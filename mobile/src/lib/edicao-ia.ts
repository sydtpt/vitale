/**
 * A edição da Retrospectiva no celular: a leitura do que está impresso, a
 * impressão pelo núcleo, e o vocabulário que a rota da revista usa para dizer por
 * que um caderno não saiu.
 * Spec: docs/specs/ia-analitica/spec.md · ADRs 0038 e 0040 · Stories 1.9, 1.10 e 1.11.
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
import {
  MESES_ABREV,
  MESES_COMPLETOS,
  NUVEM_PADRAO,
  cadernosComDado,
  descritorDaRetrospectiva,
  fetchEdicao,
  imprimir,
  localDateStr,
  offsetDoInicio,
  periodBounds,
  periodLabel,
  periodoFechado,
  portasDaEdicao,
  resolverCadeia,
  temEdicao,
  type CadernoId,
  type Causa,
  type DesfechoDoCaderno,
  type Edicao,
  type EntradaPacote,
  type EventoDoAnel,
  type Motor,
  type MotorId,
  type PeriodKind,
  type PortasDaImpressao,
  type ResultadoDaImpressao,
  type TipoComEdicao,
} from '@vitale/shared';
import { motivoDaFalha, quemNaoEscreveu } from './assinatura';
import { motorPara } from './motores';
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
  /** A edição do período — vazia quando ele fechou e ainda não foi escrito. */
  | { estado: 'ok'; edicao: Edicao };

/**
 * Os cadernos já impressos deste período, na ordem gravada.
 *
 * A ausência é resolvida **antes** da consulta: não há linha para achar, e gastar
 * uma ida ao banco para descobrir isso seria uma consulta por folheada.
 *
 * A chave sai de `resumo.{kind,startISO,endISO}` — os mesmos três campos que
 * `montarPacotes` copia para `periodo`, sem normalizar nada. A equivalência está
 * fixada em `ia/pacote.test.ts`: se um dia a montagem normalizar, é lá que
 * reprova, e não aqui, calado, com a edição sumindo da tela.
 */
export async function buscarEdicao(
  userId: string, entrada: EntradaPacote,
): Promise<LeituraDaEdicao> {
  const { kind, startISO, endISO } = entrada.resumo;
  if (!temEdicao(kind)) return { estado: 'ausente' };
  if (!periodoFechado(kind, endISO, entrada.agora)) return { estado: 'ausente' };
  const edicao = await fetchEdicao(supabase, userId, kind, startISO, endISO);
  return { estado: 'ok', edicao };
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
  /** Os ids que o app conhece — disponíveis ou não. */
  readonly catalogo: readonly string[];
}

function depsDoApp(userId: string): DepsDaImpressao {
  return {
    portas: portasDaEdicao(supabase, userId),
    // A mesma fila de chamadas da `/sono/saude`: uma chamada de nuvem por vez.
    motorPara,
    registrar: anel.registrar,
    agora: () => new Date(),
    lerPreferencia: () => lerPreferencia(descritorDaRetrospectiva.recurso),
    catalogo: idsConhecidos,
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
  const cadeia = resolverCadeia(descritorDaRetrospectiva, await d.lerPreferencia(), d.catalogo);
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

/** `YYYY-MM-DD` → a meia-noite local daquele dia. */
function diaLocal(inicio: string): Date {
  return new Date(`${inicio}T00:00:00`);
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
 * O período como a revista o escreve — `"Agosto de 2026"` —, no cabeçalho da rota
 * e na capa em papel.
 *
 * O mês ganha o "de" da proposta aprovada; semana, estação e ano ficam com o
 * rótulo da Retrospectiva (`periodLabel`), para o leitor reconhecer o período que
 * acabou de deixar.
 */
export function rotuloDaEdicao(tipo: TipoComEdicao, inicio: string): string {
  const d = diaLocal(inicio);
  if (tipo === 'month') return `${MESES_COMPLETOS[d.getMonth()]} de ${d.getFullYear()}`;
  return periodLabel(tipo, d);
}

/**
 * O período curto, para a miniatura em papel da porta — `"ago 2026"`. Semana,
 * estação e ano já são curtos no rótulo da Retrospectiva.
 */
export function rotuloCurtoDaEdicao(tipo: TipoComEdicao, inicio: string): string {
  const d = diaLocal(inicio);
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
