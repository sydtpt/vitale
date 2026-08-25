/**
 * Acesso à tabela `cultura_items` — dono único (AD-4).
 * Spec: docs/specs/cultura/spec.md
 *
 * Tabela única: não há sessões. O par `iniciado_em`/`concluido_em` é todo o
 * sinal temporal do módulo e define uma janela de consumo, nunca dias (CAP-5).
 *
 * Este módulo é o porteiro de duas garantias que o banco não impõe sozinho:
 *
 * - **CAP-13** — `tipo` não tem `check` no Postgres (é o que faz a quinta mídia
 *   custar zero migration). Quem rejeita tipo desconhecido na escrita é aqui.
 * - **CAP-12** — os `check` de coerência entre estado e datas existem na
 *   migration como última linha de defesa; validar antes é o que faz o usuário
 *   receber mensagem própria em vez de erro 23514 do Postgres.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CulturaItem } from '../models/index';
import { isTipoConhecido, type CulturaEstado, type CulturaTipo } from '../cultura/tipos';
import { fetchAllPages } from './paginate';
import {
  normalizarIndicadoPor,
  resolverPatch,
  validarItem,
  type CulturaViolacao,
} from '../cultura/estados';

const COLUMNS =
  'id,user_id,tipo,titulo,criador,estado,nota,indicado_por,fonte,fonte_id,capa_url,extra,iniciado_em,concluido_em,criado_em,atualizado_em';

export interface CulturaItemRow {
  id: string;
  user_id: string;
  tipo: string;
  titulo: string;
  criador: string | null;
  estado: CulturaEstado;
  nota: number | null;
  indicado_por: string | null;
  fonte: string | null;
  fonte_id: string | null;
  capa_url: string | null;
  extra: Record<string, unknown> | null;
  iniciado_em: string | null;
  concluido_em: string | null;
  criado_em: string;
  atualizado_em: string;
}

/** Erro de invariante. Carrega as violações para a UI exibir campo a campo. */
export class CulturaInvalidoError extends Error {
  constructor(readonly violacoes: CulturaViolacao[]) {
    super(violacoes.map((v) => v.mensagem).join(' '));
    this.name = 'CulturaInvalidoError';
  }
}

/** Linha do Postgres → modelo de domínio. Único lugar onde essa tradução existe. */
export function toCulturaItem(r: CulturaItemRow): CulturaItem {
  return {
    id: r.id,
    userId: r.user_id,
    tipo: r.tipo,
    titulo: r.titulo,
    criador: r.criador ?? undefined,
    estado: r.estado,
    nota: r.nota ?? undefined,
    indicadoPor: r.indicado_por ?? undefined,
    fonte: r.fonte ?? undefined,
    fonteId: r.fonte_id ?? undefined,
    capaUrl: r.capa_url ?? undefined,
    extra: r.extra ?? undefined,
    iniciadoEm: r.iniciado_em ?? undefined,
    concluidoEm: r.concluido_em ?? undefined,
    criadoEm: r.criado_em,
    atualizadoEm: r.atualizado_em,
  };
}

/** A estante inteira, mais recentes primeiro. */
export async function fetchCulturaItems(
  db: SupabaseClient,
  userId: string,
): Promise<CulturaItem[]> {
  const { data, error } = await db
    .from('cultura_items')
    .select(COLUMNS)
    .eq('user_id', userId)
    .order('atualizado_em', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as CulturaItemRow[]).map(toCulturaItem);
}

/**
 * Itens cuja janela de consumo intersecta o intervalo (CAP-5).
 *
 * Duas regras que fazem a consulta significar o que promete: item em curso tem
 * janela ABERTA, fechada em `hoje` para a comparação; e item em `quero` não tem
 * janela nenhuma, então fica de fora. A resolução é de janela, não de dia —
 * isto não responde "em que noites".
 */
export async function fetchCulturaItemsNaJanela(
  db: SupabaseClient,
  userId: string,
  de: string,
  ate: string,
  hoje: string,
): Promise<CulturaItem[]> {
  const data = await fetchAllPages<CulturaItemRow>((lo, hi) =>
    db
      .from('cultura_items')
      .select(COLUMNS)
      .eq('user_id', userId)
      .neq('estado', 'quero')
      .lte('iniciado_em', ate)
      .or(`concluido_em.gte.${de},and(concluido_em.is.null,${quoteDate(hoje)}.gte.${de})`)
      .order('iniciado_em', { ascending: true })
      .order('id', { ascending: true })
      .range(lo, hi),
  );
  return data
    .map(toCulturaItem)
    .filter((i) => (i.concluidoEm ?? hoje) >= de);
}

/** PostgREST espera datas sem aspas no filtro; isolado para o `or` ficar legível. */
function quoteDate(d: string): string {
  return d;
}

/** Indicadores já usados, para o autocomplete convergir grafias (CAP-11). */
export async function fetchIndicadores(db: SupabaseClient, userId: string): Promise<string[]> {
  const { data, error } = await db
    .from('cultura_items')
    .select('indicado_por')
    .eq('user_id', userId)
    .not('indicado_por', 'is', null);
  if (error) throw error;
  const vistos = new Map<string, string>();
  for (const r of (data ?? []) as Array<{ indicado_por: string }>) {
    const chave = r.indicado_por.trim().toLocaleLowerCase('pt-BR');
    if (!vistos.has(chave)) vistos.set(chave, r.indicado_por.trim());
  }
  return [...vistos.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/**
 * Item já na estante com o mesmo id de catálogo, ou `null`.
 *
 * Existe para o caminho feliz: adicionar algo que você já tem deve NAVEGAR ao
 * item existente, não estourar o unique parcial do banco na tela. A constraint
 * é rede de segurança contra corrida, não o mecanismo.
 */
export async function findCulturaItemPorFonte(
  db: SupabaseClient,
  userId: string,
  fonte: string,
  fonteId: string,
): Promise<CulturaItem | null> {
  const { data, error } = await db
    .from('cultura_items')
    .select(COLUMNS)
    .eq('user_id', userId)
    .eq('fonte', fonte)
    .eq('fonte_id', fonteId)
    .maybeSingle();
  if (error) throw error;
  return data ? toCulturaItem(data as CulturaItemRow) : null;
}

/** Campos aceitos na criação. O item pode nascer em qualquer estado (backfill). */
export interface NewCulturaItem {
  tipo: CulturaTipo;
  titulo: string;
  estado: CulturaEstado;
  criador?: string;
  nota?: number;
  indicadoPor?: string;
  fonte?: string;
  fonteId?: string;
  capaUrl?: string;
  extra?: Record<string, unknown>;
  iniciadoEm?: string;
  concluidoEm?: string;
}

/** Cria um item e devolve o id gerado. Rejeita tipo desconhecido (CAP-13). */
export async function createCulturaItem(
  db: SupabaseClient,
  userId: string,
  input: NewCulturaItem,
): Promise<string> {
  guardTipo(input.tipo);
  guardInvariantes(input);
  const { data, error } = await db
    .from('cultura_items')
    .insert({
      user_id: userId,
      tipo: input.tipo,
      titulo: input.titulo,
      criador: input.criador ?? null,
      estado: input.estado,
      nota: input.nota ?? null,
      indicado_por: normalizarIndicadoPor(input.indicadoPor) ?? null,
      fonte: input.fonte ?? null,
      fonte_id: input.fonteId ?? null,
      capa_url: input.capaUrl ?? null,
      extra: input.extra ?? null,
      iniciado_em: input.iniciadoEm ?? null,
      concluido_em: input.concluidoEm ?? null,
    })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/**
 * Campos editáveis (CAP-12). `tipo` está fora de propósito: trocá-lo
 * invalidaria `fonte`, `fonteId` e os rótulos — mudar de mídia é deletar
 * e recriar.
 */
export interface CulturaPatch {
  titulo?: string;
  criador?: string | null;
  estado?: CulturaEstado;
  nota?: number | null;
  indicadoPor?: string | null;
  capaUrl?: string | null;
  iniciadoEm?: string | null;
  concluidoEm?: string | null;
}

/**
 * Atualiza um item. Valida a coerência do resultado ANTES de escrever, com o
 * estado atual como base — é o que separa uma mensagem legível de um erro de
 * `check` do Postgres.
 */
export async function updateCulturaItem(
  db: SupabaseClient,
  atual: CulturaItem,
  patch: CulturaPatch,
): Promise<void> {
  const alvo = {
    estado: patch.estado ?? atual.estado,
    nota: resolverPatch(patch.nota, atual.nota),
    iniciadoEm: resolverPatch(patch.iniciadoEm, atual.iniciadoEm),
    concluidoEm: resolverPatch(patch.concluidoEm, atual.concluidoEm),
  };
  guardInvariantes(alvo);

  const row: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
  if (patch.titulo !== undefined) row['titulo'] = patch.titulo;
  if (patch.criador !== undefined) row['criador'] = patch.criador;
  if (patch.estado !== undefined) row['estado'] = patch.estado;
  if (patch.nota !== undefined) row['nota'] = patch.nota;
  if (patch.indicadoPor !== undefined) {
    row['indicado_por'] = normalizarIndicadoPor(patch.indicadoPor) ?? null;
  }
  if (patch.capaUrl !== undefined) row['capa_url'] = patch.capaUrl;
  if (patch.iniciadoEm !== undefined) row['iniciado_em'] = patch.iniciadoEm;
  if (patch.concluidoEm !== undefined) row['concluido_em'] = patch.concluidoEm;

  const { error } = await db.from('cultura_items').update(row).eq('id', atual.id);
  if (error) throw error;
}

/** Deleção é a única saída da estante (CAP-10): sem tombstone, de qualquer estado. */
export async function deleteCulturaItem(db: SupabaseClient, id: string): Promise<void> {
  const { error } = await db.from('cultura_items').delete().eq('id', id);
  if (error) throw error;
}

function guardTipo(tipo: string): void {
  if (!isTipoConhecido(tipo)) {
    throw new CulturaInvalidoError([
      { campo: 'estado', mensagem: `Tipo de mídia desconhecido: "${tipo}".` },
    ]);
  }
}

function guardInvariantes(item: Parameters<typeof validarItem>[0]): void {
  const violacoes = validarItem(item);
  if (violacoes.length > 0) throw new CulturaInvalidoError(violacoes);
}
