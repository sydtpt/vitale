import type { CityMark, MapStyleConfig } from '@vitale/shared';
import { MOD } from '../theme';
import { mapHead, mapScript, type MapPoint, type MapViewState } from './map-html';
import { SHARE_FONT_FACE_CSS } from './share-fonts';
import { ACTIVITY_ICON_PATHS } from './share-activity-icons';
import { getActivityMeta, type RoutePoint } from './workout-types';
import { speedFractions, elevationProfile } from './share-art-data';

/** Formatos de saída do cartão (proporção). */
export type ShareFormat = 'story' | 'square' | 'portrait'; // 9:16 · 1:1 · 4:5
/** Ambos os fundos sem mapa exportam PNG com alpha (sticker): 'art' desenha a
 *  rota/perfil sobre transparência, 'data' só título/métricas/marca. */
export type ShareBackground = 'art' | 'map' | 'data';
/** Desenho da região central no fundo "arte" — todos data-driven. 'speed' e
 *  'elevation' dependem de timestamp/altitude no track (caem no traçado padrão
 *  quando faltam); 'route' é só o traçado. */
export type ShareArtStyle = 'speed' | 'route' | 'elevation';
/** Efeito aplicado sobre os tiles do mapa (entre o mapa e o scrim). */
export type ShareMapEffect = 'none' | 'duotone' | 'gradient' | 'grain' | 'vignette';

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
  /** Cidades atravessadas pela rota (bike enriquecida). Ausente/vazio ⇒ o toggle
   *  "Mostrar cidades" não aparece. */
  cities?: CityMark[];
}

export interface ShareCardOptions {
  /** Track da atividade — altitude/timestamp (quando presentes) alimentam as
   *  artes data-driven; o mapa e as demais artes usam só lat/lng. */
  points: readonly RoutePoint[];
  format: ShareFormat;
  background: ShareBackground;
  title: string;
  /** Desenha o título (ícone + texto) e o traço logo abaixo. */
  showTitle: boolean;
  /** Tipo de atividade — desenha o glifo correspondente antes do título
   *  (mesmo mapeamento de getActivityMeta). Ausente ⇒ sem ícone. */
  activityId?: number;
  /** Já filtradas para as selecionadas + disponíveis, na ordem de exibição. */
  metrics: ShareMetricTile[];
  /** Cidades a rotular na rota — já filtradas para as selecionadas pelo usuário.
   *  Ausente/vazio ⇒ nenhuma cidade desenhada. Só têm efeito nos fundos com rota
   *  (arte e mapa). */
  cities?: CityMark[];
  watermark: boolean;
  /** Cor de destaque (rota + detalhes). Default: laranja do treino. */
  accent?: string;
  /** Cor do texto (hex). Ausente ⇒ automática: branca sobre mapa, tinta do tema sobre arte. */
  textColor?: string;
  /** Desenho da região central no fundo "arte". Default: 'speed'. */
  artStyle?: ShareArtStyle;
  /** Efeito sobre os tiles quando `background === 'map'`. Default: 'none'. */
  mapEffect?: ShareMapEffect;
  /** Obrigatório quando `background === 'map'`. */
  mapTile?: MapStyleConfig;
  /** Mapa de fundo interativo (pan/zoom/rotação) + report do enquadramento via
   *  postMessage — usado no preview do composer. Default: estático. */
  mapInteractive?: boolean;
  /** Enquadramento salvo do mapa — substitui o fitBounds inicial (export fiel ao preview). */
  mapView?: MapViewState;
  /** Xadrez de transparência sob o cartão (só no preview dos fundos com alpha —
   *  nunca no export, senão o xadrez sai na imagem). */
  previewChecker?: boolean;
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

function downsample<T>(points: readonly T[], max: number): T[] {
  if (points.length <= max) return points.slice();
  const step = Math.ceil(points.length / max);
  const out: T[] = [];
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
/** Projeção comum: viewBox + coordenadas por vértice + pontos mantidos pelo
 *  downsample (1:1 com `xy` — a arte 'speed' colore segmento a segmento). */
function projectRoute<T extends MapPoint>(
  points: readonly T[],
): { viewBox: string; xy: [number, number][]; kept: T[] } | null {
  const pts = downsample(points, 400);
  if (pts.length < 2) return null;

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

  return { viewBox: `0 0 ${round(vbW)} ${round(vbH)}`, xy, kept: pts };
}

export function projectRouteToSvg(points: readonly MapPoint[]): {
  viewBox: string;
  line: string;
  start: [number, number] | null;
  end: [number, number] | null;
} {
  const proj = projectRoute(points);
  if (!proj) return { viewBox: '0 0 100 100', line: '', start: null, end: null };
  return {
    viewBox: proj.viewBox,
    line: proj.xy.map(([x, y]) => `${x},${y}`).join(' '),
    start: proj.xy[0],
    end: proj.xy[proj.xy.length - 1],
  };
}

/* ───────────────────────────── HTML do cartão ─────────────────────────── */

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Tipografia do cartão: família Ubuntu (embutida via SHARE_FONT_FACE_CSS).
// Ubuntu para texto/título, Ubuntu Mono para os valores numéricos.
const SANS = "'Ubuntu', -apple-system, system-ui, 'Segoe UI', Roboto, sans-serif";
const MONO = "'Ubuntu Mono', ui-monospace, SFMono-Regular, Menlo, monospace";
const DISPLAY = SANS;

const GREEN = '#6FA86A';

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Mistura linear de dois hex (t=0 → a, t=1 → b). Evita depender de
 *  `color-mix()`, de suporte incerto em WebViews antigos. */
function mixHex(a: string, b: string, t: number): string {
  const parse = (hex: string): number[] => {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  };
  const ca = parse(a);
  const cb = parse(b);
  const ch = (i: number) =>
    Math.round(ca[i] + (cb[i] - ca[i]) * t)
      .toString(16)
      .padStart(2, '0');
  return `#${ch(0)}${ch(1)}${ch(2)}`;
}

/* ─────────────────── região central da arte (rota / dados) ─────────────── */

const ROUTE_CASING = 26;
const ROUTE_STROKE = 15;
const ROUTE_DOT = 22;

/** Marcadores de início (verde) e fim (accent) do traçado. */
function routeDots(xy: [number, number][], accent: string): string {
  const start = xy[0];
  const end = xy[xy.length - 1];
  return `
        <circle cx="${start[0]}" cy="${start[1]}" r="${ROUTE_DOT}" fill="${GREEN}" stroke="#FFFFFF" stroke-width="8" />
        <circle cx="${end[0]}" cy="${end[1]}" r="${ROUTE_DOT}" fill="${accent}" stroke="#FFFFFF" stroke-width="8" />`;
}

/** Traçado padrão de cor única: casing branca + linha accent + dots. Usado como
 *  fallback do 'speed' quando o track não tem timestamp. */
function standardRouteBody(xy: [number, number][], accent: string): string {
  const line = xy.map(([x, y]) => `${x},${y}`).join(' ');
  return `
        <polyline points="${line}" fill="none" stroke="#FFFFFF" stroke-opacity="0.95" stroke-width="${ROUTE_CASING}" stroke-linejoin="round" stroke-linecap="round" />
        <polyline points="${line}" fill="none" stroke="${accent}" stroke-width="${ROUTE_STROKE}" stroke-linejoin="round" stroke-linecap="round" />
        ${routeDots(xy, accent)}`;
}

/** 'route': só a linha no accent + marcadores de início/fim — sem a casing
 *  branca, que sobre fundo transparente vira um halo indesejado. */
function plainRouteBody(xy: [number, number][], accent: string): string {
  const line = xy.map(([x, y]) => `${x},${y}`).join(' ');
  return `
        <polyline points="${line}" fill="none" stroke="${accent}" stroke-width="${ROUTE_STROKE}" stroke-linejoin="round" stroke-linecap="round" />
        ${routeDots(xy, accent)}`;
}

/** Cores da rampa de ritmo (tokens do app: água → amarelo → accent). */
const HEAT_SLOW = '#6E8CC9';
const HEAT_MID = '#F5B946';

/** Cor da rampa de calor para a fração de velocidade f ∈ [0,1]. */
function heatColor(f: number, accent: string): string {
  return f < 0.5 ? mixHex(HEAT_SLOW, HEAT_MID, f * 2) : mixHex(HEAT_MID, accent, (f - 0.5) * 2);
}

/** 'speed': casing branca + um segmento colorido por fração de velocidade
 *  (caps redondos emendam os segmentos sem costura). */
function speedRouteBody(xy: [number, number][], fractions: number[], accent: string): string {
  const line = xy.map(([x, y]) => `${x},${y}`).join(' ');
  const segs = fractions
    .map((f, i) => {
      const [x1, y1] = xy[i];
      const [x2, y2] = xy[i + 1];
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${heatColor(f, accent)}" stroke-width="${ROUTE_STROKE}" stroke-linecap="round" />`;
    })
    .join('');
  return `
        <polyline points="${line}" fill="none" stroke="#FFFFFF" stroke-opacity="0.95" stroke-width="${ROUTE_CASING}" stroke-linejoin="round" stroke-linecap="round" />
        ${segs}
        ${routeDots(xy, accent)}`;
}

/** 'elevation': perfil de altitude ancorado no pé da região central — área
 *  com degradê accent, linha de topo e pico rotulado (altitude máx). */
function elevationSvg(
  prof: NonNullable<ReturnType<typeof elevationProfile>>,
  accent: string,
  fg: string,
): string {
  const W = 1000;
  const H = 420;
  const TOP = 90; // respiro p/ o rótulo do pico
  const n = prof.xs.length;
  const spanX = prof.xs[n - 1] - prof.xs[0] || 1;
  const spanY = prof.maxAlt - prof.minAlt || 1;
  const px = (i: number) => round(((prof.xs[i] - prof.xs[0]) / spanX) * W);
  const py = (i: number) => round(TOP + (1 - (prof.ys[i] - prof.minAlt) / spanY) * (H - TOP));
  const pts = Array.from({ length: n }, (_, i) => `${px(i)},${py(i)}`).join(' ');
  const labelX = Math.min(W - 80, Math.max(80, px(prof.peakIdx)));
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax meet" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="elevFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="${accent}" stop-opacity="0.38" />
            <stop offset="1" stop-color="${accent}" stop-opacity="0" />
          </linearGradient>
        </defs>
        <polygon points="${pts} ${W},${H} 0,${H}" fill="url(#elevFill)" />
        <polyline points="${pts}" fill="none" stroke="${accent}" stroke-width="10" stroke-linejoin="round" stroke-linecap="round" />
        <circle cx="${px(prof.peakIdx)}" cy="${py(prof.peakIdx)}" r="14" fill="${accent}" stroke="#FFFFFF" stroke-width="6" />
        <text x="${labelX}" y="${py(prof.peakIdx) - 34}" text-anchor="middle" font-family=${JSON.stringify(MONO)} font-size="36" font-weight="700" fill="${fg}">${Math.round(prof.maxAlt)} m</text>
      </svg>`;
}

/** Separação mínima (unidades de viewBox) entre rótulos de cidade — anti-colisão. */
const CITY_LABEL_MIN_SEP = 100;

/**
 * Rótulos das cidades sobre o traçado: para cada cidade, o vértice de rota mais
 * próximo (a marca fica exatamente sobre a linha) recebe um ponto + o nome.
 * Anti-colisão gulosa: pula rótulos ancorados perto de um já colocado.
 */
function cityLabelsSvg(
  proj: NonNullable<ReturnType<typeof projectRoute>>,
  cities: readonly CityMark[] | undefined,
  accent: string,
  fg: string,
): string {
  if (!cities || cities.length === 0) return '';
  const kept = proj.kept as readonly RoutePoint[];
  const placed: [number, number][] = [];
  const parts: string[] = [];
  for (const c of cities) {
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < kept.length; i++) {
      const dLat = kept[i].latitude - c.lat;
      const dLng = kept[i].longitude - c.lng;
      const d = dLat * dLat + dLng * dLng;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best < 0) continue;
    const [x, y] = proj.xy[best];
    if (placed.some(([px, py]) => Math.hypot(px - x, py - y) < CITY_LABEL_MIN_SEP)) continue;
    placed.push([x, y]);
    parts.push(
      `<g>
        <circle cx="${x}" cy="${y}" r="9" fill="#FFFFFF" stroke="${accent}" stroke-width="5" />
        <text x="${x}" y="${round(y - 22)}" text-anchor="middle" font-family=${JSON.stringify(SANS)} font-size="34" font-weight="600" fill="${fg}" stroke="#000000" stroke-opacity="0.45" stroke-width="7" paint-order="stroke">${escapeHtml(c.name)}</text>
      </g>`,
    );
  }
  return parts.join('');
}

/**
 * Região central por estilo de arte. 'speed' e 'elevation' dependem de
 * timestamp/altitude no track — sem eles, caem no traçado padrão.
 */
function artRouteLayer(
  style: ShareArtStyle,
  points: readonly RoutePoint[],
  accent: string,
  fg: string,
  cities?: readonly CityMark[],
): string {
  const proj = projectRoute(points);
  if (!proj) return '<div class="routeArea"></div>';

  if (style === 'elevation') {
    const prof = elevationProfile(downsample(points, 600));
    if (prof) return `<div class="routeArea">${elevationSvg(prof, accent, fg)}</div>`;
  }

  let body = style === 'route' ? plainRouteBody(proj.xy, accent) : standardRouteBody(proj.xy, accent);
  let legend = '';
  let svgStyle = '';
  if (style === 'speed') {
    const fractions = speedFractions(proj.kept);
    if (fractions) {
      body = speedRouteBody(proj.xy, fractions, accent);
      legend = `<div class="speedLegend"><span>lento</span><span class="legendBar"></span><span>rápido</span></div>`;
      // Rota acima da legenda: padding encolhe a área de desenho (border-box).
      // NÃO usar height:auto/bottom — svg é replaced element e adotaria a
      // altura intrínseca do viewBox, vazando sobre o texto em formatos baixos.
      svgStyle = ' style="padding-bottom: 9vw"';
    }
  }
  const cityLabels = cityLabelsSvg(proj, cities, accent, fg);
  return `<div class="routeArea"><svg viewBox="${proj.viewBox}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg"${svgStyle}>${body}${cityLabels}</svg>${legend}</div>`;
}

/* ───────────────────────── efeitos sobre o mapa ────────────────────────── */

/** Tile 300×300 de ruído (feTurbulence, `stitchTiles` p/ repetir sem emendas)
 *  como data-URI — o 'grain' repete esse tile em vez de gerar ruído no cartão
 *  inteiro, então o custo independe da resolução do export. */
const GRAIN_TILE_URI =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>";

/**
 * Efeito sobre os tiles: filtro CSS no `#map` + overlays irmãos (dentro de
 * `.bg`, acima do mapa e abaixo do scrim). `.bg` cria stacking context próprio
 * (`position:absolute` + `z-index:0`), então `mix-blend-mode` compõe apenas
 * contra o mapa — nunca contra o texto do cartão. CSS puro ⇒ funciona igual
 * para Leaflet (tiles raster) e MapLibre (canvas WebGL).
 */
function mapEffectLayers(
  effect: ShareMapEffect,
  accent: string,
): { mapFilter: string; overlays: string } {
  switch (effect) {
    case 'duotone':
      // Dessatura o mapa (rota inclusa — estética de pôster) e re-tinge com o
      // accent via blend 'color'; a casing branca da rota permanece branca.
      // Fallback caso algum device renderize o #map preto com o filtro:
      // overlay hexToRgba(accent, 0.35) + mix-blend-mode: multiply, sem filtro.
      return {
        mapFilter: 'filter: grayscale(1) contrast(1.06);',
        overlays: `<div class="fx" style="background: ${accent}; mix-blend-mode: color;"></div>`,
      };
    case 'gradient':
      return {
        mapFilter: 'filter: saturate(0.9);',
        overlays: `<div class="fx" style="background: linear-gradient(160deg, ${hexToRgba('#FFB36B', 0.3)} 0%, ${hexToRgba(accent, 0.22)} 55%, ${hexToRgba('#7A2E12', 0.38)} 100%);"></div>`,
      };
    case 'grain':
      return { mapFilter: '', overlays: '<div class="fx fxGrain"></div>' };
    case 'vignette':
      return {
        mapFilter: '',
        overlays:
          '<div class="fx" style="background: radial-gradient(ellipse 85% 75% at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.45) 100%);"></div>',
      };
    case 'none':
    default:
      return { mapFilter: '', overlays: '' };
  }
}

export function buildShareCardHtml(opts: ShareCardOptions): string {
  const {
    points,
    format,
    background,
    title,
    showTitle,
    activityId,
    metrics,
    cities,
    watermark,
    accent = MOD.treino.accent,
    textColor,
    artStyle = 'speed',
    mapEffect = 'none',
    mapTile,
    mapInteractive = false,
    mapView,
    previewChecker = false,
  } = opts;

  const isData = background === 'data';
  const isMap = background === 'map' && !!mapTile;

  // Cor de texto automática: branco + sombra em todos os fundos — sobre mapa
  // porque os tiles são imprevisíveis, sobre arte/dados porque o cartão sai
  // transparente e vai cair num fundo que não controlamos (story, chat…).
  // Texto secundário = mesma cor com alpha reduzido.
  const fg = textColor ?? '#FFFFFF';
  const fgMuted = hexToRgba(fg, 0.85);
  const shadow = 'text-shadow: 0 1px 12px rgba(0,0,0,0.45);';

  // Camadas de fundo + região central da rota.
  let bgLayer = '';
  let routeLayer = '';
  let headExtra = '';
  let scriptExtra = '';
  let fx = { mapFilter: '', overlays: '' };
  if (isData) {
    // Sticker: nenhum fundo nem rota — só o texto/métricas sobre transparência.
  } else if (isMap && mapTile) {
    // Mapa preenche o fundo; a região central fica vazia (rota vem do mapa).
    // Overlays de efeito vivem dentro de .bg — acima do mapa, abaixo do scrim.
    fx = mapEffectLayers(mapEffect, accent);
    bgLayer = `<div class="bg"><div id="map"></div>${fx.overlays}</div>`;
    headExtra = mapHead(mapTile);
    scriptExtra = mapScript(points, mapTile, {
      interactive: mapInteractive,
      padding: 90,
      view: mapView,
      reportView: mapInteractive,
      cities,
    });
  } else {
    // Arte: sem camada de fundo — a região central flexível mostra a rota (ou o
    // perfil de elevação) sobre transparência, e nunca cruza o texto.
    routeLayer = artRouteLayer(artStyle, points, accent, fg, cities);
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
    ? `<div class="mark"><span class="markDot"></span><span class="markName">Orbe</span></div>`
    : '';

  // Título (ícone + texto) e o traço logo abaixo — os dois somem juntos quando
  // desligado. O glifo é o mesmo ícone MDI que o app usa via getActivityMeta;
  // fallback = halteres, como lá.
  const iconPath =
    showTitle && activityId != null
      ? (ACTIVITY_ICON_PATHS[getActivityMeta(activityId).icon] ?? ACTIVITY_ICON_PATHS.dumbbell)
      : null;
  const titleIcon = iconPath
    ? `<svg class="titleIcon" viewBox="0 0 24 24"><path d="${iconPath}" fill="currentColor"/></svg>`
    : '';
  const titleBlock = showTitle
    ? `<div class="titleRow">${titleIcon}<div class="title">${escapeHtml(title)}</div></div>
      <div class="rule"></div>`
    : '';

  // Fundo do documento: preto só sob o mapa (evita flash branco enquanto os
  // tiles carregam); transparente nos demais, para o PNG sair com alpha. O
  // xadrez de preview usa tons escuros — o texto branco continua legível.
  const bodyBg = isMap
    ? '#000'
    : previewChecker
      ? 'conic-gradient(#4A4A4A 25%, #3A3A3A 0 50%, #4A4A4A 0 75%, #3A3A3A 0) 0 0 / 12vw 12vw'
      : 'transparent';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  ${headExtra}
  <style>
    ${SHARE_FONT_FACE_CSS}
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; height: 100%; background: ${bodyBg}; }
    .bg { position: absolute; inset: 0; z-index: 0; overflow: hidden; }
    .bg > svg { position: absolute; inset: 0; width: 100%; height: 100%; }
    #map { position: absolute; inset: 0; ${fx.mapFilter} }
    .fx { position: absolute; inset: 0; pointer-events: none; }
    .fxGrain { opacity: 0.14; mix-blend-mode: overlay;
      background-image: url("${GRAIN_TILE_URI}"); background-size: 300px 300px; }
    .scrim { position: absolute; inset: 0; z-index: 1; pointer-events: none;
      background: linear-gradient(to bottom, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0) 24%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.62) 100%); }
    /* pointer-events:none — o texto não captura toques; com mapa interativo,
       os gestos (pan/zoom/rotação) atravessam até o #map. */
    .card { position: absolute; inset: 0; z-index: 2; display: flex; flex-direction: column;
      justify-content: flex-end; padding: 7vw 6vw; font-family: ${SANS}; color: ${fg};
      pointer-events: none; ${shadow} }
    .routeArea { flex: 1; position: relative; min-height: 0; margin: 4vw 0; }
    .routeArea svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
    /* Legenda da arte 'speed' (rampa lento → rápido). */
    .speedLegend { position: absolute; left: 0; right: 0; bottom: 0; display: flex;
      align-items: center; justify-content: center; gap: 2.4vw; font-size: 3vw;
      letter-spacing: 0.1em; text-transform: uppercase; color: ${fgMuted}; }
    .legendBar { width: 24vw; height: 1.2vw; border-radius: 1vw;
      background: linear-gradient(to right, ${HEAT_SLOW}, ${HEAT_MID}, ${accent}); }
    .titleRow { display: flex; align-items: center; gap: 2.6vw; }
    /* Ícone do tamanho da fonte do título; text-shadow não pega em SVG, daí o
       drop-shadow equivalente. */
    .titleIcon { width: 8.6vw; height: 8.6vw; flex: none;
      filter: drop-shadow(0 1px 6px rgba(0,0,0,0.4)); }
    .title { font-family: ${DISPLAY}; font-size: 8.6vw; line-height: 1.06;
      font-weight: 500; letter-spacing: -0.015em; }
    .rule { width: 15vw; height: 1.1vw; border-radius: 1vw; background: ${accent}; }
    .footer { display: flex; flex-direction: column; gap: 4vw; }
    .metrics { display: flex; flex-wrap: wrap; gap: 3vw 8vw; }
    .tile { display: flex; flex-direction: column; }
    .value { font-family: ${MONO}; font-weight: 700; font-size: 7vw; line-height: 1;
      letter-spacing: -0.02em; }
    .caption { font-size: 3vw; letter-spacing: 0.1em; text-transform: uppercase;
      color: ${fgMuted}; margin-top: 1.6vw; }
    .mark { display: flex; align-items: center; gap: 2vw; opacity: 0.92; }
    .markDot { width: 3.6vw; height: 3.6vw; border-radius: 50%; background: ${accent}; }
    .markName { font-family: ${DISPLAY}; font-size: 4.4vw; font-weight: 500; }
  </style>
</head>
<body>
  ${bgLayer}
  ${scrim}
  <div class="card">
    ${routeLayer}
    <div class="footer">
      ${titleBlock}
      <div class="metrics">${tiles}</div>
      ${mark}
    </div>
  </div>
  ${scriptExtra}
</body>
</html>`;
}
