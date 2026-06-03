-- Vitale — limpeza one-off: remove o hábito "Água" duplicado e ARQUIVADO.
--
-- Contexto: o seed concorrente chegou a duplicar a "Água" (ver trava
-- loadInFlight em mobile/src/store/habits.store.ts). A cópia extra foi
-- arquivada manualmente; este script a apaga em definitivo.
--
-- Segurança:
--   • só remove linhas com active = false (arquivadas);
--   • só remove se AINDA existir uma "Água" ATIVA do mesmo usuário
--     (evita apagar um arquivamento legítimo quando não há duplicata);
--   • habit_logs some junto via ON DELETE CASCADE.
--
-- Execução manual (não é migration). Rode primeiro o SELECT de conferência,
-- confira o resultado e só então o DELETE.

-- 1) Conferência — o que será removido:
select h.id, h.user_id, h.name, h.active, h.created_at
from public.habits h
where h.active = false
  and lower(h.name) in ('água', 'agua')
  and exists (
    select 1 from public.habits a
    where a.user_id = h.user_id
      and a.active = true
      and lower(a.name) in ('água', 'agua')
  );

-- 2) Remoção (descomente para aplicar):
-- delete from public.habits h
-- where h.active = false
--   and lower(h.name) in ('água', 'agua')
--   and exists (
--     select 1 from public.habits a
--     where a.user_id = h.user_id
--       and a.active = true
--       and lower(a.name) in ('água', 'agua')
--   );
