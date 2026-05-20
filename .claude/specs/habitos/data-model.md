# Data Model: Habitos — contadores diários

> Esquema novo (não reusa `activities`). Segue o padrão de RLS/`touch_updated_at` de [activities](../../../supabase/migrations/20260520120000_activities.sql).

## 1. Tabelas (migration nova)

Arquivo `supabase/migrations/<timestamp>_habitos.sql`:

```sql
-- Vitale — Habitos (contadores diários)
-- Spec: .claude/specs/habitos/
-- Só contadores; direção at_least/at_most; reset diário por data local. RLS por usuário.

-- ─────────────────────────────────────────────────────────────
-- habits — definição do hábito contador
-- ─────────────────────────────────────────────────────────────
create table if not exists public.habits (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  name       text        not null,
  icon       text,                                   -- nome do ícone (IconComponent web / MCIcons mobile)
  color      text,                                   -- token do design system (MOD/accents)
  unit       text        not null,                   -- 'L', 'ml', 'un', 'cig'...
  step       numeric(8,3) not null check (step > 0), -- incremento por toque, na unidade
  target     numeric(8,3) check (target is null or target >= 0), -- meta/teto (null = sem meta)
  direction  text        not null default 'at_least'
               check (direction in ('at_least','at_most')),
  active     boolean     not null default true,
  sort       int         not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists habits_user_active_idx on public.habits (user_id, active, sort);

-- ─────────────────────────────────────────────────────────────
-- habit_logs — valor acumulado por hábito por dia
-- 1 linha por (habit_id, log_date); ausência de linha ⇒ valor 0 (reset diário)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.habit_logs (
  id         uuid        primary key default gen_random_uuid(),
  habit_id   uuid        not null references public.habits(id) on delete cascade,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  log_date   date        not null,                   -- data LOCAL do dispositivo
  value      numeric(10,3) not null default 0 check (value >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (habit_id, log_date)                        -- idempotência do reset/incremento
);

create index if not exists habit_logs_user_date_idx on public.habit_logs (user_id, log_date desc);
create index if not exists habit_logs_habit_date_idx on public.habit_logs (habit_id, log_date desc);

-- touch updated_at (reusa a função criada pela migration de activities, se existir)
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists habits_touch on public.habits;
create trigger habits_touch before update on public.habits
  for each row execute function public.touch_updated_at();

drop trigger if exists habit_logs_touch on public.habit_logs;
create trigger habit_logs_touch before update on public.habit_logs
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Row-Level Security
-- ─────────────────────────────────────────────────────────────
alter table public.habits     enable row level security;
alter table public.habit_logs enable row level security;

create policy "own habits" on public.habits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own habit_logs" on public.habit_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

| Coluna `habits` | Tipo | Uso |
|---|---|---|
| `unit` | `text` | Unidade de exibição (L, un, cig…) |
| `step` | `numeric(8,3)` | Quanto o `＋`/`−` soma/subtrai (> 0) |
| `target` | `numeric(8,3)?` | Meta (`at_least`) ou teto (`at_most`); `null` = contador puro |
| `direction` | `text` | `at_least` (atingir) \| `at_most` (não passar) |
| `active` | `boolean` | `false` = arquivado (some da captura, mantém histórico) |
| `sort` | `int` | Ordem na captura |

## 2. Incremento atômico (preferido)

Para `＋`/`−` somarem ao valor do dia mesmo com toques concorrentes/offline, usar **upsert que soma** em vez de ler-e-gravar:

```sql
create or replace function public.habit_log_add(p_habit uuid, p_date date, p_delta numeric)
returns numeric language sql security invoker as $$
  insert into public.habit_logs (habit_id, user_id, log_date, value)
  select p_habit, h.user_id, p_date, greatest(0, p_delta)
    from public.habits h where h.id = p_habit
  on conflict (habit_id, log_date) do update
    set value = greatest(0, public.habit_logs.value + p_delta)
  returning value;
$$;
```

> `security invoker` mantém o RLS do chamador (cada usuário só mexe no que é seu; o `select` de `habits` também é filtrado por RLS). O mobile/web chamam `rpc('habit_log_add', { p_habit, p_date, p_delta })` — `p_delta = +step` no `＋`, `-step` no `−`. O piso em 0 é garantido por `greatest(0, …)`.
>
> **Alternativa simples (sem RPC):** `upsert` em `habit_logs` por `(habit_id, log_date)` com `value` já calculado no cliente. Mantém o caminho simples, com pequena janela de corrida em toques concorrentes (aceitável para um usuário).

**Zerar o dia (FR-008):** `update habit_logs set value = 0 where habit_id = :id and log_date = :today` (ou delete da linha do dia).

## 3. Tipos no shared

A interface `Habit` de [@vitale/shared](../../../packages/shared/src/models/index.ts#L16-L22) é o hábito **binário** atual (`done`/`streak`) e **não muda**. Adicionar tipos novos (só campos, sem lógica — regra do `packages/shared`):

```ts
export type HabitDirection = 'at_least' | 'at_most';

/** Hábito contador (quantitativo). Distinto do `Habit` binário. */
export interface CounterHabit {
  id: string;
  name: string;
  icon: string;
  color: string;
  unit: string;          // 'L' | 'un' | ...
  step: number;          // incremento por toque
  target?: number;       // meta (at_least) / teto (at_most); ausente = sem meta
  direction: HabitDirection;
  bad: boolean;          // hábito a evitar: exibe dias SEM fazer no lugar da sequência
  active: boolean;
  sort: number;
  createdAt: string;     // ISO; limita a contagem de "dias sem fazer" à idade do hábito
}

/** Valor acumulado de um CounterHabit num dia (1 por habit/dia). */
export interface HabitLog {
  id: string;
  habitId: string;
  logDate: string;       // 'YYYY-MM-DD' (data local)
  value: number;
}
```

> Naming: `CounterHabit`/`HabitLog` evita colisão com o `Habit` binário existente (usado em `DayData.habits`). Se um dia unificarmos (backlog), introduzir `kind` e migrar.

## 4. Derivações (sem persistência)

Computadas no cliente sobre os logs carregados — nenhuma coluna derivada no banco:

- **valueToday(habit):** `value` da linha de `habit_logs` com `log_date = hoje` (local), ou 0.
- **isMet(habit, value):** `at_least` → `target != null && value >= target`; `at_most` → `target == null ? false : value <= target` (sem meta ⇒ sem estado de "batida").
- **isOver(habit, value):** `at_most && target != null && value > target` → alerta.
- **streak(habit):** dias consecutivos (até hoje) com `isMet = true`, varrendo `habit_logs` por `log_date` decrescente. Em `at_most`, um dia **sem linha** conta como 0 ⇒ dentro do teto (cumpre), o que torna o streak correto para "não fumei".
- **cleanStreak(habit):** para `bad = true` — dias consecutivos (terminando hoje) com `value = 0` ("há quantos dias sem fazer"). Hoje conta; se já fez hoje (`value > 0`), volta a 0. Limitado a `daysInclusive(createdAt, hoje)` para não exibir mais dias do que o hábito existe.
- **average(habit, period):** média de `value` por dia no período (web).
- **heatmap(habit, days):** série dos últimos N dias com `value` e flag `isMet` por dia.

## 5. Migration (ordem)

Arquivo `supabase/migrations/<timestamp>_habitos.sql`:
1. `create table habits` + índice.
2. `create table habit_logs` (unique `(habit_id, log_date)`) + índices.
3. Triggers `touch_updated_at`.
4. `enable row level security` + policies `own habits` / `own habit_logs`.
5. (Se adotada) função `habit_log_add` (§2).
