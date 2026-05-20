# Data Model: Histórico de Treinos (web)

> Esta feature **reusa** o schema do sync ([data-model do sync](../sync-atividades/data-model.md)). Aqui só (1) o delta de schema para a edição "travar do sync" e (2) os tipos/derivações de leitura da web.

## 1. Delta de schema: edição manual

Adicionar duas colunas a `public.activities` (migration nova em `supabase/migrations/<timestamp>_activities_locally_edited.sql`):

```sql
alter table public.activities
  add column locally_edited boolean not null default false,
  add column edited_at      timestamptz,
  add column hidden         boolean not null default false;

-- listar/filtrar rapidamente as travadas no sync e na UI
create index activities_user_edited_idx
  on public.activities (user_id, locally_edited);

-- leitura analítica exclui ocultas; índice parcial mantém o scan barato
create index activities_user_visible_idx
  on public.activities (user_id, start_at desc) where not hidden;
```

| Coluna | Tipo | Uso |
|--------|------|-----|
| `locally_edited` | `boolean` (default `false`) | `true` quando a web editou a linha; o sync deixa de sobrescrevê-la |
| `edited_at` | `timestamptz` | Carimbo da última edição manual (para UI "editado em…") |
| `hidden` | `boolean` (default `false`) | `true` quando uma linha editada foi apagada no HealthKit — preservada, mas fora de métricas/listas (habilita multi-source futuro) |

> RLS: as policies existentes (`for all using (auth.uid() = user_id)`) já cobrem `update` da própria linha. Nada novo de RLS.

## 2. Conflito condicional do sync (preferido)

Para o sync mobile não sobrescrever linhas travadas, substituir o `upsert` direto por uma função que adiciona `WHERE NOT locally_edited` na ação de conflito:

```sql
create or replace function public.sync_upsert_activities(rows jsonb)
returns void language sql security invoker as $$
  insert into public.activities (
    id, user_id, activity_id, activity_name, calories,
    start_at, end_at, duration_s, distance_m, source_name,
    source_id, device, tracked, has_route, metadata
  )
  select
    r->>'id', (r->>'user_id')::uuid, (r->>'activity_id')::int, r->>'activity_name',
    coalesce((r->>'calories')::int, 0), (r->>'start_at')::timestamptz, (r->>'end_at')::timestamptz,
    coalesce((r->>'duration_s')::int, 0), nullif(r->>'distance_m','')::numeric, r->>'source_name',
    r->>'source_id', r->>'device', (r->>'tracked')::boolean,
    coalesce((r->>'has_route')::boolean, false), r->'metadata'
  from jsonb_array_elements(rows) as r
  on conflict (id) do update set
    activity_id   = excluded.activity_id,
    activity_name = excluded.activity_name,
    calories      = excluded.calories,
    start_at      = excluded.start_at,
    end_at        = excluded.end_at,
    duration_s    = excluded.duration_s,
    distance_m    = excluded.distance_m,
    source_name   = excluded.source_name,
    source_id     = excluded.source_id,
    device        = excluded.device,
    tracked       = excluded.tracked,
    has_route     = excluded.has_route,
    metadata      = excluded.metadata
  where not activities.locally_edited;   -- ← não toca linhas editadas na web
$$;
```

> O `security invoker` mantém o RLS do chamador (cada usuário só insere/atualiza o que é seu). O mobile chama `supabase.rpc('sync_upsert_activities', { rows })` no lugar do `upsert` de [activity-sync.ts:60](../../../mobile/src/services/activity-sync.ts#L60).
>
> **Alternativa simples (sem RPC):** o mobile faz `select id from activities where user_id = uid and locally_edited = true` e remove esses ids dos lotes antes do `upsert` atual. Mantém o `upsert` existente, com pequena janela de corrida.

**Delta de delete:** no `syncDelta`, para ids deletados no HealthKit:
- se `locally_edited` → **`update activities set hidden = true where id = ...`** (não apaga; preserva a edição e o histórico, habilita multi-source futuro);
- senão → `delete` normal (a rota cai por cascade).

## 3. Tipos lidos pela web

A web reusa a interface `Activity` de `@vitale/shared` ([models/index.ts](../../../packages/shared/src/models/index.ts)), acrescida (no payload do select) dos campos novos:

```ts
// projeção lida no web (campos de activities relevantes à página)
interface ActivityRow {
  id: string;
  activityId: number;       // activity_id
  activityName?: string;    // activity_name
  calories: number;
  startAt: string;          // start_at (ISO)
  endAt: string;            // end_at
  durationS: number;        // duration_s
  distanceM?: number;       // distance_m (null = sem distância)
  sourceName?: string;      // source_name
  tracked?: boolean;
  hasRoute: boolean;        // has_route
  locallyEdited: boolean;   // (novo) locally_edited
  editedAt?: string;        // (novo) edited_at
  hidden: boolean;          // (novo) hidden — excluído de métricas/listas por padrão
}
```

> Adicionar `locallyEdited`/`editedAt`/`hidden` à interface `Activity` do shared é opcional (são metadados de UI). Se adicionados, mantê-los **somente como campos**, sem lógica (regra do `packages/shared`).

## 4. Metadados de tipo (exibição, web)

Não é tabela — é constante de exibição em `web/src/app/core/models/activity-types.ts`, espelhando `getActivityMeta`/`GPS_ACTIVITY_IDS` de [workout-types.ts](../../../mobile/src/lib/workout-types.ts):

```ts
interface TypeMeta {
  activityId: number;   // código HK
  label: string;        // ex.: "Corrida"  (mesma string do mobile)
  slug: string;         // ex.: "corrida"  (para a rota /historico-treinos/:slug)
  icon: string;         // nome do ícone do IconComponent web
  color: string;        // token do design system (MOD/accents)
  hasDistance: boolean; // outdoor com distância (GPS_ACTIVITY_IDS) → mostra distância no card
}
```

| `activityId` | label | slug | tem distância |
|------|-------|------|---------------|
| 13 | Ciclismo | ciclismo | sim |
| 24 | Trilha | trilha | sim |
| 37 | Corrida | corrida | sim |
| 52 | Caminhada | caminhada | sim |
| 50 | Musculação | musculacao | não (métrica adaptada: duração/calorias) |
| … | … | … | … |
| default | Treino | treino | não |

> `GPS_ACTIVITY_IDS = {13, 24, 37, 52}` define `hasDistance`. Demais tipos usam métrica adaptada no card (default: duração total).

## 5. Derivações de leitura (sem persistência)

Computadas no cliente sobre `signal<ActivityRow[]>` — nenhuma tabela nova. **Todas excluem `hidden === true`** (filtro opcional "ver ocultas" pode reexpô-las):

- **Overview(period, metric):** filtra pela **janela móvel** do período (Semana = 7 dias até hoje; Ano = 12 meses até o mês atual; Sempre = tudo) → agrupa por `(bucket, typeLabel)` → soma a métrica → série empilhada + `totals { count, distanceM, durationS, calories }`.
- **TypeSummary[] (de sempre):** agrupa por `typeLabel` → `{ count, distanceM, durationS, calories }` por tipo, ignorando o filtro de período.
- **ListByType(slug, filters, page):** filtra por label do slug + filtros (datas, faixa de distância/duração, fonte, `has_route`), ordena por `start_at desc`, pagina em memória.

## 6. Migration (ordem)

Arquivo `supabase/migrations/<timestamp>_activities_locally_edited.sql`:
1. `alter table activities add column locally_edited, edited_at, hidden`
2. `create index activities_user_edited_idx` + `activities_user_visible_idx`
3. `create function sync_upsert_activities` (se adotada a opção RPC do §2)
