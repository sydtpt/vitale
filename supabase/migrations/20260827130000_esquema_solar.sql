-- Orbe — o esquema `solar` no eixo claro/escuro.
--
-- A coluna `theme` guarda o ESQUEMA, não o tema (ver o comentário longo em
-- `20260826120000_user_preferences_theme_palette.sql`). Ela nasceu aceitando
-- 'system', 'light' e 'dark'; ganha agora 'solar', que segue o nascer e o pôr
-- do sol no lugar onde o aparelho está.
--
-- POR QUE ISTO É UMA MIGRATION E NÃO SÓ CÓDIGO: `user_preferences` é escrita
-- por inteiro num upsert só. Um valor fora do CHECK não derruba só a coluna
-- dele — derruba a linha inteira, e o erro chega como um `console.warn` que
-- ninguém vê. Sem esta migration, escolher "Solar" no app faria o usuário
-- perder tema, paleta, marca e papel de parede de uma vez.
--
-- `drop constraint` + `add constraint` incondicional, nunca `add column if not
-- exists` com o check colado: com a coluna já existente o Postgres pula o
-- statement inteiro e leva o check junto, calado.

alter table public.user_preferences
  drop constraint if exists user_preferences_theme_check;

alter table public.user_preferences
  add constraint user_preferences_theme_check
    check (theme in ('system','light','dark','solar'));
