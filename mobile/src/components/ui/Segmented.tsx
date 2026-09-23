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
    /**
     * **A fatia é quinta parte da faixa; o rótulo quebra dentro dela.**
     *
     * Medido com o Yoga (o mesmo motor da RN) nos 336 pt úteis de um iPhone 17 Pro:
     * com o Texto grande no máximo (AX XXXL, ×3,571 — a tabela dos multiplicadores é
     * a do `RCTAccessibilityManager`), "última" pede 150 pt numa fatia de 66, e a
     * faixa passa de 39 para 203 pt de altura. **Crescer em altura é o certo** — é o
     * eixo que sobra, e a fatia nunca teve `height`, só `paddingVertical`. Encurtar
     * a fonte ou cortar com `numberOfLines` seria cortar mais bonito.
     *
     * O que estava errado era o **alinhamento**: `alignItems: 'center'` dá ao `Text`
     * a largura que ele mediu, não a da fatia, e as linhas quebradas ficam alinhadas
     * à esquerda dentro de um bloco centrado — a faixa vira a sopa de letras que o
     * dono fotografou em 23/09. Esticado (o padrão, por isso sem `alignItems`) o
     * `Text` recebe a largura da fatia, e `textAlign` centra **cada linha**. No
     * tamanho normal, com uma linha só, nada muda de aparência.
     *
     * `minWidth: 0` é o par do `flex: 1`, escrito para quem vier depois: a fatia pode
     * descer abaixo do conteúdo, e é por isso que a faixa nunca estica.
     */
    segment: {
      flex: 1,
      minWidth: 0,
      paddingVertical: spacing.sm,
      borderRadius: radii.pill,
    },
    segmentActive: { backgroundColor: colors.surface, ...shadows.sm },
    segmentBrand: { backgroundColor: colors.primary },
    segmentText: { fontSize: 12.5, color: colors.ink3, fontFamily: fonts.sansSemiBold, textAlign: 'center' },
    segmentTextActive: { color: colors.ink },
    segmentTextBrand: { color: colors.onPrimary },
  });
