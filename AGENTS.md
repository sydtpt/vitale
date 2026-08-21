<!-- bmad:context -->
<!-- Verificado em 2026-08-18 contra 2a26eb2. Mantido por bmad-project-context;
     edições dentro deste bloco são substituídas no refresh. O que você quiser
     preservar, deixe fora dos marcadores. -->

## Orbe

Plataforma pessoal para gerenciar a rotina — treinos, saúde, alimentação, casa, compras e
finanças. Monorepo pnpm workspaces (resolução isolada): dashboard analítico Angular em `web/`, app de captura
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
- Nunca edite à mão `mobile/ios/`, `patches/` nem o lockfile — mude pela ferramenta que
  os gera (`expo prebuild`, `pnpm patch`, `pnpm install`). `mobile/ios/` **não** é
  versionado desde a ADR 0012: é saída de prebuild, e edição manual não sobrevive.

## Where things are

- Regras do dashboard: `web/AGENTS.md` · do app: `mobile/AGENTS.md` · do pacote
  compartilhado: `packages/shared/AGENTS.md`
- Spec de uma feature: `docs/specs/<feature>/{spec,plan,data-model}.md`; a lista de
  tarefas dela fica em `_bmad-output/implementation-artifacts/<feature>/tasks.md`.
- Decisão arquitetural: `docs/decisions/` — numerada e append-only; para mudar de ideia
  escreva outra que supersede a anterior, nunca edite a existente.
- Banco: `supabase/migrations/` · edge functions: `supabase/functions/`

## Running and verifying

- **O gerenciador é `pnpm`** ([ADR 0016](docs/decisions/0016-pnpm-isolado-substitui-npm-workspaces.md)),
  versão fixada em `packageManager`. Rodar `npm install` aqui recria a árvore plana e
  devolve as colisões entre workspaces — se acontecer, apague `node_modules` e
  `package-lock.json` e rode `pnpm install`.
- A resolução é **isolada**: cada workspace só enxerga o que declara. Dependência usada
  sem estar no `package.json` daquele workspace não resolve — é defeito a declarar, não
  a contornar.
- `pnpm -r lint` na raiz falha e não para no primeiro erro: `@vitale/shared` passa, `web`
  falha (não tem target `lint` no `angular.json`) e `mobile` também falha depois
  (`eslint: command not found`, exit 127). Valide workspace a workspace — cada `AGENTS.md`
  filho diz como.
- `pnpm -r test` na raiz roda os três workspaces: shared em `tsx`, web em Vitest, mobile
  em Jest.
- `.github/workflows/ci.yml` valida os três workspaces a cada push e PR (AD-17).
  Não há git hooks: nada é verificado no momento do commit, só depois do push.
  O CI **não** cobre build nativo iOS nem os portões em device — verde nele não
  significa feature funcionando; ver `docs/upgrade-de-plataforma.md`.
- `supabase/scripts/check-schema-drift.sh` compara as tabelas de produção com as
  que as migrations criam; sai != 0 no desvio. Precisa do banco, então não roda em
  `pnpm -r test` — rode à mão após mexer em schema.

## Known pitfalls

- Leia `activity_routes` e outras tabelas de payload grande com colunas explícitas;
  `select('*')` ali estoura o `statement_timeout` de 8 s do role `authenticated` — uma
  leitura de rotas chegou a 89 MB/17,7 s antes de virar coluna reduzida.
- Reescrita de caminho em massa com `sed` exclui `_bmad-output/` e
  `supabase/migrations/`: ambos citam caminhos antigos como registro histórico, não como
  link vivo, e a reescrita os corrompe.
- **Dependência que "sumiu" quase sempre é dependência não declarada.** Sob resolução
  isolada, o workspace só enxerga o que está no `package.json` dele. Ao migrar para pnpm
  apareceram quatro que viviam de carona na árvore plana — `@types/node` no núcleo,
  `@jest/globals` e `@types/node` no mobile, e `@expo/config-plugins` nos config plugins
  próprios. O conserto é **declarar no workspace que usa**, nunca hastear para a raiz.
- **Três TypeScripts convivem de propósito:** 5.9 no web (teto do Angular 21, que veta
  TS ≥ 6), 6.0 no mobile (o que o Expo SDK pina) e o do núcleo, que é o **menor entre os
  consumidores** (AD-15) porque `packages/shared` não tem build — os dois apps o compilam
  como fonte. Recurso de linguagem só-TS6 no núcleo quebra o build do web, longe de onde
  foi escrito; quem pega isso é o job `web` do CI.
- **Mexeu em dependência? Valide os TRÊS workspaces**, não só o que motivou a mudança —
  é o que o CI faz. Antes do isolamento, subir o mobile para o TypeScript 6 derrubou o
  build do web sem que nada no mobile acusasse.

<!-- /bmad:context -->
