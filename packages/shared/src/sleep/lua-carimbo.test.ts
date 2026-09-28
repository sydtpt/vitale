/**
 * Testes do carimbo da execução lunar — puros, sem framework. Rodar com:
 *   cd packages/shared && npx tsx src/sleep/lua-carimbo.test.ts
 *
 * Duas coisas são cobradas aqui, e as duas são falsificáveis:
 *
 * 1. **A cadeia bate com os arquivos em disco.** As quatro sha256 são recalculadas
 *    do conteúdo, e um byte a mais em qualquer documento reprova. Isto **não é** a
 *    barreira da story 4.3 — aquela mora em `architecture.test.ts` e é incondicional
 *    sobre o build inteiro; esta é o teste de unidade da constante, e existe para que
 *    a constante não nasça errada.
 * 2. **A borda direita é medida, não declarada.** A sonda pergunta ao classificador,
 *    e o teste cobra que ela saiba dizer `fechada` — senão ela seria um `return
 *    'aberta'` disfarçado.
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
  DIGEST_DA_CADEIA,
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

check('o digest da cadeia é o sha256 das sha256, na ordem, unidas por \\n', () => {
  assert.equal(
    DIGEST_DA_CADEIA,
    sha256Hex(CADEIA_DO_PRE_REGISTRO.map((e) => e.sha256).join('\n')),
  );
  assert.equal(
    DIGEST_DA_CADEIA,
    // Fixado em 28/09/2026, com a cadeia em quatro elos (story 4.2b). Elo novo muda
    // este valor: é o ponto dele.
    '70dd78c4c1adaeb48de8eb52a4da862cf351346478f0f579f3c4c2bc43446082',
    `o digest da cadeia mudou (${DIGEST_DA_CADEIA}) — confira que é o documento novo que o mudou, e `
    + 'atualize este golden no mesmo commit.',
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

console.log(`\n${passed} testes de sleep/lua-carimbo.ts passaram.`);
