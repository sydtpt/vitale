import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Defs, Line, Pattern, Rect } from 'react-native-svg';
import { colors, fonts, spacing, useThemedStyles } from '../../theme';

/**
 * A legenda das telas de sono — e as amostras que ela usa, uma por marca.
 *
 * Existe para os quatro pontos que legendam sono (visão geral, Tempos, Estágios,
 * detalhe da noite) desenharem a mesma amostra para a mesma coisa: o vão com a
 * marca ao lado é "despertar" em todos, a hachura é "sem estágio" em todos.
 */
export interface LegendEntry {
  swatch: React.ReactNode;
  label: string;
}

export function SleepLegend({ items }: { items: LegendEntry[] }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.legend}>
      {items.map((it) => (
        <View key={it.label} style={styles.item}>
          {it.swatch}
          <Text style={styles.text}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

const SW = 11;

/** Quadrado cheio. */
export function SwSolid({ color }: { color: string }) {
  return <View style={{ width: SW, height: SW, borderRadius: 3, backgroundColor: color }} />;
}

/** Contorno tracejado — a janela na cama na visão geral, ou "sem noite". */
export function SwDashed({ color }: { color: string }) {
  return <View style={{ width: SW, height: SW, borderRadius: 3, borderWidth: 1, borderStyle: 'dashed', borderColor: color }} />;
}

/** O vão na barra: a superfície com um contorno fraco. */
export function SwGap() {
  return <View style={{ width: SW, height: SW, borderRadius: 3, borderWidth: 1, borderColor: colors.ink4, backgroundColor: colors.surface }} />;
}

/** O vão com a marca amarela ao lado — o despertar nas subviews. */
export function SwGapTick({ awake }: { awake: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      <SwGap />
      <View style={{ width: 3, height: SW, borderRadius: 1, backgroundColor: awake }} />
    </View>
  );
}

/** Ponto cheio — uma noite de semana na dispersão. */
export function SwDot({ color }: { color: string }) {
  return <View style={{ width: SW, height: SW, borderRadius: SW / 2, backgroundColor: color }} />;
}

/** Ponto vazado — uma noite de fim de semana na dispersão. */
export function SwRing({ color }: { color: string }) {
  return <View style={{ width: SW, height: SW, borderRadius: SW / 2, borderWidth: 1.6, borderColor: color, backgroundColor: colors.surface }} />;
}

/** Traço vertical — a mediana na dispersão. */
export function SwBar({ color }: { color: string }) {
  return <View style={{ width: 2, height: SW, borderRadius: 1, backgroundColor: color, marginHorizontal: 4 }} />;
}

/** Hachura — "sono sem hipnograma": azul, sem o detalhe. */
export function SwHatch({ color, id = 'sw-hatch' }: { color: string; id?: string }) {
  return (
    <Svg width={SW} height={SW}>
      <Defs>
        <Pattern id={id} patternUnits="userSpaceOnUse" width={5} height={5} patternTransform="rotate(45)">
          <Line x1={0} y1={0} x2={0} y2={5} stroke={color} strokeWidth={1.3} />
        </Pattern>
      </Defs>
      <Rect width={SW} height={SW} rx={3} fill={`url(#${id})`} />
    </Svg>
  );
}

const createStyles = () =>
  StyleSheet.create({
    legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.md },
    item: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    text: { fontSize: 11, color: colors.ink2, fontFamily: fonts.sans },
  });
