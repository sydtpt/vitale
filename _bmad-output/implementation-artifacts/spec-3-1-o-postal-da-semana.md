---
title: 'Story 3.1 — O postal da semana'
type: 'feature'
created: '2026-09-25'
status: 'done'
baseline_commit: '18dc93aefb28386a4c1880e243f955c41f2ef351'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A semana abre a **mesma edição** que o mês — sumário, quatro cadernos, faixa colorida, botões de escrever — e **grava em `edicoes_ia`**. Nada na rota confere o tipo: `podeImprimir` não olha `kind`, e a sequência só recusa `all` e período aberto. O contrato diz o contrário desde o Épico 2 ("a semana não grava edição; o postal calcula na hora"), e cinco semanas já foram impressas antes de alguém fechar essa porta.

**Approach:** A rota `/revista/semana/<inicio>` passa a desenhar **um postal**: uma tela, capa pequena, **três fatos**, acromática, sem sumário e sem cadernos. Ele **calcula na hora e nunca grava**. A prosa, se ele mandar escrever, vive só na sessão — sai e reabre, voltam os três fatos. As cinco semanas já escritas não perdem o texto: o postal leva até ele por uma linha discreta.

## Boundaries & Constraints

**Always:**
- **A semana não grava.** Fechar a porta é parte da story: a recusa é do núcleo, não da tela, e tem teste.
- **Três fatos, sem comparação nenhuma** (decisão do dono, 25/09): valor absoluto, sem base, sem delta, sem percentual. `FatoTendencia` existe como forma e **ninguém a produz** — o lugar da trajetória fica escrito e vazio, com o estreitamento declarado, no molde do que a 2.4b fez com as tiras.
- **Acromático em tokens, não em hex**: só `surface`, `ink`, `ink2`, `ink3`, `line` e vizinhos de `ThemeNeutrals`. **Zero `moduleColors`** — o precedente é o `SleepRatingCard` ("nenhuma cor de sono, porque o bloco é legenda, não gráfico").
- A prosa é **memória de sessão**, no molde declarado da 1.11 (`SessaoDoCaderno` nunca é persistida, zustand sem `persist`). Não há terceiro estado.
- A escolha dos três fatos tem **dono único** e é pura. `liderDoCaderno` **não serve**: ele ranqueia por afastamento de base, e o postal não tem bases.
- O texto já gravado **nunca é apagado**, e o caminho até ele não é um segundo layout — é uma linha.

**Ask First:**
- Produzir trajetória (é story própria, e serve também ao Rotina).
- Gravar qualquer coisa numa semana, ou apagar as cinco existentes.
- Mudar `hrefDaRevista`, `SLUG_DO_TIPO` ou a exclusão da semana na parede.

**Never:** a 3.2 e a 3.3; a web; escrever em produção; cor de módulo no postal; sumário ou cadernos na semana.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Semana fechada | `/revista/semana/2026-09-21` | Postal: capa pequena, três fatos, acromático, uma tela | N/A |
| Tentar imprimir | qualquer caminho que chame a impressão com `kind: 'week'` | **Recusado no núcleo**, com estado próprio — nada vai a `edicoes_ia` | a tela nunca oferece o botão |
| Semana com edição antiga | uma das cinco (17/08 a 14/09) | Postal **igual ao das outras**, mais uma linha que abre o texto gravado | texto ilegível ⇒ a linha some, o postal fica |
| A prosa efêmera | ele manda escrever, sai e volta | Volta aos três fatos apurados, sem prosa | N/A |
| Semana magra | período com um fato só | Mostra o que tem; não inventa terceiro nem enche de vazio | N/A |
| Semana em curso | período que ainda não fechou | O que a rota já faz hoje para período aberto, sem mudança | N/A |
| Silêncio da 2.5 | cadernos silenciados | **Não alcança o postal** — ele não tem cadernos; declarar no código | N/A |

</frozen-after-approval>

## Code Map

- `mobile/src/app/revista/[tipo]/[inicio].tsx` — hoje **não ramifica por tipo**: `periodoDaRota` :112, `<Revista>` :139-141, e dentro dela o `tipo` só vai a `useEntradaDaEdicao` :149, `useGradeDaCapa` :227 e `tituloDaCapa` :266. É aqui que o postal se separa.
- `mobile/src/store/edicao.store.ts` — `podeImprimir` :275 **não olha `kind`** (o furo); a sessão nunca persistida está declarada em :45-50 e :79-96, e `sessaoQueFica` :788 diz o que sobrevive a uma releitura. É o molde da prosa efêmera.
- `packages/shared/src/ia/imprimir-sequencia.ts:148` — a única guarda de tipo: `kind === 'all'` ou período aberto. **Semana fechada passa e grava.** É onde a recusa entra.
- `packages/shared/src/period/retro.ts` — `buildRetroLede` :1198 já corta em **três** (`LEDE_ORDER` :1184), alimentado por `buildRetroHighlights` :998; a ordenação é por **classe** (`compareHighlights`, `packages/shared/src/week/highlights.ts:72`, pesos :38-43), e o porquê está escrito em :20-25. Cuidado: os destaques trazem `deltaPct` — o postal usa o **fato**, não a comparação.
- `packages/shared/src/ia/ranqueamento.ts:70-72` — já declara que *"a semana é postal — não grava edição — e por isso não ordena"*. `liderDoCaderno` :148 ranqueia por `afastamentoDe` :118, que só lê `f.bases`: sem bases, não serve.
- `packages/shared/src/ia/pacote.ts:213-222` — `FatoTendencia` (`direcao`, `periodos`, `desde`) e o argumento :204-212 de por que ela não é base. **Nenhum produtor**: `montarEntradaDaEdicao` (`period/retro-dados.ts:445`) devolve `{ resumo, agora, lapides }`.
- `packages/shared/src/theme/themes.ts:25-62` — `ThemeNeutrals`, a fonte viva dos papéis de tinta. O recorte histórico em `packages/shared/src/constants/tokens.ts:18-36`.
- `mobile/src/components/cards/SleepRatingCard.tsx:29` — o precedente escrito de bloco sem cor de módulo.
- `mobile/src/components/EdicaoCard.tsx:54` — a porta, já inteiramente acromática; `hrefDaRevista` (`mobile/src/lib/edicao-ia.ts:603`) e `SLUG_DO_TIPO` :571 já mandam `week` para a rota.
- `packages/shared/src/revista/parede.ts:33-35` e :50 — a semana fica fora da parede, com o motivo escrito (*"52 semanas por ano afogariam os doze meses"*). Não mexer.
- `packages/shared/src/period/periodos.ts:12-17` — onde o contrato da semana já está escrito, para a impressão em massa.

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/ia/imprimir-sequencia.ts` — recusar `kind === 'week'` com estado próprio, junto da recusa de `all`; teste. *(estado `semana` em `ResultadoDaImpressao`; `scripts/revista/imprimir.ts` ganhou o ramo e a frase dele.)*
- [x] `packages/shared/src/revista/` — a escolha pura dos **três fatos** do postal, com dono único: sobre os destaques que já existem, usando o **valor** e descartando a comparação; e o lugar declarado (vazio) da trajetória. *(`revista/postal.ts`: `montarPostal`, `FATOS_DO_POSTAL`, `TIPO_DO_POSTAL`, `PostalDaSemana.trajetoria` sempre vazia e congelada.)*
- [x] `mobile/src/app/revista/[tipo]/[inicio].tsx` — ramificar: `week` desenha o postal, os outros tipos seguem iguais.
- [x] `mobile/src/components/revista/` — o postal: capa pequena, três fatos, a linha que abre o texto gravado quando ele existe, tudo em papéis de tinta. *(`Postal.tsx`, na geometria de `mockups/key-formas.html`; a capa de foto do mockup ficou fora — a capa é carimbada na impressão, e a semana não imprime.)*
- [x] `mobile/src/store/edicao.store.ts` — `podeImprimir` passa a olhar o tipo; a prosa do postal vive na sessão, como a da 1.11. *(mais `guardadosDoPostal`, a regra da linha do texto guardado.)*
- [x] testes — a matriz de I/O, mais uma barreira de que o postal não usa `moduleColors`. *(`revista/postal.test.ts` (18), `ia/imprimir.test.ts` (+6), `edicao-store.test.ts` (+6), e a barreira nova no `architecture.test.ts`, provada contra uma violação semeada.)*

**Acceptance Criteria:**
- Given qualquer caminho de impressão, when o período é `week`, then nada é escrito em `edicoes_ia` e a recusa vem do núcleo.
- Given uma das cinco semanas já escritas, when o postal abre, then ele é igual ao das outras, e o texto antigo continua alcançável.
- Given o postal desenhado, when se procura cor de módulo, then não há nenhuma.

## Spec Change Log

- **25/09 — revisão adversarial (21 consertos, nenhum reabre a spec).** Os que mudam
  comportamento visível ou contrato, e que valem como registro:
  - **o cartão da Retrospectiva não promete mais** (P1). Com `kind: 'week'` e nada impresso,
    `portaDe` devolve `nada` em vez de `nao-escrita`: a frase *"fechou e ainda não foi
    escrito"* virou promessa permanentemente falsa quando o núcleo passou a recusar semana, e
    a Retrospectiva abre justamente em semana. A regra é a que `LeituraDaEdicao.ausente` já
    declarava para o Total. **A porta `impressa` fica**, e é isso que preserva o caminho até
    as cinco semanas escritas.
  - **a recusa da semana sai antes da rede no script** (P20), e não no desfecho do núcleo:
    com `--caderno`, `imprimirPeriodo` avisava *"vai criar uma edição com um caderno só"*
    antes de o núcleo responder, e o operador lia a promessa e o desmentido em seguida.
  - **nenhum fato lê zero** (P5): `0,0 km`, `€0` e `0 min` deixaram de virar fato. O piso é
    sobre o número **já arredondado para a casa em que ele é escrito** — 40 m são `0,0 km` na
    tela mesmo não sendo zero no dado —, e sem comparação o leitor não distingue "quase nada"
    de "não medido".
  - **o colofão muda com o arquivo** (P7): *"nota não arquivada"* logo abaixo de *"esta
    semana já foi escrita"* era a única linha cuja função é explicar o mecanismo descrevendo-o
    errado, e justamente no caso que a story existe para preservar.
  - **o postal não afirma antes de apurar** (P3): `fatos: null` enquanto a janela carrega — a
    lista vazia passa a significar "a semana não deixou nenhum", e só isso.
  - **`TIPO_DO_POSTAL` é literal** (`as const satisfies`), e `Revista` recebe
    `TipoComRevista` (P2): com a anotação larga, trocar os dois braços do ternário compilava —
    a semana voltava a abrir a edição e o mês virava postal. A barreira passou a ler a
    **árvore** do ternário, em vez de procurar nomes no arquivo.

- **25/09 — implementação.** Duas escolhas que a spec deixava em aberto, registradas onde
  foram feitas (e nenhuma delas toca a seção congelada):
  - **os três fatos saem do resumo, não do texto do destaque.** A spec manda usar "o valor e
    descartar a comparação"; a frase que `buildRetroHighlights` escreve já traz o delta dentro
    (`"3 treinos nesta semana · +1 vs. semana anterior"`), e recortá-la seria cirurgia em prosa
    gerada. O destaque passou a **escolher** (quais três, em que ordem) e o `RetroSummary` a
    **responder** (quanto), por uma tabela fechada de ids em `revista/postal.ts`. Fica coberto
    por teste nos dois sentidos: os ids declarados existem de verdade no gerador, e nenhum fato
    escrito contém marca de comparação.
  - **a "capa pequena" é o mastro, sem a capa de foto do mockup.** `mockups/key-formas.html`
    desenha um bloco de foto de 146 px; a capa é carimbada **na impressão**, e a semana não
    imprime — não existe foto carimbada para uma semana, e escolher uma na hora seria
    comportamento novo que a spec não pede. A picotagem (`.tear`) também ficou fora; o colofão
    (*"nota não arquivada · recalculada a cada leitura"*) diz em palavras o que ela dizia em
    desenho.

## Design Notes

**Por que "sem comparação" satisfaz o critério.** O AC recusa "semana contra semana anterior" por ser ruído, e nomeia a trajetória como a única comparação aceita. Como ninguém produz trajetória, a leitura honesta é **nenhuma comparação** — e é exatamente o que o critério queria evitar que some. O lugar dela fica escrito no código, vazio, para a story que a produzir não ter de reabrir esta decisão.

**Por que os três fatos não saem do `liderDoCaderno`.** Ele mede afastamento contra base, e o postal não tem bases — o próprio arquivo já declara que a semana não ordena. Os destaques da retro (`buildRetroHighlights`) são a fonte certa: eles existem, já vêm ordenados por classe, e `buildRetroLede` já corta em três. O que o postal descarta deles é o `deltaPct`.

**O furo que esta story fecha.** Hoje `/revista/semana/...` grava. As cinco semanas em `pacote_versao` 3 são a prova de que isso acontece — foram impressas por este caminho. A recusa vai ao **núcleo**, não à tela, senão a próxima tela a chamar a impressão reabre o furo.

## Verification

**Commands:**
- `pnpm --filter @vitale/shared lint` e `test` — 0 falhas
- `cd mobile && pnpm exec tsc --noEmit && pnpm exec jest` — 0 falhas
- `pnpm --filter @vitale/web build` — 0 erros
- `pnpm --filter @vitale/scripts lint` e `test` — 0 falhas

Os **quatro**, por **exit code**: uma barreira do `architecture.test.ts` derruba o runner em vez de imprimir `not ok`.

**Manual checks:**
- Abrir a semana de 14/09 (tem texto) e uma sem texto — as duas têm de dar o mesmo postal.

## Suggested Review Order

**A porta que faltava**

- A recusa da semana, **antes** da montagem pura — uma guarda de tipo não pode mudar com a matéria.
  [`imprimir-sequencia.ts:165`](../../packages/shared/src/ia/imprimir-sequencia.ts#L165)

- O tipo como literal, para o compilador separar os dois mundos em vez de uma convenção.
  [`postal.ts:91`](../../packages/shared/src/revista/postal.ts#L91)

**O postal**

- A escolha pura dos três fatos: o destaque escolhe, o resumo responde, sem comparação.
  [`postal.ts:275`](../../packages/shared/src/revista/postal.ts#L275)

- A tela: mastro, três fatos, a linha do texto guardado, colofão — só papéis de tinta.
  [`[inicio].tsx:203`](../../mobile/src/app/revista/[tipo]/[inicio].tsx#L203)

- A regra da linha que abre o texto das cinco semanas já escritas.
  [`edicao.store.ts:450`](../../mobile/src/store/edicao.store.ts#L450)

- O estado da edição, agora num lugar só em vez de copiado entre as duas telas.
  [`useEstadoDaEdicao.ts:27`](../../mobile/src/hooks/useEstadoDaEdicao.ts#L27)
