import { describe, it, expect } from '@jest/globals';
import {
  ACTIVITY_MET,
  HR_ZONE_WEIGHTS,
  DEFAULT_WEEKLY_TARGET_MIN,
  WHO_RANGE_MIN,
  WHO_RANGE_MAX,
  resolveWeeklyTargetMin,
  activityWeight,
  effectiveSeconds,
  metToWeight,
  weeklyTargetSeconds,
  type Activity,
} from '@vitale/shared';

const CORRIDA = 37;
const CICLISMO = 13;
const YOGA = 57;
const DESCONHECIDO = 999;

function act(activityId: number, durationS: number, hrZones?: Record<string, number>): Activity {
  return {
    id: `a-${activityId}-${durationS}`, userId: 'u', activityId,
    calories: 0, startAt: '2026-07-30T10:00:00Z', endAt: '2026-07-30T11:00:00Z',
    durationS, hasRoute: false, hrZones,
  };
}

describe('metToWeight', () => {
  it('classifica leve / moderado / vigoroso conforme a OMS', () => {
    expect(metToWeight(2.5)).toBe(0.25);   // leve, fora da diretriz aeróbica
    expect(metToWeight(3)).toBe(1);        // limiar do moderado
    expect(metToWeight(5.9)).toBe(1);
    expect(metToWeight(6)).toBe(1);        // limiar do vigoroso, rampa começa aqui
  });

  it('sobe em rampa no vigoroso e satura em 2x', () => {
    expect(metToWeight(8)).toBe(1.5);
    expect(metToWeight(14)).toBe(2);
    expect(metToWeight(30)).toBe(2);       // teto: 1 min nunca vale mais que 2
  });

  it('ordena corrida > ciclismo > yoga', () => {
    const corrida = activityWeight(CORRIDA);
    const ciclismo = activityWeight(CICLISMO);
    const yoga = activityWeight(YOGA);
    expect(corrida).toBeGreaterThan(ciclismo);
    expect(ciclismo).toBeGreaterThan(yoga);
    expect(corrida).toBeCloseTo(1.95, 5);
    expect(ciclismo).toBeCloseTo(1.2, 5);
    expect(yoga).toBe(0.75); // override: Ashtanga
  });

  it('override por tipo vence o MET da tabela', () => {
    // Yoga aqui é Ashtanga (0.75), não o Hatha de 2.5 MET que daria 0.25.
    expect(metToWeight(ACTIVITY_MET[YOGA])).toBe(0.25); // o que a tabela diria
    expect(activityWeight(YOGA)).toBe(0.75); // o que o override manda
    // Pilates não tem override e segue a tabela.
    expect(activityWeight(66)).toBe(0.25);
  });

  it('trata tipo fora da tabela como moderado', () => {
    expect(ACTIVITY_MET[DESCONHECIDO]).toBeUndefined();
    expect(activityWeight(DESCONHECIDO)).toBe(1);
  });
});

describe('effectiveSeconds', () => {
  it('sem FC, usa o peso do tipo', () => {
    // 60 min de yoga (0.75x) valem 45 min moderados; 60 min de corrida, ~117.
    expect(effectiveSeconds(act(YOGA, 3600))).toBe(3600 * 0.75);
    expect(effectiveSeconds(act(CORRIDA, 3600))).toBeCloseTo(3600 * 1.95, 5);
  });

  it('com FC cobrindo todo o treino, usa só as zonas', () => {
    // 30 min: 10 em z1 (0x), 10 em z3 (1x), 10 em z4 (2x) = 30 min equivalentes.
    const a = act(CICLISMO, 1800, { z1: 600, z3: 600, z4: 600 });
    expect(effectiveSeconds(a)).toBe(600 * 0 + 600 * 1 + 600 * 2);
  });

  it('a FC manda mesmo quando contraria o peso do tipo', () => {
    // Corrida inteira em z1 vale 0 — um trote de recuperação não é vigoroso.
    expect(effectiveSeconds(act(CORRIDA, 1800, { z1: 1800 }))).toBe(0);
    // Yoga inteira em z4 vale 2x, apesar do MET baixo da tabela.
    expect(effectiveSeconds(act(YOGA, 1800, { z4: 1800 }))).toBe(3600);
  });

  it('mistura zonas e tipo quando a FC cobre só parte do treino', () => {
    // 60 min de corrida com FC só nos primeiros 20 (em z3): 20*1 + 40*1.95.
    const a = act(CORRIDA, 3600, { z3: 1200 });
    expect(effectiveSeconds(a)).toBeCloseTo(1200 * 1 + 2400 * 1.95, 5);
  });

  it('não infla quando as zonas somam mais que a duração', () => {
    // Amostras sobrepostas (apps duplicados): escala proporcional, sem estourar.
    const a = act(CICLISMO, 1800, { z4: 2400, z5: 1200 });   // soma 3600 = 2x a duração
    // Escala 0.5 → 1200s em z4 e 600s em z5, ambos 2x = 3600s equivalentes.
    expect(effectiveSeconds(a)).toBe(3600);
    // Teto: nunca passa de 2x a duração real.
    expect(effectiveSeconds(a)).toBeLessThanOrEqual(a.durationS * 2);
  });

  it('ignora zonas vazias, negativas e duração zero', () => {
    expect(effectiveSeconds(act(CORRIDA, 0))).toBe(0);
    expect(effectiveSeconds(act(YOGA, 3600, {}))).toBe(3600 * 0.75);
    expect(effectiveSeconds(act(YOGA, 3600, { z4: -100 }))).toBe(3600 * 0.75);
  });

  it('pesa as zonas conforme a equivalência da OMS', () => {
    expect(HR_ZONE_WEIGHTS['z1']).toBe(0);
    expect(HR_ZONE_WEIGHTS['z3']).toBe(1);
    expect(HR_ZONE_WEIGHTS['z5']).toBe(2);
  });
});

describe('weeklyTargetSeconds', () => {
  const D = new Date(2026, 6, 30); // julho/2026 (31 dias), ano comum

  it('usa 190 min/semana como padrão, dentro da faixa 150–300 da OMS', () => {
    expect(DEFAULT_WEEKLY_TARGET_MIN).toBe(190);
    expect(DEFAULT_WEEKLY_TARGET_MIN).toBeGreaterThanOrEqual(WHO_RANGE_MIN);
    expect(DEFAULT_WEEKLY_TARGET_MIN).toBeLessThanOrEqual(WHO_RANGE_MAX);
  });

  it('aceita uma meta configurada pelo usuário', () => {
    expect(weeklyTargetSeconds('week', D, 300)).toBe(300 * 60);
    expect(weeklyTargetSeconds('day', D, 300)).toBeCloseTo((300 * 60) / 7, 5);
  });

  it('semana = a meta cheia, sem prorrateio', () => {
    expect(weeklyTargetSeconds('week', D)).toBe(DEFAULT_WEEKLY_TARGET_MIN * 60);
  });

  it('dia = meta semanal / 7', () => {
    expect(weeklyTargetSeconds('day', D)).toBeCloseTo((DEFAULT_WEEKLY_TARGET_MIN * 60) / 7, 5);
  });

  it('mês acompanha os dias do mês', () => {
    const jul = weeklyTargetSeconds('month', new Date(2026, 6, 1));  // 31 dias
    const jun = weeklyTargetSeconds('month', new Date(2026, 5, 1));  // 30 dias
    const fev = weeklyTargetSeconds('month', new Date(2026, 1, 1));  // 28 dias
    expect(jul).toBeCloseTo((DEFAULT_WEEKLY_TARGET_MIN * 60 / 7) * 31, 5);
    expect(jun).toBeCloseTo((DEFAULT_WEEKLY_TARGET_MIN * 60 / 7) * 30, 5);
    expect(fev).toBeCloseTo((DEFAULT_WEEKLY_TARGET_MIN * 60 / 7) * 28, 5);
    expect(jul).toBeGreaterThan(jun);
    expect(jun).toBeGreaterThan(fev);
  });

  it('ano bissexto vale um dia a mais', () => {
    const comum = weeklyTargetSeconds('year', new Date(2026, 0, 1));   // 365
    const bissexto = weeklyTargetSeconds('year', new Date(2028, 0, 1)); // 366
    expect(comum).toBeCloseTo((DEFAULT_WEEKLY_TARGET_MIN * 60 / 7) * 365, 5);
    expect(bissexto).toBeCloseTo((DEFAULT_WEEKLY_TARGET_MIN * 60 / 7) * 366, 5);
  });

  it('trata 2000 como bissexto e 1900 como comum (regra dos séculos)', () => {
    expect(weeklyTargetSeconds('year', new Date(2000, 0, 1))).toBeCloseTo((DEFAULT_WEEKLY_TARGET_MIN * 60 / 7) * 366, 5);
    expect(weeklyTargetSeconds('year', new Date(1900, 0, 1))).toBeCloseTo((DEFAULT_WEEKLY_TARGET_MIN * 60 / 7) * 365, 5);
  });
});

describe('resolveWeeklyTargetMin', () => {
  it('devolve o valor configurado quando é válido', () => {
    expect(resolveWeeklyTargetMin(300)).toBe(300);
    expect(resolveWeeklyTargetMin(30)).toBe(30);
    expect(resolveWeeklyTargetMin(1500)).toBe(1500);
  });

  it('cai no padrão quando ausente, inválido ou fora dos limites', () => {
    expect(resolveWeeklyTargetMin(undefined)).toBe(DEFAULT_WEEKLY_TARGET_MIN);
    expect(resolveWeeklyTargetMin(null)).toBe(DEFAULT_WEEKLY_TARGET_MIN);
    expect(resolveWeeklyTargetMin(NaN)).toBe(DEFAULT_WEEKLY_TARGET_MIN);
    expect(resolveWeeklyTargetMin(0)).toBe(DEFAULT_WEEKLY_TARGET_MIN);
    expect(resolveWeeklyTargetMin(-50)).toBe(DEFAULT_WEEKLY_TARGET_MIN);
    expect(resolveWeeklyTargetMin(99999)).toBe(DEFAULT_WEEKLY_TARGET_MIN);
  });

  it('arredonda valor fracionário', () => {
    expect(resolveWeeklyTargetMin(190.6)).toBe(191);
  });
});
