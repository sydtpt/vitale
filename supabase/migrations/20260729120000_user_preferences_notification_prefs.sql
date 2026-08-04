-- Orbe — Preferências de notificações locais
-- Quais tipos de notificação o usuário quer receber (digest, atividades
-- sincronizadas, tarefas automáticas) + a agenda (dia/hora) das retrospectivas
-- semanal/mensal/anual. Um único jsonb resolvido no cliente sobre os defaults
-- (resolveNotificationPrefs) — tipos futuros não exigem nova migration.

alter table public.user_preferences
  add column if not exists notification_prefs jsonb not null default '{}'::jsonb;
