/**
 * Cobertura de tipos da porta de saúde.
 *
 * Este arquivo já foi maior. Ele guardava também os tradutores do adaptador
 * legado — o dicionário que mapeava cada identificador do HealthKit para o nome
 * de método e a constante de permissão de `react-native-health`. Um tipo sem
 * tradutor não quebrava o build nem lançava em runtime: a chamada resolvia `[]`
 * e a métrica aparecia vazia como se não houvesse dado.
 *
 * Aqueles testes saíram junto com o adaptador (ADR 0012 / 0013). Não é perda de
 * cobertura: `@kingstinct/react-native-healthkit` usa os identificadores da
 * Apple diretamente, então **não existe dicionário para ficar dessincronizado**.
 * Era exatamente esse o ganho que a porta prometia ao trocar de implementação.
 *
 * O que sobra aqui é o que continua sendo verdade sobre a porta em si.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

jest.mock('@kingstinct/react-native-healthkit', () => ({
  __esModule: true,
  isHealthDataAvailable: jest.fn(() => false),
}));

import { HK, type HealthTypeId } from '../health-source/contract';
import { WORKOUT_PERMISSIONS } from '../healthkit-workouts';

const ALL_TYPES = Object.values(HK) as HealthTypeId[];

describe('porta de saúde — identificadores', () => {
  it('cada identificador do HealthKit é único', () => {
    expect(new Set(ALL_TYPES).size).toBe(ALL_TYPES.length);
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

/**
 * BARREIRA — o dedupe multi-fonte cobre exatamente as cumulativas certas.
 *
 * Quando iPhone e relógio (e apps como Garmin/Strava) escrevem o MESMO dia, a
 * soma ingênua do HealthKit dobra a contagem. `multiSourceFetch` é o caminho
 * que puxa as amostras cruas com `sourceId` e passa por `dedupeBySource`
 * (ADR 0004); qualquer outra métrica lê pelo caminho agregado, que soma tudo.
 *
 * Pôr uma cumulativa multi-fonte no caminho errado não quebra nada visível —
 * o número simplesmente vem inflado, e parece um dia bom.
 *
 * A guarda é de código-fonte porque importar `config/health-metrics` arrasta
 * tema → settings.store → client do Supabase, que não sobe sob o jest. A lista
 * vivia antes no mapa `SOURCED_TYPE_BY_ID` do adaptador legado, que saiu com
 * ele — sem isto, a propriedade ficaria sem dono.
 */
describe('BARREIRA — cumulativas multi-fonte', () => {
  it('são só as quatro que iPhone e relógio escrevem ao mesmo tempo', () => {
    const fonte = readFileSync(join(__dirname, '..', '..', 'config', 'health-metrics.ts'), 'utf8');
    const usos = [...fonte.matchAll(/multiSourceFetch\(\s*HK\.(\w+)/g)].map((m) => m[1]);

    expect(new Set(usos)).toEqual(
      new Set(['stepCount', 'distanceWalkingRunning', 'flightsClimbed', 'activeEnergyBurned']),
    );
  });
});
