import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Activity, HeatCell, Heatmap } from '@vitale/shared';
import { buildActivityConsistency } from '@vitale/shared';
import { HeatmapGrid } from '../HeatmapGrid';
import { colors, fonts, radii, shadows, spacing, useThemedStyles } from '../../theme';

/**
 * Um mês de treino em 28 células — apareci ou não, e quanto.
 *
 * ## Por que ao lado do gráfico de barras, e não no lugar dele
 *
 * As barras respondem "quanto, e de quê", que é o que elas fazem bem. Não
 * respondem "eu apareci?": num período curto, um dia sem treino vira espaço em
 * branco indistinguível da margem, e é justamente o buraco que interessa num
 * app de acompanhamento. As duas formas convivem porque as perguntas são
 * diferentes.
 *
 * ## O que a célula mede
 *
 * Minutos de **esforço** — a mesma grandeza que a linha da meta da OMS usa no
 * gráfico acima, e não tempo de relógio. Assim os dois painéis do card falam a
 * mesma língua: se a barra diz que a semana bateu a meta, a grade mostra em
 * quais dias isso aconteceu.
 */
export function ConsistencyCard({
  activities,
  weeklyTargetMin,
  days = 28,
  now,
}: {
  activities: Activity[];
  weeklyTargetMin: number;
  days?: number;
  now?: Date;
}) {
  const styles = useThemedStyles(createStyles);

  const c = useMemo(
    () => buildActivityConsistency(activities, weeklyTargetMin, days, now),
    [activities, weeklyTargetMin, days, now],
  );

  // O `HeatmapGrid` é genérico sobre `Heatmap`; adaptar aqui evita uma segunda
  // grade que sairia divergindo desta na primeira mudança de estilo.
  const data: Heatmap = useMemo(() => {
    const cells: HeatCell[] = c.days.map((d) => ({
      day: d.day,
      value: Math.round(d.effectiveS / 60),
      step: d.step,
      weekday: d.weekday,
    }));
    return {
      metric: 'esforco',
      label: 'Esforço',
      unit: ' min',
      decimals: 0,
      higherIsWorse: false,
      target: Math.round(c.targetS / 60),
      cells,
      pad: c.pad,
      measured: c.activeDays,
    };
  }, [c]);

  if (c.activeDays === 0) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Consistência · {days} dias</Text>
      <Text style={styles.sub}>
        Minutos de esforço por dia, contra a meta de {Math.round(c.targetS / 60)} min/dia.
      </Text>

      <HeatmapGrid
        data={data}
        emptyHint={`toque num dia · ${c.activeDays} de ${days} dias com treino`}
      />

      <View style={styles.footer}>
        <Stat value={`${c.activeDays}/${days}`} label="dias com treino" />
        <Stat value={`${c.metDays}`} label="bateram a meta" />
        <Stat value={`${c.longestStreak}`} label="maior sequência" />
      </View>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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
    title: { fontSize: 15, fontFamily: fonts.sansSemiBold, color: colors.ink },
    sub: { fontSize: 11.5, fontFamily: fonts.sans, color: colors.ink3, marginTop: -4 },
    footer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      borderTopWidth: 1,
      borderTopColor: colors.line,
      paddingTop: spacing.sm,
    },
    stat: { alignItems: 'center', flex: 1, gap: 1 },
    statValue: { fontSize: 15, fontFamily: fonts.monoBold, color: colors.ink },
    statLabel: { fontSize: 10.5, fontFamily: fonts.sans, color: colors.ink3 },
  });
