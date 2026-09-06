/**
 * O cartão Fotos do detalhe da atividade (ADR 0037, prancha A).
 *
 * Fica **abaixo dos números**, e é deliberado: o dono disse que abre uma
 * pedalada antiga procurando o mapa e os números, e que foto não é destaque.
 * A foto entra como camada sobre o que já manda na tela, não como seção nova
 * competindo por espaço.
 *
 * A unidade é a **parada**, não o ponto: doze fotos numa pedalada não são doze
 * lugares. Cada linha carrega o que só este app tem — a cidade real de
 * `activities.cities`, o km, e quanto tempo a bicicleta ficou parada ali.
 *
 * **Sem foto, o cartão não existe.** Some por completo, sem moldura vazia e sem
 * "adicione fotos" pedindo atenção. A única exceção é a pedalada que nunca foi
 * procurada: aí aparece uma linha fina de convite, que é também o caminho de
 * volta para quem tocou "Agora não".
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ActivityRoutePoint } from '@vitale/shared';
import { colors, fonts, onMedia, radii, shadows, spacing, useThemedStyles } from '../../theme';
import { useAuthStore } from '../../store/auth.store';
import { useActivityPhotos } from '../../hooks/useActivityPhotos';
import { useAssetUri } from '../../hooks/useAssetUri';
import { formatClip } from '../../lib/workout-format';
import type { PhotoCandidate } from '../../lib/activity-photos';
import {
  type PhotoAccess,
  type ScanResult,
  currentPhotoAccess,
  requestPhotoAccess,
  dismissPhoto,
  dismissPhotos,
  saveDecisions,
  scanActivity,
  setCover,
} from '../../services/activity-photos';
import { resolveAssetUri } from '../../services/asset-uri';
import { PhotoSuggestSheet } from './PhotoSuggestSheet';
import { PhotoGalleryModal, type GallerySection } from './PhotoGalleryModal';

/** Miniaturas por linha de parada antes de cortar. */
const PREVIEW = 2;

/**
 * Uma miniatura que sabe falhar.
 *
 * Foto apagada da biblioteca vira ligação órfã: o instante ainda existe no
 * banco, mas não há arquivo. A cura pelo instante (ADR 0037 §2) não resolve
 * isso — ela reendereça ponteiro trocado, não ressuscita arquivo. Mostrar a
 * lacuna é a resposta honesta; sumir calado faria a contagem do cabeçalho
 * discordar do que se vê.
 */
function Thumb({
  assetId,
  style,
  isVideo = false,
}: {
  assetId: string | null;
  style: object;
  isVideo?: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  const uri = useAssetUri(assetId, isVideo);
  const [broken, setBroken] = useState(false);

  if (uri === 'loading') return <View style={[style, styles.loadingTile]} />;
  if (uri === null || broken) {
    return (
      <View style={[style, styles.gap]}>
        <Ionicons name="help-outline" size={14} color={colors.ink4} />
      </View>
    );
  }
  return <Image source={{ uri }} style={style} onError={() => setBroken(true)} />;
}

function hhmm(ms: number): string {
  return new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

interface Props {
  /** Vem do hook da tela: mapa e cartão precisam do MESMO dado. */
  view: ReturnType<typeof useActivityPhotos>;
  activity: {
    id: string;
    startAtMs: number;
    endAtMs: number;
    distanceM?: number;
    photosCheckedAt: string | null;
    cities?: { name: string; lat: number; lng: number }[] | null;
  };
  points: readonly ActivityRoutePoint[];
}

export function ActivityPhotosCard({ activity, points, view }: Props) {
  const styles = useThemedStyles(createStyles);
  const userId = useAuthStore((s) => s.user?.id);
  const { photos, grouped, reload } = view;

  const [checked, setChecked] = useState<boolean>(!!activity.photosCheckedAt);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [access, setAccess] = useState<PhotoAccess>('full');
  const [scanning, setScanning] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);

  /** A cidade mais próxima da parada — o "Vrouwenakker · km 38,2" da tela. */
  const cityNear = useCallback(
    (lat: number, lng: number): string | null => {
      const cs = activity.cities ?? [];
      if (cs.length === 0) return null;
      let best = cs[0];
      let bestD = Infinity;
      for (const c of cs) {
        const d = (c.lat - lat) ** 2 + (c.lng - lng) ** 2;
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      return best.name;
    },
    [activity.cities],
  );

  const openSheet = useCallback(async () => {
    if (!userId) return;
    setSheetOpen(true);
    setScanning(true);
    try {
      let a = await currentPhotoAccess();
      if (a === 'denied') a = await requestPhotoAccess();
      setAccess(a);
      if (a === 'full') {
        setScan(await scanActivity({ ...activity }, points, userId));
      }
    } catch {
      setScan(null);
    } finally {
      setScanning(false);
    }
  }, [userId, activity, points]);

  const confirm = useCallback(
    async (accepted: PhotoCandidate[], rejected: PhotoCandidate[]) => {
      if (!userId) {
        Alert.alert('Sem sessão', 'Entre na sua conta para ligar fotos a uma pedalada.');
        return;
      }
      setSheetOpen(false);
      try {
        await saveDecisions(userId, activity.id, accepted, rejected);
        setChecked(true);
        await reload();
      } catch (e) {
        /**
         * NUNCA engolir este erro. A primeira versão tinha um `catch {}` mudo
         * com um comentário dizendo "nada se perde" — e era falso: a seleção
         * inteira ia embora e a tela não dizia nada. "Não acontece nada" foi
         * exatamente como o usuário descreveu o bug em 07/09/2026, e o silêncio
         * custou uma sessão de diagnóstico às cegas.
         */
        Alert.alert(
          'Não consegui ligar as fotos',
          e instanceof Error ? e.message : String(e),
        );
      }
    },
    [userId, activity.id, reload],
  );

  /**
   * Toque longo numa miniatura.
   *
   * "Desligar da pedalada" é a palavra certa, e não "excluir": o app não é dono
   * do arquivo. Oferecer "Ver no app Fotos" logo acima torna isso explícito —
   * a foto continua lá, inteira, depois de desligada.
   */
  const onLongPress = useCallback(
    (photoId: string, assetId: string | null) => {
      if (!userId) return;
      Alert.alert('Foto', undefined, [
        {
          text: 'Ver no app Fotos',
          onPress: () => {
            void resolveAssetUri(assetId).then((uri) => {
              if (uri) void Linking.openURL(uri).catch(() => undefined);
            });
          },
        },
        {
          text: 'Tornar a capa',
          onPress: async () => {
            try {
              await setCover(userId, activity.id, photoId);
              await reload();
            } catch {
              /* a capa é preferência, não dado: falhar em silêncio é aceitável */
            }
          },
        },
        {
          text: 'Desligar da pedalada',
          style: 'destructive',
          onPress: async () => {
            try {
              await dismissPhoto(userId, photoId);
              await reload();
            } catch {
              /* idem */
            }
          },
        },
        { text: 'Cancelar', style: 'cancel' },
      ]);
    },
    [userId, activity.id, reload],
  );

  /**
   * As seções da galeria saem do MESMO agrupamento do cartão — o cartão é o
   * índice, a galeria é o álbum, e os dois têm de contar a mesma história.
   */
  const sections = useMemo<GallerySection[]>(() => {
    const out: GallerySection[] = grouped.stops.map(({ stop, photos: ps }) => {
      const city = cityNear(stop.lat, stop.lng);
      return {
        key: `s${stop.startIdx}`,
        title: `${city ? `${city} · ` : ''}km ${(stop.distanceM / 1000).toFixed(1).replace('.', ',')}`,
        subtitle: `${hhmm(stop.startMs)} – ${hhmm(stop.endMs)} · ${Math.round(stop.durationS / 60)} min parado · ${ps.length} ${ps.length === 1 ? 'foto' : 'fotos'}`,
        photos: ps,
      };
    });
    for (const g of grouped.silent) {
      const first = g.photos[0];
      const city = first.lat !== null && first.lng !== null ? cityNear(first.lat, first.lng) : null;
      out.push({
        key: `q${g.firstMs}`,
        title: city ?? 'Parada não gravada',
        subtitle: `${hhmm(g.firstMs)} – ${hhmm(g.lastMs)} · ${Math.max(1, Math.round(g.spanS / 60))} min · o GPS não gravou aqui`,
        photos: g.photos,
      });
    }
    if (grouped.moving.length > 0) {
      out.push({
        key: 'moving',
        title: 'Em movimento',
        subtitle: `${grouped.moving.length} ${grouped.moving.length === 1 ? 'foto' : 'fotos'} · sem parada`,
        photos: grouped.moving,
      });
    }
    return out;
  }, [grouped, cityNear]);

  const sheet = (
    <PhotoSuggestSheet
      visible={sheetOpen}
      scan={scan}
      access={access}
      loading={scanning}
      onClose={() => setSheetOpen(false)}
      onConfirm={confirm}
      onOpenSettings={() => Linking.openSettings()}
    />
  );

  /**
   * Sem foto ligada. O convite continua existindo **mesmo depois de já ter
   * procurado** — a primeira versão sumia para sempre assim que
   * `photos_checked_at` era gravado, e bastava tocar "Não ligar nenhuma" uma vez
   * para a pedalada ficar sem nenhum caminho de volta (conferido no iPhone em
   * 07/09/2026).
   *
   * "Zero foto some por completo" era sobre não pedir atenção, não sobre virar
   * beco sem saída: depois de procurado, o convite fica mais quieto — texto
   * apagado, sem moldura — mas fica.
   */
  if (photos.length === 0) {
    return (
      <>
        <Pressable style={[styles.invite, checked && styles.inviteQuiet]} onPress={openSheet}>
          <Ionicons
            name="images-outline"
            size={16}
            color={checked ? colors.ink4 : colors.ink3}
          />
          <Text style={[styles.inviteText, checked && styles.inviteTextQuiet]}>
            {checked ? 'Procurar fotos de novo' : 'Procurar fotos desta pedalada'}
          </Text>
          {scanning ? (
            <ActivityIndicator size="small" color={colors.ink3} />
          ) : (
            <Ionicons name="chevron-forward" size={15} color={colors.ink4} />
          )}
        </Pressable>
        {sheet}
      </>
    );
  }

  const movingCount = grouped.moving.length;

  return (
    <>
      <Pressable style={styles.card} onPress={() => setGalleryOpen(true)}>
        <View style={styles.head}>
          <Text style={styles.title}>Fotos</Text>
          <Text style={styles.meta}>
            {photos.length} ·{' '}
            {(() => {
              const n = grouped.stops.length + grouped.silent.length;
              return n === 1 ? '1 parada' : `${n} paradas`;
            })()}
          </Text>
          <Ionicons name="chevron-forward" size={15} color={colors.ink4} style={styles.chevron} />
        </View>

        {grouped.stops.map(({ stop, photos: ps }) => {
          const city = cityNear(stop.lat, stop.lng);
          return (
            <View key={stop.startIdx} style={styles.row}>
              <View style={styles.pin}>
                <Text style={styles.pinText}>{ps.length}</Text>
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {city ? `${city} · ` : ''}km {(stop.distanceM / 1000).toFixed(1).replace('.', ',')}
                </Text>
                <Text style={styles.rowSub}>
                  {hhmm(stop.startMs)} – {hhmm(stop.endMs)} · {Math.round(stop.durationS / 60)} min parado
                </Text>
              </View>
              <View style={styles.strip}>
                {ps.slice(0, PREVIEW).map((p) => (
                  <Pressable key={p.id} onLongPress={() => onLongPress(p.id, p.assetId)} delayLongPress={300}>
                    <Thumb assetId={p.assetId} style={styles.thumb} isVideo={p.mediaType === 'video'} />
                    {p.mediaType === 'video' && p.durationS !== null && (
                      <View style={styles.clip}>
                        <Ionicons name="play" size={7} color={onMedia} />
                        <Text style={styles.clipText}>{formatClip(p.durationS)}</Text>
                      </View>
                    )}
                    {p.isCover && (
                      <View style={styles.coverBadge}>
                        <Ionicons name="star" size={9} color={onMedia} />
                      </View>
                    )}
                  </Pressable>
                ))}
              </View>
            </View>
          );
        })}

        {grouped.silent.map((g) => {
          const first = g.photos[0];
          const city = first.lat !== null && first.lng !== null ? cityNear(first.lat, first.lng) : null;
          return (
            <View key={g.firstMs} style={styles.row}>
              <View style={[styles.pin, styles.pinSilent]}>
                <Text style={styles.pinText}>{g.photos.length}</Text>
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle} numberOfLines={1}>{city ?? 'Parada não gravada'}</Text>
                <Text style={styles.rowSub}>
                  {hhmm(g.firstMs)} – {hhmm(g.lastMs)} · o GPS não gravou
                </Text>
              </View>
              <View style={styles.strip}>
                {g.photos.slice(0, PREVIEW).map((p) => (
                  <Thumb key={p.id} assetId={p.assetId} style={styles.thumb} isVideo={p.mediaType === 'video'} />
                ))}
              </View>
            </View>
          );
        })}

        {movingCount > 0 && (
          <View style={styles.row}>
            <View style={[styles.pin, styles.pinLoose]}>
              <Text style={styles.pinText}>{movingCount}</Text>
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Em movimento</Text>
              <Text style={styles.rowSub}>
                {grouped.moving.slice(0, 2).map((p) => hhmm(p.takenAtMs)).join(' e ')}
                {movingCount > 2 ? ' e mais' : ''} · sem parada
              </Text>
            </View>
            <View style={styles.strip}>
              {grouped.moving.slice(0, PREVIEW).map((p) => (
                <Pressable key={p.id} onLongPress={() => onLongPress(p.id, p.assetId)} delayLongPress={300}>
                  <Thumb assetId={p.assetId} style={styles.thumb} isVideo={p.mediaType === 'video'} />
                  {p.mediaType === 'video' && p.durationS !== null && (
                    <View style={styles.clip}>
                      <Ionicons name="play" size={7} color={onMedia} />
                      <Text style={styles.clipText}>{formatClip(p.durationS)}</Text>
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </Pressable>
      {sheet}
      <PhotoGalleryModal
        visible={galleryOpen}
        sections={sections}
        total={photos.length}
        onClose={() => setGalleryOpen(false)}
        onRescan={() => {
          setGalleryOpen(false);
          void openSheet();
        }}
        onDismiss={async (ids) => {
          if (!userId) return;
          try {
            await dismissPhotos(userId, ids);
            await reload();
          } catch (e) {
            Alert.alert(
              'Não consegui desligar',
              e instanceof Error ? e.message : String(e),
            );
          }
        }}
      />
    </>
  );
}

const createStyles = () =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii['2xl'],
      padding: spacing.lg,
      marginTop: spacing.sm,
      ...shadows.card,
    },
    head: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
    title: { fontSize: 13, fontFamily: fonts.sansBold, color: colors.ink },
    meta: { marginLeft: 'auto', fontSize: 11.5, fontFamily: fonts.mono, color: colors.ink3 },
    chevron: { marginLeft: 4 },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.line,
    },
    /**
     * O marcador é **neutro**: a rota e as cidades já usam o papel `orange`, e
     * dar cor à foto brigaria com o dado. Ver ADR 0018 e "marca não é cor de dado".
     */
    pin: {
      width: 23,
      height: 23,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.ink,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pinLoose: { borderStyle: 'dashed', borderColor: colors.ink3 },
    /**
     * A parada que o GPS não viu: contorno pontilhado, para dizer que ela é
     * **provada pelas fotos** e não medida pelo traçado.
     */
    pinSilent: { borderStyle: 'dotted', borderColor: colors.ink2 },
    pinText: { fontSize: 11, fontFamily: fonts.monoSemiBold, color: colors.ink },

    rowText: { flex: 1, minWidth: 0 },
    rowTitle: { fontSize: 12.5, fontFamily: fonts.sansSemiBold, color: colors.ink },
    rowSub: { fontSize: 11, fontFamily: fonts.mono, color: colors.ink3, marginTop: 1 },

    strip: { flexDirection: 'row', gap: 5 },
    thumb: {
      width: 44,
      height: 44,
      borderRadius: radii.sm,
      backgroundColor: colors.surfaceMute,
    },

    loadingTile: { backgroundColor: colors.surfaceMute },
    gap: {
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.lineDeep,
      borderStyle: 'dashed',
    },
    /** A duração fica na base, onde não briga com a estrela de capa (topo). */
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
    coverBadge: {
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
    invite: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.sm,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.line,
      borderStyle: 'dashed',
    },
    inviteText: { flex: 1, fontSize: 12.5, fontFamily: fonts.sansMedium, color: colors.ink3 },
    /** Depois de já ter procurado: presente, mas sem pedir atenção. */
    inviteQuiet: { borderColor: 'transparent', paddingVertical: spacing.sm },
    inviteTextQuiet: { color: colors.ink4 },
  });
