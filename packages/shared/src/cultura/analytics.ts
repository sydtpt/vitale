/**
 * Agregações do módulo Cultura — o que a página web mostra (CAP-6).
 * Spec: docs/specs/cultura/spec.md
 *
 * Funções puras, no núcleo e não no componente Angular, por dois motivos: são
 * testáveis pelo runner do shared, e nenhuma delas é específica de web — se um
 * dia o mobile mostrar o mesmo recorte, não há o que reescrever.
 *
 * Nada aqui toca o motor de correlação (`triggerImpact`): destravá-lo é o item
 * A6 do backlog de instrumentação, com escopo próprio.
 */
import type { CulturaItem } from '../models/index';
import type { CulturaEstado } from './tipos';

/**
 * A janela de consumo do item intersecta [de, ate]?
 *
 * Implementa a CAP-5 em memória, com a MESMA semântica da consulta ao banco:
 * item em curso tem janela ABERTA, fechada em `hoje`; item em `quero` não tem
 * janela nenhuma e fica de fora. Divergir daqui faria a página e o banco
 * discordarem sobre o mesmo período.
 */
export function janelaIntersecta(
  item: Pick<CulturaItem, 'estado' | 'iniciadoEm' | 'concluidoEm'>,
  de: string,
  ate: string,
  hoje: string,
): boolean {
  if (item.estado === 'quero' || !item.iniciadoEm) return false;
  const fim = item.concluidoEm ?? hoje;
  return item.iniciadoEm <= ate && fim >= de;
}

/** Quantos itens de cada mídia, entre os informados. */
export function contagemPorTipo(itens: readonly CulturaItem[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const i of itens) out[i.tipo] = (out[i.tipo] ?? 0) + 1;
  return out;
}

/** Quantos itens receberam cada nota. Índices 1..5; item sem nota não conta. */
export function distribuicaoDeNotas(itens: readonly CulturaItem[]): Record<number, number> {
  const out: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const i of itens) {
    if (i.nota != null && out[i.nota] !== undefined) out[i.nota] += 1;
  }
  return out;
}

export interface ItemParado {
  item: CulturaItem;
  /** Dias desde `iniciadoEm`. */
  dias: number;
}

/**
 * O que está em `consumindo` há mais tempo, do mais antigo para o mais recente.
 *
 * Não é ranking de vergonha: é a lista de onde sai a decisão de retomar ou
 * deletar. Como não existe estado de abandono (CAP-10), um item largado fica
 * aqui para sempre — e é justamente vê-lo que provoca a limpeza.
 */
export function paradosEmAndamento(
  itens: readonly CulturaItem[],
  hoje: string,
  limite = 5,
): ItemParado[] {
  return itens
    .filter((i): i is CulturaItem & { iniciadoEm: string } =>
      i.estado === 'consumindo' && i.iniciadoEm != null)
    .map((i) => ({ item: i, dias: diasEntre(i.iniciadoEm, hoje) }))
    .sort((a, b) => b.dias - a.dias)
    .slice(0, limite);
}

export interface Indicador {
  nome: string;
  /** Média das notas dos itens dele que TÊM nota; `null` se nenhum tem. */
  media: number | null;
  /** Total indicado, com ou sem nota. */
  total: number;
  /** Quantos entraram na média — é o que revela se ela é confiável. */
  comNota: number;
}

/**
 * Quem indicou o quê, ordenado por nota média.
 *
 * A contagem viaja junto de propósito e a página a exibe: ordenar por média
 * sem mostrar quantos itens a sustentam transforma "★5,0 de um único item" em
 * campeão sobre "★4,2 de nove". Não filtramos quem tem poucos itens — numa
 * estante pequena isso esconderia todo mundo — então a honestidade tem que
 * vir do número à vista.
 *
 * Quem não tem nenhuma nota vai para o fim, com `media: null`: ainda é
 * informação ("indicou 3, você não avaliou nenhum"), só não é ranking.
 */
export function rankingIndicadores(itens: readonly CulturaItem[]): Indicador[] {
  const por = new Map<string, { total: number; soma: number; comNota: number }>();
  for (const i of itens) {
    const nome = i.indicadoPor?.trim();
    if (!nome) continue;
    const e = por.get(nome) ?? { total: 0, soma: 0, comNota: 0 };
    e.total += 1;
    if (i.nota != null) {
      e.soma += i.nota;
      e.comNota += 1;
    }
    por.set(nome, e);
  }
  return [...por.entries()]
    .map(([nome, e]) => ({
      nome,
      media: e.comNota > 0 ? e.soma / e.comNota : null,
      total: e.total,
      comNota: e.comNota,
    }))
    .sort((a, b) => {
      if (a.media === null && b.media === null) return b.total - a.total;
      if (a.media === null) return 1;
      if (b.media === null) return -1;
      return b.media - a.media || b.comNota - a.comNota;
    });
}

/** Dias inteiros entre duas datas 'YYYY-MM-DD'. Sem fuso: compara em UTC. */
function diasEntre(de: string, ate: string): number {
  const ms = Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`);
  return Math.max(0, Math.round(ms / 86_400_000));
}

/** Quantos itens estão em cada estado. */
export function contagemPorEstado(itens: readonly CulturaItem[]): Record<CulturaEstado, number> {
  const out: Record<CulturaEstado, number> = { quero: 0, consumindo: 0, concluido: 0 };
  for (const i of itens) out[i.estado] += 1;
  return out;
}
