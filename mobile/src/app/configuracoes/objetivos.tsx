import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DEFAULT_WEEKLY_TARGET_MIN, WHO_RANGE_MIN, WHO_RANGE_MAX } from '@vitale/shared';
import { useSettingsStore } from '../../store/settings.store';
import { colors, spacing, radii, shadows, useThemedStyles } from '../../theme';

function NumInput({ value, onChange, placeholder }: { value?: number; onChange: (v?: number) => void; placeholder: string }) {
  const styles = useThemedStyles(createStyles);
  const [text, setText] = useState(value != null ? String(value) : '');
  useEffect(() => { setText(value != null ? String(value) : ''); }, [value]);
  return (
    <TextInput
      style={styles.input}
      value={text}
      onChangeText={(t) => {
        setText(t);
        const n = parseInt(t, 10);
        onChange(isNaN(n) || t === '' ? undefined : n);
      }}
      placeholder={placeholder}
      placeholderTextColor={colors.ink3}
      keyboardType="number-pad"
    />
  );
}

export default function ObjetivosScreen() {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { preferences, loadSettings, updatePreferences } = useSettingsStore();
  const [saving, setSaving] = useState(false);

  const [calories, setCalories] = useState<number | undefined>(preferences?.nutritionCaloriesGoal);
  const [protein, setProtein] = useState<number | undefined>(preferences?.nutritionProteinG);
  const [carbs, setCarbs] = useState<number | undefined>(preferences?.nutritionCarbsG);
  const [fat, setFat] = useState<number | undefined>(preferences?.nutritionFatG);
  const [days, setDays] = useState<number | undefined>(preferences?.trainingDaysPerWeek);
  const [maxHr, setMaxHr] = useState<number | undefined>(preferences?.maxHr);
  const [weeklyTarget, setWeeklyTarget] = useState<number | undefined>(preferences?.weeklyActivityTargetMin);

  useEffect(() => {
    if (!preferences) loadSettings();
  }, []);

  useEffect(() => {
    setCalories(preferences?.nutritionCaloriesGoal);
    setProtein(preferences?.nutritionProteinG);
    setCarbs(preferences?.nutritionCarbsG);
    setFat(preferences?.nutritionFatG);
    setDays(preferences?.trainingDaysPerWeek);
    setMaxHr(preferences?.maxHr);
    setWeeklyTarget(preferences?.weeklyActivityTargetMin);
  }, [preferences]);

  const save = async () => {
    setSaving(true);
    await updatePreferences({
      nutritionCaloriesGoal: calories,
      nutritionProteinG: protein,
      nutritionCarbsG: carbs,
      nutritionFatG: fat,
      trainingDaysPerWeek: days,
      maxHr,
      weeklyActivityTargetMin: weeklyTarget,
    });
    setSaving(false);
    router.back();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </Pressable>
          <Text style={styles.headerTitle}>Objetivos</Text>
          <Pressable onPress={save} hitSlop={12} disabled={saving} style={({ pressed }) => [styles.saveBtn, pressed && styles.pressed]}>
            {saving ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={styles.saveTxt}>Salvar</Text>}
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.sectionTitle}>Nutrição diária</Text>
          <View style={styles.card}>
            {[
              { label: 'Calorias', unit: 'kcal', value: calories, set: setCalories },
              { label: 'Proteína', unit: 'g', value: protein, set: setProtein },
              { label: 'Carboidratos', unit: 'g', value: carbs, set: setCarbs },
              { label: 'Gordura', unit: 'g', value: fat, set: setFat },
            ].map((f, i, arr) => (
              <View key={f.label} style={[styles.fieldRow, i < arr.length - 1 && styles.rowBorder]}>
                <View style={styles.fieldLabel}>
                  <Text style={styles.rowLabel}>{f.label}</Text>
                  <Text style={styles.unit}>{f.unit}</Text>
                </View>
                <NumInput value={f.value} onChange={f.set} placeholder="—" />
              </View>
            ))}
          </View>

          <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>Treino</Text>
          <View style={styles.card}>
            <View style={[styles.fieldRow, styles.rowBorder]}>
              <View style={styles.fieldLabel}>
                <Text style={styles.rowLabel}>Dias por semana</Text>
                <Text style={styles.unit}>dias</Text>
              </View>
              <NumInput value={days} onChange={setDays} placeholder="—" />
            </View>
            <View style={[styles.fieldRow, styles.rowBorder]}>
              <View style={styles.fieldLabel}>
                <Text style={styles.rowLabel}>FC máxima</Text>
                <Text style={styles.unit}>bpm</Text>
              </View>
              <NumInput value={maxHr} onChange={setMaxHr} placeholder="—" />
            </View>
            <View style={styles.fieldRow}>
              <View style={styles.fieldLabel}>
                <Text style={styles.rowLabel}>Meta semanal</Text>
                <Text style={styles.unit}>min equivalentes</Text>
              </View>
              <NumInput
                value={weeklyTarget}
                onChange={setWeeklyTarget}
                placeholder={String(DEFAULT_WEEKLY_TARGET_MIN)}
              />
            </View>
          </View>
          <Text style={styles.hint}>
            FC máxima: usada nas zonas de frequência cardíaca (% da FC máxima). Use o mesmo
            valor do seu relógio para as zonas baterem.
          </Text>
          <Text style={styles.hint}>
            Meta semanal: a linha de referência do gráfico de duração no Histórico, em minutos
            moderados equivalentes — 1 min intenso vale 2. A OMS recomenda de {WHO_RANGE_MIN} a{' '}
            {WHO_RANGE_MAX} min/semana; o ganho de saúde é grande até {WHO_RANGE_MIN} e satura
            depois de {WHO_RANGE_MAX}. Em branco usa {DEFAULT_WEEKLY_TARGET_MIN}.
          </Text>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: colors.ink },
  saveBtn: { paddingHorizontal: spacing.sm },
  saveTxt: { fontSize: 15, fontWeight: '600', color: colors.primary },
  pressed: { opacity: 0.6 },
  content: { padding: spacing.lg, paddingBottom: spacing['4xl'] },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: colors.ink2, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm, paddingHorizontal: 4 },
  hint: { fontSize: 12, color: colors.ink3, marginTop: spacing.sm, paddingHorizontal: 4, lineHeight: 17 },
  card: { backgroundColor: colors.surface, borderRadius: radii.lg, overflow: 'hidden', ...shadows.card },
  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.line },
  fieldLabel: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  rowLabel: { fontSize: 15, color: colors.ink },
  unit: { fontSize: 12, color: colors.ink3 },
  input: {
    backgroundColor: colors.bg,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    color: colors.ink,
    textAlign: 'right',
    minWidth: 80,
    borderWidth: 1,
    borderColor: colors.line,
  },
});
