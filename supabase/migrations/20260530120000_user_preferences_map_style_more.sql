-- Vitale — Mais estilos de mapa nas preferências do usuário
-- Spec: .claude/specs/settings/
-- Amplia o CHECK de user_preferences.map_style para os novos estilos
-- (sem rótulos, escuro, satélite e topográfico). Todos sem chave de API.

alter table public.user_preferences
  drop constraint if exists user_preferences_map_style_check;

alter table public.user_preferences
  add constraint user_preferences_map_style_check
    check (map_style in (
      'osm',
      'voyager',
      'positron',
      'voyager_nolabels',
      'positron_nolabels',
      'dark',
      'satellite',
      'topo'
    ));
