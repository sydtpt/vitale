/**
 * BARREIRA — o delta nunca varre o histórico inteiro.
 *
 * `syncDelta` roda sozinho: no cold start da sessão, a cada volta ao primeiro
 * plano e a cada treino novo que o observer do HealthKit anuncia. Para cada
 * treino que ele traz, o serviço busca a rota GPS e as amostras de FC — em
 * série, uma chamada nativa por vez. Com a janela em `YEARS_BACK` isso são ~400
 * treinos, dezenas de minutos de ponte, sem nada na tela indicando trabalho.
 *
 * E o modo de falha não é só lentidão: a âncora só é gravada no FIM do ciclo.
 * Fechar o app antes disso faz o próximo lançamento recomeçar do zero — o sync
 * automático nunca converge, em silêncio. Foi o que aconteceu quando a troca de
 * adaptador (kingstinct) invalidou a âncora do react-native-health e devolveu
 * `readAnchor` a null: nada subiu ao servidor por dias.
 *
 * Varrer o histórico é trabalho do backfill (`syncType`), disparado pelo
 * usuário e com barra de progresso. O delta pega a janela recente, grava a
 * âncora e a partir daí anda incremental.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';

const mockQueryWorkouts = jest.fn();

jest.mock('../health-source/active', () => {
  const actual = jest.requireActual('../health-source/contract');
  return {
    __esModule: true,
    ...actual,
    healthSource: {
      id: 'test',
      isAvailable: () => true,
      queryWorkouts: (...args: unknown[]) => mockQueryWorkouts(...args),
    },
  };
});

import { fetchWorkoutsDelta } from '../healthkit-workouts';
import { DELTA_CATCHUP_DAYS, YEARS_BACK } from '../workout-types';

/** Dias entre `iso` e agora. */
const daysAgo = (iso: string) => (Date.now() - new Date(iso).getTime()) / 86_400_000;

describe('BARREIRA — janela do delta de treinos', () => {
  beforeEach(() => {
    mockQueryWorkouts.mockReset();
    mockQueryWorkouts.mockResolvedValue({ workouts: [], anchor: 'nova' });
  });

  it('sem âncora, pede só a janela de catch-up — não o histórico', async () => {
    await fetchWorkoutsDelta(null);

    const { startDate } = mockQueryWorkouts.mock.calls[0][0];
    expect(daysAgo(startDate)).toBeCloseTo(DELTA_CATCHUP_DAYS, 1);
    // O ponto todo da barreira: nem perto de YEARS_BACK.
    expect(daysAgo(startDate)).toBeLessThan(YEARS_BACK * 365);
  });

  it('sem âncora, devolve a âncora nova — é o que tira o próximo ciclo do zero', async () => {
    const { anchor } = await fetchWorkoutsDelta(null);
    expect(anchor).toBe('nova');
    expect(mockQueryWorkouts.mock.calls[0][0].anchor).toBeUndefined();
  });

  it('com âncora, a janela volta a ser ampla — quem filtra é a âncora, não a data', async () => {
    await fetchWorkoutsDelta('anc-123');

    const { startDate, anchor } = mockQueryWorkouts.mock.calls[0][0];
    expect(anchor).toBe('anc-123');
    expect(daysAgo(startDate)).toBeGreaterThan(YEARS_BACK * 364);
  });
});
