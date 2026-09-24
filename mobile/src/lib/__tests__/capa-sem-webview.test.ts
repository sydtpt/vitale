/**
 * BARREIRA — **a capa desenhada não monta WebView** (Story 2.4a).
 *
 * É o critério de aceitação da story escrito como código: *"Given uma capa
 * `tracado` com rota, when a edição abre, then a rota aparece e **nenhum WebView**
 * é montado."*
 *
 * ## Por que barreira de código-fonte, e não de comportamento
 *
 * Este workspace não tem renderizador de teste (nem `@testing-library/react-native`
 * nem `react-test-renderer`), e a spec não pede dependência nova — é o mesmo
 * impasse do `useRolagemAncorada`, e a mesma resposta do `silencio-fiacao.test.ts`:
 * quando a regra não é observável sem tela, prende-se o **fonte**.
 *
 * ## O que ela impede
 *
 * A saída fácil para desenhar uma rota neste app é o `WorkoutMap`, que é um
 * `WebView` com o mapa dentro — ele já existe, já sabe desenhar `route_overview` e
 * daria capa em uma linha. O preço não aparece em uma capa: aparece em **quarenta**,
 * na parede da 2.4b, onde seriam quarenta processos de conteúdo. É exatamente o
 * custo que a 1.13 tirou da árvore quando trocou a medição do véu por `captureRef`
 * — e o WebView que sobrou lá (o `MedidorDoVeu`) desmonta assim que responde,
 * justamente por isso.
 *
 * A capa de **foto** continua podendo montar o medidor: ela não está nesta lista.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

const SRC = join(__dirname, '..', '..');

/** Os arquivos que desenham a capa em papel — os dois desenhistas e o que os monta. */
const DESENHISTAS = [
  join(SRC, 'components', 'revista', 'CapaTracado.tsx'),
  join(SRC, 'components', 'revista', 'CapaGrade.tsx'),
  join(SRC, 'hooks', 'useRotaDaCapa.ts'),
  join(SRC, 'hooks', 'useGradeDaCapa.ts'),
];

/** O fonte sem comentário de linha nem de bloco — a regra citada em prosa não conta. */
function semComentario(caminho: string): string {
  return readFileSync(caminho, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^[ \t]*\/\/.*$/gm, ' ');
}

/**
 * O que não pode aparecer: o componente do `react-native-webview`, o mapa que o
 * embrulha, e o próprio pacote.
 */
const PROIBIDOS = [
  /\breact-native-webview\b/,
  /\bWebView\b/,
  /\bWorkoutMap\b/,
  /\bmap-html\b/,
];

describe('BARREIRA — a capa desenhada não monta WebView', () => {
  it('os dois desenhistas e as duas portas estão limpos', () => {
    const sujos: string[] = [];
    for (const arquivo of DESENHISTAS) {
      const fonte = semComentario(arquivo);
      for (const proibido of PROIBIDOS) {
        if (proibido.test(fonte)) sujos.push(`${arquivo.replace(SRC, 'src')} → ${proibido}`);
      }
    }
    expect(sujos).toEqual([]);
  });

  /** A barreira precisa continuar tendo alvo: arquivo renomeado a deixa vazia. */
  it('os quatro arquivos existem — a barreira não ficou sem alvo', () => {
    for (const arquivo of DESENHISTAS) {
      expect(readFileSync(arquivo, 'utf8').length).toBeGreaterThan(0);
    }
  });

  /**
   * E desenham mesmo em SVG: sem esta linha, um arquivo que deixasse de desenhar
   * passaria na barreira por não ter nada.
   */
  it('os dois desenhistas desenham em react-native-svg', () => {
    for (const arquivo of DESENHISTAS.slice(0, 2)) {
      expect(semComentario(arquivo)).toMatch(/from 'react-native-svg'/);
    }
  });
});
