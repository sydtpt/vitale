# Review de verificação — ARCHITECTURE-SPINE (revista da Retrospectiva)

- **Alvo:** `_bmad-output/planning-artifacts/architecture/architecture-Orbe-revista-2026-09-08/ARCHITECTURE-SPINE.md`
- **Lente:** verificação — *toda decisão vinculada foi pesquisada ou conferida, ou foi afirmada de memória?*
- **Data:** 08/09/2026
- **Método:** documentação oficial (PostgREST, PostgreSQL, W3C/WCAG, reactnative.dev),
  **código-fonte do PostgreSQL** (`plancat.c`, `execIndexing.c`, REL_17_STABLE), leitura do
  repositório, e **medição executada** dos contrastes com `tsx` sobre o próprio `derive.ts`.

## Veredito

**A espinha é excepcionalmente bem ancorada.** As três pernas do AD-4 — a decisão que a
própria tarefa marcou como "se algum destes três estiver errado, o AD-4 cai" — **estão todas
corretas**, e a terceira, que a documentação só sustenta por inferência, foi **provada no
código-fonte do PostgreSQL**. AD-9, AD-12, AD-2 e o Stack conferem literalmente. O número
mais difícil de conferir (`4,25` do AD-8) foi **medido e bate em 4,246**.

O que a revisão encontrou não é sujeira de citação — é **um desvio de protocolo dentro de um
estudo pré-registrado**, que passou porque a espinha argumentou *precisão* onde a mudança
real foi de *fronteira*.

---

## Achados

### F-1 · ALTA — AD-6 muda a exposição pré-registrada, e o faz sem declarar

`pre-registro-lua.md` §3 define a exposição, **palavra por palavra**:

> **Exposição** | as **5 noites que antecedem a lua cheia** (fase **−5 a −1** do sinódico),
> contra todas as outras noites

O AD-6 redefine essa janela:

> uma noite está dentro quando cai em `(cheia − 5 dias, cheia]`

São duas coisas diferentes, e a diferença não é decorativa:

1. **O intervalo é fechado à direita.** `cheia]` inclui a própria noite da lua cheia — que em
   linguagem de fase é a **fase 0**. O §3 diz `−5 a −1`, que **exclui** a noite da cheia. Sob
   a leitura literal do §3 a coluna testada é `{−5,−4,−3,−2,−1}`; sob o AD-6 ela vira algo
   próximo de `{−4,−3,−2,−1,0}`. **A coluna testada anda uma noite**, e a noite que entra
   (a da cheia) é justamente a de maior valor esperado sob a hipótese — o que enviesa **a
   favor** do achado.
2. **A espinha nunca cita o §3.** O argumento do AD-6 é inteiramente sobre *precisão*: que a
   idade sinódica tem ~0,8 dia de erro e que "0,8 dia embaralha a coluna testada com a de
   controle". Esse argumento está **certo** (e verificado — ver Confirmados). Mas ele
   justifica trocar *como se mede* a distância, **não** trocar *quais noites entram*. A
   mudança de fronteira entra de carona num argumento sobre ruído.
3. **O companion afirma o contrário.** `correcao-pre-registro-lua.md` declara que o §3 segue
   *"intocado, palavra por palavra"* e que *"uma correção que mexesse no §3, no §4 ou no §5
   **invalidaria o pré-registro**"*. Ou o AD-6 é uma reinterpretação do §3 — e então o
   companion está errado ao dizer que o §3 está intocado — ou o AD-6 excede sua alçada.
4. **A barreira do AD-7 não pega isso.** O sha256 pina `pre-registro-lua.md`, que de fato não
   mudou. A mudança de fronteira vive **na espinha**, que nada hasheia.

**Por que é ALTA:** é um pré-registro. O valor inteiro do artefato é que a definição da
exposição não pode se mover depois que alguém olha o dado. Aqui ela se move dentro do
documento de arquitetura, num sentido que favorece o achado, sem ser nomeada como mudança.

**O que fecha:** ou (a) o AD-6 adota `[cheia − 5 dias, cheia)` — cinco noites que *antecedem*,
fiel ao §3 — e diz explicitamente que está operacionalizando `−5 a −1` com ancoragem em
instante em vez de em idade; ou (b) a mudança de fronteira entra no
`correcao-pre-registro-lua.md` como **Correção 3**, declarada, datada e assumindo o custo de
tocar o §3. O que não pode é seguir implícita.

---

### F-2 · MÉDIA — a barreira do hash protege metade do protocolo

O AD-7 hasheia `pre-registro-lua.md` e quebra o build se ele mudar. Mas a espinha, no mesmo
movimento, **parte o protocolo em dois arquivos**: `correcao-pre-registro-lua.md` passa a ser
quem manda no §7.2 (onde a execução é gravada) e no §7.3 (quando o build quebra).

Esse segundo arquivo **não é hasheado**. Ele pode ser editado — inclusive para afrouxar a
própria regra de quebra de build — com a suíte verde. A barreira que existe para impedir que
o protocolo mude em silêncio deixa de fora exatamente o arquivo que hoje contém as regras
mais recentes do protocolo.

**O que fecha:** `PRE_REGISTRO_LUA_SHA` vira um par (ou o hash cobre os dois arquivos
concatenados em ordem fixa). O `companions:` do front-matter já declara o
`correcao-pre-registro-lua.md` como *"correção obrigatória"* — a barreira deveria concordar.

*Nota favorável:* o sha256 declarado no companion —
`d09365de54bb6bbd6fa8d99af9d1f26cddaebc3492029a63d6b1b6e4f6759664` — **foi recalculado e
bate exatamente**, e `git status` confirma que `pre-registro-lua.md` não está modificado. A
afirmação "o arquivo corrigido não foi editado" é verdadeira e verificável.

---

### F-3 · MÉDIA — o intervalo `1,00 a 1,28` do AD-8 está errado, e erra no tema padrão

O AD-8 justifica a existência do `onAccent` assim:

> Alguém usar `on` sobre `accent`, que **mede 1,00 a 1,28** e é invisível

**Medido** (36 combinações tema × paleta × esquema × 11 papéis = 396 pares, executando
`resolveTokens` e `contrast` de verdade):

| | valor |
|---|---|
| mínimo de `contrast(on, accent)` | **1,000** |
| máximo | **1,943** |
| mediana | 1,000 |
| pares acima de 1,28 | **6 de 396** |
| pior caso | **1,943 — `orbe` / `orbe` / `light` / `yellow`** |

O teto real é **1,943**, não 1,28. E o pior caso é a combinação **histórica padrão** — tema
Orbe, paleta Orbe, claro —, que é onde qualquer leitor conferiria primeiro. Os outros cinco
acima de 1,28 são `clean/acessivel/dark/red` (1,403), `clean/joia/dark/purple` (1,400),
`clean/joia/dark/deep` (1,393), `clean/acessivel/dark/purple` (1,387) e `orbe/orbe/light/green`
(1,283).

**A decisão sobrevive** — 1,94 continua ilegível, e o `onAccent` continua necessário. O que
não sobrevive é o número, que foi afirmado e não medido.

---

### F-4 · MÉDIA — "sempre as quatro linhas" colide com "nunca se reescreve"

Três regras da espinha, lidas juntas, não fecham:

- **Paradigma:** *"o que foi publicado nunca é reescrito — muda por errata"*
- **Convenção "Escrita de edição":** *"Sempre o conjunto das quatro linhas numa chamada
  (AD-4). Nunca uma linha avulsa"*
- **`mudancas-mecanicas.md` (linhas 17–18):** `PACOTE_VERSAO`, `prompt_versao`, provedor,
  modelo e `agg_version_no_momento` seguem **por linha** — *"o caderno de Sono ganha errata
  sem tocar no de Movimento"*

Se toda impressão parcial grava as quatro linhas, então reimprimir só o caderno Rotina
**reescreve as três linhas que não mudaram** — incluindo `provedor`, `modelo`,
`prompt_versao`, `pacote_versao` e `gerado_em`. Ou o cliente relê as três e as regrava
byte a byte (inclusive a assinatura e o carimbo de tempo original), ou a granularidade por
linha que o companion promete se perde na primeira errata.

A espinha resolve o problema de *concorrência* (a permutação de `posicao`) e não menciona o
de *preservação*. É exatamente o tipo de coisa que dois construtores implementariam
diferente — que é o critério declarado no cabeçalho para o que deve estar na espinha.

**O que fecha:** uma frase no AD-4 dizendo que a reimpressão parcial carrega as linhas
intocadas **verbatim, assinatura e `gerado_em` inclusive**, e que `gerado_em` não é
`default now()` no caminho de upsert.

---

### F-5 · MÉDIA — o AD-6 não diz qual instante representa "uma noite"

A janela é "distância ao instante da lua cheia", e o desfecho primário do §3 é a **hora de
apagar** — que pode cair às 23:50 de um dia ou às 00:30 do seguinte. A espinha nunca define
qual instante da noite entra na comparação com `cheia`: a data da noite? o `sleep_start`? o
instante de apagar? o meio-dia local da data de referência?

Com uma fronteira dura em `cheia − 5 dias` e um desfecho que atravessa a meia-noite por
desenho, a escolha do âncora **move noites através da borda** — e move justamente as noites
tardias, que são as que carregam o efeito sob a hipótese. Precisão de minutos no instante da
cheia (que o AD-6 conquista) não serve de nada se o outro lado da subtração é ambíguo em
horas.

Isto agrava o F-1: as duas juntas fazem a coluna testada depender de uma decisão de
implementação não escrita.

---

### F-6 · BAIXA — o AD-1 se contradiz: doze ou treze blocos?

- AD-1 **Prevents:** *"os **doze** blocos da Retrospectiva serem absorvidos ou demitidos"*
- AD-1 **Rule:** *"seletor, os **treze** blocos e o painel Diagramação ficam"*

**Conferido:** `packages/shared/src/period/retro-blocks.ts` declara exatamente **13** blocos
(`lede`, `kpis`, `highlights`, `heatmap`, `tasks`, `dailyTasks`, `purchases`, `fitness`,
`sports`, `health`, `sleep`, `habits`, `yearSeries`). O `sleep` entrou em 05/09/2026 — o
"doze" é a contagem anterior a ele.

---

### F-7 · BAIXA — "nas 36 combinações" descreve mal o que a barreira assere

O AD-8 diz que a barreira verifica `contrast(onAccent, accent) ≥ GRAPHIC_FLOOR` *"nas 36
combinações"*. 36 é o número de combinações **tema × paleta × esquema** (3 × 6 × 2) — e isso
confere. Mas a asserção percorre **396 pares** (36 × 11 papéis), que é o número que o
construtor precisa esperar ver no output do teste.

**Medido, e favorável à espinha:**

| | valor |
|---|---|
| mínimo de `max(contrast(ink, accent), contrast(bgPure, accent))` | **4,246** — `orbe` / `terra` / `light` / `orange` |
| pares abaixo de 3,0 (`GRAPHIC_FLOOR`) | **0** |
| pares abaixo de 4,5 (`TEXT_FLOOR`) | 26 |

O **4,25** que a espinha registra como folga está correto (4,246), e a afirmação de que
cobrar `TEXT_FLOOR` derrubaria o build também (26 pares abaixo de 4,5). `GRAPHIC_FLOOR = 3`
e `TEXT_FLOOR = 4.5` conferem em `derive.ts:76,78`.

---

### F-8 · BAIXA — Meeus cap. 49 devolve JDE (Tempo Dinâmico), não UT

A afirmação da espinha ("Meeus cap. 49, erro de minutos") está **correta e é conservadora** —
o capítulo é preciso a poucos segundos. Mas há uma armadilha de implementação que a espinha
não nomeia: **o capítulo 49 devolve JDE, em Tempo Dinâmico**, e nenhuma das duas
implementações de referência que consultei aplica ΔT. Em 2026, ΔT ≈ **+69 s**.

Para uma janela de cinco dias isso é irrelevante — e é por isso que a folga de "minutos" da
espinha absorve o descuido. Vale registrar só para que o construtor não trate o retorno como
UTC em algum outro contexto (a hora impressa numa página, por exemplo).

---

### F-9 · BAIXA — dois detalhes de citação

1. **AD-7:** *"a suíte roda com `npx tsx`"*. O script real é
   `find src -name '*.test.ts' -print0 | xargs -0 -n1 tsx` (`packages/shared/package.json:10`).
   A substância — sem cliente de banco, offline — **confere**: `architecture.test.ts` importa
   só `node:assert`, `node:fs`, `node:path` e módulos locais. `node:crypto` cabe ali sem
   quebrar a propriedade.
2. **AD-5 Prevents:** *"`edicoes_ia`, onde o CHECK recusa `caderno='lua'`"* — dito no
   presente. A migration em vigor (`20260906150000_edicoes_ia.sql`) **não tem coluna
   `caderno`**; o CHECK está especificado como trabalho futuro em `mudancas-mecanicas.md:12`.
   A citação é fiel ao companion, mas o tempo verbal sugere um estado que o banco ainda não
   tem.

---

### F-10 · BAIXA — o número da ADR da emenda está em aberto num repo com histórico de colisão

O Structural Seed pina `docs/decisions/00xx-…-emenda-a-0045.md`. O próximo número livre é
**0047** — `0046-a-linha-de-entrada-carrega-o-veredito.md` já existe. E este repositório tem
histórico documentado de colisão de número de ADR entre branches: o próprio `git status`
desta branch mostra `0035 → 0043` e `0040 → 0044` sendo renumeradas agora.

Deixar `00xx` numa espinha que será executada em paralelo com outras frentes é convite à
terceira colisão. **Conferido:** ADR 0045 (`o-resultado-negativo-publica-com-o-mesmo-destaque`)
existe, e a leitura do AD-11 herdada — *ADR é imutável, emenda é ADR nova* — está correta.

---

## Confirmados — o que resistiu à verificação

### AD-4 — as três pernas, e a terceira provada no código-fonte

| Afirmação | Veredito | Fonte |
|---|---|---|
| PostgREST envolve toda requisição numa transação | ✅ **verdadeira** | docs.postgrest.org, `references/transactions.html`, **v12 e `latest`**: *"After User Impersonation, every request to an API resource runs inside a transaction."* + *"If the transaction doesn't fail, it will always end in a COMMIT"* |
| `UNIQUE … DEFERRABLE INITIALLY DEFERRED` só é cobrada no COMMIT | ✅ **verdadeira** | postgresql.org, `sql-createtable`: *"If the constraint is `INITIALLY DEFERRED`, it is checked **only at the end of the transaction**."* E `UNIQUE` está entre os tipos que aceitam a cláusula |
| Uma unique deferida na tabela **não** impede `ON CONFLICT` com a PK não-deferrable como árbitro | ✅ **verdadeira** | ver abaixo |

A terceira é a que a documentação sustenta apenas por inferência — `sql-insert.html` diz
*"only NOT DEFERRABLE constraints and unique indexes are supported as arbiters"*, o que
restringe **quem pode ser árbitro**, não **quem pode existir na tabela**. Por ser a perna que
derruba o AD-4 se falhar, fui ao código-fonte do PostgreSQL (REL_17_STABLE):

- **`src/backend/optimizer/util/plancat.c`**, no laço de inferência de árbitro, o comentário é
  explícito sobre *não* filtrar por `indimmediate`:

  > *"Let executor complain about `!indimmediate` case directly, because enforcement needs to
  > occur there anyway when an inference clause is omitted."*

  Ou seja: o planejador não rejeita a tabela por ter índice deferido. Ele só se importa com o
  índice **escolhido**.

- **`src/backend/executor/execIndexing.c:584-588`**, em `ExecCheckIndexConstraints`:

  ```c
  /* When specific arbiter indexes requested, only examine them */
  if (arbiterIndexes != NIL &&
      !list_member_oid(arbiterIndexes, indexRelation->rd_index->indexrelid))
      continue;
  ```

  Todo índice fora da lista de árbitros é **pulado**. O unique deferido de `posicao` nunca é
  consultado durante o `ON CONFLICT`.

- **`execIndexing.c:418-425`** confirma o mecanismo que o AD-4 depende: para um índice unique
  não-imediato, `checkUnique = UNIQUE_CHECK_PARTIAL` — a tupla entra no índice e a
  verificação de unicidade fica para o fim da transação.

**O AD-4 fica de pé nas três pernas.** É a decisão mais bem fundamentada da espinha.

### AD-6 — a premissa sobre `moon.ts` e sobre Meeus

- `packages/shared/src/astro/moon.ts` (195 linhas) exporta `moonPhase`, `moonPhaseName`,
  `moonPhaseLabel`, `moonShadowPath`, `moonShadeAlphaFor`, `MOON_SHADE_ALPHA`,
  `MOON_GLOW_ALPHA`. **Não devolve idade em dias** ✅
- E o próprio arquivo já documenta a razão que o AD-6 invoca, nas linhas 20–22: *"O que este
  módulo **não** devolve é a idade em dias. Ela sai da elongação com **até ~0,8 dia de erro**,
  porque a lua não percorre a órbita em velocidade constante."* A espinha não inventou o
  número — ele estava no código.
- O módulo cita "Meeus 25" (Sol) e "Meeus 47" (Lua), consistente com a numeração da 2ª edição
  em que o cap. **49 é "Phases of the Moon"** — confirmado por implementação independente que
  cita *"Meeus: Astronomical Algorithms (2nd ed.), chapter 49"*.
- Precisão do cap. 49: **poucos segundos** para o instante verdadeiro. "Erro de minutos" é
  conservador ✅
- Aritmética do argumento: 0,8 dia = 19,2 h contra uma janela de 5 dias — o embaralhamento é
  real. Minutos, não. O raciocínio quantitativo está certo.
- `TRIGGER_MIN_PER_CELL` de fato mora em `packages/shared/src/sleep/triggers.ts` ✅

### AD-9 — confirmado por três vias independentes

| | |
|---|---|
| Doc oficial | reactnative.dev/docs/accessibilityinfo marca `setAccessibilityFocus()` como **Deprecated**: *"Prefer using `sendAccessibilityEvent` with eventType `focus` instead."* ✅ |
| Fonte instalada | `mobile/node_modules/react-native/Libraries/Components/AccessibilityInfo/AccessibilityInfo.js:448` — `@deprecated Use \`sendAccessibilityEvent\` with eventType \`focus\` instead.` ✅ |
| As duas expostas | `AccessibilityInfo.d.ts:141` (`setAccessibilityFocus`) e `:174` (`sendAccessibilityEvent`) ✅ |
| `'focus'` é válido | `AccessibilityInfo.d.ts:41` — `type AccessibilityEventTypes = 'click' \| 'focus' \| 'viewHoverEnter'` ✅ |
| "ao lado dos cinco que já existem" | `mobile/src/hooks/` tem exatamente 5: `useActivityPhotos`, `useAssetUri`, `useMediaCounts`, `useRefreshOnForeground`, `useTabBarHeight` ✅ |

**Ressalva de método:** o `.d.ts` que a tarefa apontou **não carrega** a anotação
`@deprecated` — só o `.js` carrega. Quem conferisse apenas o `.d.ts` concluiria erradamente
que a depreciação não existe. A afirmação da espinha ("a doc atual do React Native deprecou")
é sobre a documentação, e essa está correta.

*Detalhe de assinatura:* `sendAccessibilityEvent(handle: HostInstance, …)` recebe a
**instância**, não o objeto ref — na prática `ref.current`. A espinha escreve
`sendAccessibilityEvent(ref, 'focus')`. Trivial, mas é onde o construtor tropeça uma vez.

### AD-8 — o piso de 3,0 é legalmente correto

- **WCAG 1.4.3 (W3C, Understanding SC 1.4.3):** texto grande = *"at least 18 point or 14
  point bold"* ≈ **24px / 18,5px**, com mínimo de **3:1**; abaixo disso, 4,5:1. ✅
- **22 px peso 700 é texto grande** (22 ≥ 18,66) — o piso de 3,0 é o piso **legal**, não uma
  frouxidão. ✅
- A premissa dos 22/700 não foi inventada: `ux-revista-retrospectiva-2026-09-07/DESIGN.md:292`
  — `| \`caderno-nome\` | 22, peso 700 | sans | **dentro da faixa** |`. ✅
- `onAccent` **não existe** hoje em `derive.ts`: só `onPrimary` (`:304`, derivado em `:444-446`
  como argmax entre `#FFFFFF` e `#000000` sobre `brandBase`). `RoleTokens` (`:267`) tem
  `accent · soft · on · text · graphic · wash · ramp`; `ModuleTokens` (`:467`) tem
  `tint · accent · onTint`. ✅

### AD-2 — jsonb sem CHECK, descarte silencioso

- `supabase/migrations/20260825120000_user_preferences_retro_prefs.sql`:
  `add column if not exists retro_prefs jsonb not null default '{}'::jsonb` — **sem CHECK de
  forma** ✅. Nenhuma migration posterior adiciona um.
- `resolveRetroPrefs` (`period/retro-blocks.ts:103-139`) descarta em silêncio nos três
  caminhos: id fora de `BY_ID` no `order` (`:115`), chave desconhecida ou bloco `fixed` no
  `hidden` (`:129`), e chave de topo desconhecida simplesmente não é copiada. ✅
- `moveBlock` (`:203`), `PROOF_DAYS` (`:30`), `DEATH_DAYS` (`:33`), `deadBlocks` (`:183`) e
  `visibleBlocks` (`:152`) existem — o Structural Seed sabe o que está removendo. ✅

### AD-12 — a varredura é exatamente a descrita

`packages/shared/src/architecture.test.ts`:

- Barreira do `.from()` (`:105-116`) percorre `[...webFiles, ...mobileFiles]`, definidos em
  `:54-55` como `walk(join(ROOT, 'web', 'src'))` e `walk(join(ROOT, 'mobile', 'src'))` —
  **web/src e mobile/src, e nada mais** ✅
- Barreira do `createClient` (`:125-134`) percorre `walk(join(ROOT, 'packages', 'shared',
  'src'))` — **só o núcleo** ✅
- `scripts/` **ainda não existe** na raiz — consistente com o AD-12 tratá-lo como algo que
  nasce, e o ponto ("invariante que vale só para quem chegou primeiro não é invariante") é
  legítimo. ✅

### Stack — confere linha a linha

| Declarado | Real | |
|---|---|---|
| React Native 0.86.3 | `mobile/package.json:44` = `0.86.3`; instalado `0.86.3` | ✅ |
| Expo ~57.0.20 | `mobile/package.json:21` = `~57.0.20`; instalado `57.0.20` | ✅ |
| TypeScript núcleo ~5.8 | `packages/shared/package.json` = `~5.8.0` | ✅ |
| TypeScript mobile ~6.0.3 | `mobile/package.json:66` = `~6.0.3`; instalado `6.0.3` | ✅ |
| `PACOTE_VERSAO` 1 → 2, `PROMPT_VERSAO` 2 → 3 | `mudancas-mecanicas.md:94-95` | ✅ |
| ADR 0040 = provedor é configuração | `0040-o-provedor-de-modelo-e-configuracao-nao-arquitetura.md` | ✅ |

*(A web usa TypeScript `~5.9.0`, não listado — correto, já que a web é não-objetivo
declarado e a tabela diz "só o que esta frente pina ou toca".)*

### Invariantes herdadas — todos os ids existem e os títulos batem

`architecture-Orbe-2026-08-17/ARCHITECTURE-SPINE.md` declara **AD-1 … AD-18** ✅. Conferidos
um a um os dez citados: AD-1 *Fronteira mecânica entre núcleo e adaptador*, AD-2 *Arquivo que
mistura é partido*, AD-3 *Dono único do vocabulário de domínio*, AD-4 *Contrato de schema no
núcleo, client injetado*, AD-5 *Banco como exceção nomeada*, AD-7 *Guarda mecânica no teste*,
AD-11 *ADR é imutável*, AD-12 *Estado é do app*, AD-13 *Target de teste não pode ser stub*,
AD-15 *Piso de TypeScript do núcleo*, AD-17 *O portão automatizado cobre os três workspaces*.
Nenhuma leitura distorcida.

### Demais afirmações pontuais

| Afirmação | Onde | |
|---|---|---|
| `periodoFechado` devolve `false` para `'all'` sempre | `ia/pacote.ts:144` — `if (tipo === 'all') return false;` | ✅ |
| o CHECK do banco recusa `'all'` | `20260906150000_edicoes_ia.sql` — `check (tipo_periodo in ('week','month','season','year'))` | ✅ |
| `verificar.ts` já trata `\d{1,3}(?:\.\d{3})+` como milhar | `ia/verificar.ts:48` — `const NUM = /\d{1,3}(?:\.\d{3})+\|\d+,\d+\|\d+/g` | ✅ |
| `taken_at` é a chave de cura (ADR 0037) | `20260906160000_activity_photos.sql:18` — *"A chave real é `(user_id, activity_id, taken_at)`"* | ✅ |
| `deviceCoords()` existe e seria "natural e errado" usar | `astro/timezone-coords.ts:81` | ✅ |
| `TONE_COLOR` com hex cravado em `retrospectiva/index.tsx:75` | linha 75 exata: `{ good: '#6FA86A', bad: '#D9491B', … }` | ✅ |
| painel "Diagramação" existe e ficaria | `retrospectiva/index.tsx:737` | ✅ |
| `photos/retro.ts`, `astro/sun.ts`, `ia/pacote.ts`, `ia/verificar.ts`, `data/edicoes-ia.ts`, `fetchAllPages` | todos existem | ✅ |
| ADR 0045 existe e é a do resultado negativo | `0045-o-resultado-negativo-publica-com-o-mesmo-destaque.md` | ✅ |
| §7 do pré-registro pede "permanente e contável" | `pre-registro-lua.md:155` | ✅ |
| §7.3 é condicional a "execução já gravada" | `pre-registro-lua.md:160-163` | ✅ |
| cabeçalho diz "este arquivo é imutável" | `pre-registro-lua.md:8` | ✅ |
| `architecture.test.ts` roda offline | importa só `node:assert`, `node:fs`, `node:path` + locais | ✅ |

---

## Contagem

| Severidade | Nº | Achados |
|---|---|---|
| **Alta** | 1 | F-1 |
| **Média** | 4 | F-2, F-3, F-4, F-5 |
| **Baixa** | 6 | F-6, F-7, F-8, F-9, F-10 *(F-9 agrega dois itens de citação)* |
| **Total** | **11** | |

**Afirmações verificadas e confirmadas:** 40+, incluindo as 3 pernas do AD-4 (duas por
documentação oficial, uma por código-fonte do PostgreSQL), as 4 vias do AD-9, os 2 números
medidos do AD-8, e as 6 versões do Stack.

## Recomendação

**Bloquear a construção da lua (CAP-12) até F-1 e F-2 fecharem.** As duas tocam a
integridade do pré-registro, e ambas são baratas agora e caras depois de a primeira execução
gravar linha. O resto da espinha — em particular o AD-4, que era o maior risco declarado — está
sólido o bastante para construir.

F-3, F-6, F-7 e F-9 são correções de texto na própria espinha, de minutos. F-4 e F-5 pedem
uma frase cada, mas são frases que decidem implementação.
