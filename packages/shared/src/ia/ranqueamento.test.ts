import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RetroSummary, RetroHabitRow } from '../period/retro';
import { buildRetrospective } from '../period/retro';
import type { RecapValue, MetricRecap } from '../week/recap';
import type { CadernoId } from '../period/cadernos';
import { CADERNO_IDS } from '../period/cadernos';
import type { EntradaPacote, FatoLapide, PacoteDeFatos } from './pacote';
import { cadernoVazio, montarPacotes } from './pacote';
import { montarPrompt, montarPromptDaEdicao } from './prompt';
import {
  AMOSTRA_MINIMA, PESO_DA_BASE, liderDoCaderno, ordenarCadernos,
} from './ranqueamento';

/**
 * O ranqueamento do miolo — a matriz da Story 1.7, linha a linha.
 *
 * O teste é a FUNÇÃO, não o layout: dada uma edição, a ordem é determinística.
 * Cada `describe` abaixo é uma linha da matriz da spec, e a última parte — a
 * costura — prova que a ordem e o prompt concordam sobre quem está na edição,
 * porque os dois leem o mesmo `cadernoVazio`.
 */

/* ── fábricas ── */

function recap(current: number, prior: number): RecapValue {
  const delta = current - prior;
  return { current, prior, delta, deltaPct: prior !== 0 ? (delta / prior) * 100 : null };
}

function metrica(current: number, prior: number, n: number, nAnterior?: number): MetricRecap {
  const delta = current - prior;
  return {
    current, prior, delta, deltaPct: prior !== 0 ? (delta / prior) * 100 : null, n,
    ...(nAnterior != null ? { nAnterior } : {}),
  };
}

const VAZIO = recap(0, 0);
const AGORA = new Date('2026-10-06T12:00:00');

/**
 * Um esporte. `comDistancia` é quantas das sessões têm distância — explícito em
 * toda chamada, porque é a amostra da distância e não pode nascer por descuido
 * igual às sessões.
 */
function esporte(
  activityId: number, sessoes: RecapValue, comDistancia: RecapValue | undefined,
  distanciaM: RecapValue, segundos: RecapValue, elevacaoM: RecapValue,
) {
  return {
    activityId, sessions: sessoes, distanceM: distanciaM, movingS: segundos, elevationM: elevacaoM,
    calories: VAZIO, speedMps: { current: null, prior: null }, longest: null, bestEfforts: [],
    ...(comDistancia ? { sessionsWithDistance: comDistancia } : {}),
  };
}

/**
 * Um mês **neutro**: tudo se move pouco, e todo lado tem amostra de sobra.
 *
 * É o fundo contra o qual cada linha da matriz mexe numa coisa só. Afastamentos
 * ponderados do fundo, todos por B1 (peso ½): Movimento 2,65 (atividades +5,3%),
 * Sono 1,4 (nota +2,8%), Rotina 1,3 (tarefas +2,6%), Coração 1,0 (FC −2,0%).
 */
function mesNeutro(label: string, startISO: string, endISO: string): RetroSummary {
  return {
    kind: 'month', offset: -1, label, startISO, endISO,
    tasks: { total: recap(40, 39), byModule: [] },
    habits: { good: [], bad: [] },
    registros: [],
    fitness: {
      count: recap(20, 19),
      countWithDistance: recap(18, 18),
      distanceM: recap(400_000, 390_000),
      durationS: recap(144_000, 140_400),
      calories: VAZIO, hardMin: VAZIO,
      floors: recap(500, 490),
      steps: recap(310_000, 300_000),
      byType: [],
    },
    sports: {
      cycling: esporte(13, recap(10, 10), recap(10, 10), recap(300_000, 295_000), recap(72_000, 72_000), recap(2_000, 1_950)),
      running: esporte(37, recap(8, 8), recap(8, 8), recap(80_000, 78_000), recap(28_800, 28_800), recap(300, 300)),
    },
    health: [
      {
        metric: 'sono', label: 'Sono', higherIsWorse: false, icon: 'moon' as never,
        decimals: 2, unit: 'h', recap: metrica(7.0, 6.9, 28, 27), trend: 'flat',
      },
      {
        metric: 'fcRepouso', label: 'FC de repouso', higherIsWorse: true, icon: 'heart' as never,
        decimals: 1, unit: 'bpm', recap: metrica(48, 49, 29, 28), trend: 'flat',
      },
    ],
    ratings: { sleep: metrica(3.7, 3.6, 28, 27), day: metrica(4.0, 3.9, 30, 29) },
    purchases: { count: VAZIO, spend: VAZIO, byCat: [] },
    adherence: null, sleep: null, sleepTriggers: null,
  } as RetroSummary;
}

const JUNHO = () => mesNeutro('Junho 2026', '2026-06-01', '2026-06-30');
const JULHO = () => mesNeutro('Julho 2026', '2026-07-01', '2026-07-31');
const SETEMBRO = () => mesNeutro('Setembro 2026', '2026-09-01', '2026-09-30');

function habito(id: string, atual: number, anterior: number, createdOn?: string): RetroHabitRow {
  return {
    id, name: id, bad: false, unit: '',
    recap: recap(atual, anterior), total: recap(atual, anterior), perDay: 0, perDayDays: 0,
    ...(createdOn ? { createdOn } : {}),
  };
}

const comHabito = (r: RetroSummary, h: RetroHabitRow): RetroSummary => ({ ...r, habits: { good: [h], bad: [] } });
const semFc = (r: RetroSummary): RetroSummary => ({ ...r, health: r.health.filter((h) => h.metric !== 'fcRepouso') });

function edicao(resumo: RetroSummary, extra: Partial<EntradaPacote> = {}): PacoteDeFatos[] {
  return montarPacotes({
    resumo, agora: AGORA, coberturaSono: { noites: 28, noitesAnterior: 27 }, ...extra,
  });
}

function pacote(ps: readonly PacoteDeFatos[], id: CadernoId): PacoteDeFatos {
  const p = ps.find((x) => x.caderno === id);
  assert.ok(p, `o caderno ${id} sumiu da edição`);
  return p;
}

/** As quatro mortes reais de 2026 (07/09: troca de relógio, não cano quebrado). */
const MORTES: readonly FatoLapide[] = [
  { metrica: 'respiracao', ultimaMedidaISO: '2026-07-10' },
  { metrica: 'vo2max', ultimaMedidaISO: '2026-07-14' },
  { metrica: 'spo2', ultimaMedidaISO: '2026-07-16' },
  { metrica: 'aneis', ultimaMedidaISO: '2026-08-17' },
];

/** Um hábito velho que se moveu muito: +200% sobre 10 dias. Afastamento 100. */
const HABITO_FORTE = habito('corrida_matinal', 30, 10, '2025-01-10');

/* ── o fundo ── */

describe('o mês neutro — o fundo contra o qual a matriz mexe', () => {
  it('todo caderno disputa, e a ordem é a do afastamento ponderado', () => {
    const ps = edicao(JULHO());
    assert.deepEqual(ordenarCadernos(ps), ['movimento', 'sono', 'rotina', 'coracao']);
    assert.deepEqual(liderDoCaderno(pacote(ps, 'movimento')), { chave: 'atividades', base: 'B1', afastamento: 2.65 });
  });

  it('as constantes do contrato: N = 7, B1 vale meio, B2 e B3 valem um', () => {
    assert.equal(AMOSTRA_MINIMA, 7);
    assert.deepEqual({ ...PESO_DA_BASE }, { B1: 0.5, B2: 1, B3: 1 });
    assert.ok(Object.isFrozen(PESO_DA_BASE));
  });
});

/* ── as linhas da matriz ── */

describe('julho/2026 — VO₂max 14/07; respiração 10/07 e SpO₂ 16/07', () => {
  // Rotina tem o maior afastamento do mês (100) — é o que faz a lápide provar
  // alguma coisa: sem o passo 5, Rotina abriria a edição.
  const ps = edicao(comHabito(JULHO(), HABITO_FORTE), { lapides: MORTES });

  it('Movimento e Coração na frente, entre si pelo catálogo — e só depois quem disputa', () => {
    assert.deepEqual(ordenarCadernos(ps), ['movimento', 'coracao', 'rotina', 'sono']);
  });

  it('sem as lápides, Rotina abriria: a frente é do passo 5, não do afastamento', () => {
    assert.deepEqual(ordenarCadernos(edicao(comHabito(JULHO(), HABITO_FORTE)))[0], 'rotina');
  });

  it('entre os forçados manda o catálogo — mesmo com o Coração se afastando mais', () => {
    // FC 44 contra 52: −15,4%, afastamento 7,7 — bem acima dos 2,65 do Movimento.
    // Se os forçados se ordenassem pelo afastamento, o Coração abriria julho.
    const r = JULHO();
    const fcEmQueda = {
      ...r,
      health: [r.health[0], { ...r.health[1], recap: metrica(44, 52, 29, 28) }],
    } as RetroSummary;
    const forcados = edicao(fcEmQueda, { lapides: MORTES });
    assert.ok(
      liderDoCaderno(pacote(forcados, 'coracao'))!.afastamento
        > liderDoCaderno(pacote(forcados, 'movimento'))!.afastamento,
      'o fixture perdeu a premissa: o Coração tinha que se afastar mais',
    );
    assert.deepEqual(ordenarCadernos(forcados).slice(0, 2), ['movimento', 'coracao']);
  });

  it('VO₂max é de Movimento — pela rota única da métrica', () => {
    assert.deepEqual(pacote(ps, 'movimento').lapides.map((l) => l.metrica), ['vo2max']);
    assert.deepEqual(pacote(ps, 'coracao').lapides.map((l) => l.metrica), ['respiracao', 'spo2']);
  });

  it('lápide posterior: os anéis de 17/08 ficam fora do pacote de julho', () => {
    assert.equal(ps.some((p) => p.lapides.some((l) => l.metrica === 'aneis')), false);
  });
});

/*
 * AGOSTO/2026 — o fixture real (o mesmo de `pacote.test.ts`, dado de produção
 * consultado em 06/09/2026) mais a morte dos anéis em 17/08.
 */
function agostoReal(): RetroSummary {
  return {
    kind: 'month', offset: -1, label: 'Agosto', startISO: '2026-08-01', endISO: '2026-08-31',
    tasks: { total: recap(0, 0), byModule: [] },
    habits: { good: [], bad: [] },
    registros: [],
    fitness: {
      count: recap(21, 17), distanceM: recap(435_000, 862_000), durationS: recap(144_360, 245_520),
      calories: VAZIO, hardMin: VAZIO, floors: recap(539, 500), steps: recap(537_847, 500_000), byType: [],
    },
    // As sessões com distância, dos dois lados, conferidas em produção em 11/09;
    // o total de atividades com distância não foi consultado e fica de fora. A
    // origem de cada número está no mesmo fixture em `pacote.test.ts`.
    sports: {
      cycling: esporte(13, recap(7, 11), recap(7, 11), recap(333_000, 820_000), recap(81_720, 190_000), recap(0, 0)),
      running: esporte(37, recap(8, 2), recap(8, 2), recap(101_000, 21_000), recap(41_040, 8_640), recap(0, 0)),
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
    adherence: null, sleep: null, sleepTriggers: null,
  } as RetroSummary;
}

describe('agosto/2026 — o fixture real, mais os anéis em 17/08', () => {
  const entrada: EntradaPacote = {
    resumo: agostoReal(), agora: AGORA,
    coberturaSono: { noites: 27, noitesAnterior: 14 },
    lapides: [{ metrica: 'aneis', ultimaMedidaISO: '2026-08-17' }],
  };
  const ps = montarPacotes(entrada);
  const movimento = pacote(ps, 'movimento');
  const fato = (chave: string) => movimento.metricas.find((f) => f.chave === chave);

  it('Movimento abre — e abriria mesmo sem a lápide', () => {
    assert.deepEqual(ordenarCadernos(ps), ['movimento', 'sono', 'coracao', 'rotina']);
    assert.equal(ordenarCadernos(montarPacotes({ ...entrada, lapides: [] }))[0], 'movimento');
  });

  it('a métrica líder é `ciclismo.distancia`, com amostra 7 — 333 km contra 820', () => {
    assert.equal(fato('ciclismo.distancia')?.amostra, 7);
    assert.deepEqual(liderDoCaderno(movimento), { chave: 'ciclismo.distancia', base: 'B1', afastamento: 29.7 });
  });

  it('a corrida de +381% não lidera: o lado de julho tem 2 saídas', () => {
    const corrida = fato('corrida.distancia');
    assert.equal(corrida?.bases[0].deltaPct, 381);
    assert.equal(corrida?.amostra, 2);
    // Sem o portão ela seria a manchete com folga: 381 × ½ = 190,5 contra 29,7.
    assert.ok(Math.abs(corrida!.bases[0].deltaPct!) * PESO_DA_BASE.B1 > liderDoCaderno(movimento)!.afastamento);
  });

  it('Sono fica atrás pela cobertura — 27 noites contra 14 —, mesmo com amostra de sobra', () => {
    // `nAnterior` não existia quando o agosto real foi capturado; aqui ele entra
    // alto de propósito, para isolar o portão de cobertura do da amostra.
    const r = agostoReal();
    const comDias = montarPacotes({
      ...entrada,
      resumo: {
        ...r,
        health: [{ ...r.health[0], recap: { ...r.health[0].recap, nAnterior: 25 } }, r.health[1]],
        ratings: { ...r.ratings, sleep: { ...r.ratings.sleep!, nAnterior: 30 } },
      } as RetroSummary,
    });
    const sono = pacote(comDias, 'sono');
    assert.ok(sono.metricas.every((f) => f.amostra != null && f.amostra >= AMOSTRA_MINIMA));
    assert.equal(sono.cobertura?.comparavel, false);
    assert.equal(liderDoCaderno(sono), null);
  });
});

describe('setembro/2026 — as quatro lápides, nenhuma no período', () => {
  const ps = edicao(comHabito(SETEMBRO(), HABITO_FORTE), { lapides: MORTES });

  it('ninguém é forçado: a ordem é a mesma que sem lápide nenhuma', () => {
    assert.deepEqual(ordenarCadernos(ps), ['rotina', 'movimento', 'sono', 'coracao']);
    assert.deepEqual(ordenarCadernos(ps), ordenarCadernos(edicao(comHabito(SETEMBRO(), HABITO_FORTE))));
  });

  it('as lápides continuam no pacote — como antigas, no pé', () => {
    assert.equal(pacote(ps, 'movimento').lapides.length, 2);
    assert.equal(pacote(ps, 'coracao').lapides.length, 2);
  });
});

describe('só lápide antiga — Coração sem dado, as lápides de julho, em setembro', () => {
  const ps = edicao(semFc(SETEMBRO()), { lapides: MORTES });
  const coracao = pacote(ps, 'coracao');

  it('Coração fora da lista', () => {
    assert.deepEqual(coracao.metricas, []);
    assert.equal(coracao.lapides.length, 2, 'as lápides estão lá — e não ressuscitam nada');
    assert.equal(ordenarCadernos(ps).includes('coracao'), false);
    assert.deepEqual(ordenarCadernos(ps), ['movimento', 'sono', 'rotina']);
  });

  it('e o prompt mudo — nos dois grãos', () => {
    assert.equal(montarPrompt(coracao).usuario, '');
    const edicaoInteira = montarPromptDaEdicao(ps).usuario;
    assert.equal(edicaoInteira.includes('### Coração'), false);
    assert.equal(edicaoInteira.includes('saturação de oxigênio'), false);
  });
});

describe('só lápide do período — Coração sem métrica, em julho', () => {
  const ps = edicao(semFc(JULHO()), {
    lapides: MORTES.filter((l) => l.metrica === 'respiracao' || l.metrica === 'spo2'),
  });
  const coracao = pacote(ps, 'coracao');

  it('Coração presente e forçado — à frente de quem disputa', () => {
    assert.deepEqual(coracao.metricas, []);
    assert.deepEqual(ordenarCadernos(ps), ['coracao', 'movimento', 'sono', 'rotina']);
  });

  it('sem métrica, não há líder: quem lidera é a lápide, e `metrica_lider` fica para a 1.9 decidir', () => {
    assert.equal(liderDoCaderno(coracao), null);
  });

  it('o prompt NÃO é mudo, e diz a morte', () => {
    const { usuario } = montarPrompt(coracao);
    assert.notEqual(usuario, '');
    assert.ok(usuario.includes('- saturação de oxigênio parou de chegar em 16 de julho de 2026 — neste período.'));
    assert.match(montarPromptDaEdicao(ps).usuario, /^### Coração$/m);
  });
});

describe('Rotina nova — hábitos criados em 20/05, 11 → 26 dias em junho', () => {
  // O caso que aconteceu: junho/2026 abriria com "Café +136%".
  const ps = edicao(comHabito(JUNHO(), habito('cafe', 26, 11, '2026-05-20')));

  it('Rotina não lidera: o café não passa no portão de nascimento', () => {
    const ordem = ordenarCadernos(ps);
    assert.notEqual(ordem[0], 'rotina');
    assert.deepEqual(ordem, ['movimento', 'sono', 'rotina', 'coracao']);
    assert.notEqual(liderDoCaderno(pacote(ps, 'rotina'))?.chave, 'habito.cafe');
  });

  it('não é a amostra que barra — 11 passa no N; é o caderno novo', () => {
    const cafe = pacote(ps, 'rotina').metricas.find((f) => f.chave === 'habito.cafe');
    assert.ok(cafe && cafe.amostra != null && cafe.amostra >= AMOSTRA_MINIMA);
    assert.equal(cafe.comparavel, false);
  });
});

describe('gasto sem base — 8 compras, só 1 com preço (revisão 2)', () => {
  // € 1 em maio sobre 8 compras com preço; € 18,80 em junho sobre 1 com preço e
  // 7 sem. Pela régua da contagem de compras, "gasto +1780%" teria amostra 8 e
  // afastamento 890 — a maior manchete da edição, apoiada numa compra.
  const ps = edicao({
    ...JUNHO(),
    purchases: { count: recap(8, 8), spend: recap(18.8, 1), countWithPrice: recap(1, 8), byCat: [] },
  } as RetroSummary);

  it('o gasto não disputa, e Rotina não abre por ele', () => {
    const gasto = pacote(ps, 'rotina').metricas.find((f) => f.chave === 'gasto');
    assert.equal(gasto?.bases[0].deltaPct, 1780);
    assert.equal(gasto?.amostra, 1);
    assert.notEqual(liderDoCaderno(pacote(ps, 'rotina'))?.chave, 'gasto');
    assert.equal(ordenarCadernos(ps)[0], 'movimento');
  });
});

describe('Rotina legítima — hábito antigo, 20 → 30 dias, o maior afastamento', () => {
  const ps = edicao(comHabito(JUNHO(), habito('cafe', 30, 20, '2025-01-10')));

  it('Rotina lidera: o portão é portão, não proibição', () => {
    assert.deepEqual(ordenarCadernos(ps), ['rotina', 'movimento', 'sono', 'coracao']);
    assert.deepEqual(liderDoCaderno(pacote(ps, 'rotina')), { chave: 'habito.cafe', base: 'B1', afastamento: 25 });
  });
});

describe('a fronteira do N — amostra 7 disputa, amostra 6 não', () => {
  const com = (anterior: number) => edicao(comHabito(JUNHO(), habito('cafe', 14, anterior, '2025-01-10')));

  it('7 contra 14: disputa, e lidera', () => {
    const ps = com(7);
    assert.equal(liderDoCaderno(pacote(ps, 'rotina'))?.chave, 'habito.cafe');
    assert.equal(ordenarCadernos(ps)[0], 'rotina');
  });

  it('6 contra 14: não disputa — e o afastamento dela era ainda maior', () => {
    const ps = com(6);
    const rotina = pacote(ps, 'rotina');
    assert.equal(rotina.metricas.find((f) => f.chave === 'habito.cafe')?.amostra, 6);
    assert.notEqual(liderDoCaderno(rotina)?.chave, 'habito.cafe');
    assert.equal(ordenarCadernos(ps)[0], 'movimento');
  });
});

describe('a confiança — B3 −10% e B1 −60% no mesmo fato', () => {
  // 450 km contra 1.125 no mês anterior (−60%) e contra 500 na normal (−10%).
  // Rotina, ao lado, com 25 de afastamento: fica entre os dois candidatos.
  const resumo = comHabito(
    {
      ...JULHO(),
      sports: {
        ...JULHO().sports,
        cycling: esporte(13, recap(10, 10), recap(10, 10), recap(450_000, 1_125_000), recap(72_000, 72_000), recap(2_000, 1_950)),
      },
    } as RetroSummary,
    habito('cafe', 30, 20, '2025-01-10'),
  );
  const ps = edicao(resumo, { bases: { 'ciclismo.distancia': { B3: { valor: 500 } } } });
  const movimento = pacote(ps, 'movimento');

  it('o fato usa a B3 (10), não a B1 (30) — a mais confiável, nunca a maior', () => {
    const f = movimento.metricas.find((x) => x.chave === 'ciclismo.distancia');
    assert.equal(f?.bases[0].deltaPct, -60);
    assert.equal(f?.bases[2].deltaPct, -10);
    assert.deepEqual(liderDoCaderno(movimento), { chave: 'ciclismo.distancia', base: 'B3', afastamento: 10 });
  });

  it('e isso muda a ordem: Rotina (25) passa à frente do Movimento (10)', () => {
    assert.deepEqual(ordenarCadernos(ps).slice(0, 2), ['rotina', 'movimento']);
  });

  /*
   * A B2 NA ORDEM DE CONFIANÇA — B3, depois B2, depois B1.
   *
   * Sem estas duas linhas nenhum teste passava B2, e a ordem inteira da
   * confiança ficava solta: `['B2','B3','B1']`, `['B3','B1','B2']` e
   * `['B3','B1']` deixavam a suíte verde. A primeira pega a B2 no lugar da B3; a
   * segunda e a terceira, a B1 no lugar da B2.
   */
  it('B2 −40% e B1 −60%, sem B3: responde a B2 — 40, e não os 30 da B1 × ½', () => {
    // 450 km contra 750 no mesmo mês do ano passado: −40%.
    const semB3 = edicao(resumo, { bases: { 'ciclismo.distancia': { B2: { valor: 750 } } } });
    const f = pacote(semB3, 'movimento').metricas.find((x) => x.chave === 'ciclismo.distancia');
    assert.deepEqual(f?.bases.map((b) => b.deltaPct), [-60, -40, null]);
    assert.deepEqual(liderDoCaderno(pacote(semB3, 'movimento')), {
      chave: 'ciclismo.distancia', base: 'B2', afastamento: 40,
    });
  });

  it('B3 −10%, B2 −40% e B1 −60%: responde a B3 — 10, a mais confiável das três', () => {
    const tres = edicao(resumo, { bases: { 'ciclismo.distancia': { B2: { valor: 750 }, B3: { valor: 500 } } } });
    const f = pacote(tres, 'movimento').metricas.find((x) => x.chave === 'ciclismo.distancia');
    assert.deepEqual(f?.bases.map((b) => b.deltaPct), [-60, -40, -10]);
    assert.deepEqual(liderDoCaderno(pacote(tres, 'movimento')), {
      chave: 'ciclismo.distancia', base: 'B3', afastamento: 10,
    });
  });

  /*
   * A BASE MAIS CONFIÁVEL QUE O FATO **TEM** — "tem" é ter percentual. B3 que
   * existe mas não tem `deltaPct` (a normal é zero, ou não foi medida) não
   * responde pelo fato; responde a próxima que tem.
   */
  for (const [caso, b3] of [
    ['a normal é zero (percentual indefinido)', { valor: 0 }],
    ['a normal existe e não foi medida', { valor: null }],
  ] as const) {
    it(`B3 sem percentual — ${caso}: quem responde é a B1`, () => {
      const semPct = edicao(resumo, { bases: { 'ciclismo.distancia': { B3: b3 } } });
      const f = pacote(semPct, 'movimento').metricas.find((x) => x.chave === 'ciclismo.distancia');
      assert.equal(f?.bases[2].existe, true);
      assert.equal(f?.bases[2].deltaPct, null);
      // −60% contra o mês anterior, com o peso da B1: 30. Sem o recuo, o fato
      // ficaria sem afastamento e o Movimento, sem líder de distância.
      assert.deepEqual(liderDoCaderno(pacote(semPct, 'movimento')), {
        chave: 'ciclismo.distancia', base: 'B1', afastamento: 30,
      });
      assert.deepEqual(ordenarCadernos(semPct).slice(0, 2), ['movimento', 'rotina']);
    });
  }
});

/*
 * DISTÂNCIA SEM BASE — a linha que a iteração 1 trouxe (Spec Change Log).
 *
 * Medido em produção: fevereiro/2026 teve 8 atividades e só 2 com distância. A
 * primeira versão contava as 8 como amostra da distância, e o "+971%" de março
 * passava no portão apoiado em 2 pedaladas. A amostra conta observações QUE
 * CARREGAM A MEDIDA.
 */
describe('distância sem base — fev → mar/2026: 8 → 24 atividades, 2 → 17 com distância', () => {
  const r = mesNeutro('Março 2026', '2026-03-01', '2026-03-31');
  const marco = {
    ...r,
    fitness: {
      ...r.fitness,
      count: recap(24, 8), countWithDistance: recap(17, 2),
      distanceM: recap(535_000, 50_000),        // +970%: a manchete que mentia
      durationS: recap(108_000, 43_200),        // 30 h contra 12 h: +150%
    },
    sports: {
      cycling: esporte(13, recap(12, 1), recap(12, 1), recap(420_000, 40_000), recap(64_800, 5_400), recap(3_000, 200)),
      running: esporte(37, recap(5, 1), recap(5, 1), recap(50_000, 10_000), recap(18_000, 3_600), recap(100, 20)),
    },
  } as RetroSummary;
  const ps = edicao(marco);
  const movimento = pacote(ps, 'movimento');
  const distancia = movimento.metricas.find((f) => f.chave === 'distancia');

  it('a distância não disputa: o lado de fevereiro tem 2 atividades com distância', () => {
    assert.equal(distancia?.amostra, 2);
    assert.equal(distancia?.bases[0].deltaPct, 970);
    // Pela régua da iteração 0 (a amostra das 8 atividades) ela seria a manchete
    // com folga: 970 × ½ = 485 contra os 100 das atividades.
    assert.ok(Math.abs(distancia!.bases[0].deltaPct!) * PESO_DA_BASE.B1 > 100);
  });

  it('Movimento lidera por `atividades` — a mesma história, sobre base honesta', () => {
    assert.equal(ordenarCadernos(ps)[0], 'movimento');
    assert.deepEqual(liderDoCaderno(movimento), { chave: 'atividades', base: 'B1', afastamento: 100 });
  });

  it('o tempo continua com a amostra das atividades — toda atividade tem tempo', () => {
    assert.equal(movimento.metricas.find((f) => f.chave === 'tempo')?.amostra, 8);
  });
});

describe('elevação — qualquer variação, nunca disputa', () => {
  const casos: ReadonlyArray<readonly [string, number, number]> = [
    ['a rota que não sincronizou: 2.000 m → 0, −100%', 2_000, 0],
    ['subida real de +4.900%', 100, 5_000],
    ['estável', 2_000, 2_000],
  ];
  for (const [nome, antes, depois] of casos) {
    it(nome, () => {
      const r = JULHO();
      const ps = edicao({
        ...r,
        sports: {
          ...r.sports,
          cycling: esporte(13, recap(10, 10), recap(10, 10), recap(300_000, 295_000), recap(72_000, 72_000), recap(depois, antes)),
        },
      } as RetroSummary);
      const movimento = pacote(ps, 'movimento');
      for (const k of ['ciclismo.elevacao', 'corrida.elevacao']) {
        assert.equal(movimento.metricas.find((f) => f.chave === k)?.amostra, null, k);
      }
      assert.equal(liderDoCaderno(movimento)?.chave, 'atividades', 'a elevação tomou a liderança');
    });
  }
});

describe('lápide no último dia do período — ainda é do período', () => {
  const com = (dia: string) => edicao(semFc(JULHO()), { lapides: [{ metrica: 'spo2', ultimaMedidaISO: dia }] });

  it('a de 31/07 fica no pacote de julho e força o Coração', () => {
    const ps = com('2026-07-31');
    assert.deepEqual(pacote(ps, 'coracao').lapides.map((l) => l.metrica), ['spo2']);
    assert.equal(ordenarCadernos(ps)[0], 'coracao');
  });

  it('a de 01/07 também — os dois extremos são do período', () => {
    assert.equal(ordenarCadernos(com('2026-07-01'))[0], 'coracao');
  });

  it('a de 01/08 fica fora de julho, e o Coração sem ela é vazio', () => {
    const ps = com('2026-08-01');
    assert.deepEqual(pacote(ps, 'coracao').lapides, []);
    assert.equal(ordenarCadernos(ps).includes('coracao'), false);
  });
});

/*
 * O CADERNO VAZIO COM A FORMA QUE O CELULAR MANDA.
 *
 * As fixtures acima esvaziam Coração tirando a linha de FC do resumo. O celular
 * não faz isso: ele manda SEMPRE as três linhas de saúde da retro
 * (`mobile/src/store/retro.store.ts`, `HEALTH_SPECS`: sono, vfc, fcRepouso), e o
 * mês sem medida chega com as linhas presentes e todo `atual` nulo. É essa a
 * forma que `semDado` tem que ler — um `semDado` que olhasse "não há linha" em
 * vez de "não há valor" passava em todas as outras fixtures.
 */
describe('o caderno vazio com a forma que o celular manda — linhas presentes, sem valor', () => {
  const HEALTH_SPECS_DO_CELULAR = [
    { metric: 'sono', label: 'Sono', higherIsWorse: false, icon: 'sleep' as never, decimals: 1, unit: 'h' },
    { metric: 'vfc', label: 'VFC', higherIsWorse: false, icon: 'hrv' as never, decimals: 0, unit: ' ms' },
    { metric: 'fcRepouso', label: 'FC repouso', higherIsWorse: true, icon: 'heart' as never, decimals: 0, unit: ' bpm' },
  ];
  const agostoInteiro = Array.from({ length: 31 }, (_, i) => `2026-08-${String(i + 1).padStart(2, '0')}`);
  // Setembro/2026 sem uma medida; agosto com todas — o relógio parou na virada.
  const resumo = buildRetrospective({
    now: new Date('2026-10-06T12:00:00'),
    kind: 'month',
    offset: -1,
    activities: [],
    health: HEALTH_SPECS_DO_CELULAR.map((h) => ({ ...h, valuesByDay: new Map(agostoInteiro.map((d) => [d, 50])) })),
    habits: [], registros: [], tasks: [], purchases: [],
  });
  const ps = montarPacotes({ resumo, agora: AGORA });

  it('as linhas estão lá, todas com `atual` nulo e com o valor de agosto na B1', () => {
    assert.equal(resumo.label, 'Setembro 2026', 'o fixture caiu em outro mês');
    const coracao = pacote(ps, 'coracao');
    assert.deepEqual(coracao.metricas.map((f) => f.chave), ['vfc', 'fcRepouso']);
    for (const f of [...coracao.metricas, ...pacote(ps, 'sono').metricas]) {
      assert.equal(f.atual, null, f.chave);
      assert.equal(f.bases[0].valor, 50, `${f.chave}: a base de agosto é história, e fica no pacote`);
    }
  });

  it('Coração e Sono são vazios: fora da ordem, prompt mudo, sem bloco na edição', () => {
    const ordem = ordenarCadernos(ps);
    const edicaoInteira = montarPromptDaEdicao(ps).usuario;
    for (const id of ['coracao', 'sono'] as const) {
      const p = pacote(ps, id);
      assert.ok(p.metricas.length > 0, `${id}: o fixture perdeu as linhas`);
      assert.equal(cadernoVazio(p), true, `${id}: linhas sem valor não são conteúdo`);
      assert.equal(ordem.includes(id), false, `${id} entrou na ordem`);
      assert.equal(montarPrompt(p).usuario, '', `${id}: prompt não mudo`);
      assert.equal(new RegExp(`^### ${p.rotulo}$`, 'm').test(edicaoInteira), false, `${id}: bloco na edição`);
    }
    assert.deepEqual(ordem, ['movimento', 'rotina']);
  });
});

/* ── a entrada ── */

function congelar<T>(x: T): T {
  if (x && typeof x === 'object' && !Object.isFrozen(x)) {
    Object.freeze(x);
    for (const v of Object.values(x)) congelar(v);
  }
  return x;
}

function permutacoes<T>(xs: readonly T[]): T[][] {
  if (xs.length <= 1) return [[...xs]];
  return xs.flatMap((x, i) => permutacoes([...xs.slice(0, i), ...xs.slice(i + 1)]).map((r) => [x, ...r]));
}

describe('a entrada — ordem, mutação e validade', () => {
  it('as 24 permutações, com tudo congelado, dão a mesma ordem — e nada muda', () => {
    const ps = edicao(comHabito(JULHO(), HABITO_FORTE), { lapides: MORTES });
    const esperado = ordenarCadernos(ps);
    const antes = JSON.stringify(ps);
    congelar(ps);
    const todas = permutacoes(ps);
    assert.equal(todas.length, 24);
    for (const p of todas) assert.deepEqual(ordenarCadernos(p), esperado, p.map((x) => x.caderno).join(','));
    for (const p of ps) liderDoCaderno(p);
    assert.equal(JSON.stringify(ps), antes);
  });

  it('caderno repetido explode', () => {
    const ps = edicao(JULHO());
    assert.throws(() => ordenarCadernos([...ps, ps[0]]), /caderno repetido/);
  });

  it('períodos diferentes na mesma edição explodem', () => {
    const julho = edicao(JULHO());
    const setembro = edicao(SETEMBRO());
    assert.throws(() => ordenarCadernos([julho[0], setembro[1]]), /mistura períodos/);
  });

  /*
   * AS TRÊS COORDENADAS DO PERÍODO, uma de cada vez.
   *
   * Julho contra setembro difere em tudo — início e fim —, e por isso não prende
   * nenhuma das três comparações de `validar`: tirar só a do tipo, ou só a do
   * fim, deixava a suíte verde. Cada caso abaixo difere numa coordenada só.
   */
  it('mesmo início, tipo diferente: o mês de julho contra o trimestre que começa em 01/07', () => {
    const julho = edicao(JULHO());
    const trimestre = edicao({ ...mesNeutro('Q3 2026', '2026-07-01', '2026-09-30'), kind: 'season' } as RetroSummary);
    assert.equal(trimestre[1].periodo.inicioISO, julho[0].periodo.inicioISO);
    assert.throws(() => ordenarCadernos([julho[0], trimestre[1]]), /mistura períodos/);
  });

  it('mesmo início e mesmo fim, tipo diferente — o único caso que só a comparação do tipo pega', () => {
    // O mês e o trimestre acima também diferem no fim, e a comparação do fim os
    // separaria sozinha. Datas idênticas com tipos diferentes só existem em
    // pacote montado à mão — e é exatamente o que a validação existe para barrar.
    const julho = edicao(JULHO());
    const outroTipo: PacoteDeFatos = { ...julho[1], periodo: { ...julho[1].periodo, tipo: 'season' } };
    assert.throws(() => ordenarCadernos([julho[0], outroTipo]), /mistura períodos/);
  });

  it('mesmo tipo e mesmo início, fim diferente', () => {
    const julho = edicao(JULHO());
    const julhoCurto = edicao(mesNeutro('Julho 2026', '2026-07-01', '2026-07-30'));
    assert.equal(julhoCurto[1].periodo.tipo, julho[0].periodo.tipo);
    assert.equal(julhoCurto[1].periodo.inicioISO, julho[0].periodo.inicioISO);
    assert.throws(() => ordenarCadernos([julho[0], julhoCurto[1]]), /mistura períodos/);
  });

  it('caderno fora do catálogo explode — a lua não é caderno', () => {
    const [p] = edicao(JULHO());
    assert.throws(() => ordenarCadernos([{ ...p, caderno: 'lua' as never }]), /caderno desconhecido: lua/);
  });

  /*
   * PACOTE MONTADO À MÃO COM LÁPIDE ERRADA — a validação é a mesma no
   * ranqueamento e nos dois grãos do prompt (`validarLapides`, dono único).
   * Antes, cada defeito falhava longe da causa: métrica fora do catálogo era
   * erro de tipo opaco no prompt; lápide posterior saía como "antes deste
   * período"; lápide de outro caderno forçava o caderno errado para a frente.
   */
  const LAPIDES_ERRADAS: ReadonlyArray<readonly [string, CadernoId, FatoLapide, RegExp]> = [
    ['métrica fora do catálogo', 'coracao', { metrica: 'vfc' as never, ultimaMedidaISO: '2026-07-16' }, /fora do catálogo: vfc/],
    ['data impossível', 'coracao', { metrica: 'spo2', ultimaMedidaISO: '2026-13-01' }, /data impossível/],
    ['posterior ao fim', 'coracao', { metrica: 'spo2', ultimaMedidaISO: '2026-08-17' }, /posterior ao fim do período/],
    ['no caderno de outra', 'coracao', { metrica: 'vo2max', ultimaMedidaISO: '2026-07-14' }, /mas ela é do caderno movimento/],
  ];
  for (const [nome, caderno, lapide, mensagem] of LAPIDES_ERRADAS) {
    it(`lápide ${nome}: o ranqueamento e os dois prompts explodem com a mesma mensagem clara`, () => {
      const ps = edicao(JULHO()).map((p) => (p.caderno === caderno ? { ...p, lapides: [lapide] } : p));
      const errado = ps.find((p) => p.caderno === caderno)!;
      const clara = (e: unknown) => e instanceof Error && !(e instanceof TypeError) && mensagem.test(e.message);
      assert.throws(() => ordenarCadernos(ps), clara, 'ordenarCadernos');
      assert.throws(() => montarPrompt(errado), clara, 'montarPrompt');
      assert.throws(() => montarPromptDaEdicao(ps), clara, 'montarPromptDaEdicao');
    });
  }

  /*
   * A MESMA PARIDADE NO CADERNO VAZIO.
   *
   * O loop acima injeta a lápide num Coração com FC — um caderno que o prompt
   * renderiza de qualquer jeito. O vazio é o caso que importa: o prompt o pula,
   * e se a validação viesse DEPOIS do filtro do vazio, o pacote inválido
   * passaria calado pelos dois grãos e explodiria só no ranqueamento. Só as
   * variantes com data FORA de julho servem aqui: dentro, a lápide seria do
   * período e o caderno deixaria de ser vazio.
   */
  const mensagemDe = (fn: () => unknown): string => {
    try {
      fn();
    } catch (e) {
      assert.ok(e instanceof Error && !(e instanceof TypeError), `erro opaco: ${String(e)}`);
      return e.message;
    }
    return assert.fail('não explodiu');
  };
  const LAPIDES_ERRADAS_NO_VAZIO: ReadonlyArray<readonly [string, FatoLapide, RegExp]> = [
    ['posterior ao fim', { metrica: 'spo2', ultimaMedidaISO: '2026-08-17' }, /posterior ao fim do período/],
    ['de outro caderno, com data antiga', { metrica: 'vo2max', ultimaMedidaISO: '2026-06-14' }, /mas ela é do caderno movimento/],
    ['do mês 13', { metrica: 'spo2', ultimaMedidaISO: '2026-13-01' }, /data impossível/],
  ];
  for (const [nome, lapide, mensagem] of LAPIDES_ERRADAS_NO_VAZIO) {
    it(`lápide ${nome} num Coração VAZIO: a mesma mensagem no ranqueamento e nos dois prompts`, () => {
      const ps = edicao(semFc(JULHO())).map((p) => (p.caderno === 'coracao' ? { ...p, lapides: [lapide] } : p));
      const vazio = ps.find((p) => p.caderno === 'coracao')!;
      // A premissa, sem a qual o teste mede o loop de cima de novo.
      assert.deepEqual(vazio.metricas.filter((f) => f.atual != null), []);
      assert.equal(vazio.semDado, true);
      assert.equal(vazio.cobertura, null);
      assert.deepEqual([vazio.lacunas, vazio.eventos, vazio.correlacoes], [[], [], []]);
      assert.equal(cadernoVazio(vazio), true, 'o Coração não está vazio — a lápide caiu dentro de julho?');
      const mensagens = [
        mensagemDe(() => ordenarCadernos(ps)),
        mensagemDe(() => montarPrompt(vazio)),
        mensagemDe(() => montarPromptDaEdicao(ps)),
      ];
      assert.match(mensagens[0], mensagem);
      assert.deepEqual(new Set(mensagens).size, 1, `mensagens diferentes: ${mensagens.join(' | ')}`);
    });
  }

  it('a edição sem caderno nenhum não tem ordem — e não explode', () => {
    assert.deepEqual(ordenarCadernos([]), []);
  });

  it('uma edição parcial ordena só os cadernos que tem', () => {
    const ps = edicao(JULHO());
    assert.deepEqual(ordenarCadernos(ps.filter((p) => p.caderno !== 'movimento')), ['sono', 'rotina', 'coracao']);
  });
});

/* ── a costura: a ordem e o prompt concordam sobre quem está na edição ── */

/**
 * Todas as edições desta suíte, mais as formas que só existem nas bordas: o
 * caderno que só tem lacuna, o que só tem evento, o que só tem correlação, o que
 * só tem cobertura, e a edição inteira de vazios.
 */
function fixtures(): Array<[string, PacoteDeFatos[]]> {
  const soSono = (extra: Partial<EntradaPacote>): PacoteDeFatos[] => montarPacotes({
    resumo: { ...semFc(SETEMBRO()), health: [], ratings: { sleep: null, day: SETEMBRO().ratings.day } } as RetroSummary,
    agora: AGORA,
    ...extra,
  });
  const vazio = soSono({}).find((p) => p.caderno === 'sono');
  assert.ok(vazio && cadernoVazio(vazio), 'o Sono sem noite nenhuma devia ser vazio');
  return [
    ['mês neutro', edicao(JULHO())],
    ['julho', edicao(comHabito(JULHO(), HABITO_FORTE), { lapides: MORTES })],
    ['agosto real', montarPacotes({
      resumo: agostoReal(), agora: AGORA, coberturaSono: { noites: 27, noitesAnterior: 14 },
      lapides: [{ metrica: 'aneis', ultimaMedidaISO: '2026-08-17' }],
    })],
    ['agosto do celular', montarPacotes({ resumo: agostoReal(), agora: AGORA })],
    ['setembro', edicao(comHabito(SETEMBRO(), HABITO_FORTE), { lapides: MORTES })],
    ['só lápide antiga', edicao(semFc(SETEMBRO()), { lapides: MORTES })],
    ['só lápide do período', edicao(semFc(JULHO()), { lapides: MORTES.slice(0, 3) })],
    ['rotina nova', edicao(comHabito(JUNHO(), habito('cafe', 26, 11, '2026-05-20')))],
    ['sono vazio, lápides antigas', soSono({ lapides: MORTES })],
    ['sono só com lacuna', soSono({ lacunas: [{ caderno: 'sono', diasSemDado: 30, motivo: 'relógio sem carga' }] })],
    ['sono só com evento', soSono({ eventos: [{ dia: '2026-09-12', tipo: 'atipico', rotulo: 'Noite em claro', caderno: 'sono' }] })],
    ['sono só com correlação', soSono({
      correlacoes: [{
        gatilho: 'cerveja', rotulo: 'cerveja',
        impacto: { metric: 'sono', withMean: 6, withoutMean: 7, delta: -1, deltaPct: -14.3, nWith: 2, nWithout: 20, enough: false },
      }],
    })],
    ['sono só com cobertura', soSono({ coberturaSono: { noites: 3, noitesAnterior: 27 } })],
    ['edição só de vazios', [vazio]],
  ];
}

describe('a costura — `ordenarCadernos`, `montarPrompt` e `montarPromptDaEdicao` leem o mesmo vazio', () => {
  const temBloco = (usuario: string, rotulo: string) => new RegExp(`^### ${rotulo}$`, 'm').test(usuario);

  /*
   * A ACEITAÇÃO: todo caderno da saída tem prompt não vazio e bloco na edição,
   * e nenhum outro tem. É a mesma função decidindo o passo 6 e o prompt mudo —
   * se alguém trocar uma delas por um critério próprio, a costura abre aqui.
   */
  for (const [nome, ps] of fixtures()) {
    it(`${nome}: quem está na ordem é exatamente quem tem prompt e bloco`, () => {
      const ordem = ordenarCadernos(ps);
      const daEdicao = montarPromptDaEdicao(ps).usuario;
      for (const p of ps) {
        const naOrdem = ordem.includes(p.caderno);
        assert.equal(montarPrompt(p).usuario !== '', naOrdem, `${p.caderno}: ordem e prompt do caderno discordam`);
        assert.equal(temBloco(daEdicao, p.rotulo), naOrdem, `${p.caderno}: ordem e bloco da edição discordam`);
      }
      assert.equal(daEdicao === '', ordem.length === 0, 'a edição muda é a edição sem ordem');
    });
  }

  it('as fixtures cobrem os dois lados: há caderno fora e caderno só de borda dentro', () => {
    const todas = fixtures();
    const fora = todas.flatMap(([, ps]) => ps.filter((p) => !ordenarCadernos(ps).includes(p.caderno)));
    assert.ok(fora.length >= 3, 'sem caderno fora da ordem a costura só prova metade');
    assert.ok(fora.some((p) => p.lapides.length > 0), 'nenhum caderno fora carrega lápide antiga');
  });

  it('a lápide antiga não conta como conteúdo — nem na ordem, nem nos dois prompts', () => {
    const ps = edicao(semFc(SETEMBRO()), { lapides: MORTES });
    const coracao = pacote(ps, 'coracao');
    assert.ok(coracao.lapides.length > 0 && coracao.metricas.length === 0);
    assert.equal(cadernoVazio(coracao), true);
    assert.equal(ordenarCadernos(ps).includes('coracao'), false);
    assert.equal(montarPrompt(coracao).usuario, '');
    assert.equal(temBloco(montarPromptDaEdicao(ps).usuario, 'Coração'), false);
  });

  /*
   * AS TRÊS CLÁUSULAS DO VAZIO, com asserção ABSOLUTA.
   *
   * A costura acima é relativa — ordem e prompt concordam —, e por isso é cega a
   * uma cláusula arrancada de `cadernoVazio`: sem ela, o caderno fica vazio dos
   * DOIS lados, e os dois lados concordam. Aqui se diz o que tem que acontecer:
   * o caderno está na ordem, e a linha que o fez existir chega à edição.
   */
  it('só com cobertura desigual: está na ordem, e a ressalva chega à edição', () => {
    const [, ps] = fixtures().find(([n]) => n === 'sono só com cobertura')!;
    const sono = pacote(ps, 'sono');
    assert.deepEqual(sono.metricas, []);
    assert.equal(cadernoVazio(sono), false);
    assert.ok(ordenarCadernos(ps).includes('sono'));
    const u = montarPromptDaEdicao(ps).usuario;
    assert.ok(u.includes('⚠ COBERTURA DESIGUAL'));
    assert.ok(u.includes('### Ressalvas obrigatórias\nO texto TEM que declarar a cobertura desigual de: Sono.'));
  });

  it('só com evento: está na ordem, e o evento chega à edição', () => {
    const [, ps] = fixtures().find(([n]) => n === 'sono só com evento')!;
    assert.equal(cadernoVazio(pacote(ps, 'sono')), false);
    assert.ok(ordenarCadernos(ps).includes('sono'));
    assert.ok(montarPromptDaEdicao(ps).usuario.includes('### Eventos\n- 2026-09-12: Noite em claro'));
  });

  it('só com correlação: está na ordem, e a associação chega à edição', () => {
    const [, ps] = fixtures().find(([n]) => n === 'sono só com correlação')!;
    assert.equal(cadernoVazio(pacote(ps, 'sono')), false);
    assert.ok(ordenarCadernos(ps).includes('sono'));
    assert.ok(montarPromptDaEdicao(ps).usuario.includes(
      '### Associações observadas (NUNCA são causa)\n- cerveja: AMOSTRA INSUFICIENTE (2 com, 20 sem)',
    ));
  });

  it('o cabeçalho de caderno sem seção própria existe — é a prova de presença na edição', () => {
    const [, ps] = fixtures().find(([n]) => n === 'sono só com lacuna')!;
    const edicaoInteira = montarPromptDaEdicao(ps).usuario;
    assert.ok(ordenarCadernos(ps).includes('sono'));
    assert.match(edicaoInteira, /^### Sono$/m);
    assert.ok(edicaoInteira.includes('- Sono: 30 dias sem dado (relógio sem carga)'));
  });
});

/* ── a ausência no barril ── */

describe('`ordenarCadernos` não sai pelo `index.ts` — é função de impressão, nunca de render', () => {
  it('o barril não menciona o ranqueamento', () => {
    const src = readFileSync(join(import.meta.dirname, '..', 'index.ts'), 'utf8');
    assert.equal(/ranqueamento/.test(src), false, 'o index.ts reexporta o ranqueamento');
  });

  it('e nada do que ele exporta o alcança — nem por reexportação indireta', async () => {
    const barril: Record<string, unknown> = await import('../index');
    for (const nome of ['ordenarCadernos', 'liderDoCaderno', 'AMOSTRA_MINIMA', 'PESO_DA_BASE']) {
      assert.equal(nome in barril, false, `${nome} saiu pelo barril`);
    }
    // A prova de que o import leu o barril de verdade, e não um módulo vazio.
    assert.ok('cadernoVazio' in barril && 'montarPacotes' in barril);
  });

  it('os ids que ela devolve são sempre do catálogo', () => {
    for (const [, ps] of fixtures()) {
      for (const id of ordenarCadernos(ps)) assert.ok(CADERNO_IDS.includes(id));
    }
  });
});
