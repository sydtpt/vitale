/**
 * Acesso à tabela `habits` — dono único (AD-4).
 *
 * Registrar valor **não** passa por aqui: vai pelas RPCs `habit_log_add`
 * (incremento do dia) e `habit_log_set` (fixar valor, edição de passado), que
 * resolvem concorrência no banco. O módulo cobre a série do hábito; o registro
 * diário é de `habit-logs.ts`.
 *
 * `fetchHabits` traz **todos**, ativos e arquivados. Filtrar por `active` é
 * decisão de tela e se faz em memória — o mobile consultava só os ativos num
 * caminho e todos noutro, a mesma divergência que `todo_templates` tinha.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CounterHabit } from '../models';
import { localDateStr } from '../date/local';

const COLUMNS =
  'id,name,icon,color,unit,step,target,direction,bad,show_on_home,active,sort,created_at';

export interface HabitRow {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  unit: CounterHabit['unit'];
  step: number | string;
  target: number | string | null;
  direction: CounterHabit['direction'];
  bad: boolean | null;
  show_on_home: boolean | null;
  active: boolean;
  sort: number;
  created_at: string;
}

/** Linha do Postgres → modelo de domínio. Único lugar onde essa tradução existe. */
export function toCounterHabit(r: HabitRow): CounterHabit {
  return {
    id: r.id,
    name: r.name,
    icon: r.icon ?? '',
    color: r.color ?? '',
    unit: r.unit,
    step: Number(r.step),
    target: r.target == null ? undefined : Number(r.target),
    direction: r.direction,
    bad: r.bad ?? false,
    showOnHome: r.show_on_home ?? true,
    active: r.active,
    sort: r.sort,
    createdAt: r.created_at,
  };
}

/** Todos os hábitos do usuário, ativos e arquivados, ordenados por `sort`. */
export async function fetchHabits(db: SupabaseClient, userId: string): Promise<CounterHabit[]> {
  const { data, error } = await db
    .from('habits')
    .select(COLUMNS)
    .eq('user_id', userId)
    .order('sort', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as HabitRow[]).map(toCounterHabit);
}

/** Quantos hábitos o usuário tem — sem trazer as linhas. */
export async function countHabits(db: SupabaseClient, userId: string): Promise<number> {
  const { count, error } = await db
    .from('habits')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) throw error;
  return count ?? 0;
}

/** Hábitos em forma reduzida — usado pela retrospectiva, que só rotula. */
export async function fetchHabitSummaries(
  db: SupabaseClient,
  userId: string,
): Promise<Array<{ id: string; name: string; bad: boolean; unit: CounterHabit['unit']; createdOn: string }>> {
  const { data, error } = await db
    .from('habits')
    .select('id,name,bad,unit,created_at')
    .eq('user_id', userId);
  if (error) throw error;
  return ((data ?? []) as Array<{
    id: string;
    name: string;
    bad: boolean | null;
    unit: CounterHabit['unit'];
    created_at: string;
  }>).map((r) => ({
    id: r.id,
    name: r.name,
    bad: r.bad ?? false,
    unit: r.unit,
    // Dia de criação: é o piso da amostra em `triggerImpact`. Sem ele o hábito
    // seria comparado contra dias em que não existia (ver `RetroHabit.createdOn`).
    createdOn: localDateStr(new Date(r.created_at)),
  }));
}

/** Campos aceitos na criação. `sort` é calculado pelo chamador. */
export interface NewHabit {
  name: string;
  icon: string;
  color: string;
  unit: CounterHabit['unit'];
  step: number;
  direction: CounterHabit['direction'];
  sort: number;
  target?: number | null;
  bad?: boolean;
  showOnHome?: boolean;
}

/** Cria um hábito e devolve o id gerado. */
export async function createHabit(
  db: SupabaseClient,
  userId: string,
  input: NewHabit,
): Promise<string> {
  const { data, error } = await db
    .from('habits')
    .insert({
      user_id: userId,
      name: input.name,
      icon: input.icon,
      color: input.color,
      unit: input.unit,
      step: input.step,
      target: input.target ?? null,
      direction: input.direction,
      bad: input.bad ?? false,
      show_on_home: input.showOnHome ?? true,
      sort: input.sort,
    })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/** Atualiza campos de um hábito. Patch em nomes de coluna, conferido pelo tipo. */
export async function updateHabit(
  db: SupabaseClient,
  id: string,
  patch: Partial<HabitRow>,
): Promise<void> {
  const { error } = await db.from('habits').update(patch).eq('id', id);
  if (error) throw error;
}

/** Arquiva ou reativa um hábito. */
export async function setHabitActive(
  db: SupabaseClient,
  id: string,
  active: boolean,
): Promise<void> {
  const { error } = await db.from('habits').update({ active }).eq('id', id);
  if (error) throw error;
}
