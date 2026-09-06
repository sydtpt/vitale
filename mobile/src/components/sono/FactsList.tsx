import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Fact } from '@vitale/shared';
import { colors, fonts, spacing, useThemedStyles } from '../../theme';

/**
 * As análises sob um gráfico — fatos, não notas. Medianas com faixa, contagens,
 * diferenças. Vêm prontas do núcleo (`facts.ts`); aqui só se listam.
 */
export function FactsList({ facts }: { facts: Fact[] }) {
  const styles = useThemedStyles(createStyles);
  if (facts.length === 0) return null;
  return (
    <View style={styles.list}>
      {facts.map((f) => (
        <View key={f.label} style={styles.row}>
          <Text style={styles.label}>{f.label}</Text>
          <Text style={styles.value}>{f.value}</Text>
        </View>
      ))}
    </View>
  );
}

const createStyles = () =>
  StyleSheet.create({
    list: { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.sm, gap: 7 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
    label: { flex: 1, fontSize: 12.5, color: colors.ink2, fontFamily: fonts.sans },
    value: { fontSize: 12.5, color: colors.ink, fontFamily: fonts.mono, textAlign: 'right', flexShrink: 0 },
  });
