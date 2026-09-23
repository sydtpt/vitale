/**
 * A edição da Retrospectiva no celular: a leitura do que está impresso, a
 * impressão pelo núcleo, o carimbo e a troca da capa, e o vocabulário que a rota
 * da revista usa para dizer por que um caderno não saiu.
 * Spec: docs/specs/ia-analitica/spec.md · ADRs 0038 e 0040 · Stories 1.9, 1.10, 1.11, 1.13 e 1.16.
 *
 * ## Ler é de graça; imprimir é ato do dono
 *
 * `buscarEdicao` só lê, e abrir a Retrospectiva ou a rota da revista nunca escreve
 * — senão folhear seis meses dispararia seis chamadas pagas. `imprimirEdicao` é o
 * toque em "Escrever a edição" ou num botão de caderno, e só ele chama modelo.
 *
 * ## A sequência não mora aqui
 *
 * Quem monta os pacotes, ordena os cadernos, chama o orquestrador uma vez por
 * caderno e grava o conjunto numa chamada é `imprimir` (`ia/imprimir.ts`, no
 * núcleo). Este arquivo só **liga as portas** do app a ela: o cliente do banco
 * (`portasDaEdicao`), o motor (`motorPara`), o anel, o relógio e a cadeia que a
 * preferência deste aparelho resolve. Nada aqui monta pedido, confere texto,
 * ordena caderno ou nomeia a função do banco — há barreira no
 * `architecture.test.ts` para cada uma dessas coisas.
 */
import type { Ionicons } from '@expo/vector-icons';
import {
  LAPIDES,
  MESES_ABREV,
  MESES_COMPLETOS,
  NUVEM_PADRAO,
  atividadesDoPeriodo,
  cadernosComDado,
  capaTrocada,
  cidadesDoPeriodo,
  descritorDaRetrospectiva,
  escolherCapa,
  fetchCapa,
  fetchEdicao,
  fetchPhotosForActivities,
  gravarCapa,
  imprimir,
  lapidesDosCadernos,
  localDateAt,
  localDateStr,
  offsetDoInicio,
  periodBounds,
  periodLabel,
  periodoFechado,
  portasDaEdicao,
  resolverCadeia,
  rotuloDaEdicao,
  secoesDoSeletor,
  temEdicao,
  type Activity,
  type ActivityPhoto,
  type CadernoId,
  type Capa,
  type CapaACarimbar,
  type Causa,
  type DesfechoDoCaderno,
  type Edicao,
  type EntradaPacote,
  type EventoDoAnel,
  type LapidesPorCaderno,
  type MetricaComLapide,
  type Motor,
  type MotorId,
  type PeriodKind,
  type PortasDaImpressao,
  type ResultadoDaImpressao,
  type SecaoDoSeletor,
  type TipoComEdicao,
} from '@vitale/shared';
import { useActivitiesStore } from '../store/activities.store';
import { motivoDaFalha, quemNaoEscreveu } from './assinatura';
import { catalogoDoRecurso, motorPara } from './motores';
import { anel } from './motores/anel';
import { idsConhecidos, nomeDoMotor } from './motores/catalogo';
import { lerPreferencia } from './motores/preferencia';
import { supabase } from './supabase';

export type LeituraDaEdicao =
  /**
   * Não há edição a mostrar, e não haverá agora — **é ausência, não pendência**.
   *
   * Duas razões caem aqui de propósito, porque a tela faz a mesma coisa com as
   * duas (nada):
   *
   * - **período em curso**: um jornal não anuncia a edição que ainda não fechou;
   * - **período que nunca tem edição**: o Total não fecha nunca, e o CHECK de
   *   `tipo_periodo` o recusa. Dizer "fechou e não foi escrito" nele seria
   *   prometer uma edição que o banco não aceita.
   */
  | { estado: 'ausente' }
  /**
   * A edição do período — vazia quando ele fechou e ainda não foi escrito.
   *
   * `capa` é o que a impressão carimbou (Story 1.13), ou `null`: edição impressa
   * antes da 1.13, carimbo que falhou, ou período ainda não escrito. A tela
   * desenha a capa em papel da 1.11 em todos esses casos.
   */
  | { estado: 'ok'; edicao: Edicao; capa: Capa | null };

/**
 * Os cadernos já impressos deste período, na ordem gravada — e a capa carimbada.
 *
 * A ausência é resolvida **antes** da consulta: não há linha para achar, e gastar
 * uma ida ao banco para descobrir isso seria uma consulta por folheada.
 *
 * A chave sai de `resumo.{kind,startISO,endISO}` — os mesmos três campos que
 * `montarPacotes` copia para `periodo`, sem normalizar nada. A equivalência está
 * fixada em `ia/pacote.test.ts`: se um dia a montagem normalizar, é lá que
 * reprova, e não aqui, calado, com a edição sumindo da tela.
 *
 * **As duas consultas correm juntas, e a da capa não pode derrubar a da edição.**
 * A edição é o produto; a capa é como ele se apresenta. Uma falha ao ler
 * `edicoes_capa` vira `capa: null` com o motivo no log — a rota desenha a capa em
 * papel e o texto continua lá —, enquanto uma falha ao ler `edicoes_ia` continua
 * subindo: sem ela não há o que mostrar.
 */
export async function buscarEdicao(
  userId: string, entrada: EntradaPacote,
): Promise<LeituraDaEdicao> {
  const { kind, startISO, endISO } = entrada.resumo;
  if (!temEdicao(kind)) return { estado: 'ausente' };
  if (!periodoFechado(kind, endISO, entrada.agora)) return { estado: 'ausente' };
  const [edicao, capa] = await Promise.all([
    fetchEdicao(supabase, userId, kind, startISO, endISO),
    fetchCapa(supabase, userId, kind, startISO, endISO).catch((e: unknown) => {
      // **A mensagem vai para o log, não só o objeto.** As duas falhas possíveis
      // aqui pedem trabalhos diferentes: uma rede que caiu se resolve sozinha, e
      // uma `natureza` que o `toCapa` recusou é linha estragada no banco — algo
      // que o `CHECK` afirma impossível. Engolir as duas como "falha ao ler"
      // esconderia a segunda atrás da primeira.
      console.warn(
        '[revista] a capa não foi lida (a edição segue em papel):',
        e instanceof Error ? e.message : String(e),
      );
      return null;
    }),
  ]);
  return { estado: 'ok', edicao, capa };
}

/* ── o carimbo da capa (Story 1.13) ──────────────────────────────────────── */

/**
 * As três peças da escolha da capa — **do núcleo desde a Story 2.3**
 * (`packages/shared/src/revista/capa.ts`), reexportadas daqui porque é por este
 * módulo que as telas da revista as alcançam.
 *
 * Elas subiram porque o script da impressão em massa carimba a mesma capa que o
 * telefone carimbaria: a seleção das atividades do período, o acervo de cidades
 * da legenda e o rótulo por extenso da natureza `grade` são a mesma regra nos
 * dois hospedeiros, e uma segunda cópia aqui seria a capa do Mac divergindo da
 * do iPhone no dia em que uma das duas mudasse. O comportamento não mudou.
 */
export { atividadesDoPeriodo, cidadesDoPeriodo, rotuloDaEdicao };

/**
 * As portas do carimbo. Injetáveis, para a escolha ter teste sem rede.
 *
 * A gravação se chama `carimbar`, e **não `gravar`**: `.gravar` é a porta de
 * escrita da EDIÇÃO, e uma barreira do `architecture.test.ts` cobra que só a
 * sequência da impressão a leia. Reusar o nome aqui contaria como um segundo
 * caminho até o texto do jornal, que é exatamente o que ela existe para impedir.
 */
export interface DepsDoCarimbo {
  /**
   * As atividades **visíveis** — `activities()`, não `_all`.
   *
   * O dono esconde atividade (`hidden`), e o que ele escondeu não escolhe a capa
   * nem vira o traçado do período. Em toda outra tela o efeito de esconder é
   * imediato e reversível; aqui ele ficaria **carimbado**, e desfazer exigiria
   * reimprimir a edição inteira.
   */
  readonly atividades: () => readonly Activity[];
  /**
   * O acervo de atividades já chegou? Nada se carimba antes disso — ver
   * {@link carimbarCapa}.
   */
  readonly acervoCarregado: () => boolean;
  readonly buscarFotos: (ids: readonly string[]) => Promise<ActivityPhoto[]>;
  readonly carimbar: (capa: CapaACarimbar) => Promise<Capa>;
  /** O período por extenso — a legenda da natureza `grade`. */
  readonly rotulo: (tipo: TipoComEdicao, inicio: string) => string;
}

function depsDoCarimbo(userId: string): DepsDoCarimbo {
  return {
    atividades: () => useActivitiesStore.getState().activities(),
    acervoCarregado: () => useActivitiesStore.getState().loaded,
    buscarFotos: (ids) => fetchPhotosForActivities(supabase, userId, ids),
    carimbar: (capa) => gravarCapa(supabase, userId, capa),
    rotulo: rotuloDaEdicao,
  };
}

/**
 * Escolhe e carimba a capa desta edição.
 *
 * Quem chama é a impressão **inteira**, sempre, e a **parcial quando a edição
 * ainda não tem capa nenhuma** (renegociado com o dono em 17/09): uma edição
 * montada caderno a caderno nunca volta a ver o alvo `edicao` — a 1.11 só o
 * oferece com zero cadernos impressos —, e sem essa regra ela ficaria em papel
 * para sempre, sem conserto. Uma parcial **nunca troca capa existente**: a foto e
 * a legenda são do período, não do caderno, e o que uma parcial pode mover na capa
 * é só a manchete, que continua derivada do caderno em `posicao` 1.
 *
 * **Nunca rejeita.** Carimbar não é atômico com a impressão (decisão do dono,
 * 17/09: ensinar `edicao_imprimir` a receber capa seria migração em produção), e
 * o preço está declarado — se falhar, a edição existe sem capa, o motivo vai para
 * o log e a próxima impressão recarimba. O que não pode acontecer é uma falha de
 * capa apagar o texto que o modelo acabou de escrever, ou anunciar ao dono uma
 * impressão que não terminou quando ela terminou.
 *
 * **Não carimba sobre acervo que não chegou.** Uma store vazia não é um período
 * vazio: pode ser a carga das atividades ainda em voo, ou uma que falhou. Carimbar
 * ali gravaria `grade` — a capa do período em que nada aconteceu — num agosto
 * cheio de pedaladas, e a natureza está congelada: só uma impressão nova a
 * corrige. Não saber é motivo para não gravar, e a degradação (sem capa, log,
 * recarimba depois) já está declarada no contrato.
 *
 * Devolve `null` quando não carimbou — por ausência de período com edição, por
 * acervo não carregado, ou por falha já registrada.
 */
export async function carimbarCapa(
  userId: string,
  entrada: EntradaPacote,
  deps: Partial<DepsDoCarimbo> = {},
): Promise<Capa | null> {
  const d: DepsDoCarimbo = { ...depsDoCarimbo(userId), ...deps };
  const { kind, startISO, endISO } = entrada.resumo;
  if (!temEdicao(kind)) return null;
  if (!d.acervoCarregado()) {
    console.warn(
      '[revista] a capa não foi carimbada: o acervo de atividades ainda não chegou, '
      + 'e uma store vazia não é um período vazio.',
    );
    return null;
  }
  try {
    const atividades = atividadesDoPeriodo(d.atividades(), entrada);
    const fotos = atividades.length > 0
      ? await d.buscarFotos(atividades.map((a) => a.id))
      : [];
    return await d.carimbar(escolherCapa({
      fotos,
      atividades,
      cidades: cidadesDoPeriodo(atividades),
      periodo: { tipoPeriodo: kind, inicio: startISO, fim: endISO, rotulo: d.rotulo(kind, startISO) },
    }));
  } catch (e) {
    console.warn('[revista] a capa não foi carimbada; a edição fica sem capa:', e);
    return null;
  }
}

/* ── a troca da capa (Story 1.16) ────────────────────────────────────────── */

/**
 * A troca (ou a lista dela) foi recusada **antes do banco** — nada foi gravado.
 *
 * A mensagem é a frase da tela: a troca é ato do dono e falha em voz alta, então
 * o seletor a mostra como veio. As recusas da própria foto (vídeo, instante,
 * desligada, sem arquivo) são do núcleo (`FotoRecusadaNaTroca`); estas são as que
 * só o app sabe dizer — o período e o acervo.
 */
export class TrocaRecusada extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'TrocaRecusada';
  }
}

const SEM_EDICAO = 'Este período não tem edição, e por isso não tem capa.';
/**
 * Mesma guarda do carimbo, pelo mesmo motivo: uma store vazia não é um período
 * vazio. Aqui ela não grava `grade` — mas recusaria, como "fora do período", a
 * foto que o dono acabou de escolher.
 */
const SEM_ACERVO = 'As atividades ainda não chegaram. Tente de novo em instantes.';
const FORA_DO_PERIODO = 'Esta foto não é de uma atividade deste período, e não pode ser a capa dele.';

/**
 * As fotos que podem ir para a capa desta edição, **agrupadas por atividade** —
 * a lista do seletor.
 *
 * Reusa as portas do carimbo, e com elas a **mesma** definição de "do período"
 * (`atividadesDoPeriodo` sobre as atividades visíveis): o seletor mostra o que a
 * troca aceita, e a troca aceita o que a impressão teria considerado. Quem agrupa,
 * ordena e recusa vídeo é o núcleo (`secoesDoSeletor`).
 *
 * **Só lê.** Rejeita quando o período não tem edição, quando o acervo de
 * atividades ainda não chegou (`TrocaRecusada`) ou quando a leitura das fotos
 * falha — o seletor mostra o erro, e não uma lista vazia que mentiria "não há
 * foto".
 */
export async function fotosParaCapa(
  userId: string,
  entrada: EntradaPacote,
  deps: Partial<DepsDoCarimbo> = {},
): Promise<SecaoDoSeletor[]> {
  const d: DepsDoCarimbo = { ...depsDoCarimbo(userId), ...deps };
  if (!temEdicao(entrada.resumo.kind)) throw new TrocaRecusada(SEM_EDICAO);
  if (!d.acervoCarregado()) throw new TrocaRecusada(SEM_ACERVO);
  const atividades = atividadesDoPeriodo(d.atividades(), entrada);
  if (atividades.length === 0) return [];
  const fotos = await d.buscarFotos(atividades.map((a) => a.id));
  return secoesDoSeletor(fotos, atividades);
}

/**
 * Troca a capa desta edição pela foto que o dono escolheu — e **só a capa**.
 *
 * Pela **mesma porta** do carimbo (`carimbar` → `gravarCapa`, upsert pela chave da
 * edição): identidade nova, legenda recalculada com as cidades do período, motivo
 * `trocada` e `carimbada_em` novo. O texto, a ordem, as assinaturas, a errata e a
 * manchete são de `edicoes_ia`, e nada aqui os toca.
 *
 * **Ao contrário de {@link carimbarCapa}, rejeita** — a troca é ato do dono e
 * falha em voz alta. Recusa antes do banco o período sem edição, o acervo que não
 * chegou e a foto de atividade fora do período (`TrocaRecusada`), e a foto que o
 * núcleo não aceita como capa (`FotoRecusadaNaTroca`); e propaga a falha da
 * gravação como veio.
 */
export async function trocarCapa(
  userId: string,
  entrada: EntradaPacote,
  foto: ActivityPhoto,
  deps: Partial<DepsDoCarimbo> = {},
): Promise<Capa> {
  const d: DepsDoCarimbo = { ...depsDoCarimbo(userId), ...deps };
  const { kind, startISO, endISO } = entrada.resumo;
  if (!temEdicao(kind)) throw new TrocaRecusada(SEM_EDICAO);
  if (!d.acervoCarregado()) throw new TrocaRecusada(SEM_ACERVO);
  const atividades = atividadesDoPeriodo(d.atividades(), entrada);
  if (!atividades.some((a) => a.id === foto.activityId)) throw new TrocaRecusada(FORA_DO_PERIODO);
  const capa = capaTrocada(
    { tipoPeriodo: kind, inicio: startISO, fim: endISO, rotulo: d.rotulo(kind, startISO) },
    foto,
    cidadesDoPeriodo(atividades),
  );
  return d.carimbar(capa);
}

/**
 * O título da capa aberta e do seletor — `"A capa de julho de 2026"`.
 *
 * O mês entra em minúscula, como se escreve no meio da frase; semana, estação e ano
 * ficam com o rótulo da edição (`"A capa de Q3 2026"`), que não tem minúscula
 * a dar.
 */
export function tituloDaCapa(tipo: TipoComEdicao, inicio: string): string {
  const d = localDateAt(inicio);
  if (tipo === 'month') return `A capa de ${MESES_COMPLETOS[d.getMonth()].toLowerCase()} de ${d.getFullYear()}`;
  return `A capa de ${rotuloDaEdicao(tipo, inicio)}`;
}

/* ── a impressão ─────────────────────────────────────────────────────────── */

/** O que a tela quer saber durante a impressão — caderno a caderno. */
export interface AvisosDaImpressao {
  readonly aoComecar?: (caderno: CadernoId, fila: readonly CadernoId[]) => void;
  readonly aoLer?: (caderno: CadernoId, desfecho: DesfechoDoCaderno) => void;
}

/** Os avisos, e o que imprimir. */
export interface PedidoDeImpressao extends AvisosDaImpressao {
  /**
   * Os cadernos a regenerar — `[c]` é "escrever este caderno de novo". Ausente: a
   * edição inteira. Os outros cadernos já impressos ficam como estão e não são
   * reassinados; a ordem do conjunto é recalculada pela função do banco, nunca
   * aqui.
   */
  readonly cadernos?: readonly CadernoId[];
}

/** As portas do app. Injetáveis, para a ligação ter teste sem rede. */
export interface DepsDaImpressao {
  readonly portas: PortasDaImpressao<Edicao>;
  readonly motorPara: (id: MotorId) => Motor | undefined;
  readonly registrar: (evento: EventoDoAnel) => void;
  readonly agora: () => Date;
  /** A escolha do dono para a Retrospectiva, neste aparelho, ou `null`. Nunca lança. */
  readonly lerPreferencia: () => Promise<MotorId | null>;
  /**
   * Os ids que o app conhece — disponíveis ou não. **Nunca lança**, como
   * `lerPreferencia`: quem não puder cumprir isso devolve o catálogo estático.
   *
   * Função assíncrona desde a 5.6: parte do catálogo é a lista de motores de
   * nuvem aprovados, que vem do servidor (ADR 0048) e não existe antes de alguém
   * perguntar.
   */
  readonly catalogo: () => Promise<readonly string[]>;
}

function depsDoApp(userId: string): DepsDaImpressao {
  return {
    portas: portasDaEdicao(supabase, userId),
    // A mesma fila de chamadas da `/sono/saude`: uma chamada de nuvem por vez.
    motorPara,
    registrar: anel.registrar,
    agora: () => new Date(),
    lerPreferencia: () => lerPreferencia(descritorDaRetrospectiva.recurso),
    catalogo: () => catalogoDoRecurso(descritorDaRetrospectiva.recurso),
  };
}

/**
 * Imprime a edição deste período: a cadeia pela preferência do aparelho, e a
 * sequência do núcleo com as portas do app.
 *
 * Rejeita quando uma porta falha (ler ou gravar no banco) ou quando uma função
 * pura do núcleo lança; falha de motor não rejeita — vira desfecho do caderno.
 */
export async function imprimirEdicao(
  userId: string,
  entrada: EntradaPacote,
  pedido: PedidoDeImpressao = {},
  deps: Partial<DepsDaImpressao> = {},
): Promise<ResultadoDaImpressao<Edicao>> {
  const d: DepsDaImpressao = { ...depsDoApp(userId), ...deps };
  // A rede das duas leituras: o contrato diz "nunca lança", mas a impressão já
  // avisou a tela que começou (`aoComecar`), e uma rejeição aqui a deixaria em
  // "imprimindo" para sempre. O catálogo estático é sempre um desfecho seguro —
  // `resolverCadeia` trata a preferência ausente como o padrão do recurso.
  const [preferencia, catalogo] = await Promise.all([
    d.lerPreferencia().catch(() => null),
    d.catalogo().catch(() => idsConhecidos),
  ]);
  const cadeia = resolverCadeia(descritorDaRetrospectiva, preferencia, catalogo);
  return imprimir(entrada, d.portas, {
    cadeia,
    motorPara: d.motorPara,
    registrar: d.registrar,
    agora: d.agora,
    ...(pedido.cadernos ? { cadernos: pedido.cadernos } : {}),
    ...(pedido.aoComecar ? { aoComecar: pedido.aoComecar } : {}),
    ...(pedido.aoLer ? { aoLer: pedido.aoLer } : {}),
  });
}

/** Quantos problemas da conferência a tela mostra — os primeiros; o resto fica no anel. */
export const PROBLEMAS_NA_TELA = 3;

/**
 * Por que um caderno não saiu, em palavras — ou `null`, quando saiu.
 *
 * O motivo é o mesmo idioma da assinatura da Saúde do sono (`motivoDaFalha`), com
 * dois acréscimos que só a revista tem:
 *
 * - **preferencia**: `motivoDaFalha` devolve nulo ("nada falhou"), mas aqui algo
 *   deixou de sair: a escolha deste aparelho não escreve a revista, que não
 *   imprime sem modelo;
 * - **incompleto**: o motor escreveu e a conferência aprovou, mas a resposta não
 *   disse quanto gastou — zero é medida, e não se inventa.
 *
 * **Só o motivo, sem os problemas da conferência** (desde a 1.11): a rota os
 * desenha em lista, um por linha, e colá-los na frase os mostraria duas vezes.
 * Eles saem por {@link problemasDoDesfecho}.
 */
export function naoImpressoDe(desfecho: DesfechoDoCaderno): string | null {
  switch (desfecho.tipo) {
    case 'escrito':
      return null;
    case 'incompleto':
      return `${nomeDoMotor(desfecho.leitura.motor)} escreveu, mas a resposta não disse quanto gastou, e o texto não foi guardado`;
    case 'nao-escrito': {
      const { causa, trilha } = desfecho.leitura;
      if (causa === 'preferencia') {
        return 'a escolha de motor deste aparelho para a Retrospectiva não escreve a revista';
      }
      // Trilha vazia sem ser por preferência é o pedido mudo, que não fala de motor
      // nenhum; nos outros casos, o motor é o último que tentou. A revista só admite
      // a nuvem, e é dela que o motivo fala quando a trilha não diz.
      return motivoDaFalha(causa, quemNaoEscreveu(trilha, NUVEM_PADRAO)) ?? 'não saiu';
    }
  }
}

/**
 * O que a conferência reprovou, em palavras — até {@link PROBLEMAS_NA_TELA}, da
 * última tentativa que os carrega. Vazio quando não houve conferência reprovando.
 *
 * É o **porquê** da reprovação, e é conteúdo: "não é erro do app, é a conferência
 * funcionando". O texto que o motor escreveu nunca aparece — só o detalhe que a
 * conferência escreveu sobre ele.
 */
export function problemasDoDesfecho(desfecho: DesfechoDoCaderno): string[] {
  if (desfecho.tipo !== 'nao-escrito') return [];
  const comProblemas = [...desfecho.leitura.trilha].reverse().find((t) => t.problemas && t.problemas.length > 0);
  return (comProblemas?.problemas ?? []).slice(0, PROBLEMAS_NA_TELA).map((p) => p.detalhe);
}

/**
 * Reprovado ou erro — ou `null`, quando o caderno saiu ou não tinha o que dizer
 * (decisão 3-b do dono, 16/09/2026).
 *
 * A diferença não é de cor, é de **ação**: a reprovação oferece "Escrever este
 * caderno de novo", o erro oferece "Tentar de novo".
 *
 * - **reprovada** — as seis causas **permanentes**: repetir o mesmo pedido não
 *   resolve nenhuma. `reprovada` é a conferência; `recusa-do-modelo`, `guarda` e
 *   `saida-invalida` são o motor dizendo não, ou dizendo o que não se lê;
 *   `capacidade` é "atende, mas não este pedido", e `janela` é "o pedido não
 *   cabe" — as duas eram erro até 16/09, e saíram dele porque o núcleo dos motores
 *   as classifica assim.
 * - **erro** — as duas **passageiras** (`indisponivel`, `transitoria`), e também
 *   `defeito`, `preferencia` e o desfecho `incompleto`: nenhum dos três é culpa do
 *   texto (são o app, a escolha do motor e a resposta sem contagem), e "Escrever
 *   este caderno de novo" sugeriria que é.
 * - **`mudo`**: não há o que um modelo acrescente — o caderno some.
 *
 * Exaustivo sobre `Causa` e **sem `default`**: uma causa nova no núcleo para de
 * compilar aqui, em vez de cair calada num dos dois lados.
 */
export function classeDoDesfecho(desfecho: DesfechoDoCaderno): 'reprovada' | 'erro' | null {
  switch (desfecho.tipo) {
    case 'escrito':
      return null;
    case 'incompleto':
      return 'erro';
    case 'nao-escrito':
      return classeDaCausa(desfecho.leitura.causa);
  }
}

function classeDaCausa(causa: Causa): 'reprovada' | 'erro' | null {
  switch (causa) {
    case 'reprovada':
    case 'recusa-do-modelo':
    case 'guarda':
    case 'saida-invalida':
    case 'capacidade':
    case 'janela':
      return 'reprovada';
    case 'indisponivel':
    case 'transitoria':
    case 'defeito':
    case 'preferencia':
      return 'erro';
    case 'mudo':
      return null;
  }
}

/**
 * A frase que a rota mostra no lugar do texto de um caderno que não saiu — ou
 * `null`, quando ele saiu ou some (`mudo`).
 *
 * As duas formas da proposta aprovada (quadros 2 e 3): a reprovação **da
 * conferência** diz que o texto foi descartado — e os problemas vêm embaixo, em
 * lista —; qualquer outra causa diz que o caderno não foi escrito e por quê, na
 * palavra da assinatura (`naoImpressoDe`). Nenhuma das duas mostra texto cru do
 * fornecedor: o detalhe da trilha fica no anel.
 */
export function fraseDoNaoImpresso(desfecho: DesfechoDoCaderno): string | null {
  if (classeDoDesfecho(desfecho) === null) return null;
  if (desfecho.tipo === 'nao-escrito' && desfecho.leitura.causa === 'reprovada') {
    return 'O texto não passou na conferência e foi descartado.';
  }
  return `O caderno não foi escrito: ${naoImpressoDe(desfecho)}.`;
}

/* ── a rota ──────────────────────────────────────────────────────────────── */

/** O tipo do período como a rota o escreve — em português, sem acento. */
export type SlugDoTipo = 'semana' | 'mes' | 'estacao' | 'ano';

const SLUG_DO_TIPO: Readonly<Record<TipoComEdicao, SlugDoTipo>> = Object.freeze({
  week: 'semana',
  month: 'mes',
  season: 'estacao',
  year: 'ano',
});

/** `month` → `mes`. Só os tipos que têm edição: o Total não tem rota. */
export function slugDoTipo(tipo: TipoComEdicao): SlugDoTipo {
  return SLUG_DO_TIPO[tipo];
}

/**
 * `mes` → `month`, ou `null` para o que não é tipo com edição — `total`, o nome
 * em inglês, a caixa trocada, vazio. A rota inválida mostra o cabeçalho e nada
 * mais; ela nunca adivinha o período.
 */
export function tipoDoSlug(slug: string | null | undefined): TipoComEdicao | null {
  for (const tipo of Object.keys(SLUG_DO_TIPO) as TipoComEdicao[]) {
    if (SLUG_DO_TIPO[tipo] === slug) return tipo;
  }
  return null;
}

/**
 * O endereço da rota da revista para um período — `/revista/mes/2026-08-01` —, ou
 * `null` quando o tipo não tem edição (o Total não tem rota).
 *
 * É o inverso de {@link periodoDaRota}: a porta da Retrospectiva monta o endereço
 * por aqui, e a rota o lê por lá. Não confere se o período fechou — a rota faz
 * isso, e mostra só o cabeçalho quando não.
 */
export function hrefDaRevista(kind: PeriodKind, inicio: string): `/revista/${SlugDoTipo}/${string}` | null {
  if (!temEdicao(kind)) return null;
  return `/revista/${slugDoTipo(kind)}/${inicio}`;
}

/** O período que o endereço da rota nomeia. */
export interface PeriodoDaRota {
  readonly tipo: TipoComEdicao;
  readonly inicio: string;
  readonly offset: number;
  readonly rotulo: string;
  /** Período em curso é `false`: a rota mostra o cabeçalho e nada mais. */
  readonly fechado: boolean;
}

/**
 * O período de `/revista/[tipo]/[inicio]` — ou `null`, e a rota é só o cabeçalho.
 *
 * `null` quando o tipo não tem edição (`total` não é tipo da revista) ou quando o
 * início não é o primeiro dia de um período daquele tipo. Nunca adivinha: um
 * `/revista/mes/2026-08-02` não vira agosto. O período em curso volta **com**
 * `fechado: false`, porque o cabeçalho ainda sabe dizer qual é — e a rota não
 * mostra nada abaixo dele, nem convite, nem botão.
 */
export function periodoDaRota(
  slug: string | null | undefined,
  inicio: string | null | undefined,
  now: Date,
): PeriodoDaRota | null {
  const tipo = tipoDoSlug(slug);
  if (tipo === null || typeof inicio !== 'string') return null;
  const offset = offsetDoInicio(now, tipo, inicio);
  if (offset === null) return null;
  const fim = periodBounds(now, tipo, offset).end;
  const fimISO = localDateStr(new Date(fim.getTime() - 1));
  return { tipo, inicio, offset, rotulo: rotuloDaEdicao(tipo, inicio), fechado: periodoFechado(tipo, fimISO, now) };
}

/**
 * O período curto, para a miniatura em papel da porta — `"ago 2026"`. Semana,
 * estação e ano já são curtos no rótulo da Retrospectiva.
 */
export function rotuloCurtoDaEdicao(tipo: TipoComEdicao, inicio: string): string {
  const d = localDateAt(inicio);
  if (tipo === 'month') return `${MESES_ABREV[d.getMonth()]} ${d.getFullYear()}`;
  return periodLabel(tipo, d);
}

/**
 * A data da assinatura de um caderno — `"07 set 2026"`, no dia local de quem lê.
 *
 * Montada à mão e não por `Intl`: o formato é o da proposta aprovada, e o
 * `pt-BR` do `Intl` escreve "07 de set. de 2026".
 */
export function dataDaAssinatura(geradoEm: string): string {
  const d = new Date(geradoEm);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')} ${MESES_ABREV[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * A assinatura de um caderno impresso — `"modelo-1 · 07 set 2026"`.
 *
 * Sem data que se leia, só o modelo: `"modelo · "` com o ponto pendurado leria
 * como uma data que sumiu, e o modelo sozinho continua dizendo quem escreveu.
 */
export function assinaturaDoCaderno(modelo: string, geradoEm: string): string {
  const data = dataDaAssinatura(geradoEm);
  return data ? `${modelo} · ${data}` : modelo;
}

/**
 * Quem tem o que dizer, para a tela e para as ações — a resposta do núcleo
 * (`cadernosComDado`), ou `null` quando não há resposta.
 *
 * `null` em dois casos, e os dois tiram todo botão de escrever: os dados da
 * Retrospectiva ainda não chegaram ("tem dado" sobre uma memória pela metade não é
 * resposta), ou o núcleo recusou a entrada (só uma lápide inválida faz isso — a
 * impressão recusaria o mesmo). A recusa vai para o log.
 *
 * Um lugar só para a rota e para a store: a ação confere com a mesma resposta que
 * desenhou o botão.
 */
export function comDadoDaEntrada(entrada: EntradaPacote, dadosProntos: boolean): readonly CadernoId[] | null {
  if (!dadosProntos) return null;
  try {
    return cadernosComDado(entrada);
  } catch (e) {
    console.warn('[revista] cadernosComDado recusou a entrada:', e);
    return null;
  }
}

/* ── os cadernos desenhados (Story 1.12) ─────────────────────────────────── */

/**
 * O ícone de cada caderno, dentro da faixa — **o segundo portador da
 * identidade**.
 *
 * A cor sozinha não basta: Movimento (laranja) e Coração (vermelho) medem ΔE 4,1
 * a 9,9 em cinco das seis paletas, e só a acessível os separa. O ícone resolve
 * essa colisão e resolve daltonismo no mesmo gesto — por isso ele não é
 * decoração, e por isso a faixa nunca é só cor + nome.
 *
 * Três vêm do `ICON_MAP` da Retrospectiva (`sleep`, `heart`, `habit`), pelos
 * mesmos glifos. O quarto é novo, e **com o viés declarado**: o mapa tem
 * `barbell-outline` para treino e `walk-outline` para distância, e nenhum dos
 * dois é o que Movimento majoritariamente é. A pedalada domina o acervo (555
 * atividades, 138 rotas com piso, 1.210 fotos), então `bicycle-outline` diz a
 * verdade sobre o caderno — e corrida e caminhada ficam sob ele. É uma escolha
 * de maioria, não de cobertura: se um dia a corrida virar o grosso do acervo, o
 * ícone muda com ela.
 */
export const ICONE_DO_CADERNO: Readonly<Record<CadernoId, keyof typeof Ionicons.glyphMap>> = Object.freeze({
  sono: 'moon-outline',
  movimento: 'bicycle-outline',
  coracao: 'heart-outline',
  rotina: 'checkmark-circle-outline',
});

/**
 * A frase da lápide, partida onde a família de fonte muda.
 *
 * `{nome} — última medida em DD/MM/AAAA.` — e a **data sai em mono**, porque é
 * carimbo de medida, do mesmo tipo da assinatura. A regra "número dentro de frase
 * continua serifado" vale para a prosa narrada; a lápide é registro.
 */
export interface FraseDaLapide {
  /** Tudo antes da data — `"anéis de atividade — última medida em "`. */
  readonly antes: string;
  /** A data, `DD/MM/AAAA`. Em mono na tela. */
  readonly data: string;
  /** O que fecha a frase: o ponto. */
  readonly depois: string;
  /** A frase inteira, numa linha — para teste e para quem não separa famílias. */
  readonly texto: string;
}

/**
 * `YYYY-MM-DD` → `DD/MM/AAAA`, **sem `Date`**.
 *
 * Um `new Date('2026-08-17')` é lido como meia-noite UTC e volta 16/08 em todo
 * fuso a oeste — a data da morte andaria um dia para quem lê em Brasília. A
 * lápide é um carimbo de calendário, não um instante: fatiar a string é a
 * operação certa, não um atalho.
 *
 * O que não tem a forma de um dia volta como veio: o núcleo já recusa data
 * impossível, e inventar aqui esconderia a recusa dele.
 */
function dataDaLapide(ultimaMedidaISO: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ultimaMedidaISO);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ultimaMedidaISO;
}

/**
 * A frase de uma lápide — o nome em prosa do catálogo (`LAPIDES`) e a data.
 *
 * **Nada de "verifique suas conexões".** Isso é conselho, e conselho está
 * proibido na revista; o alerta operacional vive em Conexões, com o tempo do
 * agora. A edição congela: em 2030 a de agosto/2026 ainda dirá que os anéis
 * pararam — o que como história está certo e como alerta seria ruído.
 */
export function fraseDaLapide(metrica: MetricaComLapide, ultimaMedidaISO: string): FraseDaLapide {
  const antes = `${LAPIDES[metrica].nome} — última medida em `;
  const data = dataDaLapide(ultimaMedidaISO);
  return { antes, data, depois: '.', texto: `${antes}${data}.` };
}

/** Nenhuma lápide, nos quatro cadernos — a resposta quando o núcleo recusa a entrada. */
const SEM_LAPIDE: LapidesPorCaderno = Object.freeze({
  sono: Object.freeze([]), movimento: Object.freeze([]),
  coracao: Object.freeze([]), rotina: Object.freeze([]),
});

/**
 * As lápides desta edição, por caderno — a resposta do núcleo
 * (`lapidesDosCadernos`), ou **tudo vazio** quando ele recusa a entrada.
 *
 * Mesmo molde de {@link comDadoDaEntrada}: só uma lápide inválida faz o núcleo
 * recusar (métrica fora do catálogo, data impossível, lápide repetida), a recusa
 * vai para o log e a rota **nunca cai** — o caderno é desenhado sem lápide. A
 * impressão recusaria a mesma entrada, e é lá que o erro tem de doer.
 *
 * Diferente do `comDadoDaEntrada`, não há estado "sem resposta": a lápide não
 * habilita botão nenhum, então o vazio é uma resposta legítima e não um `null`
 * que a tela tenha de tratar.
 */
export function lapidesDaEntrada(entrada: EntradaPacote): LapidesPorCaderno {
  try {
    return lapidesDosCadernos(entrada);
  } catch (e) {
    console.warn('[revista] lapidesDosCadernos recusou a entrada:', e);
    return SEM_LAPIDE;
  }
}
