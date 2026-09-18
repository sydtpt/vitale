/**
 * O véu da capa, e o piso medido dele (Story 1.13).
 *
 * O que se protege aqui é **a direção da escolha**, que é a coisa que não pode
 * inverter: o véu começa no mais profundo e clareia até o limite que ainda passa
 * em 4,5. Toda ausência de resposta — não mediu ainda, a medição quebrou, o JSON
 * veio torto, nenhum degrau alcança — cai para o lado legível.
 *
 * O contraste é medido pela régua do núcleo (`contrast`), não por uma cópia: o
 * mesmo 4,5 que o `theme.test.ts` cobra em todas as 36 combinações.
 */
import { describe, it, expect } from '@jest/globals';
import { contrast } from '@vitale/shared';
import {
  corComAlfa,
  DEGRAUS_DO_VEU,
  LARGURA_DA_MEDICAO,
  PISO_DO_VEU,
  VEU_MAIS_PROFUNDO,
  comVeu,
  degrauDoVeu,
  htmlDaMedicao,
  lerMedicao,
} from '../veu';
import { mediaVeil, onMedia } from '../../theme/tokens';

const BRANCO = { r: 255, g: 255, b: 255 };
const PRETO = { r: 0, g: 0, b: 0 };

describe('a escada de degraus', () => {
  it('vai do mais raso ao mais profundo, e o mais profundo é o último', () => {
    const ordenada = [...DEGRAUS_DO_VEU].sort((a, b) => a - b);
    expect([...DEGRAUS_DO_VEU]).toEqual(ordenada);
    expect(VEU_MAIS_PROFUNDO).toBe(DEGRAUS_DO_VEU[DEGRAUS_DO_VEU.length - 1]);
  });

  /**
   * O véu é parte da composição da capa: o texto senta sobre ele mesmo numa foto
   * escura. Um degrau zero faria a legenda flutuar sobre a imagem em algumas
   * edições e não em outras.
   */
  it('o mais raso não é zero, e o mais profundo não chega a tapar a foto', () => {
    expect(DEGRAUS_DO_VEU[0]).toBeGreaterThan(0);
    expect(VEU_MAIS_PROFUNDO).toBeLessThan(1);
  });
});

describe('comVeu — a composição em source-over', () => {
  // Nenhum hex literal aqui: a cor do véu e a do texto saem do tema, como na
  // tela — copiar o hex para o teste o poria em dois lugares que ninguém casa.
  it('sem véu, a cor é a do pixel — branco sobre branco mede 1', () => {
    expect(contrast(onMedia, comVeu(BRANCO, 0))).toBeCloseTo(1, 6);
  });

  it('com o véu cheio, a cor é a do véu', () => {
    expect(contrast(mediaVeil, comVeu(BRANCO, 1))).toBeCloseTo(1, 6);
  });

  it('cada degrau escurece o pixel mais que o anterior', () => {
    const luz = DEGRAUS_DO_VEU.map((a) => contrast(onMedia, comVeu(BRANCO, a)));
    for (let i = 1; i < luz.length; i += 1) expect(luz[i]).toBeGreaterThan(luz[i - 1]);
  });
});

describe('degrauDoVeu — o mais raso que ainda alcança 4,5', () => {
  /**
   * O caso que motivou a medição: um céu branco sob texto claro mede ≈1,8 sem
   * véu (DESIGN §Elevation & Depth).
   */
  it('o pixel branco sem véu reprova, e com o degrau escolhido passa', () => {
    expect(contrast(onMedia, comVeu(BRANCO, 0))).toBeLessThan(PISO_DO_VEU);
    const a = degrauDoVeu(BRANCO);
    expect(contrast(onMedia, comVeu(BRANCO, a))).toBeGreaterThanOrEqual(PISO_DO_VEU);
  });

  it('o degrau escolhido é o MAIS RASO que passa — o anterior reprova', () => {
    for (const pixel of [BRANCO, { r: 200, g: 190, b: 170 }, { r: 120, g: 120, b: 120 }]) {
      const a = degrauDoVeu(pixel);
      expect(contrast(onMedia, comVeu(pixel, a))).toBeGreaterThanOrEqual(PISO_DO_VEU);
      const i = DEGRAUS_DO_VEU.indexOf(a);
      if (i > 0) {
        expect(contrast(onMedia, comVeu(pixel, DEGRAUS_DO_VEU[i - 1]))).toBeLessThan(PISO_DO_VEU);
      }
    }
  });

  it('foto escura já passa: fica no degrau mais raso, e não em zero', () => {
    expect(degrauDoVeu(PRETO)).toBe(DEGRAUS_DO_VEU[0]);
  });

  it('todo pixel possível recebe um véu que alcança o piso', () => {
    for (let v = 0; v <= 255; v += 15) {
      const pixel = { r: v, g: v, b: v };
      expect(contrast(onMedia, comVeu(pixel, degrauDoVeu(pixel)))).toBeGreaterThanOrEqual(PISO_DO_VEU);
    }
  });

  /** Enquanto não mediu — e se a medição falhar — vale o mais profundo, nunca o mais raso. */
  it('sem medida, o véu é o mais profundo', () => {
    expect(degrauDoVeu(null)).toBe(VEU_MAIS_PROFUNDO);
  });

  /**
   * O caso sem saída: um texto da cor do **próprio véu**, que aprofundar só
   * aproxima do fundo. Nenhum degrau alcança o piso, e a resposta continua sendo
   * o mais profundo — a falha nunca cai para o raso.
   */
  it('nenhum degrau alcançando o piso também devolve o mais profundo', () => {
    const CINZA = { r: 128, g: 128, b: 128 };
    for (const a of DEGRAUS_DO_VEU) {
      expect(contrast(mediaVeil, comVeu(CINZA, a))).toBeLessThan(PISO_DO_VEU);
    }
    expect(degrauDoVeu(CINZA, mediaVeil)).toBe(VEU_MAIS_PROFUNDO);
  });
});

describe('lerMedicao — só medida boa vira pixel', () => {
  it('lê a resposta da página', () => {
    expect(lerMedicao('{"ok":true,"r":10,"g":20,"b":30}')).toEqual({ r: 10, g: 20, b: 30 });
  });

  it('o que não é medida boa vira null, e o véu fica no mais profundo', () => {
    const torto = [
      'não é json',
      '"uma string"',
      'null',
      '{"ok":false,"motivo":"SecurityError"}',
      '{"ok":true,"r":10,"g":20}',
      '{"ok":true,"r":10,"g":20,"b":"30"}',
      '{"ok":true,"r":10,"g":20,"b":300}',
      '{"ok":true,"r":null,"g":20,"b":30}',
    ];
    for (const d of torto) {
      expect(lerMedicao(d)).toBeNull();
      expect(degrauDoVeu(lerMedicao(d))).toBe(VEU_MAIS_PROFUNDO);
    }
  });
});

/* ── a página que mede, executada de verdade ─────────────────────────────── */

/**
 * O `<canvas>` e a `Image` que a página espera encontrar — o molde do
 * `fakeGravacao` de `data/edicoes-capa.test.ts`, aplicado ao navegador.
 *
 * **O script emitido roda de verdade aqui.** Conferi-lo por `toContain` no fonte
 * prova que a string existe, não que ela mede o lugar certo: trocar `H * (1 -
 * BANDA)` por `H * BANDA` — medir muito acima da faixa do texto — mantinha toda a
 * suíte verde e quebrava a promessa central da story.
 *
 * O raster sintético é declarado por FAIXA DE LINHA da imagem já recortada, e o
 * `getImageData` devolve só as linhas pedidas. Então o pixel reportado responde
 * uma pergunta só: **quais linhas ele leu?**
 */
interface RasterSintetico {
  /** A luminância de cada linha do raster desenhado, de cima para baixo. */
  linha: (y: number, H: number) => number;
}

interface Execucao {
  respostas: unknown[];
  /** Os argumentos do `drawImage` — o recorte `cover` que a capa também faz. */
  recorte: number[] | null;
}

function rodarAPagina(
  html: string,
  raster: RasterSintetico,
  opcoes: { imagem?: { width: number; height: number } | 'erro'; getImageDataLanca?: Error } = {},
): Execucao {
  const ABRE = '<script>';
  const corpo = html.slice(html.indexOf(ABRE) + ABRE.length, html.indexOf('</' + 'script>'));

  const out: Execucao = { respostas: [], recorte: null };
  const janela = {
    ReactNativeWebView: {
      postMessage: (texto: string) => out.respostas.push(JSON.parse(texto)),
    },
  };

  let alturaDesenhada = 0;
  const ctx = {
    drawImage: (...args: unknown[]) => {
      out.recorte = args.slice(1).map(Number);
      alturaDesenhada = Number(args[8]);
    },
    getImageData: (_x: number, y: number, w: number, h: number) => {
      if (opcoes.getImageDataLanca) throw opcoes.getImageDataLanca;
      const data: number[] = [];
      for (let linha = y; linha < y + h; linha += 1) {
        const v = raster.linha(linha, alturaDesenhada);
        for (let c = 0; c < w; c += 1) data.push(v, v, v, 255);
      }
      return { data };
    },
  };
  const documento = {
    createElement: () => ({ width: 0, height: 0, getContext: () => ctx }),
  };

  class ImagemFalsa {
    width = 0;
    height = 0;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_v: string) {
      if (opcoes.imagem === 'erro') { this.onerror?.(); return; }
      const t = opcoes.imagem ?? { width: 4000, height: 3000 };
      this.width = t.width;
      this.height = t.height;
      this.onload?.();
    }
  }

  // eslint-disable-next-line no-new-func
  new Function('window', 'document', 'Image', corpo)(janela, documento, ImagemFalsa);
  return out;
}

/** Uma capa de 390×380 com o texto ocupando o terço de baixo. */
const PAGINA = htmlDaMedicao({ uri: 'file:///var/tmp/IMG_0001.HEIC', razao: 380 / 390, banda: 0.34 });

describe('htmlDaMedicao — a página que mede', () => {
  it('carrega a imagem pedida, com o endereço escapado', () => {
    expect(PAGINA).toContain('"file:///var/tmp/IMG_0001.HEIC"');
  });

  /**
   * O analisador de HTML fecha o `<script>` no primeiro `</script` que vê, dentro
   * de string ou não — e a página morreria antes de medir, calada.
   */
  it('um endereço com fechamento de script não quebra a página', () => {
    const veneno = htmlDaMedicao({ uri: 'file:///a</' + 'script>b.jpg', razao: 1, banda: 1 });
    expect(veneno).not.toContain('</' + 'script>b.jpg');
    expect(veneno).toContain('\\u003c');
    // E o corpo continua sendo JavaScript válido que roda até o fim.
    const r = rodarAPagina(veneno, { linha: () => 10 });
    expect(r.respostas).toHaveLength(1);
  });

  it('aspas no endereço não quebram a página', () => {
    const comAspas = htmlDaMedicao({ uri: 'file:///a"b\'c.jpg', razao: 1, banda: 1 });
    expect(rodarAPagina(comAspas, { linha: () => 10 }).respostas).toHaveLength(1);
  });

  /**
   * **A promessa central da story.** A faixa de baixo é clara e o topo é escuro: se
   * ela medir o lugar certo, reporta o claro.
   */
  it('reporta o pixel mais claro DA FAIXA DE BAIXO', () => {
    const r = rodarAPagina(PAGINA, { linha: (y, H) => (y >= H * 0.66 ? 240 : 20) });
    expect(r.respostas).toEqual([{ ok: true, r: 240, g: 240, b: 240 }]);
  });

  /**
   * E o inverso, que é o que mata a troca de `H * (1 - BANDA)` por `H * BANDA`: uma
   * faixa clara **acima** do texto não pode entrar na conta, senão o véu se
   * aprofundaria por causa de pixels que o texto nunca cobre.
   */
  it('o que está ACIMA da faixa do texto não entra na conta', () => {
    // Claro só no meio (40%–60% da altura); a faixa do texto é o terço de baixo.
    const r = rodarAPagina(PAGINA, { linha: (y, H) => (y > H * 0.4 && y < H * 0.6 ? 250 : 30) });
    expect(r.respostas).toEqual([{ ok: true, r: 30, g: 30, b: 30 }]);
  });

  /** O mesmo recorte `cover` centralizado que o `resizeMode` da capa faz. */
  it('desenha o recorte cover centralizado, e não a foto inteira', () => {
    const r = rodarAPagina(PAGINA, { linha: () => 100 }, { imagem: { width: 4000, height: 3000 } });
    const [sx, sy, sw, sh, dx, dy, dw, dh] = r.recorte!;
    // Retrato dentro de paisagem: a altura da fonte é usada inteira e a largura corta.
    expect(sh).toBeCloseTo(3000, 0);
    expect(sy).toBeCloseTo(0, 0);
    expect(sw).toBeLessThan(4000);
    expect(sx).toBeCloseTo((4000 - sw) / 2, 0);
    expect([dx, dy]).toEqual([0, 0]);
    expect(dw).toBe(LARGURA_DA_MEDICAO);
    expect(dh).toBeGreaterThan(0);
  });

  /**
   * O canvas *tainted* — a página sem origem de arquivo — lança `SecurityError` no
   * `getImageData`. Ela tem de responder, e não morrer: quem não responde deixa o
   * véu inerte e indistinguível de um véu medido.
   */
  it('SecurityError no canvas vira ok:false, e não uma página muda', () => {
    const r = rodarAPagina(PAGINA, { linha: () => 100 }, {
      getImageDataLanca: new Error('The operation is insecure.'),
    });
    expect(r.respostas).toHaveLength(1);
    expect(r.respostas[0]).toMatchObject({ ok: false });
    expect(lerMedicao(JSON.stringify(r.respostas[0]))).toBeNull();
  });

  it('imagem que não carrega vira ok:false', () => {
    const r = rodarAPagina(PAGINA, { linha: () => 100 }, { imagem: 'erro' });
    expect(r.respostas[0]).toMatchObject({ ok: false });
  });

  it('imagem sem tamanho vira ok:false, em vez de dividir por zero', () => {
    const r = rodarAPagina(PAGINA, { linha: () => 100 }, { imagem: { width: 0, height: 0 } });
    expect(r.respostas[0]).toMatchObject({ ok: false });
  });

  /** A ponta da story: do pixel medido sai o véu, e ele passa em 4,5. */
  it('do pixel reportado sai um véu que alcança o piso', () => {
    const r = rodarAPagina(PAGINA, { linha: (y, H) => (y >= H * 0.66 ? 255 : 0) });
    const pixel = lerMedicao(JSON.stringify(r.respostas[0]));
    expect(pixel).toEqual({ r: 255, g: 255, b: 255 });
    expect(contrast(onMedia, comVeu(pixel!, degrauDoVeu(pixel)))).toBeGreaterThanOrEqual(PISO_DO_VEU);
  });
});

describe('corComAlfa — a cor do tema com alfa, sem literal na tela', () => {
  it('o véu e o disco da marca do toque saem dos tokens', () => {
    expect(corComAlfa(mediaVeil, 0.88)).toBe('rgba(24, 18, 13, 0.88)');
    // O disco da capa (Story 1.16): `onMedia` translúcido sobre a foto.
    expect(corComAlfa(onMedia, 0.16)).toBe('rgba(255, 255, 255, 0.16)');
  });

  it('o alfa sai com três casas no máximo', () => {
    expect(corComAlfa(onMedia, 1 / 3)).toBe('rgba(255, 255, 255, 0.333)');
  });
});
