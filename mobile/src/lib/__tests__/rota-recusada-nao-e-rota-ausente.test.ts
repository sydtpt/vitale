/**
 * BARREIRA — recusa do HealthKit não é ausência de rota.
 *
 * Diagnosticado em 29/09/2026, numa pedalada longa e nova: o compartilhar não
 * oferecia "Mostrar cidades", o contador de cidades não subia e o piso não
 * aparecia — com o traçado visível no mapa.
 *
 * O iOS acorda o app pelo observer do HealthKit **com o aparelho trancado**, e
 * nesse estado ele recusa todo dado protegido (`Code=6`,
 * "Protected health data is inaccessible"). O `queryWorkoutRoute` devolvia `[]`
 * nesse caso, sem migalha, e o vazio ficava indistinguível de "este treino não
 * tem rota". Daí saíam dois estragos, que esta suíte prende:
 *
 * 1. O `retryMissingRoutes` gravava `has_route = false` como veredito. Sem
 *    linha em `activity_routes` não há piso; com `has_route = false` o
 *    `enrichCities` (edge function) nunca enriquece as cidades.
 * 2. Quando a rota finalmente chegava pelo retry, **nada acionava o
 *    enriquecimento**: a varredura server-side saía antes desse passo e só com
 *    `pushed > 0`. Num sync que só recupera rota, ela não saía — e a atividade
 *    ficava com rota e sem cidades para sempre.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

/** O que o ciclo pediu ao servidor, na ordem. */
const mockChamadas: string[] = [];
/** `has_route` gravado pelo retry: [id, valor]. */
const mockHasRoute: [string, boolean][] = [];
/** O que o HealthKit responde quando perguntam pela rota. */
const mockRota: { points: { latitude: number; longitude: number }[]; answered: boolean } = {
  points: [],
  answered: true,
};
/** A atividade que o retry encontra sem rota persistida. */
const mockCandidatas: { id: string; hasRoute: boolean }[] = [];

jest.mock('../supabase', () => ({
  __esModule: true,
  supabase: {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'u-1' } } } }) },
    rpc: async () => ({ error: null }),
    functions: {
      invoke: async (nome: string, opts: { body?: { mode?: string } }) => {
        mockChamadas.push(`invoke:${nome}:${opts?.body?.mode ?? ''}`);
        return { error: null };
      },
    },
  },
}));

jest.mock('../healthkit-workouts', () => {
  const tipos = jest.requireActual('../workout-types') as Record<string, unknown>;
  return {
    __esModule: true,
    ...tipos,
    fetchAllWorkouts: async () => [],
    // Nenhum treino novo: é o sync que SÓ recupera rota — `pushed = 0`.
    fetchWorkoutsDelta: async () => ({ anchor: 'ancora-nova', workouts: [] }),
    fetchWorkoutRoute: async () => mockRota,
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
    return new Set([getActivityMeta(13).label]);
  },
}));

jest.mock('../connections', () => ({
  __esModule: true,
  bridgeStubKeepFilter: async () => () => true,
}));

jest.mock('../sync-anchor', () => ({
  __esModule: true,
  readAnchor: async () => 'ancora-velha',
  writeAnchor: async () => {},
}));

jest.mock('../sync-queue', () => ({
  __esModule: true,
  enqueue: async () => {},
  drainQueue: async () => 0,
}));

jest.mock('../../services/activity-todo-link', () => ({
  __esModule: true,
  linkWorkoutsToTodos: async () => 0,
}));

jest.mock('../../services/activity-photos', () => ({
  __esModule: true,
  linkNewActivityPhotos: async () => {},
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
    fetchRouteBackfillCandidates: async () => mockCandidatas,
    fetchExistingRouteIds: async () => new Set<string>(),
    upsertActivityRoute: async () => {
      mockChamadas.push('rota:subiu');
    },
    setActivityHasRoute: async (_db: unknown, _u: string, id: string, v: boolean) => {
      mockHasRoute.push([id, v]);
    },
    fetchSurfaceCandidates: async () => [],
  };
});

import { syncDelta } from '../../services/activity-sync';

describe('BARREIRA — recusa do HealthKit não é ausência de rota', () => {
  beforeEach(() => {
    mockChamadas.length = 0;
    mockHasRoute.length = 0;
    mockCandidatas.length = 0;
    mockRota.points = [];
    mockRota.answered = true;
  });

  it('o aparelho trancado NÃO faz o retry gravar has_route = false', async () => {
    mockCandidatas.push({ id: 'bike-hoje', hasRoute: true });
    // O HealthKit recusou: vazio que não é resposta.
    mockRota.points = [];
    mockRota.answered = false;

    await syncDelta();

    expect(mockHasRoute).toEqual([]);
  });

  it('o treino que realmente não tem rota continua virando has_route = false', async () => {
    mockCandidatas.push({ id: 'indoor-1', hasRoute: true });
    mockRota.points = [];
    mockRota.answered = true;

    await syncDelta();

    expect(mockHasRoute).toEqual([['indoor-1', false]]);
  });

  it('a rota recuperada tarde aciona a varredura, mesmo com pushed = 0', async () => {
    mockCandidatas.push({ id: 'bike-hoje', hasRoute: false });
    mockRota.points = [
      { latitude: 50.64, longitude: 4.26 },
      { latitude: 50.65, longitude: 4.27 },
    ];
    mockRota.answered = true;

    await syncDelta();

    expect(mockChamadas).toContain('rota:subiu');
    expect(mockChamadas).toContain('invoke:connections-ingest:reconcile');
    // E a varredura vem DEPOIS da rota subir: é o `has_route = true` recém-gravado
    // que faz o `enrichCities` enxergar a atividade.
    expect(mockChamadas.indexOf('invoke:connections-ingest:reconcile')).toBeGreaterThan(
      mockChamadas.indexOf('rota:subiu'),
    );
  });

  it('sem rota recuperada não há varredura — o sync vazio não fala com o servidor', async () => {
    await syncDelta();

    expect(mockChamadas).toEqual([]);
  });
});
