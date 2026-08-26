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
import type { TodoModule } from '@vitale/shared';
import { HABIT_ICONS, DEFAULT_HABIT_ICON } from '@vitale/shared';
import { useRegistrosStore } from '../../store/registros.store';
import { habitIconToIonicon } from '../../lib/habit-icons';
import { colors, fonts, moduleColors, radii, shadows, spacing, themed, useTheme } from '../../theme';

const ICONS = HABIT_ICONS;

const MODULES: { key: TodoModule; label: string }[] = [
  { key: 'geral', label: 'Geral' },
  { key: 'casa', label: 'Casa' },
  { key: 'financas', label: 'Finanças' },
  { key: 'compras', label: 'Compras' },
  { key: 'saude', label: 'Saúde' },
];

// Função, não constante: as cores dependem do tema e da paleta ativos, e um
// array no escopo do módulo as congelaria no import.
function colorOptions(): { key: string; accent: string }[] {
  return [
    { key: 'habito', accent: moduleColors('habito').accent },
    { key: 'tarefa', accent: moduleColors('tarefa').accent },
    { key: 'agua', accent: moduleColors('agua').accent },
    { key: 'food', accent: moduleColors('food').accent },
    { key: 'treino', accent: moduleColors('treino').accent },
    { key: 'casa', accent: moduleColors('casa').accent },
    { key: 'compras', accent: moduleColors('compras').accent },
    { key: 'financas', accent: moduleColors('financas').accent },
  ];
}

export default function RegistroEditorScreen() {
  useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const registros = useRegistrosStore((s) => s.registros);
  const load = useRegistrosStore((s) => s.load);
  const createRegistro = useRegistrosStore((s) => s.createRegistro);
  const updateRegistro = useRegistrosStore((s) => s.updateRegistro);

  const existing = useMemo(() => registros.find((r) => r.id === id), [registros, id]);

  const [name, setName] = useState('');
  const [mod, setMod] = useState<TodoModule>('geral');
  const [icon, setIcon] = useState<string>(DEFAULT_HABIT_ICON);
  const [color, setColor] = useState<string>('habito');
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id && !existing) load();
  }, [id, existing, load]);

  useEffect(() => {
    if (existing && !hydrated) {
      setName(existing.name);
      setMod(existing.module);
      setIcon(existing.icon || DEFAULT_HABIT_ICON);
      setColor(existing.color || 'habito');
      setHydrated(true);
    }
  }, [existing, hydrated]);

  const valid = name.trim() !== '';

  const onSave = async () => {
    if (!valid || saving) return;
    const base = { name: name.trim(), icon, color, module: mod };
    setSaving(true);
    try {
      if (id) {
        await updateRegistro(id, base);
      } else {
        await createRegistro(base);
      }
      router.back();
    } catch (e) {
      console.error('Erro ao salvar registro:', e);
      setSaving(false);
    }
  };

  const accent = moduleColors(color, 'habito').accent;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>{id ? 'Editar registro' : 'Novo registro'}</Text>
        {id ? (
          <Pressable
            onPress={() => router.push({ pathname: '/registros/marcar', params: { id } })}
            hitSlop={12}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          >
            <Ionicons name="add" size={24} color={colors.ink} />
          </Pressable>
        ) : (
          <View style={styles.backBtn} />
        )}
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Nome */}
          <Text style={styles.label}>Nome</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Ex.: Pizza, Comida japonesa, Dentista"
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

          {/* Ícone */}
          <Text style={styles.label}>Ícone</Text>
          <View style={styles.chips}>
            {ICONS.map((ic) => {
              const isActive = icon === ic;
              return (
                <Pressable key={ic} onPress={() => setIcon(ic)} style={[styles.iconChip, isActive && { backgroundColor: accent, borderColor: accent }]}>
                  <Ionicons name={habitIconToIonicon(ic)} size={20} color={isActive ? '#fff' : colors.ink2} />
                </Pressable>
              );
            })}
          </View>

          {/* Cor */}
          <Text style={styles.label}>Cor</Text>
          <View style={styles.chips}>
            {colorOptions().map((c) => (
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
          disabled={!valid || saving}
          style={({ pressed }) => [styles.saveBtn, { backgroundColor: accent }, (!valid || saving) && styles.saveDisabled, pressed && styles.pressed]}
        >
          {saving ? (
            <View style={styles.saveRow}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.saveText}>Salvando…</Text>
            </View>
          ) : (
            <Text style={styles.saveText}>{id ? 'Salvar' : 'Criar registro'}</Text>
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
  saveRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  saveText: { fontSize: 16, fontFamily: fonts.sansBold, color: '#fff' },
}));
