import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { CountrySummary } from '@vitale/shared';
import { colors, fonts, radii, spacing, themed, useTheme } from '../theme';

/** Grade de seleção de país (quando o tipo tem pedaladas em vários países). */
export function CountryPicker({
  countries,
  onSelect,
}: {
  countries: CountrySummary[];
  onSelect: (code: string) => void;
}) {
  useTheme();
  return (
    <View style={styles.grid}>
      {countries.map((c) => (
        <Pressable
          key={c.code}
          style={({ pressed }) => [styles.cell, pressed && styles.pressed]}
          onPress={() => onSelect(c.code)}
          accessibilityRole="button"
          accessibilityLabel={`Ver ${c.name}`}
        >
          <Text style={styles.flag}>{c.flag}</Text>
          <View style={styles.meta}>
            <Text style={styles.name} numberOfLines={1}>
              {c.name}
            </Text>
            <Text style={styles.count}>
              {c.rideCount} {c.rideCount === 1 ? 'pedalada' : 'pedaladas'}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    cell: {
      flexGrow: 1,
      flexBasis: '44%',
      minWidth: 150,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radii.xl,
    },
    pressed: { opacity: 0.7 },
    flag: { fontSize: 30, fontFamily: fonts.sans, lineHeight: 34 },
    meta: { flexShrink: 1 },
    name: { fontSize: 15, fontFamily: fonts.sansBold, color: colors.ink, letterSpacing: -0.2 },
    count: { fontSize: 12.5, fontFamily: fonts.sans, color: colors.ink3, marginTop: 2 },
  }),
);
