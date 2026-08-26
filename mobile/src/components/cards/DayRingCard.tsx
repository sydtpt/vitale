import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, fonts, useThemedStyles } from '../../theme';

interface DayRingCardProps {
  activity: number;
  food: number;
  mind: number;
  overall: number;
}

function dash(val: number, r: number): { strokeDasharray: string } {
  const C = 2 * Math.PI * r;
  return { strokeDasharray: `${(val / 100) * C} ${C}` };
}

export function DayRingCard({ activity, food, mind, overall }: DayRingCardProps) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.card}>
      <Svg width={120} height={120} viewBox="0 0 120 120">
        {/* Activity ring r=50 */}
        <Circle cx={60} cy={60} r={50} fill="none" stroke="#F25C2B22" strokeWidth={8} />
        <Circle cx={60} cy={60} r={50} fill="none" stroke="#F25C2B" strokeWidth={8}
          strokeDasharray={`${(activity / 100) * 2 * Math.PI * 50} ${2 * Math.PI * 50}`}
          strokeLinecap="round" rotation={-90} origin="60, 60" />
        {/* Food ring r=40 */}
        <Circle cx={60} cy={60} r={40} fill="none" stroke="#F5B94622" strokeWidth={8} />
        <Circle cx={60} cy={60} r={40} fill="none" stroke="#F5B946" strokeWidth={8}
          strokeDasharray={`${(food / 100) * 2 * Math.PI * 40} ${2 * Math.PI * 40}`}
          strokeLinecap="round" rotation={-90} origin="60, 60" />
        {/* Mind ring r=30 */}
        <Circle cx={60} cy={60} r={30} fill="none" stroke="#6FA86A22" strokeWidth={8} />
        <Circle cx={60} cy={60} r={30} fill="none" stroke="#6FA86A" strokeWidth={8}
          strokeDasharray={`${(mind / 100) * 2 * Math.PI * 30} ${2 * Math.PI * 30}`}
          strokeLinecap="round" rotation={-90} origin="60, 60" />
      </Svg>

      <View style={styles.info}>
        <Text style={styles.eyebrow}>DIA DE HOJE</Text>
        <Text style={styles.num}>
          {overall}<Text style={styles.of}> /100</Text>
        </Text>
        <View style={styles.legend}>
          <LegendRow color="#F25C2B" label="Movimento" value={`${activity}%`} />
          <LegendRow color="#F5B946" label="Nutrição" value={`${food}%`} />
          <LegendRow color="#6FA86A" label="Mente" value={`${mind}%`} />
        </View>
      </View>
    </View>
  );
}

function LegendRow({ color, label, value }: { color: string; label: string; value: string }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
      <Text style={styles.legendValue}>{value}</Text>
    </View>
  );
}

const createStyles = () => StyleSheet.create({
  card: {
    backgroundColor: '#1F1B16',
    borderRadius: 24,
    padding: 18,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  info: { flex: 1 },
  eyebrow: {
    fontSize: 12,
    color: '#FFE3D2',
    letterSpacing: 0.4,
    fontFamily: fonts.sansSemiBold,
  },
  num: {
    fontFamily: fonts.serif,
    fontSize: 42,
    lineHeight: 46,
    marginVertical: 4,
    color: '#FFFFFF',
  },
  of: { fontSize: 18, fontFamily: fonts.sans, color: 'rgba(255,255,255,0.6)' },
  legend: { gap: 3, marginTop: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: { width: 8, height: 8, borderRadius: 2 },
  legendLabel: { flex: 1, fontSize: 11.5, fontFamily: fonts.sans, color: 'rgba(255,255,255,0.85)' },
  legendValue: { fontSize: 11.5, fontFamily: fonts.mono, color: 'rgba(255,255,255,0.6)' },
});
