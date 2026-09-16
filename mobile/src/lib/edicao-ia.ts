/**
 * A edição da Retrospectiva no celular: a leitura do que está impresso, e a
 * impressão pelo núcleo.
 * Spec: docs/specs/ia-analitica/spec.md · ADRs 0038 e 0040 · Stories 1.9 e 1.10.
 *
 * ## Ler é de graça; imprimir é ato do dono
 *
 * `buscarEdicao` só lê, e abrir a Retrospectiva nunca escreve — senão folhear seis
 * meses dispararia seis chamadas pagas. `imprimirEdicao` é o toque em "Escrever a
 * edição", e só ele chama modelo.
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
  NUVEM_PADRAO,
  descritorDaRetrospectiva,
  fetchEdicao,
  imprimir,
  periodoFechado,
  portasDaEdicao,
  resolverCadeia,
  temEdicao,
  type CadernoId,
  type DesfechoDoCaderno,
  type Edicao,
  type EntradaPacote,
  type EventoDoAnel,
  type Motor,
  type MotorId,
  type PortasDaImpressao,
  type ResultadoDaImpressao,
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
  avisos: AvisosDaImpressao = {},
  deps: Partial<DepsDaImpressao> = {},
): Promise<ResultadoDaImpressao<Edicao>> {
  const d: DepsDaImpressao = { ...depsDoApp(userId), ...deps };
  const cadeia = resolverCadeia(descritorDaRetrospectiva, await d.lerPreferencia(), d.catalogo);
  return imprimir(entrada, d.portas, {
    cadeia,
    motorPara: d.motorPara,
    registrar: d.registrar,
    agora: d.agora,
    ...(avisos.aoComecar ? { aoComecar: avisos.aoComecar } : {}),
    ...(avisos.aoLer ? { aoLer: avisos.aoLer } : {}),
  });
}

/** Quantos problemas da conferência a tela mostra — os primeiros; o resto fica no anel. */
export const PROBLEMAS_NA_TELA = 3;

/**
 * Por que um caderno não saiu, em palavras — ou `null`, quando saiu.
 *
 * O motivo é o mesmo idioma da assinatura da Saúde do sono (`motivoDaFalha`), com
 * três acréscimos que só a revista tem:
 *
 * - **reprovada**: a conferência funcionando, e não erro do app — por isso diz
 *   *o quê*, com até {@link PROBLEMAS_NA_TELA} problemas;
 * - **preferencia**: `motivoDaFalha` devolve nulo ("nada falhou"), mas aqui algo
 *   deixou de sair: a escolha deste aparelho não escreve a revista, que não
 *   imprime sem modelo;
 * - **incompleto**: o motor escreveu e a conferência aprovou, mas a resposta não
 *   disse quanto gastou — zero é medida, e não se inventa.
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
      const motivo = motivoDaFalha(causa, quemNaoEscreveu(trilha, NUVEM_PADRAO)) ?? 'não saiu';
      const comProblemas = [...trilha].reverse().find((t) => t.problemas && t.problemas.length > 0);
      const problemas = (comProblemas?.problemas ?? []).slice(0, PROBLEMAS_NA_TELA).map((p) => p.detalhe);
      return problemas.length > 0 ? `${motivo}: ${problemas.join('; ')}` : motivo;
    }
  }
}
