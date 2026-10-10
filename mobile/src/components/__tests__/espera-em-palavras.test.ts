/**
 * BARREIRA — a espera é dita na unidade que se lê.
 *
 * A primeira versão escreveu **"aguarde 360 min"** na tela do dono (10/10/2026):
 * a espera do piso é de 6 h e o código formatava tudo em minutos. Minuto é a
 * unidade de "daqui a pouco"; passada a hora, ninguém converte de cabeça.
 */
import { describe, it, expect } from '@jest/globals';
import { esperaEmPalavras } from '../../lib/espera';

const AGORA = 1_760_000_000_000;
const min = (n: number) => AGORA + n * 60_000;

describe('BARREIRA — esperaEmPalavras', () => {
  it('a espera do piso (6 h) não sai em minutos', () => {
    const texto = esperaEmPalavras(min(360), AGORA);
    expect(texto).not.toContain('min');
    expect(texto).toBe('6 horas');
  });

  it('a espera do geocoder (10 min) sai em minutos', () => {
    expect(esperaEmPalavras(min(10), AGORA)).toBe('10 min');
  });

  it('uma hora redonda é singular', () => {
    expect(esperaEmPalavras(min(60), AGORA)).toBe('1 hora');
  });

  it('abaixo de um minuto não finge precisão', () => {
    expect(esperaEmPalavras(AGORA + 20_000, AGORA)).toBe('menos de 1 min');
  });

  it('espera já vencida não vira número negativo', () => {
    expect(esperaEmPalavras(min(-5), AGORA)).toBe('menos de 1 min');
  });
});
