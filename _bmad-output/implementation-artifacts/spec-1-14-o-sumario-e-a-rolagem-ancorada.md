---
title: 'Story 1.14 — O sumário e a rolagem ancorada'
type: 'feature'
created: '2026-09-18'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'e1fcac2e3b1f7571b67ae1b402375417bc292d43'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A edição tem capa (1.13) e cadernos (1.12), e **nenhuma navegação**. A ordem do miolo é variável de propósito, então a posição não ensina nada: quem abre julho rola os quatro cadernos para descobrir qual importa. O desenho aprovado (CAP-8) chama isso de forma da revista — capa · sumário · cadernos —, e hoje falta o meio.

**Approach:** Entre a capa e o miolo entra o **sumário**: uma linha por caderno, na ordem impressa, com o nome dele e **a chamada** — a mesma frase que a capa já usa como manchete, pelo mesmo dono no núcleo. Tocar a linha **rola com âncora** até a faixa daquele caderno, na mesma página, e **move o foco do leitor de tela junto**. A rolagem nasce **hook genérico** em `mobile/src/hooks/`: a revista é a primeira cliente, não a dona.

## Boundaries & Constraints

**Always:**
- **A chamada tem dono único** (`chamadaDoTexto`, núcleo) e é decidida na **vista** (`vistaDaEdicao`), não no render — é a mesma função que já produz a manchete da capa. Sem frase fechada ela **não existe**: `null`, nunca string vazia.
- **A linha permanece em estado misto**, com o nome e sem chamada. O sumário não espera ficar completo e existe sempre que o miolo existe — inclusive com **um** caderno (22 das 39 edições mensais do arquivo).
- **Alvo de toque é a linha inteira**, mínimo 44 px (o desenho aprovado dá 62 de mínimo, e a altura é **mínima**, nunca fixa: o tipo dinâmico cresce dentro dela).
- **Rolar não navega:** sem `router`, sem entrada na pilha, sem barra fixa. A faixa do caderno continua **não tocável** — ela é âncora e identidade.
- **O foco vai junto:** `AccessibilityInfo.sendAccessibilityEvent(ref, 'focus')` na faixa de destino. **Nunca** `setAccessibilityFocus` (deprecado) e **nunca** `findNodeHandle` — hoje há zero ocorrências dos dois, e a barreira nasce no mesmo commit.
- **A chamada aparece inteira** — sem `numberOfLines`, sem "…", com o Markdown cru como vem: cortar esconderia o fim da frase, onde mora a base comparada.
- **Rótulo em `ink2`**, nunca `ink3`; cor por token, nenhum hex, nenhuma folha de escopo de módulo lendo tema.
- **A repetição capa × linha 1 é forma, não defeito** — as duas ficam, visíveis e audíveis.

**Ask First:**
- Esconder a manchete da capa da fila do leitor de tela quando a linha 1 carrega a mesma string (achado da revisão de acessibilidade, ainda **não** convertido em critério).
- Mudar o corpo da chamada, a altura mínima da linha, a seta, ou qualquer coisa do desenho aprovado de 07/09.
- Dependência nova no mobile.

**Never:**
- Barra fixa ao rolar, caderno que colapsa, gesto horizontal, sumário em rota própria, sumário que reordena.
- Tocar capa, ordem, errata, conferência, `edicao_imprimir` ou o banco. Nenhuma migração.
- Recalcular a chamada no render, ou reimplementar o corte da primeira frase.

## I/O & Edge-Case Matrix

| Cenário | Estado | Esperado | Erro |
|---|---|---|---|
| Edição cheia | quatro cadernos impressos | quatro linhas na ordem de `posicao`, nome + chamada; a linha 1 repete a manchete | N/A |
| Estado misto | um `escrevendo`, um `reprovada` | as linhas **ficam**, com o nome e sem chamada | N/A |
| Texto sem frase fechada | caderno `pronta`, `chamadaDoTexto` devolve `null` | linha com o nome e sem chamada | nunca string vazia |
| Edição rasa | um caderno só | sumário de uma linha | N/A |
| Miolo vazio | nunca escrita, nada nesta sessão | **sem sumário** — o convite está na capa | N/A |
| Toque na linha | âncora medida | rola até o topo daquele caderno, sem navegação; o foco vai para a faixa | N/A |
| Âncora ainda sem layout | `onLayout` não chegou | **nada acontece** — nem rolagem nem foco | sem exceção, sem log de erro |
| Reduzir Movimento ligado | ajuste do sistema | a rolagem é instantânea; o foco vai igual | N/A |

</frozen-after-approval>

## Code Map

- `mobile/src/store/edicao.store.ts:298` `CadernoNaVista` — a variante `pronta` ganha `chamada`. Ela é empilhada em **dois** lugares: `:447` (linha do banco) e `:477` (`escrito` na sessão, ainda sem gravação). Os dois precisam da chamada. `:369` `chamadaDaCapa` mostra o molde — `chamadaDoTexto` já está importado no arquivo (`:4`).
- `mobile/src/store/__tests__/edicao-store.test.ts` — onde a matriz da vista já é testada; a da chamada entra aqui.
- `packages/shared/src/revista/chamada.ts:218` `chamadaDoTexto(texto): string | null` — exportado por `@vitale/shared`. Dono único, com barreira própria em `architecture.test.ts:3422`. **Nunca reimplementar.**
- `mobile/src/app/revista/[tipo]/[inicio].tsx:231` o `ScrollView` da edição e `:246` o `cadernos.map` — o ponto de enxerto, nesta ordem: capa → sumário → cadernos. `:366` a `Caderno`, cuja **faixa** (`:374`, já `accessibilityRole="header"` com o nome como rótulo) é a âncora e o alvo do foco. A folha começa em `:475`.
- `mobile/src/hooks/useFotoDaCapa.ts` — molde de hook desta casa (ciclo, estado, comentário de porquê).
- `mobile/src/components/charts/StackedBarChart.tsx:149` — o **único** uso de `AccessibilityInfo` hoje: `isReduceMotionEnabled()` + `addEventListener('reduceMotionChanged')`, com guarda de montagem. Copiar o ciclo.
- `mobile/src/components/cards/TodayBodyCard.tsx:254` `React.ComponentRef<typeof ScrollView>` e `:322` `scrollTo({ …, animated })` — o tipo e a chamada que esta casa usa.
- `mobile/node_modules/react-native/…/AccessibilityInfo.d.ts:174` — `sendAccessibilityEvent(handle: HostInstance, 'click' | 'focus' | 'viewHoverEnter')`. O handle é **o ref do host**, e é por isso que `findNodeHandle` não entra.
- `packages/shared/src/architecture.test.ts` — o bucket `TEXT_ACCENT` é o molde de ratchet que varre `mobile/`; a barreira nova segue o mesmo formato.
- `_bmad-output/planning-artifacts/ux-designs/ux-revista-retrospectiva-2026-09-07/`: `DESIGN.md:389` §Linha de sumário e `:96` os tokens (`sumario-linha`); `mockups/key-edicao.html:220` e `:436` a geometria aprovada — `.sumario` em `surface` com filete embaixo, topo com o versalete "Nesta edição", linha de `min-height: 62` com filete em cima, rótulo versalete, chamada serifada, seta **para baixo** de 18 px em traço; `EXPERIENCE.md:153` (alvo e âncora) e `:318` (o foco); `review-acessibilidade.md:42` (por que `ink2`).

## Tasks & Acceptance

**Execution:**
- [x] `mobile/src/store/edicao.store.ts` + `mobile/src/store/__tests__/edicao-store.test.ts` — `chamada: string | null` na variante `pronta`, por `chamadaDoTexto`, nos dois pontos que a empilham. Cobre as quatro primeiras linhas da matriz.
- [x] `mobile/src/hooks/useRolagemAncorada.ts` + `mobile/src/hooks/__tests__/` — o hook genérico: `scrollRef`, `ancora(id)` devolvendo `{ ref, onLayout }` **estável por id**, e `irPara(id)` que rola (instantâneo com Reduzir Movimento) e manda o foco. A decisão pura — qual `y`, e "sem layout não faz nada" — sai em função exportada e é o que o teste exercita.
- [x] `mobile/src/app/revista/[tipo]/[inicio].tsx` — o `Sumario` entre a capa e o miolo, a `Caderno` recebendo a âncora (ref na faixa, `onLayout` no container), e a folha nova.
- [x] `packages/shared/src/architecture.test.ts` — barreira nova: `setAccessibilityFocus` e `findNodeHandle` com teto **0** em `mobile/src`, dizendo no comentário qual é a API certa.

**Acceptance Criteria:**
- Given a edição de julho/2026 impressa, when o dono abre a rota, then o sumário lista os cadernos na ordem impressa e tocar uma linha leva à faixa dele sem sair da página e sem empilhar rota.
- Given o VoiceOver ligado, when a linha é tocada, then o elemento lido em seguida é o nome do caderno de destino.
- Given a suíte, when roda, then a vista e a parte pura da âncora têm teste, e as barreiras — inclusive a nova — seguem verdes.

## Spec Change Log

## Design Notes

**Duas divergências declaradas do mockup, as duas para cima:** o rótulo do caderno vai em `ink2`, não no `ink3` do `.sum-rotulo` — a revisão de acessibilidade mediu `ink3` em **2,87 sobre `bg`** e o nome do destino é informação obrigatória; e a chamada vai em **16/22**, a rampa normativa do `DESIGN.md`, e não nos 17/23 que o mockup renderizou. Qualquer outra diferença é Ask First.

**Por que a chamada nasce na vista, e não na tela:** é a mesma decisão que a 1.13 já tomou com "foto ou papel" — regra tem teste, render não tem. E ela cai onde `chamadaDoTexto` já é importado, ao lado da manchete: se um dia o corte mudar, muda num lugar só.

**Reduzir Movimento entra agora** porque esta é a **única** rolagem programática da revista e o hook é o lugar onde ela cabe; a EXPERIENCE já pede o ajuste, e o ciclo pronto está no `StackedBarChart`.

**A repetição capa × linha 1 fica audível.** Esconder a manchete condicionalmente é uma comparação de strings decidindo o que a pessoa cega ouve — se a condição errar, a capa perde sua única frase. Fica em Ask First, com o achado nomeado.

## Verification

**Commands:**
- `cd mobile && pnpm exec tsc --noEmit && pnpm exec jest` — a vista, o hook e a folha.
- `pnpm --filter @vitale/shared lint && pnpm --filter @vitale/shared test` — a barreira nova.
- `pnpm --filter @vitale/web build` — só se o núcleo mudar (não deve mudar).

**Manual checks (if no CLI):**
- `/revista/mes/2026-07-01` no iPhone: o sumário abaixo da capa, tocar cada linha e cair na faixa certa; com VoiceOver, o toque deve levar a leitura ao nome do caderno — **portão do dono**.

## Suggested Review Order

**O toque — o que ele decide, e o que ele faz**

- A entrada: o ato inteiro num lugar só — para onde, como, e quem passa a ser lido.
  [`useRolagemAncorada.ts:189`](../../mobile/src/hooks/useRolagemAncorada.ts#L189)

- A ordem e as condições, separadas das APIs — é o que torna "o foco vai junto" mensurável.
  [`useRolagemAncorada.ts:220`](../../mobile/src/hooks/useRolagemAncorada.ts#L220)

- A cola, e só ela: duas linhas de plataforma dentro do hook.
  [`useRolagemAncorada.ts:291`](../../mobile/src/hooks/useRolagemAncorada.ts#L291)

- Os dois ajustes num ref, com o selo que impede a resposta atrasada de vencer o evento.
  [`useRolagemAncorada.ts:260`](../../mobile/src/hooks/useRolagemAncorada.ts#L260)

**A âncora — onde ela quebra em silêncio**

- A invariante: o `y` é relativo ao pai, então quem mede tem que ser filho direto do rolável.
  [`useRolagemAncorada.ts:46`](../../mobile/src/hooks/useRolagemAncorada.ts#L46)

- Sem medida não há destino — e aí nem rolagem nem foco, os dois parados juntos.
  [`useRolagemAncorada.ts:99`](../../mobile/src/hooks/useRolagemAncorada.ts#L99)

- O registro: o par estável por id, para o ref-callback não desmontar a cada quadro.
  [`useRolagemAncorada.ts:104`](../../mobile/src/hooks/useRolagemAncorada.ts#L104)

- Os dois pontos de enxerto na tela: `onLayout` no container, `ref` na faixa.
  [`[inicio].tsx:503`](../../mobile/src/app/revista/%5Btipo%5D/%5Binicio%5D.tsx#L503)

**A chamada — decidida onde há teste**

- A variante `pronta` ganha a chamada; o render só escolhe entre mostrar e não mostrar.
  [`edicao.store.ts:312`](../../mobile/src/store/edicao.store.ts#L312)

- Preenchida nos dois pontos que empilham `pronta` — o banco e o escrito da sessão.
  [`edicao.store.ts:469`](../../mobile/src/store/edicao.store.ts#L469)

**O desenho**

- O sumário: uma linha por caderno do miolo, na ordem impressa, e o que ele faz de propósito.
  [`[inicio].tsx:361`](../../mobile/src/app/revista/%5Btipo%5D/%5Binicio%5D.tsx#L361)

- A linha: alvo inteiro, um nó só para o leitor de tela, e a dica que diz que rola.
  [`[inicio].tsx:403`](../../mobile/src/app/revista/%5Btipo%5D/%5Binicio%5D.tsx#L403)

- A folha, com a origem de cada número e as duas divergências declaradas do mockup.
  [`[inicio].tsx:686`](../../mobile/src/app/revista/%5Btipo%5D/%5Binicio%5D.tsx#L686)

**A barreira e os testes**

- Teto zero para `setAccessibilityFocus` e `findNodeHandle`, no dia em que ambos eram zero.
  [`architecture.test.ts:929`](../../packages/shared/src/architecture.test.ts#L929)

- A composição: os dois motivos de não animar, e o `y` zero que é ato, não ausência.
  [`useRolagemAncorada.test.ts:116`](../../mobile/src/hooks/__tests__/useRolagemAncorada.test.ts#L116)

- A cola sob espiãs — apagar o foco fica vermelho.
  [`useRolagemAncorada.test.ts:180`](../../mobile/src/hooks/__tests__/useRolagemAncorada.test.ts#L180)

- A matriz da chamada, linha a linha, incluindo o miolo vazio.
  [`edicao-store.test.ts:1018`](../../mobile/src/store/__tests__/edicao-store.test.ts#L1018)
