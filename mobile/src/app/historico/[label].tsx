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
import {
  BEST_EFFORT_DISTANCES,
  SURFACE_RANGES,
  gearForActivity,
  gearUsage,
  ridesByCountry,
  summarizeSurface,
  surfaceWindow,
  type SurfaceRange,
} from '@vitale/shared';

/** As distâncias padrão — os recordes por distância agora vivem na curva, não em cards. */
const EFFORT_KEYS = new Set(BEST_EFFORT_DISTANCES.map((d) => d.key));
import { useActivitiesStore } from '../../store/activities.store';
import { useGearStore } from '../../store/gear.store';
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
import { activityHighlights, activityNoun, type ActivityHighlight } from '../../lib/running-highlights';
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
import { HeaderSpacer } from '../../components/ui/HeaderSpacer';
import { Segmented } from '../../components/ui/Segmented';
import { PanelTabs, type Panel } from '../../components/ui/PanelTabs';
import { TypeEvolutionCard } from '../../components/cards/TypeEvolutionCard';
import { EffortTrendCard } from '../../components/cards/EffortTrendCard';
import { RecurringRoutesCard } from '../../components/cards/RecurringRoutesCard';
import { RecordCurveCard } from '../../components/cards/RecordCurveCard';
import { SurfaceCard } from '../../components/cards/SurfaceCard';

const SURFACE_OPTIONS = SURFACE_RANGES.map((r) => ({ key: r.id, label: r.label }));

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

/**
 * O rodapé do cartão de piso diz de onde o número veio: quantas pedaladas da
 * janela entraram na soma e quanto do piso foi inferido pelo tipo de via em vez
 * de lido de uma tag — o "não sei" tem que ser visível (ADR 0035).
 */
function surfaceCaption(count: number, withSurface: number, inferidoM: number, totalM: number, period: string): string {
  const cover = withSurface === count ? `${count} pedaladas` : `${withSurface} de ${count} pedaladas com piso`;
  const inf = totalM > 0 ? Math.round((inferidoM / totalM) * 100) : 0;
  return `${period} · ${cover}${inf > 0 ? ` · ${inf}% inferido pelo tipo de via` : ''}`;
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
  // UMA fileira, não duas. Eram duas — resumo em cima, recordes embaixo — para
  // cinco números, e duas fileiras de carrossel custam 214 pt logo no topo da
  // tela. Sem o cartão "Total" (que virou a manchete do cabeçalho) sobram
  // quatro no Ciclismo e dois na Corrida: cabem numa fileira só, e os Recordes
  // voltam a ser a primeira coisa que se lê.
  //
  // Os oito cards de best effort continuam de fora: viraram a curva de
  // recordes, que mostra os mesmos números como forma e, no toque, com data e
  // link. Os badges do herói e o ranking continuam vendo tudo.
  const cards = items.filter((h) => !EFFORT_KEYS.has(h.key));

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

  if (cards.length === 0) return null;

  return (
    <View style={styles.hlWrap}>
      <Text style={styles.hlTitle}>Recordes</Text>
      {row(cards)}
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
  const gears = useGearStore((s) => s.gears);
  const loadGear = useGearStore((s) => s.load);
  useEffect(() => {
    load();
    loadGear();
  }, [load, loadGear]);

  /** Tudo do tipo, sem a lente de bicicleta — é o universo do seletor. */
  const typedAll = useMemo(
    () => filterByType(_all.filter((a) => !a.hidden), label),
    [_all, label],
  );

  // ── lente de bicicleta (ADR 0034) ──────────────────────────────
  // Só as bikes que este tipo de fato usou; tipo sem bike não ganha seletor.
  // A lente vale para tudo abaixo — lista, recordes, curvas, evolução — porque
  // "recorde com a Nuroad" e "recorde de sempre" são perguntas diferentes.
  const bikes = useMemo(() => gearUsage(gears, typedAll).filter((u) => u.count > 0), [gears, typedAll]);
  const [gearId, setGearId] = useState<string>('all');
  const [showGear, setShowGear] = useState(false);
  const gearLabel = useMemo(
    () => (gearId === 'all' ? 'Todas as bikes' : bikes.find((u) => u.gear.id === gearId)?.gear.name ?? 'Bicicleta'),
    [gearId, bikes],
  );
  const typed = useMemo(
    () =>
      gearId === 'all' ? typedAll : typedAll.filter((a) => gearForActivity(gears, a)?.id === gearId),
    [typedAll, gears, gearId],
  );
  const sources = useMemo(() => distinctSources(typed), [typed]);

  // ── piso (ADR 0035): soma do período, sob a lente de bicicleta ────
  // Só aparece quando alguma pedalada do tipo já tem piso calculado — corrida
  // e yoga nunca terão, e um cartão vazio não diz nada.
  const [surfaceRange, setSurfaceRange] = useState<SurfaceRange>('tudo');
  const hasSurface = useMemo(() => typed.some((a) => a.surfaceMix && a.surfaceMix.total > 0), [typed]);
  const surface = useMemo(
    () => (hasSurface ? summarizeSurface(typed, surfaceWindow(surfaceRange)) : null),
    [typed, surfaceRange, hasSurface],
  );

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
  }, [filters, sort, label, gearId]);

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

  /** Mesma regra do card do tipo: mede em km quem tem distância, em min o resto. */
  const hasDistance = useMemo(() => typed.some((a) => (a.distanceM ?? 0) > 0), [typed]);

  /**
   * A manchete do cabeçalho: o que este esporte é, em dois números.
   *
   * Existe porque o cartão "Total" saiu da tira de Recordes — o mesmo número
   * morava no subtítulo, no cartão e no rodapé do Piso, e número repetido não é
   * reforço: faz parar para conferir se são o mesmo. Responde à lente, como
   * tudo abaixo dela: "1.321 km · 22 pedaladas" é a Nuroad, não o histórico.
   *
   * Com filtro ligado ela cede o lugar para a contagem. Saber que 12 de 148
   * passaram é mais urgente que o total, e é a única resposta que a tela dá
   * sobre o filtro ter pegado alguma coisa.
   */
  const headline = useMemo(() => {
    const n = typed.length;
    if (n === 0) return 'nenhuma atividade';
    const noun = activityNoun(typed[0].activityId, n);
    if (filtered.length !== n) return `${filtered.length} de ${noun}`;
    if (!hasDistance) {
      const secs = typed.reduce((s, a) => s + (a.movingTimeS ?? a.durationS), 0);
      return `${formatDuration(secs)} · ${noun}`;
    }
    const km = typed.reduce((s, a) => s + (a.distanceM ?? 0), 0) / 1000;
    return `${km.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} km · ${noun}`;
  }, [typed, filtered.length, hasDistance]);

  // Recordes do tipo (corrida/ciclismo) — de todo o histórico, sem os filtros
  // da lista; a lente de bicicleta, essa vale.
  const highlights = useMemo(() => {
    const id = typed[0]?.activityId;
    return id != null ? activityHighlights(typed, id) : [];
  }, [typed]);

  // Só mostra o Mapa quando há país resolvido (cidades enriquecidas).
  const hasCountries = useMemo(() => ridesByCountry(typed).length > 0, [typed]);

  /**
   * Os painéis de leitura, um por vez.
   *
   * Evolução e Piso empilhados custavam 500 pt e competiam: dois cartões
   * densos, um atrás do outro, e a lista de pedaladas nascia na segunda
   * rolagem. Em abas custam 276 e se revezam.
   *
   * Evolução é a aba padrão porque "como estou indo" é pergunta de todo dia e
   * "onde ando pisando" é de todo mês. O Piso só vira aba quando existe — a
   * corrida nunca terá piso medido, e aba vazia é pior que aba nenhuma.
   *
   * A Curva, o Melhor-por-mês e as Rotas continuam **fora** do painel, abaixo
   * dele: no Ciclismo nenhum deles renderiza (não há `bestEfforts`, e ciclismo
   * não repete rota), e na Corrida quatro abas apertam a barra. Essa é a
   * decisão que espera conferência no aparelho.
   */
  const panels = useMemo<Panel[]>(() => {
    const out: Panel[] = [
      {
        key: 'evolucao',
        label: 'Evolução',
        render: () => (
          <TypeEvolutionCard
            activities={typed}
            label={label}
            hasDistance={hasDistance}
            color={meta.color}
            // Só dentro do painel: numa pilha, sumir é o certo; numa aba
            // selecionada, sumir vira tela em branco. Acontece de verdade com a
            // lente numa bicicleta parada há meses.
            emptyLabel={surface ? 'Nada nas últimas 24 semanas com esta lente.' : undefined}
          />
        ),
      },
    ];
    if (surface) {
      out.push({
        key: 'piso',
        label: 'Piso',
        render: () => (
          <View style={styles.surfaceWrap}>
            <Segmented options={SURFACE_OPTIONS} value={surfaceRange} onChange={setSurfaceRange} />
            <SurfaceCard
              mix={surface.mix}
              caption={surfaceCaption(
                surface.count,
                surface.withSurface,
                surface.mix.inferido,
                surface.mix.total,
                surfaceWindow(surfaceRange).label,
              )}
            />
          </View>
        ),
      });
    }
    return out;
  }, [typed, label, hasDistance, meta.color, surface, surfaceRange]);

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
          <Text style={styles.headerSub} numberOfLines={1}>{headline}</Text>
        </View>
        <HeaderSpacer />
      </View>

      {/* A lente e a saída, fixas acima da lista.
          A bicicleta governa TUDO abaixo — manchete, recordes, painéis e lista —
          e vivia na barra de filtros, depois de tudo que comanda: dava para ler
          "87% pavimentado" sem saber de qual bike. Aqui ela fica à vista mesmo
          com a lista rolada, que é quando a pergunta "de qual bike é isto?"
          aparece. O Mapa vem junto porque é saída, não dado — era uma faixa de
          largura inteira só para dizer que existe outra tela; na web ele já
          mora no cabeçalho, e agora as duas plataformas concordam. */}
      {(bikes.length > 0 || hasCountries) && (
        <View style={styles.lensWrap}>
          <View style={styles.lensRow}>
            {bikes.length > 0 && (
              <Pressable
                onPress={() => {
                  setShowGear((v) => !v);
                  setShowSort(false);
                  setShowFilters(false);
                }}
                style={({ pressed }) => [
                  styles.filterToggle,
                  styles.lensGrow,
                  gearId !== 'all' && styles.filterToggleOn,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Filtrar por bicicleta"
              >
                <MaterialCommunityIcons
                  name="bike"
                  size={16}
                  color={gearId === 'all' ? colors.ink2 : colors.bgPure}
                />
                <Text
                  style={[styles.filterToggleText, gearId !== 'all' && styles.filterToggleTextOn]}
                  numberOfLines={1}
                >
                  {gearLabel}
                </Text>
                <Ionicons
                  name={showGear ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={gearId === 'all' ? colors.ink3 : colors.bgPure}
                />
              </Pressable>
            )}

            {hasCountries && (
              <Pressable
                onPress={() =>
                  router.push({ pathname: '/historico/[label]/mapa', params: { label } })
                }
                style={({ pressed }) => [styles.filterToggle, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Visão detalhada por país"
              >
                <Ionicons name="map-outline" size={16} color={meta.color} />
                <Text style={styles.filterToggleText}>Mapa</Text>
              </Pressable>
            )}
          </View>

          {showGear && (
            <View style={styles.sortPanel}>
              {[{ id: 'all', name: 'Todas as bicicletas', sub: `${typedAll.length} saídas` },
                ...bikes.map((u) => ({
                  id: u.gear.id,
                  name: u.gear.name,
                  sub: `${u.count} · ${Math.round(u.distanceM / 1000).toLocaleString('pt-BR')} km`,
                }))].map((o) => {
                const active = gearId === o.id;
                return (
                  <Pressable
                    key={o.id}
                    onPress={() => {
                      setGearId(o.id);
                      setShowGear(false);
                    }}
                    style={({ pressed }) => [styles.sortOption, pressed && styles.pressed]}
                  >
                    <Text style={[styles.sortOptionText, active && styles.sortOptionTextActive]}>
                      {o.name}
                    </Text>
                    <Text style={styles.gearOptionSub}>{o.sub}</Text>
                    {active && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                  </Pressable>
                );
              })}
              {/* A vontade de cadastrar aparece aqui, escolhendo bicicleta e não
                  achando a que se quer — então é daqui que se chega à tela. */}
              <Pressable
                onPress={() => {
                  setShowGear(false);
                  router.push('/bicicletas');
                }}
                style={({ pressed }) => [styles.sortOption, pressed && styles.pressed]}
              >
                <Text style={[styles.sortOptionText, styles.gearManage]}>Gerenciar bicicletas</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.ink3} />
              </Pressable>
            </View>
          )}
        </View>
      )}

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
            {/* Os Recordes são a primeira coisa — o que a tela promete. O Piso
                os havia empurrado para baixo da dobra: contexto tinha virado
                manchete, e o que se abre a tela para ver ficou em terceiro. */}
            {highlights.length > 0 && (
              <HighlightsRow items={highlights} onPick={goToWorkout} />
            )}

            {/* Depois dos recordes, de propósito: eles contam o que já
                aconteceu, o painel conta para onde está indo — e onde se pisa. */}
            <PanelTabs panels={panels} />

            {/* Os recordes em forma: os mesmos pontos da tira acima, num eixo
                só, para ler onde é forte e onde cai. Some com menos de duas marcas. */}
            {typed[0] && (
              <RecordCurveCard activities={gearId === 'all' ? _all : typed} sportId={typed[0].activityId} color={meta.color} onPick={goToWorkout} />
            )}
            {/* Volume responde "quanto"; isto responde "estou diminuindo?" —
                o melhor por distância, contra o recorde. Some quando o tipo
                não tem marca nenhuma. */}
            {typed[0] && (
              <EffortTrendCard activities={gearId === 'all' ? _all : typed} sportId={typed[0].activityId} color={meta.color} />
            )}
            {/* Recorde compara a mesma distância; isto compara o mesmo
                percurso, que controla desnível, curvas e semáforos. Some quando
                o esporte não repete rota — o caso do ciclismo. */}
            <RecurringRoutesCard activities={typed} onPick={goToWorkout} />
            <View style={styles.filterWrap}>
            <View style={styles.toolbarRow}>
              <Pressable
                onPress={() => {
                  setShowFilters((v) => !v);
                  setShowSort(false);
                  setShowGear(false);
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
                  setShowGear(false);
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

              {/* A bicicleta saiu daqui: ela não é um filtro entre outros, é a
                  lente que governa a tela inteira — e mora no cabeçalho, acima
                  do que comanda. Com dois chips a linha volta a caber sem
                  quebrar, que era o outro defeito. */}
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
  // A lente vive fora da FlatList, e por isso fica fixa: a pergunta "de qual
  // bike é isto?" aparece justamente com a lista rolada.
  lensWrap: { paddingHorizontal: spacing.lg, paddingBottom: 10, gap: 10 },
  lensRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  lensGrow: { flex: 1 },
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
  surfaceWrap: { gap: 10, marginBottom: 10 },
  gearOptionSub: { marginLeft: 'auto', marginRight: spacing.sm, fontSize: 11.5, fontFamily: fonts.mono, color: colors.ink3 },
  // Tinta, não marca: a catraca da ADR 0024 não deixa o acento crescer como cor
  // de letra, e quem sinaliza navegação aqui é o chevron.
  gearManage: { color: colors.ink, fontFamily: fonts.sansSemiBold },

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
    // A quebra fica mesmo com o chip de bicicleta fora daqui: rótulo de ordem
    // é longo ("Maior distância") e o aparelho pode estar em fonte grande.
    // Quebrando, o chip desce inteiro e legível em vez de ser cortado.
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  filterToggle: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    ...shadows.sm,
  },
  filterToggleText: { fontSize: 13, fontFamily: fonts.sansSemiBold, color: colors.ink2, flexShrink: 1 },
  // Lente ligada = chip cheio. `ink` sobre `bgPure` em vez da marca: a marca é
  // cromo (ADR do tema), e aqui o que se comunica é "há um filtro", não uma ação.
  filterToggleOn: { backgroundColor: colors.ink },
  filterToggleTextOn: { color: colors.bgPure },
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
