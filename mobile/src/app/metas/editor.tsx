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
import type { GoalActivityMetric, GoalFamily, GoalPeriodKind, GoalSource } from '@vitale/shared';
import { useGoalsStore, type NewGoal } from '../../store/goals.store';
import { useTodosStore } from '../../store/todos.store';
import { useHabitsStore } from '../../store/habits.store';
import { getActivityMeta, KNOWN_ACTIVITY_IDS } from '../../lib/workout-types';
import { colors, fonts, moduleColors, radii, shadows, spacing, themed, useTheme } from '../../theme';

type SourceKind = GoalSource['kind'];

const FAMILIES: { key: GoalFamily; label: string; hint: string }[] = [
  { key: 'cadence', label: 'Cadência', hint: '≥N por período ao longo do ano (ex.: correr 1x/mês)' },
  { key: 'milestone', label: 'Marco', hint: 'atingir um marco único no ano (ex.: meia-maratona)' },
  { key: 'cumulative', label: 'Acumulada', hint: 'somar até um alvo no ano (ex.: ler 12 livros)' },
];

const SOURCES: { key: SourceKind; label: string }[] = [
  { key: 'activity', label: 'Atividade' },
  { key: 'task', label: 'Tarefa' },
  { key: 'habit', label: 'Hábito' },
  { key: 'manual', label: 'Manual' },
];

const METRICS: { key: GoalActivityMetric; label: string }[] = [
  { key: 'count', label: 'Contagem' },
  { key: 'distance', label: 'Distância (km)' },
  { key: 'bestEffort', label: 'Distância padrão' },
];

const BEST_EFFORTS: { key: string; label: string }[] = [
  { key: 'half', label: 'Meia-maratona' },
  { key: 'marathon', label: 'Maratona' },
  { key: '10000', label: '10 km' },
  { key: '5000', label: '5 km' },
];

// Função, não constante: as cores dependem do tema e da paleta ativos, e um
// array no escopo do módulo as congelaria no import.
function colorOptions(): { key: string; accent: string }[] {
  return [
    { key: 'treino', accent: moduleColors('treino').accent },
    { key: 'habito', accent: moduleColors('habito').accent },
    { key: 'financas', accent: moduleColors('financas').accent },
    { key: 'casa', accent: moduleColors('casa').accent },
    { key: 'compras', accent: moduleColors('compras').accent },
    { key: 'tarefa', accent: moduleColors('tarefa').accent },
  ];
}

const ACTIVITY_TYPES = KNOWN_ACTIVITY_IDS.map((id) => ({ activityId: id, label: getActivityMeta(id).label }));

function parseNum(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export default function GoalEditorScreen() {
  useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const goals = useGoalsStore((s) => s.goals);
  const loaded = useGoalsStore((s) => s.loaded);
  const load = useGoalsStore((s) => s.load);
  const createGoal = useGoalsStore((s) => s.createGoal);
  const updateGoal = useGoalsStore((s) => s.updateGoal);

  const templates = useTodosStore((s) => s.templates);
  const loadTodos = useTodosStore((s) => s.load);
  const habits = useHabitsStore((s) => s.habits);
  const loadHabits = useHabitsStore((s) => s.load);

  const existing = useMemo(() => goals.find((g) => g.id === id), [goals, id]);

  const [title, setTitle] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [cat, setCat] = useState('treino');
  const [family, setFamily] = useState<GoalFamily>('cadence');
  const [sourceKind, setSourceKind] = useState<SourceKind>('activity');
  // activity
  const [activityAny, setActivityAny] = useState(false);
  const [activityId, setActivityId] = useState(37);
  const [metric, setMetric] = useState<GoalActivityMetric>('count');
  const [bestEffortKey, setBestEffortKey] = useState('half');
  // task / habit
  const [templateId, setTemplateId] = useState('');
  const [habitId, setHabitId] = useState('');
  // manual
  const [manualCurrent, setManualCurrent] = useState('0');
  // cadence
  const [period, setPeriod] = useState<GoalPeriodKind>('month');
  const [perPeriodTarget, setPerPeriodTarget] = useState('1');
  const [cadenceTarget, setCadenceTarget] = useState('12');
  // milestone / cumulative
  const [target, setTarget] = useState('1');
  const [unit, setUnit] = useState('');

  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadTodos();
    void loadHabits();
    if (id && !loaded) void load();
  }, [id, loaded, load, loadTodos, loadHabits]);

  useEffect(() => {
    if (!existing || hydrated) return;
    const g = existing;
    setTitle(g.title);
    setYear(String(g.year));
    setCat(g.cat || 'treino');
    setFamily(g.family);
    setSourceKind(g.source.kind);
    if (g.source.kind === 'activity') {
      setActivityAny(g.source.activityId == null);
      setActivityId(g.source.activityId ?? 37);
      setMetric(g.source.activityMetric ?? 'count');
      setBestEffortKey(g.source.bestEffortKey ?? 'half');
    }
    if (g.source.kind === 'task') setTemplateId(g.source.templateId ?? '');
    if (g.source.kind === 'habit') setHabitId(g.source.habitId ?? '');
    setManualCurrent(String(g.manualCurrent ?? 0));
    setPeriod(g.period ?? 'month');
    const ppt = g.perPeriodTarget ?? 1;
    const isDistCadence =
      g.family === 'cadence' && g.source.kind === 'activity' && g.source.activityMetric === 'distance';
    setPerPeriodTarget(String(isDistCadence ? ppt / 1000 : ppt));
    setUnit(g.unit ?? '');
    if (g.family === 'cadence') {
      setCadenceTarget(String(g.target));
    } else {
      const isDist = g.source.kind === 'activity' && g.source.activityMetric === 'distance';
      setTarget(String(isDist ? g.target / 1000 : g.target));
    }
    setHydrated(true);
  }, [existing, hydrated]);

  const isDistance = sourceKind === 'activity' && metric === 'distance';
  const isBestEffort = sourceKind === 'activity' && metric === 'bestEffort';

  const accent = moduleColors(cat, 'treino').accent;

  /** Só séries com recorrência ativa podem ser fonte de uma meta (avulsas não). */
  const recurringTemplates = useMemo(
    () => templates.filter((t) => t.recurrence.kind !== 'none'),
    [templates],
  );

  const changePeriod = (p: GoalPeriodKind) => {
    setPeriod(p);
    // default de períodos do ano ao trocar (o usuário ainda pode ajustar).
    setCadenceTarget(p === 'week' ? '52' : '12');
  };

  const buildSource = (): GoalSource => {
    switch (sourceKind) {
      case 'activity':
        return {
          kind: 'activity',
          activityId: activityAny ? undefined : Number(activityId),
          activityMetric: metric,
          bestEffortKey: metric === 'bestEffort' ? bestEffortKey : undefined,
        };
      case 'task':
        return { kind: 'task', templateId };
      case 'habit':
        return { kind: 'habit', habitId };
      case 'manual':
        return { kind: 'manual' };
    }
  };

  const buildTarget = (): number => {
    if (family === 'cadence') return Math.max(1, Math.round(parseNum(cadenceTarget) ?? 1));
    if (isBestEffort) return 1;
    const t = parseNum(target) ?? 0;
    return isDistance ? t * 1000 : t;
  };

  const valid = (() => {
    if (title.trim() === '') return false;
    if (sourceKind === 'task' && !templateId) return false;
    if (sourceKind === 'habit' && !habitId) return false;
    if (family !== 'cadence' && !isBestEffort && !((parseNum(target) ?? 0) > 0)) return false;
    return true;
  })();

  const onSave = async () => {
    if (!valid || saving) return;
    const payload: NewGoal = {
      year: parseNum(year) ?? new Date().getFullYear(),
      title: title.trim(),
      cat,
      family,
      source: buildSource(),
      period: family === 'cadence' ? period : null,
      perPeriodTarget:
        family === 'cadence'
          ? isDistance
            ? Math.max(1, Math.round((parseNum(perPeriodTarget) ?? 0) * 1000)) // km → metros
            : Math.max(1, Math.round(parseNum(perPeriodTarget) ?? 1))
          : null,
      target: buildTarget(),
      unit: unit.trim() || null,
      manualCurrent: sourceKind === 'manual' ? parseNum(manualCurrent) ?? 0 : null,
    };
    setSaving(true);
    try {
      if (id) await updateGoal(id, payload);
      else await createGoal(payload);
      router.back();
    } catch (e) {
      console.error('Erro ao salvar meta:', e);
      setSaving(false);
    }
  };

  const Chip = ({
    label,
    on,
    onPress,
  }: {
    label: string;
    on: boolean;
    onPress: () => void;
  }) => (
    <Pressable
      onPress={onPress}
      style={[styles.chip, on && { backgroundColor: accent, borderColor: accent }]}
    >
      <Text style={[styles.chipText, on && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>{id ? 'Editar meta' : 'Nova meta'}</Text>
        <View style={styles.backBtn} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Nome */}
          <Text style={styles.label}>Nome</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Ex.: Correr 1x por mês"
            placeholderTextColor={colors.ink4}
            style={styles.input}
          />

          {/* Ano + cor */}
          <View style={styles.row}>
            <View style={styles.yearCol}>
              <Text style={styles.label}>Ano</Text>
              <TextInput
                value={year}
                onChangeText={setYear}
                keyboardType="number-pad"
                style={styles.input}
              />
            </View>
            <View style={styles.flex}>
              <Text style={styles.label}>Cor</Text>
              <View style={styles.chips}>
                {colorOptions().map((c) => (
                  <Pressable
                    key={c.key}
                    onPress={() => setCat(c.key)}
                    style={[styles.swatch, { backgroundColor: c.accent }, cat === c.key && styles.swatchActive]}
                  >
                    {cat === c.key && <Ionicons name="checkmark" size={15} color="#fff" />}
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          {/* Tipo de meta */}
          <Text style={styles.label}>Tipo de meta</Text>
          <View style={styles.chips}>
            {FAMILIES.map((f) => (
              <Chip key={f.key} label={f.label} on={family === f.key} onPress={() => setFamily(f.key)} />
            ))}
          </View>
          <Text style={styles.hint}>{FAMILIES.find((f) => f.key === family)?.hint}</Text>

          {/* Fonte */}
          <Text style={styles.label}>Fonte do progresso</Text>
          <View style={styles.chips}>
            {SOURCES.map((s) => (
              <Chip key={s.key} label={s.label} on={sourceKind === s.key} onPress={() => setSourceKind(s.key)} />
            ))}
          </View>

          {/* Fonte: atividade */}
          {sourceKind === 'activity' && (
            <>
              <Text style={styles.label}>Métrica</Text>
              <View style={styles.chips}>
                {METRICS.map((m) => (
                  <Chip key={m.key} label={m.label} on={metric === m.key} onPress={() => setMetric(m.key)} />
                ))}
              </View>

              {isBestEffort && (
                <>
                  <Text style={styles.label}>Distância padrão</Text>
                  <View style={styles.chips}>
                    {BEST_EFFORTS.map((b) => (
                      <Chip key={b.key} label={b.label} on={bestEffortKey === b.key} onPress={() => setBestEffortKey(b.key)} />
                    ))}
                  </View>
                </>
              )}

              <Text style={styles.label}>Tipo de atividade</Text>
              <View style={styles.chips}>
                <Chip label="Qualquer" on={activityAny} onPress={() => setActivityAny(true)} />
                {ACTIVITY_TYPES.map((a) => (
                  <Chip
                    key={a.activityId}
                    label={a.label}
                    on={!activityAny && activityId === a.activityId}
                    onPress={() => {
                      setActivityAny(false);
                      setActivityId(a.activityId);
                    }}
                  />
                ))}
              </View>
            </>
          )}

          {/* Fonte: tarefa */}
          {sourceKind === 'task' && (
            <>
              <Text style={styles.label}>Série de tarefa (conta conclusões)</Text>
              {recurringTemplates.length === 0 ? (
                <Text style={styles.hint}>
                  Nenhuma tarefa recorrente ativa. Crie uma série recorrente em Tarefas primeiro.
                </Text>
              ) : (
                <View style={styles.chips}>
                  {recurringTemplates.map((t) => (
                    <Chip key={t.id} label={t.name} on={templateId === t.id} onPress={() => setTemplateId(t.id)} />
                  ))}
                </View>
              )}
            </>
          )}

          {/* Fonte: hábito */}
          {sourceKind === 'habit' && (
            <>
              <Text style={styles.label}>Hábito (conta dias que bateram a meta)</Text>
              {habits.length === 0 ? (
                <Text style={styles.hint}>Nenhum hábito ativo. Crie um hábito contador primeiro.</Text>
              ) : (
                <View style={styles.chips}>
                  {habits.map((h) => (
                    <Chip key={h.id} label={h.name} on={habitId === h.id} onPress={() => setHabitId(h.id)} />
                  ))}
                </View>
              )}
            </>
          )}

          {/* Fonte: manual */}
          {sourceKind === 'manual' && (
            <>
              <Text style={styles.label}>Valor atual</Text>
              <TextInput
                value={manualCurrent}
                onChangeText={setManualCurrent}
                keyboardType="decimal-pad"
                style={styles.input}
              />
            </>
          )}

          {/* Cadência */}
          {family === 'cadence' && (
            <>
              <Text style={styles.label}>Período</Text>
              <View style={styles.chips}>
                <Chip label="Semana" on={period === 'week'} onPress={() => changePeriod('week')} />
                <Chip label="Mês" on={period === 'month'} onPress={() => changePeriod('month')} />
              </View>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Text style={styles.label}>Mínimo por período{isDistance ? ' (km)' : ''}</Text>
                  <TextInput
                    value={perPeriodTarget}
                    onChangeText={setPerPeriodTarget}
                    keyboardType={isDistance ? 'decimal-pad' : 'number-pad'}
                    style={styles.input}
                  />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.label}>Períodos a cumprir</Text>
                  <TextInput
                    value={cadenceTarget}
                    onChangeText={setCadenceTarget}
                    keyboardType="number-pad"
                    style={styles.input}
                  />
                </View>
              </View>
            </>
          )}

          {/* Milestone / Cumulative alvo */}
          {family !== 'cadence' && !isBestEffort && (
            <>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Text style={styles.label}>Alvo {isDistance ? '(km)' : ''}</Text>
                  <TextInput
                    value={target}
                    onChangeText={setTarget}
                    keyboardType="decimal-pad"
                    style={styles.input}
                  />
                </View>
                {!isDistance && (
                  <View style={styles.flex}>
                    <Text style={styles.label}>Unidade (opcional)</Text>
                    <TextInput
                      value={unit}
                      onChangeText={setUnit}
                      placeholder="ex.: livros, R$"
                      placeholderTextColor={colors.ink4}
                      style={styles.input}
                      autoCapitalize="none"
                    />
                  </View>
                )}
              </View>
              {isDistance && (
                <Text style={styles.hint}>
                  {family === 'milestone'
                    ? 'Atingida quando UMA atividade sozinha alcança o alvo (ex.: um pedal > 100 km).'
                    : 'Soma da distância de todas as atividades do ano.'}
                </Text>
              )}
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
            <Text style={styles.saveText}>{id ? 'Salvar' : 'Criar meta'}</Text>
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
  hint: { fontSize: 12, fontFamily: fonts.sans, color: colors.ink3, marginTop: 6, lineHeight: 17 },
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

  row: { flexDirection: 'row', gap: spacing.md },
  yearCol: { width: 110 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipText: { fontSize: 13, color: colors.ink2, fontFamily: fonts.sansSemiBold },
  chipTextActive: { color: '#fff' },

  swatch: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  swatchActive: { borderWidth: 2.5, borderColor: colors.ink },

  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.bg },
  saveBtn: { borderRadius: radii.lg, paddingVertical: 15, alignItems: 'center' },
  saveDisabled: { opacity: 0.4 },
  saveRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  saveText: { fontSize: 16, fontFamily: fonts.sansBold, color: '#fff' },
}));
