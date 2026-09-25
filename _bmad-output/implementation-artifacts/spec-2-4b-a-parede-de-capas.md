---
title: 'Story 2.4b — A parede de capas'
type: 'feature'
created: '2026-09-25'
status: 'done'
baseline_commit: 'fc4b9d8d1aa549b6ea87855ec18468597761a8ff'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** O arquivo tem 39 meses impressos e a única porta até eles é o cartão do período corrente: para ver junho de 2023 é preciso saber que ele existe e navegar até lá. Folhear não existe. E a textura que o Épico 2 promete — *ver pela imagem quando comecei a fotografar* — só aparece quando as capas ficam **lado a lado**: hoje, 13 de 21 meses até mar/2025 não têm foto, contra 19 de 20 depois.

**Approach:** Uma tela irmã da rota da edição, duas colunas, da mais recente para trás, com as capas de **mês** desenhadas pelos desenhistas da 2.4a a 173 px, e o **ano** como quatro tiras que leem a `metrica_lider` carimbada. Uma leitura em lote por coisa — capas, textos das manchetes, fotos, rotas —, nenhuma por célula, e a lista virtualiza linhas de duas, no molde do `SeletorDaCapa`.

## Boundaries & Constraints

**Always:**
- **Uma leitura em lote por coisa, nunca uma por célula.** As 39 fotos saem de **uma** chamada: a capa guarda `foto_activity_id`, e `fetchPhotosForActivities` já lê por atividade. `fetchPhotoById` por capa está proibido aqui.
- Toda leitura que cresce com o tempo passa por `fetchAllPages`, com `range` **e** ordenação total (desempate único por linha), e entra na lista de casos de `paginacao-das-leituras.test.ts` — ela não se auto-descobre.
- **Mês na parede; ano como quatro tiras; trimestre não entra** (decisão do dono, 24/09). As tiras **leem** `metrica_lider`, nunca recalculam.
- A manchete sai de `chamadaDoTexto` — dono único, com barreira contra cortar frase à mão — e respeita o silêncio da 2.5: é a primeira linha **visível**, não `posicao === 1`.
- `'loading'` e `null` são estados distintos; capa cuja imagem sumiu **ainda diz o que era**, pela legenda carimbada.
- Folha de estilo por `useThemedStyles`; sombra por `shadows.card`, que nos temas Clean troca sombra por contorno.
- Proibido na revista: compartilhar, carrossel, gesto horizontal, hover. A borda esquerda é do voltar do sistema.

**Ask First:**
- Acrescentar `texto` a `ARQUIVO_COLUMNS` — é proibido por teste, e de propósito ("é o grosso da linha"). A manchete da parede vem de uma leitura **própria e limitada aos meses**, com o tamanho medido e escrito.
- Mexer em `escolherCapa`, re-carimbar capa, ou mudar os três números pendentes de veredito (`PONTOS_MINIMOS_DO_TRACADO`, a espessura do traço, `FRACAO_DO_VAO`).
- Dependência nova (não há FlashList nem `numColumns` no projeto, e o disco está em 96%).

**Never:** a web; escrever em produção; trimestre na parede; imprimir para preencher buraco — **abrir só lê**.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| A parede abre | 39 meses, 3 anos no arquivo | Duas colunas, ~6 capas por tela, mais recente primeiro; ano como quatro tiras | N/A |
| Capa de foto | 39 capas com `foto_activity_id` | **Uma** leitura de fotos para todas; a `uri` resolve por célula visível | falha ⇒ a capa mostra a legenda, não um vazio |
| Imagem sumiu do iPhone | `foto_id` existe, o asset não | Capa diz o que era, pela legenda carimbada; distinta de "carregando" | N/A |
| Capa de traçado | 6 capas com `rota_activity_id` | Traçado a 173 px; abaixo do limiar, cai para grade | rota ausente ⇒ papel |
| Mês sem edição | período fechado que ninguém imprimiu | **Não aparece** na parede — abrir só lê, e a parede não convida a imprimir | N/A |
| Toque | qualquer capa | Abre `/revista/[tipo]/[inicio]` daquele período e volta para a parede | alvo ≥ 44 px |
| Arquivo vazio | usuário sem nenhuma edição | Uma frase dizendo que não há edição ainda; nada de esqueleto infinito | N/A |
| Acima de 1000 linhas | o arquivo cresce (68 períodos/ano) | A leitura pagina e a ordem é total — nada desaparece calado | N/A |

</frozen-after-approval>

## Code Map

- `packages/shared/src/data/paginate.ts:43` — `fetchAllPages`, `PAGE_SIZE = 1000`; o contrato (`:26-38`) exige `range` **e** ordenação total. Moldes: `fetchArquivoDeEdicoes` (`edicoes-ia.ts:302-316`, quatro `order` = a PK menos `user_id`) e `fetchPhotosForActivities` (`activity-photos.ts:95-111`, com guarda de lista vazia).
- `packages/shared/src/data/edicoes-capa.ts` — `fetchCapa` :191 lê **uma** edição (`maybeSingle`); `CAPA_COLUMNS` :139. **Não existe leitura em lote de capas**, e a nova mora aqui (barreira `.from()` fora do núcleo, `architecture.test.ts:170`). Desempate: `(tipo_periodo, inicio, fim)`.
- `packages/shared/src/data/edicoes-ia.ts` — `ARQUIVO_COLUMNS` :282 e `ArquivoRow` :221; `metrica_lider` está em `EdicaoRow` :80 e em `EDICAO_COLUMNS` :132, mas **não** no arquivo. Acrescentá-la cobra três lugares juntos: a string, `ArquivoRow`, e o fixture `noArquivo` de `edicoes-ia.test.ts:858`, mais o caso de `paginacao-das-leituras.test.ts:140`. O teste :869 **proíbe** `texto` ali.
- `packages/shared/src/revista/chamada.ts:218` — `chamadaDoTexto`, dono único da primeira frase, com barreira em `architecture.test.ts:5369`.
- `mobile/src/store/edicao.store.ts:515` — `chamadaDaCapa(edicao, visiveis)`: a manchete é a primeira linha **visível**, e o TSDoc :505-514 explica por que não é `posicao === 1`. A parede precisa da mesma regra.
- `mobile/src/components/revista/SeletorDaCapa.tsx:179-195` (fatiar em linhas) e `:246-287` (`SectionList` com `initialNumToRender`, `windowSize`, `removeClippedSubviews`) — o molde da grade virtualizada; `COLUNAS`/`VAO` em :74-76. O motivo declarado em :47-53: 372 fotos derrubaram a tela.
- `mobile/src/hooks/useFotoDaCapa.ts:80-85` — as **duas** idas por capa (`fetchPhotoById` + `resolvePosterUri`) e o teto de 12 s :48. É o que **não** se repete 39 vezes. `mobile/src/services/asset-uri.ts` tem cache (:26), dedup (:28) e `MAX_EM_VOO = 6` (:67) — a resolução por célula visível já se auto-estrangula.
- `packages/shared/src/revista/desenho.ts` — tudo da 2.4a: `projetarTracado` :175, `PONTOS_MINIMOS_DO_TRACADO` :50, `gradeDoPeriodo` :354, `eixoDaGrade` :259, `layoutDaGrade` :433, `desenhoDaCapa` :533.
- `mobile/src/components/revista/{CapaTracado,CapaGrade}.tsx` — já `React.memo`, mudos para o leitor de tela, tamanho por prop.
- `packages/shared/src/revista/capa.ts:232` — `rotuloDaEdicao` ("Agosto de 2026"); o curto é `mobile/src/lib/edicao-ia.ts:644`.
- `docs/specs/revista-retrospectiva/cadernos.md:173-178` — o contrato das tiras: **quatro tiras de doze meses, uma por caderno, na cor do caderno**, medindo o fato que liderou; *"o anuário não tem capa: as quatro tiras são a capa do ano"*.
- `mobile/src/app/_layout.tsx:219-221` — onde a rota irmã (`revista/index`) se registra, com `animation: 'slide_from_right'`. `hrefDaRevista` em `mobile/src/lib/edicao-ia.ts:603`.
- `mobile/src/theme/tokens.ts:235` (`radii`) e `:280` (`shadows`, um `Proxy` que resolve na leitura). Barreira: nenhum `StyleSheet.create` de escopo de módulo lê `colors`.

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/data/edicoes-capa.ts` — a leitura em lote das capas, por `fetchAllPages`, com ordenação total; e o caso novo em `paginacao-das-leituras.test.ts`.
- [x] `packages/shared/src/data/edicoes-ia.ts` — `metrica_lider` no arquivo (string, `ArquivoRow`, fixture, caso de paginação); e a leitura das manchetes, **limitada aos meses**, com o tamanho medido no TSDoc e o porquê de não ser `ARQUIVO_COLUMNS`.
- [x] `packages/shared/src/revista/` — a montagem pura da parede: junta arquivo + capas + manchetes, filtra a meses, ordena do mais recente, e devolve as linhas de duas já fatiadas; mais as quatro tiras do ano a partir de `metrica_lider`.
- [x] `mobile/src/app/revista/index.tsx` + `_layout.tsx` — a rota irmã, com uma ação na Retrospectiva que a abre e volta.
- [x] `mobile/src/components/revista/` — o ladrilho (capa + rótulo abaixo em `ink2`, alvo ≥ 44 px, `shadows.card`) e as quatro tiras do ano.
- [x] `mobile/src/hooks/` ou store — a orquestração: uma leitura em lote por coisa, a `uri` resolvida só no visível, e a invalidação pela regra de `memoria-da-retro.ts`.
- [x] testes — a matriz de I/O; e uma barreira de texto-fonte de que a parede **não** chama `fetchPhotoById` nem `fetchCapa` por célula.

**Acceptance Criteria:**
- Given as 39 capas de mês, when a parede abre, then o número de leituras ao banco **não cresce com o número de capas**.
- Given um mês cujo caderno líder está silenciado (2.5), when o rótulo é desenhado, then a manchete é a do primeiro caderno **visível**.
- Given um ano, when ele aparece na parede, then são quatro tiras lendo `metrica_lider`, e nenhuma capa.

## Spec Change Log

## Design Notes

**Por que uma leitura de manchetes separada.** `ARQUIVO_COLUMNS` recusa `texto` porque a leitura dele é o arquivo **inteiro** — 168 linhas com o texto completo. A parede mostra só meses: 39 períodos, e o texto de que ela precisa é o do caderno que dá a manchete. Medido no acervo: os textos têm 294 a 519 caracteres, então a leitura da parede fica na casa de dezenas de KB — não é a mesma pergunta, e por isso não é a mesma constante. O teste que proíbe `texto` no arquivo fica intocado.

**Por que `foto_activity_id` resolve o custo.** Eram 39 idas ao banco mais 39 ao PhotoKit. A capa carimba a atividade da foto, e `fetchPhotosForActivities` lê por atividade: uma chamada traz todas as linhas, e o casamento é por `foto_id`. O que sobra — resolver o asset em `uri` — já tem cache e teto de 6 em voo no `asset-uri.ts`, e roda só no ladrilho visível.

**O ano não é uma capa.** O spec dos cadernos é explícito: *"as quatro tiras são a capa do ano"*. Elas leem o carimbo; recalcular seria inventar um ranqueamento novo a cada abertura, e a edição impressa deixaria de concordar com a parede.

## Verification

**Commands:**
- `pnpm --filter @vitale/shared lint` e `test` — 0 falhas
- `cd mobile && pnpm exec tsc --noEmit && pnpm exec jest` — 0 falhas
- `pnpm --filter @vitale/web build` — 0 erros
- `pnpm --filter @vitale/scripts lint` e `test` — 0 falhas

Os **quatro**, por **exit code**: uma barreira do `architecture.test.ts` derruba o runner em vez de imprimir `not ok`.

**Manual checks:**
- A parede rolada de agosto/2026 até junho/2023 — é a fronteira da textura que o épico promete, e a única prova dos três números pendentes.
- Um ano, para ver as quatro tiras onde a capa não está.

## Suggested Review Order

**A regra do ladrilho — uma só, em dois usos**

- O recorte: quem vira ladrilho, quem vira anuário. `montarParede` e `ponteirosDaParede` leem daqui.
  [`parede.ts:342`](../../packages/shared/src/revista/parede.ts#L342)

- A montagem: junta arquivo, capas e manchetes, ordena e fatia em linhas de duas.
  [`parede.ts:425`](../../packages/shared/src/revista/parede.ts#L425)

- As tiras do ano, lendo a `metrica_lider` carimbada — identidade, nunca grandeza.
  [`parede.ts:205`](../../packages/shared/src/revista/parede.ts#L205)

- "Nada impresso" e "nada que a parede desenhe" são frases diferentes.
  [`parede.ts:383`](../../packages/shared/src/revista/parede.ts#L383)

**O estado, fora do React**

- O redutor puro: semeadura, supersessão por carga, `relendo` no lugar do piscar.
  [`parede.ts:159`](../../mobile/src/lib/parede.ts#L159)

**As leituras — uma por coisa**

- A foto por id, sem filtro de estado: 39 linhas em vez de centenas, e a capa desligada volta.
  [`activity-photos.ts:152`](../../packages/shared/src/data/activity-photos.ts#L152)

- O lote por ids, que é o teto real (a URL), no lugar de uma paginação que nunca dispararia.
  [`activities.ts:399`](../../packages/shared/src/data/activities.ts#L399)

**A decisão escrita**

- As três decisões de 24/09, com a medição e as alternativas recusadas.
  [`0057-a-parede-mostra-meses-e-o-ano-e-quatro-tiras.md`](../../docs/decisions/0057-a-parede-mostra-meses-e-o-ano-e-quatro-tiras.md)

- O estreitamento das tiras, registrado onde a promessa antiga estava.
  [`cadernos.md`](../../docs/specs/revista-retrospectiva/cadernos.md#L174)
