-- Meta semanal de atividade (minutos moderados equivalentes) por usuário.
--
-- Referência da linha tracejada no gráfico de duração do Histórico de Treinos.
-- A OMS recomenda 150–300 min/semana de atividade moderada para adultos; o app usa
-- 190 como padrão quando a coluna é NULL (ver DEFAULT_WEEKLY_TARGET_MIN no shared,
-- packages/shared/src/health/who-activity.ts).
--
-- Os limites do check espelham MIN/MAX_WEEKLY_TARGET_MIN do shared: larga o
-- suficiente para quem treina muito, apertada o suficiente para barrar digitação
-- errada (ex.: minutos no lugar de segundos).
alter table public.user_preferences
  add column if not exists weekly_activity_target_min smallint
    check (weekly_activity_target_min between 30 and 1500);

comment on column public.user_preferences.weekly_activity_target_min is
  'Meta semanal de atividade em minutos moderados equivalentes (1 min vigoroso = 2 moderados). NULL = usa o padrão do app (190).';
