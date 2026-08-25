import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  ListRenderItemInfo,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ActivityRoutePoint, CountryCityMark } from '@vitale/shared';
import {
  activitiesInCountry,
  citiesInCountry,
  countryAt,
  countryShares,
  countryStats,
  countryViewport,
  ridesByCountry,
  routesInCountry,
} from '@vitale/shared';
import { useActivitiesStore } from '../../../store/activities.store';
import { filterByType } from '../../../lib/activity-list-filter';
import { formatDistance } from '../../../lib/workout-format';
import { CountryMap } from '../../../components/CountryMap';
import { CountryStats } from '../../../components/CountryStats';
import { CountryPicker } from '../../../components/CountryPicker';
import { colors, spacing, radii, useTheme } from '../../../theme';

/**
 * Visão detalhada por país (mobile). A partir da tela do tipo, mostra o mapa de
 * todas as rotas do país + estatísticas + lista de cidades. A lógica de
 * agregação vem toda do `@vitale/shared` (mesma da web). A lista de pedaladas
 * NÃO se repete aqui — ela já vive na tela do tipo.
 */
export default function CountryMapScreen() {
  useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { label = '', country = '' } = useLocalSearchParams<{ label: string; country?: string }>();

  const _all = useActivitiesStore((s) => s._all);
  const loaded = useActivitiesStore((s) => s.loaded);
  const load = useActivitiesStore((s) => s.load);
  const loadRouteOverviews = useActivitiesStore((s) => s.loadRouteOverviews);
  useEffect(() => {
    load();
  }, [load]);

  const typed = useMemo(() => filterByType(_all.filter((a) => !a.hidden), label), [_all, label]);
  const countries = useMemo(() => ridesByCountry(typed), [typed]);
  const selected = country.toUpperCase();
  const summary = useMemo(
    () => countries.find((c) => c.code === selected),
    [countries, selected],
  );

  const rides = useMemo(
    () => (selected ? activitiesInCountry(typed, selected) : []),
    [typed, selected],
  );
  const cities = useMemo(
    () => (selected ? citiesInCountry(typed, selected) : []),
    [typed, selected],
  );
  // Auto-seleção quando há exatamente 1 país e nenhum na URL.
  useEffect(() => {
    if (!loaded || selected) return;
    if (countries.length === 1) {
      router.replace({
        pathname: '/historico/[label]/mapa',
        params: { label, country: countries[0].code },
      });
    }
  }, [loaded, selected, countries, label, router]);

  // Carrega as rotas reduzidas do país em lote. `reqKey` marca a requisição
  // vigente. Ao trocar de país (ou de conjunto de atividades) limpamos as rotas
  // ANTES de recarregar — senão o `countryViewport` enquadraria com as rotas do
  // país anterior, que caem fora do novo bbox e derrubam o zoom para o país
  // inteiro. O `.then` só aplica se ainda for a requisição vigente; um re-render
  // com a MESMA chave não cancela o fetch em voo (evita ficar preso nas rotas
  // antigas, que era o bug ao trocar de país pelo dropdown).
  const [routesById, setRoutesById] = useState<ReadonlyMap<string, ActivityRoutePoint[]>>(new Map());
  const reqKey = useRef('');
  useEffect(() => {
    if (!selected) {
      reqKey.current = '';
      setRoutesById(new Map());
      return;
    }
    const ids = rides.map((r) => r.id);
    const key = `${selected}:${ids.join(',')}`;
    if (key === reqKey.current) return;
    reqKey.current = key;
    setRoutesById(new Map());
    void loadRouteOverviews(ids).then((map) => {
      if (reqKey.current !== key) return;
      setRoutesById(map);
    });
  }, [rides, selected, loadRouteOverviews]);

  /** As linhas do mapa: rotas recortadas ao território do país, pelo mesmo
   *  critério do rateio. Uma pedalada que só encostou aqui entra só com o trecho
   *  que aconteceu aqui — e o enquadramento segue junto. */
  const routes = useMemo(
    () => routesInCountry(rides, routesById, selected, countryAt),
    [rides, routesById, selected],
  );

  /** Agregados do país, com o volume rateado pelo trecho que aconteceu dentro
   *  dele — sem isso uma pedalada cross-border somaria seus km inteiros nos dois
   *  países. Enquanto as rotas não chegam, `countryShares` cai no rateio por
   *  cidades e os números já nascem aproximados, convergindo depois. */
  const stats = useMemo(
    () => countryStats(rides, countryShares(rides, routesById, selected, countryAt)),
    [rides, routesById, selected],
  );

  const viewport = useMemo(
    () => (selected ? countryViewport(selected, routes) : null),
    [selected, routes],
  );
  const mapRoutes = useMemo(
    () => routes.map((r) => r.map((p) => ({ latitude: p.lat, longitude: p.lng }))),
    [routes],
  );

  const goBack = () => router.back();
  const pickCountry = (code: string) =>
    router.setParams({ country: code });

  const renderCity = ({ item }: ListRenderItemInfo<CountryCityMark>) => (
    <View style={styles.cityRow}>
      <View style={styles.dot} />
      <Text style={styles.cityName} numberOfLines={1}>
        {item.name}
        {item.state ? <Text style={styles.cityState}> · {item.state}</Text> : null}
      </Text>
      {item.visitCount > 1 ? <Text style={styles.visits}>{item.visitCount}×</Text> : null}
    </View>
  );

  // ── estados sem país selecionado ──────────────────────────────
  const header = (title: string, sub?: string) => (
    <View style={styles.header}>
      <Pressable onPress={goBack} hitSlop={12} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
        <Ionicons name="chevron-back" size={22} color={colors.ink} />
      </Pressable>
      <View style={styles.headerCenter}>
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        {sub ? <Text style={styles.headerSub}>{sub}</Text> : null}
      </View>
      <View style={styles.backBtn} />
    </View>
  );

  if (!selected) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        {header(label)}
        {!loaded ? (
          <Text style={styles.state}>Carregando…</Text>
        ) : countries.length === 0 ? (
          <Text style={styles.state}>Nenhuma cidade foi resolvida ainda para suas atividades.</Text>
        ) : countries.length === 1 ? (
          <Text style={styles.state}>Abrindo…</Text>
        ) : (
          <ScrollView contentContainerStyle={styles.pickerWrap} showsVerticalScrollIndicator={false}>
            <Text style={styles.pickerTitle}>Onde você já pedalou · {countries.length} países</Text>
            <CountryPicker countries={countries} onSelect={pickCountry} />
          </ScrollView>
        )}
      </View>
    );
  }

  // ── país selecionado ─────────────────────────────────────────
  // A distância vem de `stats`, não do `summary`: o resumo da grade usa o rateio
  // grosseiro por cidades e discordaria da faixa logo abaixo.
  const sub = summary
    ? `${summary.rideCount} ${summary.rideCount === 1 ? 'pedalada' : 'pedaladas'}` +
      `${formatDistance(stats.distanceM) ? ` · ${formatDistance(stats.distanceM)}` : ''}` +
      ` · ${cities.length} cidades`
    : undefined;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      {header(`${summary?.flag ?? ''} ${summary?.name ?? selected}`.trim(), sub)}

      <FlatList
        data={cities}
        keyExtractor={(c) => c.name}
        renderItem={renderCity}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.headerContent}>
            {countries.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chips}
              >
                {countries.map((c) => (
                  <Pressable
                    key={c.code}
                    onPress={() => pickCountry(c.code)}
                    style={({ pressed }) => [
                      styles.chip,
                      c.code === selected && styles.chipActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.chipText, c.code === selected && styles.chipTextActive]}>
                      {c.flag} {c.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}

            {viewport && mapRoutes.length > 0 ? (
              <CountryMap routes={mapRoutes} viewport={viewport} />
            ) : (
              <View style={styles.mapSkeleton}>
                <Text style={styles.state}>Carregando rotas…</Text>
              </View>
            )}

            <CountryStats stats={stats} cityCount={cities.length} />

            <View style={styles.citiesHead}>
              <Text style={styles.citiesTitle}>Cidades</Text>
              <Text style={styles.citiesTotal}>{cities.length}</Text>
            </View>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
  headerSub: { fontSize: 12.5, color: colors.ink3, marginTop: 2 },
  state: { textAlign: 'center', color: colors.ink2, fontSize: 14, padding: spacing['3xl'] },

  pickerWrap: { padding: spacing.lg, gap: spacing.md },
  pickerTitle: { fontSize: 13, color: colors.ink3, fontWeight: '600' },

  list: { padding: spacing.lg, gap: 0 },
  headerContent: { gap: spacing.lg, marginBottom: spacing.md },

  chips: { gap: spacing.sm, paddingBottom: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.ink2 },
  chipTextActive: { color: colors.primaryDeep },

  mapSkeleton: {
    height: 260,
    borderRadius: radii['2xl'],
    backgroundColor: colors.surfaceMute,
    alignItems: 'center',
    justifyContent: 'center',
  },

  citiesHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  citiesTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: colors.ink3,
  },
  citiesTotal: { fontSize: 13, fontWeight: '700', color: colors.ink2 },

  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
  cityName: { flex: 1, fontSize: 15, color: colors.ink },
  cityState: { color: colors.ink3, fontSize: 13 },
  visits: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink3,
    backgroundColor: colors.surfaceMute,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
});
