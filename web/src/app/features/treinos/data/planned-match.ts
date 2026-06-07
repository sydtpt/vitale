/**
 * Derivações puras do planner de treinos (web). Sem I/O.
 *
 * Auto-match: um `PlannedWorkout` fica `done` quando existe uma `Activity`
 * sincronizada (não-oculta) no mesmo dia local. Havendo várias, prefere a de
 * `kind` compatível; o id da escolhida vai em `doneActivityId`. Dias de
 * descanso (`rest`) não auto-completam — não há como detectar "descansou".
 */
import type { Activity, PlannedWorkout, WorkoutKind } from '@vitale/shared';
import { GPS_ACTIVITY_IDS } from '@core/models/activity-types';

/** Data local 'YYYY-MM-DD' de uma `Date` (não UTC). */
export function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Data local 'YYYY-MM-DD' de um instante ISO (não UTC). */
export function localDateOf(iso: string): string {
  return localDateStr(new Date(iso));
}

/** As 7 datas (seg→dom) da semana que contém `d`, como 'YYYY-MM-DD'. */
export function weekDatesOf(d: Date = new Date()): string[] {
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (monday.getDay() + 6) % 7; // 0 = segunda
  monday.setDate(monday.getDate() - dow);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    return localDateStr(day);
  });
}

/** Tipos HealthKit de musculação/força. */
const STRENGTH_IDS = new Set<number>([11, 20, 35, 50, 59]);
/** Tipos de baixa intensidade (mobilidade, yoga, caminhada). */
const EASY_IDS = new Set<number>([52, 57, 66]);

/**
 * Intensidade de uma atividade sincronizada, para casar com o `kind` planejado.
 * Endurance: outdoor com distância (corrida/bike/trilha) + natação/cardio.
 */
export function kindForActivity(activityId: number): WorkoutKind {
  if (GPS_ACTIVITY_IDS.has(activityId) || activityId === 46 || activityId === 73) return 'endurance';
  if (STRENGTH_IDS.has(activityId)) return 'strength';
  if (EASY_IDS.has(activityId)) return 'easy';
  return 'none';
}

/**
 * Devolve os treinos planejados com `done`/`doneActivityId` recalculados a
 * partir das atividades. Imutável: não muta a entrada. Treinos `rest` ficam
 * inalterados.
 */
export function autoMatch(planned: PlannedWorkout[], activities: Activity[]): PlannedWorkout[] {
  const byDate = new Map<string, Activity[]>();
  for (const a of activities) {
    if (a.hidden) continue;
    const date = localDateOf(a.startAt);
    const arr = byDate.get(date);
    if (arr) arr.push(a);
    else byDate.set(date, [a]);
  }

  return planned.map(p => {
    if (p.kind === 'rest') return p;
    const sameDay = byDate.get(p.date);
    if (!sameDay || sameDay.length === 0) {
      return p.done ? { ...p, done: false, doneActivityId: undefined } : p;
    }
    const match = sameDay.find(a => kindForActivity(a.activityId) === p.kind) ?? sameDay[0];
    if (p.done && p.doneActivityId === match.id) return p;
    return { ...p, done: true, doneActivityId: match.id };
  });
}
