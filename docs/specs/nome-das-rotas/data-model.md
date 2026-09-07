# Data Model: Nome das rotas — `places` + `activities.route_name`

> Uma tabela nova e **duas** colunas em `activities`. Nenhuma alteração em
> `activity_name`, por decisão — ver invariante 4 da
> [ADR 0041](../../decisions/0041-o-nome-da-rota-e-molde-com-lacuna.md).
> A tabela `places` copia o molde de vigência do
> [gear](../../../supabase/migrations/20260906120000_gear_bicicleta.sql)
> ([ADR 0034](../../decisions/0034-bicicleta-e-entidade-com-heranca-por-data.md)) — mesmo
> vocabulário (`active_from` / `active_to`), mesmo `touch_updated_at`, mesma RLS.
> Spec: [spec.md](spec.md).

## 1. `places` — a âncora com vigência

Arquivo a criar na Fase 2: `20260907170000_nome_das_rotas.sql`.

`kind` nasce com um valor só e um `check`, no mesmo espírito do `gear.kind`: documenta que o
próximo (trabalho, casa de férias) é migration, não improviso. A proposta de Presença/geofence,
hoje parada, é a segunda consumidora prevista desta tabela.

```sql
create table if not exists public.places (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  kind         text        not null default 'home',
  label        text,                                  -- "Casa"; NULL = ainda sem nome
  lat          numeric     not null,
  lng          numeric     not null,
  radius_m     int         not null default 400,      -- raio de pertencimento
  active_from  date        not null,                  -- primeiro dia de vigência
  active_to    date,                                  -- NULL = vigente hoje
  derived      boolean     not null default true,     -- false = o dono corrigiu à mão
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint places_kind          check (kind in ('home')),
  constraint places_window        check (active_to is null or active_to >= active_from),
  constraint places_radius        check (radius_m between 50 and 5000),
  constraint places_lat           check (lat between -90 and 90),
  constraint places_lng           check (lng between -180 and 180)
);

create index if not exists places_user_active_from_idx
  on public.places (user_id, kind, active_from);

drop trigger if exists places_touch on public.places;
create trigger places_touch
  before update on public.places
  for each row execute function public.touch_updated_at();

alter table public.places enable row level security;

drop policy if exists "own places" on public.places;
create policy "own places" on public.places
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

**Não há constraint de não-sobreposição.** O `gear` também não tem, e a herança por data
resolve o empate percorrendo em ordem de vigência. Repetir o padrão vale mais que a garantia
extra — e uma `exclude using gist` exigiria `btree_gist`, extensão que o projeto não usa.

### As duas linhas que o backfill vai criar

Derivadas do agrupamento dos pontos de partida das 138 rotas (spec §3):

| `lat`, `lng` | `active_from` | `active_to` |
|---|---|---|
| `50.852`, `4.344` | data da primeira pedalada | `2026-06-14` |
| `50.872`, `4.373` | `2026-06-15` | `null` |

O corte em 15/06 fica no vão entre a última partida do cluster antigo (07/06) e a primeira do
novo (21/06). Nenhuma pedalada cai na fronteira.

## 2. `activities` — duas colunas

```sql
alter table public.activities
  add column if not exists route_name      text,
  add column if not exists route_name_meta jsonb;

comment on column public.activities.route_name is
  'Nome derivado da rota (ADR 0041). NULL = ainda não nomeada OU deliberadamente sem nome
   (rota degenerada, verificação reprovada). Nunca sobrescreve activity_name.';

comment on column public.activities.route_name_meta is
  'Auditoria da derivação: {forma, regiao, artigo, lingua, justificativa[], provedor,
   modelo, versao_prompt, em}. Permite rerodar só o que mudou quando o prompt subir de versão.';
```

### Por que `route_name_meta`

Segue o precedente da narração, que grava `provedor` e `modelo` em cada edição
([ADR 0040](../../decisions/0040-o-provedor-de-modelo-e-configuracao-nao-arquitetura.md),
invariante 2). Sem isso, subir a versão do prompt obriga a renomear as 138 do zero; com isso,
o passe rerroda só as linhas cuja `versao_prompt` ficou para trás.

`forma` vai gravada mesmo sendo derivável do puro, porque é o que permite auditar um nome
estranho sem recalcular a rota inteira.

### O cursor do passe

```sql
create index if not exists activities_route_name_pending_idx
  on public.activities (user_id, start_at desc)
  where route_name is null and has_route and activity_id = 13;
```

Índice parcial, no molde do que o `enrichCities` usa: só as linhas que o passe ainda tem que
visitar entram nele.

> **Cuidado herdado do `cities`.** A RPC `sync_upsert_activities` (push do HealthKit)
> **não pode** referenciar `route_name` nem `route_name_meta` — senão todo re-push apaga o
> nome derivado. A migration de `cities`
> ([20260722120000](../../../supabase/migrations/20260722120000_activities_cities.sql))
> registra exatamente essa nota; aqui vale igual, e a Fase 2 tem uma tarefa só para conferir
> isso na função em produção.

## 3. Nulo tem dois significados — e isso é aceito

`route_name is null` quer dizer *"ainda não passou"* **ou** *"passou e decidiu não nomear"*.
Distinguir exigiria uma terceira coluna ou uma sentinela, e ambas custam mais do que resolvem:
o passe que revisita uma rota degenerada gasta uma leitura e desiste de novo, sem chamar o
modelo, porque o portão de degenerescência é puro e roda antes.

`route_name_meta` desempata quando alguém precisar saber: meta preenchida com `regiao: null`
é recusa registrada.

## 4. Leitura

Precedência única, implementada num helper do shared e usada nos quatro pontos de leitura
(spec §8):

```
name_edited ? activity_name : (route_name ?? activity_name ?? meta.label)
```

O `select` das três stores ganha as duas colunas:
[shared/data/activities.ts:26](../../../packages/shared/src/data/activities.ts#L26),
[web activities.store.ts:17](../../../web/src/app/features/workout-history/data/activities.store.ts#L17),
[mobile activities.store.ts:25](../../../mobile/src/store/activities.store.ts#L25).

## 5. Reversão

`route_name` é aditiva e ninguém depende dela para existir. `drop column` devolve o
comportamento de hoje na íntegra, porque `activity_name` nunca foi tocado — o principal
benefício da invariante 4 da ADR.
