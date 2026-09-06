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

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Image,
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
}: {
  photo: ActivityPhoto;
  size: number;
  onPress: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const uri = useAssetUri(photo.assetId);
  const box = { width: size, height: size };

  return (
    <Pressable onPress={onPress} style={[box, styles.tile]}>
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
      {photo.isCover && (
        <View style={styles.cover}>
          <Ionicons name="star" size={9} color={onMedia} />
        </View>
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
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState(index);

  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={onClose}>
      <View style={styles.viewer}>
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
      </View>
    </Modal>
  );
}

function ViewerPage({ photo, width }: { photo: ActivityPhoto; width: number }) {
  const styles = useThemedStyles(createStyles);
  const uri = useAssetUri(photo.assetId);
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
}

export function PhotoGalleryModal({ visible, sections, total, onClose }: Props) {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [viewing, setViewing] = useState<number | null>(null);

  /** A ordem plana da grade — é o que o visor percorre ao deslizar. */
  const flat = useMemo(() => sections.flatMap((s) => s.photos), [sections]);

  const gap = 3;
  const size = Math.floor((width - spacing.lg * 2 - gap * (COLS - 1)) / COLS);

  let offset = 0;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.gallery, { paddingTop: insets.top }]}>
        <View style={styles.galleryHead}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="chevron-down" size={24} color={colors.ink} />
          </Pressable>
          <Text style={styles.galleryTitle}>Fotos</Text>
          <Text style={styles.galleryCount}>{total}</Text>
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
                      onPress={() => setViewing(base + i)}
                    />
                  ))}
                </View>
              </View>
            );
          })}
        </ScrollView>

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
    galleryCount: { marginLeft: 'auto', fontSize: 13, fontFamily: fonts.mono, color: colors.ink3 },
    galleryBody: { paddingHorizontal: spacing.lg },

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
    viewer: { flex: 1, backgroundColor: 'rgb(10,9,8)' },
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
