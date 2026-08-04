import { describe, it, expect } from '@jest/globals';
import {
  DEFAULT_REFERENCE_LINE_SCHEME,
  REFERENCE_LINE_SCHEMES,
  referenceLineColors,
  resolveReferenceLineScheme,
} from '@vitale/shared';

// Cores que as barras já usam (tokens de chart-palettes / tipos de atividade).
// Uma linha de referência nessas cores se confundiria com um tipo de treino.
const BAR_COLORS = [
  '#F25C2B', '#6E8CC9', '#6FA86A', '#F5B946',
  '#E26A8A', '#B4825B', '#D9491B', '#1F1B16',
];

describe('resolveReferenceLineScheme', () => {
  it('aceita os ids conhecidos', () => {
    for (const s of REFERENCE_LINE_SCHEMES) {
      expect(resolveReferenceLineScheme(s.id)).toBe(s.id);
    }
  });

  it('cai no padrão para valor ausente, vazio ou desconhecido', () => {
    expect(resolveReferenceLineScheme(undefined)).toBe(DEFAULT_REFERENCE_LINE_SCHEME);
    expect(resolveReferenceLineScheme(null)).toBe(DEFAULT_REFERENCE_LINE_SCHEME);
    expect(resolveReferenceLineScheme('')).toBe(DEFAULT_REFERENCE_LINE_SCHEME);
    expect(resolveReferenceLineScheme('arco-iris')).toBe(DEFAULT_REFERENCE_LINE_SCHEME);
    expect(resolveReferenceLineScheme(42)).toBe(DEFAULT_REFERENCE_LINE_SCHEME);
  });
});

describe('referenceLineColors', () => {
  it('devolve as duas cores do esquema', () => {
    const c = referenceLineColors('petroleo-vinho');
    expect(c.average).toBe('#8E3A5D');
    expect(c.series).toBe('#1F6F78');
  });

  it('cai no padrão para valor inválido', () => {
    expect(referenceLineColors('nao-existe')).toEqual(referenceLineColors(DEFAULT_REFERENCE_LINE_SCHEME));
  });
});

describe('REFERENCE_LINE_SCHEMES', () => {
  it('o padrão está na lista', () => {
    expect(REFERENCE_LINE_SCHEMES.some((s) => s.id === DEFAULT_REFERENCE_LINE_SCHEME)).toBe(true);
  });

  it('nenhuma cor colide com as cores das barras', () => {
    // Esta é a razão de existir do módulo: linha na cor de um tipo de atividade
    // seria lida como se fosse aquele tipo.
    for (const s of REFERENCE_LINE_SCHEMES) {
      expect(BAR_COLORS).not.toContain(s.average.toUpperCase());
      expect(BAR_COLORS).not.toContain(s.series.toUpperCase());
    }
  });

  it('as duas cores de cada esquema são distintas', () => {
    for (const s of REFERENCE_LINE_SCHEMES) {
      expect(s.average).not.toBe(s.series);
    }
  });

  it('todos os ids são únicos e têm rótulo e dica', () => {
    const ids = REFERENCE_LINE_SCHEMES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of REFERENCE_LINE_SCHEMES) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.hint.length).toBeGreaterThan(0);
    }
  });
});
