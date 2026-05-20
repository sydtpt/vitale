import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

interface Props {
  values: number[];
  width?: number;
  height?: number;
  color: string;
  mode?: 'line' | 'bar';
}

/** Mini-gráfico sem eixos para os cards do dashboard. */
export function Sparkline({ values, width = 72, height = 32, color, mode = 'line' }: Props) {
  const data = values.filter((v) => Number.isFinite(v));
  if (data.length === 0) return <Svg width={width} height={height} />;

  const max = Math.max(...data, 1);

  if (mode === 'bar') {
    const slot = width / data.length;
    const barW = Math.max(1.5, slot * 0.6);
    return (
      <Svg width={width} height={height}>
        {data.map((v, i) => {
          const h = v > 0 ? Math.max(1.5, (v / max) * (height - 2)) : 0;
          return (
            <Rect
              key={i}
              x={i * slot + (slot - barW) / 2}
              y={height - h}
              width={barW}
              height={h}
              rx={barW / 2}
              fill={color}
              opacity={0.85}
            />
          );
        })}
      </Svg>
    );
  }

  const min = Math.min(...data);
  const span = max - min || 1;
  const slot = data.length > 1 ? width / (data.length - 1) : width;
  const d = data
    .map((v, i) => {
      const x = data.length > 1 ? i * slot : width / 2;
      const y = height - 2 - ((v - min) / span) * (height - 4);
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    })
    .join(' ');

  return (
    <Svg width={width} height={height}>
      <Path d={d} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}
