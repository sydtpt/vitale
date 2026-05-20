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
import type { HabitDirection } from '@vitale/shared';
import { useHabitsStore } from '../../store/habits.store';
import { colors, spacing, radii, shadows, MOD } from '../../theme';

const ICONS = [
  'water', 'cafe', 'wine', 'beer', 'flame', 'fitness',
  'walk', 'bed', 'book', 'leaf', 'heart', 'nutrition',
] as const;

const COLORS: { key: string; accent: string }[] = [
  { key: 'agua', accent: MOD.agua.accent },
  { key: 'treino', accent: MOD.treino.accent },
  { key: 'food', accent: MOD.food.accent },
  { key: 'habito', accent: MOD.habito.accent },
  { key: 'casa', accent: MOD.casa.accent },
  { key: 'compras', accent: MOD.compras.accent },
  { key: 'financas', accent: MOD.financas.accent },
];

const UNITS = ['L', 'ml', 'un', 'cig', 'min', 'km'];

function parseNum(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export default function HabitEditorScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const allHabits = useHabitsStore((s) => s.allHabits);
  const loadAll = useHabitsStore((s) => s.loadAll);
  const createHabit = useHabitsStore((s) => s.createHabit);
  const updateHabit = useHabitsStore((s) => s.updateHabit);

  const existing = useMemo(() => allHabits.find((h) => h.id === id), [allHabits, id]);

  const [name, setName] = useState('');
  const [bad, setBad] = useState(false);
  const [direction, setDirection] = useState<HabitDirection>('at_least');
  const [target, setTarget] = useState('');
  const [unit, setUnit] = useState('un');
  const [step, setStep] = useState('1');
  const [icon, setIcon] = useState<string>('flame');
  const [color, setColor] = useState<string>('habito');
  const [hydrated, setHydrated] = useState(false);

  // Garante allHabits carregado (deep-link direto ao editor) e prefill no modo edição.
  useEffect(() => {
    if (id && !existing) loadAll();
  }, [id, existing, loadAll]);

  useEffect(() => {
    if (existing && !hydrated) {
      setName(existing.name);
      setBad(existing.bad ?? false);
      setDirection(existing.direction);
      setTarget(existing.target == null ? '' : String(existing.target).replace('.', ','));
      setUnit(existing.unit);
      setStep(String(existing.step).replace('.', ','));
      setIcon(existing.icon || 'flame');
      setColor(existing.color || 'habito');
      setHydrated(true);
    }
  }, [existing, hydrated]);

  const stepN = parseNum(step);
  const targetN = parseNum(target);
  const valid = name.trim() !== '' && unit.trim() !== '' && stepN !== null && stepN > 0;

  const onSave = async () => {
    if (!valid || stepN === null) return;
    const base = {
      name: name.trim(),
      icon,
      color,
      unit: unit.trim(),
      step: stepN,
      direction,
      bad,
    };
    if (id) {
      await updateHabit(id, { ...base, target: targetN });
    } else {
      await createHabit({ ...base, target: targetN ?? undefined });
    }
    router.back();
  };

  const accent = COLORS.find((c) => c.key === color)?.accent ?? MOD.habito.accent;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>{id ? 'Editar hábito' : 'Novo hábito'}</Text>
        <View style={styles.backBtn} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Nome */}
          <Text style={styles.label}>Nome</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Ex.: Água, Cigarro, Café"
            placeholderTextColor={colors.ink4}
            style={styles.input}
          />

          {/* Hábito ruim */}
          <Pressable
            onPress={() => setBad((b) => !b)}
            style={({ pressed }) => [styles.checkRow, pressed && styles.pressed]}
          >
            <Ionicons
              name={bad ? 'checkbox' : 'square-outline'}
              size={24}
              color={bad ? accent : colors.ink3}
            />
            <View style={styles.flex}>
              <Text style={styles.checkLabel}>Hábito ruim</Text>
              <Text style={styles.checkHint}>
                {bad
                  ? 'Mostra há quantos dias você está sem fazer.'
                  : 'Mostra a sequência de dias mantendo o hábito.'}
              </Text>
            </View>
          </Pressable>

          {/* Direção */}
          <Text style={styles.label}>Tipo de meta</Text>
          <View style={styles.segment}>
            {([
              { id: 'at_least', label: 'Atingir' },
              { id: 'at_most', label: 'Não passar' },
            ] as const).map((d) => {
              const active = direction === d.id;
              return (
                <Pressable key={d.id} onPress={() => setDirection(d.id)} style={[styles.segmentBtn, active && styles.segmentBtnActive]}>
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{d.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.hint}>
            {direction === 'at_least' ? 'Bater a meta é bom (ex.: beber 4 L).' : 'Ficar abaixo do limite é bom (ex.: ≤ 5 cigarros).'}
          </Text>

          {/* Meta / limite + unidade */}
          <View style={styles.row}>
            <View style={styles.flex}>
              <Text style={styles.label}>{direction === 'at_least' ? 'Meta' : 'Limite'} (opcional)</Text>
              <TextInput
                value={target}
                onChangeText={setTarget}
                placeholder="vazio = só contar"
                placeholderTextColor={colors.ink4}
                keyboardType="decimal-pad"
                style={styles.input}
              />
            </View>
            <View style={styles.unitCol}>
              <Text style={styles.label}>Unidade</Text>
              <TextInput
                value={unit}
                onChangeText={setUnit}
                placeholder="un"
                placeholderTextColor={colors.ink4}
                style={styles.input}
                autoCapitalize="none"
              />
            </View>
          </View>
          <View style={styles.chips}>
            {UNITS.map((u) => (
              <Pressable key={u} onPress={() => setUnit(u)} style={[styles.chip, unit === u && { backgroundColor: accent }]}>
                <Text style={[styles.chipText, unit === u && styles.chipTextActive]}>{u}</Text>
              </Pressable>
            ))}
          </View>

          {/* Incremento */}
          <Text style={styles.label}>Incremento por toque</Text>
          <TextInput
            value={step}
            onChangeText={setStep}
            placeholder="Ex.: 0,25"
            placeholderTextColor={colors.ink4}
            keyboardType="decimal-pad"
            style={[styles.input, stepN !== null && stepN <= 0 && styles.inputError]}
          />
          {stepN !== null && stepN <= 0 && <Text style={styles.error}>O incremento deve ser maior que 0.</Text>}

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

      {/* Salvar */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Pressable
          onPress={onSave}
          disabled={!valid}
          style={({ pressed }) => [styles.saveBtn, { backgroundColor: accent }, !valid && styles.saveDisabled, pressed && styles.pressed]}
        >
          <Text style={styles.saveText}>{id ? 'Salvar' : 'Criar hábito'}</Text>
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
  hint: { fontSize: 12, color: colors.ink3, marginTop: 6 },
  error: { fontSize: 12, color: colors.primaryDeep, marginTop: 4 },
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
  inputError: { borderColor: colors.primaryDeep },

  row: { flexDirection: 'row', gap: spacing.md },
  unitCol: { width: 110 },

  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  checkLabel: { fontSize: 15, fontWeight: '600', color: colors.ink },
  checkHint: { fontSize: 12, color: colors.ink3, marginTop: 2 },

  segment: { flexDirection: 'row', backgroundColor: colors.surfaceMute, borderRadius: radii.pill, padding: 3 },
  segmentBtn: { flex: 1, paddingVertical: 9, borderRadius: radii.pill, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: colors.surface, ...shadows.sm },
  segmentText: { fontSize: 13.5, color: colors.ink3, fontWeight: '500' },
  segmentTextActive: { color: colors.ink, fontWeight: '700' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.pill, backgroundColor: colors.surfaceMute },
  chipText: { fontSize: 13, color: colors.ink2, fontWeight: '600' },
  chipTextActive: { color: '#fff' },

  iconChip: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  swatch: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  swatchActive: { borderWidth: 2.5, borderColor: colors.ink },

  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.bg },
  saveBtn: { borderRadius: radii.lg, paddingVertical: 15, alignItems: 'center' },
  saveDisabled: { opacity: 0.4 },
  saveText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
