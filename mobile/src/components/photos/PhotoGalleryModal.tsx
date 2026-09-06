/**
 * Todas as fotos de uma pedalada, em tela cheia (ADR 0037).
 *
 * O cartão do detalhe mostra duas miniaturas por parada — ele é índice, não
 * álbum. Esta tela é o álbum, e mantém a **parada como unidade**: cada seção
 * é um lugar onde a bicicleta ficou parada, com a cidade, o km e quanto tempo.
 * Uma grade cronológica única seria mais simples de varrer, e perderia
 * exatamente o "onde" que é a tese da feature.
 *
 * O visor é interno de propósito: sair para o app Fotos perderia o contexto da
 * pedalada, que é o que dá sentido à foto aqui — a hora e o quilômetro embaixo
 * dela são o que nenhum outro app mostra.
 */

import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Image,
  Animated,
  PanResponder,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ActivityPhoto } from '@vitale/shared';
import { colors, fonts, onMedia, radii, spacing, useThemedStyles } from '../../theme';
import { useAssetUri } from '../../hooks/useAssetUri';
import { formatClip } from '../../lib/workout-format';

/** Colunas da grade. Três dá miniatura legível sem virar contato-prova. */
const COLS = 3;

function hhmm(ms: number): string {
  return new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function km(m: number | null): string | null {
  if (m === null) return null;
  return `km ${(m / 1000).toFixed(1).replace('.', ',')}`;
}

/** Miniatura da grade. Resolve o endereço sozinha — ver `services/asset-uri.ts`. */
function GridTile({
  photo,
  size,
  onPress,
  onLongPress,
  selecting,
  selected,
}: {
  photo: ActivityPhoto;
  size: number;
  onPress: () => void;
  onLongPress?: () => void;
  selecting: boolean;
  selected: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  const uri = useAssetUri(photo.assetId, photo.mediaType === 'video');
  const box = { width: size, height: size };

  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={280} style={[box, styles.tile]}>
      {typeof uri === 'string' ? (
        <Image source={{ uri }} style={styles.tileImg} />
      ) : (
        <View style={[styles.tileImg, uri === null && styles.tileGap]}>
          {uri === null && <Ionicons name="help-outline" size={16} color={colors.ink4} />}
        </View>
      )}
      {photo.mediaType === 'video' && photo.durationS !== null && (
        <View style={styles.clip}>
          <Ionicons name="play" size={7} color={onMedia} />
          <Text style={styles.clipText}>{formatClip(photo.durationS)}</Text>
        </View>
      )}
      {photo.isCover && !selecting && (
        <View style={styles.cover}>
          <Ionicons name="star" size={9} color={onMedia} />
        </View>
      )}
      {selecting && (
        <>
          {selected && <View style={styles.selVeil} />}
          <View style={[styles.selMark, selected && styles.selMarkOn]}>
            {selected && <Ionicons name="checkmark" size={12} color={onMedia} />}
          </View>
        </>
      )}
    </Pressable>
  );
}

/** O visor: uma foto por página, com o contexto da pedalada embaixo. */
function Viewer({
  photos,
  index,
  onClose,
}: {
  photos: ActivityPhoto[];
  index: number;
  onClose: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState(index);

  /**
   * Arrastar para baixo fecha — o gesto que todo visor de foto tem, e que o
   * usuário pediu em 07/09/2026 depois de tentar usá-lo por instinto.
   *
   * `Animated` do RN, não Reanimated (ADR 0010). O responder só assume quando o
   * movimento é **claramente vertical** (|dy| > 2·|dx|): sem isso ele roubaria
   * o gesto do carrossel horizontal, e deslizar entre fotos deixaria de
   * funcionar — que seria trocar um bug por outro.
   */
  const drag = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const pan = useRef(
    PanResponder.create({
      /**
       * **Captura**, não a fase normal. O `ScrollView` horizontal é uma view
       * nativa e assume o responder assim que o dedo se move: pedindo o gesto
       * pela fase de bolha o pai nunca o recebe, e foi por isso que a primeira
       * versão simplesmente não fez nada (conferido no iPhone em 07/09/2026).
       *
       * A guarda continua sendo o que protege o carrossel: só captura quando o
       * movimento é claramente vertical e já andou o suficiente para não ser
       * um toque trêmulo.
       */
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: (_, g) =>
        g.dy > 12 && Math.abs(g.dy) > Math.abs(g.dx) * 2,
      onMoveShouldSetPanResponder: (_, g) =>
        g.dy > 12 && Math.abs(g.dy) > Math.abs(g.dx) * 2,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) drag.setValue({ x: 0, y: g.dy });
      },
      onPanResponderRelease: (_, g) => {
        // Fecha por distância OU por velocidade: um puxão curto e rápido é tão
        // intencional quanto um arrasto longo.
        if (g.dy > 110 || g.vy > 0.7) {
          Animated.timing(drag, {
            toValue: { x: 0, y: height },
            duration: 160,
            useNativeDriver: true,
          }).start(onClose);
        } else {
          Animated.spring(drag, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: true,
            bounciness: 0,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(drag, { toValue: { x: 0, y: 0 }, useNativeDriver: true, bounciness: 0 }).start();
      },
    }),
  ).current;

  /** O fundo clareia conforme o dedo desce — o visor "solta" a foto. */
  const backdrop = drag.y.interpolate({
    inputRange: [0, height * 0.5],
    outputRange: [1, 0.2],
    extrapolate: 'clamp',
  });

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Animated.View style={[styles.viewerBackdrop, { opacity: backdrop }]} />
      <Animated.View
        style={[styles.viewer, { transform: [{ translateY: drag.y }] }]}
        {...pan.panHandlers}
      >
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: index * width, y: 0 }}
          onMomentumScrollEnd={(e) =>
            setCurrent(Math.round(e.nativeEvent.contentOffset.x / width))
          }
        >
          {photos.map((p) => (
            <ViewerPage key={p.id} photo={p} width={width} />
          ))}
        </ScrollView>

        <Pressable
          onPress={onClose}
          hitSlop={12}
          style={[styles.viewerClose, { top: insets.top + spacing.sm }]}
        >
          <Ionicons name="close" size={22} color={onMedia} />
        </Pressable>

        <View style={[styles.viewerFoot, { paddingBottom: insets.bottom + spacing.lg }]}>
          <Text style={styles.viewerTime}>{hhmm(photos[current]?.takenAt ?? 0)}</Text>
          {km(photos[current]?.routeDistanceM ?? null) && (
            <Text style={styles.viewerMeta}>{km(photos[current]!.routeDistanceM)}</Text>
          )}
          <Text style={styles.viewerMeta}>
            {current + 1} de {photos.length}
          </Text>
        </View>
      </Animated.View>
    </Modal>
  );
}

function ViewerPage({ photo, width }: { photo: ActivityPhoto; width: number }) {
  const styles = useThemedStyles(createStyles);
  const uri = useAssetUri(photo.assetId, photo.mediaType === 'video');
  return (
    <View style={[styles.viewerPage, { width }]}>
      {typeof uri === 'string' ? (
        <Image source={{ uri }} style={styles.viewerImg} resizeMode="contain" />
      ) : (
        <Ionicons name="help-outline" size={30} color={onMedia} />
      )}
    </View>
  );
}

export interface GallerySection {
  key: string;
  title: string;
  subtitle: string;
  photos: ActivityPhoto[];
}

interface Props {
  visible: boolean;
  sections: GallerySection[];
  total: number;
  onClose: () => void;
  /**
   * Procurar fotos de novo. Mora aqui, e não na tela da pedalada, porque é
   * onde o álbum está — e porque a biblioteca muda depois: foto que ainda
   * estava subindo do iCloud, ou uma pedalada antiga varrida antes de você ter
   * tirado as fotos dela.
   */
  onRescan?: () => void;
  /** Desliga as fotos escolhidas. Nunca apaga arquivo — só a ligação. */
  onDismiss?: (photoIds: string[]) => Promise<void> | void;
}

export function PhotoGalleryModal({ visible, sections, total, onClose, onRescan, onDismiss }: Props) {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [viewing, setViewing] = useState<number | null>(null);

  /**
   * A curadoria acontece **depois**: numa pedalada com muitas fotos não dá para
   * julgar uma a uma na folha, então liga-se tudo e limpa-se aqui. O modo entra
   * por toque longo numa foto — o mesmo gesto do app Fotos, para não precisar
   * de um botão a mais no cabeçalho.
   */
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };

  const leaveSelection = () => {
    setSelecting(false);
    setPicked(new Set());
  };

  /** A ordem plana da grade — é o que o visor percorre ao deslizar. */
  const flat = useMemo(() => sections.flatMap((s) => s.photos), [sections]);

  const gap = 3;
  const size = Math.floor((width - spacing.lg * 2 - gap * (COLS - 1)) / COLS);

  let offset = 0;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.gallery, { paddingTop: insets.top }]}>
        <View style={styles.galleryHead}>
          {selecting ? (
            <>
              <Pressable onPress={leaveSelection} hitSlop={12}>
                <Text style={styles.headAction}>Cancelar</Text>
              </Pressable>
              <Text style={styles.galleryTitle}>
                {picked.size === 0
                  ? 'Escolha as fotos'
                  : `${picked.size} ${picked.size === 1 ? 'escolhida' : 'escolhidas'}`}
              </Text>
              <Pressable onPress={() => setPicked(new Set(flat.map((p) => p.id)))} hitSlop={12}>
                <Text style={[styles.headAction, styles.headActionRight]}>Tudo</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable onPress={onClose} hitSlop={12}>
                <Ionicons name="chevron-down" size={24} color={colors.ink} />
              </Pressable>
              <Text style={styles.galleryTitle}>Fotos</Text>
              {onRescan && (
                <Pressable onPress={onRescan} hitSlop={10} style={styles.rescan}>
                  <Ionicons name="search" size={13} color={colors.ink2} />
                  <Text style={styles.rescanText}>Procurar mais</Text>
                </Pressable>
              )}
              <Text style={styles.galleryCount}>{total}</Text>
            </>
          )}
        </View>

        <ScrollView
          contentContainerStyle={[styles.galleryBody, { paddingBottom: insets.bottom + spacing.xl }]}
          showsVerticalScrollIndicator={false}
        >
          {sections.map((s) => {
            const base = offset;
            offset += s.photos.length;
            return (
              <View key={s.key} style={styles.section}>
                <Text style={styles.sectionTitle}>{s.title}</Text>
                <Text style={styles.sectionSub}>{s.subtitle}</Text>
                <View style={[styles.grid, { gap }]}>
                  {s.photos.map((p, i) => (
                    <GridTile
                      key={p.id}
                      photo={p}
                      size={size}
                      selecting={selecting}
                      selected={picked.has(p.id)}
                      onPress={() => (selecting ? toggle(p.id) : setViewing(base + i))}
                      onLongPress={() => {
                        if (!onDismiss) return;
                        setSelecting(true);
                        setPicked(new Set([p.id]));
                      }}
                    />
                  ))}
                </View>
              </View>
            );
          })}
        </ScrollView>

        {selecting && picked.size > 0 && (
          <View style={[styles.actionBar, { paddingBottom: insets.bottom + spacing.md }]}>
            <Pressable
              style={styles.dismissBtn}
              onPress={async () => {
                const ids = [...picked];
                leaveSelection();
                await onDismiss?.(ids);
              }}
            >
              <Ionicons name="remove-circle-outline" size={17} color={onMedia} />
              <Text style={styles.dismissText}>
                Desligar {picked.size} {picked.size === 1 ? 'foto' : 'fotos'}
              </Text>
            </Pressable>
            <Text style={styles.dismissHint}>As imagens continuam no seu iPhone.</Text>
          </View>
        )}

        {viewing !== null && (
          <Viewer photos={flat} index={viewing} onClose={() => setViewing(null)} />
        )}
      </View>
    </Modal>
  );
}

const createStyles = () =>
  StyleSheet.create({
    gallery: { flex: 1, backgroundColor: colors.bg },
    galleryHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    galleryTitle: { fontSize: 17, fontFamily: fonts.sansBold, color: colors.ink },
    galleryCount: { fontSize: 13, fontFamily: fonts.mono, color: colors.ink3 },
    rescan: {
      marginLeft: 'auto',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radii.md,
      backgroundColor: colors.surfaceMute,
    },
    rescanText: { fontSize: 12, fontFamily: fonts.sansSemiBold, color: colors.ink2 },
    galleryBody: { paddingHorizontal: spacing.lg },
    /**
     * Tinta, não marca. `primary`/`primaryDeep` garantem 3,0 — o piso do traço,
     * não o da letra (4,5) —, e a barreira mantém um teto de quantas vezes o
     * acento vira texto. Aqui não vale gastar: "Cancelar" e "Tudo" são ações de
     * cabeçalho, e a ênfase da tela é a contagem de escolhidas.
     */
    headAction: { fontSize: 15, fontFamily: fonts.sansSemiBold, color: colors.ink },
    headActionRight: { marginLeft: 'auto' },

    selVeil: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(242,92,43,0.28)',
    },
    selMark: {
      position: 'absolute',
      right: 4,
      bottom: 4,
      width: 19,
      height: 19,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.9)',
      backgroundColor: 'rgba(0,0,0,0.3)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    selMarkOn: { backgroundColor: colors.primary },

    actionBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingTop: spacing.md,
      paddingHorizontal: spacing.lg,
      gap: 6,
      backgroundColor: colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.line,
    },
    dismissBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      paddingVertical: 13,
      borderRadius: radii.lg,
      backgroundColor: colors.primary,
    },
    dismissText: { fontSize: 15, fontFamily: fonts.sansBold, color: onMedia },
    dismissHint: {
      fontSize: 11,
      fontFamily: fonts.sansMedium,
      color: colors.ink3,
      textAlign: 'center',
    },

    section: { marginBottom: spacing.xl },
    sectionTitle: { fontSize: 13.5, fontFamily: fonts.sansBold, color: colors.ink },
    sectionSub: {
      fontSize: 11,
      fontFamily: fonts.mono,
      color: colors.ink3,
      marginTop: 1,
      marginBottom: spacing.sm,
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },

    tile: { borderRadius: radii.sm, overflow: 'hidden' },
    tileImg: { width: '100%', height: '100%', backgroundColor: colors.surfaceMute },
    tileGap: {
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.lineDeep,
      borderStyle: 'dashed',
    },
    clip: {
      position: 'absolute',
      left: 3,
      bottom: 3,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: 6,
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    clipText: { fontSize: 9, fontFamily: fonts.monoSemiBold, color: onMedia },
    cover: {
      position: 'absolute',
      right: 3,
      top: 3,
      width: 15,
      height: 15,
      borderRadius: 8,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
    },

    /**
     * O visor é escuro nos dois esquemas, de propósito: a foto é que manda, e
     * um fundo claro em volta dela lava a imagem. É a convenção de todo visor.
     */
    viewer: { flex: 1 },
    /**
     * O fundo é uma camada à parte para poder clarear enquanto a foto desce.
     * Escuro nos dois esquemas: a foto é que manda, e fundo claro em volta lava
     * a imagem — é a convenção de todo visor.
     */
    viewerBackdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgb(10,9,8)',
    },
    viewerPage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    viewerImg: { width: '100%', height: '100%' },
    viewerClose: {
      position: 'absolute',
      left: spacing.lg,
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    viewerFoot: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
    },
    viewerTime: { fontSize: 17, fontFamily: fonts.mono, color: onMedia },
    viewerMeta: { fontSize: 12, fontFamily: fonts.mono, color: 'rgba(255,255,255,0.7)' },
  });
