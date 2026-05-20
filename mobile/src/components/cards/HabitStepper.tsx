import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { CounterHabit } from '@vitale/shared';
import { colors, radii, MOD } from '../../theme';
import { isMet, isOver, progress } from '../../lib/habit-logic';

/** Formata número na unidade do hábito (vírgula decimal, sem zeros à toa). */
function fmt(n: number): string {
  const r = Math.round(n * 100) / 100;
  const s = Number.isInteger(r) ? String(r) : r.toFixed(2).replace(/\.?0+$/, '');
  return s.replace('.', ',');
}

function modColor(key: string): { tint: string; accent: string } {
  return (MOD as Record<string, { tint: string; accent: string }>)[key] ?? MOD.agua;
}

interface Props {
  habit: CounterHabit;
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
  onReset: () => void;
}

export function HabitStepper({ habit, value, onIncrement, onDecrement, onReset }: Props) {
  const mod = modColor(habit.color);
  const met = isMet(habit, value);
  const over = isOver(habit, value);
  const pct = progress(habit, value);
  const hasTarget = habit.target != null;

  // Cor de destaque: alerta (estourou o teto) em vermelho; senão a cor do módulo.
  const accent = over ? colors.primaryDeep : mod.accent;

  const widthAnim = useRef(new Animated.Value(pct)).current;
  useEffect(() => {
    Animated.timing(widthAnim, { toValue: pct, duration: 280, useNativeDriver: false }).start();
  }, [pct, widthAnim]);

  const haptic = (style: Haptics.ImpactFeedbackStyle) =>
    Haptics.impactAsync(style).catch(() => {});

  const onMinus = () => {
    haptic(Haptics.ImpactFeedbackStyle.Light);
    onDecrement();
  };
  const onPlus = () => {
    haptic(Haptics.ImpactFeedbackStyle.Light);
    onIncrement();
  };
  const onLongReset = () => {
    haptic(Haptics.ImpactFeedbackStyle.Medium);
    onReset();
  };

  const borderStyle = over
    ? { borderColor: accent, borderWidth: 1.5 }
    : met
    ? { borderColor: mod.accent, borderWidth: 1.5 }
    : { borderColor: colors.line, borderWidth: 1 };

  return (
    <View style={[styles.card, borderStyle]}>
      {/* − (long-press zera o dia) */}
      <Pressable
        onPress={onMinus}
        onLongPress={onLongReset}
        delayLongPress={450}
        hitSlop={6}
        style={({ pressed }) => [styles.btn, { backgroundColor: mod.tint }, pressed && styles.pressed]}
      >
        <Ionicons name="remove" size={22} color={mod.accent} />
      </Pressable>

      {/* centro: nome, valor/meta, progresso */}
      <View style={styles.center}>
        <View style={styles.titleRow}>
          <Ionicons name={(habit.icon || 'ellipse-outline') as never} size={15} color={accent} />
          <Text style={styles.name} numberOfLines={1}>
            {habit.name}
          </Text>
          {over ? (
            <Ionicons name="alert-circle" size={16} color={accent} />
          ) : met ? (
            <Ionicons name="checkmark-circle" size={16} color={mod.accent} />
          ) : null}
        </View>

        <Text style={styles.value}>
          {fmt(value)}
          {hasTarget && <Text style={styles.target}> / {fmt(habit.target as number)}</Text>}
          <Text style={styles.unit}> {habit.unit}</Text>
        </Text>

        {hasTarget && (
          <View style={styles.track}>
            <Animated.View
              style={[
                styles.fill,
                {
                  backgroundColor: accent,
                  width: widthAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
        )}
      </View>

      {/* ＋ */}
      <Pressable
        onPress={onPlus}
        hitSlop={6}
        style={({ pressed }) => [styles.btn, { backgroundColor: accent }, pressed && styles.pressed]}
      >
        <Ionicons name="add" size={24} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii['2xl'],
    padding: 12,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  btn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  center: { flex: 1, gap: 5 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flex: 1, fontSize: 13.5, fontWeight: '600', color: colors.ink },
  value: { fontSize: 20, fontWeight: '700', color: colors.ink, fontFamily: 'GeistMono' },
  target: { fontSize: 14, color: colors.ink3, fontWeight: '500' },
  unit: { fontSize: 13, color: colors.ink2 },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceMute,
    overflow: 'hidden',
  },
  fill: { height: 6, borderRadius: 3 },
});
