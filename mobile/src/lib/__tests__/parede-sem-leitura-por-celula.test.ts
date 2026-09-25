/**
 * BARREIRA — **a parede não lê o banco por célula** (Story 2.4b).
 *
 * É o critério de aceitação da story escrito como código: *"Given as 39 capas de
 * mês, when a parede abre, then o número de leituras ao banco **não cresce com o
 * número de capas**."*
 *
 * ## Por que barreira de código-fonte, e não de comportamento
 *
 * Este workspace não tem renderizador de teste (nem `@testing-library/react-native`
 * nem `react-test-renderer`), e a spec não pede dependência nova — é o mesmo
 * impasse do `capa-sem-webview.test.ts` e do `silencio-fiacao.test.ts`, e a mesma
 * resposta: quando a regra não é observável sem tela, prende-se o **fonte**.
 *
 * ## O que ela impede
 *
 * A saída fácil é a pior: `useFotoDaCapa` e `useRotaDaCapa` já existem, já sabem
 * resolver a capa de um período e caberiam no ladrilho em uma linha cada. Numa
 * capa eles são duas consultas; em quarenta são oitenta — mais as 39 de
 * `fetchCapa` e as 39 de `fetchEdicao` que o mesmo atalho traria junto. Elas
 * chegariam fora de ordem, e a parede ficaria preenchendo buracos enquanto o dedo
 * rola.
 *
 * O único ponto da parede que fala com o banco é `useAcervoDaParede`, e o que ele
 * chama são **as leituras em lote**. `fetchCapa` e `fetchPhotoById` (as de uma
 * linha) estão proibidas nele também — a barreira as recusa em todos os arquivos,
 * inclusive no hospedeiro.
 *
 * A rota da edição (`app/revista/[tipo]/[inicio].tsx`) **não** está nesta lista, e
 * continua lendo por id: lá é uma consulta, e a diferença entre 1 e 39 é a story
 * inteira.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

const SRC = join(__dirname, '..', '..');

/** As células e o que as monta — nenhum deles pode tocar o banco. */
const CELULAS = [
  join(SRC, 'components', 'revista', 'LadrilhoDoArquivo.tsx'),
  join(SRC, 'components', 'revista', 'TirasDoAnuario.tsx'),
  join(SRC, 'app', 'revista', 'index.tsx'),
  join(SRC, 'lib', 'parede.ts'),
];

/** O **único** que lê — e que mesmo assim não pode ler de uma em uma. */
const HOSPEDEIRO = join(SRC, 'hooks', 'useAcervoDaParede.ts');

/**
 * O fonte sem comentário de linha nem de bloco — a regra citada em prosa não
 * conta.
 *
 * **Limite declarado:** o `//` só é removido quando ele **começa** a linha. Um
 * comentário de fim de linha (`const x = 1; // ver fetchCapa`) continua no texto
 * e pode acusar um arquivo limpo. É a forma que o repositório já usa (mesma
 * função em `capa-sem-webview.test.ts`), e o falso positivo é barulhento e fácil
 * de ler; o falso negativo é que seria caro, e este recorte não tem nenhum.
 */
function semComentario(caminho: string): string {
  return readFileSync(caminho, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^[ \t]*\/\/.*$/gm, ' ');
}

/**
 * As leituras **de uma linha**, e os dois hooks que as embrulham.
 *
 * `\b` no fim é o que separa `fetchCapa` de `fetchCapasDoArquivo`: a segunda é
 * justamente a leitura em lote que esta story criou, e proibi-la por engano
 * deixaria a barreira sem saída.
 */
const POR_CELULA = [
  /\bfetchCapa\b/,
  /\bfetchPhotoById\b/,
  /\bfetchEdicao\b/,
  /\bfetchRouteSurface\b/,
  /\bfetchActivityPhotos\b/,
  /\buseFotoDaCapa\b/,
  /\buseRotaDaCapa\b/,
];

describe('BARREIRA — a parede lê em lote, nunca por célula', () => {
  it('nenhuma célula da parede fala com o banco', () => {
    const sujos: string[] = [];
    for (const arquivo of CELULAS) {
      const fonte = semComentario(arquivo);
      for (const proibido of [...POR_CELULA, /\bsupabase\b/, /\bfetchAllPages\b/]) {
        if (proibido.test(fonte)) sujos.push(`${arquivo.replace(SRC, 'src')} → ${proibido}`);
      }
    }
    expect(sujos).toEqual([]);
  });

  it('o hospedeiro também não lê de uma em uma', () => {
    const fonte = semComentario(HOSPEDEIRO);
    const sujos = POR_CELULA.filter((p) => p.test(fonte)).map(String);
    expect(sujos).toEqual([]);
  });

  /**
   * A metade positiva: sem ela, um hospedeiro que deixasse de ler qualquer coisa
   * passaria na barreira por não ter nada. As cinco leituras em lote são o que a
   * story promete, e cada uma cobre uma "coisa" — edições, capas, textos, fotos,
   * rotas.
   */
  it('o hospedeiro chama as cinco leituras em lote', () => {
    const fonte = semComentario(HOSPEDEIRO);
    for (const emLote of [
      'fetchArquivoDeEdicoes',
      'fetchCapasDoArquivo',
      'fetchManchetesDosMeses',
      'fetchPhotosByIds',
      'fetchRouteOverviewPairs',
    ]) {
      expect(fonte).toContain(emLote);
    }
  });

  /**
   * E as duas do lote são chamadas **uma vez cada**, sobre a lista que
   * `ponteirosDaParede` junta.
   *
   * **Limite declarado:** contar ocorrências no fonte não vê uma chamada **dentro
   * de um laço** — `for (const c of capas) fetchPhotosByIds(…)` aparece uma vez e
   * roda trinta e nove. O que fecha esse buraco não é esta barreira, e sim o
   * `proximaParede` (`lib/parede.ts`): o hospedeiro despacha **um** `acervo` com
   * os ponteiros inteiros, e as transições desse caminho têm teste. Aqui se prende
   * a forma; lá, o efeito.
   */
  it('as leituras da segunda onda aparecem uma vez cada, sobre os ponteiros', () => {
    const fonte = semComentario(HOSPEDEIRO);
    expect(fonte).toContain('ponteirosDaParede');
    for (const emLote of ['fetchPhotosByIds', 'fetchRouteOverviewPairs']) {
      expect((fonte.match(new RegExp(`\\b${emLote}\\(`, 'g')) ?? []).length).toBe(1);
    }
  });

  /** A barreira precisa continuar tendo alvo: arquivo renomeado a deixa vazia. */
  it('os cinco arquivos existem — a barreira não ficou sem alvo', () => {
    for (const arquivo of [...CELULAS, HOSPEDEIRO]) {
      expect(readFileSync(arquivo, 'utf8').length).toBeGreaterThan(0);
    }
  });

  /**
   * A prova de que os padrões mordem: sem ela, um `POR_CELULA` escrito errado
   * (um `\\b` a mais, um nome trocado) deixaria a barreira passar sobre tudo.
   */
  it('os padrões acusam o que deveriam, e poupam a leitura em lote', () => {
    const acusa = (fonte: string) => POR_CELULA.some((p) => p.test(fonte));
    expect(acusa('const c = await fetchCapa(db, uid, t, i, f);')).toBe(true);
    expect(acusa('const f = await fetchPhotoById(db, uid, id);')).toBe(true);
    expect(acusa('const r = useRotaDaCapa(capa);')).toBe(true);
    // `fetchCapasDoArquivo` contém `fetchCapa` como prefixo: é a leitura em lote
    // que esta story criou, e proibi-la por engano deixaria a barreira sem saída.
    expect(acusa('const cs = await fetchCapasDoArquivo(db, uid);')).toBe(false);
    expect(acusa('const ps = await fetchPhotosByIds(db, uid, ids);')).toBe(false);
  });
});
