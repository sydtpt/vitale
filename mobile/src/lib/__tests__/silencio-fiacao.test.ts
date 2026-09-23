/**
 * BARREIRA — as duas telas da revista passam os cadernos visíveis (Story 2.5).
 *
 * `vistaDaEdicao` e `portaDe` recebem a lista como **último argumento com padrão**
 * (`= CADERNO_IDS`), e o padrão é deliberado: ele é o mesmo idioma de
 * `OpcoesDaImpressao.cadernos` — ausente é "os quatro" — e é o que mantém as
 * dezenas de chamadas dos testes legíveis.
 *
 * O preço desse padrão é que **apagar o argumento desliga a feature em silêncio**:
 *
 *     vistaDaEdicao(estado, comDado, AGG_VERSION)        // compila. Nada silencia.
 *     portaDe(estadoDe(...))                             // compila. O cartão volta a falar.
 *
 * E não é só "o caderno reaparece": sem a lista, `comDadoVisivel` volta a ser o
 * `comDado` cru, e o caderno silenciado ganha de volta o botão "Escrever" — que a
 * ação, essa sim lendo a preferência sozinha (`visiveisAgora`), recusaria calada.
 * Botão morto, tsc verde, suíte verde. É exatamente o modo de falha da
 * `store-selector-stability.test.ts`, e a resposta é a mesma: guarda de
 * **código-fonte**, não de comportamento.
 *
 * O que ela cobra, nos dois sítios de produção:
 *
 * - a rota da revista (`app/revista/[tipo]/[inicio].tsx`) chama `vistaDaEdicao`
 *   com quatro argumentos;
 * - a Retrospectiva (`app/retrospectiva/index.tsx`) chama `portaDe` com dois;
 * - e as duas derivam a lista de `cadernosVisiveis`, sobre uma preferência
 *   **resolvida** (`resolveRetroPrefs`) — a mesma porta que a ação usa, e cuja
 *   ausência é o defeito que esta barreira nasceu para não deixar voltar.
 *
 * Ela não vale para os testes: lá a chamada de três argumentos é o caso "ausente
 * é os quatro", e ele tem asserção própria.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

const APP = join(__dirname, '..', '..', 'app');

const ROTA = join(APP, 'revista', '[tipo]', '[inicio].tsx');
const RETRO = join(APP, 'retrospectiva', 'index.tsx');

/** O fonte sem comentário de linha nem de bloco — a regra citada em prosa não conta. */
function semComentario(caminho: string): string {
  return readFileSync(caminho, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^[ \t]*\/\/.*$/gm, ' ');
}

/**
 * A lista de argumentos de uma chamada, por contagem de parênteses.
 *
 * Uma regex não serve: os argumentos reais são chamadas aninhadas
 * (`portaDe(estadoDe(a, b, c), lista)`), e contar vírgulas no texto plano daria
 * cinco onde há dois.
 */
function argumentosDe(fonte: string, funcao: string): string[] | null {
  const abre = fonte.indexOf(`${funcao}(`);
  if (abre < 0) return null;
  let i = abre + funcao.length + 1;
  let profundidade = 1;
  const args: string[] = [];
  let atual = '';
  for (; i < fonte.length && profundidade > 0; i += 1) {
    const c = fonte[i];
    if (c === '(' || c === '[' || c === '{') profundidade += 1;
    else if (c === ')' || c === ']' || c === '}') {
      profundidade -= 1;
      if (profundidade === 0) break;
    }
    if (c === ',' && profundidade === 1) {
      args.push(atual.trim());
      atual = '';
      continue;
    }
    atual += c;
  }
  if (profundidade !== 0) return null;
  args.push(atual.trim());
  return args.map((a) => a.trim()).filter((a) => a.length > 0);
}

describe('BARREIRA — o silêncio dos cadernos está ligado nas duas telas', () => {
  it('a rota da revista passa a lista dos visíveis a vistaDaEdicao', () => {
    const args = argumentosDe(semComentario(ROTA), 'vistaDaEdicao');
    expect({ sitio: 'revista/[tipo]/[inicio].tsx', args: args?.length ?? null })
      .toEqual({ sitio: 'revista/[tipo]/[inicio].tsx', args: 4 });
  });

  it('a Retrospectiva passa a lista dos visíveis a portaDe', () => {
    const args = argumentosDe(semComentario(RETRO), 'portaDe');
    expect({ sitio: 'retrospectiva/index.tsx', args: args?.length ?? null })
      .toEqual({ sitio: 'retrospectiva/index.tsx', args: 2 });
  });

  /**
   * A lista tem que sair de `cadernosVisiveis` **sobre a preferência resolvida**.
   *
   * `preferences.retroPrefs` nem sempre passou pelo resolvedor: a hidratação do
   * boot põe no estado o que o `getJSON` devolveu do cache local. Uma tela que
   * lesse o cru discordaria da ação — que resolve — sobre a mesma entrada
   * estragada, e a discordância é calada. Foi assim que a P1 nasceu, na ação.
   *
   * O argumento vale de duas formas, e as duas estão em produção: a chamada
   * aninhada (a rota) e o `const` que guarda o resolvido porque a tela também
   * precisa dele para os blocos (a Retrospectiva). O que não vale é a fatia crua
   * da store entrando direto.
   */
  it('as duas resolvem a preferência antes de pedir os visíveis', () => {
    const problemas: string[] = [];
    for (const [nome, caminho] of [['revista/[tipo]/[inicio].tsx', ROTA], ['retrospectiva/index.tsx', RETRO]] as const) {
      const fonte = semComentario(caminho);
      const args = argumentosDe(fonte, 'cadernosVisiveis');
      const arg = args?.[0];
      if (!arg) {
        problemas.push(`${nome}: não chama cadernosVisiveis`);
        continue;
      }
      // Forma 1: `cadernosVisiveis(resolveRetroPrefs(…))`.
      if (/^resolveRetroPrefs\s*\(/.test(arg)) continue;
      // Forma 2: `cadernosVisiveis(prefs)`, com `const prefs = … resolveRetroPrefs(…)`.
      const identificador = /^[A-Za-z_$][\w$]*$/.test(arg) ? arg : null;
      const atribuido = identificador
        && new RegExp(`\\bconst\\s+${identificador}\\s*=[\\s\\S]{0,200}?resolveRetroPrefs\\s*\\(`).test(fonte);
      if (atribuido) continue;
      problemas.push(`${nome}: cadernosVisiveis(${arg}) não vem de resolveRetroPrefs`);
    }
    expect(problemas).toEqual([]);
  });
});
