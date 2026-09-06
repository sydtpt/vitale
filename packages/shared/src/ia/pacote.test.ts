import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { RetroSummary } from '../period/retro';
import type { RecapValue, MetricRecap } from '../week/recap';
import {
  PACOTE_VERSAO,
  coberturaDe,
  montarPacote,
  numerosDoPacote,
  periodoFechado,
  ressalvasObrigatorias,
} from './pacote';

/* ── fábricas ── */

function recap(current: number, prior: number): RecapValue {
  const delta = current - prior;
  return { current, prior, delta, deltaPct: prior !== 0 ? (delta / prior) * 100 : null };
}

function metrica(current: number | null, prior: number | null, n = 30): MetricRecap {
  if (current == null || prior == null) {
    return { current, prior, delta: null, deltaPct: null, n };
  }
  const delta = current - prior;
  return { current, prior, delta, deltaPct: prior !== 0 ? (delta / prior) * 100 : null, n };
}

const VAZIO = recap(0, 0);

/**
 * Agosto de 2026 contra julho — **dado real de produção**, consultado em
 * 06/09/2026. É o primeiro caso do golden set (§6 do spec) e a razão de os
 * números estarem escritos à mão aqui em vez de gerados: se a montagem mudar,
 * o teste tem que gritar contra a realidade, não contra si mesmo.
 *
 *   atividades 21 × 17 · 435 km × 862 · 40,1 h × 68,2
 *   corrida     8 × 2  · 101 km × 21
 *   ciclismo    7 × 11 · 333 km × 820
 *   nota sono 3,72 × 3,39 · nota dia 4,00 × 3,82
 *   noites com dado: 27 × 14
 */
function agosto(): RetroSummary {
  return {
    kind: 'month',
    offset: -1,
    label: 'Agosto',
    startISO: '2026-08-01',
    endISO: '2026-08-31',
    tasks: { total: recap(0, 0), byModule: [] },
    habits: { good: [], bad: [] },
    registros: [],
    fitness: {
      count: recap(21, 17),
      distanceM: recap(435_000, 862_000),
      durationS: recap(144_360, 245_520),          // 40,1 h × 68,2 h
      calories: VAZIO,
      hardMin: VAZIO,
      floors: recap(539, 500),
      steps: recap(537_847, 500_000),              // 17.350/dia em 31 dias
      byType: [],
    },
    sports: {
      cycling: {
        activityId: 13,
        sessions: recap(7, 11),
        distanceM: recap(333_000, 820_000),
        movingS: recap(81_720, 190_000),
        elevationM: recap(0, 0),
        calories: VAZIO,
        speedMps: { current: null, prior: null },
        longest: null,
        bestEfforts: [],
      },
      running: {
        activityId: 37,
        sessions: recap(8, 2),
        distanceM: recap(101_000, 21_000),
        movingS: recap(41_040, 8_640),
        elevationM: recap(0, 0),
        calories: VAZIO,
        speedMps: { current: null, prior: null },
        longest: null,
        bestEfforts: [],
      },
    },
    health: [
      {
        metric: 'sono', label: 'Sono', higherIsWorse: false, icon: 'moon' as never,
        decimals: 2, unit: 'h', recap: metrica(7.03, 6.89, 27), trend: 'up',
      },
      {
        metric: 'fcRepouso', label: 'FC de repouso', higherIsWorse: true, icon: 'heart' as never,
        decimals: 1, unit: 'bpm', recap: metrica(48.1, 49.0, 29), trend: 'down',
      },
    ],
    ratings: { sleep: metrica(3.72, 3.39, 30), day: metrica(4.0, 3.82, 30) },
    purchases: { count: VAZIO, spend: VAZIO, byCat: [] },
    adherence: null,
    sleep: null,
    sleepTriggers: null,
  } as RetroSummary;
}

const AGORA = new Date('2026-09-06T19:00:00');

/* ── a regra de edição ── */

describe('periodoFechado', () => {
  it('agosto está fechado em 6 de setembro', () => {
    assert.equal(periodoFechado('month', '2026-08-31', AGORA), true);
  });

  it('setembro NÃO está fechado em 6 de setembro', () => {
    assert.equal(periodoFechado('month', '2026-09-30', AGORA), false);
  });

  it('o último dia do período ainda é período aberto', () => {
    // Edição em curso até a virada: o dia 31 ainda pode render dado.
    assert.equal(periodoFechado('month', '2026-08-31', new Date('2026-08-31T23:59:00')), false);
    assert.equal(periodoFechado('month', '2026-08-31', new Date('2026-09-01T00:01:00')), true);
  });

  it("'all' nunca fecha — sempre cabe mais um dia", () => {
    assert.equal(periodoFechado('all', '2026-08-31', AGORA), false);
    assert.equal(periodoFechado('all', '1999-01-01', AGORA), false);
  });
});

/* ── cobertura ── */

describe('coberturaDe', () => {
  it('reprova 14 noites contra 27 — o caso que motivou o campo', () => {
    const c = coberturaDe(27, 31, 14, 31);
    assert.equal(c.comparavel, false, '27 × 14 é razão de 1,93× — não é comparação silenciosa');
  });

  it('aprova cobertura parelha e alta', () => {
    assert.equal(coberturaDe(29, 31, 28, 31).comparavel, true);
  });

  it('reprova quando um dos lados é ralo, mesmo parelho', () => {
    // 10/31 dos dois lados: razão 1×, mas nenhum dos lados tem 60%.
    assert.equal(coberturaDe(10, 31, 10, 31).comparavel, false);
  });

  it('reprova sem período anterior', () => {
    assert.equal(coberturaDe(30, 31, 0, 31).comparavel, false);
  });
});

/* ── montagem ── */

describe('montarPacote — agosto de 2026', () => {
  const p = montarPacote({
    resumo: agosto(),
    agora: AGORA,
    coberturaSono: { noites: 27, noitesAnterior: 14 },
    eventos: [{ dia: '2026-08-30', tipo: 'marco', rotulo: 'Meia maratona' }],
  });

  it('carrega versão e marca o período como fechado', () => {
    assert.equal(p.versao, PACOTE_VERSAO);
    assert.equal(p.periodo.fechado, true);
    assert.equal(p.periodo.diasNoPeriodo, 31);
  });

  it('converte metros em km e segundos em horas — a unidade em que se escreve', () => {
    const at = p.modulos.find((m) => m.modulo === 'atividade')!;
    const dist = at.metricas.find((f) => f.chave === 'distancia')!;
    assert.equal(dist.atual, 435);
    assert.equal(dist.anterior, 862);
    assert.equal(dist.unidade, 'km');

    const tempo = at.metricas.find((f) => f.chave === 'tempo')!;
    assert.equal(tempo.atual, 40.1);
    assert.equal(tempo.anterior, 68.2);
  });

  it('a manchete que a tela de hoje não sabe dizer está nos fatos', () => {
    const at = p.modulos.find((m) => m.modulo === 'atividade')!;
    const n = at.metricas.find((f) => f.chave === 'atividades')!;
    const d = at.metricas.find((f) => f.chave === 'distancia')!;
    // Mais atividades E metade dos quilômetros: os dois deltas, em sinais opostos.
    assert.ok(n.delta! > 0, 'agosto teve mais atividades');
    assert.ok(d.delta! < 0, 'e menos da metade dos quilômetros');
    assert.equal(d.deltaPct, -49.5);
  });

  it('a percepção andou mais que a medição — e os dois números estão no pacote', () => {
    const perc = p.modulos.find((m) => m.modulo === 'percepcao')!;
    const nota = perc.metricas.find((f) => f.chave === 'nota_sono')!;
    const saude = p.modulos.find((m) => m.modulo === 'saude')!;
    const sono = saude.metricas.find((f) => f.chave === 'sono')!;
    assert.equal(nota.atual, 3.72);
    assert.equal(sono.atual, 7.03);
    // ~9,7% contra ~2,0%: a razão de ~5× que vira manchete.
    assert.ok(nota.deltaPct! / sono.deltaPct! > 4);
  });

  it('a cobertura de sono obriga a ressalva', () => {
    const perc = p.modulos.find((m) => m.modulo === 'percepcao')!;
    assert.equal(perc.cobertura!.diasComDado, 27);
    assert.equal(perc.cobertura!.diasComDadoAnterior, 14);
    assert.equal(perc.cobertura!.comparavel, false);
    assert.deepEqual(ressalvasObrigatorias(p), ['Percepção']);
  });

  it('o evento sobrevive — sem ele a meia maratona vira corrida de 21 km', () => {
    assert.equal(p.eventos.length, 1);
    assert.equal(p.eventos[0].rotulo, 'Meia maratona');
  });

  it('não inventa módulo sem dado', () => {
    assert.equal(p.modulos.find((m) => m.modulo === 'registros'), undefined);
    assert.equal(p.modulos.find((m) => m.modulo === 'hábitos-bons'), undefined);
  });
});

/* ── introspecção: o alfabeto da verificação ── */

describe('numerosDoPacote', () => {
  const p = montarPacote({
    resumo: agosto(), agora: AGORA,
    coberturaSono: { noites: 27, noitesAnterior: 14 },
  });
  const nums = numerosDoPacote(p);

  it('autoriza todo número do parágrafo escrito à mão', () => {
    // §6 do spec — cada um destes aparece no texto de agosto.
    for (const n of ['21', '17', '435', '862', '40.1', '68.2', '8', '101', '3.72', '3.39', '4.00', '27', '14']) {
      assert.ok(nums.has(n), `o pacote deveria autorizar ${n}`);
    }
  });

  it('NÃO autoriza número que ninguém calculou', () => {
    assert.equal(nums.has('999'), false);
    assert.equal(nums.has('1234'), false);
  });

  it('autoriza o delta sem o sinal — é como se escreve', () => {
    // 435 − 862 = −427; o texto diria "427 km a menos".
    assert.ok(nums.has('427'));
  });
});

describe('período em curso', () => {
  it('setembro monta, mas vem marcado como aberto', () => {
    const s = agosto();
    const setembro = { ...s, label: 'Setembro', startISO: '2026-09-01', endISO: '2026-09-30' };
    const p = montarPacote({ resumo: setembro as RetroSummary, agora: AGORA });
    assert.equal(p.periodo.fechado, false, 'quem decide não gerar parágrafo é o chamador');
    assert.equal(p.periodo.diasNoPeriodo, 30);
  });
});
