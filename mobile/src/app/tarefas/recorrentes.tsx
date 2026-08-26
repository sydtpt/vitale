import React, { useEffect } from 'react';
import { View, Text, Pressable, SectionList, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TodoTemplate } from '@vitale/shared';
import { useTodosStore } from '../../store/todos.store';
import { useAuthStore } from '../../store/auth.store';
import { colors, fonts, radii, shadows, spacing, useThemedStyles } from '../../theme';
import { describeRecurrence } from '@vitale/shared';
import { HeaderSpacer } from '../../components/ui/HeaderSpacer';

// Séries que se repetem por agenda/uso/evento/estoque. Fora: avulsas ('none') e
// treinos ('on_workout'), que nascem de atividades físicas.
function isRecurring(t: TodoTemplate): boolean {
  return t.recurrence.kind !== 'none' && t.recurrence.kind !== 'on_workout';
}

export default function RecorrentesScreen() {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const allTemplates = useTodosStore((s) => s.allTemplates);
  const loading = useTodosStore((s) => s.loading);
  const loadAll = useTodosStore((s) => s.loadAll);
  const archiveTemplate = useTodosStore((s) => s.archiveTemplate);
  const user = useAuthStore((s) => s.user);

  useEffect(() => { loadAll(); }, [loadAll, user?.id]);

  const recurring = allTemplates.filter(isRecurring);
  const active = recurring.filter((t) => t.active);
  const archived = recurring.filter((t) => !t.active);

  const sections = [
    ...(active.length ? [{ title: `Ativas (${active.length})`, data: active }] : []),
    ...(archived.length ? [{ title: `Arquivadas (${archived.length})`, data: archived }] : []),
  ];

  const openEdit = (t: TodoTemplate) =>
    router.push({ pathname: '/tarefas/editor', params: { id: t.id } });

  const onArchive = (t: TodoTemplate) => {
    Alert.alert('Arquivar série', `Parar de gerar novas ocorrências de "${t.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Arquivar', style: 'destructive', onPress: () => archiveTemplate(t.id, false) },
    ]);
  };

  const renderItem = ({ item: t }: { item: TodoTemplate }) => (
    <Pressable
      onPress={() => openEdit(t)}
      style={({ pressed }) => [styles.row, !t.active && styles.rowArchived, pressed && styles.pressed]}
    >
      <View style={[styles.iconBox, { backgroundColor: `${colors.primary}22` }]}>
        <Ionicons name={(t.icon as any) ?? 'checkmark'} size={18} color={colors.primary} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.name} numberOfLines={1}>{t.name}</Text>
        <Text style={styles.label} numberOfLines={1}>{describeRecurrence(t.recurrence)}</Text>
      </View>
      {t.active ? (
        <Pressable onPress={() => onArchive(t)} hitSlop={10} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
          <Ionicons name="archive-outline" size={18} color={colors.ink4} />
        </Pressable>
      ) : (
        <Pressable onPress={() => archiveTemplate(t.id, true)} hitSlop={10} style={({ pressed }) => [styles.reactivate, pressed && styles.pressed]}>
          <Text style={styles.reactivateText}>Reativar</Text>
        </Pressable>
      )}
    </Pressable>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Recorrentes</Text>
        <HeaderSpacer />
      </View>

      {loading && recurring.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : recurring.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="repeat" size={40} color={colors.ink4} />
          <Text style={styles.emptyTitle}>Nenhuma recorrente</Text>
          <Text style={styles.emptyText}>
            Séries que se repetem (aluguel, lixo, faxina…) aparecem aqui para você editar.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(t) => t.id}
          renderItem={renderItem}
          renderSectionHeader={({ section }) => <Text style={styles.section}>{section.title}</Text>}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
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
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 20, fontFamily: fonts.serif, color: colors.ink },

  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 40 },
  section: {
    fontSize: 12.5,
    fontFamily: fonts.sansBold,
    color: colors.ink2,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 1.0,
  },
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
  rowArchived: { opacity: 0.62 },
  iconBox: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  name: { fontSize: 14.5, fontFamily: fonts.sansSemiBold, color: colors.ink },
  label: { fontSize: 12.5, fontFamily: fonts.sans, color: colors.ink3, marginTop: 2 },
  action: { width: 32, height: 32, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  reactivate: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radii.pill, backgroundColor: `${colors.primary}18` },
  reactivateText: { color: colors.primary, fontSize: 12.5, fontFamily: fonts.sansBold },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
  emptyTitle: { fontSize: 16, fontFamily: fonts.sansBold, color: colors.ink, marginTop: spacing.sm },
  emptyText: { fontSize: 13.5, fontFamily: fonts.sans, color: colors.ink3, textAlign: 'center', lineHeight: 19 },
});
