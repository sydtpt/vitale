/**
 * Testes do motor do teste lunar — puros, sem framework. Rodar com:
 *   cd packages/shared && npx tsx src/sleep/lua-protocolo.test.ts
 *
 * **Nenhum dado de sono real entra aqui, e nenhum pode entrar.** Os dois
 * pré-registros proíbem olhar mediana por fase antes da execução autorizada, e um
 * teste que carregasse noites de produção seria a execução acontecendo por acidente.
 * Todo acervo daqui é sintético e determinístico — a semente é parte do teste.
 *
 * O que este arquivo cobra, em três camadas:
 *
 * 1. **As vinte células das duas tabelas de poder**, no dígito que os documentos
 *    imprimem. Elas são a única parte do protocolo que já vinha calculada, e são o
 *    oráculo externo do motor: se o modelo de poder daqui discordasse delas, seria o
 *    modelo que estaria errado, não o documento.
 * 2. **A tabela de veredito**, com o poder como portão. O ramo "significante sem
 *    poder" é o provável com 290 noites, não o exótico, e ele tem de sair
 *    `inconclusivo` nas duas pontas — com o limiar passado e sem ele.
 * 3. **As escolhas que não estão nos documentos** — residualização da luz, correção
 *    de continuidade, origem do eixo, SD marginal no poder —, cada uma com uma
 *    asserção que reprova quem a apagar.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PHASE_ORDER, type LunarPhaseKind } from '../astro/moon';
import { janelaLunar } from './lua';
import {
  ALFA_DAS_TRES,
  ALFA_DA_CHEIA,
  CICLOS_MINIMOS,
  LIMIAR_PRATICO_MIN,
  NOITES_MINIMAS_POR_COLUNA,
  PODER_MINIMO,
  PROTOCOLO_LUNAR,
  UNIDADE_DO_MOTIVO,
  efeitoMinimoDetectavel,
  noitesParaPoder,
  poderLunar,
  vereditoLunar,
  type Lateralidade,
  type MotivoDoInconclusivo,
  type NoiteLunarMedida,
  type OQueFalta,
  type ResultadoDaFase,
  type VereditoLunarCompleto,
} from './lua-protocolo';
import { SLEEP_AXIS_ORIGIN_H, axisPosition } from './timing';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

const DAY_MS = 86_400_000;

/* ─────────────────────── Oficina de acervos sintéticos ─────────────────────── */

/** Gerador determinístico (mulberry32) — a semente é parte do caso, não um detalhe. */
function sorteio(semente: number): () => number {
  let s = semente >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussianas(n: number, semente: number): number[] {
  const u = sorteio(semente);
  const out: number[] = [];
  while (out.length < n) {
    const a = Math.max(u(), 1e-12);
    const b = u();
    const r = Math.sqrt(-2 * Math.log(a));
    out.push(r * Math.cos(2 * Math.PI * b));
    if (out.length < n) out.push(r * Math.sin(2 * Math.PI * b));
  }
  return out;
}

function media(xs: readonly number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function desvio(xs: readonly number[]): number {
  if (xs.length < 2) return 0;
  const m = media(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

function covariancia(xs: readonly number[], ys: readonly number[]): number {
  const mx = media(xs);
  const my = media(ys);
  let s = 0;
  for (let i = 0; i < xs.length; i += 1) s += (xs[i] - mx) * (ys[i] - my);
  return s / (xs.length - 1);
}

/** `wakeDay`s consecutivos a partir de `de`. */
function diasDesde(de: string, n: number): string[] {
  const t0 = Date.parse(`${de}T00:00:00Z`);
  return Array.from({ length: n }, (_, i) => new Date(t0 + i * DAY_MS).toISOString().slice(0, 10));
}

/**
 * Horas de luz do dia, ~50,8° N: de ~8 h a ~16 h 30, como a §3 descreve a Bélgica.
 *
 * Sintética de propósito: o motor não calcula luz, e um teste que a calculasse pelo
 * `astro/sun` estaria testando o sol, não o protocolo.
 */
function luzDoDia(wakeDay: string): number {
  const ano = Number(wakeDay.slice(0, 4));
  const doy = Math.round((Date.parse(`${wakeDay}T00:00:00Z`) - Date.UTC(ano, 0, 1)) / DAY_MS);
  return 12.25 + 4.25 * Math.sin((2 * Math.PI * (doy - 80)) / 365.25);
}

/** Em qual das quatro janelas a noite caiu — a mesma classificação que o motor usa. */
function faseDe(wakeDay: string): LunarPhaseKind | null {
  for (const f of PHASE_ORDER) if (janelaLunar(wakeDay, f) !== null) return f;
  return null;
}

/**
 * Uma noite com a hora local de apagar exata.
 *
 * `onsetAt` é construído para que `axisPosition(onsetAt, tzOffset)` devolva
 * `horaLocal − 18` — é assim que o caso escreve a hora que quer testar sem depender
 * do fuso do hospedeiro.
 */
function noite(
  wakeDay: string,
  horaLocal: number,
  luzH: number | null,
  tzOffset = 60,
): NoiteLunarMedida {
  const h = ((horaLocal % 24) + 24) % 24;
  const ms =
    Date.parse(`${wakeDay}T00:00:00Z`) - DAY_MS + Math.round(h * 3_600_000) - tzOffset * 60_000;
  return { wakeDay, onsetAt: new Date(ms).toISOString(), tzOffset, luzH };
}

interface Receita {
  de: string;
  noites: number;
  /** Hora local média de apagar. */
  horaBase: number;
  /** Desvio do ruído, em minutos — reescalado para ser exatamente este. */
  ruidoSd: number;
  /** Minutos de apagar por hora de luz do dia. É o que infla o SD marginal. */
  bLuz?: number;
  /** Minutos somados às noites da janela de cada fase. */
  efeito?: Partial<Record<LunarPhaseKind, number>>;
  semente?: number;
  tzOffset?: number;
}

/** O ruído exato de uma receita — centrado e reescalado para `sd` no desvio amostral. */
function ruidoDe(n: number, sd: number, semente: number): number[] {
  const cru = gaussianas(n, semente);
  const m = media(cru);
  const s = desvio(cru);
  return cru.map((v) => (s > 0 ? ((v - m) * sd) / s : 0));
}

function acervo(r: Receita): NoiteLunarMedida[] {
  const dias = diasDesde(r.de, r.noites);
  const ruido = ruidoDe(dias.length, r.ruidoSd, r.semente ?? 20260928);
  return dias.map((d, i) => {
    const luz = luzDoDia(d);
    const f = faseDe(d);
    const extra = f === null ? 0 : (r.efeito?.[f] ?? 0);
    const desloc = ruido[i] + extra + (r.bLuz ?? 0) * (luz - 12.25);
    return noite(d, r.horaBase + desloc / 60, luz, r.tzOffset);
  });
}

/**
 * Fisher–Yates determinístico: a MESMA lista, em outra ordem.
 *
 * Existe porque `vereditoLunar` recebe uma `readonly NoiteLunarMedida[]` e **nunca
 * prometeu** que ela chega ordenada — quem a montar de duas consultas, ou de um
 * `Promise.all`, entrega o que o banco devolver. Três coisas do resultado dependem de
 * qual ordem é lida, e elas não podem ser a mesma: `de`/`ate` são cronológicos,
 * `primeiraNoiteSemLuz` é de entrada, e efeito/p/veredito não podem ser nenhuma das duas.
 */
function embaralhar<T>(xs: readonly T[], semente: number): T[] {
  const u = sorteio(semente);
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(u() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function daFase(v: { fases: readonly ResultadoDaFase[] }, fase: LunarPhaseKind): ResultadoDaFase {
  const r = v.fases.find((x) => x.fase === fase);
  assert.ok(r, `a fase ${fase} não veio no resultado`);
  return r;
}

/* ───────────── As invariantes que TODO veredito deste arquivo carrega ───────────── */

/**
 * `vereditoLunar` com as invariantes de saída cobradas — **a porta de todo caso daqui**.
 *
 * Existe por um achado de revisão de 28/09: os campos que o resultado **publica** não
 * estavam presos. `familia`, `alfa`, `lateralidade` e `direcao` são copiados da linha
 * do protocolo para cada resultado, e só a tabela de **entrada** era asserida — mutar
 * `familia: 'cheia'` ou `alfa: 0.05` no ramo medido deixava a suíte inteira verde. Isso
 * faria as três fases exploratórias saírem carimbadas como confirmatórias, que é
 * exatamente o empréstimo de hipótese que a §2 e a §5 de 28/09 existem para impedir.
 * `noitesPara80` e `efeitoMinimoDetectavelMin` estavam abertos do mesmo jeito.
 *
 * Como a checagem é invariante — vale para qualquer acervo —, ela roda em **todos** os
 * vereditos do arquivo em vez de num caso só: nenhum caso novo pode esquecer dela.
 */
function rodarEConferir(noites: readonly NoiteLunarMedida[]): VereditoLunarCompleto {
  const v = vereditoLunar(noites);

  assert.equal(v.fases.length, PROTOCOLO_LUNAR.length, 'as quatro deixaram de ser quatro');
  // As quatro na MESMA ORDEM do protocolo, e casadas POSICIONALMENTE com a linha —
  // casar por `fase` deixaria passar um resultado que trocou de posição.
  v.fases.forEach((f, i) => {
    const linha = PROTOCOLO_LUNAR[i];
    const onde = `${linha.fase} (posição ${i})`;
    assert.equal(f.fase, linha.fase, `${onde}: fase`);
    assert.equal(f.familia, linha.familia, `${onde}: familia`);
    assert.equal(f.alfa, linha.alfa, `${onde}: alfa`);
    assert.equal(f.lateralidade, linha.lateralidade, `${onde}: lateralidade`);
    assert.equal(f.direcao, linha.direcao, `${onde}: direcao`);

    // Coerência: unilateral SE E SOMENTE SE há direção declarada. Uma linha
    // unilateral sem direção aceitaria achado nos dois sentidos com o α de um; uma
    // bilateral com direção recusaria metade dos achados que ela pré-registrou.
    assert.equal(
      f.lateralidade === 'unilateral',
      f.direcao !== null,
      `${onde}: lateralidade e direcao discordam`,
    );

    // A direção é COBRADA no achado, e não só declarada: na cheia, só o atraso.
    if (f.veredito === 'achado' && f.direcao === 'atraso') {
      assert.ok((f.efeitoMin ?? 0) > 0, `${onde}: achado unilateral com efeito ${f.efeitoMin}`);
    }

    // Poder, MDE e noites-para-80 saem das MESMAS contas públicas, montadas a partir
    // do SD do acervo e das contagens do próprio resultado. Um portão reprovado zera
    // as três — nada foi medido, e nulo é "não foi medido".
    const par = {
      sdMin: v.acervo.sdMin ?? Number.NaN,
      noitesDentro: f.noitesDentro,
      noitesFora: f.noitesFora,
      alfa: linha.alfa,
      lateralidade: linha.lateralidade,
    };
    if (f.portaoReprovado !== null) {
      assert.equal(f.efeitoMinimoDetectavelMin, null, `${onde}: MDE medido com portão fechado`);
      assert.equal(f.noitesPara80, null, `${onde}: noitesPara80 com portão fechado`);
      assert.equal(f.poder, null, `${onde}: poder medido com portão fechado`);
      assert.equal(f.efeitoMin, null, `${onde}: efeito medido com portão fechado`);
      assert.equal(f.p, null, `${onde}: p medido com portão fechado`);
      assert.equal(f.zDeMannWhitney, null, `${onde}: z medido com portão fechado`);
    } else {
      assert.equal(f.efeitoMinimoDetectavelMin, efeitoMinimoDetectavel(par), `${onde}: MDE`);
      assert.equal(f.noitesPara80, noitesParaPoder(par), `${onde}: noitesPara80`);
      assert.equal(f.poder, poderLunar(par), `${onde}: poder`);
    }

    // O veredito e o motivo andam juntos, e o que falta vem com a unidade do motivo.
    if (f.veredito === 'inconclusivo') {
      assert.ok(f.motivo !== null, `${onde}: inconclusivo sem motivo`);
      assert.equal(f.portaoReprovado, f.motivo === 'poder' ? null : f.motivo, `${onde}: portão`);
      if (f.falta !== null) {
        assert.equal(f.falta.unidade, UNIDADE_DO_MOTIVO[f.motivo], `${onde}: unidade do que falta`);
        assert.ok(f.falta.quanto >= 1, `${onde}: faltam ${f.falta.quanto} — zero não é falta`);
      }
    } else {
      assert.equal(f.motivo, null, `${onde}: ${f.veredito} com motivo`);
      assert.equal(f.portaoReprovado, null, `${onde}: ${f.veredito} com portão reprovado`);
      assert.equal(f.falta, null, `${onde}: ${f.veredito} dizendo que falta algo`);
      assert.ok((f.poder ?? 0) >= PODER_MINIMO, `${onde}: ${f.veredito} sem poder`);
    }

    // O `z` publicado tem de ser o que produziu o `p` — é para isso que ele existe.
    // Sem `z` e com `p`, o único p legítimo é 1: o empate perfeito, em que não houve
    // teste e o p é decisão declarada. Qualquer outro par seria p sem procedência.
    const z = f.zDeMannWhitney;
    if (f.p !== null && z === null) {
      assert.equal(f.p, 1, `${onde}: p ${f.p} sem z, e só o p=1 do empate pode ficar sem`);
    }
    if (z !== null) {
      assert.ok(f.p !== null, `${onde}: z sem p`);
      const daTabela =
        f.lateralidade === 'bilateral'
          ? Math.min(1, 2 * (1 - phiDeReferencia(z)))
          : 1 - phiDeReferencia(z);
      assert.ok(Math.abs((f.p ?? 0) - daTabela) < 1e-6, `${onde}: p ${f.p} não sai do z ${z}`);
    }
  });

  // O acervo recusa duplicata na porta, então estas duas contagens nunca divergem.
  assert.equal(v.acervo.noitesDistintas, v.acervo.noites, 'a guarda de duplicata caiu');
  return v;
}

/* ───────── Oráculo independente: MQO + Hodges–Lehmann + Mann–Whitney ───────── */

/** Posições no eixo de 18h, em minutos — sem desdobramento, que é do motor. */
function posicoes(noites: readonly NoiteLunarMedida[]): number[] {
  return noites.map((n) => axisPosition(n.onsetAt, n.tzOffset, SLEEP_AXIS_ORIGIN_H) * 60);
}

function residuosDeReferencia(valores: readonly number[], luz: readonly number[]): number[] {
  const mx = media(luz);
  const my = media(valores);
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < valores.length; i += 1) {
    sxy += (luz[i] - mx) * (valores[i] - my);
    sxx += (luz[i] - mx) ** 2;
  }
  const b = sxx > 0 ? sxy / sxx : 0;
  return valores.map((v, i) => v - my - b * (luz[i] - mx));
}

function medianaDeReferencia(xs: readonly number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const i = (s.length - 1) / 2;
  return s[Math.floor(i)] + (s[Math.ceil(i)] - s[Math.floor(i)]) * (i - Math.floor(i));
}

function hlDeReferencia(a: readonly number[], b: readonly number[]): number {
  const pares: number[] = [];
  for (const x of a) for (const y of b) pares.push(x - y);
  return medianaDeReferencia(pares);
}

function phiDeReferencia(z: number): number {
  // Abramowitz–Stegun 7.1.26 por erf, refinado por série — chega para comparar dois
  // caminhos do MESMO p, que é para o que ela serve aqui.
  const t = 1 / (1 + 0.3275911 * Math.abs(z) * Math.SQRT1_2);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp((-z * z) / 2);
  return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

/** Mann–Whitney de referência, com a correção de continuidade opcional. */
function mwDeReferencia(
  a: readonly number[],
  b: readonly number[],
  lateralidade: Lateralidade,
  correcao: number,
): number {
  const n1 = a.length;
  const n2 = b.length;
  const n = n1 + n2;
  const todos = [...a.map((v) => ({ v, t: true })), ...b.map((v) => ({ v, t: false }))].sort(
    (x, y) => x.v - y.v,
  );
  let soma = 0;
  let empates = 0;
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && todos[j + 1].v === todos[i].v) j += 1;
    const posto = (i + j) / 2 + 1;
    const t = j - i + 1;
    if (t > 1) empates += t ** 3 - t;
    for (let k = i; k <= j; k += 1) if (todos[k].t) soma += posto;
    i = j + 1;
  }
  const u = soma - (n1 * (n1 + 1)) / 2;
  const mu = (n1 * n2) / 2;
  const sigma = Math.sqrt(Math.max(0, ((n1 * n2) / 12) * (n + 1 - empates / (n * (n - 1)))));
  if (!(sigma > 0)) return 1;
  const dif = u - mu;
  if (lateralidade === 'bilateral') {
    const z = Math.max(0, Math.abs(dif) - correcao) / sigma;
    return Math.min(1, 2 * (1 - phiDeReferencia(z)));
  }
  return 1 - phiDeReferencia((dif - correcao) / sigma);
}

/* ─────────────────────── O protocolo é dado ─────────────────────── */

check('PROTOCOLO_LUNAR tem quatro linhas, na ordem da lunação, com os dois α', () => {
  assert.equal(PROTOCOLO_LUNAR.length, 4);
  assert.deepEqual(
    PROTOCOLO_LUNAR.map((l) => l.fase),
    [...PHASE_ORDER],
    'a ordem do protocolo não é a de PHASE_ORDER',
  );
  const cheia = PROTOCOLO_LUNAR.find((l) => l.fase === 'full');
  assert.ok(cheia);
  assert.equal(cheia.familia, 'cheia');
  assert.equal(cheia.alfa, 0.05);
  assert.equal(cheia.lateralidade, 'unilateral');
  assert.equal(cheia.direcao, 'atraso');
  for (const l of PROTOCOLO_LUNAR.filter((x) => x.fase !== 'full')) {
    assert.equal(l.familia, 'as-tres', `${l.fase}`);
    assert.equal(l.alfa, ALFA_DAS_TRES, `${l.fase}`);
    assert.equal(l.lateralidade, 'bilateral', `${l.fase}`);
    assert.equal(l.direcao, null, `${l.fase}`);
  }
  // A divisão escrita, não o 0,0167 que o documento imprime arredondado: o
  // arredondado é MAIS FROUXO que o protocolo, e aqui isso nunca passa.
  assert.equal(ALFA_DAS_TRES, 0.05 / 3);
  assert.ok(ALFA_DAS_TRES < 0.0167, 'ALFA_DAS_TRES ficou mais frouxo que a divisão');
  assert.equal(ALFA_DA_CHEIA, 0.05);
  assert.equal(LIMIAR_PRATICO_MIN, 15);
  assert.equal(PODER_MINIMO, 0.8);
  assert.equal(NOITES_MINIMAS_POR_COLUNA, 5);
  assert.equal(CICLOS_MINIMOS, 10);
});

/* ─────────────────────── As duas tabelas de poder ─────────────────────── */

/** n = 49 dentro × 241 fora — a geometria que os dois documentos usam. */
const N_DENTRO = 49;
const N_FORA = 241;

/** `[SD, efeito mín. detectável, poder p/ 15 min, poder p/ 30 min]` */
type LinhaDeTabela = readonly [number, number, number, number];

function conferirTabela(titulo: string, alfa: number, lateralidade: Lateralidade, linhas: readonly LinhaDeTabela[]): void {
  console.log(`     · ${titulo}`);
  console.log('       SD   MDE(80%)   p/15min   p/30min');
  for (const [sd, mde, p15, p30] of linhas) {
    const base = { sdMin: sd, noitesDentro: N_DENTRO, noitesFora: N_FORA, alfa, lateralidade };
    const meuMde = efeitoMinimoDetectavel(base);
    const meu15 = poderLunar({ ...base, efeitoMin: 15 });
    const meu30 = poderLunar({ ...base, efeitoMin: 30 });
    assert.ok(meuMde !== null && meu15 !== null && meu30 !== null);
    console.log(
      `       ${String(sd).padStart(2)}   ${meuMde.toFixed(1).padStart(8)}   ` +
        `${`${Math.round(meu15 * 100)}%`.padStart(7)}   ${`${Math.round(meu30 * 100)}%`.padStart(7)}`,
    );
    assert.equal(meuMde.toFixed(1), mde.toFixed(1), `${titulo}: MDE a SD ${sd}`);
    assert.equal(Math.round(meu15 * 100), p15, `${titulo}: poder p/ 15 min a SD ${sd}`);
    assert.equal(Math.round(meu30 * 100), p30, `${titulo}: poder p/ 30 min a SD ${sd}`);
  }
}

check('§5 de 07/09 — a tabela da cheia (5%, unilateral) sai no dígito do documento', () => {
  conferirTabela('cheia · α 5% unilateral · 49 × 241', ALFA_DA_CHEIA, 'unilateral', [
    [30, 11.7, 94, 100],
    [45, 17.5, 69, 100],
    [60, 23.4, 48, 94],
    [75, 29.2, 36, 82],
    [90, 35.1, 28, 69],
  ]);
});

check('§6 de 28/09 — a tabela das três (1,67%, bilateral) sai no dígito do documento', () => {
  conferirTabela('as três · α 5%/3 bilateral · 49 × 241', ALFA_DAS_TRES, 'bilateral', [
    [30, 15.2, 79, 100],
    [45, 22.8, 39, 97],
    [60, 30.4, 21, 79],
    [75, 38.0, 13, 56],
    [90, 45.6, 9, 39],
  ]);
});

check('noites totais para 80% em 15 min — o modelo ao lado do que os documentos imprimem', () => {
  const casos: { titulo: string; alfa: number; lat: Lateralidade; linhas: [number, number][] }[] = [
    { titulo: 'cheia (§5)', alfa: ALFA_DA_CHEIA, lat: 'unilateral', linhas: [[45, 396], [60, 706], [75, 1101]] },
    { titulo: 'as três (§6)', alfa: ALFA_DAS_TRES, lat: 'bilateral', linhas: [[45, 672], [60, 1193], [75, 1864]] },
  ];
  for (const c of casos) {
    for (const [sd, impresso] of c.linhas) {
      const meu = noitesParaPoder({
        sdMin: sd,
        noitesDentro: N_DENTRO,
        noitesFora: N_FORA,
        alfa: c.alfa,
        lateralidade: c.lat,
      });
      assert.ok(meu !== null);
      console.log(`     · ${c.titulo} SD ${sd}: modelo ${meu} · documento ${impresso}`);
      // A regra é `ceil`, e ela está documentada em `noitesParaPoder`. As três linhas
      // do §6 batem exatamente; as do §5 ficam a uma noite, porque o documento
      // arredondou à mão. A tolerância existe para que a diferença seja IMPRESSA em
      // vez de ficar calada — não para que ela possa crescer.
      assert.ok(
        Math.abs(meu - impresso) <= 2,
        `${c.titulo} SD ${sd}: modelo ${meu}, documento ${impresso}`,
      );
    }
  }
});

/* ─────────────────────── A superfície pública (§9) ─────────────────────── */

check('SUPERFÍCIE PÚBLICA — nenhuma porta calcula uma fase sozinha, e nada reexporta', () => {
  const fonte = readFileSync(join(import.meta.dirname, 'lua-protocolo.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  // As três formas que uma declaração nomeada não cobre. `export *` reabriria o
  // arquivo inteiro; `export {}` e `export default` passariam pelo regex de baixo.
  assert.ok(!/\bexport\s+default\b/.test(fonte), 'apareceu um `export default`');
  assert.ok(!/\bexport\s*\*/.test(fonte), 'apareceu um `export *`');
  assert.ok(!/\bexport\s*\{/.test(fonte), 'apareceu um `export { … }`');

  const nomes = [...fonte.matchAll(/^export\s+(?:const|function|type|interface|class|enum|let|var)\s+([A-Za-z_$][\w$]*)/gm)]
    .map((m) => m[1])
    .sort();
  // Toda palavra `export` do arquivo tem de ser uma dessas declarações: é o que
  // impede uma quinta forma de exportar de entrar sem ser vista.
  assert.equal(
    (fonte.match(/\bexport\b/g) ?? []).length,
    nomes.length,
    'há um `export` que não é declaração nomeada',
  );
  assert.deepEqual(nomes, [
    'ALFA_DAS_TRES',
    'ALFA_DA_CHEIA',
    'AcervoLunar',
    'CICLOS_MINIMOS',
    'FamiliaLunar',
    'LIMIAR_PRATICO_MIN',
    'Lateralidade',
    'LinhaDoProtocolo',
    'MotivoDoInconclusivo',
    'NOITES_MINIMAS_POR_COLUNA',
    'NoiteLunarMedida',
    'OQueFalta',
    'PODER_MINIMO',
    'PROTOCOLO_LUNAR',
    'ParametrosDePoder',
    'PortaoLunar',
    'QuatroLinhas',
    'QuatroResultados',
    'ResultadoDaFase',
    'UNIDADE_DO_MOTIVO',
    'UnidadeDoQueFalta',
    'VereditoLunar',
    'VereditoLunarCompleto',
    'efeitoMinimoDetectavel',
    'noitesParaPoder',
    'poderLunar',
    'vereditoLunar',
  ]);
  // As funções exportadas: `vereditoLunar` é a porta das quatro, e as outras três
  // recebem dispersão e tamanho de coluna, nunca uma noite — é o que a §5 manda
  // calcular ANTES de olhar o dado.
  const funcoes = [...fonte.matchAll(/^export\s+function\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]).sort();
  assert.deepEqual(funcoes, ['efeitoMinimoDetectavel', 'noitesParaPoder', 'poderLunar', 'vereditoLunar']);
  for (const privado of [
    'resolverFase',
    'rodarLinha',
    'mannWhitney',
    'hodgesLehmann',
    'residuosDaLuz',
    'desdobrarEixo',
    'naDirecaoDeclarada',
    'parametrosUtilizaveis',
  ]) {
    assert.ok(new RegExp(`function ${privado}\\b`).test(fonte), `${privado} sumiu do arquivo`);
    assert.ok(!new RegExp(`export\\s+function ${privado}\\b`).test(fonte), `${privado} virou público`);
  }
  // O 5 por coluna é constante própria: importar o `TRIGGER_MIN_PER_CELL` do gatilho
  // faria uma calibração legítima daquela feature mover um portão pré-registrado
  // daqui. E `buckets` fica de fora porque `weekKey` lê o fuso do hospedeiro — a
  // guarda de pureza só olha um nível de import, então ele passaria calado.
  assert.ok(!/from '\.\/triggers'/.test(fonte), 'o motor passou a importar de ./triggers');
  assert.ok(!/from '\.\/buckets'/.test(fonte), 'o motor passou a importar de ./buckets');
});

/* ─────────────────────── A matriz da spec ─────────────────────── */

/** Acervo de 400 noites, dispersão baixa: os três portões passam nas quatro fases. */
const LIMPO = acervo({ de: '2025-01-01', noites: 400, horaBase: 0.5, ruidoSd: 25 });

check('quatro fases, portões passando — quatro resultados completos', () => {
  const v = rodarEConferir(LIMPO);
  assert.equal(v.fases.length, 4);
  assert.deepEqual(v.fases.map((f) => f.fase), [...PHASE_ORDER]);
  for (const f of v.fases) {
    assert.equal(f.portaoReprovado, null, `${f.fase}`);
    assert.ok(f.noitesDentro >= NOITES_MINIMAS_POR_COLUNA, `${f.fase} dentro`);
    assert.ok(f.noitesFora >= NOITES_MINIMAS_POR_COLUNA, `${f.fase} fora`);
    assert.ok(f.ciclos >= CICLOS_MINIMOS, `${f.fase} ciclos`);
    assert.equal(f.noitesDentro + f.noitesFora, 400, `${f.fase} soma`);
    assert.ok(typeof f.efeitoMin === 'number' && Number.isFinite(f.efeitoMin), `${f.fase} efeito`);
    assert.ok(typeof f.p === 'number' && f.p >= 0 && f.p <= 1, `${f.fase} p`);
    assert.ok(typeof f.poder === 'number' && f.poder > PODER_MINIMO, `${f.fase} poder`);
    assert.ok(f.efeitoMinimoDetectavelMin !== null, `${f.fase} MDE`);
    assert.equal(f.veredito, 'nenhum_padrao', `${f.fase}: acervo sem efeito e com poder`);
    assert.equal(f.motivo, null, `${f.fase}`);
    assert.equal(f.falta, null, `${f.fase}`);
  }
  console.log(
    `     · ${v.acervo.noites} noites · SD marginal ${v.acervo.sdMin?.toFixed(1)} min · ` +
      `dentro/fora ${v.fases[0].noitesDentro}/${v.fases[0].noitesFora} · ciclos ${v.fases[0].ciclos}`,
  );
});

check('PROVENIÊNCIA — intervalo, noites distintas, origem do eixo e o diagnóstico da luz', () => {
  const v = rodarEConferir(LIMPO);
  assert.equal(v.acervo.noites, 400);
  assert.equal(v.acervo.noitesDistintas, 400);
  assert.equal(v.acervo.de, '2025-01-01');
  assert.equal(v.acervo.ate, diasDesde('2025-01-01', 400)[399]);
  assert.equal(v.acervo.origemDoEixoH, SLEEP_AXIS_ORIGIN_H, 'dado normal não move a origem');
  assert.equal(v.acervo.noitesSemLuz, 0);
  assert.equal(v.acervo.primeiraNoiteSemLuz, null);
  assert.ok(Math.abs((v.acervo.sdMin ?? 0) - 25) < 1, `SD marginal ${v.acervo.sdMin}`);
});

check('a noite que atravessa a meia-noite dista 20 min da vizinha, não 1.420', () => {
  // 23h50 e 00h10 em minutos desde a meia-noite distam 1.420; no eixo de 18h, 20.
  const dias = diasDesde('2025-01-01', 400);
  const noites = dias.map((d) => noite(d, faseDe(d) === 'full' ? 0 + 10 / 60 : 23 + 50 / 60, luzDoDia(d)));
  const v = rodarEConferir(noites);
  assert.equal(v.acervo.origemDoEixoH, SLEEP_AXIS_ORIGIN_H);
  const cheia = daFase(v, 'full');
  assert.equal(Math.round(cheia.efeitoMin ?? 0), 20, 'a meia-noite virou 1.420 minutos');
});

check('portão de amostra — só a fase curta para, e ela diz quantas noites faltam', () => {
  // Três noites da janela da nova sobrevivem; as demais somem do acervo.
  let vistas = 0;
  const curto = LIMPO.filter((n) => {
    if (faseDe(n.wakeDay) !== 'new') return true;
    vistas += 1;
    return vistas <= 3;
  });
  const v = rodarEConferir(curto);
  const nova = daFase(v, 'new');
  assert.equal(nova.veredito, 'inconclusivo');
  assert.equal(nova.portaoReprovado, 'amostra');
  assert.equal(nova.motivo, 'amostra');
  assert.equal(nova.noitesDentro, 3);
  // O que falta aqui é **vaga de coluna**, e não noite a coletar: quatro noites novas
  // que caíssem todas fora da janela da nova não fechariam nenhuma das duas.
  assert.deepEqual(nova.falta, { quanto: 2, unidade: 'noites-de-coluna' });
  assert.equal(nova.efeitoMin, null);
  assert.equal(nova.p, null);
  assert.equal(nova.poder, null);
  for (const outra of v.fases.filter((f) => f.fase !== 'new')) {
    assert.notEqual(outra.veredito, 'inconclusivo', `${outra.fase} parou junto`);
  }
});

check('portão de ciclos — dez ciclos, e não dez noites de um ciclo só', () => {
  // Só as noites dos seis primeiros ciclos da cheia ficam: 30 noites dentro,
  // amostra de sobra, e mesmo assim o desenho não tem as replicações internas.
  const ciclos: number[] = [];
  const poucos = LIMPO.filter((n) => {
    const j = janelaLunar(n.wakeDay, 'full');
    if (j === null) return true;
    const t = j.instante.getTime();
    if (!ciclos.includes(t)) ciclos.push(t);
    return ciclos.indexOf(t) < 6;
  });
  const v = rodarEConferir(poucos);
  const cheia = daFase(v, 'full');
  assert.equal(cheia.ciclos, 6);
  assert.ok(cheia.noitesDentro >= NOITES_MINIMAS_POR_COLUNA, 'a amostra tinha de passar');
  assert.equal(cheia.veredito, 'inconclusivo');
  assert.equal(cheia.portaoReprovado, 'ciclos');
  // Ciclo, e não noite: cem noites do sétimo ciclo não movem este número de 4 para 3.
  assert.deepEqual(cheia.falta, { quanto: CICLOS_MINIMOS - 6, unidade: 'ciclos' });
  assert.equal(cheia.efeitoMin, null);
  assert.equal(cheia.p, null);
});

check('uma noite sem luz derruba as QUATRO — a luz é pré-requisito, não ressalva', () => {
  const comBuraco = LIMPO.map((n, i) => (i === 137 ? { ...n, luzH: null } : n));
  const v = rodarEConferir(comBuraco);
  assert.equal(v.acervo.noitesSemLuz, 1);
  assert.equal(v.acervo.primeiraNoiteSemLuz, LIMPO[137].wakeDay);
  for (const f of v.fases) {
    assert.equal(f.veredito, 'inconclusivo', `${f.fase}`);
    assert.equal(f.portaoReprovado, 'luz', `${f.fase}`);
    // Noite **sem luz**, que já está no acervo: coletar não conserta, corrigir o dado sim.
    assert.deepEqual(f.falta, { quanto: 1, unidade: 'noites-sem-luz' }, `${f.fase}`);
    assert.equal(f.efeitoMin, null, `${f.fase}`);
    assert.equal(f.p, null, `${f.fase}`);
    assert.equal(f.poder, null, `${f.fase}`);
    // O diagnóstico continua: sem ele o portão da luz é indistinguível de um bug.
    assert.ok(f.noitesDentro > 0 && f.noitesFora > 0, `${f.fase} perdeu a contagem`);
  }
});

check('luzH fora de [0, 24] conta como luz ausente, não como luz zero', () => {
  for (const ruim of [-1, 25, Number.NaN, Number.POSITIVE_INFINITY]) {
    const v = rodarEConferir(LIMPO.map((n, i) => (i === 9 ? { ...n, luzH: ruim } : n)));
    assert.equal(v.acervo.noitesSemLuz, 1, `luzH ${String(ruim)}`);
    assert.equal(daFase(v, 'full').portaoReprovado, 'luz', `luzH ${String(ruim)}`);
  }
  // Zero e 24 são luz de verdade — polo em dezembro e em junho, não ausência.
  const v = rodarEConferir(LIMPO.map((n, i) => (i === 9 ? { ...n, luzH: 0 } : n)));
  assert.equal(v.acervo.noitesSemLuz, 0);
});

check('PRECEDÊNCIA — buraco de luz JUNTO com coluna curta sai como luz, nunca como amostra', () => {
  let vistas = 0;
  const curto = LIMPO.filter((n) => {
    if (faseDe(n.wakeDay) !== 'new') return true;
    vistas += 1;
    return vistas <= 3;
  }).map((n, i) => (i === 40 ? { ...n, luzH: null } : n));
  const v = rodarEConferir(curto);
  for (const f of v.fases) {
    assert.equal(f.portaoReprovado, 'luz', `${f.fase} não reportou a luz`);
  }
  // E a coluna curta continua visível no diagnóstico — o portão da luz não a apaga.
  assert.equal(daFase(v, 'new').noitesDentro, 3);
});

/**
 * O mesmo `LIMPO`, fora de ordem. A ordem de entrada e a cronológica se separam aqui.
 */
const EMBARALHADO = embaralhar(LIMPO, 31415);

check('TRÊS noites sem luz — a CONTAGEM, e a primeira em ORDEM DE ENTRADA', () => {
  // Com uma ofensora só, "quantas faltam" é indistinguível da constante 1 e "a
  // primeira" é igual à última: as duas mutações passavam verdes. Três separam as três
  // respostas — e num acervo embaralhado a primeira de entrada não é a mais antiga.
  const posicoesOfensoras = [5, 80, 300];
  const alvos = posicoesOfensoras.map((i) => EMBARALHADO[i]);
  const maisAntiga = [...alvos].map((n) => n.wakeDay).sort()[0];
  assert.notEqual(alvos[0].wakeDay, maisAntiga, 'o caso degenerou: a 1ª de entrada é a mais antiga');
  assert.notEqual(alvos[0].wakeDay, alvos[2].wakeDay, 'o caso degenerou: a 1ª é a última');

  const comBuracos = EMBARALHADO.map((n, i) =>
    posicoesOfensoras.includes(i) ? { ...n, luzH: null } : n,
  );
  const v = rodarEConferir(comBuracos);
  assert.equal(v.acervo.noitesSemLuz, 3, 'a contagem virou constante');
  assert.equal(v.acervo.primeiraNoiteSemLuz, alvos[0].wakeDay, 'não é a primeira em ordem de entrada');
  for (const f of v.fases) {
    assert.deepEqual(f.falta, { quanto: 3, unidade: 'noites-sem-luz' }, `${f.fase}`);
    assert.equal(f.portaoReprovado, 'luz', `${f.fase}`);
  }
  console.log(
    `     · 3 sem luz · 1ª de entrada ${v.acervo.primeiraNoiteSemLuz} · mais antiga ${maisAntiga}`,
  );
});

check('ACERVO EMBARALHADO — `de`/`ate` são cronológicos, e o veredito não vê a ordem', () => {
  assert.notEqual(EMBARALHADO[0].wakeDay, LIMPO[0].wakeDay, 'o embaralhamento não embaralhou');
  const v = rodarEConferir(EMBARALHADO);
  // Sem o `.sort()`, `de`/`ate` viravam as pontas da LISTA — um "intervalo" que não
  // contém metade das noites que ele diz cobrir, e que ninguém notaria olhando.
  assert.equal(v.acervo.de, LIMPO[0].wakeDay, '`de` saiu da ponta da lista, não do calendário');
  assert.equal(v.acervo.ate, LIMPO[LIMPO.length - 1].wakeDay, '`ate` idem');
  assert.equal(v.acervo.noites, LIMPO.length);

  // E o teste em si é surdo à ordem: mesmas colunas, mesmo efeito, mesmo veredito.
  const ref = rodarEConferir(LIMPO);
  v.fases.forEach((f, i) => {
    assert.equal(f.fase, ref.fases[i].fase);
    assert.equal(f.noitesDentro, ref.fases[i].noitesDentro, `${f.fase} dentro`);
    assert.equal(f.ciclos, ref.fases[i].ciclos, `${f.fase} ciclos`);
    assert.equal(f.veredito, ref.fases[i].veredito, `${f.fase} veredito`);
    // Tolerância, e não igualdade exata: somar 400 parcelas em outra ordem muda os
    // últimos bits da média do MQO. O que não pode mudar é o resultado.
    assert.ok(Math.abs((f.efeitoMin ?? 0) - (ref.fases[i].efeitoMin ?? 0)) < 1e-6, `${f.fase} efeito`);
    assert.ok(Math.abs((f.p ?? 0) - (ref.fases[i].p ?? 0)) < 1e-9, `${f.fase} p`);
  });
});

check('wakeDay REPETIDO é RECUSADO na porta — duplicata infla poder, e não se deduplica', () => {
  // A decisão é **recusar**, não deduplicar: duas linhas com o mesmo `wakeDay` são
  // duas medições da mesma noite, e escolher uma em silêncio é escolher um desfecho.
  const repetida = LIMPO[42];
  assert.throws(
    () => rodarEConferir([...LIMPO, repetida]),
    (e: unknown) =>
      e instanceof RangeError &&
      e.message.includes(repetida.wakeDay) &&
      e.message.includes('infla poder'),
    'a duplicata passou',
  );
  // Nem uma noite igual com outro horário — é a CHAVE que repete, não o valor.
  assert.throws(
    () => rodarEConferir([...LIMPO, { ...repetida, onsetAt: LIMPO[43].onsetAt }]),
    RangeError,
  );

  // E o porquê, medido em vez de afirmado: uma noite a mais numa coluna **sobe** o
  // poder, e subir poder é o que transforma `inconclusivo` em `nenhum_padrao` — o
  // erro que a §5 de 07/09 chama de mentir com o mesmo tom de voz.
  const base = {
    sdMin: 60,
    noitesDentro: N_DENTRO,
    noitesFora: N_FORA,
    alfa: ALFA_DA_CHEIA,
    lateralidade: 'unilateral' as const,
  };
  const honesto = poderLunar(base);
  const comDuplicata = poderLunar({ ...base, noitesDentro: N_DENTRO + 1 });
  assert.ok(honesto !== null && comDuplicata !== null);
  assert.ok(comDuplicata > honesto, `a duplicata não inflou o poder: ${honesto} → ${comDuplicata}`);
});

check('acervo vazio — as quatro inconclusivo por amostra, e nada lança', () => {
  const v = rodarEConferir([]);
  assert.equal(v.acervo.noites, 0);
  assert.equal(v.acervo.noitesDistintas, 0);
  assert.equal(v.acervo.de, null);
  assert.equal(v.acervo.ate, null);
  assert.equal(v.acervo.sdMin, null);
  assert.equal(v.acervo.noitesSemLuz, 0, 'zero noites não é zero luz');
  assert.equal(v.acervo.origemDoEixoH, SLEEP_AXIS_ORIGIN_H);
  for (const f of v.fases) {
    assert.equal(f.veredito, 'inconclusivo', `${f.fase}`);
    assert.equal(f.portaoReprovado, 'amostra', `${f.fase}`);
    assert.deepEqual(
      f.falta,
      { quanto: 2 * NOITES_MINIMAS_POR_COLUNA, unidade: 'noites-de-coluna' },
      `${f.fase}`,
    );
  }
});

check('wakeDay torto, onsetAt torto e tzOffset torto lançam RangeError', () => {
  const boa = LIMPO[0];
  for (const ruim of ['2026-02-30', '2026-9-1', '', '17/09/2026']) {
    assert.throws(
      () => rodarEConferir([{ ...boa, wakeDay: ruim }]),
      (e: unknown) => e instanceof RangeError && e.message.includes(`'${ruim}'`),
      `wakeDay '${ruim}'`,
    );
  }
  assert.throws(() => rodarEConferir([{ ...boa, onsetAt: 'ontem à noite' }]), RangeError);
  assert.throws(() => rodarEConferir([{ ...boa, tzOffset: Number.NaN }]), RangeError);
  assert.throws(
    () => rodarEConferir([{ ...boa, tzOffset: 'uma hora' as unknown as number }]),
    RangeError,
  );
});

check('tzOffset FORA DE ±840 min lança — acima disso não é fuso, é unidade trocada', () => {
  const boa = LIMPO[100];
  // UTC+14 (Kiritimati) e UTC−12 são os extremos que existem. 3.600 é `tzOffset` em
  // segundos, e −1.440 é um dia inteiro: os dois mandam a noite para o outro lado do
  // eixo sem que nada no resultado deixe perceber.
  for (const ruim of [841, -841, 3600, -3600, -1440]) {
    assert.throws(
      () => rodarEConferir([{ ...boa, tzOffset: ruim }]),
      (e: unknown) => e instanceof RangeError && e.message.includes('±840'),
      `tzOffset ${ruim}`,
    );
  }
  // E as bordas legítimas passam — a guarda não pode comer o fuso de quem viaja.
  for (const bom of [840, -840, 0, 120]) {
    assert.doesNotThrow(() => rodarEConferir([{ ...boa, tzOffset: bom }]), `tzOffset ${bom}`);
  }
});

check('onsetAt IMPLAUSÍVEL contra o wakeDay lança — março com apagar de julho não passa', () => {
  const noiteDe = (onsetAt: string): NoiteLunarMedida => ({
    wakeDay: '2025-03-10',
    onsetAt,
    tzOffset: 60,
    luzH: 11.5,
  });
  // O fim da noite de 10/03 é 2025-03-10T08:00Z. Estes estão a meses dele: hoje
  // entravam calados, com a noite na coluna de uma fase e a hora de apagar no eixo de
  // outra estação, e nada no resultado dizia isso.
  for (const longe of ['2025-07-04T22:00:00.000Z', '2024-12-31T23:00:00.000Z']) {
    assert.throws(
      () => rodarEConferir([noiteDe(longe)]),
      (e: unknown) => e instanceof RangeError && e.message.includes('não é da noite de'),
      longe,
    );
  }
  // A faixa plausível é generosa de propósito: 30 h antes do fim da noite é UTC+14
  // deitando cedo na véspera, e tem de passar.
  assert.doesNotThrow(() => rodarEConferir([noiteDe('2025-03-09T02:00:00.000Z')]));
  assert.throws(() => rodarEConferir([noiteDe('2025-03-07T08:00:00.000Z')]), RangeError);
});

check('GUARDAS DE PODER — alfa fora de (0,1) e efeitoMin zero ou NaN dão null, não número', () => {
  const base = {
    sdMin: 45,
    noitesDentro: N_DENTRO,
    noitesFora: N_FORA,
    lateralidade: 'unilateral' as const,
  };
  // Sem guarda, `normalQuantile` devolve ±Infinity e a conta segue: α = 1 daria
  // **100% de poder** e α = 0 daria zero, os dois com cara de número medido. O
  // 100% é o perigoso — ele abre o portão que o protocolo fecha.
  for (const alfa of [0, 1, -0.05, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(poderLunar({ ...base, alfa }), null, `poder com alfa ${String(alfa)}`);
    assert.equal(efeitoMinimoDetectavel({ ...base, alfa }), null, `MDE com alfa ${String(alfa)}`);
    assert.equal(noitesParaPoder({ ...base, alfa }), null, `noites com alfa ${String(alfa)}`);
  }
  // `efeitoMin` zero daria MDE infinito e poder igual a α; `NaN` atravessaria tudo e
  // sairia como `NaN`, que passa pelo `poder < PODER_MINIMO` como `false` — isto é,
  // abriria o portão de poder por não ser um número.
  for (const efeitoMin of [0, Number.NaN, Number.POSITIVE_INFINITY]) {
    const par = { ...base, alfa: ALFA_DA_CHEIA, efeitoMin };
    assert.equal(poderLunar(par), null, `poder com efeitoMin ${String(efeitoMin)}`);
    assert.equal(efeitoMinimoDetectavel(par), null, `MDE com efeitoMin ${String(efeitoMin)}`);
    assert.equal(noitesParaPoder(par), null, `noites com efeitoMin ${String(efeitoMin)}`);
  }
  // E o legítimo continua legítimo: α do protocolo, efeito negativo (o bilateral
  // detecta os dois sentidos) e o padrão de 15 min.
  assert.ok(poderLunar({ ...base, alfa: ALFA_DA_CHEIA }) !== null);
  assert.ok(poderLunar({ ...base, alfa: ALFA_DAS_TRES, efeitoMin: -30 }) !== null);
});

check('sd degenerado — poder null, nunca 100%, e o veredito é inconclusivo', () => {
  const dias = diasDesde('2025-01-01', 400);
  const iguais = dias.map((d) => noite(d, 0.5, luzDoDia(d)));
  const v = rodarEConferir(iguais);
  assert.equal(v.acervo.sdMin, 0);
  for (const f of v.fases) {
    assert.equal(f.poder, null, `${f.fase}: poder virou número com SD zero`);
    assert.equal(f.veredito, 'inconclusivo', `${f.fase}`);
    assert.equal(f.motivo, 'poder', `${f.fase}`);
    assert.equal(f.portaoReprovado, null, `${f.fase}: os três portões estavam abertos`);
    assert.equal(f.falta, null, `${f.fase}: a conta não existe com SD zero`);
  }
});

/* ─────────────────────── A tabela de veredito ─────────────────────── */

/**
 * Acervo com luz forte e ruído pequeno: o SD **marginal** fica alto (o poder cai),
 * mas o teste sobre os resíduos enxerga o efeito com precisão. É o molde do ramo
 * que a iteração 1 errou — significante, e sem poder.
 */
function acervoSemPoder(efeitoNaCheia: number): NoiteLunarMedida[] {
  return acervo({
    de: '2025-01-01',
    noites: 400,
    horaBase: 0.5,
    ruidoSd: 8,
    bLuz: 28,
    efeito: { full: efeitoNaCheia },
    semente: 4242,
  });
}

check('SIGNIFICANTE SEM PODER, limiar passado — inconclusivo, nunca achado', () => {
  const v = rodarEConferir(acervoSemPoder(60));
  const cheia = daFase(v, 'full');
  assert.ok(cheia.poder !== null && cheia.poder < PODER_MINIMO, `poder ${cheia.poder}`);
  assert.ok(cheia.p !== null && cheia.p < ALFA_DA_CHEIA, `p ${cheia.p}`);
  assert.ok(Math.abs(cheia.efeitoMin ?? 0) >= LIMIAR_PRATICO_MIN, `efeito ${cheia.efeitoMin}`);
  assert.equal(cheia.veredito, 'inconclusivo');
  assert.equal(cheia.motivo, 'poder');
  assert.equal(cheia.portaoReprovado, null);
  // **Só aqui** o que falta é noite a coletar — é o único motivo em que "faltam N
  // noites" é frase verdadeira, e é por isso que os outros três carregam outra unidade.
  assert.equal(cheia.falta?.unidade, 'noites-coletaveis');
  assert.ok((cheia.falta?.quanto ?? 0) >= 1, 'não disse quantas noites faltam');
  console.log(
    `     · efeito ${cheia.efeitoMin?.toFixed(1)} min · p ${cheia.p?.toExponential(1)} · ` +
      `poder ${Math.round((cheia.poder ?? 0) * 100)}% · faltam ${cheia.falta?.quanto} noites`,
  );
});

check('SIGNIFICANTE SEM PODER, limiar NÃO passado — inconclusivo, nunca nenhum_padrao', () => {
  const v = rodarEConferir(acervoSemPoder(11));
  const cheia = daFase(v, 'full');
  assert.ok(cheia.poder !== null && cheia.poder < PODER_MINIMO, `poder ${cheia.poder}`);
  assert.ok(cheia.p !== null && cheia.p < ALFA_DA_CHEIA, `p ${cheia.p}`);
  assert.ok(Math.abs(cheia.efeitoMin ?? 0) < LIMIAR_PRATICO_MIN, `efeito ${cheia.efeitoMin}`);
  // Este é o ramo que devolvia `nenhum_padrao` — silêncio impresso como informação.
  assert.equal(cheia.veredito, 'inconclusivo');
  assert.equal(cheia.motivo, 'poder');
});

check('TODO inconclusivo diz QUANTO falta — e cada motivo numa unidade diferente', () => {
  const porMotivo = new Map<MotivoDoInconclusivo, OQueFalta | null>();
  porMotivo.set('poder', daFase(rodarEConferir(acervoSemPoder(60)), 'full').falta);
  porMotivo.set('luz', daFase(rodarEConferir(LIMPO.map((n, i) => (i === 3 ? { ...n, luzH: null } : n))), 'full').falta);
  porMotivo.set('amostra', daFase(rodarEConferir([]), 'full').falta);
  const ciclos: number[] = [];
  const poucos = LIMPO.filter((n) => {
    const j = janelaLunar(n.wakeDay, 'full');
    if (j === null) return true;
    const t = j.instante.getTime();
    if (!ciclos.includes(t)) ciclos.push(t);
    return ciclos.indexOf(t) < 6;
  });
  porMotivo.set('ciclos', daFase(rodarEConferir(poucos), 'full').falta);

  // **As quatro unidades são quatro, e não uma.** Este é o defeito da story 2.8 — o
  // "1 dias" — na forma que o motor podia ter: um número certo com a palavra errada
  // colada nele. Quem imprimisse "faltam N noites" nos quatro estaria mentindo em
  // três, e nada no resultado deixava perceber.
  const unidades = new Set<string>();
  for (const [motivo, falta] of porMotivo) {
    assert.ok(falta !== null, `o inconclusivo por ${motivo} não disse quanto falta`);
    assert.ok(falta.quanto >= 1, `${motivo}: faltar zero não é faltar`);
    assert.equal(falta.unidade, UNIDADE_DO_MOTIVO[motivo], `${motivo}: unidade`);
    unidades.add(falta.unidade);
    console.log(`     · ${motivo}: faltam ${falta.quanto} — ${falta.unidade}`);
  }
  assert.equal(unidades.size, 4, 'dois motivos saíram com a mesma unidade');
  assert.equal(porMotivo.size, Object.keys(UNIDADE_DO_MOTIVO).length, 'um motivo ficou sem caso');
});

check('poder alto e efeito abaixo de 15 min — nenhum_padrao, com o efeito relatado', () => {
  const v = rodarEConferir(
    acervo({ de: '2025-01-01', noites: 400, horaBase: 0.5, ruidoSd: 20, efeito: { full: 8 }, semente: 77 }),
  );
  const cheia = daFase(v, 'full');
  assert.ok(cheia.poder !== null && cheia.poder >= PODER_MINIMO, `poder ${cheia.poder}`);
  assert.ok(cheia.p !== null && cheia.p < ALFA_DA_CHEIA, `p ${cheia.p}`);
  assert.ok(Math.abs(cheia.efeitoMin ?? 0) < LIMIAR_PRATICO_MIN, `efeito ${cheia.efeitoMin}`);
  assert.equal(cheia.veredito, 'nenhum_padrao', 'nulo prático é nulo, não achado');
  assert.ok(cheia.efeitoMin !== null, 'o efeito medido tem de ser relatado mesmo assim');
});

check('poder baixo e nada significante — inconclusivo, nunca nenhum_padrao', () => {
  const disperso = rodarEConferir(
    acervo({ de: '2025-01-01', noites: 400, horaBase: 0.5, ruidoSd: 90, semente: 909 }),
  );
  for (const f of disperso.fases) {
    assert.ok(f.poder !== null && f.poder < PODER_MINIMO, `${f.fase} poder ${f.poder}`);
    assert.ok(f.p !== null && f.p >= f.alfa, `${f.fase} p ${f.p}`);
    assert.equal(f.veredito, 'inconclusivo', `${f.fase}`);
    assert.equal(f.motivo, 'poder', `${f.fase}`);
  }
});

check('achado — 40 min de atraso, p < α e poder de sobra', () => {
  const v = rodarEConferir(
    acervo({ de: '2025-01-01', noites: 400, horaBase: 0.5, ruidoSd: 25, efeito: { full: 40 }, semente: 11 }),
  );
  const cheia = daFase(v, 'full');
  assert.equal(cheia.veredito, 'achado');
  assert.ok((cheia.efeitoMin ?? 0) > 30, `efeito ${cheia.efeitoMin}`);
  assert.ok((cheia.p ?? 1) < ALFA_DA_CHEIA);
  assert.ok((cheia.poder ?? 0) >= PODER_MINIMO);
  assert.equal(cheia.motivo, null);
});

check('BILATERAL acha o adiantamento que a cheia recusa — mesma magnitude, mesmo acervo', () => {
  const v = rodarEConferir(
    acervo({
      de: '2025-01-01',
      noites: 400,
      horaBase: 0.5,
      ruidoSd: 20,
      efeito: { full: -40, new: -40 },
      semente: 313,
    }),
  );
  const cheia = daFase(v, 'full');
  const nova = daFase(v, 'new');
  assert.ok((cheia.efeitoMin ?? 0) < -LIMIAR_PRATICO_MIN, `a cheia adiantou ${cheia.efeitoMin}`);
  assert.ok((nova.efeitoMin ?? 0) < -LIMIAR_PRATICO_MIN, `a nova adiantou ${nova.efeitoMin}`);
  // A cheia é unilateral na direção do atraso: adiantamento não conta como achado.
  assert.ok((cheia.p ?? 0) > 0.9, `p unilateral da cheia ${cheia.p}`);
  assert.equal(cheia.veredito, 'nenhum_padrao');
  // A nova é bilateral, e para ela adiantamento e atraso contam igual (§5 de 28/09).
  assert.ok((nova.p ?? 1) < ALFA_DAS_TRES, `p bilateral da nova ${nova.p}`);
  assert.equal(nova.veredito, 'achado');
  console.log(
    `     · mesmo −${Math.abs(Math.round(cheia.efeitoMin ?? 0))} min: cheia ${cheia.veredito}, nova ${nova.veredito}`,
  );
});

/* ─────────────────────── As escolhas que não estão nos documentos ─────────────────────── */

check('A LUZ SAI POR RESÍDUO — o motor bate com HL/MW sobre resíduos e discorda do cru', () => {
  const dado = acervo({
    de: '2025-01-01',
    noites: 400,
    horaBase: 0.5,
    ruidoSd: 30,
    // Luz forte de propósito: o que separa o cru do resíduo é a inclinação vezes o
    // desequilíbrio sazonal entre as colunas, e com luz fraca os dois caminhos ficam
    // a um minuto um do outro — perto demais para provar coisa nenhuma.
    bLuz: 60,
    efeito: { full: 25 },
    semente: 606,
  });
  const v = rodarEConferir(dado);
  const cheia = daFase(v, 'full');
  const pos = posicoes(dado);
  const luz = dado.map((n) => n.luzH as number);
  const res = residuosDeReferencia(pos, luz);
  const dentroRes: number[] = [];
  const foraRes: number[] = [];
  const dentroCru: number[] = [];
  const foraCru: number[] = [];
  dado.forEach((n, i) => {
    if (faseDe(n.wakeDay) === 'full') {
      dentroRes.push(res[i]);
      dentroCru.push(pos[i]);
    } else {
      foraRes.push(res[i]);
      foraCru.push(pos[i]);
    }
  });
  const hlRes = hlDeReferencia(dentroRes, foraRes);
  const hlCru = hlDeReferencia(dentroCru, foraCru);
  const pRes = mwDeReferencia(dentroRes, foraRes, 'unilateral', 0.5);
  const pCru = mwDeReferencia(dentroCru, foraCru, 'unilateral', 0.5);

  // Igual ao residualizado…
  assert.ok(Math.abs((cheia.efeitoMin ?? 0) - hlRes) < 1e-9, `motor ${cheia.efeitoMin} vs resíduo ${hlRes}`);
  assert.ok(Math.abs((cheia.p ?? 0) - pRes) < 1e-6, `motor ${cheia.p} vs resíduo ${pRes}`);
  // …e diferente do cru. Sem esta segunda metade, `residuo = apagou` passaria.
  assert.ok(Math.abs(hlRes - hlCru) > 3, `o cru e o resíduo deram o mesmo efeito: ${hlCru}`);
  assert.ok(Math.abs((cheia.efeitoMin ?? 0) - hlCru) > 3, `o motor está usando o cru: ${hlCru}`);
  assert.ok(Math.abs((cheia.p ?? 0) - pCru) > 1e-6, `o motor está usando o p do cru: ${pCru}`);
  console.log(`     · efeito resíduo ${hlRes.toFixed(2)} min · efeito cru ${hlCru.toFixed(2)} min`);
});

check('CORREÇÃO DE CONTINUIDADE — está lá, é conservadora, e apagá-la muda o p', () => {
  const dado = acervo({
    de: '2025-01-01',
    noites: 400,
    horaBase: 0.5,
    ruidoSd: 40,
    efeito: { full: 18, new: -18 },
    semente: 505,
  });
  const v = rodarEConferir(dado);
  const pos = posicoes(dado);
  const luz = dado.map((n) => n.luzH as number);
  const res = residuosDeReferencia(pos, luz);
  for (const linha of PROTOCOLO_LUNAR) {
    const dentro: number[] = [];
    const fora: number[] = [];
    dado.forEach((n, i) => (faseDe(n.wakeDay) === linha.fase ? dentro : fora).push(res[i]));
    const com = mwDeReferencia(dentro, fora, linha.lateralidade, 0.5);
    const sem = mwDeReferencia(dentro, fora, linha.lateralidade, 0);
    const doMotor = daFase(v, linha.fase).p ?? Number.NaN;
    assert.ok(Math.abs(doMotor - com) < 1e-6, `${linha.fase}: motor ${doMotor} vs com correção ${com}`);
    assert.ok(Math.abs(com - sem) > 1e-12, `${linha.fase}: a correção não mudou nada`);
    assert.ok(com > sem, `${linha.fase}: a correção tem de ser conservadora (p maior)`);
    assert.ok(
      Math.abs(doMotor - sem) > 1e-12,
      `${linha.fase}: o motor está sem correção de continuidade`,
    );
  }
});

check('O PODER USA O SD MARGINAL — o residual viraria inconclusivo em nenhum_padrao', () => {
  // 717 noites, luz forte: marginal ~85 min (55% de poder) e residual ~49,8 (92%),
  // um de cada lado do corte de 80%. Trocar um pelo outro muda o veredito — que é
  // exatamente o que a §5 proíbe, porque inflar poder transforma silêncio em
  // informação.
  const dias = diasDesde('2023-06-01', 717);
  const luzes = dias.map(luzDoDia);
  // Os dois SDs saem RESOLVIDOS, não chutados: o ruído e a luz não são ortogonais
  // nesta amostra, e ignorar a covariância entre eles erra o marginal em quase dois
  // minutos e o residual em um décimo — o bastante para mover o dígito do poder.
  //   residual² = s²·(1 − ρ²)                    → s para o residual dar 49,8
  //   marginal² = s² + b²·Var(luz) + 2b·s·C₀     → b para o marginal dar 85,0
  const unitario = ruidoDe(717, 1, 8585);
  const vLuz = desvio(luzes) ** 2;
  const c0 = covariancia(luzes, unitario);
  const escala = 49.8 / Math.sqrt(1 - c0 ** 2 / vLuz);
  const cov = escala * c0;
  const bLuz = (-cov + Math.sqrt(cov ** 2 - vLuz * (escala ** 2 - 85 ** 2))) / vLuz;
  const dado = acervo({
    de: '2023-06-01',
    noites: 717,
    horaBase: 0.5,
    ruidoSd: escala,
    bLuz,
    semente: 8585,
  });
  const v = rodarEConferir(dado);
  const cheia = daFase(v, 'full');
  const res = residuosDeReferencia(posicoes(dado), dado.map((n) => n.luzH as number));
  const sdResidual = desvio(res);
  const sdMarginal = v.acervo.sdMin ?? Number.NaN;
  assert.equal(sdMarginal.toFixed(1), '85.0', `SD marginal ${sdMarginal.toFixed(3)}`);
  assert.equal(sdResidual.toFixed(1), '49.8', `SD residual ${sdResidual.toFixed(3)}`);

  const base = {
    noitesDentro: cheia.noitesDentro,
    noitesFora: cheia.noitesFora,
    alfa: cheia.alfa,
    lateralidade: cheia.lateralidade,
  };
  const comMarginal = poderLunar({ ...base, sdMin: sdMarginal });
  const comResidual = poderLunar({ ...base, sdMin: sdResidual });
  assert.ok(comMarginal !== null && comResidual !== null);
  assert.ok(Math.abs((cheia.poder ?? 0) - comMarginal) < 1e-12, 'o motor não usou o SD marginal');
  assert.ok(comMarginal < PODER_MINIMO, `poder marginal ${comMarginal}`);
  assert.ok(comResidual >= PODER_MINIMO, `poder residual ${comResidual}`);
  assert.equal(Math.round(comMarginal * 100), 55, 'o acervo saiu do ponto: marginal');
  assert.equal(Math.round(comResidual * 100), 92, 'o acervo saiu do ponto: residual');
  assert.equal(cheia.veredito, 'inconclusivo');
  assert.equal(cheia.motivo, 'poder');
  // E o que o veredito seria com o residual: `nenhum_padrao`, porque não há efeito.
  assert.ok(
    !((cheia.p ?? 1) < cheia.alfa && Math.abs(cheia.efeitoMin ?? 0) >= LIMIAR_PRATICO_MIN),
    'o acervo ganhou efeito e o caso deixou de medir o que devia',
  );
  console.log(
    `     · marginal ${sdMarginal.toFixed(1)} min → ${Math.round(comMarginal * 100)}% · ` +
      `residual ${sdResidual.toFixed(1)} min → ${Math.round(comResidual * 100)}%`,
  );
});

check('A ORIGEM DO EIXO — observações dos dois lados das 18h continuam a 20 min', () => {
  // 17h50 e 18h10: no eixo cru de origem 18 elas caem em 1.430 e 10 — a mesma
  // mentira da meia-noite, deslocada. Só o desdobramento salva este caso.
  const dias = diasDesde('2025-01-01', 400);
  const noites = dias.map((d) =>
    noite(d, faseDe(d) === 'full' ? 18 + 10 / 60 : 17 + 50 / 60, luzDoDia(d)),
  );
  const cruas = posicoes(noites);
  assert.ok(Math.max(...cruas) - Math.min(...cruas) > 1400, 'o caso não atravessa mais a origem');

  const v = rodarEConferir(noites);
  assert.ok(Math.abs(v.acervo.origemDoEixoH - (17 + 50 / 60)) < 1e-6, `origem ${v.acervo.origemDoEixoH}`);
  const cheia = daFase(v, 'full');
  assert.equal(Math.round(cheia.efeitoMin ?? 0), 20, `efeito ${cheia.efeitoMin} — a volta no eixo voltou`);
  assert.equal(cheia.veredito, 'achado');
});

check('ROTAÇÃO CANÔNICA — o corte cai no maior vão, e mover o relógio não move número', () => {
  // Este acervo atravessa a origem das 18h: 17h50 e 18h10 caem em 1.430 e 10 no eixo
  // cru. Sem o desdobramento, o SD marginal explode — e o SD move o PODER, que é
  // portão. Por isso não é verdade que girar o eixo "não pode mudar veredito": girar
  // muda o SD, e o que salva a reprodutibilidade é o corte ser **canônico**.
  const dias = diasDesde('2025-01-01', 400);
  const noites = dias.map((d) =>
    noite(d, faseDe(d) === 'full' ? 18 + 10 / 60 : 17 + 50 / 60, luzDoDia(d)),
  );
  const sdCru = desvio(posicoes(noites));
  const ref = rodarEConferir(noites);
  assert.ok(sdCru > 300, `o caso não atravessa mais a origem: SD cru ${sdCru.toFixed(1)}`);
  assert.ok((ref.acervo.sdMin ?? 0) < 20, `SD desdobrado ${ref.acervo.sdMin}`);
  console.log(
    `     · SD cru ${sdCru.toFixed(1)} min → desdobrado ${ref.acervo.sdMin?.toFixed(1)} min · ` +
      `origem ${ref.acervo.origemDoEixoH.toFixed(2)} h`,
  );

  // Canônico = função só das posições reunidas. Deslocar o acervo INTEIRO no relógio
  // gira a nuvem rigidamente: o maior vão continua sendo o mesmo vão, o corte cai nele
  // de novo, e SD, efeito, p e veredito saem idênticos. Tirar o `.sort()` de
  // `desdobrarEixo`, ou escolher o vão por outro critério, quebra exatamente aqui.
  for (const horas of [2, 7.25, 13, 19]) {
    const movido = noites.map((n) => ({
      ...n,
      onsetAt: new Date(new Date(n.onsetAt).getTime() + horas * 3_600_000).toISOString(),
    }));
    const v = rodarEConferir(movido);
    assert.ok(Math.abs((v.acervo.sdMin ?? 0) - (ref.acervo.sdMin ?? 0)) < 1e-9, `SD a ${horas} h`);
    for (let i = 0; i < 4; i += 1) {
      assert.ok(
        Math.abs((v.fases[i].efeitoMin ?? 0) - (ref.fases[i].efeitoMin ?? 0)) < 1e-9,
        `efeito de ${v.fases[i].fase} a ${horas} h`,
      );
      assert.ok(Math.abs((v.fases[i].p ?? 0) - (ref.fases[i].p ?? 0)) < 1e-12, `p a ${horas} h`);
      assert.equal(v.fases[i].veredito, ref.fases[i].veredito, `veredito a ${horas} h`);
    }
  }
});

check('DIREÇÃO — a cheia só acha no atraso, e a invariante é cobrada, não declarada', () => {
  const v = rodarEConferir(
    acervo({
      de: '2025-01-01',
      noites: 400,
      horaBase: 0.5,
      ruidoSd: 20,
      efeito: { full: -40 },
      semente: 313,
    }),
  );
  const cheia = daFase(v, 'full');
  assert.equal(cheia.lateralidade, 'unilateral');
  assert.equal(cheia.direcao, 'atraso');
  assert.ok((cheia.efeitoMin ?? 0) < -LIMIAR_PRATICO_MIN, `efeito ${cheia.efeitoMin}`);
  assert.notEqual(cheia.veredito, 'achado', 'o adiantamento virou achado na linha do atraso');

  // **Por que a guarda de direção nunca dispara, e mesmo assim tem de existir.** O
  // sinal do Hodges–Lehmann e o de `U − μ` são o mesmo sinal — HL > 0 significa que
  // mais da metade dos pares é positiva, que é literalmente `U > n₁n₂/2` —, então um p
  // unilateral pequeno já implica efeito positivo. A guarda é a invariante escrita; a
  // asserção abaixo é a razão de ela ser redundante hoje, e o alarme de quando o
  // estimador e o teste se descasarem (trocar o HL pela diferença de medianas, por
  // exemplo, desfaz o laço — e o motor voltaria a poder "achar" do lado errado).
  const acervos = [
    LIMPO,
    acervoSemPoder(60),
    acervo({ de: '2025-01-01', noites: 400, horaBase: 0.5, ruidoSd: 25, efeito: { full: 40 }, semente: 11 }),
    acervo({ de: '2025-01-01', noites: 400, horaBase: 0.5, ruidoSd: 20, efeito: { full: -40, new: -40 }, semente: 313 }),
  ];
  let unilateraisSignificantes = 0;
  for (const dado of acervos) {
    for (const f of rodarEConferir(dado).fases) {
      if (f.lateralidade !== 'unilateral' || f.p === null) continue;
      if (f.p >= f.alfa) continue;
      unilateraisSignificantes += 1;
      assert.ok((f.efeitoMin ?? 0) > 0, `${f.fase}: p ${f.p} com efeito ${f.efeitoMin}`);
    }
  }
  assert.ok(unilateraisSignificantes >= 2, 'nenhum caso unilateral significante para observar');
});

check('O z DE MANN–WHITNEY É PUBLICADO — o p sai conferível contra a tabela normal', () => {
  const v = rodarEConferir(
    acervo({
      de: '2025-01-01',
      noites: 400,
      horaBase: 0.5,
      ruidoSd: 30,
      efeito: { full: 25, new: -22, lastQuarter: 14 },
      semente: 2026,
    }),
  );
  for (const f of v.fases) {
    assert.ok(f.zDeMannWhitney !== null, `${f.fase}: z não veio`);
    const z = f.zDeMannWhitney;
    const daTabela =
      f.lateralidade === 'bilateral'
        ? Math.min(1, 2 * (1 - phiDeReferencia(z)))
        : 1 - phiDeReferencia(z);
    assert.ok(Math.abs((f.p ?? 0) - daTabela) < 1e-6, `${f.fase}: p ${f.p} não sai do z ${z}`);
    console.log(
      `     · ${f.fase}: z ${z.toFixed(3)} → p ${(f.p ?? 0).toExponential(2)} (${f.lateralidade})`,
    );
  }
});

check('INVARIÂNCIA À ORIGEM — deslocar todas as noites não move efeito, p nem SD', () => {
  const referencia = rodarEConferir(LIMPO);
  for (const horas of [1, 5, 11.5, 17, 23]) {
    const movido = LIMPO.map((n) => ({
      ...n,
      onsetAt: new Date(new Date(n.onsetAt).getTime() + horas * 3_600_000).toISOString(),
    }));
    const v = rodarEConferir(movido);
    assert.ok(Math.abs((v.acervo.sdMin ?? 0) - (referencia.acervo.sdMin ?? 0)) < 1e-9, `SD a ${horas} h`);
    for (let i = 0; i < 4; i += 1) {
      assert.ok(
        Math.abs((v.fases[i].efeitoMin ?? 0) - (referencia.fases[i].efeitoMin ?? 0)) < 1e-9,
        `efeito de ${v.fases[i].fase} a ${horas} h`,
      );
      assert.ok(Math.abs((v.fases[i].p ?? 0) - (referencia.fases[i].p ?? 0)) < 1e-12, `p a ${horas} h`);
      assert.equal(v.fases[i].veredito, referencia.fases[i].veredito, `veredito a ${horas} h`);
    }
  }
});

check('INVARIÂNCIA DE FUSO — o hospedeiro não muda nenhum veredito', () => {
  const tzOriginal = process.env.TZ;
  const leituras: string[] = [];
  try {
    for (const tz of ['UTC', 'Europe/Brussels', 'Pacific/Kiritimati', 'Pacific/Midway', 'America/Sao_Paulo']) {
      process.env.TZ = tz;
      leituras.push(JSON.stringify(rodarEConferir(LIMPO)));
    }
  } finally {
    if (tzOriginal == null) delete process.env.TZ;
    else process.env.TZ = tzOriginal;
  }
  assert.equal(new Set(leituras).size, 1, 'o fuso do processo mudou o resultado');
});

console.log(`\n${passed} testes de sleep/lua-protocolo.ts passaram.`);
