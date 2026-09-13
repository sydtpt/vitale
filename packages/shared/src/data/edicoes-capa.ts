/**
 * Acesso à tabela `edicoes_capa` — dono único (AD-4).
 * AD-3 da espinha da revista · Story 1.9 cria a forma, a Story 1.13 carimba.
 *
 * **Só leitura aqui, de propósito.** O carimbo é da 1.13, e escrever antes dela
 * poria capa em cima de uma edição que a 1.10 ainda não sabe imprimir.
 *
 * ## Por que tabela, e não coluna em `edicoes_ia`
 *
 * A capa tem grão de **edição**; `edicoes_ia` tem grão de caderno. Uma coluna lá
 * seriam até quatro cópias da mesma capa — o mesmo padrão que o contrato recusou
 * para a ordem —, e a parede do arquivo passaria a varrer até 1.744 linhas e
 * desduplicar de quatro em quatro para desenhar 436 capas.
 *
 * ## Valores resolvidos, nunca ponteiros a re-derivar
 *
 * `coverOf` lê `isCover` e `state === 'linked'`, os dois mutáveis depois da
 * impressão — a estrela muda, o vínculo automático de 40 m muda, o `ph://` some
 * da biblioteca. Sem carimbo, a foto de agosto vira outra em outubro, contra
 * *período fechado congela*. Por isso o que fica gravado é a natureza, a
 * identidade do escolhido e **a legenda já formatada** — que continua imprimindo,
 * e servindo de descrição textual, mesmo quando a imagem não resolve mais.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * As três naturezas de capa, e a terceira não é sobra.
 *
 * `foto` só existe a partir de 2026; `tracado` é a rota do próprio período; e
 * `grade` é a grade diária de quando não há nem foto nem rota. Sem a terceira,
 * 2023 não teria capa nenhuma — e é a textura das capas que registra quando ele
 * passou a fotografar.
 */
export type NaturezaDaCapa = 'foto' | 'tracado' | 'grade';

/**
 * As três, como valor — é esta lista que o CHECK de `edicoes_capa.natureza`
 * repete, e é contra ela que a barreira do `architecture.test.ts` cobra o banco.
 * Sem um valor a comparar, "a mesma lista, letra por letra" seria só um
 * comentário de SQL.
 */
export const NATUREZAS_DA_CAPA: readonly NaturezaDaCapa[] =
  Object.freeze(['foto', 'tracado', 'grade']);

export function isNaturezaDaCapa(v: unknown): v is NaturezaDaCapa {
  return typeof v === 'string' && (NATUREZAS_DA_CAPA as readonly string[]).includes(v);
}

/** Linha como o PostgREST a devolve (snake_case). */
export interface CapaRow {
  user_id: string;
  tipo_periodo: string;
  inicio: string;
  fim: string;
  natureza: string;
  foto_id: string | null;
  foto_taken_at: string | null;
  rota_activity_id: string | null;
  legenda: string;
  carimbada_em: string;
}

export interface Capa {
  tipoPeriodo: string;
  inicio: string;
  fim: string;
  natureza: NaturezaDaCapa;
  /** `activity_photos.id` — só na natureza `foto`. */
  fotoId: string | null;
  /**
   * O instante da captura: a **chave de cura** da ADR 0037.
   *
   * O `localIdentifier` do PhotoKit não é estável entre aparelhos; o instante é.
   * Guardá-lo é o que permite re-casar a imagem depois de um Quick Start.
   */
  fotoTakenAt: string | null;
  /** `activities.id` da rota desenhada — só na natureza `tracado`. */
  rotaActivityId: string | null;
  /** Já formatada — "Ittre · km 31,1 · 12:38". Não são três campos. */
  legenda: string;
  carimbadaEm: string;
}

/** Ver a nota de `EDICAO_COLUMNS`: coluna esquecida aqui vira `undefined` na tela. */
export const CAPA_COLUMNS = 'user_id,tipo_periodo,inicio,fim,natureza,foto_id,foto_taken_at,'
  + 'rota_activity_id,legenda,carimbada_em';

const COLUMNS = CAPA_COLUMNS;

/**
 * Linha do Postgres → capa. **A natureza é conferida, não convertida por `as`.**
 *
 * O CHECK torna o valor desconhecido impossível — o que faz do cast a escrita
 * mais tentadora e a pior: no dia em que o CHECK for afrouxado, ou em que a linha
 * vier de outro lugar, o valor estranho atravessa até a tela e o sintoma aparece
 * longe daqui, como uma capa que não desenha. Explodir alto na fronteira é o
 * comportamento certo para um estado que o banco afirma não existir.
 */
export function toCapa(r: CapaRow): Capa {
  if (!isNaturezaDaCapa(r.natureza)) {
    throw new Error(
      `natureza de capa desconhecida: ${JSON.stringify(r.natureza)} — as três são `
      + `${NATUREZAS_DA_CAPA.join(', ')}, e o CHECK de edicoes_capa.natureza deveria ter recusado esta.`,
    );
  }
  return {
    tipoPeriodo: r.tipo_periodo,
    inicio: r.inicio,
    fim: r.fim,
    natureza: r.natureza,
    fotoId: r.foto_id,
    fotoTakenAt: r.foto_taken_at,
    rotaActivityId: r.rota_activity_id,
    legenda: r.legenda,
    carimbadaEm: r.carimbada_em,
  };
}

/**
 * A capa carimbada de um período, ou `null` se a edição ainda não foi impressa.
 *
 * `maybeSingle` aqui é **correto**, ao contrário de `fetchEdicao`: a chave desta
 * tabela é a edição inteira — `(user_id, tipo_periodo, inicio, fim)` —, então
 * uma linha é o máximo que existe. É `edicoes_ia` que ganhou o caderno na chave.
 */
export async function fetchCapa(
  db: SupabaseClient,
  userId: string,
  tipoPeriodo: string,
  inicio: string,
  fim: string,
): Promise<Capa | null> {
  const { data, error } = await db
    .from('edicoes_capa')
    .select(COLUMNS)
    .eq('user_id', userId)
    .eq('tipo_periodo', tipoPeriodo)
    .eq('inicio', inicio)
    .eq('fim', fim)
    .maybeSingle();
  if (error) throw error;
  return data ? toCapa(data as unknown as CapaRow) : null;
}
