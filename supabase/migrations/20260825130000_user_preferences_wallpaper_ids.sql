-- Orbe — Papel de parede: alinha o CHECK aos ids que o app realmente grava.
--
-- A `20260603130000_user_preferences_wallpaper.sql` consta como aplicada, mas
-- virou no-op: a coluna `wallpaper` já existia (criada fora do fluxo de
-- migrations, com um conjunto antigo de 5 ids), e `add column if not exists`
-- pula o statement INTEIRO — inclusive o `check` que vem colado nele. Prod
-- ficou aceitando só
--     'flat','glow','organic','rings','contour','grain'
-- enquanto o app grava os ids de packages/shared/src/constants/wallpaper.ts.
--
-- O estrago não era só o fundo: `upsertUserPreferences` grava a linha inteira
-- de uma vez, então qualquer escolha ≠ 'flat' virava check_violation e derrubava
-- o upsert todo — levando junto `theme`, `glass_enabled` e o resto. Modo escuro
-- parava de persistir por causa do papel de parede.
--
-- Recriar a constraint (drop + add, sem `if not exists`) é o único caminho
-- depois que a coluna já existe. Inclui o novo 'pure'.

update public.user_preferences
   set wallpaper = 'flat'
 where wallpaper is not null
   and wallpaper not in
     ('flat','pure','headerGlow','bottomBlob','cornerRings','hills','mesh','contourV','bars');

alter table public.user_preferences
  drop constraint if exists user_preferences_wallpaper_check;

alter table public.user_preferences
  add constraint user_preferences_wallpaper_check
    check (wallpaper in
      ('flat','pure','headerGlow','bottomBlob','cornerRings','hills','mesh','contourV','bars'));
