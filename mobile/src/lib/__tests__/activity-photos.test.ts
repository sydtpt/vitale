/**
 * Fotos na pedalada — a classificação e a cura do ponteiro (ADR 0037).
 *
 * Só as partes puras, que por isso moram em `lib/` e não em `services/` — o
 * padrão da casa, o mesmo do `activity-todo-link`. As classes `Query` e `Asset`
 * do `expo-media-library` são nativas e nem importam fora do aparelho; manter a
 * decisão longe delas é o que torna tudo isto testável.
 *
 * O que se protege aqui:
 *
 * - a foto já decidida **não volta** como sugestão. Sem isso, a foto que o dono
 *   desligou reaparece a cada abertura da atividade e ele a desliga para sempre;
 * - a foto do documento tirada em casa, no meio da pedalada, cai em `off-route`
 *   e não em `on-route` — é o que o corredor de 40 m existe para separar;
 * - a cura reendereça pelo instante e **só** quando o ponteiro está quebrado.
 */

import { describe, it, expect } from '@jest/globals';
import type { ActivityPhoto, ActivityRoutePoint } from '@vitale/shared';

import { classifyMedia, planHealing, type RawMedia } from '../activity-photos';

const T0 = Date.UTC(2026, 7, 29, 9, 8, 3);
const M = 1 / 111_320;
/** ~1 m em longitude na latitude 51,9 — o traçado sobe em latitude. */
const MLNG = 1 / (111_320 * 0.617);

/** Traçado reto de 1 km, um ponto a cada 25 m e 5 s. */
const points: ActivityRoutePoint[] = Array.from({ length: 41 }, (_, i) => ({
  lat: 51.9 + i * 25 * M,
  lng: 4.5,
  t: T0 + i * 5000,
}));

const activity = { startAtMs: T0, endAtMs: T0 + 200_000, distanceM: 850 };

function media(over: Partial<RawMedia> & { takenAtMs: number }): RawMedia {
  return {
    assetId: `A/${over.takenAtMs}`,
    lat: null,
    lng: null,
    mediaType: 'photo',
    durationS: null,
    inCloud: false,
    ...over,
  };
}

describe('classifyMedia', () => {
  it('põe no traçado a foto tirada sobre a rota', () => {
    const p = points[20];
    const [c] = classifyMedia(
      [media({ takenAtMs: T0 + 100_000, lat: p.lat, lng: p.lng + 8 * MLNG })],
      points,
      activity,
      new Set(),
    );
    expect(c.group).toBe('on-route');
    expect(c.match?.onRoute).toBe(true);
    expect(c.match?.routeIndex).toBe(20);
    // 850 m oficiais, metade do percurso: o km da tela vem reescalado.
    expect(c.match?.routeDistanceM).toBeCloseTo(425, 0);
  });

  it('a foto longe do traçado no meio da pedalada é off-route, não "depois"', () => {
    const p = points[20];
    const [c] = classifyMedia(
      [media({ takenAtMs: T0 + 100_000, lat: p.lat, lng: p.lng + 500 * MLNG })],
      points,
      activity,
      new Set(),
    );
    expect(c.group).toBe('off-route');
    expect(c.match?.onRoute).toBe(false);
  });

  it('separa antes da largada e depois da chegada', () => {
    const cs = classifyMedia(
      [media({ takenAtMs: T0 - 60_000 }), media({ takenAtMs: T0 + 900_000 })],
      points,
      activity,
      new Set(),
    );
    expect(cs.map((c) => c.group)).toEqual(['before', 'after']);
  });

  it('a foto já decidida não volta como sugestão', () => {
    const decidida = T0 + 50_000;
    const cs = classifyMedia(
      [media({ takenAtMs: decidida }), media({ takenAtMs: T0 + 60_000 })],
      points,
      activity,
      new Set([decidida]),
    );
    expect(cs).toHaveLength(1);
    expect(cs[0].takenAtMs).toBe(T0 + 60_000);
  });

  it('vídeo e situação de nuvem sobrevivem à classificação', () => {
    const [c] = classifyMedia(
      [media({ takenAtMs: T0 + 10_000, mediaType: 'video', durationS: 12.5, inCloud: true })],
      points,
      activity,
      new Set(),
    );
    expect(c.mediaType).toBe('video');
    expect(c.durationS).toBe(12.5);
    expect(c.inCloud).toBe(true);
  });

  it('sem rota, a foto ainda entra — só não ganha lugar no mapa', () => {
    const [c] = classifyMedia([media({ takenAtMs: T0 + 10_000 })], [], activity, new Set());
    expect(c.match).toBeNull();
    expect(c.group).toBe('off-route');
  });
});

describe('planHealing', () => {
  const photo = (over: Partial<ActivityPhoto> & { id: string; takenAt: number }): ActivityPhoto => ({
    activityId: 'ACT',
    assetId: `velho/${over.id}`,
    lat: null,
    lng: null,
    mediaType: 'photo',
    durationS: null,
    routeIndex: null,
    routeDistanceM: null,
    offsetM: null,
    onRoute: false,
    state: 'linked',
    isCover: false,
    ...over,
  });

  it('reendereça pelo instante quando o ponteiro quebrou', () => {
    const plan = planHealing(
      [photo({ id: 'p1', takenAt: T0 + 1000 })],
      [{ assetId: 'novo/p1', takenAtMs: T0 + 1000 }],
      () => false, // nenhum ponteiro resolve
    );
    expect(plan).toEqual([{ id: 'p1', assetId: 'novo/p1' }]);
  });

  it('não mexe em ponteiro que ainda resolve', () => {
    const plan = planHealing(
      [photo({ id: 'p1', takenAt: T0 + 1000 })],
      [{ assetId: 'novo/p1', takenAtMs: T0 + 1000 }],
      () => true,
    );
    expect(plan).toEqual([]);
  });

  it('foto apagada da biblioteca não vira cura — fica órfã, e a tela mostra a lacuna', () => {
    const plan = planHealing(
      [photo({ id: 'p1', takenAt: T0 + 1000 })],
      [{ assetId: 'novo/outro', takenAtMs: T0 + 999_999 }],
      () => false,
    );
    expect(plan).toEqual([]);
  });
});
