/**
 * Dispara o delta incremental dos tipos inscritos quando há treino novo.
 *
 * - Foreground: AppState 'active' → reconcilia (puro JS, sem dependência nativa).
 * - Background/foreground: evento nativo `healthKit:Workout:new` do HealthKit.
 *
 * Abrir/exibir a lista NÃO chama isto (FR-003) — só estes eventos chamam.
 *
 * ⚠️ Os eventos nativos só disparam se `initializeBackgroundObservers` for
 * chamado no AppDelegate (passo nativo F4 — ver tasks.md). Sem ele, vale
 * apenas o caminho de foreground via AppState.
 */
import { AppState, NativeAppEventEmitter, Platform, type AppStateStatus } from 'react-native';
import { useFitnessStore } from '../store/fitness.store';
import { useHealthStore } from '../store/health.store';

/** No máximo um delta por minuto no foreground. */
const THROTTLE_MS = 60_000;

let lastRun = 0;
let lastHealthRun = 0;
let appStateSub: { remove: () => void } | null = null;
let workoutSub: { remove: () => void } | null = null;

async function runDeltaThrottled(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastRun < THROTTLE_MS) return;
  lastRun = now;
  await useFitnessStore.getState().runDelta();
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

  appStateSub = AppState.addEventListener('change', (state: AppStateStatus) => {
    if (state === 'active') {
      void runDeltaThrottled();
      void runHealthThrottled();
    }
  });

  workoutSub = NativeAppEventEmitter.addListener('healthKit:Workout:new', () => {
    void runDeltaThrottled(true);
  });

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
