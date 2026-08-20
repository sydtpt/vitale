---
lens: adversarial
target: ARCHITECTURE-SPINE.md (Orbe, 2026-08-17)
reviewer: Reviewer Gate — lente adversarial
date: 2026-08-18
method: construir duas unidades um nível abaixo que obedeçam TODAS as ADs e ainda assim se construam incompatíveis
verdict: a espinha governa bem a LEITURA e o CÁLCULO; não governa ESCRITA, ORQUESTRAÇÃO nem ÂNCORA DE DIA — e a guarda que a impõe mede proxies que já foram contornados no próprio repositório
---

# Revisão adversarial — ARCHITECTURE-SPINE (Orbe)

## Veredito

A espinha fecha com força a duplicação de **query de leitura** e de **cálculo puro**, mas
deixa três categorias inteiras sem dono declarado — **caminho de escrita (RPC, upsert,
edge function)**, **orquestração de efeito colateral** e **âncora de dia** — e a guarda
mecânica da AD-7, que é o único ponto de imposição, mede *basename* e `.from('...')`,
dois proxies que o repositório **já contorna hoje em verde**.

Duas features perfeitamente conformes com AD-1..AD-13 se constroem incompatíveis em
**catorze pontos**, dos quais seis já estão materializados no código.

---

## As duas unidades

Escolhi duas unidades concretas e plausíveis do roadmap real do Orbe:

**Unidade A — "Aba Fitness lendo Garmin".**
O usuário passa a ter Venu 4 além do Apple Watch (memória `garmin-venu4-plan`). A unidade
ingere treinos Garmin pelo `connections-ingest` (o caminho que Strava/intervals já usam),
marca `activities.provider = 'garmin'`, deriva zonas de FC das amostras do FIT, e a aba
Fitness (`mobile/src/app/fitness/`) mostra o card do provedor com os totais do tipo.

**Unidade B — "Retrospectiva mensal no web".**
O período `month` de `/retrospectiva` (`web/src/app/features/retrospectiva/`), que agrega
atividades, saúde, hábitos, registros, ratings, tarefas e compras num mês fechado e compara
com o anterior (`buildRetrospective` / `periodBounds(kind: 'month')`).

Ambas leem tabelas pelos donos únicos em `packages/shared/src/data/`, ambas fazem cálculo
puro no núcleo, nenhuma escreve `.from(` fora do núcleo, nenhuma duplica basename, nenhuma
constrói client dentro do núcleo. **Passam na guarda.** E não fecham.

---

## Achados

### A1 · `hr_zones` não tem versão de modelo, e existem dois modelos com o mesmo formato — **critical**

**A faz:** ingere Garmin pelo edge, que chama
`computeHrZonesFromSamples(samples, { maxHr })` — `packages/shared/src/fitness/streams.ts:247`,
cujo docstring (linha 238) declara **% da FC máxima, padrão Garmin**, e escreve o resultado
em `activities.hr_zones`.

**B faz** (ou uma terceira unidade "zonas personalizadas" no mobile faz): lê o módulo que a
espinha aponta como o do mobile, `mobile/src/lib/heart-rate-zones.ts`, cujo docstring
(linhas 5-9) declara **reserva de FC (Karvonen)**, cujo `HrZoneParams.restHr`
(linha 30) está vivo, e cuja permissão `RestingHeartRate` já é pedida com o comentário
"Necessárias para derivar o tempo em zonas de FC de cada treino **(Karvonen)**"
(`mobile/src/lib/healthkit-workouts.ts:28`). Passar `restHr` é uma linha e é conforme.

**Colisão:** as duas distribuições vão para a mesma coluna `jsonb` sob as mesmas chaves
`z1..z5`, sem nenhum marcador que as separe. `dailyHardLoad`
(`packages/shared/src/health/aggregate.ts:128-140`) soma `z4+z5` sobre a coleção inteira, e
`weeklyLoadVsRecovery` deriva "carga forte" disso. Com Karvonen a mesma FC cai uma zona
acima; a série de carga do usuário ganha um degrau que nenhuma tela consegue explicar.
`health_daily` tem `AGG_VERSION` para exatamente esse risco (ADR 0004); `hr_zones` não tem
nada — a migration `20260524130000_activities_hr_zones.sql` não versiona o payload.

**Por que ambas são conformes:** AD-3 pede *um dono por conceito*, e há dois módulos com
nomes diferentes para o mesmo conceito; o próprio `streams.ts:224` documenta a duplicação
como deliberada ("Duplicadas de `HR_ZONES` … para manter esta folha sem imports"), com
teste de paridade que pina **os valores das fronteiras**, não **o modelo** (%FCmáx vs %FCR).

**Rule proposta — AD-14 (nova):**

> **AD-14 — Payload derivado carrega a versão do modelo que o produziu**
> - **Binds:** toda coluna que guarda resultado de cálculo do núcleo (`activities.hr_zones`,
>   `best_efforts`, `cities`, `health_daily.value`, `route_overview`)
> - **Prevents:** duas gerações do mesmo cálculo coexistindo sob o mesmo formato, sem forma
>   de distinguir — `hr_zones` hoje aceita %FCmáx e Karvonen na mesma chave
> - **Rule:** coluna derivada guarda, junto do valor, a versão do modelo que a produziu.
>   Mudar a fórmula é bump de versão, não reescrita silenciosa. Leitura que agrega valores
>   de versões diferentes é proibida: ou converte, ou descarta, ou recomputa. A versão é do
>   dado, não do dispositivo — nenhum token de invalidação vive só no storage local
>   (ver AD-16).

**Rule proposta — AD-3 apertada (acrescentar ao final da Rule):**

> Quando o núcleo precisar de uma segunda encarnação de um conceito por restrição de runtime
> (folha sem imports para o Deno, por exemplo), a duplicação é declarada no módulo dono, e o
> teste de paridade pina o **contrato inteiro** — fronteiras, unidades e modelo de cálculo —
> não só as constantes. Docstrings que descrevem modelos diferentes para o mesmo conceito
> são uma violação da AD-3 tanto quanto código divergente.

---

### A2 · A AD-4 diz "todo acesso a tabela" mas a guarda nunca olha o `supabase/` — há um terceiro dono de `activities` — **critical**

**A faz:** a ingestão Garmin entra por `supabase/functions/_shared/ingest.ts`, que tem
**24 chamadas `.from(`** sobre `activities`, `activity_routes`, `user_preferences`,
`linked_account_secrets` (linhas 155, 199, 216, 231, 302, 321, 330, 347, 391, 405, 517, 519,
528, 535, 559, 573, 582, 620 …), com conhecimento de schema escrito à mão — colunas,
`onConflict`, ordem de escrita — inteiramente fora de `packages/shared/src/data/`.

**B faz:** lê pelo dono único, `fetchActivities` (`packages/shared/src/data/activities.ts:89`).

**Colisão:** o `SELECT` do dono único e o `UPSERT` do edge são dois contratos de schema
independentes sobre a mesma tabela — que é literalmente o que a AD-4 existe para impedir
("schema escrito à mão em dois apps, com filtros que já divergem"). Uma coluna nova adicionada
pelo edge não aparece na leitura; uma coluna removida do `ACTIVITY_COLUMNS` mata uma feature
sem aviso — o docstring de `activities.ts:11-13` narra exatamente esse acidente já ocorrido.

**Por que ambas são conformes:** AD-4 **Binds** diz "todo acesso a tabela do Supabase", mas
a guarda da AD-7 só varre `web/src` e `mobile/src` (`architecture.test.ts:46-47,95`).
`supabase/functions/` nunca é lido. E AD-6 blinda o diretório com um propósito ("integração
com segredo"), o que dá cobertura política ao ingest.

**Bônus estrutural:** o ingest importa o núcleo por **caminho relativo**
(`ingest.ts:26,33` → `'../../../packages/shared/src/fitness/dedupe.ts'`,
`'.../streams.ts'`). O diagrama do paradigma (linhas 27-36 do spine) desenha
`edge --> db` e **não desenha `edge --> shared`**. Esse arco invisível é a razão de
`streams.ts` ter de ser folha sem imports, que por sua vez é a razão da duplicação do A1.
Uma unidade que "só" adiciona um import ao `hr-zones.ts` quebra o deploy do edge, e nada na
espinha avisa.

**Rule proposta — AD-4 apertada (substituir a Rule):**

> **Rule:** query vive em `packages/shared/src/data/` e recebe `SupabaseClient` como
> parâmetro. Isso vale para **todo** runtime que fale com o Postgres — web, mobile e edge
> function — sem exceção de diretório: o edge importa o mesmo módulo dono. O app constrói o
> client (o adaptador de storage difere) e não escreve query. Cada tabela tem exatamente um
> módulo dono do seu acesso, **de leitura e de escrita**, e esse módulo devolve modelo de
> domínio de `models/`, nunca linha crua do Postgres. Escrita que não passar por ele — RPC
> incluída — não existe (ver AD-15).

**Rule proposta — AD-1 apertada (acrescentar):**

> A direção de dependência inclui `supabase/functions → packages/shared`, por import de
> caminho `.ts` explícito. Módulo do núcleo alcançável a partir do edge é **folha**: zero
> imports. A lista de folhas é declarada no núcleo e verificada mecanicamente — um import
> novo numa folha quebra o deploy do edge e a espinha precisa dizer isso antes.

---

### A3 · RPC é escrita e ninguém é dono dela: o seam único da ADR 0008 é inalcançável pela web — **critical**

**A faz:** a Unidade A conclui a tarefa "pedalar" quando o treino Garmin chega — passa por
`mobile/src/services/todo-resolve.ts#resolveAndAdvance`, o seam que a **ADR 0008 declara
único** ("A `todos.store` do mobile e a `TodosStore.resolve` da web chamam ele").

**B faz:** a retrospectiva conta tarefas concluídas. A web resolve tarefas por
`web/src/app/features/tasks/data/todos.store.ts:233-249`, que **reimplementa o seam inteiro
inline** — `rpc('todo_resolve')` na linha 237, `setTodoTemplateMeterAtLastDone` na 243,
`fireOnComplete` **próprio** na 257-265, `nextDueDate`+`insertOccurrence` na 247-248.

**Colisão:** já divergiram. O mobile ancora tudo em `completedAt` (parâmetro,
`todo-resolve.ts` `ResolveArgs.completedAt`) e conta ocorrências criadas para notificar; a web
ancora em `localDateStr()` fixo e não conta. O mobile checa pendência no **banco**
(`hasPendingOccurrence`); a web checa na **memória da store**
(`todos.store.ts:287,296` — `this._occurrences().some(...)`). Regra nova de conclusão entra
uma vez e fica errada do outro lado — que é a "Consequência" que a própria ADR 0008 escreveu:
"Um caminho novo que resolva ocorrência direto no store nasce quebrado."

**Por que ambas são conformes — e por que isso é estrutural:** a AD-1 **proíbe** a web
importar de `mobile/src`. O seam mora em `mobile/src/services/`. Logo a ADR 0008 manda fazer
algo que a AD-1 torna **impossível**. A espinha tem dono para query (AD-4), para cálculo
(AD-1/AD-2), para vocabulário (AD-3) e para estado (AD-12) — e **nenhum** para o
*procedimento com efeito colateral*. Ele cai no vão e só pode ser duplicado.

**Alcance da guarda:** `.rpc(` não é `.from(`. Há **10 sítios de RPC nos apps**, nenhum no
núcleo:

| RPC | Sítios |
| --- | --- |
| `todo_resolve` | `web/.../todos.store.ts:137,141,237`; `mobile/src/store/todos.store.ts`; `mobile/src/services/todo-resolve.ts:30` |
| `habit_log_set` | `web/.../habits.store.ts:75`; `mobile/src/store/habits.store.ts:318` |
| `habit_log_add` | `mobile/src/store/habits.store.ts:122` |
| `sync_upsert_activities` | `mobile/src/services/activity-sync.ts` |
| `sync_upsert_health_daily` | `mobile/src/services/health-sync.ts` |

Os docstrings dos donos únicos **institucionalizam** o buraco:
`packages/shared/src/data/habit-logs.ts:3-6` — "Escrever **não** passa por aqui";
`packages/shared/src/data/health-daily.ts:4-6` — "Escrever **não** passa por aqui";
`packages/shared/src/data/activities.ts:15-18` — "Escrever atividade **não** passa por aqui".
Três das quatro tabelas mais quentes do sistema têm dono só de leitura.

**Rule proposta — AD-15 (nova):**

> **AD-15 — Escrita tem dono, e o seam de efeito colateral mora no núcleo**
> - **Binds:** toda mutação de dado do usuário — `insert`, `update`, `upsert`, `delete` e
>   **`rpc`** — e todo procedimento que encadeie mais de uma escrita
> - **Prevents:** o vão entre AD-4 (query) e AD-12 (estado), onde hoje vivem 10 sítios de RPC
>   escritos à mão e um seam que a ADR 0008 declara único mas mora dentro de um app, fora do
>   alcance do outro
> - **Rule:** `rpc` é escrita e obedece à AD-4 como qualquer query — o wrapper vive no módulo
>   dono da tabela em `packages/shared/src/data/`, recebe `SupabaseClient` por parâmetro e
>   devolve modelo de domínio. Procedimento que encadeia escritas (resolver ocorrência →
>   avançar série → disparar filhas) é **função pura de plano** no núcleo mais um executor
>   fino no adaptador: o núcleo decide *o quê*, o app decide *quando* e *com qual client*.
>   Seam de domínio nunca mora em `web/src` nem em `mobile/src`; se mora, o outro app é
>   obrigado a reimplementá-lo, e a AD-1 garante que reimplemente.

---

### A4 · Duas âncoras de dia na mesma agregação: `date` do escritor vs instante convertido pelo leitor — **critical**

**A faz:** grava `activities.start_at timestamptz` (instante). A retrospectiva filtra
atividade por comparação de instante: `ts >= cur.start.getTime() && ts < cur.end.getTime()`
(`packages/shared/src/period/retro.ts:319,393,494`), contra um `Date` de meia-noite **local
do leitor** (`periodBounds` → `start.setHours(0,0,0,0)`, `period/bounds.ts:110`).

**B faz:** para tarefas e compras, deriva o dia **no leitor**, a partir do instante:
`const doneDay = localDateStr(new Date(o.doneAt))`
(`web/src/app/features/retrospectiva/data/retro.store.ts:117`), e depois re-parseia a string
como meia-noite local (`retro.ts:434,518`). Para hábitos, saúde e ratings usa a string
**gravada pelo escritor**: `habit_logs.log_date date` — "data LOCAL do dispositivo"
(`supabase/migrations/20260520140000_habitos.sql:35`), `health_daily.day date`
(`20260523120000_health_daily.sql:12`), `daily_ratings.day date`
(`20260607130000_daily_ratings.sql:9`).

**Colisão concreta:** 31/08, 23h30, São Paulo (UTC−3). O usuário conclui a tarefa "alongar"
e incrementa o hábito "água" no celular.
- `habit_logs.log_date` = `'2026-08-31'` (escritor).
- `todo_occurrences.done_at` = `'2026-09-01T02:30:00Z'` (instante).

Abre a retrospectiva de **Agosto** no notebook em UTC (viagem, ou só o SO em UTC):
`localDateStr(new Date('2026-09-01T02:30Z'))` → `'2026-09-01'`. **A tarefa cai em Setembro;
o hábito da mesma noite cai em Agosto.** A atividade da mesma noite, filtrada por instante
contra a meia-noite local do leitor, desloca junto com a tarefa — em direção oposta à do
hábito.

**Por que ambas são conformes:** a Consistency Convention diz *"Data local no formato
`YYYY-MM-DD` derivada da timezone do dispositivo, nunca UTC. Instante em ISO 8601."* Ambas
as unidades obedecem ao pé da letra. A convenção não diz **de qual dispositivo** nem **qual
das duas formas é a chave de pertencimento a um período** — e o sistema usa as duas na mesma
soma.

**Rule proposta — Consistency Conventions, substituir a linha "Data e hora":**

> | Data e hora | O **dia** é um dado de escrita, nunca de leitura: quem grava deriva
> `YYYY-MM-DD` da timezone do seu dispositivo e persiste a string; quem lê **nunca**
> reconstrói o dia a partir de um instante. Toda entidade que participe de agregação por
> período carrega uma coluna `date` própria, mesmo quando já tem `timestamptz`. Pertencimento
> a período compara `string` com `string`; comparação de instante contra fronteira de período
> é proibida. Instante em ISO 8601 serve para ordenar e auditar, não para bucketizar. |

**Nota de implementação para quem fechar:** `todo_occurrences` precisa de `done_day date` ao
lado de `done_at`; `activities` precisa de `start_day date`. As três funções de
`period/retro.ts` que re-parseiam `\`${day}T00:00:00\`` (linhas 249, 259, 434, 518, 519)
passam a comparar string.

---

### A5 · Gêmeos por renomeação: a AD-3 os proíbe em prosa, a AD-7 os mede por basename — **high**

Rodei uma comparação de tokens entre todo `web/src` e todo `mobile/src`, ignorando pares de
mesmo basename (que a guarda já pega). Dois pares acima de 0.6 de Jaccard:

| Jaccard | web | mobile |
| --- | --- | --- |
| **0.938** | `web/src/app/features/workout-history/data/overview.ts` | `mobile/src/lib/activity-overview.ts` |
| **0.633** | `web/src/app/features/workout-history/data/type-summary.ts` | `mobile/src/lib/activity-type-summary.ts` |

O primeiro par, normalizado por prettier, difere em **exatamente 4 linhas de corpo** — a
busca de label/cor. O cabeçalho do arquivo mobile confessa: *"Portado de
web/.../data/overview.ts"* (`mobile/src/lib/activity-overview.ts:3`). São 304 e 330 linhas
do mesmo módulo, com nomes diferentes, e a guarda **passa em verde** — eu rodei
(`npx tsx src/architecture.test.ts` → `4 testes passaram`).

O segundo par **já divergiu no contrato de retorno**, que é o cenário exato que esta lente
procura:

| Conceito | web `TypeSummary` | mobile `TypeSummary` |
| --- | --- | --- |
| distância | `distanceM` | `totalDistanceM` |
| duração | `durationS` | `totalDurationS` |
| calorias | `calories` | `totalCalories` |
| ícone | `icon: string` | `icon: keyof typeof MaterialCommunityIcons.glyphMap` |
| slug | `slug: string` | **ausente** |

**A faz:** o card Garmin na aba Fitness consome o `TypeSummary` do mobile e soma
`totalDistanceM`. **B faz:** o bloco "por tipo" da retrospectiva consome o do web e soma
`distanceM`. Subir o cálculo para o núcleo agora exige escolher um dos dois nomes e quebrar
a outra unidade — o custo que a AD-1 existia para evitar, já pago.

**Por que ambas são conformes:** a AD-3 diz, textualmente, *"um segundo módulo com outro nome
para o mesmo conceito viola esta AD tanto quanto uma cópia"*. É prosa correta e não
verificada. A AD-7 descreve a guarda em termos de **basename duplicado**, e a espinha trata
a guarda como a imposição da AD-3 (AD-7 **Prevents**: "AD-1 a AD-4 virarem prosa não
verificada"). Renomear é a saída de emergência, e alguém já a usou duas vezes.

**Rule proposta — AD-7 apertada (substituir a primeira frase da Rule):**

> **Rule:** a guarda falha quando (a) um basename duplica entre `web/src` e `mobile/src` fora
> da allowlist de stores, **(b) um módulo de um app tem similaridade de conteúdo acima do
> limiar com um módulo do outro app, independentemente do nome** — basename é proxy, não
> critério, e renomear não é conformidade —, (c) existe `.from(` ou `.rpc(` fora de
> `packages/shared/src/data/` **em qualquer runtime, incluindo `supabase/functions/` e o
> próprio núcleo fora de `data/`**, (d) o núcleo importa de um app, ou (e) o núcleo constrói
> um `SupabaseClient`. Toda exceção na allowlist declara, na mesma linha, **qual conceito**
> justifica a duplicação — allowlist sem razão escrita é dívida invisível.

---

### A6 · Uma entidade, quatro mapeadores, e o dono único aceita `object` — **high**

`activities` tem hoje **quatro** contratos de linha vivos no repositório:

| Direção | Arquivo | Nota |
| --- | --- | --- |
| Leitura (dono AD-4) | `packages/shared/src/data/activities.ts:28` `ActivityRow` + `toActivity:59` | `number \| string \| null`, sem `metadata` |
| Escrita (mobile) | `mobile/src/lib/activity-map.ts:9` `ActivityRow` + `toActivityRow:52` | **tem `metadata`**, não tem `cities`/`elevation` estimados |
| Órfão web | `web/.../workout-history/data/activities.store.ts:16-42,191` `SELECT`+`DbActivityRow`+`mapRow` | não referenciado; **omite `source_id` e `device`** — a regressão que `activities.ts:11-13` narra |
| Órfão mobile | `mobile/src/store/activities.store.ts:22-78` `SELECT`+`DbActivityRow`+`mapRow` | não referenciado |

Os órfãos **não são inertes**: divergem em semântica. `mapRow` (ambos) faz
`activityName: r.activity_name ?? undefined` e `caloriesEstimated: ?? false`; `toActivity`
faz `?? ''` e `?? undefined`. Quem religar um deles — e o nome do arquivo convida — troca o
contrato sem tocar no dono.

**E o dono único tem tipo apagado no ponto de escrita:**

```ts
// packages/shared/src/data/activities.ts:243
export async function upsertActivityRoute(db: SupabaseClient, row: object): Promise<void>
```

`row: object`. **A** escreve `{activity_id, user_id, points, point_count}` (o shape de
`mobile/src/lib/activity-map.ts:40`). **B**, ou o ingest do edge, escreve o que quiser. O
módulo que a AD-4 nomeia como dono único do acesso a `activity_routes` não tem opinião sobre
o que entra nele.

**Colisão com a Unidade A:** `Activity` (o modelo em `models/index.ts:299-359`) declara
`provider`, `externalId`, `externalIds` e `metadata`. O `ACTIVITY_COLUMNS`
(`activities.ts:23-26`) **não seleciona nenhum dos quatro** e `toActivity` **não mapeia
nenhum dos quatro**. A Unidade A escreve `provider = 'garmin'` e a Unidade B lê
`a.provider === undefined` para todas as linhas do sistema — o filtro "só Garmin" devolve
zero, e o "por provedor" da retrospectiva mostra tudo como HealthKit. Ambas conformes: A
escreveu pelo caminho de escrita, B leu pelo dono único.

**Rule proposta — AD-4 apertada (acrescentar ao final da Rule):**

> Nenhuma assinatura do módulo dono aceita `object`, `any` ou `Record<string, unknown>` no
> lugar de uma linha: o shape de escrita é um tipo exportado pelo dono, e o mapeamento
> domínio→linha vive nele, ao lado do mapeamento linha→domínio. O par
> `toX`/`fromX` é simétrico: **todo campo declarado no modelo de domínio é ou lido pelo dono,
> ou não existe no modelo**. Campo de modelo que o dono nunca preenche é feature morta e
> falha a revisão.

---

### A7 · Duas prontidões para o mesmo dia, no mesmo app, no mesmo arquivo — **high**

O mobile tem **dois** donos do estado de saúde:
`mobile/src/store/health.store.ts` (amostras do HealthKit em memória, 7 dias) e
`mobile/src/store/health-daily.store.ts` (linhas de `health_daily` do Supabase, 365 dias).

E **dois** caminhos até o score de prontidão do mesmo dia:

| Caminho | Origem | Baseline |
| --- | --- | --- |
| `readinessFromSummaries` (`mobile/src/lib/health-readiness.ts:48`) | `useHealthStore.summaries` — HealthKit, janela de 7 dias | `rollingBaseline(vals.slice(0,-1), 7)` sobre o que a janela trouxe |
| `readinessSeries`→`dayReadiness` (`packages/shared/src/health/aggregate.ts:105,160`) | `useHealthDailyStore` — `health_daily` | `rollingBaseline` sobre **todos** os dias anteriores da série |

Consumidores: `mobile/src/components/cards/ReadinessCard.tsx:36` usa o primeiro;
`mobile/src/app/(tabs)/semana.tsx:99` e `mobile/src/app/recuperacao/index.tsx:102` usam o
segundo. E `mobile/src/services/notifications.ts` usa **os dois, na mesma função**: linha 190
`readinessFromSummaries(useHealthStore.getState().summaries)` para o texto da notificação,
linhas 197-205 `readinessSeries(...)` sobre `useHealthDailyStore` para o alerta de
overtraining. A push pode dizer 78 enquanto a tela de Recuperação, aberta em seguida, diz 71.

**Por que ambas são conformes:** a fórmula (`computeReadiness`) está no núcleo, pura, com um
dono só. O que tem dois donos é a **montagem do input** — e a AD-12 diz explicitamente que
"cada app é dono da sua máquina de estado", o que autoriza dois stores. A espinha não tem
regra dizendo que uma métrica de domínio tem uma fonte só.

**Rule proposta — AD-3 apertada (acrescentar):**

> A regra de dono único cobre **a entrada** do cálculo, não só a fórmula. Métrica de domínio
> derivada (prontidão, carga, volume) tem exatamente um caminho de montagem de input e uma
> fonte de verdade; um segundo caminho que produza a mesma métrica a partir de outra fonte é
> uma violação, mesmo quando os dois chamam a mesma função pura do núcleo. Quando dois stores
> do mesmo app cobrem o mesmo domínio, um deles é cache do outro e a direção é declarada.

---

### A8 · O vocabulário de exibição é a chave de persistência — **high**

`synced_activity_types.type_key` guarda o **label em português**:
`subscribeType(label)` (`mobile/src/lib/synced-types.ts:29`) recebe
`activityLabel(activityId)` = `getActivityMeta(activityId).label`
(`mobile/src/lib/activity-map.ts:48`), que vem de `ACTIVITY_TYPE_LABELS`
(`packages/shared/src/fitness/activity-types.ts:10-28`) — `'Ciclismo'`, `'Trilha'`,
`'Musculação'`.

O docstring desse arquivo diz, na linha 6: **"Adicione/edite labels somente aqui."** A AD-3
diz que o núcleo é o dono e que é lá que se mexe. Editar `'Trilha'` → `'Trail Running'` é a
ação **mais conforme possível** — e desliga silenciosamente a inscrição de sync de todo
usuário que tinha aquele tipo, porque a chave da linha em produção continua `'Trilha'`.

**Colisão com a Unidade A:** o Garmin traz "Indoor Cycling", "Strength Training", "Trail
Run". A taxonomia é indexada por **código numérico do HealthKit** (11, 13, 16, …), e
`GPS_ACTIVITY_IDS = {13,24,37,52}` também. A Unidade A precisa mapear esporte Garmin →
código HealthKit; o que não mapear cai em `DEFAULT_ACTIVITY_LABEL = 'Treino'`
(`activity-types.ts:31`) e colapsa tipos distintos numa linha só do resumo — que a Unidade B
então soma. O dono do vocabulário não tem espaço para uma fonte não-HealthKit, e a espinha
não diz que precisa ter.

**Rule proposta — AD-3 apertada (acrescentar) + Consistency Conventions:**

> Chave estável e rótulo de exibição são **conceitos diferentes com donos diferentes**.
> Nenhum valor persistido — coluna, chave de `jsonb`, `type_key`, chave de preferência — é
> um rótulo de exibição: persiste-se a chave estável, traduz-se na borda. Renomear um rótulo
> é mudança de UI e nunca toca no banco; renomear uma chave estável é migration.
> A taxonomia de tipo de atividade é indexada por chave própria do Orbe, com o código do
> HealthKit como **um** mapeamento de entrada entre outros — nunca como identidade.

*(A linha "Nomeação de entidade" da tabela de convenções — "Um nome por conceito em todo o
sistema, do Postgres ao componente" — hoje **encoraja** este acoplamento e precisa da
ressalva.)*

---

### A9 · A camada de escrita offline do mobile não existe na espinha, e suas três filas têm três disciplinas — **medium**

`mobile/src/lib/` tem uma camada inteira que a espinha não menciona:
`sync-queue.ts`, `todo-queue.ts`, `habit-queue.ts`, `local-store.ts`, `sync-anchor.ts`,
`health-sync-cursor.ts`. O web escreve direto. O Structural Seed (linhas 162-165 do spine)
descreve `mobile/src/lib/` como "adaptadores nativos (HealthKit, tipos de workout)" — a fila
de escrita não é adaptador nativo, é semântica de mutação.

Três filas, três disciplinas de concorrência:

| Fila | Trava | Dedup |
| --- | --- | --- |
| `habit-queue.ts:25-34` | **sim** — `withQueueLock`, com a razão escrita nas linhas 20-24 ("dois toques rápidos no '+' … o valor dobra no servidor") | `opId` |
| `todo-queue.ts:24-28` | **não** — e o docstring da linha 5 diz *"Modelada em habit-queue.ts"* | `opId` |
| `sync-queue.ts:22-35` | **não** | `(kind, id)` |

`enqueueResolve` (`todo-queue.ts:24`) faz read-modify-write sem trava: duas resoluções
simultâneas (toque na UI + `activity-todo-link` concluindo pelo sync — os dois caminhos que
a ADR 0008 nomeia) perdem uma. `todo_resolve` é idempotente, então o efeito é uma ocorrência
que fica pendente para sempre — não um valor dobrado, mas um item que some do fluxo.

E `resolveAndAdvance` (`todo-resolve.ts`) **ignora o resultado do drain**: enfileira, drena, e
segue para `fireOnComplete` + `insertOccurrence(next)` mesmo quando o drain falhou inteiro.
Offline, a ocorrência atual continua `pending` **e** a próxima já nasce. A Unidade B conta as
duas.

**Rule proposta — AD-16 (nova):**

> **AD-16 — Escrita offline é uma fila só, com uma disciplina só**
> - **Binds:** toda mutação originada no mobile
> - **Prevents:** três filas com três semânticas de concorrência (uma com trava, duas sem) e
>   avanço de série sobre uma escrita que não confirmou
> - **Rule:** o mobile tem **uma** fila de escrita persistente, com trava de leitura-
>   modificação-escrita, dedup por `opId` e ordem FIFO preservada entre tipos com dependência
>   (atividade antes de rota — a FK `activity_routes.activity_id → activities.id` exige).
>   Efeito colateral em cadeia só dispara depois da confirmação do servidor: enquanto o item
>   estiver na fila, a série não avança. O contrato da fila é do núcleo (plano puro); só o
>   storage é do app.

---

### A10 · `AGG_VERSION` é token de invalidação local num banco único — **medium**

`AGG_VERSION = 2` vive em `mobile/src/services/health-sync.ts:45`, e o cursor que o compara
vive no **AsyncStorage do dispositivo** (`mobile/src/lib/health-sync-cursor.ts`,
`vitale:health-cursor:${userId}`). A AD-8 declara **uma instância** servindo dev, preview,
produção e web.

**A faz:** a Unidade A corrige a agregação de sono para o Garmin e bumpa `AGG_VERSION` para 3.
O iPhone re-backfilla 365 dias e **sobrescreve** (upsert por `(user_id, day, metric)`) linhas
que o iPad — ainda na versão 2 — escreveu. O iPad, no próximo sync, reescreve as suas.
Ping-pong sem detecção.

**B faz:** lê `health_daily` sem nenhuma noção de versão (`fetchHealthDailySince`,
`packages/shared/src/data/health-daily.ts:38`) e compara o mês com o anterior. Um dos meses
está na v2, o outro na v3, e a comparação "melhorou/piorou" é ruído de versão.

**Por que ambas são conformes:** nada na espinha fala de versão de agregação nem de
multi-dispositivo. A AD-8 declara a instância única e para aí. Coberto pela AD-14 proposta em
A1, com o acréscimo: *"A versão é do dado, não do dispositivo."*

---

### A11 · 24 módulos puros vivem em `mobile/src/lib/`, e a AD-1 não diz se o critério é import direto ou transitivo — **medium**

Varri `mobile/src/lib/` por import de plataforma (`react-native`, `expo`, `@expo`,
`@react-native`): **24 dos 32 módulos não têm nenhum**. A AD-1 os manda para o núcleo. Nada
detecta. Entre eles: `activity-map.ts` (o shape de escrita de `activities`),
`health-aggregate.ts` (o shape de escrita de `health_daily`), `heart-rate-zones.ts` (A1),
`activity-overview.ts` (A5), `best-efforts.ts`, `activity-todo-link.ts`, `connections.ts`.

Dois problemas de definição:

1. **Direto ou transitivo?** `sync-queue.ts`, `todo-queue.ts`, `habit-queue.ts`,
   `sync-anchor.ts`, `health-sync-cursor.ts` não importam plataforma **diretamente**; importam
   `local-store.ts`, que importa `AsyncStorage` (`local-store.ts:5`). A AD-1 diz "o critério é
   o conjunto de imports" e não fecha a questão. Cinco módulos ficam indecidíveis por leitura
   da regra.

2. **Um `import type` cosmético ancora um módulo inteiro.**
   `mobile/src/lib/workout-types.ts:5` — `import type { MaterialCommunityIcons } from '@expo/vector-icons'`.
   É um tipo de nome de glifo. Por ele, a AD-1 mantém no app `WorkoutItem`,
   `pausedSecondsFromEvents`, `computeMovingTimeS`, `totalTimeS`, `deriveWorkoutId` — domínio
   puro. A AD-2 manda partir o arquivo; a AD-1, lida sozinha, diz que ele está no lugar certo.
   O critério mecânico, escolhido justamente por não exigir julgamento, é
   **trivial de satisfazer sem mudar nada de substancial**.

**Rule proposta — AD-1 apertada (substituir a Rule):**

> **Rule:** módulo que não importa API de plataforma (nativa, Angular, React ou React Native)
> pertence a `packages/shared`. O critério é o conjunto de imports **de valor**, e conta o
> fecho transitivo: módulo puro que só alcança plataforma através de uma dependência é
> partido pela AD-2 — a parte pura sobe e recebe o adaptador por parâmetro (como o
> `SupabaseClient` na AD-4). **`import type` não ancora nada**: tipo importado de pacote de
> plataforma que não gere código é substituído por um tipo próprio do núcleo. Um `import type`
> não é justificativa para um módulo de domínio morar num app.

---

### A12 · O núcleo tem derivação de dia duplicada dentro de si, e a guarda nunca varre o núcleo fora de `data/` — **medium**

`packages/shared/src/date/local.ts:5-6` declara: *"Estas funções são a única forma de derivar
`'YYYY-MM-DD'` no projeto."* Há pelo menos **dez** outras derivações à mão:

| Arquivo:linha | |
| --- | --- |
| `packages/shared/src/period/retro.ts:240` | `function localDay(d: Date)` — **dentro do núcleo** |
| `mobile/src/lib/health-aggregate.ts:29` | `export function localDay(iso: string)` — usada pelo `health-sync.ts:123` |
| `mobile/src/lib/health-buckets.ts:203` | `localDayKey` — e usa `getMonth()` **sem +1 e sem pad** (`2026-7-3`), formato terceiro |
| `mobile/src/lib/activity-overview.ts:88` | `ymd` |
| `mobile/src/lib/activity-list-filter.ts:59` | inline |
| `web/.../workout-history/data/overview.ts:69` | `ymd` |
| `web/.../workout-history/data/weekly-load.ts:60` | inline |
| `web/.../workout-history/data/activity-list.ts:73` | inline |
| `overview.ts:134,140` / `activity-overview.ts:159,165` | `monthKey` — `${y}-${m}` com mês 0-based |

E a lógica de **pertencimento a um dia dentro de um intervalo** é re-escrita cinco vezes só
em `period/retro.ts` (linhas 248, 258, 275, 433, 517), cada uma re-parseando
`` `${day}T00:00:00` ``.

Buraco de guarda associado: a checagem de `.from(` opera sobre `[...webFiles, ...mobileFiles]`
(`architecture.test.ts:95`). **O núcleo nunca é varrido.** Um `.from('activities')` em
`packages/shared/src/health/aggregate.ts` passa em verde, apesar de a AD-4 dizer que query
vive em `packages/shared/src/data/`.

**Rule proposta — Consistency Conventions, nova linha:**

> | Derivação de chave de agregação | Chave de dia, de semana e de mês tem um módulo dono no
> núcleo, e nenhuma outra derivação existe — nem inline, nem privada, nem dentro do próprio
> núcleo. Pertencimento de uma chave a um intervalo é função do mesmo módulo. Um teste da
> AD-7 falha quando um literal de template com `getFullYear()` aparece fora dele. |

---

### A13 · Cache sem contrato de invalidação entre unidades — **medium**

`ActivitiesStore.load(force = false)` retorna cedo se já carregou
(`web/.../activities.store.ts:85`; equivalente em `mobile/src/store/activities.store.ts`).
`RetroStore.ensure(since)` só refaz o fetch se o `since` pedido for mais antigo que
`_loadedSince` (`retro.store.ts:70-72`). Os caches de rota são `Map`s sem TTL
(`activities.store.ts:57,64`).

**A faz:** o sync Garmin insere e faz merge de atividades, muda `has_route`, dispara o
trigger de métricas estimadas — tudo sem nenhum canal que diga a alguém que aconteceu.
**B faz:** `ensure('2026-08-01')` uma vez; volta ao mês, o `since` não mudou, e a
retrospectiva de Agosto mostra o estado de antes do sync até o app ser recarregado.

**Por que ambas são conformes:** a AD-12 dá o estado ao app, e cache é estado. A espinha não
tem palavra sobre invalidação — nem no eixo tempo, nem no eixo escrita→leitura.

**Rule proposta — AD-12 apertada (acrescentar):**

> Cache é estado, e portanto do app — mas **a invalidação é contrato**. Todo caminho de
> escrita declara as chaves de leitura que invalida, e o app é obrigado a honrá-las. Cache
> que só invalida por remontagem de tela ou por reinício do app é bug, não decisão.

---

### A14 · A regex da guarda e a allowlist pareiam as coisas erradas — **low**

**Regex:** `/\.from\('[a-z_]+'/g` (`architecture.test.ts:96`). Passam em verde:
`.from("activities")` (aspas duplas), `` .from(`activities`) `` (template), `.from(TABLE)`
(variável) e qualquer tabela com dígito ou maiúscula no nome — `.from('activities_v2')` não
casa `[a-z_]+`. Nenhum desses é malícia: é o que um agente de IA escreve por padrão de estilo
diferente.

**Allowlist:** `STORE_ALLOWLIST` (`architecture.test.ts:54-65`) contém `health.store.ts`,
com a razão "stores duplicam por razão arquitetural legítima: signals vs Zustand". Mas
`web/.../saude/data/health.store.ts` lê `health_daily` do Supabase, e
`mobile/src/store/health.store.ts` é o adaptador do HealthKit — **não são o mesmo conceito**.
O par verdadeiro do web é `mobile/src/store/health-daily.store.ts` (0.462 de similaridade),
que não está na allowlist e passa só porque o nome é único. A isenção foi dada ao par errado,
e o par certo é invisível. (Além disso, `mobile/src/store/health-daily.store.ts:11-30` carrega
mais uma cópia órfã de `DbRow` + `toRow`, duplicando `toHealthDaily` de
`packages/shared/src/data/health-daily.ts:24`.)

Coberto pela AD-7 apertada em A5, com a exigência de razão escrita por linha de allowlist.

---

### A15 · A AD-5, como escrita, proíbe retroativamente a ADR 0005 — **low**

**Rule da AD-5:** *"só quando o ganho for reduzir payload na rede ou colapsar round-trip;
precedente é `activity_routes.route_overview`."*

`supabase/migrations/20260730120000_activities_estimated_metrics.sql` põe no banco um trigger
que calcula a **mediana de kcal/min do usuário por tipo** e a **forma média da distribuição
de zonas**, com as flags `calories_estimated` / `hr_zones_estimated`. Isso é regra de negócio
— não reduz payload nem colapsa round-trip. Está aceito na ADR 0005 e vivo em produção. A
razão real, escrita nos comentários da migration (linhas 15-23), é **completude do gatilho**:
os dois caminhos de escrita (`sync_upsert_activities` e o ingest do edge) convergem no banco,
e só ali dá para cobrir os dois — o que é uma **consequência direta** do buraco A3.

**Rule proposta — AD-5 apertada (substituir a Rule):**

> **Rule:** lógica vai para o banco em duas condições nomeadas, e só nelas: (a) o ganho é
> reduzir payload na rede ou colapsar round-trip — precedente `activity_routes.route_overview`;
> (b) a regra precisa valer para **todos** os caminhos de escrita e não existe um seam de
> escrita único no núcleo que os cubra — precedente `activities_estimated_metrics` (ADR 0005).
> A condição (b) é reversível por construção: quando a AD-15 der dono único à escrita, cada
> exceção aberta por (b) é revisitada. View exige `security_invoker = true`. RPC não se aplica
> onde o cliente precise escolher colunas.

---

## Resumo

| # | Achado | Severidade | Fecha com |
| --- | --- | --- | --- |
| A1 | `hr_zones` sem versão; dois modelos (%FCmáx × Karvonen) no mesmo formato | critical | **AD-14** nova + AD-3 apertada |
| A2 | `supabase/functions/` é terceiro dono de `activities` (24 `.from(`), fora da AD-4 e da guarda; arco `edge → shared` ausente do paradigma | critical | AD-4, AD-1, AD-7 apertadas |
| A3 | RPC não é coberta; o seam único da ADR 0008 é inalcançável pela web por força da AD-1 | critical | **AD-15** nova + AD-4 apertada |
| A4 | Duas âncoras de dia na mesma agregação (`date` do escritor × instante do leitor) | critical | Convention "Data e hora" reescrita |
| A5 | Gêmeos por renomeação (`overview`↔`activity-overview` 0.938; `type-summary`↔`activity-type-summary` já divergiu no contrato) | high | AD-7 apertada |
| A6 | Quatro mapeadores de `activities`; `upsertActivityRoute(db, row: object)`; `provider`/`metadata` no modelo e nunca lidos | high | AD-4 apertada |
| A7 | Duas prontidões para o mesmo dia, no mesmo app, no mesmo arquivo | high | AD-3 apertada |
| A8 | Rótulo PT-BR de exibição usado como chave de persistência (`type_key`); taxonomia presa a códigos HealthKit | high | AD-3 + Conventions |
| A9 | Três filas offline com três disciplinas; série avança sobre escrita não confirmada | medium | **AD-16** nova |
| A10 | `AGG_VERSION` local ao dispositivo sobre banco único (AD-8) | medium | AD-14 |
| A11 | 24 módulos puros em `mobile/src/lib/`; AD-1 não define direto × transitivo; `import type` ancora domínio no app | medium | AD-1 apertada |
| A12 | ≥10 derivações de `YYYY-MM-DD` (uma dentro do núcleo); guarda não varre o núcleo fora de `data/` | medium | Conventions + AD-7 |
| A13 | Cache sem contrato de invalidação entre escrita e leitura | medium | AD-12 apertada |
| A14 | Regex da guarda (aspas simples, `[a-z_]+`); allowlist isenta o par errado de `health.store` | low | AD-7 apertada |
| A15 | AD-5 como escrita proíbe retroativamente a ADR 0005, que é consequência de A3 | low | AD-5 apertada |

## Nota de calibração

Estado verificado da guarda nesta sessão:
`cd packages/shared && npx tsx src/architecture.test.ts` → **`4 testes passaram`**.
Todos os achados acima convivem com esse verde. A AD-13 está cumprida (o runner existe e
executa de verdade), e as quatro barreiras pegam o que prometem pegar — o problema não é a
guarda estar quebrada, é ela medir proxies que a espinha trata como se fossem o critério.

O que a espinha claramente acertou e não deve ser tocado: a consolidação da AD-4 é real
(139 `.from(` viraram 0 fora do núcleo, 16 módulos donos), `GPS_ACTIVITY_IDS`/`STRENGTH_IDS`/
`EASY_IDS` têm um dono só com teste de disjunção, os pares `planned-match` / `moving-time` /
`weekly-volume` que originaram a espinha estão resolvidos, e a distinção catraca × barreira
na AD-7 é uma boa peça de engenharia que fez o trabalho e virou barreira como previsto.
