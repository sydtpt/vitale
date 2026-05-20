import React from 'react';
import { ScrollView } from 'react-native';
import Svg, { Rect, Text as SvgText, Line } from 'react-native-svg';
import type { OverviewBucket, Metric } from '../../lib/activity-overview';
import { colors } from '../../theme';

interface Props {
  buckets: OverviewBucket[];
  metric: Metric;
  width: number;
  height?: number;
}

const PAD_TOP = 16;
const PAD_BOTTOM = 22;
const PAD_LEFT = 36;
const MIN_SLOT = 44; // largura mínima por barra antes de habilitar rolagem horizontal

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

/** Barras empilhadas por tipo de atividade. Portado do gráfico do web. */
export function StackedBarChart({ buckets, metric, width, height = 200 }: Props) {
  const n = buckets.length;
  if (n === 0 || width <= 0) return null;

  // rola horizontalmente quando há muitos buckets (ex.: 12 meses, anos)
  const naturalSlot = (width - PAD_LEFT) / n;
  const slot = Math.max(naturalSlot, MIN_SLOT);
  const chartW = PAD_LEFT + slot * n;

  const innerH = height - PAD_TOP - PAD_BOTTOM;
  const maxV = Math.max(...buckets.map((b) => b.total), 1);
  const barW = Math.min(slot * 0.6, 42);

  const grid = [0, 0.5, 1].map((f) => ({
    y: PAD_TOP + innerH - f * innerH,
    label: fmtAxis(maxV * f, metric),
  }));

  const svg = (
    <Svg width={chartW} height={height}>
      {grid.map((g, i) => (
        <React.Fragment key={`g${i}`}>
          <Line
            x1={PAD_LEFT}
            y1={g.y}
            x2={chartW}
            y2={g.y}
            stroke={colors.line}
            strokeWidth={1}
          />
          <SvgText x={PAD_LEFT - 6} y={g.y + 3} fontSize={9} fill={colors.ink3} textAnchor="end">
            {g.label}
          </SvgText>
        </React.Fragment>
      ))}

      {buckets.map((b, i) => {
        const x = PAD_LEFT + i * slot + (slot - barW) / 2;
        let acc = 0;
        return (
          <React.Fragment key={b.key}>
            {b.segments.map((s, si) => {
              const h = (s.value / maxV) * innerH;
              acc += h;
              const y = PAD_TOP + innerH - acc;
              return (
                <Rect
                  key={`${b.key}-${si}`}
                  x={x}
                  y={y}
                  width={barW}
                  height={Math.max(0, h)}
                  fill={s.color}
                  rx={si === b.segments.length - 1 ? Math.min(barW / 2, 4) : 0}
                />
              );
            })}
            <SvgText
              x={PAD_LEFT + i * slot + slot / 2}
              y={height - 6}
              fontSize={9}
              fill={colors.ink3}
              textAnchor="middle"
            >
              {b.label}
            </SvgText>
          </React.Fragment>
        );
      })}
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
