/**
 * A impressão da edição — a porta que o hospedeiro chama (Story 1.10, AD-13 dos
 * motores).
 *
 * ```
 * imprimir(entrada, { buscar, gravar }, opcoes)
 *   → semana | aberto | sem-caderno | nada-gravado | gravada
 * ```
 *
 * Este arquivo é **a porta**: os tipos que o hospedeiro precisa para ligar as
 * suas portas (`buscar`, `gravar`) e ler o resultado, e `imprimir`, que é a
 * sequência com o descritor da retrospectiva **fixo**. A sequência em si mora em
 * `ia/imprimir-sequencia.ts` — e a razão da separação é o que ela protege.
 *
 * Desde a 1.11 a porta responde também a pergunta da tela — **quais cadernos têm o
 * que dizer** (`cadernosComDado`) —, porque quem decide isso na impressão é o
 * núcleo, e a tela não pode ter uma segunda resposta.
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
import { CADERNO_IDS, type CadernoId } from '../period/cadernos';
import type { CONCLUSAO } from './motor';
import type { LeituraDoMotor, LeituraDoPiso, OpcoesDeProduto } from './orquestrar';
import {
  cadernoVazio,
  lapideDoPeriodo,
  montarPacotes,
  type EntradaPacote,
  type FatoLapide,
  type PacoteDeFatos,
} from './pacote';
import { descritorDaRetrospectiva } from './retrospectiva';
import { comCoberturaDoSono, imprimirCom } from './imprimir-sequencia';

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
  /**
   * **A semana não grava edição** (contrato do Épico 2, Story 3.1): ela é o
   * postal da Retrospectiva, calculado na hora a cada abertura.
   *
   * Estado próprio, e não `aberto`: uma semana fechada *fechou*, e dizer que ela
   * está em curso mentiria para quem lê o desfecho — o script anunciaria "não
   * fechou para o núcleo" sobre a semana de agosto, e quem depurasse procuraria
   * um erro de relógio que não existe. São duas recusas diferentes, e cada uma
   * diz o que é.
   *
   * **A recusa é do núcleo, e não da tela.** Cinco semanas foram gravadas por
   * `/revista/semana/…` antes de alguém fechar esta porta: nada na rota conferia
   * o tipo. Fechá-la aqui é o que garante que a próxima tela a chamar a
   * impressão não a reabra. Nada é buscado, nada é chamado e nada é gravado.
   */
  | { readonly estado: 'semana' }
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

/**
 * Os cadernos deste período que têm o que dizer, **na ordem do catálogo** — a
 * pergunta que a tela da revista faz para saber quais seções existem (Story 1.11).
 *
 * **Quem sabe é o núcleo, e pela mesma régua da impressão.** Os pacotes saem de
 * `montarPacotes` com a cobertura de noites do Sono que a sequência deriva
 * (`comCoberturaDoSono`), e o vazio é `cadernoVazio` — o dono único que também
 * tira o caderno da fila da impressão. Uma tela que decidisse "tem dado" por conta
 * própria mostraria o convite de escrever um caderno que a impressão pula, ou
 * esconderia um que ela lê.
 *
 * **Sem ranqueamento.** A ordem é a do catálogo (`CADERNO_IDS`), que é a ordem
 * dos cadernos sem linha no miolo. A ordem dos impressos é a coluna `posicao`,
 * que congelou na impressão e que nenhuma tela recalcula — por isso esta função
 * não chama `ordenarCadernos`, e a barreira do ranqueamento continua sem ofensor.
 *
 * Não olha o relógio: período em curso e Total também têm cadernos com dado. Quem
 * decide se há edição é o estado lido (`buscarEdicao`), não esta pergunta.
 */
export function cadernosComDado(entrada: EntradaPacote): CadernoId[] {
  return pacotesComDado(entrada).map((p) => p.caderno);
}

/**
 * Os **pacotes** dos cadernos que têm o que dizer, na mesma ordem e pela mesma
 * régua de {@link cadernosComDado} — os fatos que a impressão levaria a cada um.
 *
 * Existe porque há quem precise do *o quê*, e não só do *quais*: a bancada dos
 * motores (spike 22/09) mede a Retrospectiva chamando o `ler` **um pacote por
 * caderno**, e o pacote é a entrada do descritor. Sem esta porta o app teria de
 * importar `montarPacotes`, que a guarda (7) do `architecture.test.ts` lhe fecha
 * — e com razão: a cobertura de noites do Sono e a régua do vazio passariam a
 * existir duas vezes, a segunda numa tela.
 *
 * `cadernosComDado` virou a projeção desta função para as duas nunca discordarem
 * sobre quem tem dado: era o risco real de acrescentar uma segunda travessia dos
 * pacotes ao lado da primeira.
 */
export function pacotesComDado(entrada: EntradaPacote): readonly PacoteDeFatos[] {
  const comDado = new Map(
    montarPacotes(comCoberturaDoSono(entrada))
      .filter((p) => !cadernoVazio(p))
      .map((p) => [p.caderno, p] as const),
  );
  return CADERNO_IDS.flatMap((c) => {
    const p = comDado.get(c);
    return p === undefined ? [] : [p];
  });
}

/**
 * Uma lápide como a edição a desenha: a métrica, a data da última medida e **em
 * qual dos dois estados** ela aparece.
 *
 * `doPeriodo` é a diferença visual inteira (Story 1.12): a lápide do período em
 * que a métrica morreu vai ao **topo** do caderno, num degrau de corpo de letra;
 * as outras ficam no **pé**, no corpo normal. Não há terceiro estado.
 */
export interface LapideNaEdicao extends FatoLapide {
  /** A morte aconteceu **neste** período — agosto/2026 para os anéis, e nunca mais. */
  readonly doPeriodo: boolean;
}

/** As lápides de cada caderno. Sempre os quatro; sem lápide é lista vazia, não ausência. */
export type LapidesPorCaderno = Readonly<Record<CadernoId, readonly LapideNaEdicao[]>>;

/**
 * As lápides desta edição, por caderno — a segunda pergunta que a tela da revista
 * faz ao núcleo (Story 1.12).
 *
 * **Pela mesma régua da impressão, e por isso vem da porta.** `lapideDoPeriodo`,
 * `montarPacotes` e `LAPIDES` decidem *juntos* quem morreu neste período: o mapa
 * diz de que caderno é cada métrica, a montagem descarta a morte **posterior** ao
 * fim (em julho os anéis de 17/08 ainda estavam vivos) e ordena por data, e o
 * predicado separa a do período das antigas. Repetir essa régua na tela criaria
 * uma segunda resposta — e a guarda (7) proíbe a tela de importar as peças.
 *
 * **Ordenadas por data**, e no mesmo dia pela ordem do catálogo: a resposta é
 * função do conjunto de lápides, não da ordem em que o chamador as listou.
 *
 * **Entrada malformada explode** — métrica fora do catálogo, data que não é dia
 * de calendário, lápide repetida. É a mesma recusa que a impressão daria, e quem
 * chama da tela a engole (`lapidesDaEntrada`, no celular) e desenha o caderno sem
 * lápide.
 *
 * Não olha o relógio, como `cadernosComDado`: o período em curso também tem
 * lápide, e quem decide se há edição é o estado lido.
 */
export function lapidesDosCadernos(entrada: EntradaPacote): LapidesPorCaderno {
  // **Anotação, e não `as`** — isto é barreira, não estilo. Com `as ...` um
  // caderno novo em `CadernoId` compilaria com a chave faltando aqui, e o
  // `out[p.caderno].push` abaixo estouraria em runtime, na tela, com um "cannot
  // read properties of undefined". Anotado, a falta vira erro de compilação no
  // mesmo commit que acrescenta o caderno.
  const out: Record<CadernoId, LapideNaEdicao[]> = { sono: [], movimento: [], coracao: [], rotina: [] };
  for (const p of montarPacotes(comCoberturaDoSono(entrada))) {
    for (const l of p.lapides) {
      out[p.caderno].push({ ...l, doPeriodo: lapideDoPeriodo(l, p.periodo) });
    }
  }
  return out;
}
