import React from 'react';
import Svg, { Path, Circle, Text as SvgText, Line } from 'react-native-svg';
import { Bucket } from '../../lib/health-format';
import { colors } from '../../theme';

interface Props {
  buckets: Bucket[];
  width: number;
  height?: number;
  color: string;
}

const PAD_TOP = 18;
const PAD_BOTTOM = 18;

/** Gráfico de linha para métricas pontuais (FC, peso, VO₂…). */
export function LineChart({ buckets, width, height = 180, color }: Props) {
  const n = buckets.length;
  if (n === 0 || width <= 0) return null;

  const filled = buckets.map((b, i) => ({ ...b, i })).filter((b) => !b.empty);
  if (filled.length === 0) return <Svg width={width} height={height} />;

  const innerH = height - PAD_TOP - PAD_BOTTOM;
  const values = filled.map((b) => b.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const slot = n > 1 ? width / (n - 1) : width;

  const x = (i: number) => (n > 1 ? i * slot : width / 2);
  const y = (v: number) => PAD_TOP + innerH - ((v - min) / span) * innerH;

  const pts = filled.map((b) => ({ x: x(b.i), y: y(b.value) }));
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L${pts[pts.length - 1].x},${PAD_TOP + innerH} L${pts[0].x},${PAD_TOP + innerH} Z`;

  const labelStep = n <= 7 ? 1 : Math.ceil(n / 6);
  const last = pts[pts.length - 1];

  return (
    <Svg width={width} height={height}>
      <Line x1={0} y1={PAD_TOP + innerH} x2={width} y2={PAD_TOP + innerH} stroke={colors.line} strokeWidth={1} />
      <Path d={areaPath} fill={color} opacity={0.1} />
      <Path d={linePath} stroke={color} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={2.4} fill={color} />
      ))}
      <Circle cx={last.x} cy={last.y} r={4.5} fill={color} stroke={colors.surface} strokeWidth={2} />
      {buckets.map((b, i) =>
        i % labelStep === 0 ? (
          <SvgText key={b.date} x={x(i)} y={height - 4} fontSize={9} fill={colors.ink3} textAnchor="middle">
            {b.label}
          </SvgText>
        ) : null
      )}
    </Svg>
  );
}
