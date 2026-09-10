/**
 * O motor de nuvem — um só, no núcleo (AD-14).
 *
 * Havia duas cópias do cliente da `ia-narrar` no app, cada uma lendo a resposta
 * do seu jeito, e nas duas o ramo que lia o corpo de erro era código morto: o
 * cliente da function devolve erro **antes** de ler o corpo em todo não-2xx. Por
 * isso o transporte chega aqui **já normalizado** — status e corpo, ou falta de
 * rede — e cada hospedeiro só injeta `invocar`. Ler o status, o corpo, a
 * conclusão e a assinatura é trabalho deste arquivo, e de nenhum outro.
 *
 * Lê a function de hoje e a da 5.6 com a mesma tabela: os status de hoje e os
 * fixados por classe (`STATUS_POR_CLASSE`) coincidem onde se tocam, e quando o
 * corpo trouxer a classe, é ela que decide.
 */
import {
  ehClasseDeFalha,
  type ClasseDeFalha,
  type CorpoDoPedido,
} from './fio';
import { CONCLUSAO, type Falha, type Motor, type Pedido, type Resposta, type UsoDeTokens } from './motor';

/**
 * O que o hospedeiro devolve de uma chamada: o status e o corpo já lido, ou a
 * falta de rede. Status não-2xx **não** é exceção aqui — é dado.
 */
export type RespostaDoTransporte =
  | { readonly status: number; readonly corpo: unknown }
  | { readonly semRede: true; readonly detalhe?: string };

/** O único pedaço do caminho que o hospedeiro escreve: a chamada em si. */
export type Transporte = (corpo: CorpoDoPedido) => Promise<RespostaDoTransporte>;

/**
 * Status → classe, quando o corpo não traz classe. Fora desta tabela é
 * `transitoria` com `naoMapeado` — cai no piso sem gravar, e o anel fica sabendo.
 *
 * O 401 é do gateway (sem JWT, `verify_jwt = true`), antes de a function rodar.
 */
export const CLASSE_POR_STATUS: Readonly<Record<number, ClasseDeFalha>> = {
  401: 'indisponivel',
  403: 'indisponivel',
  503: 'indisponivel',
  413: 'janela',
  400: 'capacidade',
  422: 'capacidade',
  429: 'transitoria',
  502: 'transitoria',
  504: 'transitoria',
};

/** O corpo que a function lê hoje. `json` é a intenção, derivada da saída pedida. */
export function corpoDoPedido(pedido: Pedido): CorpoDoPedido {
  return { sistema: pedido.sistema, usuario: pedido.usuario, json: pedido.saida.tipo === 'esquema' };
}

function objeto(x: unknown): Record<string, unknown> | null {
  return typeof x === 'object' && x !== null && !Array.isArray(x) ? (x as Record<string, unknown>) : null;
}

function texto(x: unknown): string | null {
  return typeof x === 'string' && x.trim().length > 0 ? x : null;
}

/** O que o corpo de erro diz, para diagnóstico: o `error` de hoje e o `detalhe`. */
function detalheDoCorpo(o: Record<string, unknown> | null): string | undefined {
  if (!o) return undefined;
  const partes = [o['error'], o['detalhe']].filter((p): p is string => typeof p === 'string' && p.length > 0);
  return partes.length > 0 ? partes.join(': ') : undefined;
}

function tokensDe(x: unknown): UsoDeTokens | undefined {
  const o = objeto(x);
  if (!o) return undefined;
  const entrada = o['entrada'];
  const saida = o['saida'];
  return typeof entrada === 'number' && Number.isFinite(entrada) && typeof saida === 'number' && Number.isFinite(saida)
    ? { entrada, saida }
    : undefined;
}

function falha(classe: ClasseDeFalha, detalhe: string | undefined, naoMapeado = false): Falha {
  return {
    classe,
    ...(detalhe !== undefined ? { detalhe } : {}),
    ...(naoMapeado ? { naoMapeado: true as const } : {}),
  };
}

/**
 * A tabela de tradução inteira: o que o transporte devolveu → `Resposta` ou
 * `Falha`. Pura, e é ela que o teste percorre.
 *
 *   sem rede                               → indisponivel
 *   corpo com `classe` válida              → essa classe, qualquer que seja o status
 *   corpo com `classe` desconhecida        → a do status (ou transitoria), com naoMapeado
 *   2xx sem motivo de parada de conclusão  → saida-invalida, com o motivo cru
 *   2xx sem texto, sem assinatura, ilegível→ saida-invalida
 *   não-2xx                                → CLASSE_POR_STATUS, ou transitoria com naoMapeado
 */
export function traduzirDaNuvem(r: RespostaDoTransporte): Resposta | Falha {
  const bruto = objeto(r);
  if (!bruto) return falha('transitoria', 'o transporte devolveu um valor ilegível', true);
  if (bruto['semRede'] === true) {
    return falha('indisponivel', typeof bruto['detalhe'] === 'string' ? bruto['detalhe'] : 'sem rede');
  }
  const status = bruto['status'];
  if (typeof status !== 'number') return falha('transitoria', 'o transporte devolveu um valor sem status', true);

  const corpo = objeto(bruto['corpo']);
  const classe = corpo ? corpo['classe'] : undefined;
  if (ehClasseDeFalha(classe)) return falha(classe, detalheDoCorpo(corpo));
  // Classe que o núcleo não conhece: a function e o núcleo divergiram. O status
  // ainda dá uma classe segura, mas o anel precisa saber. `null` é ausência — uma
  // resposta boa com `classe: null` continua sendo resposta boa.
  const divergiu = corpo !== null && classe !== undefined && classe !== null;

  if (status >= 200 && status < 300) {
    if (divergiu) return falha('transitoria', `classe desconhecida no corpo: ${String(classe)}`, true);
    if (!corpo) return falha('saida-invalida', 'corpo ilegível');
    const motivo = corpo['motivoDeParada'];
    if (motivo !== CONCLUSAO) return falha('saida-invalida', `motivo de parada: ${String(motivo)}`);
    const t = texto(corpo['texto']);
    if (t === null) return falha('saida-invalida', 'resposta sem texto');
    const provedor = texto(corpo['provedor']);
    const modelo = texto(corpo['modelo']);
    if (provedor === null || modelo === null) return falha('saida-invalida', 'resposta sem assinatura');
    const tokens = tokensDe(corpo['tokens']);
    return {
      texto: t,
      assinatura: { tipo: 'nuvem', provedor, modelo },
      ...(tokens ? { tokens } : {}),
    };
  }

  const doCorpo = detalheDoCorpo(corpo);
  const detalhe = doCorpo ? `HTTP ${status} · ${doCorpo}` : `HTTP ${status}`;
  const mapeada = Object.prototype.hasOwnProperty.call(CLASSE_POR_STATUS, status)
    ? CLASSE_POR_STATUS[status]
    : undefined;
  if (mapeada) return falha(mapeada, detalhe, divergiu);
  return falha('transitoria', detalhe, true);
}

/**
 * O motor de nuvem. Recebe o transporte do hospedeiro e devolve a porta — que,
 * como toda porta, nunca rejeita: um transporte que lança, em vez de devolver
 * `semRede`, vira `transitoria` não mapeada.
 */
export function criarMotorDeNuvem(invocar: Transporte): Motor {
  return async (pedido) => {
    try {
      return traduzirDaNuvem(await invocar(corpoDoPedido(pedido)));
    } catch (e) {
      // O nome cru vai junto (AD-4): é ele que o anel precisa para mapear depois.
      const cru = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      return falha('transitoria', `o transporte lançou — ${cru}`, true);
    }
  };
}
