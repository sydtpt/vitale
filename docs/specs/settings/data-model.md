# Data Model: Settings — perfil e preferências do usuário

> Perfil e preferências de app do usuário. Duas tabelas leves (uma linha por usuário), sem lógica de negócio.

## 1. Tabelas (migration `supabase/migrations/20260528120000_user_settings.sql`)

```sql
-- Vitale — User Settings (perfil + preferências)
-- Spec: docs/specs/settings/
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
  language                text        not null default 'pt-BR',
  notifications_enabled   boolean     not null default true,
  daily_reminder_time     time,                          -- horário local para lembrete diário
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
```

| Coluna `user_preferences` | Tipo | Uso |
|---|---|---|
| `theme` | `text` | `system` (default) \| `light` \| `dark` |
| `daily_reminder_time` | `time` | Horário do lembrete diário; `null` = desativado |
| `nutrition_*` | `int?` | Metas de macros; `null` = não definido |
| `training_days_per_week` | `int?` | Dias de treino por semana; `null` = não definido |

## 2. Padrão de escrita (upsert)

Ambas as tabelas usam **upsert** — não há insert/update separados. O cliente envia sempre o estado completo da linha:

```ts
await supabase
  .from('user_preferences')
  .upsert({ id: userId, ...patch })
  .eq('id', userId);
```

`id` é a PK e referencia `auth.users`, então cada usuário tem exatamente uma linha.

## 3. Tipos no shared (`packages/shared/src/models/index.ts`)

```ts
export interface UserProfile {
  id: string;
  displayName?: string;
  avatarUrl?: string;
  updatedAt: string;
}

export type AppTheme = 'system' | 'light' | 'dark';

export interface UserPreferences {
  userId: string;
  theme: AppTheme;
  language: string;
  notificationsEnabled: boolean;
  dailyReminderTime?: string;         // 'HH:MM'
  nutritionCaloriesGoal?: number;
  nutritionProteinG?: number;
  nutritionCarbsG?: number;
  nutritionFatG?: number;
  trainingDaysPerWeek?: number;
  updatedAt: string;
}
```

## 4. Store mobile (`mobile/src/store/settings.store.ts`)

```ts
interface SettingsState {
  profile: UserProfile | null;
  preferences: UserPreferences | null;
  loading: boolean;
  loadSettings: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<UserProfile, 'displayName' | 'avatarUrl'>>) => Promise<void>;
  updatePreferences: (patch: Partial<Omit<UserPreferences, 'userId' | 'updatedAt'>>) => Promise<void>;
}
```

- `loadSettings`: busca `user_profiles` e `user_preferences` por `auth.uid()` em paralelo.
- `updateProfile` / `updatePreferences`: upsert otimista (aplica localmente antes de enviar).

## 5. Telas mobile (`mobile/src/app/configuracoes/`)

| Arquivo | Conteúdo |
|---|---|
| `_layout.tsx` | Stack com header "Configurações" e back button |
| `index.tsx` | Lista de seções: Conta, App, Dados, Sobre |
| `perfil.tsx` | Edita `display_name` e `avatar_url` |
| `app.tsx` | Alterna tema, ativa/desativa notificações, horário do lembrete |
| `objetivos.tsx` | Metas de calorias, proteína, carboidratos, gordura, dias de treino |
| `dados.tsx` | Exportar dados, fazer logout |
