import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type {
  TodoModule,
  TodoRecurrence,
  TodoOverduePolicy,
  TodoCancelPolicy,
} from '@vitale/shared';
import { useTodosStore } from '../../store/todos.store';
import { colors, spacing, radii, shadows, MOD } from '../../theme';

type Kind = TodoRecurrence['kind'];

const MODULES: { key: TodoModule; label: string }[] = [
  { key: 'geral', label: 'Geral' },
  { key: 'casa', label: 'Casa' },
  { key: 'financas', label: 'Finanças' },
  { key: 'compras', label: 'Compras' },
  { key: 'saude', label: 'Saúde' },
];

const KINDS: { key: Kind; label: string }[] = [
  { key: 'none', label: 'Avulsa' },
  { key: 'monthly', label: 'Mensal' },
  { key: 'weekly', label: 'Semanal' },
  { key: 'yearly', label: 'Anual' },
  { key: 'after_completion', label: 'Após concluir' },
  { key: 'usage', label: 'Por uso' },
  { key: 'event', label: 'Por evento' },
  { key: 'stock', label: 'Por estoque' },
];

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

const ICONS = [
  'checkbox-outline', 'home', 'cash-outline', 'cart-outline', 'trash-outline', 'water',
  'call-outline', 'medkit-outline', 'car-outline', 'paw-outline', 'document-text-outline', 'calendar-outline',
] as const;

const COLORS: { key: string; accent: string }[] = [
  { key: 'tarefa', accent: MOD.tarefa.accent },
  { key: 'casa', accent: MOD.casa.accent },
  { key: 'financas', accent: MOD.financas.accent },
  { key: 'compras', accent: MOD.compras.accent },
  { key: 'habito', accent: MOD.habito.accent },
  { key: 'treino', accent: MOD.treino.accent },
  { key: 'food', accent: MOD.food.accent },
];

function parseNum(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export default function TodoEditorScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const allTemplates = useTodosStore((s) => s.allTemplates);
  const loadAll = useTodosStore((s) => s.loadAll);
  const createTemplate = useTodosStore((s) => s.createTemplate);
  const updateTemplate = useTodosStore((s) => s.updateTemplate);

  const existing = useMemo(() => allTemplates.find((t) => t.id === id), [allTemplates, id]);

  const [name, setName] = useState('');
  const [mod, setMod] = useState<TodoModule>('geral');
  const [kind, setKind] = useState<Kind>('none');
  const [monthlyDay, setMonthlyDay] = useState('1');
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [yearMonth, setYearMonth] = useState('1');
  const [yearDay, setYearDay] = useState('1');
  const [intervalDays, setIntervalDays] = useState('15');
  const [meterUnit, setMeterUnit] = useState('km');
  const [every, setEvery] = useState('5000');
  const [eventLabel, setEventLabel] = useState('');
  const [stockRef, setStockRef] = useState('');
  const [overdue, setOverdue] = useState<TodoOverduePolicy>('carry');
  const [cancelPolicy, setCancelPolicy] = useState<TodoCancelPolicy>('manual');
  const [icon, setIcon] = useState<string>('checkbox-outline');
  const [color, setColor] = useState<string>('tarefa');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (id && !existing) loadAll();
  }, [id, existing, loadAll]);

  useEffect(() => {
    if (existing && !hydrated) {
      setName(existing.name);
      setMod(existing.module);
      setKind(existing.recurrence.kind);
      const r = existing.recurrence;
      if (r.kind === 'monthly') setMonthlyDay(String(r.day));
      if (r.kind === 'weekly') setWeekdays(r.weekdays);
      if (r.kind === 'yearly') { setYearMonth(String(r.month)); setYearDay(String(r.day)); }
      if (r.kind === 'after_completion') setIntervalDays(String(r.intervalDays));
      if (r.kind === 'usage') { setMeterUnit(r.meterUnit); setEvery(String(r.every)); }
      if (r.kind === 'event') setEventLabel(r.label);
      if (r.kind === 'stock') setStockRef(r.shopItemRef ?? '');
      setOverdue(existing.overdue);
      setCancelPolicy(existing.cancelPolicy);
      setIcon(existing.icon || 'checkbox-outline');
      setColor(existing.color || 'tarefa');
      setHydrated(true);
    }
  }, [existing, hydrated]);

  const toggleWeekday = (d: number) =>
    setWeekdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d]));

  // auto: cancelamento automático após o dia ⇒ expira
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
      case 'usage': {
        const e = parseNum(every);
        return meterUnit.trim() && e && e > 0 ? { kind: 'usage', meterUnit: meterUnit.trim(), every: e } : null;
      }
      case 'event':
        return eventLabel.trim() ? { kind: 'event', label: eventLabel.trim() } : null;
      case 'stock':
        return { kind: 'stock', shopItemRef: stockRef.trim() || undefined };
    }
  }

  const recurrence = buildRecurrence();
  const valid = name.trim() !== '' && recurrence != null;

  const onSave = async () => {
    if (!valid || !recurrence) return;
    if (id) {
      await updateTemplate(id, {
        name: name.trim(),
        icon,
        color,
        module: mod,
        recurrence,
        overdue,
        cancel_policy: cancelPolicy,
      });
    } else {
      await createTemplate({
        name: name.trim(),
        icon,
        color,
        module: mod,
        recurrence,
        overdue,
        cancelPolicy,
        meter: kind === 'usage' ? 0 : undefined,
      });
    }
    router.back();
  };

  const accent = COLORS.find((c) => c.key === color)?.accent ?? MOD.tarefa.accent;

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
        <Text style={styles.headerTitle}>{id ? 'Editar tarefa' : 'Nova tarefa'}</Text>
        <View style={styles.backBtn} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Nome */}
          <Text style={styles.label}>Nome</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Ex.: Pagar aluguel, Descer o lixo"
            placeholderTextColor={colors.ink4}
            style={styles.input}
          />

          {/* Módulo */}
          <Text style={styles.label}>Módulo</Text>
          <View style={styles.chips}>
            {MODULES.map((m) => (
              <Pressable key={m.key} onPress={() => setMod(m.key)} style={[styles.chip, mod === m.key && { backgroundColor: accent }]}>
                <Text style={[styles.chipText, mod === m.key && styles.chipTextActive]}>{m.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Recorrência */}
          <Text style={styles.label}>Recorrência</Text>
          <View style={styles.chips}>
            {KINDS.map((k) => (
              <Pressable key={k.key} onPress={() => setKind(k.key)} style={[styles.chip, kind === k.key && { backgroundColor: accent }]}>
                <Text style={[styles.chipText, kind === k.key && styles.chipTextActive]}>{k.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Campos condicionais por recorrência */}
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
                  <Pressable key={i} onPress={() => toggleWeekday(i)} style={[styles.dayChip, weekdays.includes(i) && { backgroundColor: accent, borderColor: accent }]}>
                    <Text style={[styles.dayText, weekdays.includes(i) && styles.chipTextActive]}>{w}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
          {kind === 'yearly' && (
            <View style={styles.row}>
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
              <Text style={styles.label}>Dias após concluir</Text>
              <TextInput value={intervalDays} onChangeText={setIntervalDays} keyboardType="number-pad" style={styles.input} />
            </>
          )}
          {kind === 'usage' && (
            <View style={styles.row}>
              <View style={styles.flex}>
                <Text style={styles.label}>A cada</Text>
                <TextInput value={every} onChangeText={setEvery} keyboardType="decimal-pad" style={styles.input} />
              </View>
              <View style={styles.unitCol}>
                <Text style={styles.label}>Unidade</Text>
                <TextInput value={meterUnit} onChangeText={setMeterUnit} autoCapitalize="none" style={styles.input} />
              </View>
            </View>
          )}
          {kind === 'event' && (
            <>
              <Text style={styles.label}>Evento (rótulo)</Text>
              <TextInput value={eventLabel} onChangeText={setEventLabel} placeholder="Ex.: depois que chover" placeholderTextColor={colors.ink4} style={styles.input} />
            </>
          )}
          {kind === 'stock' && (
            <>
              <Text style={styles.label}>Item (opcional)</Text>
              <TextInput value={stockRef} onChangeText={setStockRef} placeholder="Ex.: Café" placeholderTextColor={colors.ink4} style={styles.input} />
            </>
          )}

          {/* Se não fizer no dia */}
          <Text style={styles.label}>Se não fizer no dia</Text>
          {Segment(
            [
              { id: 'carry' as const, label: 'Acumula' },
              { id: 'expire' as const, label: 'Expira' },
            ],
            overdue,
            setOverdue,
          )}

          {/* Cancelamento */}
          <Text style={styles.label}>Cancelável</Text>
          {Segment(
            [
              { id: 'manual' as const, label: 'Sim' },
              { id: 'none' as const, label: 'Obrigatória' },
              { id: 'auto' as const, label: 'Auto' },
            ],
            cancelPolicy,
            setCancel,
          )}

          {/* Ícone */}
          <Text style={styles.label}>Ícone</Text>
          <View style={styles.chips}>
            {ICONS.map((ic) => {
              const active = icon === ic;
              return (
                <Pressable key={ic} onPress={() => setIcon(ic)} style={[styles.iconChip, active && { backgroundColor: accent, borderColor: accent }]}>
                  <Ionicons name={ic as never} size={20} color={active ? '#fff' : colors.ink2} />
                </Pressable>
              );
            })}
          </View>

          {/* Cor */}
          <Text style={styles.label}>Cor</Text>
          <View style={styles.chips}>
            {COLORS.map((c) => (
              <Pressable key={c.key} onPress={() => setColor(c.key)} style={[styles.swatch, { backgroundColor: c.accent }, color === c.key && styles.swatchActive]}>
                {color === c.key && <Ionicons name="checkmark" size={16} color="#fff" />}
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Pressable onPress={onSave} disabled={!valid} style={({ pressed }) => [styles.saveBtn, { backgroundColor: accent }, !valid && styles.saveDisabled, pressed && styles.pressed]}>
          <Text style={styles.saveText}>{id ? 'Salvar' : 'Criar tarefa'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 20, fontFamily: 'InstrumentSerif', color: colors.ink },

  scroll: { paddingHorizontal: spacing.lg, paddingBottom: 24, gap: 4 },
  label: { fontSize: 13, fontWeight: '600', color: colors.ink2, marginTop: spacing.lg, marginBottom: 6 },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.line,
  },
  row: { flexDirection: 'row', gap: spacing.md },
  unitCol: { width: 110 },

  segment: { flexDirection: 'row', backgroundColor: colors.surfaceMute, borderRadius: radii.pill, padding: 3 },
  segmentBtn: { flex: 1, paddingVertical: 9, borderRadius: radii.pill, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: colors.surface, ...shadows.sm },
  segmentText: { fontSize: 13.5, color: colors.ink3, fontWeight: '500' },
  segmentTextActive: { color: colors.ink, fontWeight: '700' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.pill, backgroundColor: colors.surfaceMute },
  chipText: { fontSize: 13, color: colors.ink2, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  dayChip: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line,
  },
  dayText: { fontSize: 14, color: colors.ink2, fontWeight: '700' },

  iconChip: {
    width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line,
  },
  swatch: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  swatchActive: { borderWidth: 2.5, borderColor: colors.ink },

  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.bg },
  saveBtn: { borderRadius: radii.lg, paddingVertical: 15, alignItems: 'center' },
  saveDisabled: { opacity: 0.4 },
  saveText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
