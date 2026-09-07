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
import {
  HR_ZONES,
  METRIC_ROLE,
  elevationProfile,
  gearForActivity,
  hrZoneRange,
  movingTimeFromRoutePoints,
  routeCursorAt,
  routeDistances,
  speedSeries,
  type MetricKey,
  type ActivityPhoto,
  type RouteCursor,
} from '@vitale/shared';
import { useActivitiesStore } from '../../../store/activities.store';
import { useAuthStore } from '../../../store/auth.store';
import { nomearPedaladaSePreciso, precisaDeNome } from '../../../services/route-name';
import { useGearStore } from '../../../store/gear.store';
import { useSettingsStore } from '../../../store/settings.store';
import { GearPicker } from '../../../components/cards/GearPicker';

/** Código de ciclismo do HealthKit — só pedalada tem bicicleta. */
const BIKE_ACTIVITY_ID = 13;
import { getActivityMeta, getActivityColor, resolveElevationM } from '../../../lib/workout-types';
import { activityRecordBadges } from '../../../lib/running-highlights';
import { WorkoutMap } from '../../../components/WorkoutMap';
import { RouteProfileCard } from '../../../components/cards/RouteProfileCard';
import { ActivityPhotosCard } from '../../../components/photos/ActivityPhotosCard';
import { ShareComposerModal } from '../../../components/share/ShareComposerModal';
import { useActivityPhotos } from '../../../hooks/useActivityPhotos';
import { TimeRailCard } from '../../../components/photos/TimeRailCard';
import { ClimbsCard } from '../../../components/cards/ClimbsCard';
import { SegmentsCard } from '../../../components/cards/SegmentsCard';
import { SurfaceCard } from '../../../components/cards/SurfaceCard';
import {
  formatFullDate,
  formatTime,
  formatDuration,
  formatDistance,
  formatRate,
  formatElevation,
  formatClock,
  totalTimeS,
} from '../../../lib/workout-format';
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
} from '../../../theme';
import { HeaderSpacer } from '../../../components/ui/HeaderSpacer';

type InfoRow = { label: string; value: string; onPress?: () => void };

/**
 * Uma estatística da tira do herói.
 *
 * A cor vem da **métrica**, não da atividade: numa tela de uma atividade só, o
 * tipo é constante — o título e o ícone do herói já o dizem — e pintar as cinco
 * com ele era gastar cor num dado que não varia. O ícone do herói continua na
 * cor do tipo, e é onde essa identidade fica concentrada.
 */
function Stat({
  icon,
  value,
  caption,
  metric,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  caption: string;
  metric: MetricKey;
}) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={18} color={roleColors(METRIC_ROLE[metric]).accent} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statCaption}>{caption}</Text>
    </View>
  );
}

export default function AtividadeDetalheScreen() {
  useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id = '' } = useLocalSearchParams<{ label: string; id: string }>();

  const _all = useActivitiesStore((s) => s._all);
  const load = useActivitiesStore((s) => s.load);
  const loadRoute = useActivitiesStore((s) => s.loadRoute);
  const updateActivity = useActivitiesStore((s) => s.updateActivity);
  const setHidden = useActivitiesStore((s) => s.setHidden);
  const routePoints = useActivitiesStore((s) => s.routes[id]);
  const userId = useAuthStore((s) => s.user?.id);
  const gears = useGearStore((s) => s.gears);
  const loadGear = useGearStore((s) => s.load);
  const setActivityGearId = useActivitiesStore((s) => s.setGear);
  const [pickingGear, setPickingGear] = useState(false);
  /** Mesma preferência que o mapa usa — o compositor abre no estilo dele. */
  const mapStyle = useSettingsStore((st) => st.preferences?.mapStyle) ?? 'voyager';

  const activity = useMemo(() => _all.find((a) => a.id === id), [_all, id]);
  // A bike desta pedalada: override explícito ou herança pela data (ADR 0034).
  const gear = useMemo(() => (activity ? gearForActivity(gears, activity) : undefined), [gears, activity]);

  useEffect(() => {
    load();
    loadGear();
  }, [load, loadGear]);

  const hasGps = !!activity && (activity.hasRoute || (activity.distanceM ?? 0) > 0);

  /**
   * O nome da rota, uma vez por pedalada (ADR 0042).
   *
   * Mesmo gatilho e mesmo contrato da varredura de fotos: espera o traçado
   * chegar, roda uma vez, e falha em silêncio. A pedalada que não ganhou nome
   * fica sem `route_name_meta` e volta a tentar na próxima abertura — não há
   * nada que o dono possa fazer com um aviso de cota do provedor.
   */
  useEffect(() => {
    if (!activity || !userId) return;
    if (!precisaDeNome(activity)) return;
    if (!routePoints || routePoints.length < 2) return;
    let alive = true;
    void (async () => {
      const nome = await nomearPedaladaSePreciso(activity, routePoints, userId);
      if (alive && nome) await load();
    })();
    return () => {
      alive = false;
    };
    // Governam esta passagem a pedalada, o dono e **se a rota já chegou**.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity?.id, activity?.routeName, activity?.routeNameChecked, userId, routePoints]);

  useEffect(() => {
    if (activity?.hasRoute) loadRoute(activity.id);
  }, [activity?.id, activity?.hasRoute, loadRoute]);

  // ── cursor do scrub: o dedo no gráfico vira um ponto no mapa ──
  const [cursorX, setCursorX] = useState<number | null>(null);
  /**
   * A régua só muda quando a rota muda. Sem o memo, cada quadro do arrasto
   * recalcularia milhares de haversines e o ponto engasgaria atrás do dedo.
   */
  const scrubRuler = useMemo(() => {
    const pts = routePoints ?? [];
    return {
      pts,
      distances: routeDistances(pts),
      profile: elevationProfile(pts),
      speed: speedSeries(pts),
    };
  }, [routePoints]);
  const mapCursor = useMemo<RouteCursor | null>(
    () =>
      cursorX === null
        ? null
        : routeCursorAt(
            scrubRuler.pts,
            scrubRuler.distances,
            cursorX,
            scrubRuler.profile,
            scrubRuler.speed,
          ),
    [cursorX, scrubRuler],
  );

  // As fotos desta pedalada (ADR 0037). Um só carregamento para as duas telas
  // que precisam delas: os marcadores do mapa e o cartão embaixo dos números.
  const photoView = useActivityPhotos(id, routePoints ?? [], activity?.distanceM);

  // ── estado de edição ──────────────────────────────────────────
  const [name, setName] = useState('');
  const [durationMin, setDurationMin] = useState('');
  const [saving, setSaving] = useState(false);
  const [togglingHidden, setTogglingHidden] = useState(false);

  /**
   * Compartilhar a partir do visor da galeria (ADR 0037).
   *
   * O compositor mora **aqui**, e não dentro do mapa como o outro caminho,
   * porque a galeria precisa continuar aberta atrás dele: sair do compositor
   * devolve o dono à mesma foto. Uma pedalada tem até 60, e fechar a galeria
   * obrigaria a rolar tudo de novo.
   */
  const [sharePhoto, setSharePhoto] = useState<ActivityPhoto | null>(null);


  useEffect(() => {
    if (activity) {
      setName(activity.activityName ?? '');
      setDurationMin(String(Math.round(activity.durationS / 60)));
    }
  }, [activity?.id]);

  if (!activity) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Stack.Screen
          options={{
            headerShown: false,
            // O perfil e o trilho ocupam a largura da janela, e a esquerda deles
            // é o início dos dados — a mesma faixa em que o iOS reconhece o
            // swipe-back. Três tentativas de conviver falharam: a guarda de
            // borda inutiliza a esquerda do gráfico, e desligar o gesto no
            // toque não chega a tempo (a viagem JS→nativo leva um quadro e o
            // reconhecedor já começou). Só o desligamento estático funciona.
            // Fica o chevron do cabeçalho.
            gestureEnabled: false,
          }}
        />
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </Pressable>
          <HeaderSpacer />
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
  // Tempo total = relógio de parede (fim − início) só para atividades com GPS;
  // sem GPS, `durationS` é a duração editável e canônica.
  const totalS = hasGps ? totalTimeS(activity.startAt, activity.endAt, activity.durationS) : activity.durationS;
  // Tempo em movimento: derivado do track GPS (descarta paradas), com fallback
  // para o valor sincronizado e, por fim, a duração. Limitado pelo tempo total.
  const movingFromTrack = hasGps ? movingTimeFromRoutePoints(routePoints) : undefined;
  const movingS = Math.min(movingFromTrack ?? activity.movingTimeS ?? activity.durationS, totalS);
  const rate = hasGps ? formatRate(activity.activityId, activity.distanceM, movingS) : null;
  const points = (routePoints ?? []).map((p) => ({
    latitude: p.lat,
    longitude: p.lng,
    altitude: p.alt,
    // `t` (epoch ms) alimenta a arte "Velocidade" do share; ausente em rotas antigas.
    timestamp: Number.isFinite(p.t) ? new Date(p.t as number).toISOString() : undefined,
  }));
  // Elevação: o valor sincronizado vence o cálculo sobre o track (ADR 0019) —
  // sem isso a tela mostrava ~metade do que a web e a retro mostram.
  const elevationM = resolveElevationM(activity.elevationM, points);

  /** O mesmo contexto para os dois caminhos de compartilhar: o mapa e o visor. */
  const shareContext = {
    activityId: activity.activityId,
    activityName: activity.activityName,
    metaLabel: meta.label,
    startISO: activity.startAt,
    distanceM: activity.distanceM,
    movingS,
    totalS,
    calories: activity.calories,
    elevationM,
    cities: activity.cities,
  };
  const elevation = elevationM === undefined ? null : formatElevation(elevationM);

  // Recordes que esta atividade detém (maior distância, best efforts).
  const recordBadges = activityRecordBadges(_all, activity);
  const badgesFilled = themeFillsCards();

  // Tempo em cada zona de FC (com % do total). null quando a atividade não tem dados.
  const hrZones = (() => {
    const z = activity.hrZones;
    if (!z) return null;
    const total = HR_ZONES.reduce((sum, def) => sum + (z[def.key] ?? 0), 0);
    if (total <= 0) return null;
    return HR_ZONES.map((def) => {
      const seconds = z[def.key] ?? 0;
      return {
        key: def.key,
        label: def.label,
        // O papel resolvido nos eixos ativos — antes era o hex cru do Orbe
        // claro, e a rampa não acompanhava paleta nem esquema.
        color: roleColors(def.role).accent,
        range: hrZoneRange(def),
        pct: Math.round((seconds / total) * 100),
        time: formatClock(seconds),
      };
    });
  })();

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
    { label: 'Tempo total', value: formatDuration(totalS) },
    ...(hasGps ? [{ label: 'Tempo em movimento', value: formatDuration(movingS) }] : []),
    {
      label: 'Calorias',
      value:
        activity.calories > 0
          ? `${activity.caloriesEstimated ? '≈' : ''}${activity.calories} kcal`
          : '—',
    },
    { label: 'Distância', value: distance ?? '—' },
    { label: 'Fonte', value: activity.sourceName || '—' },
    { label: 'Dispositivo', value: activity.device || '—' },
    // Só em pedalada: uma sessão de yoga não ganha "Bicicleta —". Tocável porque
    // é aqui que se conserta a fronteira de data errada por um dia, ou o dia em
    // que se levou a outra bicicleta (ADR 0033 — a exceção por pedalada).
    ...(gears.length > 0 && activity.activityId === BIKE_ACTIVITY_ID
      ? [
          {
            label: 'Bicicleta',
            value: gear ? `${gear.name}${activity.gearId ? ' · corrigida' : ''}` : 'Escolher',
            onPress: () => setPickingGear(true),
          },
        ]
      : []),
    {
      label: 'Rastreado',
      value: activity.tracked === undefined ? '—' : activity.tracked ? 'Sim' : 'Não',
    },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen
          options={{
            headerShown: false,
            // O perfil e o trilho ocupam a largura da janela, e a esquerda deles
            // é o início dos dados — a mesma faixa em que o iOS reconhece o
            // swipe-back. Três tentativas de conviver falharam: a guarda de
            // borda inutiliza a esquerda do gráfico, e desligar o gesto no
            // toque não chega a tempo (a viagem JS→nativo leva um quadro e o
            // reconhecedor já começou). Só o desligamento estático funciona.
            // Fica o chevron do cabeçalho.
            gestureEnabled: false,
          }}
        />

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
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <Text style={styles.saveText}>Salvar</Text>
            )}
          </Pressable>
        ) : (
          <HeaderSpacer />
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
              <Stat icon="time-outline" value={formatDuration(movingS)} caption="movimento" metric="movimento" />
            ) : (
              <Stat icon="time-outline" value={formatDuration(activity.durationS)} caption="duração" metric="movimento" />
            )}
            {activity.calories > 0 && (
              <Stat
                icon="flame-outline"
                value={`${activity.caloriesEstimated ? '≈' : ''}${activity.calories}`}
                caption={activity.caloriesEstimated ? 'kcal (est.)' : 'kcal'}
                metric="kcal"
              />
            )}
            {distance && <Stat icon="map-outline" value={distance} caption="distância" metric="distancia" />}
            {rate && <Stat icon="speedometer-outline" value={rate.value} caption={rate.caption} metric="velocidade" />}
            {elevation && (
              <Stat icon="trending-up-outline" value={elevation} caption="elevação" metric="elevacao" />
            )}
          </View>

          {recordBadges.length > 0 && (
            <View style={styles.recordBadges}>
              {recordBadges.map((b) => {
                const r = roleColors(b.role);
                // Mesma casca da tira de Recordes — ver ADR 0022.
                const skin = badgesFilled
                  ? { backgroundColor: r.soft, borderColor: 'transparent' }
                  : { backgroundColor: 'transparent', borderColor: r.accent };
                const fg = badgesFilled ? r.on : r.text;
                return (
                  <View key={b.key} style={[styles.recordBadge, skin]}>
                    <Ionicons name="trophy" size={12} color={fg} />
                    <Text style={[styles.recordBadgeText, { color: fg }]}>{b.label}</Text>
                  </View>
                );
              })}
            </View>
          )}

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
              <WorkoutMap
                points={points}
                cursor={mapCursor}
                share={shareContext}
                photos={{
                  stops: photoView.stopMarks,
                  dots: photoView.dotMarks,
                  ink: colors.ink,
                  fill: colors.surface,
                  list: photoView.photos,
                }}
              />
            </View>
            {/* Depois do mapa: ele responde "por onde", estes respondem "como
                foi". Somem sozinhos quando o percurso é plano ou a rota não tem
                horário por ponto. */}
            <RouteProfileCard
              points={routePoints ?? []}
              activityId={activity.activityId}
              onScrub={setCursorX}
            />
            {/* O perfil mostra o relevo; este recorta dele o que foi subida de
                verdade. Some em percurso plano — e some em quase toda corrida,
                que é a resposta certa para corrida. */}
            <ClimbsCard points={routePoints ?? []} />
            {/* O eixo que sempre significa algo (ADR 0037): o relógio. Onde o
                perfil é plano — a Holanda inteira — é este que conta o dia. */}
            <TimeRailCard
              points={routePoints ?? []}
              totalDistanceM={activity.distanceM}
              marks={photoView.railMarks}
              onScrub={setCursorX}
            />
          </>
        )}

        {/* O chão desta pedalada (ADR 0035). Também fora do bloco do percurso:
            `surfaceMix` vem do ingest e não depende da rota carregada aqui. Some
            enquanto o passe não calculou. */}
        {activity.surfaceMix && activity.surfaceMix.total > 0 && (
          <SurfaceCard
            mix={activity.surfaceMix}
            caption={
              activity.surfaceMix.inferido > 0
                ? `${Math.round((activity.surfaceMix.inferido / activity.surfaceMix.total) * 100)}% inferido pelo tipo de via`
                : undefined
            }
          />
        )}

        {/* As fotos desta pedalada (ADR 0037). Depois dos números de propósito:
            o dono abre uma pedalada antiga procurando mapa e números, e foto não
            é destaque. Some por completo quando não há foto — a única exceção é
            a pedalada nunca procurada, que ganha uma linha fina de convite. */}
        <ActivityPhotosCard
          view={photoView}
          activity={{
            id: activity.id,
            startAtMs: Date.parse(activity.startAt),
            endAtMs: Date.parse(activity.endAt ?? activity.startAt),
            distanceM: activity.distanceM,
            photosCheckedAt: activity.photosCheckedAt ?? null,
            cities: activity.cities ?? null,
          }}
          points={
            // Cru, sem `?? []`: o cartão precisa distinguir a rota **em voo** da
            // atividade **sem rota** — ver o comentário da prop.
            routePoints
          }
          onSharePhoto={setSharePhoto}
          sharingPhoto={!!sharePhoto}
          /**
           * O compositor vai DENTRO da galeria, não aqui: o iOS não apresenta
           * um `Modal` desta tela enquanto a galeria está de pé — ele só
           * aparecia depois de ela fechar. Ver `shareSlot`.
           */
          shareSlot={
            <ShareComposerModal
              visible={!!sharePhoto}
              onClose={() => setSharePhoto(null)}
              points={points}
              initialMapStyle={mapStyle}
              context={shareContext}
              photos={photoView.photos}
              initialPhotoId={sharePhoto?.id}
            />
          }
        />


        {/* Fora do bloco do percurso de propósito: `bestEfforts` vem do sync e
            existe mesmo antes de a rota ser carregada nesta sessão. Some sozinho
            quando a corrida não tem GPS. */}
        <SegmentsCard activities={_all} activity={activity} />

        <GearPicker
          visible={pickingGear}
          gears={gears}
          current={activity.gearId ?? null}
          inherited={gearForActivity(gears, { ...activity, gearId: undefined })}
          onPick={async (gid) => {
            setPickingGear(false);
            try {
              await setActivityGearId(activity.id, gid);
            } catch {
              // Sem sessão ou rede: a linha volta ao que era no próximo load.
            }
          }}
          onClose={() => setPickingGear(false)}
        />

        {hrZones && (
          <>
            <Text style={styles.sectionTitle}>Zonas de frequência cardíaca</Text>
            <View style={styles.zonesCard}>
              {hrZones.map((z) => (
                <View key={z.key} style={styles.zoneRow}>
                  <View style={styles.zoneTop}>
                    <View style={[styles.zoneDot, { backgroundColor: z.color }]} />
                    <Text style={styles.zoneLabel}>{z.label}</Text>
                    <Text style={styles.zoneRange}>{z.range}</Text>
                    <View style={styles.flex} />
                    <Text style={styles.zoneTime}>{z.time}</Text>
                    <Text style={styles.zonePct}>{z.pct}%</Text>
                  </View>
                  <View style={styles.zoneBar}>
                    <View
                      style={[styles.zoneFill, { width: `${z.pct}%`, backgroundColor: z.color }]}
                    />
                  </View>
                </View>
              ))}
              {activity.hrZonesEstimated && (
                <Text style={styles.note}>
                  Treino sem monitor cardíaco: distribuição estimada pela média dos seus treinos
                  deste tipo.
                </Text>
              )}
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
          {rows.map((row, i) => {
            const border = i < rows.length - 1 && styles.infoRowBorder;
            if (!row.onPress) {
              return (
                <View key={`${row.label}-${i}`} style={[styles.infoRow, border]}>
                  <Text style={styles.infoLabel}>{row.label}</Text>
                  <Text style={styles.infoValue} selectable numberOfLines={3}>
                    {row.value}
                  </Text>
                </View>
              );
            }
            return (
              <Pressable
                key={`${row.label}-${i}`}
                onPress={row.onPress}
                style={({ pressed }) => [styles.infoRow, border, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Text style={styles.infoLabel}>{row.label}</Text>
                <Text style={[styles.infoValue, styles.infoValueTap]} numberOfLines={2}>
                  {row.value}
                </Text>
                <Ionicons name="chevron-forward" size={15} color={colors.ink3} />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
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
    fontFamily: fonts.serif,
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
  saveText: { color: colors.onPrimary, fontSize: 14, fontFamily: fonts.sansSemiBold },

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
    fontFamily: fonts.sansSemiBold,
    color: colors.ink,
    textTransform: 'capitalize',
    textAlign: 'center',
  },
  heroTime: { fontSize: 13, color: colors.ink3, fontFamily: fonts.mono },
  heroStats: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.xl,
    marginTop: spacing.lg,
  },
  stat: { alignItems: 'center', gap: 3 },
  statValue: { fontSize: 17, color: colors.ink, fontFamily: fonts.monoBold },
  statCaption: { fontSize: 11, fontFamily: fonts.sans, color: colors.ink3 },
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
  editBadgeText: { fontSize: 11.5, color: colors.ink2, fontFamily: fonts.sansSemiBold },

  recordBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  recordBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radii.pill,
    // Sempre 1px; transparente na casca preenchida, para a pílula não mudar de
    // tamanho entre os temas.
    borderWidth: 1,
  },
  recordBadgeText: { fontSize: 12, fontFamily: fonts.sansBold },

  sectionTitle: {
    fontSize: 13,
    fontFamily: fonts.sansSemiBold,
    color: colors.ink2,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 1.0,
  },
  mapCard: {
    backgroundColor: colors.surface,
    borderRadius: radii['2xl'],
    padding: spacing.xs,
    ...shadows.card,
  },

  zonesCard: {
    backgroundColor: colors.surface,
    borderRadius: radii['2xl'],
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  zoneRow: { gap: 6 },
  zoneTop: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  zoneDot: { width: 9, height: 9, borderRadius: 5 },
  zoneLabel: { fontSize: 14, fontFamily: fonts.sansSemiBold, color: colors.ink },
  zoneRange: { fontSize: 11, fontFamily: fonts.sans, color: colors.ink3 },
  zoneTime: { fontSize: 13.5, fontFamily: fonts.mono, color: colors.ink },
  zonePct: { fontSize: 11.5, fontFamily: fonts.sans, color: colors.ink3, minWidth: 32, textAlign: 'right' },
  zoneBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceMute,
    overflow: 'hidden',
  },
  zoneFill: { height: '100%', borderRadius: 4, minWidth: 3 },

  editCard: {
    backgroundColor: colors.surface,
    borderRadius: radii['2xl'],
    padding: spacing.lg,
    ...shadows.card,
  },
  fieldLabel: {
    fontSize: 11, fontFamily: fonts.sans,
    color: colors.ink3,
    textTransform: 'uppercase',
    letterSpacing: 1.0,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surfaceMute,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15, fontFamily: fonts.sans,
    color: colors.ink,
  },
  inputDisabled: { color: colors.ink3, opacity: 0.7 },
  note: { fontSize: 12, fontFamily: fonts.sans, color: colors.ink3, marginTop: spacing.xs, fontStyle: 'italic' },

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
  toggleTitle: { fontSize: 15, fontFamily: fonts.sansSemiBold, color: colors.ink },
  toggleSub: { fontSize: 12, fontFamily: fonts.sans, color: colors.ink3, marginTop: 2, lineHeight: 17 },

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
  infoLabel: { fontSize: 13.5, fontFamily: fonts.sans, color: colors.ink3, flexShrink: 0, maxWidth: '45%' },
  infoValue: { fontSize: 13.5, color: colors.ink, fontFamily: fonts.mono, flex: 1, textAlign: 'right' },
  // Linha que abre algo: sai da mono para a sans semibold, e o chevron ao lado
  // faz o resto. A marca não entra como cor de letra (catraca da ADR 0024).
  infoValueTap: { fontFamily: fonts.sansSemiBold },

  emptyText: { fontSize: 15, fontFamily: fonts.sans, color: colors.ink3 },
}));
