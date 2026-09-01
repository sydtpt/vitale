-- Orbe — Tarefas: reabrir uma conclusão (desfazer o toque errado).
-- Spec: docs/specs/tarefas/
--
-- `todo_resolve` já aceitava p_status = 'pending' (o CHECK da coluna permite),
-- mas deixava `done_at` e `meta` da conclusão para trás: a ocorrência voltava a
-- pendente carregando a hora em que foi "feita" e o meta rico (valor pago,
-- source='activity-sync'). Reabrir agora limpa os dois — é a conclusão inteira
-- que se desfaz, não só o status.
--
-- A remoção do que a conclusão gerou (próxima da série + filhas do
-- encadeamento) continua no cliente, como o resto do avanço de série.
create or replace function public.todo_resolve(p_occ uuid, p_status text, p_meta jsonb default null)
returns public.todo_occurrences language sql security invoker as $$
  update public.todo_occurrences
     set status  = p_status,
         done_at = case
                     when p_status = 'done'    then now()
                     when p_status = 'pending' then null
                     else done_at
                   end,
         meta    = case
                     when p_status = 'pending' then null
                     else coalesce(p_meta, meta)
                   end
   where id = p_occ
  returning *;
$$;
