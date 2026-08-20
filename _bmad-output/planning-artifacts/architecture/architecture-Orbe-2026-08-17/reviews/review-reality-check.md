# Review — lente `reality-check`

- **Alvo:** `_bmad-output/planning-artifacts/architecture/architecture-Orbe-2026-08-17/ARCHITECTURE-SPINE.md` (status: `final`, `updated: 2026-08-17`)
- **Data da revisão:** 2026-08-18
- **Lente:** reality-check — cada decisão comprometida foi pesquisada/checada contra a realidade, ou foi afirmada de memória?
- **Escopo:** tabela `Stack`, correnteza/EOL de cada tecnologia nomeada, afirmações técnicas verificáveis dentro das ADs, e evidência citada nas cláusulas `Prevents`.

## Veredito

A espinha **arquitetural** (as regras) resiste ao teste de realidade: AD-6 (Deno), AD-7 (guarda existe e roda), AD-11, AD-12 e a fronteira de dependência conferem com o repositório. O que **não** resiste é a camada factual em volta: a tabela `Stack` omite oito dependências load-bearing, a nota sobre o salto de SDK do mobile diagnostica o obstáculo errado, quatro cláusulas `Prevents` citam evidência que já era falsa no dia da publicação, e a única stack de runtime do projeto (Expo 54 / RN 0.81.5 / Node 20) está fora de suporte upstream sem que o documento registre isso.

---

## A. Tabela `Stack` × repositório

Versões resolvidas conferidas em `node_modules` (não só nos ranges declarados).

| Linha da Stack (`ARCHITECTURE-SPINE.md:134-145`) | Declarado no repo | Resolvido | Veredito |
| --- | --- | --- | --- |
| TypeScript 5.9 | `web/package.json:39` `~5.9.0`; `mobile/package.json` `~5.9.2`; **`packages/shared/package.json:16` `~5.8.0`** | web 5.9.3, mobile 5.9.3, **shared 5.8.3** | ⚠️ **impreciso** |
| Angular (web) 21 | `web/package.json:17` `^21.0.0` | 21.2.13 | ✅ |
| Vitest (web) 4 | `web/package.json:40` `^4.0.8` | 4.1.10 | ✅ |
| Expo 54 | `mobile/package.json:20` `~54.0.0` | 54.0.34 | ✅ |
| React Native 0.81.5 | `mobile/package.json:38` | 0.81.5 | ✅ |
| React 19.1.0 | `mobile/package.json:37` | 19.1.0 | ✅ |
| Zustand (mobile) 5 | `mobile/package.json:46` `^5.0.0` | 5.0.13 | ✅ |
| Jest (mobile) 29 | `mobile/package.json:53` `^29.7.0` | 29.7.0 (+ `jest-expo` 54.0.17) | ✅ |
| @supabase/supabase-js 2.106 | `web`, `mobile`, `packages/shared` — todos `^2.106.0` | 2.106.0 | ✅ (mas ver A-2) |
| Supabase Postgres + RLS + edge functions Deno | `supabase/functions/`, `supabase/config.toml` | — | ✅ |

### A-1 — `packages/shared` está em TypeScript 5.8, não 5.9 — **medium**

A Stack afirma "TypeScript 5.9" como se fosse uniforme. O núcleo — o workspace que a AD-1 elege como dono de todo cálculo, e onde a guarda da AD-7 vive — está em `~5.8.0` (`packages/shared/package.json:16`), resolvido para 5.8.3, enquanto web e mobile estão em 5.9.3. Numa AD que compila o núcleo com `tsc --noEmit` (`packages/shared/package.json` script `lint`), a versão do compilador do núcleo é justamente a que importa. A tabela apaga a única divergência que ela tinha o dever de mostrar.

### A-2 — `patch-package` + o patch pinado do supabase-js não aparecem em lugar nenhum — **high**

`package.json:19` roda `patch-package` no `postinstall`, e `patches/@supabase+supabase-js+2.106.0.patch` neutraliza o `import()` dinâmico de `@opentelemetry/api` dentro do `dist/index.cjs` e `dist/index.mjs` do supabase-js (verificado: o patch troca o `import(OTEL_PKG)` por `Promise.resolve(null)`).

Isso é load-bearing para a AD-4, que faz do `SupabaseClient` a única costura de dados do sistema: o nome do arquivo de patch carrega a versão exata `2.106.0`, então **qualquer bump de supabase-js descarta o patch silenciosamente** e reintroduz o `import()` dinâmico nos dois bundlers. A Stack lista "@supabase/supabase-js 2.106" sem dizer que o `2.106` é um pin duro, não um piso. A convenção `ARCHITECTURE-SPINE.md:130` menciona `patches/` como artefato gerado, mas isso é sobre *como editar*, não sobre *o que trava*.

### A-3 — Dependências load-bearing ausentes da Stack — **high**

Todas essas são citadas indiretamente pelo próprio documento (no diagrama de paradigma, no Structural Seed ou nas ADs) e nenhuma aparece na tabela:

| Ausente | Onde é load-bearing |
| --- | --- |
| `expo-router` 6.0.23 (`mobile/package.json:30`, `main: "expo-router/entry"` em `:5`) | Structural Seed nomeia `mobile/src/app/ # rotas Expo Router` (`ARCHITECTURE-SPINE.md:165`) |
| `react-native-health` 1.19.0 (`mobile/package.json:40`) | O diagrama põe `HealthKit` como fronteira externa (`ARCHITECTURE-SPINE.md:35`); o Seed nomeia `mobile/src/lib/ # adaptadores nativos (HealthKit...)` (`:163`) |
| `leaflet` 1.9.4 + `maplibre-gl` 4.7.1 + `@maplibre/maplibre-gl-leaflet` 0.0.22 (`web/package.json:23,25,26`) | O mapa multi-rota é a razão de existir do precedente citado na AD-5 (`activity_routes.route_overview`) |
| `zone.js` ~0.15.0 (`web/package.json:29`) | A AD-12 diz "signals no web"; o web **não** é zoneless — não há `provideZonelessChangeDetection` em `web/src`. A Stack sugere um modelo de mudança que o repo não adota |
| `tsx` 4.23.12 (`packages/shared/package.json`) | É o runner real da guarda da AD-7 e o alvo `test` que a AD-13 exige (`packages/shared/package.json:9`) |
| `react-native-svg` 15.12.1, `react-native-view-shot` 4.0.3, `react-native-webview` 13.15.0 (`mobile/package.json:43-45`) | Módulos nativos de terceiros — são o custo real do salto de SDK que a nota da Stack descreve (ver C-1) |
| Node `>=20.0.0` (`package.json:25`) | Único runtime declarado do monorepo; EOL (ver B-6) |

Uma tabela `Stack` que omite o runtime de rotas do mobile, a ponte HealthKit, a stack de mapas inteira e o runner que executa a guarda da AD-7 não está descrevendo a stack.

---

## B. Correnteza e EOL de cada tecnologia nomeada

Todas as verificações abaixo foram feitas na web em 2026-08-18.

### B-1 — React Native 0.81.5 está **Unsupported** upstream — **critical**

A página oficial de releases classifica 0.81.x como **Unsupported**. As versões em suporte hoje são 0.87.x (Active, 2026-08-10), 0.86.x (Active, 2026-06-09) e 0.85.x (End of Cycle, 2026-04-06) — a política é "as 3 últimas séries minor". Fonte: <https://reactnative.dev/docs/releases> e <https://github.com/reactwg/react-native-releases/blob/main/docs/support.md>.

A Stack registra `React Native | 0.81.5` como um fato neutro. Não é: é a única stack de runtime de um dos dois adaptadores do sistema, e ela não recebe mais patch de segurança. O documento não classifica isso nem em `Deferred`.

### B-2 — Expo SDK 54 está a ~1 mês do fim de vida, e o canal OTA já pode estar quebrado — **high**

O changelog do SDK 57 declara: "SDK releases will continue to have a lifetime of approximately one year... Expo SDK 54 (September 2025) will receive critical fixes until the next SDK release (September or October 2026)". Fonte: <https://expo.dev/changelog/sdk-57>. A última SDK é a 57 (RN 0.86, React 19.2), com a 56 tendo saído em 2026-05-21 — o repo está **três SDKs atrás**.

Agravante **não confirmado por declaração oficial da Expo**, mas com três issues independentes abertas: relatos de que o EAS Update recusa `sdkVersion 54.0.0` com "GraphQL request failed" desde **2026-05-01** (<https://github.com/expo/expo/issues/45276>, também #45275 e #45279). Isso é diretamente relevante porque o projeto tem OTA ligado: `mobile/app.json:12-15` define `updates.url` apontando para `u.expo.dev/127be066-...` com `enabled: true`, e `mobile/eas.json` define canais `preview` e `production`. Fetch da issue #45276 confirma o relato e que ela está fechada **sem resposta de staff nem resolução registrada** — logo, "não confirmado" quanto ao status atual.

### B-3 — Angular 21 saiu do suporte ativo em 2026-06-03 — **medium**

Angular 22 é a release corrente (22.1.2, 2026-08-13). Angular 21 (2025-11-19) encerrou o **suporte ativo em 2026-06-03** e está em LTS/segurança até 2027-06-30; último patch da linha 21 é 21.2.20 (2026-08-12) — o repo está em 21.2.13. Fonte: <https://endoflife.date/angular>. Não é urgente, mas a Stack apresenta "Angular 21" sem sinalizar que a linha já é LTS.

### B-4 — TypeScript: a Stack cita 5.9 enquanto o estável é 7.0 — **medium**

TypeScript 7.0.2 é estável desde 2026-08-05 (compilador nativo em Go), com 6.0 entre as duas. Fontes: <https://www.infoq.com/news/2026/08/typescript-7-released/>, <https://www.npmjs.com/package/typescript>. Ficar em 5.9 é uma escolha defensável (Angular 21 e jest-expo 54 têm faixas próprias), mas é uma **decisão** — e o documento não a registra como tal, nem em `Deferred`. Está afirmada de memória, não pesquisada.

### B-5 — Bumps menores, todos sem impacto arquitetural — **low**

- `@supabase/supabase-js`: repo 2.106.0, npm 2.112.3 (<https://www.npmjs.com/package/@supabase/supabase-js>). Não existe v3. Mas ver A-2: o bump exige regerar o patch.
- Vitest: repo 4.1.10, npm 4.1.11 (5.0 em beta) — <https://www.npmjs.com/package/vitest>.
- Zustand: repo 5.0.13, npm 5.0.15 — <https://www.npmjs.com/package/zustand>.
- Jest: repo 29.7.0, npm 30.4.2 (<https://jestjs.io/blog/2025/06/04/jest-30>). Jest 29 é a major anterior; está travado por `jest-expo ~54.0.17`, portanto sai junto com a SDK — vale registrar essa amarra, não o número.

### B-6 — Node 20 (`engines`) está EOL desde 2026-04-30 — **medium**

`package.json:25` declara `"node": ">=20.0.0"`. Node 20 encerrou o ciclo em **2026-04-30** e não recebe mais patch de segurança; Node 22 vai até 2027-04-30 e Node 24 até 2028-04-30. Fonte: <https://nodejs.org/en/about/eol>. A máquina de desenvolvimento está em v22.14.0 — ou seja, o piso declarado permite um runtime que ninguém usa e que já morreu.

---

## C. Afirmações técnicas dentro das ADs

### C-1 — A nota da Stack sobre `mobile/ios/` diagnostica o obstáculo errado — **high**

`ARCHITECTURE-SPINE.md:147` afirma: *"o mobile está preso à SDK do Expo: subir React Native exige subir a SDK inteira, e `mobile/ios/` é versionado (bare), o que torna o salto um trabalho de prebuild, não de bump."*

A parte factual **confere**: 23 arquivos rastreados sob `mobile/ios/` (`Podfile`, `Podfile.lock`, `Vitale.xcodeproj/project.pbxproj`, `AppDelegate.swift`, `Vitale.entitlements`, `Info.plist`), com `mobile/.gitignore:12-18` excluindo só `Pods/`, `build/` e `xcuserdata`. É bare workflow versionado, e o ADR `docs/decisions/0009-ios-versionado-workflow-bare.md` registra a decisão.

O **diagnóstico**, porém, erra o gargalo. `mobile/app.json:10` traz `"newArchEnabled": false`. React Native 0.82 é a primeira versão que roda **exclusivamente** na New Architecture: "Any attempts to fall back to the Legacy Architecture, such as setting `newArchEnabled=false` on Android or passing `RCT_NEW_ARCH_ENABLED=0`... will be ignored", e "React Native 0.81 and Expo SDK 54 are the last versions that support the Legacy Architecture". Fonte: <https://reactnative.dev/blog/2025/10/08/react-native-0.82>.

Ou seja: o repo está sentado exatamente na **última** SDK que aceita a arquitetura legada, com a flag ligada em legado. O salto SDK 54 → 55+ não é "trabalho de prebuild" — é uma migração de New Architecture que precisa atravessar `react-native-health` 1.19.0, `react-native-webview` 13.15.0, `react-native-view-shot` 4.0.3, `react-native-svg` 15.12.1 e o `AppDelegate.swift`/bridging header versionados à mão. A nota subestima o custo por uma ordem de grandeza, e o `Deferred` não abriga o item.

### C-2 — AD-5: `security_invoker = true` está tecnicamente correto, mas a regra nunca foi exercida e o precedente citado não a demonstra — **medium**

A afirmação em si **confere** com a doc oficial: para Postgres < 15 "views bypass RLS by default because they are usually created with the `postgres` user"; a partir do PG 15 usa-se `security_invoker = true` para a view respeitar as políticas da tabela subjacente. Fonte: <https://supabase.com/docs/guides/database/postgres/row-level-security>.

Contra o repo, porém: `grep -rn "security_invoker" supabase/` retorna **zero ocorrências**, e não há nenhum `create view` / `create materialized view` nas 42 migrations. E o precedente que a AD-5 invoca — `activity_routes.route_overview` — **não é uma view**: `supabase/migrations/20260723120000_activity_routes_overview.sql` cria uma função `public._route_overview(jsonb, int)` `immutable` e uma **coluna gerada `stored`** (`generated always as (public._route_overview(points)) stored`). Coluna gerada não tem `security_invoker`; ela herda o RLS da própria tabela.

O precedente é legítimo para a *primeira* metade da AD-5 ("só quando o ganho for reduzir payload na rede" — a justificativa de timeout está escrita na própria migration). Mas a frase "View exige `security_invoker = true`" é uma regra prospectiva sem nenhum caso no repo, apresentada em meio a evidência que parece sustentá-la e não sustenta.

### C-3 — AD-9: a chave está correta como invariante, errada como nome — **medium**

A afirmação "a anon key é pública e protegida por RLS" **confere** com a doc oficial, que é explícita sobre o risco simétrico: "A table in an exposed schema without RLS is readable and writable by anyone with your publishable key" (<https://supabase.com/docs/guides/database/postgres/row-level-security>). O invariante sobrevive.

O nome não. O que está versionado em `web/src/environments/environment.ts:5` e em `mobile/eas.json` (linhas 12, 21, 29) é `sb_publishable_uD8fZpj1...` — a **publishable key** do novo esquema de chaves, não uma `anon` key JWT legada. A Supabase está aposentando `anon`/`service_role` **até o fim de 2026**, com os dois formatos convivendo até serem desativados manualmente no Dashboard. Fontes: <https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys>, <https://supabase.com/docs/guides/getting-started/api-keys>.

A AD-9 e a linha de `Segredos` em Consistency Conventions (`ARCHITECTURE-SPINE.md:129`) usam "anon key" como se fosse o termo vigente. Pela AD-3 — "cada conceito de domínio tem exatamente um módulo dono... Um nome por conceito em todo o sistema" — a própria espinha aplica a si mesma o nome que o fornecedor está retirando de circulação.

### C-4 — AD-6: edge functions Deno — **confirmado**

A doc oficial descreve o runtime como "Supabase Edge Runtime (Deno compatible runtime with TypeScript first)" (<https://supabase.com/docs/guides/functions>). O repo tem `supabase/functions/{connections-ingest,intervals-link,strava-oauth}/index.ts` + `_shared/`, e `supabase/config.toml` documenta o `verify_jwt` por função com a razão de cada um. Nenhuma discrepância. A doc não fixa versão de Deno — **não confirmado** qual versão, e a AD não depende disso.

### C-5 — AD-7 "não há CI nem git hooks" — **confirmado**

Não existe `.github/`, não existe `.husky/`, e `.git/hooks` só tem `.sample`. A guarda existe de fato e é real: `packages/shared/src/architecture.test.ts` roda quatro checagens (basename duplicado com allowlist, `.from(` fora do núcleo, núcleo importando de app, núcleo construindo client), ligada ao `npm test` da raiz via `package.json:18`.

---

## D. Evidência citada que já era falsa na data de publicação

Estas são o achado central da lente: quatro cláusulas `Prevents` — que são a *justificativa* de cada AD — descrevem um repositório que não existia mais quando o documento foi marcado `status: final`.

### D-1 — AD-13 cita um estado revertido no mesmo dia — **high**

`ARCHITECTURE-SPINE.md:117` afirma, no presente: *"`packages/shared` tem três arquivos de teste e um script `echo 'No tests yet'`, e eles nunca rodaram"*.

Realidade em 2026-08-18: são **cinco** arquivos de teste (`architecture.test.ts`, `goals/evaluate.test.ts`, `chart/axis.test.ts`, `chart/smooth-path.test.ts`, `fitness/activity-types.test.ts`) e o script é um runner real — `packages/shared/package.json:9`: `find src -name '*.test.ts' -print0 | xargs -0 -n1 tsx`.

O `echo 'No tests yet'` foi removido no commit `94f58c0` — *"chore: liga os testes do shared ao npm test e remove config morta"*, **2026-08-17 21:30**, o mesmo dia em que a espinha foi criada e fechada. A mensagem do commit é ainda mais direta que a AD: *"Os 3 testes de packages/shared nunca rodaram... Todos os 27 asserts passam."* A AD-13 é uma regra boa; a evidência que a sustenta é um passado apresentado como presente.

### D-2 — AD-9 previne uma etapa de build que já tinha sido deletada — **medium**

`ARCHITECTURE-SPINE.md:93` diz que a AD-9 previne *"etapa de substituição de placeholder que já existe morta no repositório e engana quem a encontra"*.

Não existe. `web/src/environments/` contém **um único arquivo** (`environment.ts`), e `web/angular.json` não tem `fileReplacements` em nenhuma configuração (`production` só define `budgets` + `outputHashing`). O `environment.prod.ts` foi apagado no mesmo `94f58c0`, cuja mensagem registra: *"Fase 1: environment.prod.ts era placeholder órfão (sem fileReplacements no angular.json, sem nenhuma referência)"*.

A regra continua certa. Mas o `Prevents` manda o leitor procurar uma armadilha no repositório, e quem procurar não acha — o que corrói exatamente a confiança que o documento precisa ter.

### D-3 — AD-4 e AD-7 descrevem um passivo já drenado — **high**

`ARCHITECTURE-SPINE.md:62` fixa o escopo da AD-4 em *"139 chamadas hoje, 14 tabelas em comum entre os apps"*, e `:82` descreve o mecanismo de **catraca** como o regime corrente ("Uma checagem cujo passivo ainda está sendo drenado entra como catraca... e vira barreira ao chegar a zero").

Medido em 2026-08-18: `grep -rn "\.from(" web/src mobile/src` (excluindo `Array.from` etc.) retorna **0**. Há 16 módulos donos em `packages/shared/src/data/` (não 14). A CAP-6 fechou em `8c0837d` — *"feat(data): activities e activity_routes — CAP-6 COMPLETA"*, 2026-08-18.

O próprio código já sabe disso. `packages/shared/src/architecture.test.ts:90-92` comenta: *"Foi CATRACA enquanto as 139 chamadas originais eram migradas... **Chegou a zero e virou barreira**, como estava previsto desde que foi escrita"* — e a checagem em `:94` é declarada `BARREIRA`, não catraca. As quatro checagens são barreira; **nenhuma catraca existe no repositório**. A AD-7 dedica um terço do seu texto a explicar um mecanismo que não está em uso, e a AD-4 dimensiona seu binding com um número zerado no dia seguinte.

Nota: `ARCHITECTURE-SPINE.md:112` ("os 10 pares de store duplicados", AD-12) **confere exatamente** — a `STORE_ALLOWLIST` em `architecture.test.ts:56-66` tem precisamente 10 entradas. E o `Deferred` de `.claude/specs` cita "28 migrations aplicadas": `grep -rl "\.claude/specs" supabase/migrations/` retorna **28** (de 42 no total). Quando o documento mede, ele mede bem — o problema é que ele não remede.

### D-4 — `running-highlights.ts` (Deferred) — **confirmado**

Existe nos dois apps: `mobile/src/lib/running-highlights.ts` e `web/src/app/features/workout-history/data/running-highlights.ts`, e está corretamente na lista `DEFERRED` da guarda (`architecture.test.ts:72`) com a mesma razão escrita. Consistente.

---

## E. Achado adicional fora do escopo estrito, mas material

### E-1 — `app.json` e `eas.json` duplicados na raiz, com identidade divergente — **medium**

Existem quatro arquivos rastreados: `app.json`, `eas.json`, `mobile/app.json`, `mobile/eas.json`. Os da raiz **contradizem** os do mobile:

| Campo | raiz | `mobile/` |
| --- | --- | --- |
| `ios.bundleIdentifier` | `com.sydtpt.lifeorganizer` | `com.sydtpt.vitale` |
| `extra.eas.projectId` | `d7f897be-21ee-4e10-8ffa-b916cacd1e31` | `127be066-b0bb-4469-bd58-d7e5c6c9cd22` |

`mobile/app.config.js` faz `require('./app.json')` — logo o config vivo é o de `mobile/`. Os da raiz são órfãos que ninguém lê, mas que um `eas build` disparado da raiz leria. Isso é precisamente o padrão que a AD-9 quis eliminar (config morta que engana quem a encontra) e que a AD-3 proíbe (dois donos do mesmo conceito). O `bundle ID` divergente ainda contradiz o que o CLAUDE.md registra como invariante de build (`com.sydtpt.vitale`, "renomear quebraria builds/entitlements"). A espinha não cobre nem menciona esses arquivos.

---

## F. Não confirmado

Registrado como não confirmado em vez de suposto, conforme a regra da lente.

| Afirmação | Onde | Por quê |
| --- | --- | --- |
| *"cinco pares de lógica idêntica divergindo hoje, **com 85% de co-change**"* | `ARCHITECTURE-SPINE.md:45` | O `.memlog.md` da sessão registra "5 pares ativos hoje" (linha 23) e "21 basenames duplicados" com contagens de linha por par (linha 11), mas **nenhuma medição de co-change** e nenhum "85%". A métrica não é derivável do repo sem análise de histórico do git que não está registrada em lugar nenhum. É o tipo exato de número específico que a lente procura: preciso demais para ser estimativa, sem fonte para ser fato. |
| *"`user_profiles`... `n_tup_ins = 0` (nunca recebeu insert)"* | `ARCHITECTURE-SPINE.md:187` | Estatística de catálogo do Postgres de produção; não verificável a partir do repositório em modo leitura. As demais partes da mesma linha **conferem**: nenhum código referencia `user_profiles`. |
| Status atual da regressão de EAS Update em SDK 54 | ver B-2 | Três issues abertas por usuários, uma delas fechada **sem resposta de staff nem resolução registrada**. Nenhuma comunicação oficial da Expo localizada. |
| Versão de Deno do Supabase Edge Runtime | ver C-4 | A doc oficial descreve "Deno compatible runtime" sem fixar versão. |

---

## Resumo por severidade

| # | Achado | Severidade |
| --- | --- | --- |
| B-1 | React Native 0.81.5 está `Unsupported` upstream; a Stack registra o número sem sinalizar, e não há item em `Deferred` | critical |
| C-1 | A nota da Stack culpa `mobile/ios/`+prebuild pelo travamento do mobile; o gargalo real é `newArchEnabled: false` com RN 0.81/SDK 54 sendo os últimos a aceitar a arquitetura legada | high |
| D-3 | AD-4 (`139 chamadas`, `14 tabelas`) e a catraca da AD-7 descrevem um passivo hoje em zero — o próprio `architecture.test.ts` declara as 4 checagens como BARREIRA | high |
| D-1 | AD-13 cita `echo 'No tests yet'` e "três arquivos de teste"; o script virou runner tsx real e são cinco arquivos, mudados em `94f58c0` no mesmo dia da publicação | high |
| A-3 | Oito dependências load-bearing fora da Stack: `expo-router`, `react-native-health`, `leaflet`/`maplibre-gl`, `zone.js`, `tsx`, `react-native-svg`/`view-shot`/`webview`, Node engine | high |
| A-2 | `patch-package` e o patch pinado `@supabase+supabase-js+2.106.0.patch` ausentes; o `2.106` é pin duro e o bump derruba o patch em silêncio | high |
| B-2 | Expo SDK 54 a ~1 mês do fim de vida (3 SDKs atrás); relatos não confirmados de EAS Update recusando SDK 54 desde 2026-05-01, com OTA ligado em `mobile/app.json` | high |
| E-1 | `app.json`/`eas.json` órfãos na raiz com `bundleIdentifier` e `projectId` divergentes do `mobile/` | medium |
| C-2 | `security_invoker = true` é correto por doc, mas não há nenhuma view no repo e o precedente citado (`route_overview`) é coluna gerada `stored`, não view | medium |
| C-3 | AD-9 diz "anon key"; o repo usa `sb_publishable_...` e a Supabase aposenta `anon`/`service_role` até o fim de 2026 — o invariante sobrevive, o nome não | medium |
| D-2 | AD-9 previne uma etapa de substituição de placeholder já deletada (`environment.prod.ts`, sem `fileReplacements` no `angular.json`) | medium |
| A-1 | Stack diz "TypeScript 5.9"; `packages/shared` — o núcleo — está em `~5.8.0` | medium |
| B-3 | Angular 21 fora do suporte ativo desde 2026-06-03 (LTS até 2027-06-30); corrente é 22.1.2 | medium |
| B-4 | Stack cita TS 5.9 sem registrar como decisão; estável é 7.0.2 desde 2026-08-05 | medium |
| B-6 | `engines.node: ">=20.0.0"`; Node 20 EOL em 2026-04-30 (máquina em v22.14.0) | medium |
| F | "85% de co-change" (AD-1) sem fonte no memlog nem derivável do repo | medium |
| B-5 | Drift menor de patch: supabase-js 2.106→2.112.3, Vitest 4.1.10→4.1.11, Zustand 5.0.13→5.0.15, Jest 29→30 (travado por `jest-expo`) | low |

## Confirmado sem ressalva

AD-6 (Deno) · AD-7 (guarda existe, roda, 4 checagens reais; sem CI e sem hooks) · AD-11 (11 ADRs numerados em `docs/decisions/`) · AD-12 (exatamente 10 stores na allowlist) · AD-10 (`AGENTS.md` na raiz + 3 workspaces) · `Deferred` das 28 migrations com comentário `.claude/specs` (28/42) · `Deferred` de `running-highlights.ts` · `mobile/ios/` versionado em bare workflow · direção de dependência do diagrama (0 `.from(` fora do núcleo, núcleo não importa app, núcleo não constrói client).

---

## Recomendação mínima

1. **Reancorar as ADs 4, 7, 9 e 13** ao repositório de 2026-08-18: os números da AD-4 e a catraca da AD-7 são história, não estado; as evidências das ADs 9 e 13 foram removidas em `94f58c0`. As *regras* estão certas — o que precisa mudar é o tempo verbal e o número.
2. **Corrigir C-1**, que é a única imprecisão que muda uma estimativa de trabalho: trocar "trabalho de prebuild" por "migração de New Architecture" e criar o item correspondente em `Deferred`, com condição de revisita — a mais natural sendo o fim de vida da SDK 54 em Set/Out 2026.
3. **Completar a Stack** com as oito dependências de A-3, o pin do patch de A-2, e a divergência de TS do núcleo em A-1. Marcar RN 0.81.5, Expo 54, Angular 21 e Node 20 com o status de suporte, não só com o número.
4. **Renomear "anon key" para "publishable key"** na AD-9 e em Consistency Conventions — a própria AD-3 exige um nome por conceito, e este está sendo retirado pelo fornecedor até o fim de 2026.
5. **Remover ou reconciliar** `app.json` e `eas.json` da raiz (E-1) — é a mesma classe de config morta que a AD-9 existe para eliminar.
