/**
 * Piso das rotas — pintar o traçado por trecho.
 *
 * O `surface_segments` de uma rota é uma lista de `[inícioM, fimM, classe,
 * inferido]` medida ao longo do **`route_overview`**, não do track cheio: o
 * passe amostra a cada 400 m (`SURFACE_SAMPLE_SPACING_M`) e casa cada amostra
 * com a via mais próxima. São ~30 trechos numa pedalada típica.
 *
 * Daí a decisão desta camada: **a pintura não pode ser mais fina que a
 * amostra**. Fatiar o track cheio em blocos de 200 m, ou interpolar entre
 * amostras, desenharia uma precisão que a fonte não tem — a cor mudaria no meio
 * de uma rua porque a régua caiu ali, não porque o chão mudou. Pinta-se o
 * overview, na resolução em que o piso foi medido.
 *
 * A única interpolação que existe aqui é geométrica e obrigatória: a fronteira
 * entre dois trechos quase nunca cai exatamente num vértice, e sem cortar a
 * aresta a cor saltaria até o vértice seguinte — um erro de até 400 m visível a
 * olho nu no mapa.
 */
import { haversineM } from '../geo/distance';
import type { SurfaceCategory, SurfaceSegment } from './classify';

/** `[lat, lng]` — a forma exata em que `route_overview` chega do banco. */
export type OverviewPoint = [number, number];

export interface PaintedRun {
  /** Pontos consecutivos que compartilham a classe, prontos para uma polyline. */
  coords: OverviewPoint[];
  category: SurfaceCategory;
  /** 1 quando a classe veio do tipo de via, não de uma tag `surface` do OSM. */
  inferred: 0 | 1;
  /** Comprimento do trecho no overview, em metros. */
  lengthM: number;
}

/** Ponto a `t` do caminho de `a` para `b` — linear, que a 400 m é indistinguível. */
function lerp(a: OverviewPoint, b: OverviewPoint, t: number): OverviewPoint {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/**
 * Corta o overview nos limites dos trechos e devolve um traço por classe.
 *
 * Trechos consecutivos com a mesma classe **não** são fundidos: cada um carrega
 * o próprio `inferred`, e fundir apagaria a diferença entre um quilômetro
 * medido e um quilômetro adivinhado pelo tipo de via.
 *
 * Devolve vazio quando não há o que pintar — rota curta demais, sem segmentos,
 * ou segmentos que não alcançam a geometria. Quem chama desenha a linha lisa de
 * sempre nesse caso; um mapa sem cor é melhor que um mapa com cor inventada.
 */
export function paintRoute(
  overview: readonly OverviewPoint[],
  segments: readonly SurfaceSegment[],
): PaintedRun[] {
  if (overview.length < 2 || segments.length === 0) return [];

  // A régua: distância acumulada até cada vértice do overview.
  const cum = new Array<number>(overview.length);
  cum[0] = 0;
  for (let i = 1; i < overview.length; i += 1) {
    const a = overview[i - 1]!;
    const b = overview[i]!;
    cum[i] = cum[i - 1]! + haversineM(a[0], a[1], b[0], b[1]);
  }
  const totalM = cum[cum.length - 1]!;
  if (totalM <= 0) return [];

  /** O ponto a `d` metros do início, cortando a aresta quando preciso. */
  const at = (d: number): OverviewPoint => {
    if (d <= 0) return overview[0]!;
    if (d >= totalM) return overview[overview.length - 1]!;
    // Busca binária pela aresta que contém `d`.
    let lo = 0;
    let hi = cum.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid]! <= d) lo = mid;
      else hi = mid;
    }
    const span = cum[hi]! - cum[lo]!;
    const t = span > 0 ? (d - cum[lo]!) / span : 0;
    return lerp(overview[lo]!, overview[hi]!, t);
  };

  const out: PaintedRun[] = [];
  for (const [startM, endM, category, inferred] of segments) {
    const from = Math.max(0, Math.min(startM, totalM));
    const to = Math.max(0, Math.min(endM, totalM));
    if (to - from < 1) continue; // trecho degenerado: nada a desenhar

    // O traço começa no corte, passa por todos os vértices internos e termina
    // no corte seguinte. Sem os vértices internos a rua viraria uma reta.
    const coords: OverviewPoint[] = [at(from)];
    for (let i = 0; i < overview.length; i += 1) {
      const d = cum[i]!;
      if (d > from && d < to) coords.push(overview[i]!);
    }
    coords.push(at(to));

    out.push({ coords, category, inferred, lengthM: to - from });
  }
  return out;
}
