-- Orbe — traz `public.profiles` para o versionamento
-- ADR: docs/decisions/0011-schema-mora-em-migrations.md
--
-- A tabela já EXISTE em produção desde antes das migrations e nunca foi
-- versionada. Esta migration não a cria de novo lá — reproduz o estado atual,
-- verificado em 2026-08-18 contra o projeto svyyuhxkblufhfvfvqte, para que um
-- ambiente novo (db reset, provisionamento) nasça igual.
--
-- Idempotente de propósito: em produção é no-op; em banco limpo, cria.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  birthdate date not null,
  avatar_url text,
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

-- Policies: cada usuário só enxerga e escreve o próprio perfil.
drop policy if exists "select own profile" on public.profiles;
create policy "select own profile" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "upsert own profile" on public.profiles;
create policy "upsert own profile" on public.profiles
  for insert with check (auth.uid() = id);

comment on table public.profiles is
  'Perfil do usuário (quem ele é): nome, nascimento e avatar. Configuração do app fica em user_preferences. Chaveada em auth.users.id.';

-- `user_profiles` (migration 20260528120000) duplica este conceito. Verificado em
-- 2026-08-18 via pg_stat_user_tables: n_tup_ins = 0 — nunca recebeu um insert,
-- não é "está vazia agora". Nenhum código a referencia desde a CAP-6.
--
-- Ainda assim NÃO é derrubada aqui: drop é irreversível, e o contador zera num
-- pg_stat_reset ou recuperação de crash — é evidência forte, não prova. O drop
-- é decisão do Syd, em migration própria.
comment on table public.user_profiles is
  'OBSOLETA — superada por public.profiles. Não escrever. Ver ADR 0011.';
