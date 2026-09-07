import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { AlignmentTest, AwakeAlignment, SleepColors } from '@vitale/shared';
import { colors, fonts, spacing, useThemedStyles } from '../../theme';

interface Props {
  alignment: AwakeAlignment;
  palette: SleepColors;
  /** 'MMM/AA' dos extremos da janela — a tela formata. */
  fromLabel: string;
  toLabel: string;
}

const clock = (h: number) => `${String(h).padStart(2, '0')}h`;
const since = (h: number) => (h === 0 ? 'a 1ª meia hora' : `+${h}h`);

/**
 * Relógio ou corpo — a peça que responde *"tem algo me acordando na mesma hora?"*.
 *
 * Dois alinhamentos dos **mesmos** despertares, cada um contra o que o acaso
 * daria. Uma causa externa (trem, avião, vizinho) fica presa ao relógio de
 * parede; uma causa interna fica presa ao seu sono. A que subir acima do acaso
 * é a que explica — e quando nenhuma sobe, isso também é resposta.
 *
 * A linha do acaso **não é uniforme**: às 4h ele quase sempre está dormindo,
 * então é claro que há mais despertares ali. O esperado sai de espalhar os
 * despertares de cada noite dentro daquela noite. Sem esse denominador o
 * gráfico mede o relógio, não a pessoa.
 *
 * Ver `awake-shape.ts` para o teste e para por que a primeira hora de sono sai
 * do eixo do relógio.
 */
export function AwakeAlignmentView({ alignment, palette, fromLabel, toLabel }: Props) {
  const styles = useThemedStyles(createStyles);
  const { clock: cl, since: si } = alignment;

  return (
    <View>
      <Text style={styles.sub}>
        {alignment.events} despertares de {alignment.nights} noites · {fromLabel} a {toLabel}
      </Text>

      <Lane
        styles={styles}
        title="Pelo relógio de parede"
        hint="descontada a 1ª hora de sono"
        test={cl}
        color={palette.awake}
        format={clock}
        verdict={
          cl.significant && cl.peak
            ? `a noite quebra mais por volta de ${clock(cl.peak.from)} — ${cl.peak.observed} contra ${Math.round(cl.peak.expected)} que o acaso daria`
            : cl.peak
              ? `nada se repete: a hora mais carregada, ${clock(cl.peak.from)}, tem ${cl.peak.observed} despertares e o acaso daria ${Math.round(cl.peak.expected)}`
              : 'sem faixa com noites suficientes'
        }
      />

      <Lane
        styles={styles}
        title="Desde que você apagou"
        hint="faixas de meia hora"
        test={si}
        color={palette.sleep}
        format={since}
        verdict={
          si.significant && si.peak
            ? `${si.peak.observed} despertares em ${since(si.peak.from)} contra ${Math.round(si.peak.expected)} esperados — ${si.peak.ratio.toFixed(1).replace('.', ',')}× o acaso`
            : 'espalhados pela noite, como o acaso daria'
        }
      />

      <Text style={styles.close}>
        {cl.significant
          ? 'Há uma hora do relógio que se repete acima do acaso.'
          : si.significant
            ? 'Nenhuma hora do relógio te acorda. O que quebra a sua noite acompanha o seu sono, não a rua.'
            : 'Nem o relógio nem o sono explicam — os despertares caem espalhados.'}
      </Text>
    </View>
  );
}

type Styles = ReturnType<typeof createStyles>;

/** Uma pista: as barras do observado e a linha do acaso por cima. */
function Lane({
  styles, title, hint, test, color, format, verdict,
}: {
  styles: Styles; title: string; hint: string; test: AlignmentTest;
  color: string; format: (n: number) => string; verdict: string;
}) {
  // Escala comum às barras e à linha, senão a comparação visual mente.
  const top = Math.max(1, ...test.bins.map((b) => Math.max(b.observed, b.expected)));
  // Só as faixas com alguma exposição: as horas em que ele nunca dorme são vão,
  // não zero, e desenhá-las achataria o resto do gráfico.
  const shown = test.bins.filter((b) => b.expected >= 0.5 || b.observed > 0);
  const peakAt = test.peak?.from;

  return (
    <View style={styles.lane}>
      <View style={styles.laneHead}>
        <Text style={styles.laneTitle}>{title}</Text>
        <Text style={styles.laneHint}>{hint}</Text>
      </View>
      <View style={styles.bars}>
        {shown.map((b) => {
          const isPeak = b.from === peakAt;
          return (
            <View key={b.from} style={styles.col}>
              <View style={styles.track}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: Math.max(1, (b.observed / top) * BAR_H),
                      backgroundColor: color,
                      opacity: isPeak ? 1 : 0.55,
                    },
                  ]}
                />
                {/* o acaso: um traço na altura esperada, sobre a barra */}
                <View style={[styles.chance, { bottom: (b.expected / top) * BAR_H }]} />
              </View>
              <Text style={[styles.xl, isPeak && styles.xlPeak]}>
                {b.from % 2 === 0 ? format(b.from) : ''}
              </Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.verdict}>{verdict}</Text>
    </View>
  );
}

const BAR_H = 54;

const createStyles = () =>
  StyleSheet.create({
    sub: { fontSize: 11.5, color: colors.ink3, fontFamily: fonts.sans, marginBottom: spacing.sm },
    lane: { marginTop: spacing.md },
    laneHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
    laneTitle: { fontSize: 12.5, fontFamily: fonts.sansSemiBold, color: colors.ink },
    laneHint: { fontSize: 10.5, color: colors.ink4, fontFamily: fonts.sans },
    bars: { flexDirection: 'row', gap: 2, alignItems: 'flex-end', marginTop: 8 },
    col: { flex: 1, alignItems: 'center' },
    track: { height: BAR_H, width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
    bar: { width: '78%', borderRadius: 2 },
    chance: { position: 'absolute', left: 0, right: 0, height: 1.5, backgroundColor: colors.ink4 },
    xl: { fontSize: 8, color: colors.ink4, fontFamily: fonts.mono, marginTop: 3 },
    xlPeak: { color: colors.ink2, fontFamily: fonts.monoSemiBold },
    verdict: { fontSize: 11.5, lineHeight: 16, color: colors.ink2, fontFamily: fonts.sans, marginTop: 6 },
    close: {
      fontSize: 12.5, lineHeight: 18, color: colors.ink, fontFamily: fonts.sans,
      marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line,
    },
  });
