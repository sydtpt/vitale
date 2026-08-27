/**
 * Séries derivadas do track GPS: perfil de elevação e velocidade ao longo do
 * percurso.
 *
 * Nasceram no `mobile/src/lib/share-art-data.ts`, servindo as artes do cartão de
 * compartilhamento. São puras e não têm nada de mobile — e o detalhe da
 * atividade, nos dois apps, quer exatamente as mesmas curvas. Ficaram aqui; o
 * compositor do cartão virou um adaptador de formato.
 *
 * **O ponto é o persistido** (`{lat, lng, alt?, t?}`, `t` em epoch ms), que é o
 * que as duas telas de detalhe já têm em mãos. O formato do HealthKit
 * (`RoutePoint`, com nomes longos e timestamp ISO) é o de entrada do sync, e
 * converter entre os dois é trabalho de adaptador.
 */
import type { ActivityRoutePoint } from '../models';
import { haversineM } from '../geo/distance';

/**
 * Janela de suavização do traçado, em amostras.
 *
 * Serve só ao desenho. **Não** é a janela do ganho de elevação
 * (`ELEVATION_SMOOTH_WINDOW`, em `streams.ts`), que alimenta um número
 * publicado e segue caminho próprio. Terem o mesmo valor hoje é coincidência,
 * não acoplamento: unificá-las faria uma mudança estética mexer numa métrica.
 */
const SMOOTH_WINDOW = 15;
/** Mínimo de amostras válidas para a série valer a pena visualmente. */
const MIN_SAMPLES = 10;
/** Desnível mínimo (m) para o perfil ter o que mostrar. */
const MIN_ELEVATION_SPAN_M = 3;

/** Média móvel centrada de janela `window`, encolhendo nas bordas. */
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

/** Velocidade por segmento, com a distância acumulada em que ela aconteceu. */
export interface SpeedSeries {
  /** Distância acumulada (m) no fim de cada segmento. */
  xs: number[];
  /** Velocidade suavizada (m/s) do segmento. */
  mps: number[];
}

/**
 * Velocidade real por segmento: Δhaversine ÷ Δt, com os buracos herdando o
 * vizinho anterior e uma média móvel por cima.
 *
 * `null` quando menos de `MIN_SAMPLES` segmentos têm Δt válido — rota antiga,
 * gravada antes de o sync guardar o horário de cada ponto. Nesse caso não há
 * curva de ritmo a desenhar, e desenhar uma reta seria inventar.
 */
export function speedSeries(points: readonly ActivityRoutePoint[]): SpeedSeries | null {
  if (points.length < MIN_SAMPLES + 1) return null;

  const raw = new Array<number | null>(points.length - 1);
  const xs = new Array<number>(points.length - 1);
  let acc = 0;
  let valid = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const d = haversineM(a.lat, a.lng, b.lat, b.lng);
    acc += d;
    xs[i - 1] = acc;
    const dt = ((b.t ?? NaN) - (a.t ?? NaN)) / 1000;
    if (Number.isFinite(dt) && dt > 0) {
      raw[i - 1] = d / dt;
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

  return { xs, mps: smoothSeries(filled, SMOOTH_WINDOW) };
}

/**
 * Fração de velocidade (0..1) por segmento, com clamp nos percentis p10–p90
 * (imune a outliers de GPS). Ritmo ~constante ⇒ tudo 0,5.
 *
 * É o que a arte "Velocidade" do cartão consome: ela pinta o traçado, não
 * desenha eixo, então o que importa é a posição relativa e não o valor. Para um
 * gráfico com unidade, use `speedSeries` — jogar a escala fora e depois
 * reinventá-la seria pior que não a ter jogado.
 */
export function speedFractions(points: readonly ActivityRoutePoint[]): number[] | null {
  const series = speedSeries(points);
  if (!series) return null;

  const smooth = series.mps;
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
 * suavizada.
 *
 * `null` sem amostras suficientes **ou com percurso ~plano** (desnível abaixo de
 * `MIN_ELEVATION_SPAN_M`). O segundo caso é o que importa na tela: um perfil de
 * 1,5 m de desnível esticado na altura do card desenha uma montanha que não
 * existe. Quem chama esconde a seção em vez de mostrar gráfico vazio.
 */
export function elevationProfile(
  points: readonly ActivityRoutePoint[],
): ElevationProfile | null {
  const withAlt = points.filter((p) => typeof p.alt === 'number');
  if (withAlt.length < MIN_SAMPLES) return null;

  const ys = smoothSeries(withAlt.map((p) => p.alt as number), SMOOTH_WINDOW);
  const xs = new Array<number>(withAlt.length);
  xs[0] = 0;
  for (let i = 1; i < withAlt.length; i++) {
    xs[i] = xs[i - 1] + haversineM(
      withAlt[i - 1].lat, withAlt[i - 1].lng,
      withAlt[i].lat, withAlt[i].lng,
    );
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
