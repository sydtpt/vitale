import { describe, it, expect } from '@jest/globals';
import type { Activity } from '@vitale/shared';
import { DEFAULT_WEEKLY_TARGET_MIN } from '@vitale/shared';
import { buildOverview, earliestActivityYear, overviewYears } from '../activity-overview';

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
    const ov = buildOverview([act({ startAt: '2026-05-10T08:00:00' })], 'meses12', 'count', now);
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
    const ov = buildOverview(activities, 'meses12', 'count', now);

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

  it('esconde os tipos filtrados das barras e dos totais, mas não da legenda', () => {
    const activities = [
      act({ activityId: 37, startAt: '2026-05-20T08:00:00', durationS: 1800 }), // Corrida
      act({ activityId: 50, startAt: '2026-05-20T20:00:00', durationS: 3600 }), // Musculação
    ];
    const ov = buildOverview(activities, 'semana', 'duration', now, new Set(['Corrida']));
    const today = ov.buckets[ov.buckets.length - 1];
    expect(today.segments.map((s) => s.label)).toEqual(['Musculação']);
    expect(today.total).toBe(3600);
    expect(ov.totals.count).toBe(1);
    // legenda mantém o tipo oculto, senão não dá para reexibir
    expect(ov.legend.map((l) => l.label).sort()).toEqual(['Corrida', 'Musculação']);
  });
});

describe('buildOverview — sempre (botões de ano)', () => {
  const now = new Date(2026, 4, 20);
  const activities = [
    act({ startAt: '2024-03-01T08:00:00' }),
    act({ startAt: '2026-01-10T08:00:00' }),
    act({ startAt: '2026-02-10T08:00:00' }),
  ];

  it('sem filtro: um bucket por ano entre o mínimo e o máximo', () => {
    const ov = buildOverview(activities, 'sempre', 'count', now);
    expect(ov.buckets.map((b) => b.key)).toEqual(['2024', '2025', '2026']);
    expect(ov.totals.count).toBe(3);
  });

  it('anos desmarcados saem das barras e dos totais', () => {
    const ov = buildOverview(
      activities, 'sempre', 'count', now, new Set(), DEFAULT_WEEKLY_TARGET_MIN, 0, new Set(['2026']),
    );
    expect(ov.buckets.map((b) => b.key)).toEqual(['2024', '2025']);
    expect(ov.totals.count).toBe(1);
  });

  it('overviewYears lista todos os anos do histórico, inclusive os vazios', () => {
    expect(overviewYears(activities)).toEqual([2024, 2025, 2026]);
    expect(overviewYears([])).toEqual([]);
  });
});

describe('buildOverview — mês (barras semanais)', () => {
  const now = new Date(2026, 4, 20); // quarta, 20 mai 2026

  it('gera 5 buckets seg–dom terminando na semana atual', () => {
    const ov = buildOverview([], 'mes', 'count', now);
    expect(ov.buckets).toHaveLength(5);
    expect(ov.granularity).toBe('week');
    expect(ov.buckets.map((b) => b.key)).toEqual([
      '2026-04-20', '2026-04-27', '2026-05-04', '2026-05-11', '2026-05-18',
    ]);
    expect(ov.buckets[4].label).toBe('18/05');
  });

  it('agrupa a atividade na semana da sua segunda-feira', () => {
    const activities = [
      act({ startAt: '2026-05-24T08:00:00' }), // domingo → semana de 18/05
      act({ startAt: '2026-05-18T08:00:00' }), // segunda → semana de 18/05
      act({ startAt: '2026-05-17T08:00:00' }), // domingo → semana de 11/05
      act({ startAt: '2026-04-13T08:00:00' }), // fora da janela
    ];
    const ov = buildOverview(activities, 'mes', 'count', now);
    expect(ov.buckets[4].total).toBe(2);
    expect(ov.buckets[3].total).toBe(1);
    expect(ov.totals.count).toBe(3);
  });
});

describe('buildOverview — esforço ponderado e meta da OMS', () => {
  const now = new Date(2026, 4, 20);

  it('soma os segundos de esforço por bucket', () => {
    const activities = [
      // 60 min de corrida sem FC → peso do tipo (0.975)
      act({ activityId: 37, startAt: '2026-05-20T08:00:00', durationS: 3600 }),
      // 30 min de yoga sem FC → peso 0.375 (override Ashtanga)
      act({ activityId: 57, startAt: '2026-05-20T10:00:00', durationS: 1800 }),
    ];
    const ov = buildOverview(activities, 'semana', 'duration', now);
    const today = ov.buckets[ov.buckets.length - 1];
    expect(today.effectiveS).toBeCloseTo(3600 * 0.975 + 1800 * 0.375, 5);
    // e a linha continua abaixo da barra, que é o ponto da escala
    expect(today.effectiveS!).toBeLessThanOrEqual(today.total);
    // a barra continua sendo a duração bruta — é a linha que é ponderada
    expect(today.total).toBe(5400);
  });

  it('independe da métrica exibida e respeita os tipos ocultos', () => {
    const activities = [
      act({ activityId: 37, startAt: '2026-05-20T08:00:00', durationS: 3600 }),
      act({ activityId: 57, startAt: '2026-05-20T10:00:00', durationS: 1800 }),
    ];
    const porContagem = buildOverview(activities, 'semana', 'count', now);
    const porDuracao = buildOverview(activities, 'semana', 'duration', now);
    const i = porContagem.buckets.length - 1;
    expect(porContagem.buckets[i].effectiveS).toBe(porDuracao.buckets[i].effectiveS);

    const semCorrida = buildOverview(activities, 'semana', 'duration', now, new Set(['Corrida']));
    expect(semCorrida.buckets[i].effectiveS).toBeCloseTo(1800 * 0.375, 5);
  });

  it('usa as zonas de FC quando o treino tem batimentos', () => {
    // 30 min de yoga inteiros em z4 contam cheios, apesar do MET baixo do tipo —
    // "cheio" é o teto da escala, ou seja, a própria duração.
    const activities = [
      act({ activityId: 57, startAt: '2026-05-20T08:00:00', durationS: 1800, hrZones: { z4: 1800 } }),
    ];
    const ov = buildOverview(activities, 'semana', 'duration', now);
    expect(ov.buckets[ov.buckets.length - 1].effectiveS).toBe(1800);
  });

  it('deixa a barra de comparação fora da série de esforço', () => {
    const activities = [
      act({ startAt: '2026-05-10T08:00:00', durationS: 1800 }),
      act({ startAt: '2025-05-10T08:00:00', durationS: 1800 }), // comparação
    ];
    const ov = buildOverview(activities, 'meses12', 'duration', now);
    const comparison = ov.buckets[ov.buckets.length - 1];
    expect(comparison.comparison).toBe(true);
    expect(comparison.effectiveS).toBeUndefined();
    expect(ov.buckets[ov.buckets.length - 2].effectiveS).toBeGreaterThan(0);
  });

  it('effortAvgS = média sobre todos os buckets, com dias de descanso valendo 0', () => {
    // 60 min de corrida (0.975) num único dia da janela de 7 dias.
    const activities = [act({ activityId: 37, startAt: '2026-05-20T08:00:00', durationS: 3600 })];
    const ov = buildOverview(activities, 'semana', 'duration', now);
    expect(ov.effortTotalS).toBeCloseTo(3600 * 0.975, 5);
    // média diária: o total dividido pelos 7 buckets, não pelos dias com treino
    expect(ov.effortAvgS).toBeCloseTo((3600 * 0.975) / 7, 5);
  });

  it('a reta do esforço é comparável com a meta na mesma escala', () => {
    // A escala é ancorada no vigoroso, então um treino inteiro em z4 vale exatamente a
    // sua duração. Rodar a meta semanal toda em z4 encosta na linha da meta, sem sobrar.
    const alvoS = DEFAULT_WEEKLY_TARGET_MIN * 60;
    const activities = [
      act({ activityId: 37, startAt: '2026-05-20T08:00:00', durationS: alvoS, hrZones: { z4: alvoS } }),
    ];
    const ov = buildOverview(activities, 'semana', 'duration', now);
    // bateu a meta na semana → a reta encosta exatamente na linha da meta
    expect(ov.effortAvgS).toBeCloseTo(ov.targetS, 5);
  });

  it('effortAvgS deixa a barra de comparação fora da média', () => {
    const activities = [
      act({ activityId: 37, startAt: '2026-05-10T08:00:00', durationS: 3600 }),
      act({ activityId: 37, startAt: '2025-05-10T08:00:00', durationS: 3600 }), // comparação
    ];
    const ov = buildOverview(activities, 'meses12', 'duration', now);
    // 12 buckets pontuados (o 13º é comparação), só um com treino
    expect(ov.effortTotalS).toBeCloseTo(3600 * 0.975, 5);
    expect(ov.effortAvgS).toBeCloseTo((3600 * 0.975) / 12, 5);
  });

  it('prorrateia a meta da OMS conforme o tamanho do bucket', () => {
    const semanal = DEFAULT_WEEKLY_TARGET_MIN * 60;
    expect(buildOverview([], 'semana', 'duration', now).targetS).toBeCloseTo(semanal / 7, 5);
    expect(buildOverview([], 'mes', 'duration', now).targetS).toBe(semanal);
    // maio/2026 = 31 dias
    expect(buildOverview([], 'meses12', 'duration', now).targetS).toBeCloseTo((semanal / 7) * 31, 5);
    const sempre = buildOverview([act({ startAt: '2026-05-10T08:00:00' })], 'sempre', 'duration', now);
    expect(sempre.granularity).toBe('year');
    expect(sempre.targetS).toBeCloseTo((semanal / 7) * 365, 5);
  });
});

describe('buildOverview — ano civil (navegável)', () => {
  const now = new Date(2026, 4, 20); // quarta, 20 mai 2026

  it('ano corrente: só os meses decorridos, último em destaque', () => {
    const ov = buildOverview([], 'ano', 'count', now);
    expect(ov.buckets).toHaveLength(5); // jan..mai
    expect(ov.buckets.map((b) => b.label)).toEqual(['jan', 'fev', 'mar', 'abr', 'mai']);
    expect(ov.buckets[4].emphasis).toBe(true);
    expect(ov.granularity).toBe('month');
  });

  it('ano anterior: os 12 meses, nenhum em destaque', () => {
    const ov = buildOverview([], 'ano', 'count', now, new Set(), undefined, -1);
    expect(ov.buckets).toHaveLength(12);
    expect(ov.buckets.map((b) => b.key)).toEqual(
      Array.from({ length: 12 }, (_, m) => `2025-${m}`),
    );
    expect(ov.buckets.some((b) => b.emphasis)).toBe(false);
  });

  it('não cria barra de comparação (navegar substitui)', () => {
    const ov = buildOverview([], 'ano', 'count', now);
    expect(ov.buckets.some((b) => b.comparison)).toBe(false);
  });

  it('separa as atividades pelo ano civil', () => {
    const activities = [
      act({ startAt: '2026-03-10T08:00:00' }),
      act({ startAt: '2025-12-20T08:00:00' }), // dezembro anterior — fora do ano corrente
    ];
    const atual = buildOverview(activities, 'ano', 'count', now);
    expect(atual.totals.count).toBe(1);
    expect(atual.buckets[2].total).toBe(1); // março

    const anterior = buildOverview(activities, 'ano', 'count', now, new Set(), undefined, -1);
    expect(anterior.totals.count).toBe(1);
    expect(anterior.buckets[11].total).toBe(1); // dezembro
  });

  it('effortAvgS divide pelos meses decorridos, não por 12', () => {
    // 60 min de corrida (peso 1.95) em março do ano corrente.
    const activities = [act({ activityId: 37, startAt: '2026-03-10T08:00:00', durationS: 3600 })];
    const ov = buildOverview(activities, 'ano', 'duration', now);
    expect(ov.buckets).toHaveLength(5);
    expect(ov.effortAvgS).toBeCloseTo((3600 * 0.975) / 5, 5);
  });
});

describe('earliestActivityYear', () => {
  it('devolve o ano da atividade mais antiga', () => {
    expect(
      earliestActivityYear([
        act({ startAt: '2026-05-10T08:00:00' }),
        act({ startAt: '2023-11-02T08:00:00' }),
        act({ startAt: '2024-01-01T08:00:00' }),
      ]),
    ).toBe(2023);
  });

  it('devolve undefined sem atividades', () => {
    expect(earliestActivityYear([])).toBeUndefined();
  });
});

describe('buildOverview — meta prorrateada do bucket em curso', () => {
  it('ano civil: mês corrente proporcional aos dias decorridos', () => {
    // 20/mai/2026 12h → 19.5 de 31 dias de maio decorridos.
    const now = new Date(2026, 4, 20, 12);
    const ov = buildOverview([], 'ano', 'duration', now);
    const fracao = (19 + 12 / 24) / 31;
    expect(ov.currentTargetS).toBeCloseTo(ov.targetS * fracao, 5);
    expect(ov.currentTargetS!).toBeLessThan(ov.targetS);
  });

  it('ano fechado: sem prorrateio, a meta cheia vale para todos os meses', () => {
    const now = new Date(2026, 4, 20, 12);
    const ov = buildOverview([], 'ano', 'duration', now, new Set(), undefined, -1);
    expect(ov.currentTargetS).toBeUndefined();
  });

  it('primeiro dia do mês prorrateia quase tudo', () => {
    const now = new Date(2026, 4, 1, 0, 0); // 1º de maio, 00:00
    const ov = buildOverview([], 'ano', 'duration', now);
    expect(ov.currentTargetS).toBeCloseTo(0, 5);
  });

  it('sempre: o ano corrente é prorrateado pelos dias já passados', () => {
    const now = new Date(2026, 6, 30, 12); // 30/jul/2026
    const ov = buildOverview([act({ startAt: '2026-03-01T08:00:00' })], 'sempre', 'duration', now);
    expect(ov.granularity).toBe('year');
    // ~210.5 de 365 dias
    expect(ov.currentTargetS!).toBeGreaterThan(ov.targetS * 0.5);
    expect(ov.currentTargetS!).toBeLessThan(ov.targetS * 0.65);
  });

  it('semana: o dia de hoje é prorrateado pelas horas decorridas', () => {
    const now = new Date(2026, 4, 20, 6); // 6h da manhã = 1/4 do dia
    const ov = buildOverview([], 'semana', 'duration', now);
    expect(ov.currentTargetS).toBeCloseTo(ov.targetS * 0.25, 5);
  });
});
