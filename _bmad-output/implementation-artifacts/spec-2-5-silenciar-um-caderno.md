---
title: 'Story 2.5 — Silenciar um caderno'
type: 'feature'
created: '2026-09-23'
status: 'done'
baseline_commit: '20dd402a07568d1fcbed66f41b7f3f41827711b6'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A revista não tem como ser contrariada. O leitor lê um caderno que nunca quis, e a única coisa que o app lhe oferece é o ranqueamento — que, pior, coloca o caderno indesejado em **primeiro** justamente no mês em que ele mais varia. Ao lado disso, o painel Diagramação carrega duas ferramentas que não se sustentam mais: as setas de reordenar, e a regra dos 60 dias, cuja função (`deadBlocks`) **não tem um único chamador de produção**.

**Approach:** Uma chave nova, `RetroPrefs.cadernosOcultos`, no mesmo jsonb `user_preferences.retro_prefs`. O caderno silenciado some da edição na tela **e** deixa de ser pedido à nuvem quando o telefone imprime — o filtro entra em `OpcoesDaImpressao.cadernos`, que já é a lista de candidatos, antes da primeira chamada paga. No mesmo passo o painel perde as setas, a regra dos 60 dias e o congelamento da prova de gráfica, e fica uma lista só de olhos: os blocos da Retrospectiva em cima, os quatro cadernos da revista embaixo.

## Boundaries & Constraints

**Always:**
- `CadernoId` continua com **dono único** em `period/cadernos.ts` (AD-2). `RetroBlockId` **não** é alargado — são dois vocabulários e dois atos independentes.
- O núcleo **não conhece preferência**. Quem filtra é o hospedeiro: o telefone monta `cadernos` e passa; `scripts/revista/imprimir.ts` segue sem passar, e imprime os quatro. É o mesmo desenho da preferência de motor, resolvida fora e entregue como `cadeia`.
- **Nada é apagado do banco.** Silenciar nunca escreve em `edicoes_ia`. Caderno fora de `pedidos` não é removido pela sequência (`imprimir-sequencia.ts:186`), então dessilenciar traz de volta tudo o que já foi impresso.
- A `order` que o dono arrumou **fica e continua valendo** — só deixa de ser editável.
- `resolveRetroPrefs` segue descartando chave desconhecida em silêncio, e nunca faz spread do jsonb cru.

**Ask First:**
- Silenciar a partir de outro lugar que não o painel Diagramação (p.ex. um gesto na própria edição).
- Qualquer migration. A coluna é `jsonb not null default '{}'` sem CHECK — conferido em `20260825120000_user_preferences_retro_prefs.sql:11-12`.
- Fazer o script de impressão em massa respeitar o silêncio.

**Never:** a parede de capas (2.4); mexer na web (ela não lê `retro_prefs` e não tem painel); escrever em produção; apagar ou reimprimir edição.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Silenciar na leitura | `cadernosOcultos: { sono: '2026-09-23' }`, edição com sono em `posicao` 1 | O caderno some do miolo e do sumário; os outros mantêm a ordem relativa | N/A |
| Manchete da capa | o caderno de `posicao` 1 está silenciado | A manchete passa para o **primeiro caderno visível**, nunca `null` nem o silenciado | Sem caderno visível → capa sem manchete |
| Impressão pelo telefone | 1 caderno silenciado, alvo `edicao` | A sequência recebe os 3 restantes; 3 chamadas, não 4 | N/A |
| Todos silenciados | os quatro em `cadernosOcultos` | Nenhum botão de imprimir é oferecido | **Nunca** chamar `imprimir` com lista vazia (`imprimir-sequencia.ts:139` lança `TypeError`) |
| Dessilenciar | caderno volta a ser visível | O texto já impresso reaparece, sem reimprimir nada | N/A |
| jsonb podre | `cadernosOcultos: 7`, `{ inventado: 'x' }`, `{ sono: 42 }` | Cai para `{}` / descarta a entrada, sem quebrar | N/A |

</frozen-after-approval>

## Code Map

- `packages/shared/src/period/retro-blocks.ts` — o alvo principal. `RetroPrefs` :83-90 (ganha `cadernosOcultos`, perde `proofStartedOn`), `DEFAULT_RETRO_PREFS` :92, `resolveRetroPrefs` :103-140 (ramo novo, no molde do de `hidden` :122-134), `toggleBlock` :193 (o molde de `toggleCaderno`). **Saem:** `PROOF_DAYS` :30, `DEATH_DAYS` :33, `layoutEditable` :170, `deadBlocks` :183, `moveBlock` :203. O TSDoc :10-25 descreve a prova de gráfica e precisa ser reescrito.
- `packages/shared/src/period/cadernos.ts` — `CadernoId` :34, `CADERNO_IDS` :169 (ordem do catálogo), `isCadernoId` :171, `rotuloDoCaderno` :182. O guarda do jsonb sai daqui, não de uma lista nova.
- `mobile/src/app/retrospectiva/index.tsx` — o painel, JSX inline: gate `editando` :779, eyebrow :781, **legenda :782-785** (frase 2 é a dos 60 dias; "e mova o que usa para cima" também morre), linhas :786-810 (olho :791-796, label :797, **setas :798-806**). `editavel` :750 e o carimbo de `proofStartedOn` em `salvarPrefs` :398-402 saem com o congelamento. A segunda lista (cadernos) entra depois de :810.
- `mobile/src/store/edicao.store.ts` — `vistaDaEdicao` :451-557: laço dos impressos :493-508 e dos com-dado :511-554 — **é aqui que a leitura filtra**, e o sumário (`[inicio].tsx:437`) consome o mesmo vetor. **A armadilha da manchete:** :416-419 lê `edicao.find(c => c.posicao === 1)` pelo **valor**, não pela primeira posição da lista. `imprimirAlvo` :757, com `{ cadernos: [alvo] }` :851-852.
- `packages/shared/src/ia/imprimir-sequencia.ts` — `pedidos` :153, corte :155-156 (`sem-caderno` **antes** de qualquer chamada paga), `saem(c)` :186 (o que não foi pedido sobrevive). Nada muda aqui: o filtro chega pronto.
- `mobile/src/lib/edicao-ia.ts` — `PedidoDeImpressao.cadernos` :367-375 e o repasse :436; `ICONE_DO_CADERNO` :714 para a lista nova.
- `mobile/src/store/settings.store.ts` :87, :141, :168 — leitura, patch e upsert da linha inteira; `preferences-merge.ts:36-46` — o merge é por **campo**, nunca dentro do jsonb.
- `mobile/src/lib/__tests__/retro.test.ts` :828-897 — o bloco inteiro da diagramação. **Saem** :874-882 (`deadBlocks`), :884-889 (`layoutEditable`), :891-896 (`moveBlock`). Ficam e ganham vizinhos os de `resolveRetroPrefs` :831-851.
- `packages/shared/src/architecture.test.ts` :348-365, :592-612 — a barreira de CHECK cobre só `ID_COLUMNS` (`theme`, `wallpaper`, `theme_id`, `palette_id`, `brand_id`). `retro_prefs` é jsonb e fica fora: conferido, não presumido.

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/period/retro-blocks.ts` — acrescentar `cadernosOcultos?: Partial<Record<CadernoId, string>>` a `RetroPrefs`, o ramo defensivo em `resolveRetroPrefs` (validando por `isCadernoId` e exigindo valor string) e `toggleCaderno(prefs, id, today)`; remover `PROOF_DAYS`, `DEATH_DAYS`, `layoutEditable`, `deadBlocks`, `moveBlock` e `proofStartedOn`; reescrever o TSDoc — a prova de gráfica acabou e a diagramação é a que está salva.
- [x] `packages/shared/src/period/retro-blocks.ts` (ou vizinho puro) — um seletor `cadernosVisiveis(prefs)` sobre `CADERNO_IDS`, para a tela e a impressão lerem a mesma lista.
- [x] `mobile/src/app/retrospectiva/index.tsx` — tirar as setas e o gate `editavel`; reescrever a legenda (as duas frases morrem); acrescentar a segunda lista, rotulada, com os quatro cadernos e um olho cada.
- [x] `mobile/src/store/edicao.store.ts` — filtrar os dois laços de `vistaDaEdicao` pelos cadernos visíveis, e trocar a manchete de `posicao === 1` pelo primeiro caderno visível; em `imprimirAlvo`, montar `cadernos` já sem os silenciados e **não oferecer impressão** quando a lista ficaria vazia.
- [x] `mobile/src/lib/__tests__/retro.test.ts` — apagar os três testes dos símbolos removidos; cobrir a matriz de I/O acima (jsonb podre, todos silenciados, manchete do líder silenciado, dessilenciar).

**Acceptance Criteria:**
- Given a `order` salva hoje (`sleep` em 3º, `habits` em 5º), when a story fecha, then a Retrospectiva aparece **exatamente como aparece hoje** — só sem as setas.
- Given o painel Diagramação, when 24/10/2026 chegar, then ele continua editável — o congelamento da prova de gráfica não existe mais.
- Given um caderno silenciado, when o ranqueamento o poria em primeiro, then ele não aparece.
- Given um app antigo regravando `retro_prefs`, when ele salva, then `cadernosOcultos` é perdido em silêncio — custo declarado, não defeito (ver Design Notes).

## Spec Change Log

**23/09 — a revisão fechou em 17 consertos, todos aplicados. Nenhum toca o `Intent`.**

Três mudam **comportamento**, e são os que importam:

- **P1 — `visiveisAgora` passou a resolver a preferência.** Era o único leitor que entregava
  `preferences.retroPrefs` cru a `cadernosVisiveis`, enquanto as duas telas resolvem. Como a
  `settings.store` hidrata do cache local sem resolver, um `{ sono: 42 }` gravado por um build
  anterior lia como silêncio para a ação e como ruído para as telas: botão "Escrever" vivo na
  tela, recusa calada na ação. **O caminho que gasta dinheiro era o que dispensava a resolução.**
- **P4 — carimbo `''` deixou de atravessar o guarda**, nos dois mapas. Ele sobrevivia a
  `typeof v === 'string'` e lia como *visível* no `if (ocultos[id])` dos leitores — guarda e
  leitor discordando em silêncio sobre a mesma entrada.
- **P9 — a rota deixou de ter beco.** Com tudo silenciado e algo impresso, ela era capa e nada:
  sem botão, sem aviso, sem caminho de volta a uma decisão tomada noutra tela. A vista passou a
  decidir `avisoDoSilencio` (dois textos, um para tudo calado e outro para o silêncio parcial),
  e ele cala quando há convite ou impressão correndo.

Uma é **decisão declarada, que estava calada** (P11): `visiveisAgora()` é um retrato tirado no
topo de `imprimirAlvo`, e silenciar no meio de uma impressão **não** a cancela — o caderno é
pago e gravado, e some da tela no mesmo quadro. Escolhido em vez de travar o olho porque o custo
é uma chamada, nada se perde (dessilenciar devolve) e a alternativa travaria um painel global por
causa de uma impressão num período só. Reler a preferência mais abaixo seria pior: `podeImprimir`
e `candidatos` passariam a responder a leituras diferentes. Há teste prendendo a escolha.

Três são **rede contra regressão**:

- **P3 — barreira nova**, `mobile/src/lib/__tests__/silencio-fiacao.test.ts`, no idioma da
  `store-selector-stability.test.ts`: o 4º argumento tem padrão, então apagá-lo em qualquer das
  duas telas desligaria a feature com tsc e suíte verdes — e pior, devolveria o botão "Escrever"
  a um caderno que a ação recusa. Conferida por mutação: quebra nos dois sítios.
- **P2 — o mock da `settings.store` ganhou `cru`**, porque resolver dentro do próprio `getState`
  tornava a P1 estruturalmente invisível. Conferido por mutação: com a P1 de volta, o teste novo
  reprova.
- **P5, P13, P14** — igualdade de conjuntos escrita como tal em vez de igualdade de tamanhos; o
  teste de "não se reimprime" ganhou a fixture que o nome promete (sono **já impresso**), além da
  primeira impressão; e os dois testes baratos que faltavam (`portaDe` sem lista ≡ com
  `CADERNO_IDS`; `toggleCaderno` sobre `RetroPrefs` legado **sem** a chave — o caminho real de
  todo aparelho vindo do build anterior).

Cinco são **prosa que mentia** — P6 (quatro TSDocs ainda prometendo "o caderno em `posicao` 1",
no mesmo arquivo em que `chamadaDaCapa` diz que não é), P7 (`hidden` virou campo morto não
declarado enquanto `cadernosOcultos` ganhava dez linhas declarando o mesmo custo), P12 (o
comentário do `visibleBlocks` sobre `PeriodKind`, perdido na mudança de lugar), P8 (uma legenda
por lista, com o efeito econômico dito ao dono e não só num comentário; "Cadernos da revista" no
lugar de "Na revista", porque silenciar muda as duas telas) e P10 (`accessibilityRole="switch"`
com `checked` nos dois olhos, e o `ICONE_DO_CADERNO` escondido da árvore de acessibilidade).

Cinco são **documento** — P15 (a refinação de 23/09 registrada nos três lugares que mandavam
apagar `RetroPrefs.order`; o efeito econômico em CAP-14; o título da §6, o sumário, a §8 e as dez
linhas novas do índice de testes da §7), P16 (`scripts/README.md`: a massa **não** respeita o
silêncio, e mudar isso é `Ask First`) e P17 (o custo novo: bloco criado depois da 2.5 nasce no fim
da `order` **para sempre**, sem UI para movê-lo — declarado na §6.1 e no TSDoc, com as três saídas
possíveis).

---

**23/09 — três desvios do Code Map, na implementação. Nenhum toca o `Intent`.**

1. **`portaDe` também recebe a lista.** O Code Map só nomeava `vistaDaEdicao`, mas
   `chamadaDaCapa` tem **dois** chamadores, e o outro é o cartão da Retrospectiva. Sem isto, o
   caderno silenciado continuaria dando a chamada do cartão — falando exatamente na tela em que
   ele foi calado. A assinatura ganhou `visiveis: readonly CadernoId[] = CADERNO_IDS`, o mesmo
   idioma de `OpcoesDaImpressao.cadernos` (ausente ⇒ os quatro).
2. **A matriz de I/O ficou em dois arquivos.** `retro.test.ts` leva o que é do núcleo (jsonb
   podre, dessilenciar, `cadernosVisiveis`, a ordem salva que sobrevive); `edicao-store.test.ts`
   leva o que é da tela e do dinheiro (manchete do líder silenciado, miolo, todos silenciados,
   e os candidatos que chegam à sequência), porque as fixtures da edição impressa (`impresso`,
   `estadoLido`) moram lá e copiá-las seria uma segunda verdade.
3. **`docs/specs/retrospectiva/v2-jornal.md` §6.1 foi reescrita.** Ela descrevia a prova de
   gráfica e os 60 dias como regras vivas, e o TSDoc do `retro-blocks.ts` manda o leitor até lá.
   §6.1 passa a registrar a revogação com o motivo de cada uma, e nasceu a §6.2, do silêncio.

**Duas decisões dentro da matriz, que ela não nomeia:**

- **`nadaImpresso` e `capa.impressa` continuam sobre a edição INTEIRA.** São resposta do banco
  ("este período já foi escrito"), e o texto do silenciado continua gravado. Silenciar o único
  caderno impresso não devolve o período ao convite.
- **`capa.semCaderno` lê o `comDado` CRU.** O aviso fala do período ("nenhum caderno deste
  período tem o que dizer"); com os quatro silenciados isso seria mentira — eles têm, e o dono
  é que não quer ouvir. Ali a capa fica sem botão **e sem aviso**.

**`supabase/migrations/20260825120000_user_preferences_retro_prefs.sql` NÃO foi tocada.** O
comentário dela ainda descreve `proofStartedOn` na forma do jsonb. Migration aplicada é
imutável, e o `supabase/ensaio/` a repete — a correção, se ele quiser, é migration nova, que é
`Ask First`.

## Design Notes

**A data guardada não é lida por ninguém.** `hidden[id]` e `cadernosOcultos[id]` guardam `'YYYY-MM-DD'` porque `deadBlocks` lia — e `deadBlocks` sai nesta story. A forma fica, e promete o que já não cumpre. É o preço de não fazer migration de dado por causa de um booleano; está declarado aqui para não ser redescoberto como bug.

**O buraco na `posicao` não é problema do banco.** `posicao smallint check (posicao >= 1)` mais uma `unique` deferida — nenhuma constraint de contiguidade (`20260912120000_edicao_por_caderno.sql:58,94`). A "contiguidade de 1 a N" é prosa do comentário, e quem a produz é `array_position(p_ordem, …)` dentro de `edicao_imprimir`. Como silenciar **nunca escreve**, a numeração gravada não muda; quem pula o buraco é a leitura. O único lugar do cliente que lê `posicao` pelo valor é a manchete, e é exatamente por isso que ela está na matriz.

**Por que o script fica de fora.** Ele é ferramenta de backfill de períodos já fechados, rodada pelo dono com o JWT dele, sabendo o que quer. Fazê-lo ler `user_preferences` seria uma leitura nova na bancada para economizar chamadas numa corrida que acontece uma vez. Se mudar de ideia, é `Ask First`.

**A perda silenciosa por app antigo é real e medida.** `resolveRetroPrefs` monta o retorno do zero com as chaves que conhece; um build anterior a esta story lê `retro_prefs`, descarta `cadernosOcultos`, e o primeiro `updatePreferences` regrava o jsonb sem ela (`settings.store.ts:168` faz upsert da linha inteira). `mergePreferences` não protege, porque o campo `retroPrefs` está definido. Um aparelho, um build de cada vez: o custo é aceito.

## Verification

**Commands:**
- `pnpm --filter @vitale/shared lint` — expect: 0 erros
- `pnpm --filter @vitale/shared test` — expect: 0 falhas, incluindo as barreiras de arquitetura
- `cd mobile && pnpm exec tsc --noEmit && pnpm exec jest` — expect: 0 erros; a suíte `diagramação em blocos (§6)` passa sem os três testes removidos
- `pnpm --filter @vitale/web build` — expect: 0 erros (a web não deve ser tocada; isto é a prova)
- `pnpm --filter @vitale/scripts lint && pnpm --filter @vitale/scripts test` — expect: 0 falhas

Rode os **quatro** workspaces antes de declarar verde: um nome reservado no shared já deixou a barreira vermelha sem que nada aparente tivesse mudado.

**Manual checks (if no CLI):**
- O painel Diagramação abre mesmo com `proofStartedOn` antigo no jsonb, e não mostra seta nenhuma.
- Com `sono` silenciado, a rota `/revista/[tipo]/[inicio]` de um período cujo líder era sono mostra manchete do próximo caderno, e o sumário tem uma linha a menos.

## Suggested Review Order

**A preferência — onde o silêncio mora**

- A chave nova no mesmo jsonb, com o custo da data que ninguém lê declarado ali.
  [`retro-blocks.ts:136`](../../packages/shared/src/period/retro-blocks.ts#L136)

- O seletor que a tela e a impressão leem — uma lista só, na ordem do catálogo.
  [`retro-blocks.ts:252`](../../packages/shared/src/period/retro-blocks.ts#L252)

- O guarda que faz `resolveRetroPrefs` e `cadernosVisiveis` concordarem sobre `''`.
  [`retro-blocks.ts:154`](../../packages/shared/src/period/retro-blocks.ts#L154)

- O ato, no molde de `toggleBlock`: carimba o dia, dessilenciar apaga a entrada.
  [`retro-blocks.ts:264`](../../packages/shared/src/period/retro-blocks.ts#L264)

**A leitura — a armadilha que a story existe para evitar**

- A manchete deixou de procurar o valor 1; procura o primeiro visível.
  [`edicao.store.ts:490`](../../mobile/src/store/edicao.store.ts#L490)

- O aviso do silêncio: a rota não termina mais em capa muda sem explicação.
  [`edicao.store.ts:471`](../../mobile/src/store/edicao.store.ts#L471)

**O dinheiro — quem não é pedido à nuvem**

- A ação lê a preferência ela mesma, e resolve — o erro que a revisão pegou.
  [`edicao.store.ts:712`](../../mobile/src/store/edicao.store.ts#L712)

- A rota resolve de novo: o cache pode vir de um build anterior.
  [`[inicio].tsx:182`](../../mobile/src/app/revista/[tipo]/[inicio].tsx#L182)

**A tela**

- A segunda lista, e por que o rótulo não é "Na revista".
  [`index.tsx:838`](../../mobile/src/app/retrospectiva/index.tsx#L838)

**As redes**

- A barreira que prende a fiação das duas telas — provada por mutação.
  [`silencio-fiacao.test.ts:82`](../../mobile/src/lib/__tests__/silencio-fiacao.test.ts#L82)

- A matriz de I/O do lado do hospedeiro: manchete, miolo, botões e candidatos.
  [`edicao-store.test.ts:1222`](../../mobile/src/store/__tests__/edicao-store.test.ts#L1222)
