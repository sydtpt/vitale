import { describe, it, expect } from '@jest/globals';
import { buildTrainingLoad, type FormCurveDay, type TrainingLoad } from '@vitale/shared';
import {
  BAND_LABEL,
  FOOTER_DEFAULT,
  STRAIN_WEEKS,
  canShowLoad,
  decimal,
  loadState,
  percentText,
  staleText,
  strainTrend,
  textureLine,
} from '../training-load-view';

// Spec: _bmad-output/implementation-artifacts/spec-carga-acwr.md

function day(i: number, load: number): FormCurveDay {
  const d = new Date(Date.UTC(2026, 5, 1));
  d.setUTCDate(d.getUTCDate() + i);
  return { day: d.toISOString().slice(0, 10), dailyLoadMin: load, base: 0, fatigue: 0, form: 0 };
}

function series(loads: number[]): FormCurveDay[] {
  return loads.map((l, i) => day(i, l));
}

/** 28 dias de base a 40/dia, mais a semana pedida. */
function withWeek(week: number[], base = 40): FormCurveDay[] {
  return series([...Array.from({ length: 28 }, () => base), ...week]);
}

/** Semana variada com a média pedida — evita cair no caso `constant`. */
function variedWeek(mean: number): number[] {
  const shape = [2.25, 0, 1.5, 0, 1.75, 0.5, 1];
  return shape.map((f) => f * mean);
}

const OPTIMAL = buildTrainingLoad(withWeek(variedWeek(40)));
const CAUTION = buildTrainingLoad(withWeek(variedWeek(56)));
const RISK = buildTrainingLoad(withWeek(variedWeek(80)));
const UNDER = buildTrainingLoad(withWeek(variedWeek(20)));

describe('as fixtures caem nas faixas que os testes assumem', () => {
  it('cobre as quatro faixas', () => {
    expect(OPTIMAL.band).toBe('optimal');
    expect(CAUTION.band).toBe('caution');
    expect(RISK.band).toBe('risk');
    expect(UNDER.band).toBe('undertraining');
  });
});

describe('percentText', () => {
  it('converte a razão em variação sobre a base', () => {
    expect(percentText(1.12)).toBe('+12%');
    expect(percentText(0.66)).toBe('−34%');
    expect(percentText(2)).toBe('+100%');
  });

  it('nunca imprime menos zero', () => {
    // `Math.round` devolve −0 para qualquer coisa em [−0,5, 0), e "−0%" na tela
    // seria erro visível. 0,998 cai exatamente aí: (0,998 − 1) × 100 = −0,2.
    expect(percentText(0.998)).toBe('0%');
    expect(percentText(1)).toBe('0%');
    expect(percentText(1.004)).toBe('0%');
    // Varredura: nenhum ponto da vizinhança do 1 pode imprimir o sinal com zero.
    for (let v = 0.99; v <= 1.01; v += 0.0005) {
      expect(percentText(v)).not.toBe('−0%');
    }
  });

  it('usa o menos tipográfico, não o hífen', () => {
    expect(percentText(0.5)).toContain('−');
    expect(percentText(0.5)).not.toContain('-');
  });

  it('devolve travessão sem número', () => {
    expect(percentText(null)).toBe('—');
    expect(percentText(Number.NaN)).toBe('—');
  });
});

describe('decimal', () => {
  it('usa vírgula', () => {
    expect(decimal(1.12)).toBe('1,12');
    expect(decimal(1.44, 1)).toBe('1,4');
  });
  it('devolve travessão sem número', () => {
    expect(decimal(null)).toBe('—');
  });
});

describe('staleText', () => {
  it('concorda em número', () => {
    expect(staleText(1)).toBe('1 dia sem sincronizar — o silêncio entra como descanso');
    expect(staleText(9)).toContain('9 dias sem sincronizar');
  });
  it('sobrevive a nunca ter sincronizado', () => {
    expect(staleText(null)).toContain('Sem sincronizar');
  });
});

describe('canShowLoad', () => {
  it('exige dado carregado e série', () => {
    expect(canShowLoad(false, series([1, 2]))).toBe(false);
    expect(canShowLoad(true, [])).toBe(false);
    expect(canShowLoad(true, series([1]))).toBe(true);
  });
});

describe('loadState — as quatro faixas', () => {
  it('rotula e tinge cada uma', () => {
    const o = loadState(OPTIMAL, true, 0);
    expect(o.chip).toBe(BAND_LABEL.optimal);
    expect(o.tone).toBe('optimal');
    expect(o.body.kind).toBe('scale');

    expect(loadState(CAUTION, true, 0).tone).toBe('caution');
    expect(loadState(RISK, true, 0).chip).toBe(BAND_LABEL.risk);
    expect(loadState(UNDER, true, 0).tone).toBe('under');
  });

  it('não promete diagnóstico em rótulo nenhum', () => {
    // As fronteiras foram calibradas sobre o acoplado e classificam o
    // desacoplado, mais sensível: os rótulos descrevem, não diagnosticam.
    for (const label of Object.values(BAND_LABEL)) {
      expect(label).toContain('costume');
      expect(label).not.toMatch(/risco|perigo|lesão/i);
    }
  });

  it('leva a razão crua junto, para conferência', () => {
    expect(loadState(OPTIMAL, true, 0).ratioText).toMatch(/^ACWR \d,\d\d$/);
  });
});

describe('loadState — o portão de confiança', () => {
  it('não deixa passar faixa nenhuma com dado velho', () => {
    // A regra que não pode falhar: zeros de sync parado empurram o ACWR para
    // `undertraining`, a faixa mais tranquilizadora da escala.
    for (const tl of [OPTIMAL, CAUTION, RISK, UNDER]) {
      const s = loadState(tl, false, 9);
      expect(s.chip).toBeNull();
      expect(s.tone).toBe('mute');
      expect(s.body.kind).toBe('alert');
    }
  });

  it('diz quantos dias faz que não sincroniza', () => {
    const s = loadState(RISK, false, 9);
    expect(s.body.kind === 'alert' && s.body.text).toContain('9 dias sem sincronizar');
  });

  it('mantém o número, apagado, como a curva de forma faz', () => {
    expect(loadState(RISK, false, 9).headline).toBe(percentText(RISK.acwr));
  });

  it('apaga também a leitura de textura', () => {
    expect(textureLine(OPTIMAL, false).note).toBe('sem dado confiável');
  });
});

describe('loadState — sem índice', () => {
  it('separa "voltando de uma pausa" de "sem histórico"', () => {
    const parado = buildTrainingLoad(series([...Array.from({ length: 28 }, () => 0), ...variedWeek(40)]));
    expect(parado.acwr).toBeNull();
    const s = loadState(parado, true, 0);
    expect(s.headline).toBe('—');
    expect(s.body.kind).toBe('void');
    expect(s.body.kind === 'void' && s.body.text).toContain('ficou parado');

    const curto = buildTrainingLoad(series([10, 20, 30, 40, 50]));
    expect(curto.chronicDays).toBe(0);
    const c = loadState(curto, true, 0);
    expect(c.body.kind === 'void' && c.body.text).toContain('Ainda não há três semanas');
  });
});

describe('loadState — base aquecendo', () => {
  it('mostra o número apagado e conta os dias', () => {
    const curto = buildTrainingLoad(series(Array.from({ length: 20 }, (_, i) => 30 + (i % 5) * 10)));
    expect(curto.shortWindow).toBe(true);
    const s = loadState(curto, true, 0);
    expect(s.chip).toBe('base ainda aquecendo');
    expect(s.tone).toBe('mute');
    expect(s.body.kind === 'scale' && s.body.muted).toBe(true);
    expect(s.footer).toContain('20 de 28 dias');
  });

  it('a faixa cheia usa o rodapé padrão', () => {
    expect(loadState(OPTIMAL, true, 0).footer).toBe(FOOTER_DEFAULT);
  });
});

describe('textureLine', () => {
  it('lê o número quando ele existe', () => {
    const t = textureLine(OPTIMAL, true);
    expect(t.value).toMatch(/^\d,\d$/);
    expect(t.note).toBe('dias variados');
    expect(t.tone).toBe('ink');
  });

  it('marca a semana monótona', () => {
    // Semana quase uniforme: desvio pequeno, monotonia alta.
    const quase = buildTrainingLoad(withWeek([41, 39, 40, 41, 39, 40, 40]));
    expect(quase.monotonyBand).toBe('monotonous');
    const t = textureLine(quase, true);
    expect(t.note).toBe('dias iguais demais');
    expect(t.tone).toBe('alert');
  });

  it('sete dias idênticos não viram "sem leitura"', () => {
    // O caso que justifica a função: `monotony` é null porque o desvio é zero,
    // e mesmo assim a faixa diz `monotonous`. É o extremo, não a ausência.
    const constante = buildTrainingLoad(withWeek([40, 40, 40, 40, 40, 40, 40]));
    expect(constante.monotony).toBeNull();
    expect(constante.monotonyReason).toBe('constant');
    expect(constante.monotonyBand).toBe('monotonous');
    const t = textureLine(constante, true);
    expect(t.value).toBe('—');
    expect(t.note).toBe('sete dias idênticos');
    expect(t.tone).toBe('alert');
  });

  it('distingue semana parada de semana idêntica', () => {
    const parada = buildTrainingLoad(withWeek([0, 0, 0, 0, 0, 0, 0]));
    expect(parada.monotonyReason).toBe('idle');
    const t = textureLine(parada, true);
    expect(t.note).toBe('semana sem treino');
    expect(t.tone).toBe('mute');
  });

  it('distingue semana incompleta', () => {
    const curta = buildTrainingLoad(series([10, 20, 30]));
    expect(curta.monotonyReason).toBe('shortWeek');
    expect(textureLine(curta, true).note).toBe('semana ainda em curso');
  });

  it('sobrevive a um motivo desconhecido', () => {
    const alien = { monotony: null, monotonyReason: 'futuro', monotonyBand: null } as unknown as TrainingLoad;
    expect(textureLine(alien, true).note).toBe('sem leitura');
  });
});

describe('strainTrend', () => {
  it('devolve uma posição por semana pedida', () => {
    const s = series(Array.from({ length: 90 }, (_, i) => (i % 3 === 0 ? 90 : 10)));
    expect(strainTrend(s)).toHaveLength(STRAIN_WEEKS);
    expect(strainTrend(s, 4)).toHaveLength(4);
  });

  it('termina na semana mais recente', () => {
    const s = series(Array.from({ length: 90 }, (_, i) => (i % 3 === 0 ? 90 : 10)));
    const trend = strainTrend(s);
    expect(trend[trend.length - 1]).toBe(buildTrainingLoad(s).strain);
  });

  it('devolve null onde não há semana, em vez de zero', () => {
    // Strain zero e strain indefinido são coisas diferentes: a barra mostra a
    // ausência em vez de fingir um fundo de escala.
    const curta = series(Array.from({ length: 20 }, () => 30));
    const trend = strainTrend(curta);
    expect(trend[0]).toBeNull();
    expect(trend).toHaveLength(STRAIN_WEEKS);
  });

  it('não explode com série vazia', () => {
    expect(strainTrend([])).toEqual(Array.from({ length: STRAIN_WEEKS }, () => null));
  });
});
