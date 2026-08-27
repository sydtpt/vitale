/**
 * O modelo do gráfico de barras empilhadas do Histórico.
 *
 * Era o melhor gráfico do app e o mais duplicado: 635 linhas no mobile, 415 na
 * web, com a mesma escala, o mesmo empilhamento, o mesmo degrau de meta e a
 * mesma interpolação escritos duas vezes. As duas cópias já divergiam em
 * detalhes que ninguém escolheu — raio do topo 7 contra 6, largura máxima da
 * barra 52 contra 56, e o eixo do mobile imprimindo "1.5h" enquanto o resto do
 * app escreve "1,5". Divergência sem decisão é o sintoma; a causa é o modelo não
 * ter dono.
 *
 * Aqui fica **só a geometria**: onde cada retângulo cai, onde as linhas de grade
 * caem, por onde a linha de meta passa. Cada plataforma desenha do seu jeito e
 * mede o seu tooltip — é lá que as diferenças são legítimas.
 *
 * As constantes que **são** escolha de plataforma (tamanho, padding, raio,
 * largura máxima, rolagem) entram por `StackedBarsGeometry`, para o modelo
 * reproduzir exatamente o que cada app desenhava.
 */
import { compactNumber, niceAxisMax } from './axis';
import { mix } from '../theme/color';

/** As quatro métricas do Histórico. */
export type StackedMetric = 'distance' | 'duration' | 'calories' | 'count';

export interface StackedSegment {
  label: string;
  value: number;
  color: string;
}

/**
 * O bucket que o gráfico consome. `OverviewBucket` o satisfaz estruturalmente —
 * declarado aqui, e não importado de `fitness/`, para o desenho não passar a
 * depender do domínio de atividades.
 */
export interface StackedBucket {
  key: string;
  label: string;
  total: number;
  segments: readonly StackedSegment[];
  /** Segundos de esforço — alimenta a polilinha. Ausente = sem ponto. */
  effectiveS?: number;
  /** Barra de comparação: não é cronológica, fica fora da polilinha. */
  comparison?: boolean;
  /** Barra em destaque (mês atual no período "Ano") — ganha mais espaço. */
  emphasis?: boolean;
}

export interface StackedBarsGeometry {
  width: number;
  height: number;
  padTop: number;
  padRight: number;
  padBottom: number;
  padLeft: number;
  /**
   * Largura mínima por slot. Acima dela o gráfico cresce além de `width` e quem
   * desenha rola na horizontal. `0` (o caso da web) nunca rola: os slots
   * encolhem até caber.
   */
  minSlot: number;
  /** Raio dos cantos superiores do segmento do topo da pilha. */
  topRadius: number;
  /** Largura máxima da barra, por tipo de bucket. */
  maxBarWidth: { normal: number; emphasis: number; comparison: number };
}

export interface StackedSeg {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  label: string;
  value: number;
  opacity: number;
  /** Topo da pilha: é quem leva os cantos arredondados. */
  top: boolean;
  /** Path com os cantos superiores arredondados; `''` quando não é o topo. */
  d: string;
}

export interface StackedBar {
  key: string;
  label: string;
  /** Início e largura do slot — o degrau da meta se apoia neles. */
  x0: number;
  slot: number;
  x: number;
  barW: number;
  cx: number;
  total: number;
  /** Y do topo da pilha. */
  topY: number;
  comparison: boolean;
  segs: StackedSeg[];
  /** Y do ponto de esforço; `null` = bucket sem ponto. */
  effY: number | null;
  /** Esforço em segundos, para o tooltip. */
  effS: number;
}

export interface StackedGridLine {
  y: number;
  /** Valor na unidade da métrica. Formatar é trabalho de quem desenha. */
  value: number;
  /** Linha do zero: fecha o painel do plot, então leva traço mais firme. */
  base: boolean;
}

export interface StackedBarsModel {
  /** Largura total do desenho. Maior que `geometry.width` ⇒ rola. */
  chartW: number;
  plotLeft: number;
  plotRight: number;
  plotH: number;
  baseY: number;
  /** Topo do eixo, na unidade da métrica. */
  maxV: number;
  grid: StackedGridLine[];
  bars: StackedBar[];
  /** Path da linha de meta (reta, ou com degrau no bucket em curso); `''` = sem meta. */
  goalPath: string;
  /** Y da meta cheia, para posicionar o rótulo. */
  goalY: number | null;
  effortFlatY: number | null;
}

export interface StackedBarsInput {
  buckets: readonly StackedBucket[];
  metric: StackedMetric;
  geometry: StackedBarsGeometry;
  /** Meta de referência, na unidade das barras. */
  goal?: number;
  /**
   * Meta do bucket em curso, proporcional ao tempo decorrido. Faz a linha descer
   * em degrau sobre ele — comparar um mês pela metade com a meta cheia faria a
   * última barra parecer sempre um fracasso.
   */
  currentGoal?: number;
  /** Calcula os pontos da polilinha de esforço. */
  showEffort?: boolean;
  /** Reta do esforço médio por bucket. */
  effortFlat?: number;
  /** Traduz a cor da série para a paleta ativa. Padrão: identidade. */
  colorOf?: (color: string) => string;
}

/** Divisões do eixo Y: 4 passos = 5 linhas de grade (com a do zero). */
export const STACKED_GRID_TICKS = 4;
/** Unidade em que cada métrica é lida — o eixo escolhe passos redondos nela. */
const AXIS_UNIT: Record<StackedMetric, number> = {
  distance: 1000,
  duration: 3600,
  calories: 1,
  count: 1,
};
/** Métricas sem casa decimal: o passo do eixo tem que ser inteiro. */
const INTEGER_METRICS: ReadonlySet<StackedMetric> = new Set<StackedMetric>(['calories', 'count']);

/** Retângulo com cantos superiores arredondados e base reta. */
export function topRoundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.max(0, Math.min(r, w / 2, h));
  return [
    `M ${x} ${y + h}`,
    `L ${x} ${y + rr}`,
    `Q ${x} ${y} ${x + rr} ${y}`,
    `L ${x + w - rr} ${y}`,
    `Q ${x + w} ${y} ${x + w} ${y + rr}`,
    `L ${x + w} ${y + h}`,
    'Z',
  ].join(' ');
}

function weightOf(b: StackedBucket): number {
  if (b.emphasis) return 1.5;
  if (b.comparison) return 0.72;
  return 1;
}

function maxBarWidthOf(b: StackedBucket, g: StackedBarsGeometry): number {
  if (b.emphasis) return g.maxBarWidth.emphasis;
  if (b.comparison) return g.maxBarWidth.comparison;
  return g.maxBarWidth.normal;
}

export function buildStackedBars(input: StackedBarsInput): StackedBarsModel {
  const { buckets, metric, geometry: g, goal, currentGoal, effortFlat } = input;
  const showEffort = input.showEffort ?? false;
  const colorOf = input.colorOf ?? ((c: string) => c);

  const weights = buckets.map(weightOf);
  const totalWeight = weights.reduce((s, w) => s + w, 0) || 1;
  const naturalUnit = (g.width - g.padLeft - g.padRight) / totalWeight;
  const unit = g.minSlot > 0 ? Math.max(naturalUnit, g.minSlot) : naturalUnit;
  // Sem rolagem a largura é a pedida, e não a soma dos slots: `padLeft + n*unit`
  // reconstruído a partir de uma divisão erra o último bit, e um `chartW` um
  // milésimo maior que a largura da tela ligaria a rolagem por engano.
  const chartW = g.minSlot > 0 ? g.padLeft + unit * totalWeight + g.padRight : g.width;

  const plotH = g.height - g.padTop - g.padBottom;
  const baseY = g.padTop + plotH;
  const plotLeft = g.padLeft;
  const plotRight = chartW - g.padRight;

  // O eixo precisa absorver a meta e a série de esforço: uma meta acima da barra
  // mais alta seria cortada silenciosamente fora do plot.
  const axisUnit = AXIS_UNIT[metric];
  const rawMax = Math.max(
    ...buckets.map((b) => Math.max(b.total, showEffort ? b.effectiveS ?? 0 : 0)),
    goal ?? 0,
    effortFlat ?? 0,
    // Piso: sem dados, um eixo de 0–1h/1km é mais legível que um de 0–1s/1m.
    axisUnit,
  );
  // Topo redondo e acima do máximo: dá folga sobre a barra mais alta e faz as
  // cinco linhas da grade caírem em valores legíveis.
  const maxV = niceAxisMax(rawMax, {
    unit: axisUnit,
    ticks: STACKED_GRID_TICKS,
    integer: INTEGER_METRICS.has(metric),
  });

  const grid: StackedGridLine[] = Array.from(
    { length: STACKED_GRID_TICKS + 1 },
    (_, i) => i / STACKED_GRID_TICKS,
  ).map((f) => ({ y: baseY - f * plotH, value: maxV * f, base: f === 0 }));

  let cursor = g.padLeft;
  const bars: StackedBar[] = buckets.map((b, i) => {
    const slot = unit * weights[i];
    const x0 = cursor;
    cursor += slot;
    const barW = Math.min(slot * 0.62, maxBarWidthOf(b, g));
    const x = x0 + (slot - barW) / 2;
    const opacity = b.comparison ? 0.4 : 1;
    const topIdx = b.segments.length - 1;

    let acc = 0;
    const segs: StackedSeg[] = b.segments.map((s, si) => {
      const h = (s.value / maxV) * plotH;
      acc += h;
      const y = baseY - acc;
      const top = si === topIdx;
      return {
        x,
        y,
        w: barW,
        h,
        color: colorOf(s.color),
        label: s.label,
        value: s.value,
        opacity,
        top,
        d: top ? topRoundedRectPath(x, y, barW, h, Math.min(g.topRadius, barW / 2, h)) : '',
      };
    });

    // Barras de comparação ficam fora da série de esforço (não são cronológicas).
    const effS = b.effectiveS ?? 0;
    const effY =
      showEffort && !b.comparison && b.effectiveS !== undefined
        ? baseY - (effS / maxV) * plotH
        : null;

    return {
      key: b.key,
      label: b.label,
      x0,
      slot,
      x,
      barW,
      cx: x + barW / 2,
      total: b.total,
      topY: baseY - acc,
      comparison: !!b.comparison,
      segs,
      effY,
      effS,
    };
  });

  const goalY = goal && goal > 0 ? baseY - (goal / maxV) * plotH : null;
  const effortFlatY = effortFlat && effortFlat > 0 ? baseY - (effortFlat / maxV) * plotH : null;

  // Meta: reta quando o período está fechado; com degrau sobre o bucket em curso.
  // Saltos (`M`) em vez de conectores verticais — degrau legível sem poluir.
  let goalPath = '';
  if (goalY !== null && goal) {
    // O bucket em curso é o último NÃO-comparação: em "12 meses" a barra de
    // comparação vem depois dele, fora da ordem cronológica.
    let idx = -1;
    for (let i = buckets.length - 1; i >= 0; i--) {
      if (!buckets[i].comparison) {
        idx = i;
        break;
      }
    }
    if (currentGoal === undefined || currentGoal >= goal || idx < 0) {
      goalPath = `M ${plotLeft} ${goalY} L ${plotRight} ${goalY}`;
    } else {
      const b = bars[idx];
      const stepStart = Math.max(plotLeft, b.x0);
      const stepEnd = Math.min(plotRight, b.x0 + b.slot);
      const yCur = baseY - (currentGoal / maxV) * plotH;
      const parts = [
        `M ${plotLeft} ${goalY} L ${stepStart} ${goalY}`,
        `M ${stepStart} ${yCur} L ${stepEnd} ${yCur}`,
      ];
      // Barras depois do bucket em curso (comparação) voltam à meta cheia.
      if (stepEnd < plotRight) parts.push(`M ${stepEnd} ${goalY} L ${plotRight} ${goalY}`);
      goalPath = parts.join(' ');
    }
  }

  return { chartW, plotLeft, plotRight, plotH, baseY, maxV, grid, bars, goalPath, goalY, effortFlatY };
}

/**
 * Interpola as barras do estado anterior (mesma `key`) até o alvo.
 *
 * Séries removidas encolhem a zero **no lugar** em vez de sumir de uma vez, e a
 * pilha é re-empilhada a cada quadro — sem isso, desligar um tipo na legenda faz
 * os de cima saltarem para baixo.
 */
export function interpolateStackedBars(
  from: readonly StackedBar[],
  to: readonly StackedBar[],
  progress: number,
  baseY: number,
  topRadius: number,
  fallbackColor: string,
): StackedBar[] {
  const fromByKey = new Map(from.map((b) => [b.key, b]));
  return to.map((tb) => interpolateBar(fromByKey.get(tb.key), tb, progress, baseY, topRadius, fallbackColor));
}

function interpolateBar(
  from: StackedBar | undefined,
  to: StackedBar,
  e: number,
  baseY: number,
  topRadius: number,
  fallbackColor: string,
): StackedBar {
  const fromSegs = from?.segs ?? [];
  const fromByLabel = new Map(fromSegs.map((s) => [s.label, s]));
  const toByLabel = new Map(to.segs.map((s) => [s.label, s]));

  // Ordem = a do alvo; séries removidas voltam à sua posição anterior.
  const order: string[] = to.segs.map((s) => s.label);
  fromSegs.forEach((s, idx) => {
    if (!toByLabel.has(s.label)) order.splice(Math.min(idx, order.length), 0, s.label);
  });

  const rows = order.map((label) => {
    const fs = fromByLabel.get(label);
    const ts = toByLabel.get(label);
    const fromH = fs?.h ?? 0;
    const toH = ts?.h ?? 0;
    return {
      label,
      h: fromH + (toH - fromH) * e,
      color: ts?.color ?? fs?.color ?? fallbackColor,
      value: ts?.value ?? 0,
    };
  });

  // O topo é a última série ainda visível: durante o encolhimento, quem já sumiu
  // não pode segurar os cantos arredondados.
  let topIdx = -1;
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].h > 0.5) {
      topIdx = i;
      break;
    }
  }

  let acc = 0;
  const opacity = to.comparison ? 0.4 : 1;
  const segs: StackedSeg[] = rows.map((r, i) => {
    acc += r.h;
    const y = baseY - acc;
    const top = i === topIdx;
    return {
      x: to.x,
      y,
      w: to.barW,
      h: r.h,
      color: r.color,
      label: r.label,
      value: r.value,
      opacity,
      top,
      d: top ? topRoundedRectPath(to.x, y, to.barW, r.h, Math.min(topRadius, to.barW / 2, r.h)) : '',
    };
  });

  // O ponto de esforço anima junto com as barras; um bucket novo cresce da base.
  const fromEffY = from?.effY ?? baseY;
  const effY = to.effY === null ? null : fromEffY + (to.effY - fromEffY) * e;

  return { ...to, topY: baseY - acc, segs, effY };
}

/** `1 − (1 − t)³`: rápido no começo, assentando no fim. */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// ─────────────────────────── Rótulos ───────────────────────────

function num(v: number, digits: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/**
 * Valor curto, na unidade da métrica: "12,5km", "3,5h", "17.426".
 *
 * O separador é o de pt-BR nas duas plataformas. O mobile imprimia "1.5h" com
 * ponto — não por escolha, mas por ser a cópia que nunca recebeu o
 * `toLocaleString` que a web ganhou.
 */
export function formatMetricShort(v: number, metric: StackedMetric): string {
  switch (metric) {
    case 'distance':
      return `${num(v / 1000, v >= 10000 ? 0 : 1)}km`;
    case 'duration':
      return `${num(v / 3600, v >= 36000 ? 0 : 1)}h`;
    case 'calories':
    case 'count':
      return num(Math.round(v), 0);
  }
}

/**
 * Rótulo do eixo e do topo da barra. Para métricas inteiras vira compacto:
 * "17426" rouba a largura do eixo e não informa mais que "17k".
 */
export function formatAxisLabel(v: number, metric: StackedMetric): string {
  return INTEGER_METRICS.has(metric) ? compactNumber(v) : formatMetricShort(v, metric);
}

/**
 * Rótulo das linhas de referência. `formatMetricShort` de duração sempre imprime
 * horas, e a meta diária (~21 min) viraria "0,4h"; abaixo de 1 h usa minutos.
 */
export function formatCompactLabel(v: number, metric: StackedMetric): string {
  if (metric !== 'duration' || v >= 3600) return formatAxisLabel(v, metric);
  return `${num(Math.round(v / 60), 0)} min`;
}

/**
 * Extremos do degradê de um segmento.
 *
 * O tom de clareamento é a **superfície do tema**, não um creme cravado. As duas
 * cópias misturavam com `#FBF1E2`: no escuro isso lavava a barra em direção a um
 * bege que não existe em lugar nenhum daquele esquema. A mistura é perceptual
 * (OKLab, o `mix` do tema) em vez de sRGB — a rampa fica mais uniforme, sem a
 * zona morta que a interpolação linear cria nos tons médios.
 */
export function stackedGradientStops(color: string, surface: string): { top: string; base: string } {
  return { top: mix(color, surface, 0.32), base: mix(color, surface, 0.08) };
}

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Só hex ganha degradê: `var(--x)` e `currentColor` não dá para interpolar. */
export function isHexColor(c: string): boolean {
  return HEX_RE.test(c);
}

/** Id determinístico do degradê de uma cor, para o `<defs>`. */
export function stackedGradientId(color: string): string {
  return `sbc-grad-${color.replace('#', '')}`;
}
