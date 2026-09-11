import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { RetroSummary, RetroHabitRow, RetroRegistroRow } from '../period/retro';
import { buildRetrospective } from '../period/retro';
import type { Activity } from '../models/index';
import type { RecapValue, MetricRecap } from '../week/recap';
import { metricRecap } from '../week/recap';
import { CADERNO_IDS } from '../period/cadernos';
import type { CadernoId } from '../period/cadernos';
import {
  periodLabel, previousPeriodLabel, previousPeriodStartISO,
} from '../period/bounds';
import type { PeriodKind } from '../period/bounds';
import type { FatoLapide, FatoNumero, PacoteDeFatos } from './pacote';
import {
  PACOTE_VERSAO,
  cadernoVazio,
  coberturaDe,
  lapideDoPeriodo,
  temLapideDoPeriodo,
  validarLapides,
  montarPacote,
  montarPacotes,
  numerosDoPacote,
  periodoFechado,
  procedenciaDoPacote,
  ressalvasObrigatorias,
  TEXTO_DA_ESTACAO,
  valoresDoPacote,
} from './pacote';
import { montarPrompt, montarPromptDaEdicao } from './prompt';
import { ordenarCadernos } from './ranqueamento';
import { estacaoDaLuz } from '../astro/casa';

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
        // Os DOIS lados são dado real, conferidos em produção em 11/09: em
        // ago/2026 toda saída de bicicleta e de corrida tem distância; em
        // jul/2026 os 15 registros crus de bicicleta tinham distância, e havia 2
        // corridas com distância (contagem crua, antes do dedupe — a retro de
        // julho conta 11 pedaladas). O TOTAL de atividades com distância não foi
        // consultado — e por isso `fitness.countWithDistance` fica de fora:
        // inventá-lo seria fabricar o lado fino que o portão existe para medir.
        sessionsWithDistance: recap(7, 11),
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
        sessionsWithDistance: recap(8, 2),
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

const ENTRADA_AGOSTO = {
  resumo: agosto(),
  agora: AGORA,
  coberturaSono: { noites: 27, noitesAnterior: 14 },
};

/**
 * As quatro métricas que morreram em 2026 — **dado real**, diagnosticado em
 * produção em 07/09/2026 (troca de relógio, não cano quebrado). Na ordem da
 * morte, que não é a do mapa: a montagem ordena sozinha.
 */
const LAPIDES_DE_2026: readonly FatoLapide[] = [
  { metrica: 'aneis', ultimaMedidaISO: '2026-08-17' },
  { metrica: 'spo2', ultimaMedidaISO: '2026-07-16' },
  { metrica: 'vo2max', ultimaMedidaISO: '2026-07-14' },
  { metrica: 'respiracao', ultimaMedidaISO: '2026-07-10' },
];

/**
 * Roda `fn` com o fuso do processo fixado em cada um destes — no molde de
 * `astro/sun.test.ts` (invariância de fuso da luz).
 *
 * Existe porque o CI roda em UTC, e em UTC as duas mutações clássicas de data
 * local passam verdes: formatar com `toISOString()` e andar a semana em
 * 7 × 86.400.000 ms. Medido em 11/09, mutando `period/bounds.ts` numa cópia e
 * pinando um fuso de cada vez:
 *
 * - **Bruxelas** (UTC+1/+2) pega as duas. O `toISOString()` erra todo caso — a
 *   meia-noite local é 22h ou 23h UTC da véspera —, e os milissegundos erram a
 *   semana de 30/03, que atravessa a virada europeia da primavera (29/03).
 * - **Nova York** (UTC−5/−4) pega só a dos milissegundos, e só na semana de
 *   09/03, que atravessa a virada americana da primavera (08/03). O
 *   `toISOString()` passa lá: a oeste de UTC, a meia-noite local ainda é o
 *   mesmo dia em UTC.
 * - Na virada do OUTONO nenhum dos dois pega os milissegundos: andar 7 × 24 h
 *   para trás cai uma hora depois da meia-noite, no mesmo dia.
 *
 * Os dois ficam: Nova York pega a semana de 09/03, que Bruxelas não vê.
 */
const FUSOS_COM_VERAO = ['Europe/Brussels', 'America/New_York'] as const;

function emCadaFuso(fn: (tz: string) => void): void {
  const original = process.env.TZ;
  try {
    for (const tz of FUSOS_COM_VERAO) {
      process.env.TZ = tz;
      fn(tz);
    }
  } finally {
    if (original == null) delete process.env.TZ;
    else process.env.TZ = original;
  }
}

function porCaderno(ps: readonly PacoteDeFatos[]): Record<CadernoId, PacoteDeFatos> {
  const out = {} as Record<CadernoId, PacoteDeFatos>;
  for (const p of ps) out[p.caderno] = p;
  return out;
}

function fato(p: PacoteDeFatos, chave: string): FatoNumero | undefined {
  return p.metricas.find((f) => f.chave === chave);
}

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

/* ── montagem por caderno ── */

describe('montarPacotes — agosto de 2026', () => {
  const pacotes = montarPacotes({
    ...ENTRADA_AGOSTO,
    eventos: [{ dia: '2026-08-30', tipo: 'marco', rotulo: 'Meia maratona' }],
  });
  const c = porCaderno(pacotes);

  it('devolve os quatro cadernos, na ordem do catálogo, na versão 3', () => {
    // 3: `amostra` e `comparavel` no fato, e a lápide como fato próprio.
    assert.deepEqual(pacotes.map((p) => p.caderno), [...CADERNO_IDS]);
    for (const p of pacotes) assert.equal(p.versao, 3);
    assert.equal(PACOTE_VERSAO, 3);
  });

  it('todo pacote carrega o mesmo período, e ele está fechado', () => {
    for (const p of pacotes) {
      assert.equal(p.periodo.fechado, true);
      assert.equal(p.periodo.diasNoPeriodo, 31);
      assert.equal(p.periodo.rotulo, 'Agosto');
    }
  });

  it('converte metros em km e segundos em horas — a unidade em que se escreve', () => {
    const dist = fato(c.movimento, 'distancia')!;
    assert.equal(dist.atual, 435);
    assert.equal(dist.bases.find((b) => b.id === 'B1')!.valor, 862);
    assert.equal(dist.unidade, 'km');

    const tempo = fato(c.movimento, 'tempo')!;
    assert.equal(tempo.atual, 40.1);
    assert.equal(tempo.bases.find((b) => b.id === 'B1')!.valor, 68.2);
  });

  it('a manchete que a tela de hoje não sabe dizer está nos fatos', () => {
    const n = fato(c.movimento, 'atividades')!.bases.find((b) => b.id === 'B1')!;
    const d = fato(c.movimento, 'distancia')!.bases.find((b) => b.id === 'B1')!;
    // Mais atividades E metade dos quilômetros: os dois deltas, em sinais opostos.
    assert.ok(n.delta! > 0, 'agosto teve mais atividades');
    assert.ok(d.delta! < 0, 'e menos da metade dos quilômetros');
    assert.equal(d.deltaPct, -49.5);
  });

  /*
   * O erro que esta story existe para não cometer. Os cinco módulos da versão 1
   * NÃO mapeiam um-para-um nos quatro cadernos: `saude` se parte e `percepcao`
   * se parte. Quem tratar como rename produz um Sono com FC dentro — e nenhum
   * teste de tamanho pega isso.
   */
  it('saúde SE PARTE: sono vai para Sono, FC vai para Coração', () => {
    assert.ok(fato(c.sono, 'sono'), 'a duração de sono é do caderno Sono');
    assert.equal(fato(c.coracao, 'sono'), undefined, 'e não do Coração');
    assert.ok(fato(c.coracao, 'fcRepouso'), 'a FC de repouso é do caderno Coração');
    assert.equal(fato(c.sono, 'fcRepouso'), undefined, 'e NUNCA do Sono');
  });

  it('percepção SE PARTE: a nota do sono é de Sono, a do dia é de Rotina', () => {
    assert.equal(fato(c.sono, 'nota_sono')!.atual, 3.72);
    assert.equal(fato(c.rotina, 'nota_dia')!.atual, 4);
    assert.equal(fato(c.rotina, 'nota_sono'), undefined);
    assert.equal(fato(c.sono, 'nota_dia'), undefined);
  });

  it('a percepção andou mais que a medição — e os dois números estão no mesmo caderno', () => {
    const nota = fato(c.sono, 'nota_sono')!.bases.find((b) => b.id === 'B1')!;
    const sono = fato(c.sono, 'sono')!.bases.find((b) => b.id === 'B1')!;
    // ~9,7% contra ~2,0%: a razão de ~5× que vira manchete. É leitura de UM
    // caderno — na versão 1 ela cruzava dois módulos.
    assert.ok(nota.deltaPct! / sono.deltaPct! > 4);
  });

  it('a cobertura de noites é do caderno Sono, e obriga a ressalva', () => {
    assert.equal(c.sono.cobertura!.diasComDado, 27);
    assert.equal(c.sono.cobertura!.diasComDadoAnterior, 14);
    assert.equal(c.sono.cobertura!.comparavel, false);
    assert.deepEqual(ressalvasObrigatorias(pacotes), ['Sono']);
  });

  it('cada esporte é um grupo dentro de Movimento, com chave própria', () => {
    assert.equal(fato(c.movimento, 'ciclismo.distancia')!.atual, 333);
    assert.equal(fato(c.movimento, 'corrida.distancia')!.atual, 101);
    assert.equal(fato(c.movimento, 'ciclismo.distancia')!.grupo, 'Ciclismo');
    // Três "Distância" no mesmo caderno: sem chave única a base externa não teria
    // onde pousar, e sem grupo o modelo escolheria a errada.
    const distancias = c.movimento.metricas.filter((f) => f.rotulo === 'Distância');
    assert.equal(distancias.length, 3);
    assert.equal(new Set(distancias.map((f) => f.chave)).size, 3);
  });

  it('o evento sobrevive, no caderno de Movimento', () => {
    assert.equal(c.movimento.eventos.length, 1);
    assert.equal(c.movimento.eventos[0].rotulo, 'Meia maratona');
    assert.equal(c.sono.eventos.length, 0);
  });

  it('não inventa métrica sem dado — hábitos e registros vazios não viram fato', () => {
    assert.equal(c.rotina.metricas.some((f) => f.chave.startsWith('habito.')), false);
    assert.equal(c.rotina.metricas.some((f) => f.chave.startsWith('registro.')), false);
  });
});

/**
 * A cobertura do Coração conta só as linhas do Coração.
 *
 * Na versão 1 o `max(recap.n)` corria sobre TODAS as linhas de saúde, e o agosto
 * do golden set não distingue os dois comportamentos: sono tem n=27, FC tem
 * n=29, e os dois caminhos devolvem 29.
 *
 * A configuração viva distingue. O store da retro registra sono, vfc e
 * fcRepouso, e a VFC está parada desde 17/07. Num mês com a FC medida em 10 dias
 * e o sono em 28, o `max` sobre tudo daria 28 — cobertura comparável, nenhuma
 * ressalva — e a revista escreveria sobre FC de repouso a partir de dez dias sem
 * a ressalva que a §5 do spec obriga.
 */
describe('a cobertura do Coração é a das métricas do Coração', () => {
  const fcRala = (): RetroSummary => {
    const s = agosto();
    return {
      ...s,
      health: [
        { ...s.health[0], recap: metrica(7.03, 6.89, 28) },   // sono: 28 de 31
        { ...s.health[1], recap: metrica(48.1, 49, 10) },     // FC: 10 de 31
      ],
    } as RetroSummary;
  };

  const pacotes = montarPacotes({ resumo: fcRala(), agora: AGORA });
  const c = porCaderno(pacotes);

  it('conta os 10 dias da FC, não os 28 do sono', () => {
    assert.equal(c.coracao.cobertura!.diasComDado, 10);
    assert.equal(c.coracao.cobertura!.diasNoPeriodo, 31);
  });

  it('10 de 31 não é comparação silenciosa — e a ressalva nomeia Coração', () => {
    assert.equal(c.coracao.cobertura!.comparavel, false);
    assert.deepEqual(ressalvasObrigatorias(pacotes), ['Coração']);
  });

  it('o sono não empresta a cobertura dele — sem noites informadas, ela é nula', () => {
    // `coberturaSono` não veio; o `recap.n` do sono NÃO vira cobertura de Sono,
    // porque compararia o período consigo mesmo e poria número novo no alfabeto.
    assert.equal(c.sono.cobertura, null);
    assert.equal(valoresDoPacote(c.sono).has(28), false);
  });
});

/* ── isolamento entre cadernos ── */

describe('isolamento — o caderno de Sono não sabe quanto o dono pedalou', () => {
  const c = porCaderno(montarPacotes(ENTRADA_AGOSTO));

  it('nenhuma CHAVE de Movimento aparece no pacote de Sono', () => {
    const doSono = new Set(c.sono.metricas.map((f) => f.chave));
    for (const f of c.movimento.metricas) {
      assert.equal(doSono.has(f.chave), false, `"${f.chave}" vazou para o caderno de Sono`);
    }
  });

  it('nenhum VALOR de ciclismo aparece no pacote de Sono', () => {
    const valores = valoresDoPacote(c.sono);
    // 333 km × 820 · 7 saídas × 11 · 22,7 h × 52,8. Zero fica de fora de
    // propósito: a elevação do mês é 0 e zero é vocabulário compartilhado —
    // testá-lo mediria coincidência, não vazamento.
    for (const v of [333, 820, 7, 11, 22.7, 52.8, 487, 59.4]) {
      assert.equal(valores.has(v), false, `${v} é de ciclismo e vazou para o Sono`);
    }
  });

  it('o texto de um caderno se confere contra o alfabeto DELE', () => {
    // A frouxidão que a v1 tinha: "435" era autorizado ao falar de sono.
    assert.equal(valoresDoPacote(c.sono).has(435), false);
    assert.equal(valoresDoPacote(c.movimento).has(435), true);
  });
});

/* ── a medição do alfabeto: a única coisa que denuncia um split nominal ── */

/**
 * **Isto é entrega, não bônus.**
 *
 * O modo de falha desta story é silencioso: um split malfeito — cada caderno
 * recebendo a união em vez da fatia — passa em toda asserção que se possa
 * escrever sobre conteúdo. O que denuncia é o **tamanho**. Por isso a medição é
 * publicada na saída do teste, e não só comparada.
 *
 * A referência é o pacote único da versão 1, medido em 07/09/2026 sobre este
 * mesmo agosto: **71 valores, 16 inteiros entre 0 e 100** — um inteiro alucinado
 * nessa faixa passava a conferência 16% das vezes.
 */
const V1_VALORES = 71;
const V1_INTEIROS = 16;

/**
 * Com `coberturaSono` o pacote único da v1 media 73/18 — as quatro contagens de
 * noite entram no alfabeto. Medido contra o `pacote.ts` do commit `baef0be`
 * (`git show baef0be:packages/shared/src/ia/pacote.ts`) em 09/09/2026, para o
 * caso de alguém achar que a diferença é regressão. Não é: a entrada é outra.
 */
const V1_VALORES_COM_SONO = 73;
const V1_INTEIROS_COM_SONO = 18;

function inteirosAte100(vs: ReadonlySet<number>): number[] {
  return [...vs].filter((v) => Number.isInteger(v) && v >= 0 && v <= 100).sort((a, b) => a - b);
}

/**
 * A medição é feita sobre a **mesma entrada** que produziu os 71/16 publicados
 * em `bases-e-ranqueamento.md`: sem `coberturaSono`. Comparar contra uma entrada
 * diferente daria uma tabela bonita e uma comparação falsa.
 */
const ENTRADA_MEDIDA = { resumo: agosto(), agora: AGORA };

describe('a medição do alfabeto, por caderno', () => {
  const pacotes = montarPacotes(ENTRADA_MEDIDA);
  const uniao = valoresDoPacote(pacotes);
  const inteirosUniao = inteirosAte100(uniao);

  const linhas = pacotes.map((p) => {
    const vs = valoresDoPacote(p);
    return { caderno: p.caderno, valores: vs.size, inteiros: inteirosAte100(vs).length };
  });

  // A publicação. Sai no corpo do módulo de propósito: é entrega, e tem que
  // aparecer mesmo quando toda asserção passa.
  const pad = (s: string | number, n: number) => String(s).padStart(n);
  console.log('\n── o alfabeto da verificação — agosto/2026, por caderno ──');
  console.log(`   ${'caderno'.padEnd(12)}${pad('valores', 8)}${pad('inteiros 0–100', 16)}`);
  for (const l of linhas) {
    console.log(`   ${l.caderno.padEnd(12)}${pad(l.valores, 8)}${pad(l.inteiros, 16)}`);
  }
  console.log(`   ${'união'.padEnd(12)}${pad(uniao.size, 8)}${pad(inteirosUniao.length, 16)}`);
  console.log(`   ${'v1 (um só)'.padEnd(12)}${pad(V1_VALORES, 8)}${pad(V1_INTEIROS, 16)}`);
  console.log(`   inteiros da união: ${inteirosUniao.join(' ')}`);
  const pior = Math.max(...linhas.map((l) => l.inteiros));
  console.log(
    `   um inteiro alucinado de 0 a 100 passava ${V1_INTEIROS}% das vezes; `
    + `no pior caderno passa ${pior}%.\n`,
  );

  it('cada caderno tem alfabeto MENOR que o do pacote único equivalente', () => {
    for (const l of linhas) {
      assert.ok(
        l.valores < uniao.size,
        `${l.caderno} tem ${l.valores} valores contra ${uniao.size} da união — `
        + 'um caderno do tamanho da união é um split nominal',
      );
    }
  });

  it('a união é EXATAMENTE o alfabeto da v1 — a mudança de forma não trouxe número', () => {
    // Se este número subir, alguém acrescentou valor ao pacote sem declarar
    // como compensa. É a regra do alfabeto, cobrada em vez de prometida.
    assert.equal(uniao.size, V1_VALORES);
    assert.equal(inteirosUniao.length, V1_INTEIROS);
  });

  it('com a cobertura de noites, a união bate o 73/18 da v1 na mesma entrada', () => {
    const comSono = valoresDoPacote(montarPacotes(ENTRADA_AGOSTO));
    assert.equal(comSono.size, V1_VALORES_COM_SONO);
    assert.equal(inteirosAte100(comSono).length, V1_INTEIROS_COM_SONO);
  });

  it('o caderno mais gordo ainda é bem menor que a união', () => {
    const maior = Math.max(...linhas.map((l) => l.valores));
    assert.ok(
      maior <= uniao.size * 0.8,
      `o maior caderno tem ${maior} de ${uniao.size} — perto demais da união`,
    );
  });

  it('nenhum caderno carrega os 16 inteiros de 0 a 100 da união', () => {
    for (const l of linhas) {
      assert.ok(l.inteiros < V1_INTEIROS, `${l.caderno} tem ${l.inteiros} inteiros de 0 a 100`);
    }
  });
});

/* ── as bases nomeadas ── */

describe('bases', () => {
  const c = porCaderno(montarPacotes(ENTRADA_AGOSTO));

  it('todo fato traz as três, sempre, na ordem B1 · B2 · B3', () => {
    for (const p of Object.values(c)) {
      for (const f of p.metricas) {
        assert.deepEqual(f.bases.map((b) => b.id), ['B1', 'B2', 'B3'], f.chave);
      }
    }
  });

  it('B1 existe e traz valor, delta e o nome dela', () => {
    const b1 = fato(c.movimento, 'distancia')!.bases[0];
    assert.equal(b1.existe, true);
    assert.equal(b1.valor, 862);
    assert.equal(b1.delta, -427);
    assert.equal(b1.rotulo, 'o período anterior');
  });

  it('B2 e B3 entram COMO FATO DECLARADO DE AUSÊNCIA — não somem', () => {
    // O caderno Rotina não tem B2 nem B3 antes de mai/2027 (§4 do brief). A
    // regra que fecha o buraco: o modelo não pode DESCOBRIR que não há ano
    // anterior — ele tem que ser INFORMADO de que não há.
    const nota = fato(c.rotina, 'nota_dia')!;
    const [, b2, b3] = nota.bases;
    assert.equal(b2.existe, false);
    assert.equal(b3.existe, false);
    assert.ok(b2.motivo && b2.motivo.length > 0, 'ausência sem motivo é silêncio de novo');
    assert.ok(b3.motivo && b3.motivo.length > 0);
    assert.equal(b2.valor, null);
    assert.equal(b2.deltaPct, null);
  });

  it('base inexistente não põe número nenhum no alfabeto', () => {
    const so = montarPacote({ ...ENTRADA_AGOSTO }, 'rotina');
    const semExternas = valoresDoPacote(so);
    const comB2 = valoresDoPacote(montarPacote(
      { ...ENTRADA_AGOSTO, bases: { nota_dia: { B2: { valor: 3.5 } } } },
      'rotina',
    ));
    assert.equal(semExternas.has(3.5), false);
    assert.equal(comB2.has(3.5), true, 'a base informada entra no alfabeto');
    assert.ok(comB2.size > semExternas.size);
  });

  it('B2 informada vira base existente, com delta contra o atual', () => {
    const p = montarPacote(
      { ...ENTRADA_AGOSTO, bases: { distancia: { B2: { valor: 380 } } } },
      'movimento',
    );
    const b2 = fato(p, 'distancia')!.bases[1];
    assert.equal(b2.existe, true);
    assert.equal(b2.valor, 380);
    assert.equal(b2.delta, 55);
    assert.equal(b2.rotulo, 'o mesmo período do ano anterior');
  });

  it('o motivo informado pelo chamador vence o padrão', () => {
    const p = montarPacote(
      { ...ENTRADA_AGOSTO, bases: { distancia: { B3: { valor: null, motivo: 'só um ano de bicicleta' } } } },
      'movimento',
    );
    const b3 = fato(p, 'distancia')!.bases[2];
    assert.equal(b3.existe, false);
    assert.equal(b3.motivo, 'só um ano de bicicleta');
  });

  it("'all' não tem período anterior — e diz isso, em vez de omitir B1", () => {
    const tudo = { ...agosto(), kind: 'all' as const, label: 'Tudo' };
    const p = montarPacote({ resumo: tudo as RetroSummary, agora: AGORA }, 'movimento');
    const b1 = fato(p, 'distancia')!.bases[0];
    assert.equal(b1.existe, false);
    assert.equal(b1.valor, null);
    assert.ok(b1.motivo);
  });
});

/* ── trajetória e fato de texto ── */

describe('FatoTendencia', () => {
  const p = montarPacote({
    ...ENTRADA_AGOSTO,
    tendencias: {
      rotina: [{ chave: 'nota_dia', rotulo: 'Nota do dia', direcao: 'sobe', periodos: 3, desde: 'junho' }],
    },
  }, 'rotina');

  it('carrega direção, nº de períodos e desde quando — sem valor bruto', () => {
    const t = p.tendencias[0];
    assert.equal(t.direcao, 'sobe');
    assert.equal(t.periodos, 3);
    assert.equal(t.desde, 'junho');
    assert.equal(Object.keys(t).sort().join(','), 'chave,desde,direcao,periodos,rotulo');
  });

  it('põe UM inteiro no alfabeto — o argumento de por que não é uma quarta base', () => {
    const sem = valoresDoPacote(montarPacote(ENTRADA_AGOSTO, 'rotina'));
    const com = valoresDoPacote(p);
    assert.equal(com.has(3), true);
    // 3 pode já estar lá por outro caminho; o que importa é o crescimento.
    assert.ok(com.size - sem.size <= 1, 'a trajetória não pode custar mais que um número');
  });

  it('o caderno Rotina compara mesmo sem B2 e sem B3', () => {
    // É a única comparação que ele consegue antes de mai/2027.
    assert.ok(p.tendencias.length > 0);
    assert.equal(p.metricas[0].bases[1].existe, false);
  });
});

describe('FatoTexto', () => {
  const p = montarPacote({
    ...ENTRADA_AGOSTO,
    textos: {
      movimento: [
        { chave: 'cidades', rotulo: 'Cidades', valor: 'Ittre, Leuven e Bruxelles' },
        { chave: 'piso', rotulo: 'Piso', valor: '72% pavimentado' },
      ],
    },
  }, 'movimento');

  it('cidades e piso entram como texto', () => {
    assert.equal(p.textos.length, 2);
    assert.equal(p.textos[0].valor, 'Ittre, Leuven e Bruxelles');
  });

  it('NÃO entra no alfabeto numérico — é o motivo de a forma existir', () => {
    const sem = valoresDoPacote(montarPacote(ENTRADA_AGOSTO, 'movimento'));
    const com = valoresDoPacote(p);
    assert.equal(com.size, sem.size, 'o "72" do piso não pode virar número autorizado');
    assert.equal(com.has(72), false);
  });
});

/* ── caderno sem dado ── */

describe('caderno sem dado', () => {
  const semNoites = (): RetroSummary => {
    const s = agosto();
    return {
      ...s,
      health: s.health.filter((h) => h.metric !== 'sono'),
      ratings: { sleep: null, day: s.ratings.day },
    } as RetroSummary;
  };

  it('o pacote de Sono EXISTE e declara a ausência; não inventa métrica', () => {
    const p = montarPacote({ resumo: semNoites(), agora: AGORA }, 'sono');
    assert.equal(p.caderno, 'sono');
    assert.equal(p.semDado, true);
    assert.deepEqual(p.metricas, []);
    assert.equal(p.cobertura, null);
    assert.equal(p.rotulo, 'Sono');
  });

  it('o mês com noites não vem marcado como vazio', () => {
    assert.equal(montarPacote(ENTRADA_AGOSTO, 'sono').semDado, false);
  });
});

/* ── introspecção: o alfabeto da verificação ── */

describe('numerosDoPacote', () => {
  const pacotes = montarPacotes(ENTRADA_AGOSTO);
  const nums = numerosDoPacote(pacotes);

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

  it('o alfabeto de um caderno é subconjunto do da união', () => {
    const so = numerosDoPacote(montarPacote(ENTRADA_AGOSTO, 'sono'));
    for (const n of so) assert.ok(nums.has(n), `"${n}" está no Sono e não na união`);
  });
});

/* ── o nome real do período anterior ── */

describe('periodo.rotuloAnterior', () => {
  const comPeriodo = (kind: RetroSummary['kind'], startISO: string, endISO: string) =>
    montarPacote(
      { resumo: { ...agosto(), kind, startISO, endISO } as RetroSummary, agora: AGORA },
      'movimento',
    ).periodo.rotuloAnterior;

  it('é o nome PRÓPRIO do anterior, não "período anterior"', () => {
    // O campo que a v1 tinha dizia sempre "período anterior" — a Story 1.3 o
    // removeu por não ter leitor. A quinta regra é o leitor, e o que ela precisa
    // é justamente o que aquele campo não dava: o nome.
    assert.equal(comPeriodo('month', '2026-08-01', '2026-08-31'), 'Julho 2026');
  });

  it('atravessa a virada de ano', () => {
    assert.equal(comPeriodo('month', '2026-01-01', '2026-01-31'), 'Dezembro 2025');
  });

  it('cada tipo de período tem a forma dele', () => {
    assert.equal(comPeriodo('week', '2026-08-03', '2026-08-09'), '27/07 – 02/08');
    assert.equal(comPeriodo('season', '2026-04-01', '2026-06-30'), 'Q1 2026');
    assert.equal(comPeriodo('year', '2025-01-01', '2025-12-31'), '2024');
  });

  it('`all` não tem anterior — sempre cabe mais um dia', () => {
    assert.equal(comPeriodo('all', '2000-01-01', '2026-09-06'), null);
  });

  it('o INÍCIO do anterior sai pelo mesmo caminho que o nome dele', () => {
    // A fronteira do portão de nascimento (Story 1.7). Dois caminhos dariam, no
    // dia em que um mudasse, um período anterior com um nome e outro começo —
    // por isso a prova é que o rótulo do período que começa ali É o nome.
    const casos: ReadonlyArray<readonly [PeriodKind, string, string]> = [
      ['month', '2026-08-01', '2026-07-01'],
      ['month', '2026-01-01', '2025-12-01'],
      ['week', '2026-08-03', '2026-07-27'],
      ['season', '2026-04-01', '2026-01-01'],
      ['year', '2025-01-01', '2024-01-01'],
    ];
    // Em fuso fixado: em UTC, um início formatado com `toISOString()` sai certo
    // por sorte. Em Bruxelas, a meia-noite local é 22h ou 23h UTC da véspera.
    emCadaFuso((tz) => {
      for (const [tipo, inicio, esperado] of casos) {
        const anterior = previousPeriodStartISO(tipo, inicio);
        assert.equal(anterior, esperado, `${tz} ${tipo} ${inicio}`);
        assert.equal(
          periodLabel(tipo, new Date(`${anterior}T00:00:00`)), previousPeriodLabel(tipo, inicio),
          `${tz} ${tipo} ${inicio}: o início e o nome do anterior discordam`,
        );
      }
      assert.equal(previousPeriodStartISO('all', '2000-01-01'), null);
      assert.equal(previousPeriodStartISO('month', 'não é data'), null);
    });
  });

  it('a semana que cruza o horário de verão não perde nem ganha um dia — em todo fuso', () => {
    // 29/03/2026 e 25/10/2026 são as viradas europeias; 08/03 e 01/11, as
    // americanas. Uma conta em milissegundos de 7 × 24 h cai na véspera quando a
    // semana atravessa a virada da primavera — em Bruxelas na de 30/03, em Nova
    // York na de 09/03 —; a conta por componentes de data não. Em UTC não há
    // virada nenhuma, e por isso o fuso é fixado aqui.
    emCadaFuso((tz) => {
      assert.equal(previousPeriodStartISO('week', '2026-03-30'), '2026-03-23', tz);
      assert.equal(previousPeriodStartISO('week', '2026-11-02'), '2026-10-26', tz);
      assert.equal(previousPeriodStartISO('week', '2026-03-09'), '2026-03-02', tz);
    });
  });

  it('é TEXTO: não põe número nenhum no alfabeto', () => {
    // A regra do alfabeto vale para qualquer campo novo. O 71/16 medido logo
    // abaixo é a mesma cobrança; esta asserção diz por que ele não se mexeu.
    const ano = montarPacotes({
      resumo: { ...agosto(), kind: 'year', startISO: '2025-01-01', endISO: '2025-12-31' } as RetroSummary,
      agora: AGORA,
    });
    assert.equal(ano[0].periodo.rotuloAnterior, '2024');
    assert.equal(valoresDoPacote(ano).has(2024), false, '2024 é rótulo, não medida');
  });
});

/* ── procedência: o alfabeto com a etiqueta de onde cada valor nasceu ── */

describe('procedenciaDoPacote', () => {
  const pacotes = montarPacotes(ENTRADA_AGOSTO);
  const proc = procedenciaDoPacote(pacotes);

  it('não acrescenta NEM tira número do alfabeto', () => {
    // A quinta regra da conferência precisa de origem, não de mais números. Se
    // os dois conjuntos divergirem, um dos dois lados da conferência passou a
    // ver um alfabeto que o outro não vê — e isso é calado.
    const daProcedencia = new Set(proc.map((x) => x.valor));
    const alfabeto = valoresDoPacote(pacotes);
    assert.equal(daProcedencia.size, alfabeto.size);
    for (const v of alfabeto) assert.ok(daProcedencia.has(v), `${v} sumiu da procedência`);
  });

  it('o valor da base sai etiquetado com a base; o `atual` sai sem etiqueta', () => {
    const dist = montarPacote(ENTRADA_AGOSTO, 'movimento').metricas
      .find((f) => f.chave === 'distancia');
    assert.ok(dist, 'o fixture perdeu a distância');
    const b1 = dist.bases.find((b) => b.id === 'B1');
    assert.ok(b1?.valor != null);
    const doValor = (v: number) => proc.filter((x) => x.valor === v && x.chave === 'distancia');
    assert.deepEqual(doValor(b1.valor).map((x) => x.base), ['B1']);
    assert.deepEqual(doValor(dist.atual as number).map((x) => x.base), [null]);
  });

  it('delta e deltaPct NÃO são valor de base — são a relação com ela', () => {
    // Cobrar nomeação de "caiu 49,5%" reprovaria uma frase bem-formada, e falso
    // positivo na conferência custa uma edição inteira.
    const dist = montarPacote(ENTRADA_AGOSTO, 'movimento').metricas
      .find((f) => f.chave === 'distancia');
    const b1 = dist?.bases.find((b) => b.id === 'B1');
    assert.ok(b1?.deltaPct != null);
    for (const x of proc.filter((y) => y.valor === Math.abs(b1.deltaPct as number))) {
      assert.equal(x.base, null);
    }
  });
});

describe('período em curso', () => {
  it('setembro monta, mas vem marcado como aberto', () => {
    const s = agosto();
    const setembro = { ...s, label: 'Setembro', startISO: '2026-09-01', endISO: '2026-09-30' };
    const ps = montarPacotes({ resumo: setembro as RetroSummary, agora: AGORA });
    for (const p of ps) {
      assert.equal(p.periodo.fechado, false, 'quem decide não gerar parágrafo é o chamador');
      assert.equal(p.periodo.diasNoPeriodo, 30);
    }
  });
});

/*
 * ── A LUZ DO PERÍODO: TEXTO, NUNCA NÚMERO (Story 1.6) ──
 *
 * Duas tentativas puseram as horas de luz no pacote como número, e as duas
 * passaram verdes com asserções ancoradas no agosto de 14,5 h — o caso sortudo.
 * Julho dá 16, dezembro dá 8, todo ano, e um inteiro desses entrava no alfabeto
 * de cadernos que não o tinham. Por isso TODA asserção daqui varre os 60 meses
 * de 2023 a 2027, e nenhuma olha um mês só.
 */
describe('a luz do período — texto em `periodo`, custo zero no alfabeto', () => {
  const ANOS = [2023, 2024, 2025, 2026, 2027];
  const NOMES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];

  /** O mesmo resumo de agosto, mudado para outro mês — só as datas andam. */
  function entradaDoMes(ano: number, m: number, resumo: RetroSummary = agosto()) {
    const mm = String(m).padStart(2, '0');
    const ultimo = new Date(Date.UTC(ano, m, 0)).getUTCDate();
    return {
      resumo: {
        ...resumo, label: `${NOMES[m - 1]} ${ano}`,
        startISO: `${ano}-${mm}-01`, endISO: `${ano}-${mm}-${ultimo}`,
      } as RetroSummary,
      agora: AGORA,
      coberturaSono: { noites: 27, noitesAnterior: 14 },
    };
  }

  const MESES = ANOS.flatMap((ano) => NOMES.map((_, i) => [ano, i + 1] as const));

  /** Um intervalo qualquer, com o mesmo resumo de agosto — só as datas andam. */
  function entradaDe(kind: RetroSummary['kind'], startISO: string, endISO: string, label: string) {
    return {
      resumo: { ...agosto(), kind, label, startISO, endISO } as RetroSummary,
      agora: AGORA,
      coberturaSono: { noites: 27, noitesAnterior: 14 },
    };
  }

  /** O alfabeto de cada caderno, como texto comparável. */
  const alfabetos = (ps: readonly PacoteDeFatos[]) =>
    Object.fromEntries(ps.map((p) => [p.caderno, [...valoresDoPacote(p)].sort((a, b) => a - b).join(' ')]));

  it('existe em todo mês, e é o texto da estação daquele mês', () => {
    // Não basta existir: uma troca de "curtos" por "longos", ou uma luz presa em
    // "transição", produziria um texto sem dígito e igual nos quatro cadernos —
    // tudo o que as outras asserções pedem — dizendo ao modelo que dezembro é claro.
    for (const [ano, m] of MESES) {
      const ultimo = new Date(Date.UTC(ano, m, 0)).getUTCDate();
      const mm = String(m).padStart(2, '0');
      const esperado = TEXTO_DA_ESTACAO[estacaoDaLuz(`${ano}-${mm}-01`, `${ano}-${mm}-${ultimo}`)!];
      for (const p of montarPacotes(entradaDoMes(ano, m))) {
        assert.equal(p.periodo.luz, esperado, `${ano}-${m} ${p.caderno}`);
      }
    }
  });

  it('os doze meses com o texto LITERAL, nos cinco anos — não derivado da função', () => {
    // O teste acima confere a fiação (o pacote usa a estação calculada); este
    // confere a estação. Os dois juntos são o que o primeiro sozinho fingia ser.
    const ESPERADO = [
      'dias curtos', 'dias curtos', 'dias em transição', 'dias longos', 'dias longos', 'dias longos',
      'dias longos', 'dias longos', 'dias em transição', 'dias curtos', 'dias curtos', 'dias curtos',
    ];
    for (const ano of ANOS) {
      for (let m = 1; m <= 12; m += 1) {
        assert.equal(montarPacotes(entradaDoMes(ano, m))[0].periodo.luz, ESPERADO[m - 1], `${NOMES[m - 1]} de ${ano}`);
      }
    }
  });

  /*
   * O ALFABETO NÃO CONHECE A ESTAÇÃO — e esta é a guarda que não depende de chave.
   *
   * Uma versão anterior deste teste comparava cada pacote com ele mesmo "sem a
   * luz", tirando `periodo.luz` e os fatos de chave `luz`. A revisão devolveu as
   * horas de luz sob a chave `sol` e os 240 pacotes passaram: o teste só pegava
   * a luz voltando pelo nome que as tentativas revertidas usaram.
   *
   * Esta não pergunta o nome. Com o MESMO resumo, dois períodos do mesmo
   * comprimento e de estações diferentes têm que ter alfabetos idênticos —
   * janeiro (curtos) e julho (longos) têm 31 dias; o terceiro e o quarto
   * trimestres, 92. Se qualquer número sazonal entrar no pacote, sob qualquer
   * chave ou campo, os dois divergem.
   */
  it('meses do mesmo comprimento têm alfabetos IDÊNTICOS, qualquer que seja a estação', () => {
    for (const ano of ANOS) {
      const porComprimento = new Map<number, Array<[number, Record<string, string>]>>();
      for (let m = 1; m <= 12; m += 1) {
        const dias = new Date(Date.UTC(ano, m, 0)).getUTCDate();
        const lista = porComprimento.get(dias) ?? [];
        lista.push([m, alfabetos(montarPacotes(entradaDoMes(ano, m)))]);
        porComprimento.set(dias, lista);
      }
      for (const [dias, lista] of porComprimento) {
        const [m0, a0] = lista[0];
        for (const [m, a] of lista.slice(1)) {
          assert.deepEqual(a, a0, `${ano}: meses ${m0} e ${m} (${dias} dias) divergem — algo sazonal virou número`);
        }
      }
      // O teste só prova algo se o mesmo comprimento cobrir estações diferentes.
      const estacoesDe31 = new Set(
        (porComprimento.get(31) ?? []).map(([m]) => montarPacotes(entradaDoMes(ano, m))[0].periodo.luz),
      );
      assert.equal(estacoesDe31.size, 3, `${ano}: os meses de 31 dias deviam cobrir as três estações`);
    }
  });

  it('SEMANA: toda semana de 2023 a 2027 tem estação certa, e o alfabeto não a conhece', () => {
    // A tela abre na semana por padrão, e a matriz da spec tem uma linha para ela.
    let referencia: Record<string, string> | null = null;
    const vistas = new Set<string>();
    for (let t = Date.UTC(2023, 0, 2); t <= Date.UTC(2027, 11, 27); t += 7 * 86_400_000) {
      const ini = new Date(t).toISOString().slice(0, 10);
      const fim = new Date(t + 6 * 86_400_000).toISOString().slice(0, 10);
      const ps = montarPacotes(entradaDe('week', ini, fim, `${ini.slice(8)}/${ini.slice(5, 7)}`));
      const esperado = TEXTO_DA_ESTACAO[estacaoDaLuz(ini, fim)!];
      for (const p of ps) assert.equal(p.periodo.luz, esperado, `semana de ${ini}`);
      vistas.add(esperado);
      const a = alfabetos(ps);
      referencia ??= a;
      assert.deepEqual(a, referencia, `semana de ${ini}: o alfabeto mudou com a estação`);
    }
    assert.equal(vistas.size, 3, 'as semanas deviam cobrir as três estações');
  });

  it('TRIMESTRE: estação certa em todos, e o 3º e o 4º — 92 dias cada — têm o mesmo alfabeto', () => {
    const tri = (ano: number, q: number): readonly [string, string] => {
      const ini = `${ano}-${String(q * 3 - 2).padStart(2, '0')}-01`;
      const ultimo = new Date(Date.UTC(ano, q * 3, 0)).getUTCDate();
      return [ini, `${ano}-${String(q * 3).padStart(2, '0')}-${ultimo}`];
    };
    for (const ano of ANOS) {
      const porQ: Array<Record<string, string>> = [];
      for (let q = 1; q <= 4; q += 1) {
        const [ini, fim] = tri(ano, q);
        const ps = montarPacotes(entradaDe('season', ini, fim, `Q${q} ${ano}`));
        const esperado = TEXTO_DA_ESTACAO[estacaoDaLuz(ini, fim)!];
        for (const p of ps) assert.equal(p.periodo.luz, esperado, `Q${q} de ${ano}`);
        porQ.push(alfabetos(ps));
      }
      // Q3 (julho–setembro) é de dias longos, Q4 (outubro–dezembro) de curtos.
      assert.deepEqual(porQ[3], porQ[2], `${ano}: Q3 e Q4 têm 92 dias e alfabetos diferentes`);
    }
  });

  /*
   * A ASSINATURA DA PROCEDÊNCIA — a guarda que nem a isomorfia tinha.
   *
   * A isomorfia compara CONJUNTOS de valores entre estações, e por construção
   * não vê um número que não varie com a estação, nem um que coincida com um
   * valor que o caderno já tem. A revisão pôs uma luz constante de 11 no
   * Movimento — 11 é o valor de B1 das sessões de ciclismo — e tudo passou,
   * enquanto a quinta regra ficava desarmada para o 11 pela guarda de
   * ambiguidade.
   *
   * Esta conta ENTRADAS da procedência, não valores distintos, e lista as chaves.
   * Com o mesmo resumo, nenhuma das duas coisas depende do período — então elas
   * são literais, e qualquer número novo, sob qualquer chave, constante ou não,
   * colidindo ou não, muda a contagem.
   */
  const ASSINATURA: Record<string, readonly [number, readonly string[]]> = {
    sono: [13, ['', 'nota_sono', 'sono']],
    movimento: [61, [
      '', 'andares', 'atividades', 'ciclismo.distancia', 'ciclismo.elevacao', 'ciclismo.sessoes',
      'ciclismo.tempo', 'corrida.distancia', 'corrida.elevacao', 'corrida.sessoes', 'corrida.tempo',
      'distancia', 'passos_dia', 'tempo',
    ]],
    coracao: [11, ['', 'fcRepouso']],
    rotina: [14, ['', 'compras', 'gasto', 'nota_dia', 'tarefas']],
  };

  const confereAssinatura = (ps: readonly PacoteDeFatos[], onde: string) => {
    for (const p of ps) {
      const pr = procedenciaDoPacote(p);
      const [n, chaves] = ASSINATURA[p.caderno];
      assert.equal(pr.length, n, `${onde} ${p.caderno}: ${pr.length} entradas na procedência, eram ${n}`);
      assert.deepEqual([...new Set(pr.map((x) => x.chave))].sort(), [...chaves], `${onde} ${p.caderno}: chave nova`);
    }
  };

  it('a assinatura da procedência não muda — nos 60 meses, em toda semana e em todo trimestre', () => {
    for (const [ano, m] of MESES) confereAssinatura(montarPacotes(entradaDoMes(ano, m)), `${ano}-${m}`);
    for (let t = Date.UTC(2023, 0, 2); t <= Date.UTC(2027, 11, 27); t += 7 * 86_400_000) {
      const ini = new Date(t).toISOString().slice(0, 10);
      const fim = new Date(t + 6 * 86_400_000).toISOString().slice(0, 10);
      confereAssinatura(montarPacotes(entradaDe('week', ini, fim, ini)), `semana ${ini}`);
    }
    for (const ano of ANOS) {
      for (let q = 1; q <= 4; q += 1) {
        const ini = `${ano}-${String(q * 3 - 2).padStart(2, '0')}-01`;
        const ultimo = new Date(Date.UTC(ano, q * 3, 0)).getUTCDate();
        const fim = `${ano}-${String(q * 3).padStart(2, '0')}-${ultimo}`;
        confereAssinatura(montarPacotes(entradaDe('season', ini, fim, `Q${q} ${ano}`)), `Q${q} ${ano}`);
      }
    }
  });

  /*
   * A MESMA ASSINATURA COM AS LÁPIDES E COM A AMOSTRA SENTINELA (Story 1.7).
   *
   * Os três campos que a 1.7 trouxe — `amostra`, `comparavel` e a data da
   * lápide — são lidos só pelo ranqueamento e pelo prompt, e nunca pela
   * procedência. Esta é a prova no mesmo varredor da 1.6: as quatro mortes de
   * 2026 entram em todo período que as alcança (antigas ou do período), cada
   * fato leva `amostra: 777`, e a contagem de entradas e as chaves não mudam em
   * nenhum dos 60 meses, das semanas e dos trimestres.
   */
  it('a assinatura não muda com as quatro lápides e `amostra` sentinela — em todo período', () => {
    const sujar = (ps: readonly PacoteDeFatos[]) => ps.map((p) => ({
      ...p, metricas: p.metricas.map((f) => ({ ...f, amostra: 777, comparavel: false })),
    }));
    let comLapide = 0;
    const confere = (entrada: Parameters<typeof montarPacotes>[0], onde: string) => {
      const ps = sujar(montarPacotes({ ...entrada, lapides: LAPIDES_DE_2026 }));
      comLapide += ps.filter((p) => p.lapides.length > 0).length;
      confereAssinatura(ps, onde);
    };
    for (const [ano, m] of MESES) confere(entradaDoMes(ano, m), `${ano}-${m}`);
    for (let t = Date.UTC(2023, 0, 2); t <= Date.UTC(2027, 11, 27); t += 7 * 86_400_000) {
      const ini = new Date(t).toISOString().slice(0, 10);
      const fim = new Date(t + 6 * 86_400_000).toISOString().slice(0, 10);
      confere(entradaDe('week', ini, fim, ini), `semana ${ini}`);
    }
    for (const ano of ANOS) {
      for (let q = 1; q <= 4; q += 1) {
        const ini = `${ano}-${String(q * 3 - 2).padStart(2, '0')}-01`;
        const ultimo = new Date(Date.UTC(ano, q * 3, 0)).getUTCDate();
        const fim = `${ano}-${String(q * 3).padStart(2, '0')}-${ultimo}`;
        confere(entradaDe('season', ini, fim, `Q${q} ${ano}`), `Q${q} ${ano}`);
      }
    }
    // Sem isto a varredura podia passar sem lápide nenhuma no pacote.
    assert.ok(comLapide > 100, `só ${comLapide} pacotes carregaram lápide — a varredura não mediu nada`);
  });

  it('a luz não é fato de caderno: nem em `metricas`, nem em `textos`, nem em `tendencias`', () => {
    for (const [ano, m] of MESES) {
      for (const p of montarPacotes(entradaDoMes(ano, m))) {
        const chaves = [...p.metricas, ...p.textos, ...p.tendencias].map((x) => x.chave);
        assert.deepEqual(chaves.filter((c) => /luz/i.test(c)), [], `${ano}-${m} ${p.caderno}`);
      }
    }
  });

  it('está nos QUATRO pacotes, e é o mesmo texto', () => {
    for (const [ano, m] of MESES) {
      const luzes = montarPacotes(entradaDoMes(ano, m)).map((p) => p.periodo.luz);
      assert.equal(luzes.length, 4);
      assert.equal(new Set(luzes).size, 1, `${ano}-${m}: cadernos discordam da luz`);
    }
  });

  it('nem o campo nem o CABEÇALHO INTEIRO têm número de luz — em nenhum mês', () => {
    // O cabeçalho é por onde a luz chega ao modelo. Cobrar só a linha "Luz do
    // dia:" deixava passar uma segunda linha "Sol: 14,5 h" ou as horas coladas
    // no fim da linha do Período — a revisão fez as duas coisas e passou.
    // Do cabeçalho saem só o rótulo, as datas ISO e a contagem de dias, que são
    // do período e não da luz; o que sobra não pode ter dígito nenhum.
    for (const [ano, m] of MESES) {
      const ps = montarPacotes(entradaDoMes(ano, m));
      assert.equal(/\d/.test(ps[0].periodo.luz!), false, `${ano}-${m}: "${ps[0].periodo.luz}"`);
      const { usuario } = montarPromptDaEdicao(ps);
      // A primeira linha é o título, e ele tem o ano — por isso sai da varredura.
      // Mas sai porque é EXATAMENTE o título: pulá-la sem conferir deixava passar
      // `# Julho 2026 · 16,0 h de luz`, e a revisão fez isso com a suíte verde.
      const [titulo, ...demais] = usuario.split('\n###')[0].split('\n');
      assert.equal(titulo, `# ${ps[0].periodo.rotulo}`, `${ano}-${m}: o título ganhou algo além do rótulo`);
      const cabecalho = demais.join('\n');
      assert.ok(cabecalho.includes('Luz do dia:'), `${ano}-${m}: a linha da luz não saiu`);
      const resto = cabecalho.replace(/\d{4}-\d{2}-\d{2}/g, '').replace(/\(\d+ dias\)/g, '');
      assert.equal(/\d/.test(resto), false, `${ano}-${m}: número no cabeçalho:\n${cabecalho}`);
    }
  });

  it('ano e histórico completo não têm estação — `null`, declarado', () => {
    for (const ano of ANOS) {
      const r = { ...agosto(), kind: 'year' as const, label: String(ano), startISO: `${ano}-01-01`, endISO: `${ano}-12-31` };
      for (const p of montarPacotes({ resumo: r as RetroSummary, agora: AGORA })) {
        assert.equal(p.periodo.luz, null, `${ano}: um ano cobre todas as estações`);
      }
    }
    const tudo = { ...agosto(), kind: 'all' as const, label: 'Tudo', startISO: '2023-05-22', endISO: '2026-09-06' };
    for (const p of montarPacotes({ resumo: tudo as RetroSummary, agora: AGORA })) {
      assert.equal(p.periodo.luz, null);
    }
  });

  it('no prompt que a PRODUÇÃO manda, caderno vazio não aparece e a luz sai uma vez', () => {
    // `montarPromptDaEdicao` é o grão que o celular usa até a Story 1.10. A
    // tentativa anterior só protegia `montarPrompt`, e na edição real cada
    // caderno vazio voltava à vida carregando a luz — quatro vezes.
    const vazio = { ...agosto(), health: [], ratings: { sleep: null, day: metrica(4.0, 3.82, 30) } };
    for (const [ano, m] of MESES) {
      const pacotes = montarPacotes({ ...entradaDoMes(ano, m, vazio as RetroSummary), coberturaSono: undefined });
      const { usuario } = montarPromptDaEdicao(pacotes);
      assert.equal(usuario.includes('### Sono'), false, `${ano}-${m}: Sono vazio apareceu`);
      assert.equal(usuario.includes('### Coração'), false, `${ano}-${m}: Coração vazio apareceu`);
      assert.equal(usuario.split('Luz do dia:').length - 1, 1, `${ano}-${m}: a luz não saiu exatamente uma vez`);
    }
  });

  /*
   * A COSTURA COM O RANQUEAMENTO, sobre as fixtures deste arquivo (Story 1.7):
   * quem está na ordem da edição é exatamente quem tem prompt e bloco. Os 60
   * meses, com o resumo cheio e com o de Sono e Coração vazios, sem e com as
   * quatro lápides — o que põe julho/2026 com o Coração vazio ressuscitado pela
   * morte do mês, e todo mês depois dele com lápide antiga que não ressuscita.
   */
  it('a ordem e os dois prompts concordam sobre quem está na edição — nos 60 meses', () => {
    const vazio = { ...agosto(), health: [], ratings: { sleep: null, day: metrica(4.0, 3.82, 30) } } as RetroSummary;
    let fora = 0;
    for (const [ano, m] of MESES) {
      for (const resumo of [agosto(), vazio]) {
        for (const lapides of [[], LAPIDES_DE_2026]) {
          const ps = montarPacotes({ ...entradaDoMes(ano, m, resumo), coberturaSono: undefined, lapides });
          const ordem = ordenarCadernos(ps);
          const edicao = montarPromptDaEdicao(ps).usuario;
          for (const p of ps) {
            const dentro = ordem.includes(p.caderno);
            if (!dentro) fora += 1;
            assert.equal(montarPrompt(p).usuario !== '', dentro, `${ano}-${m} ${p.caderno}: ordem × prompt`);
            assert.equal(new RegExp(`^### ${p.rotulo}$`, 'm').test(edicao), dentro, `${ano}-${m} ${p.caderno}: ordem × bloco`);
          }
        }
      }
    }
    assert.ok(fora > 200, `só ${fora} cadernos fora da ordem — a costura mediu um lado só`);
  });

  it('`semDado` não muda por causa da luz — caderno vazio segue vazio', () => {
    // Um mês sem nenhuma métrica de saúde nem nota: Sono e Coração ficam vazios.
    const vazio = { ...agosto(), health: [], ratings: { sleep: null, day: metrica(4.0, 3.82, 30) } };
    for (const [ano, m] of MESES) {
      const c = porCaderno(montarPacotes({ ...entradaDoMes(ano, m, vazio as RetroSummary), coberturaSono: undefined }));
      assert.equal(c.sono.semDado, true, `${ano}-${m}: a luz encheu o Sono`);
      assert.equal(c.coracao.semDado, true, `${ano}-${m}: a luz encheu o Coração`);
      assert.ok(c.sono.periodo.luz, 'e a luz continua lá — só não conta como conteúdo');
    }
  });
});

/*
 * ── A AMOSTRA E O PORTÃO DE NASCIMENTO (Story 1.7) ──
 *
 * `amostra` e `comparavel` existem só para o ranqueamento. Quem decide cada um é
 * quem produz o fato, porque só ali se sabe de onde o número veio — e é isso que
 * estes testes conferem, produtor a produtor.
 */

/** Um hábito como o `retro.ts` o entrega — só o que o pacote lê importa aqui. */
function linhaDeHabito(id: string, atual: number, anterior: number, createdOn?: string): RetroHabitRow {
  return {
    id, name: id, bad: false, unit: '',
    recap: recap(atual, anterior), total: recap(atual, anterior), perDay: 0, perDayDays: 0,
    ...(createdOn ? { createdOn } : {}),
  };
}

function linhaDeRegistro(id: string, atual: number, anterior: number, createdOn?: string): RetroRegistroRow {
  return { id, name: id, recap: recap(atual, anterior), everyDays: 0, ...(createdOn ? { createdOn } : {}) };
}

describe('amostra — o menor lado da comparação com B1, decidido por quem produz o fato', () => {
  const c = porCaderno(montarPacotes(ENTRADA_AGOSTO));
  const amostra = (p: PacoteDeFatos, chave: string) => {
    const f = fato(p, chave);
    assert.ok(f, `o fixture perdeu "${chave}"`);
    return f.amostra;
  };

  it('a contagem é a própria contagem; o tempo do caderno, as atividades', () => {
    // 21 atividades contra 17: o lado fino tem 17. Toda atividade tem tempo.
    assert.equal(amostra(c.movimento, 'atividades'), 17);
    assert.equal(amostra(c.movimento, 'tempo'), 17);
  });

  it('a distância do caderno conta só as atividades COM distância — e sem a contagem, não se sabe', () => {
    // O agosto real não traz o total de atividades com distância: `null`, que não
    // disputa. Nunca as 17 atividades — ioga e força não têm quilômetro.
    assert.equal(amostra(c.movimento, 'distancia'), null);
    // A linha "Distância sem base" da matriz, com os números DELA: fevereiro →
    // março/2026, 8 → 24 atividades, 2 → 17 com distância.
    const marco = montarPacote({
      resumo: {
        ...agosto(), label: 'Março 2026', startISO: '2026-03-01', endISO: '2026-03-31',
        fitness: { ...agosto().fitness, count: recap(24, 8), countWithDistance: recap(17, 2) },
      } as RetroSummary,
      agora: AGORA,
    }, 'movimento');
    assert.equal(amostra(marco, 'distancia'), 2, 'o lado de fevereiro tem 2 atividades com distância');
    assert.equal(amostra(marco, 'atividades'), 8, 'e 8 atividades — a contagem é outra coisa');
    assert.equal(amostra(marco, 'tempo'), 8, 'toda atividade tem tempo');
  });

  it('num esporte, a distância tem a amostra das sessões COM distância; o tempo, a de todas', () => {
    // A linha de agosto da matriz: 333 km de bicicleta em 7 saídas é um fato
    // sobre 7 observações; os +381% da corrida saem de 2 saídas em julho.
    for (const k of ['sessoes', 'distancia', 'tempo']) {
      assert.equal(amostra(c.movimento, `ciclismo.${k}`), 7, `ciclismo.${k}`);
      assert.equal(amostra(c.movimento, `corrida.${k}`), 2, `corrida.${k}`);
    }
    // Um rolo sem sensor é sessão de ciclismo sem quilômetro.
    const s = agosto();
    const comRolo = montarPacote({
      resumo: {
        ...s,
        sports: { ...s.sports, cycling: { ...s.sports.cycling!, sessions: recap(12, 11), sessionsWithDistance: recap(6, 11) } },
      } as RetroSummary,
      agora: AGORA,
    }, 'movimento');
    assert.equal(amostra(comRolo, 'ciclismo.distancia'), 6);
    assert.equal(amostra(comRolo, 'ciclismo.tempo'), 11);
    // Sem a contagem com distância, a distância do esporte não se sabe.
    const semContagem = montarPacote({
      resumo: {
        ...s,
        sports: { ...s.sports, cycling: { ...s.sports.cycling!, sessionsWithDistance: undefined } },
      } as RetroSummary,
      agora: AGORA,
    }, 'movimento');
    assert.equal(amostra(semContagem, 'ciclismo.distancia'), null);
  });

  it('a elevação nunca tem amostra — a rota que não sincronizou não é notícia', () => {
    assert.equal(amostra(c.movimento, 'ciclismo.elevacao'), null);
    assert.equal(amostra(c.movimento, 'corrida.elevacao'), null);
  });

  it('passos e andares: ninguém sabe quantos dias os produziram — `null`', () => {
    assert.equal(amostra(c.movimento, 'passos_dia'), null);
    assert.equal(amostra(c.movimento, 'andares'), null);
  });

  it('saúde e notas: os dias com valor de cada lado — sem `nAnterior`, não se sabe', () => {
    // O agosto real foi capturado antes de `nAnterior` existir. O lado de julho é
    // desconhecido, e desconhecido é null — nem zero, nem "o mesmo n".
    const semAnterior = [
      [c.sono, 'sono'], [c.sono, 'nota_sono'], [c.coracao, 'fcRepouso'], [c.rotina, 'nota_dia'],
    ] as const;
    for (const [p, k] of semAnterior) assert.equal(amostra(p, k), null, k);

    const s = agosto();
    const comAnterior = porCaderno(montarPacotes({
      resumo: {
        ...s,
        health: [
          { ...s.health[0], recap: { ...s.health[0].recap, nAnterior: 14 } },
          { ...s.health[1], recap: { ...s.health[1].recap, nAnterior: 31 } },
        ],
        ratings: {
          sleep: { ...s.ratings.sleep!, nAnterior: 12 },
          day: { ...s.ratings.day!, nAnterior: 31 },
        },
      } as RetroSummary,
      agora: AGORA,
    }));
    assert.equal(amostra(comAnterior.sono, 'sono'), 14, '27 noites contra 14: o lado fino tem 14');
    assert.equal(amostra(comAnterior.coracao, 'fcRepouso'), 29, '29 dias contra 31');
    assert.equal(amostra(comAnterior.sono, 'nota_sono'), 12);
    assert.equal(amostra(comAnterior.rotina, 'nota_dia'), 30);
  });

  it('tarefas e compras pela própria contagem; o gasto, pelas compras COM PREÇO', () => {
    const comPreco = (countWithPrice?: RecapValue) => montarPacote({
      resumo: {
        ...agosto(),
        tasks: { total: recap(44, 39), byModule: [] },
        purchases: {
          count: recap(9, 6), spend: recap(214.5, 180), byCat: [],
          ...(countWithPrice ? { countWithPrice } : {}),
        },
      } as RetroSummary,
      agora: AGORA,
    }, 'rotina');
    const p = comPreco(recap(9, 5));
    assert.equal(amostra(p, 'tarefas'), 39);
    assert.equal(amostra(p, 'compras'), 6);
    assert.equal(amostra(p, 'gasto'), 5, 'o gasto é soma das compras com preço — cinco, e não 180 euros nem 6 compras');
    assert.equal(amostra(comPreco(), 'gasto'), null, 'sem a contagem das compras com preço, o gasto não se sabe');
    assert.equal(amostra(comPreco(), 'compras'), 6, 'as compras continuam com a própria contagem');
  });

  it('8 compras com 1 preço: o "gasto +1780%" tem amostra 1, e não 8', () => {
    // O caso da revisão 2: compra sem preço não carrega gasto. Pela régua da
    // iteração 1 (a contagem de compras) este gasto passava no portão com 8.
    const p = montarPacote({
      resumo: {
        ...agosto(),
        purchases: { count: recap(8, 8), spend: recap(18.8, 1), countWithPrice: recap(1, 8), byCat: [] },
      } as RetroSummary,
      agora: AGORA,
    }, 'rotina');
    const gasto = fato(p, 'gasto');
    assert.equal(gasto?.bases[0].deltaPct, 1780);
    assert.equal(gasto?.amostra, 1);
    assert.equal(amostra(p, 'compras'), 8);
  });

  it('hábito e registro: os dias de cada lado', () => {
    const p = montarPacote({
      resumo: {
        ...agosto(),
        habits: { good: [linhaDeHabito('cafe', 26, 11)], bad: [] },
        registros: [linhaDeRegistro('corte', 1, 2)],
      } as RetroSummary,
      agora: AGORA,
    }, 'rotina');
    assert.equal(amostra(p, 'habito.cafe'), 11);
    assert.equal(amostra(p, 'registro.corte'), 1);
  });

  it('o histórico completo não tem anterior, e por isso não tem lado menor', () => {
    const tudo = { ...agosto(), kind: 'all' as const, label: 'Tudo', startISO: '2000-01-01' };
    for (const p of montarPacotes({ resumo: tudo as RetroSummary, agora: AGORA })) {
      for (const f of p.metricas) assert.equal(f.amostra, null, `${p.caderno}/${f.chave}`);
    }
  });
});

describe('comparavel — o portão de nascimento', () => {
  // Junho/2026, cujo anterior começa em 01/05. O caso real da spec: os hábitos
  // nasceram em 20/05, e junho abriria com "Café +136%" sobre 11 dias de maio.
  const junho = (habitos: RetroHabitRow[], registros: RetroRegistroRow[] = []) => montarPacote({
    resumo: {
      ...agosto(), label: 'Junho 2026', startISO: '2026-06-01', endISO: '2026-06-30',
      habits: { good: habitos, bad: [] }, registros,
    } as RetroSummary,
    agora: AGORA,
  }, 'rotina');

  it('hábito criado depois do início do anterior não compara — e o N não o barraria', () => {
    const f = fato(junho([linhaDeHabito('cafe', 26, 11, '2026-05-20')]), 'habito.cafe');
    assert.ok(f);
    assert.equal(f.comparavel, false);
    assert.ok(f.amostra != null && f.amostra >= 7, 'a amostra passaria sozinha — é o nascimento que barra');
  });

  it('nascido NO primeiro dia do anterior ainda cobre o anterior inteiro; no segundo, não — em todo fuso', () => {
    // A fronteira é `previousPeriodStartISO`, que é data LOCAL. Em UTC, um início
    // do anterior formatado com `toISOString()` sairia certo por sorte; em
    // Bruxelas ele vira 30/04, e o hábito criado em 01/05 deixa de comparar.
    emCadaFuso((tz) => {
      const comparavel = (createdOn: string) =>
        fato(junho([linhaDeHabito('cafe', 26, 20, createdOn)]), 'habito.cafe')?.comparavel;
      assert.equal(comparavel('2026-05-01'), true, `${tz}: nascido no primeiro dia`);
      assert.equal(comparavel('2026-05-02'), false, `${tz}: nascido no segundo dia`);
      assert.equal(comparavel('2026-04-30'), true, `${tz}: nascido na véspera`);
      assert.equal(comparavel('2025-01-10'), true, tz);
      assert.equal(comparavel('2026-06-15'), false, `${tz}: nascido dentro do período corrente, pior ainda`);
    });
  });

  it('sem data de criação, não há o que amputar', () => {
    assert.equal(fato(junho([linhaDeHabito('cafe', 26, 20)]), 'habito.cafe')?.comparavel, true);
  });

  it('data de criação que não é YYYY-MM-DD de calendário é "não se sabe" — e não passa', () => {
    // Cair em comparável seria o silêncio decidindo a favor da manchete:
    // "20/05/2026" comparado como texto contra "2026-05-01" sai maior sempre.
    const comparavel = (createdOn: string) =>
      fato(junho([linhaDeHabito('cafe', 26, 20, createdOn)]), 'habito.cafe')?.comparavel;
    for (const mau of ['20/05/2026', '2026-5-20', '2026-02-30', '2026-13-01', 'ontem']) {
      assert.equal(comparavel(mau), false, `"${mau}" passou como comparável`);
    }
    // Carimbo com hora também não, nem de um hábito velho: cortado, ele é o dia
    // UTC, e a fronteira do anterior é o dia LOCAL — `…T22:30:00Z` em Bruxelas é
    // o dia seguinte. A camada de dados já entrega o dia local
    // (`localDateStr(new Date(created_at))`); o carimbo cru é outra origem.
    assert.equal(comparavel('2025-01-10T09:30:00.000Z'), false);
    assert.equal(comparavel('2026-04-30T22:30:00Z'), false);
  });

  it('período com anterior cujo início não se sabe: não passa; sem anterior (`all`), passa', () => {
    const habito = linhaDeHabito('cafe', 30, 20, '2025-01-10');
    const comStart = (kind: RetroSummary['kind'], startISO: string) => montarPacote({
      resumo: { ...agosto(), kind, startISO, habits: { good: [habito], bad: [] } } as RetroSummary,
      agora: AGORA,
    }, 'rotina');
    // Um início ilegível: o período tem anterior (B1 existe), e não se sabe onde
    // ele começa — há um lado a amputar, e não dá para dizer se amputou.
    assert.equal(fato(comStart('month', 'sem-data'), 'habito.cafe')?.comparavel, false);
    // O histórico completo não tem anterior: não há o que amputar.
    assert.equal(fato(comStart('all', '2000-01-01'), 'habito.cafe')?.comparavel, true);
  });

  it('vale para registro também', () => {
    const p = junho([], [
      linhaDeRegistro('corte', 2, 1, '2026-06-03'),
      linhaDeRegistro('dentista', 1, 1, '2024-02-01'),
    ]);
    assert.equal(fato(p, 'registro.corte')?.comparavel, false);
    assert.equal(fato(p, 'registro.dentista')?.comparavel, true);
  });

  it('todo o resto do pacote compara — só o que nasce tem data de nascimento', () => {
    for (const p of montarPacotes(ENTRADA_AGOSTO)) {
      for (const f of p.metricas) assert.equal(f.comparavel, true, `${p.caderno}/${f.chave}`);
    }
  });
});

/*
 * O CAMINHO INTEIRO: do `RetroInput` ao fato.
 *
 * `createdOn` e `nAnterior` nascem em `retro.ts` e `week/recap.ts` e são lidos em
 * `ia/pacote.ts`. Os testes acima montam o `RetroSummary` à mão; este passa pelo
 * `buildRetrospective` de verdade, para que apagar a cópia de um dos dois campos
 * reprove aqui e não só na tela.
 */
describe('do `buildRetrospective` ao fato — `createdOn`, `nAnterior` e as atividades com distância chegam', () => {
  const dias = (mes: string, de: number, ate: number) =>
    Array.from({ length: ate - de + 1 }, (_, i) => `2026-${mes}-${String(de + i).padStart(2, '0')}`);
  let seq = 0;
  const atividade = (dia: string, activityId: number, distanceM?: number): Activity => ({
    id: `a${seq += 1}`, userId: 'u', activityId, calories: 0,
    startAt: `${dia}T08:00:00`, endAt: `${dia}T09:00:00`, durationS: 3600,
    ...(distanceM != null ? { distanceM } : {}),
    hasRoute: distanceM != null,
  });
  // Café: nasce em 20/05 e é marcado de 20 a 30 de maio (11 dias) e de 1º a 26 de
  // junho (26). FC: 10 dias medidos em maio, 25 em junho. Notas: 12 e 9 dias de
  // sono, 20 e 28 do dia. Atividades: maio tem 2 pedaladas e 1 ioga; junho tem 3
  // pedaladas (uma num rolo sem distância), 1 corrida e 2 iogas.
  const IOGA = 57;   // `fitness/activity-types.ts`: 57 é Yoga
  const resumo = buildRetrospective({
    now: new Date('2026-07-06T12:00:00'),
    kind: 'month',
    offset: -1,
    activities: [
      atividade('2026-05-04', 13, 40_000), atividade('2026-05-11', 13, 55_000), atividade('2026-05-12', IOGA),
      atividade('2026-06-02', 13, 38_000), atividade('2026-06-09', 13, 61_000), atividade('2026-06-10', 13, 0),
      atividade('2026-06-14', 37, 10_000), atividade('2026-06-15', IOGA), atividade('2026-06-22', IOGA),
    ],
    ratingsSleep: new Map([...dias('05', 1, 12), ...dias('06', 1, 9)].map((d) => [d, 4])),
    ratingsDay: new Map([...dias('05', 1, 20), ...dias('06', 1, 28)].map((d) => [d, 3])),
    health: [{
      metric: 'fcRepouso', label: 'FC de repouso', higherIsWorse: true, icon: 'heart' as never,
      decimals: 1, unit: 'bpm',
      valuesByDay: new Map([...dias('05', 1, 10), ...dias('06', 1, 25)].map((d) => [d, 50])),
    }],
    habits: [
      {
        id: 'cafe', name: 'Café', bad: false, createdOn: '2026-05-20',
        logsByDay: new Map([...dias('05', 20, 30), ...dias('06', 1, 26)].map((d) => [d, 1])),
      },
      { id: 'agua', name: 'Água', bad: false, logsByDay: new Map(dias('06', 1, 3).map((d) => [d, 1])) },
    ],
    registros: [{ id: 'corte', name: 'Corte', days: ['2026-05-25', '2026-06-20'], createdOn: '2026-05-24' }],
    tasks: [],
    // O caso da revisão 2: 8 compras em maio, todas com preço (€ 0,125 cada —
    // € 1 no total); 8 em junho, e só uma com preço (€ 18,80). "Gasto +1780%".
    purchases: [
      ...dias('05', 1, 8).map((d) => ({ doneDay: d, name: 'pão', price: 0.125 })),
      ...dias('06', 1, 7).map((d) => ({ doneDay: d, name: 'sem nota' })),
      { doneDay: '2026-06-08', name: 'mercado', price: 18.8 },
    ],
  });

  it('a linha do hábito e a do registro trazem a data de criação — e só quando ela existe', () => {
    assert.equal(resumo.label, 'Junho 2026', 'o fixture caiu em outro mês');
    const cafe = resumo.habits.good.find((h) => h.id === 'cafe');
    const agua = resumo.habits.good.find((h) => h.id === 'agua');
    assert.equal(cafe?.createdOn, '2026-05-20');
    assert.ok(agua && !('createdOn' in agua), 'sem data, a chave não nasce — `undefined` mudaria a forma da linha');
    assert.equal(resumo.registros[0].createdOn, '2026-05-24');
  });

  it('o recap de saúde traz os dias dos DOIS lados', () => {
    assert.equal(resumo.health[0].recap.n, 25);
    assert.equal(resumo.health[0].recap.nAnterior, 10);
  });

  it('as notas de sono e do dia também trazem os dois lados', () => {
    assert.equal(resumo.ratings.sleep?.n, 9);
    assert.equal(resumo.ratings.sleep?.nAnterior, 12);
    assert.equal(resumo.ratings.day?.n, 28);
    assert.equal(resumo.ratings.day?.nAnterior, 20);
  });

  it('as atividades com distância são contadas dos dois lados — no total e por esporte', () => {
    // Junho: 6 atividades, 3 com distância (duas pedaladas e a corrida; o rolo
    // e as iogas não). Maio: 3 atividades, 2 com distância.
    assert.deepEqual([resumo.fitness.count.current, resumo.fitness.count.prior], [6, 3]);
    assert.deepEqual(
      [resumo.fitness.countWithDistance?.current, resumo.fitness.countWithDistance?.prior], [3, 2],
    );
    const bike = resumo.sports.cycling;
    assert.deepEqual([bike?.sessions.current, bike?.sessions.prior], [3, 2]);
    assert.deepEqual([bike?.sessionsWithDistance?.current, bike?.sessionsWithDistance?.prior], [2, 2]);
    assert.deepEqual(
      [resumo.sports.running?.sessionsWithDistance?.current, resumo.sports.running?.sessionsWithDistance?.prior], [1, 0],
    );
  });

  it('as compras com preço são contadas dos dois lados', () => {
    assert.deepEqual([resumo.purchases.count.current, resumo.purchases.count.prior], [8, 8]);
    assert.deepEqual([resumo.purchases.countWithPrice?.current, resumo.purchases.countWithPrice?.prior], [1, 8]);
  });

  it('e o pacote os lê: o café não compara, e cada amostra conta quem carrega a medida', () => {
    const c = porCaderno(montarPacotes({ resumo, agora: AGORA }));
    const cafe = fato(c.rotina, 'habito.cafe');
    assert.equal(cafe?.amostra, 11);
    assert.equal(cafe?.comparavel, false);
    assert.equal(fato(c.rotina, 'registro.corte')?.comparavel, false);
    assert.equal(fato(c.coracao, 'fcRepouso')?.amostra, 10);
    assert.equal(fato(c.sono, 'nota_sono')?.amostra, 9);
    assert.equal(fato(c.rotina, 'nota_dia')?.amostra, 20);
    assert.equal(fato(c.movimento, 'atividades')?.amostra, 3);
    assert.equal(fato(c.movimento, 'distancia')?.amostra, 2, 'as iogas não sustentam a distância');
    assert.equal(fato(c.movimento, 'ciclismo.distancia')?.amostra, 2, 'o rolo não sustenta a distância');
    assert.equal(fato(c.movimento, 'ciclismo.tempo')?.amostra, 2);
    assert.equal(fato(c.movimento, 'ciclismo.elevacao')?.amostra, null);
    const gasto = fato(c.rotina, 'gasto');
    assert.equal(gasto?.bases[0].deltaPct, 1780);
    assert.equal(gasto?.amostra, 1, '"gasto +1780%" apoiado numa compra com preço, não em oito');
    assert.equal(fato(c.rotina, 'compras')?.amostra, 8);
  });
});

describe('`metricRecap` semanal também devolve os dois lados', () => {
  it('`n` é a semana corrente, `nAnterior` a anterior', () => {
    // Quarta, 10/06/2026: a semana vai de 08 a 14/06; a anterior, de 01 a 07/06.
    const valores = new Map<string, number>([
      ['2026-06-08', 50], ['2026-06-09', 52],
      ['2026-06-01', 49], ['2026-06-03', 51], ['2026-06-05', 50],
    ]);
    const r = metricRecap(valores, new Date('2026-06-10T12:00:00'));
    assert.equal(r.n, 2);
    assert.equal(r.nAnterior, 3);
    // E sem nada na semana corrente, o lado anterior continua contado.
    const soAnterior = metricRecap(new Map([['2026-06-03', 51]]), new Date('2026-06-10T12:00:00'));
    assert.equal(soAnterior.current, null);
    assert.equal(soAnterior.nAnterior, 1);
  });
});

/* ── a lápide na montagem ── */

describe('a lápide na montagem', () => {
  const doMes = (label: string, startISO: string, endISO: string, resumo: RetroSummary = agosto()) => ({
    resumo: { ...resumo, label, startISO, endISO } as RetroSummary, agora: AGORA,
  });
  const JULHO = doMes('Julho 2026', '2026-07-01', '2026-07-31');
  const SETEMBRO = doMes('Setembro 2026', '2026-09-01', '2026-09-30');

  it('cada lápide cai no caderno do MAPA — VO₂max em Movimento, não em Coração', () => {
    const c = porCaderno(montarPacotes({ ...JULHO, lapides: LAPIDES_DE_2026 }));
    assert.deepEqual(c.movimento.lapides.map((l) => l.metrica), ['vo2max']);
    assert.deepEqual(c.coracao.lapides.map((l) => l.metrica), ['respiracao', 'spo2']);
    assert.deepEqual(c.sono.lapides, []);
    assert.deepEqual(c.rotina.lapides, []);
  });

  it('morte posterior ao fim do período fica fora — em julho, os anéis de 17/08 ainda viviam', () => {
    const metricas = (e: typeof JULHO) =>
      montarPacotes({ ...e, lapides: LAPIDES_DE_2026 }).flatMap((p) => p.lapides.map((l) => l.metrica)).sort();
    assert.deepEqual(metricas(JULHO), ['respiracao', 'spo2', 'vo2max']);
    assert.deepEqual(metricas({ resumo: agosto(), agora: AGORA }), ['aneis', 'respiracao', 'spo2', 'vo2max']);
    assert.deepEqual(metricas(SETEMBRO), ['aneis', 'respiracao', 'spo2', 'vo2max']);
    assert.deepEqual(metricas(doMes('Junho 2026', '2026-06-01', '2026-06-30')), [], 'junho não viu morte nenhuma');
  });

  it('é do período quando a última medida cai dentro dele — os dois extremos inclusivos', () => {
    const periodo = { inicioISO: '2026-07-01', fimISO: '2026-07-31' };
    const em = (d: string) => lapideDoPeriodo({ metrica: 'spo2', ultimaMedidaISO: d }, periodo);
    assert.equal(em('2026-07-01'), true);
    assert.equal(em('2026-07-31'), true);
    assert.equal(em('2026-06-30'), false);
    assert.equal(em('2026-08-01'), false);
  });

  it('ordenada pela data, qualquer que seja a ordem da entrada', () => {
    const a = montarPacotes({ ...SETEMBRO, lapides: LAPIDES_DE_2026 });
    const b = montarPacotes({ ...SETEMBRO, lapides: [...LAPIDES_DE_2026].reverse() });
    assert.deepEqual(a.map((p) => p.lapides), b.map((p) => p.lapides));
    assert.deepEqual(porCaderno(a).movimento.lapides.map((l) => l.metrica), ['vo2max', 'aneis']);
  });

  it('`semDado` conta a lápide do período e ignora a antiga', () => {
    // Um Coração sem FC nenhuma — só as lápides de respiração e SpO₂, de julho.
    const semFc = { ...agosto(), health: agosto().health.filter((h) => h.metric !== 'fcRepouso') } as RetroSummary;
    const julho = porCaderno(montarPacotes({
      ...doMes('Julho 2026', '2026-07-01', '2026-07-31', semFc), lapides: LAPIDES_DE_2026,
    }));
    assert.deepEqual(julho.coracao.metricas, []);
    assert.equal(julho.coracao.semDado, false, 'a morte de julho enche o Coração de julho');
    assert.equal(cadernoVazio(julho.coracao), false);

    const setembro = porCaderno(montarPacotes({
      ...doMes('Setembro 2026', '2026-09-01', '2026-09-30', semFc), lapides: LAPIDES_DE_2026,
    }));
    assert.equal(setembro.coracao.lapides.length, 2, 'as antigas continuam no pacote');
    assert.equal(setembro.coracao.semDado, true, 'mas não enchem o caderno — sensor morto não ressuscita sozinho');
    assert.equal(cadernoVazio(setembro.coracao), true);
  });

  it('`cadernoVazio` guarda a precedência mesmo com `semDado` montado errado à mão', () => {
    const semFc = { ...agosto(), health: agosto().health.filter((h) => h.metric !== 'fcRepouso') } as RetroSummary;
    const coracao = porCaderno(montarPacotes({
      ...doMes('Julho 2026', '2026-07-01', '2026-07-31', semFc), lapides: LAPIDES_DE_2026,
    })).coracao;
    assert.equal(cadernoVazio({ ...coracao, semDado: true }), false, 'a lápide do mês em que morreu não se cala');
  });

  it('sem `lapides` na entrada — o que o celular manda hoje —, a lista vem vazia em todo caderno', () => {
    for (const p of montarPacotes(ENTRADA_AGOSTO)) assert.deepEqual(p.lapides, []);
  });

  it('entrada malformada explode, em vez de virar texto sem sentido no prompt', () => {
    const com = (lapides: readonly FatoLapide[]) => () => montarPacotes({ ...JULHO, lapides });
    // Forma errada, e forma certa com calendário impossível: o mês 13 estourava
    // com erro de tipo em `dataPorExtenso`, e 30/02 virava "30 de fevereiro".
    for (const d of ['16/07/2026', '2026-7-16', '2026-13-01', '2026-02-30', '2026-00-10', '2026-06-31']) {
      assert.throws(com([{ metrica: 'spo2', ultimaMedidaISO: d }]), /data impossível/, d);
    }
    assert.doesNotThrow(com([{ metrica: 'spo2', ultimaMedidaISO: '2024-02-29' }]), 'o 29 de fevereiro bissexto existe');
    assert.throws(
      com([{ metrica: 'spo2', ultimaMedidaISO: '2026-07-16' }, { metrica: 'spo2', ultimaMedidaISO: '2026-07-17' }]),
      /repetida/,
    );
    assert.throws(com([{ metrica: 'vfc' as never, ultimaMedidaISO: '2026-07-16' }]), /fora do catálogo/);
  });

  it('duas lápides do mesmo caderno no MESMO dia: o pacote e o prompt não dependem da ordem da entrada', () => {
    // A chave secundária do sort é a ordem do mapa — sem ela, a ordem de quem
    // chamou vazaria para o pacote e para o texto que o modelo lê.
    const mesmoDia: readonly FatoLapide[] = [
      { metrica: 'spo2', ultimaMedidaISO: '2026-07-16' },
      { metrica: 'respiracao', ultimaMedidaISO: '2026-07-16' },
    ];
    const coracao = (lapides: readonly FatoLapide[]) =>
      porCaderno(montarPacotes({ ...JULHO, lapides })).coracao;
    const a = coracao(mesmoDia);
    const b = coracao([...mesmoDia].reverse());
    assert.deepEqual(a.lapides.map((l) => l.metrica), ['respiracao', 'spo2'], 'a ordem do mapa desempata');
    assert.deepEqual(b.lapides, a.lapides);
    assert.equal(montarPrompt(b).usuario, montarPrompt(a).usuario);
  });

  it('`validarLapides` confere o pacote de qualquer origem — e diz qual lápide e por quê', () => {
    const coracao = porCaderno(montarPacotes({ ...JULHO, lapides: LAPIDES_DE_2026 })).coracao;
    assert.doesNotThrow(() => validarLapides(coracao), 'o que a montagem produz é válido');
    const com = (lapides: readonly FatoLapide[]) => () => validarLapides({ ...coracao, lapides: [...lapides] });
    assert.throws(com([{ metrica: 'vfc' as never, ultimaMedidaISO: '2026-07-16' }]), /fora do catálogo: vfc/);
    assert.throws(com([{ metrica: 'spo2', ultimaMedidaISO: '2026-02-30' }]), /data impossível/);
    assert.throws(
      com([{ metrica: 'spo2', ultimaMedidaISO: '2026-08-01' }]),
      /posterior ao fim do período: 2026-08-01 é depois de 2026-07-31/,
    );
    assert.throws(com([{ metrica: 'vo2max', ultimaMedidaISO: '2026-07-14' }]), /no caderno coracao, mas ela é do caderno movimento/);
    assert.throws(
      com([{ metrica: 'spo2', ultimaMedidaISO: '2026-07-16' }, { metrica: 'spo2', ultimaMedidaISO: '2026-07-10' }]),
      /repetida/,
    );
    // O último dia do período ainda é dele.
    assert.doesNotThrow(com([{ metrica: 'spo2', ultimaMedidaISO: '2026-07-31' }]));
  });

  it('"tem lápide do período" tem um dono só, e é o que semDado, o vazio e a ordem perguntam', () => {
    const periodo = { inicioISO: '2026-07-01', fimISO: '2026-07-31' };
    assert.equal(temLapideDoPeriodo([], periodo), false);
    assert.equal(temLapideDoPeriodo([{ metrica: 'spo2', ultimaMedidaISO: '2026-06-30' }], periodo), false);
    assert.equal(temLapideDoPeriodo([
      { metrica: 'vo2max', ultimaMedidaISO: '2026-06-30' },
      { metrica: 'aneis', ultimaMedidaISO: '2026-07-31' },
    ], periodo), true);
  });
});

/* ── a sentinela: o que só o ranqueamento lê ── */

describe('a sentinela — amostra, comparavel e a data da lápide ficam fora do alfabeto e do prompt', () => {
  const limpos = montarPacotes(ENTRADA_AGOSTO);
  const sujos = montarPacotes({ ...ENTRADA_AGOSTO, lapides: LAPIDES_DE_2026 }).map((p) => ({
    ...p, metricas: p.metricas.map((f) => ({ ...f, amostra: 777, comparavel: false })),
  }));
  const ordenado = (s: ReadonlySet<number>) => [...s].sort((a, b) => a - b);

  it('com `amostra: 777` e quatro lápides datadas, o alfabeto é o MESMO — caderno a caderno e na união', () => {
    // A igualdade cobre também a data: nem o dia, nem o mês, nem o ano da morte
    // viraram número autorizado.
    assert.deepEqual(ordenado(valoresDoPacote(sujos)), ordenado(valoresDoPacote(limpos)));
    for (const [i, p] of sujos.entries()) {
      assert.deepEqual(ordenado(valoresDoPacote(p)), ordenado(valoresDoPacote(limpos[i])), p.caderno);
      assert.equal(numerosDoPacote(p).has('777'), false, p.caderno);
    }
    assert.equal(valoresDoPacote(sujos).has(777), false);
  });

  it('a procedência é entrada por entrada a mesma — a quinta regra não vê diferença', () => {
    assert.deepEqual(procedenciaDoPacote(sujos), procedenciaDoPacote(limpos));
  });

  it('777 não aparece em prompt nenhum — do caderno ou da edição', () => {
    const prompts = [montarPromptDaEdicao(sujos).usuario, ...sujos.map((p) => montarPrompt(p).usuario)];
    for (const u of prompts) assert.equal(u.includes('777'), false);
    // A ausência só prova algo se a lápide CHEGOU ao prompt.
    assert.ok(prompts[0].includes('anéis de atividade pararam de chegar em 17 de agosto de 2026'));
  });

  it('sem lápide, `amostra` e `comparavel` sujos dão o prompt IDÊNTICO ao limpo — nos dois grãos', () => {
    // Procurar o 777 só pega quem o escreve como está. Um prompt que passasse a
    // ler `comparavel` ("— não comparável") ou a amostra por extenso passaria
    // naquela busca; na igualdade, não.
    const sujosSemLapide = limpos.map((p) => ({
      ...p, metricas: p.metricas.map((f) => ({ ...f, amostra: 777, comparavel: false })),
    }));
    assert.equal(montarPromptDaEdicao(sujosSemLapide).usuario, montarPromptDaEdicao(limpos).usuario);
    assert.equal(montarPromptDaEdicao(sujosSemLapide).sistema, montarPromptDaEdicao(limpos).sistema);
    for (const [i, p] of sujosSemLapide.entries()) {
      assert.equal(montarPrompt(p).usuario, montarPrompt(limpos[i]).usuario, p.caderno);
    }
  });
});

/* ── o que o celular manda hoje ── */

/**
 * O `usuario` de agosto, capturado no **commit base da Story 1.7** (`2e276ea`)
 * com a entrada que o celular monta hoje — `{ resumo, agora }`, sem lápide nem
 * cobertura de noites (`mobile/src/app/retrospectiva/index.tsx`).
 *
 * A 1.7 mexeu na montagem (amostra, nascimento, lápide, `semDado`) e no prompt
 * (seção nova, vazio decidido nos dois grãos, cabeçalho de caderno sem seção).
 *
 * **O que este golden prende é o `usuario` da edição de agosto**, sem lápide:
 * ele não pode mudar um byte. O que mudou para todos, e que ele de propósito NÃO
 * prende: o `sistema` ganhou a linha da FORMA sobre a lápide (`PROMPT_VERSAO` 5),
 * e o caderno de borda — só lacuna, evento ou correlação — passou a ter
 * cabeçalho na edição (agosto não tem caderno de borda). Gerado da captura, não
 * digitado.
 */
const GOLDEN_AGOSTO_CELULAR = [
  '# Agosto',
  'Escreva a edição inteira: os cadernos abaixo, num texto só. Período: 2026-08-01 a 2026-08-31 (31 dias).',
  'Luz do dia: dias longos.',
  '',
  '### Sono',
  '- Sono: 7,03 h (contra julho: 6,89 h, 2,0%)',
  '- Nota de sono: 3,72 (contra julho: 3,39, 9,7%)',
  '#### Comparações sem número neste caderno',
  '- sem o mesmo período do ano anterior: não existe em todos os fatos deste caderno.',
  '- sem a normal do período: não existe em todos os fatos deste caderno.',
  '',
  'As comparações desta seção não têm número neste caderno. Ao escrever, não',
  'ponha o nome de nenhuma delas junto de um número de outra comparação.',
  '',
  '### Movimento',
  '- Atividades: 21 (contra julho: 17, 23,5%)',
  '- Distância: 435 km (contra julho: 862 km, −49,5%)',
  '- Tempo: 40,1 h (contra julho: 68,2 h, −41,2%)',
  '- Passos por dia: 17.350 (contra julho: 16.129, 7,6%)',
  '- Andares: 539 (contra julho: 500, 7,8%)',
  '#### Ciclismo',
  '- Sessões: 7 (contra julho: 11, −36,4%)',
  '- Distância: 333 km (contra julho: 820 km, −59,4%)',
  '- Tempo em movimento: 22,7 h (contra julho: 52,8 h, −57,0%)',
  '- Elevação: 0 m (contra julho: 0 m)',
  '#### Corrida',
  '- Sessões: 8 (contra julho: 2, 300,0%)',
  '- Distância: 101 km (contra julho: 21 km, 381,0%)',
  '- Tempo em movimento: 11,4 h (contra julho: 2,4 h, 375,0%)',
  '- Elevação: 0 m (contra julho: 0 m)',
  '#### Comparações sem número neste caderno',
  '- sem o mesmo período do ano anterior: não existe em todos os fatos deste caderno.',
  '- sem a normal do período: não existe em todos os fatos deste caderno.',
  '',
  'As comparações desta seção não têm número neste caderno. Ao escrever, não',
  'ponha o nome de nenhuma delas junto de um número de outra comparação.',
  '',
  '### Coração',
  '- FC de repouso: 48,1 bpm (contra julho: 49,0 bpm, −1,8%)',
  '#### Cobertura',
  '- Neste período: 29 de 31 dias. No período comparado: 29 de 31 dias.',
  '#### Comparações sem número neste caderno',
  '- sem o mesmo período do ano anterior: não existe em todos os fatos deste caderno.',
  '- sem a normal do período: não existe em todos os fatos deste caderno.',
  '',
  'As comparações desta seção não têm número neste caderno. Ao escrever, não',
  'ponha o nome de nenhuma delas junto de um número de outra comparação.',
  '',
  '### Rotina',
  '- Nota do dia: 4,00 (contra julho: 3,82, 4,7%)',
  '#### Dia a dia',
  '- Tarefas concluídas: 0 (contra julho: 0)',
  '- Compras: 0 (contra julho: 0)',
  '- Gasto: 0,00 (contra julho: 0,00)',
  '#### Comparações sem número neste caderno',
  '- sem o mesmo período do ano anterior: não existe em todos os fatos deste caderno.',
  '- sem a normal do período: não existe em todos os fatos deste caderno.',
  '',
  'As comparações desta seção não têm número neste caderno. Ao escrever, não',
  'ponha o nome de nenhuma delas junto de um número de outra comparação.',
].join('\n');

describe('o prompt que o celular manda hoje — golden do commit base', () => {
  it('sem `lapides`, o `usuario` de agosto é idêntico, byte a byte, ao de antes da 1.7', () => {
    assert.equal(montarPromptDaEdicao(montarPacotes(ENTRADA_MEDIDA)).usuario, GOLDEN_AGOSTO_CELULAR);
  });
});
