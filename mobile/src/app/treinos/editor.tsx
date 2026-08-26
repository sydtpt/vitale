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
  Alert,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PlannedWorkout } from '@vitale/shared';
import { usePlannedWorkoutsStore } from '../../store/planned-workouts.store';
import { colors, fonts, moduleColors, radii, shadows, spacing, themed, useTheme } from '../../theme';
import { HeaderSpacer } from '../../components/ui/HeaderSpacer';

type Kind = PlannedWorkout['kind'];

const KINDS: { key: Kind; label: string; mod: string }[] = [
  { key: 'strength', label: 'Força', mod: 'treino' },
  { key: 'endurance', label: 'Endurance', mod: 'agua' },
  { key: 'easy', label: 'Leve', mod: 'habito' },
  { key: 'rest', label: 'Descanso', mod: 'casa' },
];

export default function TreinoEditorScreen() {
  useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, date } = useLocalSearchParams<{ id?: string; date?: string }>();

  const planned = usePlannedWorkoutsStore((s) => s.planned);
  const load = usePlannedWorkoutsStore((s) => s.load);
  const createWorkout = usePlannedWorkoutsStore((s) => s.createWorkout);
  const updateWorkout = usePlannedWorkoutsStore((s) => s.updateWorkout);
  const removeWorkout = usePlannedWorkoutsStore((s) => s.removeWorkout);

  const existing = useMemo(() => planned.find((p) => p.id === id), [planned, id]);

  const [type, setType] = useState('');
  const [kind, setKind] = useState<Kind>('strength');
  const [durMin, setDurMin] = useState('45');
  const [distKm, setDistKm] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id && !existing) load();
  }, [id, existing, load]);

  useEffect(() => {
    if (existing && !hydrated) {
      setType(existing.type);
      setKind(existing.kind);
      setDurMin(String(existing.durMin));
      setDistKm(existing.distKm != null ? String(existing.distKm) : '');
      setHydrated(true);
    }
  }, [existing, hydrated]);

  const valid = type.trim() !== '';
  const accent = moduleColors(KINDS.find((k) => k.key === kind)?.mod ?? 'treino', 'treino').accent;

  const onSave = async () => {
    if (!valid || saving) return;
    const base = {
      type: type.trim(),
      kind,
      durMin: kind === 'rest' ? 0 : Number(durMin) || 0,
      distKm: kind === 'endurance' ? Number(distKm) || 0 : undefined,
    };
    setSaving(true);
    try {
      if (id) {
        await updateWorkout(id, base);
      } else {
        await createWorkout({ date: date ?? '', ...base });
      }
      router.back();
    } catch (e) {
      console.error('Erro ao salvar treino planejado:', e);
      setSaving(false);
    }
  };

  const onDelete = () => {
    if (!id) return;
    Alert.alert('Excluir treino', 'Remover este treino planejado?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await removeWorkout(id);
          router.back();
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>{id ? 'Editar treino' : 'Novo treino'}</Text>
        {id ? (
          <Pressable onPress={onDelete} hitSlop={12} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
            <Ionicons name="trash-outline" size={20} color={moduleColors('compras').accent} />
          </Pressable>
        ) : (
          <HeaderSpacer />
        )}
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Treino */}
          <Text style={styles.label}>Treino</Text>
          <TextInput
            value={type}
            onChangeText={setType}
            placeholder="Ex.: Pernas — Volume"
            placeholderTextColor={colors.ink4}
            style={styles.input}
          />

          {/* Intensidade */}
          <Text style={styles.label}>Intensidade</Text>
          <View style={styles.chips}>
            {KINDS.map((k) => {
              const active = kind === k.key;
              return (
                <Pressable key={k.key} onPress={() => setKind(k.key)} style={[styles.chip, active && { backgroundColor: accent }]}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{k.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Duração */}
          {kind !== 'rest' && (
            <>
              <Text style={styles.label}>Duração (min)</Text>
              <TextInput
                value={durMin}
                onChangeText={setDurMin}
                keyboardType="number-pad"
                placeholder="45"
                placeholderTextColor={colors.ink4}
                style={styles.input}
              />
            </>
          )}

          {/* Distância */}
          {kind === 'endurance' && (
            <>
              <Text style={styles.label}>Distância (km)</Text>
              <TextInput
                value={distKm}
                onChangeText={setDistKm}
                keyboardType="decimal-pad"
                placeholder="10"
                placeholderTextColor={colors.ink4}
                style={styles.input}
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Pressable
          onPress={onSave}
          disabled={!valid || saving}
          style={({ pressed }) => [styles.saveBtn, { backgroundColor: accent }, (!valid || saving) && styles.saveDisabled, pressed && styles.pressed]}
        >
          {saving ? (
            <View style={styles.saveRow}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.saveText}>Salvando…</Text>
            </View>
          ) : (
            <Text style={styles.saveText}>{id ? 'Salvar' : 'Criar treino'}</Text>
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

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.pill, backgroundColor: colors.surfaceMute },
  chipText: { fontSize: 13, color: colors.ink2, fontFamily: fonts.sansSemiBold },
  chipTextActive: { color: '#fff' },

  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.bg },
  saveBtn: { borderRadius: radii.lg, paddingVertical: 15, alignItems: 'center' },
  saveDisabled: { opacity: 0.4 },
  saveRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  saveText: { fontSize: 16, fontFamily: fonts.sansBold, color: '#fff' },
}));
