import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { TodoTemplate, TodoOccurrence } from '@vitale/shared';
import { colors, radii, MOD } from '../../theme';
import { daysLate, isOverdue } from '../../lib/todo-logic';
import { describeRecurrence, dueLabel } from '../../lib/todo-format';

function modColor(key: string): { tint: string; accent: string } {
  return (MOD as Record<string, { tint: string; accent: string }>)[key] ?? MOD.tarefa;
}

interface Props {
  template: TodoTemplate;
  occurrence: TodoOccurrence;
  onDone?: () => void;
  onMore?: () => void;
  /** Variante somente-leitura para ocorrências já concluídas (seção "Concluídas hoje"). */
  done?: boolean;
}

/** Item da lista de tarefas: checkbox para concluir + atalho de ações (•••). */
export function TodoItem({ template, occurrence, onDone, onMore, done = false }: Props) {
  const mod = modColor(template.color);
  const overdue = !done && isOverdue(occurrence);
  const late = daysLate(occurrence);
  const autoDone = done && occurrence.meta?.source === 'activity-sync';

  const subtitle = done
    ? 'Concluída'
    : overdue
      ? `Atrasada há ${late}d`
      : `${dueLabel(occurrence.dueDate)} · ${describeRecurrence(template.recurrence)}`;

  const onCheck = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onDone?.();
  };

  return (
    <View style={[styles.card, overdue && styles.cardOverdue, done && styles.cardDone]}>
      {done ? (
        <View style={[styles.check, { backgroundColor: mod.accent, borderColor: mod.accent }]}>
          <Ionicons name="checkmark" size={20} color="#fff" />
        </View>
      ) : (
        <Pressable onPress={onCheck} hitSlop={8} style={({ pressed }) => [styles.check, { borderColor: mod.accent }, pressed && styles.pressed]}>
          <Ionicons name="checkmark" size={20} color={mod.accent} />
        </Pressable>
      )}

      <View style={styles.center}>
        <View style={styles.titleRow}>
          <View style={[styles.iconBox, { backgroundColor: mod.tint }]}>
            <Ionicons name={(template.icon || 'checkbox-outline') as never} size={14} color={mod.accent} />
          </View>
          <Text style={[styles.name, done && styles.nameDone]} numberOfLines={1}>{template.name}</Text>
          {autoDone && (
            <View style={[styles.badge, { backgroundColor: MOD.treino.tint }]}>
              <Ionicons name="barbell-outline" size={11} color={MOD.treino.accent} />
              <Text style={[styles.badgeText, { color: MOD.treino.accent }]}>Treino</Text>
            </View>
          )}
        </View>
        <Text style={[styles.sub, overdue && styles.subOverdue]}>{subtitle}</Text>
      </View>

      {!done && onMore && (
        <Pressable onPress={onMore} hitSlop={8} style={({ pressed }) => [styles.more, pressed && styles.pressed]}>
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.ink3} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii['2xl'],
    padding: 12,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.line,
  },
  cardOverdue: { borderColor: colors.primaryDeep, borderWidth: 1.5 },
  cardDone: { backgroundColor: colors.surfaceMute },
  pressed: { opacity: 0.6 },
  check: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { flex: 1, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBox: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  name: { flex: 1, fontSize: 14.5, fontWeight: '600', color: colors.ink },
  nameDone: { color: colors.ink3, textDecorationLine: 'line-through' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: radii.pill },
  badgeText: { fontSize: 10.5, fontWeight: '700' },
  sub: { fontSize: 12.5, color: colors.ink3, marginLeft: 32 },
  subOverdue: { color: colors.primaryDeep, fontWeight: '600' },
  more: { width: 36, height: 36, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
});
