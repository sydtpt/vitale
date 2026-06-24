import { describe, it, expect } from '@jest/globals';
import {
  buildWeekHighlights,
  type ActivityRecap,
  type MetricRecap,
  type RecapValue,
} from '@vitale/shared';

function recapValue(current: number, prior: number): RecapValue {
  const delta = current - prior;
  return { current, prior, delta, deltaPct: prior !== 0 ? (delta / prior) * 100 : null };
}

function activityRecap(curCount: number, priorCount: number, curM = 0, priorM = 0): ActivityRecap {
  return {
    count: recapValue(curCount, priorCount),
    distanceM: recapValue(curM, priorM),
    durationS: recapValue(0, 0),
    calories: recapValue(0, 0),
  };
}

function metricRecap(current: number | null, prior: number | null): MetricRecap {
  if (current == null || prior == null) {
    return { current, prior, delta: null, deltaPct: null, n: current == null ? 0 : 1 };
  }
  const delta = current - prior;
  return { current, prior, delta, deltaPct: prior !== 0 ? (delta / prior) * 100 : null, n: 1 };
}

describe('buildWeekHighlights', () => {
  it('inclui treinos e distância quando há atividade na semana', () => {
    const hs = buildWeekHighlights({ activities: activityRecap(3, 2, 12000, 8000) });
    const workouts = hs.find((h) => h.id === 'workouts');
    expect(workouts).toBeDefined();
    expect(workouts!.tone).toBe('good'); // +1 treino, mais é bom
    expect(workouts!.text).toContain('3 treinos');
    expect(hs.find((h) => h.id === 'distance')).toBeDefined();
  });

  it('omite treinos quando não houve atividade', () => {
    const hs = buildWeekHighlights({ activities: activityRecap(0, 0) });
    expect(hs.find((h) => h.id === 'workouts')).toBeUndefined();
  });

  it('marca FC repouso subindo como ruim e sono subindo como bom', () => {
    const hs = buildWeekHighlights({
      health: [
        { metric: 'fcRepouso', label: 'FC repouso', recap: metricRecap(60, 54), higherIsWorse: true, icon: 'heart', unit: ' bpm' },
        { metric: 'sono', label: 'Sono', recap: metricRecap(7.5, 7.0), higherIsWorse: false, icon: 'sleep', decimals: 1, unit: 'h' },
      ],
    });
    expect(hs.find((h) => h.id === 'health-fcRepouso')!.tone).toBe('bad');
    expect(hs.find((h) => h.id === 'health-sono')!.tone).toBe('good');
  });

  it('omite métrica sem dado na semana atual', () => {
    const hs = buildWeekHighlights({
      health: [{ metric: 'vfc', label: 'VFC', recap: metricRecap(null, 50), higherIsWorse: false, icon: 'hrv' }],
    });
    expect(hs.find((h) => h.id === 'health-vfc')).toBeUndefined();
  });

  it('hábito ruim subindo é bad; estável é omitido', () => {
    const hs = buildWeekHighlights({
      badHabits: [
        { name: 'Cigarro', recap: recapValue(5, 2) },
        { name: 'Doce', recap: recapValue(2, 2) }, // estável → omitido
      ],
    });
    expect(hs.find((h) => h.id === 'bad-Cigarro')!.tone).toBe('bad');
    expect(hs.find((h) => h.id === 'bad-Doce')).toBeUndefined();
  });

  it('gasto subindo é ruim e ordena por magnitude do delta', () => {
    const hs = buildWeekHighlights({
      activities: activityRecap(3, 3),                 // 0% → priority baixa
      spend: recapValue(500, 250),                     // +100% → priority alta
    });
    expect(hs[0].id).toBe('spend');
    expect(hs[0].tone).toBe('bad');
  });

  it('retorna vazio sem nenhuma entrada', () => {
    expect(buildWeekHighlights({})).toEqual([]);
  });
});
