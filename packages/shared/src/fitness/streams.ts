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
 * Janela (s) da média móvel centrada aplicada à altitude antes da histerese.
 * Sem ela, o jitter de barômetro/GPS (±1–2 m por segundo) acumula como subida
 * e infla o ganho em ~2× (validado contra o EU-DEM em rota real).
 *
 * A janela é em TEMPO, não em amostras: os tracks vão de 1 Hz (Apple Watch) a
 * 1 ponto/5 s (o que chega pela ponte Strava→HealthKit). Contada em amostras,
 * a mesma "janela" suavizaria 15 s num caso e 75 s no outro, e o track esparso
 * perderia relevo real — era o que fazia a mesma subida render números
 * diferentes conforme quem gravou.
 */
export const ELEVATION_SMOOTH_SECONDS = 15;
/**
 * Fallback em amostras para rotas sem `t` (≈15 s a 1 Hz, a densidade das rotas
 * antigas do Apple Watch). Preserva o valor histórico dessas linhas.
 */
export const ELEVATION_SMOOTH_WINDOW = 15;

/**
 * Limiar (m) da histerese sobre série BAROMÉTRICA — a que vem de um FIT
 * (Garmin, ciclocomputador), direto ou pela ponte da Strava. Calibrado contra o
 * Garmin Connect: 59 vs 58 e 104 vs 103 em duas corridas, e erro mediano de 5%
 * em 11 pedaladas. Ver ADR 0021.
 */
export const ELEVATION_GAIN_THRESHOLD_BARO_M = 0.7;
/**
 * Limiar (m) sobre altitude de GNSS — a que o Apple Watch entrega no
 * `CLLocation.altitude` do HKWorkoutRoute. Tem deriva de baixa frequência que o
 * limiar barométrico acumularia como subida falsa: no pedal de 124 km de
 * 05/07/2026, 0,7 m dá 1.158 m contra os 894 m que a Strava mostra; 3 m dá 860.
 */
export const ELEVATION_GAIN_THRESHOLD_GNSS_M = 3;

/**
 * A série de altitude veio de um FIT? O formato guarda altitude em unidades de
 * 1/5 m, então TODO valor é múltiplo de 0,2 — assinatura que a altitude de
 * `CLLocation` (float arbitrário) não tem. É auto-descritivo: não depende de
 * saber quem gravou nem de estado externo.
 *
 * Série sem amplitude é descartada antes do teste: um track cuja altitude é
 * constante (fonte que gravou 0 em vez de omitir) passaria trivialmente, e o
 * limiar não muda nada nele de qualquer forma.
 */
function isBarometricSeries(alts: number[]): boolean {
  let min = Infinity;
  let max = -Infinity;
  for (const a of alts) {
    if (a < min) min = a;
    if (a > max) max = a;
  }
  if (!(max - min > 1)) return false;
  return alts.every((a) => Math.abs(a * 5 - Math.round(a * 5)) < 1e-6);
}

/** Média móvel centrada de janela `window` amostras, encolhendo nas bordas. */
function smoothByCount(xs: number[], window: number): number[] {
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
 * Média móvel centrada de janela `seconds` sobre `ts` (epoch ms, não-decrescente).
 * Dois ponteiros: cada índice olha os vizinhos dentro de ±seconds/2.
 */
function smoothByTime(xs: number[], ts: number[], seconds: number): number[] {
  if (seconds <= 0) return xs;
  const half = (seconds * 1000) / 2;
  const prefix = new Array<number>(xs.length + 1);
  prefix[0] = 0;
  for (let i = 0; i < xs.length; i++) prefix[i + 1] = prefix[i] + xs[i];
  const out = new Array<number>(xs.length);
  let a = 0;
  let b = 0;
  for (let i = 0; i < xs.length; i++) {
    while (ts[a] < ts[i] - half) a++;
    if (b < i) b = i;
    while (b + 1 < xs.length && ts[b + 1] <= ts[i] + half) b++;
    out[i] = (prefix[b + 1] - prefix[a]) / (b - a + 1);
  }
  return out;
}

/** Suaviza pela janela de tempo quando o track tem `t` utilizável; senão, por amostras. */
function smoothAltitudes(alts: number[], ts: number[] | undefined): number[] {
  return ts ? smoothByTime(alts, ts, ELEVATION_SMOOTH_SECONDS) : smoothByCount(alts, ELEVATION_SMOOTH_WINDOW);
}

/**
 * Ganho de elevação acumulado (m): suaviza a altitude (média móvel centrada de
 * `ELEVATION_SMOOTH_SECONDS`) e soma só as subidas, com histerese — a âncora só
 * avança quando a variação acumulada desde ela passa do limiar, então subidas
 * graduais contam por inteiro e o ruído do barômetro/GPS não.
 *
 * Sem `threshold` explícito, escolhe o limiar pelo TIPO DE SINAL da série
 * (`isBarometricSeries`) — o mesmo limiar não serve para altitude de FIT e de
 * GNSS. Este é o número canônico: vence o `total_elevation_gain` reportado por
 * strava/intervals, que o intervals infla em corrida (ADR 0021 supersede 0019).
 *
 * Retorna undefined quando nenhum ponto tem altitude (rota sem barômetro)
 * — espelha o `elevationGain` do mobile e o `_elevation_gain` das migrations.
 */
export function elevationGainFromPoints(
  points: FitnessPoint[] | undefined,
  threshold?: number,
): number | undefined {
  if (!points) return undefined;
  const alts: number[] = [];
  const ts: number[] = [];
  let monotonic = true;
  for (const p of points) {
    if (typeof p.alt !== 'number') continue;
    alts.push(p.alt);
    if (typeof p.t === 'number' && Number.isFinite(p.t)) {
      if (ts.length > 0 && p.t < ts[ts.length - 1]) monotonic = false;
      ts.push(p.t);
    }
  }
  if (alts.length === 0) return undefined;
  // Só usa a janela de tempo com timestamp em TODOS os pontos e sem clock skew;
  // um track meio-a-meio daria janelas incoerentes entre os trechos.
  const usable = monotonic && ts.length === alts.length ? ts : undefined;
  const limit =
    threshold ??
    (isBarometricSeries(alts) ? ELEVATION_GAIN_THRESHOLD_BARO_M : ELEVATION_GAIN_THRESHOLD_GNSS_M);
  let gain = 0;
  let ref: number | undefined;
  for (const alt of smoothAltitudes(alts, usable)) {
    if (ref === undefined) {
      ref = alt;
      continue;
    }
    const delta = alt - ref;
    if (delta > limit) {
      gain += delta;
      ref = alt;
    } else if (delta < -limit) {
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
