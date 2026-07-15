-- Agenda a ingestão de conexões (Strava / intervals.icu) a cada 15 minutos.
-- RODAR MANUALMENTE no SQL editor do projeto, substituindo os placeholders:
--   <PROJECT_REF>  ref do projeto (https://<PROJECT_REF>.supabase.co)
--   <CRON_SECRET>  o mesmo valor de `supabase secrets set CRON_SECRET=...`
-- NUNCA commitar este arquivo com os valores preenchidos.
--
-- Pré-requisitos:
--   supabase functions deploy connections-ingest intervals-link strava-oauth
--   supabase secrets set CRON_SECRET=... (e STRAVA_* / OAUTH_STATE_SECRET / WEB_APP_URL)

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove agendamento anterior, se existir (idempotente).
select cron.unschedule('connections-ingest')
where exists (select 1 from cron.job where jobname = 'connections-ingest');

select cron.schedule(
  'connections-ingest',
  '*/15 * * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/connections-ingest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);

-- Conferir: select * from cron.job;
-- Últimas execuções: select * from cron.job_run_details order by start_time desc limit 10;
