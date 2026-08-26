import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type {
  TodoRecurrence,
  TodoOverduePolicy,
  TodoCancelPolicy,
  ShopCat,
} from '@vitale/shared';
import { SHOP_CATS } from '@vitale/shared';
import { useTodosStore } from '../../store/todos.store';
import { colors, fonts, moduleColors, radii, shadows, spacing, themed, useTheme } from '../../theme';

type Kind = Extract<TodoRecurrence['kind'], 'none' | 'monthly' | 'weekly' | 'yearly' | 'after_completion'>;

const KINDS: { key: Kind; label: string }[] = [
  { key: 'none', label: 'Avulso' },
  { key: 'weekly', label: 'Semanal' },
  { key: 'monthly', label: 'Mensal' },
  { key: 'after_completion', label: 'Após comprar' },
  { key: 'yearly', label: 'Anual' },
];

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];


function parseNum(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export default function ComprasEditorScreen() {
  useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const allTemplates = useTodosStore((s) => s.allTemplates);
  const load = useTodosStore((s) => s.load);
  const loadAll = useTodosStore((s) => s.loadAll);
  const createTemplate = useTodosStore((s) => s.createTemplate);
  const updateTemplate = useTodosStore((s) => s.updateTemplate);

  const existing = useMemo(() => allTemplates.find((t) => t.id === id), [allTemplates, id]);

  const [name, setName] = useState('');
  const [kind, setKind] = useState<Kind>('none');
  const [monthlyDay, setMonthlyDay] = useState('1');
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [yearMonth, setYearMonth] = useState('1');
  const [yearDay, setYearDay] = useState('1');
  const [intervalDays, setIntervalDays] = useState('14');
  const [overdue, setOverdue] = useState<TodoOverduePolicy>('carry');
  const [cancelPolicy, setCancelPolicy] = useState<TodoCancelPolicy>('manual');
  // Campos de compras
  const [qty, setQty] = useState('');
  const [cat, setCat] = useState<ShopCat>('Outros');
  const [price, setPrice] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
    loadAll();
  }, [load, loadAll]);

  useEffect(() => {
    if (existing && !hydrated) {
      setName(existing.name);
      const k = existing.recurrence.kind;
      if (k === 'none' || k === 'monthly' || k === 'weekly' || k === 'yearly' || k === 'after_completion') {
        setKind(k);
      }
      const r = existing.recurrence;
      if (r.kind === 'monthly') setMonthlyDay(String(r.day));
      if (r.kind === 'weekly') setWeekdays(r.weekdays);
      if (r.kind === 'yearly') { setYearMonth(String(r.month)); setYearDay(String(r.day)); }
      if (r.kind === 'after_completion') setIntervalDays(String(r.intervalDays));
      setOverdue(existing.overdue);
      setCancelPolicy(existing.cancelPolicy);
      // campos de compras
      const m = existing.meta ?? {};
      if (m.qty) setQty(String(m.qty));
      if (m.cat) setCat(m.cat as ShopCat);
      if (m.price != null) setPrice(String(m.price));
      setHydrated(true);
    }
  }, [existing, hydrated]);

  const toggleWeekday = (d: number) =>
    setWeekdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d]));

  const setCancel = (c: TodoCancelPolicy) => {
    setCancelPolicy(c);
    if (c === 'auto') setOverdue('expire');
  };

  function buildRecurrence(): TodoRecurrence | null {
    switch (kind) {
      case 'none': return { kind: 'none' };
      case 'monthly': {
        const d = parseNum(monthlyDay);
        return d && d >= 1 && d <= 31 ? { kind: 'monthly', day: d } : null;
      }
      case 'weekly':
        return weekdays.length ? { kind: 'weekly', weekdays: [...weekdays].sort((a, b) => a - b) } : null;
      case 'yearly': {
        const m = parseNum(yearMonth);
        const d = parseNum(yearDay);
        return m && d && m >= 1 && m <= 12 && d >= 1 && d <= 31 ? { kind: 'yearly', month: m, day: d } : null;
      }
      case 'after_completion': {
        const n = parseNum(intervalDays);
        return n && n > 0 ? { kind: 'after_completion', intervalDays: Math.round(n) } : null;
      }
    }
  }

  const recurrence = buildRecurrence();
  const valid = name.trim() !== '' && recurrence != null;

  const onSave = async () => {
    if (!valid || !recurrence || saving) return;
    const meta: Record<string, unknown> = { cat };
    if (qty.trim()) meta.qty = qty.trim();
    const pn = parseNum(price);
    if (pn != null && pn > 0) meta.price = pn;

    setSaving(true);
    try {
      if (id) {
        await updateTemplate(id, {
          name: name.trim(),
          icon: 'cart-outline',
          color: 'compras',
          module: 'compras',
          recurrence,
          overdue,
          cancel_policy: cancelPolicy,
          meta,
        });
      } else {
        await createTemplate({
          name: name.trim(),
          icon: 'cart-outline',
          color: 'compras',
          module: 'compras',
          recurrence,
          overdue,
          cancelPolicy,
          meta,
        });
      }
      router.back();
    } catch (e) {
      console.error('Erro ao salvar item de compras:', e);
      setSaving(false);
    }
  };

  const Segment = <T extends string>(opts: { id: T; label: string }[], value: T, onPick: (v: T) => void) => (
    <View style={styles.segment}>
      {opts.map((o) => {
        const active = value === o.id;
        return (
          <Pressable key={o.id} onPress={() => onPick(o.id)} style={[styles.segmentBtn, active && styles.segmentBtnActive]}>
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>{id ? 'Editar item' : 'Novo item de compras'}</Text>
        <View style={styles.backBtn} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Nome */}
          <Text style={styles.label}>Nome do item</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Ex.: Frango, Leite, Shampoo"
            placeholderTextColor={colors.ink4}
            style={styles.input}
            autoFocus={!id}
          />

          {/* Campos de compras */}
          <Text style={styles.sectionHeader}>Detalhes</Text>

          <Text style={styles.label}>Quantidade</Text>
          <TextInput
            value={qty}
            onChangeText={setQty}
            placeholder="Ex.: 500g, 2 caixas, 1 unidade"
            placeholderTextColor={colors.ink4}
            style={styles.input}
          />

          <Text style={styles.label}>Categoria</Text>
          <View style={styles.chips}>
            {SHOP_CATS.map((c) => (
              <Pressable key={c} onPress={() => setCat(c)} style={[styles.chip, cat === c && { backgroundColor: moduleColors('compras').accent }]}>
                <Text style={[styles.chipText, cat === c && styles.chipTextActive]}>{c}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Preço estimado (R$)</Text>
          <TextInput
            value={price}
            onChangeText={setPrice}
            placeholder="Ex.: 12,90"
            placeholderTextColor={colors.ink4}
            keyboardType="decimal-pad"
            style={styles.input}
          />

          {/* Recorrência */}
          <Text style={styles.sectionHeader}>Recorrência</Text>

          <Text style={styles.label}>Tipo</Text>
          <View style={styles.chips}>
            {KINDS.map((k) => (
              <Pressable key={k.key} onPress={() => setKind(k.key)} style={[styles.chip, kind === k.key && { backgroundColor: moduleColors('compras').accent }]}>
                <Text style={[styles.chipText, kind === k.key && styles.chipTextActive]}>{k.label}</Text>
              </Pressable>
            ))}
          </View>

          {kind === 'monthly' && (
            <>
              <Text style={styles.label}>Dia do mês</Text>
              <TextInput value={monthlyDay} onChangeText={setMonthlyDay} keyboardType="number-pad" style={styles.input} />
            </>
          )}
          {kind === 'weekly' && (
            <>
              <Text style={styles.label}>Dias da semana</Text>
              <View style={styles.chips}>
                {WEEKDAYS.map((w, i) => (
                  <Pressable key={i} onPress={() => toggleWeekday(i)} style={[styles.dayChip, weekdays.includes(i) && { backgroundColor: moduleColors('compras').accent, borderColor: moduleColors('compras').accent }]}>
                    <Text style={[styles.dayText, weekdays.includes(i) && styles.chipTextActive]}>{w}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
          {kind === 'yearly' && (
            <View style={styles.rowFlex}>
              <View style={styles.flex}>
                <Text style={styles.label}>Mês</Text>
                <TextInput value={yearMonth} onChangeText={setYearMonth} keyboardType="number-pad" style={styles.input} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.label}>Dia</Text>
                <TextInput value={yearDay} onChangeText={setYearDay} keyboardType="number-pad" style={styles.input} />
              </View>
            </View>
          )}
          {kind === 'after_completion' && (
            <>
              <Text style={styles.label}>Dias após comprar</Text>
              <TextInput value={intervalDays} onChangeText={setIntervalDays} keyboardType="number-pad" style={styles.input} />
            </>
          )}

          {/* Comportamento */}
          <Text style={styles.sectionHeader}>Comportamento</Text>

          <Text style={styles.label}>Se não comprar no dia</Text>
          {Segment(
            [
              { id: 'carry' as const, label: 'Acumula' },
              { id: 'expire' as const, label: 'Expira' },
            ],
            overdue,
            setOverdue,
          )}

          <Text style={styles.label}>Cancelável</Text>
          {Segment(
            [
              { id: 'manual' as const, label: 'Sim' },
              { id: 'none' as const, label: 'Obrigatório' },
              { id: 'auto' as const, label: 'Auto' },
            ],
            cancelPolicy,
            setCancel,
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Pressable
          onPress={onSave}
          disabled={!valid || saving}
          style={({ pressed }) => [styles.saveBtn, (!valid || saving) && styles.saveDisabled, pressed && styles.pressed]}
        >
          {saving ? (
            <View style={styles.saveRow}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.saveText}>Salvando…</Text>
            </View>
          ) : (
            <Text style={styles.saveText}>{id ? 'Salvar' : 'Adicionar à lista'}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backBtn: {
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

  scroll: { paddingHorizontal: spacing.lg, paddingBottom: 24, gap: 4 },
  sectionHeader: {
    fontSize: 16,
    fontFamily: fonts.serif,
    color: colors.ink,
    marginTop: spacing.xl,
    marginBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingBottom: 6,
  },
  label: { fontSize: 13, fontFamily: fonts.sansSemiBold, color: colors.ink2, marginTop: spacing.lg, marginBottom: 6 },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15, fontFamily: fonts.sans,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.line,
  },
  rowFlex: { flexDirection: 'row', gap: spacing.md },

  segment: { flexDirection: 'row', backgroundColor: colors.surfaceMute, borderRadius: radii.pill, padding: 3 },
  segmentBtn: { flex: 1, paddingVertical: 9, borderRadius: radii.pill, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: colors.surface, ...shadows.sm },
  segmentText: { fontSize: 13.5, color: colors.ink3, fontFamily: fonts.sansMedium },
  segmentTextActive: { color: colors.ink, fontFamily: fonts.sansBold },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.pill, backgroundColor: colors.surfaceMute },
  chipText: { fontSize: 13, color: colors.ink2, fontFamily: fonts.sansSemiBold },
  chipTextActive: { color: '#fff' },
  dayChip: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line,
  },
  dayText: { fontSize: 14, color: colors.ink2, fontFamily: fonts.sansBold },

  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
  },
  saveBtn: {
    borderRadius: radii.lg,
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: moduleColors('compras').accent,
  },
  saveDisabled: { opacity: 0.4 },
  saveRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  saveText: { fontSize: 16, fontFamily: fonts.sansBold, color: '#fff' },
}));
