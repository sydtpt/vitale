import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, AccessibilityInfo } from 'react-native';
import Svg, { Rect, Text as SvgText, Line, Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import type { OverviewBucket, Metric } from '../../lib/activity-overview';
import { formatDuration, formatDistance } from '../../lib/workout-format';
import { remapChartColor } from '../../lib/chart-palettes';
import { useChartPaletteStore } from '../../store/chart-palette.store';
import { colors } from '../../theme';

interface Props {
  buckets: OverviewBucket[];
  metric: Metric;
  width: number;
  height?: number;
  /** Quando true, ignora MIN_SLOT e comprime as barras para caber na largura disponível sem rolagem. */
  noScroll?: boolean;
  /** Muda quando período/métrica trocam — usado só para fechar o tooltip aberto.
   * A animação em si dispara sozinha a cada mudança dos dados (período/métrica/legenda). */
  animationKey?: string;
}

const PAD_TOP = 16;
const PAD_BOTTOM = 22;
const PAD_LEFT = 36;
const MIN_SLOT = 44; // largura mínima por barra antes de habilitar rolagem horizontal
const TOP_RADIUS = 7; // raio dos cantos superiores do segmento do topo da pilha
const ANIM_MS = 360;

// Tom quente usado para suavizar/clarear as cores das séries (casa com a paleta bege/creme).
const WARM = '#FBF1E2';

interface Seg { x: number; y: number; w: number; h: number; color: string; label: string; value: number; opacity: number; top: boolean; }
interface Bar { key: string; label: string; center: number; barW: number; x: number; comparison: boolean; total: number; topY: number; segs: Seg[]; }
interface SlotLayout { x0: number; slot: number; center: number; }
interface Model {
  chartW: number; baseY: number; layout: SlotLayout[];
  grid: { y: number; label: string }[]; bars: Bar[];
}

/** Formata o valor do eixo Y de acordo com a métrica selecionada. */
function fmtAxis(v: number, metric: Metric): string {
  switch (metric) {
    case 'distance':
      return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}km`;
    case 'duration':
      return `${(v / 3600).toFixed(v >= 36000 ? 0 : 1)}h`;
    case 'calories':
    case 'count':
      return String(Math.round(v));
  }
}

/** Valor exato de uma série (usado no tooltip). */
function fmtValue(v: number, metric: Metric): string {
  switch (metric) {
    case 'distance':
      return formatDistance(v) ?? '0 m';
    case 'duration':
      return formatDuration(v);
    case 'calories':
      return `${Math.round(v)} kcal`;
    case 'count':
      return `${Math.round(v)}`;
  }
}

// ---- Utilidades de cor (mix hex→hex, sem dependência) ----
const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
function isHex(c: string): boolean { return HEX_RE.test(c); }
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(r: number, g: number, b: number): string {
  const to = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}
function mix(hex: string, withHex: string, amount: number): string {
  const [r1, g1, b1] = hexToRgb(hex);
  const [r2, g2, b2] = hexToRgb(withHex);
  return rgbToHex(r1 + (r2 - r1) * amount, g1 + (g2 - g1) * amount, b1 + (b2 - b1) * amount);
}
function gradTop(hex: string): string { return mix(hex, WARM, 0.32); }
function gradBase(hex: string): string { return mix(hex, WARM, 0.08); }
function gradId(hex: string): string { return `sbc-grad-${hex.replace('#', '')}`; }
function fillFor(color: string): string { return isHex(color) ? `url(#${gradId(color)})` : color; }
function easeOutCubic(t: number): number { return 1 - Math.pow(1 - t, 3); }

/** Retângulo com cantos superiores arredondados e base reta. */
function topRoundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
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

/** Peso de largura de cada bucket: mês atual (destaque) ganha mais espaço; a
 * barra de comparação, menos. Os demais têm peso 1. */
function slotWeight(b: OverviewBucket): number {
  if (b.emphasis) return 1.5;
  if (b.comparison) return 0.72;
  return 1;
}

/** Largura máxima da barra por bucket, acompanhando o peso do slot. */
function maxBarWidth(b: OverviewBucket): number {
  if (b.emphasis) return 52;
  if (b.comparison) return 26;
  return 42;
}

/** Geometria-alvo (grow=1) de todo o gráfico. As cores dos segmentos já saem
 * remapeadas para a paleta ativa. */
function buildModel(buckets: OverviewBucket[], metric: Metric, width: number, height: number, noScroll: boolean, paletteId: string): Model {
  const weights = buckets.map(slotWeight);
  const totalWeight = weights.reduce((s, w) => s + w, 0) || 1;
  const naturalUnit = (width - PAD_LEFT) / totalWeight;
  const unit = noScroll ? naturalUnit : Math.max(naturalUnit, MIN_SLOT);
  const chartW = noScroll ? width : PAD_LEFT + unit * totalWeight;
  const innerH = height - PAD_TOP - PAD_BOTTOM;
  const baseY = PAD_TOP + innerH;
  const maxV = Math.max(...buckets.map((b) => b.total), 1);

  let cursor = PAD_LEFT;
  const layout: SlotLayout[] = buckets.map((b, i) => {
    const slot = unit * weights[i];
    const x0 = cursor;
    cursor += slot;
    return { x0, slot, center: x0 + slot / 2 };
  });

  const grid = [0, 0.5, 1].map((f) => ({ y: baseY - f * innerH, label: fmtAxis(maxV * f, metric) }));

  const bars: Bar[] = buckets.map((b, i) => {
    const { slot, center } = layout[i];
    const barW = Math.min(slot * 0.62, maxBarWidth(b));
    const x = center - barW / 2;
    const opacity = b.comparison ? 0.4 : 1;
    const topIdx = b.segments.length - 1;
    let acc = 0;
    const segs: Seg[] = b.segments.map((s, si) => {
      const h = (s.value / maxV) * innerH;
      acc += h;
      const y = baseY - acc;
      return { x, y, w: barW, h, color: remapChartColor(s.color, paletteId), label: s.label, value: s.value, opacity, top: si === topIdx };
    });
    return { key: b.key, label: b.label, center, barW, x, comparison: !!b.comparison, total: b.total, topY: baseY - acc, segs };
  });

  return { chartW, baseY, layout, grid, bars };
}

/** Interpola um bar do estado anterior (mesma key) até o alvo. Séries removidas
 * encolhem a 0 no lugar; novas crescem de 0; a pilha é re-empilhada por quadro. */
function interpBar(from: Bar | undefined, to: Bar, e: number, baseY: number): Bar {
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
    return { label, h: fromH + (toH - fromH) * e, color: ts?.color ?? fs?.color ?? '#5C534A', value: ts?.value ?? 0 };
  });

  let topIdx = -1;
  for (let i = rows.length - 1; i >= 0; i--) if (rows[i].h > 0.5) { topIdx = i; break; }

  let acc = 0;
  const opacity = to.comparison ? 0.4 : 1;
  const segs: Seg[] = rows.map((r, i) => {
    acc += r.h;
    const y = baseY - acc;
    return { x: to.x, y, w: to.barW, h: r.h, color: r.color, label: r.label, value: r.value, opacity, top: i === topIdx };
  });
  return { key: to.key, label: to.label, center: to.center, barW: to.barW, x: to.x, comparison: to.comparison, total: to.total, topY: baseY - acc, segs };
}

// Dimensões do tooltip.
const TT_PAD = 8;
const TT_ROW = 15;
const TT_DOT = 7;
const TT_FS = 10;

/** Barras empilhadas por tipo de atividade. Portado do gráfico do web. */
export function StackedBarChart({ buckets, metric, width, height = 200, noScroll = false, animationKey }: Props) {
  const [display, setDisplay] = useState<Bar[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  const displayRef = useRef<Bar[]>([]);
  const rafRef = useRef<number | undefined>(undefined);

  const paletteId = useChartPaletteStore((s) => s.paletteId);
  const model = useMemo(
    () => buildModel(buckets, metric, width, height, noScroll, paletteId),
    [buckets, metric, width, height, noScroll, paletteId],
  );

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (mounted) setReduceMotion(v); });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => setReduceMotion(v));
    return () => { mounted = false; sub.remove(); };
  }, []);

  // Fecha o tooltip ao trocar período/métrica (não na legenda).
  useEffect(() => { setSelected(null); }, [animationKey]);

  const setDisp = (bars: Bar[]) => { displayRef.current = bars; setDisplay(bars); };

  // Tween: interpola do estado atual até o alvo a cada mudança dos dados.
  useEffect(() => {
    const target = model.bars;
    const baseY = model.baseY;
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    if (reduceMotion) { setDisp(target); return; }
    const fromByKey = new Map(displayRef.current.map((b) => [b.key, b]));
    const start = Date.now();
    const step = () => {
      const t = Math.min(1, (Date.now() - start) / ANIM_MS);
      if (t >= 1) { setDisp(target); rafRef.current = undefined; return; }
      const e = easeOutCubic(t);
      setDisp(target.map((tb) => interpBar(fromByKey.get(tb.key), tb, e, baseY)));
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [model, reduceMotion]);

  if (buckets.length === 0 || width <= 0) return null;

  const { chartW, baseY, layout, grid } = model;

  // Cores distintas atualmente renderizadas (inclui séries que estão encolhendo).
  const gradColors = Array.from(
    new Set(display.flatMap((b) => b.segs.map((s) => s.color)).filter(isHex)),
  );

  // ---- Tooltip (opcional) ----
  let tooltip: React.ReactNode = null;
  const selBucket = selected != null ? buckets[selected] : null;
  if (selected != null && selBucket && selBucket.segments.length > 0 && layout[selected]) {
    const b = selBucket;
    const { center } = layout[selected];
    const barTopY = display[selected]?.topY ?? model.bars[selected]?.topY ?? baseY;
    const showTotal = b.segments.length > 1;
    const lineCount = 1 + b.segments.length + (showTotal ? 1 : 0);
    const boxH = TT_PAD * 2 + lineCount * TT_ROW;

    const rowStrings = b.segments.map((s) => `${s.label}  ${fmtValue(s.value, metric)}`);
    if (showTotal) rowStrings.push(`Total  ${fmtValue(b.total, metric)}`);
    const maxLen = Math.max(b.label.length, ...rowStrings.map((r) => r.length));
    const boxW = Math.min(Math.max(104, maxLen * 5.9 + TT_DOT + 22), chartW - 8);

    let by = barTopY - boxH - 6;
    if (by < 2) by = Math.min(barTopY + 6, height - boxH - 2);
    if (by < 2) by = 2;
    const bx = Math.min(Math.max(center - boxW / 2, 4), chartW - boxW - 4);

    const textX = bx + TT_PAD + TT_DOT + 6;
    const valX = bx + boxW - TT_PAD;

    tooltip = (
      <React.Fragment>
        <Rect
          x={bx}
          y={by}
          width={boxW}
          height={boxH}
          rx={8}
          fill={colors.surface}
          stroke={colors.line}
          strokeWidth={1}
          onPress={() => setSelected(null)}
        />
        <SvgText x={bx + TT_PAD} y={by + TT_PAD + TT_FS} fontSize={TT_FS} fontWeight="700" fill={colors.ink}>
          {b.label}
        </SvgText>
        {b.segments.map((s, k) => {
          const lineY = by + TT_PAD + TT_FS + TT_ROW * (k + 1);
          return (
            <React.Fragment key={`tt-${k}`}>
              <Rect x={bx + TT_PAD} y={lineY - TT_DOT + 0.5} width={TT_DOT} height={TT_DOT} rx={2} fill={remapChartColor(s.color, paletteId)} />
              <SvgText x={textX} y={lineY} fontSize={TT_FS} fill={colors.ink2}>
                {s.label}
              </SvgText>
              <SvgText x={valX} y={lineY} fontSize={TT_FS} fill={colors.ink} textAnchor="end" fontFamily="GeistMono">
                {fmtValue(s.value, metric)}
              </SvgText>
            </React.Fragment>
          );
        })}
        {showTotal && (
          <React.Fragment>
            <SvgText
              x={textX}
              y={by + TT_PAD + TT_FS + TT_ROW * (b.segments.length + 1)}
              fontSize={TT_FS}
              fill={colors.ink3}
              fontWeight="700"
            >
              Total
            </SvgText>
            <SvgText
              x={valX}
              y={by + TT_PAD + TT_FS + TT_ROW * (b.segments.length + 1)}
              fontSize={TT_FS}
              fill={colors.ink}
              textAnchor="end"
              fontWeight="700"
              fontFamily="GeistMono"
            >
              {fmtValue(b.total, metric)}
            </SvgText>
          </React.Fragment>
        )}
      </React.Fragment>
    );
  }

  const svg = (
    <Svg width={chartW} height={height}>
      <Defs>
        {gradColors.map((c) => (
          <LinearGradient key={gradId(c)} id={gradId(c)} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={gradTop(c)} />
            <Stop offset="1" stopColor={gradBase(c)} />
          </LinearGradient>
        ))}
      </Defs>

      {grid.map((g, i) => (
        <React.Fragment key={`g${i}`}>
          <Line x1={PAD_LEFT} y1={g.y} x2={chartW} y2={g.y} stroke={colors.line} strokeWidth={0.5} strokeOpacity={0.4} />
          <SvgText x={PAD_LEFT - 6} y={g.y + 3} fontSize={9} fill={colors.ink3} textAnchor="end">
            {g.label}
          </SvgText>
        </React.Fragment>
      ))}

      {display.map((b) => (
        <React.Fragment key={b.key}>
          {b.segs.map((s, si) => {
            const fill = fillFor(s.color);
            if (s.top && s.h > 0.5) {
              const r = Math.min(TOP_RADIUS, s.w / 2, s.h);
              return (
                <Path key={`${b.key}-${si}`} d={topRoundedRectPath(s.x, s.y, s.w, s.h, r)} fill={fill} fillOpacity={s.opacity} />
              );
            }
            return (
              <Rect key={`${b.key}-${si}`} x={s.x} y={s.y} width={s.w} height={Math.max(0, s.h)} fill={fill} fillOpacity={s.opacity} rx={0} />
            );
          })}
        </React.Fragment>
      ))}

      {model.bars.map((b) => (
        <SvgText
          key={`lbl-${b.key}`}
          x={b.center}
          y={height - 6}
          fontSize={9}
          fill={b.comparison ? colors.ink4 : colors.ink3}
          textAnchor="middle"
        >
          {b.label}
        </SvgText>
      ))}

      {/* Áreas transparentes de toque, por slot (renderizadas por cima das barras). */}
      {layout.map((l, i) => (
        <Rect
          key={`tap-${i}`}
          x={l.x0}
          y={0}
          width={l.slot}
          height={height}
          fill="transparent"
          onPress={() => setSelected((prev) => (prev === i ? null : i))}
        />
      ))}

      {tooltip}
    </Svg>
  );

  if (chartW > width) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {svg}
      </ScrollView>
    );
  }
  return svg;
}
