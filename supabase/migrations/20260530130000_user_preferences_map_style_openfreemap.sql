-- Vitale — Estilos OpenFreeMap (vector tiles / MapLibre)
-- Spec: .claude/specs/settings/
-- Amplia o CHECK de user_preferences.map_style com os estilos vetoriais do
-- OpenFreeMap (Positron, Bright, Fiord e a vista 3D). Sem chave de API.

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
      'topo',
      'ofm_positron',
      'ofm_bright',
      'ofm_fiord',
      'ofm_3d'
    ));
