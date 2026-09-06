import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  DURATION_FULL_H,
  SCORE_COVERAGE_FLOOR,
  coverageNote,
  filterByRange,
  periodScore,
  rangeBounds,
  rangeNights,
  type SonoRange,
} from '@vitale/shared';
import { useSonoStore } from '../../store/sono.store';
import { PeriodNav } from '../../components/sono/PeriodNav';
import { SleepScoreDims } from '../../components/sono/SleepScoreDims';
import { HeaderSpacer } from '../../components/ui/HeaderSpacer';
import { colors, fonts, radii, shadows, sleepColors, spacing, useThemedStyles } from '../../theme';

/**
 * /sono/saude — a saúde do sono do período, em cinco dimensões contadas.
 *
 * É a tela que a proposta de 06/09/2026 pediu, e ela existe **separada da noite**
 * por um motivo de definição: regularidade é uma relação entre noites, não uma
 * propriedade de uma. A noite conta quatro dimensões; o período conta cinco. Não
 * há como o cartão da aba mostrar a quinta, e é isso que dá sentido a esta tela.
 *
 * O que ela recusa: seta de tendência, comparação com período anterior em forma
 * de "melhorou", meta e streak. A contagem de um período ao lado da de outro é o
 * usuário quem faz, navegando — o app não conclui por ele (ADR 0036).
 *
 * Abaixo do piso de cobertura a contagem some e as medidas ficam. No histórico
 * real isto é o caso comum, não a exceção: 14 dos 18 meses estão abaixo.
 */
export default function SonoSaudeScreen() {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const sc = sleepColors();

  const periods = useSonoStore((s) => s.periods);
  const ratings = useSonoStore((s) => s.sleepRatings);
  const loaded = useSonoStore((s) => s.loaded);
  const load = useSonoStore((s) => s.load);
  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  // Começa em 7 dias, não em "última": a quinta dimensão é a razão desta tela
  // existir, e ela precisa de noites seguidas. "Última" continua no seletor e
  // degrada sozinha — uma noite só sai com regularidade não medida, que é a
  // verdade, e é o mesmo que o cartão da aba mostra.
  const [range, setRange] = useState<SonoRange>('7d');
  const [offset, setOffset] = useState(0);

  const today = useMemo(() => new Date(), []);
  const nights = useMemo(() => filterByRange(periods, range, today, offset), [periods, range, offset, today]);
  const expected = useMemo(() => rangeNights(range, today, offset), [range, offset, today]);

  const score = useMemo(() => {
    const { since } = rangeBounds(range, today, offset);
    // A linha de base olha para **antes** do período: se o período se comparasse
    // consigo mesmo, a continuidade seria sempre a própria mediana e a dimensão
    // não diria nada.
    const history = since === null ? periods : periods.filter((p) => p.wakeDay < since);
    return periodScore(nights, expected, ratings, history);
  }, [nights, expected, ratings, periods, range, offset, today]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Saúde do sono</Text>
        <HeaderSpacer />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <PeriodNav
            range={range}
            offset={offset}
            periods={periods}
            nights={nights}
            onRange={(r) => {
              setRange(r);
              setOffset(0);
            }}
            onOffset={setOffset}
          />

          <SleepScoreDims
            score={score}
            palette={sc}
            note={coverageNote(score) ?? undefined}
          />

          {!score.scored && score.coverage !== null && score.coverage.nights > 0 && (
            <Text style={styles.warn}>
              Abaixo de {Math.round(SCORE_COVERAGE_FLOOR * 100)}% das noites, uma contagem seria sobre
              as noites que o relógio conseguiu gravar — não sobre o período.
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>De onde vem cada linha</Text>
          <Legend
            label="Duração"
            text={`Dois traços a partir de ${DURATION_FULL_H} h — o consenso da AASM e da Sleep Research Society (2015).`}
            styles={styles}
          />
          <Legend
            label="Continuidade"
            text="Tempo acordado, comparado com as suas 30 noites anteriores. É relativo de propósito: a troca de relógio em julho derrubou a sua vigília mediana de 71 para 13 minutos sem você mudar nada."
            styles={styles}
          />
          <Legend
            label="Horário"
            text="Quanto o meio das suas noites se espalha dentro do período. Uma semana inteira deslocada, mas coerente consigo, não é desordem."
            styles={styles}
          />
          <Legend
            label="Regularidade"
            text="O índice que compara o seu estado agora com o de 24 h atrás, minuto a minuto. É a medida com a melhor evidência de desfecho que existe, e só roda em noites seguidas."
            styles={styles}
          />
          <Legend
            label="Percepção"
            text="A nota que você deu ao acordar. É a única dimensão que nenhum aparelho tem — e nas suas noites é a duração que mais anda junto com ela."
            styles={styles}
            last
          />
        </View>

        <Text style={styles.note}>
          Não é diagnóstico, e não é comparação com outras pessoas. Estágios de sono ficam de fora
          da contagem por decisão: nas suas noites, a fração de sono profundo cai quando você dorme
          mais, então pontuá-la seria premiar noite curta.
        </Text>
      </ScrollView>
    </View>
  );
}

type Styles = ReturnType<typeof createStyles>;

function Legend({ label, text, styles, last }: { label: string; text: string; styles: Styles; last?: boolean }) {
  return (
    <View style={[styles.legendRow, last && styles.noBorder]}>
      <Text style={styles.legendLabel}>{label}</Text>
      <Text style={styles.legendText}>{text}</Text>
    </View>
  );
}

const createStyles = () =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: spacing.lg, paddingBottom: spacing.xl * 2, gap: spacing.md },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    backBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radii.md },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontFamily: fonts.sansBold, color: colors.ink },
    pressed: { opacity: 0.7 },

    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.line,
      ...shadows.card,
    },
    cardTitle: { fontSize: 15, fontFamily: fonts.sansBold, color: colors.ink, marginBottom: spacing.sm },
    warn: { marginTop: spacing.md, fontSize: 12, lineHeight: 17, color: colors.ink3, fontFamily: fonts.sans },

    legendRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line, gap: 2 },
    noBorder: { borderBottomWidth: 0, paddingBottom: 0 },
    legendLabel: { fontSize: 12.5, fontFamily: fonts.sansSemiBold, color: colors.ink },
    legendText: { fontSize: 12.5, lineHeight: 18, color: colors.ink2, fontFamily: fonts.sans },

    note: { fontSize: 12, lineHeight: 17.5, color: colors.ink3, fontFamily: fonts.sans, paddingHorizontal: 4 },
  });
