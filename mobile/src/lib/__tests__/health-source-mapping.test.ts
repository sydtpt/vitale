/**
 * Cobertura da tradução da porta de saúde.
 *
 * A porta fala identificadores do HealthKit; o adaptador legado os traduz para o
 * dialeto de `react-native-health`. Um identificador sem tradutor **não quebra o
 * build e não lança em runtime** — a chamada simplesmente resolve `[]`, e a
 * métrica aparece vazia como se não houvesse dado. É a falha silenciosa que este
 * teste existe para tornar impossível.
 *
 * Vale igualmente para o adaptador que vier depois: ao trocar a implementação,
 * este teste é o que garante que nenhum dos 29 tipos ficou para trás.
 */
import { describe, it, expect } from '@jest/globals';

// A lib nativa não roda sob o jest; só os mapas do adaptador interessam aqui.
jest.mock('react-native-health', () => ({
  __esModule: true,
  default: { Constants: { Permissions: {} } },
}));

import { HK, type HealthTypeId } from '../health-source/contract';
import { LEGACY_MAPS } from '../health-source/legacy-provider';
// `HEALTH_PERMISSIONS` fica fora daqui de propósito: importar `config/health-metrics`
// arrasta tema → settings.store → client do Supabase, que não sobe sob o jest. A
// propriedade que interessa (todo tipo tem permissão) é verificada sobre o `HK`
// inteiro logo abaixo, que é um superconjunto daquela lista.
import { WORKOUT_PERMISSIONS } from '../healthkit-workouts';

const { METHOD_BY_TYPE, SOURCED_TYPE_BY_ID, PERMISSION_BY_TYPE } = LEGACY_MAPS;

const ALL_TYPES = Object.values(HK) as HealthTypeId[];

/**
 * Tipos que não são lidos como série de amostras: treino tem consulta própria,
 * rota é acessada pelo id do treino, e os demais são característica ou agregado.
 */
const NOT_SAMPLE_QUERIES: readonly HealthTypeId[] = [
  HK.workout,
  HK.workoutRoute,
  HK.activitySummary,
  HK.dateOfBirth,
  HK.biologicalSex,
  HK.bloodType,
  // Pedimos permissão para os dois, mas a leitura de pressão traz sístole e
  // diástole na mesma amostra, consultada pelo identificador da sístole.
  HK.bloodPressureDiastolic,
  // Autorizada para o cálculo de gasto total; nenhuma métrica a plota hoje.
  HK.basalEnergyBurned,
];

describe('porta de saúde — cobertura da tradução', () => {
  it('cada identificador do HealthKit é único', () => {
    expect(new Set(ALL_TYPES).size).toBe(ALL_TYPES.length);
  });

  it('todo tipo tem permissão mapeada — sem isso a leitura é negada em silêncio', () => {
    const orphans = ALL_TYPES.filter((t) => !PERMISSION_BY_TYPE[t]);
    expect(orphans).toEqual([]);
  });

  it('todo tipo lido como amostra tem tradutor no adaptador legado', () => {
    const orphans = ALL_TYPES.filter(
      (t) => !NOT_SAMPLE_QUERIES.includes(t) && !METHOD_BY_TYPE[t] && !SOURCED_TYPE_BY_ID[t],
    );
    expect(orphans).toEqual([]);
  });

  it('as exceções declaradas são exatamente as que não têm tradutor de amostra', () => {
    const untranslated = ALL_TYPES.filter((t) => !METHOD_BY_TYPE[t] && !SOURCED_TYPE_BY_ID[t]);
    expect(untranslated.sort()).toEqual([...NOT_SAMPLE_QUERIES].sort());
  });

  it('as cumulativas multi-fonte são só as quatro com iPhone e relógio escrevendo', () => {
    expect(Object.keys(SOURCED_TYPE_BY_ID).sort()).toEqual(
      [HK.stepCount, HK.distanceWalkingRunning, HK.flightsClimbed, HK.activeEnergyBurned].sort(),
    );
  });
});

describe('porta de saúde — listas de permissão', () => {
  it('a aba de treinos não pede tipo desconhecido nem repetido', () => {
    expect(WORKOUT_PERMISSIONS.filter((t) => !ALL_TYPES.includes(t))).toEqual([]);
    expect(new Set(WORKOUT_PERMISSIONS).size).toBe(WORKOUT_PERMISSIONS.length);
  });

  it('treino e rota estão entre as permissões da aba de treinos', () => {
    expect(WORKOUT_PERMISSIONS).toContain(HK.workout);
    expect(WORKOUT_PERMISSIONS).toContain(HK.workoutRoute);
  });
});
