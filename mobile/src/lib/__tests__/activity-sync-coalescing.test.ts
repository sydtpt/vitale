/**
 * BARREIRA — um ciclo de delta por vez.
 *
 * Ao abrir o app, quatro gatilhos caem no mesmo segundo: o observer do
 * HealthKit, o `AppState` virando active, o disparo inicial de
 * `startActivitySync`, e um segundo observer. Três deles passam `force`, que
 * ignora o throttle de um minuto. O diagnóstico em device flagrou o resultado:
 *
 *     14:17:44  delta  1172ms
 *     14:17:44  delta  1188ms
 *     14:17:44  delta  1780ms
 *
 * Três `syncDelta` concorrentes releem a mesma âncora, buscam os mesmos treinos
 * e refazem as buscas de rota GPS e de FC — trabalho triplicado numa thread só.
 * O upsert é idempotente, então não duplica dado, mas os três gravam âncora
 * sobre âncora e o que perde a corrida persiste uma âncora mais velha do que a
 * já gravada — regredindo o ponto de partida do próximo ciclo.
 *
 * Nenhum teste de lógica pega isso: cada delta, isolado, está correto. É a
 * simultaneidade que erra, e ela só aparece no seam onde os gatilhos se juntam.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockRunDelta = jest.fn<() => Promise<void>>();
const mockSyncToCloud = jest.fn<() => Promise<void>>();
let observerCb: (() => void) | null = null;

jest.mock('../../lib/sync-breadcrumbs', () => ({
  __esModule: true,
  recordBreadcrumb: () => Promise.resolve(),
}));

jest.mock('../../lib/health-source/active', () => ({
  __esModule: true,
  HK: { workout: 'HKWorkoutTypeIdentifier' },
  healthSource: {
    id: 'test',
    configureBackgroundDelivery: () => Promise.resolve(true),
    subscribeWorkoutObserver: (cb: () => void) => {
      observerCb = cb;
      return { remove: () => {} };
    },
  },
}));

jest.mock('../../store/fitness.store', () => ({
  __esModule: true,
  useFitnessStore: { getState: () => ({ runDelta: mockRunDelta }) },
}));

jest.mock('../../store/health.store', () => ({
  __esModule: true,
  useHealthStore: { getState: () => ({ syncToCloud: mockSyncToCloud }) },
}));

import { startActivitySync, stopActivitySync } from '../../services/healthkit-observer';

/** Promise que o teste resolve quando quiser — segura o delta "em voo". */
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('BARREIRA — deltas simultâneos coalescem', () => {
  beforeEach(() => {
    stopActivitySync();
    observerCb = null;
    mockRunDelta.mockReset();
    mockSyncToCloud.mockReset().mockResolvedValue(undefined);
  });

  it('quatro gatilhos no mesmo instante rodam UM delta, não quatro', async () => {
    const emVoo = deferred();
    mockRunDelta.mockReturnValue(emVoo.promise);

    // O disparo inicial já sai daqui e fica pendurado no delta em voo.
    startActivitySync();
    expect(mockRunDelta).toHaveBeenCalledTimes(1);

    // Os outros gatilhos chegam enquanto o primeiro ainda não terminou.
    observerCb?.();
    observerCb?.();
    observerCb?.();

    expect(mockRunDelta).toHaveBeenCalledTimes(1);

    emVoo.resolve();
    await emVoo.promise;
  });

  it('depois que o ciclo termina, um gatilho novo roda de novo', async () => {
    mockRunDelta.mockResolvedValue(undefined);

    startActivitySync();
    await Promise.resolve();
    await Promise.resolve();
    expect(mockRunDelta).toHaveBeenCalledTimes(1);

    // `force` do observer: ignora o throttle, mas só depois do ciclo fechar.
    observerCb?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(mockRunDelta).toHaveBeenCalledTimes(2);
  });

  it('um delta que rejeita não deixa a porta trancada', async () => {
    mockRunDelta.mockRejectedValueOnce(new Error('rede caiu'));

    startActivitySync();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    mockRunDelta.mockResolvedValue(undefined);
    observerCb?.();
    await Promise.resolve();
    await Promise.resolve();

    // Sem o `finally`, o primeiro delta travaria todos os seguintes.
    expect(mockRunDelta).toHaveBeenCalledTimes(2);
  });
});
