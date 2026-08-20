---
lens: 'deriva espinha × código'
target: '../ARCHITECTURE-SPINE.md'
date: '2026-08-18'
method: 'varredura do código com leitura apenas; guarda executada; análise de pureza transitiva e de similaridade de conteúdo entre os apps'
verdict: 'as regras continuam certas; a descrição já não é verdadeira, e três ADs estão violadas exatamente onde a guarda é cega'
---

# Review — deriva entre a espinha e o código

## Veredito

**A espinha continua sendo o contrato certo para o que vem depois, mas parou de ser uma descrição verdadeira do repositório — e as violações que existem hoje estão todas no ponto cego estrutural da guarda da AD-7.**

Duas coisas separadas, e vale não confundi-las:

1. **Como contrato**, a espinha resistiu bem. Nenhuma AD precisou ser revogada pela consolidação. A AD-4 pegou a divergência silenciosa de schema, a AD-6 foi respeitada até dentro do Deno (`supabase/functions/_shared/ingest.ts:18-25` importa o kernel de dedupe do núcleo em vez de recopiá-lo), a AD-11 se sustenta (as 11 ADRs têm exatamente 1 commit cada), a AD-12 acertou o número na mosca (10 pares de store, nem um a mais).

2. **Como descrição**, ela está datada em quase toda afirmação quantitativa, e — mais grave — ela declara uma cobertura mecânica que a guarda não entrega. A guarda compara **basenames** e varre **2 das 4 árvores**. Toda a duplicação que sobrou hoje está fora desse alcance, e não por acaso: o próprio histórico da consolidação estabeleceu o precedente de **renomear para sair da guarda**, duas vezes, com justificativas que não se sustentam à conferência.

Estado mecânico verificado: `npm run test` verde nos três workspaces (shared 38 asserts em 5 arquivos, web 123, mobile 349); as 4 checagens da guarda passam; zero `.from(` em `web/src` e `mobile/src`; zero derivação de data em UTC no repositório inteiro; nenhuma função do núcleo muta parâmetro de entrada.

---

## 1. As ADs contra o código

| AD | Obedecida hoje? | Ainda tem trabalho? | Severidade da deriva |
| --- | --- | --- | --- |
| AD-1 — fronteira núcleo/adaptador | **Não** | Sim — 21 módulos, ~2.090 linhas | critical |
| AD-2 — arquivo que mistura é partido | **Não** | Sim — é o que trava a AD-1 | critical |
| AD-3 — dono único do vocabulário | **Não** | Sim — `localDateStr` tem 3 donos | high |
| AD-4 — schema no núcleo, client injetado | Parcial | Sim — `supabase/functions/` fora do contrato | high |
| AD-5 — banco como exceção nomeada | Sim | Não — virou histórico | — |
| AD-6 — edge function só p/ segredo | **Sim** | Não | — |
| AD-7 — guarda mecânica | Roda, mas é cega | Sim — método precisa mudar | high |
| AD-8 — instância Supabase única | Sim | Não | — |
| AD-9 — build sem segredo | Sim | Resíduo cosmético | low |
| AD-10 — conhecimento estratificado | Sim | Não | — |
| AD-11 — ADR imutável | **Sim** | Não | — |
| AD-12 — estado é do app | Sim | Não — número ainda exato | — |
| AD-13 — target de teste não é stub | Sim | Sim — cobertura em parte no lugar errado | medium |

### CRITICAL — C1. `overview.ts` × `activity-overview.ts`: a maior duplicata do repositório, invisível para a guarda

Viola **AD-1**, **AD-2** e a segunda frase da **AD-3**.

- `web/src/app/features/workout-history/data/overview.ts` (305 linhas)
- `mobile/src/lib/activity-overview.ts` (331 linhas)

Medido: **11 de 11 exports em comum** (`Period`, `Metric`, `TypeSegment`, `OverviewBucket`, `OverviewTotals`, `LegendItem`, `Overview`, `metricValue`, `buildOverview`, `earliestActivityYear`, `overviewYears`) e **199 linhas idênticas** após normalizar espaço e comentário. Os dois importam **exatamente o mesmo conjunto** do núcleo:

```ts
import { DEFAULT_WEEKLY_TARGET_MIN, effectiveSeconds, elapsedFraction, mondayOf, weeklyTargetSeconds } from '@vitale/shared';
```

O cabeçalho do arquivo do mobile confessa a origem, em `mobile/src/lib/activity-overview.ts:3`:

> `* Portado de web/.../data/overview.ts. Sem dependência de react-native —`

A única diferença real de dependência é o provedor de ícone/cor: `metaForActivity` (web, `overview.ts:8`) contra `getActivityMeta`/`getActivityColor` (mobile, `activity-overview.ts:8`). Isso é o caso-livro da **AD-2**: parta o arquivo, injete o provedor de apresentação, a metade pura sobe.

**Por que escapou.** O inventário de duplicação (`_bmad-output/specs/spec-consolidacao-arquitetural/inventario-duplicacao.md`) foi construído por basename, e a guarda também. `overview` ≠ `activity-overview`, então o par nunca apareceu em nenhuma das duas listas — nem entre "os cinco pares medidos", nem entre os "basenames duplicados não medidos". Não é um diferimento consciente: **é um buraco de método**, e é maior que qualquer um dos cinco pares que a consolidação de fato fechou (o maior deles, `todo-logic`, tinha 274 linhas).

Co-change confirma que é uma cópia viva, não código morto: `git log` sobre os dois caminhos dá 7 commits, **3 deles tocando os dois arquivos no mesmo commit** (`b8de47e`, `1d15659`, `ff3f6a5`).

Na mesma família, menor mas idêntico em natureza: `web/src/app/features/workout-history/data/type-summary.ts` × `mobile/src/lib/activity-type-summary.ts` — 2 de 2 exports em comum, 23 linhas idênticas.

### HIGH — C2. `localDateStr` tem três definições vivas, e o núcleo afirma ser a única

Viola **AD-3** frontalmente, e é a função que carrega a convenção de data do projeto inteiro.

`packages/shared/src/date/local.ts:1-7` diz, textualmente:

> `* Todo o Orbe usa a data do **dispositivo**, nunca UTC (...)`
> `* Estas funções são a única forma de derivar 'YYYY-MM-DD' no projeto.`

Não são. Existem três definições:

| Arquivo:linha | Situação |
| --- | --- |
| `packages/shared/src/date/local.ts:14` | dono declarado; criado pela consolidação em `602d983` |
| `web/src/app/features/registros/data/registro-logic.ts:9` | cópia viva |
| `web/src/app/features/saude/data/health-format.ts:8` | cópia viva |

E as cópias não são resíduo esquecido — são **consumidas de propósito** por stores que poderiam importar do núcleo:

- `web/src/app/features/registros/data/registros.store.ts:5` → `import { localDateStr } from './registro-logic';`
- `web/src/app/features/saude/data/health.store.ts:5` → `import { localDateStr } from './health-format';`

O agravante é o alvo. A convenção "data local `YYYY-MM-DD`, nunca UTC" é a única da tabela `Consistency Conventions` cuja quebra produz bug silencioso de fuso. Hoje as três implementações concordam — foi exatamente assim que os cinco pares consolidados começaram.

Na carona, `formatNumber` duplica verbatim entre `web/src/app/features/saude/data/health-format.ts:34` e `mobile/src/lib/health-buckets.ts:153`, e `formatHoursMin` entre `health-format.ts:26` (privado) e `health-buckets.ts:160` (exportado). Ver C3 — este par é justamente o que foi **renomeado para longe** da guarda.

### HIGH — C3. "Renomear em vez de allowlistar" virou precedente, e as duas justificativas não conferem

O commit `4b7d711` renomeou dois pares "porque NÃO eram duplicatas", com esta razão explícita na mensagem:

> `Renomear em vez de allowlistar: cada nome extra na allowlist da guarda é uma exceção que ninguém revisita depois.`

A intenção é boa. A execução, conferida contra o código, falha nos dois casos:

**`mock-data` → `hoje-fixtures`.** A mensagem afirma "fixtures diferentes, símbolos diferentes (HOJE contra LIFTS/FINANCAS/HEATMAP)". Conferido:

| `web/src/app/core/models/mock-data.ts` | `mobile/src/services/hoje-fixtures.ts` |
| --- | --- |
| `WEEK` (:7) | `WEEK` (:8) |
| `TODAY_IDX` (:8) | `TODAY_IDX` (:9) |
| `HEATMAP` (:10) | `HEATMAP` (:49) |
| `HOJE` (:20) | `HOJE` (:11) |
| `TREINOS_SEMANA` (:52) | `TREINOS_SEMANA` (:59) |

**5 dos 6 exports do mobile também existem na web**, incluindo `HEATMAP`, citado na mensagem como prova de que eram diferentes. 44 linhas idênticas.

**`health-format` → `health-buckets`.** A mensagem afirma "A da web, com 62 linhas, de fato só formata datas". Mas é justamente na parte de formatação que estão as duplicatas (`formatNumber`, `formatHoursMin` — ver C2), e a da web também carrega `localDateStr` e `lastNDates`, que são derivação de data, não formatação.

Baixo risco material nos dois casos (fixtures e formatadores curtos). O problema é o **mecanismo**: o repositório agora tem precedente commitado de que renomear é a saída aceitável quando a guarda acusa, e a conferência que justificou o rename foi feita por leitura de nomes de export, não por comparação de conteúdo. C1 é o que esse mecanismo custa quando o arquivo é grande.

### HIGH — C4. A AD-4 é silenciosa sobre `supabase/functions/`, e a guarda também

A AD-4 vincula "**todo** acesso a tabela do Supabase". A CAP-6 declara sucesso como "nenhuma chamada `.from(` fora de `packages/shared/src/data/`". Medido hoje:

| Árvore | `.from(` |
| --- | ---: |
| `web/src` | 0 |
| `mobile/src` | 0 |
| `packages/shared/src/data` | 77 (18 tabelas, 16 módulos) |
| **`supabase/functions` + `supabase/scripts`** | **30** |

As 30: `activities` (12), `linked_accounts` (7), `linked_account_secrets` (5), `activity_routes` (5), `user_preferences` (1), em `supabase/functions/_shared/ingest.ts`, `supabase/functions/strava-oauth/index.ts` e `supabase/functions/intervals-link/index.ts`.

A guarda não as vê porque só varre duas árvores — `packages/shared/src/architecture.test.ts:46-47`:

```ts
const webFiles = walk(join(ROOT, 'web', 'src')).filter(...);
const mobileFiles = walk(join(ROOT, 'mobile', 'src')).filter(...);
```

Há **razão técnica boa** para a exceção: o runtime é Deno, o client é service-role (ignora RLS), e `linked_account_secrets` é uma tabela que os apps não podem tocar — ela é, aliás, a **única das 19 tabelas alcançáveis sem módulo dono** em `packages/shared/src/data/`, contrariando "cada tabela tem exatamente um módulo dono do seu acesso".

O problema não é a exceção — é que ela **não está escrita em lugar nenhum**. A AD-4 diz "todo", a CAP-6 declara zero, e quem ler amanhã vai concluir que edge function é território livre ou que a guarda cobre o que não cobre. Isto é violação de contrato por omissão, não diferimento consciente: nenhum documento a registra.

### HIGH — C5. O método da guarda é uma renomeação de distância da cegueira total

A AD-7 diz que a guarda impede a AD-1..AD-4 de "virarem prosa não verificada". Ela impede menos do que promete. Quatro limites, todos em `packages/shared/src/architecture.test.ts`:

1. **Detecção por basename** (`:74-87`) — não vê C1 (~300 linhas), nem C2 (símbolo duplicado dentro de arquivos com nomes distintos). Qualquer duplicata sobrevive a um `git mv`.
2. **Escopo de 2 de 4 árvores** (`:46-47`) — não vê C4.
3. **Regex de aspas simples** (`:96`) — `/\.from\('[a-z_]+'/` não pega `.from("x")`, `` .from(`x`) `` nem tabela com maiúscula ou dígito. Hoje não há nenhum caso, mas a barreira é contornável sem intenção.
4. **Zero imposição fora do `npm run test`** — confirmado: não existe `.github/workflows`, não existe `.husky`, `.git/hooks` só tem samples.

Recomendação concreta: trocar a checagem de basename por comparação de **conjunto de símbolos exportados** entre as árvores (foi o que achou C1 aqui, em ~40 linhas de script), e estender a varredura de `.from(` a `supabase/` com allowlist explícita e escrita.

### MEDIUM — C6. 21 módulos transitivamente puros continuam fora do núcleo

Análise de pureza **transitiva** (fecho de imports, seguindo relativos e os aliases `@core/`/`@features/`; `@supabase/*` não conta como plataforma, conforme a Assumption resolvida do SPEC). Excluídos `supabase.client.ts` e `environment.ts`, que são adaptador legítimo:

```
 312  mobile/src/lib/health-buckets.ts
 305  web/src/app/features/workout-history/data/overview.ts
 228  web/src/app/features/workout-history/data/running-highlights.ts   [diferido — OK]
 135  mobile/src/lib/health-aggregate.ts
 135  web/src/app/features/workout-history/data/activity-list.ts
 135  web/src/app/features/workout-history/data/weekly-load.ts
 105  web/src/app/core/models/mock-data.ts
  93  web/src/app/core/models/activity-types.ts
  83  mobile/src/lib/heart-rate-zones.ts
  75  mobile/src/services/hoje-fixtures.ts
  64  mobile/src/lib/workout-format.ts
  63  web/src/app/features/saude/data/health-format.ts
  55  web/src/app/features/registros/data/registro-logic.ts
  54  mobile/src/lib/activity-todo-link.ts
  51  mobile/src/lib/health-readiness.ts
  50  web/src/app/features/workout-history/data/type-summary.ts
  45  mobile/src/lib/share-fonts.ts
  42  web/src/app/features/workout-history/data/format.ts
  29  mobile/src/lib/share-activity-icons.ts
  23  web/src/app/features/semana/data/weekly-recap.ts
   8  web/src/app/features/saude/data/trigger-impact.ts
```

~2.090 linhas. Pela letra da AD-1 ("módulo que não importa API de plataforma pertence a `packages/shared`"), cada uma é uma violação. Nem todas merecem movimento — `share-fonts.ts` e `trigger-impact.ts` não têm par e mover não paga. Mas a AD-1 não abre essa exceção, e a espinha não diz onde ela para. **Ou a AD-1 ganha um critério de corte escrito (ex.: "sobe quando houver segundo consumidor ou par cross-app"), ou ela é uma regra que o repositório viola 21 vezes e ninguém trata como violação.**

### MEDIUM — C7. A AD-1 tem uma brecha de `import type` que hoje é load-bearing

A AD-1 diz "o critério é o conjunto de imports, nunca um julgamento". Literalmente aplicado, um `import type` conta — e ele é apagado na compilação.

`mobile/src/lib/workout-types.ts:5`:

```ts
import type { MaterialCommunityIcons } from '@expo/vector-icons';
```

É a **única** dependência de plataforma daquele módulo. Ela contamina, por transitividade, `mobile/src/lib/activity-overview.ts` e `mobile/src/lib/activity-type-summary.ts` — os dois lados mobile de C1. Ou seja: a metade mobile da maior duplicata do repositório está isenta da AD-1 por um import que não existe em runtime.

O ajuste é de uma frase na regra: importação **somente de tipo** não conta como API de plataforma. Com ela, C1 deixa de precisar de julgamento e passa a ser pego mecanicamente.

### MEDIUM — C8. A cobertura de teste do núcleo mora nos adaptadores

A CAP-1 diz "o núcleo compartilhado roda seus próprios testes". Parcialmente:

| Runner | Arquivos que exercitam `@vitale/shared` |
| --- | ---: |
| `packages/shared` (tsx) | 5 (dos quais 1 é a guarda) |
| `mobile` (Jest) | **16** de 29 |
| `web` (Vitest) | **10** |

Arquivos como `mobile/src/lib/__tests__/todo-logic.test.ts`, `habit-logic.test.ts`, `moving-time.test.ts`, `week-highlights.test.ts` e `fitness-dedupe.test.ts` testam código que hoje vive em `packages/shared/src/`. Funciona, e `npm run test` na raiz roda tudo. Mas o núcleo não é verificável isoladamente: `npm test -w @vitale/shared` exercita uma fração pequena do que o núcleo faz, e a garantia da AD-13 ("falhar é aceitável; mentir que passou, não") fica dependente de um workspace de adaptador continuar existindo.

Não é violação de regra escrita — é a AD-13 cumprida na letra e vazando no espírito.

---

## 2. Números e afirmações que envelheceram

Cada linha abaixo é prosa em **presente** na espinha que descreve um estado que não existe mais. Quem ler a espinha amanhã sem ler os commits vai agir sobre o repositório errado.

| Onde | Texto na espinha | Realidade em 2026-08-18 |
| --- | --- | --- |
| AD-1 · Prevents | "cinco pares de lógica idêntica divergindo **hoje**, com 85% de co-change" | Os cinco foram consolidados (`602d983`, `d8d4e3b`, `279fdea`, `acf0e2c`, `0bad0e0`). O passivo que sobra é outro e maior — C1 |
| AD-3 · Prevents | "`GPS_ACTIVITY_IDS` definido em web e mobile enquanto o núcleo detém apenas os rótulos" | Dono único em `packages/shared/src/fitness/activity-types.ts:48`; web e mobile só re-exportam (`web/src/app/core/models/activity-types.ts:16`, `mobile/src/lib/workout-types.ts:114`). Os 4 conjuntos têm teste de disjunção |
| AD-4 · Binds | "**139 chamadas hoje**, 14 tabelas em comum entre os apps" | 0 nos apps; 77 em `packages/shared/src/data/` sobre 18 tabelas em 16 módulos; 30 em `supabase/functions` (C4) |
| AD-7 · Rule | "Uma checagem cujo passivo ainda está sendo drenado entra como **catraca**" | Nenhuma catraca resta. As 4 checagens são BARREIRA — o próprio arquivo registra a transição (`architecture.test.ts:89-93`). O texto sobre catraca segue **útil como política**, mas não descreve mais o estado |
| AD-7 · Prevents | "não há CI nem git hooks neste repositório" | **Ainda verdadeiro** — verificado: sem `.github/workflows`, sem `.husky`, `.git/hooks` só samples |
| AD-12 · Binds | "os 10 pares de store duplicados" | **Ainda exato.** Web tem exatamente os 10 da allowlist; mobile tem 17 (7 sem par: `auth`, `chart-palette`, `fitness`, `health-daily`, `meals`, `settings`, `transactions`). Nenhuma entrada da allowlist está obsoleta |
| AD-13 · Prevents | "`packages/shared` tem **três** arquivos de teste e um script `echo 'No tests yet'`, e eles **nunca rodaram**" | Obsoleto por inteiro. 5 arquivos de teste, script real (`find src -name '*.test.ts' \| xargs -n1 tsx`), 38 asserts verdes |
| Stack | "TypeScript 5.9" | Uma linha escondendo duas versões: `web` e `packages/shared` declaram `~5.9`, **`mobile` declara `~5.8.0`** e resolve para 5.8.3 hoisted. O núcleo é consumido pelos dois — feature de 5.9 no núcleo quebra o `tsc` do mobile |
| Stack | Angular 21, Vitest 4, Expo 54, RN 0.81.5, React 19.1.0, Zustand 5, Jest 29, supabase-js 2.106 | Confere: 21.2.13 · 4.1.10 · 54.0.34 · 0.81.5 · 19.1.0 · 5.0.13 · 29.7.0 · 2.106.0 |

**Recomendação de forma, não só de conteúdo:** a espinha misturou *invariante* (durável) com *medição* (perecível) dentro do mesmo campo `Prevents`. Pela própria AD-10 — "o que é derivável do código não se escreve" — o número pertence ao inventário, não à AD. O `Prevents` deveria nomear a **classe** de falha ("duplicação de cálculo entre os apps"), e o inventário datado carregar a contagem. Feito isso, esta seção inteira deixa de reaparecer na próxima revisão.

---

## 3. `Structural Seed` × árvore real

A seed está **incompleta em todas as quatro raízes**, e a maior parte do que falta foi criada **pela consolidação que a espinha autorizou**.

### `packages/shared/src/` — 5 diretórios e o arquivo mais importante ausentes

| Real | Na seed? |
| --- | --- |
| `data/ models/ constants/ fitness/ health/ goals/ week/ period/ chart/ geo/` | sim |
| **`todo/`** (`logic.ts`, `format.ts`) | **não** — criado em `602d983` |
| **`habits/`** (`logic.ts`) | **não** — criado em `d8d4e3b` |
| **`planner/`** (`planned-match.ts`) | **não** — criado em `279fdea` |
| **`format/`** (`workout.ts`) | **não** — criado em `2a26eb2` |
| **`date/`** (`local.ts`) | **não** — criado em `602d983`; é o dono da convenção de data (C2) |
| **`architecture.test.ts`** | **não** — é a AD-7 inteira, na raiz de `src/` |

A ausência de `date/` é a que mais custa: é o módulo que a espinha manda usar na tabela de convenções, e ele não aparece no mapa que a espinha desenha do núcleo.

### `web/src/app/` — só 2 de 5 entradas

Seed lista `core/supabase/` e `features/`. Real: `core/` tem `auth/`, `models/`, `services/`, `supabase/`, e existe `shared/` (`components/`, `layouts/`). `core/models/` guarda `activity-types.ts` e `mock-data.ts` — dois dos módulos puros de C6, num diretório que a seed não menciona.

### `mobile/src/` — 3 de 8 entradas, e a descrição de `lib/` é falsa

Seed lista `lib/`, `store/`, `app/`. Real, além desses: `components/`, `config/`, `hooks/`, `services/`, `theme/`.

Pior que a omissão é a glosa. A seed descreve `lib/` como:

> `lib/           # adaptadores nativos (HealthKit, tipos de workout)`

Conferido: `mobile/src/lib/` tem **32 arquivos, dos quais só 8 importam API de plataforma** (`activity-type-summary.ts`, `habit-icons.ts`, `healthkit-workouts.ts`, `local-store.ts`, `share-export.ts`, `supabase.ts`, `workout-types.ts`, `tab-bar-scroll.tsx`). Os outros 24 são módulos puros ou quase — e um deles, `activity-overview.ts`, é metade de C1. A seed descreve `lib/` como o lugar dos adaptadores; na prática ele é o **maior depósito de lógica de domínio fora do núcleo**, e a descrição da espinha ativamente desencoraja quem for procurar lá.

### `supabase/` e `docs/`

`supabase/`: seed lista `migrations/` e `functions/`. Faltam `config.toml` e **`scripts/`** — que contém `check-schema-drift.sh`, a ferramenta de detecção de desvio criada em `c4f9f8f`/`694ca77` e citada como "comando documentado" nas Constraints do SPEC. Um artefato de imposição arquitetural fora do mapa da arquitetura.

`docs/`: seed lista `decisions/` e `specs/`. **Confere** — 11 ADRs + README, 44 `.md` em 16 pastas de spec. Os 28 links de `docs/`/`_bmad-output/` no `CLAUDE.md` resolvem, todos (verificado arquivo a arquivo).

---

## 4. Os `Deferred`, um a um

| Item | Condição disparou? | Situação |
| --- | --- | --- |
| **Alvo de hospedagem do web** | **Não** | Nada publicado; `web/src/environments/environment.ts` é o único arquivo de environment e não há `fileReplacements` em `web/angular.json`. Diferimento válido e intacto. Resíduo cosmético: o arquivo mantém `production: false` (que um build de prod herdaria) e `apiUrl: 'http://localhost:3000/api'` (`:2-3`), que **nenhum código lê** — só `appUrl` é usado, em `web/src/app/core/auth/auth.service.ts:29`. Pequena contradição com a CAP-8 ("configuração que não mente") |
| **Pipeline de CI** | **Sim, por outro caminho** | A condição escrita é "quando a guarda passar a ser burlada por **esquecimento** de rodar `npm run test`". Não foi esquecimento: a guarda **rodou, passou, e não viu** C1 nem C4. A condição está escrita contra o modo de falha errado. CI não resolveria C1 — rodar mais vezes uma checagem cega não a torna vidente. **Recomendação: não construir o CI ainda; reescrever a condição** para cobrir "quando a guarda passar sem enxergar uma violação conhecida", que é o estado de hoje, e corrigir o método antes (C5) |
| **Segunda instância Supabase** | **Não** | Um usuário, uma instância — `web/src/environments/environment.ts:4` e `mobile/src/lib/supabase.ts:4` apontam para o mesmo projeto. Intacto |
| **Comentários `.claude/specs` nas 28 migrations** | **Não, e nem deve** | Verificado: exatamente **28** migrations referenciam `.claude/specs`, e o tombstone existe em `.claude/specs/README.md`, resolvendo os ponteiros. Único item da seção que continua **100% exato**. Nota menor: `grep` também acerta 2 arquivos em `_bmad-output/implementation-artifacts/` (`deferred-work.md:50`, `spec-testes-do-web-com-vitest.md:77`), que são registro histórico de processo — não afeta o diferimento, mas torna o critério literal da CAP-2 ("retorna apenas migrations e o tombstone") tecnicamente falso |
| **`running-highlights.ts` duplicado** | **Disparou durante a própria consolidação** | A condição é "quando alguém encostar em highlights". O commit `2a26eb2` **encostou** — alterou 6 linhas em `web/src/app/features/workout-history/data/running-highlights.ts` ao renomear os formatadores. O diferimento foi reafirmado no mesmo commit em vez de executado. Defensável (a mudança era mecânica, não de design), mas a condição, como escrita, já não filtra nada. Estado atual: 5 de 5 exports em comum, 150 linhas idênticas, devidamente na allowlist `DEFERRED` da guarda (`architecture.test.ts:72`) — **este é diferimento consciente e registrado, não violação** |
| **`drop` de `user_profiles`** | **Não** | Nenhuma referência em código (só em documentos de planejamento). Continua aguardando decisão do dono do banco. Intacto |

---

## 5. `Consistency Conventions` — as verificáveis mecanicamente

| Convenção | Resultado | Evidência |
| --- | --- | --- |
| **Data local `YYYY-MM-DD`, nunca UTC** | ✅ na prática · ⚠️ no dono | **Zero** ocorrências de `toISOString().slice(0,10)`, `.substring(0,10)` ou `.split('T')[0]` em `packages/shared/src`, `web/src`, `mobile/src` e `supabase/functions`. A convenção é obedecida em todo lugar. Mas o **dono** dela está trincado — 3 definições de `localDateStr` (C2) |
| **`select('*')` proibido em tabela grande** | ✅ | 7 ocorrências, todas em tabelas de payload pequeno: `todo_templates` (4), `goals`, `todo_occurrences`, `user_preferences`. A de `user_preferences` traz justificativa escrita no próprio módulo (`packages/shared/src/data/user-preferences.ts:4`), como o SPEC exige. E o caso perigoso está protegido por comentário explícito: `packages/shared/src/data/activities.ts:4` — "**Nunca leia `activity_routes` com `select('*')`** — a coluna `points` guarda o…". Nenhuma leitura de `activity_routes` ou `activities` usa `*` |
| **Pureza e imutabilidade no núcleo** | ✅ | Todas as 14 chamadas de `.sort()`/`.reverse()` em `packages/shared/src` operam sobre array **recém-criado** (`[...x]`, `.map()`, `.filter()`, `[...map.keys()]`), nunca sobre parâmetro. Conferidos individualmente os dois casos ambíguos: `planner/planned-match.ts:80` ordena arrays construídos dentro da própria função; `fitness/streams.ts:253` ordena o resultado de um `.filter()`. Zero `push`/`splice` sobre entrada |
| **Núcleo não constrói client** | ✅ | Guarda ativa (`architecture.test.ts:114-124`). `createClient` só em `web/src/app/core/supabase/supabase.client.ts:8`, `mobile/src/lib/supabase.ts:13` e nos `_shared/` do Deno |
| **Segredos** | ✅ | Anon key versionada em `environment.ts:5` (é `sb_publishable_*`, pública por design); mobile lê de `process.env.EXPO_PUBLIC_*`; `.env` ignorado na raiz (`.gitignore:27-29`) e no mobile (`mobile/.gitignore:8-9`) |
| **Um nome por conceito** | ⚠️ | É a convenção que C1, C2 e C3 quebram. Mecanicamente inverificável hoje, porque a guarda compara nome de arquivo, não conceito |
| **Aviso de sincronia manual** | ⚠️ low | O commit `4b7d711` declarou remover "o último aviso manual de sincronia do repositório". Sobrou um, em `web/src/app/core/models/activity-types.ts:1-6`: "*Espelha `getActivityMeta`/`GPS_ACTIVITY_IDS` de mobile/src/lib/workout-types.ts (…) **Mantenha os labels idênticos ao mobile** para coerência entre plataformas*". O aviso está, além de sobrevivente, **desatualizado**: os labels vêm hoje do núcleo (`ACTIVITY_TYPE_LABELS`), não do mobile |

---

## Triagem

### critical
1. **C1** — `overview.ts` × `activity-overview.ts`: 11/11 exports, 199 linhas idênticas, cópia autodeclarada no cabeçalho. Maior que qualquer par que a consolidação fechou. Viola AD-1, AD-2, AD-3.

### high
2. **C2** — `localDateStr` com 3 definições vivas, duas delas ativamente importadas por stores, enquanto o núcleo se declara "a única forma". Viola AD-3 no ponto de maior risco de bug silencioso.
3. **C4** — AD-4 diz "todo acesso" e a CAP-6 declara zero, mas 30 `.from(` vivem em `supabase/functions/`, fora do alcance da guarda e sem exceção escrita em lugar nenhum. `linked_account_secrets` é a única tabela sem módulo dono.
4. **C5** — o método da guarda (basename + 2 de 4 árvores + regex de aspas simples) é contornável por `git mv`, e o repositório já tem precedente commitado de contorná-lo.
5. **C3** — as duas justificativas de rename do commit `4b7d711` não conferem contra o código (5 de 6 símbolos em comum num caso; formatadores duplicados no outro).

### medium
6. **C6** — 21 módulos puros (~2.090 linhas) fora do núcleo; a AD-1 não escreve onde a regra para, então ou ganha critério de corte ou é violada 21 vezes por definição.
7. **Seed desatualizada** — 5 diretórios do núcleo criados pela própria consolidação estão ausentes, o arquivo da guarda não aparece, e a glosa de `mobile/src/lib/` ("adaptadores nativos") é falsa para 24 de 32 arquivos.
8. **C7** — `import type` conta como plataforma pela letra da AD-1, e é exatamente o que isenta a metade mobile de C1.
9. **C8** — 26 dos ~31 arquivos de teste que exercitam o núcleo moram nos adaptadores; `npm test -w @vitale/shared` cobre uma fração.
10. **Números obsoletos em presente** — AD-1, AD-3, AD-4, AD-13 e a prosa de catraca da AD-7 descrevem um repositório que não existe mais.

### low
11. `web/src/app/core/models/activity-types.ts:1-6` — aviso de sincronia manual sobrevivente **e** desatualizado.
12. Stack: "TypeScript 5.9" esconde mobile em `~5.8.0` contra web/shared em `~5.9`.
13. `environment.ts:2-3` — `production: false` no único arquivo de environment e `apiUrl` que nenhum código lê.
14. CAP-2: `grep -r "\.claude/specs"` também acerta 2 arquivos em `_bmad-output/`, tornando o critério literal falso (sem consequência prática).

---

## Resposta à pergunta da lente

**A espinha ainda descreve a realidade?** Não. As regras sim; os fatos não. Toda medição envelheceu, a seed perdeu cinco diretórios que a própria consolidação criou, e a descrição de `mobile/src/lib/` aponta na direção contrária de onde a lógica de domínio realmente está.

**Ainda é útil como contrato para o que vem depois?** Sim — e é o achado mais importante desta revisão. Nenhuma das 13 ADs precisou ser revogada; a AD-4 pagou por si só ao expor divergências de schema que ninguém procurava, e a AD-6 se sustentou até no runtime Deno. O que a espinha precisa não é de revisão de decisão, é de **três correções de precisão**:

1. **Separar invariante de medição** (AD-10 aplicada a ela mesma): o `Prevents` nomeia a classe de falha, o inventário datado carrega o número. Isso remove a seção 2 desta revisão permanentemente.
2. **Escrever a fronteira que a AD-4 não escreveu**: `supabase/functions/` é exceção nomeada, com razão (service-role, Deno, `linked_account_secrets`), ou a guarda passa a varrê-lo.
3. **Trocar o método da AD-7 de nome para símbolo**: enquanto a checagem for por basename, a espinha promete uma cobertura que não tem — e C1 é a prova de quanto isso custa em linhas.

Feitas essas três, a espinha volta a ser o que se propôs a ser: substrato do qual a próxima feature nasce consistente, e não um retrato de 2026-08-17 com moldura de contrato.
