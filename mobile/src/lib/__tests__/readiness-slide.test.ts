import { describe, it, expect } from '@jest/globals';
import {
  READINESS_STALE_DAYS,
  computeReadiness,
  type ReadinessComponent,
  type ReadinessKey,
  type ReadinessScore,
} from '@vitale/shared';
import {
  NO_SCORE_TITLE,
  READINESS_CAPTION,
  READINESS_SHORT_LABEL,
  ageNote,
  bandText,
  canShowReadiness,
  coverageNote,
  noScoreNote,
  scoreLabel,
  scoreText,
  shortLabel,
} from '../readiness-slide';

/** Entrada completa: os cinco sinais presentes e frescos. */
const FULL = {
  sleepHours: 7.2,
  restingHr: 54,
  restingHrBaseline: 56,
  hrv: 66,
  hrvBaseline: 60,
  ringsPct: [0.9, 1, 0.7],
  acwr: 1.05,
};

function score(partial: Partial<ReadinessScore> = {}): ReadinessScore {
  return { total: 72, band: 'high', components: [], coverage: 1, missing: [], stale: [], ...partial };
}

function comp(key: ReadinessKey, over: Partial<ReadinessComponent> = {}): ReadinessComponent {
  return {
    key,
    label: key,
    score: 70,
    weight: 0.2,
    ageDays: 0,
    stale: false,
    baseline: null,
    baselineShort: null,
    ...over,
  };
}

describe('rótulos curtos', () => {
  it('cobre todo componente que o núcleo emite', () => {
    const real = computeReadiness(FULL);
    expect(real.components.length).toBe(5);
    for (const c of real.components) {
      expect(READINESS_SHORT_LABEL[c.key]).toBeDefined();
    }
  });

  it('é sempre mais curto ou igual ao rótulo do núcleo', () => {
    // A razão de existir do mapa: os dois rótulos longos do núcleo quebram na
    // coluna de 92 pt e esticam o slide para fora do trilho de altura fixa.
    for (const c of computeReadiness(FULL).components) {
      expect(shortLabel(c).length).toBeLessThanOrEqual(c.label.length);
    }
  });

  it('cabe em uma linha da coluna de rótulo', () => {
    // 12 caracteres a 12,5 px de Manrope ficam sob os 92 pt com folga; o limite
    // é grosseiro de propósito — o que ele impede é um rótulo novo entrar longo.
    for (const label of Object.values(READINESS_SHORT_LABEL)) {
      expect(label.length).toBeLessThanOrEqual(12);
    }
  });

  it('cai no rótulo do núcleo diante de uma chave desconhecida', () => {
    const alien = comp('temperatura' as ReadinessKey, { label: 'Temperatura da pele' });
    expect(shortLabel(alien)).toBe('Temperatura da pele');
  });
});

describe('canShowReadiness', () => {
  it('esconde o slide sem nenhum sinal medido', () => {
    expect(canShowReadiness(computeReadiness({}))).toBe(false);
    expect(canShowReadiness(score())).toBe(false);
  });

  it('mostra com um único sinal, mesmo sem nota', () => {
    // É o caso que motivou o piso de cobertura: um sinal só não dá nota, e o
    // slide precisa existir justamente para explicar por quê.
    expect(canShowReadiness(score({ total: null, components: [comp('sono')] }))).toBe(true);
  });
});

describe('coverageNote', () => {
  it('lista os sinais quando todos chegaram frescos', () => {
    const full = computeReadiness(FULL);
    expect(full.missing).toEqual([]);
    expect(coverageNote(full)).toBe(READINESS_CAPTION);
  });

  it('conta os sinais quando algum falta', () => {
    // O caso real: a VFC parou de chegar em 17/07/2026 e o cartão continuou
    // exibindo a mesma legenda de sempre, com 75% da informação. Ver ADR 0026.
    const semVfc = computeReadiness({ ...FULL, hrv: null, hrvBaseline: null });
    expect(semVfc.missing).toContain('vfc');
    expect(coverageNote(semVfc)).toBe('4 de 5 sinais');
  });

  it('conta o sinal VELHO como ausente — é o que ele é para a nota', () => {
    const velho = computeReadiness({ ...FULL, ageDays: { aneis: 18, sono: 4 } });
    expect(velho.stale.sort()).toEqual(['aneis', 'sono']);
    expect(coverageNote(velho)).toBe('3 de 5 sinais');
  });

  it('não conta nada sem componente nenhum', () => {
    // Score vazio nunca chega ao slide (`canShowReadiness` barra), mas a legenda
    // não pode devolver "0 de 0" se alguém a chamar antes da guarda.
    expect(coverageNote(score())).toBe(READINESS_CAPTION);
  });
});

describe('a nota e a faixa', () => {
  it('mostra o número e a palavra quando há nota', () => {
    const r = computeReadiness(FULL);
    expect(scoreText(r)).toBe(String(r.total));
    expect(['baixa', 'moderada', 'alta']).toContain(bandText(r));
    expect(scoreLabel(r)).toContain('de 100');
  });

  it('vira travessão sem nota, e a leitura acessível explica em vez de soletrar', () => {
    const sem = score({ total: null, band: null, components: [comp('vfc')], missing: ['sono'] });
    expect(scoreText(sem)).toBe('—');
    expect(bandText(sem)).toBe('');
    expect(scoreLabel(sem)).toContain('indisponível');
    expect(scoreLabel(sem)).not.toContain('—');
  });
});

describe('ageNote', () => {
  it('cala sobre o que é de hoje ou de data desconhecida', () => {
    expect(ageNote(comp('sono', { ageDays: 0 }))).toBe('');
    expect(ageNote(comp('sono', { ageDays: null }))).toBe('');
  });

  it('nomeia ontem e conta os dias depois disso', () => {
    expect(ageNote(comp('sono', { ageDays: 1 }))).toBe('ontem');
    expect(ageNote(comp('aneis', { ageDays: 18 }))).toBe('18 d');
  });
});

describe('noScoreNote', () => {
  it('cala quando há nota — quem fala ali é o conselho', () => {
    expect(noScoreNote(computeReadiness(FULL))).toBe('');
  });

  it('distingue "nada chegou" de "chegou velho"', () => {
    expect(noScoreNote(score({ total: null, components: [] }))).toContain('Nenhum sinal');

    const velho = computeReadiness({
      sleepHours: 8.3,
      restingHr: 46,
      restingHrBaseline: 50,
      hrv: 34,
      hrvBaseline: 40,
      ringsPct: [1, 1, 1],
      ageDays: { sono: 4, fcRepouso: 4, vfc: 0, aneis: 18 },
    });
    expect(velho.total).toBeNull();
    expect(noScoreNote(velho)).toContain(`${READINESS_STALE_DAYS} dias`);
    expect(noScoreNote(velho)).toContain('3 sinais');
  });

  it('distingue "poucos sinais" de "sinais velhos"', () => {
    // Tudo fresco, mas só o sono chegou: 0,24 de 1,00 não dá nota, e a razão
    // não é idade nenhuma.
    const magro = computeReadiness({ sleepHours: 7 });
    expect(magro.total).toBeNull();
    expect(magro.stale).toEqual([]);
    expect(noScoreNote(magro)).toContain('Poucos sinais');
  });

  it('o título do rodapé sem nota é curto o bastante para uma linha', () => {
    expect(NO_SCORE_TITLE.length).toBeLessThanOrEqual(20);
  });
});
