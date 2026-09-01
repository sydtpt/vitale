import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import type { Activity } from '@vitale/shared';
import { bestEffortTrend, distancesWithData } from '@vitale/shared';
import { LineChart } from '../charts/LineChart';
import { Segmented } from '../ui/Segmented';
import { formatClock, formatRate } from '../../lib/workout-format';
import { colors, fonts, radii, shadows, spacing, useThemedStyles } from '../../theme';

/**
 * "Estou diminuindo?" — o melhor tempo por mês numa distância, contra o recorde.
 *
 * O objetivo declarado é baixar minutos por quilômetro, e ritmo médio de corrida
 * não mede isso: um 20 km leve tem ritmo pior que um 5 km forte, sempre. A única
 * leitura comparável consigo mesma é o ritmo **na mesma distância** — daí o
 * seletor, e daí só as distâncias que têm marca.
 *
 * Mais baixo é mais rápido. O eixo não começa em zero, e isso é deliberado: entre
 * 4:20 e 4:30 por quilômetro a diferença é o que interessa, e num eixo a partir
 * de zero ela teria quatro pixels. O recorde é o chão pontilhado que a série
 * tenta encostar. Mês sem corrida naquela distância é buraco, não ponte.
 */
export function EffortTrendCard({
  activities,
  sportId,
  color,
  months = 12,
}: {
  /** O histórico inteiro — a série filtra pelo esporte. */
  activities: Activity[];
  sportId: number;
  color: string;
  months?: number;
}) {
  const styles = useThemedStyles(createStyles);
  const { width } = useWindowDimensions();
  const chartW = Math.max(0, width - spacing.lg * 4);

  const distances = useMemo(() => distancesWithData(activities, sportId), [activities, sportId]);
  // 5 km é a distância que mais se corre; se não houver, a primeira com marca.
  const [key, setKey] = useState<string | null>(null);
  const selected = key && distances.some((d) => d.key === key) ? key : distances.find((d) => d.key === '5000')?.key ?? distances[0]?.key;

  const trend = useMemo(
    () => (selected ? bestEffortTrend(activities, sportId, selected, months) : null),
    [activities, sportId, selected, months],
  );

  if (distances.length === 0 || !trend || !selected) return null;

  const distance = distances.find((d) => d.key === selected)!;
  const record = trend.record;
  const recordRate = record ? formatRate(sportId, distance.meters, record.secs) : null;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>Melhor {distance.label} por mês</Text>
        {record && (
          <Text style={styles.record}>
            recorde <Text style={styles.recordValue}>{formatClock(record.secs)}</Text>
            {recordRate && <Text style={styles.recordRate}> · {recordRate.value} {recordRate.caption === 'pace' ? '/km' : recordRate.caption}</Text>}
          </Text>
        )}
      </View>

      {distances.length > 1 && (
        <Segmented
          options={distances.map((d) => ({ key: d.key, label: d.label.replace('Meia maratona', 'Meia') }))}
          value={selected}
          onChange={setKey}
        />
      )}

      {trend.measured === 0 ? (
        <Text style={styles.empty}>Nenhuma corrida cobriu {distance.label} nos últimos {months} meses.</Text>
      ) : (
        <LineChart
          buckets={trend.buckets.map((b) => ({
            label: b.label,
            date: b.date,
            value: b.secs ?? 0,
            count: b.secs === null ? 0 : 1,
            empty: b.secs === null,
          }))}
          width={chartW}
          height={140}
          color={color}
          gaps
          reference={record ? { value: record.secs, label: `recorde ${formatClock(record.secs)}` } : undefined}
        />
      )}

      <Text style={styles.caption}>
        Mais baixo = mais rápido · um ponto por mês, o melhor daquele mês
        {trend.measured > 0 && ` · ${trend.measured} de ${months} meses com marca`}
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
      gap: spacing.sm,
      ...shadows.card,
    },
    head: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, flexWrap: 'wrap' },
    title: { fontSize: 13, fontFamily: fonts.sansSemiBold, color: colors.ink, flexShrink: 1 },
    record: { marginLeft: 'auto', fontSize: 11.5, fontFamily: fonts.sans, color: colors.ink3 },
    recordValue: { fontFamily: fonts.monoBold, color: colors.ink },
    recordRate: { fontFamily: fonts.mono, color: colors.ink2 },
    empty: { fontSize: 12, fontFamily: fonts.sans, color: colors.ink3, paddingVertical: spacing.md },
    caption: { fontSize: 10.5, fontFamily: fonts.sans, color: colors.ink3 },
  });
