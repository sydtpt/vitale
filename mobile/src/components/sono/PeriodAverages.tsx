import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatHm, type PeriodSummary, type SleepColors } from '@vitale/shared';
import { colors, fonts, spacing, useThemedStyles } from '../../theme';

interface Props {
  summary: PeriodSummary;
  palette: SleepColors;
}

/**
 * As médias do topo: *dormindo* sempre; o segundo número é *na cama* quando a
 * cama foi medida em ≥ 80% das noites, senão *acordado*. É a regra de
 * `periodSummary` — a tela só a escreve. Sem meta, sem seta. O ponto ao lado
 * do rótulo é a cor da coisa: sono, cama ou vigília.
 */
export function PeriodAverages({ summary, palette }: Props) {
  const styles = useThemedStyles(createStyles);
  const s = summary.secondary;
  return (
    <View style={styles.row}>
      <View style={styles.tile}>
        <View style={styles.lab}>
          <View style={[styles.dot, { backgroundColor: palette.sleep }]} />
          <Text style={styles.labText}>dormindo</Text>
        </View>
        <Text style={styles.val}>{formatHm(summary.asleepH)}</Text>
        <Text style={styles.sub}>média de {summary.nights} {summary.nights === 1 ? 'noite' : 'noites'}</Text>
      </View>
      {s && (
        <View style={styles.tile}>
          <View style={styles.lab}>
            <View
              style={[
                styles.dot,
                s.kind === 'bed'
                  ? { backgroundColor: palette.bed, borderWidth: 1, borderColor: palette.sleep }
                  : { backgroundColor: palette.awake },
              ]}
            />
            <Text style={styles.labText}>{s.kind === 'bed' ? 'na cama' : 'acordado'}</Text>
          </View>
          <Text style={styles.val}>
            {s.kind === 'bed' ? formatHm(s.hours) : (
              <>
                {Math.round(s.minutes)}
                <Text style={styles.unit}> min</Text>
              </>
            )}
          </Text>
          <Text style={styles.sub}>
            {s.kind === 'bed'
              ? `${Math.round(s.share * 100)}% das noites medem a cama`
              : `cama medida em ${Math.round(s.share * 100)}% — média omitida`}
          </Text>
        </View>
      )}
    </View>
  );
}

const createStyles = () =>
  StyleSheet.create({
    row: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
    tile: { flex: 1 },
    lab: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    labText: { fontSize: 10.5, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.ink3, fontFamily: fonts.sansSemiBold },
    val: { fontSize: 26, fontFamily: fonts.mono, color: colors.ink, letterSpacing: -0.5, marginTop: 2 },
    unit: { fontSize: 13, color: colors.ink3, fontFamily: fonts.sans },
    sub: { fontSize: 11, color: colors.ink3, fontFamily: fonts.sans },
  });
