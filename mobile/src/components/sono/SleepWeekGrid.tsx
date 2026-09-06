import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { axisPosition, awakeMinOf, formatHm, type SleepColors, type SleepPeriod } from '@vitale/shared';
import { colors, fonts, spacing, useThemedStyles } from '../../theme';

interface Props {
  nights: readonly SleepPeriod[];
  width: number;
  palette: SleepColors;
  /** Toque numa noite abre o detalhe dela. */
  onPressNight?: (wakeDay: string) => void;
}

const WD = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
const PAD_LEFT = 38;
const HEAD_H = 16;
const ROW_H = 74;
const BAR_W = 14;
/** A partir de quanto a marca amarela aparece ao lado da barra. */
const AWAKE_MARK_MIN = 30;

function weekday(day: string): number {
  return (new Date(`${day}T12:00:00`).getDay() + 6) % 7;
}
function weekStart(day: string): string {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() - weekday(day));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function dm(day: string): string {
  return `${Number(day.slice(8, 10))}/${day.slice(5, 7)}`;
}

/**
 * B2 — a grade semana × dia. As semanas em linhas, os dias em colunas, e cada
 * célula é a noite em miniatura: a barra vai de apagar a acordar no mesmo eixo de
 * horas em todas. Ler para baixo compara a mesma noite da semana ao longo do
 * período — as quartas acordando às 9, as sextas mais curtas.
 *
 * A marca amarela ao lado da barra é o despertar, como em toda tela de sono —
 * aqui só quando a noite passou de {@link AWAKE_MARK_MIN} minutos acordado, porque
 * em 14 pt de largura não há espaço para o vão. Tracejado é noite sem dado.
 */
export function SleepWeekGrid({ nights, width, palette, onPressNight }: Props) {
  const styles = useThemedStyles(createStyles);
  if (nights.length === 0 || width <= 0) return null;

  const byWeek = new Map<string, (SleepPeriod | undefined)[]>();
  for (const p of nights) {
    const k = weekStart(p.wakeDay);
    if (!byWeek.has(k)) byWeek.set(k, new Array<SleepPeriod | undefined>(7).fill(undefined));
    byWeek.get(k)![weekday(p.wakeDay)] = p;
  }
  const weeks = [...byWeek.keys()].sort();

  const onsets = nights.map((p) => axisPosition(p.onsetAt, p.tzOffset));
  const wakes = nights.map((p) => axisPosition(p.wakeAt, p.tzOffset));
  const from = Math.max(0, Math.min(...onsets) - 0.5);
  const to = Math.min(24, Math.max(...wakes) + 0.5);
  const span = Math.max(to - from, 1);
  const cellW = (width - PAD_LEFT) / 7;
  const barW = Math.min(BAR_W, cellW * 0.4);
  const height = HEAD_H + weeks.length * ROW_H;
  const yIn = (pos: number) => 4 + ((pos - from) / span) * (ROW_H - 26);
  const guides = [6, 14].filter((g) => g > from && g < to); // meia-noite e 8h

  return (
    <View>
      <Svg width={width} height={height}>
        {WD.map((d, i) => (
          <SvgText key={d} x={PAD_LEFT + i * cellW + cellW / 2} y={11} fontSize={9.5} fill={colors.ink3} textAnchor="middle" fontFamily={fonts.mono}>
            {d}
          </SvgText>
        ))}
        {weeks.map((k, r) => {
          const top = HEAD_H + r * ROW_H;
          const row = byWeek.get(k)!;
          return (
            <G key={k}>
              <SvgText x={0} y={top + ROW_H / 2 - 6} fontSize={9} fill={colors.ink4} fontFamily={fonts.mono}>
                {dm(k)}
              </SvgText>
              {guides.map((g) => (
                <Line key={g} x1={PAD_LEFT} x2={width} y1={top + yIn(g)} y2={top + yIn(g)} stroke={colors.line} strokeWidth={1} strokeDasharray="2 4" />
              ))}
              {row.map((p, i) => {
                const cx = PAD_LEFT + i * cellW + cellW / 2;
                if (!p) {
                  const y1 = top + yIn(Math.max(from, 6));
                  const y2 = top + yIn(Math.min(to, 14));
                  return (
                    <Rect key={`${k}-${i}`} x={cx - barW / 2} y={y1} width={barW} height={Math.max(2, y2 - y1)} rx={3}
                      fill="none" stroke={colors.line} strokeWidth={1} strokeDasharray="3 3" />
                  );
                }
                const y1 = top + yIn(axisPosition(p.onsetAt, p.tzOffset));
                const y2 = top + yIn(axisPosition(p.wakeAt, p.tzOffset));
                const aw = awakeMinOf(p);
                return (
                  <G key={p.wakeDay} onPress={onPressNight ? () => onPressNight(p.wakeDay) : undefined}>
                    {/* Alvo de toque: a célula inteira, não só a barra. */}
                    <Rect x={cx - cellW / 2} y={top} width={cellW} height={ROW_H} fill="transparent" />
                    <Rect x={cx - barW / 2} y={y1} width={barW} height={Math.max(2, y2 - y1)} rx={3} fill={palette.sleep} />
                    {aw !== null && aw >= AWAKE_MARK_MIN && (
                      <Rect x={cx + barW / 2 + 3} y={y1} width={3} height={Math.max(2, y2 - y1)} rx={1} fill={palette.awake} />
                    )}
                    <SvgText x={cx} y={top + ROW_H - 8} fontSize={9} fill={colors.ink3} textAnchor="middle" fontFamily={fonts.mono}>
                      {formatHm(p.asleepH)}
                    </SvgText>
                  </G>
                );
              })}
            </G>
          );
        })}
      </Svg>
      <Text style={styles.note}>linhas de guia: meia-noite e 8h · toque numa noite abre o detalhe</Text>
    </View>
  );
}

const createStyles = () =>
  StyleSheet.create({
    note: { fontSize: 11, color: colors.ink3, fontFamily: fonts.sans, marginTop: spacing.xs },
  });
