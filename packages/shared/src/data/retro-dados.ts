/**
 * As nove leituras da Retrospectiva, numa chamada (Story 2.2).
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
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DadosDaRetro } from '../period/retro-dados';
import { fetchDailyRatingScores } from './daily-ratings';
import { fetchHabitLogsSince } from './habit-logs';
import { fetchHabitSummaries } from './habits';
import { fetchHealthDailyValues } from './health-daily';
import { fetchRegistroLogsSince, fetchRegistroSummaries } from './registros';
import { fetchSleepPeriodsSince } from './sleep';
import { fetchDoneTodoOccurrencesSince } from './todo-occurrences';
import { fetchTodoTemplateSummaries } from './todo-templates';

/**
 * Os dados crus da Retrospectiva desde `since` (`YYYY-MM-DD`), as nove leituras em
 * paralelo. Rejeita se qualquer uma rejeitar — metade dos dados não é entrada.
 */
export async function fetchDadosDaRetro(db: SupabaseClient, userId: string, since: string): Promise<DadosDaRetro> {
  const [health, ratings, habits, habitLogs, registros, registroLogs, templates, occurrences, sleepPeriods] =
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
    ]);
  return { health, ratings, habits, habitLogs, registros, registroLogs, templates, occurrences, sleepPeriods };
}
