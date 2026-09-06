import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Line, Rect, Text as SvgText } from 'react-native-svg';
import {
  axisPosition,
  awakeMinOf,
  clockOfAxis,
  formatHm,
  isFreeWakeDay,
  median,
  quantile,
  type SleepBucket,
  type SleepColors,
  type SleepPeriod,
} from '@vitale/shared';
import { colors, fonts, spacing, useThemedStyles } from '../../theme';

/** Uma noite (ou uma semana, nos períodos longos) reduzida ao que as réguas medem. */
export interface DispersionPoint {
  key: string;
  /** Apagar e acordar em horas de eixo (origem 18h). */
  onset: number;
  wake: number;
  asleepH: number;
  /** `null` = a fonte não reporta. */
  awakeMin: number | null;
  /** Noite de fim de semana — ponto vazado. */
  free: boolean;
}

export function dispersionPoints(nights: readonly SleepPeriod[]): DispersionPoint[] {
  return nights.map((p) => ({
    key: p.wakeDay,
    onset: axisPosition(p.onsetAt, p.tzOffset),
    wake: axisPosition(p.wakeAt, p.tzOffset),
    asleepH: p.asleepH,
    awakeMin: awakeMinOf(p),
    free: isFreeWakeDay(p.wakeDay),
  }));
}

/** Nos períodos longos cada ponto é a noite típica de uma semana. */
export function dispersionPointsFromBuckets(buckets: readonly SleepBucket[]): DispersionPoint[] {
  return buckets.map((b) => ({
    key: b.key,
    onset: b.onset.median,
    wake: b.wake.median,
    asleepH: b.asleepH,
    awakeMin: b.awakeMin,
    free: false,
  }));
}

interface Props {
  points: DispersionPoint[];
  width: number;
  palette: SleepColors;
  /** "noite" ou "semana" — o que cada ponto é. */
  unit?: 'noite' | 'semana';
}

const H = 46;
const PAD = 8;
const R = 5;

interface StripDef {
  title: string;
  sub: string;
  values: { v: number; free: boolean; key: string }[];
  fmt: (v: number) => string;
  lo: number;
  hi: number;
  ticks: number[];
}

/** Piso e teto redondos em volta dos dados, com uma folga de meio passo. */
function bounds(vs: number[], step: number, floor?: number): { lo: number; hi: number; ticks: number[] } {
  const min = Math.min(...vs);
  const max = Math.max(...vs);
  let lo = Math.floor(min / step) * step - step / 2;
  let hi = Math.ceil(max / step) * step + step / 2;
  if (floor !== undefined) lo = Math.max(floor, lo);
  if (hi - lo < step * 2) hi = lo + step * 2;
  const ticks: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) ticks.push(t);
  return { lo, hi, ticks };
}

/**
 * B1 — a dispersão com mediana. Cada noite é um ponto numa régua; a linha é a
 * mediana, a faixa é o miolo p25–p75. A regularidade aparece como **largura**,
 * não como índice: quatro réguas — apagou, acordou, dormido, acordado — e o
 * fim de semana vazado, para se ver se é ele que puxa a faixa.
 *
 * Fim de semana é a única distinção de forma; a cor é uma só, a do sono, e o
 * miolo é a lavagem do azul — a mesma da cama nas outras telas, porque também
 * aqui é "o intervalo em volta", não um dado a mais.
 */
export function SleepDispersion({ points, width, palette, unit = 'noite' }: Props) {
  const styles = useThemedStyles(createStyles);
  if (points.length === 0 || width <= 0) return null;

  const strips: StripDef[] = [];
  const pick = (f: (p: DispersionPoint) => number | null) =>
    points.flatMap((p) => { const v = f(p); return v === null ? [] : [{ v, free: p.free, key: p.key }]; });

  const on = pick((p) => p.onset);
  const b1 = bounds(on.map((x) => x.v), 1);
  strips.push({ title: 'Apagou', sub: `hora em que o sono começou`, values: on, fmt: clockOfAxis, ...b1 });

  const wk = pick((p) => p.wake);
  const b2 = bounds(wk.map((x) => x.v), 1);
  strips.push({ title: 'Acordou', sub: 'hora em que acabou', values: wk, fmt: clockOfAxis, ...b2 });

  const hs = pick((p) => p.asleepH);
  const b3 = bounds(hs.map((x) => x.v), 1, 0);
  strips.push({ title: 'Dormido', sub: `horas líquidas por ${unit}`, values: hs, fmt: formatHm, ...b3 });

  const aw = pick((p) => p.awakeMin);
  if (aw.length > 0) {
    const b4 = bounds(aw.map((x) => x.v), Math.max(...aw.map((x) => x.v)) > 60 ? 30 : 10, 0);
    strips.push({ title: 'Acordado', sub: `minutos por ${unit}`, values: aw, fmt: (v) => `${Math.round(v)} min`, ...b4 });
  }

  return (
    <View>
      {strips.map((s) => {
        const vs = s.values.map((x) => x.v);
        const med = median(vs);
        const p25 = quantile(vs, 0.25);
        const p75 = quantile(vs, 0.75);
        const X = (v: number) => PAD + ((v - s.lo) / (s.hi - s.lo)) * (width - PAD * 2);
        const cy = H / 2 - 4;
        return (
          <View key={s.title} style={styles.strip}>
            <View style={styles.head}>
              <Text style={styles.title}>{s.title}</Text>
              <Text style={styles.stat}>
                {s.fmt(med)} <Text style={styles.statRange}>· {s.fmt(p25)}–{s.fmt(p75)}</Text>
              </Text>
            </View>
            <Text style={styles.sub}>{s.sub}</Text>
            <Svg width={width} height={H}>
              <Rect x={X(p25)} y={cy - 11} width={Math.max(2, X(p75) - X(p25))} height={22} rx={4} fill={palette.bed} />
              <Line x1={X(med)} x2={X(med)} y1={cy - 15} y2={cy + 15} stroke={colors.ink} strokeWidth={2} />
              {s.values.map((x) => (
                <Circle
                  key={x.key}
                  cx={X(x.v)}
                  cy={cy}
                  r={R}
                  fill={x.free ? colors.surface : palette.sleep}
                  stroke={palette.sleep}
                  strokeWidth={1.6}
                />
              ))}
              <Line x1={0} x2={width} y1={cy + 18} y2={cy + 18} stroke={colors.line} strokeWidth={1} />
              {s.ticks.map((t) => (
                <SvgText key={t} x={X(t)} y={H - 1} fontSize={9} fill={colors.ink4} textAnchor="middle" fontFamily={fonts.mono}>
                  {s.fmt(t)}
                </SvgText>
              ))}
            </Svg>
          </View>
        );
      })}
    </View>
  );
}

const createStyles = () =>
  StyleSheet.create({
    strip: { marginTop: spacing.md },
    head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.sm },
    title: { fontSize: 13, fontFamily: fonts.sansBold, color: colors.ink },
    stat: { fontSize: 12, fontFamily: fonts.mono, color: colors.ink },
    statRange: { color: colors.ink3 },
    sub: { fontSize: 11, color: colors.ink3, fontFamily: fonts.sans, marginTop: 1 },
  });
