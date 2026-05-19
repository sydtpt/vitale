import React from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, MOD } from '../../theme';

const LINKS = [
  { icon: 'barbell-outline' as const, label: 'Treinos', sub: 'Histórico e cargas', tint: MOD.treino.tint, color: MOD.treino.accent },
  { icon: 'wallet-outline' as const, label: 'Finanças', sub: 'Orçamento e gastos', tint: MOD.financas.tint, color: MOD.financas.accent },
  { icon: 'home-outline' as const, label: 'Casa', sub: 'Rotinas e tarefas', tint: MOD.casa.tint, color: MOD.casa.accent },
  { icon: 'golf-outline' as const, label: 'Metas', sub: '5 ativas', tint: MOD.habito.tint, color: MOD.habito.accent },
  { icon: 'trending-up-outline' as const, label: 'Progresso', sub: 'Gráficos longos', tint: MOD.agua.tint, color: MOD.agua.accent },
  { icon: 'notifications-outline' as const, label: 'Lembretes', sub: '6 ativos', tint: MOD.food.tint, color: MOD.food.accent },
];

export default function MaisScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.greet}>
        <Text style={styles.title}>Mais</Text>
      </View>
      <View style={styles.grid}>
        {LINKS.map(l => (
          <Pressable key={l.label} style={styles.tile}>
            <View style={[styles.ico, { backgroundColor: l.tint }]}>
              <Ionicons name={l.icon} size={20} color={l.color} />
            </View>
            <Text style={styles.tileTitle}>{l.label}</Text>
            <Text style={styles.tileSub}>{l.sub}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingTop: 54 },
  greet: { paddingVertical: spacing.lg },
  title: { fontFamily: 'InstrumentSerif', fontSize: 34, color: colors.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '48%', backgroundColor: colors.surface, borderRadius: 16, padding: 14, gap: 8 },
  ico: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tileTitle: { fontSize: 14, fontWeight: '600', color: colors.ink },
  tileSub: { fontSize: 12, color: colors.ink3 },
});
