import React from 'react';
import Svg, { Circle, G } from 'react-native-svg';

export interface Ring {
  value: number;
  goal: number;
  color: string;
}

interface Props {
  rings: Ring[]; // do mais externo (índice 0) para o mais interno
  size?: number;
  strokeWidth?: number;
}

/** Anéis de atividade concêntricos (estilo Apple Watch): Mover · Exercício · Em pé. */
export function ActivityRings({ rings, size = 120, strokeWidth = 11 }: Props) {
  const center = size / 2;
  const gap = 3;

  return (
    <Svg width={size} height={size}>
      <G rotation={-90} origin={`${center}, ${center}`}>
        {rings.map((ring, i) => {
          const radius = center - strokeWidth / 2 - i * (strokeWidth + gap);
          if (radius <= 0) return null;
          const circ = 2 * Math.PI * radius;
          const progress = ring.goal > 0 ? Math.min(ring.value / ring.goal, 1) : 0;
          const offset = circ * (1 - progress);
          return (
            <React.Fragment key={i}>
              <Circle
                cx={center}
                cy={center}
                r={radius}
                stroke={ring.color}
                strokeWidth={strokeWidth}
                fill="none"
                opacity={0.18}
              />
              <Circle
                cx={center}
                cy={center}
                r={radius}
                stroke={ring.color}
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={`${circ} ${circ}`}
                strokeDashoffset={offset}
                strokeLinecap="round"
              />
            </React.Fragment>
          );
        })}
      </G>
    </Svg>
  );
}
