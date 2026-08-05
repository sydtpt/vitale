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
  it('devolve as duas cores do esquema no tema pedido', () => {
    expect(referenceLineColors('petroleo-vinho', 'light')).toEqual({
      series: '#0D4F58', average: '#7A1F52',
    });
    expect(referenceLineColors('petroleo-vinho', 'dark')).toEqual({
      series: '#7FDCE6', average: '#F0A8C8',
    });
  });

  it('sem tema, assume claro (a web não tem tema escuro)', () => {
    for (const s of REFERENCE_LINE_SCHEMES) {
      expect(referenceLineColors(s.id)).toEqual(referenceLineColors(s.id, 'light'));
    }
  });

  it('cada tema tem o seu passo — nunca o mesmo hex nos dois', () => {
    // O ponto da separação: um violeta escuro dá 10.6:1 sobre a superfície clara e
    // 1.6:1 sobre a escura. Reaproveitar o passo sumiria com a linha num dos temas.
    for (const s of REFERENCE_LINE_SCHEMES) {
      expect(referenceLineColors(s.id, 'dark').series)
        .not.toBe(referenceLineColors(s.id, 'light').series);
      expect(referenceLineColors(s.id, 'dark').average)
        .not.toBe(referenceLineColors(s.id, 'light').average);
    }
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
      for (const mode of ['light', 'dark'] as const) {
        expect(BAR_COLORS).not.toContain(s[mode].average.toUpperCase());
        expect(BAR_COLORS).not.toContain(s[mode].series.toUpperCase());
      }
    }
  });

  it('as duas cores de cada esquema são distintas, em cada tema', () => {
    for (const s of REFERENCE_LINE_SCHEMES) {
      for (const mode of ['light', 'dark'] as const) {
        expect(s[mode].average).not.toBe(s[mode].series);
      }
    }
  });

  it('a linha do progresso clareia no tema escuro e escurece no claro', () => {
    // A regra que faz a separação por tema valer: o passo escuro tem de ser mais claro
    // que o passo claro, senão ele não se destaca da superfície #1E1A15.
    const lum = (hex: string) => {
      const ch = (i: number) => {
        const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * ch(0) + 0.7152 * ch(1) + 0.0722 * ch(2);
    };
    for (const s of REFERENCE_LINE_SCHEMES) {
      expect(lum(s.dark.series)).toBeGreaterThan(lum(s.light.series));
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
