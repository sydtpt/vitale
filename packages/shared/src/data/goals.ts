/**
 * Acesso à tabela `goals` — dono único (AD-4).
 *
 * Meta é declaração de intenção; o **progresso não mora aqui**. Ele é derivado
 * por `evaluateGoal` a partir das fontes (ocorrências concluídas, registros de
 * hábito, atividades), e é isso que permite a mesma meta ser medida por fontes
 * diferentes sem duplicar dado.
 *
 * `manual_current` é a exceção deliberada: metas de fonte manual não têm de
 * onde derivar, então o número é digitado e guardado.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Goal, GoalFamily, GoalPeriodKind, GoalSource } from '../models';

export interface GoalRow {
  id: string;
  year: number;
  title: string;
  cat: string | null;
  family: GoalFamily;
  source: GoalSource;
  period: GoalPeriodKind | null;
  per_period_target: number | string | null;
  target: number | string;
  unit: string | null;
  manual_current: number | string | null;
  active: boolean;
  sort: number;
  created_at: string;
}

/** Linha do Postgres → modelo de domínio. Único lugar onde essa tradução existe. */
export function toGoal(r: GoalRow): Goal {
  return {
    id: r.id,
    year: r.year,
    title: r.title,
    cat: r.cat ?? 'geral',
    family: r.family,
    source: r.source,
    period: r.period ?? undefined,
    perPeriodTarget: r.per_period_target == null ? undefined : Number(r.per_period_target),
    target: Number(r.target),
    unit: r.unit ?? undefined,
    manualCurrent: r.manual_current == null ? undefined : Number(r.manual_current),
    active: r.active,
    sort: r.sort,
    createdAt: r.created_at,
  };
}

/** Campos que uma meta aceita na criação e na edição. */
export interface GoalInput {
  year: number;
  title: string;
  cat: string;
  family: GoalFamily;
  source: GoalSource;
  target: number;
  /** `null` além de ausente: o editor limpa um campo pondo null. */
  period?: GoalPeriodKind | null;
  perPeriodTarget?: number | null;
  unit?: string | null;
  manualCurrent?: number | null;
}

/** Modelo de domínio → linha. Contraparte de `toGoal`, para escrita. */
function toRow(input: GoalInput): Record<string, unknown> {
  return {
    year: input.year,
    title: input.title,
    cat: input.cat,
    family: input.family,
    source: input.source,
    period: input.period ?? null,
    per_period_target: input.perPeriodTarget ?? null,
    target: input.target,
    unit: input.unit ?? null,
    manual_current: input.manualCurrent ?? null,
  };
}

/** Todas as metas do usuário, ativas e arquivadas, ordenadas por `sort`. */
export async function fetchGoals(db: SupabaseClient, userId: string): Promise<Goal[]> {
  const { data, error } = await db
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .order('sort');
  if (error) throw error;
  return ((data ?? []) as GoalRow[]).map(toGoal);
}

/** Cria uma meta. `sort` é calculado pelo chamador. */
export async function createGoal(
  db: SupabaseClient,
  userId: string,
  input: GoalInput,
  sort: number,
): Promise<void> {
  const { error } = await db.from('goals').insert({ user_id: userId, ...toRow(input), sort });
  if (error) throw error;
}

/** Substitui os campos editáveis de uma meta. */
export async function updateGoal(
  db: SupabaseClient,
  id: string,
  input: GoalInput,
): Promise<void> {
  const { error } = await db.from('goals').update(toRow(input)).eq('id', id);
  if (error) throw error;
}

/** Arquiva ou reativa uma meta. */
export async function setGoalActive(
  db: SupabaseClient,
  id: string,
  active: boolean,
): Promise<void> {
  const { error } = await db.from('goals').update({ active }).eq('id', id);
  if (error) throw error;
}

/** Apaga uma meta. O progresso é derivado, então nada mais precisa ser limpo. */
export async function deleteGoal(
  db: SupabaseClient,
  userId: string,
  id: string,
): Promise<void> {
  const { error } = await db.from('goals').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}
