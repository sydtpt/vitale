/**
 * Dispara o delta incremental dos tipos inscritos quando há treino novo.
 *
 * - Foreground: AppState 'active' → reconcilia (puro JS, sem dependência nativa).
 * - Background/foreground: observer de treino da porta de saúde (ver
 *   `subscribeWorkoutObserver` em `health-source/contract.ts`).
 *
 * Abrir/exibir a lista NÃO chama isto (FR-003) — só estes eventos chamam.
 *
 * ⚠️ O observer só dispara com o app fechado se `configureBackgroundDelivery`
 * tiver rodado pelo menos uma vez (chamado abaixo) — cada adaptador decide
 * como isso se sustenta nativamente (ver contract.ts). Sem isso, vale apenas
 * o caminho de foreground via AppState.
 */
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { HK, healthSource } from '../lib/health-source/active';
import { recordBreadcrumb } from '../lib/sync-breadcrumbs';
import { useFitnessStore } from '../store/fitness.store';
import { useHealthStore } from '../store/health.store';

/** No máximo um delta por minuto no foreground. */
const THROTTLE_MS = 60_000;

let lastRun = 0;
let lastHealthRun = 0;
let appStateSub: { remove: () => void } | null = null;
let workoutSub: { remove: () => void } | null = null;

/**
 * Delta em voo. Ao abrir o app, quatro gatilhos chegam no mesmo segundo —
 * `observer`, `foreground`, o disparo inicial de `startActivitySync` e um
 * segundo `observer` — e `force` faz três deles ignorarem o throttle. O
 * diagnóstico flagrou os três deltas concorrentes:
 *
 *     14:17:44  delta  1172ms
 *     14:17:44  delta  1188ms
 *     14:17:44  delta  1780ms
 *
 * Cada um relê a mesma âncora, busca os mesmos treinos, e refaz as buscas de
 * rota GPS e de FC — trabalho triplicado numa thread só. O upsert é idempotente,
 * então não duplica dado; mas os três terminam gravando âncora sobre âncora, e
 * o que perde a corrida grava uma âncora mais velha do que a já persistida.
 * Um ciclo por vez: quem chega no meio aproveita o que já está rodando.
 */
let deltaEmVoo: Promise<void> | null = null;

async function runDeltaThrottled(force = false): Promise<void> {
  if (deltaEmVoo) return deltaEmVoo;

  const now = Date.now();
  if (!force && now - lastRun < THROTTLE_MS) return;
  lastRun = now;

  deltaEmVoo = useFitnessStore
    .getState()
    .runDelta()
    // `syncDelta` já trata os próprios erros; se ainda assim algo escapar, não
    // pode virar unhandled rejection — os chamadores são todos `void f()`.
    .catch(() => undefined)
    .finally(() => {
      deltaEmVoo = null;
      void recordBreadcrumb('delta', `${Date.now() - now}ms`);
    });
  return deltaEmVoo;
}

/** Sobe os agregados diários de saúde (re-sync da janela recente), com throttle. */
async function runHealthThrottled(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastHealthRun < THROTTLE_MS) return;
  lastHealthRun = now;
  await useHealthStore.getState().syncToCloud();
}

export function startActivitySync(): void {
  if (Platform.OS !== 'ios') return;
  if (appStateSub || workoutSub) return; // já ativo

  // Migalha do outro lado da porta de sessão: `app-launch` (em `_layout.tsx`)
  // diz que o processo subiu; esta diz que a sessão resolveu e o sync armou.
  // Uma sem a outra é exatamente o diagnóstico — ver `sync-breadcrumbs.ts`.
  void recordBreadcrumb('sync-start', `state=${AppState.currentState}`);

  appStateSub = AppState.addEventListener('change', (state: AppStateStatus) => {
    if (state === 'active') {
      void recordBreadcrumb('foreground');
      void runDeltaThrottled();
      void runHealthThrottled();
    }
  });

  workoutSub = healthSource.subscribeWorkoutObserver(() => {
    void recordBreadcrumb('observer');
    void runDeltaThrottled(true);
  });

  // Garante a entrega em background para o próximo cold launch (ver o aviso
  // no topo do arquivo). Falha aqui não impede o caminho de foreground via
  // AppState — mas precisa aparecer, porque é o único passo cujo fracasso é
  // invisível: o app só deixa de ser acordado, sem sintoma na hora.
  void healthSource
    .configureBackgroundDelivery([HK.workout])
    .then((ok) => recordBreadcrumb('bg-config', ok ? 'ok' : 'FALHOU'));

  // Reconciliação inicial ao iniciar a sessão.
  void runDeltaThrottled(true);
  void runHealthThrottled(true);
}

export function stopActivitySync(): void {
  appStateSub?.remove();
  appStateSub = null;
  workoutSub?.remove();
  workoutSub = null;
}
