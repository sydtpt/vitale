/**
 * BARREIRA — o cliente espera mais do que o servidor pediu.
 *
 * Medido em produção em 10/10/2026, no erro que finalmente ficou visível:
 *
 *     overpass indisponível — overpass-api.de timeout 25s · overpass.kumi…
 *
 * A consulta declarava `[timeout:25]` e o `AbortController` do app também
 * abortava em 25 s. Uma consulta que usasse todo o orçamento do servidor
 * **nunca** podia ser entregue: o aborto disparava no mesmo instante em que a
 * resposta começaria a viajar — e viajava por 4G. Os dois espelhos "falhavam"
 * por uma conta que não fechava, não por estarem fora do ar.
 *
 * Esta barreira não testa um valor; testa a **relação**. Qualquer ajuste
 * futuro num dos dois tempos reprova aqui se a folga sumir.
 */
import { describe, it, expect } from '@jest/globals';
import { OVERPASS_TIMEOUT_S, TIMEOUT_MS } from '../surface-osm';

describe('BARREIRA — o tempo do cliente cobre o do servidor', () => {
  it('o cliente espera mais que o orçamento declarado ao Overpass', () => {
    expect(TIMEOUT_MS).toBeGreaterThan(OVERPASS_TIMEOUT_S * 1000);
  });

  it('a folga é suficiente para a resposta viajar, não só um arredondamento', () => {
    const folgaS = TIMEOUT_MS / 1000 - OVERPASS_TIMEOUT_S;
    // Resposta de rota longa, com `out geom`, por rede móvel: segundos, não
    // milissegundos. Abaixo de 10 s a folga é decorativa.
    expect(folgaS).toBeGreaterThanOrEqual(10);
  });

  it('o orçamento do servidor cabe no que o Overpass aceita', () => {
    // A política pública tolera consultas longas, mas pedir muito é abuso —
    // e um passe que trava 3 min dentro do sync é pior que um que falha.
    expect(OVERPASS_TIMEOUT_S).toBeGreaterThanOrEqual(25);
    expect(OVERPASS_TIMEOUT_S).toBeLessThanOrEqual(90);
  });
});
