import { describe, it, expect } from '@jest/globals';
import {
  DEFAULT_BRAND_ID,
  FORM_BASE_DAYS,
  FORM_FATIGUE_DAYS,
  FORM_TYPICAL_DAYS,
  contrast,
  resolveTokens,
  type FormCurve,
  type FormCurveDay,
  type PaletteId,
  type ThemeId,
} from '@vitale/shared';
import {
  ALERT_TEXT,
  BAR_LABELS,
  baseBarColor,
  DETAIL_SPAN_DAYS,
  LEGEND_TEXT,
  PHRASES,
  SPARK_DAYS,
  barScale,
  canShow,
  detailSentence,
  formState,
  signedInt,
  sparkSegments,
  sparkValues,
  staleLabel,
  warmupLabel,
} from '../form-curve-view';

// Spec: _bmad-output/implementation-artifacts/spec-curva-de-forma-mobile.md

function day(i: number, form: number, base = 90, fatigue = 90 - form): FormCurveDay {
  return { day: `2026-06-${String(i + 1).padStart(2, '0')}`, dailyLoadMin: 30, base, fatigue, form };
}

function curve(partial: Partial<FormCurve> = {}): FormCurve {
  return {
    base: 93,
    fatigue: 57,
    form: 36,
    typical: { base: 96, fatigue: 101, form: -5 },
    series: [day(0, 36)],
    historyDays: 120,
    daysSinceLastActivity: 0,
    shortWindow: false,
    trusted: true,
    ...partial,
  };
}

describe('formState — a matriz de estados', () => {
  it('fresco: saldo positivo confiável', () => {
    const s = formState(curve({ form: 36.4 }));
    expect(s.tone).toBe('fresh');
    expect(s.valueText).toBe('+36');
    expect(s.phrase).toBe(PHRASES.fresh);
    expect(s.badge).toBeNull();
    expect(s.footer).toEqual({ kind: 'axis', left: `${SPARK_DAYS} dias`, right: 'hoje' });
  });

  it('enterrado: saldo negativo confiável', () => {
    const s = formState(curve({ form: -48 }));
    expect(s.tone).toBe('buried');
    expect(s.valueText).toBe('-48');
    expect(s.phrase).toBe('Hoje é dia de perna leve.');
  });

  it('sem confiança: 12 dias sem sincronizar viram selo e alerta, mesmo com saldo positivo', () => {
    const s = formState(curve({ form: 36, trusted: false, daysSinceLastActivity: 12 }));
    expect(s.tone).toBe('unsure');
    expect(s.phrase).toBe('Não dá para confiar neste número.');
    expect(s.badge).toBe('12 DIAS SEM SINCRONIZAR');
    expect(s.footer).toEqual({ kind: 'alert', text: ALERT_TEXT });
  });

  it('aquecendo: janela curta confiável troca os rótulos pela nota', () => {
    const s = formState(curve({ shortWindow: true, historyDays: 20 }));
    expect(s.tone).toBe('fresh');
    expect(s.footer).toEqual({ kind: 'warmup', text: `Base ainda aquecendo · 20 de ${FORM_BASE_DAYS} dias` });
  });

  it('enterrado e aquecendo ao mesmo tempo: número vermelho com a nota de aquecimento', () => {
    const s = formState(curve({ form: -20, shortWindow: true, historyDays: 10 }));
    expect(s.tone).toBe('buried');
    expect(s.footer.kind).toBe('warmup');
  });

  it('sem confiança vence a janela curta — o alerta é o problema maior', () => {
    const s = formState(curve({ trusted: false, shortWindow: true, daysSinceLastActivity: 6 }));
    expect(s.footer.kind).toBe('alert');
  });

  it('saldo zero conta como fresco e imprime "0" sem sinal', () => {
    const s = formState(curve({ form: 0 }));
    expect(s.tone).toBe('fresh');
    expect(s.valueText).toBe('0');
  });

  it('o tom segue o número impresso: −0,3 vira "0" e não pode ser vermelho', () => {
    const s = formState(curve({ form: -0.3 }));
    expect(s.valueText).toBe('0');
    expect(s.tone).toBe('fresh');
    const t = formState(curve({ form: -0.6 }));
    expect(t.valueText).toBe('-1');
    expect(t.tone).toBe('buried');
  });
});

describe('rótulos', () => {
  it('signedInt arredonda e põe sinal só no positivo', () => {
    expect(signedInt(36.4)).toBe('+36');
    expect(signedInt(-47.6)).toBe('-48');
    expect(signedInt(-0.3)).toBe('0');
  });

  it('staleLabel flexiona e cobre o caso sem atividade', () => {
    expect(staleLabel(12)).toBe('12 DIAS SEM SINCRONIZAR');
    expect(staleLabel(1)).toBe('1 DIA SEM SINCRONIZAR');
    expect(staleLabel(null)).toBe('SEM SINCRONIZAÇÃO');
  });

  it('warmupLabel usa a janela da base', () => {
    expect(warmupLabel(20)).toBe(`Base ainda aquecendo · 20 de ${FORM_BASE_DAYS} dias`);
  });

  it('janelas nos rótulos vêm do núcleo, não de literais', () => {
    expect(SPARK_DAYS).toBe(FORM_BASE_DAYS);
    expect(DETAIL_SPAN_DAYS).toBe(FORM_FATIGUE_DAYS);
    expect(BAR_LABELS.base).toBe(`Base ${FORM_BASE_DAYS} d`);
    expect(BAR_LABELS.fatigue).toBe(`Cansaço ${FORM_FATIGUE_DAYS} d`);
    expect(LEGEND_TEXT).toContain(`${FORM_TYPICAL_DAYS} dias`);
    expect(LEGEND_TEXT).not.toContain('média');
  });
});

describe('canShow — sem dado, sem cartão', () => {
  it('não mostra enquanto o store não carregou', () => {
    expect(canShow(false, curve())).toBe(false);
  });
  it('não mostra com série vazia', () => {
    expect(canShow(true, curve({ series: [] }))).toBe(false);
  });
  it('mostra com dado carregado e pelo menos um dia', () => {
    expect(canShow(true, curve())).toBe(true);
  });
});

describe('sparkSegments — a faísca segmentada por sinal', () => {
  const box = { width: 300, height: 44, pad: 4 };

  it('corta no cruzamento de zero por interpolação, um segmento por troca de sinal', () => {
    const sp = sparkSegments([-4, 6, 3, -2], box);
    expect(sp.segments.map((s) => s.sign)).toEqual([-1, 1, -1]);
    // slot = 100; span = 10 → y(v) = 4 + (6 − v)/10 × 36; zero em 25.6.
    // O primeiro cruzamento fica a 40% do trecho (−4 → 6); o segundo a 60% (3 → −2).
    expect(sp.zeroY).toBe(25.6);
    expect(sp.segments[0].d).toBe('M0,40 L40,25.6');
    expect(sp.segments[1].d).toBe('M40,25.6 L100,4 L200,14.8 L260,25.6');
    expect(sp.segments[2].d).toBe('M260,25.6 L300,32.8');
    expect(sp.end).toEqual({ x: 300, y: 32.8 });
    for (const s of sp.segments) expect(s.d).not.toMatch(/NaN|Infinity/);
  });

  it('zero exato no meio: o corte cai no próprio ponto, sem NaN', () => {
    const sp = sparkSegments([-4, 0, 3], box);
    expect(sp.segments.map((s) => s.sign)).toEqual([-1, 1]);
    expect(sp.segments[0].d).toBe(`M0,40 L150,${sp.zeroY}`);
    expect(sp.segments[1].d.startsWith(`M150,${sp.zeroY}`)).toBe(true);
    for (const s of sp.segments) expect(s.d).not.toMatch(/NaN/);
  });

  it('o zero fica dentro da caixa e o domínio inclui o zero', () => {
    const sp = sparkSegments([-4, 6, 3, -2], box);
    // span = 10 → zero a 60% da altura útil (36), partindo de pad 4.
    expect(sp.zeroY).toBeCloseTo(4 + 0.6 * 36, 5);
    const soPositivo = sparkSegments([2, 5, 3], box);
    expect(soPositivo.segments).toHaveLength(1);
    expect(soPositivo.segments[0].sign).toBe(1);
    expect(soPositivo.zeroY).toBe(40);
    const soNegativo = sparkSegments([-2, -5], box);
    expect(soNegativo.segments[0].sign).toBe(-1);
    expect(soNegativo.zeroY).toBe(4);
  });

  it('série curta: um ponto vira um único segmento sem NaN, com marcador', () => {
    const sp = sparkSegments([5], box);
    expect(sp.segments).toHaveLength(1);
    expect(sp.segments[0].d).toBe('M150,4');
    expect(sp.segments[0].d).not.toMatch(/NaN/);
    expect(sp.end).toEqual({ x: 150, y: 4 });
  });

  it('vazio: nada para desenhar, sem lançar', () => {
    const sp = sparkSegments([], box);
    expect(sp.segments).toEqual([]);
    expect(sp.end).toBeNull();
    expect(Number.isFinite(sp.zeroY)).toBe(true);
  });

  it('valor não finito é descartado e os demais se redistribuem', () => {
    const sp = sparkSegments([1, NaN, 2], box);
    expect(sp.segments[0].d).toBe('M0,22 L300,4');
    expect(sp.segments[0].d).not.toMatch(/NaN/);
  });

  it('offsetX desloca a geometria inteira', () => {
    const sp = sparkSegments([1, 2], { ...box, offsetX: 10 });
    expect(sp.segments[0].d.startsWith('M10,')).toBe(true);
    expect(sp.end?.x).toBe(310);
  });

  it('sparkValues recorta os últimos SPARK_DAYS saldos da série', () => {
    const series = Array.from({ length: 90 }, (_, i) => day(i % 28, i));
    const v = sparkValues(series);
    expect(v).toHaveLength(SPARK_DAYS);
    expect(v[v.length - 1]).toBe(89);
    expect(v[0]).toBe(90 - SPARK_DAYS);
  });
});

describe('barScale — as duas barras na mesma escala', () => {
  it('100% é o maior dos quatro valores com 10% de folga', () => {
    const b = barScale(curve({ base: 93, fatigue: 57, typical: { base: 96, fatigue: 101, form: -5 } }));
    expect(b.max).toBeCloseTo(111.1, 5);
    expect(b.base).toBeCloseTo(93 / 111.1, 5);
    expect(b.fatigue).toBeCloseTo(57 / 111.1, 5);
    expect(b.typicalBase).toBeCloseTo(96 / 111.1, 5);
    expect(b.typicalFatigue).toBeCloseTo(101 / 111.1, 5);
  });

  it('tudo zero não divide por zero', () => {
    const b = barScale(curve({ base: 0, fatigue: 0, typical: { base: 0, fatigue: 0, form: 0 } }));
    expect(b).toEqual({ max: 0, base: 0, fatigue: 0, typicalBase: 0, typicalFatigue: 0 });
  });
});

describe('detailSentence — hoje contra uma semana atrás', () => {
  function series(len: number, base: (i: number) => number, fatigue: (i: number) => number): FormCurveDay[] {
    return Array.from({ length: len }, (_, i) => day(i % 28, base(i) - fatigue(i), base(i), fatigue(i)));
  }

  it('cansaço caiu, base segurou', () => {
    const s = series(9, () => 93, (i) => (i >= 8 ? 57 : 93));
    expect(detailSentence(s)).toBe('O cansaço caiu 36 em uma semana e a base segurou em 93.');
  });

  it('cansaço subiu, base subiu', () => {
    const s = series(8, (i) => 80 + i * 2, (i) => 60 + i * 10);
    // hoje i=7: base 94, cansaço 130; há 7 dias i=0: base 80, cansaço 60.
    expect(detailSentence(s)).toBe('O cansaço subiu 70 em uma semana e a base subiu 14 para 94.');
  });

  it('cansaço parado, base caiu', () => {
    const s = series(8, (i) => 100 - i * 3, () => 50);
    expect(detailSentence(s)).toBe('O cansaço ficou em 50 na semana e a base caiu 21 para 79.');
  });

  it('variação de 1 é ruído nas duas séries: "ficou" e "segurou"', () => {
    const s = series(8, (i) => (i >= 7 ? 94 : 93), (i) => (i >= 7 ? 51 : 50));
    expect(detailSentence(s)).toBe('O cansaço ficou em 51 na semana e a base segurou em 94.');
    const t = series(8, () => 93, (i) => (i >= 7 ? 48 : 50));
    expect(detailSentence(t)).toBe('O cansaço caiu 2 em uma semana e a base segurou em 93.');
  });

  it('a conta fecha com os números impressos: deltas sobre valores arredondados', () => {
    const s = series(8, (i) => (i >= 7 ? 94.6 : 80.4), () => 50);
    // 80,4 → 94,6 arredonda para 80 → 95: subiu 15, não 14.
    expect(detailSentence(s)).toBe('O cansaço ficou em 50 na semana e a base subiu 15 para 95.');
  });

  it('série curta (7 pontos) omite a frase', () => {
    expect(detailSentence(series(DETAIL_SPAN_DAYS, () => 90, () => 90))).toBeNull();
    expect(detailSentence([])).toBeNull();
  });
});

describe('baseBarColor — a Base separa do Cansaço por luz, não só por matiz', () => {
  // As listas não são exportadas pelo shared; os tipos são, e o tsc acusa id inválido.
  const THEMES: ThemeId[] = ['orbe', 'clean', 'cleanElev'];
  const PALETTES: PaletteId[] = ['orbe', 'bruma', 'terra', 'neon', 'joia', 'acessivel'];

  it('em todo tema × esquema × paleta: separação ≥ 1,15 do rose e ≥ 4,5 da superfície', () => {
    for (const theme of THEMES) {
      for (const scheme of ['light', 'dark'] as const) {
        for (const palette of PALETTES) {
          const tk = resolveTokens(theme, scheme, palette, DEFAULT_BRAND_ID);
          const base = baseBarColor(tk.roles.blue.text, tk.ink);
          const rose = tk.roles.rose.text;
          const where = `${theme}/${scheme}/${palette}`;
          expect({ where, v: contrast(base, rose) }).toEqual({ where, v: expect.any(Number) });
          expect(contrast(base, rose)).toBeGreaterThanOrEqual(1.15);
          expect(contrast(base, tk.surface)).toBeGreaterThanOrEqual(4.5);
          expect(base).not.toBe(rose);
        }
      }
    }
  });

  it('o passo fundo escurece no claro e clareia no escuro', () => {
    const light = resolveTokens('orbe', 'light', 'orbe', DEFAULT_BRAND_ID);
    const dark = resolveTokens('orbe', 'dark', 'orbe', DEFAULT_BRAND_ID);
    expect(contrast(baseBarColor(light.roles.blue.text, light.ink), light.surface)).toBeGreaterThan(
      contrast(light.roles.blue.text, light.surface),
    );
    expect(contrast(baseBarColor(dark.roles.blue.text, dark.ink), dark.surface)).toBeGreaterThan(
      contrast(dark.roles.blue.text, dark.surface),
    );
  });
});
