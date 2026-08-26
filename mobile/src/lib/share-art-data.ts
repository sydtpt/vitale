/**
 * Séries derivadas do track GPS para as artes data-driven do cartão de
 * compartilhamento ("Velocidade" e "Perfil"). Funções puras, sem dependência
 * de react-native/HealthKit — testáveis sem mocks (padrão de workout-types.ts).
 */
import type { RoutePoint } from './workout-types';

const EARTH_RADIUS_M = 6371000;

/** Distância em metros entre dois pontos (Haversine). */
export function haversineM(a: RoutePoint, b: RoutePoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Média móvel centrada de janela `window`, encolhendo nas bordas (espelha
 *  smoothAltitudes de workout-types.ts). */
export function smoothSeries(xs: number[], window: number): number[] {
  if (window <= 1 || xs.length === 0) return xs.slice();
  const half = Math.floor(window / 2);
  const prefix = new Array<number>(xs.length + 1);
  prefix[0] = 0;
  for (let i = 0; i < xs.length; i++) prefix[i + 1] = prefix[i] + xs[i];
  const out = new Array<number>(xs.length);
  for (let i = 0; i < xs.length; i++) {
    const a = Math.max(0, i - half);
    const b = Math.min(xs.length - 1, i + half);
    out[i] = (prefix[b + 1] - prefix[a]) / (b - a + 1);
  }
  return out;
}

/**
 * Janela de suavização do PERFIL desenhado, em amostras. Serve só ao traçado —
 * não é a janela do ganho de elevação (`ELEVATION_SMOOTH_SECONDS`, em tempo),
 * que segue caminho próprio e não depende desta.
 */
const SMOOTH_WINDOW = 15;
/** Mínimo de amostras válidas para a série valer a pena visualmente. */
const MIN_SAMPLES = 10;
/** Desnível mínimo (m) para o perfil ter o que mostrar. */
const MIN_ELEVATION_SPAN_M = 3;

/**
 * Fração de velocidade (0..1) por segmento entre pontos consecutivos:
 * Δhaversine ÷ Δt, suavizada e normalizada com clamp nos percentis p10–p90
 * (imune a outliers de GPS). Comprimento = points.length − 1; segmentos sem
 * timestamp válido herdam o valor do vizinho anterior. Retorna null quando há
 * menos de MIN_SAMPLES segmentos com Δt válido (ex.: rota antiga sem `t`) —
 * o cartão então cai no traçado de cor única. Ritmo ~constante ⇒ tudo 0.5.
 */
export function speedFractions(points: readonly RoutePoint[]): number[] | null {
  if (points.length < MIN_SAMPLES + 1) return null;

  const raw = new Array<number | null>(points.length - 1);
  let valid = 0;
  for (let i = 1; i < points.length; i++) {
    const t0 = Date.parse(points[i - 1].timestamp ?? '');
    const t1 = Date.parse(points[i].timestamp ?? '');
    const dt = (t1 - t0) / 1000;
    if (Number.isFinite(dt) && dt > 0) {
      raw[i - 1] = haversineM(points[i - 1], points[i]) / dt;
      valid++;
    } else {
      raw[i - 1] = null;
    }
  }
  if (valid < MIN_SAMPLES) return null;

  // Buracos herdam o vizinho anterior (e o primeiro válido preenche o início).
  const filled = new Array<number>(raw.length);
  let last = raw.find((v): v is number => v !== null) ?? 0;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] !== null) last = raw[i] as number;
    filled[i] = last;
  }

  const smooth = smoothSeries(filled, SMOOTH_WINDOW);
  const sorted = [...smooth].sort((a, b) => a - b);
  const lo = sorted[Math.floor(0.1 * (sorted.length - 1))];
  const hi = sorted[Math.ceil(0.9 * (sorted.length - 1))];
  if (hi - lo < 1e-6) return smooth.map(() => 0.5);
  return smooth.map((v) => Math.min(1, Math.max(0, (v - lo) / (hi - lo))));
}

export interface ElevationProfile {
  /** Distância acumulada (m) por amostra — mesmo comprimento de `ys`. */
  xs: number[];
  /** Altitude suavizada (m) por amostra. */
  ys: number[];
  /** Índice do pico em `ys`. */
  peakIdx: number;
  /** Altitude do pico (série suavizada — robusta a spikes de GPS). */
  maxAlt: number;
  minAlt: number;
}

/**
 * Perfil de elevação do percurso: x = distância acumulada, y = altitude
 * suavizada. Retorna null sem dados suficientes ou com percurso ~plano
 * (desnível < MIN_ELEVATION_SPAN_M) — o cartão cai no traçado padrão.
 */
export function elevationProfile(points: readonly RoutePoint[]): ElevationProfile | null {
  const withAlt = points.filter((p) => typeof p.altitude === 'number');
  if (withAlt.length < MIN_SAMPLES) return null;

  const ys = smoothSeries(withAlt.map((p) => p.altitude as number), SMOOTH_WINDOW);
  const xs = new Array<number>(withAlt.length);
  xs[0] = 0;
  for (let i = 1; i < withAlt.length; i++) {
    xs[i] = xs[i - 1] + haversineM(withAlt[i - 1], withAlt[i]);
  }

  let peakIdx = 0;
  let minAlt = ys[0];
  for (let i = 1; i < ys.length; i++) {
    if (ys[i] > ys[peakIdx]) peakIdx = i;
    if (ys[i] < minAlt) minAlt = ys[i];
  }
  const maxAlt = ys[peakIdx];
  if (maxAlt - minAlt < MIN_ELEVATION_SPAN_M) return null;

  return { xs, ys, peakIdx, maxAlt, minAlt };
}
