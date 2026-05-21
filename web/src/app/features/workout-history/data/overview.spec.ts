import type { Activity } from '@vitale/shared';
import { buildOverview, metricValue } from './overview';

function act(partial: Partial<Activity> & { startAt: string }): Activity {
  return {
    id: Math.random().toString(36),
    userId: 'u1',
    activityId: 37, // Corrida
    calories: 100,
    durationS: 1800,
    distanceM: 5000,
    endAt: partial.startAt,
    hasRoute: false,
    ...partial,
  };
}

describe('metricValue', () => {
  const a = act({ startAt: '2026-05-20T08:00:00', distanceM: 4200, durationS: 1500, calories: 320 });

  it('lê cada métrica', () => {
    expect(metricValue(a, 'distance')).toBe(4200);
    expect(metricValue(a, 'duration')).toBe(1500);
    expect(metricValue(a, 'calories')).toBe(320);
    expect(metricValue(a, 'count')).toBe(1);
  });

  it('trata distância ausente como 0', () => {
    const indoor = act({ startAt: '2026-05-20T08:00:00', distanceM: undefined });
    expect(metricValue(indoor, 'distance')).toBe(0);
  });
});

describe('buildOverview — sempre', () => {
  const now = new Date(2026, 4, 20, 12);
  const activities = [
    act({ startAt: '2024-03-01T08:00:00' }),
    act({ startAt: '2026-01-10T08:00:00' }),
    act({ startAt: '2026-02-10T08:00:00' }),
  ];

  it('cria um bucket por ano entre o mínimo e o máximo', () => {
    const o = buildOverview(activities, 'sempre', 'count', now);
    expect(o.buckets.map((b) => b.key)).toEqual(['2024', '2025', '2026']);
  });

  it('agrega a métrica count por ano', () => {
    const o = buildOverview(activities, 'sempre', 'count', now);
    expect(o.buckets.find((b) => b.key === '2024')?.total).toBe(1);
    expect(o.buckets.find((b) => b.key === '2025')?.total).toBe(0);
    expect(o.buckets.find((b) => b.key === '2026')?.total).toBe(2);
    expect(o.totals.count).toBe(3);
  });
});

describe('buildOverview — semana (janela móvel)', () => {
  const now = new Date(2026, 4, 20, 12); // 2026-05-20

  it('inclui só os últimos 7 dias e ignora o resto', () => {
    const activities = [
      act({ startAt: '2026-05-20T08:00:00' }), // hoje
      act({ startAt: '2026-05-14T08:00:00' }), // dentro (6 dias atrás)
      act({ startAt: '2026-05-10T08:00:00' }), // fora (>6 dias)
    ];
    const o = buildOverview(activities, 'semana', 'count', now);
    expect(o.buckets.length).toBe(7);
    expect(o.totals.count).toBe(2);
    expect(o.buckets[o.buckets.length - 1].total).toBe(1); // hoje
  });
});

describe('buildOverview — legenda e segmentos por tipo', () => {
  const now = new Date(2026, 4, 20, 12);

  it('ordena a legenda pelo total da métrica (desc) e separa segmentos por tipo', () => {
    const activities = [
      act({ startAt: '2026-05-20T08:00:00', activityId: 50, distanceM: undefined }), // Musculação
      act({ startAt: '2026-05-20T09:00:00', activityId: 37, distanceM: 8000 }), // Corrida
      act({ startAt: '2026-05-20T10:00:00', activityId: 37, distanceM: 2000 }), // Corrida
    ];
    const o = buildOverview(activities, 'semana', 'distance', now);
    expect(o.legend[0].label).toBe('Corrida'); // 10000m
    const today = o.buckets[o.buckets.length - 1];
    const corrida = today.segments.find((s) => s.label === 'Corrida');
    expect(corrida?.value).toBe(10000);
    // Musculação tem distância 0 → não vira segmento
    expect(today.segments.some((s) => s.label === 'Musculação')).toBe(false);
  });
});
