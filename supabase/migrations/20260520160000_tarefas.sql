-- Vitale — Tarefas (to-do com agendamento)
-- Spec: .claude/specs/tarefas/
-- Série (todo_templates) gera ocorrências (todo_occurrences). RLS por usuário.

-- ─────────────────────────────────────────────────────────────
-- todo_templates — regra/série da tarefa (recorrente ou avulsa)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.todo_templates (
  id            uuid         primary key default gen_random_uuid(),
  user_id       uuid         not null references auth.users(id) on delete cascade,
  name          text         not null,
  icon          text,                                   -- nome do ícone (IconComponent web / Ionicons mobile)
  color         text,                                   -- token do design system (MOD)
  module        text         not null default 'geral'
                  check (module in ('financas','compras','casa','saude','geral')),
  recurrence    jsonb        not null,                  -- união discriminada por `kind`
  overdue       text         not null default 'carry'
                  check (overdue in ('carry','expire')),
  cancel_policy text         not null default 'manual'
                  check (cancel_policy in ('none','manual','auto')),
  meter              numeric(12,3),                     -- contador atual (recurrence.kind = 'usage')
  meter_at_last_done numeric(12,3),                     -- leitura na última conclusão
  active        boolean      not null default true,
  sort          int          not null default 0,
  created_at    timestamptz  not null default now(),
  updated_at    timestamptz  not null default now()
);

create index if not exists todo_templates_user_active_idx on public.todo_templates (user_id, active, sort);

-- ─────────────────────────────────────────────────────────────
-- todo_occurrences — item concreto na lista
-- ─────────────────────────────────────────────────────────────
create table if not exists public.todo_occurrences (
  id          uuid         primary key default gen_random_uuid(),
  template_id uuid         not null references public.todo_templates(id) on delete cascade,
  user_id     uuid         not null references auth.users(id) on delete cascade,
  due_date    date,                                     -- null = sem data (até concluir)
  status      text         not null default 'pending'
                check (status in ('pending','done','skipped','canceled','expired')),
  done_at     timestamptz,
  meta        jsonb,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now()
);

-- unicidade só quando há data: geração idempotente (evita ocorrência duplicada em multi-device)
create unique index if not exists todo_occ_template_due_uidx
  on public.todo_occurrences (template_id, due_date) where due_date is not null;
create index if not exists todo_occ_user_status_idx on public.todo_occurrences (user_id, status, due_date);
create index if not exists todo_occ_template_idx     on public.todo_occurrences (template_id, due_date desc);

-- touch updated_at (função já criada por migrations anteriores; recriar é idempotente)
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists todo_templates_touch on public.todo_templates;
create trigger todo_templates_touch before update on public.todo_templates
  for each row execute function public.touch_updated_at();

drop trigger if exists todo_occurrences_touch on public.todo_occurrences;
create trigger todo_occurrences_touch before update on public.todo_occurrences
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- todo_resolve — seta status + done_at de uma ocorrência (idempotente por id).
-- p_status ∈ done|skipped|canceled|expired. A geração da PRÓXIMA ocorrência é
-- feita no cliente (depende da recorrência). security invoker mantém o RLS.
-- ─────────────────────────────────────────────────────────────
create or replace function public.todo_resolve(p_occ uuid, p_status text, p_meta jsonb default null)
returns public.todo_occurrences language sql security invoker as $$
  update public.todo_occurrences
     set status  = p_status,
         done_at = case when p_status = 'done' then now() else done_at end,
         meta    = coalesce(p_meta, meta)
   where id = p_occ
  returning *;
$$;

-- ─────────────────────────────────────────────────────────────
-- Row-Level Security: cada usuário só acessa as próprias linhas
-- ─────────────────────────────────────────────────────────────
alter table public.todo_templates   enable row level security;
alter table public.todo_occurrences enable row level security;

create policy "own todo_templates" on public.todo_templates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own todo_occurrences" on public.todo_occurrences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
