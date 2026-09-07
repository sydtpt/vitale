import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SleepPeriod } from '../models';
import {
  TRIGGER_MIN_PER_CELL,
  habitCut,
  sleepTriggerBoard,
  triggerNights,
  triggerReach,
  twoColumnReading,
  type TriggerNight,
} from './triggers';

/* ── fábricas ── */

/** Noite que acorda em `wakeDay`, apagando às `onsetH` e dormindo `asleepH`. */
function night(wakeDay: string, onsetH: number, asleepH: number): SleepPeriod {
  const prev = new Date(`${wakeDay}T00:00:00Z`);
  prev.setUTCDate(prev.getUTCDate() - 1);
  const base = onsetH >= 12 ? prev.toISOString().slice(0, 10) : wakeDay;
  const onset = new Date(`${base}T${String(onsetH).padStart(2, '0')}:00:00Z`);
  return {
    userId: 'u',
    onsetAt: onset.toISOString(),
    wakeAt: new Date(onset.getTime() + asleepH * 3_600_000).toISOString(),
    inBedAt: null,
    inBedEnd: null,
    tzOffset: 0,
    wakeDay,
    asleepH,
    awakenings: [],
    stages: null,
    stageSegments: null,
  };
}

/** Constrói noites já no formato do cruzamento, alternando as colunas. */
function nights(spec: { column: 'presa' | 'livre'; eve: string; asleep: number; onset?: number }[]): TriggerNight[] {
  return spec.map((s, i) => ({
    wakeDay: `w${i}`,
    eve: s.eve,
    column: s.column,
    onset: s.onset ?? 6,
    asleep: s.asleep,
    rating: null,
  }));
}

/** n noites de uma coluna, metade com o gatilho `eve`, com médias controladas. */
function cell(column: 'presa' | 'livre', withMin: number, withoutMin: number, n = 6): TriggerNight[] {
  const out: TriggerNight[] = [];
  for (let i = 0; i < n; i += 1) out.push(...nights([{ column, eve: 'G', asleep: withMin }]));
  for (let i = 0; i < n; i += 1) out.push(...nights([{ column, eve: 'x' + i, asleep: withoutMin }]));
  return out;
}

/* ═══════════════════════ triggerNights ═══════════════════════ */

describe('triggerNights', () => {
  it('a véspera é o dia anterior ao de acordar — é lá que mora o gatilho', () => {
    const [n] = triggerNights([night('2026-08-12', 23, 7)]);
    assert.equal(n.wakeDay, '2026-08-12');
    assert.equal(n.eve, '2026-08-11');
  });

  it('a noite antes de folga é `livre`; a antes de trabalho é `presa`', () => {
    // 2026-08-15 é sábado: a noite que acorda nele é véspera de sexta = livre.
    assert.equal(triggerNights([night('2026-08-15', 23, 7)])[0].column, 'livre');
    assert.equal(triggerNights([night('2026-08-16', 23, 7)])[0].column, 'livre', 'domingo também');
    assert.equal(triggerNights([night('2026-08-13', 23, 7)])[0].column, 'presa', 'quinta é presa');
  });

  it('desconta a vigília do tempo dormido', () => {
    const p = night('2026-08-12', 23, 8);
    const on = new Date(p.onsetAt).getTime();
    p.awakenings = [{ from: new Date(on + 3_600_000).toISOString(), to: new Date(on + 5_400_000).toISOString() }];
    const [n] = triggerNights([p]);
    assert.equal(Math.round(n.asleep), 8 * 60 - 30);
  });

  it('carrega a nota quando existe, e null quando não', () => {
    const r = new Map([['2026-08-12', 4]]);
    assert.equal(triggerNights([night('2026-08-12', 23, 7)], r)[0].rating, 4);
    assert.equal(triggerNights([night('2026-08-13', 23, 7)], r)[0].rating, null);
  });
});

/* ═══════════════════════ a regra das duas colunas ═══════════════════════ */

describe('twoColumnReading', () => {
  it('passa quando as duas colunas concordam no sinal e o efeito é grande', () => {
    const ns = [...cell('presa', 400, 430), ...cell('livre', 380, 420)];
    const r = twoColumnReading('g', 'Gatilho', 'asleep', new Set(['G']), ns);
    assert.equal(r.agrees, true);
    assert.equal(r.passes, true);
    assert.equal(Math.round(r.delta!), -35, 'média de −30 e −40');
  });

  it('MORRE quando os sinais discordam — o sintoma de ruído', () => {
    // Exatamente o caso da água no arquivo real: +227 numa coluna, −99 na outra.
    const ns = [...cell('presa', 600, 373), ...cell('livre', 300, 399)];
    const r = twoColumnReading('agua', 'Água', 'asleep', new Set(['G']), ns);
    assert.equal(r.agrees, false);
    assert.equal(r.passes, false);
    assert.equal(r.delta, null);
    assert.ok(r.cells[0].delta! > 0 && r.cells[1].delta! < 0, 'as duas colunas ficam visíveis mesmo assim');
  });

  it('MORRE quando uma coluna não tem noites de sobra', () => {
    const ns = [
      ...cell('presa', 400, 430),
      ...nights(Array.from({ length: 2 }, () => ({ column: 'livre' as const, eve: 'G', asleep: 400 }))),
      ...nights(Array.from({ length: 9 }, (_, i) => ({ column: 'livre' as const, eve: 'y' + i, asleep: 430 }))),
    ];
    const r = twoColumnReading('g', 'G', 'asleep', new Set(['G']), ns);
    assert.equal(r.cells[1].nWith, 2);
    assert.equal(r.cells[1].delta, null, `abaixo de ${TRIGGER_MIN_PER_CELL} a coluna cala`);
    assert.equal(r.passes, false);
  });

  it('concorda no sinal mas MORRE no piso de tamanho — o caso do +0,13 ponto', () => {
    const ns = [
      ...cell('presa', 0, 0).map((n, i) => ({ ...n, rating: n.eve === 'G' ? 3.63 : 3.5, asleep: 400 + i })),
      ...cell('livre', 0, 0).map((n, i) => ({ ...n, rating: n.eve === 'G' ? 3.63 : 3.5, asleep: 400 + i })),
    ];
    const r = twoColumnReading('g', 'G', 'rating', new Set(['G']), ns);
    assert.equal(r.agrees, true, 'as duas colunas concordam');
    assert.equal(r.passes, false, 'e mesmo assim treze centésimos não viram manchete');
    assert.equal(r.delta, null);
  });

  it('a métrica de horário sai em minutos, com "mais tarde" positivo', () => {
    const later = [
      ...nights(Array.from({ length: 6 }, () => ({ column: 'presa' as const, eve: 'G', asleep: 400, onset: 6.5 }))),
      ...nights(Array.from({ length: 6 }, (_, i) => ({ column: 'presa' as const, eve: 'x' + i, asleep: 400, onset: 6 }))),
      ...nights(Array.from({ length: 6 }, () => ({ column: 'livre' as const, eve: 'G', asleep: 400, onset: 7 }))),
      ...nights(Array.from({ length: 6 }, (_, i) => ({ column: 'livre' as const, eve: 'y' + i, asleep: 400, onset: 6 }))),
    ];
    const r = twoColumnReading('cafe', 'Café', 'onset', new Set(['G']), later);
    assert.equal(r.passes, true);
    assert.equal(Math.round(r.delta!), 45, 'média de +30 e +60 min');
  });
});

/* ═══════════════════════ o corte adaptativo ═══════════════════════ */

describe('habitCut', () => {
  const eves = Array.from({ length: 20 }, (_, i) => `d${String(i).padStart(2, '0')}`);

  it('hábito frequente: a mediana cai no meio e o corte pergunta DOSE', () => {
    const logs = new Map(eves.map((d, i) => [d, (i % 4) + 1]));
    const { cut, days } = habitCut(logs, eves);
    assert.equal(cut, 3, 'mediana superior de cinco 1, cinco 2, cinco 3 e cinco 4');
    assert.equal(days.size, 5, 'só os dias de 4 ficam acima do corte');
  });

  it('hábito raro: a mediana cai em zero e o corte degenera para PRESENÇA', () => {
    // Cinco dias com o hábito em vinte — o caso da cerveja.
    const logs = new Map(eves.slice(0, 5).map((d) => [d, 2]));
    const { cut, days } = habitCut(logs, eves);
    assert.equal(cut, 0);
    assert.equal(days.size, 5, 'todos os dias com o hábito entram, não metade deles');
  });

  it('os zeros contam: cortar só pelos dias COM o hábito perderia metade da amostra', () => {
    const logs = new Map(eves.slice(0, 6).map((d, i) => [d, i < 3 ? 1 : 3]));
    assert.equal(habitCut(logs, eves).days.size, 6, 'com zeros, todos os 6 entram');
    // sem os zeros a mediana seria 1 e só os de valor 3 entrariam
    const semZeros = [...logs.values()].sort((a, b) => a - b);
    assert.equal(semZeros[Math.floor(semZeros.length / 2)], 3);
  });
});

/* ═══════════════════════ a régua de alcance ═══════════════════════ */

describe('triggerReach', () => {
  it('conta as noites tocadas em cada coluna e diz quanto falta na mais curta', () => {
    const ns = nights([
      ...Array.from({ length: 7 }, () => ({ column: 'presa' as const, eve: 'G', asleep: 400 })),
      ...Array.from({ length: 2 }, () => ({ column: 'livre' as const, eve: 'G', asleep: 400 })),
      ...Array.from({ length: 30 }, (_, i) => ({ column: 'presa' as const, eve: 'x' + i, asleep: 400 })),
    ]);
    const r = triggerReach('pizza', 'Pizza', new Set(['G']), ns);
    assert.equal(r.nights, 9);
    assert.equal(r.presa, 7);
    assert.equal(r.livre, 2);
    assert.equal(r.missing, 3, 'faltam 3 noites livres');
    assert.equal(r.ready, false);
  });

  it('gatilho nunca marcado não entra na régua — vazio não é "quase lá"', () => {
    const ns = nights(
      Array.from({ length: 20 }, (_, i) => ({ column: 'presa' as const, eve: 'x' + i, asleep: 400 })),
    );
    const board = sleepTriggerBoard(
      [{ id: 'novo', label: 'Pedir comida', days: new Set<string>() }],
      ns,
    );
    assert.equal(board.pending.length, 0);
    assert.equal(board.readings.length, 0);
    assert.equal(board.silent.length, 0);
  });

  it('pronta quando as duas colunas chegaram ao piso', () => {
    const ns = nights([
      ...Array.from({ length: 7 }, () => ({ column: 'presa' as const, eve: 'G', asleep: 400 })),
      ...Array.from({ length: 8 }, () => ({ column: 'livre' as const, eve: 'G', asleep: 400 })),
    ]);
    const r = triggerReach('cerveja', 'Cerveja', new Set(['G']), ns);
    assert.equal(r.missing, 0);
    assert.equal(r.ready, true);
  });
});
