import { Injectable, computed, inject, signal } from '@angular/core';
import type { Activity, ActivityRoutePoint, CityMark } from '@vitale/shared';
import { supabase } from '@core/supabase/supabase.client';
import { AuthService } from '@core/auth/auth.service';
import { buildTypeSummaries } from './type-summary';
import {
  fetchActivities,
  fetchRouteOverviews,
  fetchRoutePoints,
  setActivityHidden,
  updateActivityFields,
} from '@vitale/shared';

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

const SELECT =
  'id,user_id,activity_id,activity_name,calories,start_at,end_at,duration_s,moving_time_s,distance_m,elevation_m,source_name,tracked,has_route,best_efforts,hr_zones,calories_estimated,hr_zones_estimated,cities,locally_edited,edited_at,hidden';

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

/**
 * Fonte única das atividades do usuário no web. Faz um único fetch e mantém
 * tudo em memória; visão geral, resumos por tipo e listas derivam por computed().
 * Decisão de performance: ver docs/specs/historico-treinos/plan.md §4.1.
 */
@Injectable({ providedIn: 'root' })
export class ActivitiesStore {
  private readonly auth = inject(AuthService);

  private readonly _all = signal<Activity[]>([]);
  private readonly _state = signal<LoadState>('idle');
  private readonly _error = signal<string | null>(null);
  /** Cache de rotas GPS (resolução cheia) por activityId — usado no detalhe. */
  private readonly _routes = new Map<string, ActivityRoutePoint[]>();
  /**
   * Cache de overviews reduzidos (route_overview: ~1/40 pontos, só lat/lng) por
   * activityId — usado no mapa agregado por país. Separado de `_routes` de
   * propósito: mesma chave, resoluções diferentes; misturá-los devolveria baixa
   * resolução ao detalhe (que precisa dos pontos cheios).
   */
  private readonly _overviews = new Map<string, ActivityRoutePoint[]>();

  /** Atividades visíveis (exclui ocultas) — base de toda derivação analítica. */
  readonly activities = computed(() => this._all().filter((a) => !a.hidden));

  /**
   * Busca por id incluindo ocultas — usado no detalhe, onde uma atividade fora
   * das estatísticas ainda precisa ser exibida e poder voltar para elas.
   */
  findById(id: string): Activity | undefined {
    return this._all().find((a) => a.id === id);
  }
  readonly state = this._state.asReadonly();
  readonly error = this._error.asReadonly();
  readonly loading = computed(() => this._state() === 'loading' || this._state() === 'idle');
  readonly isEmpty = computed(() => this._state() === 'loaded' && this.activities().length === 0);

  /** Agregados por tipo (de todo o histórico), independentes do filtro de período. */
  readonly typeSummaries = computed(() => buildTypeSummaries(this.activities()));

  async load(force = false): Promise<void> {
    if (!force && (this._state() === 'loaded' || this._state() === 'loading')) return;

    const userId = this.auth.user()?.id;
    if (!userId) {
      this._error.set('Sessão não encontrada.');
      this._state.set('error');
      return;
    }

    this._state.set('loading');
    this._error.set(null);

    try {
      this._all.set(await fetchActivities(supabase, userId));
    } catch (e) {
      this._error.set(e instanceof Error ? e.message : 'Erro ao carregar.');
      this._state.set('error');
      return;
    }
    this._state.set('loaded');
  }

  /**
   * Edição manual: persiste o patch, marca a linha como `locally_edited`
   * (o sync mobile deixa de sobrescrevê-la) e atualiza o estado local.
   */
  async updateActivity(
    id: string,
    patch: { activityName?: string | null; durationS?: number },
  ): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) throw new Error('Sessão não encontrada.');
    const editedAt = new Date().toISOString();
    await updateActivityFields(supabase, userId, id, {
      activityName: patch.activityName ?? undefined,
      durationS: patch.durationS,
    });

    this._all.update((list) =>
      list.map((a) =>
        a.id === id
          ? {
              ...a,
              ...(patch.activityName !== undefined ? { activityName: patch.activityName ?? undefined } : {}),
              ...(patch.durationS !== undefined ? { durationS: patch.durationS } : {}),
              locallyEdited: true,
              editedAt,
            }
          : a,
      ),
    );
  }

  /**
   * Inclui ou remove a atividade das estatísticas alternando a flag `hidden`.
   * O sync push-only preserva `hidden` (não está no SET do upsert), então a
   * escolha sobrevive a sincronizações futuras.
   */
  async setHidden(id: string, hidden: boolean): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) throw new Error('Sessão não encontrada.');
    await setActivityHidden(supabase, userId, id, hidden);

    this._all.update((list) => list.map((a) => (a.id === id ? { ...a, hidden } : a)));
  }

  /**
   * Carrega a rota GPS (lista de pontos) de uma atividade outdoor sob demanda.
   * Resultado fica em cache; retorna `[]` quando a atividade não tem rota.
   */
  async loadRoute(activityId: string): Promise<ActivityRoutePoint[]> {
    const cached = this._routes.get(activityId);
    if (cached) return cached;

    const userId = this.auth.user()?.id;
    if (!userId) throw new Error('Sessão não encontrada.');
    const points = ((await fetchRoutePoints(supabase, userId, activityId)) ?? []).filter(
      (p) => typeof p?.lat === 'number' && typeof p?.lng === 'number',
    );
    this._routes.set(activityId, points);
    return points;
  }

  /**
   * Carrega os overviews reduzidos de várias atividades de uma vez (mapa por
   * país, onde dezenas de rotas são desenhadas juntas). Lê `route_overview`
   * (~1/40 pontos, só lat/lng) em vez de `points` cheio — puxar o track completo
   * de dezenas de rotas num `in(...)` estoura o statement_timeout de 8s. Busca só
   * as ainda não cacheadas, guarda no cache próprio `_overviews`, e devolve um
   * Map id→pontos com uma entrada por id pedido (`[]` para as sem rota).
   */
  async loadRouteOverviews(ids: readonly string[]): Promise<Map<string, ActivityRoutePoint[]>> {
    const missing = ids.filter((id) => !this._overviews.has(id));
    if (missing.length > 0) {
      const uid = this.auth.user()?.id;
      if (!uid) throw new Error('Sessão não encontrada.');
      for (const row of await fetchRouteOverviews(supabase, uid, missing)) {
        this._overviews.set(row.activityId, row.overview);
      }
      // Ids sem linha em activity_routes: cacheia [] para não rebuscar.
      for (const id of missing) if (!this._overviews.has(id)) this._overviews.set(id, []);
    }
    return new Map(ids.map((id) => [id, this._overviews.get(id) ?? []]));
  }
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
