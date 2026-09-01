import React, { useMemo } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Activity } from '@vitale/shared';
import { HR_ZONES, buildWeeklyLoad } from '@vitale/shared';
import { StackedBarChart } from '../charts/StackedBarChart';
import { formatDuration } from '../../lib/workout-format';
import { colors, fonts, radii, roleColors, shadows, spacing, useTheme, useThemedStyles } from '../../theme';

/** Quantas semanas a janela móvel exibe — a mesma da web. */
const WEEKS = 8;

/**
 * Carga semanal: tempo em cada zona de FC, oito semanas, com a polarização da
 * semana e o alerta de carga forte.
 *
 * Existia só na web, pronta e testada — e o Sydnei olha "quanto tempo em cada
 * zona" no celular, depois de correr: *"se não tem no mobile, eu não vejo"*.
 * Fica ao lado da grade de consistência: ela responde "apareci?", esta responde
 * "e a que custo?". Mesmo `buildWeeklyLoad` do núcleo, mesmas oito semanas, o
 * mesmo gráfico empilhado — a semana daqui tem de bater com a da web.
 */
export function WeeklyLoadCard({ activities }: { activities: Activity[] }) {
  const styles = useThemedStyles(createStyles);
  // Lido a cada render de propósito: as cores das zonas seguem a paleta ativa.
  useTheme();
  const { width } = useWindowDimensions();
  const chartW = Math.max(0, width - spacing.lg * 4);

  const load = useMemo(() => buildWeeklyLoad(activities, WEEKS), [activities]);
  const empty = load.buckets.every((b) => b.total === 0);
  if (empty) return null;

  const easyPct = Math.round(load.polarization.easyPct);
  const zones = HR_ZONES.map((z) => ({ label: z.label, color: roleColors(z.role).accent }));

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Carga semanal</Text>
      <Text style={styles.title}>Zonas de frequência cardíaca</Text>

      {load.highLoadAlert && (
        <View style={styles.alert}>
          <Ionicons name="warning-outline" size={14} color={roleColors('red').text} />
          <Text style={styles.alertText}>
            Carga forte acima do habitual esta semana — considere priorizar recuperação.
          </Text>
        </View>
      )}

      <StackedBarChart buckets={load.buckets} metric="duration" width={chartW} height={170} noScroll />

      <View style={styles.legend}>
        {zones.map((z) => (
          <View key={z.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: z.color }]} />
            <Text style={styles.legendText}>{z.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.polar}>
        <View style={styles.polarHead}>
          <Text style={styles.polarLabel}>Esta semana</Text>
          <Text style={styles.polarPct}>{easyPct}% leve</Text>
        </View>
        <View style={styles.polarBar}>
          <View style={[styles.polarFill, { width: `${easyPct}%` }]} />
        </View>
        <View style={styles.polarFoot}>
          <Text style={styles.polarFootText}>Leve (Z1–Z2) {formatDuration(load.polarization.easyS)}</Text>
          <Text style={styles.polarFootText}>Forte (Z4–Z5) {formatDuration(load.polarization.hardS)}</Text>
        </View>
      </View>
    </View>
  );
}

const createStyles = () =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii['2xl'],
      padding: spacing.lg,
      marginTop: spacing.md,
      gap: spacing.sm,
      ...shadows.card,
    },
    eyebrow: {
      fontSize: 10.5,
      fontFamily: fonts.sansSemiBold,
      color: colors.ink3,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    title: { fontSize: 15, fontFamily: fonts.sansSemiBold, color: colors.ink, marginTop: -6 },
    alert: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: roleColors('red').soft,
      borderRadius: 10,
      paddingHorizontal: 11,
      paddingVertical: 8,
    },
    // `.on` sobre o `.soft`: é o par que garante 4,5 dentro do preenchimento. ADR 0024.
    alertText: { flex: 1, fontSize: 12, fontFamily: fonts.sansMedium, color: roleColors('red').on },
    legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendDot: { width: 9, height: 9, borderRadius: 5 },
    legendText: { fontSize: 11, fontFamily: fonts.sans, color: colors.ink2 },
    polar: { gap: 6, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.sm },
    polarHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    polarLabel: { fontSize: 12, fontFamily: fonts.sansSemiBold, color: colors.ink2 },
    polarPct: { fontSize: 13, fontFamily: fonts.monoBold, color: colors.ink },
    polarBar: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceMute, overflow: 'hidden' },
    // Leve = Z1–Z2; a cor é a da zona de recuperação, a mesma da legenda.
    polarFill: { height: '100%', borderRadius: 4, backgroundColor: roleColors('blue').accent },
    polarFoot: { flexDirection: 'row', justifyContent: 'space-between' },
    polarFootText: { fontSize: 10.5, fontFamily: fonts.sans, color: colors.ink3 },
  });
