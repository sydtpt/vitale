import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Switch,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useActivitiesStore } from '../../../store/activities.store';
import { getActivityMeta, getActivityColor, elevationGain } from '../../../lib/workout-types';
import { WorkoutMap } from '../../../components/WorkoutMap';
import {
  formatFullDate,
  formatTime,
  formatDuration,
  formatDistance,
  formatRate,
  formatElevation,
} from '../../../lib/workout-format';
import { colors, spacing, radii, shadows } from '../../../theme';

type InfoRow = { label: string; value: string };

function Stat({
  icon,
  value,
  caption,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  caption: string;
  color: string;
}) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statCaption}>{caption}</Text>
    </View>
  );
}

export default function AtividadeDetalheScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id = '' } = useLocalSearchParams<{ label: string; id: string }>();

  const _all = useActivitiesStore((s) => s._all);
  const load = useActivitiesStore((s) => s.load);
  const loadRoute = useActivitiesStore((s) => s.loadRoute);
  const updateActivity = useActivitiesStore((s) => s.updateActivity);
  const setHidden = useActivitiesStore((s) => s.setHidden);
  const routePoints = useActivitiesStore((s) => s.routes[id]);

  const activity = useMemo(() => _all.find((a) => a.id === id), [_all, id]);

  useEffect(() => {
    load();
  }, [load]);

  const hasGps = !!activity && (activity.hasRoute || (activity.distanceM ?? 0) > 0);

  useEffect(() => {
    if (activity?.hasRoute) loadRoute(activity.id);
  }, [activity?.id, activity?.hasRoute, loadRoute]);

  // ── estado de edição ──────────────────────────────────────────
  const [name, setName] = useState('');
  const [durationMin, setDurationMin] = useState('');
  const [saving, setSaving] = useState(false);
  const [togglingHidden, setTogglingHidden] = useState(false);

  useEffect(() => {
    if (activity) {
      setName(activity.activityName ?? '');
      setDurationMin(String(Math.round(activity.durationS / 60)));
    }
  }, [activity?.id]);

  if (!activity) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </Pressable>
          <View style={styles.backBtn} />
        </View>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={36} color={colors.ink4} />
          <Text style={styles.emptyText}>Atividade não encontrada</Text>
        </View>
      </View>
    );
  }

  const meta = getActivityMeta(activity.activityId);
  const color = getActivityColor(activity.activityId);
  const distance = formatDistance(activity.distanceM);
  const movingS = activity.movingTimeS ?? activity.durationS;
  const rate = hasGps ? formatRate(activity.activityId, activity.distanceM, movingS) : null;
  const points = (routePoints ?? []).map((p) => ({
    latitude: p.lat,
    longitude: p.lng,
    altitude: p.alt,
  }));
  const elevation = formatElevation(elevationGain(points));

  const nameDirty = name.trim() !== (activity.activityName ?? '');
  const durDirty =
    !hasGps && durationMin.trim() !== String(Math.round(activity.durationS / 60));
  const dirty = nameDirty || durDirty;

  const onSave = async () => {
    setSaving(true);
    try {
      const patch: { activityName?: string | null; durationS?: number } = {};
      if (nameDirty) patch.activityName = name.trim() || null;
      if (durDirty) {
        const mins = parseInt(durationMin, 10);
        if (Number.isFinite(mins) && mins >= 0) patch.durationS = mins * 60;
      }
      await updateActivity(activity.id, patch);
    } finally {
      setSaving(false);
    }
  };

  const onToggleHidden = async (next: boolean) => {
    setTogglingHidden(true);
    try {
      // Switch "Incluir nas métricas": ligado = visível ⇒ hidden = !next
      await setHidden(activity.id, !next);
    } finally {
      setTogglingHidden(false);
    }
  };

  const rows: InfoRow[] = [
    { label: 'Tipo', value: meta.label },
    { label: 'Nome (Health)', value: activity.activityName || '—' },
    { label: 'Código', value: String(activity.activityId) },
    { label: 'Início', value: `${formatFullDate(activity.startAt)} · ${formatTime(activity.startAt)}` },
    { label: 'Fim', value: `${formatFullDate(activity.endAt)} · ${formatTime(activity.endAt)}` },
    { label: 'Tempo total', value: formatDuration(activity.durationS) },
    ...(hasGps ? [{ label: 'Tempo em movimento', value: formatDuration(movingS) }] : []),
    { label: 'Calorias', value: activity.calories > 0 ? `${activity.calories} kcal` : '—' },
    { label: 'Distância', value: distance ?? '—' },
    { label: 'Fonte', value: activity.sourceName || '—' },
    { label: 'Dispositivo', value: activity.device || '—' },
    {
      label: 'Rastreado',
      value: activity.tracked === undefined ? '—' : activity.tracked ? 'Sim' : 'Não',
    },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>{meta.label}</Text>
        {dirty ? (
          <Pressable
            onPress={onSave}
            disabled={saving}
            style={({ pressed }) => [styles.saveBtn, pressed && styles.pressed]}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveText}>Salvar</Text>
            )}
          </Pressable>
        ) : (
          <View style={styles.backBtn} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={[styles.heroIcon, { backgroundColor: `${color}22` }]}>
            <MaterialCommunityIcons name={meta.icon} size={28} color={color} />
          </View>
          <Text style={styles.heroDate}>{formatFullDate(activity.startAt)}</Text>
          <Text style={styles.heroTime}>
            {formatTime(activity.startAt)} – {formatTime(activity.endAt)}
          </Text>

          <View style={styles.heroStats}>
            {hasGps ? (
              <>
                <Stat icon="walk-outline" value={formatDuration(movingS)} caption="movimento" color={color} />
                <Stat icon="time-outline" value={formatDuration(activity.durationS)} caption="tempo total" color={color} />
              </>
            ) : (
              <Stat icon="time-outline" value={formatDuration(activity.durationS)} caption="duração" color={color} />
            )}
            {activity.calories > 0 && (
              <Stat icon="flame-outline" value={`${activity.calories}`} caption="kcal" color={color} />
            )}
            {distance && <Stat icon="map-outline" value={distance} caption="distância" color={color} />}
            {rate && <Stat icon="speedometer-outline" value={rate.value} caption={rate.caption} color={color} />}
            {elevation && (
              <Stat icon="trending-up-outline" value={elevation} caption="elevação" color={color} />
            )}
          </View>

          {activity.locallyEdited && (
            <View style={styles.editBadge}>
              <Ionicons name="create-outline" size={12} color={colors.ink2} />
              <Text style={styles.editBadgeText}>editado manualmente</Text>
            </View>
          )}
        </View>

        {points.length > 1 && (
          <>
            <Text style={styles.sectionTitle}>Percurso</Text>
            <View style={styles.mapCard}>
              <WorkoutMap points={points} />
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>Editar</Text>
        <View style={styles.editCard}>
          <Text style={styles.fieldLabel}>Nome</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Nome da atividade"
            placeholderTextColor={colors.ink4}
          />

          <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Duração (min)</Text>
          <TextInput
            style={[styles.input, hasGps && styles.inputDisabled]}
            value={durationMin}
            onChangeText={setDurationMin}
            editable={!hasGps}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={colors.ink4}
          />
          {hasGps && (
            <Text style={styles.note}>Duração calculada pelo rastreamento GPS.</Text>
          )}
        </View>

        <View style={styles.toggleCard}>
          <View style={styles.flex}>
            <Text style={styles.toggleTitle}>Incluir nas métricas</Text>
            <Text style={styles.toggleSub}>
              Desligar mantém a atividade salva, mas fora dos gráficos e somas.
            </Text>
          </View>
          {togglingHidden ? (
            <ActivityIndicator size="small" color={color} />
          ) : (
            <Switch
              value={!activity.hidden}
              onValueChange={onToggleHidden}
              trackColor={{ true: color, false: colors.lineDeep }}
              thumbColor="#fff"
            />
          )}
        </View>

        <Text style={styles.sectionTitle}>Todos os dados</Text>
        <View style={styles.infoCard}>
          {rows.map((row, i) => (
            <View
              key={`${row.label}-${i}`}
              style={[styles.infoRow, i < rows.length - 1 && styles.infoRowBorder]}
            >
              <Text style={styles.infoLabel}>{row.label}</Text>
              <Text style={styles.infoValue} selectable numberOfLines={3}>
                {row.value}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
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
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontFamily: 'InstrumentSerif',
    color: colors.ink,
  },
  saveBtn: {
    height: 36,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  saveText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },

  scroll: { paddingHorizontal: spacing.lg, paddingBottom: 48 },

  hero: {
    backgroundColor: colors.surface,
    borderRadius: radii['2xl'],
    padding: spacing.xl,
    alignItems: 'center',
    gap: 4,
    ...shadows.card,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  heroDate: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink,
    textTransform: 'capitalize',
    textAlign: 'center',
  },
  heroTime: { fontSize: 13, color: colors.ink3, fontFamily: 'GeistMono' },
  heroStats: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.xl,
    marginTop: spacing.lg,
  },
  stat: { alignItems: 'center', gap: 3 },
  statValue: { fontSize: 17, fontWeight: '700', color: colors.ink, fontFamily: 'GeistMono' },
  statCaption: { fontSize: 11, color: colors.ink3 },
  editBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceMute,
  },
  editBadgeText: { fontSize: 11.5, color: colors.ink2, fontWeight: '600' },

  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink2,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mapCard: {
    backgroundColor: colors.surface,
    borderRadius: radii['2xl'],
    padding: spacing.xs,
    ...shadows.card,
  },

  editCard: {
    backgroundColor: colors.surface,
    borderRadius: radii['2xl'],
    padding: spacing.lg,
    ...shadows.card,
  },
  fieldLabel: {
    fontSize: 11,
    color: colors.ink3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surfaceMute,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.ink,
  },
  inputDisabled: { color: colors.ink3, opacity: 0.7 },
  note: { fontSize: 12, color: colors.ink3, marginTop: spacing.xs, fontStyle: 'italic' },

  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii['2xl'],
    padding: spacing.lg,
    marginTop: spacing.md,
    ...shadows.card,
  },
  toggleTitle: { fontSize: 15, fontWeight: '600', color: colors.ink },
  toggleSub: { fontSize: 12, color: colors.ink3, marginTop: 2, lineHeight: 17 },

  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radii['2xl'],
    paddingHorizontal: spacing.lg,
    ...shadows.card,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
    gap: spacing.lg,
  },
  infoRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  infoLabel: { fontSize: 13.5, color: colors.ink3, flexShrink: 0, maxWidth: '45%' },
  infoValue: { fontSize: 13.5, color: colors.ink, fontFamily: 'GeistMono', flex: 1, textAlign: 'right' },

  emptyText: { fontSize: 15, color: colors.ink3 },
});
