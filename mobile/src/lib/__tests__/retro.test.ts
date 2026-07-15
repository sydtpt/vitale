import { describe, it, expect } from '@jest/globals';
import {
  periodBounds,
  latestAvailableOffset,
  buildRetrospective,
  buildYearByMonth,
  type Activity,
  type RetroInput,
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

  it('separa hábitos bons e ruins e conta dias com registro', () => {
    const s = buildRetrospective(baseInput({
      habits: [
        { id: 'h1', name: 'Água', bad: false, logsByDay: new Map([['2026-06-15', 2], ['2026-06-16', 3]]) },
        { id: 'h2', name: 'Cigarro', bad: true, logsByDay: new Map([['2026-06-16', 1]]) },
      ],
    }));
    expect(s.habits.good).toHaveLength(1);
    expect(s.habits.good[0].recap.current).toBe(2);
    expect(s.habits.bad[0].recap.current).toBe(1);
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
