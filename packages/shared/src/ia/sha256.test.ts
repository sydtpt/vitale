import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { sha256Hex } from './sha256';

/**
 * O SHA-256 à mão só vale se sair igual ao de referência em todo texto que um
 * pedido pode ter — acento, emoji, surrogate solto e as fronteiras de bloco,
 * onde erro de preenchimento se esconde.
 */
const referencia = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

describe('sha256Hex — conferido contra node:crypto', () => {
  it('os vetores do FIPS 180-4', () => {
    assert.equal(sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    assert.equal(
      sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'),
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    );
  });

  it('as fronteiras de bloco (55, 56, 63, 64, 65, 119, 120 bytes)', () => {
    for (const n of [1, 55, 56, 57, 63, 64, 65, 119, 120, 127, 128, 129]) {
      const s = 'x'.repeat(n);
      assert.equal(sha256Hex(s), referencia(s), `n=${n}`);
    }
  });

  it('UTF-8 de verdade: acento, CJK, emoji e as bordas de cada largura', () => {
    const casos = [
      'Saúde do sono',
      'ação — «três»',
      '睡眠',                      // CJK
      '\u{1F600}\u{1F6CF}\uFE0F',          // emoji com seletor de variação
      '\u007F\u0080\u07FF\u0800\uFFFF',    // 1→2→3 bytes e o topo do plano básico
      '\u{10000}\u{10FFFF}',               // 4 bytes, das duas pontas
    ];
    for (const s of casos) assert.equal(sha256Hex(s), referencia(s), JSON.stringify(s));
  });

  it('surrogate solto vira U+FFFD, como no Buffer', () => {
    for (const s of ['\ud800', '\udc00', 'a\ud800b', '\ud83d', 'x\ude00', '\ud800\u{10000}']) {
      assert.equal(sha256Hex(s), referencia(s), JSON.stringify(s));
    }
  });

  it('um pedido do tamanho da janela da function (60 mil caracteres) e um milhão de "a"', () => {
    const grande = 'Você dormiu 7h02. '.repeat(3400);
    assert.equal(sha256Hex(grande), referencia(grande));
    assert.equal(
      sha256Hex('a'.repeat(1_000_000)),
      'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0',
    );
  });

  it('textos pseudoaleatórios de todos os planos', () => {
    let semente = 20260910;
    const aleatorio = () => {
      semente = (semente * 1103515245 + 12345) % 2147483648;
      return semente / 2147483648;
    };
    for (let i = 0; i < 200; i += 1) {
      let s = '';
      const n = Math.floor(aleatorio() * 150);
      for (let j = 0; j < n; j += 1) {
        const faixa = aleatorio();
        // Metade ASCII, o resto do plano básico (surrogates soltos inclusos) e os planos altos.
        const cp = faixa < 0.5 ? Math.floor(aleatorio() * 0x80)
          : faixa < 0.8 ? Math.floor(aleatorio() * 0x10000)
          : 0x10000 + Math.floor(aleatorio() * 0xfffff);
        s += cp < 0x10000 ? String.fromCharCode(cp) : String.fromCodePoint(cp);
      }
      assert.equal(sha256Hex(s), referencia(s), JSON.stringify(s));
    }
  });
});
