# Data Model: Sincronização de Atividades

> Schema Postgres (Supabase) para [plan.md](./plan.md). Versionar como migration em `supabase/migrations/`.

## Visão geral

```
auth.users (Supabase)
   │ 1
   │
   ├──< activities             (PK id = UUID HealthKit)
   │        │ 1
   │        └──1 activity_routes      (PK/FK activity_id, ON DELETE CASCADE)
   │
   ├──< synced_activity_types  (PK user_id + type_key)  ← tipos opt-in
   │
   └──< sync_state             (PK user_id + device_id)
```

## Tabela `activities`

A chave primária é o **ID do treino no HealthKit** (UUID em texto) — garante idempotência (`upsert onConflict: id`). Usamos `text` (não `uuid`) para acomodar a chave determinística de fallback quando o HealthKit não fornece UUID (ver [spec.md](./spec.md) §9).

```sql
create table public.activities (
  id              text        primary key,                      -- ID do HealthKit (ou chave derivada)
  user_id         uuid        not null references auth.users(id) on delete cascade,
  activity_id     int         not null,                         -- código HK (37=corrida, 50=musculação...)
  activity_name   text,                                         -- nome cru do HealthKit
  calories        int         not null default 0,
  start_at        timestamptz not null,
  end_at          timestamptz not null,
  duration_s      int         not null default 0,               -- segundos
  distance_m      numeric,                                      -- metros (null = indoor/sem distância)
  source_name     text,
  source_id       text,
  device          text,
  tracked         boolean,
  has_route       boolean     not null default false,           -- atalho p/ saber se há rota
  metadata        jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index activities_user_start_idx on public.activities (user_id, start_at desc);
create index activities_user_type_idx  on public.activities (user_id, activity_id);
```

> `start_at desc` cobre a listagem cronológica (web e mobile). `activity_id` cobre o agrupamento por tipo da aba Fitness.

### Trigger de `updated_at`

```sql
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger activities_touch
  before update on public.activities
  for each row execute function public.touch_updated_at();
```

## Tabela `activity_routes`

Separada de `activities` para manter a listagem leve — rotas podem ter milhares de pontos.

```sql
create table public.activity_routes (
  activity_id  text        primary key references public.activities(id) on delete cascade,
  user_id      uuid        not null references auth.users(id) on delete cascade,
  points       jsonb       not null,        -- [{ lat, lng, alt? }, ...]
  point_count  int         not null default 0,
  created_at   timestamptz not null default now()
);
```

> `points` como `jsonb` no MVP (simples, sem PostGIS). Se a leitura web exigir geo-queries, migrar para `geography(LineString)` depois. `user_id` redundante para simplificar a policy de RLS.

## Tabela `synced_activity_types`

Os tipos de treino que o usuário optou por sincronizar (FR-004/FR-006). Fonte da verdade da inscrição; o device cacheia localmente para offline/background.

```sql
create table public.synced_activity_types (
  user_id      uuid        not null references auth.users(id) on delete cascade,
  type_key     text        not null,        -- chave do tipo = label de getActivityMeta (ex.: "Corrida")
  created_at   timestamptz not null default now(),
  primary key (user_id, type_key)
);
```

> `type_key` é o rótulo agrupado na UI. Ver [NEEDS CLARIFICATION] na spec sobre usar um slug estável em vez do label de exibição. `syncDelta` filtra `added[]` por pertencer a este conjunto.

## Tabela `sync_state`

Suporta o sync incremental (FR-003). A âncora do HealthKit também é guardada **localmente** no device; esta tabela dá visibilidade server-side e multi-dispositivo.

```sql
create table public.sync_state (
  user_id        uuid        not null references auth.users(id) on delete cascade,
  device_id      text        not null,         -- identificador estável do device
  last_synced_at timestamptz,
  anchor         text,                          -- âncora opaca do HealthKit (se persistida no servidor)
  primary key (user_id, device_id)
);
```

## Row-Level Security (FR-008, SC-006)

```sql
alter table public.activities            enable row level security;
alter table public.activity_routes       enable row level security;
alter table public.synced_activity_types enable row level security;
alter table public.sync_state            enable row level security;

-- activities: dono total sobre as próprias linhas
create policy "own activities" on public.activities
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- activity_routes: idem
create policy "own routes" on public.activity_routes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- synced_activity_types: idem
create policy "own synced types" on public.synced_activity_types
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- sync_state: idem
create policy "own sync_state" on public.sync_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

## Mapeamento `WorkoutItem` → `activities`

Referência: `mobile/src/store/fitness.store.ts` (`WorkoutItem`).

| `WorkoutItem` | Coluna | Observação |
|---------------|--------|------------|
| `id` | `id` | **UUID do HealthKit** — se ausente, derivar/descartar (ver risco no plan) |
| — | `user_id` | `session.user.id` |
| `activityId` | `activity_id` | |
| `activityName` | `activity_name` | |
| `calories` | `calories` | já arredondado |
| `start` | `start_at` | ISO → timestamptz |
| `end` | `end_at` | ISO → timestamptz |
| `duration` | `duration_s` | segundos |
| `distance` | `distance_m` | opcional |
| `sourceName` | `source_name` | |
| `sourceId` | `source_id` | |
| `device` | `device` | |
| `tracked` | `tracked` | |
| `hasGpsRoute(activityId)` | `has_route` | derivado |
| `metadata` | `metadata` | jsonb |
| `workoutEventsCount` | `metadata.workoutEventsCount` | dobrar em metadata |

## Tipos no `packages/shared` (read-only)

```ts
// packages/shared/src/models/index.ts  — apenas interfaces, sem lógica
export interface Activity {
  id: string;
  userId: string;
  activityId: number;
  activityName?: string;
  calories: number;
  startAt: string;
  endAt: string;
  durationS: number;
  distanceM?: number;
  sourceName?: string;
  sourceId?: string;
  device?: string;
  tracked?: boolean;
  hasRoute: boolean;
  metadata?: Record<string, unknown>;
}

export interface ActivityRoutePoint { lat: number; lng: number; alt?: number; }
export interface ActivityRoute {
  activityId: string;
  points: ActivityRoutePoint[];
  pointCount: number;
}
```

## Migration

Arquivo: `supabase/migrations/<timestamp>_activities.sql` contendo, nesta ordem:
1. `activities` + índices + trigger `updated_at`
2. `activity_routes`
3. `synced_activity_types`
4. `sync_state`
5. `enable row level security` + policies das quatro tabelas
