import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  TRIGGER_MIN_PER_CELL,
  type SleepColors,
  type SleepTriggerBoard,
  type TriggerReach,
  type TriggerReading,
} from '@vitale/shared';
import { colors, fonts, spacing, useThemedStyles } from '../../theme';

interface Props {
  board: SleepTriggerBoard;
  palette: SleepColors;
}

/** "dorme 33 min a menos" — a frase é do sinal, não de um juízo sobre ele. */
function phraseOf(r: TriggerReading): string {
  const d = r.delta ?? 0;
  const n = Math.round(Math.abs(d));
  if (r.metric === 'onset') return `deita ${n} min mais ${d > 0 ? 'tarde' : 'cedo'}`;
  if (r.metric === 'asleep') return `dorme ${n} min a ${d > 0 ? 'mais' : 'menos'}`;
  const pt = Math.abs(d).toFixed(2).replace('.', ',');
  return `acorda ${pt} ponto ${d > 0 ? 'acima' : 'abaixo'}`;
}

const signed = (v: number, dec = 0) =>
  `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(dec).replace('.', ',')}`;

/**
 * O que precedeu a noite — esporte, hábito, registro — sob a regra das duas
 * colunas (`sleep/triggers.ts`).
 *
 * Três blocos, e a separação entre o segundo e o terceiro é o ponto da peça:
 *
 * 1. **O que fala** — passou a regra. Cada linha mostra as duas colunas, porque
 *    é a concordância entre elas que sustenta a leitura, e escondê-la deixaria
 *    o número parecendo mais firme do que é.
 * 2. **O que ainda não dá para dizer** — a régua de alcance, com quanto falta.
 * 3. **O que já tem noites e mesmo assim não diz nada** — medido e sem efeito.
 *
 * Juntar 2 e 3 seria o erro: *"não tem efeito"* e *"não tem dado"* são coisas
 * opostas, e uma tela muda não as separa. A Retrospectiva é jornal — informa,
 * não aconselha —, então nada aqui vira recomendação, e o `n` anda junto do
 * número. Ver ADR 0044.
 */
export function SleepTriggers({ board, palette }: Props) {
  const styles = useThemedStyles(createStyles);
  const { readings, pending, silent } = board;

  if (readings.length === 0 && pending.length === 0 && silent.length === 0) return null;

  return (
    <View>
      {readings.length > 0 && (
        <View style={styles.group}>
          {readings.map((r) => (
            <View key={`${r.id}:${r.metric}`} style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={styles.name} numberOfLines={1}>{r.label}</Text>
                <Text style={styles.phrase}>{phraseOf(r)}</Text>
              </View>
              <Text style={styles.cells}>
                {r.cells
                  .map((c) => `${c.column} ${signed(c.delta ?? 0, r.metric === 'rating' ? 2 : 0)}`)
                  .join('  ·  ')}
              </Text>
            </View>
          ))}
          <Text style={styles.rule}>
            só sai quando a noite de trabalho e a de folga concordam no sinal — sem isso o
            cruzamento mede o calendário, não o gatilho
          </Text>
        </View>
      )}

      {pending.length > 0 && (
        <View style={styles.group}>
          <Text style={styles.groupTitle}>O que ainda não dá para dizer</Text>
          <Text style={styles.groupSub}>
            a leitura abre com {TRIGGER_MIN_PER_CELL} noites de cada tipo
          </Text>
          {pending.map((p) => (
            <ReachRow key={p.id} reach={p} palette={palette} styles={styles} />
          ))}
        </View>
      )}

      {silent.length > 0 && (
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Medidos, e sem efeito</Text>
          <Text style={styles.groupSub}>
            {silent.map((s) => `${s.label} (${s.nights})`).join(' · ')}
          </Text>
        </View>
      )}
    </View>
  );
}

type Styles = ReturnType<typeof createStyles>;

function ReachRow({ reach, palette, styles }: { reach: TriggerReach; palette: SleepColors; styles: Styles }) {
  const have = Math.min(reach.presa, reach.livre);
  const frac = Math.min(1, have / TRIGGER_MIN_PER_CELL);
  return (
    <View style={styles.reach}>
      <Text style={styles.reachName} numberOfLines={1}>{reach.label}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.max(4, frac * 100)}%`, backgroundColor: palette.sleep }]} />
      </View>
      <Text style={styles.reachN}>
        {reach.missing === 1 ? 'falta 1' : `faltam ${reach.missing}`}
      </Text>
    </View>
  );
}

const createStyles = () =>
  StyleSheet.create({
    group: { marginTop: spacing.md },
    groupTitle: { fontSize: 12.5, fontFamily: fonts.sansSemiBold, color: colors.ink },
    groupSub: { fontSize: 11, color: colors.ink3, fontFamily: fonts.sans, marginBottom: 6 },
    row: { paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.line },
    rowMain: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
    name: { flexShrink: 1, fontSize: 13, fontFamily: fonts.sansSemiBold, color: colors.ink },
    phrase: { fontSize: 12.5, fontFamily: fonts.mono, color: colors.ink2 },
    cells: { fontSize: 10.5, fontFamily: fonts.mono, color: colors.ink4, marginTop: 2 },
    rule: { fontSize: 11, lineHeight: 15.5, color: colors.ink3, fontFamily: fonts.sans, marginTop: 8 },
    reach: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
    reachName: { width: 96, fontSize: 12, fontFamily: fonts.sans, color: colors.ink2 },
    track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.line, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: 3, opacity: 0.6 },
    reachN: { width: 56, textAlign: 'right', fontSize: 10.5, fontFamily: fonts.mono, color: colors.ink3 },
  });
