import React from 'react';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';
import type { SleepBucket, StageKey } from '@vitale/shared';
import { colors } from '../../theme';

interface Props {
  buckets: SleepBucket[];
  width: number;
  height?: number;
  stageColors: Record<StageKey, string>;
}

const PAD_TOP = 8;
const PAD_BOTTOM = 18;
const PAD_LEFT = 26;
const ORDER: StageKey[] = ['deep', 'core', 'rem', 'unspecified'];

/**
 * Estágios nos períodos longos: uma coluna por semana, empilhando as horas
 * médias por estágio. É **composição**, não posição — uma "noite típica" não tem
 * hora para cada estágio, então o eixo aqui é de horas, não de relógio.
 *
 * Estimativa do aparelho, comparável com você mesmo: nunca contra norma clínica.
 */
export function SleepStagesWeeklyChart({ buckets, width, height = 232, stageColors }: Props) {
  if (buckets.length === 0 || width <= 0) return null;
  const totals = buckets.map((b) => ORDER.reduce((s, k) => s + (b.stagesH[k] ?? 0), 0));
  const maxH = Math.max(1, ...totals);
  const innerH = height - PAD_TOP - PAD_BOTTOM;
  const slot = (width - PAD_LEFT) / buckets.length;
  const bw = Math.max(3, Math.min(slot * 0.7, 26));
  const y = (h: number) => PAD_TOP + innerH - (h / maxH) * innerH;
  const labelStep = buckets.length <= 14 ? 1 : Math.ceil(buckets.length / 6);
  const grid: number[] = [];
  for (let h = 2; h <= maxH; h += 2) grid.push(h);

  return (
    <Svg width={width} height={height}>
      {grid.map((h) => (
        <React.Fragment key={h}>
          <Line x1={PAD_LEFT} y1={y(h)} x2={width} y2={y(h)} stroke={colors.line} strokeWidth={1} />
          <SvgText x={0} y={y(h) + 3} fontSize={9} fill={colors.ink4}>{`${h}h`}</SvgText>
        </React.Fragment>
      ))}
      <Line x1={PAD_LEFT} y1={y(0)} x2={width} y2={y(0)} stroke={colors.line} strokeWidth={1} />
      {buckets.map((b, i) => {
        const x = PAD_LEFT + i * slot + (slot - bw) / 2;
        let acc = 0;
        return (
          <React.Fragment key={b.key}>
            {b.stagedNights === 0 ? (
              <Rect x={x} y={y(maxH * 0.5)} width={bw} height={innerH * 0.5} rx={3} fill="none" stroke={colors.line} strokeDasharray="3 3" />
            ) : (
              ORDER.filter((k) => (b.stagesH[k] ?? 0) > 0).map((k) => {
                const h = b.stagesH[k] ?? 0;
                const top = y(acc + h);
                const bottom = y(acc);
                acc += h;
                return <Rect key={k} x={x} y={top} width={bw} height={Math.max(1, bottom - top - 1)} fill={stageColors[k]} />;
              })
            )}
            {i % labelStep === 0 && (
              <SvgText x={x + bw / 2} y={height - 4} fontSize={8.5} fill={colors.ink4} textAnchor="middle">
                {`${b.key.slice(8)}/${b.key.slice(5, 7)}`}
              </SvgText>
            )}
          </React.Fragment>
        );
      })}
    </Svg>
  );
}
