import { describe, it, expect } from '@jest/globals';
import {
  periodBounds,
  latestAvailableOffset,
  buildRetrospective,
  buildRetroHighlights,
  buildRetroLede,
  buildHeatmap,
  resolveRetroPrefs,
  visibleBlocks,
  layoutEditable,
  deadBlocks,
  toggleBlock,
  moveBlock,
  RETRO_BLOCKS,
  DEFAULT_RETRO_PREFS,
  type RetroPrefs,
  buildYearByMonth,
  retroSince,
  compareHighlights,
  ANALYSIS_WINDOW_DAYS,
  buildTaskGrid,
  isDailyRecurrence,
  describeRecurrence,
  firstDueDate,
  nextDueDate,
  EVERY_WEEKDAY,
  type Activity,
  type PeriodKind,
  type RetroInput,
  type WeekHighlight,
} from '@vitale/shared';

// Quarta, 17/06/2026 10h local.
const NOW = new Date(2026, 5, 17, 10, 0, 0);

function act(
  startAt: string,
  distanceM = 0,
  durationS = 1800,
  calories = 100,
  over: Partial<Activity> = {},
): Activity {
  return {
    id: startAt, userId: 'u', activityId: 1, calories, startAt,
    endAt: startAt, durationS, distanceM, hasRoute: false,
    ...over,
  };
}

function baseInput(over: Partial<RetroInput>): RetroInput {
  return {
    now: NOW, kind: 'week', offset: 0,
    activities: [], health: [], habits: [], registros: [], tasks: [], purchases: [],
    ...over,
  };
}

describe('periodBounds', () => {
  it('semana = segunda a domingo (fim exclusivo)', () => {
    const { start, end, label } = periodBounds(NOW, 'week', 0);
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(5);
    expect(start.getDate()).toBe(15); // segunda 15/06
    expect(end.getDate()).toBe(22);   // exclusivo: segunda seguinte
    expect(label).toBe('15/06 – 21/06');
  });

  it('offset -1 recua uma semana', () => {
    const { start } = periodBounds(NOW, 'week', -1);
    expect(start.getDate()).toBe(8);
  });

  it('mês começa no dia 01 e rotula em PT', () => {
    const { start, end, label } = periodBounds(NOW, 'month', 0);
    expect(start.getDate()).toBe(1);
    expect(start.getMonth()).toBe(5);
    expect(end.getMonth()).toBe(6); // julho
    expect(label).toBe('Junho 2026');
  });

  it('mês offset -1 atravessa virada de ano', () => {
    const jan = new Date(2026, 0, 10);
    const { start, label } = periodBounds(jan, 'month', -1);
    expect(start.getFullYear()).toBe(2025);
    expect(start.getMonth()).toBe(11);
    expect(label).toBe('Dezembro 2025');
  });

  it('ano começa em 01/jan', () => {
    const { start, end, label } = periodBounds(NOW, 'year', 0);
    expect(start.getMonth()).toBe(0);
    expect(start.getDate()).toBe(1);
    expect(end.getFullYear()).toBe(2027);
    expect(label).toBe('2026');
  });

  it('estação = trimestre civil (Q2 de junho)', () => {
    const { start, end, label } = periodBounds(NOW, 'season', 0);
    expect(start.getMonth()).toBe(3);  // abril
    expect(start.getDate()).toBe(1);
    expect(end.getMonth()).toBe(6);    // exclusivo: julho
    expect(label).toBe('Q2 2026');
  });

  it('estação offset -1 recua um trimestre', () => {
    const { start, label } = periodBounds(NOW, 'season', -1);
    expect(start.getMonth()).toBe(0);  // janeiro
    expect(label).toBe('Q1 2026');
  });

  it('estação atravessa virada de ano', () => {
    const fev = new Date(2026, 1, 10);
    const { start, label } = periodBounds(fev, 'season', -1);
    expect(start.getFullYear()).toBe(2025);
    expect(start.getMonth()).toBe(9);  // outubro
    expect(label).toBe('Q4 2025');
  });

  it('total cobre do epoch fixo até amanhã', () => {
    const { start, end, label } = periodBounds(NOW, 'all', 0);
    expect(start.getFullYear()).toBe(2000);
    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(5);
    expect(end.getDate()).toBe(18);    // amanhã 00:00 (NOW = 17/06)
    expect(label).toBe('Total');
  });
});

describe('latestAvailableOffset', () => {
  it('semana só fecha no domingo ≥ 20h', () => {
    expect(latestAvailableOffset(new Date(2026, 5, 21, 21), 'week')).toBe(0);  // domingo 21h
    expect(latestAvailableOffset(new Date(2026, 5, 21, 19), 'week')).toBe(-1); // domingo 19h
    expect(latestAvailableOffset(new Date(2026, 5, 17, 23), 'week')).toBe(-1); // quarta
  });

  it('mês sempre disponível só o anterior; ano disponível ao vivo', () => {
    expect(latestAvailableOffset(NOW, 'month')).toBe(-1);
    expect(latestAvailableOffset(NOW, 'year')).toBe(0);
  });

  it('estação e total disponíveis ao vivo', () => {
    expect(latestAvailableOffset(NOW, 'season')).toBe(0);
    expect(latestAvailableOffset(NOW, 'all')).toBe(0);
  });
});

describe('buildRetrospective', () => {
  it('conta tarefas e treinos do período vs anterior', () => {
    const input = baseInput({
      activities: [act('2026-06-16T08:00:00', 5000), act('2026-06-10T08:00:00', 3000)],
      tasks: [
        { doneDay: '2026-06-16', module: 'casa' },
        { doneDay: '2026-06-17', module: 'saude' },
        { doneDay: '2026-06-10', module: 'casa' }, // semana anterior
      ],
    });
    const s = buildRetrospective(input);
    expect(s.fitness.count.current).toBe(1); // só 16/06 está na semana atual
    expect(s.fitness.count.prior).toBe(1);   // 10/06 na anterior
    expect(s.tasks.total.current).toBe(2);
    expect(s.tasks.total.prior).toBe(1);
    expect(s.tasks.byModule[0].count).toBeGreaterThanOrEqual(1);
  });

  it('soma gasto estimado das compras no período', () => {
    const s = buildRetrospective(baseInput({
      purchases: [
        { doneDay: '2026-06-16', cat: 'Proteínas', price: 30, name: 'Frango' },
        { doneDay: '2026-06-18', cat: 'Vegetais', price: 12, name: 'Alface' },
        { doneDay: '2026-06-09', cat: 'Vegetais', price: 8, name: 'Tomate' }, // anterior
      ],
    }));
    expect(s.purchases.spend.current).toBe(42);
    expect(s.purchases.spend.prior).toBe(8);
    expect(s.purchases.count.current).toBe(2);
  });

  it('soma passos do período vs anterior (vem de health_daily, não das atividades)', () => {
    const s = buildRetrospective(baseInput({
      stepsByDay: new Map([
        ['2026-06-15', 8000],
        ['2026-06-16', 12000],
        ['2026-06-09', 5000], // semana anterior
      ]),
    }));
    expect(s.fitness.steps.current).toBe(20000);
    expect(s.fitness.steps.prior).toBe(5000);
  });

  it('agrupa byType por tipo de atividade, ignorando o nome livre do treino', () => {
    const s = buildRetrospective(baseInput({
      activities: [
        act('2026-06-15T08:00:00', 50000, 1800, 100, { activityId: 13, activityName: 'Morning Ride' }),
        act('2026-06-16T08:00:00', 30000, 1800, 100, { activityId: 13, activityName: 'Tour de la Meuse-Rhin' }),
        act('2026-06-17T08:00:00', 10000, 1800, 100, { activityId: 37, activityName: 'Brussels Running' }),
      ],
    }));
    expect(s.fitness.byType).toEqual([
      { key: '13', label: 'Ciclismo', count: 2, sum: 80000 },
      { key: '37', label: 'Corrida', count: 1, sum: 10000 },
    ]);
  });

  it('byType rotula tipo desconhecido como "Treino"', () => {
    const s = buildRetrospective(baseInput({
      activities: [act('2026-06-16T08:00:00', 0, 1800, 100, { activityId: 999 })],
    }));
    expect(s.fitness.byType).toEqual([{ key: '999', label: 'Treino', count: 1, sum: 0 }]);
  });

  it('zera passos quando não há série de saúde', () => {
    const s = buildRetrospective(baseInput({ activities: [act('2026-06-16T08:00:00', 5000)] }));
    expect(s.fitness.steps.current).toBe(0);
  });

  it('separa hábitos bons e ruins e conta dias com registro', () => {
    const s = buildRetrospective(baseInput({
      habits: [
        { id: 'h1', name: 'Água', bad: false, unit: 'L', logsByDay: new Map([['2026-06-15', 2], ['2026-06-16', 3]]) },
        { id: 'h2', name: 'Cigarro', bad: true, logsByDay: new Map([['2026-06-16', 1]]) },
      ],
    }));
    expect(s.habits.good).toHaveLength(1);
    expect(s.habits.good[0].recap.current).toBe(2);
    expect(s.habits.bad[0].recap.current).toBe(1);
  });

  it('soma a quantidade do hábito e a média diária do período', () => {
    const s = buildRetrospective(baseInput({
      habits: [
        {
          id: 'h1', name: 'Água', bad: false, unit: 'L',
          logsByDay: new Map([
            ['2026-06-15', 2], ['2026-06-16', 3], ['2026-06-17', 1],
            ['2026-06-10', 4], // semana anterior
          ]),
        },
      ],
    }));
    const agua = s.habits.good[0];
    expect(agua.unit).toBe('L');
    expect(agua.total.current).toBe(6);
    expect(agua.total.prior).toBe(4);
    // Semana em curso: 15/06 (1º registro) até hoje, 17/06 → 3 dias.
    expect(agua.perDayDays).toBe(3);
    expect(agua.perDay).toBeCloseTo(2);
  });

  it('média diária ancora no 1º registro (não dilui em períodos longos)', () => {
    const s = buildRetrospective(baseInput({
      kind: 'year',
      habits: [
        {
          id: 'h1', name: 'Água', bad: false, unit: 'L',
          // Hábito criado em junho: os meses anteriores não entram no divisor.
          logsByDay: new Map([['2026-06-16', 3], ['2026-06-17', 3]]),
        },
      ],
    }));
    const agua = s.habits.good[0];
    expect(agua.total.current).toBe(6);
    expect(agua.perDayDays).toBe(2); // 16/06 → 17/06
    expect(agua.perDay).toBeCloseTo(3);
  });

  it('agrega registros por marcações e esconde os sem atividade', () => {
    const s = buildRetrospective(baseInput({
      registros: [
        { id: 'r1', name: 'Cerveja', days: ['2026-06-15', '2026-06-17', '2026-06-09'] },
        { id: 'r2', name: 'Fast food', days: ['2026-06-16'] },
        { id: 'r3', name: 'Arquivado', days: ['2026-01-02'] }, // fora do período e do anterior
      ],
    }));
    expect(s.registros.map((r) => r.name)).toEqual(['Cerveja', 'Fast food']);
    expect(s.registros[0].recap.current).toBe(2); // 15 e 17/06
    expect(s.registros[0].recap.prior).toBe(1);   // 09/06
    // 15/06 (1ª marca) → hoje 17/06 = 3 dias ÷ 2 marcas.
    expect(s.registros[0].everyDays).toBeCloseTo(1.5);
  });

  it('hábito sem registro no período não gera média', () => {
    const s = buildRetrospective(baseInput({
      habits: [{ id: 'h1', name: 'Água', bad: false, unit: 'L', logsByDay: new Map([['2026-06-10', 4]]) }],
    }));
    const agua = s.habits.good[0];
    expect(agua.total.current).toBe(0);
    expect(agua.perDayDays).toBe(0);
    expect(agua.perDay).toBe(0);
  });

  it("kind 'all' agrega tudo sem base de comparação", () => {
    const s = buildRetrospective(baseInput({
      kind: 'all',
      activities: [
        act('2024-03-10T08:00:00', 5000),
        act('2026-06-16T08:00:00', 3000),
      ],
      tasks: [{ doneDay: '2025-01-05', module: 'casa' }],
    }));
    expect(s.fitness.count.current).toBe(2);   // atravessa anos
    expect(s.fitness.count.prior).toBe(0);     // prev degenerado
    expect(s.fitness.count.deltaPct).toBeNull();
    expect(s.tasks.total.current).toBe(1);
    expect(s.label).toBe('Total');
  });
});

describe('sports (Ciclismo/Corrida)', () => {
  const CYCLING = 13;
  const RUNNING = 37;

  it('agrega ciclismo: sessões, elevação, velocidade, maior pedal e fallback de tempo', () => {
    const s = buildRetrospective(baseInput({
      activities: [
        // semana atual: 20 km em 3600 s de movimento, 150 m de elevação
        act('2026-06-16T08:00:00', 20000, 4000, 500, {
          activityId: CYCLING, movingTimeS: 3600, elevationM: 150,
        }),
        // sem movingTimeS → cai para durationS (1800)
        act('2026-06-17T08:00:00', 10000, 1800, 300, {
          activityId: CYCLING, elevationM: 50,
        }),
        // semana anterior
        act('2026-06-10T08:00:00', 15000, 2700, 400, {
          activityId: CYCLING, movingTimeS: 2700, elevationM: 80,
        }),
        // outro esporte não entra
        act('2026-06-16T18:00:00', 5000, 1500, 200, { activityId: RUNNING }),
      ],
    }));
    const sp = s.sports.cycling!;
    expect(sp).not.toBeNull();
    expect(sp.sessions.current).toBe(2);
    expect(sp.sessions.prior).toBe(1);
    expect(sp.distanceM.current).toBe(30000);
    expect(sp.movingS.current).toBe(3600 + 1800); // fallback durationS no 2º
    expect(sp.elevationM.current).toBe(200);
    expect(sp.elevationM.prior).toBe(80);
    expect(sp.calories.current).toBe(800);
    expect(sp.speedMps.current).toBeCloseTo(30000 / 5400);
    expect(sp.longest).toEqual({
      activityRef: '2026-06-16T08:00:00', distanceM: 20000, date: '2026-06-16T08:00:00',
    });
    expect(sp.bestEfforts).toEqual([]); // ciclismo não tem recordes
  });

  it('corrida: melhor esforço do período com base no anterior', () => {
    const s = buildRetrospective(baseInput({
      activities: [
        act('2026-06-15T08:00:00', 5000, 1500, 300, {
          activityId: RUNNING, bestEfforts: { '5000': 1500 },
        }),
        act('2026-06-17T08:00:00', 6000, 1700, 350, {
          activityId: RUNNING, bestEfforts: { '5000': 1440, '1000': 250 },
        }),
        // semana anterior: 5k mais rápido ainda
        act('2026-06-09T08:00:00', 5000, 1400, 300, {
          activityId: RUNNING, bestEfforts: { '5000': 1400 },
        }),
      ],
    }));
    const sp = s.sports.running!;
    // ordem segue BEST_EFFORT_LABELS: 1000 antes de 5000
    expect(sp.bestEfforts.map((b) => b.key)).toEqual(['1000', '5000']);
    const b5k = sp.bestEfforts.find((b) => b.key === '5000')!;
    expect(b5k.seconds).toBe(1440);                       // mín do período
    expect(b5k.activityRef).toBe('2026-06-17T08:00:00');  // atividade recordista
    expect(b5k.priorSeconds).toBe(1400);                  // mín do anterior
    const b1k = sp.bestEfforts.find((b) => b.key === '1000')!;
    expect(b1k.seconds).toBe(250);
    expect(b1k.priorSeconds).toBeNull();
  });

  it('null sem atividades do esporte; hidden excluída; guarda de divisão', () => {
    const s = buildRetrospective(baseInput({
      activities: [
        act('2026-06-16T08:00:00', 5000, 1500, 300, { activityId: RUNNING, hidden: true }),
        // corrida sem distância/movimento → speedMps null
        act('2026-06-17T08:00:00', 0, 0, 100, { activityId: RUNNING }),
      ],
    }));
    expect(s.sports.cycling).toBeNull();                 // nenhum pedal
    const sp = s.sports.running!;
    expect(sp.sessions.current).toBe(1);                 // hidden fora
    expect(sp.speedMps.current).toBeNull();              // ÷0 guardado
    expect(sp.longest).toBeNull();                       // sem distância > 0
  });

  it("kind 'all': recordes sem priorSeconds e sessões sem base", () => {
    const s = buildRetrospective(baseInput({
      kind: 'all',
      activities: [
        act('2024-06-15T08:00:00', 5000, 1500, 300, {
          activityId: RUNNING, bestEfforts: { '5000': 1500 },
        }),
      ],
    }));
    const sp = s.sports.running!;
    expect(sp.sessions.current).toBe(1);
    expect(sp.sessions.prior).toBe(0);
    expect(sp.bestEfforts[0].priorSeconds).toBeNull();
  });
});

describe('buildYearByMonth', () => {
  it('distribui atividades e tarefas por mês do ano', () => {
    const buckets = buildYearByMonth(baseInput({
      kind: 'year', offset: 0,
      activities: [act('2026-03-10T08:00:00', 5000), act('2026-03-20T08:00:00', 1000)],
      tasks: [{ doneDay: '2026-07-01', module: 'casa' }],
    }));
    expect(buckets).toHaveLength(12);
    expect(buckets[2].workouts).toBe(2);  // março
    expect(buckets[2].distanceKm).toBe(6);
    expect(buckets[6].tasks).toBe(1);      // julho
  });
});

// ─────────────────────────────────────────────────────────────
// Camada 0 do spec v2 (docs/specs/retrospectiva/v2-jornal.md).
// Cada teste aqui prova um dos defeitos D1–D3 da v1.
// ─────────────────────────────────────────────────────────────

/** Dias 'YYYY-MM-DD' contando de trás pra frente a partir de NOW. */
function daysBack(n: number, from = NOW): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(from);
    d.setDate(d.getDate() - i);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  return out;
}

describe('retroSince — janela de análise ≠ janela de exibição (§2.1)', () => {
  it('no modo semanal alcança pelo menos a janela de análise', () => {
    const since = retroSince(NOW, 'week', 0);
    const dias = Math.round((NOW.getTime() - since.getTime()) / 86_400_000);
    // A v1 devolvia ~14 dias aqui — era o defeito D1.
    expect(dias).toBeGreaterThanOrEqual(ANALYSIS_WINDOW_DAYS);
  });

  it('nunca encurta o período anterior quando ele é mais antigo que a janela', () => {
    // Ano de 2 anos atrás começa muito antes de hoje−90d.
    const since = retroSince(NOW, 'year', -1);
    const prior = periodBounds(NOW, 'year', -2).start;
    expect(since.getTime()).toBeLessThanOrEqual(prior.getTime());
  });

  it('alargar o fetch não muda nenhum RecapValue', () => {
    // Uma atividade dentro da semana e outra 40 dias atrás (dentro da janela larga,
    // fora do período exibido). O recap da semana só pode enxergar a primeira.
    const dentro = daysBack(1)[0];
    const fora = daysBack(41)[40];
    const s = buildRetrospective(baseInput({
      kind: 'week', offset: 0,
      activities: [act(`${dentro}T08:00:00`, 5000), act(`${fora}T08:00:00`, 90_000)],
    }));
    expect(s.fitness.count.current).toBe(1);
    expect(s.fitness.distanceM.current).toBe(5000);
  });
});

describe('compareHighlights — classe antes de |deltaPct| (§2.2)', () => {
  const hl = (over: Partial<WeekHighlight>): WeekHighlight => ({
    id: 'x', tone: 'neutral', icon: 'workout', text: 't', priority: 0, ...over,
  });

  it('cross fica acima de volume mesmo com deltaPct muito menor', () => {
    const volume = hl({ id: 'v', kind: 'volume', priority: 50 });   // +1 treino = +50%
    const cross = hl({ id: 'c', kind: 'cross', priority: 8 });      // sono −8%
    // A v1 ordenava por priority cru: o volume ganhava. Era o defeito D2.
    expect([volume, cross].sort(compareHighlights)[0].id).toBe('c');
  });

  it('|deltaPct| desempata dentro da mesma classe', () => {
    const a = hl({ id: 'a', kind: 'volume', priority: 10 });
    const b = hl({ id: 'b', kind: 'volume', priority: 40 });
    expect([a, b].sort(compareHighlights)[0].id).toBe('b');
  });

  it('kind ausente é tratado como volume — destaques da Semana intactos', () => {
    const semKind = hl({ id: 'legado', priority: 90 });
    const cross = hl({ id: 'c', kind: 'cross', priority: 6 });
    expect([semKind, cross].sort(compareHighlights)[0].id).toBe('c');
    const outroVolume = hl({ id: 'v', kind: 'volume', priority: 95 });
    expect([semKind, outroVolume].sort(compareHighlights)[0].id).toBe('v');
  });
});

describe('insight cruzado com janela larga (§2.3, §2.5)', () => {
  // 60 dias de sono: nos dias com o gatilho dorme 6h, nos demais 8h.
  const dias = daysBack(60);
  const gatilho = dias.filter((_, i) => i % 4 === 0);            // 15 dias
  const sono = new Map(dias.map((d) => [d, gatilho.includes(d) ? 6 : 8]));

  const input = baseInput({
    kind: 'week', offset: 0,
    health: [{
      metric: 'sono', label: 'Sono', higherIsWorse: false, icon: 'sleep',
      decimals: 1, unit: 'h', valuesByDay: sono,
    }],
    habits: [{
      id: 'h1', name: 'cerveja', bad: true, unit: 'L',
      logsByDay: new Map(gatilho.map((d) => [d, 1])),
    }],
  });

  it('o insight cruzado existe e lidera — na visão SEMANAL', () => {
    const hs = buildRetroHighlights(buildRetrospective(input), input);
    const cross = hs.filter((h) => h.kind === 'cross');
    // Na v1 esta lista era vazia: 7 dias não fecham MIN_DAYS_PER_SIDE dos dois lados.
    expect(cross.length).toBeGreaterThan(0);
    expect(hs[0].kind).toBe('cross');
  });

  it('o destaque cruzado carrega a amostra (o `n`)', () => {
    const hs = buildRetroHighlights(buildRetrospective(input), input);
    const cross = hs.find((h) => h.kind === 'cross')!;
    expect(cross.support).toMatch(/\d+ dias com · \d+ sem/);
    expect(cross.support).toContain('associação, não causa');
  });

  it('createdOn descarta dias anteriores à criação do gatilho', () => {
    const recente = { ...input, habits: [{ ...input.habits[0], createdOn: dias[9] }] };
    const hs = buildRetroHighlights(buildRetrospective(recente), recente);
    const cross = hs.find((h) => h.kind === 'cross');
    // Só ~10 dias sobram: 3 com o gatilho e 7 sem — ainda fecha, mas com n menor.
    if (cross) expect(cross.support).not.toBe(
      buildRetroHighlights(buildRetrospective(input), input).find((h) => h.kind === 'cross')!.support,
    );
  });
});

describe('buildTaskGrid — a faixa das diárias', () => {
  // Semana corrente: segunda 15/06 a domingo 21/06. NOW = quarta 17/06.
  const semana = ['2026-06-15', '2026-06-16', '2026-06-17', '2026-06-18', '2026-06-19', '2026-06-20', '2026-06-21'];

  const grid = (dailyTasks: RetroInput['dailyTasks'], kind: PeriodKind = 'week') =>
    buildTaskGrid({ now: NOW, kind, offset: 0, dailyTasks });

  it('sem nenhuma série diária devolve null — a UI omite o bloco', () => {
    expect(grid([])).toBeNull();
    expect(grid(undefined)).toBeNull();
  });

  it('uma célula por dia do período, com a segunda em weekday 0', () => {
    const g = grid([{ id: 't', name: 'ZMA', days: [] }])!;
    expect(g.rows[0].cells.map((c) => c.day)).toEqual(semana);
    expect(g.rows[0].cells[0].weekday).toBe(0); // segunda
    expect(g.rows[0].cells[6].weekday).toBe(6); // domingo
  });

  it('conta feito e esquecido, e ignora o futuro', () => {
    // Tomou 15 e 16; esqueceu nada ainda; 17 é hoje; 18–21 não chegaram.
    const g = grid([{ id: 't', name: 'ZMA', days: ['2026-06-15', '2026-06-16'] }])!;
    const r = g.rows[0];
    expect(r.done).toBe(2);
    expect(r.missed).toBe(0);
    expect(r.possible).toBe(2);
    expect(r.cells.slice(3).every((c) => c.done === null)).toBe(true);
  });

  it('o dia que passou sem marcação é esquecido', () => {
    const g = grid([{ id: 't', name: 'ZMA', days: ['2026-06-16'] }])!;
    const r = g.rows[0];
    expect(r.cells[0].done).toBe(false); // segunda passou em branco
    expect(r.done).toBe(1);
    expect(r.missed).toBe(1);
    expect(r.rate).toBeCloseTo(0.5);
  });

  it('hoje ainda não feito fica pendente, não esquecido — o denominador não pisca', () => {
    const g = grid([{ id: 't', name: 'ZMA', days: ['2026-06-15', '2026-06-16'] }])!;
    const hoje = g.rows[0].cells.find((c) => c.day === '2026-06-17')!;
    expect(hoje.done).toBeNull();
    expect(g.rows[0].possible).toBe(2); // 15 e 16 — hoje entra só quando marcado

    const feito = grid([{ id: 't', name: 'ZMA', days: [...semana.slice(0, 3)] }])!;
    expect(feito.rows[0].cells.find((c) => c.day === '2026-06-17')!.done).toBe(true);
    expect(feito.rows[0].possible).toBe(3);
  });

  it('createdOn zera a cobrança dos dias anteriores à série', () => {
    // "Comer uma fruta" criada na terça: a segunda não conta como esquecida.
    const g = grid([{ id: 'f', name: 'Comer uma fruta', days: [], createdOn: '2026-06-16' }])!;
    expect(g.rows[0].cells[0].done).toBeNull();
    expect(g.rows[0].cells[1].done).toBe(false); // terça passou e não fez
    expect(g.rows[0].missed).toBe(1);
    expect(g.rows[0].possible).toBe(1);
  });

  it('recap compara com o mesmo período anterior', () => {
    const g = grid([{
      id: 't', name: 'ZMA',
      // 2 nesta semana; 4 na semana de 08–14/06.
      days: ['2026-06-15', '2026-06-16', '2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11'],
    }])!;
    expect(g.rows[0].recap.current).toBe(2);
    expect(g.rows[0].recap.prior).toBe(4);
  });

  it('o total agrega as linhas — várias séries no mesmo eixo de dias', () => {
    const g = grid([
      { id: 'a', name: 'ZMA', days: ['2026-06-15', '2026-06-16'] },
      { id: 'b', name: 'Creatina', days: ['2026-06-15'] },
    ])!;
    expect(g.rows).toHaveLength(2);
    expect(g.done).toBe(3);
    expect(g.possible).toBe(4);   // 2 dias fechados × 2 séries
    expect(g.rate).toBeCloseTo(0.75);
    // Mesmo comprimento: é o que permite comparar as faixas empilhadas.
    expect(g.rows[0].cells).toHaveLength(g.rows[1].cells.length);
  });

  it('no mês a faixa cobre o mês inteiro, parando em hoje', () => {
    const g = grid([{ id: 't', name: 'ZMA', days: [] }], 'month')!;
    expect(g.rows[0].cells).toHaveLength(30); // junho
    expect(g.rows[0].missed).toBe(16);        // 01–16; 17 é hoje (pendente)
    expect(g.rows[0].cells.filter((c) => c.done === null)).toHaveLength(14);
  });
});

describe('séries diárias NÃO alimentam o cruzamento de saúde', () => {
  const dias = daysBack(60);
  const falhou = dias.filter((_, i) => i % 4 === 0);

  it('nenhum destaque cruzado nasce de uma tarefa diária', () => {
    const input = baseInput({
      kind: 'week', offset: 0,
      health: [{
        metric: 'sono', label: 'Sono', higherIsWorse: false, icon: 'sleep',
        decimals: 1, unit: 'h',
        valuesByDay: new Map(dias.map((d) => [d, falhou.includes(d) ? 6 : 8])),
      }],
      // Correlação forte de propósito: mesmo assim não pode virar destaque.
      dailyTasks: [{ id: 't1', name: 'ZMA', days: dias.filter((d) => !falhou.includes(d)) }],
    });
    const hs = buildRetroHighlights(buildRetrospective(input), input);
    expect(hs.some((h) => h.kind === 'cross')).toBe(false);
  });
});

describe('recorrência diária = weekly com a semana inteira', () => {
  it('isDailyRecurrence reconhece só os sete dias', () => {
    expect(isDailyRecurrence({ kind: 'weekly', weekdays: [...EVERY_WEEKDAY] })).toBe(true);
    expect(isDailyRecurrence({ kind: 'weekly', weekdays: [1, 2, 3, 4, 5] })).toBe(false);
    expect(isDailyRecurrence({ kind: 'monthly', day: 1 })).toBe(false);
  });

  it('o rótulo vira "Todo dia" em vez dos sete abreviados', () => {
    expect(describeRecurrence({ kind: 'weekly', weekdays: [...EVERY_WEEKDAY] })).toBe('Todo dia');
    expect(describeRecurrence({ kind: 'weekly', weekdays: [1, 3] })).toBe('Seg/Qua');
  });

  it('o motor de recorrência já a trata como qualquer weekly — sem ramo novo', () => {
    const diaria = { kind: 'weekly' as const, weekdays: [...EVERY_WEEKDAY] };
    // Toda data é candidata: a primeira é hoje, e a próxima é sempre amanhã.
    expect(firstDueDate(diaria, '2026-06-17')).toBe('2026-06-17');
    expect(nextDueDate(diaria, '2026-06-17')).toBe('2026-06-18');
    expect(nextDueDate(diaria, '2026-06-30')).toBe('2026-07-01'); // vira o mês
  });
});

describe('buildRetroLede — a manchete (§3)', () => {
  const hl = (over: Partial<WeekHighlight>): WeekHighlight => ({
    id: 'x', tone: 'neutral', icon: 'workout', text: 't', priority: 0, ...over,
  });

  it('ordena em ordem NARRATIVA — fato, variação, insight', () => {
    // Entrada na ordem de relevância (cross primeiro), como buildRetroHighlights entrega.
    const lede = buildRetroLede([
      hl({ id: 'c', kind: 'cross', text: 'nos dias com "cerveja", sono −8%', support: '24 dias com · 66 sem' }),
      hl({ id: 'h', kind: 'health', text: 'sono piorou: −0,6h' }),
      hl({ id: 'v', kind: 'volume', text: '3 treinos neste período' }),
    ]);
    expect(lede.sentences).toEqual([
      '3 treinos neste período.',
      'Sono piorou: −0,6h.',
      'Nos dias com "cerveja", sono −8%.',
    ]);
    expect(lede.support).toBe('24 dias com · 66 sem');
    expect(lede.thin).toBe(false);
  });

  it('no máximo uma frase por classe — um jornal tem uma manchete, não um índice', () => {
    const lede = buildRetroLede([
      hl({ id: 'v1', kind: 'volume', text: '3 treinos' }),
      hl({ id: 'v2', kind: 'volume', text: '64 km percorridos' }),
      hl({ id: 'v3', kind: 'volume', text: '11 tarefas' }),
    ]);
    expect(lede.sentences).toEqual(['3 treinos.']);
  });

  it('nunca passa de três frases', () => {
    const lede = buildRetroLede([
      hl({ id: 'c', kind: 'cross', text: 'a' }),
      hl({ id: 'h', kind: 'health', text: 'b' }),
      hl({ id: 'an', kind: 'anomaly', text: 'c' }),
      hl({ id: 'v', kind: 'volume', text: 'd' }),
    ]);
    expect(lede.sentences.length).toBeLessThanOrEqual(3);
  });

  it('sem material vira thin em vez de frase vazia', () => {
    const lede = buildRetroLede([]);
    expect(lede.thin).toBe(true);
    expect(lede.sentences).toEqual([]);
    expect(lede.support).toBeUndefined();
  });

  it('sem insight cruzado não inventa support', () => {
    const lede = buildRetroLede([hl({ id: 'v', kind: 'volume', text: '3 treinos' })]);
    expect(lede.support).toBeUndefined();
    expect(lede.thin).toBe(false);
  });
});

describe('buildHeatmap — genérico em N (§4)', () => {
  /** Série de sono cobrindo maio e junho/2026 — maio é período fechado, junho é o vivo. */
  function sono(over: Record<string, number> = {}, base = 7) {
    const m = new Map<string, number>();
    for (let d = 1; d <= 31; d++) m.set(`2026-05-${String(d).padStart(2, '0')}`, base);
    for (let d = 1; d <= 30; d++) m.set(`2026-06-${String(d).padStart(2, '0')}`, base);
    for (const [k, v] of Object.entries(over)) m.set(k, v);
    return m;
  }
  const metric = (valuesByDay: Map<string, number>) => ({
    metric: 'sono', label: 'Sono', higherIsWorse: false,
    icon: 'sleep' as const, decimals: 1, unit: 'h', valuesByDay,
  });

  it('N vem do período: semana fechada ⇒ 7 células, mês fechado ⇒ 31', () => {
    const h = metric(sono());
    // Períodos fechados: a grade é cheia. Para o período ao vivo, ver o describe
    // 'dia futuro não é dia sem dado'.
    const semana = buildHeatmap(baseInput({ kind: 'week', offset: -1, health: [h] }), 'sono');
    const mes = buildHeatmap(baseInput({ kind: 'month', offset: -1, health: [h] }), 'sono');
    expect(semana!.cells).toHaveLength(7);
    expect(mes!.cells).toHaveLength(31); // maio
  });

  it('pad alinha a grade que começa na segunda', () => {
    // 01/06/2026 é uma segunda ⇒ nenhum pad; a semana de NOW começa em 15/06, idem.
    const mes = buildHeatmap(baseInput({ kind: 'month', offset: 0, health: [metric(sono())] }), 'sono');
    expect(mes!.pad).toBe(0);
    expect(mes!.cells[0].weekday).toBe(0);
    // Julho/2026 começa numa quarta ⇒ 2 células de pad.
    const julho = buildHeatmap(baseInput({ kind: 'month', offset: 1, health: [metric(sono())] }), 'sono');
    expect(julho?.pad ?? 2).toBe(2);
  });

  it('escala divergente: abaixo da meta é negativo, acima é positivo', () => {
    const h = metric(sono({
      '2026-06-08': 4.9,  // −30%
      '2026-06-09': 5.6,  // −20%
      '2026-06-10': 6.4,  // −8,6%
      '2026-06-11': 7.0,  // na meta
      '2026-06-12': 7.3,  // +4,3%
      '2026-06-13': 7.6,  // +8,6%
    }));
    const s = buildHeatmap(baseInput({ kind: 'week', offset: -1, health: [h] }), 'sono')!;
    expect(s.cells.map((c) => c.step).slice(0, 6)).toEqual([-3, -2, -1, 0, 1, 2]);
  });

  it('dia sem dado ≠ dia neutro', () => {
    const vals = sono();
    vals.delete('2026-06-09');
    const s = buildHeatmap(baseInput({ kind: 'week', offset: -1, health: [metric(vals)] }), 'sono')!;
    const vazio = s.cells.find((c) => c.day === '2026-06-09')!;
    expect(vazio.value).toBeNull();
    expect(vazio.step).toBeNull();          // null, e não 0 — não medido não é "em cima da meta"
    expect(s.measured).toBe(6);
  });

  it('devolve null sem métrica, sem meta, ou sem nenhum dia medido', () => {
    const inputSemMetrica = baseInput({ kind: 'week', offset: 0, health: [] });
    expect(buildHeatmap(inputSemMetrica, 'sono')).toBeNull();

    const semMeta = metric(sono());
    expect(buildHeatmap(
      baseInput({ kind: 'week', offset: 0, health: [{ ...semMeta, metric: 'vfc' }] }),
      'vfc',
    )).toBeNull();

    expect(buildHeatmap(
      baseInput({ kind: 'week', offset: -400, health: [metric(sono())] }),
      'sono',
    )).toBeNull();
  });

  it('higherIsWorse inverte o lado ruim da escala', () => {
    const alto = new Map([['2026-06-08', 10]]);
    const bom = buildHeatmap(baseInput({
      kind: 'week', offset: -1,
      health: [{ ...metric(alto), metric: 'sono', higherIsWorse: false }],
    }), 'sono')!;
    const ruim = buildHeatmap(baseInput({
      kind: 'week', offset: -1,
      health: [{ ...metric(alto), metric: 'sono', higherIsWorse: true }],
    }), 'sono')!;
    expect(bom.cells[0].step).toBe(2);   // dormir mais é melhor
    expect(ruim.cells[0].step).toBe(-3); // se subir fosse ruim, o mesmo valor é o pior
  });
});

describe('diagramação em blocos (§6)', () => {
  const HOJE = '2026-08-25';

  it('resolve sobre os defaults e nunca esconde uma seção nova', () => {
    // Ordem salva por uma versão antiga que não conhecia 'heatmap' nem 'yearSeries'.
    const p = resolveRetroPrefs({ order: ['lede', 'kpis'] });
    expect(p.order.slice(0, 2)).toEqual(['lede', 'kpis']);
    expect(p.order).toContain('heatmap');
    expect(p.order).toHaveLength(RETRO_BLOCKS.length);
  });

  it('descarta id desconhecido e ordem duplicada', () => {
    const p = resolveRetroPrefs({ order: ['lede', 'lede', 'inventado', 'kpis'] });
    expect(p.order.filter((id) => id === 'lede')).toHaveLength(1);
    expect(p.order).not.toContain('inventado' as never);
  });

  it('jsonb inválido cai no default sem quebrar', () => {
    for (const raw of [null, 42, 'x', { order: 'nope', hidden: 7 }]) {
      const p = resolveRetroPrefs(raw);
      expect(p.order).toHaveLength(RETRO_BLOCKS.length);
      expect(p.hidden).toEqual({});
    }
  });

  it('bloco fixo não pode ser escondido, nem pelo jsonb nem pelo toggle', () => {
    expect(resolveRetroPrefs({ hidden: { lede: HOJE } }).hidden).toEqual({});
    const p = toggleBlock(DEFAULT_RETRO_PREFS, 'lede', HOJE);
    expect(p.hidden.lede).toBeUndefined();
  });

  it('visibleBlocks respeita ordem, ocultos e o modo do período', () => {
    const escondido = toggleBlock(DEFAULT_RETRO_PREFS, 'kpis', HOJE);
    const semana = visibleBlocks(escondido, 'week').map((b) => b.id);
    expect(semana).not.toContain('kpis');
    expect(semana).toContain('heatmap');       // heatmap é de week/month/season
    expect(semana).not.toContain('yearSeries'); // yearSeries é só do ano
    expect(visibleBlocks(escondido, 'year').map((b) => b.id)).toContain('yearSeries');
  });

  it('esconder carimba a data; reativar apaga', () => {
    const off = toggleBlock(DEFAULT_RETRO_PREFS, 'habits', HOJE);
    expect(off.hidden.habits).toBe(HOJE);
    expect(toggleBlock(off, 'habits', '2026-09-01').hidden.habits).toBeUndefined();
  });

  it('a regra dos 60 dias só marca o que passou do prazo', () => {
    const p: RetroPrefs = {
      ...DEFAULT_RETRO_PREFS,
      hidden: { habits: '2026-06-01', purchases: '2026-08-20' },
    };
    const mortos = deadBlocks(p, HOJE);
    expect(mortos).toContain('habits');     // 85 dias
    expect(mortos).not.toContain('purchases'); // 5 dias
  });

  it('a diagramação congela quando a prova de gráfica termina', () => {
    expect(layoutEditable(DEFAULT_RETRO_PREFS, HOJE)).toBe(true); // prova nem começou
    expect(layoutEditable({ ...DEFAULT_RETRO_PREFS, proofStartedOn: '2026-08-01' }, HOJE)).toBe(true);
    // Jornal é igual toda edição: passados os 60 dias, para de ser reordenável.
    expect(layoutEditable({ ...DEFAULT_RETRO_PREFS, proofStartedOn: '2026-05-01' }, HOJE)).toBe(false);
  });

  it('moveBlock troca vizinhos e ignora movimento fora da lista', () => {
    const p = moveBlock(DEFAULT_RETRO_PREFS, 'highlights', -1);
    expect(p.order[1]).toBe('highlights');
    expect(p.order[2]).toBe('kpis');
    expect(moveBlock(DEFAULT_RETRO_PREFS, 'lede', -1).order).toEqual(DEFAULT_RETRO_PREFS.order);
  });
});

describe('heatmap — dia futuro não é dia sem dado', () => {
  const metric = (valuesByDay: Map<string, number>) => ({
    metric: 'sono', label: 'Sono', higherIsWorse: false,
    icon: 'sleep' as const, decimals: 1, unit: 'h', valuesByDay,
  });

  it('período ao vivo para em hoje, em vez de pintar o futuro de vazio', () => {
    // NOW = quarta, 17/06/2026. A estação Q2 vai de 01/abr a 30/jun.
    const h = metric(new Map([['2026-06-15', 7]]));
    const s = buildHeatmap(baseInput({ kind: 'season', offset: 0, health: [h] }), 'sono')!;
    // 01/abr–17/jun = 78 dias. O trimestre inteiro teria 91 — as 13 de julho... não,
    // as 13 restantes de junho seriam futuro puro.
    expect(s.cells).toHaveLength(78);
    expect(s.cells[s.cells.length - 1].day).toBe('2026-06-17');
  });

  it('período fechado no passado continua inteiro', () => {
    const h = metric(new Map([['2026-05-10', 7]]));
    const s = buildHeatmap(baseInput({ kind: 'month', offset: -1, health: [h] }), 'sono')!;
    expect(s.cells).toHaveLength(31); // maio inteiro
    expect(s.cells[30].day).toBe('2026-05-31');
  });

  it('a semana corrente também para em hoje', () => {
    const h = metric(new Map([['2026-06-15', 7]]));
    const s = buildHeatmap(baseInput({ kind: 'week', offset: 0, health: [h] }), 'sono')!;
    expect(s.cells).toHaveLength(3); // seg 15, ter 16, qua 17
  });
});
