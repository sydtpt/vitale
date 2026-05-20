import React, { useCallback, useMemo } from 'react';
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
import {
  useFitnessStore,
  WorkoutItem,
  getActivityMeta,
  TypeSyncStatus,
} from '../../store/fitness.store';
import { colors, spacing, radii, MOD, shadows } from '../../theme';

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

const SYNC_ICON: Record<Exclude<TypeSyncStatus, 'syncing'>, {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  tint: string;
}> = {
  unsubscribed: { icon: 'sync-outline', color: MOD.treino.accent, tint: MOD.treino.tint },
  synced: { icon: 'checkmark-circle', color: colors.green, tint: colors.greenSoft },
  pending: { icon: 'cloud-upload-outline', color: colors.yellow, tint: colors.yellowSoft },
  error: { icon: 'alert-circle', color: colors.primaryDeep, tint: colors.primarySoft },
};

function ActivityTypeCard({
  group,
  onPress,
  onSync,
  status,
}: {
  group: ActivityGroup;
  onPress: () => void;
  onSync: () => void;
  status: TypeSyncStatus;
}) {
  const syncing = status === 'syncing';
  const meta = syncing ? null : SYNC_ICON[status];
  const subtitle =
    status === 'synced'
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
      <View style={[styles.iconBox, { backgroundColor: MOD.treino.tint }]}>
        <MaterialCommunityIcons name={group.icon} size={24} color={MOD.treino.accent} />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>{group.label}</Text>
        <Text style={styles.cardMeta}>{subtitle}</Text>
      </View>
      <Pressable
        onPress={onSync}
        disabled={syncing}
        style={({ pressed }) => [
          styles.syncBtn,
          { backgroundColor: meta?.tint ?? MOD.treino.tint },
          pressed && styles.syncBtnPressed,
          syncing && styles.syncBtnDisabled,
        ]}
        hitSlop={8}
      >
        {syncing || !meta ? (
          <ActivityIndicator size="small" color={MOD.treino.accent} />
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
        <Ionicons name="barbell-outline" size={40} color={MOD.treino.accent} />
      </View>
      <Text style={styles.permTitle}>Acesse seus Treinos</Text>
      <Text style={styles.permDesc}>
        O Vitale lê seus exercícios do Apple Health para exibir o histórico completo de atividades.
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
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    permissionStatus,
    workouts,
    loading,
    requestPermission,
    syncType,
    typeStatus,
    syncedTypes,
  } = useFitnessStore();

  const groups = useMemo(() => groupByActivity(workouts), [workouts]);

  const handleSync = useCallback(
    async (label: string) => {
      await syncType(label);
      const err = useFitnessStore.getState().syncError[label];
      if (err) Alert.alert('Erro ao sincronizar', err);
    },
    [syncType]
  );

  const handleResyncAll = useCallback(() => {
    if (syncedTypes.size === 0) return;
    Alert.alert(
      'Re-sincronizar histórico',
      'Isso reenvia todos os treinos inscritos ao servidor, corrigindo distâncias que possam ter sido gravadas incorretamente.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Re-sincronizar',
          style: 'destructive',
          onPress: async () => {
            for (const label of syncedTypes) {
              await syncType(label);
            }
          },
        },
      ]
    );
  }, [syncedTypes, syncType]);

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
        onSync={() => handleSync(item.label)}
        status={typeStatus[item.label] ?? 'unsubscribed'}
      />
    ),
    [handleOpen, handleSync, typeStatus]
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

const styles = StyleSheet.create({
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
    fontFamily: 'InstrumentSerif',
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
    fontFamily: 'GeistMono',
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
    fontWeight: '600',
    color: colors.ink,
    marginBottom: 2,
  },
  cardMeta: {
    fontSize: 13,
    color: colors.ink3,
    fontFamily: 'GeistMono',
  },
  syncBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: MOD.treino.tint,
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
    fontWeight: '600',
    color: colors.ink2,
  },
  emptySubText: {
    fontSize: 13.5,
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
    backgroundColor: MOD.treino.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  permTitle: {
    fontSize: 22,
    fontFamily: 'InstrumentSerif',
    color: colors.ink,
    textAlign: 'center',
  },
  permDesc: {
    fontSize: 14.5,
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
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.2,
  },
  permNote: {
    fontSize: 12,
    color: colors.ink4,
    textAlign: 'center',
  },
});
