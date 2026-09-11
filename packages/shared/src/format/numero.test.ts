import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatarNumero as doPrompt } from '../ia/prompt';
import { formatarNumero } from './numero';

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
});
