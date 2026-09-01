import React from 'react';
import Svg, { Path, Circle, Text as SvgText, Line } from 'react-native-svg';
import { Bucket } from '../../lib/health-buckets';
import { colors } from '../../theme';

interface Props {
  buckets: Bucket[];
  width: number;
  height?: number;
  color: string;
  /**
   * Não ligar pontos separados por um bucket vazio.
   *
   * O padrão (ligar) serve a métricas contínuas — a FC de repouso existe todo
   * dia, o buraco é dado faltando. Numa série de "melhor do mês", o mês sem
   * corrida não é dado faltando: é um mês sem corrida, e a linha passando por
   * cima dele inventaria uma progressão que não aconteceu. Com `gaps` a área
   * também some — sombrear um vazio é a mesma mentira.
   */
  gaps?: boolean;
  /** Linha pontilhada de referência (o recorde, a meta…). Entra na escala. */
  reference?: { value: number; label?: string };
}

const PAD_TOP = 18;
const PAD_BOTTOM = 18;

/** Gráfico de linha para métricas pontuais (FC, peso, VO₂…). */
export function LineChart({ buckets, width, height = 180, color, gaps = false, reference }: Props) {
  const n = buckets.length;
  if (n === 0 || width <= 0) return null;

  const filled = buckets.map((b, i) => ({ ...b, i })).filter((b) => !b.empty);
  if (filled.length === 0) return <Svg width={width} height={height} />;

  const innerH = height - PAD_TOP - PAD_BOTTOM;
  const values = filled.map((b) => b.value);
  // A referência entra na escala: um recorde abaixo de todo ponto sairia da caixa.
  const min = Math.min(...values, reference?.value ?? Infinity);
  const max = Math.max(...values, reference?.value ?? -Infinity);
  const span = max - min || 1;
  const slot = n > 1 ? width / (n - 1) : width;

  const x = (i: number) => (n > 1 ? i * slot : width / 2);
  const y = (v: number) => PAD_TOP + innerH - ((v - min) / span) * innerH;

  const pts = filled.map((b) => ({ x: x(b.i), y: y(b.value), i: b.i }));
  // Com `gaps`, um salto de índice > 1 recomeça o traço (M) em vez de ligar (L).
  const linePath = pts
    .map((p, k) => `${k === 0 || (gaps && p.i - pts[k - 1].i > 1) ? 'M' : 'L'}${p.x},${p.y}`)
    .join(' ');
  const areaPath = `${linePath} L${pts[pts.length - 1].x},${PAD_TOP + innerH} L${pts[0].x},${PAD_TOP + innerH} Z`;
  const refY = reference ? y(reference.value) : null;

  const labelStep = n <= 7 ? 1 : Math.ceil(n / 6);
  const last = pts[pts.length - 1];

  return (
    <Svg width={width} height={height}>
      <Line x1={0} y1={PAD_TOP + innerH} x2={width} y2={PAD_TOP + innerH} stroke={colors.line} strokeWidth={1} />
      {!gaps && <Path d={areaPath} fill={color} opacity={0.1} />}
      {refY !== null && (
        <>
          <Line x1={0} y1={refY} x2={width} y2={refY} stroke={colors.ink3} strokeWidth={1} strokeDasharray="1 3" />
          {reference?.label && (
            <SvgText x={width} y={refY - 4} fontSize={9} fill={colors.ink3} textAnchor="end">
              {reference.label}
            </SvgText>
          )}
        </>
      )}
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
