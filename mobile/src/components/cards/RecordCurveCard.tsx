import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Activity } from '@vitale/shared';
import { bestEffortCurve, formatPace, formatSpeed } from '@vitale/shared';
import { CurveChart } from '../charts/CurveChart';
import { formatClock, formatDateLabel } from '../../lib/workout-format';
import { colors, fonts, radii, shadows, spacing, useThemedStyles } from '../../theme';

const RIDE = 13;

/**
 * A curva de recordes: a melhor marca em cada distância, num eixo só.
 *
 * Uma leitura responde o que oito cards em carrossel não respondem — se você é
 * forte no curto e cai no longo, ou o contrário. Corrida lê ritmo (mais baixo =
 * mais rápido); pedal lê velocidade (mais alto = mais rápido). O x é log: em
 * escala linear 1 km e 5 km ficariam colados num canto e a maratona sozinha.
 *
 * É um **envelope de melhores marcas**, não um teste: o 1 km pode ser de um
 * tiro em março e o 21 km de uma prova em setembro. O rótulo diz isso, e o
 * toque no ponto diz de quando é cada um — o "quando fiz" pedido.
 */
export function RecordCurveCard({
  activities,
  sportId,
  color,
  onPick,
}: {
  activities: Activity[];
  sportId: number;
  color: string;
  /** Abre a corrida que detém a marca tocada. */
  onPick?: (activityId: string) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { width } = useWindowDimensions();
  const chartW = Math.max(0, width - spacing.lg * 4);
  const isRide = sportId === RIDE;

  const curve = useMemo(() => bestEffortCurve(activities, sportId), [activities, sportId]);
  const [selected, setSelected] = useState<string | null>(null);

  // Uma marca só é um ponto, não uma curva.
  if (curve.length < 2) return null;

  // Pedal: km/h, mais alto é melhor. Corrida: s/km, mais baixo é melhor.
  const yOf = (secPerKm: number) => (isRide ? 3600 / secPerKm : secPerKm);
  const formatY = (v: number) =>
    isRide ? `${v.toFixed(0)} km/h` : (formatPace(1000, v) ?? '—');

  const points = curve.map((p) => ({
    key: p.key,
    label: p.label.replace('Meia maratona', 'Meia').replace('Maratona', '42'),
    x: p.meters,
    y: yOf(p.secPerKm),
  }));
  const picked = curve.find((p) => p.key === selected) ?? null;
  const pickedRate = picked
    ? isRide
      ? `${formatSpeed(picked.meters, picked.secs)} km/h`
      : `${formatPace(picked.meters, picked.secs)} /km`
    : null;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>Curva de recordes</Text>
        <Text style={styles.sub}>{isRide ? 'mais alto = mais rápido' : 'mais baixo = mais rápido'}</Text>
      </View>

      <CurveChart
        points={points}
        width={chartW}
        color={color}
        logX
        formatY={formatY}
        selectedKey={selected}
        onSelect={(k) => setSelected((prev) => (prev === k ? null : k))}
      />

      {/* A leitura fica: nada some quando o dedo sai. */}
      <Pressable
        disabled={!picked || !onPick}
        onPress={() => picked && onPick?.(picked.id)}
        style={({ pressed }) => [styles.readout, pressed && styles.pressed]}
      >
        {picked ? (
          <>
            <Text style={styles.readoutK}>
              {picked.label} · <Text style={styles.readoutV}>{formatClock(picked.secs)}</Text> · {pickedRate}
            </Text>
            <Text style={styles.readoutDate}>{formatDateLabel(picked.startAt)}</Text>
            {onPick && <Ionicons name="chevron-forward" size={14} color={colors.ink3} />}
          </>
        ) : (
          <Text style={styles.readoutK}>toque num ponto · {curve.length} distâncias com marca</Text>
        )}
      </Pressable>

      <Text style={styles.caption}>
        Envelope das melhores marcas — cada ponto pode ser de uma corrida diferente, não é um teste único.
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
    head: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
    title: { fontSize: 13, fontFamily: fonts.sansSemiBold, color: colors.ink },
    sub: { marginLeft: 'auto', fontSize: 10.5, fontFamily: fonts.sans, color: colors.ink3 },
    readout: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surfaceMute,
      borderRadius: 10,
      paddingHorizontal: 11,
      paddingVertical: 8,
      minHeight: 34,
    },
    pressed: { opacity: 0.7 },
    readoutK: { flex: 1, fontSize: 11.5, fontFamily: fonts.sans, color: colors.ink2 },
    readoutV: { fontFamily: fonts.monoBold, color: colors.ink },
    readoutDate: { fontSize: 11, fontFamily: fonts.sans, color: colors.ink3 },
    caption: { fontSize: 10.5, fontFamily: fonts.sans, color: colors.ink3 },
  });
