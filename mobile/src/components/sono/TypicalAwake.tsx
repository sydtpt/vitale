import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { SleepColors, TypicalAwakening } from '@vitale/shared';
import { colors, fonts, spacing, useThemedStyles } from '../../theme';

interface Props {
  typical: TypicalAwakening;
  palette: SleepColors;
  /** 'DD/MM' do dia do maior despertar — a tela decide o formato. */
  longestDay?: string;
}

/**
 * O despertar típico: três números e a fração de piscada.
 *
 * **O mínimo não está aqui, e é de propósito.** Ele vale `0,0` min em toda janela
 * do arquivo — é a resolução do aparelho, não um fato sobre a noite. No lugar
 * dele vai a fração abaixo de cinco minutos, que responde à mesma pergunta
 * ("quanto disso é ruído?") sem imprimir ruído como se fosse dado.
 *
 * A mediana é o número do meio porque a distribuição é torta: em agosto de 2026,
 * 56 dos 85 despertares ficaram abaixo de cinco minutos e a média (6,6 min) fica
 * três vezes acima da mediana (2 min). Mesmo motivo pelo qual o bloco de Sono
 * publica mediana de horas dormidas desde 06/09/2026.
 */
export function TypicalAwake({ typical, palette, longestDay }: Props) {
  const styles = useThemedStyles(createStyles);
  const { medianMin, p90Min, longest, brief, total } = typical;

  if (medianMin === null) {
    return (
      <Text style={styles.none}>
        {total === 0
          ? 'Nenhum despertar registrado nestas noites.'
          : `Os ${total} despertares ficaram todos abaixo de 5 minutos — o chão do aparelho.`}
      </Text>
    );
  }

  return (
    <View>
      <View style={styles.triple}>
        <Cell styles={styles} label="típico" value={Math.round(medianMin)} note="mediana" accent={palette.awake} />
        <Cell
          styles={styles}
          label="o longo"
          value={p90Min === null ? null : Math.round(p90Min)}
          note="1 em cada 10"
        />
        <Cell
          styles={styles}
          label="o maior"
          value={longest ? Math.round(longest.min) : null}
          note={longest && longestDay ? longestDay : '—'}
        />
      </View>
      <Text style={styles.foot}>
        {brief} dos {total} ficaram abaixo de 5 minutos — o piso do aparelho, não uma noite picada
      </Text>
    </View>
  );
}

type Styles = ReturnType<typeof createStyles>;

function Cell({
  styles, label, value, note, accent,
}: { styles: Styles; label: string; value: number | null; note: string; accent?: string }) {
  return (
    <View style={styles.cell}>
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={[styles.cellValue, accent ? { color: accent } : null]}>
        {value === null ? '—' : value}
        {value === null ? null : <Text style={styles.cellUnit}> min</Text>}
      </Text>
      <Text style={styles.cellNote}>{note}</Text>
    </View>
  );
}

const createStyles = () =>
  StyleSheet.create({
    triple: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
    cell: { flex: 1 },
    cellLabel: { fontSize: 11, color: colors.ink3, fontFamily: fonts.sans, marginBottom: 2 },
    cellValue: { fontSize: 24, fontFamily: fonts.mono, color: colors.ink, letterSpacing: -0.5 },
    cellUnit: { fontSize: 12, color: colors.ink3, fontFamily: fonts.sans },
    cellNote: { fontSize: 10.5, color: colors.ink4, fontFamily: fonts.sans, marginTop: 1 },
    foot: { fontSize: 11.5, lineHeight: 16, color: colors.ink3, fontFamily: fonts.sans, marginTop: spacing.sm },
    none: { fontSize: 12, color: colors.ink3, fontFamily: fonts.sans, marginTop: spacing.sm },
  });
