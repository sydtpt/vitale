import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { localDateStr, readinessAdvice, type AdviceTone } from '@vitale/shared';
import { useHealthStore } from '../../store/health.store';
import { useHealthDailyStore } from '../../store/health-daily.store';
import { usePlannedWorkoutsStore } from '../../store/planned-workouts.store';
import { readinessFromSummaries } from '../../lib/health-readiness';
import { colors, fonts, radii, shadows, spacing, useThemedStyles } from '../../theme';
import { GlassCard } from '../ui/GlassCard';

const COMP_COLOR: Record<string, string> = {
  sono: colors.blue,
  fcRepouso: colors.rose,
  vfc: colors.green,
  aneis: colors.primary,
};

/** Cor de destaque por tom da recomendação. */
const TONE_COLOR: Record<AdviceTone, string> = {
  go: colors.green,
  caution: colors.primary,
  rest: colors.blue,
  neutral: colors.ink3,
};

/** Card de prontidão na tela Hoje. Some quando não há dados de saúde na sessão. */
export function ReadinessCard() {
  const styles = useThemedStyles(createStyles);
  const summaries = useHealthStore((s) => s.summaries);
  // Assina `rows` (e não `seriesFor`, que é estável): é a chegada da tabela que
  // precisa acordar o componente. O recorte da métrica sai do `useMemo` abaixo,
  // porque `rows` cobre um ano de todas as métricas.
  const dailyRows = useHealthDailyStore((s) => s.rows);
  const loadDaily = useHealthDailyStore((s) => s.load);
  const planned = usePlannedWorkoutsStore((s) => s.planned);
  const loadPlanner = usePlannedWorkoutsStore((s) => s.load);

  useEffect(() => {
    loadPlanner();
    // VFC do intervals.icu mora em `health_daily`, não no HealthKit (ADR 0026).
    void loadDaily();
  }, [loadPlanner, loadDaily]);

  const vfcRows = useMemo(() => dailyRows.filter((r) => r.metric === 'vfc'), [dailyRows]);
  const score = useMemo(
    () => readinessFromSummaries(summaries, { vfc: vfcRows }),
    [summaries, vfcRows],
  );
  if (score.components.length === 0) return null;

  // Recomendação: prontidão × intensidade do treino planejado de hoje (real).
  const today = planned.find((p) => p.date === localDateStr());
  const advice = readinessAdvice(score.total, true, today?.kind ?? 'none', today?.type ?? '');
  const accent = TONE_COLOR[advice.tone];

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
      <View style={[styles.advice, { borderLeftColor: accent }]}>
        <Text style={[styles.adviceTitle, { color: accent }]}>{advice.title}</Text>
        <Text style={styles.adviceText}>{advice.text}</Text>
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
  eyebrow: { fontSize: 12.5, fontFamily: fonts.sansBold, color: colors.ink2, letterSpacing: 0.6 },
  caption: { fontSize: 12, fontFamily: fonts.sans, color: colors.ink3, marginTop: 1 },
  score: { fontSize: 36, fontFamily: fonts.serif, color: colors.ink },
  bars: { gap: 8 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barLabel: { width: 92, fontSize: 12.5, fontFamily: fonts.sans, color: colors.ink2 },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.surfaceMute, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  barVal: { width: 26, textAlign: 'right', fontSize: 12.5, color: colors.ink, fontFamily: fonts.monoBold },
  advice: {
    backgroundColor: colors.surfaceMute,
    borderLeftWidth: 3,
    borderRadius: radii.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: 2,
  },
  adviceTitle: { fontSize: 13, fontFamily: fonts.sansBold },
  adviceText: { fontSize: 12.5, fontFamily: fonts.sans, lineHeight: 17, color: colors.ink2 },
});
