-- Vitale — Intensidade do blur nas preferências do usuário
-- Controla o nível do efeito glass (tab bar + cards). No iOS, intensidade
-- baixa = mais translúcido/see-through; alta = mais fosco. Default 50.

alter table public.user_preferences
  add column if not exists blur_intensity integer not null default 50
    check (blur_intensity between 0 and 100);
