-- Vitale — Estilo de mapa nas preferências do usuário
-- Spec: .claude/specs/settings/
-- Adiciona a escolha do estilo de tiles dos mapas de atividade.
-- 'voyager' (CARTO Voyager, pastel) é o padrão atual.

alter table public.user_preferences
  add column if not exists map_style text not null default 'voyager'
    check (map_style in ('osm','voyager','positron'));
