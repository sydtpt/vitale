-- Vitale — Tarefas: 1 série por (user, linked_activity_id
-- Spec: .claude/specs/tarefas/ + .claude/specs/sync-atividades/
--
-- Antes: o auto-create em linkWorkoutsToTodos (mobile/src/services/activity-todo-link.ts)
-- inseria um todo_template novo sempre que NÃO via uma série ativa para o tipo de
-- atividade — sem proteção a corrida entre execuções (cold-start multi-device,
-- retry após falha, ou seleção que filtrava por `active`). Dezenas de templates
-- "Ciclismo/Corrida/Yoga" se acumularam, e cada um gerava sua ocorrência diária.
--
-- Esta migration deduplica as séries existentes por (user_id, linked_activity_id),
-- preservando o keeper (preferindo o ativo mais antigo) e movendo ocorrências dos
-- losers para ele — descarta colisões em (template_id, due_date) mantendo a "melhor"
-- (done > pending, depois mais antiga). Depois adiciona o unique partial index que
-- impede futuras duplicações.

-- ─────────────────────────────────────────────────────────────
-- 1. Dedup: para cada (user_id, linked_activity_id) com >1 templates,
--    consolida ocorrências e apaga os losers.
-- ─────────────────────────────────────────────────────────────
do $$
declare
  pair record;
  keeper_id uuid;
begin
  for pair in
    select user_id, linked_activity_id
      from public.todo_templates
     where linked_activity_id is not null
     group by user_id, linked_activity_id
    having count(*) > 1
  loop
    -- Keeper: prefere ativo, depois o mais antigo (provavelmente o "original" do usuário).
    select id into keeper_id
      from public.todo_templates
     where user_id = pair.user_id
       and linked_activity_id = pair.linked_activity_id
     order by active desc, created_at asc
     limit 1;

    -- (a) Em cada due_date com várias ocorrências (keeper + losers), mantém só 1:
    --     prioriza status 'done', depois done_at, depois created_at. Necessário antes
    --     de repointar para não violar o unique index (template_id, due_date).
    with all_occs as (
      select o.id,
             row_number() over (
               partition by o.due_date
               order by case when o.status = 'done' then 0 else 1 end,
                        o.done_at nulls last,
                        o.created_at
             ) as rn
        from public.todo_occurrences o
        join public.todo_templates  t on t.id = o.template_id
       where t.user_id = pair.user_id
         and t.linked_activity_id = pair.linked_activity_id
         and o.due_date is not null
    )
    delete from public.todo_occurrences
     where id in (select id from all_occs where rn > 1);

    -- (b) Repointa o que sobrou (incluindo ocorrências sem due_date) pro keeper.
    update public.todo_occurrences o
       set template_id = keeper_id
      from public.todo_templates t
     where o.template_id = t.id
       and t.user_id = pair.user_id
       and t.linked_activity_id = pair.linked_activity_id
       and t.id <> keeper_id;

    -- (c) Apaga os templates losers.
    delete from public.todo_templates
     where user_id = pair.user_id
       and linked_activity_id = pair.linked_activity_id
       and id <> keeper_id;
  end loop;
end$$;

-- ─────────────────────────────────────────────────────────────
-- 2. Constraint: 1 série por (user_id, linked_activity_id).
--    Partial — séries sem linked_activity_id (tarefas normais) ficam livres.
-- ─────────────────────────────────────────────────────────────
create unique index if not exists todo_templates_linked_activity_uidx
  on public.todo_templates (user_id, linked_activity_id)
  where linked_activity_id is not null;
