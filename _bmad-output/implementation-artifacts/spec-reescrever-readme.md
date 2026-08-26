---
title: 'Reescrever o README.md a partir do estado real do repo'
type: 'chore'
created: '2026-08-26'
status: 'done'
baseline_commit: 'b6041f1a0fd92dd0b105edf515c1f38e701d94bc'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/CLAUDE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** O `README.md` congelou numa versão do projeto que não existe mais. Ele chama o produto de Vitale, anuncia Angular 20, Expo 52/RN 0.76, manda instalar com `npm`, lista Reanimated 3 na stack (hoje proibido pela ADR 0010), mostra 4 tabs no mobile (são 6) e 7 rotas na web (são 20), e descreve o projeto como sem backend — enquanto existem 52 migrations e 5 edge functions no `supabase/`. Quem chega pelo README recebe instruções que quebram a árvore de dependências.

**Approach:** Substituir o arquivo inteiro por um texto novo, em inglês, na estrutura híbrida: três parágrafos curtos de contexto (o que é o Orbe, por que existe, a divisão web≠mobile) e daí em diante referência seca — comandos verificados, layout do monorepo, rotas, tabs, backend, validação e ponteiro para as ADRs. Cada afirmação factual sai do código ou do `AGENTS.md`, nunca de memória.

## Boundaries & Constraints

**Always:**
- Hierarquia de verdade quando as fontes divergem: **código > `AGENTS.md` + `docs/decisions/` > `CLAUDE.md` > `docs/specs/`**. O `00-overview.md` e partes do `CLAUDE.md` são registro histórico, não estado atual.
- Todo comando escrito no README tem de existir em `package.json` (raiz ou workspace) ou em `.github/workflows/ci.yml`. Nada inventado, nada "aproximado".
- Toda versão citada (Angular, Expo, RN, TypeScript, pnpm, Node) vem do `package.json` correspondente, copiada verbatim.
- Inglês em todo o arquivo — prosa, títulos de seção e tabelas.
- Nome visível é **Orbe**; `@vitale/*` e `com.sydtpt.vitale` aparecem só quando o texto explica por que o escopo npm não acompanhou a marca.

**Ask First:**
- Qualquer edição fora do `README.md`.
- Adicionar seção que exija informação que o repo não comprova (roadmap, screenshots, licença, instruções de deploy).

**Never:**
- Não tocar em `package.json`, `CLAUDE.md`, `AGENTS.md` nem nos specs — mesmo os que estão errados. Corrigi-los é outro trabalho.
- Não reproduzir a checklist de "Project Status" com caixinhas: ela apodrece a cada commit e o `CLAUDE.md` já é dono desse estado.
- Não despejar as 20 rotas cruas nem as 24 ADRs uma a uma — agrupar e apontar.
- Não copiar prosa do `CLAUDE.md`: o público é outro (humano chegando ao repo, não agente executando tarefa).

</frozen-after-approval>

## Code Map

Fatos já verificados nesta sessão — o implementador **não precisa re-investigar**, só transcrever.

- `package.json` (raiz) — `engines.node >= 20.0.0`; `packageManager: pnpm@11.22.0`. Scripts: `web:dev`, `web:build`, `mobile:start`, `mobile:android`, `mobile:ios`, `lint`, `test`. ⚠️ o campo `description` ainda diz "Vitale" — fora de escopo, não corrigir.
- `web/package.json` — `@vitale/web`, Angular `^21.0.0`, TypeScript `~5.9.0`. Deps notáveis: `@supabase/supabase-js`, `leaflet`, `maplibre-gl`, `@maplibre/maplibre-gl-leaflet`, `rxjs`, `zone.js`.
- `mobile/package.json` — `@vitale/mobile`, Expo `~57.0.16`, React Native `0.86.2`, React `19.2.3`, TypeScript `~6.0.3`.
- `packages/shared/package.json` — `@vitale/shared`, `main: src/index.ts` (**sem build** — os apps compilam como fonte), TypeScript `~5.8.0`, testes via `tsx`. Por que três TypeScripts convivem: AGENTS.md, AD-15.
- `web/src/main.ts` — as rotas vivem aqui, não em `app.routes.ts`. 20 rotas: `''`→`semana`, `semana`, `retrospectiva`, `treinos`, `workout-history` (+`/:slug`, `/:slug/mapa`, `/:slug/:id`), `habits`, `saude`, `recuperacao`, `tasks`, `registros`, `cultura`, `alimentacao`, `compras`, `casa`, `financas`, `metas`, `conexoes`, `configuracoes`; `**`→`login`.
- `web/src/app/features/auth/auth.routes.ts` — `login`, `register`, `setup`.
- `mobile/src/app/(tabs)/` — 6 tabs: `index.tsx` (Hoje), `semana`, `historico`, `saude`, `compras`, `mais`.
- `packages/shared/src/theme/` — `brands.ts`, `palettes.ts`, `themes.ts`, `derive.ts`, `color.ts`, `css-vars.ts` + `theme.test.ts`. Os quatro eixos (esquema · tema · paleta · marca) nascem aqui.
- `packages/shared/src/architecture.test.ts` — barreiras de arquitetura; roda no `pnpm --filter @vitale/shared test`.
- `packages/shared/src/` — domínios: `astro`, `chart`, `constants`, `cultura`, `data`, `date`, `fitness`, `format`, `geo`, `goals`, `habits`, `health`, `models`, `period`, `planner`, `theme`, `todo`, `week`.
- `supabase/` — 52 migrations em `migrations/`; edge functions: `connections-ingest`, `cultura-search`, `intervals-link`, `strava-oauth` (+`_shared`). Postgres + RLS. `supabase/scripts/check-schema-drift.sh` compara prod com as migrations (precisa do banco; roda à mão).
- `docs/decisions/` — 24 ADRs numeradas + `README.md`. Append-only: para mudar de ideia, escreve-se outra que supersede.
- `.github/workflows/ci.yml` — 3 jobs (`shared`, `web`, `mobile`) a cada push e PR. Comandos exatos: `pnpm --filter @vitale/shared lint`, `pnpm --filter @vitale/shared test`, `pnpm --filter @vitale/web build`, `pnpm --filter @vitale/web test`, `cd mobile && pnpm exec tsc --noEmit`, `cd mobile && pnpm exec jest`, `cd mobile && pnpm dlx expo-doctor`. Sem git hooks. Não cobre build nativo iOS.
- `AGENTS.md` — fonte verificada (2026-08-18 contra `2a26eb2`). `pnpm -r lint` na raiz **falha** (web sem target `lint`, mobile sem eslint) — não anunciar esse comando no README.
- `README.md` — alvo. Substituição integral.

## Tasks & Acceptance

**Execution:**
- [x] `README.md` -- reescrever o arquivo inteiro em inglês, na ordem: título + 3 parágrafos de contexto → Quick start → Repo layout → Web → Mobile → Shared/design system → Backend → Validation → Decisions → Where the docs live -- é o único arquivo do escopo; o conteúdo vem do Code Map, não de nova investigação.

**Acceptance Criteria:**
- Given o README novo, when se procura por "Vitale", "Angular 20", "Expo 52", "Reanimated", "npm install" ou "npm run", then nenhuma ocorrência aparece — exceto a menção deliberada a `@vitale/*` explicando o descompasso entre marca e escopo npm.
- Given um leitor que nunca abriu o repo, when segue o Quick start de cima a baixo, then instala com `corepack`/`pnpm` e sobe a web em `http://localhost:4200` sem passo faltando.
- Given a seção Validation, when se compara cada comando com `.github/workflows/ci.yml`, then todos batem verbatim e `pnpm -r lint` não é recomendado.
- Given a seção Web, when se compara com `web/src/main.ts`, then nenhuma rota listada é inexistente e nenhum módulo em produção (retrospectiva, cultura, tasks, conexões, recuperação, registros, saúde, histórico) está ausente.
- Given a seção Mobile, when se compara com `mobile/src/app/(tabs)/`, then as 6 tabs estão corretas.
- Given o arquivo inteiro, when se procura por caixinhas `- [x]`/`- [ ]` de status, then não há nenhuma.

## Spec Change Log

## Design Notes

**Por que híbrido e não referência pura:** o README é a única porta do repo que não assume contexto. Os três parágrafos de abertura pagam por si; depois disso, prosa vira ruído para quem só quer o comando.

**O que a abertura precisa entregar, nessa ordem:** (1) o Orbe é uma plataforma pessoal de rotina — treino, saúde, comida, casa, compras, finanças; (2) existe porque esses dados viviam em seis apps que não conversam; (3) a divisão que explica todo o resto do repo — **mobile captura, web analisa**.

**Rotas:** agrupar por domínio em vez de listar as 20. Sugestão de agrupamento — *Overview* (semana, retrospectiva), *Training & health* (treinos, workout-history, saude, recuperacao, habits), *Daily life* (alimentacao, compras, casa, tasks, registros, cultura), *Money & goals* (financas, metas), *Setup* (conexoes, configuracoes). Rotas aninhadas de `workout-history` viram uma nota, não linhas.

**Design system:** a tabela dos quatro eixos do `CLAUDE.md` é boa e cabe aqui traduzida — é o que há de mais distintivo no projeto. Fechar com a regra que o `architecture.test.ts` cobra: cor nasce no shared, nunca hex numa tela.

**Tom:** declarativo e curto. Sem "powerful", "seamless", "modern stack". Uma tabela vale mais que um parágrafo sempre que os dados forem pares chave-valor.

## Verification

**Commands:**
- `grep -niE "vitale|angular 20|expo 52|reanimated|npm install|npm run" README.md` -- expected: só as linhas que explicam de propósito o escopo `@vitale/*`; qualquer outra ocorrência é defeito.
- `grep -oE "^\| \`?/[a-z-]+" README.md | sort -u` -- expected: toda rota citada existe em `web/src/main.ts`.
- `git diff --stat` -- expected: exatamente um arquivo alterado, `README.md`.

**Manual checks:**
- Ler o Quick start de cima a baixo como quem clonou agora: prereqs (Node ≥ 20, corepack) → `pnpm install` → `pnpm web:dev` → mobile. Nenhum passo pressuposto.
- Conferir a seção Validation contra `.github/workflows/ci.yml` linha a linha.

## Suggested Review Order

**Ponto de entrada**

- Abertura híbrida: 3 parágrafos de contexto antes de virar referência seca.
  [`README.md:1`](../../README.md#L1)

**Correções factuais que a revisão pegou — leia estas primeiro**

- Era "nunca escreva hex, o teste proíbe". O teste é catraca, não barreira: verificado rodando os 12 checks.
  [`README.md:103`](../../README.md#L103)
- Era "nascer e pôr do sol". A ADR 0023 decide crepúsculo civil (−6°) por altitude do sol, e rejeita nascer/pôr explicitamente.
  [`README.md:114`](../../README.md#L114)
- Era "o schema mora nas migrations e em nenhum outro lugar". O pg_cron do ingest é instalado à mão por script.
  [`README.md:129`](../../README.md#L129)
- Era "Node >= 20" — o que o `engines` diz, mais frouxo que o que o Angular CLI 21 aceita.
  [`README.md:15`](../../README.md#L15)

**Bloqueios de primeira execução**

- Sem `mobile/.env` o app builda e conversa com nada, sem erro. Não havia nenhuma menção a env.
  [`README.md:29`](../../README.md#L29)
- `patches/` é load-bearing: patch que não aplica derruba o install, e o do HealthKit falha em silêncio.
  [`README.md:53`](../../README.md#L53)
- Os três `cd mobile` viraram subshells — encadeados nus, o segundo falha.
  [`README.md:152`](../../README.md#L152)

**Afirmações agora escopadas com honestidade**

- Toda rota está atrás de `profileGuard`; o drift script vê tabelas e colunas, não políticas nem triggers.
  [`README.md:72`](../../README.md#L72)
- Append-only implica uma regra de leitura: conferir `Status:` antes de confiar numa ADR.
  [`README.md:168`](../../README.md#L168)

**Periféricos**

- A fronteira de idioma declarada: README em inglês, tudo que ele linka em português.
  [`README.md:174`](../../README.md#L174)
