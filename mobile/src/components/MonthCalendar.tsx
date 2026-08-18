import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing } from '../theme';
import { localDateStr } from '@vitale/shared';

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

interface Cell {
  key: string;
  date: string; // '' = vazio
  day: number;
  marked: boolean;
  future: boolean;
}

interface Props {
  selected: string | null;
  marked?: Set<string>;
  onSelect: (date: string) => void;
  onMonthChange?: (year: number, monthIdx: number) => void;
}

/** Calendário mensal: grade 7 col (domingo→sábado), navegação de mês, futuro off. */
export function MonthCalendar({ selected, marked, onSelect, onMonthChange }: Props) {
  const now = useMemo(() => new Date(), []);
  const today = localDateStr(now);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const canNext =
    year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth());

  const cells = useMemo<Cell[]>(() => {
    const first = new Date(year, month, 1).getDay();
    const total = new Date(year, month + 1, 0).getDate();
    const out: Cell[] = [];
    for (let i = 0; i < first; i++) out.push({ key: `e${i}`, date: '', day: 0, marked: false, future: false });
    for (let d = 1; d <= total; d++) {
      const date = localDateStr(new Date(year, month, d));
      out.push({ key: date, date, day: d, marked: !!marked?.has(date), future: date > today });
    }
    return out;
  }, [year, month, marked, today]);

  const step = (delta: number) => {
    if (delta > 0 && !canNext) return;
    let m = month + delta;
    let y = year;
    if (m < 0) { m = 11; y--; }
    else if (m > 11) { m = 0; y++; }
    setMonth(m);
    setYear(y);
    onMonthChange?.(y, m);
  };

  return (
    <View style={styles.cal}>
      <View style={styles.nav}>
        <Pressable onPress={() => step(-1)} hitSlop={8} style={({ pressed }) => [styles.navBtn, pressed && styles.pressed]}>
          <Ionicons name="chevron-back" size={18} color={colors.ink2} />
        </Pressable>
        <Text style={styles.label}>{MONTHS[month]} {year}</Text>
        <Pressable
          onPress={() => step(1)}
          disabled={!canNext}
          hitSlop={8}
          style={({ pressed }) => [styles.navBtn, pressed && styles.pressed, !canNext && styles.disabled]}
        >
          <Ionicons name="chevron-forward" size={18} color={colors.ink2} />
        </Pressable>
      </View>

      <View style={styles.row}>
        {WEEKDAYS.map((w, i) => (
          <View key={`wd${i}`} style={styles.cellWrap}>
            <Text style={styles.weekday}>{w}</Text>
          </View>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((c) => {
          if (!c.date) return <View key={c.key} style={styles.cellWrap} />;
          const isSel = c.date === selected;
          const isToday = c.date === today;
          return (
            <View key={c.key} style={styles.cellWrap}>
              <Pressable
                onPress={() => onSelect(c.date)}
                disabled={c.future}
                style={({ pressed }) => [
                  styles.day,
                  isToday && styles.dayToday,
                  isSel && styles.daySel,
                  pressed && !isSel && styles.pressed,
                ]}
              >
                <Text style={[styles.dayNum, c.future && styles.dayFuture, isSel && styles.dayNumSel]}>
                  {c.day}
                </Text>
                {c.marked && <View style={[styles.dot, isSel && styles.dotSel]} />}
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cal: { backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.md, borderWidth: 1, borderColor: colors.line },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  navBtn: { width: 32, height: 32, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 14.5, fontWeight: '700', color: colors.ink, textTransform: 'capitalize' },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.4 },
  row: { flexDirection: 'row', marginBottom: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cellWrap: { width: `${100 / 7}%`, aspectRatio: 1, padding: 2 },
  weekday: { textAlign: 'center', fontSize: 11, fontWeight: '600', color: colors.ink3 },
  day: { flex: 1, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  dayToday: { borderWidth: 1, borderColor: colors.line },
  daySel: { backgroundColor: colors.primary },
  dayNum: { fontSize: 14, color: colors.ink, fontWeight: '500' },
  dayNumSel: { color: '#fff', fontWeight: '700' },
  dayFuture: { color: colors.ink4 },
  dot: { position: 'absolute', bottom: 5, width: 4, height: 4, borderRadius: 2, backgroundColor: colors.primary },
  dotSel: { backgroundColor: '#fff' },
});
