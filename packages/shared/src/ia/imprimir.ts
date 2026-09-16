/**
 * A impressão da edição — a porta que o hospedeiro chama (Story 1.10, AD-13 dos
 * motores).
 *
 * ```
 * imprimir(entrada, { buscar, gravar }, opcoes) → aberto | sem-caderno | nada-gravado | gravada
 * ```
 *
 * Este arquivo é **a porta**: os tipos que o hospedeiro precisa para ligar as
 * suas portas (`buscar`, `gravar`) e ler o resultado, e `imprimir`, que é a
 * sequência com o descritor da retrospectiva **fixo**. A sequência em si mora em
 * `ia/imprimir-sequencia.ts` — e a razão da separação é o que ela protege.
 *
 * **O descritor não é parâmetro de quem imprime.** Uma sequência que aceitasse
 * descritor pelo barril aceitaria `{ ...descritorDaRetrospectiva, conferir: () =>
 * ({ ok: true }) }` — e gravaria texto não conferido, sem nenhuma barreira ver,
 * porque isso é atribuição de propriedade, não leitura de método. A versão
 * parametrizável (`imprimirCom`) fica fora do barril e fora da porta de IA do
 * `architecture.test.ts`: a guarda (7) reprova um app que a importe por caminho
 * profundo, e só os testes do núcleo a alcançam, por caminho relativo.
 *
 * O que a sequência garante — conferir antes de gravar, gravar uma vez, nunca
 * apagar texto publicado por falha de motor, a versão da agregação carimbada fora
 * daqui — está escrito em `ia/imprimir-sequencia.ts`, junto do código que o faz.
 */
import type { PeriodKind } from '../period/bounds';
import type { CadernoId } from '../period/cadernos';
import type { CONCLUSAO } from './motor';
import type { LeituraDoMotor, LeituraDoPiso, OpcoesDeProduto } from './orquestrar';
import type { EntradaPacote } from './pacote';
import { descritorDaRetrospectiva } from './retrospectiva';
import { imprimirCom } from './imprimir-sequencia';

/* ── as portas ───────────────────────────────────────────────────────────── */

/**
 * O período de uma edição, como a tabela o chaveia. `all` fica de fora pelo tipo:
 * período que nunca fecha não tem edição.
 */
export interface PeriodoDaEdicao {
  readonly tipoPeriodo: Exclude<PeriodKind, 'all'>;
  readonly inicio: string;
  readonly fim: string;
}

/**
 * Um caderno regenerado — o texto que um motor escreveu e a conferência aprovou,
 * com a assinatura virada colunas.
 *
 * **Não tem a versão da agregação**, de propósito: quem a carimba é a porta, a
 * partir da constante. Um campo aqui seria a fila de passagens por onde o nulo
 * chegou a produção uma vez.
 */
export interface LinhaDaImpressao {
  readonly caderno: CadernoId;
  readonly texto: string;
  readonly provedor: string;
  readonly modelo: string;
  readonly promptVersao: number;
  readonly pacoteVersao: number;
  /** Só a conclusão grava: a borda já traduziu o resto em `Falha`. */
  readonly motivoDeParada: typeof CONCLUSAO;
  readonly tokensEntrada: number;
  readonly tokensSaida: number;
  /** `null` é declaração — nenhuma métrica liderou —, e é escrito, nunca omitido. */
  readonly metricaLider: string | null;
}

/** O que `gravar` recebe: os cadernos que a edição passa a ter, e o texto só dos regenerados. */
export interface Impressao extends PeriodoDaEdicao {
  /** Contígua pela função do banco: a posição é o índice + 1. */
  readonly ordem: readonly CadernoId[];
  readonly linhas: readonly LinhaDaImpressao[];
}

/**
 * As duas portas que o hospedeiro injeta. `E` é o que a gravação devolve — a
 * edição relida, no celular.
 */
export interface PortasDaImpressao<E> {
  /** Os cadernos já impressos deste período. É o que impede a falha de motor de apagar texto. */
  buscar(periodo: PeriodoDaEdicao): Promise<readonly { readonly caderno: CadernoId }[]>;
  /** Grava o conjunto, numa chamada. A sequência a chama no máximo uma vez. */
  gravar(impressao: Impressao): Promise<E>;
}

/* ── os desfechos ────────────────────────────────────────────────────────── */

/**
 * Como terminou a leitura de um caderno.
 *
 * - `escrito`: um motor escreveu, a conferência aprovou, e o texto vai para `gravar`.
 * - `nao-escrito`: é o piso — com a causa e a trilha. Piso é ausência: não grava.
 * - `incompleto`: um motor escreveu e a conferência aprovou, mas a resposta não
 *   disse quantos tokens gastou. Zero é medida, e não se inventa: não grava.
 */
export type DesfechoDoCaderno =
  | { readonly tipo: 'escrito'; readonly leitura: LeituraDoMotor<string> }
  | { readonly tipo: 'nao-escrito'; readonly leitura: LeituraDoPiso }
  | { readonly tipo: 'incompleto'; readonly leitura: LeituraDoMotor<string>; readonly falta: 'tokens' };

export interface DesfechoNaImpressao {
  readonly caderno: CadernoId;
  readonly desfecho: DesfechoDoCaderno;
}

export type ResultadoDaImpressao<E> =
  /** Período em curso, ou o Total: nada foi buscado nem chamado. */
  | { readonly estado: 'aberto' }
  /** Nenhum caderno pedido tem o que dizer: nada foi buscado nem chamado. */
  | { readonly estado: 'sem-caderno' }
  /** Ninguém escreveu. `gravar` não foi chamada, e nada foi apagado. */
  | { readonly estado: 'nada-gravado'; readonly desfechos: readonly DesfechoNaImpressao[] }
  /** Ao menos um caderno escreveu, e o conjunto foi gravado numa chamada. */
  | { readonly estado: 'gravada'; readonly edicao: E; readonly desfechos: readonly DesfechoNaImpressao[] };

/* ── as opções ───────────────────────────────────────────────────────────── */

/** Sem descritor: ele não é escolha de quem imprime (ver o cabeçalho). */
export interface OpcoesDaImpressao extends Pick<OpcoesDeProduto, 'cadeia' | 'motorPara' | 'registrar' | 'agora'> {
  /**
   * Os cadernos a regenerar. Ausente: os quatro. Os outros já impressos ficam
   * como estão — só a ordem é recalculada sobre todos os que ficam. Vazia é
   * chamada errada, e lança antes de qualquer outra coisa.
   */
  readonly cadernos?: readonly CadernoId[];
  /**
   * Um caderno vai ser lido. `fila` são os cadernos que serão lidos nesta
   * impressão, na ordem em que serão lidos. Exceção aqui é engolida.
   */
  readonly aoComecar?: (caderno: CadernoId, fila: readonly CadernoId[]) => void;
  /** Um caderno terminou. Exceção aqui é engolida: o aviso não derruba a impressão. */
  readonly aoLer?: (caderno: CadernoId, desfecho: DesfechoDoCaderno) => void;
}

/* ── a porta ─────────────────────────────────────────────────────────────── */

/**
 * Imprime a edição de um período fechado, com o descritor da retrospectiva.
 *
 * Os casos em que rejeita — e nenhum deles é falha de motor — estão em
 * `imprimirCom` (`ia/imprimir-sequencia.ts`).
 */
export function imprimir<E>(
  entrada: EntradaPacote,
  portas: PortasDaImpressao<E>,
  opcoes: OpcoesDaImpressao,
): Promise<ResultadoDaImpressao<E>> {
  return imprimirCom(descritorDaRetrospectiva, entrada, portas, opcoes);
}
