-- Vitale — Ratings subjetivos diários (sono percebido ao acordar + dia ao fim do dia)
-- Spec: plano "Ratings subjetivos diários".
-- Valor 100% subjetivo (1–5), NÃO derivado de outros dados. 1 linha por (user, dia);
-- sono e dia moram juntos, cada campo preenchido em momento diferente via upsert.
-- Reset diário por data local. RLS por usuário.

create table if not exists public.daily_ratings (
  user_id       uuid        not null references auth.users(id) on delete cascade,
  day           date        not null,                       -- data LOCAL do dispositivo
  sleep_quality smallint    check (sleep_quality between 1 and 5),  -- percepção ao acordar
  day_quality   smallint    check (day_quality between 1 and 5),    -- percepção ao fim do dia
  day_note      text,                                       -- anotação livre opcional do dia
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (user_id, day)
);

create index if not exists daily_ratings_user_day_idx on public.daily_ratings (user_id, day desc);

-- touch updated_at (função já criada por migrations anteriores; recriar é idempotente)
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists daily_ratings_touch on public.daily_ratings;
create trigger daily_ratings_touch before update on public.daily_ratings
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Row-Level Security: cada usuário só acessa as próprias linhas
-- ─────────────────────────────────────────────────────────────
alter table public.daily_ratings enable row level security;

create policy "own daily_ratings" on public.daily_ratings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
