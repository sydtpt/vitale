/**
 * Matemática de cor do sistema de temas — pura, sem dependência, sem tema.
 *
 * Existe porque o Orbe passou a ter **2 temas × 2 esquemas × 6 paletas = 24
 * combinações**. Autorar tint à mão nessa escala significa ~1.200 hex que
 * ninguém revisa; o caminho viável é declarar poucos matizes e *calcular* o
 * resto, com um teste que mede contraste em vez de confiar no olho.
 *
 * Duas escolhas que valem justificativa:
 *
 * **OKLab, não HSL.** Clarear em HSL desloca matiz percebido e desaba o chroma
 * de forma desigual entre faixas — amarelo e azul com o mesmo `L` de HSL não
 * parecem ter o mesmo peso. OKLab é perceptualmente uniforme, então um alvo
 * único de luminosidade produz tints com peso visual comparável em todas as
 * faixas. É o que faz `softOf` funcionar igual para laranja e azul.
 *
 * **Viénot (1999) para daltonismo, não Brettel completo.** É uma projeção por
 * matriz em RGB linear, barata e determinística. Basta para o que o teste
 * pergunta — "estas duas cores continuam separáveis?" — sem simular percepção.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Cor em OKLCH: `l` 0–1, `c` ≥ 0, `h` em graus 0–360. */
export interface Oklch {
  l: number;
  c: number;
  h: number;
}

/* ───────────────────────── hex ↔ rgb ───────────────────────── */

export function hexToRgb(hex: string): Rgb {
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (h.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(h)) {
    throw new Error(`hex inválido: ${hex}`);
  }
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  };
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

export function rgbToHex({ r, g, b }: Rgb): string {
  const byte = (v: number): string =>
    Math.round(clamp01(v) * 255)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();
  return `#${byte(r)}${byte(g)}${byte(b)}`;
}

/* ─────────────────────── sRGB ↔ linear ─────────────────────── */

const toLinear = (c: number): number =>
  c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

const toSrgb = (c: number): number =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;

function linearize({ r, g, b }: Rgb): Rgb {
  return { r: toLinear(r), g: toLinear(g), b: toLinear(b) };
}

function delinearize({ r, g, b }: Rgb): Rgb {
  return { r: toSrgb(r), g: toSrgb(g), b: toSrgb(b) };
}

/* ───────────────────── OKLab (Björn Ottosson) ───────────────────── */

function linearRgbToOklab(lin: Rgb): { L: number; a: number; b: number } {
  const l = 0.4122214708 * lin.r + 0.5363325363 * lin.g + 0.0514459929 * lin.b;
  const m = 0.2119034982 * lin.r + 0.6806995451 * lin.g + 0.1073969566 * lin.b;
  const s = 0.0883024619 * lin.r + 0.2817188376 * lin.g + 0.6299787005 * lin.b;
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  };
}

function oklabToLinearRgb(lab: { L: number; a: number; b: number }): Rgb {
  const l_ = lab.L + 0.3963377774 * lab.a + 0.2158037573 * lab.b;
  const m_ = lab.L - 0.1055613458 * lab.a - 0.0638541728 * lab.b;
  const s_ = lab.L - 0.0894841775 * lab.a - 1.291485548 * lab.b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  };
}

export function hexToOklch(hex: string): Oklch {
  const { L, a, b } = linearRgbToOklab(linearize(hexToRgb(hex)));
  const c = Math.sqrt(a * a + b * b);
  // Matiz é indefinido sem chroma; 0 mantém a conversão de volta determinística.
  const h = c < 1e-7 ? 0 : ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  return { l: L, c, h };
}

const inGamut = ({ r, g, b }: Rgb): boolean =>
  r >= -1e-4 && r <= 1 + 1e-4 && g >= -1e-4 && g <= 1 + 1e-4 && b >= -1e-4 && b <= 1 + 1e-4;

/**
 * OKLCH → hex. Fora do gamute sRGB, **reduz chroma** preservando luminosidade e
 * matiz (busca binária), em vez de recortar canal por canal. Recortar canal
 * desloca o matiz — um vermelho saturado demais viraria laranja em vez de
 * apenas perder saturação, e o tint deixaria de pertencer à sua família.
 */
export function oklchToHex({ l, c, h }: Oklch): string {
  const at = (chroma: number): Rgb => {
    const rad = (h * Math.PI) / 180;
    return oklabToLinearRgb({ L: l, a: chroma * Math.cos(rad), b: chroma * Math.sin(rad) });
  };
  let lin = at(c);
  if (!inGamut(lin)) {
    let lo = 0;
    let hi = c;
    for (let i = 0; i < 24; i += 1) {
      const mid = (lo + hi) / 2;
      if (inGamut(at(mid))) lo = mid;
      else hi = mid;
    }
    lin = at(lo);
  }
  return rgbToHex(delinearize(lin));
}

/* ──────────────────────── WCAG ──────────────────────── */

/** Luminância relativa WCAG 2.x (coeficientes sobre RGB linear). */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = linearize(hexToRgb(hex));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razão de contraste WCAG entre duas cores opacas. 1 = idênticas, 21 = extremo. */
export function contrast(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/* ──────────────────── Daltonismo (Viénot 1999) ──────────────────── */

export type Cvd = 'protanopia' | 'deuteranopia';

const CVD_MATRIX: Record<Cvd, readonly number[]> = {
  protanopia: [0.11238, 0.88762, 0, 0.11238, 0.88762, 0, 0.00401, -0.00401, 1],
  deuteranopia: [0.29275, 0.70725, 0, 0.29275, 0.70725, 0, -0.02234, 0.02234, 1],
};

/** Projeta uma cor para como ela é vista sob o tipo de daltonismo indicado. */
export function simulateCvd(hex: string, kind: Cvd): string {
  const { r, g, b } = linearize(hexToRgb(hex));
  const m = CVD_MATRIX[kind];
  return rgbToHex(
    delinearize({
      r: clamp01(m[0] * r + m[1] * g + m[2] * b),
      g: clamp01(m[3] * r + m[4] * g + m[5] * b),
      b: clamp01(m[6] * r + m[7] * g + m[8] * b),
    }),
  );
}

/**
 * Distância perceptual entre duas cores, em centésimos de unidade OKLab
 * (euclidiana). Escala legível: ~2 é o limiar de "dá para notar lado a lado",
 * ~10 é "claramente outra cor". Usada para separação de séries e para medir
 * deriva contra os valores históricos do tema Orbe.
 */
export function deltaE(a: string, b: string): number {
  const A = linearRgbToOklab(linearize(hexToRgb(a)));
  const B = linearRgbToOklab(linearize(hexToRgb(b)));
  const dL = A.L - B.L;
  const da = A.a - B.a;
  const db = A.b - B.b;
  return Math.sqrt(dL * dL + da * da + db * db) * 100;
}

/** Separação entre duas cores sob um tipo de daltonismo. */
export function cvdSeparation(a: string, b: string, kind: Cvd): number {
  return deltaE(simulateCvd(a, kind), simulateCvd(b, kind));
}

/**
 * Mistura `amount` de `b` dentro de `a`, em OKLab. Linear e sem surpresa de
 * matiz — ao contrário de misturar em sRGB, que escurece o meio do caminho.
 */
export function mix(a: string, b: string, amount: number): string {
  const t = clamp01(amount);
  const A = linearRgbToOklab(linearize(hexToRgb(a)));
  const B = linearRgbToOklab(linearize(hexToRgb(b)));
  return rgbToHex(
    delinearize(
      oklabToLinearRgb({
        L: A.L + (B.L - A.L) * t,
        a: A.a + (B.a - A.a) * t,
        b: A.b + (B.b - A.b) * t,
      }),
    ),
  );
}
