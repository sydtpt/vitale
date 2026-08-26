-- Orbe — Tema e paleta nas preferências do usuário.
--
-- Dois eixos NOVOS e independentes, somados ao claro/escuro que já existia:
--   theme_id   — família de neutros  (orbe | clean | cleanElev)
--   palette_id — família cromática   (orbe | bruma | terra | neon | joia | acessivel)
--
-- CUIDADO DE NOMENCLATURA: a coluna `theme` já existe e guarda 'system' |
-- 'light' | 'dark' — o ESQUEMA, não o tema. O nome ficou de quando havia só
-- aquele eixo. Renomear custaria migration nos dois apps por ganho cosmético,
-- então convivem: `theme` é esquema, `theme_id` é tema.
--
-- As constraints são criadas com `drop` + `add` incondicional, e não com o
-- `check` colado no `add column`. Foi exatamente esse atalho que deixou o
-- CHECK de `wallpaper` meses fora de sincronia com o app: a coluna já existia,
-- o `if not exists` pulou o statement INTEIRO, e o `check` foi junto — sem
-- erro nenhum. Ver `20260825130000_user_preferences_wallpaper_ids.sql`.
--
-- `palette_id` também absorve a preferência de paleta de gráficos, que antes
-- vivia só no armazenamento local de cada app. Os ids antigos ('vivido',
-- 'artico') são resolvidos no cliente por `resolvePalette`.

alter table public.user_preferences
  add column if not exists theme_id text not null default 'orbe';

alter table public.user_preferences
  add column if not exists palette_id text not null default 'orbe';

alter table public.user_preferences
  drop constraint if exists user_preferences_theme_id_check;

alter table public.user_preferences
  add constraint user_preferences_theme_id_check
    check (theme_id in ('orbe','clean','cleanElev'));

alter table public.user_preferences
  drop constraint if exists user_preferences_palette_id_check;

alter table public.user_preferences
  add constraint user_preferences_palette_id_check
    check (palette_id in ('orbe','bruma','terra','neon','joia','acessivel'));
