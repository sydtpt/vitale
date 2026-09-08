---
title: 'Story 1.1 — AGG_VERSION vira vocabulário do núcleo'
type: 'bugfix'
created: '2026-09-08'
status: 'done'
review_loop_iteration: 1
baseline_commit: '7313ccc04b04051afc95262ef3d0c55d848b2a23'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Nenhuma edição em produção é elegível a errata. `AGG_VERSION = 9` é const
privada de um módulo do mobile, e o valor se perde em **quatro** passagens opcionais em fila
— a tela chama a store com um argumento só, a store repassa `undefined`, o adaptador faz
`?? null`, e o campo de escrita é opcional no núcleo. `precisaErrata` devolve `false` para
nulo, então o bump global que deveria marcar errata em todas as edições não marca nenhuma.
O conserto **precede o backfill**: sem ele, o arquivo inteiro nasce inelegível e o conserto
vira backfill do backfill.

**Approach:** A constante sobe para o núcleo com dono único — e **o valor não viaja**.
`upsertEdicao`, que mora no mesmo pacote, lê `AGG_VERSION` e carimba a linha ele mesmo. As
quatro passagens **deixam de existir** em vez de virarem obrigatórias, e o campo sai de
`EdicaoInput`. Nenhum hospedeiro escolhe a versão, então não há como omitir **nem como
gravar a errada**.

## Boundaries & Constraints

**Always:**
- A constante tem **um dono só** no núcleo e é lida de lá pelo sync do mobile.
- **A versão é lida no ponto de gravação, nunca recebida de fora.** Nenhum hospedeiro —
  telefone, script de backfill, hospedeiro futuro — tem superfície para escolhê-la.
- A barreira nova roda **offline**, sem cliente de banco, tem asserção de não-vacuidade, e
  varre também `supabase/functions`.
- O valor numérico permanece **9**. Esta story move e centraliza; não bumpa.

**Ask First:**
- Qualquer alteração no valor da constante.
- Qualquer remoção ou alteração das 7 edições hoje em produção.

**Never:**
- **Não** passar a versão como parâmetro por caminho nenhum — nem opcional, nem obrigatório.
  Um parâmetro tipado garante *presença*, nunca *correção*: `PACOTE_VERSAO` é `number`, sai
  do mesmo barril e compila no lugar dela.
- **Não** aplicar `not null` na coluna nesta story. As 7 edições em produção têm nulo ali, e
  elas só saem na migração da Story 1.9 — a constraint falharia. Ver Design Notes.
- Não tocar no caminho de **leitura**: `Edicao.aggVersionNoMomento` continua `number | null`
  enquanto a coluna aceitar nulo, e a guarda de nulo em `precisaErrata` continua necessária
  para as 7 linhas legadas.
- Não bumpar `PACOTE_VERSAO` nem `PROMPT_VERSAO`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Edição nova impressa | Um hospedeiro grava uma edição | A linha carrega a versão vigente (9), nunca nulo | N/A |
| Errata após bump | Edição gravada com 9; constante sobe para 10 | `precisaErrata` devolve **`true`** — hoje devolve `false` | N/A |
| Edição sem bump | Edição gravada com 9; constante segue 9 | `precisaErrata` devolve `false` | N/A |
| Linha legada | Uma das 7 edições, com nulo na coluna | `precisaErrata` devolve `false` — nulo é "não foi medido", não "igual" | N/A |
| Zero é medida | Edição com 0 na coluna, constante em 9 | `precisaErrata` devolve `true` — zero não é ausência | N/A |
| Hospedeiro tenta escolher a versão | Alguém passa a versão ao gravar | **Não compila** — não existe campo nem parâmetro para isso | Erro de tipo em `tsc` |
| Redefinição | Alguém declara a constante num segundo módulo | Barreira reprova, offline | Falha na suíte do núcleo |

</frozen-after-approval>

## Code Map

- `packages/shared/src/constants/agg-version.ts` -- **a criar**: o dono único, com o histórico
  v1→v9 movido do sync junto (esse comentário é a razão de ser da constante)
- `packages/shared/src/index.ts:8-14` -- o bloco de reexports de `constants/`
- `packages/shared/src/data/edicoes-ia.ts:94-108` -- `EdicaoInput`: o campo
  `aggVersionNoMomento?` **sai daqui**
- `packages/shared/src/data/edicoes-ia.ts:125-140` -- `upsertEdicao`: passa a ler `AGG_VERSION`
  por import relativo e a carimbar `agg_version_no_momento` ele mesmo
- `packages/shared/src/data/edicoes-ia.ts:143` -- `precisaErrata`; **read-only nesta story**
- `mobile/src/services/health-sync.ts:90` -- a definição privada atual; o comentário de 35
  linhas acima dela vai junto, e **não deixe bloco órfão para trás** (um ponteiro de uma linha
  ao lado do import basta)
- `mobile/src/services/health-sync.ts:215,253` -- os dois usos em código; comportamento intocado
- `mobile/src/lib/edicao-ia.ts:71-97` -- `gerarEdicao`: o parâmetro `aggVersion?` **sai**
- `mobile/src/store/edicao.store.ts:32,85` -- a assinatura e o repasse: **saem**
- `mobile/src/app/retrospectiva/index.tsx:294` -- a chamada volta a ter um argumento só, e a
  tela **não importa** `AGG_VERSION`
- `packages/shared/src/architecture.test.ts:30,55,173` -- `check()`, `mobileFiles`, e na 173 o
  precedente de asserção de não-vacuidade que a barreira nova imita
- `supabase/migrations/20260906150000_edicoes_ia.sql:43` -- a coluna nullable; **read-only**

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/constants/agg-version.ts` -- criar com a constante e o histórico
      v1→v9 -- é o dono único que a AD-16 exige
- [x] `packages/shared/src/index.ts` -- reexportar o módulo novo
- [x] `mobile/src/services/health-sync.ts` -- remover a definição local e importar do núcleo,
      sem deixar comentário órfão -- elimina o segundo dono
- [x] `packages/shared/src/data/edicoes-ia.ts` -- remover `aggVersionNoMomento` de
      `EdicaoInput` e fazer `upsertEdicao` ler a constante -- tira a superfície de erro
- [x] `mobile/src/lib/edicao-ia.ts` -- remover o parâmetro `aggVersion` -- a passagem some
- [x] `mobile/src/store/edicao.store.ts` -- remover `aggVersion` da interface e do repasse
- [x] `mobile/src/app/retrospectiva/index.tsx` -- a chamada volta a um argumento -- **já
      estava assim**: a tela nunca passou a versão nem importou a constante, e é justamente
      por isso que a gravação recebia `undefined`. Nenhuma edição foi necessária
- [x] `packages/shared/src/architecture.test.ts` -- barreira de dono único, com asserção de
      não-vacuidade, varrendo também `supabase/functions`
- [x] `packages/shared/src/data/edicoes-ia.test.ts` -- criar cobrindo as linhas da matriz; o
      fake de banco devolve linha **diferente** da enviada, para medir o mapeamento de verdade

**Acceptance Criteria:**
- Given uma edição gravada com a versão vigente e um bump posterior, when `precisaErrata` é
  consultado, then devolve `true`.
- Given qualquer hospedeiro, when ele grava uma edição, then não existe parâmetro nem campo
  pelo qual ele possa informar a versão — o valor vem da constante.
- Given a suíte do núcleo, when ela roda offline, then a barreira passa **e** falha tanto com
  um segundo dono quanto se ficar sem alvo.
- Given o sync do mobile, when ele decide backfill e grava o cursor, then usa o valor
  importado do núcleo e o comportamento de sync não muda.

## Spec Change Log

**2026-09-09 — iteração 1, `intent_gap` (abordagem renegociada pelo dono).**

- **Achado que disparou:** os três revisores convergiram, independentemente, no mesmo buraco.
  A abordagem anterior — quatro passagens de `number` obrigatório — fechava a *omissão* mas
  deixava aberto o *valor errado*: trocar `AGG_VERSION` por `PACOTE_VERSAO` na tela (mesmo
  barril, mesmo tipo, uma palavra) mantinha `tsc`, as 874 asserções, a barreira nova e o jest
  **todos verdes**, e carimbava 1 em vez de 9 para sempre.
- **O que foi amendado:** o `Approach` e as `Boundaries` no bloco congelado. O valor deixa de
  viajar: `upsertEdicao` lê a constante. `EdicaoInput` perde o campo; as três passagens do
  mobile somem.
- **Estado ruim evitado:** um carimbo silenciosamente errado — a mesma classe de defeito que
  a story existe para matar, entrando pela porta do valor em vez da porta da ausência.
- **KEEP — o que funcionou e tem que sobreviver à re-derivação:**
  1. O docblock da constante com o histórico **v1→v9 completo** movido do sync, mais a nota de
     que incrementar é global e caro. É a razão de ser da constante.
  2. A **asserção de não-vacuidade** da barreira, com a mensagem que diz o que fazer se a
     constante mudar de arquivo. Provada: mover o arquivo derruba o build.
  3. O regex da barreira usando `const\s+`, que de propósito **não casa consigo mesmo** dentro
     do arquivo de barreiras — com o comentário explicando por quê.
  4. O teste **"zero é medida, não ausência"**, que trava o `!= null` contra um futuro
     `if (e.aggVersionNoMomento && …)`.
  5. Os comentários que explicam *por que* cada mudança existe, no tom do repositório.

## Design Notes

**Por que o valor não viaja.** Um parâmetro obrigatório garante que *algo* chegue, nunca que
o *certo* chegue — e o errado está a uma palavra de distância, exportado do mesmo barril. Como
`upsertEdicao` e `AGG_VERSION` moram no mesmo pacote, ler no ponto de gravação elimina a
classe inteira: sem parâmetro não há valor errado, não há `NaN` (que o JSON serializa como
nulo, reabrindo o defeito original), e o script de backfill da Story 2.2 herda a garantia de
graça em vez de ter que lembrar de passar a versão.

**Por que a coluna NÃO vira `not null` aqui.** Tornar a coluna obrigatória sem o valor sempre
presente troca um defeito silencioso por falhas de escrita em produção. E há um impedimento
concreto: as 7 edições em produção têm nulo na coluna e **só saem na migração da Story 1.9**;
um `not null` agora falharia nelas. A constraint pertence àquela migração.

**A garantia continua sendo o tipo — mas agora pela ausência.** Não existe campo em
`EdicaoInput` nem parâmetro em `gerarEdicao`, então não há o que preencher errado. A barreira
em `architecture.test.ts` cobre o que o tipo não alcança: um segundo módulo declarando a
constante. Ela varre também `supabase/functions`, porque a edge function é hospedeiro e a
barreira irmã da cadeia de provedores já existe por essa razão.

## Verification

**Commands:**
- `pnpm --filter @vitale/shared lint` -- expected: 0 erros
- `pnpm --filter @vitale/shared test` -- expected: exit 0; a barreira nova e os testes de
  `edicoes-ia` aparecem na saída
- `cd mobile && pnpm exec tsc --noEmit` -- expected: 0 erros
- `cd mobile && pnpm exec jest` -- expected: sem regressão
- `pnpm --filter @vitale/web build && pnpm --filter @vitale/web test` -- expected: sem regressão

**Provas negativas (rodar e reverter, porque teste verde não demonstra reprovação):**
- Declarar `AGG_VERSION` num segundo arquivo -- expected: a barreira reprova e lista os dois.
- Mover `constants/agg-version.ts` -- expected: a asserção de não-vacuidade dispara.
- Tentar passar a versão a `upsertEdicao` ou a `gerarEdicao` -- expected: erro de tipo.

**Manual checks:**
- Após instalar o build, imprimir uma edição nova e confirmar em produção que a linha tem
  `agg_version_no_momento = 9`. Só a linha real prova o caminho de escrita.

## Suggested Review Order

**O dono único, e por que o valor não viaja**

- O ponto de entrada: a constante e o docblock que explica o custo de um bump.
  [`agg-version.ts:58`](../../packages/shared/src/constants/agg-version.ts#L58)

- O carimbo acontece aqui dentro, sem ninguém informar nada — é o coração da story.
  [`edicoes-ia.ts:143`](../../packages/shared/src/data/edicoes-ia.ts#L143)

- A ausência do campo é a garantia: não há o que preencher errado.
  [`edicoes-ia.ts:98`](../../packages/shared/src/data/edicoes-ia.ts#L98)

- Como os hospedeiros alcançam a constante.
  [`index.ts:9`](../../packages/shared/src/index.ts#L9)

**As duas barreiras**

- Dono único, com não-vacuidade primeiro e escopo até `scripts/`.
  [`architecture.test.ts:233`](../../packages/shared/src/architecture.test.ts#L233)

- O congelamento do valor: vermelho aqui é pedido de confirmação, não defeito.
  [`health-sync-backfill.test.ts:30`](../../mobile/src/lib/__tests__/health-sync-backfill.test.ts#L30)

**A decisão de backfill, agora testável**

- A expressão extraída sem mudar de comportamento, longe do HealthKit.
  [`health-sync-cursor.ts:31`](../../mobile/src/lib/health-sync-cursor.ts#L31)

- O sync chama a função em vez de repetir a expressão.
  [`health-sync.ts:181`](../../mobile/src/services/health-sync.ts#L181)

**Apoio**

- O fake devolve linha diferente da enviada, então mede o mapeamento em vez de ecoar.
  [`edicoes-ia.test.ts:94`](../../packages/shared/src/data/edicoes-ia.test.ts#L94)
