<!-- bmad:context -->
<!-- Verificado em 2026-08-18 contra 2a26eb2. Mantido por bmad-project-context;
     edições dentro deste bloco são substituídas no refresh. O que você quiser
     preservar, deixe fora dos marcadores. -->

## Orbe

Plataforma pessoal para gerenciar a rotina — treinos, saúde, alimentação, casa, compras e
finanças. Monorepo npm workspaces: dashboard analítico Angular em `web/`, app de captura
rápida Expo/React Native em `mobile/`, modelos de domínio e design tokens em
`packages/shared/` (`@vitale/shared`), backend Supabase (Postgres + RLS + edge functions
Deno) em `supabase/`. Specs de produto vivem em `docs/specs/`; artefatos de planejamento
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
- Spec de uma feature: `docs/specs/<feature>/{spec,plan,data-model}.md`; a lista de
  tarefas dela fica em `_bmad-output/implementation-artifacts/<feature>/tasks.md`.
- Decisão arquitetural: `docs/decisions/` — numerada e append-only; para mudar de ideia
  escreva outra que supersede a anterior, nunca edite a existente.
- Banco: `supabase/migrations/` · edge functions: `supabase/functions/`

## Running and verifying

- `npm run lint` na raiz falha, e não para no primeiro erro: `@vitale/shared` passa, `web`
  falha (não tem target `lint` no `angular.json`) e `mobile` também falha depois
  (`eslint: command not found`, exit 127). Valide workspace a workspace — cada `AGENTS.md`
  filho diz como.
- `npm run test` na raiz roda os três workspaces: shared em `tsx`, web em Vitest, mobile
  em Jest.
- Não há CI nem git hooks: nada é verificado automaticamente no commit.
- `supabase/scripts/check-schema-drift.sh` compara as tabelas de produção com as
  que as migrations criam; sai != 0 no desvio. Precisa do banco, então não roda em
  `npm run test` — rode à mão após mexer em schema.

## Known pitfalls

- Leia `activity_routes` e outras tabelas de payload grande com colunas explícitas;
  `select('*')` ali estoura o `statement_timeout` de 8 s do role `authenticated` — uma
  leitura de rotas chegou a 89 MB/17,7 s antes de virar coluna reduzida.
- Reescrita de caminho em massa com `sed` exclui `_bmad-output/` e
  `supabase/migrations/`: ambos citam caminhos antigos como registro histórico, não como
  link vivo, e a reescrita os corrompe.
- **Mexeu no `overrides` da raiz ou regenerou o `package-lock.json`? Valide os TRÊS
  workspaces**, não só o que motivou a mudança. O lockfile é compartilhado, então uma
  troca feita pelo mobile chega no web e no shared. Foi assim que subir o mobile para
  o TypeScript 6 quebrou o build do web: o `@angular/compiler-cli` fica hasteado na
  raiz e passou a resolver o TS 6, enquanto o `@angular-devkit/build-angular`, aninhado
  em `web/`, seguia no 5.9 — dois TypeScripts no mesmo build, e o 6 renomeou
  `lib.esnext.float16` para `lib.es2025.float16`. O `overrides` da raiz agora prende o
  TS do `compiler-cli` na faixa do web; o toolchain do Angular 21 **veta** TS ≥ 6
  (`@angular-devkit/build-angular` pede `>=5.9 <6.0`), então não adianta subir o web.

<!-- /bmad:context -->
