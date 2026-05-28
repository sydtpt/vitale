-- Vitale — Tarefas: encadeamento por conclusão (onComplete)
-- Spec: .claude/specs/tarefas/
--
-- Adiciona `on_complete jsonb` em todo_templates — lista de regras de spawn
-- ({ templateId, ifPending: 'ignore' | 'duplicate' }). Ao concluir esta série,
-- o seam `resolveAndAdvance` instancia ocorrências das séries-filhas (que
-- continuam mantendo a própria `recurrence`).
--
-- Migra séries antigas com recurrence.kind = 'on_task' (modelo anterior, onde
-- a filha apontava para o pai): vira `on_complete` no template-pai e a
-- recorrência da filha vira 'none' (avulsa, criada por gatilho).
alter table public.todo_templates
  add column if not exists on_complete jsonb;

-- Migração de dados: para cada template com recurrence.kind = 'on_task', adiciona
-- a regra no pai (sourceTemplateId) e troca a recurrence da filha para 'none'.
do $$
declare
  child record;
  parent_rules jsonb;
  new_rule jsonb;
begin
  for child in
    select id, user_id, recurrence
      from public.todo_templates
     where recurrence->>'kind' = 'on_task'
  loop
    new_rule := jsonb_build_object('templateId', child.id, 'ifPending', 'ignore');
    select coalesce(on_complete, '[]'::jsonb)
      into parent_rules
      from public.todo_templates
     where id = (child.recurrence->>'sourceTemplateId')::uuid
       and user_id = child.user_id;
    if parent_rules is not null then
      update public.todo_templates
         set on_complete = parent_rules || jsonb_build_array(new_rule)
       where id = (child.recurrence->>'sourceTemplateId')::uuid
         and user_id = child.user_id;
    end if;
    update public.todo_templates
       set recurrence = '{"kind":"none"}'::jsonb
     where id = child.id;
  end loop;
end$$;
