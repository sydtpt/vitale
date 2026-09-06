import React, { useId } from 'react';
import Svg, { Defs, Line, Pattern, Rect, Text as SvgText } from 'react-native-svg';
import type { SleepBucket, SleepColors, StageKey } from '@vitale/shared';
import { colors } from '../../theme';

interface Props {
  /** Colunas por noite (`bucketPeriods(nights, 'night')`) ou por semana. */
  buckets: SleepBucket[];
  width: number;
  height?: number;
  palette: SleepColors;
}

const PAD_TOP = 8;
const PAD_BOTTOM = 18;
const PAD_LEFT = 26;
/** Respiro de superfície entre segmentos — o mesmo 2 px que a barra empilhada pede. */
const GAP = 2;
/**
 * De baixo para cima: profundo na base, leve, REM, o que não tem estágio, e a
 * vigília no topo — a ordem do hipnograma virada de pé. A legenda lê a mesma
 * ordem de cima para baixo (despertar · REM · leve · profundo).
 */
const ORDER: (StageKey | 'awake')[] = ['deep', 'core', 'rem', 'unspecified', 'awake'];

function hoursOf(b: SleepBucket, k: StageKey | 'awake'): number {
  if (k === 'awake') return (b.awakeMin ?? 0) / 60;
  return b.stagesH[k] ?? 0;
}

/**
 * Os estágios em **total**: uma coluna por noite (ou por semana), em horas por
 * estágio, com a vigília no topo — a altura da coluna é a noite inteira. É
 * composição, não posição: responde "quanto", enquanto o timing chart responde
 * "quando". Nos períodos longos é a única leitura possível, porque uma "noite
 * típica" não tem hora para cada estágio.
 *
 * Coluna sem hipnograma não é célula vazia — é hachura na altura das horas
 * dormidas: "dormiu, sem o detalhe". Estimativa do aparelho, comparável com você
 * mesmo: nunca contra norma clínica.
 */
export function SleepStagesStackChart({ buckets, width, height = 232, palette }: Props) {
  const hatchId = `stack-hatch-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  if (buckets.length === 0 || width <= 0) return null;
  const nightly = buckets[0].kind === 'night';
  const totals = buckets.map((b) => (b.stagedNights === 0 ? b.asleepH : ORDER.reduce((s, k) => s + hoursOf(b, k), 0)));
  const maxH = Math.max(1, ...totals);
  const innerH = height - PAD_TOP - PAD_BOTTOM;
  const slot = (width - PAD_LEFT) / buckets.length;
  const bw = nightly ? Math.max(4, Math.min(slot * 0.58, 18)) : Math.max(3, Math.min(slot * 0.7, 26));
  const y = (h: number) => PAD_TOP + innerH - (h / maxH) * innerH;
  const labelStep = buckets.length <= 14 ? 1 : Math.ceil(buckets.length / 6);
  const grid: number[] = [];
  for (let h = 2; h <= maxH; h += 2) grid.push(h);

  const fillOf = (k: StageKey | 'awake'): string => {
    if (k === 'deep') return palette.deep;
    if (k === 'core') return palette.light;
    if (k === 'rem') return palette.rem;
    if (k === 'awake') return palette.awake;
    return `url(#${hatchId})`;
  };

  return (
    <Svg width={width} height={height}>
      <Defs>
        <Pattern id={hatchId} patternUnits="userSpaceOnUse" width={5} height={5} patternTransform="rotate(45)">
          <Line x1={0} y1={0} x2={0} y2={5} stroke={palette.unknown} strokeWidth={1.3} />
        </Pattern>
      </Defs>
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
              <Rect x={x} y={y(b.asleepH)} width={bw} height={Math.max(1, y(0) - y(b.asleepH))} fill={`url(#${hatchId})`} />
            ) : (
              ORDER.filter((k) => hoursOf(b, k) > 0).map((k) => {
                const h = hoursOf(b, k);
                const top = y(acc + h);
                const bottom = y(acc);
                acc += h;
                return <Rect key={k} x={x} y={top} width={bw} height={Math.max(1, bottom - top - GAP)} fill={fillOf(k)} />;
              })
            )}
            {i % labelStep === 0 && (
              <SvgText x={x + bw / 2} y={height - 4} fontSize={nightly ? 9 : 8.5} fill={nightly ? colors.ink3 : colors.ink4} textAnchor="middle">
                {nightly ? b.key.slice(8) : `${b.key.slice(8)}/${b.key.slice(5, 7)}`}
              </SvgText>
            )}
          </React.Fragment>
        );
      })}
    </Svg>
  );
}
