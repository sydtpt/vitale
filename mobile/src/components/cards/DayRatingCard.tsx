import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radii, shadows, spacing, useThemedStyles } from '../../theme';
import { RatingPills } from '../ui/RatingPills';

interface Props {
  value: number | null;
  note: string | null;
  /** Persiste a nota do dia (1–5) + anotação opcional. */
  onSubmit: (value: number, note: string | null) => void;
}

/**
 * Captura subjetiva do dia (fim do dia). Escala 1–5 + anotação livre opcional.
 * O gate de horário (≥ 22h) fica a cargo da tela que renderiza o card.
 */
export function DayRatingCard({ value, note, onSubmit }: Props) {
  const styles = useThemedStyles(createStyles);
  const [text, setText] = useState(note ?? '');

  const choose = (v: number) => {
    onSubmit(v, text.trim() ? text.trim() : null);
  };

  const commitNote = () => {
    if (value != null) onSubmit(value, text.trim() ? text.trim() : null);
  };

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Ionicons name="sparkles-outline" size={16} color={colors.primary} />
        <Text style={styles.title}>Como foi seu dia?</Text>
      </View>

      <RatingPills value={value} onSelect={choose} />

      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        onBlur={commitNote}
        placeholder="Anotação do dia… (opcional)"
        placeholderTextColor={colors.ink3}
        multiline
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
  input: {
    minHeight: 44,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceMute,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14, fontFamily: fonts.sans,
    color: colors.ink,
    textAlignVertical: 'top',
  },
});
