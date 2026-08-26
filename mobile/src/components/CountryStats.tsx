import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { CountryStats as CountryStatsData } from '@vitale/shared';
import { formatDistance, formatDuration, formatElevation, formatSpeed } from '../lib/workout-format';
import { colors, fonts, radii, spacing, themed, useTheme } from '../theme';

const EVEREST_M = 8849;

function Tile({ value, label, caption }: { value: string; label: string; caption?: string | null }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

/**
 * Faixa de estatísticas agregadas do país (mesmos tiles da web). Os volumes já
 * chegam rateados pelo trecho dentro do país, daí o "aqui" nos rótulos de
 * máximo: numa pedalada que cruzou a fronteira, o número é o do trecho.
 */
export function CountryStats({ stats, cityCount }: { stats: CountryStatsData; cityCount: number }) {
  useTheme();
  const everestRatio = stats.elevationM / EVEREST_M;
  const everest =
    everestRatio >= 0.1
      ? `≈ ${everestRatio.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}× Everest`
      : null;

  const daysN = stats.movingTimeS / 86400;
  const days =
    daysN >= 0.1
      ? `≈ ${daysN.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${
          daysN.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) === '1' ? 'dia' : 'dias'
        }`
      : null;

  const speed = formatSpeed(stats.distanceM, stats.movingTimeS);

  return (
    <View style={styles.grid}>
      <Tile value={formatDistance(stats.distanceM) ?? '—'} label="Distância total" />
      <Tile value={formatElevation(stats.elevationM) ?? '—'} label="Subida total" caption={everest} />
      <Tile value={formatDuration(stats.movingTimeS)} label="Tempo pedalando" caption={days} />
      <Tile value={speed ? `${speed} km/h` : '—'} label="Velocidade média" />
      <Tile value={formatDistance(stats.longestRideM) ?? '—'} label="Maior trecho aqui" />
      <Tile value={formatElevation(stats.maxClimbM) ?? '—'} label="Maior subida aqui" />
      <Tile value={String(cityCount)} label="Cidades" />
      {stats.calories > 0 ? (
        <Tile value={`${Math.round(stats.calories).toLocaleString('pt-BR')} kcal`} label="Calorias" />
      ) : null}
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    tile: {
      flexGrow: 1,
      flexBasis: '30%',
      minWidth: 100,
      gap: 2,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radii.lg,
    },
    value: {
      fontSize: 20,
      fontFamily: fonts.sansBold,
      color: colors.ink,
      letterSpacing: -0.3,
      fontVariant: ['tabular-nums'],
    },
    label: { fontSize: 11, letterSpacing: 0.5, fontFamily: fonts.sansSemiBold, color: colors.ink3, textTransform: 'uppercase' },
    caption: { fontSize: 11, fontFamily: fonts.sansSemiBold, color: colors.primary, marginTop: 1 },
  }),
);
