/**
 * Acesso a `visits`, `place_days` e `forgotten_days` — dono único (AD-4).
 *
 * As três tabelas da Presença numa porta só, porque elas só fazem sentido juntas: a
 * visita é o fato, o rollup é como ele é lido, e a lápide é o que foi apagado. `places`
 * tem dono próprio e mais antigo — [`places.ts`](./places.ts) —, e esta feature o
 * **adota** em vez de criar outra tabela de lugar.
 *
 * ## Idempotência: `client_event_id`, não `id`
 *
 * A fila do aparelho pode reenviar o mesmo evento — rede caiu, o iOS matou o app no meio,
 * o `retry` entrou. Então a escrita é `upsert` por `(user_id, client_event_id)`, que é o
 * id do evento **no aparelho** (`placeId:kind:instante`): a mesma travessia reenviada
 * atualiza a linha em vez de criar outra.
 *
 * É o mesmo id que o log local já usa para deduplicar desde a Fase 0. Levá-lo até o banco
 * faz a fila e a semeadura dos 24 dias serem idempotentes **pelo mesmo mecanismo**, em
 * vez de dois.
 *
 * ## A visita aberta é reenviada de propósito
 *
 * Uma visita em curso sobe com `departed_at` nulo e volta a subir quando fecha. Não é
 * desperdício: é como a saída chega ao banco sem um segundo canal. O `upsert` cuida.
 *
 * ## `place_days` não escapa do teto de 1000 por existir
 *
 * O rollup existe porque o PostgREST corta em 1000 linhas **sem erro**, e ler um ano de
 * `visits` devolveria um ano curto e calado. Mas um ano de `place_days` com três lugares
 * são ~1100 linhas — **ele mesmo passa do teto**. A leitura longa pagina
 * ({@link fetchAllPages}) e ordena por `(day, place_id)`, que é único por construção
 * graças ao índice `place_days_chave`.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAllPages } from './paginate';

/* ── visits ──────────────────────────────────────────────────────────────── */

const VISIT_COLUMNS =
  'id,user_id,place_id,source,client_event_id,arrived_at,departed_at,departed_source,tz,lat,lng,accuracy_m,status,merged_into,agg_version';

export interface VisitRow {
  id: string;
  user_id: string;
  place_id: string | null;
  source: 'geofence' | 'clvisit' | 'manual';
  client_event_id: string | null;
  arrived_at: string;
  departed_at: string | null;
  departed_source: 'geofence' | 'clvisit' | 'inferred' | 'manual' | null;
  tz: string;
  lat: number | null;
  lng: number | null;
  accuracy_m: number | null;
  status: 'provisional' | 'confirmed' | 'merged';
  merged_into: string | null;
  agg_version: number;
}

/** O que o aparelho tem para enviar. `id` é do banco e não vem daqui. */
export interface VisitaParaEnviar {
  placeId: string | null;
  source: 'geofence' | 'clvisit' | 'manual';
  clientEventId: string;
  arrivedAt: string;
  departedAt: string | null;
  departedSource: 'geofence' | 'clvisit' | 'inferred' | 'manual' | null;
  tz: string;
  lat?: number | null;
  lng?: number | null;
  accuracyM?: number | null;
  status?: 'provisional' | 'confirmed' | 'merged';
}

/** Quantas visitas por chamada. Lote grande demais estoura o corpo da requisição. */
export const VISITAS_POR_LOTE = 200;

/**
 * Envia visitas, deduplicando por `client_event_id`.
 *
 * Em lotes, e **parando no primeiro erro**: o que já subiu continua valendo, e a fila
 * reenvia o resto na próxima — a idempotência é o que torna isso seguro. Tentar
 * continuar depois de um erro só esconderia a causa.
 */
export async function enviarVisitas(
  db: SupabaseClient,
  userId: string,
  visitas: readonly VisitaParaEnviar[],
): Promise<number> {
  let enviadas = 0;
  for (let i = 0; i < visitas.length; i += VISITAS_POR_LOTE) {
    const lote = visitas.slice(i, i + VISITAS_POR_LOTE).map((v) => ({
      user_id: userId,
      place_id: v.placeId,
      source: v.source,
      client_event_id: v.clientEventId,
      arrived_at: v.arrivedAt,
      departed_at: v.departedAt,
      departed_source: v.departedSource,
      tz: v.tz,
      lat: v.lat ?? null,
      lng: v.lng ?? null,
      accuracy_m: v.accuracyM ?? null,
      status: v.status ?? 'provisional',
    }));
    const { error } = await db
      .from('visits')
      .upsert(lote, { onConflict: 'user_id,client_event_id' });
    if (error) throw error;
    enviadas += lote.length;
  }
  return enviadas;
}

/** Visitas de uma janela de dias, pela chegada. Pagina: um ano pode passar de 1000. */
export async function fetchVisitas(
  db: SupabaseClient,
  userId: string,
  de: string,
  ate: string,
): Promise<VisitRow[]> {
  return fetchAllPages<VisitRow>((from, to) =>
    db
      .from('visits')
      .select(VISIT_COLUMNS)
      .eq('user_id', userId)
      .gte('arrived_at', `${de}T00:00:00Z`)
      .lte('arrived_at', `${ate}T23:59:59Z`)
      .order('arrived_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to),
  );
}

/* ── place_days ──────────────────────────────────────────────────────────── */

const DAY_COLUMNS =
  'user_id,day,place_id,identidade,seconds,arrivals,inferred_edges,incomplete';

export interface PlaceDayRow {
  user_id: string;
  day: string;
  place_id: string | null;
  identidade: string | null;
  seconds: number;
  arrivals: number;
  inferred_edges: number;
  incomplete: boolean;
}

export interface DiaParaGravar {
  day: string;
  placeId: string | null;
  identidade: string | null;
  seconds: number;
  arrivals: number;
  inferredEdges: number;
  incomplete?: boolean;
}

/**
 * Grava o rollup de um período.
 *
 * `onConflict` é a chave do índice `place_days_chave`, que usa `nulls not distinct`
 * — sem isso o lugar "fora" (`place_id` nulo) duplicaria a cada recálculo, porque em
 * SQL nulo não é igual a nulo.
 */
export async function gravarPlaceDays(
  db: SupabaseClient,
  userId: string,
  dias: readonly DiaParaGravar[],
): Promise<void> {
  if (dias.length === 0) return;
  const { error } = await db.from('place_days').upsert(
    dias.map((d) => ({
      user_id: userId,
      day: d.day,
      place_id: d.placeId,
      identidade: d.identidade,
      seconds: Math.round(d.seconds),
      arrivals: d.arrivals,
      inferred_edges: d.inferredEdges,
      incomplete: d.incomplete ?? false,
    })),
    { onConflict: 'user_id,day,place_id' },
  );
  if (error) throw error;
}

/** O rollup de uma janela. **Esta é a leitura longa** — por isso pagina. */
export async function fetchPlaceDays(
  db: SupabaseClient,
  userId: string,
  de: string,
  ate: string,
): Promise<PlaceDayRow[]> {
  return fetchAllPages<PlaceDayRow>((from, to) =>
    db
      .from('place_days')
      .select(DAY_COLUMNS)
      .eq('user_id', userId)
      .gte('day', de)
      .lte('day', ate)
      .order('day', { ascending: true })
      .order('place_id', { ascending: true, nullsFirst: true })
      .range(from, to),
  );
}

/* ── forgotten_days ──────────────────────────────────────────────────────── */

export interface ForgottenDayRow {
  user_id: string;
  day: string;
  seconds: number;
  visits: number;
}

/**
 * Credita uma lápide — e **soma**, nunca substitui.
 *
 * Esquecer duas coisas no mesmo dia tem de somar os dois tempos. Um `upsert` simples
 * sobrescreveria a primeira lápide com a segunda, e o dia passaria a dizer que se
 * esqueceu menos do que se esqueceu. O chamador soma antes de gravar; esta porta só
 * recusa valor negativo, que o `CHECK` do banco também recusa.
 */
export async function gravarLapides(
  db: SupabaseClient,
  userId: string,
  lapides: readonly { day: string; seconds: number; visits: number }[],
): Promise<void> {
  if (lapides.length === 0) return;
  const { error } = await db.from('forgotten_days').upsert(
    lapides.map((l) => ({
      user_id: userId,
      day: l.day,
      seconds: Math.max(0, Math.round(l.seconds)),
      visits: Math.max(0, l.visits),
    })),
    { onConflict: 'user_id,day' },
  );
  if (error) throw error;
}

export async function fetchLapides(
  db: SupabaseClient,
  userId: string,
  de: string,
  ate: string,
): Promise<ForgottenDayRow[]> {
  const { data, error } = await db
    .from('forgotten_days')
    .select('user_id,day,seconds,visits')
    .eq('user_id', userId)
    .gte('day', de)
    .lte('day', ate)
    .order('day', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ForgottenDayRow[];
}
