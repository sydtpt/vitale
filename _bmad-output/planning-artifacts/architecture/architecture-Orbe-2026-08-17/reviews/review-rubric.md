# Review — ARCHITECTURE-SPINE Orbe (lente: rubric walker)

**Alvo:** `_bmad-output/planning-artifacts/architecture/architecture-Orbe-2026-08-17/ARCHITECTURE-SPINE.md`
**Lente:** rubric walker — good-spine checklist (7 itens)
**Data:** 2026-08-18
**Estado do mundo:** a consolidação que a espinha guiou já foi entregue. A guarda roda e está verde (4 BARREIRA, confirmado nesta sessão via `cd packages/shared && npm test`).

---

## Veredito

**CHANGES REQUESTED.**

A espinha é forte exatamente onde foi construída para ser forte: diagnosticou a duplicação que existia, escolheu uma fronteira mecânica sobre uma semântica com justificativa registrada, e entregou. CAP-4 está genuinamente cumprida, a guarda executa de verdade, AD-13 fechou o buraco do runner fantasma, e AD-6/AD-8/AD-11 ratificam corretamente o brownfield.

Mas ela falha o item 2 do checklist no seu próprio invariante-título: **a AD-1 não tem enforcement nenhum.** A AD-7 impõe um *proxy* — colisão de basename entre os dois apps — e não a regra da AD-1. O proxy é evadido por renomear um arquivo, e hoje 31 módulos sem import de plataforma em `mobile/src` e 14 em `web/src` vivem fora do núcleo com a guarda verde. Um deles é uma segunda implementação viva de um cálculo cujo modelo foi resolvido pela ADR 0001.

E falha o item 7 em três dimensões que a altitude *initiative* possui: **erro/falha**, **offline/sync** e **segurança/autz** não têm uma linha na espinha — cada uma com divergência concreta já presente no código. Some-se a isso um invariante de deploy (AD-9) que, combinado com o `Deferred` de hospedagem, quebra o login em produção no dia da publicação.

---

## Itens do checklist

| # | Item | Resultado |
| --- | --- | --- |
| 1 | Fixa os pontos reais de divergência para features/epics? | **Não** — falta offline/sync, superfície de erro e obrigação de RLS em tabela nova (F4, F5, F6) |
| 2 | Cada Rule é executável e previne o Prevents declarado? | **Não** — AD-1 sem enforcement (F1); AD-3 com escopo que permite a violação dentro do núcleo (F2) |
| 3 | Nada em `Deferred` permite divergir? | **Não** — CI com gatilho inobservável (F7); running-highlights estaciona violação de AD-3 sob justificativa de AD-2 (F8) |
| 4 | Tech nomeada verificada e atual? | **Quase** — tudo confere menos TypeScript (F10) |
| 5 | Ratifica o brownfield existente? | **Parcial** — ratifica AD-6/AD-8/AD-11 bem; deixa de ratificar RLS 21/21 (F6); AD-1 condena ~45 módulos sem nomeá-los como diferidos (F1) |
| 6 | Cobre as capabilities do SPEC? | **Parcial** — CAP-5 tem o proxy fraco como critério (F1); CAP-8 incompleta (F11) |
| 7 | Toda dimensão da altitude decidida/diferida/aberta? | **Não** — erro/falha, offline/sync e autz em silêncio total (F4, F5, F6) |

---

## Achados

### F1 — `critical` · A AD-1 não é imposta por nada; a AD-7 impõe um proxy evadível por renomear

A AD-1 (linha 46) é o invariante-título da espinha e se declara mecânica: *"módulo que não importa API de plataforma (nativa, Angular, React ou React Native) pertence a `packages/shared`. O critério é o conjunto de imports."*

A AD-7 (linha 82) enumera exatamente quatro checagens, e **nenhuma delas é essa regra**. A primeira — *"o teste falha quando um basename duplica entre `web/src` e `mobile/src`"* — mede colisão de nome entre os dois apps, não pureza de import. `packages/shared/src/architecture.test.ts:74-87` confirma: compara `basename` de web contra `basename` de mobile.

Consequências verificadas nesta sessão (varredura por import de `react`, `react-native`, `expo`, `@angular/*`, `rxjs`, `zustand`, `@react-navigation`):

- **31 de 133** módulos em `mobile/src` não importam API de plataforma;
- **14 de 108** módulos em `web/src` idem.

A guarda está verde com todos eles fora do núcleo. Três consequências distintas, em ordem de gravidade:

**(a) Segunda implementação viva de um cálculo de domínio.** `mobile/src/lib/heart-rate-zones.ts:47-74` (`computeHrZones`) é algoritmicamente idêntica a `packages/shared/src/fitness/streams.ts:247-278` (`computeHrZonesFromSamples`) — mesmo filtro, mesmo `MAX_GAP_S = 60`, mesma fração, mesmo arredondamento. As duas estão em caminhos de produção **diferentes**: a do mobile alimenta o sync (`mobile/src/services/activity-sync.ts:27`), a do núcleo alimenta o ingest (`supabase/functions/_shared/ingest.ts:31,181`). A guarda não vê porque `heart-rate-zones.ts` existe só no mobile — não há gêmeo em web para colidir.

Pior: o cabeçalho do módulo mobile (`heart-rate-zones.ts:5-6`) afirma *"Usa **reserva de FC (Karvonen)** — mais acertiva que % da FCmáx pura"*, que é textualmente a alternativa **rejeitada** pela ADR 0001 (`docs/decisions/0001-zonas-de-fc-por-percentual-da-fc-maxima.md`, seção "Alternativas rejeitadas"). O código concorda com a ADR na prática (os chamadores omitem `restHr`), mas a documentação do módulo contradiz uma decisão ratificada — que é precisamente o que a AD-11 existe para impedir.

**(b) A rede de proteção de um invariante do núcleo mora num adaptador.** `packages/shared/src/fitness/streams.ts:224-226` redeclara as fronteiras de zona e se justifica: *"Duplicadas de `HR_ZONES` (health/hr-zones.ts) para manter esta folha sem imports — teste de paridade pina os valores."* Esse teste de paridade é `mobile/src/lib/__tests__/fitness-streams.test.ts:114`. Ou seja: o único teste que impede duas constantes do núcleo de divergirem roda no workspace do **mobile**. O runner do núcleo (`packages/shared/package.json`: `find src -name '*.test.ts' | xargs -n1 tsx`) nunca o alcança. Isso contraria a própria AD-7: *"A guarda vive no workspace do núcleo e só vale onde executa."*

**(c) A espinha condena ~45 módulos sem os nomear.** A AD-1 declara que todo módulo puro pertence ao núcleo. `Deferred` nomeia exatamente um (`running-highlights.ts`). Os outros ~44 não são nem violação assumida nem exceção registrada — são silêncio. Isso quebra o item 5 do checklist: a espinha não ratifica esse brownfield, condena-o tacitamente.

**Correção:** ou a AD-7 ganha uma quinta checagem que implemente a AD-1 de fato (módulo sem import de plataforma fora de `packages/shared` falha), entrando como **catraca** no teto atual de 45 — o mecanismo que a própria AD-7 já define para passivo em drenagem — ou a AD-1 ganha uma cláusula explícita de que consumo por um único app dispensa a subida, e aí o `Prevents` precisa ser reescrito, porque deixa de prevenir o caso (a).

---

### F2 — `high` · A Rule da AD-3 tem escopo que permite a divergência que o Prevents declara

A AD-3 (linha 58) diz: *"cada conceito de domínio tem exatamente um módulo dono em `packages/shared`. **Redefinir constante de domínio fora do núcleo é proibido.** [...] um segundo módulo com outro nome para o mesmo conceito viola esta AD tanto quanto uma cópia."*

A frase imperativa — a única acionável — é escopada em **"fora do núcleo"**. A cláusula "exatamente um módulo dono" é prosa sem verbo de proibição e sem checagem. Resultado: duplicação *dentro* do núcleo passa pela letra da regra, e existe:

- `packages/shared/src/fitness/streams.ts:227` — `HR_ZONE_BOUNDS`
- `packages/shared/src/health/hr-zones.ts` — `HR_ZONES`

...duas definições da mesma fronteira de zona, dentro do núcleo, auto-documentadas como cópia.

E a escada de best efforts tem **três donos**, dois deles com nomes diferentes para o mesmo conceito — o caso que a AD-3 nomeia explicitamente:

| Local | Símbolo | Forma |
| --- | --- | --- |
| `packages/shared/src/fitness/streams.ts:146` | `BEST_EFFORT_TARGETS` | `{key, meters}` |
| `mobile/src/lib/best-efforts.ts:28` | `BEST_EFFORT_DISTANCES` | `{key, meters, label}` |
| `web/src/app/features/workout-history/data/running-highlights.ts:34` | `BEST_EFFORT_DISTANCES` | `{key, meters, label}` (inline) |

As três já divergiram: os rótulos web são `'1km'`, `'5km'`, `'Meia maratona'`; os do mobile são `'1 km'`, `'5 km'`, `'Meia maratona'`. Chaves e metros ainda batem — o que segura isso é comentário, não código (`streams.ts:143-144`: *"As chaves DEVEM casar com as lidas em `running-highlights` (web e mobile)"*).

**Correção:** remover o escopo "fora do núcleo" da cláusula imperativa. A proibição é de **redefinir**, ponto — inclusive de um módulo do núcleo para outro.

---

### F3 — `high` · AD-9 + `Deferred` de hospedagem quebram o login em produção

A AD-9 (linha 94): *"a anon key é pública e protegida por RLS; fica versionada em **um único arquivo de environment**. O build de produção **não substitui arquivo** nem injeta segredo."* Verificado: só existe `web/src/environments/environment.ts`, e `web/angular.json` não tem `fileReplacements`.

Esse arquivo único contém (`environment.ts:6`):

```ts
appUrl: 'http://localhost:4200',
```

E ele é consumido em produção pelo fluxo de OAuth — `web/src/app/core/auth/auth.service.ts:29`:

```ts
options: { redirectTo: `${environment.appUrl}/semana` },
```

O memlog (linha 36) registra *"WEB SERA PUBLICADO EM BREVE: invariantes de deploy viram dimensao de primeira classe"*. Publicando sob a AD-9 como escrita, o **Sign in with Google redireciona o usuário para `http://localhost:4200/semana`**. A AD-9 resolveu corretamente o problema do segredo e, ao fazê-lo, apagou o único mecanismo que diferenciava ambientes — sem notar que um valor não-secreto e dependente de ambiente viajava no mesmo arquivo.

O `Deferred` de hospedagem (linha 182) não cobre isso: trata a escolha como *"de plataforma, não de arquitetura"*, o que é verdade para o host e falso para a origem do redirect.

**Correção:** a AD-9 precisa separar *segredo* de *dependente-de-ambiente*. A regra correta não é "um arquivo versionado", é "nenhum segredo no build" — e valor dependente de origem deriva de `window.location.origin` em runtime, não de constante compilada. É mudança de uma linha em `auth.service.ts` e uma cláusula na AD-9.

---

### F4 — `high` · Dimensão erro/falha em silêncio, com divergência já presente

Nenhuma AD, convenção ou checagem trata do que acontece quando uma leitura falha.

O núcleo é perfeitamente consistente: os **16** módulos de `packages/shared/src/data/` fazem `if (error) throw error` em 100% dos caminhos (contagem de `throw` = contagem de checagens de erro em todos os 16). Convenção limpa, ratificável, não ratificada.

Do lado do adaptador, para a **mesma tabela**, consumida pelo **mesmo módulo dono**, o comportamento diverge:

- `web/src/app/features/treinos/data/planned-workouts.store.ts:88-97` — `try/catch`, seta `_error` e `_state='error'`, a UI mostra o estado.
- `mobile/src/store/planned-workouts.store.ts` — chama `fetchPlannedWorkouts`/`createPlannedWorkout`/`patchPlannedWorkout`/`deletePlannedWorkout` nas linhas 61, 79, 93 e 99. **Zero blocos `catch` no arquivo inteiro.** A falha vira rejection não tratada e desaparece.

A AD-12 (linha 112) licencia isso ao dizer que *"cada app é dono da sua máquina de estado"* — mas a divergência aqui não é de estilo de máquina de estado (signals vs Zustand), é sobre **se uma falha é observável**. O run inclusive tropeçou nessa classe de defeito: o memlog (linha 31) registra *"Ou 'profiles' foi criada fora de migration em producao, ou a leitura do web falha silenciosamente"* — a falha silenciosa foi hipótese de trabalho e nunca virou invariante.

**Correção:** uma convenção em `Consistency Conventions` basta — algo como "módulo de dados lança; adaptador que chama módulo de dados trata e expõe estado de erro; engolir exceção é proibido". Sem isso, cada feature nova decide de novo, e metade decide errado.

---

### F5 — `high` · Dimensão offline/sync em silêncio, com três cópias já no lugar

O mobile tem um subsistema de escrita offline inteiro. A espinha não o menciona uma vez — nem em AD, nem em `Structural Seed` (que descreve `mobile/src/lib/` apenas como *"adaptadores nativos (HealthKit, tipos de workout)"*), nem em `Deferred`.

Três módulos com a mesma forma exata:

| Módulo | Chave | API |
| --- | --- | --- |
| `mobile/src/lib/sync-queue.ts:15` | `vitale:sync-queue` | `readQueue` / `enqueue` / `clearQueue` / `drainQueue` |
| `mobile/src/lib/habit-queue.ts:17` | `vitale:habit-queue` | `readHabitQueue` / `enqueueDelta` / `clearHabitQueue` / `drainHabitQueue` |
| `mobile/src/lib/todo-queue.ts:17` | `vitale:todo-queue` | `readTodoQueue` / `enqueueResolve` / `clearTodoQueue` / `drainTodoQueue` |

Todos com a mesma assinatura `store: KVStore = asyncStore`, todos sem import de plataforma (portanto todos violando a AD-1 por F1), e ligados entre si por **comentário**: `habit-queue.ts:6` diz *"Modelado em [sync-queue.ts](./sync-queue.ts)"*, `todo-queue.ts:5` diz *"Modelada em [habit-queue.ts](./habit-queue.ts)"*.

Esse é literalmente o padrão que o run diagnosticou como causa-raiz — o memlog (linha 20) sobre `planned-match.ts:3`: *"processo manual documentado no codigo ocupando o lugar de uma regra de arquitetura"*. A consolidação matou a instância e deixou o padrão vivo em outro canto do repo.

A divergência concreta que o silêncio permite: a próxima feature com escrita no mobile não tem regra sobre enfileirar ou não, nem sobre reusar a fila genérica. Uma quarta cópia entra e a guarda passa.

**Correção:** uma AD que decida se a fila é genérica-e-única (subindo para o núcleo, já que os três são puros e recebem o `KVStore` por parâmetro) ou por-domínio-por-design; e, se for por-domínio, um item de `Deferred` com condição de revisita — não silêncio.

---

### F6 — `medium` · Segurança/autz: a AD-9 apoia-se em RLS que nada obriga

A AD-9 justifica a anon key pública com *"protegida por RLS"*. A espinha inteira não tem uma AD, convenção ou checagem que **obrigue** RLS.

Verificação: das **21** tabelas criadas em `supabase/migrations/`, **21** têm `enable row level security`. Convenção 21/21 — tão consistente quanto a das edge functions, que a AD-6 ratificou corretamente. Esta ficou de fora.

A AD-4 (linha 62) binda *"todo acesso a tabela do Supabase"* — acesso, não criação. Então a divergência específica: a próxima feature cria a tabela 22 sem RLS, nenhuma checagem falha (a guarda só olha `.from(` e basename), a AD-9 perde silenciosamente sua premissa, e a anon key versionada no repo — que estará num bundle público assim que o web publicar (F3) — passa a dar leitura aberta àquela tabela.

**Correção:** cláusula na AD-4 ou convenção nova: tabela nova nasce com RLS na mesma migration. É a única dimensão de segurança que a altitude possui neste sistema, e ela está implícita.

---

### F7 — `medium` · O `Deferred` de CI tem gatilho que ninguém pode observar

`Deferred`, linha 183: *"Pipeline de CI — Quando a guarda da AD-7 passar a ser burlada por esquecimento de rodar `npm run test`."*

Não existe mecanismo que detecte esse esquecimento. A AD-7 (linha 81) estabelece o próprio fato: *"não há CI nem git hooks neste repositório"*. A condição só é observável por CI — que é exatamente o que está sendo diferido. É circular: o gatilho nunca dispara, e o diferimento é permanente por construção.

**Correção:** trocar por uma condição observável — por exemplo, "quando um commit chegar em `main` com a guarda vermelha", detectável rodando a guarda sobre o histórico, ou uma revisita por data.

---

### F8 — `medium` · O `Deferred` de `running-highlights` estaciona uma violação de AD-3 sob justificativa de AD-2

`Deferred`, linha 186, justifica: *"`ActivityHighlight` carrega `value` e `caption` já formatados — separar cálculo de apresentação é o que a AD-2 manda, mas muda o contrato que os componentes consomem."* Razão legítima e bem escrita — para a AD-2.

O que o item não diz é que o mesmo par carrega uma violação de **AD-3**: `web/.../running-highlights.ts:34` redeclara `BEST_EFFORT_DISTANCES` inline (ver F2). Essa parte não tem nada a ver com acoplamento de apresentação e podia ter subido sozinha.

E o custo é composto: `packages/shared/src/architecture.test.ts:72` põe `running-highlights.ts` num `DEFERRED` set que isenta o **arquivo inteiro** da checagem de basename. Diferir uma dimensão apagou a visibilidade de todas.

Os dois arquivos já divergiram além dos rótulos: `web` usa `fmtDate`/`fmtElevation` de `./format`, `mobile` usa `formatDateLabel`/`formatElevation` de `./workout-format` — e o cabeçalho do web (linhas 3-4) ainda instrui *"mantenha as duas em sincronia"*.

**Correção:** o item de `Deferred` precisa nomear as duas dimensões separadamente, e a constante devia ter subido junto com a consolidação — é a mudança que **não** toca o contrato dos componentes.

---

### F9 — `medium` · O anti-padrão que originou a espinha sobreviveu como mecanismo de fato

O run identificou instrução-de-sincronia-em-comentário como o sintoma da ausência de regra (memlog linha 20). Depois da consolidação, ela continua sendo o mecanismo real em pelo menos quatro pontos:

- `web/src/app/core/models/activity-types.ts:3-6` — *"Espelha `getActivityMeta`/`GPS_ACTIVITY_IDS` de mobile/src/lib/workout-types.ts [...] Mantenha os labels idênticos ao mobile"* (o comentário está inclusive **obsoleto**: a linha 16 já reexporta do `@vitale/shared`, e os labels vêm de `ACTIVITY_TYPE_LABELS`)
- `packages/shared/src/fitness/streams.ts:143-144` e `225` — *"As chaves DEVEM casar"* / *"Duplicadas de `HR_ZONES`"*
- `mobile/src/lib/best-efforts.ts:25-26` — *"As chaves DEVEM casar com as lidas em `running-highlights` (web e mobile)"*
- `mobile/src/lib/habit-icons.ts:10` — *"Ao adicionar um ícone no shared, adicione a entrada aqui também"*

O último é o contraexemplo instrutivo e deve ser preservado como padrão: o `Record<HabitIconName, IoniconName>` faz o `tsc` **exigir** exaustividade, então o comentário só descreve o que o compilador já garante. Os três primeiros não têm nada por trás.

**Correção:** a espinha deveria dizer, em `Consistency Conventions`, que sincronia entre módulos se estabelece por tipo ou por teste, nunca por comentário — e que comentário que peça sincronia manual é sinal de AD-3 pendente.

---

### F10 — `low` · A tabela `Stack` nomeia uma versão de TypeScript que o núcleo não usa

`Stack` (linha 136) declara `TypeScript | 5.9`. Verificado:

| Workspace | Pin |
| --- | --- |
| `web` | `~5.9.0` |
| `mobile` | `~5.9.2` |
| `packages/shared` | **`~5.8.0`** |

O núcleo — o workspace que os outros dois consomem por `main: src/index.ts`, ou seja, **como fonte** — compila e roda seus testes num minor diferente do de ambos os adaptadores. O resto da tabela confere integralmente (Angular 21, Vitest 4, Expo 54, RN 0.81.5, React 19.1.0, Zustand 5, Jest 29, supabase-js 2.106).

---

### F11 — `low` · CAP-8 ("configuração que não mente") ficou incompleta

O critério de sucesso da CAP-8 lista dois itens: remover `environment.prod.ts` e a permissão obsoleta do `mkdir`. Ambos feitos.

Mas `web/src/environments/environment.ts:3` mantém:

```ts
apiUrl: 'http://localhost:3000/api',
```

Verificado: `apiUrl` não é referenciado em lugar nenhum (`web/src`, `mobile/src`, `packages/shared/src`), e não há nenhum servidor em `localhost:3000` no repositório. É exatamente a mesma espécie de artefato que a CAP-8 removeu — configuração que descreve um mecanismo inexistente e engana quem a encontra — sobrevivendo no arquivo que a AD-9 acabou de eleger como fonte única.

---

## O que passa, e vale registrar

- **CAP-4 cumprida de fato.** `GPS_ACTIVITY_IDS`, `ENDURANCE_IDS`, `STRENGTH_IDS` e `EASY_IDS` têm definição única em `packages/shared/src/fitness/activity-types.ts:48-57`, e o teste de disjunção existe e passa.
- **AD-13 cumprida.** `packages/shared` tem runner real (`tsx`) e os três testes antes órfãos executam — confirmado na saída (`8 testes passaram`, `4 testes passaram`, `7 testes passaram`).
- **AD-7 executa e está verde.** As quatro BARREIRA rodam; a catraca de `.from(` chegou a zero e virou barreira como previsto. A distinção catraca/barreira na Rule é das partes mais bem escritas da espinha.
- **AD-4 cumprida.** Nenhum `.from(` fora de `packages/shared/src/data/`; 16 módulos dono, um por tabela.
- **AD-6 e AD-8** ratificam corretamente convenções brownfield verificadas.
- A escolha de fronteira mecânica sobre semântica, com a justificativa registrada no memlog (linha 23: *"regra que exige julgamento ja falhou 5 vezes neste repo"*), é uma decisão de arquitetura genuinamente boa. O problema não é a fronteira — é que a guarda nunca chegou a implementá-la.

---

## Ordem sugerida de correção

1. **F3** — quebra produção no dia da publicação; correção de uma linha.
2. **F1** — decide se a AD-1 é lei ou orientação; tudo o mais depende dessa resposta.
3. **F2** e **F6** — duas cláusulas, ambas fechando divergência já materializada.
4. **F4** e **F5** — as duas dimensões silenciosas que a próxima feature vai encontrar primeiro.
5. **F7**–**F11** — higiene.
