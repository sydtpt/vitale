import React, { useEffect } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TodoTemplate, TodoOccurrence } from '@vitale/shared';
import { useTodosStore } from '../../store/todos.store';
import { useAuthStore } from '../../store/auth.store';
import { TodoItem } from '../../components/cards/TodoItem';
import { colors, fonts, radii, shadows, spacing, useThemedStyles } from '../../theme';
import { todoDayStr, todoTimeStr, isOverdue, isVisibleNow, isStarted, addDays } from '@vitale/shared';

export default function TarefasScreen() {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const templates = useTodosStore((s) => s.templates);
  const occurrences = useTodosStore((s) => s.occurrences);
  const loading = useTodosStore((s) => s.loading);
  const load = useTodosStore((s) => s.load);
  const resolve = useTodosStore((s) => s.resolve);
  const reopen = useTodosStore((s) => s.reopen);
  const skip = useTodosStore((s) => s.skip);
  const cancel = useTodosStore((s) => s.cancel);
  const user = useAuthStore((s) => s.user);

  useEffect(() => { load(); }, [load, user?.id]);

  const tplById = new Map(templates.map((t) => [t.id, t]));
  // Dia lógico: a lista de hoje só vira às 02h (a madrugada fecha o dia anterior).
  const today = todoDayStr();

  // Exclui módulo 'compras' — lista de compras fica na sua própria tab.
  const isTask = (o: TodoOccurrence) =>
    tplById.has(o.templateId) && tplById.get(o.templateId)!.module !== 'compras';

  const now = todoTimeStr();
  // isStarted: "a partir de" oculta a série inteira até o dia escolhido.
  const pending = occurrences.filter(
    (o) => o.status === 'pending' && isTask(o) && isStarted(tplById.get(o.templateId)!, today),
  );
  // startTime: a tarefa do dia só aparece a partir do horário; antes disso cai em "Em breve".
  const visible = (o: TodoOccurrence) => isVisibleNow(tplById.get(o.templateId)!, o, today, now);

  const overdue = pending.filter((o) => isOverdue(o, today));
  const todayList = pending.filter(
    (o) => !isOverdue(o, today) && (o.dueDate === null || o.dueDate <= today) && visible(o),
  );
  const in48h = addDays(today, 2);
  const upcoming = pending.filter(
    (o) =>
      (o.dueDate !== null && o.dueDate > today && o.dueDate <= in48h) ||
      (o.dueDate === today && !visible(o)),
  );

  // Concluídas hoje (inclui as auto-concluídas pelo sync de treino) — por doneAt local.
  const doneToday = occurrences.filter(
    (o) =>
      o.status === 'done' &&
      o.doneAt != null &&
      todoDayStr(new Date(o.doneAt)) === today &&
      isTask(o),
  );

  const pendingIds = new Set(pending.map((o) => o.templateId));
  const triggers = templates.filter(
    (t) =>
      ['event', 'stock', 'usage'].includes(t.recurrence.kind) &&
      t.module !== 'compras' &&
      !pendingIds.has(t.id),
  );

  const empty = pending.length === 0 && triggers.length === 0 && doneToday.length === 0;

  const onMore = (t: TodoTemplate, o: TodoOccurrence) => {
    Alert.alert(t.name, undefined, [
      { text: 'Editar série', onPress: () => router.push({ pathname: '/tarefas/editor', params: { id: t.id } }) },
      { text: 'Pular esta', onPress: () => skip(o.id) },
      { text: 'Cancelar tarefa', style: 'destructive', onPress: () => cancel(o.id) },
      { text: 'Fechar', style: 'cancel' },
    ]);
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

  const renderDone = (o: TodoOccurrence) => (
    <TodoItem
      key={o.id}
      template={tplById.get(o.templateId)!}
      occurrence={o}
      done
      onReopen={() => reopen(o.id)}
    />
  );


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
        <Pressable onPress={() => router.push('/tarefas/recorrentes')} hitSlop={12} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
          <Ionicons name="repeat" size={20} color={colors.ink} />
        </Pressable>
        <Pressable onPress={() => router.push('/tarefas/automaticas')} hitSlop={12} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
          <Ionicons name="flash-outline" size={20} color={colors.ink} />
        </Pressable>
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
            <Ionicons name="add" size={18} color={colors.onPrimary} />
            <Text style={styles.ctaText}>Nova tarefa</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Section title="Atrasadas" items={overdue} />
          <Section title="A fazer" items={todayList} />
          <Section title="Em breve" items={upcoming} />

          {doneToday.length > 0 && (
            <>
              <Text style={styles.section}>Concluídas hoje</Text>
              {doneToday.map(renderDone)}
            </>
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
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

  scroll: { paddingHorizontal: spacing.lg, paddingBottom: 40 },
  section: {
    fontSize: 12.5,
    fontFamily: fonts.sansBold,
    color: colors.ink2,
    marginTop: spacing.xl,
    marginBottom: spacing.xs,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 1.0,
  },
  card: { backgroundColor: colors.surface, borderRadius: radii['2xl'], overflow: 'hidden', marginTop: 8, ...shadows.card },
  trigger: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  iconBox: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  name: { fontSize: 14.5, fontFamily: fonts.sansSemiBold, color: colors.ink },
  summary: { fontSize: 12.5, fontFamily: fonts.sans, color: colors.ink3, marginTop: 2 },
  triggerBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.pill },
  triggerBtnText: { color: '#fff', fontSize: 13, fontFamily: fonts.sansBold },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
  emptyTitle: { fontSize: 16, fontFamily: fonts.sansBold, color: colors.ink, marginTop: spacing.sm },
  emptyText: { fontSize: 13.5, fontFamily: fonts.sans, color: colors.ink3, textAlign: 'center', lineHeight: 19 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, paddingHorizontal: 18, paddingVertical: 11, borderRadius: radii.pill, marginTop: spacing.md },
  ctaText: { color: colors.onPrimary, fontSize: 14.5, fontFamily: fonts.sansBold },
});
