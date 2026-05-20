import React from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, spacing, MOD } from '../../theme';

type Link = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
  tint: string;
  color: string;
  route?: string;
};

const LINKS: Link[] = [
  { icon: 'checkmark-done-outline', label: 'Tarefas', sub: 'To-do e recorrências', tint: MOD.tarefa.tint, color: MOD.tarefa.accent, route: '/tarefas' },
  { icon: 'repeat-outline', label: 'Hábitos', sub: 'Contadores diários', tint: MOD.habito.tint, color: MOD.habito.accent, route: '/habitos' },
  { icon: 'sync-outline', label: 'Sync de atividades', sub: 'Treinos do Apple Health', tint: MOD.treino.tint, color: MOD.treino.accent, route: '/fitness' },
  { icon: 'barbell-outline', label: 'Treinos', sub: 'Histórico e cargas', tint: MOD.treino.tint, color: MOD.treino.accent },
  { icon: 'wallet-outline', label: 'Finanças', sub: 'Orçamento e gastos', tint: MOD.financas.tint, color: MOD.financas.accent },
  { icon: 'home-outline', label: 'Casa', sub: 'Rotinas e tarefas', tint: MOD.casa.tint, color: MOD.casa.accent },
  { icon: 'golf-outline', label: 'Metas', sub: '5 ativas', tint: MOD.habito.tint, color: MOD.habito.accent },
  { icon: 'trending-up-outline', label: 'Progresso', sub: 'Gráficos longos', tint: MOD.agua.tint, color: MOD.agua.accent },
  { icon: 'notifications-outline', label: 'Lembretes', sub: '6 ativos', tint: MOD.food.tint, color: MOD.food.accent },
];

export default function MaisScreen() {
  const router = useRouter();
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.greet}>
        <Text style={styles.title}>Mais</Text>
      </View>
      <View style={styles.grid}>
        {LINKS.map(l => (
          <Pressable
            key={l.label}
            disabled={!l.route}
            onPress={() => l.route && router.push(l.route as never)}
            style={({ pressed }) => [styles.tile, pressed && l.route && styles.pressed]}
          >
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
  pressed: { opacity: 0.7 },
  ico: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tileTitle: { fontSize: 14, fontWeight: '600', color: colors.ink },
  tileSub: { fontSize: 12, color: colors.ink3 },
});
