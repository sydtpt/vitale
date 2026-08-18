/**
 * Acesso à tabela `planned_workouts` — dono único (AD-4).
 *
 * Treino planejado é intenção da semana; o `done` **não** vem do banco. Ele é
 * derivado pelo auto-match (`planner/planned-match`), casando o plano com as
 * atividades sincronizadas do mesmo dia. Por isso `toPlannedWorkout` sempre
 * devolve `done: false`: quem resolve é `autoMatch`, e gravar o estado no banco
 * criaria uma segunda verdade para conciliar.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PlannedWorkout } from '../models';

const COLUMNS = 'id,plan_date,type,kind,dur_min,dist_km,sort,created_at';

export interface PlannedWorkoutRow {
  id: string;
  plan_date: string;
  type: string;
  kind: PlannedWorkout['kind'];
  dur_min: number | string;
  dist_km: number | string | null;
  sort: number;
  created_at: string;
}

/** Linha do Postgres → modelo de domínio. Único lugar onde essa tradução existe. */
export function toPlannedWorkout(r: PlannedWorkoutRow): PlannedWorkout {
  return {
    id: r.id,
    date: r.plan_date,
    type: r.type,
    kind: r.kind,
    durMin: Number(r.dur_min),
    distKm: r.dist_km == null ? undefined : Number(r.dist_km),
    done: false,
    sort: r.sort,
    createdAt: r.created_at,
  };
}

/** Treinos planejados num intervalo fechado de datas, ordenados por `sort`. */
export async function fetchPlannedWorkouts(
  db: SupabaseClient,
  userId: string,
  fromDate: string,
  toDate: string,
): Promise<PlannedWorkout[]> {
  const { data, error } = await db
    .from('planned_workouts')
    .select(COLUMNS)
    .eq('user_id', userId)
    .gte('plan_date', fromDate)
    .lte('plan_date', toDate)
    .order('sort', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as PlannedWorkoutRow[]).map(toPlannedWorkout);
}

/** Campos aceitos na criação. `sort` é calculado pelo chamador. */
export interface NewPlannedWorkout {
  date: string;
  type: string;
  kind: PlannedWorkout['kind'];
  durMin: number;
  distKm?: number | null;
  sort: number;
}

/**
 * Coerência entre `kind` e as medidas. Descanso não tem duração; distância só
 * faz sentido em endurance. O mobile já aplicava isso na escrita e a web não —
 * criar um dia de descanso pela web gravava a duração que estivesse no
 * formulário. Aplicar aqui elimina a divergência por construção.
 */
function coherentMeasures(
  kind: PlannedWorkout['kind'],
  durMin: number | undefined,
  distKm: number | null | undefined,
): { dur_min: number; dist_km: number | null } {
  return {
    dur_min: kind === 'rest' ? 0 : (durMin ?? 0),
    dist_km: kind === 'endurance' ? (distKm ?? null) : null,
  };
}

/** Cria um treino planejado e devolve o modelo. */
export async function createPlannedWorkout(
  db: SupabaseClient,
  userId: string,
  input: NewPlannedWorkout,
): Promise<PlannedWorkout> {
  const { data, error } = await db
    .from('planned_workouts')
    .insert({
      user_id: userId,
      plan_date: input.date,
      type: input.type,
      kind: input.kind,
      ...coherentMeasures(input.kind, input.durMin, input.distKm),
      sort: input.sort,
    })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return toPlannedWorkout(data as PlannedWorkoutRow);
}

/** Atualiza um treino planejado e devolve o modelo já atualizado. */
export async function updatePlannedWorkout(
  db: SupabaseClient,
  userId: string,
  id: string,
  input: { type: string; kind: PlannedWorkout['kind']; durMin: number; distKm?: number | null },
): Promise<PlannedWorkout> {
  const { data, error } = await db
    .from('planned_workouts')
    .update({
      type: input.type,
      kind: input.kind,
      ...coherentMeasures(input.kind, input.durMin, input.distKm),
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return toPlannedWorkout(data as PlannedWorkoutRow);
}

/** Apaga um treino planejado. */
export async function deletePlannedWorkout(
  db: SupabaseClient,
  userId: string,
  id: string,
): Promise<void> {
  const { error } = await db
    .from('planned_workouts')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}

/**
 * Atualização parcial: só os campos presentes no patch são escritos. Mexer em
 * `kind` arrasta as medidas para manter a coerência — descanso zera duração,
 * sair de endurance limpa distância.
 */
export async function patchPlannedWorkout(
  db: SupabaseClient,
  userId: string,
  id: string,
  patch: {
    type?: string;
    kind?: PlannedWorkout['kind'];
    durMin?: number;
    distKm?: number | null;
  },
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.type !== undefined) row['type'] = patch.type;
  if (patch.kind !== undefined) {
    row['kind'] = patch.kind;
    if (patch.kind === 'rest') row['dur_min'] = 0;
    if (patch.kind !== 'endurance') row['dist_km'] = null;
  }
  if (patch.durMin !== undefined) row['dur_min'] = patch.durMin;
  if (patch.distKm !== undefined) row['dist_km'] = patch.distKm;
  const { error } = await db
    .from('planned_workouts')
    .update(row)
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}
