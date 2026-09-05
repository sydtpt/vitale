import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import {
  SLEEP_AXIS_ORIGIN_H,
  clockOfAxis,
  formatHm,
  signedMin,
  type SleepColors,
  type SleepRetro,
  type SleepSide,
  type SleepStageStat,
} from '@vitale/shared';
import { colors, fonts, spacing, useThemedStyles } from '../../theme';

interface Props {
  retro: SleepRetro;
  prevLabel: string;
  curLabel: string;
  width: number;
  palette: SleepColors;
}

const PAD_TOP = 18;
const PAD_BOTTOM = 44;
const PAD_LEFT = 30;
const BAR_W = 32;

/** A barra de composição da noite média: REM · Leve · Profundo · acordado. */
export function CompositionBar({ stages, awakeMin, palette }: { stages: SleepStageStat | null; awakeMin: number | null; palette: SleepColors }) {
  const styles = useThemedStyles(createStyles);
  if (!stages) return null;
  const aw = (awakeMin ?? 0) / 60;
  const segs: { flex: number; color: string }[] = [
    { flex: stages.rem, color: palette.rem },
    { flex: stages.core, color: palette.light },
    { flex: stages.deep, color: palette.deep },
    { flex: aw, color: palette.awake },
  ].filter((s) => s.flex > 0);
  return (
    <View style={styles.comp}>
      {segs.map((s, i) => <View key={i} style={[styles.seg, { flex: s.flex, backgroundColor: s.color }]} />)}
    </View>
  );
}

/**
 * B4 — antes × agora. Duas noites típicas lado a lado: a barra vai da mediana de
 * apagar à de acordar, o bigode é o miolo p25–p75; embaixo, a composição por fase
 * e as diferenças **em minutos, e só elas** — nenhuma seta de bom ou ruim. O
 * jornal não julga a noite, e o Tempos também não.
 *
 * É a mesma peça que o bloco Sono da Retrospectiva desenha (`sleepRetro`): um
 * núcleo, três lugares.
 */
export function BeforeAfter({ retro, prevLabel, curLabel, width, palette }: Props) {
  const styles = useThemedStyles(createStyles);
  const { cur, prev, delta } = retro;
  if (!prev || !delta || width <= 0) return null;

  const height = 210;
  const from = Math.max(0, Math.min(prev.onset.p25, cur.onset.p25) - 0.5);
  const to = Math.min(24, Math.max(prev.wake.p75, cur.wake.p75) + 0.5);
  const span = Math.max(to - from, 1);
  const innerH = height - PAD_TOP - PAD_BOTTOM;
  const y = (pos: number) => PAD_TOP + ((pos - from) / span) * innerH;
  const innerW = width - PAD_LEFT;
  const grid: number[] = [];
  for (let h = Math.ceil(from / 2) * 2; h <= to; h += 2) grid.push(h);

  const column = (s: SleepSide, label: string, cx: number) => {
    const y1 = y(s.onset.median);
    const y2 = y(s.wake.median);
    return (
      <React.Fragment key={label}>
        <Line x1={cx} x2={cx} y1={y(s.onset.p25)} y2={y(s.onset.p75)} stroke={colors.ink3} strokeWidth={1.5} />
        <Line x1={cx} x2={cx} y1={y(s.wake.p25)} y2={y(s.wake.p75)} stroke={colors.ink3} strokeWidth={1.5} />
        <Rect x={cx - BAR_W / 2} y={y1} width={BAR_W} height={Math.max(2, y2 - y1)} rx={5} fill={palette.sleep} />
        <SvgText x={cx} y={y1 - 5} fontSize={10.5} fill={colors.ink} textAnchor="middle" fontFamily={fonts.mono}>
          {clockOfAxis(s.onset.median)}
        </SvgText>
        <SvgText x={cx} y={y2 + 12} fontSize={10.5} fill={colors.ink} textAnchor="middle" fontFamily={fonts.mono}>
          {clockOfAxis(s.wake.median)}
        </SvgText>
        <SvgText x={cx} y={height - 20} fontSize={12} fill={colors.ink} textAnchor="middle" fontFamily={fonts.monoBold}>
          {formatHm(s.asleepH)}
        </SvgText>
        <SvgText x={cx} y={height - 6} fontSize={9.5} fill={colors.ink3} textAnchor="middle" fontFamily={fonts.mono}>
          {`${label} · n${s.nights}`}
        </SvgText>
      </React.Fragment>
    );
  };

  const rows: { l: string; a: string; b: string; d: number | null }[] = [
    { l: 'Dormido', a: formatHm(prev.asleepH), b: formatHm(cur.asleepH), d: delta.asleepMin },
    ...(prev.awake && cur.awake
      ? [{ l: 'Acordado', a: `${Math.round(prev.awake.minMean)} min`, b: `${Math.round(cur.awake.minMean)} min`, d: delta.awakeMin }]
      : []),
    { l: 'Apagou', a: clockOfAxis(prev.onset.median), b: clockOfAxis(cur.onset.median), d: delta.onsetMin },
    { l: 'Acordou', a: clockOfAxis(prev.wake.median), b: clockOfAxis(cur.wake.median), d: delta.wakeMin },
    ...(prev.stages && cur.stages
      ? [
          { l: 'REM', a: formatHm(prev.stages.rem), b: formatHm(cur.stages.rem), d: delta.remMin },
          { l: 'Leve', a: formatHm(prev.stages.core), b: formatHm(cur.stages.core), d: delta.coreMin },
          { l: 'Profundo', a: formatHm(prev.stages.deep), b: formatHm(cur.stages.deep), d: delta.deepMin },
        ]
      : []),
  ];

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Antes × agora</Text>
      <Text style={styles.sub}>barra = mediana de apagar → acordar · bigode = miolo p25–p75</Text>
      <Svg width={width} height={height}>
        {grid.map((h) => (
          <React.Fragment key={h}>
            <Line x1={PAD_LEFT} y1={y(h)} x2={width} y2={y(h)} stroke={colors.line} strokeWidth={1} strokeDasharray="2 4" />
            <SvgText x={0} y={y(h) + 3} fontSize={9} fill={colors.ink4} fontFamily={fonts.mono}>
              {`${String((SLEEP_AXIS_ORIGIN_H + h) % 24).padStart(2, '0')}h`}
            </SvgText>
          </React.Fragment>
        ))}
        {column(prev, prevLabel, PAD_LEFT + innerW * 0.28)}
        {column(cur, curLabel, PAD_LEFT + innerW * 0.72)}
      </Svg>

      {cur.stages && prev.stages && (
        <View style={styles.compBlock}>
          <View style={styles.compRow}>
            <Text style={styles.compLabel}>antes</Text>
            <CompositionBar stages={prev.stages} awakeMin={prev.awake?.minMean ?? null} palette={palette} />
          </View>
          <View style={styles.compRow}>
            <Text style={styles.compLabel}>agora</Text>
            <CompositionBar stages={cur.stages} awakeMin={cur.awake?.minMean ?? null} palette={palette} />
          </View>
        </View>
      )}

      <View style={styles.rows}>
        {rows.map((r) => (
          <View key={r.l} style={styles.row}>
            <Text style={styles.rowL}>{r.l}</Text>
            <Text style={styles.rowR}>
              <Text style={styles.rowPrev}>{r.a}</Text> → {r.b}
              <Text style={styles.rowDelta}>{r.d === null ? '  —' : `  ${signedMin(r.d)}`}</Text>
            </Text>
          </View>
        ))}
      </View>
      <Text style={styles.note}>
        Diferenças em minutos, sem cor de bom ou ruim.
        {retro.sourceChange ? ` A comparação cruza a troca para ${retro.sourceChange.label}: a vigília não se compara.` : ''}
      </Text>
    </View>
  );
}

const createStyles = () =>
  StyleSheet.create({
    wrap: { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.md },
    title: { fontSize: 13, fontFamily: fonts.sansBold, color: colors.ink },
    sub: { fontSize: 11, color: colors.ink3, fontFamily: fonts.sans, marginTop: 1, marginBottom: spacing.sm },
    comp: { flex: 1, flexDirection: 'row', gap: 2, height: 10 },
    seg: { borderRadius: 3 },
    compBlock: { gap: 6, marginTop: spacing.sm },
    compRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    compLabel: { width: 44, fontSize: 11, color: colors.ink3, fontFamily: fonts.sans },
    rows: { marginTop: spacing.sm, gap: 6 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
    rowL: { fontSize: 12.5, color: colors.ink2, fontFamily: fonts.sans },
    rowR: { fontSize: 12.5, color: colors.ink, fontFamily: fonts.mono },
    rowPrev: { color: colors.ink3 },
    rowDelta: { color: colors.ink3 },
    note: { fontSize: 11, lineHeight: 16, color: colors.ink3, fontFamily: fonts.sans, marginTop: spacing.sm },
  });
