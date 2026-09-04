import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';
import {
  SLEEP_AXIS_ORIGIN_H,
  axisRange,
  buildAwakeClock,
  peakAwakeWindow,
  toTimingBar,
  type SleepPeriod,
} from '@vitale/shared';
import { colors, fonts, useThemedStyles } from '../../theme';

interface Props {
  periods: SleepPeriod[];
  width: number;
  height?: number;
  accent: string;
}

const PAD_BOTTOM = 16;

/**
 * O relógio de vigília: os despertares de todas as noites da janela sobrepostos
 * num único eixo de hora do dia. Responde "eu acordo sempre às 3h?" — que nenhum
 * score da categoria responde — por DENSIDADE (faixas mais escuras onde mais
 * noites coincidem), não por contagem.
 *
 * Três estados, e a tela diz qual é: a fonte não reporta ("não sei"), reporta e
 * não houve, reporta e houve. Colapsar os dois primeiros em zero faria a tela
 * afirmar "você dormiu direto" quando a verdade é "não sei".
 *
 * Sem score, sem índice de fragmentação — o dado do usuário mostra vigília × nota
 * correndo ao contrário do que um score assumiria (spec §6).
 */
export function AwakeningsClock({ periods, width, height = 64, accent }: Props) {
  const styles = useThemedStyles(createStyles);
  if (width <= 0) return null;

  const clock = buildAwakeClock(periods);

  if (clock.coverage === 'unreported') {
    return <Text style={styles.note}>Seu relógio não reporta despertares — não dá para saber.</Text>;
  }
  if (clock.coverage === 'none') {
    return <Text style={styles.note}>Nenhum despertar registrado nas últimas {clock.nightsReporting} noites.</Text>;
  }

  // Mesmo eixo do timing chart, para as duas leituras se alinharem.
  const range = axisRange(periods.map(toTimingBar));
  const span = Math.max(range.to - range.from, 1);
  const innerH = height - PAD_BOTTOM;
  const x = (pos: number) => ((pos - range.from) / span) * width;

  const gridStart = Math.ceil(range.from / 2) * 2;
  const grid: number[] = [];
  for (let h = gridStart; h <= range.to; h += 2) grid.push(h);

  const peak = peakAwakeWindow(clock);
  const hourOf = (pos: number) => `${String(Math.floor((SLEEP_AXIS_ORIGIN_H + pos) % 24)).padStart(2, '0')}:${String(Math.round(((pos % 1) + 1) % 1 * 60)).padStart(2, '0')}`;

  return (
    <View>
      <Svg width={width} height={height}>
        {clock.bins
          .filter((b) => b.to > range.from && b.from < range.to && b.nights > 0)
          .map((b) => (
            <Rect
              key={b.from}
              x={x(Math.max(b.from, range.from))}
              y={0}
              width={Math.max(1, x(Math.min(b.to, range.to)) - x(Math.max(b.from, range.from)))}
              height={innerH}
              fill={accent}
              opacity={0.15 + 0.85 * b.density}
            />
          ))}
        <Line x1={0} y1={innerH} x2={width} y2={innerH} stroke={colors.line} strokeWidth={1} />
        {grid.map((h) => (
          <SvgText key={h} x={x(h)} y={height - 3} fontSize={9} fill={colors.ink4} textAnchor="middle">
            {`${String((SLEEP_AXIS_ORIGIN_H + h) % 24).padStart(2, '0')}h`}
          </SvgText>
        ))}
      </Svg>
      <Text style={styles.note}>
        {peak
          ? `Mais frequente por volta de ${hourOf(peak.from)} — em ${peak.nights} de ${clock.nightsReporting} noites.`
          : `Sem horário que se repita nas ${clock.nightsReporting} noites.`}
      </Text>
    </View>
  );
}

const createStyles = () =>
  StyleSheet.create({
    note: { fontSize: 12, lineHeight: 17, color: colors.ink3, fontFamily: fonts.sans, marginTop: 6 },
  });
