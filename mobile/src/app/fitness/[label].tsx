import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ListRenderItemInfo,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useFitnessStore,
  WorkoutItem,
  getActivityMeta,
} from '../../store/fitness.store';
import {
  formatDateLabel,
  formatTime,
  formatDuration,
  formatDistance,
} from '../../lib/workout-format';
import { colors, spacing, radii, MOD, shadows } from '../../theme';

const PAGE_SIZE = 10;

function WorkoutCard({ item, onPress }: { item: WorkoutItem; onPress: () => void }) {
  const meta = getActivityMeta(item.activityId);
  const distance = formatDistance(item.distance);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.iconBox, { backgroundColor: MOD.treino.tint }]}>
          <MaterialCommunityIcons name={meta.icon} size={20} color={MOD.treino.accent} />
        </View>
        <View style={styles.cardHeaderText}>
          <Text style={styles.cardDate}>{formatDateLabel(item.start)}</Text>
          <Text style={styles.cardTime}>
            {formatTime(item.start)} – {formatTime(item.end)}
          </Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Ionicons name="time-outline" size={14} color={colors.ink3} />
          <Text style={styles.statValue}>{formatDuration(item.duration)}</Text>
        </View>
        {item.calories > 0 && (
          <View style={styles.stat}>
            <Ionicons name="flame-outline" size={14} color={colors.ink3} />
            <Text style={styles.statValue}>{item.calories} kcal</Text>
          </View>
        )}
        {distance && (
          <View style={styles.stat}>
            <Ionicons name="map-outline" size={14} color={colors.ink3} />
            <Text style={styles.statValue}>{distance}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

export default function ActivityDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { label = '' } = useLocalSearchParams<{ label: string }>();

  const { workouts, syncType, typeStatus } = useFitnessStore();
  const syncing = typeStatus[label] === 'syncing';

  const handleFullResync = useCallback(() => {
    Alert.alert(
      'Reenviar histórico completo',
      'Isso reenvia todo o histórico deste tipo ao servidor, recalculando tempo em movimento e distâncias. Pode demorar alguns minutos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Reenviar',
          style: 'destructive',
          onPress: async () => {
            await syncType(label);
            const err = useFitnessStore.getState().syncError[label];
            if (err) Alert.alert('Erro ao sincronizar', err);
          },
        },
      ]
    );
  }, [label, syncType]);

  const filtered = useMemo(
    () =>
      workouts
        .filter((w) => getActivityMeta(w.activityId).label === label)
        .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime()),
    [workouts, label]
  );

  const [visible, setVisible] = useState(PAGE_SIZE);

  // Recomeça do topo quando a atividade muda
  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [label]);

  const data = useMemo(() => filtered.slice(0, visible), [filtered, visible]);

  const loadMore = useCallback(() => {
    setVisible((v) => (v >= filtered.length ? v : v + PAGE_SIZE));
  }, [filtered.length]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<WorkoutItem>) => (
      <WorkoutCard
        item={item}
        onPress={() =>
          router.push({ pathname: '/fitness/workout/[id]', params: { id: item.id } })
        }
      />
    ),
    [router]
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{label}</Text>
          <Text style={styles.headerSub}>
            {filtered.length} {filtered.length === 1 ? 'atividade' : 'atividades'}
          </Text>
        </View>
        <Pressable
          onPress={handleFullResync}
          disabled={syncing}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed, syncing && { opacity: 0.5 }]}
        >
          {syncing
            ? <ActivityIndicator size="small" color={colors.ink3} />
            : <Ionicons name="refresh-outline" size={20} color={colors.ink3} />
          }
        </Pressable>
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        initialNumToRender={PAGE_SIZE}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="barbell-outline" size={36} color={colors.ink4} />
            <Text style={styles.emptyText}>Sem atividades</Text>
          </View>
        }
      />
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
  backBtnPressed: {
    opacity: 0.7,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: 'InstrumentSerif',
    color: colors.ink,
  },
  headerSub: {
    fontSize: 12,
    color: colors.ink3,
    fontFamily: 'GeistMono',
    marginTop: 2,
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
    gap: spacing.md,
    ...shadows.card,
  },
  cardPressed: {
    opacity: 0.75,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: {
    flex: 1,
  },
  cardDate: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
  },
  cardTime: {
    fontSize: 12.5,
    color: colors.ink3,
    fontFamily: 'GeistMono',
    marginTop: 2,
  },

  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingLeft: 52,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statValue: {
    fontSize: 13,
    color: colors.ink2,
    fontFamily: 'GeistMono',
  },

  empty: {
    alignItems: 'center',
    paddingTop: 80,
    gap: spacing.md,
  },
  emptyText: {
    fontSize: 15,
    color: colors.ink3,
  },
});
