import { describe, it, expect } from '@jest/globals';
import type { Activity } from '@vitale/shared';
import { buildOverview } from '../activity-overview';

function act(partial: Partial<Activity> & { startAt: string }): Activity {
  return {
    id: partial.id ?? Math.random().toString(36).slice(2),
    userId: 'u1',
    activityId: partial.activityId ?? 37, // Corrida por padrão
    activityName: undefined,
    calories: partial.calories ?? 0,
    endAt: partial.endAt ?? partial.startAt,
    durationS: partial.durationS ?? 0,
    distanceM: partial.distanceM,
    hasRoute: partial.hasRoute ?? false,
    hidden: partial.hidden ?? false,
    ...partial,
  } as Activity;
}

describe('buildOverview', () => {
  const now = new Date(2026, 4, 20); // 20 mai 2026 (mês 4 = maio)

  it('semana: gera 7 buckets diários e soma a métrica no dia certo', () => {
    const activities = [
      act({ startAt: '2026-05-20T08:00:00', distanceM: 5000, durationS: 1800, calories: 300 }),
      act({ startAt: '2026-05-20T18:00:00', distanceM: 3000, durationS: 1200, calories: 200 }),
      act({ startAt: '2026-05-18T07:00:00', distanceM: 10000, durationS: 3600, calories: 600 }),
    ];
    const ov = buildOverview(activities, 'semana', 'distance', now);

    expect(ov.buckets).toHaveLength(7);
    expect(ov.totals.count).toBe(3);
    expect(ov.totals.distanceM).toBe(18000);

    const today = ov.buckets[ov.buckets.length - 1];
    expect(today.total).toBe(8000); // duas corridas de hoje somadas
  });

  it('janela móvel: ignora atividades fora dos 7 dias', () => {
    const activities = [
      act({ startAt: '2026-05-20T08:00:00', distanceM: 5000 }),
      act({ startAt: '2026-05-01T08:00:00', distanceM: 9999 }), // fora da semana
    ];
    const ov = buildOverview(activities, 'semana', 'distance', now);
    expect(ov.totals.count).toBe(1);
    expect(ov.totals.distanceM).toBe(5000);
  });

  it('ano: 13 buckets (11 meses + mês atual em destaque + comparação ao final)', () => {
    const ov = buildOverview([act({ startAt: '2026-05-10T08:00:00' })], 'ano', 'count', now);
    expect(ov.buckets).toHaveLength(13);

    // Penúltimo bucket = mês atual (em destaque).
    const current = ov.buckets[ov.buckets.length - 2];
    expect(current.total).toBe(1);
    expect(current.emphasis).toBe(true);

    // Último bucket = comparação (mesmo mês há 1 ano), depois do mês atual.
    const comparison = ov.buckets[ov.buckets.length - 1];
    expect(comparison.comparison).toBe(true);
    expect(comparison.label).toBe("mai '25");
  });

  it('ano: barra de comparação alimenta o gráfico mas fica fora dos totais', () => {
    const activities = [
      act({ startAt: '2026-05-10T08:00:00', durationS: 1800, calories: 300, distanceM: 5000 }),
      // mesmo mês do ano anterior (maio/2025) — só comparação, não conta nos totais
      act({ startAt: '2025-05-10T08:00:00', durationS: 3600, calories: 600, distanceM: 9000 }),
    ];
    const ov = buildOverview(activities, 'ano', 'count', now);

    // totais ignoram a atividade de comparação
    expect(ov.totals.count).toBe(1);
    expect(ov.totals.durationS).toBe(1800);
    expect(ov.totals.calories).toBe(300);
    expect(ov.totals.distanceM).toBe(5000);

    // ...mas a barra de comparação existe no gráfico (último bucket)
    const comparison = ov.buckets[ov.buckets.length - 1];
    expect(comparison.comparison).toBe(true);
    expect(comparison.total).toBe(1);
  });

  it('separa segmentos por tipo dentro do mesmo bucket', () => {
    const activities = [
      act({ activityId: 37, startAt: '2026-05-20T08:00:00', durationS: 1800 }), // Corrida
      act({ activityId: 50, startAt: '2026-05-20T20:00:00', durationS: 3600 }), // Musculação
    ];
    const ov = buildOverview(activities, 'semana', 'duration', now);
    const today = ov.buckets[ov.buckets.length - 1];
    expect(today.segments).toHaveLength(2);
    expect(ov.legend.map((l) => l.label).sort()).toEqual(['Corrida', 'Musculação']);
  });

  it('métrica count conta atividades independente da grandeza', () => {
    const activities = [
      act({ startAt: '2026-05-20T08:00:00', distanceM: 0, durationS: 0 }),
      act({ startAt: '2026-05-20T09:00:00', distanceM: 0, durationS: 0 }),
    ];
    const ov = buildOverview(activities, 'semana', 'count', now);
    expect(ov.buckets[ov.buckets.length - 1].total).toBe(2);
  });
});
