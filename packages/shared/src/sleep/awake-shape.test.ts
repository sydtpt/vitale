import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SleepPeriod } from '../models';
import {
  ALIGNMENT_MIN_EVENTS,
  ALIGNMENT_ONSET_GUARD_MIN,
  awakeAlignment,
  poissonTailAtLeast,
  typicalAwakening,
} from './awake-shape';

/* ── fábricas ── */

const iso = (day: string, hh: number, mm = 0) =>
  new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10), hh, mm)).toISOString();

/** Uma noite que começa em `onsetH` do dia anterior a `wakeDay` e dura `lenH`. */
function night(
  wakeDay: string,
  onsetH: number,
  lenH: number,
  awakenings: { atMin: number; durMin: number }[] | null,
): SleepPeriod {
  const prev = new Date(`${wakeDay}T00:00:00Z`);
  prev.setUTCDate(prev.getUTCDate() - 1);
  const prevDay = prev.toISOString().slice(0, 10);
  // onsetH >= 12 cai na véspera; abaixo disso é madrugada do próprio wakeDay
  const onset = onsetH >= 12 ? new Date(iso(prevDay, onsetH)) : new Date(iso(wakeDay, onsetH));
  return {
    userId: 'u',
    onsetAt: onset.toISOString(),
    wakeAt: new Date(onset.getTime() + lenH * 3_600_000).toISOString(),
    inBedAt: null,
    inBedEnd: null,
    tzOffset: 0,
    wakeDay,
    asleepH: lenH,
    awakenings:
      awakenings === null
        ? null
        : awakenings.map((a) => ({
            from: new Date(onset.getTime() + a.atMin * 60_000).toISOString(),
            to: new Date(onset.getTime() + (a.atMin + a.durMin) * 60_000).toISOString(),
          })),
    stages: null,
    stageSegments: null,
  };
}

const dayAt = (i: number) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);

/* ═══════════════════════ o despertar típico ═══════════════════════ */

describe('typicalAwakening', () => {
  it('devolve null quando nenhuma noite reporta — fonte muda não é zero despertar', () => {
    assert.equal(typicalAwakening([night('2026-01-02', 23, 8, null)]), null);
    assert.equal(typicalAwakening([]), null);
  });

  it('reporta com lista vazia: a noite conta no denominador e não há evento', () => {
    const t = typicalAwakening([night('2026-01-02', 23, 8, [])])!;
    assert.equal(t.reporting, 1);
    assert.equal(t.total, 0);
    assert.equal(t.medianMin, null);
    assert.equal(t.longest, null);
  });

  it('a mediana olha só os de 5 min ou mais; os curtos viram `brief`', () => {
    const t = typicalAwakening([
      night('2026-01-02', 23, 8, [
        { atMin: 30, durMin: 1 },
        { atMin: 60, durMin: 2 },
        { atMin: 90, durMin: 4 },
        { atMin: 120, durMin: 10 },
        { atMin: 200, durMin: 20 },
        { atMin: 300, durMin: 30 },
      ]),
    ])!;
    assert.equal(t.total, 6);
    assert.equal(t.brief, 3, 'três abaixo de 5 min');
    assert.equal(t.real, 3);
    assert.equal(t.medianMin, 20, 'mediana de 10/20/30 — os curtos não entram');
  });

  it('5 min exatos contam como despertar de verdade (>=, igual às faixas)', () => {
    const t = typicalAwakening([night('2026-01-02', 23, 8, [{ atMin: 60, durMin: 5 }])])!;
    assert.equal(t.real, 1);
    assert.equal(t.brief, 0);
  });

  it('o maior traz o dia junto, e é o maior de TODOS, não só dos reais', () => {
    const t = typicalAwakening([
      night('2026-01-02', 23, 8, [{ atMin: 60, durMin: 12 }]),
      night('2026-01-03', 23, 8, [{ atMin: 60, durMin: 44 }]),
      night('2026-01-04', 23, 8, [{ atMin: 60, durMin: 9 }]),
    ])!;
    assert.equal(Math.round(t.longest!.min), 44);
    assert.equal(t.longest!.day, '2026-01-03');
  });

  it('o p90 só sai com pelo menos 5 despertares reais', () => {
    const poucos = typicalAwakening([
      night('2026-01-02', 23, 8, [{ atMin: 60, durMin: 10 }, { atMin: 120, durMin: 20 }]),
    ])!;
    assert.equal(poucos.p90Min, null);
    assert.notEqual(poucos.medianMin, null, 'a mediana sai com dois — o p90 é que não');
  });
});

/* ═══════════════════════ Poisson ═══════════════════════ */

describe('poissonTailAtLeast', () => {
  it('P(X >= 0) = 1 e cresce quando o observado cai', () => {
    assert.equal(poissonTailAtLeast(0, 10), 1);
    assert.ok(poissonTailAtLeast(5, 10) > poissonTailAtLeast(15, 10));
  });

  it('observado igual à média fica perto de meio; muito acima fica minúsculo', () => {
    const meio = poissonTailAtLeast(10, 10);
    assert.ok(meio > 0.3 && meio < 0.7, `esperava ~0,5, veio ${meio}`);
    assert.ok(poissonTailAtLeast(40, 10) < 1e-9);
  });
});

/* ═══════════════════════ alinhamento ═══════════════════════ */

describe('awakeAlignment', () => {
  it('devolve null abaixo do piso de eventos — uma semana não responde isto', () => {
    const poucas = Array.from({ length: 7 }, (_, i) =>
      night(dayAt(i), 23, 8, [{ atMin: 120, durMin: 10 }]),
    );
    assert.equal(awakeAlignment(poucas), null);
  });

  it('CONTROLE POSITIVO: um evento preso ao relógio é detectado', () => {
    // 240 noites com hora de dormir variando de 21h a 2h — se o teste não
    // acusar isto, ele não sabe dizer "sim" e não serve para nada.
    const noites = Array.from({ length: 240 }, (_, i) => {
      const onsetH = [21, 22, 23, 0, 1, 2][i % 6];
      const len = 8;
      // o "trem" às 06:10: minutos desde o onset até chegar lá
      const onsetAbs = onsetH >= 12 ? onsetH - 24 : onsetH;
      const trem = (6 + 10 / 60 - onsetAbs) * 60;
      const evs = [{ atMin: trem, durMin: 12 }];
      if (i % 3 === 0) evs.push({ atMin: 60 + (i % 5) * 40, durMin: 8 });
      return night(dayAt(i), onsetH, len, evs);
    });
    const a = awakeAlignment(noites, 400)!;
    assert.ok(a.events >= ALIGNMENT_MIN_EVENTS);
    assert.equal(a.clock.significant, true, 'o trem das 6h10 tem de aparecer no relógio');
    assert.equal(a.clock.peak!.from, 6, 'e tem de aparecer NA hora certa');
    assert.ok(a.clock.peak!.ratio > 1.8, `esperava concentração forte, veio ${a.clock.peak!.ratio}`);
  });

  it('CONTROLE NEGATIVO: despertar espalhado dentro da noite não vira padrão', () => {
    const noites = Array.from({ length: 260 }, (_, i) => {
      const onsetH = [22, 23, 0, 1][i % 4];
      // posições pseudo-aleatórias mas determinísticas, espalhadas pela noite
      const evs = [0, 1, 2].map((k) => ({ atMin: ((i * 97 + k * 151) % 440) + 20, durMin: 8 }));
      return night(dayAt(i), onsetH, 8, evs);
    });
    const a = awakeAlignment(noites, 400)!;
    assert.equal(a.clock.significant, false, 'sem causa externa, o relógio não pode acusar');
  });

  it('o guarda de início de noite existe: um pico logo depois do onset NÃO vira achado de relógio', () => {
    // Toda noite quebra 15 min depois de apagar, com a hora de dormir variando.
    // Sem o guarda o relógio acusaria a hora mais comum de deitar e a tela diria
    // "algo te acorda à meia-noite" — o falso positivo que o guarda existe para
    // matar. Os outros dois despertares ficam espalhados pela noite.
    const noites = Array.from({ length: 260 }, (_, i) => {
      const onsetH = [21, 22, 23, 0, 1, 2][i % 6];
      const espalhados = [0, 1].map((k) => ({ atMin: ((i * 97 + k * 151) % 380) + 70, durMin: 8 }));
      return night(dayAt(i), onsetH, 8, [{ atMin: 15, durMin: 10 }, ...espalhados]);
    });
    const a = awakeAlignment(noites, 400)!;
    assert.equal(a.clock.significant, false, 'o pico de onset não pode virar achado de relógio');
    assert.equal(a.since.significant, true, 'ele aparece no alinhamento certo: o do corpo');
    assert.equal(a.since.peak!.from, 0, 'na primeira meia hora');
  });

  it('o guarda desconta exatamente a primeira hora do teste de relógio', () => {
    const noites = Array.from({ length: 260 }, (_, i) =>
      night(dayAt(i), 23, 8, [
        { atMin: ALIGNMENT_ONSET_GUARD_MIN - 5, durMin: 10 },
        { atMin: ALIGNMENT_ONSET_GUARD_MIN + 5, durMin: 10 },
      ]),
    );
    const a = awakeAlignment(noites, 400)!;
    assert.equal(a.since.events, 520, 'o alinhamento pelo corpo vê os dois');
    assert.equal(a.clock.events, 260, 'o do relógio vê só o que está fora do guarda');
  });

  it('a janela olha as últimas N noites que reportam, e diz de quando fala', () => {
    const noites = Array.from({ length: 300 }, (_, i) =>
      night(dayAt(i), 23, 8, [
        { atMin: 100 + (i % 11) * 30, durMin: 9 },
        { atMin: 60 + (i % 7) * 45, durMin: 7 },
      ]),
    );
    const a = awakeAlignment(noites, 180)!;
    assert.equal(a.nights, 180);
    assert.equal(a.to, dayAt(299));
    assert.equal(a.from, dayAt(120));
  });

  it('noites sem reporte não entram na janela nem no denominador', () => {
    const mudas = Array.from({ length: 50 }, (_, i) => night(dayAt(i), 23, 8, null));
    const falantes = Array.from({ length: 260 }, (_, i) =>
      night(dayAt(50 + i), 23, 8, [{ atMin: 120 + (i % 9) * 25, durMin: 9 }]),
    );
    const a = awakeAlignment([...mudas, ...falantes], 400)!;
    assert.equal(a.nights, 260);
    assert.equal(a.from, dayAt(50));
  });
});
