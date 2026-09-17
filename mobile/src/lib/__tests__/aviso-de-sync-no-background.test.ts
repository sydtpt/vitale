/**
 * BARREIRA — o aviso de atividade sincronizada cabe na janela de background.
 *
 * Medido no iPhone em 17/09/2026: um treino de yoga terminou às 08:20:57, o
 * HealthKit acordou o app fechado às 08:21:20 e o treino estava no Supabase às
 * 08:21:21 — mas a notificação só apareceu às 08:34, quando o dono abriu o app.
 * As migalhas deram o motivo sem ambiguidade: `delta 793227ms`, o mesmo ciclo,
 * 13 min 13 s, começado em background e terminado no primeiro plano.
 *
 * O `@kingstinct/react-native-healthkit` chama o `completionHandler` do observer
 * na hora, e o iOS congela o app segundos depois. O delta leva 8–11 s mesmo com o
 * app aberto (rotas, zonas de FC, tarefas, fotos, âncora, rotas faltantes, piso),
 * e a notificação era o ÚLTIMO passo. O treino subia; o aviso esperava a próxima
 * abertura.
 *
 * O conserto é a ordem: o aviso sai logo depois do upsert das atividades, antes
 * de todo o resto, e é esperado — é o único passo do ciclo que o dono vê com o
 * app fechado. Esta suíte prende essa ordem.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

/** A ordem em que os passos do ciclo aconteceram. */
const mockPassos: string[] = [];
const mockUpsert: { erro: string | null } = { erro: null };

jest.mock('../supabase', () => ({
  __esModule: true,
  supabase: {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'u-1' } } } }) },
    rpc: async (nome: string) => {
      mockPassos.push(`rpc:${nome}`);
      return { error: mockUpsert.erro ? { message: mockUpsert.erro } : null };
    },
    functions: { invoke: async () => ({ error: null }) },
  },
}));

jest.mock('../healthkit-workouts', () => {
  const tipos = jest.requireActual('../workout-types') as Record<string, unknown>;
  return {
    __esModule: true,
    ...tipos,
    fetchAllWorkouts: async () => [],
    fetchWorkoutsDelta: async () => ({
      anchor: 'ancora-nova',
      workouts: [
        {
          id: 'hk-yoga-1',
          activityId: 57,
          activityName: 'Yoga',
          calories: 40,
          start: '2026-09-17T06:05:57.000Z',
          end: '2026-09-17T06:20:57.000Z',
          duration: 900,
          movingTimeS: 900,
          sourceName: 'Fitness',
        },
      ],
    }),
    fetchWorkoutRoute: async () => [],
    fetchWorkoutHeartRate: async () => [],
    fetchHrZoneParams: async () => ({ maxHr: 0, restingHr: 0 }),
  };
});

jest.mock('../synced-types', () => ({
  __esModule: true,
  subscribeType: async () => {},
  loadSyncedTypes: async () => {
    const { getActivityMeta } = jest.requireActual('../workout-types') as {
      getActivityMeta: (id: number) => { label: string };
    };
    return new Set([getActivityMeta(57).label]);
  },
}));

jest.mock('../connections', () => ({
  __esModule: true,
  bridgeStubKeepFilter: async () => () => true,
}));

jest.mock('../sync-anchor', () => ({
  __esModule: true,
  // Com âncora: é o caminho em que tarefas e fotos também rodam depois do upsert.
  readAnchor: async () => 'ancora-velha',
  writeAnchor: async () => {
    mockPassos.push('ancora');
  },
}));

jest.mock('../sync-queue', () => ({
  __esModule: true,
  enqueue: async () => {},
  drainQueue: async () => 0,
}));

jest.mock('../../services/activity-todo-link', () => ({
  __esModule: true,
  linkWorkoutsToTodos: async () => {
    mockPassos.push('tarefas');
    return 0;
  },
}));

jest.mock('../../services/activity-photos', () => ({
  __esModule: true,
  linkNewActivityPhotos: async () => {
    mockPassos.push('fotos');
  },
}));

jest.mock('../../store/settings.store', () => ({
  __esModule: true,
  useSettingsStore: { getState: () => ({ preferences: {} }) },
}));

jest.mock('../surface-osm', () => ({
  __esModule: true,
  surfaceFailureMeta: () => ({}),
  surfaceOfOverview: async () => ({ segments: [], meta: {}, mix: {} }),
}));

jest.mock('@vitale/shared', () => {
  const actual = jest.requireActual('@vitale/shared') as Record<string, unknown>;
  return {
    __esModule: true,
    ...actual,
    fetchRouteBackfillCandidates: async () => {
      mockPassos.push('rotas-faltantes');
      return [];
    },
    fetchSurfaceCandidates: async () => {
      mockPassos.push('piso');
      return [];
    },
  };
});

import { syncDelta, type SyncedActivity } from '../../services/activity-sync';

describe('BARREIRA — o aviso sai logo depois do upsert, antes do resto do ciclo', () => {
  beforeEach(() => {
    mockPassos.length = 0;
    mockUpsert.erro = null;
  });

  it('avisa com as atividades que subiram, e termina antes de tarefas, fotos, âncora, rotas faltantes e piso', async () => {
    let recebidas: readonly SyncedActivity[] = [];
    const r = await syncDelta({
      aoSubir: async (atividades) => {
        mockPassos.push('aviso:começo');
        recebidas = atividades;
        // Um passo assíncrono de verdade dentro do aviso: o ciclo tem de esperar
        // por ele, e não só disparar e seguir.
        await Promise.resolve();
        mockPassos.push('aviso:fim');
      },
    });

    expect(r.ok).toBe(true);
    expect(recebidas).toEqual([{ id: 'hk-yoga-1', activityId: 57 }]);

    const i = (passo: string) => mockPassos.indexOf(passo);
    expect(i('rpc:sync_upsert_activities')).toBeGreaterThanOrEqual(0);
    expect(i('aviso:começo')).toBeGreaterThan(i('rpc:sync_upsert_activities'));
    for (const depois of ['tarefas', 'fotos', 'ancora', 'rotas-faltantes', 'piso']) {
      expect(i(depois)).toBeGreaterThan(i('aviso:fim'));
    }
  });

  it('o resultado continua trazendo as atividades enviadas, com ou sem aviso', async () => {
    const r = await syncDelta();
    expect(r.syncedActivities).toEqual([{ id: 'hk-yoga-1', activityId: 57 }]);
    expect(mockPassos).toContain('ancora');
  });

  it('upsert que falhou não avisa — nada subiu', async () => {
    mockUpsert.erro = 'rede';
    const aoSubir = jest.fn(async () => {});
    const r = await syncDelta({ aoSubir });
    expect(aoSubir).not.toHaveBeenCalled();
    expect(r.syncedActivities).toEqual([]);
  });

  it('aviso que lança não derruba o sync: a âncora anda e o resto do ciclo roda', async () => {
    const r = await syncDelta({
      aoSubir: async () => {
        throw new Error('permissão de notificação sumiu');
      },
    });
    expect(r.ok).toBe(true);
    expect(mockPassos).toEqual(expect.arrayContaining(['tarefas', 'fotos', 'ancora', 'rotas-faltantes', 'piso']));
  });
});
