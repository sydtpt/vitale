import React, { useEffect } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TodoTemplate, TodoOccurrence } from '@vitale/shared';
import { useTodosStore } from '../../store/todos.store';
import { useAuthStore } from '../../store/auth.store';
import { TodoItem } from '../../components/cards/TodoItem';
import { localDateStr, isOverdue } from '../../lib/todo-logic';
import { describeRecurrence } from '../../lib/todo-format';
import { colors, spacing, radii, shadows, MOD } from '../../theme';

function modColor(key: string): { tint: string; accent: string } {
  return (MOD as Record<string, { tint: string; accent: string }>)[key] ?? MOD.tarefa;
}

export default function TarefasScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const templates = useTodosStore((s) => s.templates);
  const occurrences = useTodosStore((s) => s.occurrences);
  const loading = useTodosStore((s) => s.loading);
  const load = useTodosStore((s) => s.load);
  const resolve = useTodosStore((s) => s.resolve);
  const skip = useTodosStore((s) => s.skip);
  const cancel = useTodosStore((s) => s.cancel);
  const trigger = useTodosStore((s) => s.trigger);
  const updateMeter = useTodosStore((s) => s.updateMeter);
  const user = useAuthStore((s) => s.user);

  useEffect(() => { load(); }, [load, user?.id]);

  const tplById = new Map(templates.map((t) => [t.id, t]));
  const today = localDateStr();
  const pending = occurrences.filter((o) => o.status === 'pending' && tplById.has(o.templateId));

  const overdue = pending.filter((o) => isOverdue(o, today));
  const todayList = pending.filter((o) => !isOverdue(o, today) && (o.dueDate === null || o.dueDate <= today));
  const upcoming = pending.filter((o) => o.dueDate !== null && o.dueDate > today);

  const pendingIds = new Set(pending.map((o) => o.templateId));
  const triggers = templates.filter(
    (t) => ['event', 'stock', 'usage'].includes(t.recurrence.kind) && !pendingIds.has(t.id),
  );

  const empty = pending.length === 0 && triggers.length === 0;

  const onMore = (t: TodoTemplate, o: TodoOccurrence) => {
    Alert.alert(t.name, undefined, [
      { text: 'Editar série', onPress: () => router.push({ pathname: '/tarefas/editor', params: { id: t.id } }) },
      { text: 'Pular esta', onPress: () => skip(o.id) },
      { text: 'Cancelar tarefa', style: 'destructive', onPress: () => cancel(o.id) },
      { text: 'Fechar', style: 'cancel' },
    ]);
  };

  const onUsage = (t: TodoTemplate) => {
    if (t.recurrence.kind !== 'usage') return;
    const unit = t.recurrence.meterUnit;
    // Alert.prompt é iOS-only; em Android cai no editor da série.
    if (Alert.prompt) {
      Alert.prompt(
        t.name,
        `Leitura atual (${unit})`,
        (text) => {
          const n = Number(String(text).replace(',', '.'));
          if (Number.isFinite(n)) updateMeter(t.id, n);
        },
        'plain-text',
        t.meter != null ? String(t.meter) : '',
        'numeric',
      );
    } else {
      router.push({ pathname: '/tarefas/editor', params: { id: t.id } });
    }
  };

  // Conclusão rica: tarefas de Finanças capturam o valor pago em meta (sem backend de Finanças ainda).
  const onDone = (t: TodoTemplate, o: TodoOccurrence) => {
    if (t.module === 'financas' && Alert.prompt) {
      Alert.prompt(
        t.name,
        'Valor pago (opcional)',
        (text) => {
          const n = Number(String(text).replace(',', '.'));
          resolve(o.id, 'done', Number.isFinite(n) && n > 0 ? { amount: n } : undefined);
        },
        'plain-text',
        '',
        'numeric',
      );
    } else {
      resolve(o.id, 'done');
    }
  };

  const renderItem = (o: TodoOccurrence) => {
    const t = tplById.get(o.templateId)!;
    return (
      <TodoItem
        key={o.id}
        template={t}
        occurrence={o}
        onDone={() => onDone(t, o)}
        onMore={() => onMore(t, o)}
      />
    );
  };

  const TriggerRow = ({ t }: { t: TodoTemplate }) => {
    const mod = modColor(t.color);
    const isUsage = t.recurrence.kind === 'usage';
    const cta = isUsage ? 'Atualizar' : 'Registrar';
    return (
      <View style={styles.trigger}>
        <View style={[styles.iconBox, { backgroundColor: mod.tint }]}>
          <Ionicons name={(t.icon || 'flash-outline') as never} size={18} color={mod.accent} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.name}>{t.name}</Text>
          <Text style={styles.summary}>
            {describeRecurrence(t.recurrence)}
            {isUsage && t.meter != null ? ` · ${t.meter} ${(t.recurrence as { meterUnit: string }).meterUnit}` : ''}
          </Text>
        </View>
        <Pressable
          onPress={() => (isUsage ? onUsage(t) : trigger(t.id))}
          style={({ pressed }) => [styles.triggerBtn, { backgroundColor: mod.accent }, pressed && styles.pressed]}
        >
          <Text style={styles.triggerBtnText}>{cta}</Text>
        </Pressable>
      </View>
    );
  };

  const Section = ({ title, items }: { title: string; items: TodoOccurrence[] }) =>
    items.length > 0 ? (
      <>
        <Text style={styles.section}>{title}</Text>
        {items.map(renderItem)}
      </>
    ) : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Tarefas</Text>
        <Pressable onPress={() => router.push('/tarefas/editor')} hitSlop={12} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
          <Ionicons name="add" size={24} color={colors.ink} />
        </Pressable>
      </View>

      {loading && occurrences.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : empty ? (
        <View style={styles.center}>
          <Ionicons name="checkmark-done-circle-outline" size={40} color={colors.ink4} />
          <Text style={styles.emptyTitle}>Nenhuma tarefa</Text>
          <Text style={styles.emptyText}>Crie tarefas recorrentes ou avulsas para acompanhar no dia a dia.</Text>
          <Pressable onPress={() => router.push('/tarefas/editor')} style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.ctaText}>Nova tarefa</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Section title="Atrasadas" items={overdue} />
          <Section title="A fazer" items={todayList} />
          <Section title="Em breve" items={upcoming} />
          {triggers.length > 0 && (
            <>
              <Text style={styles.section}>Gatilhos manuais</Text>
              <View style={styles.card}>
                {triggers.map((t) => <TriggerRow key={t.id} t={t} />)}
              </View>
            </>
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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

  scroll: { paddingHorizontal: spacing.lg, paddingBottom: 40 },
  section: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.ink2,
    marginTop: spacing.xl,
    marginBottom: spacing.xs,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: { backgroundColor: colors.surface, borderRadius: radii['2xl'], overflow: 'hidden', marginTop: 8, ...shadows.card },
  trigger: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  iconBox: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  name: { fontSize: 14.5, fontWeight: '600', color: colors.ink },
  summary: { fontSize: 12.5, color: colors.ink3, marginTop: 2 },
  triggerBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.pill },
  triggerBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.ink, marginTop: spacing.sm },
  emptyText: { fontSize: 13.5, color: colors.ink3, textAlign: 'center', lineHeight: 19 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, paddingHorizontal: 18, paddingVertical: 11, borderRadius: radii.pill, marginTop: spacing.md },
  ctaText: { color: '#fff', fontSize: 14.5, fontWeight: '700' },
});
