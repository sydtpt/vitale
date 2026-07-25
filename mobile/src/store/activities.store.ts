import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Activity, ActivityRoutePoint, CityMark } from '@vitale/shared';

export interface ActivityPatch {
  activityName?: string | null;
  durationS?: number;
}

const SELECT =
  'id,user_id,activity_id,activity_name,calories,start_at,end_at,duration_s,moving_time_s,distance_m,elevation_m,' +
  'source_name,source_id,device,tracked,has_route,best_efforts,hr_zones,cities,locally_edited,edited_at,hidden';

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
    const { loading, loaded } = get();
    if (loading || (loaded && !force)) return;

    set({ loading: true, error: null });

    const { data, error } = await supabase
      .from('activities')
      .select(SELECT)
      .order('start_at', { ascending: false });

    if (error) {
      set({ loading: false, error: error.message });
      return;
    }

    set({
      _all: ((data ?? []) as unknown as DbActivityRow[]).map(mapRow),
      loading: false,
      loaded: true,
    });
  },

  findById: (id) => get()._all.find((a) => a.id === id),

  updateActivity: async (id, patch) => {
    const editedAt = new Date().toISOString();
    // `locally_edited` mantém o selo "editado"; as flags por campo dizem ao sync
    // QUAIS campos preservar (ele continua atualizando os demais).
    const dbPatch: Record<string, unknown> = { locally_edited: true, edited_at: editedAt };
    if (patch.activityName !== undefined) {
      dbPatch.activity_name = patch.activityName;
      dbPatch.name_edited = true;
    }
    if (patch.durationS !== undefined) {
      dbPatch.duration_s = patch.durationS;
      dbPatch.duration_edited = true;
    }

    const { error } = await supabase.from('activities').update(dbPatch).eq('id', id);
    if (error) throw new Error(error.message);

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
    const { error } = await supabase.from('activities').update({ hidden }).eq('id', id);
    if (error) throw new Error(error.message);

    set((state) => ({
      _all: state._all.map((a) => (a.id === id ? { ...a, hidden } : a)),
    }));
  },

  loadRoute: async (activityId) => {
    if (get().routes[activityId] !== undefined) return;

    const { data, error } = await supabase
      .from('activity_routes')
      .select('points')
      .eq('activity_id', activityId)
      .maybeSingle();

    if (error) {
      // Rota ausente não é erro fatal; cacheia vazio para não refazer a busca.
      set((state) => ({ routes: { ...state.routes, [activityId]: [] } }));
      return;
    }

    const points = ((data?.points ?? []) as ActivityRoutePoint[]).filter(
      (p) => typeof p?.lat === 'number' && typeof p?.lng === 'number',
    );
    set((state) => ({ routes: { ...state.routes, [activityId]: points } }));
  },

  loadRouteOverviews: async (ids) => {
    const cache = get().overviews;
    const missing = ids.filter((id) => cache[id] === undefined);
    if (missing.length > 0) {
      const { data, error } = await supabase
        .from('activity_routes')
        .select('activity_id, route_overview')
        .in('activity_id', missing);

      const next: Record<string, ActivityRoutePoint[]> = {};
      if (!error) {
        for (const row of (data ?? []) as {
          activity_id: string;
          route_overview: [number, number][] | null;
        }[]) {
          // route_overview é [[lat,lng],...]; mapeia para {lat,lng} p/ o mapa.
          next[row.activity_id] = (row.route_overview ?? [])
            .filter((pair) => Array.isArray(pair) && pair.length >= 2)
            .map(([lat, lng]) => ({ lat, lng }));
        }
      }
      // Ids sem linha (ou erro): cacheia [] para não rebuscar.
      for (const id of missing) if (next[id] === undefined) next[id] = [];
      set((state) => ({ overviews: { ...state.overviews, ...next } }));
    }
    const all = get().overviews;
    return new Map(ids.map((id) => [id, all[id] ?? []]));
  },
}));
