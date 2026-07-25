/**
 * Kernel de métricas derivadas de streams de treino (rota GPS + FC), no shape
 * persistido (`activity_routes.points`): `{lat, lng, alt?, t?}` com `t` em epoch ms.
 *
 * Ports puros dos módulos do mobile (`moving-time.ts`, `best-efforts.ts`,
 * `heart-rate-zones.ts`, `elevationGain`) para uso por qualquer ambiente —
 * inclusive Deno (edge functions). Por isso este arquivo é uma FOLHA: zero
 * imports (nem relativos, nem de pacote), para o Deno importá-lo com path `.ts`
 * explícito sem arrastar o grafo de módulos do shared. As fronteiras de zona de
 * FC são re-declaradas aqui; um teste de paridade as pina em `HR_ZONES`
 * (`health/hr-zones.ts`) e nas implementações do mobile.
 */

/** Ponto de rota persistido (mesmo shape de `ActivityRoutePoint` em models). */
export interface FitnessPoint {
  lat: number;
  lng: number;
  alt?: number;
  /** Timestamp do ponto em epoch ms. Ausente em rotas antigas. */
  t?: number;
}

/** Amostra de FC: batimentos por minuto num instante (epoch ms). */
export interface FitnessHrSample {
  bpm: number;
  t: number;
}

export interface FitnessHrZoneParams {
  /** FC máxima estimada (bpm). Tipicamente 220 − idade. */
  maxHr: number;
  /** FC de repouso (bpm). Ausente/0 ⇒ cálculo cai para % da FCmáx. */
  restHr?: number;
}

const EARTH_RADIUS_M = 6371000;

/** Distância em metros entre dois pares lat/lng (Haversine). */
function haversineM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const la1 = toRad(aLat);
  const la2 = toRad(bLat);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(la1) * Math.cos(la2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Limiar de velocidade (m/s) abaixo do qual o atleta é considerado parado.
 * ~0.8 m/s (≈2.9 km/h) descarta o ruído de GPS de quem está parado sem cortar
 * caminhada/corrida reais.
 */
export const FITNESS_MOVING_SPEED_THRESHOLD_MPS = 0.8;

/**
 * Tempo em movimento (s): soma dos intervalos entre pontos consecutivos cuja
 * velocidade ficou ≥ `minSpeedMps` — paradas (semáforo, pausa) e lacunas de
 * gravação não contam. Retorna undefined sem amostras suficientes com tempo.
 */
export function movingTimeFromPoints(
  points: FitnessPoint[] | undefined,
  minSpeedMps = FITNESS_MOVING_SPEED_THRESHOLD_MPS,
): number | undefined {
  if (!points) return undefined;
  const pts = points.filter(
    (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && typeof p.t === 'number' && Number.isFinite(p.t),
  );
  if (pts.length < 2) return undefined;
  let moving = 0;
  for (let i = 1; i < pts.length; i++) {
    const dt = ((pts[i].t as number) - (pts[i - 1].t as number)) / 1000;
    if (!Number.isFinite(dt) || dt <= 0) continue; // clock skew / duplicatas
    const dd = haversineM(pts[i - 1].lat, pts[i - 1].lng, pts[i].lat, pts[i].lng);
    if (dd / dt >= minSpeedMps) moving += dt;
  }
  return moving > 0 ? Math.round(moving) : undefined;
}

/**
 * Janela da média móvel centrada (em amostras ≈ segundos a 1 Hz) aplicada à
 * altitude antes da histerese. Sem ela, o jitter de barômetro/GPS (±1–2 m por
 * segundo) acumula como subida e infla o ganho em ~2× (validado contra o
 * EU-DEM em rota real).
 */
export const ELEVATION_SMOOTH_WINDOW = 15;
/** Limiar (m) da histerese do ganho de elevação, sobre a série suavizada. */
export const ELEVATION_GAIN_THRESHOLD_M = 3;

/** Média móvel centrada de janela `window`, encolhendo nas bordas. */
function smoothAltitudes(xs: number[], window: number): number[] {
  if (window <= 1) return xs;
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
 * Ganho de elevação acumulado (m): suaviza a altitude (média móvel centrada
 * de `ELEVATION_SMOOTH_WINDOW` amostras) e soma só as subidas, com histerese
 * — a âncora só avança quando a variação acumulada desde ela passa do limiar,
 * então subidas graduais contam por inteiro e o ruído do barômetro/GPS não.
 * Retorna undefined quando nenhum ponto tem altitude (rota sem barômetro)
 * — espelha o `elevationGain` do mobile e o `_elevation_gain` das migrations.
 */
export function elevationGainFromPoints(
  points: FitnessPoint[] | undefined,
  threshold = ELEVATION_GAIN_THRESHOLD_M,
): number | undefined {
  if (!points) return undefined;
  const alts: number[] = [];
  for (const p of points) {
    if (typeof p.alt === 'number') alts.push(p.alt);
  }
  if (alts.length === 0) return undefined;
  let gain = 0;
  let ref: number | undefined;
  for (const alt of smoothAltitudes(alts, ELEVATION_SMOOTH_WINDOW)) {
    if (ref === undefined) {
      ref = alt;
      continue;
    }
    const delta = alt - ref;
    if (delta > threshold) {
      gain += delta;
      ref = alt;
    } else if (delta < -threshold) {
      ref = alt;
    }
  }
  return gain;
}

/**
 * Distâncias padrão dos best efforts. As chaves DEVEM casar com as lidas em
 * `running-highlights` (web e mobile) e com `BEST_EFFORT_DISTANCES` do mobile.
 */
export const BEST_EFFORT_TARGETS: ReadonlyArray<{ key: string; meters: number }> = [
  { key: '1000', meters: 1000 },
  { key: '5000', meters: 5000 },
  { key: '10000', meters: 10000 },
  { key: '20000', meters: 20000 },
  { key: 'half', meters: 21097.5 },
  { key: '30000', meters: 30000 },
  { key: '40000', meters: 40000 },
  { key: 'marathon', meters: 42195 },
];

/**
 * Menor tempo (s) para cobrir `target` metros num trecho contínuo — janela
 * deslizante sobre distância acumulada × tempo em movimento, com interpolação
 * na borda inicial para medir exatamente `target`.
 */
function bestWindow(cum: number[], time: number[], target: number): number | undefined {
  const n = cum.length;
  if (n < 2 || cum[n - 1] < target) return undefined;

  let best = Infinity;
  let i = 0;
  for (let j = 1; j < n; j++) {
    while (i + 1 < j && cum[j] - cum[i + 1] >= target) i++;
    if (cum[j] - cum[i] < target) continue;

    const segDist = cum[i + 1] - cum[i];
    const excess = cum[j] - cum[i] - target;
    let startTime = time[i];
    if (segDist > 0 && excess > 0) {
      startTime += (excess / segDist) * (time[i + 1] - time[i]);
    }
    const dur = time[j] - startTime;
    if (dur > 0 && dur < best) best = dur;
  }
  return best === Infinity ? undefined : Math.round(best);
}

/**
 * Recordes de corrida a partir do track. Mapa chave→segundos para cada distância
 * padrão coberta. O eixo de tempo é o tempo EM MOVIMENTO (paradas não inflam o
 * recorde). Vazio se não houver timestamps suficientes.
 */
export function computeBestEffortsFromPoints(points: FitnessPoint[]): Record<string, number> {
  const pts = points.filter(
    (p) =>
      typeof p.t === 'number' &&
      Number.isFinite(p.t) &&
      Number.isFinite(p.lat) &&
      Number.isFinite(p.lng),
  );
  if (pts.length < 2) return {};

  const cum: number[] = [0];
  const time: number[] = [0]; // tempo em movimento acumulado (s)
  let prev = pts[0];
  let moving = 0;
  for (let i = 1; i < pts.length; i++) {
    const dt = ((pts[i].t as number) - (prev.t as number)) / 1000;
    // Ignora pontos com tempo não-crescente, medindo sempre a partir do último aceito.
    if (!Number.isFinite(dt) || dt <= 0) continue;
    const dist = haversineM(prev.lat, prev.lng, pts[i].lat, pts[i].lng);
    if (dist / dt >= FITNESS_MOVING_SPEED_THRESHOLD_MPS) moving += dt;
    cum.push(cum[cum.length - 1] + dist);
    time.push(moving);
    prev = pts[i];
  }

  const out: Record<string, number> = {};
  for (const { key, meters } of BEST_EFFORT_TARGETS) {
    const secs = bestWindow(cum, time, meters);
    if (secs !== undefined) out[key] = secs;
  }
  return out;
}

/**
 * Fronteiras das zonas de FC como fração da FC máxima, da mais leve à mais
 * intensa. Duplicadas de `HR_ZONES` (health/hr-zones.ts) para manter esta folha
 * sem imports — teste de paridade pina os valores.
 */
const HR_ZONE_BOUNDS: ReadonlyArray<{ key: string; max: number }> = [
  { key: 'z1', max: 0.6 },
  { key: 'z2', max: 0.7 },
  { key: 'z3', max: 0.8 },
  { key: 'z4', max: 0.9 },
  { key: 'z5', max: Infinity },
];

/** Intervalo (s) acima do qual o gap entre amostras é pausa, não tempo ativo. */
const MAX_GAP_S = 60;

/**
 * Tempo (s) em cada zona de FC por **% da FC máxima** (padrão Garmin):
 *   %FCmáx = FC / FCmáx
 * Intervalo entre amostras consecutivas vai para a zona da amostra que o abre;
 * gaps > 60 s são descartados. `restHr` é opcional (legado Karvonen: quando > 0
 * usa reserva de FC) — os chamadores hoje o omitem para casar com o relógio.
 * Mapa chave→segundos só com zonas que tiveram tempo; vazio sem amostras/params
 * válidos.
 */
export function computeHrZonesFromSamples(
  samples: FitnessHrSample[],
  params: FitnessHrZoneParams,
): Record<string, number> {
  const valid = samples
    .filter((s) => Number.isFinite(s.bpm) && s.bpm > 0 && Number.isFinite(s.t))
    .sort((a, b) => a.t - b.t);
  if (valid.length < 2) return {};

  const restHr = params.restHr && params.restHr > 0 ? params.restHr : 0;
  const reserve = params.maxHr - restHr;
  if (!(reserve > 0)) return {};

  const out: Record<string, number> = {};
  for (let i = 0; i < valid.length - 1; i++) {
    const dt = (valid[i + 1].t - valid[i].t) / 1000;
    if (dt <= 0 || dt > MAX_GAP_S) continue;
    const frac = (valid[i].bpm - restHr) / reserve;
    const idx = HR_ZONE_BOUNDS.findIndex((z) => frac < z.max);
    const key = HR_ZONE_BOUNDS[idx < 0 ? HR_ZONE_BOUNDS.length - 1 : idx].key;
    out[key] = (out[key] ?? 0) + dt;
  }

  const rounded: Record<string, number> = {};
  for (const [k, v] of Object.entries(out)) {
    const s = Math.round(v);
    if (s > 0) rounded[k] = s;
  }
  return rounded;
}

/** FCmáx a partir da idade (220 − idade); sem idade válida, usa o fallback. */
export function fitnessMaxHrFromAge(age?: number, fallback = 190): number {
  return age && age > 0 && age < 120 ? 220 - age : fallback;
}
