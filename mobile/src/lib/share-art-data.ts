/**
 * Adaptador de formato para as artes data-driven do cartão de compartilhamento
 * ("Velocidade" e "Perfil").
 *
 * A conta mora no núcleo (`fitness/route-profile.ts`), onde o detalhe da
 * atividade dos dois apps também a consome. Aqui só se converte o ponto do
 * HealthKit (`RoutePoint`, nomes longos e timestamp ISO) para o **persistido**
 * (`{lat, lng, alt?, t?}`), que é o formato que o núcleo fala.
 *
 * As assinaturas continuam recebendo `RoutePoint` de propósito: o compositor
 * (`share-card-html.ts`) trabalha em cima dos pontos projetados no formato do
 * mapa, e fazê-lo converter seria empurrar o adaptador para dentro dele.
 */
import type { ActivityRoutePoint } from '@vitale/shared';
import {
  elevationProfile as coreElevationProfile,
  haversineM as coreHaversineM,
  smoothSeries,
  speedFractions as coreSpeedFractions,
  type ElevationProfile,
} from '@vitale/shared';
import type { RoutePoint } from './workout-types';

export type { ElevationProfile };
export { smoothSeries };

function toPersisted(p: RoutePoint): ActivityRoutePoint {
  const t = Date.parse(p.timestamp ?? '');
  return {
    lat: p.latitude,
    lng: p.longitude,
    alt: p.altitude,
    t: Number.isFinite(t) ? t : undefined,
  };
}

/** Distância em metros entre dois pontos (Haversine). */
export function haversineM(a: RoutePoint, b: RoutePoint): number {
  return coreHaversineM(a.latitude, a.longitude, b.latitude, b.longitude);
}

/**
 * Fração de velocidade (0..1) por segmento — ver `speedFractions` no núcleo.
 * Comprimento = points.length − 1. `null` quando a rota não tem horário por
 * ponto, e aí o cartão cai no traçado de cor única.
 */
export function speedFractions(points: readonly RoutePoint[]): number[] | null {
  return coreSpeedFractions(points.map(toPersisted));
}

/**
 * Perfil de elevação do percurso — ver `elevationProfile` no núcleo. `null` sem
 * dados suficientes ou com percurso ~plano; o cartão cai no traçado padrão.
 */
export function elevationProfile(points: readonly RoutePoint[]): ElevationProfile | null {
  return coreElevationProfile(points.map(toPersisted));
}
