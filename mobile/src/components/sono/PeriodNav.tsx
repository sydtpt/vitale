import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SONO_RANGES, hasNights, rangeLabel, type SleepPeriod, type SonoRange } from '@vitale/shared';
import { Segmented } from '../ui/Segmented';
import { colors, fonts, spacing, useThemedStyles } from '../../theme';

interface Props {
  range: SonoRange;
  offset: number;
  /** Todas as noites conhecidas — é o que decide se o ◀ acende. */
  periods: SleepPeriod[];
  /** As noites da janela corrente, para o rótulo de "última". */
  nights: SleepPeriod[];
  onRange: (r: SonoRange) => void;
  onOffset: (o: number) => void;
}

const OPTIONS = SONO_RANGES.map((r) => ({ key: r.id, label: r.label }));

/**
 * O seletor de período das subviews de sono: o `Segmented` do Histórico (não um
 * primo) mais a navegação ◀ ▶ — um período do próprio tamanho para trás ou para
 * a frente, e o ◀ só acende onde há noite. Trocar o período volta ao corrente.
 */
export function PeriodNav({ range, offset, periods, nights, onRange, onOffset }: Props) {
  const styles = useThemedStyles(createStyles);
  const canBack = hasNights(periods, range, new Date(), offset + 1);
  const canFwd = offset > 0;
  return (
    <View>
      <Segmented
        options={OPTIONS}
        value={range}
        onChange={(r) => {
          onRange(r);
          onOffset(0);
        }}
      />
      <View style={styles.navRow}>
        <Pressable onPress={() => canBack && onOffset(offset + 1)} disabled={!canBack} hitSlop={10} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={18} color={canBack ? colors.ink : colors.ink4} />
        </Pressable>
        <Text style={styles.navLabel}>{rangeLabel(range, nights, new Date(), offset)}</Text>
        <Pressable onPress={() => canFwd && onOffset(offset - 1)} disabled={!canFwd} hitSlop={10} style={styles.navBtn}>
          <Ionicons name="chevron-forward" size={18} color={canFwd ? colors.ink : colors.ink4} />
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = () =>
  StyleSheet.create({
    navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
    navBtn: { width: 34, height: 30, alignItems: 'center', justifyContent: 'center' },
    navLabel: { fontSize: 12.5, fontFamily: fonts.mono, color: colors.ink2 },
  });
