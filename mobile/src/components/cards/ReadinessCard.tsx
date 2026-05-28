import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useHealthStore } from '../../store/health.store';
import { readinessFromSummaries } from '../../lib/health-readiness';
import { colors, spacing, radii, shadows, useThemedStyles } from '../../theme';
import { GlassCard } from '../ui/GlassCard';

const COMP_COLOR: Record<string, string> = {
  sono: colors.blue,
  fcRepouso: colors.rose,
  vfc: colors.green,
  aneis: colors.primary,
};

/** Card de prontidão na tela Hoje. Some quando não há dados de saúde na sessão. */
export function ReadinessCard() {
  const styles = useThemedStyles(createStyles);
  const summaries = useHealthStore((s) => s.summaries);
  const score = readinessFromSummaries(summaries);
  if (score.components.length === 0) return null;

  return (
    <GlassCard style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>PRONTIDÃO</Text>
          <Text style={styles.caption}>sono · coração · atividade</Text>
        </View>
        <Text style={styles.score}>{score.total}</Text>
      </View>
      <View style={styles.bars}>
        {score.components.map((c) => (
          <View key={c.key} style={styles.barRow}>
            <Text style={styles.barLabel}>{c.label}</Text>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  { width: `${Math.round(c.score)}%`, backgroundColor: COMP_COLOR[c.key] ?? colors.primary },
                ]}
              />
            </View>
            <Text style={styles.barVal}>{Math.round(c.score)}</Text>
          </View>
        ))}
      </View>
    </GlassCard>
  );
}

const createStyles = () => StyleSheet.create({
  card: {
    borderRadius: radii['2xl'],
    padding: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.md,
    ...shadows.card,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { fontSize: 12.5, fontWeight: '700', color: colors.ink2, letterSpacing: 0.6 },
  caption: { fontSize: 12, color: colors.ink3, marginTop: 1 },
  score: { fontSize: 36, fontFamily: 'InstrumentSerif', color: colors.ink },
  bars: { gap: 8 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barLabel: { width: 92, fontSize: 12.5, color: colors.ink2 },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.surfaceMute, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  barVal: { width: 26, textAlign: 'right', fontSize: 12.5, fontWeight: '700', color: colors.ink, fontFamily: 'GeistMono' },
});
