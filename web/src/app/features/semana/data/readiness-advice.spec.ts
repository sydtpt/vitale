import type { Treino } from '@vitale/shared';
import { classifyWorkout, readinessAdvice } from '@vitale/shared';

function treino(partial: Partial<Treino>): Treino {
  return {
    day: 'QUI', date: 21, type: 'X', dur: 0, vol: 0,
    done: false, rest: false, planned: true, run: null,
    ...partial,
  };
}

describe('classifyWorkout', () => {
  it('descanso tem prioridade', () => {
    expect(classifyWorkout(treino({ rest: true, vol: 100 }))).toBe('rest');
  });
  it('corrida/bike = endurance', () => {
    expect(classifyWorkout(treino({ run: { dist: 10, pace: '—' } }))).toBe('endurance');
  });
  it('volume de carga = força', () => {
    expect(classifyWorkout(treino({ vol: 4200 }))).toBe('strength');
  });
  it('duração sem volume/run = leve', () => {
    expect(classifyWorkout(treino({ dur: 45 }))).toBe('easy');
  });
  it('sem treino = none', () => {
    expect(classifyWorkout(undefined)).toBe('none');
    expect(classifyWorkout(treino({ dur: 0, vol: 0 }))).toBe('none');
  });
});

describe('readinessAdvice — sem dados', () => {
  it('não inventa conselho quando falta prontidão', () => {
    const a = readinessAdvice(0, false, 'strength', 'Pernas');
    expect(a.tone).toBe('neutral');
    expect(a.text).toContain('Sincronize');
  });
});

describe('readinessAdvice — prontidão baixa (<50)', () => {
  it('dia forte → cautela, sugere aliviar e cita o treino', () => {
    const a = readinessAdvice(40, true, 'strength', 'Pernas — Volume');
    expect(a.tone).toBe('caution');
    expect(a.text).toContain('Pernas — Volume');
  });
  it('descanso → confirma recuperação', () => {
    const a = readinessAdvice(40, true, 'rest', 'Descanso');
    expect(a.tone).toBe('rest');
    expect(a.text).toContain('descanso');
  });
  it('dia leve → priorizar sono, sem cautela', () => {
    const a = readinessAdvice(40, true, 'easy', 'Yoga');
    expect(a.tone).toBe('rest');
  });
});

describe('readinessAdvice — prontidão moderada (50–69)', () => {
  it('dia forte → neutro, monitorar', () => {
    const a = readinessAdvice(60, true, 'endurance', 'Corrida longa');
    expect(a.tone).toBe('neutral');
    expect(a.title).toBe('Prontidão moderada');
  });
});

describe('readinessAdvice — prontidão alta (>=70)', () => {
  it('dia forte → liberar com tudo', () => {
    const a = readinessAdvice(85, true, 'strength', 'Pernas');
    expect(a.tone).toBe('go');
    expect(a.text).toContain('Pernas');
  });
  it('descanso → sugere adiantar treino leve', () => {
    const a = readinessAdvice(85, true, 'rest', 'Descanso');
    expect(a.tone).toBe('go');
    expect(a.text).toContain('adiantar');
  });
});
