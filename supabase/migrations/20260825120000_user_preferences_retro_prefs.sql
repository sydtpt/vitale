-- Orbe — Diagramação da Retrospectiva (spec v2 §6)
-- Ordem e visibilidade dos blocos da tela + a data em que a "prova de gráfica"
-- começou. Um único jsonb resolvido no cliente sobre os defaults
-- (resolveRetroPrefs) — bloco novo não exige nova migration.
--
-- Forma: { order: RetroBlockId[], hidden: { <id>: 'YYYY-MM-DD' }, proofStartedOn?: 'YYYY-MM-DD' }
-- `hidden` guarda a DATA em que o bloco foi escondido, não um booleano: é dela que
-- sai a regra dos 60 dias (bloco escondido e não reativado vira candidato a sair
-- do código). Um booleano perderia exatamente a informação que a regra precisa.

alter table public.user_preferences
  add column if not exists retro_prefs jsonb not null default '{}'::jsonb;
