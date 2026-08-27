import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, AccessibilityInfo } from 'react-native';
import Svg, { Rect, Text as SvgText, Line, Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import {
  buildStackedBars,
  easeOutCubic,
  formatAxisLabel,
  formatCompactLabel,
  interpolateStackedBars,
  isHexColor,
  remapChartColor,
  smoothLinePath,
  stackedGradientId,
  stackedGradientStops,
  type LinePoint,
  type StackedBar,
  type StackedBarsGeometry,
} from '@vitale/shared';
import type { OverviewBucket, Metric } from '../../lib/activity-overview';
import { formatDuration, formatDistance } from '../../lib/workout-format';
import { colors, fonts, useTheme } from '../../theme';

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
  /** Meta de referência (mesma unidade das barras); ausente = sem linha. */
  goal?: number;
  /** Rótulo da linha de meta (ex.: "OMS"). */
  goalLabel?: string;
  /** Sufixo de unidade do rótulo ("/mês"): sem ele "14h" é lido como total do período. */
  goalUnit?: string;
  /**
   * Meta do bucket em curso, proporcional ao tempo decorrido. Quando presente, a linha
   * da meta desce em degrau sobre esse bucket — comparar um mês pela metade com a meta
   * cheia faria a última barra parecer sempre um fracasso.
   */
  currentGoal?: number;
  /** Desenha a polilinha de esforço ponderado a partir de `bucket.effectiveS`. */
  showEffort?: boolean;
  /**
   * Reta horizontal com o esforço médio por bucket. Combina com `showEffort`: a
   * polilinha mostra a variação, a reta mostra o patamar médio para comparar direto
   * com a meta. No período "Semana" aparece sozinha (lá não há progressão).
   */
  effortFlat?: number;
  /** Rótulo da reta de média. */
  effortFlatLabel?: string;
  /** Cor da reta de média (esquema configurável em Preferências). */
  effortFlatColor?: string;
  /** Cor da polilinha de progressão. */
  effortColor?: string;
}

const PAD_LEFT = 36;
const ANIM_MS = 360;
/** Cor de uma série que já sumiu do alvo e ainda está encolhendo. */
const FADING_COLOR = '#5C534A';

/**
 * A geometria deste app. O modelo é o do núcleo; o que fica aqui são as medidas
 * de tela — padding, raio, largura de barra e o mínimo por slot, que é o que
 * liga a rolagem horizontal quando o período tem barra demais para a largura.
 */
function geometry(width: number, height: number, noScroll: boolean): StackedBarsGeometry {
  return {
    width,
    height,
    padTop: 16,
    padRight: 0,
    padBottom: 22,
    padLeft: PAD_LEFT,
    minSlot: noScroll ? 0 : 44,
    topRadius: 7,
    maxBarWidth: { normal: 42, emphasis: 52, comparison: 26 },
  };
}

/**
 * Valor exato de uma série, para o tooltip.
 *
 * Fica aqui e não no núcleo de propósito: o tooltip do celular tem espaço para
 * "1h 30min" e é onde se vai buscar o número cheio. A web mostra o mesmo valor
 * num `<title>` de SVG, onde a forma curta ("1,5h") cabe melhor. São duas
 * superfícies diferentes, não uma divergência.
 */
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

// Dimensões do tooltip.
const TT_PAD = 8;
const TT_ROW = 15;
const TT_DOT = 7;
const TT_FS = 10;

/**
 * Barras empilhadas por tipo de atividade.
 *
 * A geometria é a do núcleo (`buildStackedBars`), a mesma que a web desenha; o
 * que fica aqui é o desenho em `react-native-svg`, a rolagem horizontal e o
 * tooltip, que no celular é um painel medido em vez de um `<title>`.
 */
export function StackedBarChart({
  buckets, metric, width, height = 200, noScroll = false, animationKey,
  goal, goalLabel = 'Meta', goalUnit = '', currentGoal, showEffort = false, effortFlat, effortFlatLabel = 'Média',
  effortFlatColor = colors.ink2, effortColor = colors.ink2,
}: Props) {
  // A paleta ativa vem do tema — o app e os gráficos usam a mesma desde a unificação.
  const { paletteId } = useTheme();
  const [display, setDisplay] = useState<StackedBar[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  const displayRef = useRef<StackedBar[]>([]);
  const rafRef = useRef<number | undefined>(undefined);

  const geo = useMemo(() => geometry(width, height, noScroll), [width, height, noScroll]);
  const model = useMemo(
    () => buildStackedBars({
      buckets,
      metric,
      geometry: geo,
      goal,
      currentGoal,
      showEffort,
      effortFlat,
      colorOf: (c) => remapChartColor(c, paletteId),
    }),
    [buckets, metric, geo, goal, currentGoal, showEffort, effortFlat, paletteId],
  );

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (mounted) setReduceMotion(v); });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => setReduceMotion(v));
    return () => { mounted = false; sub.remove(); };
  }, []);

  // Fecha o tooltip ao trocar período/métrica (não na legenda).
  useEffect(() => { setSelected(null); }, [animationKey]);

  const setDisp = (bars: StackedBar[]) => { displayRef.current = bars; setDisplay(bars); };

  // Tween: interpola do estado atual até o alvo a cada mudança dos dados.
  useEffect(() => {
    const target = model.bars;
    const baseY = model.baseY;
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    if (reduceMotion) { setDisp(target); return; }
    // Congelado ANTES do laço, de propósito: interpolar a partir do quadro
    // anterior em vez do estado de partida achataria a curva do easing — cada
    // quadro andaria uma fração do que resta, e a barra nunca chegaria.
    const from = displayRef.current;
    const start = Date.now();
    const step = () => {
      const t = Math.min(1, (Date.now() - start) / ANIM_MS);
      if (t >= 1) { setDisp(target); rafRef.current = undefined; return; }
      const e = easeOutCubic(t);
      setDisp(interpolateStackedBars(from, target, e, baseY, geo.topRadius, FADING_COLOR));
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [model, reduceMotion, geo.topRadius]);

  if (buckets.length === 0 || width <= 0) return null;

  const { chartW, baseY, grid, goalPath, goalY, effortFlatY } = model;

  // Curva do esforço ponderado: cúbica monotônica (suaviza sem inventar picos).
  // Quebra (null) nos buckets sem ponto.
  const effortPath = smoothLinePath(
    display.map<LinePoint | null>((b) => (b.effY === null ? null : { x: b.cx, y: b.effY })),
  );

  // Cores distintas atualmente renderizadas (inclui séries que estão encolhendo).
  const gradColors = Array.from(
    new Set(display.flatMap((b) => b.segs.map((s) => s.color)).filter(isHexColor)),
  );

  // ---- Tooltip (opcional) ----
  let tooltip: React.ReactNode = null;
  const selBucket = selected != null ? buckets[selected] : null;
  if (selected != null && selBucket && selBucket.segments.length > 0 && model.bars[selected]) {
    const b = selBucket;
    const center = model.bars[selected].cx;
    const barTopY = display[selected]?.topY ?? model.bars[selected]?.topY ?? baseY;
    const showTotal = b.segments.length > 1;
    const effortLabel = showEffort && b.effectiveS !== undefined
      ? `Esforço  ${fmtValue(b.effectiveS, metric)}`
      : null;
    const lineCount = 1 + b.segments.length + (showTotal ? 1 : 0) + (effortLabel ? 1 : 0);
    const boxH = TT_PAD * 2 + lineCount * TT_ROW;

    const rowStrings = b.segments.map((s) => `${s.label}  ${fmtValue(s.value, metric)}`);
    if (showTotal) rowStrings.push(`Total  ${fmtValue(b.total, metric)}`);
    if (effortLabel) rowStrings.push(effortLabel);
    const maxLen = Math.max(b.label.length, ...rowStrings.map((r) => r.length));
    const boxW = Math.min(Math.max(104, maxLen * 5.9 + TT_DOT + 22), chartW - 8);

    let by = barTopY - boxH - 6;
    if (by < 2) by = Math.min(barTopY + 6, height - boxH - 2);
    if (by < 2) by = 2;
    const bx = Math.min(Math.max(center - boxW / 2, 4), chartW - boxW - 4);

    const textX = bx + TT_PAD + TT_DOT + 6;
    const valX = bx + boxW - TT_PAD;
    // Linha do esforço ponderado, logo abaixo do total.
    const effortY = by + TT_PAD + TT_FS + TT_ROW * (b.segments.length + 1 + (showTotal ? 1 : 0));

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
        <SvgText x={bx + TT_PAD} y={by + TT_PAD + TT_FS} fontSize={TT_FS} fontFamily={fonts.sansBold} fill={colors.ink}>
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
              <SvgText x={valX} y={lineY} fontSize={TT_FS} fill={colors.ink} textAnchor="end" fontFamily={fonts.mono}>
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
              fontFamily={fonts.sansBold}
            >
              Total
            </SvgText>
            <SvgText
              x={valX}
              y={by + TT_PAD + TT_FS + TT_ROW * (b.segments.length + 1)}
              fontSize={TT_FS}
              fill={colors.ink}
              textAnchor="end"
              fontFamily={fonts.monoBold}
            >
              {fmtValue(b.total, metric)}
            </SvgText>
          </React.Fragment>
        )}
        {effortLabel && (
          <React.Fragment>
            <Line
              x1={bx + TT_PAD}
              y1={effortY - TT_FS / 2}
              x2={bx + TT_PAD + TT_DOT}
              y2={effortY - TT_FS / 2}
              stroke={colors.ink}
              strokeWidth={2}
            />
            <SvgText x={textX} y={effortY} fontSize={TT_FS} fill={colors.ink2}>
              Esforço
            </SvgText>
            <SvgText x={valX} y={effortY} fontSize={TT_FS} fill={colors.ink} textAnchor="end" fontFamily={fonts.mono}>
              {fmtValue(b.effectiveS ?? 0, metric)}
            </SvgText>
          </React.Fragment>
        )}
      </React.Fragment>
    );
  }

  const svg = (
    <Svg width={chartW} height={height}>
      <Defs>
        {gradColors.map((c) => {
          const stops = stackedGradientStops(c, colors.surface);
          return (
            <LinearGradient key={stackedGradientId(c)} id={stackedGradientId(c)} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={stops.top} />
              <Stop offset="1" stopColor={stops.base} />
            </LinearGradient>
          );
        })}
        {/* Painel da área de plot: um só tom com rampa de opacidade (o degradê some
            na base, onde a linha de eixo assume). Segue o tema pelo proxy `colors`. */}
        <LinearGradient id="sbc-plot-bg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.surfaceMute} stopOpacity={0.7} />
          <Stop offset="1" stopColor={colors.surfaceMute} stopOpacity={0.15} />
        </LinearGradient>
      </Defs>

      {/* Largura em `chartW` (não na da tela): no scroll horizontal o painel acompanha as barras. */}
      <Rect x={model.plotLeft} y={geo.padTop} width={model.plotRight - model.plotLeft}
        height={model.plotH} fill="url(#sbc-plot-bg)" />

      {grid.map((g, i) => (
        <React.Fragment key={`g${i}`}>
          <Line
            x1={model.plotLeft} y1={g.y} x2={model.plotRight} y2={g.y}
            stroke={g.base ? colors.lineDeep : colors.line}
            strokeWidth={g.base ? 1 : 0.5}
            strokeOpacity={g.base ? 0.8 : 0.4}
          />
          <SvgText x={model.plotLeft - 6} y={g.y + 3} fontSize={9} fill={colors.ink3} textAnchor="end">
            {formatAxisLabel(g.value, metric)}
          </SvgText>
        </React.Fragment>
      ))}

      {display.map((b) => (
        <React.Fragment key={b.key}>
          {b.segs.map((s, si) => {
            const fill = isHexColor(s.color) ? `url(#${stackedGradientId(s.color)})` : s.color;
            if (s.top && s.h > 0.5) {
              return (
                <Path key={`${b.key}-${si}`} d={s.d} fill={fill} fillOpacity={s.opacity} />
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
          x={b.cx}
          y={height - 6}
          fontSize={9}
          fill={b.comparison ? colors.ink4 : colors.ink3}
          textAnchor="middle"
        >
          {b.label}
        </SvgText>
      ))}

      {/* Linhas de referência: pintam por cima das barras, abaixo dos toques.

          Cada uma vai duas vezes: um traço largo em `colors.surface` (o halo) e a cor
          por cima. Desde que o esforço passou a ser ancorado no vigoroso, a linha corre
          DENTRO das barras em vez de acima delas, então ela é lida contra 48 cores de
          preenchimento (8 papéis × 6 paletas). Sem o halo nenhuma cor passa de 8% de
          cobertura; com ele, os valores de `reference-lines.ts` cobrem 100%. Pela mesma
          razão não há strokeOpacity nas cores: opacidade mistura a linha com a barra
          por baixo, que é o que destrói o contraste. O halo lê `colors` (proxy do tema),
          então acompanha claro/escuro sozinho. */}
      {goalY != null && (
        <React.Fragment>
          <Path d={goalPath} fill="none" stroke={colors.surface} strokeWidth={3.5} strokeOpacity={0.9} strokeLinecap="round" />
          <Path
            d={goalPath}
            fill="none"
            stroke={colors.ink3}
            strokeWidth={1.25}
            strokeDasharray="3 3"
          />
          <SvgText x={model.plotRight - 4} y={goalY - 5} fontSize={8.5} fill={colors.ink3} fillOpacity={0.85} textAnchor="end" fontFamily={fonts.mono}>
            {`${goalLabel} · ${formatCompactLabel(goal ?? 0, metric)}${goalUnit}`}
          </SvgText>
        </React.Fragment>
      )}

      {effortFlatY != null && (
        <React.Fragment>
          {/* Pontilhada: traço diferente da meta tracejada e da polilinha sólida.
              Rótulo à esquerda; a meta ancora à direita, então nunca colidem. */}
          <Line
            x1={model.plotLeft} y1={effortFlatY} x2={model.plotRight} y2={effortFlatY}
            stroke={colors.surface} strokeWidth={3.5} strokeOpacity={0.9} strokeLinecap="round"
          />
          <Line
            x1={model.plotLeft}
            y1={effortFlatY}
            x2={model.plotRight}
            y2={effortFlatY}
            stroke={effortFlatColor}
            strokeWidth={1.5}
            strokeDasharray="1 3"
            strokeLinecap="round"
          />
          <SvgText x={model.plotLeft + 4} y={effortFlatY - 5} fontSize={8.5} fill={effortFlatColor} fontFamily={fonts.mono}>
            {`${effortFlatLabel} · ${formatCompactLabel(effortFlat ?? 0, metric)}`}
          </SvgText>
        </React.Fragment>
      )}

      {effortPath !== '' && (
        <React.Fragment>
          <Path d={effortPath} fill="none" stroke={colors.surface} strokeWidth={4.5} strokeOpacity={0.9} strokeLinecap="round" strokeLinejoin="round" />
          <Path d={effortPath} fill="none" stroke={effortColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          {display.map((b) => (b.effY === null ? null : (
            <React.Fragment key={`eff-${b.key}`}>
              <Circle cx={b.cx} cy={b.effY} r={3.2} fill={colors.surface} fillOpacity={0.9} />
              <Circle cx={b.cx} cy={b.effY} r={2.2} fill={effortColor} />
            </React.Fragment>
          )))}
        </React.Fragment>
      )}

      {/* Áreas transparentes de toque, por slot (renderizadas por cima das barras). */}
      {model.bars.map((b, i) => (
        <Rect
          key={`tap-${b.key}`}
          x={b.x0}
          y={0}
          width={b.slot}
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
