import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  ScrollView,
  StyleSheet,
  ListRenderItemInfo,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Activity } from '@vitale/shared';
import { ridesByCountry } from '@vitale/shared';
import { useActivitiesStore } from '../../store/activities.store';
import { getActivityMeta, getActivityColor } from '../../lib/workout-types';
import {
  applyFilters,
  filterByType,
  distinctSources,
  SORT_OPTIONS,
  type ActivityFilters,
  type ActivitySort,
} from '../../lib/activity-list-filter';
import {
  formatDateLabel,
  formatTime,
  formatDuration,
  formatDistance,
} from '../../lib/workout-format';
import { activityHighlights, type ActivityHighlight } from '../../lib/running-highlights';
import {
  colors,
  fonts,
  radii,
  roleColors,
  shadows,
  spacing,
  themed,
  themeFillsCards,
  useTheme,
} from '../../theme';

/**
 * Largura fixa do cartão de recorde. Precisa ser fixa para o `snapToInterval`
 * ter passo — com largura ditada pelo conteúdo, cada cartão encaixaria num
 * lugar diferente. 148 comporta o maior valor ("2863.8 km" em Geist Mono 20)
 * e o maior rótulo ("Elevação 12 meses") sem truncar.
 */
const HL_CARD_W = 148;

const PAGE_SIZE = 12;

type RouteChoice = 'all' | 'yes' | 'no';

/** Converte "dd/mm/aaaa" digitado em "YYYY-MM-DD"; undefined se incompleto. */
function parseInputDate(s: string): string | undefined {
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return undefined;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function numOr(s: string): number | undefined {
  const v = parseFloat(s.replace(',', '.'));
  return Number.isFinite(v) ? v : undefined;
}

function ActivityCard({
  item,
  color,
  icon,
  onPress,
}: {
  item: Activity;
  color: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress: () => void;
}) {
  const distance = formatDistance(item.distanceM);
  // Atividades com GPS exibem o tempo em movimento; as demais, a duração total.
  const isGps = item.hasRoute || (item.distanceM ?? 0) > 0;
  const timeS = isGps ? item.movingTimeS ?? item.durationS : item.durationS;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconBox, { backgroundColor: `${color}22` }]}>
          <MaterialCommunityIcons name={icon} size={20} color={color} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.cardDate}>{formatDateLabel(item.startAt)}</Text>
          <Text style={styles.cardTime}>
            {formatTime(item.startAt)} – {formatTime(item.endAt)}
          </Text>
        </View>
        {item.locallyEdited && (
          <View style={styles.editBadge}>
            <Ionicons name="create-outline" size={11} color={colors.ink2} />
            <Text style={styles.editBadgeText}>editado</Text>
          </View>
        )}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Ionicons name="time-outline" size={14} color={colors.ink3} />
          <Text style={styles.statValue}>{formatDuration(timeS)}</Text>
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

function HighlightsRow({
  items,
  onPick,
}: {
  items: ActivityHighlight[];
  onPick: (id: string) => void;
}) {
  // Linha 1 → distâncias (resumo); linha 2 → recordes por distância (decrescente).
  const summary = items.filter((h) => h.group === 'summary');
  const records = items.filter((h) => h.group === 'record');

  // A casca sai do tema, não do esquema: temas que não dão preenchimento ao card
  // (Clean) pintam a cor na borda, e o valor usa `text` em vez de `on`. Ver a
  // ADR 0022 e `fillsCards()` no shared.
  const filled = themeFillsCards();

  const renderCard = (h: ActivityHighlight) => {
    const r = roleColors(h.role);
    const skin = filled
      ? { backgroundColor: r.soft, borderColor: 'transparent' }
      : { backgroundColor: 'transparent', borderColor: r.accent };
    const valueColor = filled ? r.on : r.text;

    const inner = (
      <>
        <Text style={styles.hlLabel} numberOfLines={1}>
          {h.label}
        </Text>
        <Text style={[styles.hlValue, { color: valueColor }]}>{h.value}</Text>
        {h.caption ? (
          <Text style={styles.hlCaption} numberOfLines={1}>
            {h.caption}
          </Text>
        ) : null}
      </>
    );

    // Agregados (últimos 12 meses, total) não têm link.
    const id = h.activityId;
    if (!id) {
      return (
        <View key={h.key} style={[styles.hlCard, skin]}>
          {inner}
        </View>
      );
    }
    return (
      <Pressable
        key={h.key}
        onPress={() => onPick(id)}
        style={({ pressed }) => [styles.hlCard, skin, pressed && styles.pressed]}
      >
        {inner}
      </Pressable>
    );
  };

  // O corte na borda direita era o pior valor possível: perto demais de inteiro
  // para ler como "arrasta para ver mais", cortado demais para ler como inteiro.
  // O encaixe dá batente ao gesto e torna o cartão parcial francamente parcial.
  const row = (items: ActivityHighlight[]) => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.hlRow}
      snapToInterval={HL_CARD_W + spacing.sm}
      snapToAlignment="start"
      decelerationRate="fast"
      disableIntervalMomentum
    >
      {items.map(renderCard)}
    </ScrollView>
  );

  return (
    <View style={styles.hlWrap}>
      <Text style={styles.hlTitle}>Recordes</Text>
      {summary.length > 0 && row(summary)}
      {records.length > 0 && row(records)}
    </View>
  );
}

export default function TipoListScreen() {
  useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { label = '' } = useLocalSearchParams<{ label: string }>();

  const _all = useActivitiesStore((s) => s._all);
  const load = useActivitiesStore((s) => s.load);
  useEffect(() => {
    load();
  }, [load]);

  const typed = useMemo(
    () => filterByType(_all.filter((a) => !a.hidden), label),
    [_all, label],
  );
  const sources = useMemo(() => distinctSources(typed), [typed]);

  // ── estado dos filtros (inputs crus) ──────────────────────────
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [sort, setSort] = useState<ActivitySort>('date-desc');
  const [fromStr, setFromStr] = useState('');
  const [toStr, setToStr] = useState('');
  const [minKm, setMinKm] = useState('');
  const [maxKm, setMaxKm] = useState('');
  const [minMin, setMinMin] = useState('');
  const [maxMin, setMaxMin] = useState('');
  const [source, setSource] = useState('');
  const [routeChoice, setRouteChoice] = useState<RouteChoice>('all');

  const filters: ActivityFilters = useMemo(() => {
    const minKmN = numOr(minKm);
    const maxKmN = numOr(maxKm);
    const minMinN = numOr(minMin);
    const maxMinN = numOr(maxMin);
    return {
      fromDate: parseInputDate(fromStr),
      toDate: parseInputDate(toStr),
      minDistanceM: minKmN != null ? minKmN * 1000 : undefined,
      maxDistanceM: maxKmN != null ? maxKmN * 1000 : undefined,
      minDurationS: minMinN != null ? minMinN * 60 : undefined,
      maxDurationS: maxMinN != null ? maxMinN * 60 : undefined,
      sourceName: source || undefined,
      hasRoute: routeChoice === 'all' ? undefined : routeChoice === 'yes',
    };
  }, [fromStr, toStr, minKm, maxKm, minMin, maxMin, source, routeChoice]);

  const filtered = useMemo(() => applyFilters(typed, filters, sort), [typed, filters, sort]);
  const sortLabel = useMemo(
    () => SORT_OPTIONS.find((o) => o.key === sort)?.label ?? '',
    [sort],
  );

  const [visible, setVisible] = useState(PAGE_SIZE);
  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [filters, sort, label]);

  const data = useMemo(() => filtered.slice(0, visible), [filtered, visible]);
  const loadMore = useCallback(() => {
    setVisible((v) => (v >= filtered.length ? v : v + PAGE_SIZE));
  }, [filtered.length]);

  const meta = useMemo(() => {
    const first = typed[0];
    return first
      ? { icon: getActivityMeta(first.activityId).icon, color: getActivityColor(first.activityId) }
      : { icon: 'dumbbell' as const, color: colors.ink2 };
  }, [typed]);

  // Recordes do tipo (corrida/ciclismo) — de todo o histórico, sem os filtros.
  const highlights = useMemo(() => {
    const id = typed[0]?.activityId;
    return id != null ? activityHighlights(typed, id) : [];
  }, [typed]);

  // Só mostra "Visão detalhada" quando há país resolvido (cidades enriquecidas).
  const hasCountries = useMemo(() => ridesByCountry(typed).length > 0, [typed]);

  const goToWorkout = useCallback(
    (id: string) =>
      router.push({ pathname: '/historico/[label]/[id]', params: { label, id } }),
    [router, label],
  );

  const clearFilters = () => {
    setFromStr('');
    setToStr('');
    setMinKm('');
    setMaxKm('');
    setMinMin('');
    setMaxMin('');
    setSource('');
    setRouteChoice('all');
  };

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Activity>) => (
      <ActivityCard
        item={item}
        color={meta.color}
        icon={meta.icon}
        onPress={() =>
          router.push({
            pathname: '/historico/[label]/[id]',
            params: { label, id: item.id },
          })
        }
      />
    ),
    [router, label, meta],
  );

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
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{label}</Text>
          <Text style={styles.headerSub}>
            {filtered.length} de {typed.length}{' '}
            {typed.length === 1 ? 'atividade' : 'atividades'}
          </Text>
        </View>
        <View style={styles.backBtn} />
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
        ListHeaderComponent={
          <View>
            {hasCountries && (
              <Pressable
                onPress={() => router.push({ pathname: '/historico/[label]/mapa', params: { label } })}
                style={({ pressed }) => [styles.detailBtn, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Visão detalhada por país"
              >
                <Ionicons name="map-outline" size={18} color={colors.primary} />
                <Text style={styles.detailBtnText}>Visão detalhada</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.ink3} />
              </Pressable>
            )}
            {highlights.length > 0 && (
              <HighlightsRow items={highlights} onPick={goToWorkout} />
            )}
            <View style={styles.filterWrap}>
            <View style={styles.toolbarRow}>
              <Pressable
                onPress={() => {
                  setShowFilters((v) => !v);
                  setShowSort(false);
                }}
                style={({ pressed }) => [styles.filterToggle, pressed && styles.pressed]}
              >
                <Ionicons name="options-outline" size={16} color={colors.ink2} />
                <Text style={styles.filterToggleText}>Filtros</Text>
                <Ionicons
                  name={showFilters ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={colors.ink3}
                />
              </Pressable>

              <Pressable
                onPress={() => {
                  setShowSort((v) => !v);
                  setShowFilters(false);
                }}
                style={({ pressed }) => [styles.filterToggle, pressed && styles.pressed]}
              >
                <Ionicons name="swap-vertical-outline" size={16} color={colors.ink2} />
                <Text style={styles.filterToggleText}>{sortLabel}</Text>
                <Ionicons
                  name={showSort ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={colors.ink3}
                />
              </Pressable>
            </View>

            {showSort && (
              <View style={styles.sortPanel}>
                {SORT_OPTIONS.map((opt) => {
                  const active = sort === opt.key;
                  return (
                    <Pressable
                      key={opt.key}
                      onPress={() => {
                        setSort(opt.key);
                        setShowSort(false);
                      }}
                      style={({ pressed }) => [styles.sortOption, pressed && styles.pressed]}
                    >
                      <Text style={[styles.sortOptionText, active && styles.sortOptionTextActive]}>
                        {opt.label}
                      </Text>
                      {active && (
                        <Ionicons name="checkmark" size={18} color={colors.primary} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}

            {showFilters && (
              <View style={styles.filterPanel}>
                <Text style={styles.fieldLabel}>Período</Text>
                <View style={styles.row}>
                  <TextInput
                    style={styles.input}
                    placeholder="De dd/mm/aaaa"
                    placeholderTextColor={colors.ink4}
                    value={fromStr}
                    onChangeText={setFromStr}
                    keyboardType="numbers-and-punctuation"
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Até dd/mm/aaaa"
                    placeholderTextColor={colors.ink4}
                    value={toStr}
                    onChangeText={setToStr}
                    keyboardType="numbers-and-punctuation"
                  />
                </View>

                <Text style={styles.fieldLabel}>Distância (km)</Text>
                <View style={styles.row}>
                  <TextInput
                    style={styles.input}
                    placeholder="mín"
                    placeholderTextColor={colors.ink4}
                    value={minKm}
                    onChangeText={setMinKm}
                    keyboardType="decimal-pad"
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="máx"
                    placeholderTextColor={colors.ink4}
                    value={maxKm}
                    onChangeText={setMaxKm}
                    keyboardType="decimal-pad"
                  />
                </View>

                <Text style={styles.fieldLabel}>Duração (min)</Text>
                <View style={styles.row}>
                  <TextInput
                    style={styles.input}
                    placeholder="mín"
                    placeholderTextColor={colors.ink4}
                    value={minMin}
                    onChangeText={setMinMin}
                    keyboardType="number-pad"
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="máx"
                    placeholderTextColor={colors.ink4}
                    value={maxMin}
                    onChangeText={setMaxMin}
                    keyboardType="number-pad"
                  />
                </View>

                {sources.length > 1 && (
                  <>
                    <Text style={styles.fieldLabel}>Fonte</Text>
                    <View style={styles.chips}>
                      {sources.map((s) => {
                        const active = source === s;
                        return (
                          <Pressable
                            key={s}
                            onPress={() => setSource(active ? '' : s)}
                            style={[styles.chip, active && styles.chipActive]}
                          >
                            <Text style={[styles.chipText, active && styles.chipTextActive]}>
                              {s}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </>
                )}

                <Text style={styles.fieldLabel}>Rota GPS</Text>
                <View style={styles.chips}>
                  {(
                    [
                      { k: 'all', l: 'Todos' },
                      { k: 'yes', l: 'Com rota' },
                      { k: 'no', l: 'Sem rota' },
                    ] as { k: RouteChoice; l: string }[]
                  ).map(({ k, l }) => {
                    const active = routeChoice === k;
                    return (
                      <Pressable
                        key={k}
                        onPress={() => setRouteChoice(k)}
                        style={[styles.chip, active && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{l}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Pressable onPress={clearFilters} style={styles.clearBtn}>
                  <Text style={styles.clearText}>Limpar filtros</Text>
                </Pressable>
              </View>
            )}
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="filter-outline" size={36} color={colors.ink4} />
            <Text style={styles.emptyText}>Nenhuma atividade com esses filtros</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  detailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 10,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radii.lg,
  },
  detailBtnText: { flex: 1, fontSize: 14, fontFamily: fonts.sansBold, color: colors.primary },
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
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 22, fontFamily: fonts.serif, color: colors.ink },
  headerSub: { fontSize: 12, color: colors.ink3, fontFamily: fonts.mono, marginTop: 2 },

  list: { paddingHorizontal: spacing.lg, paddingBottom: 40, gap: 10 },

  hlWrap: { marginBottom: 14, gap: spacing.sm },
  hlTitle: {
    fontSize: 11,
    color: colors.ink3,
    textTransform: 'uppercase',
    letterSpacing: 1.0,
    fontFamily: fonts.sansSemiBold,
  },
  hlRow: { gap: spacing.sm, paddingRight: spacing.lg },
  hlCard: {
    borderRadius: radii.xl,
    // Sempre 1px: na casca preenchida a borda é transparente. Desenhar a linha
    // condicionalmente mudaria a caixa de tamanho entre os temas.
    borderWidth: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    width: HL_CARD_W,
    gap: 4,
  },
  // `ink2` e não `ink3`: o cinza claro do escuro sobre o tint claro media 2,94.
  hlLabel: { fontSize: 11.5, color: colors.ink2, fontFamily: fonts.sansSemiBold },
  hlValue: { fontSize: 20, fontFamily: fonts.mono, color: colors.ink, marginTop: 2 },
  hlCaption: { fontSize: 11, color: colors.ink2, fontFamily: fonts.mono },

  filterWrap: { marginBottom: 10, gap: 10 },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    ...shadows.sm,
  },
  filterToggleText: { fontSize: 13, fontFamily: fonts.sansSemiBold, color: colors.ink2 },
  sortPanel: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    ...shadows.card,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm + 1,
  },
  sortOptionText: { fontSize: 14, fontFamily: fonts.sans, color: colors.ink2 },
  sortOptionTextActive: { color: colors.primary, fontFamily: fonts.sansSemiBold },
  filterPanel: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.card,
  },
  fieldLabel: {
    fontSize: 11, fontFamily: fonts.sans,
    color: colors.ink3,
    textTransform: 'uppercase',
    letterSpacing: 1.0,
    marginTop: spacing.xs,
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceMute,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: colors.ink,
    fontFamily: fonts.mono,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceMute,
  },
  chipActive: { backgroundColor: colors.ink },
  chipText: { fontSize: 12.5, fontFamily: fonts.sans, color: colors.ink2 },
  chipTextActive: { color: '#fff' },
  clearBtn: { alignSelf: 'flex-start', marginTop: spacing.sm },
  clearText: { fontSize: 13, color: colors.primary, fontFamily: fonts.sansSemiBold },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radii['2xl'],
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardDate: { fontSize: 15, fontFamily: fonts.sansSemiBold, color: colors.ink },
  cardTime: { fontSize: 12.5, color: colors.ink3, fontFamily: fonts.mono, marginTop: 2 },
  editBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceMute,
  },
  editBadgeText: { fontSize: 10.5, fontFamily: fonts.sans, color: colors.ink2 },

  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, paddingLeft: 52 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statValue: { fontSize: 13, color: colors.ink2, fontFamily: fonts.mono },

  empty: { alignItems: 'center', paddingTop: 60, gap: spacing.md },
  emptyText: { fontSize: 15, fontFamily: fonts.sans, color: colors.ink3, textAlign: 'center' },
}));
