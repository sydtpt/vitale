import { Injectable, computed, inject, signal } from '@angular/core';
import type { Activity, ActivityRoutePoint } from '@vitale/shared';
import { supabase } from '@core/supabase/supabase.client';
import { AuthService } from '@core/auth/auth.service';
import { buildTypeSummaries } from './type-summary';

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

const SELECT =
  'id,user_id,activity_id,activity_name,calories,start_at,end_at,duration_s,distance_m,source_name,tracked,has_route,locally_edited,edited_at,hidden';

interface DbActivityRow {
  id: string;
  user_id: string;
  activity_id: number;
  activity_name: string | null;
  calories: number | null;
  start_at: string;
  end_at: string;
  duration_s: number | null;
  distance_m: number | null;
  source_name: string | null;
  tracked: boolean | null;
  has_route: boolean | null;
  locally_edited: boolean | null;
  edited_at: string | null;
  hidden: boolean | null;
}

/**
 * Fonte única das atividades do usuário no web. Faz um único fetch e mantém
 * tudo em memória; visão geral, resumos por tipo e listas derivam por computed().
 * Decisão de performance: ver .claude/specs/historico-treinos/plan.md §4.1.
 */
@Injectable({ providedIn: 'root' })
export class ActivitiesStore {
  private readonly auth = inject(AuthService);

  private readonly _all = signal<Activity[]>([]);
  private readonly _state = signal<LoadState>('idle');
  private readonly _error = signal<string | null>(null);
  /** Cache de rotas GPS por activityId — carregadas sob demanda no detalhe. */
  private readonly _routes = new Map<string, ActivityRoutePoint[]>();

  /** Atividades visíveis (exclui ocultas) — base de toda derivação analítica. */
  readonly activities = computed(() => this._all().filter((a) => !a.hidden));
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

    const { data, error } = await supabase
      .from('activities')
      .select(SELECT)
      .eq('user_id', userId)
      .order('start_at', { ascending: false });

    if (error) {
      this._error.set(error.message);
      this._state.set('error');
      return;
    }

    this._all.set(((data ?? []) as unknown as DbActivityRow[]).map(mapRow));
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
    const editedAt = new Date().toISOString();
    const dbPatch: Record<string, unknown> = { locally_edited: true, edited_at: editedAt };
    if (patch.activityName !== undefined) dbPatch['activity_name'] = patch.activityName;
    if (patch.durationS !== undefined) dbPatch['duration_s'] = patch.durationS;

    const { error } = await supabase.from('activities').update(dbPatch).eq('id', id);
    if (error) throw new Error(error.message);

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
   * Carrega a rota GPS (lista de pontos) de uma atividade outdoor sob demanda.
   * Resultado fica em cache; retorna `[]` quando a atividade não tem rota.
   */
  async loadRoute(activityId: string): Promise<ActivityRoutePoint[]> {
    const cached = this._routes.get(activityId);
    if (cached) return cached;

    const { data, error } = await supabase
      .from('activity_routes')
      .select('points')
      .eq('activity_id', activityId)
      .maybeSingle();

    if (error) throw new Error(error.message);

    const points = ((data?.points ?? []) as ActivityRoutePoint[]).filter(
      (p) => typeof p?.lat === 'number' && typeof p?.lng === 'number',
    );
    this._routes.set(activityId, points);
    return points;
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
    distanceM: r.distance_m ?? undefined,
    sourceName: r.source_name ?? undefined,
    tracked: r.tracked ?? undefined,
    hasRoute: r.has_route ?? false,
    locallyEdited: r.locally_edited ?? false,
    editedAt: r.edited_at ?? undefined,
    hidden: r.hidden ?? false,
  };
}
