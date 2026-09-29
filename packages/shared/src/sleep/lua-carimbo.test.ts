/**
 * Testes do carimbo da execução lunar — puros, sem framework. Rodar com:
 *   cd packages/shared && npx tsx src/sleep/lua-carimbo.test.ts
 *
 * Três coisas são cobradas aqui, e as três são falsificáveis:
 *
 * 1. **A cadeia bate com os arquivos em disco.** As quatro sha256 são recalculadas
 *    do conteúdo, e um byte a mais em qualquer documento reprova.
 * 2. **A borda direita é medida, não declarada.** A sonda pergunta ao classificador,
 *    e o teste cobra que ela saiba dizer `fechada` — senão ela seria um `return
 *    'aberta'` disfarçado.
 * 3. **O motor não muda sem a versão subir.** O sha256 do fonte de `lua-protocolo.ts`
 *    tem golden, ao lado de `MOTOR_LUNAR_VERSAO` — o molde de `PROMPT_VERSAO` com o
 *    golden de `ia/verificar.test.ts`.
 *
 * ## Quem quebra o build, hoje e na 4.3
 *
 * **Este arquivo já quebra.** Ele roda em `pnpm --filter @vitale/shared test` como
 * qualquer `*.test.ts` do núcleo, então um byte a mais em qualquer um dos quatro
 * documentos reprova a suíte — incondicionalmente, tenha havido execução ou não. É a
 * Correção 4 da segunda correção de 28/09, e é o preço declarado lá.
 *
 * **O que a 4.3 decide é outra coisa**, e não é "se o build quebra": se a cobrança
 * migra para `architecture.test.ts`, onde as barreiras valem sobre o repositório
 * inteiro e não só sobre este workspace; e se ela passa a cobrir também
 * `JANELA_LUNAR_NOITES`, `HORA_UTC_DO_FIM_DA_NOITE` e a borda, que hoje são
 * *carimbadas* em cada execução e nunca impedidas.
 *
 * Nenhum dado de sono entra aqui. O pré-registro proíbe olhar antes de rodar, e
 * proveniência não precisa de noite medida para ser conferida.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HORA_UTC_DO_FIM_DA_NOITE, JANELA_LUNAR_NOITES, janelaLunarDoInstante } from './lua';
import { PHASE_ORDER, nextLunarPhase } from '../astro/moon';
import { sha256Hex } from '../ia/sha256';
import {
  BORDAS_DA_JANELA,
  CADEIA_DO_PRE_REGISTRO,
  CADEIA_MINIMA,
  DIGEST_DA_CADEIA,
  INICIO_DO_ACERVO_LUNAR,
  MOTOR_LUNAR_VERSAO,
  operacionalizacaoLunar,
} from './lua-carimbo';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

const ROOT = join(import.meta.dirname, '..', '..', '..', '..');

/* ─────────────────────────── A cadeia ─────────────────────────── */

check('a cadeia tem QUATRO elos, na ordem cronológica em que a regra mudou', () => {
  assert.equal(CADEIA_DO_PRE_REGISTRO.length, 4);
  assert.deepEqual(
    CADEIA_DO_PRE_REGISTRO.map((e) => e.arquivo),
    [
      'docs/specs/revista-retrospectiva/pre-registro-lua.md',
      'docs/specs/revista-retrospectiva/correcao-pre-registro-lua.md',
      'docs/specs/revista-retrospectiva/pre-registro-lua-outras-fases.md',
      'docs/specs/revista-retrospectiva/correcao-2-pre-registro-lua-outras-fases.md',
    ],
    'a ordem é append-only e é parte do conteúdo: documento novo entra no FIM, nenhum sai.',
  );
});

/**
 * **O teste que faz a constante valer alguma coisa.**
 *
 * Sem ele, as quatro sha256 são quatro strings que alguém digitou, e o "arquivo
 * imutável" é uma declaração sem consequência. Com ele, corrigir uma vírgula em
 * qualquer um dos quatro documentos reprova a suíte — que é o preço declarado na
 * correção de 08/09, e o comportamento certo para um arquivo que se diz imutável.
 *
 * `node:crypto` aqui, e `sha256Hex` do núcleo no teste de baixo: são duas
 * implementações independentes, e é assim que `ia/sha256.test.ts` já confere a sua.
 */
check('cada elo bate com o sha256 do arquivo em disco', () => {
  for (const { arquivo, sha256 } of CADEIA_DO_PRE_REGISTRO) {
    const conteudo = readFileSync(join(ROOT, arquivo));
    const real = createHash('sha256').update(conteudo).digest('hex');
    assert.equal(
      real,
      sha256,
      `${arquivo} mudou (sha256 ${real}).\n  Os quatro documentos são IMUTÁVEIS — nem para corrigir `
      + `um erro neles. A saída é um documento novo de correção, que cite os anteriores e diga o que `
      + `mudou e por quê, mais um par no fim de CADEIA_DO_PRE_REGISTRO. Se a mudança foi intencional e `
      + `o documento é o novo, atualize a constante no mesmo commit.`,
    );
  }
});

/**
 * **É este teste que prende o literal.**
 *
 * `DIGEST_DA_CADEIA` deixou de ser derivado no import — a versão antiga rodava um
 * SHA-256 em JavaScript puro na abertura de todo hospedeiro que toca o barril, iPhone
 * incluído, para produzir um valor lido uma vez a cada cem noites. O literal não é um
 * segundo número a manter em sincronia justamente porque esta asserção refaz a conta
 * a partir da cadeia e reprova se divergir: é o papel que o golden de
 * `ia/verificar.test.ts` faz para o texto do SISTEMA.
 */
check('o digest da cadeia é o sha256 das sha256, na ordem, unidas por \\n', () => {
  const recalculado = sha256Hex(CADEIA_DO_PRE_REGISTRO.map((e) => e.sha256).join('\n'));
  assert.equal(
    DIGEST_DA_CADEIA,
    recalculado,
    `o literal DIGEST_DA_CADEIA (${DIGEST_DA_CADEIA}) não é mais o digest da cadeia (${recalculado}) `
    + '— confira que é o documento novo que o mudou, e atualize a constante no mesmo commit.',
  );
});

/**
 * **O piso da cadeia é o número que o CHECK do banco repete**, e ele não sobe junto
 * com a cadeia: execuções antigas têm quatro elos e continuam legíveis quando o
 * quinto documento chegar. Quem cobra que o SQL diga o mesmo número é
 * `architecture.test.ts`; aqui se cobra que o piso seja piso.
 */
check('CADEIA_MINIMA é o piso, não o comprimento de hoje', () => {
  assert.equal(CADEIA_MINIMA, 4);
  assert.ok(
    CADEIA_DO_PRE_REGISTRO.length >= CADEIA_MINIMA,
    `a cadeia tem ${CADEIA_DO_PRE_REGISTRO.length} elos e o piso é ${CADEIA_MINIMA} — uma execução `
    + 'gravada hoje não passaria no CHECK da própria migração.',
  );
});

/** A ordem é conteúdo: duas cadeias com os mesmos elos trocados não são a mesma. */
check('o digest depende da ORDEM dos elos, não só do conjunto', () => {
  const hashes = CADEIA_DO_PRE_REGISTRO.map((e) => e.sha256);
  const trocados = [hashes[1], hashes[0], hashes[2], hashes[3]];
  assert.notEqual(sha256Hex(trocados.join('\n')), DIGEST_DA_CADEIA);
});

check('a cadeia é congelada — ninguém a alarga em runtime', () => {
  assert.ok(Object.isFrozen(CADEIA_DO_PRE_REGISTRO));
  for (const e of CADEIA_DO_PRE_REGISTRO) assert.ok(Object.isFrozen(e), e.arquivo);
});

check('cada sha256 tem a forma de um sha256 — 64 hexadecimais minúsculos', () => {
  for (const { arquivo, sha256 } of CADEIA_DO_PRE_REGISTRO) {
    assert.match(sha256, /^[0-9a-f]{64}$/, arquivo);
  }
  assert.match(DIGEST_DA_CADEIA, /^[0-9a-f]{64}$/);
});

/* ─────────────────────── A operacionalização ─────────────────────── */

check('a operacionalização carimba os três valores que decidem a coluna', () => {
  const op = operacionalizacaoLunar();
  assert.equal(op.janelaNoites, JANELA_LUNAR_NOITES);
  assert.equal(op.horaUtcDoFimDaNoite, HORA_UTC_DO_FIM_DA_NOITE);
  assert.equal(op.bordaDireita, 'aberta');
  assert.ok(Object.isFrozen(op));
  console.log(
    `     · janela ${op.janelaNoites} noites · noite às ${op.horaUtcDoFimDaNoite}:00 UTC · `
    + `borda ${op.bordaDireita}`,
  );
});

check('o memo devolve o mesmo objeto — cache puro, e a resposta não muda', () => {
  assert.equal(operacionalizacaoLunar(), operacionalizacaoLunar());
});

/**
 * **A sonda não é um `return 'aberta'` disfarçado.**
 *
 * Ela mede a borda perguntando ao classificador: no instante exato da fase, a noite
 * cai na janela? Este teste refaz a pergunta aqui e confere que a resposta é `null`
 * nas quatro fases — se o classificador passasse a incluir a própria fase, a sonda
 * devolveria `fechada` e este teste é o que mostra que ela **sabe** devolver isso.
 */
check('a sonda da borda pergunta ao classificador, e ele responde null nas quatro', () => {
  const referencia = new Date(Date.UTC(2026, 0, 1));
  for (const fase of PHASE_ORDER) {
    const { instant } = nextLunarPhase(fase, referencia);
    assert.equal(
      janelaLunarDoInstante(instant, fase),
      null,
      `${fase}: a noite no instante EXATO da fase entrou na janela — a borda direita fechou, e o `
      + 'protocolo a pré-registrou aberta. Se a mudança foi intencional, ela é um documento de correção.',
    );
    // E a noite um minuto antes está dentro: é o outro lado da mesma borda, e sem
    // isto um classificador que devolvesse `null` para tudo passaria neste teste.
    const umMinutoAntes = new Date(instant.getTime() - 60_000);
    const dentro = janelaLunarDoInstante(umMinutoAntes, fase);
    assert.ok(dentro !== null && dentro.noite === -1, `${fase}: a última noite antes da fase saiu da janela`);
  }
});

check('as duas bordas são vocabulário fechado e congelado', () => {
  assert.deepEqual([...BORDAS_DA_JANELA], ['aberta', 'fechada']);
  assert.ok(Object.isFrozen(BORDAS_DA_JANELA));
});

check('o alcance do protocolo tem nome, e é o 23/04/2025 do §3', () => {
  assert.equal(INICIO_DO_ACERVO_LUNAR, '2025-04-23');
  assert.match(INICIO_DO_ACERVO_LUNAR, /^\d{4}-\d{2}-\d{2}$/);
});

/* ─────────────────────── O motor, e a versão dele ─────────────────────── */

/**
 * **O MOTOR TEM GOLDEN — e é isto que torna `MOTOR_LUNAR_VERSAO` uma afirmação.**
 *
 * A janela, a hora e a borda dizem *qual noite entrou em qual coluna*, e as três já
 * têm coluna na tabela. Nada dizia *com que aritmética o veredito saiu*: trocar o
 * Hodges–Lehmann pela diferença de duas medianas, o Mann–Whitney por outro teste, ou
 * a aproximação normal do poder por uma exata muda efeito, p e poder sobre o **mesmo
 * acervo** — e fazer isso depois de ver o resultado não deixava rastro nenhum.
 *
 * O golden é o sha256 do fonte inteiro de `lua-protocolo.ts`. Mexer nele sem subir a
 * versão reprova aqui, que é o ponto: a versão existe para comparar duas execuções
 * sabendo o que mudou entre elas. Os dois sobem no mesmo commit.
 *
 * **`lua.ts` fica de fora de propósito** — o que vive lá é a operacionalização, que já
 * tem três colunas próprias por execução. Metê-la aqui faria uma mudança de janela
 * subir a versão do motor, dizendo a coisa errada: o motor não mudou, a régua mudou.
 */
check('o motor é o do golden — aritmética nova sem bump de versão reprova aqui', () => {
  assert.equal(MOTOR_LUNAR_VERSAO, 1);
  const fonte = readFileSync(join(import.meta.dirname, 'lua-protocolo.ts'));
  const sha = createHash('sha256').update(fonte).digest('hex');
  assert.equal(
    sha,
    // Fixado em 29/09/2026, com `MOTOR_LUNAR_VERSAO` 1 (story 4.2b).
    '9c53db13a275096fb0b3cd6080f1f97e431d0ffba8574565ac0786973d5179bb',
    `sleep/lua-protocolo.ts mudou (sha256 ${sha}) — o motor do teste lunar é o que produz efeito, p e `
    + 'poder. Se a mudança pretendia alterar a conta, suba MOTOR_LUNAR_VERSAO e atualize este golden '
    + 'no mesmo commit; execuções já gravadas ficam com a versão anterior carimbada, que é o ponto. '
    + 'Se foi só comentário, suba o golden e deixe a versão onde está — e diga isso na mensagem do '
    + 'commit, porque ninguém consegue distinguir as duas coisas por um hash.',
  );
});

console.log(`\n${passed} testes de sleep/lua-carimbo.ts passaram.`);
