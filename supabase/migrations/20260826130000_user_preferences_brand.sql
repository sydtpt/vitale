-- Orbe — Cor de marca nas preferências do usuário.
--
-- Quarto eixo do sistema de temas. Governa o CROMO — o botão “+”, os CTAs, o
-- Salvar, os toggles, os estados ativos — e não as cores de módulo, que
-- continuam vindo de `palette_id`. Escolher marca azul deixa o “+” azul e o
-- chip de Treino laranja, que é o comportamento pretendido.
--
-- Até aqui `primary` saía do papel `orange` da paleta, e como as seis paletas
-- mantêm o laranja quente na faixa do treino, o cromo do app era laranja em
-- qualquer uma delas.
--
-- Constraint por `drop` + `add` incondicional — nunca `check` colado no
-- `add column if not exists`, que o Postgres pula inteiro quando a coluna já
-- existe. Ver `20260825130000_user_preferences_wallpaper_ids.sql`.

alter table public.user_preferences
  add column if not exists brand_id text not null default 'laranja';

alter table public.user_preferences
  drop constraint if exists user_preferences_brand_id_check;

alter table public.user_preferences
  add constraint user_preferences_brand_id_check
    check (brand_id in ('laranja','tinta','azul','verde'));
