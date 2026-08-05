/**
 * Geometria de linhas suaves para gráficos SVG (web + mobile).
 *
 * A polilinha do esforço ponderado ligava os pontos com retas, o que deixa a
 * progressão "quadrada" — cada mês vira um bico. Aqui a curva é uma cúbica
 * monotônica (Fritsch–Carlson): suaviza os cantos sem inventar picos entre os
 * pontos nem descer abaixo de zero, coisa que uma Catmull-Rom solta faria.
 */

export interface LinePoint {
  x: number;
  y: number;
}

/** Tangentes monotônicas: nenhum trecho ultrapassa os valores dos seus extremos. */
function tangents(pts: readonly LinePoint[]): number[] {
  const n = pts.length;
  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = pts[i + 1].x - pts[i].x;
    slopes.push(dx === 0 ? 0 : (pts[i + 1].y - pts[i].y) / dx);
  }
  const m: number[] = new Array(n).fill(0);
  m[0] = slopes[0];
  m[n - 1] = slopes[n - 2];
  for (let i = 1; i < n - 1; i++) {
    const prev = slopes[i - 1];
    const next = slopes[i];
    // Ponto de virada (máximo/mínimo local): tangente zero mantém o extremo no ponto.
    m[i] = prev * next <= 0 ? 0 : (prev + next) / 2;
  }
  // Limite de Fritsch–Carlson: |tangente| <= 3x a menor inclinação vizinha.
  for (let i = 0; i < n - 1; i++) {
    const s = slopes[i];
    if (s === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / s;
    const b = m[i + 1] / s;
    const k = Math.hypot(a, b);
    if (k > 3) {
      m[i] = ((3 * a) / k) * s;
      m[i + 1] = ((3 * b) / k) * s;
    }
  }
  return m;
}

/** Um trecho contínuo: `M` inicial + cúbicas até o último ponto. */
function segmentPath(pts: readonly LinePoint[], round: (v: number) => number): string {
  const head = `M ${round(pts[0].x)} ${round(pts[0].y)}`;
  if (pts.length === 1) return head;
  if (pts.length === 2) return `${head} L ${round(pts[1].x)} ${round(pts[1].y)}`;

  const m = tangents(pts);
  const parts = [head];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const dx = (p1.x - p0.x) / 3;
    parts.push(
      `C ${round(p0.x + dx)} ${round(p0.y + m[i] * dx)}` +
        ` ${round(p1.x - dx)} ${round(p1.y - m[i + 1] * dx)}` +
        ` ${round(p1.x)} ${round(p1.y)}`,
    );
  }
  return parts.join(' ');
}

/**
 * Caminho SVG suave a partir de pontos em ordem crescente de `x`.
 * `null` quebra a linha (bucket sem ponto) e reinicia um trecho novo — o mesmo
 * contrato da polilinha anterior, então o caller só troca a montagem do `d`.
 */
export function smoothLinePath(points: readonly (LinePoint | null)[], precision = 2): string {
  const factor = 10 ** precision;
  const round = (v: number) => Math.round(v * factor) / factor;
  const parts: string[] = [];
  let run: LinePoint[] = [];
  const flush = () => {
    if (run.length) parts.push(segmentPath(run, round));
    run = [];
  };
  for (const p of points) {
    if (p === null) flush();
    else run.push(p);
  }
  flush();
  return parts.join(' ');
}
