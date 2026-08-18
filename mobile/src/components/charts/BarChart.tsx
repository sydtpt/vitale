import React from 'react';
import Svg, { Rect, Text as SvgText, Line } from 'react-native-svg';
import { Bucket } from '../../lib/health-buckets';
import { colors } from '../../theme';

interface Props {
  buckets: Bucket[];
  width: number;
  height?: number;
  color: string;
}

const PAD_TOP = 18;
const PAD_BOTTOM = 18;

/** Gráfico de barras para métricas cumulativas (passos, kcal, sono…). */
export function BarChart({ buckets, width, height = 180, color }: Props) {
  const n = buckets.length;
  if (n === 0 || width <= 0) return null;

  const innerH = height - PAD_TOP - PAD_BOTTOM;
  const maxV = Math.max(...buckets.map((b) => b.value), 1);
  const slot = width / n;
  const barW = Math.max(2, Math.min(slot * 0.62, 22));

  // mostra rótulos do eixo X sem poluir (semana = todos; demais = espaçado)
  const labelStep = n <= 7 ? 1 : Math.ceil(n / 6);
  const maxIdx = buckets.reduce((mi, b, i) => (b.value > buckets[mi].value ? i : mi), 0);

  return (
    <Svg width={width} height={height}>
      <Line x1={0} y1={PAD_TOP + innerH} x2={width} y2={PAD_TOP + innerH} stroke={colors.line} strokeWidth={1} />
      {buckets.map((b, i) => {
        const h = b.value > 0 ? Math.max(2, (b.value / maxV) * innerH) : 0;
        const x = i * slot + (slot - barW) / 2;
        const y = PAD_TOP + innerH - h;
        const isMax = i === maxIdx && b.value > 0;
        return (
          <React.Fragment key={b.date}>
            <Rect
              x={x}
              y={y}
              width={barW}
              height={h}
              rx={Math.min(barW / 2, 5)}
              fill={isMax ? color : colors.lineDeep}
              opacity={isMax ? 1 : 0.55}
            />
            {i % labelStep === 0 && (
              <SvgText
                x={i * slot + slot / 2}
                y={height - 4}
                fontSize={9}
                fill={colors.ink3}
                textAnchor="middle"
              >
                {b.label}
              </SvgText>
            )}
          </React.Fragment>
        );
      })}
    </Svg>
  );
}
