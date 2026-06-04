import React, { useEffect } from 'react';
import { View, Text, Pressable, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TodoTemplate } from '@vitale/shared';
import { useTodosStore } from '../../store/todos.store';
import { useAuthStore } from '../../store/auth.store';
import { colors, spacing, radii, shadows, useThemedStyles } from '../../theme';

function isAutomatic(t: TodoTemplate): boolean {
  return (
    ['on_workout', 'event', 'stock', 'usage'].includes(t.recurrence.kind) ||
    t.linkedActivityId != null ||
    (t.onComplete != null && t.onComplete.length > 0) ||
    t.triggerOnly === true
  );
}

function autoLabel(t: TodoTemplate): string {
  if (t.recurrence.kind === 'on_workout') return 'Criada ao registrar treino';
  if (t.recurrence.kind === 'event') {
    const label = (t.recurrence as { kind: 'event'; label: string }).label;
    return `Gatilho: ${label}`;
  }
  if (t.recurrence.kind === 'stock') return 'Gatilho: estoque';
  if (t.recurrence.kind === 'usage') {
    const rec = t.recurrence as { kind: 'usage'; meterUnit: string; every: number };
    return `Gatilho: a cada ${rec.every} ${rec.meterUnit}`;
  }
  if (t.linkedActivityId != null) return 'Concluída automaticamente por treino';
  if (t.onComplete != null && t.onComplete.length > 0)
    return `Encadeia ${t.onComplete.length} tarefa${t.onComplete.length > 1 ? 's' : ''} ao concluir`;
  return 'Só por gatilho';
}

export default function AutomaticasScreen() {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const templates = useTodosStore((s) => s.templates);
  const loading = useTodosStore((s) => s.loading);
  const load = useTodosStore((s) => s.load);
  const user = useAuthStore((s) => s.user);

  useEffect(() => { load(); }, [load, user?.id]);

  const automatic = templates.filter(isAutomatic);

  const renderItem = ({ item: t }: { item: TodoTemplate }) => (
    <Pressable
      onPress={() => router.push({ pathname: '/tarefas/editor', params: { id: t.id } })}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.iconBox, { backgroundColor: `${colors.primary}22` }]}>
        <Ionicons name={(t.icon as any) ?? 'checkmark'} size={18} color={colors.primary} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.name} numberOfLines={1}>{t.name}</Text>
        <Text style={styles.label} numberOfLines={1}>{autoLabel(t)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.ink4} />
    </Pressable>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Automáticas</Text>
        <View style={styles.iconBtn} />
      </View>

      {loading && automatic.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : automatic.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="flash-outline" size={40} color={colors.ink4} />
          <Text style={styles.emptyTitle}>Nenhuma automação</Text>
          <Text style={styles.emptyText}>
            Tarefas com gatilhos, encadeamento ou integração com treinos aparecem aqui.
          </Text>
        </View>
      ) : (
        <FlatList
          data={automatic}
          keyExtractor={(t) => t.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const createStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  pressed: { opacity: 0.7 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 20, fontFamily: 'InstrumentSerif', color: colors.ink },

  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radii['2xl'],
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 8,
    ...shadows.card,
  },
  separator: { height: 0 },
  iconBox: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  name: { fontSize: 14.5, fontWeight: '600', color: colors.ink },
  label: { fontSize: 12.5, color: colors.ink3, marginTop: 2 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.ink, marginTop: spacing.sm },
  emptyText: { fontSize: 13.5, color: colors.ink3, textAlign: 'center', lineHeight: 19 },
});
