---
title: 'Story 2.4a — Os dois desenhistas da capa: o traçado e a grade'
type: 'feature'
created: '2026-09-24'
status: 'done'
baseline_commit: 'f80d5d330cec17b46106057a591be077983e6047'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A capa tem três naturezas e o app desenha **uma**. `tracado` e `grade` caem no papel liso da 1.11 — e o comentário que admite isso está no código: *"`tracado` ou `grade` (que ninguém desenha ainda)"*. Não é caso de borda: no arquivo real, **17 dos 39 meses** têm uma dessas duas capas, e todo 2023–2024 vive delas. A parede (2.4b) depende disto; a rota da edição, que já existe, sofre disto hoje.

**Approach:** Dois desenhistas, os dois em SVG, os dois alimentados por dado que a tela **já tem em mãos**. O traçado projeta o `route_overview` — 10 a 135 pontos, já simplificado — com correção de latitude; a grade marca os dias do período que tiveram atividade **ou** registro. Ambos nascem em `CapaEmPapel`, no lugar do fundo liso, e ambos são funções puras no núcleo com um componente burro em cima, para a 2.4b os reusar a 173 px sem reescrever nada.

## Boundaries & Constraints

**Always:**
- A geometria e a contagem são **funções puras no shared**, testáveis sem tela; o componente só desenha.
- A rota vem de `fetchRouteSurface` (uma rota, `route_overview` + segmentos). **Nunca** a coluna `points`, que estoura o `statement_timeout` de 8 s.
- A grade sai da entrada que a rota já monta (`activities` e `registros[].days` do `RetroInput`) — **nenhuma leitura nova**.
- A projeção corrige a latitude (`cos φ`), senão a Bélgica sai esticada; e preserva a proporção, senão a rota deforma.
- Cor de dado sai de **papel de paleta**, nunca de `--primary`: rota e célula marcada são conteúdo, não cromo.
- A capa carimbada passa **inteira e sem reinterpretação** — a legenda já vem formatada e é ela que aparece.

**Ask First:**
- Qualquer leitura nova do banco, em lote ou não.
- Mexer em `escolherCapa` (1.13/1.16) ou re-carimbar capa.
- O número de `PONTOS_MINIMOS_DO_TRACADO`: escolha um, declare o argumento, e marque como **pendente do veredito em tela** — as seis rotas reais têm 10, 29, 52, 110, 129 e 135 pontos.

**Never:** a parede de capas (2.4b); a web; escrever em produção; `WorkoutMap`/WebView como miniatura — um processo de conteúdo por capa é exatamente o que a 1.13 tirou da árvore.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Traçado normal | capa `tracado`, rota de 135 pontos | Polilinha proporcional na caixa, com margem; legenda carimbada no pé | N/A |
| Rota curta | rota abaixo de `PONTOS_MINIMOS_DO_TRACADO` | Cai para `grade` — sem risco de virar um risco | N/A |
| Rota sumiu | `rotaActivityId` sem linha em `activity_routes` | Cai para o papel liso de hoje, **e a legenda continua dizendo o que era** | leitura falha ⇒ aviso, nunca tela vazia |
| Rota degenerada | todos os pontos no mesmo lugar (extensão 0) | Não divide por zero: desenha um ponto centrado | N/A |
| Grade densa | jun/2023 — 21 dias com atividade de 30 | 30 células, 21 marcadas | N/A |
| Grade esparsa | jan/2024 — 0 atividades, 1 registro | 31 células, **1** marcada: esparso é a informação | N/A |
| Período em curso | mês que ainda não fechou | A grade **para em hoje** — dia futuro não é dia sem dado | N/A |
| Sem marca nenhuma | período sem atividade e sem registro | Grade inteira vazia, com a legenda; não vira papel liso | N/A |

</frozen-after-approval>

## Code Map

- `mobile/src/app/revista/[tipo]/[inicio].tsx` — `CapaEmPapel` :386 é o alvo: hoje desenha nas quatro situações que o TSDoc :378-385 lista, e duas delas deixam de cair aqui. `desenhaFoto` :316 é quem escolhe; `vista.capa.carimbada` traz a `Capa` inteira.
- `mobile/src/store/edicao.store.ts` — `CapaNaVista` :397: `periodo`, `impressa`, `manchete`, `carimbada` (a `Capa` crua, que **passa sem ser reinterpretada**).
- `packages/shared/src/data/edicoes-capa.ts` — `Capa` :101, `NaturezaDaCapa` :41, `rotaActivityId` :115 ("só na natureza `tracado`"). A geometria **não** é carimbada: a capa guarda o ponteiro.
- `packages/shared/src/data/activities.ts` — `fetchRouteSurface` :328 devolve `{ overview, segments }` de **uma** rota; o cabeçalho :4-6 explica por que `points` nunca entra.
- `packages/shared/src/period/retro.ts` — `RetroInput` :165 com `activities` :169 e `registros` :179 (`RetroRegistro.days` :144, dias `'YYYY-MM-DD'`); `periodBounds` dá o recorte. `buildHeatmap` :1299 **não serve**: exige métrica de saúde com meta.
- `mobile/src/components/charts/Sparkline.tsx:13` — o molde da miniatura em SVG: `<Svg>` vazio quando não há dado, sem eixos, 72×32.
- `mobile/src/components/cards/ClimbsCard.tsx:87` — o precedente do traço: `<Polyline points fill="none" stroke={colors.ink2} strokeWidth={1.4}>`.
- `mobile/src/components/HeatmapGrid.tsx` — a grade que existe: `COLS = 7`, `GAP = 4` :43-44, e a nota :12-15 de que `aspectRatio` **não funciona** dentro de `flexWrap` — o lado sai de `onLayout`.
- `mobile/src/hooks/useFotoDaCapa.ts:52` — hoje `tracado`/`grade` entram como `sem-foto`; continua assim, e é o que faz a capa cair em `CapaEmPapel`.
- `react-native-svg` 15.15.4 está em `mobile/package.json:51`, usado por 26 arquivos.

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/revista/` — a projeção pura: `[lat,lon][]` → pontos na caixa, com `cos φ`, proporção preservada, margem, e o caso da extensão zero; mais `PONTOS_MINIMOS_DO_TRACADO` com o argumento escrito.
- [x] `packages/shared/src/revista/` — a contagem pura da grade: dias do período (parando em hoje) marcados por atividade **ou** registro, a partir do `RetroInput`.
- [x] `mobile/src/components/revista/` — `CapaTracado` e `CapaGrade`, componentes burros em SVG, recebendo o já calculado, com tamanho por prop (a 2.4b os usará a 173 px).
- [x] `mobile/src/app/revista/[tipo]/[inicio].tsx` — ligar os dois em `CapaEmPapel`, com a queda para papel quando a rota não vem; buscar a rota por `fetchRouteSurface` só quando a natureza for `tracado`.
- [x] testes — a matriz de I/O, com as seis rotas reais como fixture de forma (contagens, não pixels).

**Acceptance Criteria:**
- Given uma capa `tracado` com rota, when a edição abre, then a rota aparece e **nenhum WebView** é montado.
- Given a mesma rota, when desenhada em 173 px e em 346 px, then a forma é a mesma — a projeção não depende do tamanho.
- Given um mês sem atividade e sem registro, when a capa é `grade`, then a grade aparece vazia com a legenda, e não o papel liso.

## Spec Change Log

## Design Notes

**Por que puro no shared e burro no componente.** A 2.4b vai desenhar ~40 destes numa lista rolante. Se a geometria morar no componente, ela roda a cada quadro de rolagem; se morar no núcleo, é `useMemo` e teste sem tela. É a mesma divisão que o `RouteProfileCard` já faz (`geometry` fora do render).

**A cor não é a marca.** No mockup desta proposta eu pintei a célula marcada de `#F25C2B` e estava errado: `--primary` é cromo. Rota e célula são **dado**, e dado pede papel de paleta — a regra de *marca ≠ cor de dado*.

**O limiar existe para a 2.4b.** Em tamanho de capa inteira quase tudo lê; a 173 px, não. Declarar o limiar agora, com a queda para grade já ligada, é o que faz a parede herdar a decisão em vez de reabri-la — e o número muda com uma linha quando o veredito chegar.

## Verification

**Commands:**
- `pnpm --filter @vitale/shared lint` e `test` — 0 falhas
- `cd mobile && pnpm exec tsc --noEmit && pnpm exec jest` — 0 falhas
- `pnpm --filter @vitale/web build` — 0 erros
- `pnpm --filter @vitale/scripts lint` e `test` — 0 falhas

Os **quatro**, conferidos por **exit code**: uma barreira do `architecture.test.ts` derruba o runner em vez de imprimir `not ok`, e um grep mostra verde.

**Manual checks:**
- Abrir uma edição de capa `tracado` (fev/2026, jul/2024) e uma de `grade` (jun/2023, densa; jan/2024, quase vazia) — é o par que mostra se a grade fala.

## Suggested Review Order

**O eixo da grade — o conserto que o dono decidiu**

- O eixo sai do período: semana e mês em pé, trimestre e ano deitados.
  [`desenho.ts:259`](../../packages/shared/src/revista/desenho.ts#L259)

- A contagem dos dias, com o `pad` do dia da semana e o teto de 366.
  [`desenho.ts:354`](../../packages/shared/src/revista/desenho.ts#L354)

- Onde cada célula cai, nos dois eixos, sem reservar coluna que não existe.
  [`desenho.ts:433`](../../packages/shared/src/revista/desenho.ts#L433)

**O traçado**

- A projeção com `cos φ`, proporção preservada e o caso degenerado de verdade.
  [`desenho.ts:175`](../../packages/shared/src/revista/desenho.ts#L175)

- O limiar, com o argumento — e marcado como pendente do veredito em tela.
  [`desenho.ts:50`](../../packages/shared/src/revista/desenho.ts#L50)

**A decisão, num lugar só**

- Veredito e carga juntos: é o que matou o guarda inalcançável e a grade de zero células.
  [`desenho.ts:533`](../../packages/shared/src/revista/desenho.ts#L533)

- Os cinco estados da leitura da rota, derivados no render — sem o quadro que piscava.
  [`useRotaDaCapa.ts`](../../mobile/src/hooks/useRotaDaCapa.ts)

- O que torna a grade velha, como regra pura e compartilhada.
  [`memoria-da-retro.ts`](../../mobile/src/store/memoria-da-retro.ts)

**As telas**

- Os dois desenhistas, `React.memo`, mudos para o leitor de tela.
  [`CapaTracado.tsx`](../../mobile/src/components/revista/CapaTracado.tsx) · [`CapaGrade.tsx`](../../mobile/src/components/revista/CapaGrade.tsx)

- A barreira que prende a AC que nenhum teste de comportamento alcança.
  [`capa-sem-webview.test.ts`](../../mobile/src/lib/__tests__/capa-sem-webview.test.ts)
