import { describe, it, expect } from '@jest/globals';
import { computeReadiness, type ReadinessComponent, type ReadinessScore } from '@vitale/shared';
import {
  READINESS_CAPTION,
  READINESS_SHORT_LABEL,
  canShowReadiness,
  coverageNote,
  shortLabel,
} from '../readiness-slide';

/** Entrada completa: os quatro sinais presentes. */
const FULL = { sleepHours: 7.2, restingHr: 54, restingHrBaseline: 56, hrv: 66, hrvBaseline: 60, ringsPct: [0.9, 1, 0.7] };

function score(partial: Partial<ReadinessScore> = {}): ReadinessScore {
  return { total: 72, components: [], coverage: 1, missing: [], ...partial };
}

function comp(key: ReadinessComponent['key'], label = key): ReadinessComponent {
  return { key, label, score: 70, weight: 0.25 };
}

describe('rótulos curtos', () => {
  it('cobre todo componente que o núcleo emite', () => {
    const real = computeReadiness(FULL);
    expect(real.components.length).toBe(4);
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
    const alien = { key: 'temperatura', label: 'Temperatura da pele', score: 50, weight: 0.1 };
    expect(shortLabel(alien as unknown as ReadinessComponent)).toBe('Temperatura da pele');
  });
});

describe('canShowReadiness', () => {
  it('esconde o slide sem nenhum sinal medido', () => {
    expect(canShowReadiness(computeReadiness({}))).toBe(false);
    expect(canShowReadiness(score())).toBe(false);
  });

  it('mostra com um único sinal', () => {
    expect(canShowReadiness(score({ components: [comp('sono')] }))).toBe(true);
  });
});

describe('coverageNote', () => {
  it('lista os sinais quando todos chegaram', () => {
    const full = computeReadiness(FULL);
    expect(full.missing).toEqual([]);
    expect(coverageNote(full)).toBe(READINESS_CAPTION);
  });

  it('conta os sinais quando algum falta', () => {
    // O caso real: a VFC parou de chegar em 17/07/2026 e o cartão continuou
    // exibindo a mesma legenda de sempre, com 75% da informação. Ver ADR 0026.
    const semVfc = computeReadiness({ ...FULL, hrv: null, hrvBaseline: null });
    expect(semVfc.missing).toContain('vfc');
    expect(coverageNote(semVfc)).toBe('3 de 4 sinais');
  });

  it('conta com dois sinais faltando', () => {
    const magro = computeReadiness({ sleepHours: 7, ringsPct: [0.8] });
    expect(coverageNote(magro)).toBe('2 de 4 sinais');
  });

  it('não conta nada sem componente nenhum', () => {
    // Score vazio nunca chega ao slide (`canShowReadiness` barra), mas a legenda
    // não pode devolver "0 de 0" se alguém a chamar antes da guarda.
    expect(coverageNote(score())).toBe(READINESS_CAPTION);
  });
});
