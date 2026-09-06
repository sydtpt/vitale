import React from 'react';
import Svg, { Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import {
  HEART_DAY_MAX_BPM,
  HEART_DAY_MIN_BPM,
  heartLineRuns,
  type ActivitySpan,
  type HourlyProfilePoint,
  type MinuteSpan,
} from '@vitale/shared';
import type { Sample } from '../../lib/health-buckets';
import { colors, fonts, moduleColors, roleColors, sleepColors } from '../../theme';

interface Props {
  /** As amostras cruas do dia (HealthKit), em ordem. */
  samples: Sample[];
  width: number;
  height?: number;
  /** Janelas dormindo que tocam o dia, no minuto local. */
  sleep: MinuteSpan[];
  /** Treinos do dia, no minuto local, com rótulo curto. */
  workouts: ActivitySpan[];
  /** A faixa típica por hora (p25–p75), dos últimos dias da tabela. */
  profile: HourlyProfilePoint[];
}

const PAD_TOP = 22;
const PAD_BOTTOM = 20;
const PAD_LEFT = 30;
const PAD_RIGHT = 6;

/** Minuto local de uma amostra: a hora do aparelho, como `health_daily.day`. */
function minuteOf(s: Sample): number {
  const d = new Date(s.start);
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

/**
 * A curva de FC de um dia, no mesmo desenho da web (proposta de 05/09/2026):
 * medida a cada 2 min em linha, sem suavização, sobre a faixa típica da hora;
 * a noite sombreada no `bed` do Sono; o treino como marca no topo, no papel do
 * módulo Treino; escala fixa 40–170 para um dia calmo parecer calmo.
 * Cores lidas no render — nunca no escopo do módulo (`architecture.test.ts`).
 */
export function DayHeartChart({ samples, width, height = 190, sleep, workouts, profile }: Props) {
  if (width <= 0) return null;
  const red = roleColors('red');
  const bed = sleepColors().bed;
  const treino = moduleColors('treino').accent;

  const plotW = width - PAD_LEFT - PAD_RIGHT;
  const plotH = height - PAD_TOP - PAD_BOTTOM;
  const x = (minute: number) => PAD_LEFT + (minute / 1440) * plotW;
  const y = (bpm: number) => {
    const v = Math.max(HEART_DAY_MIN_BPM, Math.min(HEART_DAY_MAX_BPM, bpm));
    return PAD_TOP + (1 - (v - HEART_DAY_MIN_BPM) / (HEART_DAY_MAX_BPM - HEART_DAY_MIN_BPM)) * plotH;
  };
  const f = (n: number) => n.toFixed(1);

  const band =
    profile.length > 1
      ? `${profile.map((p, i) => `${i ? 'L' : 'M'}${f(x(p.hour * 60 + 30))},${f(y(p.p75))}`).join(' ')} ${[...profile]
          .reverse()
          .map((p) => `L${f(x(p.hour * 60 + 30))},${f(y(p.p25))}`)
          .join(' ')} Z`
      : null;

  const ordered = [...samples].filter((s) => Number.isFinite(s.value)).sort((a, b) => a.start.localeCompare(b.start));
  const minutes = ordered.map(minuteOf);
  const readings = ordered.map((s) => s.value);
  const runs = heartLineRuns(minutes, readings).map((run) =>
    run.map((p, i) => `${i ? 'L' : 'M'}${f(x(p.minute))},${f(y(p.value))}`).join(' '),
  );

  return (
    <Svg width={width} height={height}>
      {band && <Path d={band} fill={red.wash} opacity={0.55} />}
      {sleep.map((s, i) => (
        <Rect key={`s${i}`} x={x(s.from)} y={PAD_TOP} width={Math.max(0, x(s.to) - x(s.from))} height={plotH} fill={bed} opacity={0.7} />
      ))}
      {[40, 80, 120, 160].map((v) => (
        <React.Fragment key={v}>
          <Line x1={PAD_LEFT} x2={width - PAD_RIGHT} y1={y(v)} y2={y(v)} stroke={colors.line} strokeWidth={1} />
          <SvgText x={PAD_LEFT - 5} y={y(v) + 3.5} fontSize={9} fontFamily={fonts.mono} fill={colors.ink3} textAnchor="end">
            {v}
          </SvgText>
        </React.Fragment>
      ))}
      {[0, 6, 12, 18, 24].map((h) => (
        <SvgText
          key={h}
          x={x(h * 60)}
          y={height - 5}
          fontSize={9}
          fontFamily={fonts.mono}
          fill={colors.ink3}
          textAnchor={h === 0 ? 'start' : h === 24 ? 'end' : 'middle'}
        >
          {h}h
        </SvgText>
      ))}
      {workouts.map((w, i) => {
        const wx = x(w.from);
        const ww = Math.max(3, x(w.to) - wx);
        return (
          <React.Fragment key={`w${i}`}>
            <Rect x={wx} y={PAD_TOP - 12} width={ww} height={4} rx={2} fill={treino} />
            {ww > 46 && (
              <SvgText x={wx + ww / 2} y={PAD_TOP - 15} fontSize={9.5} fontFamily={fonts.sansBold} fill={colors.ink2} textAnchor="middle">
                {w.name}
              </SvgText>
            )}
          </React.Fragment>
        );
      })}
      {runs.map((d, i) => (
        <Path key={`r${i}`} d={d} stroke={red.graphic} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      ))}
    </Svg>
  );
}
