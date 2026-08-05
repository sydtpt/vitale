import type { Activity } from '@vitale/shared';
import { DEFAULT_WEEKLY_TARGET_MIN } from '@vitale/shared';
import { buildOverview, earliestActivityYear, metricValue, overviewYears } from './overview';

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

  it('anos desmarcados saem das barras e dos totais', () => {
    const o = buildOverview(activities, 'sempre', 'count', now, new Set(), DEFAULT_WEEKLY_TARGET_MIN, 0, new Set(['2026']));
    expect(o.buckets.map((b) => b.key)).toEqual(['2024', '2025']);
    expect(o.totals.count).toBe(1);
  });

  it('overviewYears lista todos os anos do histórico, inclusive os vazios', () => {
    expect(overviewYears(activities)).toEqual([2024, 2025, 2026]);
    expect(overviewYears([])).toEqual([]);
  });
});

describe('buildOverview — ano (comparação ano a ano)', () => {
  const now = new Date(2026, 4, 20, 12); // maio/2026

  it('gera 13 buckets: 11 meses + mês atual em destaque + comparação ao final', () => {
    const o = buildOverview([act({ startAt: '2026-05-10T08:00:00' })], 'meses12', 'count', now);
    expect(o.buckets.length).toBe(13);

    const current = o.buckets[o.buckets.length - 2]; // penúltimo = mês atual
    expect(current.emphasis).toBe(true);
    expect(current.total).toBe(1);

    const comparison = o.buckets[o.buckets.length - 1]; // último = comparação
    expect(comparison.comparison).toBe(true);
    expect(comparison.label).toBe("mai '25");
  });

  it('a barra de comparação alimenta o gráfico mas fica fora dos totais', () => {
    const activities = [
      act({ startAt: '2026-05-10T08:00:00' }),
      act({ startAt: '2025-05-10T08:00:00' }), // mesmo mês, ano anterior → só comparação
    ];
    const o = buildOverview(activities, 'meses12', 'count', now);

    expect(o.totals.count).toBe(1); // ignora a atividade de comparação
    const comparison = o.buckets[o.buckets.length - 1];
    expect(comparison.total).toBe(1); // ...mas a barra existe
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

describe('buildOverview — mês (barras semanais)', () => {
  const now = new Date(2026, 4, 20, 12); // quarta, 2026-05-20

  it('gera 5 buckets seg–dom terminando na semana atual', () => {
    const o = buildOverview([], 'mes', 'count', now);
    expect(o.buckets.length).toBe(5);
    expect(o.granularity).toBe('week');
    // Segunda da semana de 20/05/2026 = 18/05; 4 semanas antes = 20/04.
    expect(o.buckets.map((b) => b.key)).toEqual([
      '2026-04-20', '2026-04-27', '2026-05-04', '2026-05-11', '2026-05-18',
    ]);
    expect(o.buckets[4].label).toBe('18/05');
  });

  it('agrupa a atividade na semana da sua segunda-feira', () => {
    const activities = [
      act({ startAt: '2026-05-24T08:00:00' }), // domingo → semana de 18/05
      act({ startAt: '2026-05-18T08:00:00' }), // segunda → semana de 18/05
      act({ startAt: '2026-05-17T08:00:00' }), // domingo → semana de 11/05
      act({ startAt: '2026-04-13T08:00:00' }), // fora da janela
    ];
    const o = buildOverview(activities, 'mes', 'count', now);
    expect(o.buckets[4].total).toBe(2);
    expect(o.buckets[3].total).toBe(1);
    expect(o.totals.count).toBe(3);
  });

  it('a meta na granularidade semanal é o valor cheio, sem prorrateio', () => {
    const o = buildOverview([], 'mes', 'duration', now);
    expect(o.targetS).toBe(DEFAULT_WEEKLY_TARGET_MIN * 60);
  });
});

describe('buildOverview — esforço ponderado (linha do gráfico de duração)', () => {
  const now = new Date(2026, 4, 20, 12);

  it('soma os segundos de esforço por bucket', () => {
    const activities = [
      // 60 min de corrida sem FC → peso do tipo (0.975).
      act({ startAt: '2026-05-20T08:00:00', activityId: 37, durationS: 3600 }),
      // 30 min de yoga sem FC → peso 0.375 (override Ashtanga).
      act({ startAt: '2026-05-20T10:00:00', activityId: 57, durationS: 1800 }),
    ];
    const o = buildOverview(activities, 'semana', 'duration', now);
    const hoje = o.buckets[o.buckets.length - 1];
    expect(hoje.effectiveS).toBeCloseTo(3600 * 0.975 + 1800 * 0.375, 5);
    // A barra continua sendo a duração bruta — é a linha que é ponderada.
    expect(hoje.total).toBe(5400);
    // ...e a linha nunca sobe acima dela, que é o ponto da escala.
    expect(hoje.effectiveS!).toBeLessThanOrEqual(hoje.total);
  });

  it('independe da métrica exibida', () => {
    const activities = [act({ startAt: '2026-05-20T08:00:00', activityId: 57, durationS: 3600 })];
    const porContagem = buildOverview(activities, 'semana', 'count', now);
    const porDuracao = buildOverview(activities, 'semana', 'duration', now);
    const idx = porContagem.buckets.length - 1;
    expect(porContagem.buckets[idx].effectiveS).toBe(porDuracao.buckets[idx].effectiveS);
  });

  it('respeita os tipos ocultos na legenda', () => {
    const activities = [
      act({ startAt: '2026-05-20T08:00:00', activityId: 37, durationS: 3600 }),
      act({ startAt: '2026-05-20T10:00:00', activityId: 57, durationS: 1800 }),
    ];
    const o = buildOverview(activities, 'semana', 'duration', now, new Set(['Corrida']));
    const hoje = o.buckets[o.buckets.length - 1];
    expect(hoje.effectiveS).toBeCloseTo(1800 * 0.375, 5);
    // ...mas a legenda continua listando o tipo escondido, para poder reexibir.
    expect(o.legend.some((l) => l.label === 'Corrida')).toBe(true);
  });

  it('deixa a barra de comparação fora da série', () => {
    const activities = [
      act({ startAt: '2026-05-10T08:00:00' }),
      act({ startAt: '2025-05-10T08:00:00' }), // mesmo mês, ano anterior → comparação
    ];
    const o = buildOverview(activities, 'meses12', 'duration', now);
    const comparison = o.buckets[o.buckets.length - 1];
    expect(comparison.comparison).toBe(true);
    expect(comparison.effectiveS).toBeUndefined();
    expect(o.buckets[o.buckets.length - 2].effectiveS).toBeGreaterThan(0);
  });
});

describe('buildOverview — reta do esforço (período Semana)', () => {
  const now = new Date(2026, 4, 20, 12);

  it('effortAvgS = média sobre todos os buckets, com dias de descanso valendo 0', () => {
    const activities = [act({ startAt: '2026-05-20T08:00:00', activityId: 37, durationS: 3600 })];
    const o = buildOverview(activities, 'semana', 'duration', now);
    expect(o.effortTotalS).toBeCloseTo(3600 * 0.975, 5);
    expect(o.effortAvgS).toBeCloseTo((3600 * 0.975) / 7, 5);
  });

  it('a reta encosta na meta quando a semana bate o alvo', () => {
    const alvoS = DEFAULT_WEEKLY_TARGET_MIN * 60;
    const activities = [
      // A escala é ancorada no vigoroso: um treino inteiro em z4 vale exatamente a sua
      // duração. Rodar a meta toda em z4 encosta na linha da meta, sem sobrar nem faltar.
      act({ startAt: '2026-05-20T08:00:00', activityId: 37, durationS: alvoS, hrZones: { z4: alvoS } }),
    ];
    const o = buildOverview(activities, 'semana', 'duration', now);
    expect(o.effortAvgS).toBeCloseTo(o.targetS, 5);
  });

  it('deixa a barra de comparação fora da média', () => {
    const activities = [
      act({ startAt: '2026-05-10T08:00:00', durationS: 3600 }),
      act({ startAt: '2025-05-10T08:00:00', durationS: 3600 }), // comparação
    ];
    const o = buildOverview(activities, 'meses12', 'duration', now);
    expect(o.effortAvgS).toBeCloseTo((3600 * 0.975) / 12, 5);
  });
});

describe('buildOverview — meta da OMS por granularidade', () => {
  const now = new Date(2026, 4, 20, 12); // maio/2026 (31 dias), ano comum

  it('prorrateia a meta semanal conforme o tamanho do bucket', () => {
    const semanal = DEFAULT_WEEKLY_TARGET_MIN * 60;
    expect(buildOverview([], 'semana', 'duration', now).granularity).toBe('day');
    expect(buildOverview([], 'semana', 'duration', now).targetS).toBeCloseTo(semanal / 7, 5);
    expect(buildOverview([], 'mes', 'duration', now).targetS).toBe(semanal);
    expect(buildOverview([], 'meses12', 'duration', now).targetS).toBeCloseTo((semanal / 7) * 31, 5);

    const sempre = buildOverview([act({ startAt: '2026-05-10T08:00:00' })], 'sempre', 'duration', now);
    expect(sempre.granularity).toBe('year');
    expect(sempre.targetS).toBeCloseTo((semanal / 7) * 365, 5);
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

describe('buildOverview — ano civil (navegável)', () => {
  const now = new Date(2026, 4, 20, 12); // quarta, 20 mai 2026

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
    // 60 min de corrida (peso 0.975) em março do ano corrente.
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
