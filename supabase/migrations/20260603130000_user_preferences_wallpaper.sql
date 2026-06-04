-- Vitale — Papel de parede nas preferências do usuário
-- Spec: .claude/specs/settings/
-- Adiciona a escolha do fundo (papel de parede) do app.
-- 'flat' (creme sólido) é o padrão atual.

alter table public.user_preferences
  add column if not exists wallpaper text not null default 'flat'
    check (wallpaper in ('flat','headerGlow','bottomBlob','cornerRings','hills','mesh','contourV','bars'));
