/**
 * Filtro, ordenação e paginação (em memória) da lista de atividades de um tipo.
 * Puro/testável. Ver spec §US4/FR-008.
 */
import type { Activity } from '@vitale/shared';
import { metaForActivity } from '@core/models/activity-types';

export type RouteFilter = 'all' | 'yes' | 'no';
export type SortKey = 'date' | 'distance' | 'duration';
export type SortDir = 'asc' | 'desc';

export interface ActivityFilters {
  from?: string;           // 'YYYY-MM-DD'
  to?: string;             // 'YYYY-MM-DD'
  minDistanceKm?: number;
  maxDistanceKm?: number;
  minDurationMin?: number;
  maxDurationMin?: number;
  source?: string;         // source_name exato
  hasRoute?: RouteFilter;
}

export interface ListOptions {
  filters: ActivityFilters;
  sort: SortKey;
  dir: SortDir;
  page: number;            // 1-based
  pageSize: number;
}

export interface ActivityListResult {
  items: Activity[];       // fatia da página
  total: number;           // total filtrado
  page: number;            // página efetiva (clampada)
  pageCount: number;
  sources: string[];       // fontes distintas do tipo (antes dos filtros)
}

export const EMPTY_FILTERS: ActivityFilters = { hasRoute: 'all' };

function localYmd(iso: string): string {
  const d = new Date(iso);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? '0' + m : m}-${day < 10 ? '0' + day : day}`;
}

export function filterByType(activities: Activity[], label: string): Activity[] {
  return activities.filter((a) => metaForActivity(a.activityId).label === label);
}

export function applyFilters(items: Activity[], f: ActivityFilters): Activity[] {
  return items.filter((a) => {
    const ymd = localYmd(a.startAt);
    if (f.from && ymd < f.from) return false;
    if (f.to && ymd > f.to) return false;

    const km = (a.distanceM ?? 0) / 1000;
    if (f.minDistanceKm != null && km < f.minDistanceKm) return false;
    if (f.maxDistanceKm != null && km > f.maxDistanceKm) return false;

    const min = a.durationS / 60;
    if (f.minDurationMin != null && min < f.minDurationMin) return false;
    if (f.maxDurationMin != null && min > f.maxDurationMin) return false;

    if (f.source && a.sourceName !== f.source) return false;

    if (f.hasRoute === 'yes' && !a.hasRoute) return false;
    if (f.hasRoute === 'no' && a.hasRoute) return false;

    return true;
  });
}

function sortValue(a: Activity, key: SortKey): number {
  switch (key) {
    case 'date': return new Date(a.startAt).getTime();
    case 'distance': return a.distanceM ?? 0;
    case 'duration': return a.durationS;
  }
}

export function sortActivities(items: Activity[], key: SortKey, dir: SortDir): Activity[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => (sortValue(a, key) - sortValue(b, key)) * sign);
}

export function buildActivityList(
  activities: Activity[],
  label: string,
  opts: ListOptions,
): ActivityListResult {
  const typed = filterByType(activities, label);

  const sources = [...new Set(typed.map((a) => a.sourceName).filter((s): s is string => !!s))].sort();

  const filtered = sortActivities(applyFilters(typed, opts.filters), opts.sort, opts.dir);

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / opts.pageSize));
  const page = Math.min(Math.max(1, opts.page), pageCount);
  const start = (page - 1) * opts.pageSize;
  const items = filtered.slice(start, start + opts.pageSize);

  return { items, total, page, pageCount, sources };
}
