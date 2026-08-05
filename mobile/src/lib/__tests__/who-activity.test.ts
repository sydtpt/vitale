import { describe, it, expect } from '@jest/globals';
import {
  ACTIVITY_MET,
  HR_ZONE_WEIGHTS,
  MAX_WEIGHT,
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
    expect(metToWeight(2.5)).toBe(0.125);  // leve, fora da diretriz aeróbica
    expect(metToWeight(3)).toBe(0.5);      // limiar do moderado
    expect(metToWeight(5.9)).toBe(0.5);
    expect(metToWeight(6)).toBe(0.5);      // limiar do vigoroso, rampa começa aqui
  });

  it('sobe em rampa no vigoroso e satura no teto', () => {
    expect(metToWeight(8)).toBe(0.75);
    expect(metToWeight(10)).toBe(1);       // teto atingido aqui
    expect(metToWeight(14)).toBe(1);
    expect(metToWeight(30)).toBe(1);       // 1 min nunca vale mais que 1 min
  });

  it('ordena corrida > ciclismo > yoga', () => {
    const corrida = activityWeight(CORRIDA);
    const ciclismo = activityWeight(CICLISMO);
    const yoga = activityWeight(YOGA);
    expect(corrida).toBeGreaterThan(ciclismo);
    expect(ciclismo).toBeGreaterThan(yoga);
    expect(corrida).toBeCloseTo(0.975, 5);
    expect(ciclismo).toBeCloseTo(0.6, 5);
    expect(yoga).toBe(0.375); // override: Ashtanga
  });

  it('override por tipo vence o MET da tabela', () => {
    // Yoga aqui é Ashtanga (0.375), não o Hatha de 2.5 MET que daria 0.125.
    expect(metToWeight(ACTIVITY_MET[YOGA])).toBe(0.125); // o que a tabela diria
    expect(activityWeight(YOGA)).toBe(0.375); // o que o override manda
    // Pilates não tem override e segue a tabela.
    expect(activityWeight(66)).toBe(0.125);
  });

  it('trata tipo fora da tabela como moderado', () => {
    expect(ACTIVITY_MET[DESCONHECIDO]).toBeUndefined();
    expect(activityWeight(DESCONHECIDO)).toBe(0.5);
  });

  it('nenhum peso passa do teto', () => {
    // A escala é ancorada no vigoroso: 1 min forte = 1 min de esforço. Um peso acima
    // de MAX_WEIGHT quebraria a invariante de `effectiveSeconds` (ver o teste de matriz
    // adiante) e a linha do gráfico voltaria a subir acima da barra.
    for (const id of [...Object.keys(ACTIVITY_MET).map(Number), DESCONHECIDO]) {
      expect(activityWeight(id)).toBeLessThanOrEqual(MAX_WEIGHT);
    }
    for (const peso of Object.values(HR_ZONE_WEIGHTS)) {
      expect(peso).toBeLessThanOrEqual(MAX_WEIGHT);
    }
  });
});

describe('effectiveSeconds', () => {
  it('sem FC, usa o peso do tipo', () => {
    // 60 min de yoga (0.375x) valem 22,5 min de esforço; 60 min de corrida, ~58,5.
    expect(effectiveSeconds(act(YOGA, 3600))).toBe(3600 * 0.375);
    expect(effectiveSeconds(act(CORRIDA, 3600))).toBeCloseTo(3600 * 0.975, 5);
  });

  it('com FC cobrindo todo o treino, as zonas mandam quando superam o piso', () => {
    // 30 min de ciclismo: 10 em z3 (0.5x) + 20 em z4 (1x) = 25 min de esforço,
    // acima do piso do tipo (30 × 0.6 = 18).
    const a = act(CICLISMO, 1800, { z3: 600, z4: 1200 });
    expect(effectiveSeconds(a)).toBe(600 * 0.5 + 1200 * 1);
  });

  it('a FC levanta o valor acima do peso do tipo', () => {
    // Yoga inteira em z4 conta cheia, apesar do MET baixo da tabela — e "cheia" agora
    // é exatamente a duração, o teto da escala.
    expect(effectiveSeconds(act(YOGA, 1800, { z4: 1800 }))).toBe(1800);
  });

  it('o piso protege o treino longo e fácil', () => {
    // Pedal de 1 h inteiro em z1: pelas zonas daria 0 (z1 não conta para a OMS),
    // mas pedalar 1 h é trabalho — o piso garante 1 h × 0.6.
    expect(effectiveSeconds(act(CICLISMO, 3600, { z1: 3600 }))).toBeCloseTo(3600 * 0.6, 5);
  });

  it('gravar FC nunca vale menos do que não gravar', () => {
    // A inversão que o piso existe para impedir: medir só pode acrescentar.
    const semFc = effectiveSeconds(act(CORRIDA, 1800));
    const casos: Record<string, number>[] = [
      { z1: 1800 }, { z1: 1500, z2: 300 }, { z2: 900 }, { z1: 600, z3: 200 },
    ];
    for (const zonas of casos) {
      expect(effectiveSeconds(act(CORRIDA, 1800, zonas))).toBeGreaterThanOrEqual(semFc);
    }
    expect(effectiveSeconds(act(CORRIDA, 1800, { z1: 1800 }))).toBeCloseTo(1800 * 0.975, 5);
  });

  it('mistura zonas e tipo quando a FC cobre só parte do treino', () => {
    // 60 min de ciclismo com FC só nos primeiros 20 (em z4): 20*1 + 40*0.6 = 44 min,
    // acima do piso de 60 × 0.6 = 36.
    const a = act(CICLISMO, 3600, { z4: 1200 });
    expect(effectiveSeconds(a)).toBeCloseTo(1200 * 1 + 2400 * 0.6, 5);
  });

  it('o piso conta tempo em movimento, não tempo parado', () => {
    // Pedal urbano de 2 h com 30 min parado, todo em z1: semáforo não é atividade.
    const a = { ...act(CICLISMO, 7200, { z1: 7200 }), movingTimeS: 5400 };
    expect(effectiveSeconds(a)).toBeCloseTo(5400 * 0.6, 5);
  });

  it('ignora tempo em movimento maior que a duração', () => {
    // Existem linhas assim no histórico (yoga com 15 724 s numa sessão de 3 600 s).
    const a = { ...act(YOGA, 3600), movingTimeS: 15724 };
    expect(effectiveSeconds(a)).toBe(3600 * 0.375);
  });

  it('não infla quando as zonas somam mais que a duração', () => {
    // Amostras sobrepostas (apps duplicados): escala proporcional, sem estourar.
    const a = act(CICLISMO, 1800, { z4: 2400, z5: 1200 });   // soma 3600 = 2x a duração
    // Escala 0.5 → 1200s em z4 e 600s em z5, ambos 1x = os 1800s da duração, no teto.
    expect(effectiveSeconds(a)).toBe(1800);
  });

  it('ignora zonas vazias, negativas e duração zero', () => {
    expect(effectiveSeconds(act(CORRIDA, 0))).toBe(0);
    expect(effectiveSeconds(act(YOGA, 3600, {}))).toBe(3600 * 0.375);
    expect(effectiveSeconds(act(YOGA, 3600, { z4: -100 }))).toBe(3600 * 0.375);
  });

  it('pesa as zonas conforme a equivalência da OMS', () => {
    expect(HR_ZONE_WEIGHTS['z1']).toBe(0);
    expect(HR_ZONE_WEIGHTS['z3']).toBe(0.5);
    expect(HR_ZONE_WEIGHTS['z5']).toBe(1);
  });

  it('nunca passa da duração — a invariante que segura a linha dentro da barra', () => {
    // O gráfico de Duração desenha a linha de esforço sobre as barras de tempo total.
    // Se algum peso passar de MAX_WEIGHT a linha volta a subir acima da barra, que é
    // exatamente o que esta escala existe para impedir. Guarda-corpo: a tabela inteira
    // contra as formas de `hrZones` e `movingTimeS` que aparecem no histórico real.
    const distribuicoes: (Record<string, number> | undefined)[] = [
      undefined,
      {},
      { z1: 3600 },                       // tudo leve
      { z5: 3600 },                       // tudo no máximo
      { z2: 1200, z3: 1200, z4: 1200 },   // mista
      { z4: 7200, z5: 3600 },             // soma 3x a duração (amostras sobrepostas)
      { z2: -100, z9: 900 },              // negativo e zona fora do mapa
    ];
    const tipos = [...Object.keys(ACTIVITY_MET).map(Number), DESCONHECIDO];
    for (const activityId of tipos) {
      for (const hrZones of distribuicoes) {
        for (const movingTimeS of [undefined, 1800, 99999]) {
          const a = { ...act(activityId, 3600, hrZones), movingTimeS };
          const eff = effectiveSeconds(a);
          expect(eff).toBeGreaterThanOrEqual(0);
          expect(eff).toBeLessThanOrEqual(a.durationS);
        }
      }
    }
  });
});

describe('weeklyTargetSeconds', () => {
  const D = new Date(2026, 6, 30); // julho/2026 (31 dias), ano comum

  it('usa 95 min/semana como padrão, dentro da faixa 75–150 da OMS', () => {
    expect(DEFAULT_WEEKLY_TARGET_MIN).toBe(95);
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
    expect(resolveWeeklyTargetMin(95.6)).toBe(96);
  });
});
