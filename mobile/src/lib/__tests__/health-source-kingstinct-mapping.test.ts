/**
 * Cobertura das tabelas de tradução do adaptador kingstinct.
 *
 * Diferente do legado (`health-source-mapping.test.ts`), esta lib não precisa
 * de dicionário de nome-de-método nem de permissão — os identificadores do
 * HealthKit são usados diretamente. O que precisa de cobertura aqui é outra
 * coisa: os enums numéricos que a lib devolve (estágio de sono, tipo de
 * evento de treino) e que o adaptador traduz para os rótulos em string que o
 * resto do app espera. Um valor sem tradução não quebra o build — vira uma
 * amostra descartada ou um evento de pausa não reconhecido, silenciosamente.
 */
import { describe, it, expect } from '@jest/globals';

jest.mock('@kingstinct/react-native-healthkit', () => ({
  __esModule: true,
  configureBackgroundTypes: jest.fn(),
  getBiologicalSexAsync: jest.fn(),
  getBloodTypeAsync: jest.fn(),
  getDateOfBirthAsync: jest.fn(),
  isHealthDataAvailable: jest.fn(() => false),
  queryCategorySamples: jest.fn(),
  queryCorrelationSamples: jest.fn(),
  queryQuantitySamples: jest.fn(),
  queryStatisticsCollectionForQuantity: jest.fn(),
  queryWorkoutSamples: jest.fn(),
  queryWorkoutSamplesWithAnchor: jest.fn(),
  requestAuthorization: jest.fn(),
  subscribeToChanges: jest.fn(() => ({ remove: () => {} })),
  UpdateFrequency: { immediate: 1, hourly: 2, daily: 3, weekly: 4 },
}));

import { queryWorkoutSamples } from '@kingstinct/react-native-healthkit';
import { KINGSTINCT_MAPS } from '../health-source/kingstinct-provider';
import { kingstinctHealthSource } from '../health-source/kingstinct-provider';

const { UNIT_ALIAS, SLEEP_LABEL, WORKOUT_EVENT_LABEL } = KINGSTINCT_MAPS;

describe('adaptador kingstinct — cobertura das traduções', () => {
  it('CategoryValueSleepAnalysis (0-5) tem rótulo — HealthKit não define outros valores', () => {
    for (let v = 0; v <= 5; v++) {
      expect(SLEEP_LABEL[v]).toBeDefined();
    }
  });

  it('os rótulos de sono são exatamente os que aggregateSleepNights reconhece', () => {
    expect(new Set(Object.values(SLEEP_LABEL))).toEqual(
      new Set(['INBED', 'ASLEEP', 'AWAKE', 'CORE', 'DEEP', 'REM']),
    );
  });

  it('pause/resume/motionPaused/motionResumed (1,2,5,6) têm rótulo — os únicos que pausedSecondsFromEvents lê', () => {
    expect(WORKOUT_EVENT_LABEL[1]).toBe('pause');
    expect(WORKOUT_EVENT_LABEL[2]).toBe('resume');
    expect(WORKOUT_EVENT_LABEL[5]).toBe('motion paused');
    expect(WORKOUT_EVENT_LABEL[6]).toBe('motion resumed');
  });

  it('todo alias de unidade do react-native-health traduz para uma string HKUnit distinta', () => {
    const aliases = Object.keys(UNIT_ALIAS);
    expect(aliases.sort()).toEqual(
      ['bpm', 'gram', 'percent', 'calorie', 'kilocalorie', 'meter', 'count'].sort(),
    );
    // Nenhum alias devolve string vazia nem permanece igual ao apelido do
    // legado quando a Apple exige outra grafia (ex.: 'bpm' → 'count/min').
    // 'count' é a exceção real: "count" já é a grafia HKUnit para as duas.
    for (const [alias, canonical] of Object.entries(UNIT_ALIAS)) {
      expect(canonical.length).toBeGreaterThan(0);
      if (alias === 'count') continue;
      expect(canonical).not.toBe(alias);
    }
  });
});

/**
 * O treino que esta lib devolve é um HybridObject do Nitro: cada propriedade
 * lida é uma travessia SÍNCRONA da ponte pro Swift. Com `PAGE_SIZE = 1000` e
 * ~12 leituras por treino, isso são ~12.000 travessias na thread JS — foi o
 * que congelou a aba "Sync de atividades" ao abrir. `toJSON()` traz tudo numa
 * chamada só.
 *
 * O proxy falso abaixo EXPLODE se qualquer propriedade for lida direto, então
 * o teste falha se alguém voltar a ler do proxy — a regressão não tem sintoma
 * em teste (o mapeamento continua correto), só trava no device.
 */
describe('adaptador kingstinct — mapeamento de treino não atravessa a ponte por propriedade', () => {
  const snapshot = {
    uuid: 'w1',
    workoutActivityType: 37,
    duration: { quantity: 1800 },
    totalEnergyBurned: { quantity: 250 },
    totalDistance: { quantity: 5000 },
    startDate: new Date('2026-08-19T10:00:00.000Z'),
    endDate: new Date('2026-08-19T10:30:00.000Z'),
    sourceRevision: { source: { name: 'Watch', bundleIdentifier: 'com.apple.health' } },
    device: { name: 'Apple Watch' },
    metadata: {},
    events: [],
  };

  /** Proxy que só tolera `toJSON()`; qualquer outra leitura lança. */
  function explodingProxy() {
    const forbidden = () => {
      throw new Error('leitura de propriedade no proxy — use toJSON()');
    };
    return new Proxy(
      { toJSON: () => snapshot },
      {
        get(target, prop) {
          if (prop === 'toJSON') return target.toJSON;
          return forbidden();
        },
      },
    );
  }

  it('lê o treino por toJSON(), sem tocar nas propriedades do proxy', async () => {
    (queryWorkoutSamples as jest.Mock).mockResolvedValueOnce([explodingProxy()]);

    const { workouts } = await kingstinctHealthSource.queryWorkouts({
      startDate: '2026-08-01T00:00:00.000Z',
      limit: 1000,
      ascending: false,
    });

    expect(workouts).toHaveLength(1);
    expect(workouts[0].id).toBe('w1');
    expect(workouts[0].activityId).toBe(37);
    expect(workouts[0].start).toBe('2026-08-19T10:00:00.000Z');
  });
});

/**
 * `toJSON()` do treino não converte em profundidade: `sourceRevision.source`
 * continua sendo um `SourceProxy`. E o `HybridObject` base do Nitro declara
 * `name` como "o nome do HybridObject", sombreando o `name` da fonte — ler
 * `.name` direto devolve a string "SourceProxy".
 *
 * Isso chegou a produção: três atividades foram gravadas no Supabase com
 * `source_name = 'SourceProxy'` em vez de 'Strava'. A falha não tem sintoma —
 * o valor tem o tipo certo e atravessa a pilha inteira sem reclamar.
 *
 * O dublê abaixo reproduz exatamente a colisão: `.name` devolve o nome da
 * classe, `toJSON()` devolve a fonte de verdade.
 */
describe('adaptador kingstinct — o nome da fonte vem do toJSON(), não do proxy', () => {
  /** SourceProxy como o Nitro o entrega: `.name` sombreado pelo HybridObject. */
  const sourceProxy = {
    name: 'SourceProxy',
    bundleIdentifier: 'com.strava.stravaride',
    toJSON: () => ({ name: 'Strava', bundleIdentifier: 'com.strava.stravaride' }),
  };

  const workoutComProxyDeFonte = {
    toJSON: () => ({
      uuid: 'w2',
      workoutActivityType: 37,
      duration: { quantity: 1800 },
      startDate: new Date('2026-08-20T10:00:00.000Z'),
      endDate: new Date('2026-08-20T10:30:00.000Z'),
      sourceRevision: { source: sourceProxy },
      metadata: {},
      events: [],
    }),
  };

  it('grava o nome real da fonte, não o nome da classe do HybridObject', async () => {
    (queryWorkoutSamples as jest.Mock).mockResolvedValueOnce([workoutComProxyDeFonte]);

    const { workouts } = await kingstinctHealthSource.queryWorkouts({
      startDate: '2026-08-01T00:00:00.000Z',
      limit: 1000,
      ascending: false,
    });

    expect(workouts[0].sourceName).toBe('Strava');
    expect(workouts[0].sourceName).not.toBe('SourceProxy');
    // bundleIdentifier não colide — é o campo que o dedupeBySource usa (ADR 0004).
    expect(workouts[0].sourceId).toBe('com.strava.stravaride');
  });

  it('tolera fonte já serializada, sem toJSON — nem toda amostra vem por proxy', async () => {
    (queryWorkoutSamples as jest.Mock).mockResolvedValueOnce([
      {
        toJSON: () => ({
          ...workoutComProxyDeFonte.toJSON(),
          sourceRevision: { source: { name: 'Apple Watch', bundleIdentifier: 'com.apple.health' } },
        }),
      },
    ]);

    const { workouts } = await kingstinctHealthSource.queryWorkouts({
      startDate: '2026-08-01T00:00:00.000Z',
      limit: 1000,
      ascending: false,
    });

    expect(workouts[0].sourceName).toBe('Apple Watch');
  });
});
