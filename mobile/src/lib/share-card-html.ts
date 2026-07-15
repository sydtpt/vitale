import type { MapStyleConfig } from '@vitale/shared';
import { MOD } from '../theme';
import { mapHead, mapScript, type MapPoint } from './map-html';

/** Formatos de saída do cartão (proporção). */
export type ShareFormat = 'story' | 'square' | 'portrait'; // 9:16 · 1:1 · 4:5
export type ShareBackground = 'art' | 'map';
export type ShareTheme = 'light' | 'dark';

/** Chave de métrica exibível no cartão. */
export type ShareMetricKey =
  | 'distance'
  | 'movingTime'
  | 'totalTime'
  | 'rate'
  | 'elevation'
  | 'calories'
  | 'hr';

/** Uma célula de estatística já formatada (valor + legenda). */
export interface ShareMetricTile {
  key: ShareMetricKey;
  value: string;
  caption: string;
}

/**
 * Dados crus da atividade repassados do detalhe para o composer. As strings de
 * métrica são derivadas aqui (reusando os formatadores) conforme o usuário liga
 * cada chip; a elevação é calculada dos pontos dentro do composer.
 */
export interface ShareContext {
  activityId: number;
  activityName?: string;
  metaLabel: string;
  startISO: string;
  distanceM?: number;
  movingS?: number;
  totalS?: number;
  calories?: number;
  /** Ganho de elevação (m), derivado da rota no detalhe. Ausente ⇒ sem chip. */
  elevationM?: number;
  /** Média de FC (bpm), quando disponível. Ausente ⇒ chip de FC não aparece. */
  hrAvgBpm?: number;
}

export interface ShareCardOptions {
  points: readonly MapPoint[];
  format: ShareFormat;
  background: ShareBackground;
  theme: ShareTheme;
  title: string;
  subtitle?: string;
  /** Já filtradas para as selecionadas + disponíveis, na ordem de exibição. */
  metrics: ShareMetricTile[];
  watermark: boolean;
  /** Cor de destaque (rota + detalhes). Default: laranja do treino. */
  accent?: string;
  /** Obrigatório quando `background === 'map'`. */
  mapTile?: MapStyleConfig;
}

/** Dimensões lógicas (px) por formato — a proporção que o WebView deve receber. */
export const FORMAT_DIMENSIONS: Record<ShareFormat, { width: number; height: number }> = {
  story: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
  portrait: { width: 1080, height: 1350 },
};

/** Razão largura/altura por formato (usada para o letterbox do preview). */
export function formatRatio(format: ShareFormat): number {
  const { width, height } = FORMAT_DIMENSIONS[format];
  return width / height;
}

/* ─────────────────────────── projeção da rota ─────────────────────────── */

function downsample(points: readonly MapPoint[], max: number): MapPoint[] {
  if (points.length <= max) return points.slice();
  const step = Math.ceil(points.length / max);
  const out: MapPoint[] = [];
  for (let i = 0; i < points.length; i += step) out.push(points[i]);
  const last = points[points.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

const round = (n: number) => Math.round(n * 10) / 10;

/** Padding relativo (fração do lado maior) ao redor do traçado no viewBox. */
const ROUTE_PAD = 0.08;
/** Lado maior do viewBox normalizado do traçado. */
const ROUTE_MAJOR = 1000;

/**
 * Projeta os pontos GPS num traçado SVG normalizado ao próprio bounding box
 * (projeção equirretangular: longitude escalada por `cos(lat)`; eixo Y
 * invertido). O `viewBox` retornado tem a proporção da rota, então o `<svg>`
 * pode preencher qualquer região com `preserveAspectRatio="xMidYMid meet"` sem
 * distorcer nem depender do formato do cartão.
 */
export function projectRouteToSvg(points: readonly MapPoint[]): {
  viewBox: string;
  line: string;
  start: [number, number] | null;
  end: [number, number] | null;
} {
  const pts = downsample(points, 400);
  if (pts.length < 2) return { viewBox: '0 0 100 100', line: '', start: null, end: null };

  const lat0 =
    (pts.reduce((s, p) => s + p.latitude, 0) / pts.length) * (Math.PI / 180);
  const cos = Math.cos(lat0);
  const proj = pts.map((p) => ({ x: p.longitude * cos, y: p.latitude }));

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of proj) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const spanX = Math.max(maxX - minX, 1e-9);
  const spanY = Math.max(maxY - minY, 1e-9);
  const scale = ROUTE_MAJOR / Math.max(spanX, spanY);
  const pad = ROUTE_PAD * ROUTE_MAJOR;
  const vbW = spanX * scale + 2 * pad;
  const vbH = spanY * scale + 2 * pad;

  const xy = proj.map((p): [number, number] => [
    round(pad + (p.x - minX) * scale),
    round(pad + (maxY - p.y) * scale),
  ]);

  return {
    viewBox: `0 0 ${round(vbW)} ${round(vbH)}`,
    line: xy.map(([x, y]) => `${x},${y}`).join(' '),
    start: xy[0],
    end: xy[xy.length - 1],
  };
}

/* ───────────────────────────── HTML do cartão ─────────────────────────── */

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const SANS = "-apple-system, 'Geist', system-ui, 'Segoe UI', Roboto, sans-serif";
const MONO = "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace";
const SERIF = "'Instrument Serif', Georgia, 'Times New Roman', serif";

const GREEN = '#6FA86A';

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Gradiente de fundo do cartão "arte" (glow accent + degradê da marca por tema). */
function artBgStyle(theme: ShareTheme, accent: string): string {
  const gradient =
    theme === 'dark'
      ? 'linear-gradient(160deg, #1C1812 0%, #241E18 60%, #2A231B 100%)'
      : 'linear-gradient(160deg, #FFF7EE 0%, #FFE9DA 55%, #FFDFC9 100%)';
  const glow = `radial-gradient(circle at 78% 16%, ${hexToRgba(accent, theme === 'dark' ? 0.22 : 0.28)}, transparent 55%)`;
  return `${glow}, ${gradient}`;
}

export function buildShareCardHtml(opts: ShareCardOptions): string {
  const {
    points,
    format,
    background,
    theme,
    title,
    subtitle,
    metrics,
    watermark,
    accent = MOD.treino.accent,
    mapTile,
  } = opts;

  const isMap = background === 'map' && !!mapTile;
  const dark = theme === 'dark';

  // Cores de texto: sobre mapa (tiles variáveis) sempre branco + scrim;
  // sobre arte, tinta do tema (o gradiente controla o contraste).
  const fg = isMap ? '#FFFFFF' : dark ? '#F6EFE6' : '#1F1B16';
  const fgMuted = isMap
    ? 'rgba(255,255,255,0.85)'
    : dark
      ? 'rgba(246,239,230,0.68)'
      : 'rgba(31,27,22,0.58)';
  const shadow = isMap ? 'text-shadow: 0 1px 12px rgba(0,0,0,0.45);' : '';

  // Camadas de fundo + região central da rota.
  let bgLayer: string;
  let routeLayer = '<div class="routeArea"></div>';
  let headExtra = '';
  let scriptExtra = '';
  if (isMap && mapTile) {
    // Mapa preenche o fundo; a região central fica vazia (rota vem do mapa).
    bgLayer = '<div class="bg"><div id="map"></div></div>';
    headExtra = mapHead(mapTile);
    scriptExtra = mapScript(points, mapTile, { interactive: false, padding: 90 });
  } else {
    // Arte: gradiente no fundo; a rota (SVG normalizado ao próprio bbox) mora na
    // região flexível central, entre título e métricas — nunca cruza o texto.
    bgLayer = `<div class="bg" style="background: ${artBgStyle(theme, accent)};"></div>`;
    const { viewBox, line, start, end } = projectRouteToSvg(points);
    const casing = 26;
    const stroke = 15;
    const dot = 22;
    const route = line
      ? `
        <polyline points="${line}" fill="none" stroke="#FFFFFF" stroke-opacity="0.95" stroke-width="${casing}" stroke-linejoin="round" stroke-linecap="round" />
        <polyline points="${line}" fill="none" stroke="${accent}" stroke-width="${stroke}" stroke-linejoin="round" stroke-linecap="round" />
        ${start ? `<circle cx="${start[0]}" cy="${start[1]}" r="${dot}" fill="${GREEN}" stroke="#FFFFFF" stroke-width="8" />` : ''}
        ${end ? `<circle cx="${end[0]}" cy="${end[1]}" r="${dot}" fill="${accent}" stroke="#FFFFFF" stroke-width="8" />` : ''}`
      : '';
    routeLayer = `<div class="routeArea"><svg viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">${route}</svg></div>`;
  }

  const scrim = isMap
    ? '<div class="scrim"></div>'
    : '';

  const tiles = metrics
    .map(
      (m) => `
      <div class="tile">
        <div class="value">${escapeHtml(m.value)}</div>
        <div class="caption">${escapeHtml(m.caption)}</div>
      </div>`,
    )
    .join('');

  const mark = watermark
    ? `<div class="mark"><span class="markTri"></span><span class="markName">Vitale</span></div>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  ${headExtra}
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; height: 100%; background: #000; }
    .bg { position: absolute; inset: 0; z-index: 0; overflow: hidden; }
    #map { position: absolute; inset: 0; }
    .scrim { position: absolute; inset: 0; z-index: 1; pointer-events: none;
      background: linear-gradient(to bottom, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0) 24%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.62) 100%); }
    .card { position: absolute; inset: 0; z-index: 2; display: flex; flex-direction: column;
      justify-content: space-between; padding: 7vw 6vw; font-family: ${SANS}; color: ${fg}; ${shadow} }
    .routeArea { flex: 1; position: relative; min-height: 0; margin: 4vw 0; }
    .routeArea svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
    .title { font-family: ${SERIF}; font-size: 9.5vw; line-height: 1.02; font-weight: 400; }
    .rule { width: 15vw; height: 1.1vw; border-radius: 1vw; background: ${accent}; margin-top: 3vw; }
    .subtitle { font-size: 3.4vw; letter-spacing: 0.12em; text-transform: uppercase;
      color: ${fgMuted}; margin-top: 3vw; }
    .footer { display: flex; flex-direction: column; gap: 4vw; }
    .metrics { display: flex; flex-wrap: wrap; gap: 3vw 8vw; }
    .tile { display: flex; flex-direction: column; }
    .value { font-family: ${MONO}; font-weight: 700; font-size: 7vw; line-height: 1;
      letter-spacing: -0.02em; }
    .caption { font-size: 3vw; letter-spacing: 0.1em; text-transform: uppercase;
      color: ${fgMuted}; margin-top: 1.6vw; }
    .mark { display: flex; align-items: center; gap: 2vw; opacity: 0.92; }
    .markTri { width: 0; height: 0; border-left: 2.2vw solid transparent; border-right: 2.2vw solid transparent;
      border-bottom: 3.8vw solid ${accent}; }
    .markName { font-family: ${SERIF}; font-size: 4.6vw; }
  </style>
</head>
<body>
  ${bgLayer}
  ${scrim}
  <div class="card">
    <div class="header">
      <div class="title">${escapeHtml(title)}</div>
      <div class="rule"></div>
      ${subtitle ? `<div class="subtitle">${escapeHtml(subtitle)}</div>` : ''}
    </div>
    ${routeLayer}
    <div class="footer">
      <div class="metrics">${tiles}</div>
      ${mark}
    </div>
  </div>
  ${scriptExtra}
</body>
</html>`;
}
