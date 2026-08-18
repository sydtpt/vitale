import { describe, it, expect } from '@jest/globals';
import type { CounterHabit, HabitLog } from '@vitale/shared';
import { localDateStr, isMet, isOver, progress, logsByDate, streak, cleanStreak, daysInclusive, average, lastNDates, heatmap } from '@vitale/shared';

const agua: Pick<CounterHabit, 'direction' | 'target'> = { direction: 'at_least', target: 4 };
const cigarro: Pick<CounterHabit, 'direction' | 'target'> = { direction: 'at_most', target: 5 };
const semMeta: Pick<CounterHabit, 'direction' | 'target'> = { direction: 'at_most', target: undefined };

describe('isMet / isOver / progress', () => {
  it('at_least bate quando value ≥ target', () => {
    expect(isMet(agua, 3.75)).toBe(false);
    expect(isMet(agua, 4)).toBe(true);
    expect(isMet(agua, 5)).toBe(true);
  });

  it('at_most bate quando value ≤ target e estoura acima', () => {
    expect(isMet(cigarro, 5)).toBe(true);
    expect(isMet(cigarro, 6)).toBe(false);
    expect(isOver(cigarro, 6)).toBe(true);
    expect(isOver(cigarro, 5)).toBe(false);
  });

  it('sem target nunca é "batida" nem "estourada"', () => {
    expect(isMet(semMeta, 10)).toBe(false);
    expect(isOver(semMeta, 10)).toBe(false);
    expect(progress(semMeta, 10)).toBe(0);
  });

  it('progress satura em [0,1]', () => {
    expect(progress(agua, 2)).toBe(0.5);
    expect(progress(agua, 8)).toBe(1);
  });
});

function log(habitId: string, logDate: string, value: number): HabitLog {
  return { id: `${habitId}-${logDate}`, habitId, logDate, value };
}

describe('streak', () => {
  it('at_least conta dias consecutivos batendo a meta, hoje pendente não quebra', () => {
    const today = '2026-05-20';
    const byDate = logsByDate([
      log('a', '2026-05-20', 1), // hoje pendente (não bateu) → pula sem quebrar
      log('a', '2026-05-19', 4),
      log('a', '2026-05-18', 5),
      log('a', '2026-05-17', 2), // quebra
      log('a', '2026-05-16', 4),
    ]);
    expect(streak(agua, byDate, today)).toBe(2); // 19 e 18
  });

  it('at_least conta hoje quando já bateu', () => {
    const today = '2026-05-20';
    const byDate = logsByDate([log('a', '2026-05-20', 4), log('a', '2026-05-19', 4)]);
    expect(streak(agua, byDate, today)).toBe(2);
  });

  it('at_most: dias sem log contam como dentro do teto', () => {
    const today = '2026-05-20';
    // 20 (0 ok), 19 (0 ok), 18 (0 ok) cumprem; 17 (6) estoura → streak 3
    const byDate = logsByDate([log('c', '2026-05-17', 6)]);
    expect(streak(cigarro, byDate, today)).toBe(3);
  });

  it('sem target → streak 0', () => {
    expect(streak(semMeta, new Map(), '2026-05-20')).toBe(0);
  });

  it('at_most sem nenhum log não trava: limita à janela (maxDays)', () => {
    // Sem dia que estoure o teto, o laço caminharia ao infinito; maxDays corta.
    expect(streak(cigarro, new Map(), '2026-05-20', 84)).toBe(84);
  });
});

describe('cleanStreak (hábito ruim: dias sem fazer)', () => {
  it('conta dias consecutivos sem registro, terminando hoje', () => {
    const today = '2026-05-20';
    // 20 (0), 19 (0) sem fazer; 18 fez (2) → quebra → streak 2
    const byDate = logsByDate([log('c', '2026-05-18', 2)]);
    expect(cleanStreak(byDate, today)).toBe(2);
  });

  it('hoje conta: se já fez hoje (value > 0), volta a 0', () => {
    const today = '2026-05-20';
    const byDate = logsByDate([log('c', '2026-05-20', 1)]);
    expect(cleanStreak(byDate, today)).toBe(0);
  });

  it('sem nenhum registro: limita à janela (maxDays = idade do hábito)', () => {
    expect(cleanStreak(new Map(), '2026-05-20', 5)).toBe(5);
  });
});

describe('daysInclusive', () => {
  it('mesmo dia ⇒ 1', () => {
    expect(daysInclusive('2026-05-20', '2026-05-20')).toBe(1);
  });
  it('conta o intervalo de forma inclusiva', () => {
    expect(daysInclusive('2026-05-18', '2026-05-20')).toBe(3);
  });
  it('nunca menor que 1 (data futura)', () => {
    expect(daysInclusive('2026-05-25', '2026-05-20')).toBe(1);
  });
});

describe('average / lastNDates / heatmap / localDateStr', () => {
  it('average', () => {
    expect(average([])).toBe(0);
    expect(average([2, 4, 6])).toBe(4);
  });

  it('lastNDates devolve N datas terminando hoje', () => {
    const dates = lastNDates(3, new Date('2026-05-20T09:00:00'));
    expect(dates).toEqual(['2026-05-18', '2026-05-19', '2026-05-20']);
  });

  it('heatmap marca met por dia', () => {
    const byDate = logsByDate([log('a', '2026-05-19', 4), log('a', '2026-05-20', 1)]);
    const cells = heatmap(agua, byDate, ['2026-05-19', '2026-05-20']);
    expect(cells).toEqual([
      { date: '2026-05-19', value: 4, met: true },
      { date: '2026-05-20', value: 1, met: false },
    ]);
  });

  it('localDateStr formata a data local', () => {
    expect(localDateStr(new Date('2026-01-05T10:00:00'))).toBe('2026-01-05');
  });
});
