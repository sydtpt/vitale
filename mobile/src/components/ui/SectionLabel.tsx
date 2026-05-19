import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme';

interface SectionLabelProps {
  children: string;
  right?: string;
}

export function SectionLabel({ children, right }: SectionLabelProps) {
  return (
    <View style={styles.sec}>
      <Text style={styles.lbl}>{children}</Text>
      {right && <Text style={styles.r}>{right}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  sec: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingTop: 24,
    paddingHorizontal: 4,
  },
  lbl: {
    fontSize: 13,
    color: colors.ink3,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  r: {
    fontSize: 12.5,
    color: colors.ink3,
    fontFamily: 'GeistMono',
  },
});
