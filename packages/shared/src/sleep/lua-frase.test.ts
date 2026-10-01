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
  ANTES_DA_FASE,
  APOIO_SEM_LEITURA,
  APOIO_SEM_NUMERO,
  DATA_DO_PRE_REGISTRO,
  FASES_DA_FAMILIA,
  FRASE_SEM_LEITURA,
  LIMIAR_EM_PALAVRAS,
  NOME_DA_FASE,
  PALAVRA_DO_VEREDITO,
  RAZAO_DO_GRUPO,
  ROTULO_CURTO_DA_FASE,
  ROTULO_DA_FAMILIA,
  SEM_LEITURA,
  apoioDoBloco,
  comporFraseColetiva,
  fraseColetivaDe,
  fraseDaFalha,
  numeroDoBloco,
  numeroDoEfeito,
  numeroDoQueFalta,
  ordinalDaExecucao,
  type CausaDaFalhaLunar,
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
  // **O sentinela do limiar.** Ele é o próprio 15, e está aqui porque a guarda
  // `digitosForaDoLimiar` já tirava **toda** ocorrência de "15" do texto antes de
  // procurar dígito: um `falta.quanto` igual ao limiar vazava para a frase sem
  // ninguém ver. Com esta fase pedindo 15, um vazamento daqui tem de reprovar.
  full: LIMIAR_PRATICO_MIN,
  lastQuarter: 404,
};
const SOMA_PROIBIDA = 101 + 202 + LIMIAR_PRATICO_MIN + 404;

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

/**
 * Os dígitos que sobram num texto depois de tirar o limiar — tem de ser nenhum.
 *
 * **Tira a frase do limiar, e não o número dele.** `split('15')` removia qualquer
 * ocorrência de `15` em qualquer posição, então um `falta.quanto` de 15 passava pela
 * guarda inteiro: a única varredura que prova que nenhum número sobe tinha um buraco
 * do tamanho exato do valor mais provável de aparecer nela. Tirando só
 * `LIMIAR_EM_PALAVRAS` — *"15 minutos"*, a forma em que o limiar legitimamente
 * aparece —, um 15 solto volta a ser dígito que sobra.
 */
function digitosForaDoLimiar(texto: string): string {
  return texto.split(LIMIAR_EM_PALAVRAS).join(' ').replace(/\D/g, '');
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
  // A leitura do leitor de tela existe em toda tupla, carrega os dois
  // compartimentos, e **não gagueja**: o rótulo entra uma vez só.
  assert.ok(l.leitura.includes(l.placar), `${onde}: a leitura perdeu o placar`);
  assert.ok(l.leitura.includes(l.porque), `${onde}: a leitura perdeu o porquê`);
  assert.ok(l.leitura.startsWith(l.rotulo), `${onde}: a leitura não começa pelo rótulo da família`);
  assert.ok(
    !l.leitura.startsWith(`${l.rotulo}. ${l.rotulo}`),
    `${onde}: a leitura repete o rótulo — "${l.leitura}"`,
  );
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

/* ──── Motivo NÃO gravado não vira "sem poder" — é a gaveta da story 2.6 ──── */

/**
 * `f.motivo ?? 'poder'` transformava um `inconclusivo` com motivo nulo na afirmação
 * *"rodou sem poder"*. `numeroDoBloco` devolve `null` para a **mesma** linha: o bloco
 * não imprimia nada e a frase afirmava um motivo — a tela inteira dizendo as duas
 * coisas. Ausência não vira poder; ela vira a terceira fatia da partição.
 */
{
  /** A mesma fase, com o motivo apagado — o que o banco pode devolver. */
  const apagarMotivo = (f: ResultadoDaFase): ResultadoDaFase => ({
    ...f, motivo: null, portaoReprovado: null, falta: null,
  });

  const todasSemMotivo = comporFraseColetiva(
    quatro({
      new: { veredito: 'inconclusivo' },
      firstQuarter: { veredito: 'inconclusivo' },
      full: { veredito: 'inconclusivo' },
      lastQuarter: { veredito: 'inconclusivo' },
    }).map(apagarMotivo),
    0,
  );
  for (const l of todasSemMotivo.linhas) {
    conferirLinha(l, `sem motivo · ${l.familia}`);
    assert.ok(
      !l.porque.includes('sem poder'),
      `motivo nulo não pode sair como "sem poder" — "${l.porque}"`,
    );
    assert.match(l.porque, /não diz por quê/);
    assert.match(l.porque, /cada bloco diz qual/);
  }
  // E o bloco concorda com a frase: sem motivo não há número.
  const nua = apagarMotivo(fase('new', { veredito: 'inconclusivo' }));
  assert.equal(numeroDoBloco(nua), null, 'sem motivo não há unidade, então não há número');

  // Misto: duas com motivo e uma sem. A frase diz as três fatias e não elege nenhuma.
  const misto = comporFraseColetiva(
    [
      apagarMotivo(fase('new', { veredito: 'inconclusivo' })),
      fase('firstQuarter', { veredito: 'inconclusivo', motivo: 'amostra' }),
      fase('full', { veredito: 'inconclusivo', motivo: 'poder' }),
      fase('lastQuarter', { veredito: 'inconclusivo', motivo: 'poder' }),
    ],
    0,
  );
  assert.match(misto.asTres.porque, /uma parou num portão/i);
  assert.match(misto.asTres.porque, /uma rodou sem poder/);
  assert.match(misto.asTres.porque, /uma veio sem motivo gravado/);
  assert.match(misto.asTres.porque, /cada bloco diz qual, e em que unidade\./);
  assert.equal(digitosForaDoLimiar(misto.asTres.porque), '', 'nem aqui sobe número');
}
console.log('ok — motivo nulo entra na partição em vez de virar "sem poder"');

/* ──── O sentido do deslocamento não se inventa a partir de nada ──── */

/**
 * `(efeitoMin ?? 0) < 0` fazia um efeito **não medido** e um efeito **exatamente
 * zero** saírem os dois como *"ficou mais tarde"* — direção afirmada sem medição
 * atrás. `apoioDoBloco` é cuidadoso nisso por escrito (*"zero seria mentira"*); a
 * frase não era.
 */
{
  const comEfeito = (f: LunarPhaseKind, efeitoMin: number | null): ResultadoDaFase => ({
    ...fase(f, { veredito: 'achado' }), efeitoMin,
  });
  const naoMedido = comporFraseColetiva(
    [
      comEfeito('new', null),
      fase('firstQuarter', { veredito: 'inconclusivo' }),
      comEfeito('full', 0),
      fase('lastQuarter', { veredito: 'inconclusivo' }),
    ],
    0,
  );
  for (const l of naoMedido.linhas) conferirLinha(l, `sentido sem medida · ${l.familia}`);
  assert.match(naoMedido.asTres.porque, /mudou numa direção que não foi medida/);
  assert.ok(
    !naoMedido.asTres.porque.includes('ficou mais tarde'),
    'sem efeito medido não se afirma a direção do atraso',
  );
  assert.match(naoMedido.cheia.porque, /não se deslocou em direção nenhuma/);
  assert.ok(
    !naoMedido.cheia.porque.includes('ficou mais tarde'),
    'zero não é uma direção: era exatamente o que o operador de coalescência afirmava',
  );

  // E a elipse da segunda oração coordenada obedece à mesma régua.
  const duasSemMedida = comporFraseColetiva(
    [
      comEfeito('new', 21),
      comEfeito('firstQuarter', null),
      fase('full', { veredito: 'inconclusivo' }),
      comEfeito('lastQuarter', 0),
    ],
    0,
  );
  assert.match(duasSemMedida.asTres.porque, /em direção não medida/);
  assert.match(duasSemMedida.asTres.porque, /sem deslocamento/);
}
console.log('ok — direção não medida e zero não viram "ficou mais tarde"');

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

  // **E a incoerência é recusada, nas duas direções.** O portão é global às quatro,
  // então `acervo.noitesSemLuz` e os quatro `portaoReprovado` são a MESMA afirmação
  // em duas colunas. Antes, um acervo com noite sem luz e fases paradas em outros
  // portões fazia a frase dizer "global às quatro" enquanto cada bloco nomeava outro
  // motivo — as duas na mesma tela, e a frase escolhendo em silêncio por qual metade
  // falar.
  assert.throws(
    () => comporFraseColetiva(
      quatro({
        new: { veredito: 'inconclusivo', motivo: 'poder' },
        firstQuarter: { veredito: 'inconclusivo', motivo: 'amostra' },
        full: { veredito: 'inconclusivo', motivo: 'ciclos' },
        lastQuarter: { veredito: 'inconclusivo', motivo: 'poder' },
      }),
      1,
    ),
    (e: unknown) => {
      assert.ok(e instanceof Error);
      assert.match(e.message, /noitesSemLuz = 1 com 0 de 4/);
      assert.match(e.message, /fetchUltimaExecucaoLunar/, 'a mensagem diz o primeiro passo');
      return true;
    },
    'acervo sem luz com as fases paradas em outro portão é incoerência, não caso',
  );
  // O inverso: as quatro no portão da luz com o acervo dizendo zero noites sem luz.
  assert.throws(
    () => comporFraseColetiva(
      quatro({
        new: { veredito: 'inconclusivo', motivo: 'luz' },
        firstQuarter: { veredito: 'inconclusivo', motivo: 'luz' },
        full: { veredito: 'inconclusivo', motivo: 'luz' },
        lastQuarter: { veredito: 'inconclusivo', motivo: 'luz' },
      }),
      0,
    ),
    /noitesSemLuz = 0 com 4 de 4/,
    'as quatro na luz com o acervo em zero também é incoerência',
  );
  // E uma só na luz, que é o que o motor nunca produz: o portão não é por fase.
  assert.throws(
    () => comporFraseColetiva(
      quatro({
        new: { veredito: 'inconclusivo', motivo: 'luz' },
        firstQuarter: { veredito: 'inconclusivo', motivo: 'amostra' },
        full: { veredito: 'inconclusivo', motivo: 'poder' },
        lastQuarter: { veredito: 'inconclusivo', motivo: 'poder' },
      }),
      1,
    ),
    /1 de 4/,
  );
}
console.log('ok — a luz vem primeiro, e discordar do acervo é recusado nas duas direções');

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

  // **Congelada até o fundo.** Ela é um singleton de módulo que `fraseColetivaDe(null)`
  // entrega a todo chamador: um `frase.cheia.placar = …` em qualquer tela mudaria o
  // quarto estado do app inteiro, para sempre. `Object.freeze` na superfície deixava
  // `linhas` e cada linha mutáveis.
  assert.ok(Object.isFrozen(FRASE_SEM_LEITURA), 'a frase');
  assert.ok(Object.isFrozen(FRASE_SEM_LEITURA.linhas), 'a tupla das duas linhas');
  for (const l of FRASE_SEM_LEITURA.linhas) assert.ok(Object.isFrozen(l), `a linha ${l.familia}`);
  assert.throws(
    () => {
      (FRASE_SEM_LEITURA.cheia as { placar: string }).placar = 'A cheia decidiu.';
    },
    TypeError,
    'o quarto estado não se reescreve por atribuição',
  );
  assert.equal(FRASE_SEM_LEITURA.cheia.placar, 'A cheia não foi lida.');
}
console.log('ok — o quarto estado tem a mesma forma, congelado até o fundo');

/* ───────── A falha de leitura NÃO é o quarto estado, e desenha ───────── */

/**
 * *Não deu para ler* e *nunca rodou* são afirmações diferentes sobre a pilha de
 * tentativas, e a falha tem **frase própria** por uma razão medida: hoje
 * `lua_execucoes` não existe, as duas leituras lançam, e com a linha de entrada
 * desenhando só no estado `pronto` o pé do caderno Sono ficava vazio e `/sono/lua`
 * ficava **inalcançável** — a única porta da página mora nessa linha.
 *
 * E *falha de rede* não é *falha de integridade*: a primeira pede tentar de novo, a
 * segunda pede consertar dado e nunca melhora tentando.
 */
{
  const CAUSAS: readonly CausaDaFalhaLunar[] = ['rede', 'integridade'];
  for (const causa of CAUSAS) {
    const f = fraseDaFalha(causa);
    for (const l of f.linhas) conferirLinha(l, `falha ${causa} · ${l.familia}`);
    assert.ok(Object.isFrozen(f.linhas), `a falha ${causa} também é congelada até o fundo`);
    // Nenhuma falha afirma que a primeira execução não rodou: isso é o quarto estado.
    for (const l of f.linhas) {
      assert.ok(
        !l.porque.includes('ainda não rodou'),
        `a falha ${causa} não pode afirmar que nenhuma execução rodou`,
      );
      assert.ok(!l.placar.includes('decidiu'), 'quem não foi lido não decidiu nada');
    }
    assert.notDeepEqual(f, FRASE_SEM_LEITURA, `a falha ${causa} não é o quarto estado`);
  }
  assert.notDeepEqual(
    fraseDaFalha('rede'),
    fraseDaFalha('integridade'),
    'rede manda tentar de novo; integridade manda consertar — a frase não pode ser a mesma',
  );
  assert.match(fraseDaFalha('rede').cheia.porque, /Isto não diz que nenhuma rodou/);
  assert.match(fraseDaFalha('integridade').cheia.porque, /tentar de novo devolve o mesmo/);
}
console.log('ok — a falha de leitura tem frase própria, e a de integridade tem a dela');

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

  /**
   * **O piso: nunca lista vazia.** `inconclusivo` por poder com dispersão
   * degenerada sai sem `falta`, sem `p`, sem `poder` e sem efeito — então
   * `numeroDoBloco` devolve `null`, nenhuma medida entra, e o bloco imprimia **só o
   * nome da fase e a palavra "inconclusivo"**: a variante curta que a ADR 0045 §3
   * proíbe, na fase em que menos se pode encurtar.
   */
  const degenerada: ResultadoDaFase = {
    ...fase('new', { veredito: 'inconclusivo', motivo: 'poder' }),
    efeitoMin: null, p: null, zDeMannWhitney: null, poder: null,
    efeitoMinimoDetectavelMin: null, falta: null, noitesPara80: null,
  };
  assert.equal(numeroDoBloco(degenerada), null, 'sem a conta, não há número no bloco');
  const apoioDaDegenerada = apoioDoBloco(degenerada);
  assert.ok(apoioDaDegenerada.length > 0, 'o bloco sem número não encolhe — ele diz que não há');
  assert.equal(apoioDaDegenerada[0], APOIO_SEM_NUMERO);
  // E toda fase de todo veredito tem ao menos uma linha de apoio: é a invariante,
  // não o caso.
  for (const f of PHASE_ORDER) {
    for (const v of TODOS) {
      assert.ok(
        apoioDoBloco(fase(f, { veredito: v })).length > 0,
        `a fase ${f} em ${v} ficou sem linha de apoio`,
      );
    }
  }
}
console.log('ok — as linhas de apoio dizem o que foi medido, o que não foi, e nunca somem');

/* ────────────────── A moldura e os cabeçalhos de família ────────────────── */

{
  assert.equal(ordinalDaExecucao(0), 'nenhuma execução');
  assert.equal(ordinalDaExecucao(1), '1ª execução');
  assert.equal(ordinalDaExecucao(6), '6ª execução');
  assert.throws(() => ordinalDaExecucao(-1), RangeError);
  // **Fração não é contagem.** `Number.isFinite` aceitava `2.5`, e
  // `formatarNumero(2.5, 0)` arredondava: a página imprimia "3ª execução" debaixo de
  // uma mensagem que diz "não é uma contagem". `Number.isInteger` é o que a mensagem
  // descreve.
  for (const n of [2.5, 0.5, -0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => ordinalDaExecucao(n), RangeError, `${String(n)} não é uma contagem`);
  }

  // O α impresso é o do protocolo, e o arredondado dos documentos vem com a
  // divisão ao lado: 1,67% é MAIS FROUXO que 5/3 %.
  //
  // **Os dois saem das constantes, e o teste não pina literal nenhum.** Pinar
  // `'α 1,67% (0,05 / 3)'` provava que alguém digitou o mesmo texto duas vezes; o que
  // tem de ser verdade é que o texto é o α do protocolo, e isso só se prova
  // derivando o esperado do mesmo lugar de onde o código deriva.
  assert.equal(ALFA_DA_CHEIA, 0.05);
  assert.equal(
    ALFA_DO_GRUPO.cheia,
    `α ${(ALFA_DA_CHEIA * 100).toFixed(0)}% · unilateral · direção do atraso`,
  );
  assert.equal(
    ALFA_DO_GRUPO['as-tres'],
    `α ${(ALFA_DAS_TRES * 100).toFixed(2).replace('.', ',')}% `
    + `(${ALFA_DA_CHEIA.toFixed(2).replace('.', ',')} / ${String(FASES_DA_FAMILIA['as-tres'].length)}) `
    + '· bilateral',
  );
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

  // **O vocabulário de fase mora num lugar só.** São três formas do mesmo nome — o
  // do bloco, o da oração e o curto da figura —, e a tela que declarava o curto por
  // conta podia rebatizar uma fase sem nada reclamar.
  for (const f of PHASE_ORDER) {
    for (const [onde, mapa] of [
      ['NOME_DA_FASE', NOME_DA_FASE],
      ['ANTES_DA_FASE', ANTES_DA_FASE],
      ['ROTULO_CURTO_DA_FASE', ROTULO_CURTO_DA_FASE],
    ] as const) {
      assert.ok(mapa[f].length > 0, `${onde} não nomeia ${f}`);
    }
    assert.ok(Object.isFrozen(ROTULO_CURTO_DA_FASE), 'o rótulo curto é congelado');
  }
  assert.equal(ROTULO_CURTO_DA_FASE.firstQuarter, 'crescente');
  assert.equal(new Set(Object.values(ROTULO_CURTO_DA_FASE)).size, PHASE_ORDER.length);

  // **O limiar com a unidade concordando com ele** — a lição do "1 dias".
  assert.equal(LIMIAR_EM_PALAVRAS, `${String(LIMIAR_PRATICO_MIN)} minutos`);
  assert.ok(LIMIAR_EM_PALAVRAS.includes(String(LIMIAR_PRATICO_MIN)), 'o número é o da constante');

  // **A data do pré-registro sai de uma fonte, e a razão do grupo deriva dela.**
  // As três prosas que a citam — a razão, o versalete da página e o rodapé do método
  // — eram texto digitado três vezes, e corrigir uma deixava as outras duas mentindo.
  for (const familia of ['cheia', 'as-tres'] as const) {
    assert.ok(
      RAZAO_DO_GRUPO[familia].includes(DATA_DO_PRE_REGISTRO[familia]),
      `a razão do grupo ${familia} não cita a data declarada`,
    );
  }
  assert.notEqual(DATA_DO_PRE_REGISTRO.cheia, DATA_DO_PRE_REGISTRO['as-tres']);
  assert.ok(Object.isFrozen(DATA_DO_PRE_REGISTRO));

  // O rótulo de família é o mesmo que a leitura usa — uma fonte, não duas.
  assert.deepEqual(Object.keys(ROTULO_DA_FAMILIA).sort(), ['as-tres', 'cheia']);
}
console.log('ok — a moldura, os α derivados, as datas e o vocabulário dos quatro blocos');
