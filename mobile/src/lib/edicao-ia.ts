/**
 * A leitura da edição impressa — e, por ora, **só** a leitura.
 * Spec: docs/specs/ia-analitica/spec.md · ADRs 0038 e 0040 · Story 1.9.
 *
 * ## Por que o celular parou de escrever
 *
 * A edição virou uma linha por caderno, e a ordem é a coluna `posicao`. Quem
 * decide essa ordem é `ordenarCadernos`, que a tela **não pode importar** — há
 * barreira no `architecture.test.ts` — porque a ordem congela na impressão e
 * recalculá-la na leitura reordenaria período fechado em silêncio.
 *
 * Gravar uma linha só, rotulada com um caderno qualquer para contornar isso,
 * poria mentira num arquivo que o Épico 2 vai imprimir 53 vezes e o anuário do
 * Épico 3 vai ler. A sequência da impressão — as chamadas ao orquestrador, a
 * conferência de cada texto e a gravação atômica pela função `edicao_imprimir` —
 * é a Story 1.10. O intervalo custa pouco: a migração já apagou as 7 edições de
 * produção, então o arquivo nasce vazio de qualquer jeito.
 *
 * Nada aqui chama modelo, nada aqui grava.
 */
import {
  periodoFechado, temEdicao, fetchEdicao,
  type EntradaPacote, type Edicao,
} from '@vitale/shared';
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
