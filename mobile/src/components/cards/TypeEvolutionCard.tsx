import React, { useMemo } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import type { Activity } from '@vitale/shared';
import { buildTypeVolumeTrend, totalsDelta } from '@vitale/shared';
import { BarChart } from '../charts/BarChart';
import { getActivityMeta } from '../../lib/workout-types';
import { colors, fonts, radii, roleColors, shadows, spacing, useThemedStyles } from '../../theme';

/**
 * A evolução recente de um tipo, logo abaixo dos recordes.
 *
 * Os recordes contam o que **já** aconteceu — o melhor de sempre, o maior dos
 * doze meses. Não dizem se a coisa está indo para cima ou para baixo agora, que
 * é a outra pergunta que se leva para a tela de um esporte.
 *
 * A série é a mesma do card daquele tipo na lista do Histórico, pelo mesmo
 * builder do núcleo, só que com a janela maior. Card e tela discordando sobre o
 * mesmo esporte seria o pior tipo de bug: dois números certos sobre a mesma
 * coisa.
 */
export function TypeEvolutionCard({
  activities,
  label,
  hasDistance,
  color,
  weeks = 12,
  now,
}: {
  /** O histórico inteiro do tipo — o recorte por rótulo é feito aqui. */
  activities: Activity[];
  label: string;
  /** Tipos com distância medem em km; os demais, em minutos. */
  hasDistance: boolean;
  color: string;
  weeks?: number;
  now?: Date;
}) {
  const styles = useThemedStyles(createStyles);
  const { width } = useWindowDimensions();
  // Padding da lista mais o do card, dos dois lados.
  const chartW = Math.max(0, width - spacing.lg * 4);
  const unit = hasDistance ? 'km' : 'min';

  const trend = useMemo(
    () =>
      buildTypeVolumeTrend(
        activities,
        (id) => getActivityMeta(id).label,
        label,
        hasDistance ? 'distance' : 'duration',
        weeks,
        now,
      ),
    [activities, label, hasDistance, weeks, now],
  );

  // Nem a janela nem a anterior tiveram nada: seriam doze barras de altura zero,
  // que parecem defeito e não dizem nada que a contagem do topo já não diga.
  if (trend.total === 0 && trend.previousTotal === 0) return null;

  const delta = totalsDelta(trend.total, trend.previousTotal);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>Evolução</Text>
        <Text style={styles.total}>
          {trend.total}
          <Text style={styles.unit}> {unit}</Text>
        </Text>
        {delta !== null && (
          <Text
            style={[
              styles.delta,
              delta > 0 ? styles.deltaUp : delta < 0 ? styles.deltaDown : styles.deltaFlat,
            ]}
          >
            {delta === 0 ? '=' : `${delta > 0 ? '↑' : '↓'}${Math.abs(delta)}%`}
          </Text>
        )}
      </View>

      <BarChart
        buckets={trend.buckets}
        width={chartW}
        height={130}
        color={color}
        emphasis="last"
        reference={{ value: trend.mean, label: `média ${trend.mean} ${unit}` }}
      />

      <Text style={styles.caption}>
        Últimas {weeks} semanas · média de {trend.mean} {unit} por semana
        {delta !== null && ` · variação sobre as ${weeks} semanas anteriores`}
      </Text>
    </View>
  );
}

const createStyles = () =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.xl,
      padding: spacing.lg,
      marginBottom: 14,
      gap: spacing.xs,
      ...shadows.card,
    },
    head: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
    title: { fontSize: 13, fontFamily: fonts.sansSemiBold, color: colors.ink },
    total: { marginLeft: 'auto', fontSize: 19, fontFamily: fonts.monoBold, color: colors.ink },
    unit: { fontSize: 12, fontFamily: fonts.sansSemiBold, color: colors.ink3 },
    delta: { fontSize: 11, fontFamily: fonts.monoBold },
    // `.text` e não `.accent`: acento promete 3,0 (piso gráfico), letra quer 4,5.
    deltaUp: { color: roleColors('green').text },
    deltaDown: { color: roleColors('red').text },
    deltaFlat: { color: colors.ink4 },
    caption: { fontSize: 10.5, fontFamily: fonts.sans, color: colors.ink3 },
  });
