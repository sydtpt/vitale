/**
 * A regra de composição da frase coletiva, **varrida por tupla**. Rodar com:
 *   cd packages/shared && npx tsx src/sleep/lua-frase.test.ts
 *
 * **Nenhum dado lunar real entra aqui, e nenhum pode entrar.** Toda fase deste
 * arquivo é construída à mão a partir de `PROTOCOLO_LUNAR`: o que se mede é a
 * regra que escreve, não o teste que mediu.
 *
 * ## Por tupla, e não por caso escolhido
 *
 * O veredito é por fase e tem três valores, então o espaço pós-execução tem
 * **81 tuplas** (3⁴). A prancha de UX rende três delas; uma suíte que cobrisse só
 * essas três provaria que três frases existem, e a emenda de 01/10 da ADR 0045
 * declara a garantia **para toda tupla que o protocolo possa produzir**. Por isso
 * a varredura é exaustiva: as 81 geram texto, nenhuma lança, e nenhuma devolve
 * compartimento vazio.
 *
 * ## As cinco invariantes que este arquivo prende
 *
 * 1. **Nenhum número sobe.** O único dígito admitido nos compartimentos é o
 *    limiar de 15 min; qualquer outro é um `falta.quanto` vazando — e somar
 *    unidades diferentes imprimiria outra coisa com o nome de noite (story 2.8).
 * 2. **`decidir` é veredito com poder**, `achado` **ou** `nenhum_padrao`. Quatro
 *    `nenhum_padrao` dizem *decidiram*; quatro `inconclusivo` dizem *não*.
 * 3. **O placar é por família**, com denominadores 1 e 3 e o verbo concordando
 *    com o numeral — nunca um número sobre quatro.
 * 4. **A luz ganha de qualquer outro motivo**, porque o portão é global às
 *    quatro, e ali é proibido escrever que faltou poder.
 * 5. **Motivos mistos não elegem um motivo**: a frase diz a partição e manda ao
 *    bloco.
 */
import assert from 'node:assert/strict';
import { PHASE_ORDER, type LunarPhaseKind } from '../astro/moon';
import {
  ALFA_DAS_TRES,
  ALFA_DA_CHEIA,
  LIMIAR_PRATICO_MIN,
  PROTOCOLO_LUNAR,
  UNIDADE_DO_MOTIVO,
  type FamiliaLunar,
  type MotivoDoInconclusivo,
  type ResultadoDaFase,
  type VereditoLunar,
} from './lua-protocolo';
import {
  ALFA_DO_GRUPO,
  APOIO_SEM_LEITURA,
  FASES_DA_FAMILIA,
  FRASE_SEM_LEITURA,
  NOME_DA_FASE,
  PALAVRA_DO_VEREDITO,
  SEM_LEITURA,
  apoioDoBloco,
  comporFraseColetiva,
  fraseColetivaDe,
  numeroDoBloco,
  numeroDoEfeito,
  numeroDoQueFalta,
  ordinalDaExecucao,
  type FraseColetiva,
  type LinhaDaFamilia,
} from './lua-frase';

/* ─────────────────────────── O construtor ─────────────────────────── */

/**
 * Valores de `falta.quanto` **distintivos**, um por fase, mais a soma deles.
 *
 * Eles existem para que o vazamento seja legível: se um número destes aparecer
 * num compartimento, foi `falta` subindo; se 1.010 aparecer, foi alguém somando
 * unidades que não se contam na mesma moeda.
 */
const FALTA_POR_FASE: Readonly<Record<LunarPhaseKind, number>> = {
  new: 101,
  firstQuarter: 202,
  full: 303,
  lastQuarter: 404,
};
const SOMA_PROIBIDA = 101 + 202 + 303 + 404;

interface Pedido {
  veredito: VereditoLunar;
  motivo?: MotivoDoInconclusivo;
  /** Minutos, com sinal. Positivo é atraso. */
  efeito?: number;
}

/** Uma fase do protocolo no estado pedido — α, família e direção saem do protocolo. */
function fase(f: LunarPhaseKind, p: Pedido): ResultadoDaFase {
  const l = PROTOCOLO_LUNAR.find((x) => x.fase === f);
  assert.ok(l !== undefined, `a fase ${f} não está no protocolo`);
  const motivo = p.veredito === 'inconclusivo' ? (p.motivo ?? 'poder') : null;
  const efeito = p.efeito ?? (f === 'full' ? 19 : -11);
  const medido = p.veredito !== 'inconclusivo' || motivo === 'poder';
  return {
    fase: f,
    familia: l.familia,
    alfa: l.alfa,
    lateralidade: l.lateralidade,
    direcao: l.direcao,
    veredito: p.veredito,
    motivo,
    portaoReprovado: motivo === null || motivo === 'poder' ? null : motivo,
    efeitoMin: medido ? efeito : null,
    p: medido ? (p.veredito === 'achado' ? 0.014 : 0.21) : null,
    zDeMannWhitney: medido ? 2.2 : null,
    poder: medido ? (p.veredito === 'inconclusivo' ? 0.64 : 0.86) : null,
    efeitoMinimoDetectavelMin: medido ? 17.5 : null,
    noitesDentro: 49,
    noitesFora: 241,
    ciclos: 17,
    falta:
      motivo === null
        ? null
        : { quanto: FALTA_POR_FASE[f], unidade: UNIDADE_DO_MOTIVO[motivo] },
    noitesPara80: medido ? 396 : null,
  };
}

/** As quatro, na ordem do protocolo, cada uma com o pedido dela. */
function quatro(pedidos: Readonly<Record<LunarPhaseKind, Pedido>>): ResultadoDaFase[] {
  return PHASE_ORDER.map((f) => fase(f, pedidos[f]));
}

const TODOS: readonly VereditoLunar[] = ['achado', 'nenhum_padrao', 'inconclusivo'];
const TODOS_OS_MOTIVOS: readonly MotivoDoInconclusivo[] = ['amostra', 'ciclos', 'poder'];

/** As 81 tuplas, como pedidos. A luz fica fora: ela é do acervo, não da fase. */
function asOitentaEUma(): Readonly<Record<LunarPhaseKind, Pedido>>[] {
  const out: Readonly<Record<LunarPhaseKind, Pedido>>[] = [];
  for (const a of TODOS) {
    for (const b of TODOS) {
      for (const c of TODOS) {
        for (const d of TODOS) {
          out.push({ new: { veredito: a }, firstQuarter: { veredito: b }, full: { veredito: c }, lastQuarter: { veredito: d } });
        }
      }
    }
  }
  return out;
}

/* ─────────────────────── A varredura das 81 tuplas ─────────────────────── */

const tuplas = asOitentaEUma();
assert.equal(tuplas.length, 81, 'o espaço pós-execução é 3⁴ — se não são 81, a varredura mudou');

/** Os dígitos que sobram num texto depois de tirar o limiar — tem de ser nenhum. */
function digitosForaDoLimiar(texto: string): string {
  return texto.split(String(LIMIAR_PRATICO_MIN)).join('').replace(/\D/g, '');
}

function conferirLinha(l: LinhaDaFamilia, onde: string): void {
  assert.ok(l.placar.trim().length > 0, `${onde}: compartimento 1 vazio`);
  assert.ok(l.porque.trim().length > 0, `${onde}: compartimento 2 vazio`);
  assert.ok(l.placar.endsWith('.'), `${onde}: o placar não é uma frase — "${l.placar}"`);
  assert.ok(
    l.porque.endsWith('.'),
    `${onde}: o compartimento 2 não termina em frase — "${l.porque}"`,
  );
  assert.equal(
    l.tamanho,
    FASES_DA_FAMILIA[l.familia].length,
    `${onde}: o denominador não é o tamanho da família`,
  );
  assert.ok(l.tamanho === 1 || l.tamanho === 3, `${onde}: denominador ${String(l.tamanho)} — são 1 e 3, nunca 4`);
  assert.ok(l.decidiram <= l.tamanho, `${onde}: decidiram mais que o tamanho da família`);
  for (const [campo, texto] of [['placar', l.placar], ['porque', l.porque]] as const) {
    assert.equal(
      digitosForaDoLimiar(texto),
      '',
      `${onde}: número no ${campo} — "${texto}". Nenhum número sobe para a frase coletiva: as `
      + 'quatro unidades do que falta não se contam na mesma moeda, e o quanto fica no bloco.',
    );
  }
  assert.ok(!texto(l).includes(String(SOMA_PROIBIDA)), `${onde}: a soma das unidades subiu`);
  assert.ok(!texto(l).includes('quatro fases'), `${onde}: "quatro fases" é o denominador proibido`);
  assert.ok(!texto(l).includes('das quatro'), `${onde}: "das quatro" é o denominador proibido`);
}

function texto(l: LinhaDaFamilia): string {
  return `${l.placar} ${l.porque}`;
}

/** O placar que o numeral obriga, por família e por `d`. */
function placarEsperado(familia: FamiliaLunar, d: number): string {
  if (familia === 'cheia') return d === 0 ? 'A cheia não decidiu.' : 'A cheia decidiu.';
  return ['Nenhuma das três decidiu.', 'Uma das três decidiu.', 'Duas das três decidiram.', 'As três decidiram.'][d];
}

for (const [i, pedidos] of tuplas.entries()) {
  const fases = quatro(pedidos);
  let f: FraseColetiva;
  try {
    f = comporFraseColetiva(fases, 0);
  } catch (e) {
    assert.fail(`a tupla ${String(i)} lançou: ${e instanceof Error ? e.message : String(e)}`);
  }
  assert.equal(f.linhas.length, 2, `a tupla ${String(i)} não tem duas linhas`);
  assert.deepEqual([f.linhas[0], f.linhas[1]], [f.cheia, f.asTres], 'a ordem de leitura é a cheia primeiro');
  for (const l of f.linhas) {
    const onde = `tupla ${String(i)} · ${l.familia}`;
    conferirLinha(l, onde);
    const d = FASES_DA_FAMILIA[l.familia].filter(
      (fa) => pedidos[fa].veredito !== 'inconclusivo',
    ).length;
    assert.equal(l.decidiram, d, `${onde}: a contagem de decididas discorda da tupla`);
    assert.equal(l.placar, placarEsperado(l.familia, d), `${onde}: o placar não concorda com o numeral`);
  }
}
console.log('ok — as 81 tuplas geram texto, com placar por família e sem número nenhum');

/* ──────────── E as combinações de MOTIVO, pela mesma régua ──────────── */

/**
 * As 27 combinações de motivo nas três, mais os três da cheia.
 *
 * A varredura das 81 usa um motivo só, então ela não alcança o caminho da
 * **partição** — que é justamente onde um número somado teria para onde ir, porque
 * ali conviveriam `falta` de unidades diferentes. Aqui todas as misturas passam
 * pela mesma conferência: nenhum compartimento vazio, e nenhum dígito fora do
 * limiar.
 */
{
  let combinacoes = 0;
  for (const a of TODOS_OS_MOTIVOS) {
    for (const b of TODOS_OS_MOTIVOS) {
      for (const c of TODOS_OS_MOTIVOS) {
        for (const m of TODOS_OS_MOTIVOS) {
          combinacoes += 1;
          const f = comporFraseColetiva(
            quatro({
              new: { veredito: 'inconclusivo', motivo: a },
              firstQuarter: { veredito: 'inconclusivo', motivo: b },
              full: { veredito: 'inconclusivo', motivo: m },
              lastQuarter: { veredito: 'inconclusivo', motivo: c },
            }),
            0,
          );
          for (const l of f.linhas) conferirLinha(l, `motivos ${a}/${b}/${c} · cheia ${m} · ${l.familia}`);
          // Com motivos diferentes nas três, nenhum deles pode falar pelas outras.
          if (new Set([a, b, c]).size > 1) {
            assert.match(
              f.asTres.porque,
              /cada bloco diz qual, e em que unidade\./,
              'com motivos mistos a frase manda ao bloco em vez de eleger um motivo',
            );
          }
        }
      }
    }
  }
  assert.equal(combinacoes, 81, 'são 3 motivos em 4 fases — 81 combinações de motivo');
}
console.log('ok — as 81 combinações de motivo também saem sem número e sem motivo eleito');

/* ───────────────── `decidir` é veredito com poder, não achado ───────────────── */

{
  const todasNulas = comporFraseColetiva(
    quatro({
      new: { veredito: 'nenhum_padrao' },
      firstQuarter: { veredito: 'nenhum_padrao' },
      full: { veredito: 'nenhum_padrao' },
      lastQuarter: { veredito: 'nenhum_padrao' },
    }),
    0,
  );
  // Com `decidir = achado` estas duas linhas seriam as mesmas da tupla toda
  // inconclusiva, e a distinção que a §5 de 07/09 chama de "o erro mais fácil
  // deste documento" voltaria a viver só no compartimento menor.
  assert.equal(todasNulas.cheia.placar, 'A cheia decidiu.');
  assert.equal(todasNulas.asTres.placar, 'As três decidiram.');
  assert.match(todasNulas.cheia.porque, /na direção que este teste pode achar/);
  assert.match(todasNulas.asTres.porque, /em nenhuma direção/);
  assert.match(todasNulas.asTres.porque, /Nenhuma das três mostrou deslocamento de 15 minutos ou mais/);

  const todasIndecisas = comporFraseColetiva(
    quatro({
      new: { veredito: 'inconclusivo' },
      firstQuarter: { veredito: 'inconclusivo' },
      full: { veredito: 'inconclusivo' },
      lastQuarter: { veredito: 'inconclusivo' },
    }),
    0,
  );
  assert.equal(todasIndecisas.cheia.placar, 'A cheia não decidiu.');
  assert.equal(todasIndecisas.asTres.placar, 'Nenhuma das três decidiu.');
  assert.equal(
    todasIndecisas.cheia.porque,
    'O teste rodou sem poder para decidir entre as duas colunas.',
  );
  assert.equal(
    todasIndecisas.asTres.porque,
    'Os três testes rodaram sem poder para decidir entre as duas colunas.',
  );
  assert.notEqual(
    todasNulas.cheia.placar,
    todasIndecisas.cheia.placar,
    'poder que não acha e falta de poder não podem escrever a mesma primeira linha',
  );
}
console.log('ok — decidir é veredito com poder: nenhum padrão decide, inconclusivo não');

/* ─────────────── O achado nomeia a fase, e o sentido dela ─────────────── */

{
  const naCheia = comporFraseColetiva(
    quatro({
      new: { veredito: 'inconclusivo' },
      firstQuarter: { veredito: 'inconclusivo' },
      full: { veredito: 'achado', efeito: 19 },
      lastQuarter: { veredito: 'inconclusivo' },
    }),
    0,
  );
  assert.equal(naCheia.cheia.placar, 'A cheia decidiu.');
  assert.equal(
    naCheia.cheia.porque,
    'Nas noites que antecedem a cheia, a hora de apagar ficou mais tarde.',
  );
  assert.equal(naCheia.asTres.placar, 'Nenhuma das três decidiu.');

  // Uma das três decide: o placar da família das três, e a oração final dizendo
  // quantas sobraram e por quê — nunca omitida.
  const umaDasTres = comporFraseColetiva(
    quatro({
      new: { veredito: 'achado', efeito: -17 },
      firstQuarter: { veredito: 'inconclusivo' },
      full: { veredito: 'inconclusivo' },
      lastQuarter: { veredito: 'inconclusivo' },
    }),
    0,
  );
  assert.equal(umaDasTres.asTres.placar, 'Uma das três decidiu.');
  assert.match(umaDasTres.asTres.porque, /Nas noites que antecedem a lua nova, a hora de apagar ficou mais cedo\./);
  assert.match(umaDasTres.asTres.porque, /Duas não decidiram: rodaram sem poder/);

  // Duas ou mais decidem: plural no placar, e **cada** fase nomeada, na ordem do
  // protocolo. O compartimento tem de caber mais de um nome.
  const duas = comporFraseColetiva(
    quatro({
      new: { veredito: 'achado', efeito: 21 },
      firstQuarter: { veredito: 'inconclusivo' },
      full: { veredito: 'inconclusivo' },
      lastQuarter: { veredito: 'achado', efeito: -18 },
    }),
    0,
  );
  assert.equal(duas.asTres.placar, 'Duas das três decidiram.');
  assert.match(
    duas.asTres.porque,
    /Nas noites que antecedem a lua nova, a hora de apagar ficou mais tarde; nas que antecedem o quarto minguante, mais cedo\./,
  );
  assert.ok(
    duas.asTres.porque.indexOf('lua nova') < duas.asTres.porque.indexOf('quarto minguante'),
    'as fases são nomeadas na ordem do protocolo',
  );
  assert.match(duas.asTres.porque, /Uma não decidiu/);

  // Achado e nenhum padrão na mesma família: a oração final diz quantas
  // decidiram SEM achar — o compartimento não pode sugerir que uma delas ficou
  // sem resposta.
  const misto = comporFraseColetiva(
    quatro({
      new: { veredito: 'achado', efeito: 21 },
      firstQuarter: { veredito: 'nenhum_padrao', efeito: 3 },
      full: { veredito: 'inconclusivo' },
      lastQuarter: { veredito: 'nenhum_padrao', efeito: -2 },
    }),
    0,
  );
  assert.equal(misto.asTres.placar, 'As três decidiram.');
  assert.match(misto.asTres.porque, /Duas decidiram sem achar deslocamento de 15 minutos ou mais\./);
  assert.ok(!misto.asTres.porque.includes('não decidiram'), 'com as três decidindo ninguém sobra');
}
console.log('ok — o achado nomeia a fase e o sentido, e cabe mais de um nome');

/* ──────────────── O motivo real, e a partição quando são mistos ──────────────── */

for (const m of TODOS_OS_MOTIVOS) {
  const f = comporFraseColetiva(
    quatro({
      new: { veredito: 'inconclusivo', motivo: m },
      firstQuarter: { veredito: 'inconclusivo', motivo: m },
      full: { veredito: 'inconclusivo', motivo: m },
      lastQuarter: { veredito: 'inconclusivo', motivo: m },
    }),
    0,
  );
  const esperado: Record<MotivoDoInconclusivo, RegExp> = {
    poder: /rodou sem poder para decidir entre as duas colunas/,
    amostra: /parou no portão da amostra/,
    ciclos: /parou no portão dos ciclos/,
    luz: /parou no portão da luz/,
  };
  assert.match(f.cheia.porque, esperado[m], `o motivo ${m} não foi nomeado na linha da cheia`);
  assert.ok(
    !f.cheia.porque.includes('cada bloco'),
    'com um motivo só a frase nomeia o motivo, em vez de mandar ao bloco',
  );
}

{
  // Mistos nas três: a frase diz a partição e **não** elege um motivo.
  const mistos = comporFraseColetiva(
    quatro({
      new: { veredito: 'inconclusivo', motivo: 'amostra' },
      firstQuarter: { veredito: 'inconclusivo', motivo: 'ciclos' },
      full: { veredito: 'inconclusivo', motivo: 'poder' },
      lastQuarter: { veredito: 'inconclusivo', motivo: 'poder' },
    }),
    0,
  );
  assert.match(mistos.asTres.porque, /Duas pararam num portão e uma rodou sem poder; cada bloco diz qual, e em que unidade\./);
  for (const proibido of ['portão da amostra', 'portão dos ciclos']) {
    assert.ok(
      !mistos.asTres.porque.includes(proibido),
      `com motivos mistos a frase não pode afirmar "${proibido}" como se fosse de todas`,
    );
  }
  // Dois portões diferentes, sem nenhuma por poder: continua sem eleger um.
  const soPortoes = comporFraseColetiva(
    quatro({
      new: { veredito: 'inconclusivo', motivo: 'amostra' },
      firstQuarter: { veredito: 'inconclusivo', motivo: 'ciclos' },
      full: { veredito: 'inconclusivo', motivo: 'poder' },
      lastQuarter: { veredito: 'nenhum_padrao', efeito: 2 },
    }),
    0,
  );
  assert.match(soPortoes.asTres.porque, /pararam em portões diferentes; cada bloco diz qual, e em que unidade\./);
  assert.equal(soPortoes.asTres.placar, 'Uma das três decidiu.');
}
console.log('ok — o motivo real quando é um, a partição quando são mistos');

/* ─────────── A luz é global, e ganha de qualquer outro motivo ─────────── */

{
  // O acervo tem noite sem luz: o motor para as quatro no mesmo portão. A frase
  // tem de trazer o motivo nas DUAS linhas.
  const luz = comporFraseColetiva(
    quatro({
      new: { veredito: 'inconclusivo', motivo: 'luz' },
      firstQuarter: { veredito: 'inconclusivo', motivo: 'luz' },
      full: { veredito: 'inconclusivo', motivo: 'luz' },
      lastQuarter: { veredito: 'inconclusivo', motivo: 'luz' },
    }),
    3,
  );
  assert.match(luz.cheia.porque, /O portão da luz reprovou antes de qualquer cálculo/);
  assert.match(luz.asTres.porque, /global às quatro/);
  for (const l of luz.linhas) {
    assert.ok(
      !l.porque.includes('sem poder para decidir'),
      'com o portão da luz reprovado nenhum poder foi calculado — escrever que faltou poder é falso, '
      + 'e manda esperar cem noites quando o que falta é consertar dado',
    );
    assert.ok(!l.porque.includes('não houve poder'), 'a frase proibida por nome');
    assert.equal(digitosForaDoLimiar(l.porque), '', 'nem o número das noites sem luz sobe');
  }

  // E a luz ganha mesmo quando os motivos por fase dizem outra coisa: o portão é
  // propriedade do acervo, e ele é cobrado primeiro.
  const contraOsOutros = comporFraseColetiva(
    quatro({
      new: { veredito: 'inconclusivo', motivo: 'poder' },
      firstQuarter: { veredito: 'inconclusivo', motivo: 'amostra' },
      full: { veredito: 'inconclusivo', motivo: 'ciclos' },
      lastQuarter: { veredito: 'inconclusivo', motivo: 'poder' },
    }),
    1,
  );
  assert.match(contraOsOutros.cheia.porque, /O portão da luz reprovou/);
  assert.match(contraOsOutros.asTres.porque, /global às quatro/);
}
console.log('ok — a luz vem primeiro e ganha de qualquer outro motivo');

/* ─────────────────────── O estado pré-execução ─────────────────────── */

{
  assert.deepEqual(fraseColetivaDe(null), FRASE_SEM_LEITURA, 'sem execução, a frase é a do quarto estado');
  assert.equal(FRASE_SEM_LEITURA.cheia.placar, 'A cheia não foi lida.');
  assert.equal(FRASE_SEM_LEITURA.asTres.placar, 'As três não foram lidas.');
  for (const l of FRASE_SEM_LEITURA.linhas) {
    conferirLinha(l, `pré-execução · ${l.familia}`);
    assert.match(l.porque, /A primeira execução autorizada ainda não rodou/);
    // O verbo muda porque não houve LEITURA, não porque não houve resultado.
    assert.ok(!l.placar.includes('decidiu'), 'antes da primeira execução ninguém decidiu nada');
  }
  assert.match(FRASE_SEM_LEITURA.asTres.porque, /as quatro rodam juntas, ou nenhuma roda/);
}
console.log('ok — o quarto estado tem a mesma forma, com o verbo da ausência de leitura');

/* ────────────── A execução truncada diz o que fazer ────────────── */

{
  const tres = quatro({
    new: { veredito: 'inconclusivo' },
    firstQuarter: { veredito: 'inconclusivo' },
    full: { veredito: 'inconclusivo' },
    lastQuarter: { veredito: 'inconclusivo' },
  }).slice(0, 3);
  assert.throws(
    () => comporFraseColetiva(tres, 0),
    (e: unknown) => {
      assert.ok(e instanceof Error);
      assert.match(e.message, /recebeu 3/);
      // A mensagem diz o que fazer, e não em que parágrafo a regra está escrita.
      assert.match(e.message, /fetchUltimaExecucaoLunar/);
      assert.ok(!/§/.test(e.message), 'a mensagem não cita parágrafo: quem a lê quer o primeiro passo');
      return true;
    },
  );
  const cinco = [
    ...quatro({
      new: { veredito: 'achado' },
      firstQuarter: { veredito: 'achado' },
      full: { veredito: 'achado' },
      lastQuarter: { veredito: 'achado' },
    }),
    fase('new', { veredito: 'inconclusivo' }),
  ];
  assert.throws(() => comporFraseColetiva(cinco, 0), /execucao_id/);
}
console.log('ok — a execução truncada lança dizendo como consertar');

/* ──────────────── O vocabulário dos blocos de fase ──────────────── */

{
  // O número com a unidade DELE, e a concordância com o numeral — a lição do
  // "1 dias" da story 2.8 chegando na tela.
  assert.deepEqual(numeroDoQueFalta({ quanto: 382, unidade: 'noites-coletaveis' }, 'poder'), {
    valor: '382 noites coletáveis',
    legenda: 'faltam para 80% de poder em 15 min',
  });
  assert.equal(numeroDoQueFalta({ quanto: 1, unidade: 'noites-coletaveis' }, 'poder').valor, '1 noite coletável');
  assert.equal(numeroDoQueFalta({ quanto: 1, unidade: 'ciclos' }, 'ciclos').valor, '1 ciclo');
  assert.equal(numeroDoQueFalta({ quanto: 4, unidade: 'ciclos' }, 'ciclos').valor, '4 ciclos');
  assert.equal(numeroDoQueFalta({ quanto: 2, unidade: 'noites-de-coluna' }, 'amostra').valor, '2 noites de coluna');
  assert.equal(numeroDoQueFalta({ quanto: 3, unidade: 'noites-sem-luz' }, 'luz').valor, '3 noites sem horas de luz');
  // Nenhuma unidade que não é noite coletável se escreve "noites": imprimir
  // "faltam 4 noites" sobre ciclos erraria por ~118 dias.
  for (const m of ['amostra', 'ciclos'] as const) {
    const n = numeroDoQueFalta({ quanto: 4, unidade: UNIDADE_DO_MOTIVO[m] }, m);
    assert.ok(!n.legenda.includes('noites coletáveis'), `o motivo ${m} não conta noite coletável`);
  }
  // E o identificador do banco é sem acento; a palavra exibida é a acentuada.
  assert.equal(UNIDADE_DO_MOTIVO.poder, 'noites-coletaveis');
  assert.match(numeroDoQueFalta({ quanto: 2, unidade: 'noites-coletaveis' }, 'poder').valor, /coletáveis/);

  // O efeito, com sinal e com o nome do sentido. Na cheia, unilateral no atraso,
  // um negativo é adiantamento — e a palavra o diz.
  const atraso = numeroDoEfeito(fase('full', { veredito: 'achado', efeito: 19 }));
  assert.deepEqual(atraso, { valor: '+19 min', legenda: 'atraso mediano · hora de apagar' });
  const adiantamento = numeroDoEfeito(fase('full', { veredito: 'nenhum_padrao', efeito: -40 }));
  assert.deepEqual(adiantamento, { valor: '−40 min', legenda: 'adiantamento mediano · hora de apagar' });
  const bilateral = numeroDoEfeito(fase('new', { veredito: 'nenhum_padrao', efeito: 3 }));
  assert.deepEqual(bilateral, { valor: '+3 min', legenda: 'deslocamento mediano · hora de apagar' });

  // O bloco do inconclusivo imprime o que falta; os outros dois, o efeito.
  assert.equal(numeroDoBloco(fase('new', { veredito: 'inconclusivo' }))?.valor, '101 noites coletáveis');
  assert.equal(numeroDoBloco(fase('full', { veredito: 'achado', efeito: 19 }))?.valor, '+19 min');
  // Portão reprovado: nada de efeito, porque nada foi medido.
  assert.equal(numeroDoEfeito(fase('new', { veredito: 'inconclusivo', motivo: 'ciclos' })), null);
}
console.log('ok — o número de cada bloco sai com a unidade dele');

{
  // Portão reprovado: "efeito não medido", nunca zero.
  const portao = apoioDoBloco(fase('new', { veredito: 'inconclusivo', motivo: 'amostra' }));
  assert.match(portao[0], /Efeito não medido: o portão reprovou antes, e zero seria mentira\./);
  // O portão da luz é global, e o bloco o diz — é o que impede o leitor de achar
  // que os outros três blocos falam de outra coisa.
  const luz = apoioDoBloco(fase('firstQuarter', { veredito: 'inconclusivo', motivo: 'luz' }));
  assert.ok(luz.some((l) => l.includes('global às quatro')), 'o bloco da luz diz que o portão é global');

  // O adiantamento na cheia com poder: uma linha, no mesmo corpo, sem ícone e sem
  // itálico — as três atenuações que a ADR 0045 §3 proíbe.
  const direcao = apoioDoBloco(fase('full', { veredito: 'nenhum_padrao', efeito: -40 }));
  assert.ok(
    direcao.some((l) => l.includes('um adiantamento aqui não é achado por este protocolo')),
    'a direção não coberta é explicada em uma linha',
  );
  // E ela não existe quando o deslocamento é no sentido pré-registrado.
  const semExplicacao = apoioDoBloco(fase('full', { veredito: 'nenhum_padrao', efeito: 4 }));
  assert.ok(!semExplicacao.some((l) => l.includes('adiantamento')), 'nada a explicar no sentido coberto');
  // Nem nas três, que são bilaterais: ali as duas direções contam.
  const bilateral = apoioDoBloco(fase('lastQuarter', { veredito: 'nenhum_padrao', efeito: -40 }));
  assert.ok(!bilateral.some((l) => l.includes('não é achado por este protocolo')), 'bilateral acha nos dois sentidos');
  assert.ok(bilateral.some((l) => l.includes('bilateral')), 'a lateralidade que decidiu é dita');

  // No inconclusivo por poder a lateralidade NÃO entra: o que explicou o veredito
  // foi o poder.
  const semPoder = apoioDoBloco(fase('full', { veredito: 'inconclusivo', motivo: 'poder' }));
  assert.ok(semPoder.some((l) => l.includes('poder')), 'o poder medido é a razão, e aparece');
  assert.ok(!semPoder.some((l) => l.includes('unilateral')), 'a lateralidade não decidiu aqui');
}
console.log('ok — as linhas de apoio dizem o que foi medido e o que não foi');

/* ────────────────── A moldura e os cabeçalhos de família ────────────────── */

{
  assert.equal(ordinalDaExecucao(0), 'nenhuma execução');
  assert.equal(ordinalDaExecucao(1), '1ª execução');
  assert.equal(ordinalDaExecucao(6), '6ª execução');
  assert.throws(() => ordinalDaExecucao(-1), RangeError);

  // O α impresso é o do protocolo, e o arredondado dos documentos vem com a
  // divisão ao lado: 1,67% é MAIS FROUXO que 5/3 %.
  assert.equal(ALFA_DA_CHEIA, 0.05);
  assert.match(ALFA_DO_GRUPO.cheia, new RegExp(`α ${String(ALFA_DA_CHEIA * 100)}%`));
  assert.match(ALFA_DO_GRUPO.cheia, /unilateral/);
  assert.match(ALFA_DO_GRUPO['as-tres'], /α 1,67% \(0,05 \/ 3\)/);
  assert.match(ALFA_DO_GRUPO['as-tres'], /bilateral/);
  assert.ok(
    Math.abs(ALFA_DAS_TRES - 0.05 / 3) < 1e-12,
    'o α das três é a divisão escrita, não o arredondado',
  );
  assert.ok(ALFA_DAS_TRES < 0.0167, 'o arredondado dos documentos é mais frouxo que o protocolo');

  // As duas famílias somam quatro fases, e nenhuma delas conta as quatro juntas.
  assert.equal(FASES_DA_FAMILIA.cheia.length, 1);
  assert.equal(FASES_DA_FAMILIA['as-tres'].length, 3);
  assert.deepEqual([...FASES_DA_FAMILIA.cheia], ['full']);
  assert.deepEqual([...FASES_DA_FAMILIA['as-tres']], ['new', 'firstQuarter', 'lastQuarter']);

  // Os três vereditos têm palavra, e o quarto estado ocupa a vaga de uma delas.
  assert.deepEqual(Object.keys(PALAVRA_DO_VEREDITO).sort(), ['achado', 'inconclusivo', 'nenhum_padrao']);
  assert.equal(PALAVRA_DO_VEREDITO.nenhum_padrao, 'nenhum padrão');
  assert.equal(SEM_LEITURA, 'sem leitura');
  assert.ok(!SEM_LEITURA.includes('—'), 'travessão leria como nulo MEDIDO');
  assert.match(APOIO_SEM_LEITURA, /ainda não rodou/);

  // As quatro fases têm nome, e o nome do protocolo não é o da fase observada.
  for (const f of PHASE_ORDER) {
    assert.ok(NOME_DA_FASE[f].length > 0, `a fase ${f} não tem nome`);
  }
  assert.equal(NOME_DA_FASE.full, 'Lua cheia');
  assert.equal(NOME_DA_FASE.lastQuarter, 'Quarto minguante');
}
console.log('ok — a moldura, os α por família e o vocabulário dos quatro blocos');
