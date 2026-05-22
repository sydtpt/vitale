/**
 * Filtro e ordenação (em memória) da lista de atividades de um tipo.
 * Puro/testável. Paginação fica no componente (slice + load-more). Ver §US4/FR-008.
 */
import type { Activity } from '@vitale/shared';
import { getActivityMeta } from './workout-types';

export interface ActivityFilters {
  fromDate?: string; // 'YYYY-MM-DD'
  toDate?: string; // 'YYYY-MM-DD'
  minDistanceM?: number;
  maxDistanceM?: number;
  minDurationS?: number;
  maxDurationS?: number;
  sourceName?: string;
  hasRoute?: boolean; // undefined = todos
}

/** Critérios de ordenação da lista. `date-desc` é o default (mais recentes primeiro). */
export type ActivitySort =
  | 'date-desc'
  | 'date-asc'
  | 'distance-desc'
  | 'distance-asc'
  | 'duration-desc'
  | 'duration-asc';

export const SORT_OPTIONS: { key: ActivitySort; label: string }[] = [
  { key: 'date-desc', label: 'Mais recentes' },
  { key: 'date-asc', label: 'Mais antigas' },
  { key: 'distance-desc', label: 'Maior distância' },
  { key: 'distance-asc', label: 'Menor distância' },
  { key: 'duration-desc', label: 'Maior duração' },
  { key: 'duration-asc', label: 'Menor duração' },
];

function sortComparator(sort: ActivitySort): (a: Activity, b: Activity) => number {
  switch (sort) {
    case 'date-asc':
      return (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
    case 'distance-desc':
      return (a, b) => (b.distanceM ?? 0) - (a.distanceM ?? 0);
    case 'distance-asc':
      return (a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0);
    case 'duration-desc':
      return (a, b) => b.durationS - a.durationS;
    case 'duration-asc':
      return (a, b) => a.durationS - b.durationS;
    case 'date-desc':
    default:
      return (a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime();
  }
}

function localYmd(iso: string): string {
  const d = new Date(iso);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? '0' + m : m}-${day < 10 ? '0' + day : day}`;
}

export function filterByType(activities: Activity[], label: string): Activity[] {
  return activities.filter((a) => getActivityMeta(a.activityId).label === label);
}

export function applyFilters(
  activities: Activity[],
  f: ActivityFilters,
  sort: ActivitySort = 'date-desc',
): Activity[] {
  return activities
    .filter((a) => {
      const ymd = localYmd(a.startAt);
      if (f.fromDate && ymd < f.fromDate) return false;
      if (f.toDate && ymd > f.toDate) return false;

      const dist = a.distanceM ?? 0;
      if (f.minDistanceM != null && dist < f.minDistanceM) return false;
      if (f.maxDistanceM != null && dist > f.maxDistanceM) return false;

      if (f.minDurationS != null && a.durationS < f.minDurationS) return false;
      if (f.maxDurationS != null && a.durationS > f.maxDurationS) return false;

      if (f.sourceName && a.sourceName !== f.sourceName) return false;

      if (f.hasRoute != null && a.hasRoute !== f.hasRoute) return false;

      return true;
    })
    .sort(sortComparator(sort));
}

/** Fontes distintas (source_name) presentes no conjunto, ordenadas. */
export function distinctSources(activities: Activity[]): string[] {
  return [...new Set(activities.map((a) => a.sourceName).filter((s): s is string => !!s))].sort();
}
