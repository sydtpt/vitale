-- Vitale — User Settings (perfil + preferências)
-- Spec: .claude/specs/settings/
-- Uma linha por usuário em cada tabela; upsert por id.

-- ─────────────────────────────────────────────────────────────
-- user_profiles — identidade visível ao usuário
-- ─────────────────────────────────────────────────────────────
create table if not exists public.user_profiles (
  id           uuid        primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url   text,
  updated_at   timestamptz not null default now()
);

drop trigger if exists user_profiles_touch on public.user_profiles;
create trigger user_profiles_touch before update on public.user_profiles
  for each row execute function public.touch_updated_at();

alter table public.user_profiles enable row level security;

create policy "own profile" on public.user_profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- ─────────────────────────────────────────────────────────────
-- user_preferences — configurações do app; uma linha por usuário
-- ─────────────────────────────────────────────────────────────
create table if not exists public.user_preferences (
  id                      uuid        primary key references auth.users(id) on delete cascade,
  theme                   text        not null default 'system'
                            check (theme in ('system','light','dark')),
  glass_enabled           boolean     not null default false,
  language                text        not null default 'pt-BR',
  notifications_enabled   boolean     not null default true,
  daily_reminder_time     time,
  nutrition_calories_goal int         check (nutrition_calories_goal > 0),
  nutrition_protein_g     int         check (nutrition_protein_g >= 0),
  nutrition_carbs_g       int         check (nutrition_carbs_g >= 0),
  nutrition_fat_g         int         check (nutrition_fat_g >= 0),
  training_days_per_week  int         check (training_days_per_week between 1 and 7),
  updated_at              timestamptz not null default now()
);

drop trigger if exists user_preferences_touch on public.user_preferences;
create trigger user_preferences_touch before update on public.user_preferences
  for each row execute function public.touch_updated_at();

alter table public.user_preferences enable row level security;

create policy "own preferences" on public.user_preferences
  for all using (auth.uid() = id) with check (auth.uid() = id);
