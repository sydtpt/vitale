/**
 * A ligação do aviso: `runDelta` entrega a notificação ao ciclo, para ela sair
 * logo depois do upsert — e não a dispara de novo depois do `await`.
 *
 * O teste do serviço (`aviso-de-sync-no-background.test.ts`) prende a ORDEM
 * dentro do ciclo. Sem este, a store podia voltar a chamar `notifyActivitySync`
 * só no fim — o jeito que congelava o aviso por 13 min em background — com a
 * suíte do serviço inteira verde, porque o serviço continuaria certo.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockSyncDelta = jest.fn<(opcoes?: { aoSubir?: unknown }) => Promise<Record<string, unknown>>>();
const mockNotifyActivitySync = jest.fn(async () => {});
const mockNotifyAutoTasks = jest.fn(async () => {});

jest.mock('../../lib/health-source/active', () => ({
  __esModule: true,
  healthSource: { id: 'test' },
}));

jest.mock('../../lib/healthkit-workouts', () => ({
  __esModule: true,
  WORKOUT_PERMISSIONS: [],
  PAGE_SIZE: 20,
  fetchWorkoutsPage: async () => ({ workouts: [], hasMore: false }),
  GPS_ACTIVITY_IDS: new Set(),
  hasGpsRoute: () => false,
  elevationGain: () => 0,
  resolveElevationM: () => null,
  getActivityMeta: () => ({ icon: 'dumbbell', label: 'Yoga' }),
  fetchWorkoutRoute: async () => [],
}));

jest.mock('../../services/activity-sync', () => ({
  __esModule: true,
  syncType: async () => ({}),
  syncDelta: (opcoes?: { aoSubir?: unknown }) => mockSyncDelta(opcoes),
}));

jest.mock('../../lib/synced-types', () => ({
  __esModule: true,
  loadSyncedTypes: async () => new Set(),
  unsubscribeType: async () => {},
}));

jest.mock('../../services/notifications', () => ({
  __esModule: true,
  notifyActivitySync: (...args: unknown[]) => mockNotifyActivitySync(...(args as [])),
  notifyAutoTasks: (...args: unknown[]) => mockNotifyAutoTasks(...(args as [])),
}));

jest.mock('../activities.store', () => ({
  __esModule: true,
  useActivitiesStore: { getState: () => ({ load: async () => {} }) },
}));

import { useFitnessStore } from '../fitness.store';

const RESULTADO = {
  pushed: 1,
  deleted: 0,
  routes: 0,
  queued: 0,
  ok: true,
  labels: ['Yoga'],
  tasksCreated: 2,
  syncedActivities: [{ id: 'hk-yoga-1', activityId: 57 }],
};

describe('runDelta — o aviso vai para dentro do ciclo', () => {
  beforeEach(() => {
    mockSyncDelta.mockReset();
    mockNotifyActivitySync.mockClear();
    mockNotifyAutoTasks.mockClear();
  });

  it('entrega notifyActivitySync como aoSubir, e não notifica de novo depois do ciclo', async () => {
    mockSyncDelta.mockImplementation(async (opcoes) => {
      // O ciclo é quem avisa, com as atividades que subiram.
      await (opcoes?.aoSubir as (a: unknown[]) => Promise<void>)(RESULTADO.syncedActivities);
      return RESULTADO;
    });

    await useFitnessStore.getState().runDelta();

    expect(mockSyncDelta).toHaveBeenCalledTimes(1);
    expect(typeof mockSyncDelta.mock.calls[0][0]?.aoSubir).toBe('function');
    // Uma vez — a de dentro do ciclo. Uma segunda chamada, depois do `await`, é
    // exatamente a que o iOS congela em background.
    expect(mockNotifyActivitySync).toHaveBeenCalledTimes(1);
    expect(mockNotifyActivitySync).toHaveBeenCalledWith(RESULTADO.syncedActivities);
  });

  it('a de tarefas automáticas continua no fim, porque as tarefas nascem depois do upsert', async () => {
    mockSyncDelta.mockResolvedValue(RESULTADO);
    await useFitnessStore.getState().runDelta();
    expect(mockNotifyAutoTasks).toHaveBeenCalledWith(2);
  });
});
