/**
 * A geometria da tira de um caderno — **pura, sem tema, sem React e sem
 * `StyleSheet`** (Stories 2.4b e 3.2).
 *
 * Ela existe separada de `CelulasDaTira.tsx` porque é a metade que **tem prova**:
 * o vão maior na troca é a razão declarada de a tira existir, e a altura do
 * filete é a conta que separa "não saiu" de "saiu". As duas são triviais de
 * testar e impossíveis de observar sem tela — e este workspace não tem
 * renderizador. Enquanto moravam dentro do componente, a extração que é o ponto
 * da 3.2 ficava sem prova nenhuma.
 *
 * Kebab-case e `.ts` porque **não exporta componente** — a mesma convenção de
 * `constantes-da-capa.ts`, e o mesmo motivo.
 *
 * ## As duas grades, e por que são duas
 *
 * Os doze meses dividem a largura, e o vão da troca tem de sair de algum lugar.
 * Há dois lugares, e eles dão desenhos diferentes:
 *
 * - **`divididas`** (a parede, aprovada em tela na 2.4b) — o vão é **margem entre
 *   as células**, então as doze dividem o que sobra: todas as barras têm a mesma
 *   largura, e as colunas **mudam** com o número de trocas daquela tira.
 * - **`fixas`** (o anuário da edição, 3.2) — cada mês é dono de um doze avos da
 *   largura, e o vão sai de **dentro** da célula: as colunas são as mesmas nas
 *   quatro tiras, e a barra que vem depois de uma troca é mais estreita.
 *
 * **O anuário precisa de `fixas`, e não é preferência.** Ele rotula os meses uma
 * vez só, e uma régua de doze letras tem de cair sobre as quatro tiras. Com
 * `divididas`, cada tira tem colunas próprias (três trocas deslocam o fim da
 * tira em 15 px, mais de meia célula): não existe régua que sirva às quatro, e
 * legendar uma delas desalinha as outras três.
 *
 * O custo de `fixas` está declarado: a barra depois de uma troca fica ~5 px mais
 * estreita. Ela **não** vira grandeza — a largura varia exatamente com o que o
 * vão já diz ("aqui o líder mudou"), nunca com valor; e o que a tira promete
 * (`accent` × `tint` por cor, presença por forma) fica intacto.
 */
import type { ViewStyle } from 'react-native';
import type { CelulaDaTira } from '@vitale/shared';

/**
 * O vão entre dois meses, e o vão que marca a **troca de líder**.
 *
 * Dois números, e a razão entre eles é o que se lê: 2 px separa meses vizinhos
 * sem os desgrudar, 7 px abre uma pausa que o olho reconhece como "aqui mudou".
 * Um só valor não conseguiria dizer as duas coisas, e um traço no meio da tira
 * competiria com a própria barra.
 *
 * **Não são exportados.** Eles vieram da parede aprovada em tela e não se mexem;
 * exportá-los convidaria alguém a recalcular o vão numa tela em vez de chamar
 * {@link vaoAntesDaCelula}, que é onde a regra mora.
 */
const VAO_DO_MES = 2;
const VAO_DA_TROCA = 7;

/**
 * O vão **antes** de uma célula — `0` na primeira, que não tem antes.
 *
 * É a regra inteira da tira numa função: o vão maior sai de `mudou`, o carimbo
 * que diz que a métrica líder daquele mês é outra que a do último mês que teve
 * uma. Mês calado não é troca (`tirasDoAno` não zera o anterior num mês mudo), e
 * por isso `sem-metrica` e `ausente` recebem sempre o vão pequeno.
 */
export function vaoAntesDaCelula(celula: CelulaDaTira, indice: number): number {
  if (indice <= 0) return 0;
  return celula.estado === 'metrica' && celula.mudou ? VAO_DA_TROCA : VAO_DO_MES;
}

/** Onde o vão é gasto — ver o cabeçalho do módulo. */
export type ColunasDaTira = 'divididas' | 'fixas';

/**
 * O estilo que carrega o vão de uma célula, ou `null` quando não há vão.
 *
 * **Em `fixas` nunca sai margem** — e essa é a invariante do alinhamento: sem
 * margem, as doze células de qualquer tira são doze `flex: 1` idênticos, e uma
 * régua de doze `flex: 1` cai exatamente sobre elas, nas quatro tiras. É isto
 * que o teste prende.
 *
 * Os objetos são congelados e fixos — quatro no módulo inteiro —, então o render
 * não cria estilo novo por célula.
 */
export function estiloDoVao(colunas: ColunasDaTira, vao: number): ViewStyle | null {
  if (!(vao > 0)) return null;
  const grande = vao >= VAO_DA_TROCA;
  if (colunas === 'fixas') return grande ? VAO_DENTRO_TROCA : VAO_DENTRO_MES;
  return grande ? VAO_ENTRE_TROCA : VAO_ENTRE_MES;
}

const VAO_ENTRE_MES: ViewStyle = Object.freeze({ marginLeft: VAO_DO_MES });
const VAO_ENTRE_TROCA: ViewStyle = Object.freeze({ marginLeft: VAO_DA_TROCA });
const VAO_DENTRO_MES: ViewStyle = Object.freeze({ paddingLeft: VAO_DO_MES });
const VAO_DENTRO_TROCA: ViewStyle = Object.freeze({ paddingLeft: VAO_DA_TROCA });

/**
 * A coluna de um mês — **a mesma para a célula da tira e para a letra da régua**.
 *
 * Um doze avos do que houver, sem largura medida: é daqui que sai o alinhamento
 * da régua com as tiras, e é por ser o **mesmo objeto** nos dois lugares que ele
 * não pode divergir por edição de um deles.
 */
export const COLUNA_DO_MES: ViewStyle = Object.freeze({ flex: 1 });

/**
 * A altura do filete da **ausência** — um quarto do bloco.
 *
 * Um quarto, e não metade: a metade ainda lê como bloco baixo, e o que se quer é
 * que "não saiu" não seja confundido com "saiu". Centrado na faixa, ele desenha
 * uma pausa na linha, que é exatamente o que aquele mês foi.
 */
const FRACAO_DO_FILETE = 4;

/**
 * Um quinto do lado para o raio do bloco, como na célula da `CapaGrade`, e pelo
 * mesmo motivo: o quadrado puro lê como pixel de tabela, e o raio grande, como
 * bolinha. O filete é capsulado (metade da própria altura) — um quinto de 34
 * arredondaria um traço de 9 px em quase um círculo.
 */
const FRACAO_DO_RAIO = 5;

/**
 * As alturas que uma tira pode ter, em pixel.
 *
 * O teto e o piso existem por causa do cache: {@link formaDaTira} guarda um
 * conjunto de estilos por altura, e uma altura **medida** (de um `onLayout`, de
 * uma fração de densidade de tela) faria o mapa crescer um registro por pixel —
 * e `NaN` produziria raio e altura `NaN`, que o RN desenha como nada, calado. As
 * duas alturas do app são constantes de módulo (16 e 34), então o grampo nunca
 * morde em produção; ele existe para o dia em que alguém passar uma medida.
 */
const ALTURA_MINIMA = 4;
const ALTURA_MAXIMA = 240;

/** A altura, normalizada para um inteiro dentro dos limites. */
export function alturaDaTira(altura: number): number {
  if (!Number.isFinite(altura)) {
    console.warn(`[revista] altura de tira inválida (${String(altura)}); usando ${ALTURA_MINIMA}.`);
    return ALTURA_MINIMA;
  }
  return Math.min(ALTURA_MAXIMA, Math.max(ALTURA_MINIMA, Math.round(altura)));
}

/** As três medidas de uma tira, derivadas da altura dela. */
export interface FormaDaTira {
  /** A caixa de um mês: a coluna, com a altura da faixa. */
  readonly celula: ViewStyle;
  /** O bloco cheio — "o caderno saiu". */
  readonly marca: ViewStyle;
  /** O filete — "o caderno não saiu". Sobrepõe a altura e o raio da marca. */
  readonly marcaAusente: ViewStyle;
}

/**
 * A forma de uma tira daquela altura — **memoizada por altura normalizada**.
 *
 * O cache existe pela identidade dos objetos: sem ele, cada render criaria doze
 * estilos novos por tira. Com a entrada grampeada por {@link alturaDaTira}, ele
 * é limitado por construção.
 *
 * **Nada aqui lê tema** — são medidas —, e por isso pode morar no escopo do
 * módulo sem congelar a paleta. Quem lê cor é `corDaCelula`, no render.
 */
const FORMAS = new Map<number, FormaDaTira>();

export function formaDaTira(altura: number): FormaDaTira {
  const px = alturaDaTira(altura);
  const ja = FORMAS.get(px);
  if (ja) return ja;
  const filete = Math.max(1, Math.round(px / FRACAO_DO_FILETE));
  const nova: FormaDaTira = Object.freeze({
    celula: Object.freeze({ ...COLUNA_DO_MES, height: px, justifyContent: 'center' }),
    // `alignSelf: 'stretch'` e não `width: '100%'`: em `fixas` a célula tem
    // padding, e a porcentagem não é o que se quer ali — o que se quer é a caixa
    // de conteúdo, que é exatamente o que o stretch preenche.
    marca: Object.freeze({ alignSelf: 'stretch', height: px, borderRadius: px / FRACAO_DO_RAIO }),
    marcaAusente: Object.freeze({ height: filete, borderRadius: filete / 2 }),
  });
  FORMAS.set(px, nova);
  return nova;
}
