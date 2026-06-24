import { describe, it, expect } from '@jest/globals';
import type { TodoOccurrence, TodoTemplate } from '@vitale/shared';
import {
  localDateStr,
  localTimeStr,
  isValidTime,
  isValidDate,
  addDays,
  daysBetween,
  firstDueDate,
  nextDueDate,
  triggeredDueDate,
  isOverdue,
  isStarted,
  isVisibleNow,
  isPastEnd,
  daysLate,
  dueUsage,
  reconcileTemplate,
} from '../todo-logic';

// 2026-05-20 é uma quarta-feira (getDay() === 3).
const TODAY = '2026-05-20';

describe('helpers de data', () => {
  it('localDateStr formata data local', () => {
    expect(localDateStr(new Date('2026-01-05T10:00:00'))).toBe('2026-01-05');
  });
  it('addDays atravessa o mês', () => {
    expect(addDays('2026-05-20', 15)).toBe('2026-06-04');
  });
  it('daysBetween', () => {
    expect(daysBetween('2026-05-18', '2026-05-20')).toBe(2);
    expect(daysBetween('2026-05-20', '2026-05-18')).toBe(-2);
  });
});

describe('triggeredDueDate (on_workout)', () => {
  it('sem dueInDays → sem prazo (null)', () => {
    expect(triggeredDueDate({ kind: 'on_workout' }, TODAY)).toBeNull();
  });
  it('dueInDays = 0 → no dia do gatilho', () => {
    expect(triggeredDueDate({ kind: 'on_workout', dueInDays: 0 }, TODAY)).toBe(TODAY);
  });
  it('dueInDays = N → N dias após o gatilho', () => {
    expect(triggeredDueDate({ kind: 'on_workout', dueInDays: 3 }, TODAY)).toBe('2026-05-23');
  });
  it('outros kinds → null', () => {
    expect(triggeredDueDate({ kind: 'none' }, TODAY)).toBeNull();
  });
});

describe('firstDueDate', () => {
  it('monthly: este mês se o dia ainda não passou, senão o próximo', () => {
    expect(firstDueDate({ kind: 'monthly', day: 25 }, TODAY)).toBe('2026-05-25');
    expect(firstDueDate({ kind: 'monthly', day: 1 }, TODAY)).toBe('2026-06-01');
  });
  it('weekly: hoje se bate o dia (inclusivo)', () => {
    expect(firstDueDate({ kind: 'weekly', weekdays: [3, 0] }, TODAY)).toBe('2026-05-20');
  });
  it('yearly: este ano se ainda não passou', () => {
    expect(firstDueDate({ kind: 'yearly', month: 12, day: 25 }, TODAY)).toBe('2026-12-25');
    expect(firstDueDate({ kind: 'yearly', month: 1, day: 10 }, TODAY)).toBe('2027-01-10');
  });
  it('after_completion começa hoje', () => {
    expect(firstDueDate({ kind: 'after_completion', intervalDays: 15 }, TODAY)).toBe(TODAY);
  });
  it('none/usage/event/stock não têm data', () => {
    expect(firstDueDate({ kind: 'none' }, TODAY)).toBeNull();
    expect(firstDueDate({ kind: 'usage', meterUnit: 'km', every: 5000 }, TODAY)).toBeNull();
    expect(firstDueDate({ kind: 'event', label: 'choveu' }, TODAY)).toBeNull();
    expect(firstDueDate({ kind: 'stock' }, TODAY)).toBeNull();
  });
  it('startDate futuro ancora a primeira data nele (não retroage)', () => {
    // dia 1 já passou em 05-20; sem startDate cairia em 06-01. Com "a partir de"
    // 07-10, a próxima dia-1 é 08-01.
    expect(firstDueDate({ kind: 'monthly', day: 1 }, TODAY, '2026-07-10')).toBe('2026-08-01');
    expect(firstDueDate({ kind: 'after_completion', intervalDays: 15 }, TODAY, '2026-07-10')).toBe('2026-07-10');
  });
  it('startDate no passado/hoje não muda a âncora (= hoje)', () => {
    expect(firstDueDate({ kind: 'monthly', day: 25 }, TODAY, '2026-05-01')).toBe('2026-05-25');
    expect(firstDueDate({ kind: 'monthly', day: 25 }, TODAY, TODAY)).toBe('2026-05-25');
  });
});

describe('isStarted ("a partir de")', () => {
  it('sem startDate sempre ativa', () => {
    expect(isStarted({}, TODAY)).toBe(true);
    expect(isStarted({ startDate: undefined }, TODAY)).toBe(true);
  });
  it('oculta antes do dia, ativa a partir dele (inclusive)', () => {
    expect(isStarted({ startDate: '2026-05-22' }, TODAY)).toBe(false);
    expect(isStarted({ startDate: TODAY }, TODAY)).toBe(true);
    expect(isStarted({ startDate: '2026-05-18' }, TODAY)).toBe(true);
  });
});

describe('isValidDate', () => {
  it('aceita datas reais e rejeita formato/calendário inválidos', () => {
    expect(isValidDate('2026-05-20')).toBe(true);
    expect(isValidDate('2026-02-30')).toBe(false);
    expect(isValidDate('2026-13-01')).toBe(false);
    expect(isValidDate('20260520')).toBe(false);
    expect(isValidDate('')).toBe(false);
  });
});

describe('nextDueDate', () => {
  it('monthly ancora no calendário (aluguel atrasado → próxima ainda dia 1)', () => {
    expect(nextDueDate({ kind: 'monthly', day: 1 }, '2026-05-01', '2026-05-20')).toBe('2026-06-01');
  });
  it('weekly: próximo dia da semana após a ocorrência', () => {
    // qua 05-20 → próximo de {qua,dom} é dom 05-24
    expect(nextDueDate({ kind: 'weekly', weekdays: [3, 0] }, '2026-05-20')).toBe('2026-05-24');
  });
  it('after_completion ancora na conclusão (+intervalo)', () => {
    expect(nextDueDate({ kind: 'after_completion', intervalDays: 15 }, '2026-05-01', '2026-05-20')).toBe('2026-06-04');
  });
  it('yearly avança um ano', () => {
    expect(nextDueDate({ kind: 'yearly', month: 4, day: 30 }, '2026-04-30')).toBe('2027-04-30');
  });
  it('none/usage/event/stock não geram próxima por data', () => {
    expect(nextDueDate({ kind: 'none' }, '2026-05-20')).toBeNull();
    expect(nextDueDate({ kind: 'event', label: 'x' }, '2026-05-20')).toBeNull();
  });
});

function occ(p: Partial<TodoOccurrence>): TodoOccurrence {
  return {
    id: 'o1',
    templateId: 't1',
    dueDate: null,
    status: 'pending',
    createdAt: '2026-05-01T00:00:00Z',
    ...p,
  };
}

describe('isOverdue / daysLate', () => {
  it('pendente com data passada é atrasada', () => {
    expect(isOverdue(occ({ dueDate: '2026-05-18' }), TODAY)).toBe(true);
    expect(daysLate(occ({ dueDate: '2026-05-18' }), TODAY)).toBe(2);
  });
  it('vence hoje não é atrasada', () => {
    expect(isOverdue(occ({ dueDate: TODAY }), TODAY)).toBe(false);
    expect(daysLate(occ({ dueDate: TODAY }), TODAY)).toBe(0);
  });
  it('concluída ou sem data não é atrasada', () => {
    expect(isOverdue(occ({ dueDate: '2026-05-18', status: 'done' }), TODAY)).toBe(false);
    expect(isOverdue(occ({ dueDate: null }), TODAY)).toBe(false);
  });
});

describe('janela de horário', () => {
  it('localTimeStr formata HH:MM zero-padded', () => {
    expect(localTimeStr(new Date('2026-05-20T09:05:00'))).toBe('09:05');
    expect(localTimeStr(new Date('2026-05-20T23:59:00'))).toBe('23:59');
  });
  it('isValidTime aceita 00:00–23:59 e rejeita o resto', () => {
    expect(isValidTime('18:00')).toBe(true);
    expect(isValidTime('00:00')).toBe(true);
    expect(isValidTime('23:59')).toBe(true);
    expect(isValidTime('24:00')).toBe(false);
    expect(isValidTime('18:60')).toBe(false);
    expect(isValidTime('8:00')).toBe(false);
    expect(isValidTime('')).toBe(false);
  });

  describe('isVisibleNow (startTime)', () => {
    const t = { startTime: '18:00' };
    it('esconde a do dia antes do horário', () => {
      expect(isVisibleNow(t, { dueDate: TODAY }, TODAY, '17:00')).toBe(false);
    });
    it('mostra a do dia a partir do horário', () => {
      expect(isVisibleNow(t, { dueDate: TODAY }, TODAY, '18:00')).toBe(true);
      expect(isVisibleNow(t, { dueDate: TODAY }, TODAY, '19:30')).toBe(true);
    });
    it('dia passado ou futuro: sempre visível', () => {
      expect(isVisibleNow(t, { dueDate: '2026-05-18' }, TODAY, '10:00')).toBe(true);
      expect(isVisibleNow(t, { dueDate: '2026-05-22' }, TODAY, '10:00')).toBe(true);
    });
    it('sem startTime ou sem data: sempre visível', () => {
      expect(isVisibleNow({}, { dueDate: TODAY }, TODAY, '01:00')).toBe(true);
      expect(isVisibleNow(t, { dueDate: null }, TODAY, '01:00')).toBe(true);
    });
  });

  describe('isPastEnd (endTime)', () => {
    const t = { endTime: '20:00' };
    it('passou da hora final hoje', () => {
      expect(isPastEnd(t, occ({ dueDate: TODAY }), TODAY, '21:00')).toBe(true);
    });
    it('antes da hora final hoje: false', () => {
      expect(isPastEnd(t, occ({ dueDate: TODAY }), TODAY, '19:00')).toBe(false);
    });
    it('dia anterior: passou (independe da hora)', () => {
      expect(isPastEnd(t, occ({ dueDate: '2026-05-18' }), TODAY, '00:01')).toBe(true);
    });
    it('sem endTime, não-pendente ou sem data: false', () => {
      expect(isPastEnd({}, occ({ dueDate: TODAY }), TODAY, '23:59')).toBe(false);
      expect(isPastEnd(t, occ({ dueDate: TODAY, status: 'done' }), TODAY, '23:59')).toBe(false);
      expect(isPastEnd(t, occ({ dueDate: null }), TODAY, '23:59')).toBe(false);
    });
  });
});

describe('dueUsage', () => {
  const base: Pick<TodoTemplate, 'recurrence' | 'meter' | 'meterAtLastDone'> = {
    recurrence: { kind: 'usage', meterUnit: 'km', every: 5000 },
    meter: 0,
    meterAtLastDone: 0,
  };
  it('atinge o limite por uso', () => {
    expect(dueUsage({ ...base, meter: 6000 })).toBe(true);
    expect(dueUsage({ ...base, meter: 3000 })).toBe(false);
  });
  it('false para recorrência não-usage', () => {
    expect(dueUsage({ ...base, recurrence: { kind: 'none' } })).toBe(false);
  });
});

describe('reconcileTemplate', () => {
  const tmpl = (
    p: Partial<TodoTemplate>,
  ): Pick<TodoTemplate, 'id' | 'active' | 'recurrence' | 'overdue' | 'endTime'> => ({
    id: 't1',
    active: true,
    recurrence: { kind: 'monthly', day: 1 },
    overdue: 'carry',
    ...p,
  });

  it('carry: vencida permanece, sem duplicar', () => {
    const actions = reconcileTemplate(
      tmpl({ recurrence: { kind: 'monthly', day: 1 }, overdue: 'carry' }),
      [occ({ dueDate: '2026-05-01' })],
      TODAY,
    );
    expect(actions).toEqual([]);
  });

  it('expire: expira a vencida e cria a próxima a partir de hoje', () => {
    const actions = reconcileTemplate(
      tmpl({ recurrence: { kind: 'weekly', weekdays: [3] }, overdue: 'expire' }),
      [occ({ id: 'old', dueDate: '2026-05-13' })], // quarta anterior
      TODAY,
    );
    expect(actions).toContainEqual({ type: 'expire', occId: 'old' });
    expect(actions).toContainEqual({ type: 'create', templateId: 't1', dueDate: '2026-05-20' });
  });

  it('com ocorrência futura pendente não cria nova', () => {
    const actions = reconcileTemplate(
      tmpl({ recurrence: { kind: 'monthly', day: 25 }, overdue: 'carry' }),
      [occ({ dueDate: '2026-05-25' })],
      TODAY,
    );
    expect(actions).toEqual([]);
  });

  it('template inativo: nenhuma ação', () => {
    const actions = reconcileTemplate(
      tmpl({ active: false }),
      [occ({ dueDate: '2026-05-01' })],
      TODAY,
    );
    expect(actions).toEqual([]);
  });

  it('after_completion não gera na reconciliação (geração no resolve)', () => {
    const actions = reconcileTemplate(
      tmpl({ recurrence: { kind: 'after_completion', intervalDays: 15 }, overdue: 'carry' }),
      [occ({ dueDate: '2026-05-10' })],
      TODAY,
    );
    expect(actions).toEqual([]);
  });

  it('endTime: cancela a do dia após o horário e suprime o create de calendário', () => {
    const actions = reconcileTemplate(
      tmpl({ recurrence: { kind: 'weekly', weekdays: [3] }, overdue: 'carry', endTime: '20:00' }),
      [occ({ id: 'hoje', dueDate: TODAY })],
      TODAY,
      '21:00',
    );
    expect(actions).toEqual([{ type: 'cancel', occId: 'hoje', templateId: 't1', dueDate: TODAY }]);
  });

  it('endTime: antes do horário não cancela', () => {
    const actions = reconcileTemplate(
      tmpl({ recurrence: { kind: 'weekly', weekdays: [3] }, overdue: 'carry', endTime: '20:00' }),
      [occ({ id: 'hoje', dueDate: TODAY })],
      TODAY,
      '10:00',
    );
    expect(actions).toEqual([]);
  });

  it('endTime sobrepõe carry: vencida com endTime é cancelada (não permanece)', () => {
    const actions = reconcileTemplate(
      tmpl({ recurrence: { kind: 'monthly', day: 1 }, overdue: 'carry', endTime: '20:00' }),
      [occ({ id: 'old', dueDate: '2026-05-01' })],
      TODAY,
      '08:00',
    );
    expect(actions).toEqual([{ type: 'cancel', occId: 'old', templateId: 't1', dueDate: '2026-05-01' }]);
  });

  it('endTime precede expire: cancela em vez de expirar', () => {
    const actions = reconcileTemplate(
      tmpl({ recurrence: { kind: 'weekly', weekdays: [3] }, overdue: 'expire', endTime: '20:00' }),
      [occ({ id: 'old', dueDate: '2026-05-13' })],
      TODAY,
      '08:00',
    );
    expect(actions).toContainEqual({ type: 'cancel', occId: 'old', templateId: 't1', dueDate: '2026-05-13' });
    expect(actions.some((a) => a.type === 'expire')).toBe(false);
    expect(actions.some((a) => a.type === 'create')).toBe(false);
  });
});
