/**
 * As fotos ligadas de uma atividade, e o que o mapa precisa delas (ADR 0037).
 *
 * Mora num hook porque **duas telas da mesma página precisam do mesmo dado**: o
 * mapa desenha os marcadores e o cartão lista as paradas. Carregar duas vezes
 * daria contagens diferentes na mesma tela durante o intervalo entre as duas
 * respostas — o tipo de incoerência que ninguém reporta como bug, só desconfia.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  type ActivityPhoto,
  type ActivityRoutePoint,
  detectStops,
  fetchActivityPhotos,
  groupByStop,
} from '@vitale/shared';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth.store';

export interface ActivityPhotoView {
  photos: ActivityPhoto[];
  /** Paradas que têm foto, com a contagem — o que o mapa desenha em círculo. */
  stopMarks: { lat: number; lng: number; count: number }[];
  /** Fotos fora de parada — ponto pequeno no mapa. */
  dotMarks: { lat: number; lng: number }[];
  grouped: ReturnType<typeof groupByStop<ActivityPhoto & { takenAtMs: number }>>;
  reload: () => Promise<void>;
}

export function useActivityPhotos(
  activityId: string,
  points: readonly ActivityRoutePoint[],
  totalDistanceM?: number,
): ActivityPhotoView {
  const userId = useAuthStore((s) => s.user?.id);
  const [photos, setPhotos] = useState<ActivityPhoto[]>([]);

  const reload = useCallback(async () => {
    if (!userId) return;
    try {
      setPhotos(await fetchActivityPhotos(supabase, userId, activityId, { linkedOnly: true }));
    } catch {
      // Sem foto é um estado válido, não um erro de tela.
    }
  }, [userId, activityId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const stops = useMemo(
    () => detectStops(points, { totalDistanceM }),
    [points, totalDistanceM],
  );

  const grouped = useMemo(
    () => groupByStop(photos.map((p) => ({ ...p, takenAtMs: p.takenAt })), stops),
    [photos, stops],
  );

  /**
   * O marcador da parada fica na coordenada da **parada**, não na da foto: as
   * fotos de um café estão espalhadas por poucos metros, e usar a primeira
   * delas faria o círculo dançar conforme quais entraram.
   */
  const stopMarks = useMemo(
    () => grouped.stops.map(({ stop, photos: ps }) => ({ lat: stop.lat, lng: stop.lng, count: ps.length })),
    [grouped],
  );

  /** Só a foto em movimento que tem coordenada própria vira ponto no mapa. */
  const dotMarks = useMemo(
    () =>
      grouped.moving
        .filter((p) => p.lat !== null && p.lng !== null)
        .map((p) => ({ lat: p.lat as number, lng: p.lng as number })),
    [grouped],
  );

  return { photos, stopMarks, dotMarks, grouped, reload };
}
