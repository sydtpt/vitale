import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { RetroSummary } from '../period/retro';
import type { RecapValue, MetricRecap } from '../week/recap';
import { CADERNO_IDS } from '../period/cadernos';
import type { CadernoId } from '../period/cadernos';
import type { FatoNumero, PacoteDeFatos } from './pacote';
import {
  PACOTE_VERSAO,
  coberturaDe,
  montarPacote,
  montarPacotes,
  numerosDoPacote,
  periodoFechado,
  procedenciaDoPacote,
  ressalvasObrigatorias,
  TEXTO_DA_ESTACAO,
  valoresDoPacote,
} from './pacote';
import { montarPromptDaEdicao } from './prompt';
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

const ENTRADA_AGOSTO = {
  resumo: agosto(),
  agora: AGORA,
  coberturaSono: { noites: 27, noitesAnterior: 14 },
};

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

  it('devolve os quatro cadernos, na ordem do catálogo, na versão 2', () => {
    assert.deepEqual(pacotes.map((p) => p.caderno), [...CADERNO_IDS]);
    for (const p of pacotes) assert.equal(p.versao, 2);
    assert.equal(PACOTE_VERSAO, 2);
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
