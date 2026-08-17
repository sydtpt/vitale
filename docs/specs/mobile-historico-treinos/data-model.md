# Data Model: Histórico de Treinos (mobile)

> Esta feature **reusa** o schema do sync e o delta de schema do web ([data-model web](../historico-treinos/data-model.md)). As colunas `locally_edited`, `edited_at` e `hidden` já devem existir (criadas na migration do web — T001 de [tasks web](../../../_bmad-output/implementation-artifacts/historico-treinos/tasks.md)).  
> Aqui estão os **tipos e interfaces mobile** e as derivações de leitura.

---

## 1. Pré-requisito de schema

As colunas abaixo **já devem estar na tabela** `public.activities` (criadas pelo web):

| Coluna | Tipo | Uso |
|--------|------|-----|
| `locally_edited` | `boolean` (default `false`) | `true` quando editado manualmente; sync não sobrescreve |
| `edited_at` | `timestamptz` | Carimbo da última edição manual |
| `hidden` | `boolean` (default `false`) | `true` = excluída de métricas/listas, mas preservada |

Se a migration web **não foi aplicada**, aplicar antes de implementar esta feature:

```sql
-- supabase/migrations/<ts>_activities_locally_edited.sql
alter table public.activities
  add column locally_edited boolean not null default false,
  add column edited_at      timestamptz,
  add column hidden         boolean not null default false;

create index activities_user_edited_idx
  on public.activities (user_id, locally_edited);

create index activities_user_visible_idx
  on public.activities (user_id, start_at desc) where not hidden;
```

---

## 2. Tipo `Activity` no mobile

Novo tipo usado pelo `activities.store.ts` (leitura do Supabase, não confundir com `WorkoutItem` do HealthKit):

```typescript
// mobile/src/store/activities.store.ts (ou mobile/src/lib/activity-types.ts)
export interface Activity {
  id: string;
  activityId: number;        // activity_id (código HealthKit)
  activityName: string | null;
  calories: number;
  startAt: string;           // ISO 8601
  endAt: string;
  durationS: number;         // segundos
  distanceM: number | null;  // metros; null = sem distância
  sourceName: string | null;
  tracked: boolean | null;
  hasRoute: boolean;
  locallyEdited: boolean;    // locally_edited
  editedAt: string | null;   // edited_at
  hidden: boolean;
}
```

> Esta interface é **separada** de `WorkoutItem` (HealthKit) e de `ActivityRow` (activity-map.ts, mapeamento HealthKit→Supabase). Os três são modelos de domínios distintos.

---

## 3. Atualização do `ActivityRow` em `activity-map.ts`

O tipo `ActivityRow` em `mobile/src/lib/activity-map.ts` representa a linha Supabase **para fins de sync** (escrita do HealthKit). Adicionar as novas colunas para que o mobile possa checar `locally_edited` antes do upsert (se adotar a alternativa simples ao RPC):

```typescript
// Adicionar a ActivityRow:
locally_edited: boolean;
edited_at: string | null;
hidden: boolean;
```

> Se o projeto usar a opção **RPC `sync_upsert_activities`** (preferida), o mobile não precisa checar `locally_edited` antes do upsert — o Postgres garante atomicamente. Nesse caso, a adição é opcional mas documentada para consistência.

---

## 4. Interface do store `useActivitiesStore`

```typescript
// mobile/src/store/activities.store.ts

interface ActivitiesState {
  // Estado
  _all: Activity[];                          // Dataset completo (inclui hidden)
  loading: boolean;
  error: string | null;
  routes: Record<string, ActivityRoutePoint[]>; // cache de rotas GPS

  // Getters derivados (Zustand computed via get())
  activities: Activity[];                    // exclui hidden === true
  isEmpty: boolean;

  // Ações
  load: (force?: boolean) => Promise<void>;
  findById: (id: string) => Activity | undefined;
  updateActivity: (id: string, patch: ActivityPatch) => Promise<void>;
  setHidden: (id: string, hidden: boolean) => Promise<void>;
  loadRoute: (activityId: string) => Promise<void>;
}

interface ActivityPatch {
  activityName?: string;
  durationS?: number;
}
```

**SQL de leitura:**
```sql
select id, activity_id, activity_name, calories,
       start_at, end_at, duration_s, distance_m,
       source_name, tracked, has_route,
       locally_edited, edited_at, hidden
  from activities
 where user_id = auth.uid()
 order by start_at desc;
```

**SQL de edição:**
```sql
update activities
   set activity_name  = :name,          -- se fornecido
       duration_s     = :durationS,     -- se fornecido (e sem GPS)
       locally_edited = true,
       edited_at      = now()
 where id = :id;                        -- RLS garante user_id
```

**SQL de toggle hidden:**
```sql
update activities
   set hidden = :hidden
 where id = :id;
```

---

## 5. Derivações de leitura (sem persistência)

Todas excluem `hidden === true`. Portadas do web:

### `buildOverview(activities, period, metric, now)`

```typescript
// mobile/src/lib/activity-overview.ts
type Period = 'semana' | 'ano' | 'sempre';
type Metric = 'distance' | 'duration' | 'calories' | 'count';

interface Bucket {
  label: string;           // ex.: "Seg", "Jan", "2024"
  date: string;            // ISO date do início do bucket
  segments: Segment[];     // um por tipo presente
}

interface Segment {
  typeLabel: string;
  value: number;           // na métrica selecionada
  color: string;           // MOD.treino.accent ou cor derivada
}

interface OverviewResult {
  buckets: Bucket[];
  totals: { count: number; distanceM: number; durationS: number; calories: number };
}
```

**Bucketing (janelas móveis):**
- `'semana'` → 7 dias: hoje + os 6 anteriores. Bucket = 1 dia.
- `'ano'` → 12 meses: mês atual + os 11 anteriores. Bucket = 1 mês.
- `'sempre'` → todo o histórico. Bucket = 1 ano.

### `buildTypeSummaries(activities)`

```typescript
// mobile/src/lib/activity-type-summary.ts
interface TypeSummary {
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  count: number;
  totalDistanceM: number;   // 0 para tipos sem distância
  totalDurationS: number;
  totalCalories: number;
  hasDistance: boolean;     // GPS_ACTIVITY_IDS.has(activityId) de alguma atividade do tipo
}
```

Agrupa **todo o histórico** por `getActivityMeta(activityId).label`.

### `applyFilters(activities, filters)` + paginação

```typescript
// mobile/src/lib/activity-list-filter.ts
interface ActivityFilters {
  fromDate?: string;        // YYYY-MM-DD
  toDate?: string;
  minDistanceM?: number;
  maxDistanceM?: number;
  minDurationS?: number;
  maxDurationS?: number;
  sourceName?: string;
  hasRoute?: boolean;
}
```

Retorna `Activity[]` filtrado e ordenado por `startAt desc`. Paginação feita no componente via `slice(0, visible)` + load-more (mesmo padrão do `/fitness/[label].tsx` atual).

---

## 6. Metadados de tipo

Reutilizar **sem modificação** as funções existentes:
- `getActivityMeta(activityId)` → `{ icon, label }` — `mobile/src/lib/workout-types.ts`
- `hasGpsRoute(activityId)` → `boolean` — `mobile/src/lib/workout-types.ts`
- `GPS_ACTIVITY_IDS` → `Set<number>` — `mobile/src/lib/workout-types.ts`

Para cores do gráfico, usar `MOD` de `mobile/src/theme` (mesmo padrão do resto do mobile).

---

## 7. Rota de cache de rota GPS

Reutilizar o mesmo mecanismo do `fitness.store.ts`:

```typescript
// loadRoute(activityId) — busca de activity_routes
const { data } = await supabase
  .from('activity_routes')
  .select('points')
  .eq('activity_id', activityId)
  .single();
// Armazena em routes[activityId]: ActivityRoutePoint[]
```

O componente `WorkoutMap` existente (`mobile/src/components/WorkoutMap.tsx`) já consume `ActivityRoutePoint[]` — reutilizar sem alteração.
