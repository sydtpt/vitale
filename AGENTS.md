<!-- bmad:context -->
<!-- Verificado em 2026-08-17 contra a711c41. Mantido por bmad-project-context;
     edições dentro deste bloco são substituídas no refresh. O que você quiser
     preservar, deixe fora dos marcadores. -->

## Orbe

Plataforma pessoal para gerenciar a rotina — treinos, saúde, alimentação, casa, compras e
finanças. Monorepo npm workspaces: dashboard analítico Angular em `web/`, app de captura
rápida Expo/React Native em `mobile/`, modelos de domínio e design tokens em
`packages/shared/` (`@vitale/shared`), backend Supabase (Postgres + RLS + edge functions
Deno) em `supabase/`. Specs de produto vivem em `.claude/specs/`; artefatos de planejamento
do BMAD, em `_bmad-output/`.

## Policy

- Nunca rode `supabase db push` sem confirmação explícita do usuário — o projeto está
  linkado e o push atinge produção. Gere o `.sql` em `supabase/migrations/` e pergunte.
- Nunca rode DDL destrutivo (`DROP`, `TRUNCATE`, `DELETE` sem `WHERE`) em produção sem
  confirmação explícita.
- Nunca leia, edite nem commite `.env` (raiz) e `mobile/.env`.
  `web/src/environments/environment.ts` é versionado de propósito — contém só a anon key,
  pública e protegida por RLS.
- Nunca edite à mão `mobile/ios/` (versionado para EAS bare) nem `patches/` — mude pela
  ferramenta que os gera (`expo prebuild`, `patch-package`).

## Where things are

- Regras do dashboard: `web/AGENTS.md` · do app: `mobile/AGENTS.md` · do pacote
  compartilhado: `packages/shared/AGENTS.md`
- Spec de uma feature: `.claude/specs/<feature>/{spec,plan,data-model,tasks}.md`
- Banco: `supabase/migrations/` · edge functions: `supabase/functions/`

## Running and verifying

- `npm run lint` na raiz falha, e não para no primeiro erro: `@vitale/shared` passa, `web`
  falha (não tem target `lint` no `angular.json`) e `mobile` também falha depois
  (`eslint: command not found`, exit 127). Valide workspace a workspace — cada `AGENTS.md`
  filho diz como.
- `npm run test` na raiz roda todos os workspaces (web em Vitest, mobile em Jest).
- Não há CI nem git hooks: nada é verificado automaticamente no commit.

## Known pitfalls

- Leia `activity_routes` e outras tabelas de payload grande com colunas explícitas;
  `select('*')` ali estoura o `statement_timeout` de 8 s do role `authenticated` — uma
  leitura de rotas chegou a 89 MB/17,7 s antes de virar coluna reduzida.

<!-- /bmad:context -->
