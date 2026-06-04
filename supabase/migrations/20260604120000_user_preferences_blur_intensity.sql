-- Vitale — Intensidade do blur nas preferências do usuário
-- Controla o nível de transparência do efeito glass (tab bar + cards).
-- 100 = blur máximo / mais transparente; 0 = sem blur (praticamente sólido).

alter table public.user_preferences
  add column if not exists blur_intensity integer not null default 100
    check (blur_intensity between 0 and 100);
