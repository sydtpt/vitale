import React from 'react';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { colors } from '../../theme';

export interface CurvePointVM {
  key: string;
  /** Rótulo do eixo x ("5 km"). */
  label: string;
  /** Posição no eixo x — em log quando `logX`. Precisa ser > 0 nesse caso. */
  x: number;
  y: number;
}

interface Props {
  points: CurvePointVM[];
  width: number;
  height?: number;
  color: string;
  /** Escala logarítmica no x: 1 km e 42 km cabem no mesmo eixo sem esmagar o 5 e o 10. */
  logX?: boolean;
  /** Como escrever um valor do eixo y ("4:20"). */
  formatY: (v: number) => string;
  /** Ponto em destaque (o tocado). */
  selectedKey?: string | null;
  onSelect?: (key: string) => void;
}

const PAD_TOP = 12;
const PAD_BOTTOM = 20;
const PAD_LEFT = 40;
const PAD_RIGHT = 12;

/**
 * Linha com pontos sobre um eixo x numérico — a curva de recordes.
 *
 * O `LineChart` posiciona por índice, um bucket por coluna; aqui a posição
 * **é** a distância, e em log: em escala linear 1 km e 5 km ficariam colados
 * num canto e a maratona sozinha do outro lado. O eixo y não começa em zero, de
 * propósito — entre 4:20 e 4:40 por quilômetro a diferença é a informação.
 *
 * Toque num ponto seleciona; a leitura fica com o card, que sabe o que o ponto
 * significa (o tempo, a data, a corrida). Nenhuma cor cravada.
 */
export function CurveChart({
  points,
  width,
  height = 170,
  color,
  logX = false,
  formatY,
  selectedKey = null,
  onSelect,
}: Props) {
  if (points.length === 0 || width <= 0) return null;

  const innerW = width - PAD_LEFT - PAD_RIGHT;
  const innerH = height - PAD_TOP - PAD_BOTTOM;

  const xs = points.map((p) => (logX ? Math.log(p.x) : p.x));
  const xLo = Math.min(...xs);
  const xHi = Math.max(...xs);
  const ys = points.map((p) => p.y);
  const yLo = Math.min(...ys);
  const yHi = Math.max(...ys);
  // 8% de folga para o ponto extremo não encostar na borda da caixa.
  const yPad = (yHi - yLo || 1) * 0.08;
  const lo = yLo - yPad;
  const hi = yHi + yPad;

  const x = (i: number) => (xHi > xLo ? PAD_LEFT + ((xs[i] - xLo) / (xHi - xLo)) * innerW : PAD_LEFT + innerW / 2);
  const y = (v: number) => PAD_TOP + innerH - ((v - lo) / (hi - lo)) * innerH;

  const pts = points.map((p, i) => ({ ...p, px: x(i), py: y(p.y) }));
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.px.toFixed(1)},${p.py.toFixed(1)}`).join(' ');
  const grid = [0, 0.5, 1].map((f) => ({ v: lo + (hi - lo) * f, gy: y(lo + (hi - lo) * f) }));

  return (
    <Svg width={width} height={height}>
      {grid.map((g, i) => (
        <React.Fragment key={i}>
          <Line x1={PAD_LEFT} y1={g.gy} x2={width - PAD_RIGHT} y2={g.gy} stroke={colors.line} strokeWidth={0.5} strokeDasharray="3 3" />
          <SvgText x={PAD_LEFT - 6} y={g.gy + 3} fontSize={9} fill={colors.ink3} textAnchor="end">
            {formatY(g.v)}
          </SvgText>
        </React.Fragment>
      ))}

      <Path d={path} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />

      {pts.map((p) => {
        const on = p.key === selectedKey;
        return (
          <React.Fragment key={p.key}>
            {on && <Circle cx={p.px} cy={p.py} r={7} fill={color} fillOpacity={0.18} />}
            <Circle cx={p.px} cy={p.py} r={on ? 4.5 : 3.2} fill={color} stroke={colors.surface} strokeWidth={on ? 2 : 1.5} />
            {/* Área de toque maior que o ponto: dedo não é mouse. */}
            <Circle cx={p.px} cy={p.py} r={16} fill="transparent" onPress={() => onSelect?.(p.key)} />
            <SvgText x={p.px} y={height - 6} fontSize={9} fill={on ? colors.ink : colors.ink3} textAnchor="middle">
              {p.label}
            </SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}
