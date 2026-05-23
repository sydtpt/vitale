import React, { useEffect } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TodoTemplate, TodoOccurrence, ShopMeta, ShopCat } from '@vitale/shared';
import { SHOP_CATS } from '@vitale/shared';
import * as Haptics from 'expo-haptics';
import { useTodosStore } from '../../store/todos.store';
import { useAuthStore } from '../../store/auth.store';
import { localDateStr, isOverdue } from '../../lib/todo-logic';
import { describeRecurrence } from '../../lib/todo-format';
import { colors, spacing, radii, shadows, MOD } from '../../theme';

const ACCENT = MOD.compras.accent;
const TINT = MOD.compras.tint;

function shopMeta(t: TodoTemplate): ShopMeta {
  const m = t.meta ?? {};
  return {
    qty: (m.qty as string | undefined),
    cat: ((m.cat as ShopCat | undefined) ?? 'Outros'),
    price: (m.price as number | undefined),
  };
}

interface ItemRowProps {
  template: TodoTemplate;
  occurrence: TodoOccurrence;
  onDone: () => void;
  onMore: () => void;
  done?: boolean;
}

function ItemRow({ template, occurrence, onDone, onMore, done = false }: ItemRowProps) {
  const meta = shopMeta(template);
  const overdue = !done && isOverdue(occurrence);

  const onCheck = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onDone();
  };

  return (
    <View style={[styles.row, overdue && styles.rowOverdue, done && styles.rowDone]}>
      {done ? (
        <View style={[styles.check, { backgroundColor: ACCENT, borderColor: ACCENT }]}>
          <Ionicons name="checkmark" size={18} color="#fff" />
        </View>
      ) : (
        <Pressable onPress={onCheck} hitSlop={8} style={({ pressed }) => [styles.check, { borderColor: ACCENT }, pressed && styles.pressed]}>
          <Ionicons name="checkmark" size={18} color={ACCENT} />
        </Pressable>
      )}

      <View style={styles.rowBody}>
        <Text style={[styles.itemName, done && styles.itemNameDone]} numberOfLines={1}>
          {template.name}
        </Text>
        <Text style={styles.itemSub}>
          {meta.qty ? meta.qty : describeRecurrence(template.recurrence)}
          {meta.price != null ? ` · R$ ${meta.price.toFixed(2).replace('.', ',')}` : ''}
        </Text>
      </View>

      {meta.qty ? (
        <View style={styles.qtyBadge}>
          <Text style={styles.qtyText}>{meta.qty}</Text>
        </View>
      ) : null}

      {!done && (
        <Pressable onPress={onMore} hitSlop={8} style={({ pressed }) => [styles.moreBtn, pressed && styles.pressed]}>
          <Ionicons name="ellipsis-horizontal" size={18} color={colors.ink3} />
        </Pressable>
      )}
    </View>
  );
}

export default function ComprasScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const templates = useTodosStore((s) => s.templates);
  const occurrences = useTodosStore((s) => s.occurrences);
  const loading = useTodosStore((s) => s.loading);
  const load = useTodosStore((s) => s.load);
  const resolve = useTodosStore((s) => s.resolve);
  const skip = useTodosStore((s) => s.skip);
  const cancel = useTodosStore((s) => s.cancel);
  const user = useAuthStore((s) => s.user);

  useEffect(() => { load(); }, [load, user?.id]);

  const comprasTemplates = templates.filter((t) => t.module === 'compras');
  const tplById = new Map(comprasTemplates.map((t) => [t.id, t]));
  const today = localDateStr();

  const pending = occurrences.filter(
    (o) => o.status === 'pending' && tplById.has(o.templateId),
  );

  const doneToday = occurrences.filter(
    (o) =>
      o.status === 'done' &&
      o.doneAt != null &&
      localDateStr(new Date(o.doneAt)) === today &&
      tplById.has(o.templateId),
  );

  // Agrupar pendentes por categoria, respeitando a ordem de SHOP_CATS
  const grouped = new Map<ShopCat | 'Outros', Array<{ t: TodoTemplate; o: TodoOccurrence }>>();
  for (const o of pending) {
    const t = tplById.get(o.templateId)!;
    const cat = shopMeta(t).cat;
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push({ t, o });
  }

  const catOrder: Array<ShopCat | 'Outros'> = [...SHOP_CATS];
  const sortedCats = catOrder.filter((c) => grouped.has(c));

  const totalEstimate = pending.reduce((sum, o) => {
    const t = tplById.get(o.templateId)!;
    return sum + (shopMeta(t).price ?? 0);
  }, 0);

  const empty = pending.length === 0 && doneToday.length === 0;

  const onMore = (t: TodoTemplate, o: TodoOccurrence) => {
    Alert.alert(t.name, undefined, [
      { text: 'Editar item', onPress: () => router.push({ pathname: '/compras/editor', params: { id: t.id } }) },
      { text: 'Pular esta', onPress: () => skip(o.id) },
      { text: 'Remover', style: 'destructive', onPress: () => cancel(o.id) },
      { text: 'Fechar', style: 'cancel' },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Compras</Text>
        <Pressable onPress={() => router.push('/compras/editor')} hitSlop={12} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
          <Ionicons name="add" size={24} color={colors.ink} />
        </Pressable>
      </View>

      {totalEstimate > 0 && (
        <View style={styles.estimateBanner}>
          <Ionicons name="pricetag-outline" size={14} color={ACCENT} />
          <Text style={styles.estimateText}>
            Estimativa: <Text style={styles.estimateValue}>R$ {totalEstimate.toFixed(2).replace('.', ',')}</Text>
          </Text>
        </View>
      )}

      {loading && occurrences.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : empty ? (
        <View style={styles.center}>
          <Ionicons name="cart-outline" size={40} color={colors.ink4} />
          <Text style={styles.emptyTitle}>Lista vazia</Text>
          <Text style={styles.emptyText}>Adicione itens avulsos ou recorrentes para montar sua lista de mercado.</Text>
          <Pressable onPress={() => router.push('/compras/editor')} style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.ctaText}>Adicionar item</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {sortedCats.map((cat) => {
            const items = grouped.get(cat)!;
            const done = items.filter(({ o }) => o.status === 'done').length;
            return (
              <View key={cat}>
                <View style={styles.catHeader}>
                  <Text style={styles.catTitle}>{cat}</Text>
                  <Text style={styles.catCount}>{items.length}</Text>
                </View>
                <View style={styles.card}>
                  {items.map(({ t, o }) => (
                    <ItemRow
                      key={o.id}
                      template={t}
                      occurrence={o}
                      onDone={() => resolve(o.id, 'done')}
                      onMore={() => onMore(t, o)}
                    />
                  ))}
                </View>
              </View>
            );
          })}

          {doneToday.length > 0 && (
            <>
              <Text style={styles.section}>Comprados hoje</Text>
              <View style={styles.card}>
                {doneToday.map((o) => {
                  const t = tplById.get(o.templateId)!;
                  return (
                    <ItemRow
                      key={o.id}
                      template={t}
                      occurrence={o}
                      onDone={() => {}}
                      onMore={() => {}}
                      done
                    />
                  );
                })}
              </View>
            </>
          )}
          <View style={{ height: 32 }} />
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

  estimateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: TINT,
    borderRadius: radii.xl,
  },
  estimateText: { fontSize: 13, color: colors.ink2 },
  estimateValue: { fontWeight: '700', color: ACCENT },

  scroll: { paddingHorizontal: spacing.lg, paddingBottom: 40 },

  catHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    marginBottom: spacing.xs,
    marginHorizontal: 4,
  },
  catTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.ink2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  catCount: {
    fontSize: 12,
    fontWeight: '600',
    color: ACCENT,
    backgroundColor: TINT,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },

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

  card: {
    backgroundColor: colors.surface,
    borderRadius: radii['2xl'],
    overflow: 'hidden',
    ...shadows.card,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowOverdue: { backgroundColor: '#FFF5F5' },
  rowDone: { opacity: 0.55 },

  check: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  rowBody: { flex: 1 },
  itemName: { fontSize: 14.5, fontWeight: '600', color: colors.ink },
  itemNameDone: { color: colors.ink3, textDecorationLine: 'line-through' },
  itemSub: { fontSize: 12.5, color: colors.ink3, marginTop: 2 },

  qtyBadge: {
    backgroundColor: TINT,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  qtyText: { fontSize: 12, fontWeight: '700', color: ACCENT },

  moreBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.ink, marginTop: spacing.sm },
  emptyText: { fontSize: 13.5, color: colors.ink3, textAlign: 'center', lineHeight: 19 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: ACCENT,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: radii.pill,
    marginTop: spacing.md,
  },
  ctaText: { color: '#fff', fontSize: 14.5, fontWeight: '700' },
});
