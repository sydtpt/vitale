/**
 * Migalhas do sync — um log curto e local que sobrevive ao app ser encerrado.
 *
 * **Por que existe.** A sincronização em background roda justamente quando não
 * há ninguém olhando: o iOS acorda o app, o JS sobe sem UI, e tudo acontece
 * antes de qualquer tela existir. Nesse cenário `console.log` não vai a lugar
 * nenhum e o depurador não está conectado. Sem carimbo persistido, "não
 * sincronizou" é indistinguível de "nem chegou a rodar".
 *
 * As migalhas separam três hipóteses que, de fora, parecem a mesma falha:
 *
 * | O que aparece no log            | O que isso significa                        |
 * |---------------------------------|---------------------------------------------|
 * | nenhuma migalha nova            | o iOS nunca acordou o app                   |
 * | `app-launch` (state=background) | acordou, mas o JS parou antes do sync       |
 * | `sync-start` + `delta`          | rodou; o problema está no delta ou no dado  |
 *
 * `app-launch` é gravada na carga do módulo raiz, **antes** de qualquer porta de
 * sessão, porque é a única que responde "o iOS acordou o processo?". `sync-start`
 * vem depois da sessão resolver — a diferença entre as duas é o diagnóstico.
 *
 * Ler o log não estraga a evidência: os carimbos dizem quando cada coisa rodou,
 * então abrir o app depois do teste para conferir é seguro.
 */
import { asyncStore, getJSON, setJSON, type KVStore } from './local-store';

const KEY = 'vitale:sync-breadcrumbs';

/** Teto do log circular. Baixo de propósito: é diagnóstico, não histórico. */
export const BREADCRUMB_CAP = 60;

export type BreadcrumbEvent =
  /** Bundle JS avaliado — o processo subiu, com ou sem UI. */
  | 'app-launch'
  /** `startActivitySync` entrou: houve sessão e o serviço armou os listeners. */
  | 'sync-start'
  /** Voltou ao primeiro plano. */
  | 'foreground'
  /** O observer de treino do HealthKit disparou. */
  | 'observer'
  /**
   * Resultado de `configureBackgroundDelivery` — o passo que persiste os tipos
   * no UserDefaults nativo. É dessa chave que `setupBackgroundObservers()`
   * depende no cold launch seguinte; sem ela o iOS nunca acorda o app. Falha
   * aqui não tem sintoma imediato, por isso o registro explícito.
   */
  | 'bg-config'
  /** Um ciclo de delta terminou. */
  | 'delta';

export interface Breadcrumb {
  /** ISO 8601. */
  at: string;
  event: BreadcrumbEvent;
  /** Contexto livre — `AppState` no launch, duração no delta. */
  detail?: string;
}

/**
 * Serializa as escritas. `AsyncStorage` não tem read-modify-write atômico, e as
 * migalhas mais importantes (`app-launch` e `sync-start`) saem quase juntas —
 * sem a fila, uma sobrescreveria a outra e o log perderia exatamente o par que
 * dá o diagnóstico.
 */
let fila: Promise<void> = Promise.resolve();

export function recordBreadcrumb(
  event: BreadcrumbEvent,
  detail?: string,
  store: KVStore = asyncStore,
): Promise<void> {
  fila = fila.then(async () => {
    try {
      const atual = (await getJSON<Breadcrumb[]>(KEY, store)) ?? [];
      const proximo = [...atual, { at: new Date().toISOString(), event, detail }];
      await setJSON(KEY, proximo.slice(-BREADCRUMB_CAP), store);
    } catch {
      // Diagnóstico nunca derruba o que está diagnosticando.
    }
  });
  return fila;
}

/** Do mais recente para o mais antigo — a ordem em que se lê um log de falha. */
export async function readBreadcrumbs(store: KVStore = asyncStore): Promise<Breadcrumb[]> {
  const todas = (await getJSON<Breadcrumb[]>(KEY, store)) ?? [];
  return [...todas].reverse();
}

export async function clearBreadcrumbs(store: KVStore = asyncStore): Promise<void> {
  await setJSON<Breadcrumb[]>(KEY, [], store);
}
