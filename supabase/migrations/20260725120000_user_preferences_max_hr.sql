-- Orbe — FC máxima do usuário em user_preferences
-- Base das zonas de frequência cardíaca (% da FC máxima, padrão Garmin).
-- Fonte única lida pelo ingest (connections-ingest) e pelo sync do mobile;
-- substitui o max_hr default do intervals.icu (ex.: 210), que inflava o teto e
-- jogava treinos leves inteiros na Z1.

alter table public.user_preferences
  add column if not exists max_hr smallint check (max_hr between 100 and 230);
