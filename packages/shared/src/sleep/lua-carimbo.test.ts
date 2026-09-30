/**
 * Testes do carimbo da execução lunar — puros, sem framework. Rodar com:
 *   cd packages/shared && npx tsx src/sleep/lua-carimbo.test.ts
 *
 * O que se cobra aqui é a **forma do módulo**: a sonda da borda, a operacionalização,
 * o piso da cadeia e o congelamento dela. Duas coisas são falsificáveis e valem a
 * leitura:
 *
 * 1. **A borda direita é medida, não declarada.** A sonda pergunta ao classificador,
 *    e o teste cobra que ela saiba dizer `fechada` — senão ela seria um `return
 *    'aberta'` disfarçado.
 * 2. **O piso é piso, e não o comprimento de hoje.** `CADEIA_MINIMA` não acompanha o
 *    crescimento da cadeia, de propósito: execuções antigas têm quatro elos e
 *    continuam legíveis quando o quinto documento chegar.
 *
 * ## As sha256 NÃO são conferidas aqui, e a razão é o furo que a 4.3 fechou
 *
 * A cobrança da cadeia, do digest e do golden do motor **saiu deste arquivo** e virou
 * barreira canônica em `architecture.test.ts` (story 4.3). O que vivia aqui iterava
 * `CADEIA_DO_PRE_REGISTRO` e comparava com o disco — conferia a constante contra si
 * mesma —, então **editar o documento e a constante no mesmo commit passava**. Lá as
 * sha256 esperadas são literais da própria barreira, e essa mutação reprova.
 *
 * Nada mudou no que a Correção 2 de 08/09 promete: a quebra continua incondicional, e
 * um byte a mais em qualquer um dos quatro documentos reprova a suíte inteira. E não
 * se repete aqui nenhuma sha que já é cobrada lá: **uma fonte de verdade por sha**.
 *
 * Nenhum dado de sono entra aqui. O pré-registro proíbe olhar antes de rodar, e
 * proveniência não precisa de noite medida para ser conferida.
 */
import assert from 'node:assert/strict';
import { HORA_UTC_DO_FIM_DA_NOITE, JANELA_LUNAR_NOITES, janelaLunarDoInstante } from './lua';
import { PHASE_ORDER, nextLunarPhase } from '../astro/moon';
import {
  BORDAS_DA_JANELA,
  CADEIA_DO_PRE_REGISTRO,
  CADEIA_MINIMA,
  DIGEST_DA_CADEIA,
  INICIO_DO_ACERVO_LUNAR,
  operacionalizacaoLunar,
} from './lua-carimbo';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

/* ─────────────────────────── A cadeia ─────────────────────────── */

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

check('a cadeia é congelada — ninguém a alarga em runtime', () => {
  assert.ok(Object.isFrozen(CADEIA_DO_PRE_REGISTRO));
  for (const e of CADEIA_DO_PRE_REGISTRO) assert.ok(Object.isFrozen(e), e.arquivo);
});

/**
 * **Só a FORMA, e nada de disco.** Este `for` é o que sobrou da cobrança que migrou, e ele
 * não abre arquivo nenhum: quem compara cada elo com os bytes em disco é
 * `architecture.test.ts`, com as sha256 escritas como literais **dele**. O leitor que vê um
 * laço sobre `CADEIA_DO_PRE_REGISTRO` aqui supõe cobrança que não existe mais — daí esta
 * nota. O que se cobra abaixo é que um literal truncado ou em caixa alta caia como "o
 * literal está quebrado", e não como "o arquivo mudou", que mandaria o leitor procurar no
 * lugar errado.
 */
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

console.log(`\n${passed} testes de sleep/lua-carimbo.ts passaram.`);
