/**
 * BARREIRA — o pedágio do Nominatim é do app inteiro, não de cada passe.
 *
 * Medido no iPhone em 10/10/2026, na primeira versão do passe no aparelho: ela
 * respeitava 1,1 s *dentro* de cada enriquecimento e nada impedia vários de
 * rodarem juntos. Abrir três pedaladas em sequência deu três laços pedindo ao
 * mesmo tempo — ~2,7 req/s — e o log registrou `geocode HTTP 429` nas três, às
 * 20:41:17, 20:41:18 e 20:41:18, mais uma repetição a cada reavaliação do
 * efeito (20:41:46, 20:42:54).
 *
 * O limite do Nominatim é por cliente. Um pedágio por passe é, por construção,
 * o limite multiplicado pelo número de telas abertas.
 */
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  CASTIGO_429_MS,
  GeocoderDeCastigo,
  INTERVALO_MS,
  castigoAtivoAte,
  cidadesDaRota,
  limparPedagio,
} from '../geocode-osm';

/** Duas coordenadas a ~2 km: viram duas amostras, logo duas chamadas. */
const DOIS_PONTOS = [
  { lat: 50.64, lng: 4.26 },
  { lat: 50.66, lng: 4.26 },
];

/** Uma resposta mínima e válida do Nominatim. */
const RESPOSTA_OK = {
  lat: '50.65',
  lon: '4.26',
  address: { city: 'Ittre', country_code: 'be' },
  namedetails: { name: 'Ittre' },
};

let instantes: number[] = [];

function fetchFalso(status = 200) {
  return jest.fn(async () => {
    instantes.push(Date.now());
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => RESPOSTA_OK,
    } as unknown as Response;
  });
}

beforeEach(() => {
  limparPedagio();
  instantes = [];
});

afterEach(() => {
  limparPedagio();
});

describe('BARREIRA — pedágio global do geocoder', () => {
  it('dois passes concorrentes se intercalam: nunca duas chamadas dentro do intervalo', async () => {
    const f = fetchFalso();
    global.fetch = f as unknown as typeof fetch;

    // É exatamente o cenário do iPhone: duas telas abertas em sequência.
    await Promise.all([cidadesDaRota(DOIS_PONTOS), cidadesDaRota(DOIS_PONTOS)]);

    expect(f).toHaveBeenCalledTimes(4);
    const ordenados = [...instantes].sort((a, b) => a - b);
    for (let i = 1; i < ordenados.length; i++) {
      const gap = ordenados[i] - ordenados[i - 1];
      // 50 ms de folga para o relógio do runner.
      expect(gap).toBeGreaterThanOrEqual(INTERVALO_MS - 50);
    }
  }, 20_000);

  it('429 põe o geocoder de castigo e a chamada seguinte nem sai', async () => {
    const f = fetchFalso(429);
    global.fetch = f as unknown as typeof fetch;

    await expect(cidadesDaRota(DOIS_PONTOS)).rejects.toBeInstanceOf(GeocoderDeCastigo);
    // Uma chamada só: o castigo é do cliente, não da coordenada — insistir nas
    // outras 39 amostras é como se perde um IP.
    expect(f).toHaveBeenCalledTimes(1);

    const liberaEm = castigoAtivoAte();
    expect(liberaEm).toBeGreaterThan(Date.now());
    expect(liberaEm).toBeLessThanOrEqual(Date.now() + CASTIGO_429_MS);

    await expect(cidadesDaRota(DOIS_PONTOS)).rejects.toBeInstanceOf(GeocoderDeCastigo);
    expect(f).toHaveBeenCalledTimes(1);
  }, 20_000);

  it('cancelar interrompe o laço em vez de deixá-lo pedindo', async () => {
    const f = fetchFalso();
    global.fetch = f as unknown as typeof fetch;

    const ctrl = new AbortController();
    ctrl.abort();

    await expect(cidadesDaRota(DOIS_PONTOS, ctrl.signal)).rejects.toThrow('cancelado');
    expect(f).not.toHaveBeenCalled();
  });

  it('rota de menos de dois pontos não gasta chamada nenhuma', async () => {
    const f = fetchFalso();
    global.fetch = f as unknown as typeof fetch;

    await expect(cidadesDaRota([{ lat: 50.6, lng: 4.2 }])).resolves.toEqual([]);
    expect(f).not.toHaveBeenCalled();
  });
});
