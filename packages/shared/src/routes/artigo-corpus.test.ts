/**
 * A prova de corpus da regra do artigo (story 5.14).
 *
 * Uma regra nova sobre dado vivo tem duas maneiras de estar errada: não morder
 * nada (o `verificar.test.ts` cobre isso, com o caso-espelho) ou morder o que já
 * foi aprovado. Esta é a segunda: os pares `(língua, artigo)` das **135** metas
 * que o dono aprovou em produção, passados pela regra, um a um.
 *
 * **O que este teste não é.** Ele não fala com o banco — o fixture é um
 * instantâneo que uma pessoa transcreveu da saída de uma query, na data que o
 * `medido_em` registra. Então a contagem impressa aqui é a do arquivo, não a da
 * produção de hoje: quando o acervo passar de 135, isto segue verde e desatualizado.
 * O que ele prova é histórico e vale a pena: **na data em que a regra entrou,
 * nenhum nome aprovado era reprovado por ela**. As asserções abaixo existem para
 * que esse instantâneo não apodreça em silêncio nem fique verde por vacuidade.
 *
 * O fixture não guarda topônimo, nem id, nem nada de saúde — só as duas colunas
 * de que a regra depende, com a contagem de quantas metas cada par representa.
 *
 * `viaArtigo` não entra aqui porque **não é persistido na meta** — ele não
 * existe no corpus para ser conferido. A prova dele é o golden de 20, onde três
 * pedaladas o trazem (`le` e `la` em francês, `het` em neerlandês).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ARTIGOS_POR_LINGUA, verificarNome } from './verificar';
import type { Lingua, NomePreenchido } from './types';

interface Corpus {
  fonte: string;
  query: string;
  medido_em: string;
  total: number;
  manutencao: string;
  pares: { lingua: Lingua; artigo: string | null; n: number }[];
}

const corpus: Corpus = JSON.parse(
  readFileSync(join(import.meta.dirname, '__fixtures__', 'artigos-producao.json'), 'utf8'),
);

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

/*
 * Uma rota mínima e consistente, **com região**: é a região que faz o `artigo`
 * ser lido, e a regra é amarrada ao uso do campo. Sem ela o corpus inteiro
 * passaria sem a regra rodar uma única vez.
 */
const cidade = (name: string) => ({ name, country: 'België / Belgique / Belgien', lat: 0, lng: 0 });
const rota = { cities: [cidade('Ninove')] };
const comArtigo = (lingua: Lingua, artigo: string | null) => {
  const pecas: NomePreenchido = { regiao: 'Pajottenland', artigo, justificativa: ['Ninove'] };
  return verificarNome(rota, { forma: 'casa-loop-casa', lingua }, pecas);
};

check('o fixture soma as 135 metas aprovadas — e diz de quando é', () => {
  const soma = corpus.pares.reduce((t, p) => t + p.n, 0);
  assert.equal(soma, corpus.total);
  assert.equal(soma, 135, 'o corpus da story 5.14 são 135 pedaladas com nome aprovado');
  // Sem estes dois, ninguém sabe de quando é o instantâneo nem como refazê-lo.
  assert.match(corpus.medido_em, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(corpus.query.includes('route_name_meta'), 'o fixture carrega a query que o gerou');
  assert.ok(corpus.manutencao.length > 0, 'o fixture diz quem o atualiza e quando');
});

check('o corpus tem artigo de verdade — senão a prova seria vazia', () => {
  /*
   * Sem isto, um fixture futuro só com artigos nulos deixaria este arquivo verde
   * sem conferir nada: artigo nulo sai pela primeira linha de `conferirArtigo`.
   * Hoje são 15 metas com artigo (`le` × 11, `la` × 4).
   */
  const comValor = corpus.pares.filter((p) => p.artigo !== null);
  assert.ok(comValor.length > 0, 'nenhum artigo não nulo no corpus: a prova não prova nada');
  const quantas = comValor.reduce((t, p) => t + p.n, 0);
  assert.ok(quantas >= 15, `só ${quantas} metas com artigo — o corpus encolheu?`);
});

check('toda língua do corpus está na tabela da regra', () => {
  // A tabela é exaustiva por tipo, mas o JSON não tem tipo em runtime: uma
  // língua nova em produção viraria um TypeError obscuro lá dentro. Aqui vira
  // uma frase.
  const conhecidas = Object.keys(ARTIGOS_POR_LINGUA);
  for (const p of corpus.pares) {
    assert.ok(
      conhecidas.includes(p.lingua),
      `língua "${p.lingua}" está em produção e não está na tabela (${conhecidas.join(', ')})`,
    );
  }
});

check('o arnês não é vazio — ele reprova quando o artigo é de outra língua', () => {
  // Sem isto, "0 reprovadas" continuaria verde se a regra sumisse, se o arnês
  // parasse de passar a língua, ou se ele parasse de mandar região.
  assert.ok(comArtigo('fr', 'a').problemas.some((p) => p.regra === 'artigo'));
});

check('nenhuma das metas aprovadas é reprovada pela regra do artigo', () => {
  let conferidas = 0;
  const porPar: string[] = [];
  for (const p of corpus.pares) {
    const doArtigo = comArtigo(p.lingua, p.artigo).problemas.filter((x) => x.regra === 'artigo');
    assert.deepEqual(
      doArtigo,
      [],
      `${p.lingua}/${JSON.stringify(p.artigo)} (${p.n} metas): ${JSON.stringify(doArtigo)}`,
    );
    conferidas += p.n;
    porPar.push(`${p.lingua} + ${p.artigo === null ? 'sem artigo' : `"${p.artigo}"`} × ${p.n}`);
  }
  assert.equal(conferidas, corpus.total);
  console.log(`     ${conferidas} metas aprovadas, 0 reprovadas`);
  for (const linha of porPar) console.log(`       ${linha}`);
});

console.log(
  `\n${passed} checagens de corpus ok — instantâneo de ${corpus.medido_em}, ${corpus.fonte}`,
);
