/**
 * As duas regras da amostra da bancada que falharam em 22/09 — as duas sem
 * levantar exceção, as duas aparecendo na tela como `mudo` em todos os motores.
 *
 * Elas moram aqui, e não num teste de tela, porque são **puras**: uma é a
 * convenção de sinal do período, a outra é a pergunta que o descritor já faz.
 * Um teste de tela custaria mock de supabase e da ponte para cobrir aritmética.
 */
import { describe, it, expect } from '@jest/globals';
import { periodBounds, periodoFechado, type FatosDoNome } from '@vitale/shared';
import { OFFSET_DA_SEMANA_FECHADA, rotaMedivel } from '../motores/amostras-regras';

/** 22/09/2026, uma terça — o dia em que o defeito apareceu. */
const TERCA = new Date(2026, 8, 22, 22, 30);

function diaLocal(d: Date): string {
  const p = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** O último dia do período: o fim é exclusivo (00:00 do dia seguinte). */
function ultimoDia(now: Date, offset: number): string {
  return diaLocal(new Date(periodBounds(now, 'week', offset).end.getTime() - 1));
}

describe('o período que a Retrospectiva mede na bancada', () => {
  it('é uma semana FECHADA — com o sinal trocado, nenhum motor escreve', () => {
    expect(periodoFechado('week', ultimoDia(TERCA, OFFSET_DA_SEMANA_FECHADA), TERCA)).toBe(true);
    // A prova do defeito de 22/09: `+1` é a semana que vem, que nunca fechou, e o
    // descritor devolve pedido nulo — a bancada mostrava `mudo` sem dizer por quê.
    expect(periodoFechado('week', ultimoDia(TERCA, 1), TERCA)).toBe(false);
    // E a semana corrente também não serve, pelo mesmo motivo.
    expect(periodoFechado('week', ultimoDia(TERCA, 0), TERCA)).toBe(false);
  });
});

describe('a pedalada que entra na amostra do nome de rota', () => {
  const rota = (distanceM: number, cidades: number): FatosDoNome => ({
    rota: {
      startAt: '2026-07-14T09:00:00.000Z',
      distanceM,
      elevationM: 40,
      lat0: 50.85,
      lng0: 4.34,
      lat1: 50.87,
      lng1: 4.37,
      cities: Array.from({ length: cidades }, (_, i) => ({ name: `Cidade ${i + 1}`, country: 'BE', lat: 50.85 + i / 100, lng: 4.34 + i / 100 })),
    },
    ancoras: [],
  });

  it('recusa a rota que o descritor recusaria — o caso real de 14/07: 4,3 km e uma cidade', () => {
    expect(rotaMedivel(rota(4321, 1))).toBe(false);
  });

  it('recusa rota curta demais e rota sem cidade', () => {
    expect(rotaMedivel(rota(1625, 2))).toBe(false);
    expect(rotaMedivel(rota(16156, 0))).toBe(false);
  });

  it('aceita as que o descritor aceita: cinco cidades em 16 km, e uma cidade em 21 km', () => {
    expect(rotaMedivel(rota(16156, 5))).toBe(true);
    expect(rotaMedivel(rota(21364, 1))).toBe(true);
  });
});
