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
import { View, Text, StyleSheet, Pressable, Image, ActivityIndicator, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  type ActivityPhoto,
  type ActivityRoutePoint,
  detectStops,
  fetchActivityPhotos,
  groupByStop,
} from '@vitale/shared';
import { colors, fonts, radii, shadows, spacing, useThemedStyles } from '../../theme';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth.store';
import type { PhotoCandidate } from '../../lib/activity-photos';
import {
  type PhotoAccess,
  type ScanResult,
  currentPhotoAccess,
  requestPhotoAccess,
  saveDecisions,
  scanActivity,
} from '../../services/activity-photos';
import { PhotoSuggestSheet } from './PhotoSuggestSheet';

/** Miniaturas por linha de parada antes de cortar. */
const PREVIEW = 2;

function assetUri(assetId: string | null): string | undefined {
  if (!assetId) return undefined;
  return assetId.includes('://') ? assetId : `ph://${assetId}`;
}

function hhmm(ms: number): string {
  return new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

interface Props {
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

export function ActivityPhotosCard({ activity, points }: Props) {
  const styles = useThemedStyles(createStyles);
  const userId = useAuthStore((s) => s.user?.id);

  const [photos, setPhotos] = useState<ActivityPhoto[]>([]);
  const [checked, setChecked] = useState<boolean>(!!activity.photosCheckedAt);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [access, setAccess] = useState<PhotoAccess>('full');
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    fetchActivityPhotos(supabase, userId, activity.id, { linkedOnly: true })
      .then((rows) => {
        if (alive) setPhotos(rows);
      })
      .catch(() => {
        /* sem foto é um estado válido, não um erro de tela */
      });
    return () => {
      alive = false;
    };
  }, [userId, activity.id]);

  /** As paradas saem do traçado, com o km já na escala oficial da atividade. */
  const stops = useMemo(
    () => detectStops(points, { totalDistanceM: activity.distanceM }),
    [points, activity.distanceM],
  );

  const grouped = useMemo(
    () => groupByStop(photos.map((p) => ({ ...p, takenAtMs: p.takenAt })), stops),
    [photos, stops],
  );

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
      if (!userId) return;
      setSheetOpen(false);
      try {
        await saveDecisions(userId, activity.id, accepted, rejected);
        setChecked(true);
        setPhotos(await fetchActivityPhotos(supabase, userId, activity.id, { linkedOnly: true }));
      } catch {
        /* a folha volta pelo cartão; nada se perde */
      }
    },
    [userId, activity.id],
  );

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

  // Nunca procurada: uma linha fina de convite, não um cartão vazio.
  if (photos.length === 0) {
    if (checked) return sheet;
    return (
      <>
        <Pressable style={styles.invite} onPress={openSheet}>
          <Ionicons name="images-outline" size={16} color={colors.ink3} />
          <Text style={styles.inviteText}>Procurar fotos desta pedalada</Text>
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
      <View style={styles.card}>
        <View style={styles.head}>
          <Text style={styles.title}>Fotos</Text>
          <Text style={styles.meta}>
            {photos.length} · {grouped.stops.length === 1 ? '1 parada' : `${grouped.stops.length} paradas`}
          </Text>
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
                  <Image key={p.id} source={{ uri: assetUri(p.assetId) }} style={styles.thumb} />
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
                <Image key={p.id} source={{ uri: assetUri(p.assetId) }} style={styles.thumb} />
              ))}
            </View>
          </View>
        )}
      </View>
      {sheet}
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
  });
