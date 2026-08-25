/**
 * Registro local das atividades já anunciadas por notificação.
 *
 * O `pushed` do sync conta LINHAS ENVIADAS, não treinos inéditos — e o upsert é
 * idempotente de propósito, então o mesmo treino volta a ser enviado sempre que
 * a âncora não avança:
 *
 *  - push com falha (`failed.length > 0`) segura a âncora → o próximo ciclo
 *    rebusca e reenvia os mesmos treinos;
 *  - sem âncora (cold start após trocar de adaptador, ou a 1ª vez), o delta lê
 *    os últimos `DELTA_CATCHUP_DAYS` dias inteiros — tudo já sincronizado;
 *  - a anchored query do HealthKit reemite uma amostra quando outro app mexe nos
 *    metadados dela.
 *
 * Nos três casos o treino já foi anunciado. Este ledger é o que separa "enviado"
 * de "inédito"; sem ele a mesma atividade notifica a cada ciclo.
 *
 * Persistido (e não em memória) porque o observer do HealthKit acorda o app em
 * background: o processo morre entre um anúncio e o próximo.
 */
import { asyncStore, getJSON, setJSON, type KVStore } from './local-store';

const KEY = 'vitale:notified-activities';

/**
 * Teto de ids guardados. A janela do delta é de dias, então 500 cobre com folga
 * o que pode voltar a ser enviado; o que cai fora só seria reanunciado se o
 * HealthKit reemitisse um treino de meses atrás — e crescer sem limite é pior.
 */
const MAX_IDS = 500;

/** Serializa os claims: dois ciclos concorrentes fariam read-modify-write em cima um do outro. */
let chain: Promise<unknown> = Promise.resolve();

/**
 * Devolve, das atividades informadas, só as que AINDA NÃO foram anunciadas — e
 * já as marca como anunciadas na mesma passada (daí "claim": quem recebe o id é
 * o único responsável por notificar).
 *
 * Marcar aqui, e não depois de a notificação de fato aparecer, é intencional: se
 * o anúncio for suprimido (toggle desligado, permissão negada), a atividade
 * continua "vista" e não vira um backlog para despejar quando o toggle voltar.
 */
export function claimUnnotified(
  ids: readonly string[],
  store: KVStore = asyncStore,
): Promise<string[]> {
  const run = chain.then(
    () => claimNow(ids, store),
    () => claimNow(ids, store),
  );
  // A cadeia não pode carregar rejeição: ela só serializa.
  chain = run.catch(() => undefined);
  return run;
}

async function claimNow(ids: readonly string[], store: KVStore): Promise<string[]> {
  if (ids.length === 0) return [];

  const known = (await getJSON<string[]>(KEY, store)) ?? [];
  const seen = new Set(known);

  const fresh: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue; // já anunciado antes — ou repetido dentro deste mesmo lote
    seen.add(id);
    fresh.push(id);
  }
  if (fresh.length === 0) return [];

  const merged = [...known, ...fresh];
  await setJSON(KEY, merged.slice(-MAX_IDS), store);
  return fresh;
}

/** Esquece tudo — usado ao trocar de conta/limpar dados locais. */
export async function clearNotifiedActivities(store: KVStore = asyncStore): Promise<void> {
  await setJSON<string[]>(KEY, [], store);
}
