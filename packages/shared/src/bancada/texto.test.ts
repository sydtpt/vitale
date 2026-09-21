import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MOTIVOS_FORA_DA_MEDIDA, type ForaDaMedida } from './medidas';
import { decimal, foraEmTexto, hashCurto, porcento, segundos } from './texto';

/**
 * Como a bancada escreve um número (story 5.13) — um dono só para o relatório do Mac e a
 * tela do iPhone.
 */

const nada: Readonly<Record<ForaDaMedida, number>> = {
  semChamada: 0,
  sintetica: 0,
  defeito: 0,
  indisponivel: 0,
  doHospedeiro: 0,
};

describe('os números', () => {
  it('vírgula decimal, e `—` onde não há medida — nunca 0 nem NaN', () => {
    assert.equal(decimal(13.64), '13,6');
    assert.equal(decimal(2, 2), '2,00');
    assert.equal(porcento(19, 22), '86,4%');
    assert.equal(porcento(0, 0), '—');
    assert.equal(segundos(13_600), '13,6 s');
    assert.equal(segundos(null), '—');
    assert.equal(hashCurto('a'.repeat(64)), 'a'.repeat(12));
  });
});

describe('o que ficou fora da medida', () => {
  it('concorda no singular e no plural — a frase é lida, não é tabela', () => {
    assert.equal(foraEmTexto({ ...nada, defeito: 1 }), '1 defeito');
    assert.equal(foraEmTexto({ ...nada, defeito: 2 }), '2 defeitos');
    assert.equal(foraEmTexto({ ...nada, sintetica: 1 }), '1 sintética');
    assert.equal(foraEmTexto({ ...nada, sintetica: 3 }), '3 sintéticas');
    assert.equal(foraEmTexto({ ...nada, indisponivel: 1 }), '1 indisponível');
    assert.equal(foraEmTexto({ ...nada, indisponivel: 4 }), '4 indisponíveis');
    // Os invariáveis continuam invariáveis.
    assert.equal(foraEmTexto({ ...nada, semChamada: 1 }), '1 sem chamada');
    assert.equal(foraEmTexto({ ...nada, doHospedeiro: 1 }), '1 do hospedeiro');
    assert.equal(foraEmTexto({ ...nada, doHospedeiro: 2 }), '2 do hospedeiro');
  });

  it('sai na ordem de precedência dos motivos, não na ordem do objeto', () => {
    // O objeto vem com as chaves ao contrário de propósito.
    const trocado = { doHospedeiro: 1, indisponivel: 2, defeito: 3, sintetica: 4, semChamada: 5 };
    assert.equal(foraEmTexto(trocado), '5 sem chamada · 4 sintéticas · 3 defeitos · 2 indisponíveis · 1 do hospedeiro');
    assert.deepEqual(
      [...MOTIVOS_FORA_DA_MEDIDA],
      ['semChamada', 'sintetica', 'defeito', 'indisponivel', 'doHospedeiro'],
      'a ordem da frase é a da precedência — se a lista mudar, a frase muda junto',
    );
  });

  it('nada fora da medida é "nenhuma", e não uma frase vazia', () => {
    assert.equal(foraEmTexto(nada), 'nenhuma');
  });
});
