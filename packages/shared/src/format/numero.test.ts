import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatarNumero as doPrompt } from '../ia/prompt';
import { formatarNumero, porExtenso } from './numero';

/**
 * `formatarNumero` mudou de `ia/prompt.ts` para cá na story 5.2, sem mudar uma
 * linha do corpo. A saída de sempre continua cobrada em `ia/verificar.test.ts`,
 * que o importa pelo caminho antigo; aqui se cobra que o caminho antigo é o
 * mesmo símbolo — uma declaração, não uma cópia.
 */
describe('formatarNumero', () => {
  it('o prompt reexporta o mesmo símbolo, não uma cópia', () => {
    assert.equal(doPrompt, formatarNumero);
  });

  it('pt-BR: vírgula decimal, ponto de milhar, menos tipográfico', () => {
    assert.equal(formatarNumero(17350, 0), '17.350');
    assert.equal(formatarNumero(40.1, 1), '40,1');
    assert.equal(formatarNumero(-49.5, 1), '−49,5');
  });

  it('a média das notas da Saúde do sono sai com vírgula, na casa que o fato mostra', () => {
    // 3,25 é a média de quatro notas (3, 3, 3, 4): o meio exato sobe.
    assert.equal(formatarNumero(3.25, 1), '3,3');
    assert.equal(formatarNumero(3.5, 1), '3,5');
    assert.equal(formatarNumero(4, 1), '4,0');
  });
});

describe('porExtenso', () => {
  it('de um a dez, nos dois gêneros — só um e dois flexionam', () => {
    assert.deepEqual(
      Array.from({ length: 10 }, (_, i) => porExtenso(i + 1, 'feminino')),
      ['uma', 'duas', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez'],
    );
    assert.deepEqual(
      Array.from({ length: 10 }, (_, i) => porExtenso(i + 1, 'masculino')),
      ['um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez'],
    );
  });

  it('fora de 1 a 10 é defeito de quem chamou, e lança', () => {
    for (const n of [0, 11, -1, 2.5, NaN, Infinity]) {
      assert.throws(() => porExtenso(n, 'feminino'), RangeError, String(n));
    }
  });
});
