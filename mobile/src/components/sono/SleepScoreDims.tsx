import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { SleepColors, SleepDimension, SleepScore } from '@vitale/shared';
import { colors, fonts, spacing, useThemedStyles } from '../../theme';

interface Props {
  score: SleepScore;
  palette: SleepColors;
  /** Esconde o total — usado onde a cobertura não sustenta a contagem. */
  hideTally?: boolean;
  /** Frase sob o total (cobertura, ou o lembrete de que a noite não tem regularidade). */
  note?: string;
}

/**
 * As cinco linhas da saúde do sono: rótulo, dois traços e o fato cru.
 *
 * O desenho carrega três decisões do review de 06/09/2026, e nenhuma é estética:
 *
 * 1. **O fato fica ao lado do preenchimento, sempre.** É o que deixa discordar
 *    de um ponto sem descartar as outras dimensões — e o que impede a linha de
 *    virar "confie em mim".
 * 2. **Preenchido é azul de sono, vazio é linha.** Sem verde-amarelo-vermelho:
 *    semáforo é juízo, e a tela não julga (ADR 0036).
 * 3. **Dimensão não medida não é dimensão zerada.** Ela sai apagada, com o
 *    motivo escrito, e não conta no denominador — que por isso encolhe.
 */
export function SleepScoreDims({ score, palette, hideTally, note }: Props) {
  const styles = useThemedStyles(createStyles);
  const show = !hideTally && score.scored;

  return (
    <View>
      <View style={styles.dims}>
        {score.dimensions.map((d) => (
          <DimRow key={d.key} dim={d} palette={palette} styles={styles} />
        ))}
      </View>

      <View style={styles.rule} />

      {show ? (
        <View style={styles.tally}>
          <Text style={styles.tallyValue}>
            {score.points}
            <Text style={styles.tallyMax}>/{score.max}</Text>
          </Text>
          {note ? <Text style={styles.tallyNote}>{note}</Text> : null}
        </View>
      ) : (
        note && <Text style={styles.tallyNote}>{note}</Text>
      )}
    </View>
  );
}

type Styles = ReturnType<typeof createStyles>;

function DimRow({ dim, palette, styles }: { dim: SleepDimension; palette: SleepColors; styles: Styles }) {
  const absent = dim.points === null;
  return (
    <View style={styles.row}>
      <Text style={[styles.label, absent && styles.faded]} numberOfLines={1}>
        {dim.label}
      </Text>
      <View style={styles.pips}>
        {[0, 1].map((i) => (
          <View
            key={i}
            style={[
              styles.pip,
              { backgroundColor: (dim.points ?? 0) > i ? palette.sleep : colors.line },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.fact, absent && styles.faded]} numberOfLines={1}>
        {absent ? (dim.absent ?? '—') : dim.fact}
      </Text>
    </View>
  );
}

const createStyles = () =>
  StyleSheet.create({
    dims: { gap: 9, marginTop: spacing.sm },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    label: { width: 92, fontSize: 12.5, fontFamily: fonts.sansSemiBold, color: colors.ink },
    faded: { color: colors.ink3 },
    pips: { flex: 1, flexDirection: 'row', gap: 3 },
    pip: { flex: 1, height: 7, borderRadius: 4 },
    fact: {
      // `flexShrink` e não largura fixa: "precisa de 5 noites seguidas" é longo,
      // e cortar o motivo seria pior do que cortar o número que não existe.
      flexShrink: 1,
      maxWidth: '46%',
      textAlign: 'right',
      fontSize: 11.5,
      fontFamily: fonts.mono,
      color: colors.ink2,
    },
    rule: { height: 1, backgroundColor: colors.line, marginVertical: spacing.md },
    tally: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
    tallyValue: { fontSize: 32, fontFamily: fonts.mono, color: colors.ink, letterSpacing: -1 },
    tallyMax: { fontSize: 16, color: colors.ink3 },
    tallyNote: { flex: 1, fontSize: 11.5, lineHeight: 16, color: colors.ink3, fontFamily: fonts.sans },
  });
