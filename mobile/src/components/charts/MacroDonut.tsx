import React from 'react';
import Svg, { Circle, G } from 'react-native-svg';
import { colors } from '../../theme';

export interface DonutSegment {
  value: number;
  color: string;
}

interface Props {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
}

/** Donut de proporção (macronutrientes). */
export function MacroDonut({ segments, size = 120, strokeWidth = 16 }: Props) {
  const center = size / 2;
  const radius = center - strokeWidth / 2;
  const circ = 2 * Math.PI * radius;
  const total = segments.reduce((a, s) => a + s.value, 0);

  let acc = 0;

  return (
    <Svg width={size} height={size}>
      <G rotation={-90} origin={`${center}, ${center}`}>
        <Circle cx={center} cy={center} r={radius} stroke={colors.line} strokeWidth={strokeWidth} fill="none" />
        {total > 0 &&
          segments.map((seg, i) => {
            const frac = seg.value / total;
            const dash = frac * circ;
            const offset = -acc * circ;
            acc += frac;
            return (
              <Circle
                key={i}
                cx={center}
                cy={center}
                r={radius}
                stroke={seg.color}
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={`${dash} ${circ - dash}`}
                strokeDashoffset={offset}
                strokeLinecap="butt"
              />
            );
          })}
      </G>
    </Svg>
  );
}
