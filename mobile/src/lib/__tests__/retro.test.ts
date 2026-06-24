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

function act(startAt: string, distanceM = 0, durationS = 1800, calories = 100): Activity {
  return {
    id: startAt, userId: 'u', activityId: 1, calories, startAt,
    endAt: startAt, durationS, distanceM, hasRoute: false,
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
