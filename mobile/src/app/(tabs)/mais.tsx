import React from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, spacing, moduleColors, shadows, useThemedStyles } from '../../theme';
import { useTabBarHeight } from '../../hooks/useTabBarHeight';

type Link = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
  /** Chave de módulo — cor resolvida no render (adapta ao tema claro/escuro). */
  mod: string;
  route?: string;
};

const LINKS: Link[] = [
  { icon: 'checkmark-done-outline', label: 'Tarefas', sub: 'To-do e recorrências', mod: 'tarefa', route: '/tarefas' },
  { icon: 'repeat-outline', label: 'Hábitos', sub: 'Contadores diários', mod: 'habito', route: '/habitos' },
  { icon: 'calendar-outline', label: 'Semana', sub: 'Visão geral da semana', mod: 'agua', route: '/(tabs)/semana' },
  { icon: 'albums-outline', label: 'Retrospectiva', sub: 'Mês, semana e ano', mod: 'habito', route: '/retrospectiva' },
  { icon: 'bookmark-outline', label: 'Registros', sub: 'Marcar atividades do dia', mod: 'food', route: '/registros' },
  { icon: 'barbell-outline', label: 'Treinos', sub: 'Planeje a semana', mod: 'treino', route: '/treinos' },
  { icon: 'sync-outline', label: 'Sync de atividades', sub: 'Treinos do Apple Health', mod: 'treino', route: '/fitness' },
  { icon: 'heart-outline', label: 'Saúde', sub: 'Métricas do Apple Health', mod: 'saude', route: '/(tabs)/saude' },
  { icon: 'battery-charging-outline', label: 'Recuperação', sub: 'Saúde × esporte agregado', mod: 'agua', route: '/recuperacao' },
  { icon: 'wallet-outline', label: 'Finanças', sub: 'Orçamento e gastos', mod: 'financas' },
  { icon: 'home-outline', label: 'Casa', sub: 'Rotinas e tarefas', mod: 'casa' },
  { icon: 'golf-outline', label: 'Metas', sub: '5 ativas', mod: 'habito' },
  { icon: 'trending-up-outline', label: 'Progresso', sub: 'Gráficos longos', mod: 'agua' },
  { icon: 'notifications-outline', label: 'Lembretes', sub: '6 ativos', mod: 'food' },
];

export default function MaisScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const tabBarHeight = useTabBarHeight();
  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight }]}>
      <View style={styles.greet}>
        <Text style={styles.title}>Mais</Text>
      </View>
      <View style={styles.grid}>
        {LINKS.map(l => {
          const mc = moduleColors(l.mod);
          return (
          <Pressable
            key={l.label}
            disabled={!l.route}
            onPress={() => l.route && router.push(l.route as never)}
            style={({ pressed }) => [styles.tile, pressed && l.route && styles.pressed]}
          >
            <View style={[styles.ico, { backgroundColor: mc.tint }]}>
              <Ionicons name={l.icon} size={20} color={mc.accent} />
            </View>
            <Text style={styles.tileTitle}>{l.label}</Text>
            <Text style={styles.tileSub}>{l.sub}</Text>
          </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionHeader}>Configurações</Text>
      <Pressable
        onPress={() => router.push('/configuracoes' as never)}
        style={({ pressed }) => [styles.settingsRow, pressed && styles.pressed]}
      >
        <View style={[styles.ico, styles.settingsIco]}>
          <Ionicons name="settings-outline" size={20} color={colors.ink2} />
        </View>
        <View style={styles.settingsText}>
          <Text style={styles.tileTitle}>Perfil e ajustes</Text>
          <Text style={styles.tileSub}>Conta, app, objetivos e dados</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.ink3} />
      </Pressable>
    </ScrollView>
  );
}

const createStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingTop: 54 },
  greet: { paddingVertical: spacing.lg },
  title: { fontFamily: 'InstrumentSerif', fontSize: 34, color: colors.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '48%', backgroundColor: colors.surface, borderRadius: 16, padding: 14, gap: 8, ...shadows.card },
  pressed: { opacity: 0.7 },
  ico: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tileTitle: { fontSize: 14, fontWeight: '600', color: colors.ink },
  tileSub: { fontSize: 12, color: colors.ink3 },
  sectionHeader: { fontSize: 13, fontWeight: '600', color: colors.ink2, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.xl, marginBottom: spacing.sm },
  settingsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 16, padding: 14, ...shadows.card },
  settingsIco: { backgroundColor: colors.line },
  settingsText: { flex: 1, gap: 2 },
});
