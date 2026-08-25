import { create } from 'zustand';
import { useAuthStore } from './auth.store';
import {
  fetchActivities,
  fetchRouteOverviews,
  fetchRoutePoints,
  setActivityHidden,
  updateActivityFields,
} from '@vitale/shared';
import { supabase } from '../lib/supabase';
import type { Activity, ActivityRoutePoint, CityMark } from '@vitale/shared';

function currentUserId(): string | undefined {
  return useAuthStore.getState().user?.id;
}

export interface ActivityPatch {
  activityName?: string | null;
  durationS?: number;
}

const SELECT =
  'id,user_id,activity_id,activity_name,calories,start_at,end_at,duration_s,moving_time_s,distance_m,elevation_m,' +
  'source_name,source_id,device,tracked,has_route,best_efforts,hr_zones,calories_estimated,hr_zones_estimated,cities,locally_edited,edited_at,hidden';

interface DbActivityRow {
  id: string;
  user_id: string;
  activity_id: number;
  activity_name: string | null;
  calories: number | null;
  start_at: string;
  end_at: string;
  duration_s: number | null;
  moving_time_s: number | null;
  distance_m: number | null;
  elevation_m: number | null;
  source_name: string | null;
  source_id: string | null;
  device: string | null;
  tracked: boolean | null;
  has_route: boolean | null;
  best_efforts: Record<string, number> | null;
  hr_zones: Record<string, number> | null;
  calories_estimated: boolean | null;
  hr_zones_estimated: boolean | null;
  cities: CityMark[] | null;
  locally_edited: boolean | null;
  edited_at: string | null;
  hidden: boolean | null;
}

function mapRow(r: DbActivityRow): Activity {
  return {
    id: r.id,
    userId: r.user_id,
    activityId: r.activity_id,
    activityName: r.activity_name ?? undefined,
    calories: r.calories ?? 0,
    startAt: r.start_at,
    endAt: r.end_at,
    durationS: r.duration_s ?? 0,
    movingTimeS: r.moving_time_s ?? undefined,
    distanceM: r.distance_m ?? undefined,
    elevationM: r.elevation_m ?? undefined,
    sourceName: r.source_name ?? undefined,
    sourceId: r.source_id ?? undefined,
    device: r.device ?? undefined,
    tracked: r.tracked ?? undefined,
    hasRoute: r.has_route ?? false,
    bestEfforts: r.best_efforts ?? undefined,
    hrZones: r.hr_zones ?? undefined,
    caloriesEstimated: r.calories_estimated ?? false,
    hrZonesEstimated: r.hr_zones_estimated ?? false,
    cities: r.cities ?? undefined,
    locallyEdited: r.locally_edited ?? false,
    editedAt: r.edited_at ?? undefined,
    hidden: r.hidden ?? false,
  };
}

interface ActivitiesState {
  /** Dataset completo do usuário (inclui ocultas). */
  _all: Activity[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
  /** Cache de rotas GPS (resolução cheia) por id de atividade — usado no detalhe. */
  routes: Record<string, ActivityRoutePoint[]>;
  /**
   * Cache de overviews reduzidos (`route_overview`: ~1/40 pontos, só lat/lng) por
   * id — usado no mapa agregado por país. Separado de `routes`: mesma chave,
   * resoluções diferentes; misturá-los daria baixa resolução ao detalhe.
   */
  overviews: Record<string, ActivityRoutePoint[]>;

  /** Atividades visíveis (exclui hidden) — base das derivações analíticas. */
  activities: () => Activity[];
  /** true só depois de carregado e sem atividades visíveis. */
  isEmpty: () => boolean;

  load: (force?: boolean) => Promise<void>;
  findById: (id: string) => Activity | undefined;
  updateActivity: (id: string, patch: ActivityPatch) => Promise<void>;
  setHidden: (id: string, hidden: boolean) => Promise<void>;
  loadRoute: (activityId: string) => Promise<void>;
  /**
   * Carrega em lote os overviews reduzidos (mapa por país). Busca só os ainda
   * não cacheados via `in(...)`, popula `overviews`, e devolve um Map id→pontos
   * com uma entrada por id pedido (`[]` para as sem rota).
   */
  loadRouteOverviews: (ids: readonly string[]) => Promise<Map<string, ActivityRoutePoint[]>>;
}

/**
 * Busca em voo, se houver. O `loading` do estado só dizia QUE existe uma; para
 * um `force` que chega no meio dela, isso não basta — a busca em voo começou
 * ANTES do push e não traz a atividade recém-sincronizada. Descartar o `force`
 * aí perde a atualização em silêncio, e ela só voltaria num cold start.
 */
let inFlight: Promise<void> | null = null;

export const useActivitiesStore = create<ActivitiesState>((set, get) => ({
  _all: [],
  loading: false,
  loaded: false,
  error: null,
  routes: {},
  overviews: {},

  activities: () => get()._all.filter((a) => !a.hidden),
  isEmpty: () => get().loaded && get()._all.filter((a) => !a.hidden).length === 0,

  load: async (force = false) => {
    // Espera a busca em voo em vez de desistir: sem `force` ela já entrega o que
    // se pediu; com `force`, refaz depois (ver `inFlight` acima).
    if (inFlight) {
      await inFlight;
      if (!force) return;
    }
    if (get().loaded && !force) return;

    const userId = currentUserId();
    if (!userId) return;
    set({ loading: true, error: null });

    const run = (async () => {
      let all;
      try {
        all = await fetchActivities(supabase, userId);
      } catch (e) {
        set({ loading: false, error: e instanceof Error ? e.message : 'Erro ao carregar.' });
        return;
      }

      set({
        _all: all,
        loading: false,
        loaded: true,
      });
    })();

    inFlight = run;
    try {
      await run;
    } finally {
      if (inFlight === run) inFlight = null;
    }
  },

  findById: (id) => get()._all.find((a) => a.id === id),

  updateActivity: async (id, patch) => {
    const uid = currentUserId();
    if (!uid) throw new Error('Sessão não encontrada.');
    const editedAt = new Date().toISOString();
    await updateActivityFields(supabase, uid, id, {
      activityName: patch.activityName ?? undefined,
      durationS: patch.durationS,
    });

    set((state) => ({
      _all: state._all.map((a) =>
        a.id === id
          ? {
              ...a,
              ...(patch.activityName !== undefined
                ? { activityName: patch.activityName ?? undefined }
                : {}),
              ...(patch.durationS !== undefined ? { durationS: patch.durationS } : {}),
              locallyEdited: true,
              editedAt,
            }
          : a,
      ),
    }));
  },

  setHidden: async (id, hidden) => {
    const uid = currentUserId();
    if (!uid) throw new Error('Sessão não encontrada.');
    await setActivityHidden(supabase, uid, id, hidden);

    set((state) => ({
      _all: state._all.map((a) => (a.id === id ? { ...a, hidden } : a)),
    }));
  },

  loadRoute: async (activityId) => {
    if (get().routes[activityId] !== undefined) return;

    const uid = currentUserId();
    if (!uid) return;
    let raw: ActivityRoutePoint[] | null;
    try {
      raw = await fetchRoutePoints(supabase, uid, activityId);
    } catch {
      // Rota ausente não é erro fatal; cacheia vazio para não refazer a busca.
      set((state) => ({ routes: { ...state.routes, [activityId]: [] } }));
      return;
    }

    const points = (raw ?? []).filter(
      (p) => typeof p?.lat === 'number' && typeof p?.lng === 'number',
    );
    set((state) => ({ routes: { ...state.routes, [activityId]: points } }));
  },

  loadRouteOverviews: async (ids) => {
    const cache = get().overviews;
    const missing = ids.filter((id) => cache[id] === undefined);
    if (missing.length > 0) {
      const uid = currentUserId();
      const next: Record<string, ActivityRoutePoint[]> = {};
      try {
        if (uid) {
          for (const row of await fetchRouteOverviews(supabase, uid, [...missing])) {
            next[row.activityId] = row.overview;
          }
        }
      } catch {
        /* erro: cacheia [] abaixo para não rebuscar */
      }
      // Ids sem linha (ou erro): cacheia [] para não rebuscar.
      for (const id of missing) if (next[id] === undefined) next[id] = [];
      set((state) => ({ overviews: { ...state.overviews, ...next } }));
    }
    const all = get().overviews;
    return new Map(ids.map((id) => [id, all[id] ?? []]));
  },
}));
