import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, radii, shadows, spacing, useThemedStyles } from '../../theme';

/**
 * Seletor segmentado — período, métrica, distância.
 *
 * Vivia como função local da aba Histórico (e uma cópia no compositor de
 * compartilhamento). Saiu de lá quando um terceiro card precisou dele: a
 * terceira cópia seria o ponto em que as três começam a divergir.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = () =>
  StyleSheet.create({
    segmented: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceMute,
      borderRadius: radii.pill,
      padding: 3,
    },
    segment: {
      flex: 1,
      paddingVertical: spacing.sm,
      borderRadius: radii.pill,
      alignItems: 'center',
    },
    segmentActive: { backgroundColor: colors.surface, ...shadows.sm },
    segmentText: { fontSize: 12.5, color: colors.ink3, fontFamily: fonts.sansSemiBold },
    segmentTextActive: { color: colors.ink },
  });
