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
  variant = 'neutral',
}: {
  options: readonly { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  /**
   * `neutral` (padrão): o item ativo é a superfície sobre o trilho abafado —
   * seletor de leitura (período, métrica, distância). `brand`: o item ativo é
   * a marca — seletor de ação, como no compositor de compartilhamento. O texto
   * sobre a marca é `onPrimary`, não `#fff`: a marca "tinta" fica quase branca
   * no escuro, e branco cravado sumiria nela.
   */
  variant?: 'neutral' | 'brand';
}) {
  const styles = useThemedStyles(createStyles);
  const brand = variant === 'brand';
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
            style={[styles.segment, active && (brand ? styles.segmentBrand : styles.segmentActive)]}
          >
            <Text
              style={[
                styles.segmentText,
                active && (brand ? styles.segmentTextBrand : styles.segmentTextActive),
              ]}
            >
              {o.label}
            </Text>
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
    segmentBrand: { backgroundColor: colors.primary },
    segmentText: { fontSize: 12.5, color: colors.ink3, fontFamily: fonts.sansSemiBold },
    segmentTextActive: { color: colors.ink },
    segmentTextBrand: { color: colors.onPrimary },
  });
