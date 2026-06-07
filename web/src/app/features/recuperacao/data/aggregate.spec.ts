import type { Activity, HealthDaily } from '@vitale/shared';
import {
  dailyHardLoad,
  readinessInputsByDay,
  readinessSeries,
  weeklyLoadVsRecovery,
  wellnessSummary,
  sportHealthCorrelations,
  buildPeriodRecap,
  recapHeadline,
} from '@vitale/shared';

// Quarta 2026-06-03 → semana de seg 2026-06-01.
const NOW = new Date(2026, 5, 3, 12, 0, 0);

function act(p: Partial<Activity> & { startAt: string }): Activity {
  return {
    id: Math.random().toString(36),
    userId: 'u1',
    activityId: 37,
    calories: 100,
    durationS: 1800,
    endAt: p.startAt,
    hasRoute: false,
    ...p,
  };
}

function hd(metric: string, day: string, value: number, extra?: Record<string, unknown>): HealthDaily {
  return { userId: 'u1', day, metric, value, extra };
}

describe('dailyHardLoad', () => {
  it('soma minutos em Z4+Z5 por dia local', () => {
    const m = dailyHardLoad([
      act({ startAt: '2026-06-02T07:00:00', hrZones: { z2: 600, z4: 300, z5: 300 } }), // 10 min fortes
      act({ startAt: '2026-06-02T18:00:00', hrZones: { z4: 120 } }),                    // +2 min
    ]);
    expect(m.get('2026-06-02')).toBeCloseTo(12, 5);
  });

  it('ignora ocultas e sem hrZones', () => {
    const m = dailyHardLoad([
      act({ startAt: '2026-06-02T07:00:00', hidden: true, hrZones: { z5: 600 } }),
      act({ startAt: '2026-06-02T07:00:00' }),
    ]);
    expect(m.size).toBe(0);
  });
});

describe('readinessSeries', () => {
  it('devolve um ponto por dia com score quando há dado', () => {
    const inputs = readinessInputsByDay({
      sono: [hd('sono', '2026-06-03', 8)],
      fcRepouso: [hd('fcRepouso', '2026-06-01', 50), hd('fcRepouso', '2026-06-03', 50)],
      vfc: [hd('vfc', '2026-06-01', 60), hd('vfc', '2026-06-03', 60)],
      aneis: [],
    });
    const series = readinessSeries(inputs, new Set(['2026-06-03']), 7, NOW);
    expect(series.length).toBe(7);
    const today = series[series.length - 1];
    expect(today.date).toBe('2026-06-03');
    expect(today.score).not.toBeNull();
    expect(today.hasActivity).toBeTrue();
  });
});

describe('weeklyLoadVsRecovery', () => {
  it('devolve 8 semanas e soma a carga forte da semana atual', () => {
    const acts = [act({ startAt: '2026-06-02T07:00:00', hrZones: { z4: 600, z5: 600 } })]; // 20 min
    const rows = weeklyLoadVsRecovery(acts, new Map([['2026-06-02', 80]]), 8, NOW);
    expect(rows.length).toBe(8);
    const current = rows[rows.length - 1];
    expect(current.hardMin).toBe(20);
    expect(current.recovery).toBe(80);
  });
});

describe('wellnessSummary', () => {
  it('agrega prontidão recente + esporte da semana', () => {
    const inputs = readinessInputsByDay({
      sono: [hd('sono', '2026-06-03', 8)],
      fcRepouso: [hd('fcRepouso', '2026-06-01', 50), hd('fcRepouso', '2026-06-03', 50)],
      vfc: [hd('vfc', '2026-06-01', 60), hd('vfc', '2026-06-03', 60)],
      aneis: [],
    });
    const acts = [act({ startAt: '2026-06-02T07:00:00', hrZones: { z4: 300, z5: 300 } })];
    const w = wellnessSummary(inputs, acts, NOW);
    expect(w.overall).not.toBeNull();
    expect(w.sport.sessions).toBe(1);
    expect(w.categories.length).toBeGreaterThan(0);
  });
});

describe('sportHealthCorrelations', () => {
  it('marca dados insuficientes com poucos dias', () => {
    const out = sportHealthCorrelations([], { vfc: new Map(), fcRepouso: new Map(), sono: new Map() }, NOW);
    expect(out.length).toBe(3);
    expect(out.every((r) => !r.enough)).toBeTrue();
  });
});

describe('buildPeriodRecap', () => {
  it('separa janela atual da anterior e calcula deltas', () => {
    const acts = [
      act({ startAt: '2026-06-02T07:00:00', distanceM: 6000, durationS: 1800 }), // dentro de 2026-05-28..06-03
      act({ startAt: '2026-05-25T07:00:00', distanceM: 4000, durationS: 1200 }), // janela anterior
    ];
    const r = buildPeriodRecap(acts, new Map([['2026-06-02', 80]]), 7, NOW);
    expect(r.sessions.current).toBe(1);
    expect(r.sessions.prev).toBe(1);
    expect(r.distanceKm.current).toBe(6);
    expect(r.distanceKm.prev).toBe(4);
    expect(r.distanceKm.deltaPct).toBeCloseTo(50, 5);
    expect(r.avgReadiness.current).toBe(80);
    expect(r.longestKm).toBe(6);
  });

  it('recapHeadline monta o texto do push', () => {
    const r = buildPeriodRecap(
      [act({ startAt: '2026-06-02T07:00:00', distanceM: 32400, durationS: 9000 })],
      new Map([['2026-06-02', 74]]),
      7,
      NOW,
    );
    expect(recapHeadline(r)).toContain('32,4 km');
    expect(recapHeadline(r)).toContain('prontidão 74');
  });
});
