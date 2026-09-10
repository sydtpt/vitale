/**
 * SHA-256 puro, sem imports (FIPS 180-4).
 *
 * Existe porque o hash do pedido tem de sair **igual** no iPhone, no Mac da
 * bancada e em qualquer hospedeiro futuro (AD-11: pedido idêntico é pedido com o
 * mesmo hash) — e o caminho óbvio, `node:crypto`, é import de pacote que a
 * barreira do núcleo de IA recusa e que o Hermes não tem. Nem `TextEncoder`: a
 * codificação UTF-8 é feita aqui, à mão, para o resultado não depender de qual
 * global o hospedeiro oferece.
 *
 * Interno ao núcleo: não sai pelo barril. Quem precisa de hash de pedido chama
 * `hashDoPedido`, em `ia/motor.ts`. Os vetores do teste são conferidos contra o
 * `node:crypto`.
 */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const H0 = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
];

/**
 * Texto → bytes UTF-8. Surrogate solto vira U+FFFD, como no `TextEncoder` e no
 * `Buffer` — senão o mesmo texto quebrado teria dois hashes.
 */
function utf8(texto: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < texto.length; i += 1) {
    let c = texto.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const d = i + 1 < texto.length ? texto.charCodeAt(i + 1) : 0;
      if (d >= 0xdc00 && d <= 0xdfff) {
        c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00);
        i += 1;
      } else {
        c = 0xfffd;
      }
    } else if (c >= 0xdc00 && c <= 0xdfff) {
      c = 0xfffd;
    }
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    else {
      out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
  }
  return Uint8Array.from(out);
}

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

/** O SHA-256 do texto em UTF-8, em hexadecimal minúsculo. */
export function sha256Hex(texto: string): string {
  const bytes = utf8(texto);
  const n = bytes.length;
  // Mensagem + o bit 1 + o comprimento em 64 bits, arredondado para blocos de 64 bytes.
  const tamanho = Math.ceil((n + 9) / 64) * 64;
  const m = new Uint8Array(tamanho);
  m.set(bytes);
  m[n] = 0x80;
  const bits = n * 8;
  const alto = Math.floor(bits / 0x100000000);
  const baixo = bits >>> 0;
  for (let i = 0; i < 4; i += 1) {
    m[tamanho - 8 + i] = (alto >>> (24 - 8 * i)) & 0xff;
    m[tamanho - 4 + i] = (baixo >>> (24 - 8 * i)) & 0xff;
  }

  const h = Uint32Array.from(H0);
  const w = new Uint32Array(64);
  for (let b = 0; b < tamanho; b += 64) {
    for (let t = 0; t < 16; t += 1) {
      const i = b + t * 4;
      w[t] = (m[i] << 24) | (m[i + 1] << 16) | (m[i + 2] << 8) | m[i + 3];
    }
    for (let t = 16; t < 64; t += 1) {
      const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = w[t - 16] + s0 + w[t - 7] + s1;
    }

    let a = h[0], bb = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
    for (let t = 0; t < 64; t += 1) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[t] + w[t]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & bb) ^ (a & c) ^ (bb & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = bb;
      bb = a;
      a = (t1 + t2) >>> 0;
    }
    // O `Uint32Array` reduz a soma módulo 2³² na atribuição.
    h[0] += a; h[1] += bb; h[2] += c; h[3] += d;
    h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
  }

  let hex = '';
  for (let i = 0; i < 8; i += 1) hex += h[i].toString(16).padStart(8, '0');
  return hex;
}
