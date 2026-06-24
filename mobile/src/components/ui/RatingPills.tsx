import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, radii, useThemedStyles } from '../../theme';

/** Cor graduada 1→5 (ruim → bom): vermelho, laranja, amarelo, verde-claro, verde. */
const SCALE_COLORS = ['#E05C5C', '#F2873C', '#F5B946', '#9CC06A', '#6FA86A'];

interface Props {
  /** Valor selecionado (1–5) ou null se ainda não escolhido. */
  value: number | null;
  onSelect: (value: number) => void;
}

/** Escala 1–5 em pílulas numeradas, com cor graduada e haptic leve ao tocar. */
export function RatingPills({ value, onSelect }: Props) {
  const styles = useThemedStyles(createStyles);

  const handle = (v: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onSelect(v);
  };

  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((v) => {
        const selected = value === v;
        const accent = SCALE_COLORS[v - 1];
        return (
          <Pressable
            key={v}
            onPress={() => handle(v)}
            hitSlop={4}
            style={({ pressed }) => [
              styles.pill,
              selected
                ? { backgroundColor: accent, borderColor: accent }
                : { backgroundColor: colors.surfaceMute, borderColor: colors.line },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.num, selected ? styles.numOn : styles.numOff]}>{v}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = () => StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  pill: {
    flex: 1,
    height: 44,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  num: { fontSize: 17, fontWeight: '700', fontFamily: 'GeistMono' },
  numOn: { color: '#fff' },
  numOff: { color: colors.ink3 },
});
