---
title: 'Story 1.13 — A capa na edição, com o véu medido'
type: 'feature'
created: '2026-09-17'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'd13c218'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A capa da edição é papel desde a 1.11 — o período em serifada e a manchete — e a revista ainda não diz **onde** o período aconteceu. Pior: a escolha da foto não está carimbada em lugar nenhum. `coverOf` lê `isCover` e `state === 'linked'`, os dois mutáveis depois da impressão, e o `ph://` some da biblioteca: sem carimbo, a edição que ele leu em agosto tem outra capa em outubro, contra *período fechado congela*.

**Approach:** A impressão **inteira** passa a escolher e carimbar a capa em `edicoes_capa` — natureza, identidade e **a legenda já formatada** —, e a rota desenha a capa com **foto**, sangrada, com o véu em gradiente local aprofundado até o texto medir 4,5 contra o pixel mais claro sob ele. As naturezas `tracado` e `grade` são carimbadas, não desenhadas (recorte do dono, 17/09); até a story do desenho, elas caem na capa em papel da 1.11.

## Boundaries & Constraints

**Always:**
- **A escolha é do núcleo e é pura:** `escolherCapa` decide natureza e identidade a partir das fotos e das atividades do período, reusando `coverOf` — a mesma regra da tira da Retrospectiva e do compositor. A tela nunca escolhe capa, e o render nunca recalcula: o que se desenha é o que está carimbado.
- **Três naturezas, sempre uma:** `foto` quando há foto vinculada no período; senão `tracado`, quando há atividade do período com rota; senão `grade`. A terceira não é sobra — é ela que faz 2023 parecer 2023.
- **Valores resolvidos, nunca ponteiros a re-derivar:** `fotoId`, `fotoTakenAt` (a chave de cura da ADR 0037) e a **legenda já formatada**, que continua imprimindo — e servindo de descrição textual — quando a imagem não resolve mais.
- **A legenda da foto tem dono único:** a linha de três campos (`Ittre · km 31,1 · 12:38`) sai de uma função do núcleo, e o compositor de compartilhar passa a chamá-la. Cada pedaço some sozinho quando o dado não existe; a hora sempre fica.
- **Carimba na impressão inteira; a parcial só carimba quando não há capa nenhuma** (renegociado pelo dono em 17/09, depois da revisão: a edição montada caderno a caderno ficaria para sempre sem capa). Reimpressão de um caderno só **nunca muda** capa existente — não muda a foto nem a legenda — a manchete continua derivada do caderno em `posicao` 1, e essa é a única coisa da capa que uma parcial pode mover.
- **A gravação é porta nova em `data/edicoes-capa.ts`**, com a mesma guarda de sessão da `portasDaEdicao`. Falha ao carimbar **não derruba a impressão nem apaga texto**: a edição fica sem capa, o motivo vai para o log, e a próxima impressão inteira recarimba.
- **O véu é local e tem piso medido:** gradiente só sob o texto, nunca filtro sobre a imagem inteira. O app mede o pixel mais claro sob a faixa do texto e aprofunda o véu até o contraste alcançar **4,5**. Enquanto não mediu — e se a medição falhar — vale o véu **mais profundo**, nunca o mais raso.
- **Nada de `ph://` direto num `<Image>`**: o URI local se resolve como o resto do app já faz.

**Ask First:**
- Mudar a composição da capa, a altura sangrada, ou as frases das legendas de `tracado` e `grade`.
- Trocar a régua de 4,5, o jeito de medir, ou acrescentar dependência nova ao mobile.

**Never:**
- Desenhar `tracado` ou `grade` (story própria, já no deferred-work); parede de capas (2.4); sumário (1.14).
- Migração nova, mudar `edicao_imprimir`, ou tocar ordem, errata e conferência.
- Recarimbar em reimpressão parcial; recalcular a escolha da capa no render; escurecer a imagem inteira.
- Hex literal, `ink3` em informação obrigatória, `StyleSheet` de escopo de módulo lendo tema.

## I/O & Edge-Case Matrix

| Cenário | Estado | Esperado | Erro |
|---|---|---|---|
| Escolha com foto | agosto/2026, fotos vinculadas | natureza `foto`, `fotoId`/`fotoTakenAt` da `coverOf`, legenda de três campos | N/A |
| Escolha sem foto | período com atividade com rota | natureza `tracado`, `rotaActivityId` da rota mais longa, legenda sem hora | N/A |
| Escolha sem nada | 2023: sem foto e sem rota | natureza `grade`, identidades nulas, legenda = o período por extenso | N/A |
| Legenda incompleta | foto sem coordenada, ou fora do traçado | o pedaço some; a hora sempre fica | nunca legenda vazia |
| Carimbo | impressão **inteira** bem-sucedida | capa gravada (ou recarimbada) com `carimbada_em` novo | gravação falha: edição sem capa, log, impressão intacta |
| Reimpressão parcial, com capa | `cadernos: ['coracao']`, capa carimbada | a capa **não** é tocada | N/A |
| Reimpressão parcial, sem capa | `cadernos: ['coracao']`, nenhuma capa | carimba (a edição montada caderno a caderno também tem capa) | falha: sem capa, log, impressão intacta |
| Desenho com foto | capa `foto` e imagem resolvível | foto sangrada, período + manchete + legenda sobre o véu local | imagem não resolve: capa em papel da 1.11, com a legenda carimbada |
| Véu medido | pixel mais claro sob o texto | o véu aprofunda até o contraste ≥ 4,5 | medição falha ou demora: fica o véu mais profundo |
| Capa não-foto | natureza `tracado` ou `grade` | capa em papel da 1.11; nenhum espaço reservado para desenho | N/A |
| Edição sem capa | impressa antes da 1.13 | capa em papel; a próxima impressão inteira carimba | N/A |

</frozen-after-approval>

## Code Map

- `packages/shared/src/data/edicoes-capa.ts` — `NaturezaDaCapa`/`NATUREZAS_DA_CAPA` (~35), `Capa`/`toCapa` (~63–120), `CAPA_COLUMNS`, `fetchCapa` (~124). **Só leitura hoje, por decisão declarada no cabeçalho: "a 1.13 carimba".** A porta de escrita nasce aqui.
- `packages/shared/src/photos/retro.ts:44` `coverOf(photos)` — estrela primeiro, senão a maior corrida silenciosa. É a regra que a escolha reusa; `photos/photos.test.ts` é o molde do teste.
- `mobile/src/components/share/ShareComposerModal.tsx:355-384` — o `placeLine` de três campos (cidade mais próxima entre `activities.cities`, km do traçado, hora). É daqui que a legenda sai para o núcleo, e este passa a ser um chamador.
- `mobile/src/app/retrospectiva/index.tsx:184-214` — como o período vira fotos: `periodBounds` → ids das atividades → `fetchPhotosForActivities`. A impressão precisa da mesma lista.
- `mobile/src/store/edicao.store.ts` — `imprimir(entrada, dadosProntos)` (inteira) e `imprimirCaderno(…, caderno)` (parcial): é a diferença entre carimbar e não tocar. A vista da edição passa a carregar a capa lida.
- `mobile/src/lib/edicao-ia.ts` — `imprimirEdicao(...)` e `buscarEdicao`; molde do `try/catch` que engole recusa (`comDadoDaEntrada`, `lapidesDaEntrada`).
- `mobile/src/app/revista/[tipo]/[inicio].tsx` — a capa em papel da 1.11 (`styles.capa`, `eyebrow`/`periodo`/`manchete`) é o fallback e o ponto de enxerto; o caderno da 1.12 mostra o padrão de cor no render.
- `mobile/src/components/photos/ActivityPhotosCard.tsx:87` — `<Image source={{ uri }}>` com URI já resolvido; `mobile/src/services/activity-photos.ts:10-20` explica o `getAssetInfoAsync` do `expo-media-library` 57 e o custo do iCloud.
- `mobile/src/lib/share-card-html.ts` — WebView já é ferramenta da casa para pixel (o cartão de compartilhar). `react-native-webview@13.16.1` e `expo-linear-gradient@~57.0.2` já estão no `mobile/package.json`; **nenhuma dependência nova é necessária**.
- `packages/shared/src/theme/color.ts` — `contrast(a, b)`, a régua do 4,5.
- `_bmad-output/planning-artifacts/ux-designs/ux-revista-retrospectiva-2026-09-07/DESIGN.md` §Components (Capa) e §Elevation & Depth (o véu com piso); `EXPERIENCE.md` §Accessibility Floor (a legenda **é** a descrição textual da imagem).

## Tasks & Acceptance

**Execution:**
- [ ] `packages/shared/src/revista/capa.ts` + teste — `escolherCapa({ fotos, atividades, periodo, cidades })` devolve natureza, identidade e legenda; `legendaDaFoto(foto, cidades)` (os três campos, cada um opcional) e `legendaDaRota(atividade)`. Cobre as quatro primeiras linhas da matriz.
- [ ] `packages/shared/src/data/edicoes-capa.ts` + teste — `gravarCapa(db, userId, capa)`: upsert pela chave da edição, `carimbada_em` novo, guarda de uid da sessão (molde: `portasDaEdicao` em `data/edicoes-ia.ts`).
- [ ] `mobile/src/components/share/ShareComposerModal.tsx` — passa a chamar `legendaDaFoto`, sem mudar as condições dele. Dono único da frase.
- [ ] `mobile/src/store/edicao.store.ts` + `mobile/src/lib/edicao-ia.ts` + teste — a impressão **inteira** carimba depois do sucesso (falha só loga); a **parcial** não; a edição lida traz a capa carimbada para a vista.
- [ ] `mobile/src/lib/veu.ts` + teste — a parte pura: dada a luminância medida e a cor do texto, qual degrau de véu alcança 4,5 (e o mais profundo quando não há medida).
- [ ] `mobile/src/app/revista/[tipo]/[inicio].tsx` + componente da capa com foto — imagem sangrada, véu local em gradiente, período/manchete/legenda por cima, medição por WebView oculto uma vez por capa, fallback para a capa em papel.

**Acceptance Criteria:**
- Given a edição de agosto/2026 impressa de novo por inteiro, when o dono abre a rota, then a capa mostra a foto do período com a legenda de três campos, e o texto se lê sobre ela.
- Given a mesma edição reimpressa caderno a caderno, when ela é reaberta, then a capa continua exatamente a mesma — foto, legenda e `carimbada_em`.
- Given a suíte, when roda, then a matriz tem teste nas funções puras e nas portas, e as barreiras seguem verdes.

## Spec Change Log

- **Achado (revisão cega + lacunas, 17/09):** a edição montada **caderno a caderno** nunca ganharia capa — o carimbo só rodava na impressão inteira, e o botão da edição inteira desaparece assim que existe um caderno impresso (regra da 1.11). O dono renegociou o bloco congelado: a parcial passa a carimbar **quando não há capa nenhuma**, e segue proibida de tocar capa existente. Estado ruim evitado: edição permanentemente em papel, sem caminho de conserto. **KEEP:** a escolha pura no núcleo reusando `coverOf`, a legenda com dono único, o véu que começa no degrau mais profundo, e a gravação que nunca derruba a impressão.

## Design Notes

**Por que o app grava, e não a função do banco** (decisão do dono, 17/09): `edicao_imprimir` não recebe capa, e ensiná-la a receber é migração em produção — janela, com a seção 6 do roteiro da 1.9 como leitura obrigatória. O preço da escolha, declarado: o carimbo não é atômico com a impressão. Se ele falhar, a edição existe sem capa e a próxima impressão inteira a recarimba — perda recuperável, ao contrário de uma janela mal executada.

**Por que medir no aparelho** (decisão do dono, 17/09): as fotos vêm da biblioteca dele e um céu branco sob texto claro mede ≈1,8. O véu começa no degrau **mais profundo** e clareia até o limite que ainda passa em 4,5 — a falha, portanto, é sempre para o lado legível. A medição usa o WebView que o cartão de compartilhar já usa (canvas + `getImageData` sobre a faixa do texto), uma vez por capa, sem dependência nova.

**A legenda é a descrição textual da imagem** (EXPERIENCE §Accessibility Floor) — por isso ela é carimbada e não derivada no render: quando o `ph://` some, a frase continua dizendo onde o período aconteceu.

## Verification

**Commands:**
- `pnpm --filter @vitale/shared lint && pnpm --filter @vitale/shared test` — barreiras verdes, incluindo a lista de naturezas contra o CHECK do banco.
- `pnpm --filter @vitale/web build` — o núcleo mudou.
- `cd mobile && pnpm exec tsc --noEmit && pnpm exec jest`.

**Manual checks (if no CLI):**
- `/revista/mes/2026-08-01` no iPhone depois de reimprimir a edição inteira: a foto sangrada, a legenda de três campos, e o texto legível sobre o véu — **portão do dono**.

## Suggested Review Order

**A escolha — o que fica congelado**

- A entrada: a cascata foto → traçado → grade, com a identidade e a legenda que vão para o banco.
  [`capa.ts:234`](../../packages/shared/src/revista/capa.ts#L234)

- Quem nem entra na disputa: vídeo e instante inválido, antes do `coverOf`.
  [`capa.ts:171`](../../packages/shared/src/revista/capa.ts#L171)

- A legenda de três campos, agora com dono único — o compositor passou a chamá-la.
  [`capa.ts:106`](../../packages/shared/src/revista/capa.ts#L106)

**O carimbo — quando, e por quem**

- A porta de escrita, com a guarda de sessão e o `carimbada_em` escrito à mão.
  [`edicoes-capa.ts:190`](../../packages/shared/src/data/edicoes-capa.ts#L190)

- Quem junta fotos, atividades e cidades — e se recusa a carimbar sobre acervo não carregado.
  [`edicao-ia.ts:242`](../../mobile/src/lib/edicao-ia.ts#L242)

- A regra que o dono renegociou: a parcial carimba só quando não há capa.
  [`edicao.store.ts:818`](../../mobile/src/store/edicao.store.ts#L818)

**O véu — a promessa de 4,5**

- O degrau: dado o pixel medido, o alfa mais raso que ainda passa; sem medida, o mais profundo.
  [`veu.ts:92`](../../mobile/src/lib/veu.ts#L92)

- A página que mede: recorte `cover`, faixa do texto, pixel mais claro.
  [`veu.ts:158`](../../mobile/src/lib/veu.ts#L158)

- O medidor na tela: vive só até a primeira resposta, e diz no log quando não mediu.
  [`CapaComFoto.tsx:208`](../../mobile/src/components/revista/CapaComFoto.tsx#L208)

**O desenho**

- A capa com foto: imagem sangrada, véu local, texto por cima.
  [`CapaComFoto.tsx:86`](../../mobile/src/components/revista/CapaComFoto.tsx#L86)

- A decisão foto-ou-papel saiu do componente e entrou na matriz da vista.
  [`edicao.store.ts:422`](../../mobile/src/store/edicao.store.ts#L422)

- A resolução do arquivo, com teto de tempo e sem piscar papel no primeiro quadro.
  [`useFotoDaCapa.ts:50`](../../mobile/src/hooks/useFotoDaCapa.ts#L50)

**Os testes**

- A cascata da escolha, linha a linha da matriz.
  [`capa.test.ts:154`](../../packages/shared/src/revista/capa.test.ts#L154)

- O script da medição **executado** no Jest — trocar a faixa agora falha.
  [`veu.test.ts:222`](../../mobile/src/lib/__tests__/veu.test.ts#L222)
