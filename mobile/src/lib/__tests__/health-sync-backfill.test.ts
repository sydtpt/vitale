/**
 * BARREIRA — um bump de `AGG_VERSION` nunca é acidente.
 *
 * `AGG_VERSION` mora no núcleo desde a Story 1.1, num arquivo cujo docblock fala
 * de errata. Quem edita aquele número hoje não está lendo `health-sync.ts` — e é
 * lá que a conta é paga. Trocar 9 por 10 faz, no primeiro ciclo de sincronização
 * de **todos** os dispositivos, `precisaBackfill` devolver `true` sozinho:
 *
 *   - até 200 dias de métricas pesadas (FC crua, ~1.300 amostras/dia no Watch e
 *     5.700 em dia de treino), puxadas do HealthKit em fatias de 30 dias;
 *   - 500 dias de todas as outras métricas;
 *   - a reagregação completa do sono, que reescreve `sleep_periods` e as linhas
 *     diárias derivadas dele.
 *
 * Nada disso aparece na tela e nada disso foi pedido pelo usuário. Sem este
 * teste, o bump passa com as cinco suítes verdes, porque nenhuma delas executa
 * `syncHealth` nem observa o valor.
 *
 * Então o número está congelado aqui. Este teste **deve** ficar vermelho no dia
 * em que a versão subir — o vermelho é o pedido de confirmação, não um defeito.
 * Subir a versão de propósito é atualizar este arquivo no mesmo commit, junto
 * com a entrada nova na história em `constants/agg-version.ts`.
 */
import { describe, it, expect } from '@jest/globals';
import { AGG_VERSION } from '@vitale/shared';
import { precisaBackfill } from '../health-sync-cursor';

describe('BARREIRA — o valor de AGG_VERSION', () => {
  it('continua em 9 — subir custa um re-backfill em todos os aparelhos', () => {
    expect(AGG_VERSION).toBe(9);
  });
});

describe('a decisão de backfill do sync de saúde', () => {
  /**
   * Esta é exatamente a linha que `syncHealth` grava ao fim de um ciclo bem
   * sucedido (`writeHealthCursor(userId, { lastDay, version: AGG_VERSION })`).
   * Se ela disparasse backfill, todo ciclo seria um backfill.
   */
  it('cursor na versão vigente não dispara backfill', () => {
    expect(precisaBackfill({ lastDay: '2026-09-08', version: AGG_VERSION })).toBe(false);
  });

  it('cursor uma versão atrás dispara backfill — é o mecanismo de recorreção', () => {
    expect(precisaBackfill({ lastDay: '2026-09-08', version: AGG_VERSION - 1 })).toBe(true);
  });

  it('dispositivo que nunca sincronizou faz backfill, mesmo na versão vigente', () => {
    expect(precisaBackfill({ lastDay: null, version: AGG_VERSION })).toBe(true);
  });

  /**
   * O cursor antigo guardava só a string do dia, e `readHealthCursor` o traduz
   * para `version: 0`. Zero é uma versão medida, e é menor que a vigente: o
   * aparelho que ainda não passou por nenhum bump se recorrige uma vez.
   */
  it('cursor legado (versão 0) ainda faz o backfill de recorreção', () => {
    expect(precisaBackfill({ lastDay: '2026-09-08', version: 0 })).toBe(true);
  });

  /**
   * A comparação é `<`, não `!==`: um cursor à FRENTE da versão do app não pede
   * backfill. Acontece de verdade quando um build novo é instalado e depois se
   * volta ao anterior — refazer 500 dias por causa disso seria castigo sem causa.
   */
  it('cursor à frente do app não dispara backfill', () => {
    expect(precisaBackfill({ lastDay: '2026-09-08', version: AGG_VERSION + 1 })).toBe(false);
  });
});
