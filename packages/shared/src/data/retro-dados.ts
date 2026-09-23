/**
 * As leituras da Retrospectiva, numa chamada (Story 2.2).
 *
 * Não é dono de tabela nenhuma: cada leitura é do módulo dono dela (AD-4), com a
 * paginação e a ordenação total de lá. Este arquivo só as dispara juntas, na mesma
 * janela, para que o celular (`retro.store`) e o script (`scripts/revista/`) leiam
 * **o mesmo conjunto** — antes, a lista das nove morava na store do celular, e o
 * script teria de repeti-la.
 *
 * Quem transforma o resultado em entrada é `retroInputDe` (`period/retro-dados.ts`),
 * que corta na janela do período com os mesmos predicados que estas leituras
 * aplicam no banco. Uma leitura nova aqui pede o predicado dela lá — o teste do
 * contrato (`period/retro-dados.test.ts`) compara as duas coisas.
 *
 * **Nove mais uma** (Story 2.7). As nove são a matéria da edição: se uma falha,
 * metade dos dados não é entrada e a leitura inteira rejeita. A décima — os fatos
 * do silêncio, que viram lápide — é **aditiva**: ela responde por uma função que
 * pode não existir no banco ainda, e a edição sem ela é a edição de antes desta
 * story. Por isso a falha dela não derruba as outras nove; vira lápide nenhuma.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { PISO_DE_SILENCIO_DIAS } from '../period/lapides';
import type { DadosDaRetro } from '../period/retro-dados';
import { fetchDailyRatingScores } from './daily-ratings';
import { fetchHabitLogsSince } from './habit-logs';
import { fetchHabitSummaries } from './habits';
import { fetchHealthDailyValues, fetchSilencioDasMetricas } from './health-daily';
import { fetchRegistroLogsSince, fetchRegistroSummaries } from './registros';
import { fetchSleepPeriodsSince } from './sleep';
import { fetchDoneTodoOccurrencesSince } from './todo-occurrences';
import { fetchTodoTemplateSummaries } from './todo-templates';

/**
 * O que já foi avisado nesta sessão, por causa.
 *
 * Enquanto a migração da 2.7 não for aplicada — e esse é o estado **esperado**
 * até o dono rodar a janela —, a décima leitura falha em **toda** abertura da
 * Retrospectiva. Um aviso por abertura afoga o log e ensina a ignorá-lo; um por
 * causa, por sessão, diz a mesma coisa uma vez.
 */
const jaAvisado = new Set<string>();

/** Só para o teste: esquece o que já foi avisado. Não tem chamador de produção. */
export function esquecerAvisosDaRetro(): void {
  jaAvisado.clear();
}

function avisarUmaVez(causa: string, mensagem: string, detalhe?: unknown): void {
  if (jaAvisado.has(causa)) return;
  jaAvisado.add(causa);
  if (detalhe === undefined) console.warn(mensagem);
  else console.warn(mensagem, detalhe);
}

/**
 * A função do banco ainda não existe — o estado esperado antes da janela, e não
 * um defeito. O PostgREST responde `PGRST202` (função não encontrada no schema
 * exposto) ou `42883` (`undefined_function`).
 */
function ehFuncaoQueNaoExiste(e: unknown): boolean {
  const c = (e as { code?: unknown } | null)?.code;
  return c === 'PGRST202' || c === '42883';
}

/**
 * Os dados crus da Retrospectiva desde `since` (`YYYY-MM-DD`), as dez leituras em
 * paralelo. Rejeita se **qualquer uma das nove** rejeitar — metade dos dados não é
 * entrada. A décima (o silêncio) é a exceção declarada no cabeçalho.
 */
export async function fetchDadosDaRetro(db: SupabaseClient, userId: string, since: string): Promise<DadosDaRetro> {
  // A lista vazia tem duas causas, e só uma delas já foi explicada no `catch`.
  let silencioFalhou = false;
  const [health, ratings, habits, habitLogs, registros, registroLogs, templates, occurrences, sleepPeriods, silencios] =
    await Promise.all([
      fetchHealthDailyValues(db, userId, since),
      fetchDailyRatingScores(db, userId, since),
      fetchHabitSummaries(db, userId),
      fetchHabitLogsSince(db, userId, since),
      fetchRegistroSummaries(db, userId),
      fetchRegistroLogsSince(db, userId, since),
      fetchTodoTemplateSummaries(db, userId),
      fetchDoneTodoOccurrencesSince(db, userId, since),
      // Por dia de acordar ≥ `since`: a mesma janela dos deltas e dos 90 dias.
      fetchSleepPeriodsSince(db, userId, since),
      // A décima, **sem janela**: a lápide pergunta pela vida inteira da métrica,
      // não pelo período. Falha aqui é lápide nenhuma, e a edição sai como saía
      // antes da 2.7 — mas não em silêncio, e não como se as duas causas fossem
      // a mesma: "a função ainda não foi aplicada" é o estado esperado antes da
      // janela do dono; "a leitura falhou" é rede, permissão ou forma.
      fetchSilencioDasMetricas(db, PISO_DE_SILENCIO_DIAS).catch((e: unknown) => {
        silencioFalhou = true;
        if (ehFuncaoQueNaoExiste(e)) {
          avisarUmaVez(
            'sem-funcao',
            '[retro] `metricas_silencio` ainda não existe no banco — a edição sai sem lápide, '
            + 'como saía antes da Story 2.7. Aplicar a migração 20260923120000 liga a lápide.',
          );
        } else {
          avisarUmaVez('falhou', '[retro] os fatos do silêncio não vieram — a edição sai sem lápide:', e);
        }
        return [];
      }),
    ]);
  // Zero métricas não é "nenhum silêncio": a função filtra por `auth.uid()` e não
  // recebe `userId`, então sem sessão ela devolve lista vazia SEM erro — e o
  // `catch` acima nunca dispara. O acervo do dono sempre tem métrica.
  if (silencios.length === 0 && !silencioFalhou) {
    avisarUmaVez(
      'acervo-vazio',
      '[retro] `metricas_silencio` respondeu sem métrica nenhuma — ou o acervo de saúde está vazio, '
      + 'ou a função rodou sem sessão (ela filtra por auth.uid()). A edição sai sem lápide.',
    );
  }
  return { health, ratings, habits, habitLogs, registros, registroLogs, templates, occurrences, sleepPeriods, silencios };
}
