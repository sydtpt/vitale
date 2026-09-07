import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PanGestureHandler,
  PinchGestureHandler,
  State,
  type PanGestureHandlerGestureEvent,
  type PinchGestureHandlerGestureEvent,
} from 'react-native-gesture-handler';
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as Haptics from 'expo-haptics';
import {
  MAP_STYLES,
  coverOf,
  detectStops,
  groupByStop,
  type ActivityRoutePoint,
  type MapStyle,
} from '@vitale/shared';
import type { MapViewState } from '../../lib/map-html';
import type { RoutePoint } from '../../lib/workout-types';
import {
  formatDistance,
  formatDuration,
  formatRate,
  formatElevation,
} from '../../lib/workout-format';
import {
  buildShareCardHtml,
  formatRatio,
  FORMAT_DIMENSIONS,
  PHOTO_FRAME_DEFAULT,
  type PhotoFrame,
  type ShareArtStyle,
  type ShareBackground,
  type ShareContext,
  type ShareFormat,
  type ShareMapEffect,
  type ShareMetricKey,
  type ShareMetricTile,
} from '../../lib/share-card-html';
import { captureCardPng, saveCardPngToGallery, shareCardPng } from '../../lib/share-export';
import { resolvePosterUri } from '../../services/asset-uri';
import type { ActivityPhoto } from '@vitale/shared';
import { useAssetUri } from '../../hooks/useAssetUri';

/** Miniatura do seletor de foto — resolve o endereço sozinha. */
/**
 * A camada da foto — a mesma no preview e na exportação.
 *
 * Existe como componente porque as duas **têm** de concordar: o `captureRef`
 * fotografa a pilha inteira, e qualquer diferença entre o que se vê e o que se
 * exporta viraria um PNG deslocado que só aparece depois de compartilhado.
 *
 * Fica sempre ATRÁS do WebView. A versão com bloco a punha por cima, e ela
 * cobria o texto — a foto pertence ao fundo.
 */
function PhotoLayer({
  uri,
  frame,
  box,
}: {
  uri: string;
  frame: PhotoFrame;
  box: { width: number; height: number };
}) {
  return (
    <Image
      source={{ uri }}
      resizeMode="cover"
      style={[
        styles.photoBehind,
        {
          // Ordem importa: a escala entra por último, então o deslocamento fica
          // em pixels do cartão e não cresce junto com a aproximação.
          transform: [
            { translateX: frame.dx * box.width },
            { translateY: frame.dy * box.height },
            { scale: frame.scale },
          ],
        },
      ]}
    />
  );
}

function PickerThumb({
  assetId,
  style,
  isVideo,
  durationS = null,
}: {
  assetId: string | null;
  style: object;
  isVideo: boolean;
  durationS?: number | null;
}) {
  const uri = useAssetUri(assetId, isVideo, durationS);
  if (typeof uri !== 'string') return <View style={style} />;
  return <Image source={{ uri }} style={style} />;
}
import { MOD, colors, fonts, radii, shadows, spacing, themed, useTheme } from '../../theme';
import { Segmented } from '../ui/Segmented';

interface ShareComposerModalProps {
  visible: boolean;
  onClose: () => void;
  /** Track completo (altitude/timestamp alimentam as artes data-driven). */
  points: readonly RoutePoint[];
  /** Estilo de mapa inicial (das preferências do usuário); a troca no composer é local. */
  initialMapStyle: MapStyle;
  context: ShareContext;
  /** Fotos ligadas à atividade (ADR 0037). Vazio ⇒ o fundo "Foto" nem aparece. */
  photos?: readonly ActivityPhoto[];
  /**
   * Abre já com esta foto escolhida e o fundo **Foto** ligado.
   *
   * É o caminho que vem do visor da galeria: quem tocou em compartilhar estava
   * olhando uma foto específica, e chegar ao compositor num fundo diferente —
   * ou noutra foto — seria perder o que ele acabou de escolher.
   */
  initialPhotoId?: string;
}

interface MetricDef {
  key: ShareMetricKey;
  label: string;
  tile: ShareMetricTile;
}

const METRIC_ORDER: ShareMetricKey[] = [
  'distance',
  'movingTime',
  'elevation',
  'rate',
  'calories',
  'hr',
  'totalTime',
];

/** Quebra "8.42 km" → { value: "8.42", caption: "km" }. */
function splitMeasure(s: string): { value: string; caption: string } {
  const i = s.lastIndexOf(' ');
  return i > 0 ? { value: s.slice(0, i), caption: s.slice(i + 1) } : { value: s, caption: '' };
}

/** Deriva as métricas disponíveis (com dados) a partir do contexto. */
function availableMetrics(ctx: ShareContext): MetricDef[] {
  const out: MetricDef[] = [];
  const push = (key: ShareMetricKey, label: string, tile: ShareMetricTile | null) => {
    if (tile) out.push({ key, label, tile });
  };

  const dist = formatDistance(ctx.distanceM);
  if (dist) push('distance', 'Distância', { key: 'distance', ...splitMeasure(dist) });

  if (ctx.movingS && ctx.movingS > 0)
    push('movingTime', 'Movimento', {
      key: 'movingTime',
      value: formatDuration(ctx.movingS),
      caption: 'movimento',
    });

  const elev = formatElevation(ctx.elevationM ?? 0);
  if (elev) push('elevation', 'Elevação', { key: 'elevation', ...splitMeasure(elev) });

  const rate = formatRate(ctx.activityId, ctx.distanceM, ctx.movingS);
  if (rate) push('rate', 'Ritmo', { key: 'rate', value: rate.value, caption: rate.caption });

  if (ctx.calories && ctx.calories > 0)
    push('calories', 'Calorias', { key: 'calories', value: String(ctx.calories), caption: 'kcal' });

  if (ctx.hrAvgBpm && ctx.hrAvgBpm > 0)
    push('hr', 'FC', { key: 'hr', value: String(Math.round(ctx.hrAvgBpm)), caption: 'bpm' });

  if (ctx.totalS && ctx.totalS > 0)
    push('totalTime', 'Tempo total', {
      key: 'totalTime',
      value: formatDuration(ctx.totalS),
      caption: 'tempo total',
    });

  return out.sort((a, b) => METRIC_ORDER.indexOf(a.key) - METRIC_ORDER.indexOf(b.key));
}

const FORMAT_OPTS: { key: ShareFormat; label: string }[] = [
  { key: 'story', label: 'Story' },
  { key: 'square', label: 'Quadrado' },
  { key: 'portrait', label: 'Retrato' },
];
const BG_OPTS: { key: ShareBackground; label: string }[] = [
  { key: 'art', label: 'Transparente' },
  { key: 'map', label: 'Mapa' },
  { key: 'data', label: 'Dados' },
  { key: 'photo', label: 'Foto' },
];
/** Sem foto ligada, o fundo "Foto" não existe — em vez de existir e falhar. */
function bgOptions(hasPhoto: boolean) {
  return hasPhoto ? BG_OPTS : BG_OPTS.filter((o) => o.key !== 'photo');
}
const ART_OPTS: { key: ShareArtStyle; label: string }[] = [
  { key: 'speed', label: 'Velocidade' },
  { key: 'route', label: 'Rota' },
  { key: 'elevation', label: 'Elevação' },
];
const EFFECT_OPTS: { key: ShareMapEffect; label: string }[] = [
  { key: 'none', label: 'Nenhum' },
  { key: 'duotone', label: 'Duotone' },
  { key: 'gradient', label: 'Degradê' },
  { key: 'grain', label: 'Granulado' },
  { key: 'vignette', label: 'Vinheta' },
];
/** Paleta de cores do texto: neutros + accents dos módulos (tokens do shared). */
const TEXT_COLORS: string[] = [
  '#FFFFFF',
  '#F6EFE6',
  MOD.financas.accent,
  MOD.treino.accent,
  MOD.food.accent,
  MOD.habito.accent,
  MOD.tarefa.accent,
  MOD.agua.accent,
  MOD.compras.accent,
  MOD.casa.accent,
];
/** Ordem de exibição dos estilos de mapa (mesma da tela de configurações). */
const MAP_STYLE_ORDER: MapStyle[] = [
  'voyager',
  'positron',
  'voyager_nolabels',
  'positron_nolabels',
  'dark',
  'satellite',
  'topo',
  'osm',
  'ofm_positron',
  'ofm_bright',
  'ofm_fiord',
  'ofm_3d',
];
const MAP_OPTS = MAP_STYLE_ORDER.map((key) => ({ key, label: MAP_STYLES[key].label }));

function tap() {
  Haptics.selectionAsync().catch(() => {});
}

/** Enquadramento salvo do mapa + engine que o produziu (o zoom não é
 *  equivalente entre elas: mundo = 256·2^z no Leaflet e 512·2^z no MapLibre). */
interface StoredMapView {
  view: MapViewState;
  kind: 'raster' | 'vector';
}

/** Adapta a vista salva à engine do estilo atual (z ± 1 entre Leaflet↔MapLibre;
 *  rotação/pitch não existem no raster). */
function adaptView(stored: StoredMapView | null, kind: 'raster' | 'vector'): MapViewState | undefined {
  if (!stored) return undefined;
  if (stored.kind === kind) return stored.view;
  const zoom = stored.view.zoom + (stored.kind === 'raster' ? -1 : 1);
  return kind === 'raster'
    ? { center: stored.view.center, zoom, bearing: 0, pitch: 0 }
    : { ...stored.view, zoom };
}

export function ShareComposerModal({
  visible,
  onClose,
  points,
  initialMapStyle,
  context,
  photos = [],
  initialPhotoId,
}: ShareComposerModalProps) {
  const insets = useSafeAreaInsets();
  useTheme();

  const metrics = useMemo(() => availableMetrics(context), [context]);
  const defaultTitle = (context.activityName?.trim() || context.metaLabel).trim();

  /**
   * A foto do cartão (ADR 0037). A capa é o padrão — é para isso que o
   * `is_cover` existe: o dono escolhe uma vez no cartão Fotos e o composer
   * abre nela, sem perguntar de novo a cada compartilhamento.
   */
  const photoChoices = useMemo(
    () => photos.filter((p) => p.assetId),
    [photos],
  );
  const [photoId, setPhotoId] = useState<string | null>(null);
  const chosenPhoto = useMemo(
    () => photoChoices.find((p) => p.id === photoId) ?? photoChoices.find((p) => p.isCover) ?? photoChoices[0],
    [photoChoices, photoId],
  );
  // Resolvido pelo `getUri()` da biblioteca: o `ph://` montado à mão não
  // carrega (conferido no iPhone em 06/09/2026). Ver services/asset-uri.ts.
  const resolvedPhoto = useAssetUri(
    chosenPhoto?.assetId ?? null,
    chosenPhoto?.mediaType === 'video',
    chosenPhoto?.durationS ?? null,
  );
  const photoUri = typeof resolvedPhoto === 'string' ? resolvedPhoto : undefined;


  /**
   * O enquadramento da foto.
   *
   * `fit` decide se ela preenche o cartão ou vira bloco; `scale`/`dx`/`dy` são
   * o que a pinça e o arrasto movem. Fica em **estado**, e não em `ref` como o
   * enquadramento do mapa, porque aqui a `<Image>` é uma view nativa nossa: ela
   * precisa re-renderizar a cada quadro do gesto. O mapa mora dentro do WebView,
   * e re-renderizar aquilo recarregaria a página inteira.
   */
  const [frame, setFrame] = useState<PhotoFrame>(PHOTO_FRAME_DEFAULT);
  /** O valor no início do gesto — a pinça é relativa ao que já estava lá. */
  const frameStart = useRef<PhotoFrame>(PHOTO_FRAME_DEFAULT);
  const pinchRef = useRef<PinchGestureHandler>(null);
  const panRef = useRef<PanGestureHandler>(null);

  const [format, setFormat] = useState<ShareFormat>('story');
  const [background, setBackground] = useState<ShareBackground>('art');
  /**
   * A linha da parada. Opcional a pedido dele — nem toda foto vale um lugar, e
   * há cartão em que o nome da pedalada basta.
   */
  const [showPlace, setShowPlace] = useState(true);

  /**
   * A parada da foto escolhida — "Ittre · km 31,1 · 12:38".
   *
   * A cidade sai da mesma conta que o cartão de fotos faz: a mais próxima da
   * coordenada, entre as que a rota atravessou. Não é geocodificação nova — é
   * `activities.cities`, que o ingest já enriqueceu.
   *
   * Cada pedaço é opcional e some sozinho: foto sem coordenada não tem cidade,
   * foto fora do traçado não tem quilômetro. O que sempre existe é a hora, que
   * é a chave da própria feature (ADR 0037 §2).
   */
  const placeLine = useMemo(() => {
    if (background !== 'photo' || !showPlace || !chosenPhoto) return undefined;
    const parts: string[] = [];

    const cs = context.cities ?? [];
    if (chosenPhoto.lat !== null && chosenPhoto.lng !== null && cs.length > 0) {
      let best = cs[0];
      let bestD = Infinity;
      for (const c of cs) {
        const d = (c.lat - chosenPhoto.lat) ** 2 + (c.lng - chosenPhoto.lng) ** 2;
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      parts.push(best.name);
    }

    if (chosenPhoto.routeDistanceM !== null) {
      parts.push(`km ${(chosenPhoto.routeDistanceM / 1000).toFixed(1).replace('.', ',')}`);
    }

    parts.push(
      new Date(chosenPhoto.takenAt).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    );
    return parts.join(' · ');
  }, [background, showPlace, chosenPhoto, context.cities]);

  const [artStyle, setArtStyle] = useState<ShareArtStyle>('speed');
  const [mapStyle, setMapStyle] = useState<MapStyle>(initialMapStyle);
  const [mapEffect, setMapEffect] = useState<ShareMapEffect>('none');
  // null = automática (branca — o cartão cai sobre fundos que não controlamos).
  const [textColor, setTextColor] = useState<string | null>(null);
  const [showTitle, setShowTitle] = useState(true);
  const [watermark, setWatermark] = useState(true);
  // Enquadramento do mapa ajustado pelo usuário no preview (ref: pan/zoom não
  // devem recarregar o WebView — só é lido quando o html é reconstruído).
  const mapViewRef = useRef<StoredMapView | null>(null);
  const previewRef = useRef<WebView>(null);
  const [title, setTitle] = useState(defaultTitle);
  const [enabled, setEnabled] = useState<Set<ShareMetricKey>>(
    () => new Set(metrics.map((m) => m.key)),
  );
  // Cidades da rota (bike enriquecida): toggle "Mostrar cidades" + quais exibir.
  const [showCities, setShowCities] = useState(false);
  /**
   * A arte da rota sobre a foto.
   *
   * Ligada por padrão, que é como sempre foi — mas opcional a pedido dele: numa
   * foto boa o traçado por cima é ruído, e quem decide isso é quem olha a foto.
   */
  const [showRoute, setShowRoute] = useState(true);
  const [enabledCities, setEnabledCities] = useState<Set<string>>(
    () => new Set((context.cities ?? []).map((c) => c.name)),
  );

  // Reinicializa quando abre para uma atividade diferente.
  useEffect(() => {
    if (!visible) return;
    setTitle(defaultTitle);
    setShowTitle(true);
    setEnabled(new Set(metrics.map((m) => m.key)));
    setShowCities(false);
    setEnabledCities(new Set((context.cities ?? []).map((c) => c.name)));
    setArtStyle('speed');
    setMapStyle(initialMapStyle);
    setMapEffect('none');
    setTextColor(null);
    mapViewRef.current = null;
    setFrame(PHOTO_FRAME_DEFAULT);
    frameStart.current = PHOTO_FRAME_DEFAULT;
    setShowRoute(true);
    setShowPlace(true);
    // Vindo do visor, o fundo e a foto já estão decididos; vindo do mapa, o
    // compositor abre como sempre abriu.
    setBackground(initialPhotoId ? 'photo' : 'art');
    setPhotoId(initialPhotoId ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, context.activityId, initialPhotoId]);

  // Título com debounce p/ não recarregar o WebView a cada tecla.
  const [debouncedTitle, setDebouncedTitle] = useState(title);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedTitle(title), 250);
    return () => clearTimeout(t);
  }, [title]);

  const selectedTiles = useMemo(
    () => metrics.filter((m) => enabled.has(m.key)).map((m) => m.tile),
    [metrics, enabled],
  );

  // Nomes de cidade únicos, na ordem do percurso (os chips do controle).
  const cityNames = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const c of context.cities ?? []) {
      if (!seen.has(c.name)) {
        seen.add(c.name);
        out.push(c.name);
      }
    }
    return out;
  }, [context.cities]);

  // Marcas a desenhar: todas as cidades cujo nome está habilitado (mantém as
  // re-entradas na mesma cidade). Só passam ao cartão quando o toggle está on.
  const selectedCities = useMemo(
    () => (context.cities ?? []).filter((c) => enabledCities.has(c.name)),
    [context.cities, enabledCities],
  );

  /**
   * A sequência: um cartão por parada (proposta D do estudo).
   *
   * Não é um cartão novo — é o MESMO cartão, N vezes, cada um com a foto e a
   * parada dele. Foi a proposta A que tornou isto barato: quando o cartão
   * aprendeu a dizer de onde a foto é, a sequência virou uma lista de fotos
   * diferentes no mesmo desenho.
   *
   * A capa de cada parada escolhe qual foto entra — a do meio da maior rajada,
   * ou a que ele estrelou (ver `coverOf`). É a mesma regra da Retrospectiva, e
   * a coerência importa: a foto que representa o dia no jornal é a mesma que o
   * representa no Story.
   */
  const stopCards = useMemo(() => {
    if (photos.length === 0) return [];
    const pts = points as unknown as ActivityRoutePoint[];
    const withMs = photos
      .filter((p) => p.state === 'linked')
      .map((p) => ({ ...p, takenAtMs: p.takenAt }));
    if (withMs.length === 0) return [];

    const stops = detectStops(pts, { totalDistanceM: context.distanceM });
    const grouped = groupByStop(withMs, stops, pts);

    const cities = context.cities ?? [];
    const near = (lat: number | null, lng: number | null): string | null => {
      if (lat === null || lng === null || cities.length === 0) return null;
      let best = cities[0];
      let bestD = Infinity;
      for (const c of cities) {
        const d = (c.lat - lat) ** 2 + (c.lng - lng) ** 2;
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      return best.name;
    };

    const out: { photo: ActivityPhoto; city: string | null; km: number | null; atMs: number }[] = [];
    for (const g of grouped.stops) {
      const cover = coverOf(g.photos);
      if (cover) out.push({ photo: cover, city: near(g.stop.lat, g.stop.lng), km: g.stop.distanceM, atMs: g.stop.startMs });
    }
    for (const g of grouped.silent) {
      const cover = coverOf(g.photos);
      const first = g.photos[0];
      if (cover) out.push({ photo: cover, city: near(first.lat, first.lng), km: cover.routeDistanceM, atMs: g.firstMs });
    }
    return out.sort((a, b) => a.atMs - b.atMs);
  }, [photos, points, context.distanceM, context.cities]);

  /** Liga a sequência. Só existe com foto e mais de uma parada. */
  const [sequence, setSequence] = useState(false);
  const [seqAt, setSeqAt] = useState(0);
  const canSequence = background === 'photo' && stopCards.length > 1;
  const seqOn = sequence && canSequence;
  const seqCard = seqOn ? stopCards[Math.min(seqAt, stopCards.length - 1)] : null;

  const mapTile = MAP_STYLES[mapStyle];
  /**
   * Os campos que a sequência sobrescreve no cartão.
   *
   * A cidade vira o TÍTULO e a pedalada sai de cena: numa sequência de Stories
   * o que muda de quadro para quadro é o lugar, e repetir o nome da pedalada
   * seis vezes gastaria a manchete com o que já se sabe. O quilômetro percorrido
   * é a única métrica, e é ele que faz o dia crescer diante de quem assiste.
   */
  const seqOverrides = useCallback(
    (card: { city: string | null; km: number | null; atMs: number }, i: number, n: number) => {
      const hhmm = new Date(card.atMs).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      return {
        title: card.city ?? 'Parada',
        place: `Parada ${i + 1} de ${n} · ${hhmm}`,
        metrics:
          card.km === null
            ? []
            : [
                {
                  key: 'distance' as ShareMetricKey,
                  value: (card.km / 1000).toFixed(1).replace('.', ','),
                  caption: 'km percorridos',
                },
              ],
      };
    },
    [],
  );

  const html = useMemo(
    () =>
      buildShareCardHtml({
        points,
        format,
        background,
        artStyle,
        showRoute,
        mapEffect,
        textColor: textColor ?? undefined,
        showTitle,
        activityId: context.activityId,
        ...(seqCard
          ? seqOverrides(seqCard, Math.min(seqAt, stopCards.length - 1), stopCards.length)
          : { title: debouncedTitle || defaultTitle, place: placeLine, metrics: selectedTiles }),
        cities: showCities ? selectedCities : undefined,
        watermark,
        mapTile,
        // Preview: mapa ajustável; reconstruções (trocar métrica, estilo…) reabrem
        // no último enquadramento reportado, em vez de refazer o fitBounds.
        mapInteractive: background === 'map',
        mapView: adaptView(mapViewRef.current, mapTile.kind),
        // Fundos com alpha (arte e dados) precisam do xadrez para o usuário ver
        // que o PNG sai sem fundo.
        // Só os fundos que REALMENTE saem com alpha. A condição era
        // `!== 'map'`, que pegava a foto junto: o xadrez é opaco e cobria a
        // `<Image>` nativa que fica atrás do WebView — a foto simplesmente não
        // aparecia no preview, e no bloco o xadrez saía no lugar do papel.
        previewChecker: background === 'art' || background === 'data',
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // `showRoute` e `frame` entram aqui porque o HTML depende dos dois. Sem o
    // primeiro, ligar o interruptor da rota não redesenhava nada até outra
    // opção mudar por acidente — foi assim que ele descobriu (07/09/2026).
    [points, format, background, artStyle, showRoute, placeLine, seqCard, seqAt, stopCards, seqOverrides, mapEffect, textColor, debouncedTitle, defaultTitle, showTitle, context.activityId, selectedTiles, showCities, selectedCities, watermark, mapTile],
  );

  // Letterbox: dimensiona o WebView à proporção real de saída dentro da área.
  const [area, setArea] = useState({ w: 0, h: 0 });
  const onArea = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setArea({ w: width, h: height });
  };
  const ratio = formatRatio(format);
  const box = useMemo(() => {
    if (area.w <= 0 || area.h <= 0) return { width: 0, height: 0 };
    return area.w / area.h > ratio
      ? { width: area.h * ratio, height: area.h }
      : { width: area.w, height: area.w / ratio };
  }, [area, ratio]);

  /** Só há o que enquadrar quando o fundo é foto e ela já resolveu. */
  const showPhoto = background === 'photo' && !!photoUri;

  /**
   * O enquadramento, pelo dedo.
   *
   * O limite de 1× para baixo é o que garante que a foto **sempre cubra** a
   * janela: abaixo disso apareceria papel por dentro do quadro, e o cartão
   * sairia com uma faixa vazia que ninguém pediu. Para cima, 4× — passando
   * disso a foto do iPhone começa a mostrar o próprio grão.
   */
  const onPinch = useCallback(
    (e: PinchGestureHandlerGestureEvent) => {
      const next = frameStart.current.scale * e.nativeEvent.scale;
      setFrame((f) => ({ ...f, scale: Math.min(4, Math.max(1, next)) }));
    },
    [],
  );

  const onFramePan = useCallback(
    (e: PanGestureHandlerGestureEvent) => {
      if (box.width <= 0 || box.height <= 0) return;
      setFrame((f) => ({
        ...f,
        dx: frameStart.current.dx + e.nativeEvent.translationX / box.width,
        dy: frameStart.current.dy + e.nativeEvent.translationY / box.height,
      }));
    },
    [box.width, box.height],
  );

  /**
   * A âncora do gesto.
   *
   * Guardar o valor no **início** é o que faz pinça e arrasto se somarem em vez
   * de brigarem: os dois handlers rodam ao mesmo tempo, e cada um lê a mesma
   * âncora em vez do estado que o outro acabou de mudar.
   */
  const onFrameGestureState = useCallback(
    (e: { nativeEvent: { state: number } }) => {
      if (e.nativeEvent.state === State.BEGAN) frameStart.current = frame;
    },
    [frame],
  );

  const toggleMetric = (key: ShareMetricKey) => {
    tap();
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleCity = (name: string) => {
    tap();
    setEnabledCities((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  // ── Exportar: renderiza o cartão num WebView de palco (na tela, coberto por
  //    um overlay opaco), captura em PNG a 1080px e abre o share sheet. ──────
  const dim = FORMAT_DIMENSIONS[format];
  // Ref na View que embrulha o WebView de export: a ref do próprio WebView
  // (13.x) é um handle imperativo (goBack, injectJavaScript…), não uma view
  // nativa — o captureRef do view-shot falha com "not a ReactComponent".
  const exportStageRef = useRef<View>(null);
  const [exporting, setExporting] = useState(false);
  const [exportHtml, setExportHtml] = useState('');
  /**
   * A fila da sequência.
   *
   * O palco de exportação é UM só: ele monta o HTML, espera o WebView carregar,
   * fotografa e entrega. Para N cartões a fila reusa exatamente esse ciclo —
   * trocar o `exportHtml` faz o WebView recarregar, e o `onLoadEnd` volta.
   * Nada de montar seis palcos, que seriam seis WebViews vivos ao mesmo tempo.
   */
  const seqQueue = useRef<{ html: string; uri: string }[]>([]);
  const seqDone = useRef<string[]>([]);
  /** A foto que o palco desenha agora — a da carta da vez, na sequência. */
  const [exportPhotoUri, setExportPhotoUri] = useState<string | null>(null);

  // Palco de export: o maior tamanho com a proporção do formato que cabe na
  // tela. Precisa ficar DENTRO da tela: o WKWebView só rasteriza a região
  // visível e o drawViewHierarchyInRect do snapshot falha com views offscreen.
  // O cartão usa vw — escala perfeita; a captura redimensiona para 1080px.
  const win = useWindowDimensions();
  const exportBox = useMemo(() => {
    const s = Math.min(win.width / dim.width, win.height / dim.height);
    return { width: Math.round(dim.width * s), height: Math.round(dim.height * s) };
  }, [win.width, win.height, dim]);

  // Congela o cartão atual em versão estática para o snapshot. O zoom do
  // enquadramento é corrigido para o viewport do palco (mesma área visível:
  // z' = z + log2(largura_palco / largura_preview)).
  const startExport = async () => {
    tap();
    let view = adaptView(mapViewRef.current, mapTile.kind);
    if (view && box.width > 0) {
      view = { ...view, zoom: view.zoom + Math.log2(exportBox.width / box.width) };
    }
    const base = {
      points,
      format,
      background,
      artStyle,
      showRoute,
      mapEffect,
      textColor: textColor ?? undefined,
      showTitle,
      activityId: context.activityId,
      cities: showCities ? selectedCities : undefined,
      watermark,
      mapTile,
      mapView: background === 'map' ? view : undefined,
    };

    /**
     * A sequência resolve **todas as fotos antes** de começar.
     *
     * O endereço da biblioteca não sai de um hook aqui — cada carta precisa do
     * dela, e hook não roda em laço. Resolver tudo na frente também evita a
     * fila parar no meio esperando o iCloud, com o palco montado e o usuário
     * olhando um indicador que não anda.
     */
    if (seqOn) {
      const cartas: { html: string; uri: string }[] = [];
      for (let i = 0; i < stopCards.length; i += 1) {
        const c = stopCards[i];
        const uri = await resolvePosterUri(
          c.photo.assetId,
          c.photo.mediaType === 'video',
          c.photo.durationS,
        );
        if (!uri) continue; // foto que não resolve não vira cartão vazio
        cartas.push({
          uri,
          html: buildShareCardHtml({ ...base, ...seqOverrides(c, i, stopCards.length) }),
        });
      }
      if (cartas.length === 0) {
        Alert.alert('Sem cartões', 'Nenhuma foto das paradas pôde ser aberta agora.');
        return;
      }
      const primeira = cartas.shift()!;
      seqQueue.current = cartas;
      seqDone.current = [];
      setExportPhotoUri(primeira.uri);
      setExportHtml(primeira.html);
      setExporting(true);
      return;
    }

    seqQueue.current = [];
    seqDone.current = [];
    setExportPhotoUri(null);
    setExportHtml(
      buildShareCardHtml({
        ...base,
        place: placeLine,
        title: title || defaultTitle,
        metrics: selectedTiles,
      }),
    );
    setExporting(true);
  };

  const onExportLoaded = async () => {
    if (!exporting) return;
    try {
      // Dá tempo do mapa (tiles remotos) desenhar antes do snapshot; estilos
      // vector (MapLibre, especialmente o 3D) desenham mais devagar que raster.
      await new Promise((r) =>
        setTimeout(r, background === 'map' ? (mapTile.kind === 'vector' ? 2200 : 1500) : 350),
      );
      const uri = await captureCardPng(exportStageRef, dim);

      // A fila da sequência: fotografa, guarda, e passa para a próxima carta
      // sem desmontar o palco. Só a última entrega.
      if (seqQueue.current.length > 0) {
        seqDone.current.push(uri);
        const next = seqQueue.current.shift()!;
        setExportPhotoUri(next.uri);
        setExportHtml(next.html);
        return;
      }
      const todas = seqDone.current.length > 0 ? [...seqDone.current, uri] : null;
      seqDone.current = [];
      setExportPhotoUri(null);
      setExporting(false); // desmonta o palco antes do diálogo de destino
      if (todas) void deliverSequence(todas);
      else offerDelivery(uri);
    } catch (e) {
      // Inclui o detalhe técnico — sem ele é impossível diagnosticar no device.
      const detail = e instanceof Error && e.message ? `\n\n${e.message}` : '';
      Alert.alert('Erro', `Não foi possível gerar a imagem do cartão.${detail}`);
    } finally {
      setExporting(false);
    }
  };

  /**
   * A entrega da sequência: **tudo para a galeria**, em ordem.
   *
   * Não há diálogo de destino aqui, e não é preguiça: o `expo-sharing` manda
   * UM arquivo por vez, e seis diálogos seguidos seriam piores que nenhum. E o
   * destino real de uma sequência é o carretel — é de lá que os Stories são
   * postados, um atrás do outro.
   */
  const deliverSequence = async (uris: readonly string[]) => {
    let saved = 0;
    for (const u of uris) {
      try {
        if ((await saveCardPngToGallery(u)) === 'saved') saved += 1;
      } catch {
        // Um cartão que falha não derruba os outros — o que salvou, salvou.
      }
    }
    if (saved === 0) {
      Alert.alert('Não consegui salvar', 'O Orbe precisa de permissão para gravar na galeria.');
      return;
    }
    Alert.alert(
      saved === uris.length ? 'Sequência salva' : 'Sequência salva em parte',
      `${saved} ${saved === 1 ? 'cartão foi' : 'cartões foram'} para a galeria, em ordem — de lá você posta um atrás do outro.`,
    );
  };

  // O share sheet não oferece "Salvar imagem" para file-URLs — daí a escolha
  // explícita de destino (galeria direto via media-library, ou share sheet).
  const offerDelivery = (uri: string) => {
    Alert.alert('Cartão pronto', 'O que fazer com a imagem?', [
      { text: 'Salvar na galeria', onPress: () => void deliverToGallery(uri) },
      { text: 'Compartilhar…', onPress: () => void deliverToShare(uri) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const deliverToGallery = async (uri: string) => {
    try {
      const result = await saveCardPngToGallery(uri);
      if (result === 'denied') {
        Alert.alert(
          'Sem permissão',
          'Autorize o acesso às fotos nos Ajustes para salvar o cartão na galeria.',
        );
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert('Salvo', 'Cartão salvo na galeria.');
    } catch (e) {
      const detail = e instanceof Error && e.message ? `\n\n${e.message}` : '';
      Alert.alert('Erro', `Não foi possível salvar na galeria.${detail}`);
    }
  };

  const deliverToShare = async (uri: string) => {
    try {
      if ((await shareCardPng(uri, title || defaultTitle)) === 'unavailable') {
        Alert.alert('Indisponível', 'Compartilhamento não está disponível neste dispositivo.');
      }
    } catch (e) {
      const detail = e instanceof Error && e.message ? `\n\n${e.message}` : '';
      Alert.alert('Erro', `Não foi possível compartilhar.${detail}`);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      {/* KAV na raiz do Modal (cobre a tela toda ⇒ dispensa keyboardVerticalOffset):
          o teclado encolhe o container, `previewArea` (flex:1) cede o espaço e o
          maxHeight da faixa de controles recalcula — o campo Nome sobe junto. */}
      <KeyboardAvoidingView
        style={[styles.container, { paddingTop: insets.top }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Barra superior */}
        <View style={styles.topbar}>
          <Pressable onPress={onClose} hitSlop={12} style={({ pressed }) => pressed && styles.pressed}>
            <Text style={styles.cancel}>Cancelar</Text>
          </Pressable>
          <Text style={styles.topTitle}>Compartilhar</Text>
          <Pressable
            onPress={startExport}
            disabled={exporting || metrics.length === 0}
            hitSlop={12}
            style={({ pressed }) => [
              styles.exportBtn,
              exporting && styles.exportDisabled,
              pressed && styles.pressed,
            ]}
          >
            {exporting ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <Text style={styles.exportText}>
                {seqOn ? `Salvar ${stopCards.length}` : 'Exportar'}
              </Text>
            )}
          </Pressable>
        </View>

        {/* Preview */}
        <View style={styles.previewArea} onLayout={onArea}>
          {box.width > 0 && (
            <View
              style={[
                styles.previewFrame,
                { width: box.width, height: box.height },
              ]}
            >
              {showPhoto && (
                <PhotoLayer uri={photoUri!} frame={frame} box={box} />
              )}
              <WebView
                ref={previewRef}
                key={`${format}-${background}-${artStyle}-${showRoute ? 'r' : 'n'}-${mapStyle}-${mapEffect}-${textColor ?? 'auto'}`}
                originWhitelist={['*']}
                source={{ html }}
                style={styles.web}
                scrollEnabled={false}
                // Fundo mapa: gestos passam para o mapa (pan/zoom/rotação).
                pointerEvents={background === 'map' ? 'auto' : 'none'}
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
                androidLayerType="hardware"
                // Trocar opção remonta o WebView (key) — mostra loading até o
                // cartão carregar, em vez do flash em branco.
                startInLoadingState
                renderLoading={PreviewLoading}
                onMessage={(e) => {
                  try {
                    const msg = JSON.parse(e.nativeEvent.data);
                    if (msg.type === 'mapView') {
                      mapViewRef.current = {
                        view: {
                          center: msg.center,
                          zoom: msg.zoom,
                          bearing: msg.bearing,
                          pitch: msg.pitch,
                        },
                        kind: mapTile.kind,
                      };
                    }
                  } catch {
                    // mensagem não-JSON: ignora
                  }
                }}
              />
              {/* A rede de gestos cobre o preview inteiro nos dois modos: no
                  bloco o dedo raramente cai exatamente sobre ele, e exigir
                  precisão para enquadrar seria o contrário do que se quer.

                  `react-native-gesture-handler`, e não `PanResponder`: o
                  `ScrollView` do iOS resolve arrasto no nível NATIVO, e o
                  PanResponder não vê o gesto em fase nenhuma. Esta feature já
                  descobriu isso duas vezes — no visor da galeria e no trilho do
                  tempo. A ADR 0010 proíbe o Reanimated, não o gesture-handler. */}
              {showPhoto && (
                <PinchGestureHandler
                  ref={pinchRef}
                  simultaneousHandlers={panRef}
                  onGestureEvent={onPinch}
                  onHandlerStateChange={onFrameGestureState}
                >
                  <View style={StyleSheet.absoluteFill}>
                    <PanGestureHandler
                      ref={panRef}
                      simultaneousHandlers={pinchRef}
                      onGestureEvent={onFramePan}
                      onHandlerStateChange={onFrameGestureState}
                    >
                      <View style={StyleSheet.absoluteFill} />
                    </PanGestureHandler>
                  </View>
                </PinchGestureHandler>
              )}
              {background === 'map' && (
                <Pressable
                  style={({ pressed }) => [styles.recenterBtn, pressed && styles.pressed]}
                  onPress={() => {
                    tap();
                    previewRef.current?.injectJavaScript('window.recenter && window.recenter(); true;');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Recentrar rota"
                  hitSlop={8}
                >
                  <Ionicons name="locate-outline" size={16} color="#fff" />
                </Pressable>
              )}
            </View>
          )}
        </View>

        {/* Controles */}
        <ScrollView
          style={styles.controls}
          contentContainerStyle={[styles.controlsContent, { paddingBottom: insets.bottom + spacing.lg }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Pressable
            style={[styles.switchRow, styles.switchRowFirst]}
            onPress={() => {
              tap();
              setShowTitle((t) => !t);
            }}
          >
            <Text style={styles.switchLabel}>Título</Text>
            <View style={[styles.switchTrack, showTitle && styles.switchTrackOn]}>
              <View style={[styles.switchThumb, showTitle && styles.switchThumbOn]} />
            </View>
          </Pressable>

          {showTitle && (
            <>
              <Text style={styles.fieldLabel}>Nome</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder={defaultTitle}
                placeholderTextColor={colors.ink4}
                maxLength={60}
              />
            </>
          )}

          <Text style={styles.fieldLabel}>Formato</Text>
          <Segmented
            variant="brand"
            options={FORMAT_OPTS}
            value={format}
            onChange={(v) => {
              tap();
              setFormat(v);
            }}
          />

          <Text style={styles.fieldLabel}>Fundo</Text>
          <Segmented
            variant="brand"
            options={bgOptions(photoChoices.length > 0)}
            value={background}
            onChange={(v) => {
              tap();
              setBackground(v);
            }}
          />

          {background === 'photo' && photoChoices.length > 1 && (
            <>
              <Text style={styles.fieldLabel}>Qual foto</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoPicker}>
                {photoChoices.map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => {
                      tap();
                      setPhotoId(p.id);
                    }}
                    style={[styles.photoOpt, chosenPhoto?.id === p.id && styles.photoOptOn]}
                  >
                    <PickerThumb
                      assetId={p.assetId}
                      style={styles.photoOptImg}
                      isVideo={p.mediaType === 'video'}
                      durationS={p.durationS}
                    />
                    {/* A capa é a foto que este compositor já abria por padrão
                        — estava numa linha de código e em lugar nenhum da tela.
                        A estrela é a única mudança visível desta frente. */}
                    {p.isCover && (
                      <View style={styles.photoOptStar}>
                        <Ionicons name="star" size={9} color={colors.onPrimary} />
                      </View>
                    )}
                  </Pressable>
                ))}
              </ScrollView>
            </>
          )}

          {/* Só com o fundo Foto: um controle morto na tela é pior que um
              controle a menos. */}
          {background === 'photo' && (
            <>
              <Text style={styles.fieldLabel}>Enquadramento</Text>
              <Text style={styles.fitHint}>
                {frame.scale > 1.02
                  ? `Pinça para aproximar, dedo para mover · ${frame.scale.toFixed(1)}×`
                  : 'Pinça para aproximar, dedo para mover'}
              </Text>
              {canSequence && (
                <>
                  <Pressable
                    style={styles.switchRow}
                    onPress={() => {
                      tap();
                      setSequence((v) => !v);
                      setSeqAt(0);
                    }}
                  >
                    <Text style={styles.switchLabel}>
                      Um cartão por parada · {stopCards.length}
                    </Text>
                    <View style={[styles.switchTrack, seqOn && styles.switchTrackOn]}>
                      <View style={[styles.switchThumb, seqOn && styles.switchThumbOn]} />
                    </View>
                  </Pressable>
                  {seqOn && (
                    <View style={styles.pager}>
                      <Pressable
                        onPress={() => {
                          tap();
                          setSeqAt((i) => Math.max(0, i - 1));
                        }}
                        disabled={seqAt === 0}
                        hitSlop={10}
                      >
                        <Ionicons
                          name="chevron-back"
                          size={18}
                          color={seqAt === 0 ? colors.ink4 : colors.ink2}
                        />
                      </Pressable>
                      <Text style={styles.pagerText}>
                        {seqCard?.city ?? 'Parada'} · {seqAt + 1} de {stopCards.length}
                      </Text>
                      <Pressable
                        onPress={() => {
                          tap();
                          setSeqAt((i) => Math.min(stopCards.length - 1, i + 1));
                        }}
                        disabled={seqAt >= stopCards.length - 1}
                        hitSlop={10}
                      >
                        <Ionicons
                          name="chevron-forward"
                          size={18}
                          color={seqAt >= stopCards.length - 1 ? colors.ink4 : colors.ink2}
                        />
                      </Pressable>
                    </View>
                  )}
                </>
              )}
              <Pressable
                style={styles.switchRow}
                onPress={() => {
                  tap();
                  setShowPlace((v) => !v);
                }}
              >
                <Text style={styles.switchLabel}>Mostrar onde a foto foi tirada</Text>
                <View style={[styles.switchTrack, showPlace && styles.switchTrackOn]}>
                  <View style={[styles.switchThumb, showPlace && styles.switchThumbOn]} />
                </View>
              </Pressable>
              <Pressable
                style={styles.switchRow}
                onPress={() => {
                  tap();
                  setShowRoute((v) => !v);
                }}
              >
                <Text style={styles.switchLabel}>Desenhar a rota sobre a foto</Text>
                <View style={[styles.switchTrack, showRoute && styles.switchTrackOn]}>
                  <View style={[styles.switchThumb, showRoute && styles.switchThumbOn]} />
                </View>
              </Pressable>
            </>
          )}

          {/* Também sobre a foto: desde que a rota seja desenhada, escolher se
              ela mostra velocidade, traçado puro ou elevação é a mesma decisão.
              Esconder o seletor ali obrigava a voltar ao fundo Transparente
              para trocar, e voltar de novo. */}
          {(background === 'art' || (background === 'photo' && showRoute)) && (
            <>
              <Text style={styles.fieldLabel}>Estilo da arte</Text>
              <ChipRow
                options={ART_OPTS}
                value={artStyle}
                onChange={(v) => {
                  tap();
                  setArtStyle(v);
                }}
              />
            </>
          )}

          {background === 'map' && (
            <>
              <Text style={styles.fieldLabel}>Estilo do mapa</Text>
              <ChipRow
                options={MAP_OPTS}
                value={mapStyle}
                onChange={(v) => {
                  tap();
                  setMapStyle(v);
                }}
              />

              <Text style={styles.fieldLabel}>Efeito</Text>
              <ChipRow
                options={EFFECT_OPTS}
                value={mapEffect}
                onChange={(v) => {
                  tap();
                  setMapEffect(v);
                }}
              />
            </>
          )}

          <Text style={styles.fieldLabel}>Cor do texto</Text>
          <SwatchRow
            value={textColor}
            onChange={(v) => {
              tap();
              setTextColor(v);
            }}
          />

          <Text style={styles.fieldLabel}>Métricas</Text>
          <View style={styles.chips}>
            {metrics.map((m) => {
              const on = enabled.has(m.key);
              return (
                <Pressable
                  key={m.key}
                  onPress={() => toggleMetric(m.key)}
                  style={[styles.chip, on ? styles.chipOn : styles.chipOff]}
                >
                  <Text style={[styles.chipText, on ? styles.chipTextOn : styles.chipTextOff]}>
                    {m.label}
                  </Text>
                </Pressable>
              );
            })}
            {metrics.length === 0 && (
              <Text style={styles.note}>Sem métricas disponíveis para esta atividade.</Text>
            )}
          </View>

          {cityNames.length > 0 && (
            <>
              <Pressable
                style={styles.switchRow}
                onPress={() => {
                  tap();
                  setShowCities((s) => !s);
                }}
              >
                <Text style={styles.switchLabel}>Mostrar cidades</Text>
                <View style={[styles.switchTrack, showCities && styles.switchTrackOn]}>
                  <View style={[styles.switchThumb, showCities && styles.switchThumbOn]} />
                </View>
              </Pressable>
              {showCities && (
                <View style={styles.chips}>
                  {cityNames.map((name) => {
                    const on = enabledCities.has(name);
                    return (
                      <Pressable
                        key={name}
                        onPress={() => toggleCity(name)}
                        style={[styles.chip, on ? styles.chipOn : styles.chipOff]}
                      >
                        <Text style={[styles.chipText, on ? styles.chipTextOn : styles.chipTextOff]}>
                          {name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </>
          )}

          <Pressable
            style={styles.switchRow}
            onPress={() => {
              tap();
              setWatermark((w) => !w);
            }}
          >
            <Text style={styles.switchLabel}>Marca d'água Orbe</Text>
            <View style={[styles.switchTrack, watermark && styles.switchTrackOn]}>
              <View style={[styles.switchThumb, watermark && styles.switchThumbOn]} />
            </View>
          </Pressable>
        </ScrollView>

        {/* Palco do snapshot: o cartão em tamanho de tela, escondido do usuário
            pelo overlay opaco por cima (nunca deslocado para fora da tela —
            ver comentário do exportBox). */}
        {exporting && (
          <>
            <View
              ref={exportStageRef}
              style={[styles.exportStage, { width: exportBox.width, height: exportBox.height }]}
              pointerEvents="none"
              collapsable={false}
            >
              {/* A foto entra como view NATIVA atrás do cartão: o WKWebView não
                  carrega `ph://`, e o `captureRef` fotografa esta View inteira,
                  então o snapshot compõe foto + cartão sem base64 nenhum. */}
              {(exportPhotoUri ?? (showPhoto ? photoUri : null)) && (
                <PhotoLayer
                  uri={(exportPhotoUri ?? photoUri)!}
                  frame={frame}
                  box={exportBox}
                />
              )}
              <WebView
                originWhitelist={['*']}
                source={{ html: exportHtml }}
                // Transparente p/ o PNG do modo "Dados" sair com alpha (arte e
                // mapa pintam fundo opaco próprio — não muda nada p/ eles).
                style={{ width: exportBox.width, height: exportBox.height, backgroundColor: 'transparent' }}
                scrollEnabled={false}
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
                androidLayerType="hardware"
                onLoadEnd={onExportLoaded}
              />
            </View>
            <View style={styles.exportOverlay}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.exportOverlayText}>Gerando imagem…</Text>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Linha de swatches de cor do texto. O primeiro é "Auto" (segue o tema do
 *  cartão), desenhado como círculo metade tinta / metade creme. */
function SwatchRow({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.chipRow}
      contentContainerStyle={styles.chipRowContent}
    >
      <Pressable
        onPress={() => onChange(null)}
        style={[styles.swatch, value === null && styles.swatchActive]}
      >
        <View style={styles.swatchAuto}>
          <View style={styles.swatchAutoHalfDark} />
          <View style={styles.swatchAutoHalfLight} />
        </View>
      </Pressable>
      {TEXT_COLORS.map((c) => (
        <Pressable
          key={c}
          onPress={() => onChange(c)}
          style={[styles.swatch, value === c && styles.swatchActive]}
        >
          <View style={[styles.swatchFill, { backgroundColor: c }]} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

/** Overlay de carregamento do preview (enquanto o WebView remontado carrega). */
function PreviewLoading() {
  return (
    <View style={styles.previewLoading}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

/** Linha horizontal rolável de chips de seleção única (para listas longas
 *  que não cabem no Segmented, que divide o espaço igualmente). */
function ChipRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.chipRow}
      contentContainerStyle={styles.chipRowContent}
    >
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={[styles.chip, on ? styles.chipOn : styles.chipOff]}
          >
            <Text style={[styles.chipText, on ? styles.chipTextOn : styles.chipTextOff]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Controle segmentado genérico (Pressables ad-hoc, tokens do tema). */
const styles = themed(() =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    pressed: { opacity: 0.6 },

    topbar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    cancel: { fontSize: 15, fontFamily: fonts.sans, color: colors.ink2 },
    topTitle: { fontSize: 17, fontFamily: fonts.sansBold, color: colors.ink },
    exportBtn: {
      paddingHorizontal: spacing.lg,
      paddingVertical: 7,
      borderRadius: radii.pill,
      backgroundColor: colors.primary,
    },
    exportDisabled: { backgroundColor: colors.ink4, opacity: 0.5 },
    exportText: { fontSize: 14, fontFamily: fonts.sansSemiBold, color: colors.onPrimary },

    previewArea: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    previewFrame: {
      borderRadius: radii['2xl'],
      overflow: 'hidden',
      backgroundColor: colors.surfaceMute,
      ...shadows.card,
    },
    web: { flex: 1, backgroundColor: 'transparent' },
    photoBehind: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    fitHint: { fontSize: 11.5, fontFamily: fonts.sans, color: colors.ink4, marginTop: spacing.sm },

  photoPicker: { flexGrow: 0 },
  photoOpt: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    marginRight: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  photoOptOn: { borderColor: colors.primary },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  pagerText: { fontSize: 13, fontFamily: fonts.sansMedium, color: colors.ink2 },
  /** A estrela da capa — a escolha padrão deixa de ser invisível. */
  photoOptStar: {
    position: 'absolute',
    right: 2,
    top: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoOptImg: { width: '100%', height: '100%' },
  exportStage: { position: 'absolute', top: 0, left: 0 },
    exportOverlay: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
      backgroundColor: colors.bg,
    },
    exportOverlayText: { fontSize: 14, fontFamily: fonts.sans, color: colors.ink2 },
    recenterBtn: {
      position: 'absolute',
      right: spacing.md,
      bottom: spacing.md,
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    previewLoading: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceMute,
    },

    controls: {
      maxHeight: '46%',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.line,
      backgroundColor: colors.surface,
    },
    controlsContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
    fieldLabel: {
      fontSize: 11, fontFamily: fonts.sans,
      color: colors.ink3,
      textTransform: 'uppercase',
      letterSpacing: 1.0,
      marginBottom: spacing.xs,
      marginTop: spacing.md,
    },
    input: {
      backgroundColor: colors.surfaceMute,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      fontSize: 15, fontFamily: fonts.sans,
      color: colors.ink,
    },


    // Margem negativa + padding no conteúdo: chips rolam de borda a borda.
    chipRow: { flexGrow: 0, marginHorizontal: -spacing.lg },
    chipRowContent: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg },

    // Swatch = anel externo (marca a seleção) + círculo de cor interno.
    swatch: {
      width: 36,
      height: 36,
      borderRadius: 18,
      padding: 3,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    swatchActive: { borderColor: colors.primary },
    swatchFill: {
      flex: 1,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
    },
    swatchAuto: {
      flex: 1,
      borderRadius: 999,
      overflow: 'hidden',
      flexDirection: 'row',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
    },
    swatchAutoHalfDark: { flex: 1, backgroundColor: '#1F1B16' },
    swatchAutoHalfLight: { flex: 1, backgroundColor: '#F6EFE6' },

    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: 7,
      borderRadius: radii.pill,
      borderWidth: 1,
    },
    chipOn: { backgroundColor: MOD.treino.tint, borderColor: 'transparent' },
    chipOff: { backgroundColor: 'transparent', borderColor: colors.line },
    chipText: { fontSize: 13.5, fontFamily: fonts.sansSemiBold },
    chipTextOn: { color: colors.primary },
    chipTextOff: { color: colors.ink3 },
    note: { fontSize: 13, fontFamily: fonts.sans, color: colors.ink3, fontStyle: 'italic' },

    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.lg,
      paddingVertical: spacing.xs,
    },
    // Primeiro item da faixa: o paddingTop do container já dá o respiro.
    switchRowFirst: { marginTop: 0 },
    switchLabel: { fontSize: 15, fontFamily: fonts.sans, color: colors.ink },
    switchTrack: {
      width: 46,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.lineDeep,
      padding: 3,
      justifyContent: 'center',
    },
    switchTrackOn: { backgroundColor: colors.primary },
    switchThumb: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: '#fff',
    },
    switchThumbOn: { alignSelf: 'flex-end' },
  }),
);
