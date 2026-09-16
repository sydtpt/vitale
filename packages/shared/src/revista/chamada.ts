/**
 * A **chamada** de um caderno: a primeira frase do texto que ele já escreveu
 * (story 1.8, `docs/specs/revista-retrospectiva/cadernos.md`).
 *
 * A capa, o sumário e a parede da revista mostram a chamada de cada caderno, e
 * esta é a única função que a extrai. Sem dono único cada tela escreveria o
 * próprio corte, e o corte óbvio (`indexOf('.')`) quebra na primeira frase com
 * milhar: "1.210 fotos em 2026." viraria "1.". O `architecture.test.ts` barra o
 * corte de frase escrito à mão fora daqui e de `format/frase.ts`.
 *
 * ## Onde ela corta: onde a conferência corta
 *
 * O fim de frase é o de `terminaFrase` (`format/frase.ts`), a mesma regra que a
 * conferência (`ia/verificar.ts`) usa para decidir qual base está colada a um
 * número. **Todo ponto em que a chamada corta é um ponto em que a conferência
 * também considera fim de frase.** A chamada só **pula** cortes da regra — e
 * pular a deixa mais longa, nunca mais curta. É a direção segura: quando ela
 * erra, junta duas frases; nunca leva à capa um número longe da base.
 *
 * Os cortes que ela pula, todos pontos:
 *
 * - **Abreviação da lista fechada** — `aprox.`, `p.ex.`, `p. ex.`, `vs.`,
 *   `i.e.`, `cf.` e `p.p.`. O critério é **"em regra precede o complemento"**,
 *   não "nunca termina frase" (em português quase toda abreviação termina frase
 *   em alguma construção). `aprox.`, `p.ex.` e `p.p.` às vezes terminam, e aí a
 *   chamada junta a frase seguinte. Ficam de fora `etc.`, `máx.` e `mín.`, que
 *   terminam frase mais do que precedem, e os tratamentos (`Sr.`, `Dra.`), que a
 *   revista não usa. Entrar na lista é pergunta ao dono — e o teste compara a
 *   lista inteira, item a item.
 * - **Ponto colado a letra** — "intervals.icu", "1.º": ponto seguido de letra,
 *   sem espaço, não é fim de frase em prosa.
 *
 * Uma abreviação de vários pontos é casada inteira, e entre as partes cabe
 * espaço — "p. p.", "i. e.", "p. ex." —, inclusive o de largura zero: qualquer
 * espaço que não seja corte de `terminaFrase`. As abreviações ficam **só aqui**:
 * na regra compartilhada, mudariam o que a conferência reprova.
 *
 * ## Onde ela começa
 *
 * Espaço à frente sai, inclusive o de largura zero. Os marcadores de lista no
 * começo saem também, **quantos houver** ("1. a. O sono caiu." começa em "O"):
 * ver `MARCADOR`. O espaço obrigatório depois do marcador é o que protege o
 * milhar: "1.210 fotos" não é marcador. Depois, um trecho até o corte **sem
 * nenhuma letra** é pulado e a busca continua — "... e o sono caiu 40 min."
 * devolve "e o sono caiu 40 min.". Mudar onde a chamada começa não fere o
 * invariante: os cortes continuam sendo os da conferência.
 *
 * ## Ausência não é string vazia
 *
 * `null` quer dizer **não há caderno**: sendo escrito, reprovado e não impresso
 * chegam aqui do mesmo jeito — sem linha no banco, logo sem texto. É `null`
 * também o texto **sem conteúdo**: nenhum trecho com letra depois de tirar os
 * marcadores e pular os trechos sem letra. A letra de um marcador não é
 * conteúdo — "a) 40" não tem chamada, e "40" não seria uma. A chamada nunca é
 * `''`, e chamar de novo sobre ela devolve ela mesma.
 *
 * ## O que ela não resolve (`deferred-work.md`, entrada da 1.8)
 *
 * Não tem teto de tamanho: texto sem terminador devolve o texto inteiro. `\u2026` (o
 * caractere) não corta, e junta duas frases. Markdown sai cru.
 *
 * **Sem lookbehind em regex**: roda no Hermes, e não há precedente de lookbehind
 * no boot do app (ver a 5.3). **Caractere invisível sempre por escape** (`\u200B`):
 * editor e formatador o apagam cru sem nenhum teste notar.
 */
import { terminaFrase } from '../format/frase';

/**
 * A lista fechada, em minúsculas — a casa da letra não decide. O espaço de
 * `p. ex.` casa **um ou mais** espaços que não sejam corte de `terminaFrase`;
 * depois de um ponto de dentro de qualquer outra, **zero ou mais**.
 *
 * Exportada só para o teste comparar a lista inteira — não sai pelo barril.
 */
export const ABREVIACOES_DA_CHAMADA: readonly string[] = Object.freeze([
  'aprox.', 'p.ex.', 'p. ex.', 'vs.', 'i.e.', 'cf.', 'p.p.',
]);

/** O espaço que sai das pontas e cabe dentro de uma abreviação: o comum e os de largura zero (ZWSP, ZWNJ, ZWJ, WJ, BOM). */
const ESPACO = /[\s\u200B\u200C\u200D\u2060\uFEFF]/;
const LETRA = /\p{L}/u;
/** O que, logo antes, faz da abreviação um pedaço de outra palavra. */
const DENTRO_DA_PALAVRA = /[\p{L}\p{N}\p{M}]/u;

/**
 * Um marcador de lista no começo, sempre com espaço depois:
 *
 * - um a três dígitos com `.` ou `)` — `1.`, `12)`;
 * - **uma** letra ASCII com `.` ou `)` — `a.`, `B)`. Só ASCII: "É." é uma
 *   frase, não um item;
 * - um romano de duas letras ou mais, até 39: **maiúsculo** com `.` ou `)` —
 *   `II.`, `XVI)` —, **minúsculo só com `)`** — `iv)`. "Vi." é uma frase, e
 *   "vi." também;
 * - um traço: hífen, bala, meia-risca e travessão.
 *
 * O romano de uma letra já é letra ASCII.
 */
const MARCADOR =
  /^(?:(?:\d{1,3}|[a-zA-Z]|(?=[IVX]{2})X{0,3}(?:IX|IV|V?I{0,3}))[.)]|(?=[ivx]{2})x{0,3}(?:ix|iv|v?i{0,3})\)|[-\u2022\u2013\u2014])\s+/u;

/** Os terminadores que entram quando colados ao corte: "...", "?!". */
const TERMINADORES = '.!?';
/** Os fechamentos que entram logo depois dos terminadores: aspas retas e curvas, angulares, parêntese e colchete. */
const FECHAMENTOS = '"\'\u201D\u2019\u00BB\u203A)]';

function letraEm(texto: string, i: number): boolean {
  const cp = texto.codePointAt(i);
  return cp !== undefined && LETRA.test(String.fromCodePoint(cp));
}

/**
 * A abreviação começa numa fronteira: nem letra, nem dígito, nem marca
 * combinante logo antes. O caractere de antes é lido inteiro — uma letra fora
 * do plano básico ocupa duas unidades, e a de baixo sozinha não é letra.
 */
function emFronteira(texto: string, k: number): boolean {
  if (k === 0) return true;
  const baixo = texto.charCodeAt(k - 1);
  const antes = baixo >= 0xdc00 && baixo <= 0xdfff && k >= 2 ? texto.slice(k - 2, k) : texto[k - 1];
  return !DENTRO_DA_PALAVRA.test(antes);
}

/**
 * Onde termina (exclusivo) a abreviação casada em `k`, ou -1.
 *
 * O espaço de dentro é o de `ESPACO` que **não é corte de `terminaFrase`** —
 * pergunta à regra, não fixa `\n`: no dia em que ela aprender outro separador de
 * linha, a abreviação deixa de atravessá-lo sozinha.
 */
function casaAbreviacao(texto: string, k: number, abreviacao: string): number {
  let i = k;
  const espacoDeDentro = (): number => {
    const inicio = i;
    while (i < texto.length && ESPACO.test(texto[i]) && !terminaFrase(texto, i)) i += 1;
    return i - inicio;
  };
  for (let p = 0; p < abreviacao.length; p += 1) {
    const esperado = abreviacao[p];
    if (esperado === ' ') {
      if (espacoDeDentro() === 0) return -1;
      continue;
    }
    if (texto[i] === undefined || texto[i].toLowerCase() !== esperado) return -1;
    i += 1;
    // Depois de um ponto de dentro, o espaço é opcional: "p. p.", "i. e.".
    if (esperado === '.' && p < abreviacao.length - 1 && abreviacao[p + 1] !== ' ') espacoDeDentro();
  }
  return i;
}

/** Os pontos que pertencem a uma abreviação da lista — casada inteira, nenhum ponto de dentro corta. */
function pontosDeAbreviacao(texto: string): ReadonlySet<number> {
  const pontos = new Set<number>();
  for (let k = 0; k < texto.length; k += 1) {
    if (!emFronteira(texto, k)) continue;
    for (const abreviacao of ABREVIACOES_DA_CHAMADA) {
      const fim = casaAbreviacao(texto, k, abreviacao);
      for (let i = k; i < fim; i += 1) if (texto[i] === '.') pontos.add(i);
    }
  }
  return pontos;
}

function depoisDoEspaco(texto: string, i: number): number {
  let j = i;
  while (j < texto.length && ESPACO.test(texto[j])) j += 1;
  return j;
}

/**
 * O começo depois do espaço e de **todos** os marcadores de lista seguidos — a
 * não ser que ali comece uma abreviação ("P. ex. \u2026").
 */
function depoisDosMarcadores(texto: string, i: number): number {
  let j = depoisDoEspaco(texto, i);
  for (;;) {
    if (ABREVIACOES_DA_CHAMADA.some((a) => casaAbreviacao(texto, j, a) >= 0)) return j;
    const m = MARCADOR.exec(texto.slice(j));
    if (!m) return j;
    j = depoisDoEspaco(texto, j + m[0].length);
  }
}

/**
 * Onde termina (exclusivo) a frase que começa em `de`.
 *
 * O corte é o primeiro de `terminaFrase` que não seja ponto de abreviação nem
 * ponto colado a letra. Se ele é um terminador, entra — com os terminadores
 * colados e os fechamentos logo depois; se é quebra de linha (ou qualquer outro
 * separador que a regra aprenda), fica de fora.
 */
function fimDaFrase(texto: string, de: number, abreviacoes: ReadonlySet<number>): number {
  for (let i = de; i < texto.length; i += 1) {
    if (!terminaFrase(texto, i)) continue;
    if (texto[i] === '.' && (abreviacoes.has(i) || letraEm(texto, i + 1))) continue;
    if (!TERMINADORES.includes(texto[i])) return i;
    let j = i + 1;
    while (j < texto.length && TERMINADORES.includes(texto[j])) j += 1;
    while (j < texto.length && FECHAMENTOS.includes(texto[j])) j += 1;
    return j;
  }
  return texto.length;
}

function semEspacoNoFim(s: string): string {
  let fim = s.length;
  while (fim > 0 && ESPACO.test(s[fim - 1])) fim -= 1;
  return s.slice(0, fim);
}

/**
 * A primeira frase do texto de um caderno, ou `null` se não há caderno.
 *
 * `null`/`undefined` é caderno sendo escrito, reprovado ou não impresso — os
 * três chegam sem texto. Texto sem conteúdo (nenhum trecho com letra fora dos
 * marcadores) também é `null`. Nunca `''`.
 */
export function chamadaDoTexto(texto: string | null | undefined): string | null {
  if (texto == null || !LETRA.test(texto)) return null;
  const abreviacoes = pontosDeAbreviacao(texto);
  let inicio = 0;
  for (;;) {
    inicio = depoisDosMarcadores(texto, inicio);
    if (inicio >= texto.length) return null;
    const fim = fimDaFrase(texto, inicio, abreviacoes);
    const frase = semEspacoNoFim(texto.slice(inicio, fim));
    if (LETRA.test(frase)) return frase;
    // Um separador que não é espaço e fica de fora do trecho: sem o passo, o
    // laço pararia nele para sempre.
    inicio = fim > inicio ? fim : fim + 1;
  }
}
