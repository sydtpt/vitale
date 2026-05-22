-- Vitale — Habitos: definir valor absoluto de um dia (edição de passado)
-- Spec: .claude/specs/habitos/data-model.md §2
-- Complementa habit_log_add (delta) com um "set" idempotente por (habit_id, log_date).
-- Usado por web e mobile na edição de dias passados. security invoker mantém o RLS.

-- ─────────────────────────────────────────────────────────────
-- habit_log_set — fixa o valor do dia. p_value <= 0 apaga a linha
-- (ausência ⇒ 0, mesma semântica do reset). Devolve o valor final.
-- ─────────────────────────────────────────────────────────────
create or replace function public.habit_log_set(p_habit uuid, p_date date, p_value numeric)
returns numeric language plpgsql security invoker as $$
declare
  v_user   uuid;
  v_result numeric;
begin
  select user_id into v_user from public.habits where id = p_habit;
  if v_user is null then
    raise exception 'habit not found';
  end if;

  if p_value <= 0 then
    delete from public.habit_logs where habit_id = p_habit and log_date = p_date;
    return 0;
  end if;

  insert into public.habit_logs (habit_id, user_id, log_date, value)
  values (p_habit, v_user, p_date, p_value)
  on conflict (habit_id, log_date) do update
    set value = excluded.value
  returning value into v_result;

  return v_result;
end; $$;
