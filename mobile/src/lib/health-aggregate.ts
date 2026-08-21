/**
 * Agregação pura de amostras do HealthKit → linhas diárias (`health_daily`).
 * Sem dependência nativa — testável isoladamente (espelha `activity-map.ts`).
 *
 * É AQUI que mora a otimização de volume: as milhares de amostras brutas de
 * frequência cardíaca (e afins) viram ~1 linha/dia ANTES de tocar a rede.
 */
import type { Sample } from './health-buckets';

/** Linha da tabela `health_daily` (snake_case, como no Postgres). */
export interface HealthDailyRow {
  user_id: string;
  day: string; // 'YYYY-MM-DD' (data local)
  metric: string;
  value: number | null;
  min_value?: number | null;
  max_value?: number | null;
  count?: number | null;
  extra?: Record<string, unknown> | null;
}

/** Metadados mínimos necessários para escolher a estratégia de agregação. */
export interface AggregateMeta {
  id: string;
  kind: 'cumulative' | 'discrete';
}

/** 'YYYY-MM-DD' local de um ISO (a data do dia, não UTC). */
export function localDay(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Agrupa amostras por dia local (preservando a ordem de chegada). */
function groupByDay(samples: Sample[]): Map<string, Sample[]> {
  const map = new Map<string, Sample[]>();
  for (const s of samples) {
    const day = localDay(s.start);
    const arr = map.get(day);
    if (arr) arr.push(s);
    else map.set(day, [s]);
  }
  return map;
}

/** Cumulativas (passos, energia, sono…): soma do dia. */
export function aggregateCumulative(samples: Sample[], metricId: string, userId: string): HealthDailyRow[] {
  const rows: HealthDailyRow[] = [];
  for (const [day, group] of groupByDay(samples)) {
    const total = group.reduce((a, s) => a + s.value, 0);
    rows.push({ user_id: userId, day, metric: metricId, value: total, count: group.length });
  }
  return rows;
}

/** Discretas (FC, peso…): média + faixa (min/max) + nº de amostras do dia. */
export function aggregateDiscrete(samples: Sample[], metricId: string, userId: string): HealthDailyRow[] {
  const rows: HealthDailyRow[] = [];
  for (const [day, group] of groupByDay(samples)) {
    const values = group.map((s) => s.value);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    rows.push({
      user_id: userId,
      day,
      metric: metricId,
      value: avg,
      min_value: Math.min(...values),
      max_value: Math.max(...values),
      count: values.length,
    });
  }
  return rows;
}

/** Pressão arterial: sistólica em `value`/min/max; diastólica média em `extra`. */
export function aggregatePressure(samples: Sample[], userId: string): HealthDailyRow[] {
  const rows: HealthDailyRow[] = [];
  for (const [day, group] of groupByDay(samples)) {
    const sys = group.map((s) => s.value);
    const dia = group.map((s) => s.extra ?? 0);
    const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    const sysAvg = avg(sys);
    rows.push({
      user_id: userId,
      day,
      metric: 'pressao',
      value: sysAvg,
      min_value: Math.min(...sys),
      max_value: Math.max(...sys),
      count: group.length,
      extra: { sys: sysAvg, dia: avg(dia) },
    });
  }
  return rows;
}

/**
 * Sono: soma as horas das noites atribuídas ao dia e leva o detalhamento por
 * estágio (que `aggregateSleepNights` já entrega em `stages`) para o `extra`.
 * Sem isso, 7h de sono com 20min de REM e 7h com 1h40 de REM viravam a mesma linha.
 */
export function aggregateSleep(samples: Sample[], userId: string): HealthDailyRow[] {
  const rows: HealthDailyRow[] = [];
  for (const [day, group] of groupByDay(samples)) {
    const total = group.reduce((a, s) => a + s.value, 0);
    const stages: Record<string, number> = {};
    for (const s of group) {
      for (const [stage, hours] of Object.entries(s.stages ?? {})) {
        stages[stage] = (stages[stage] ?? 0) + hours;
      }
    }
    rows.push({
      user_id: userId,
      day,
      metric: 'sono',
      value: total,
      count: group.length,
      // Fonte sem hipnograma (só ASLEEP genérico) não gera estágio: `extra` fica nulo.
      extra: Object.keys(stages).length > 0 ? stages : null,
    });
  }
  return rows;
}

/**
 * Anéis de atividade: o `ringsFetch` traz só o resumo mais recente (3 amostras),
 * logo gera 1 linha para o dia atual com mover/exercício/em pé + metas em `extra`.
 */
export function aggregateRings(samples: Sample[], userId: string): HealthDailyRow[] {
  if (samples.length === 0) return [];
  const keys = ['move', 'exercise', 'stand'];
  const extra: Record<string, { value: number; goal: number }> = {};
  samples.forEach((s, i) => {
    if (keys[i]) extra[keys[i]] = { value: s.value, goal: s.extra ?? 0 };
  });
  return [
    { user_id: userId, day: localDay(samples[0].start), metric: 'aneis', value: samples[0].value, extra },
  ];
}

/**
 * Roteia a métrica para o agregador adequado.
 * `macros` é omitido em F1 (donut de totais do período, não série diária).
 */
export function toHealthDailyRows(meta: AggregateMeta, samples: Sample[], userId: string): HealthDailyRow[] {
  if (samples.length === 0) return [];
  switch (meta.id) {
    case 'pressao':
      return aggregatePressure(samples, userId);
    case 'aneis':
      return aggregateRings(samples, userId);
    case 'sono':
      return aggregateSleep(samples, userId);
    case 'macros':
      return [];
    default:
      return meta.kind === 'cumulative'
        ? aggregateCumulative(samples, meta.id, userId)
        : aggregateDiscrete(samples, meta.id, userId);
  }
}
