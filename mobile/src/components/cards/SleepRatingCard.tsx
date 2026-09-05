import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { lineText, nightLine, type LinePart, type SleepPeriod } from '@vitale/shared';
import { colors, fonts, radii, shadows, spacing, useThemedStyles } from '../../theme';
import { RatingPills } from '../ui/RatingPills';

interface Props {
  /** Nota de hoje (1–5) ou null se ainda não preenchida. */
  value: number | null;
  onSelect: (value: number) => void;
  /**
   * A noite medida que acordou hoje, ou null enquanto não há. Só aparece com a
   * nota dada — nunca no card de captura, para o relógio não puxar a resposta
   * (spec Sono CAP-8).
   */
  night?: SleepPeriod | null;
  /** Toque no bloco da noite — abre `/sono/[day]`. */
  onNightPress?: () => void;
}

/**
 * Captura da qualidade percebida do sono (ao acordar). Enquanto não há nota,
 * mostra a escala 1–5; depois colapsa num chip compacto que reabre ao toque.
 *
 * Com a nota dada, a mesma linha ganha a **medição** à direita: percepção de um
 * lado (o chip), medição do outro — `01:26 → 08:39` e `3 despertares · 8 min`,
 * duas linhas de 16 pt dentro dos 36 pt do chip. Só tinta: número em mono
 * `ink`, palavra em `ink2`; nenhuma cor de sono, porque o bloco é legenda, não
 * gráfico. O texto nasce em `nightLine()` no núcleo; aqui só se pinta.
 */
export function SleepRatingCard({ value, onSelect, night, onNightPress }: Props) {
  const styles = useThemedStyles(createStyles);
  const [editing, setEditing] = useState(false);
  const filled = value != null;

  if (filled && !editing) {
    const line = night ? nightLine(night) : null;
    return (
      <View style={styles.row}>
        <Pressable onPress={() => setEditing(true)} style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
          <Ionicons name="moon-outline" size={15} color={colors.blue} />
          <Text style={styles.chipText}>Sono</Text>
          <Text style={styles.chipValue}>{value}/5</Text>
          <Ionicons name="pencil-outline" size={13} color={colors.ink3} />
        </Pressable>
        {line && (
          <Pressable
            onPress={onNightPress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Noite medida: ${lineText(line.clocks)}${line.awake ? `, ${lineText(line.awake)}` : ''}. Abre o detalhe da noite.`}
            style={({ pressed }) => [styles.facts, pressed && styles.pressed]}
          >
            <Line parts={line.clocks} styles={styles} />
            {line.awake && <Line parts={line.awake} styles={styles} />}
          </Pressable>
        )}
      </View>
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

type Styles = ReturnType<typeof createStyles>;

/** Uma linha do bloco: cada parte com a fonte do seu tipo, o resto herdado. */
function Line({ parts, styles }: { parts: LinePart[]; styles: Styles }) {
  return (
    <Text style={styles.line} numberOfLines={1}>
      {parts.map((p, i) => (
        <Text key={i} style={p.kind === 'num' ? styles.num : p.kind === 'sym' ? styles.sym : styles.word}>
          {p.text}
        </Text>
      ))}
    </Text>
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
  // A linha: o chip à esquerda, a noite à direita, centrados na altura do chip.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
    ...shadows.card,
  },
  pressed: { opacity: 0.7 },
  chipText: { fontSize: 13, color: colors.ink2, fontFamily: fonts.sansSemiBold },
  chipValue: { fontSize: 13, color: colors.ink, fontFamily: fonts.monoBold },
  // Sem casca: o chip continua sendo o único objeto da linha e o bloco lê como
  // legenda dele. `marginLeft: auto` encosta no limite direito do conteúdo,
  // como os valores das linhas da aba Sono.
  facts: { marginLeft: 'auto', alignItems: 'flex-end', flexShrink: 1 },
  line: { fontSize: 12, lineHeight: 16 },
  num: { fontFamily: fonts.mono, color: colors.ink },
  sym: { fontFamily: fonts.mono, color: colors.ink2 },
  word: { fontFamily: fonts.sans, color: colors.ink2 },
});
