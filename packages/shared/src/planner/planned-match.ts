/**
 * Derivações puras do planner de treinos — fonte única. Sem I/O.
 *
 * Auto-match: um `PlannedWorkout` fica `done` quando existe uma `Activity`
 * sincronizada (não-oculta) no mesmo dia local. Havendo várias, prefere a de
 * `kind` compatível; o id da escolhida vai em `doneActivityId`. Dias de
 * descanso (`rest`) não auto-completam — não há como detectar "descansou".
 */
import type { Activity, PlannedWorkout } from '../models';
import { kindForActivity } from '../fitness/activity-types';
import { localDateOf, localDateStr } from '../date/local';

export { kindForActivity };

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

  return planned.map((p) => {
    if (p.kind === 'rest') return p;
    const sameDay = byDate.get(p.date);
    if (!sameDay || sameDay.length === 0) {
      return p.done ? { ...p, done: false, doneActivityId: undefined } : p;
    }
    const match = sameDay.find((a) => kindForActivity(a.activityId) === p.kind) ?? sameDay[0];
    if (p.done && p.doneActivityId === match.id) return p;
    return { ...p, done: true, doneActivityId: match.id };
  });
}

const DOW = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];

export interface PlannedDay {
  date: string;
  /** 'SEG'…'DOM' */
  label: string;
  isToday: boolean;
  workouts: PlannedWorkout[];
}

/**
 * Grade seg→dom da semana corrente, cada dia com seus treinos já resolvidos
 * pelo auto-match e ordenados por `sort`.
 */
export function buildWeek(planned: PlannedWorkout[], activities: Activity[]): PlannedDay[] {
  const today = localDateStr();
  const resolved = autoMatch(planned, activities);
  const byDate = new Map<string, PlannedWorkout[]>();
  for (const p of resolved) {
    const arr = byDate.get(p.date);
    if (arr) arr.push(p);
    else byDate.set(p.date, [p]);
  }
  return weekDatesOf().map((date, i) => ({
    date,
    label: DOW[i],
    isToday: date === today,
    workouts: (byDate.get(date) ?? []).sort((a, b) => a.sort - b.sort),
  }));
}
