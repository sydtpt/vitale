/**
 * O **véu** da capa da revista, e o piso medido dele (Story 1.13).
 *
 * ## Por que existe piso, e por que ele é medido
 *
 * A capa é o único lugar da revista onde o contraste depende de uma imagem que o
 * app não escolhe: as fotos vêm da biblioteca do iPhone, e um céu branco sob
 * texto claro mede ≈1,8 (DESIGN §Elevation & Depth). Nenhum valor de véu autorado
 * à mão serve para as duas pontas — o que salva a foto de praia apaga a foto de
 * floresta.
 *
 * Então o app **mede o pixel mais claro sob a faixa do texto** e escolhe o degrau
 * de véu que ainda alcança {@link PISO_DO_VEU} ali. A direção da escolha é o que
 * importa: começa no **mais profundo** e clareia até o limite que ainda passa —
 * então toda falha (não mediu ainda, a medição quebrou, nenhum degrau alcança)
 * cai para o lado legível, nunca para o raso.
 *
 * ## O que é local aqui
 *
 * O véu é um gradiente **só sob o texto**, nunca um filtro sobre a imagem
 * inteira: a foto informa, e escurecê-la por inteiro para caber texto seria
 * decorar em cima de dado. O que este módulo decide é a **profundidade** — a
 * forma (onde ele começa a ramper, até onde vai) é do componente.
 *
 * ## O que a medição não precisa resolver
 *
 * Nada aqui fala com o `<canvas>`: {@link htmlDaMedicao} monta a página e
 * {@link lerMedicao} lê a resposta. As duas são strings entrando e saindo, e por
 * isso têm teste sem aparelho.
 */
import { contrast, hexToRgb, rgbToHex } from '@vitale/shared';
// A parte PURA do tema, e não o barril: `theme/index.tsx` arrasta o
// `ThemeProvider` e, por tabela, o cliente Supabase — e o véu é aritmética de
// cor, que não depende de sessão nenhuma (ver o cabeçalho de `theme/tokens.ts`).
import { mediaVeil, onMedia } from '../theme/tokens';

/** A régua: 4,5 — o piso de texto da WCAG AA. Trocá-la é pergunta ao dono. */
export const PISO_DO_VEU = 4.5;

/**
 * Os degraus de profundidade do véu, **do mais raso ao mais profundo**.
 *
 * Uma escada, e não um número contínuo, por duas razões: a busca fica
 * determinística (o mesmo pixel dá sempre o mesmo véu, em qualquer aparelho) e o
 * resultado é reproduzível num teste sem tolerância de ponto flutuante.
 *
 * **O mais raso é 0,40, e não zero.** O véu é parte da composição da capa — o
 * texto senta sobre ele mesmo numa foto escura, senão a legenda flutuaria sobre a
 * imagem em algumas edições e não em outras. O mais profundo, 0,88, é o valor do
 * mockup (`key-edicao.html`, `rgba(24,18,13,.86)`) arredondado para a escada.
 */
export const DEGRAUS_DO_VEU: readonly number[] = Object.freeze([
  0.40, 0.48, 0.56, 0.64, 0.72, 0.80, 0.88,
]);

/** O degrau que vale enquanto não se mediu — e quando a medição falha. */
export const VEU_MAIS_PROFUNDO = DEGRAUS_DO_VEU[DEGRAUS_DO_VEU.length - 1];

/** Um pixel medido na foto, em sRGB 0–255. */
export interface PixelMedido {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/**
 * A cor que o olho vê: o véu **sobre** o pixel, em `source-over`.
 *
 * A composição é feita em sRGB (não linearizada) de propósito — é o que a GPU faz
 * com a opacidade de uma view no React Native e com `rgba()` no CSS. Medir num
 * espaço e desenhar noutro daria um número certo para uma tela que não existe.
 */
export function comVeu(pixel: PixelMedido, alfa: number, veu: string = mediaVeil): string {
  const a = alfa < 0 ? 0 : alfa > 1 ? 1 : alfa;
  const v = hexToRgb(veu);
  const canal = (doVeu: number, doPixel: number): number => a * doVeu + (1 - a) * (doPixel / 255);
  return rgbToHex({
    r: canal(v.r, pixel.r),
    g: canal(v.g, pixel.g),
    b: canal(v.b, pixel.b),
  });
}

/**
 * O degrau de véu para um pixel medido: **o mais raso que ainda alcança o piso**.
 *
 * `null` é "não mediu" — enquanto a medição não voltou, ou porque ela falhou — e
 * devolve o {@link VEU_MAIS_PROFUNDO}. É a mesma resposta de quando nenhum degrau
 * alcança o piso: os dois casos são desconhecimento sobre a imagem, e a resposta
 * ao desconhecimento é o lado legível.
 */
export function degrauDoVeu(
  pixel: PixelMedido | null,
  corDoTexto: string = onMedia,
  veu: string = mediaVeil,
): number {
  if (!pixel) return VEU_MAIS_PROFUNDO;
  for (const alfa of DEGRAUS_DO_VEU) {
    if (contrast(corDoTexto, comVeu(pixel, alfa, veu)) >= PISO_DO_VEU) return alfa;
  }
  return VEU_MAIS_PROFUNDO;
}

/* ── a medição, no WebView ───────────────────────────────────────────────── */

/**
 * A largura, em pixels, do raster que a página desenha para medir.
 *
 * **Pequena de propósito.** A regra é "o pixel mais claro sob a faixa do texto", e
 * numa foto em resolução cheia esse pixel costuma ser um brilho especular de um
 * pixel só — o véu inteiro se aprofundaria por causa de um reflexo em cromado.
 * Desenhar a foto reduzida faz o navegador **filtrar** a vizinhança antes da
 * leitura: o que se mede continua sendo o pixel mais claro do raster, e o raster
 * já é a média local. Também derruba o custo: 72 px de largura são ~2 mil pixels
 * a percorrer, contra 4 milhões.
 */
export const LARGURA_DA_MEDICAO = 72;

/**
 * O endereço, seguro dentro de um `<script>` inline.
 *
 * `JSON.stringify` resolve aspas e barras, e **não resolve `</script>`**: o
 * analisador de HTML fecha o bloco no primeiro `</script>` que vê, esteja ele
 * dentro de uma string ou não, e a página morreria antes de medir — sem mensagem
 * nenhuma, com o véu no mais profundo e sem nada no log dizendo por quê. Escapar
 * o `<` mata a sequência sem mudar o valor da string para o JavaScript.
 *
 * Não é hipótese: um caminho da biblioteca do iPhone vem de nome de arquivo, e
 * nome de arquivo aceita `<` e `/`.
 */
export function enderecoNoScript(uri: string): string {
  return JSON.stringify(uri).replace(/</g, '\\u003c');
}

/** O que a página devolve ao React Native. */
export type RespostaDaMedicao =
  | { readonly ok: true; readonly r: number; readonly g: number; readonly b: number }
  | { readonly ok: false; readonly motivo: string };

/**
 * A página que mede — um `<canvas>` sem nada visível.
 *
 * Ela desenha a imagem **como a capa a desenha** (recorte `cover`, centralizado),
 * lê a faixa de baixo e devolve o pixel de maior luminância. Tem que ser o mesmo
 * recorte: medir a foto inteira responderia sobre pixels que a capa nunca mostra.
 *
 * **O endereço que entra aqui é um `data:`**, não um `file://`: a capa rasteriza
 * a própria `<Image>` e manda os bytes embutidos (`CapaComFoto.amostraDaFoto`).
 * A primeira versão mandava o arquivo da biblioteca, e o WKWebView levou "não" do
 * sandbox no aparelho — medido em 18/09/2026. Com `data:` a origem é a mesma, o
 * canvas não fica *tainted* e não há permissão a pedir. Se ainda assim o
 * `getImageData` lançar `SecurityError`, a página responde `ok:false`: o véu fica
 * no mais profundo, que é a resposta certa para "não sei o que tem embaixo".
 *
 * `banda` é a fração da altura da capa que o bloco de texto ocupa, contada de
 * baixo para cima; `razao` é altura ÷ largura da capa. **Os dois entram já
 * arredondados**, e não em pixels: a página é remontada quando eles mudam, e um
 * ponto de layout a mais recarregaria o WebView no meio da medição.
 */
export function htmlDaMedicao(p: {
  uri: string;
  razao: number;
  banda: number;
}): string {
  const razao = Number.isFinite(p.razao) && p.razao > 0 ? p.razao : 1;
  const banda = Math.min(1, Math.max(0.02, p.banda));
  return `<!doctype html><meta charset="utf-8"><body style="margin:0">
<script>
(function () {
  var W = ${LARGURA_DA_MEDICAO};
  var H = Math.max(1, Math.round(W * ${razao.toFixed(4)}));
  var BANDA = ${banda.toFixed(4)};
  function responder(o) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(o));
  }
  var img = new Image();
  img.onerror = function () { responder({ ok: false, motivo: 'a imagem não carregou' }); };
  img.onload = function () {
    try {
      if (!img.width || !img.height) { responder({ ok: false, motivo: 'imagem sem tamanho' }); return; }
      var c = document.createElement('canvas');
      c.width = W; c.height = H;
      var ctx = c.getContext('2d');
      // O mesmo recorte do resizeMode="cover" da capa, centralizado.
      var escala = Math.max(W / img.width, H / img.height);
      var sw = W / escala, sh = H / escala;
      ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, W, H);
      var y0 = Math.max(0, Math.floor(H * (1 - BANDA)));
      var d = ctx.getImageData(0, y0, W, H - y0).data;
      var melhor = -1, mr = 0, mg = 0, mb = 0;
      for (var i = 0; i < d.length; i += 4) {
        // Luminância aproximada, só para ORDENAR os candidatos — o contraste de
        // verdade é medido do lado do React Native, pela régua do núcleo.
        var l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        if (l > melhor) { melhor = l; mr = d[i]; mg = d[i + 1]; mb = d[i + 2]; }
      }
      if (melhor < 0) { responder({ ok: false, motivo: 'faixa vazia' }); return; }
      responder({ ok: true, r: mr, g: mg, b: mb });
    } catch (e) {
      responder({ ok: false, motivo: String(e && e.message ? e.message : e) });
    }
  };
  img.src = ${enderecoNoScript(p.uri)};
})();
</script></body>`;
}

/**
 * A resposta da página, virada pixel — ou `null`, que o {@link degrauDoVeu} lê
 * como "não mediu" e responde com o véu mais profundo.
 *
 * Tudo que não é uma medida boa vira `null`: JSON quebrado, `ok:false`, canal
 * fora de 0–255. Um canal `NaN` atravessaria até o `rgbToHex` e sairia como um
 * véu qualquer, que é justamente o que não pode acontecer.
 */
export function lerMedicao(data: string): PixelMedido | null {
  let m: unknown;
  try {
    m = JSON.parse(data);
  } catch {
    return null;
  }
  if (typeof m !== 'object' || m === null) return null;
  const r = m as Partial<Record<'ok' | 'r' | 'g' | 'b', unknown>>;
  if (r.ok !== true) return null;
  const canal = (v: unknown): number | null =>
    (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 255 ? v : null);
  const vr = canal(r.r);
  const vg = canal(r.g);
  const vb = canal(r.b);
  if (vr === null || vg === null || vb === null) return null;
  return { r: vr, g: vg, b: vb };
}
