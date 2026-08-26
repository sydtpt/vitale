import React, { useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Platform,
  Alert,
  ListRenderItemInfo,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useActivitiesStore } from '../../store/activities.store';
import {
  useFitnessStore,
  WorkoutItem,
  getActivityMeta,
  TypeSyncStatus,
  mergeWorkoutSources,
} from '../../store/fitness.store';
import { colors, fonts, moduleColors, radii, shadows, spacing, themed, useTheme } from '../../theme';

type ActivityGroup = {
  key: string;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  total: number;
};

function groupByActivity(workouts: WorkoutItem[]): ActivityGroup[] {
  const map = new Map<string, ActivityGroup>();
  for (const w of workouts) {
    const meta = getActivityMeta(w.activityId);
    const key = meta.label;
    const existing = map.get(key);
    if (existing) {
      existing.total += 1;
    } else {
      map.set(key, { key, label: meta.label, icon: meta.icon, total: 1 });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

type SyncIcon = { icon: keyof typeof Ionicons.glyphMap; color: string; tint: string };

// Função, não constante: `tint` e `color` seguem tema e paleta, e um objeto no
// escopo do módulo os congelaria no import.
function syncIcon(status: Exclude<TypeSyncStatus, 'syncing'>): SyncIcon {
  const treino = moduleColors('treino');
  return {
    unsubscribed: { icon: 'sync-outline' as const, color: treino.accent, tint: treino.tint },
    synced: { icon: 'checkmark-circle' as const, color: colors.green, tint: colors.greenSoft },
    pending: { icon: 'cloud-upload-outline' as const, color: colors.yellow, tint: colors.yellowSoft },
    error: { icon: 'alert-circle' as const, color: colors.primaryDeep, tint: colors.primarySoft },
  }[status];
}

function ActivityTypeCard({
  group,
  onPress,
  onSync,
  status,
  progress,
}: {
  group: ActivityGroup;
  onPress: () => void;
  onSync: () => void;
  status: TypeSyncStatus;
  progress: number;
}) {
  const syncing = status === 'syncing';
  const meta = syncing ? null : syncIcon(status);
  const pct = Math.round(Math.min(Math.max(progress, 0), 1) * 100);
  const subtitle = syncing
    ? `Sincronizando… ${pct}%`
    : status === 'synced'
    ? 'Sincronizado'
    : status === 'pending'
    ? 'Pendente'
    : status === 'error'
    ? 'Erro — toque para tentar de novo'
    : `${group.total} ${group.total === 1 ? 'atividade' : 'atividades'}`;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={[styles.iconBox, { backgroundColor: moduleColors('treino').tint }]}>
        <MaterialCommunityIcons name={group.icon} size={24} color={moduleColors('treino').accent} />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>{group.label}</Text>
        <Text style={styles.cardMeta}>{subtitle}</Text>
        {syncing && (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct}%` }]} />
          </View>
        )}
      </View>
      <Pressable
        onPress={onSync}
        disabled={syncing}
        style={({ pressed }) => [
          styles.syncBtn,
          { backgroundColor: meta?.tint ?? moduleColors('treino').tint },
          pressed && styles.syncBtnPressed,
          syncing && styles.syncBtnDisabled,
        ]}
        hitSlop={8}
      >
        {syncing || !meta ? (
          <ActivityIndicator size="small" color={moduleColors('treino').accent} />
        ) : (
          <Ionicons name={meta.icon} size={18} color={meta.color} />
        )}
      </Pressable>
      <Ionicons name="chevron-forward" size={18} color={colors.ink4} />
    </Pressable>
  );
}

function PermissionScreen({ onRequest }: { onRequest: () => void }) {
  return (
    <View style={styles.permCenter}>
      <View style={styles.permIconWrap}>
        <Ionicons name="barbell-outline" size={40} color={moduleColors('treino').accent} />
      </View>
      <Text style={styles.permTitle}>Acesse seus Treinos</Text>
      <Text style={styles.permDesc}>
        O Orbe lê seus exercícios do Apple Health para exibir o histórico completo de atividades.
      </Text>
      <Pressable style={styles.permBtn} onPress={onRequest}>
        <Text style={styles.permBtnText}>Permitir Acesso</Text>
      </Pressable>
      <Text style={styles.permNote}>Seus dados ficam apenas no dispositivo.</Text>
    </View>
  );
}

function UnavailableScreen() {
  return (
    <View style={styles.permCenter}>
      <Ionicons name="alert-circle-outline" size={40} color={colors.ink3} />
      <Text style={styles.permTitle}>Não disponível</Text>
      <Text style={styles.permDesc}>O Apple Health só está disponível em dispositivos iOS.</Text>
    </View>
  );
}

export default function FitnessScreen() {
  useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    permissionStatus,
    workouts,
    loading,
    requestPermission,
    syncType,
    syncDeltaForLabel,
    runDelta,
    typeStatus,
    syncProgress,
    syncedTypes,
  } = useFitnessStore();

  // O seletor devolve a fatia CRUA (referência estável) e a derivação vai no
  // useMemo. `s.activities()` filtra e cria um array novo a cada avaliação —
  // no Zustand 5 (useSyncExternalStore) isso é snapshot instável, e o React
  // re-renderiza em loop até travar o app. É como o resto das telas já faz.
  const allActivities = useActivitiesStore((s) => s._all);
  const supActivities = useMemo(() => allActivities.filter((a) => !a.hidden), [allActivities]);

  useEffect(() => {
    void useActivitiesStore.getState().load();
  }, []);

  const mergedWorkouts = useMemo(
    () => mergeWorkoutSources(workouts, supActivities),
    [workouts, supActivities],
  );

  const groups = useMemo(() => groupByActivity(mergedWorkouts), [mergedWorkouts]);

  const handleSync = useCallback(
    async (label: string, status: TypeSyncStatus) => {
      if (status === 'unsubscribed') {
        // Primeira vez: inscreve + backfill completo
        await syncType(label);
      } else {
        // Já inscrito: envia só atividades novas
        await syncDeltaForLabel(label);
      }
      const err = useFitnessStore.getState().syncError[label];
      if (err) Alert.alert('Erro ao sincronizar', err);
    },
    [syncType, syncDeltaForLabel]
  );

  const handleResyncAll = useCallback(async () => {
    if (syncedTypes.size === 0) return;
    await runDelta();
  }, [syncedTypes, runDelta]);

  const handleOpen = useCallback(
    (label: string) => {
      router.push({ pathname: '/fitness/[label]', params: { label } });
    },
    [router]
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ActivityGroup>) => (
      <ActivityTypeCard
        group={item}
        onPress={() => handleOpen(item.label)}
        onSync={() => handleSync(item.label, typeStatus[item.label] ?? 'unsubscribed')}
        status={typeStatus[item.label] ?? 'unsubscribed'}
        progress={syncProgress[item.label] ?? 0}
      />
    ),
    [handleOpen, handleSync, typeStatus, syncProgress]
  );

  const renderEmpty = useCallback(() => {
    if (loading) return null;
    return (
      <View style={styles.emptyState}>
        <Ionicons name="barbell-outline" size={36} color={colors.ink4} />
        <Text style={styles.emptyText}>Nenhum treino encontrado</Text>
        <Text style={styles.emptySubText}>
          Registre exercícios no Apple Health ou no app Exercícios.
        </Text>
      </View>
    );
  }, [loading]);

  if (Platform.OS !== 'ios' || permissionStatus === 'unavailable') {
    return <UnavailableScreen />;
  }

  if (permissionStatus === 'unknown' || permissionStatus === 'denied') {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={({ pressed }) => [styles.backBtn, pressed && styles.syncBtnPressed]}>
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </Pressable>
          <Text style={styles.headerTitle}>Sync de atividades</Text>
        </View>
        <PermissionScreen onRequest={requestPermission} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={({ pressed }) => [styles.backBtn, pressed && styles.syncBtnPressed]}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Sync de atividades</Text>
        {groups.length > 0 && (
          <Text style={styles.headerSub}>
            {groups.length} {groups.length === 1 ? 'tipo' : 'tipos'}
          </Text>
        )}
        <View style={{ flex: 1 }} />
        {syncedTypes.size > 0 && (
          <Pressable
            onPress={handleResyncAll}
            style={({ pressed }) => [styles.resyncBtn, pressed && styles.syncBtnPressed]}
            hitSlop={8}
          >
            <Ionicons name="refresh-outline" size={18} color={colors.ink3} />
          </Pressable>
        )}
      </View>

      {loading && workouts.length === 0 ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(item) => item.key}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    // 'center' (e não 'baseline'): a linha contém views não-textuais (spacer
    // flex e botão de resync); 'baseline' faz o Yoga calcular baseline NaN para
    // essas views e aborta o app (std::logic_error).
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: fonts.serif,
    color: colors.ink,
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
  headerSub: {
    fontSize: 13,
    color: colors.ink3,
    fontFamily: fonts.mono,
  },

  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 40,
    gap: 10,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radii['2xl'],
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    ...shadows.card,
  },
  cardPressed: {
    opacity: 0.75,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: fonts.sansSemiBold,
    color: colors.ink,
    marginBottom: 2,
  },
  cardMeta: {
    fontSize: 13,
    color: colors.ink3,
    fontFamily: fonts.mono,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: moduleColors('treino').accent,
  },
  syncBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: moduleColors('treino').tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resyncBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncBtnPressed: {
    opacity: 0.65,
  },
  syncBtnDisabled: {
    opacity: 0.5,
  },

  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    gap: spacing.md,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: fonts.sansSemiBold,
    color: colors.ink2,
  },
  emptySubText: {
    fontSize: 13.5, fontFamily: fonts.sans,
    color: colors.ink3,
    textAlign: 'center',
    paddingHorizontal: spacing['3xl'],
    lineHeight: 20,
  },

  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  permCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['3xl'],
    gap: spacing.lg,
  },
  permIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 28,
    backgroundColor: moduleColors('treino').tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  permTitle: {
    fontSize: 22,
    fontFamily: fonts.serif,
    color: colors.ink,
    textAlign: 'center',
  },
  permDesc: {
    fontSize: 14.5, fontFamily: fonts.sans,
    color: colors.ink2,
    textAlign: 'center',
    lineHeight: 22,
  },
  permBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: radii.pill,
    marginTop: spacing.sm,
  },
  permBtnText: {
    fontSize: 15,
    fontFamily: fonts.sansBold,
    color: colors.onPrimary,
    letterSpacing: 0.2,
  },
  permNote: {
    fontSize: 12, fontFamily: fonts.sans,
    color: colors.ink4,
    textAlign: 'center',
  },
}));
