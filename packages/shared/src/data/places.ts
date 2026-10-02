/**
 * Acesso à tabela `places` — dono único (AD-4).
 *
 * Um lugar é uma janela de datas com coordenada. Quem quer saber "qual era a
 * casa nesta pedalada" não pergunta aqui: pergunta a `ancoraEm` em
 * `routes/anchor.ts`, que resolve pela vigência. Este módulo só traz as linhas.
 *
 * Mesmo desenho do `data/gear.ts`, e pela mesma razão (ADR 0034 → 0041): é uma
 * tabela de poucas linhas por usuário — duas hoje —, muito abaixo do teto de
 * 1000 do PostgREST, então não há paginação.
 *
 * As linhas são **derivadas**, não cadastradas: quem as escreve é o passe, a
 * partir dos extremos das rotas. `derived = false` marca a linha que o dono
 * corrigiu à mão, e essa o passe não toca.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { HomeAnchor } from '../routes/types';

/** Linha como o PostgREST a devolve (snake_case). */
export interface PlaceRow {
  id: string;
  user_id: string;
  kind: string;
  label: string | null;
  lat: number | string;
  lng: number | string;
  radius_m: number;
  active_from: string;
  active_to: string | null;
  derived: boolean;
}

const COLUMNS = 'id,user_id,kind,label,lat,lng,radius_m,active_from,active_to,derived';

/**
 * `numeric` do Postgres chega como **string** no PostgREST — é o mesmo cuidado
 * que `distance_m` já exige em `data/activities.ts`. Sem o `Number()`, a
 * haversine recebe texto e devolve `NaN` sem reclamar, e toda pedalada vira
 * "A → B" em silêncio.
 */
export function toHomeAnchor(r: PlaceRow): HomeAnchor {
  return {
    lat: Number(r.lat),
    lng: Number(r.lng),
    radiusM: r.radius_m,
    activeFrom: r.active_from,
    activeTo: r.active_to ?? null,
  };
}

/** As casas do usuário, em ordem de vigência. */
export async function fetchHomeAnchors(
  db: SupabaseClient,
  userId: string,
): Promise<HomeAnchor[]> {
  const { data, error } = await db
    .from('places')
    .select(COLUMNS)
    .eq('user_id', userId)
    .eq('kind', 'home')
    .order('active_from', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => toHomeAnchor(r as PlaceRow));
}

/* ── A Presença adota esta tabela (02/10/2026) ───────────────────────────── */

/**
 * O lugar como a Presença o lê — a linha inteira, não só a âncora de rota.
 *
 * `identidade` é o que **atravessa mudança de endereço**, e é por ela que toda métrica
 * agrega. A `id` é a linha: um endereço, com a janela em que ele valeu.
 */
export interface Lugar {
  id: string;
  identidade: string;
  kind: string;
  label: string | null;
  lat: number;
  lng: number;
  /** Raio da âncora de rota (400 m em produção). Não é o do geofence. */
  radiusM: number;
  /** Raio do geofence. `null` = este lugar não é monitorado. */
  geofenceRadiusM: number | null;
  geofenceSlot: number | null;
  module: string | null;
  isPrivate: boolean;
  activeFrom: string;
  activeTo: string | null;
  derived: boolean;
}

const LUGAR_COLUMNS =
  'id,user_id,identidade,kind,label,lat,lng,radius_m,geofence_radius_m,geofence_slot,module,is_private,active_from,active_to,derived';

interface LugarRow extends PlaceRow {
  identidade: string;
  geofence_radius_m: number | null;
  geofence_slot: number | null;
  module: string | null;
  is_private: boolean;
}

function toLugar(r: LugarRow): Lugar {
  return {
    id: r.id,
    identidade: r.identidade,
    kind: r.kind,
    label: r.label,
    lat: Number(r.lat),
    lng: Number(r.lng),
    radiusM: r.radius_m,
    geofenceRadiusM: r.geofence_radius_m,
    geofenceSlot: r.geofence_slot,
    module: r.module,
    isPrivate: r.is_private,
    activeFrom: r.active_from,
    activeTo: r.active_to ?? null,
    derived: r.derived,
  };
}

/** Todos os lugares, de todas as identidades, em ordem de vigência. */
export async function fetchLugares(db: SupabaseClient, userId: string): Promise<Lugar[]> {
  const { data, error } = await db
    .from('places')
    .select(LUGAR_COLUMNS)
    .eq('user_id', userId)
    .is('archived_at', null)
    .order('identidade', { ascending: true })
    .order('active_from', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => toLugar(r as LugarRow));
}

/** O lugar vigente de uma identidade num dia — a linha que valia naquela data. */
export function vigenteEm(lugares: readonly Lugar[], identidade: string, ymd: string): Lugar | undefined {
  return lugares
    .filter((l) => l.identidade === identidade && l.activeFrom <= ymd && (l.activeTo === null || l.activeTo >= ymd))
    .sort((a, b) => b.activeFrom.localeCompare(a.activeFrom))[0];
}

export interface EnderecoNovo {
  lat: number;
  lng: number;
  geofenceRadiusM: number;
  label?: string;
  /** Primeiro dia em que o endereço novo vale. O anterior fecha na véspera. */
  a_partir_de: string;
}

/**
 * **Mudar de endereço sem perder métrica.**
 *
 * É a operação que a exigência do dono criou, em 02/10/2026: *"se eu mudar de casa,
 * mudarei o local mas não quero perder as métricas"*. Ela existe como função nomeada
 * justamente para ninguém a reinventar errado — e o jeito errado é tentador: **editar
 * `lat`/`lng` da linha**. Isso preservaria a métrica e apagaria a história, e a feature
 * de nome das rotas, que pergunta "onde era a casa naquela pedalada", passaria a
 * responder com o endereço novo para pedaladas de dois anos atrás.
 *
 * O jeito certo são duas linhas: fecha a vigente na véspera, abre outra com a **mesma
 * identidade**. As visitas antigas continuam apontando para a linha antiga, e a métrica
 * — que agrega por identidade — atravessa.
 *
 * Não é transação: são duas chamadas. Se a segunda falhar, o estado que sobra é "sem
 * endereço vigente", que a tela mostra e o dono corrige — o mesmo raciocínio de
 * `applyGearWindows`. O inverso (abrir antes de fechar) deixaria dois endereços vigentes
 * ao mesmo tempo, que é o estado que o casamento ponto↔lugar não sabe resolver.
 */
export async function mudarDeEndereco(
  db: SupabaseClient,
  userId: string,
  identidade: string,
  novo: EnderecoNovo,
): Promise<void> {
  const vespera = new Date(`${novo.a_partir_de}T12:00:00Z`);
  vespera.setUTCDate(vespera.getUTCDate() - 1);
  const fim = vespera.toISOString().slice(0, 10);

  const { error: erroFechar } = await db
    .from('places')
    .update({ active_to: fim })
    .eq('user_id', userId)
    .eq('identidade', identidade)
    .is('active_to', null);
  if (erroFechar) throw erroFechar;

  const atual = await fetchLugares(db, userId);
  const anterior = atual.find((l) => l.identidade === identidade);

  const { error } = await db.from('places').insert({
    user_id: userId,
    identidade,
    kind: anterior?.kind ?? 'other',
    label: novo.label ?? anterior?.label ?? null,
    lat: novo.lat,
    lng: novo.lng,
    radius_m: anterior?.radiusM ?? 400,
    geofence_radius_m: novo.geofenceRadiusM,
    geofence_slot: anterior?.geofenceSlot ?? null,
    module: anterior?.module ?? null,
    is_private: anterior?.isPrivate ?? false,
    active_from: novo.a_partir_de,
    derived: false,
  });
  if (error) throw error;
}

export interface LugarNovo {
  identidade: string;
  kind: string;
  label: string;
  lat: number;
  lng: number;
  geofenceRadiusM: number;
  geofenceSlot?: number | null;
  module?: string | null;
  isPrivate?: boolean;
  /** Primeiro dia em que este endereço vale. Padrão: hoje. */
  activeFrom?: string;
}

/**
 * Cadastra um lugar.
 *
 * `radius_m` recebe o padrão da âncora de rota (400 m) porque a coluna é `not null` e
 * pertence à outra feature — a Presença não tem opinião sobre ela. O raio que a
 * Presença usa é o `geofence_radius_m`, e os dois existem porque respondem a perguntas
 * diferentes (ver a migração `20261002120000`).
 *
 * `derived = false` marca que foi o dono quem cadastrou. É o contrato que já existia
 * nesta tabela, e é o que diz ao passe de rotas para não tocar nesta linha.
 */
export async function criarLugar(
  db: SupabaseClient,
  userId: string,
  novo: LugarNovo,
): Promise<string> {
  const { data, error } = await db
    .from('places')
    .insert({
      user_id: userId,
      identidade: novo.identidade,
      kind: novo.kind,
      label: novo.label,
      lat: novo.lat,
      lng: novo.lng,
      radius_m: 400,
      geofence_radius_m: novo.geofenceRadiusM,
      geofence_slot: novo.geofenceSlot ?? null,
      module: novo.module ?? null,
      is_private: novo.isPrivate ?? false,
      active_from: novo.activeFrom ?? new Date().toISOString().slice(0, 10),
      derived: false,
    })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}
