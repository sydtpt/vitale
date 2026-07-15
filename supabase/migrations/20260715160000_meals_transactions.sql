-- Vitale — Refeições (meals) + Transações financeiras (transactions)
-- 1ª fatia de backend de Alimentação e Finanças, alimentada pela captura rápida
-- (QuickAddSheet no mobile). Sem recorrência: cada linha é um registro pontual.
-- RLS por usuário, no mesmo padrão de registros/daily_ratings.

-- ─────────────────────────────────────────────────────────────
-- meals — refeição logada num dia (o que comeu + macros opcionais)
-- O sheet grava nome + tipo + kcal; macros ficam para a página Alimentação.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.meals (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  meal_date  date        not null,                  -- data LOCAL do dispositivo
  meal_type  text        not null default 'outro'
               check (meal_type in ('cafe','almoco','lanche','jantar','outro')),
  name       text        not null,                  -- "o que você comeu"
  kcal       int,                                   -- opcional
  protein    numeric,                               -- macros opcionais (g)
  carbs      numeric,
  fat        numeric,
  logged_at  timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists meals_user_date_idx on public.meals (user_id, meal_date desc);

-- ─────────────────────────────────────────────────────────────
-- transactions — despesa lançada (valor em reais, categoria livre)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.transactions (
  id          uuid          primary key default gen_random_uuid(),
  user_id     uuid          not null references auth.users(id) on delete cascade,
  tx_date     date          not null,               -- data LOCAL do dispositivo
  description text          not null,
  category    text,
  amount      numeric(12,2) not null check (amount > 0),   -- em reais
  created_at  timestamptz   not null default now(),
  updated_at  timestamptz   not null default now()
);

create index if not exists transactions_user_date_idx on public.transactions (user_id, tx_date desc);

-- touch updated_at (função já criada por migrations anteriores; recriar é idempotente)
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists meals_touch on public.meals;
create trigger meals_touch before update on public.meals
  for each row execute function public.touch_updated_at();

drop trigger if exists transactions_touch on public.transactions;
create trigger transactions_touch before update on public.transactions
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Row-Level Security: cada usuário só acessa as próprias linhas
-- ─────────────────────────────────────────────────────────────
alter table public.meals        enable row level security;
alter table public.transactions enable row level security;

create policy "own meals" on public.meals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own transactions" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
