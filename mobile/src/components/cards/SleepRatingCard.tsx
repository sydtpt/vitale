import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radii, shadows, spacing, useThemedStyles } from '../../theme';
import { RatingPills } from '../ui/RatingPills';

interface Props {
  /** Nota de hoje (1–5) ou null se ainda não preenchida. */
  value: number | null;
  onSelect: (value: number) => void;
}

/**
 * Captura da qualidade percebida do sono (ao acordar). Enquanto não há nota,
 * mostra a escala 1–5; depois colapsa num chip compacto que reabre ao toque.
 */
export function SleepRatingCard({ value, onSelect }: Props) {
  const styles = useThemedStyles(createStyles);
  const [editing, setEditing] = useState(false);
  const filled = value != null;

  if (filled && !editing) {
    return (
      <Pressable onPress={() => setEditing(true)} style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
        <Ionicons name="moon-outline" size={15} color={colors.blue} />
        <Text style={styles.chipText}>Sono</Text>
        <Text style={styles.chipValue}>{value}/5</Text>
        <Ionicons name="pencil-outline" size={13} color={colors.ink3} />
      </Pressable>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Ionicons name="moon-outline" size={16} color={colors.blue} />
        <Text style={styles.title}>Como foi seu sono?</Text>
      </View>
      <RatingPills
        value={value}
        onSelect={(v) => {
          onSelect(v);
          setEditing(false);
        }}
      />
    </View>
  );
}

const createStyles = () => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii['2xl'],
    padding: 14,
    marginTop: spacing.md,
    gap: 12,
    ...shadows.card,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 14.5, fontFamily: fonts.sansSemiBold, color: colors.ink },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginTop: spacing.md,
    ...shadows.card,
  },
  pressed: { opacity: 0.7 },
  chipText: { fontSize: 13, color: colors.ink2, fontFamily: fonts.sansSemiBold },
  chipValue: { fontSize: 13, color: colors.ink, fontFamily: fonts.monoBold },
});
