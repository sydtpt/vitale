---
title: 'Story 4.4 — A página da lua'
type: 'feature'
created: '2026-10-02'
status: 'in-progress'
review_loop_iteration: 0
baseline_commit: '67ab2a91732ec31a111f9d8e6b2363eb7079b8ad'
context:
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-revista-retrospectiva-2026-09-07/EXPERIENCE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-revista-retrospectiva-2026-09-07/DESIGN.md'
  - '{project-root}/docs/decisions/0045-o-resultado-negativo-publica-com-o-mesmo-destaque.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** O motor devolve o veredito das quatro fases, a tabela o grava e a cadeia o
autoriza — e **nada no app lê nada disso**. `vereditoLunar`, `lua-carimbo` e
`data/lua-execucoes` não têm um único consumidor no mobile. A última story do épico é a que
torna o teste visível.

**Approach:** Uma **regra de composição pura no núcleo** que gera as duas linhas a partir da
tupla, uma **sub-página** que imprime a moldura e os quatro blocos, e uma **linha no pé do
caderno Sono** que carrega o mesmo texto — porque é sobre ela que a emenda à ADR 0045
declara a garantia anti-atenuação.

## Boundaries & Constraints

**Always:**
- **As espinhas de UX são o contrato e vencem em caso de conflito com a prancha.** Está
  declarado nelas. `status: final`, e a seção que manda é "Disciplina de pré-registro na tela".
- **A regra de composição é função pura no núcleo**, não condicional na tela. O espaço é de
  **81 tuplas** e o mobile não tem renderizador de teste — a regra tem de ser testável sem tela.
- **`decidir` = chegou a um veredito com poder**: `achado` **ou** `nenhum_padrao`. Só
  `inconclusivo` é não decidir. **Não** é "achou algo".
- **O placar é por família**, denominadores **1** e **3**, **nunca 4** — o §2 do
  `pre-registro-lua-outras-fases.md` proíbe juntar as quatro num só resultado.
- **A luz vem primeiro, porque o portão é global às quatro.** Quando ela reprova, nenhum poder
  foi calculado, e escrever *"não houve poder"* é **falso**.
- **Nenhuma linha e nenhum compartimento desaparece**, em tupla nenhuma, nem antes da primeira
  execução. Não há variante curta.
- **A página lê a última linha e NUNCA calcula ao abrir.** `vereditoLunar` não é chamado na tela.
- **Nenhum dado lunar é consultado** por quem constrói. A migração não foi aplicada.
- **Nenhum hex em tela.** Cor por `useThemedStyles` + `moduleColors` no render.

**Ask First:**
- Como a linha chega ao pé do caderno Sono (ver Design Notes) — é a decisão de fiação.
- Qualquer coisa que mude o texto que a regra produz: a redação é autorada na espinha, e
  mudá-la mexe no que a emenda da ADR declara.

**Never:**
- A web. Executar o teste. Aplicar a migração. Escrever em produção.
- Mudar α, janela, desfecho, portões, vereditos ou limiar; editar os quatro documentos da cadeia.
- Reanimated (ADR 0010). `findNodeHandle` e `setAccessibilityFocus` (trancados em zero).
- **Embrulhar o `map` dos cadernos numa `View`** — quebra todas as âncoras do sumário com a
  suíte verde.
- Os seis achados de acessibilidade que ficaram abertos na UX. Estão registrados; nenhum bloqueia.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Nenhuma execução gravada | tabela vazia (**é o estado real hoje**) | o 4º estado: a moldura inteira, "não foi lida" nas duas famílias, a data da primeira leitura no lugar da próxima | não lança |
| Carregando | leitura em voo | estado próprio, **distinto** de "nada" — união discriminada | N/A |
| Quatro `inconclusivo` por poder | o caso provável | *"A cheia não decidiu. Nenhuma das três decidiu."* + o motivo real, e o quanto falta **no bloco**, com a unidade | N/A |
| Quatro `nenhum_padrao` | todas com poder | *"A cheia decidiu. As três decidiram."* + "nenhuma mostrou deslocamento de 15 min ou mais" | N/A |
| Uma das três decide | tupla mista | o placar da família das três diz *"Uma das três decidiu"*, e a oração final diz quantas decidiram sem achar | N/A |
| Duas ou mais decidem | `d ≥ 2` | placar no **plural** e o compartimento nomeia **cada** uma, na ordem do protocolo | N/A |
| Uma noite sem luz | portão global | as **duas** linhas trazem o mesmo motivo; **proibido** escrever "não houve poder" | N/A |
| Motivos mistos | portões diferentes por fase | a frase diz a **partição** e manda ao bloco; proibido afirmar o motivo majoritário | N/A |
| Adiantamento com poder na cheia | `nenhum_padrao` com efeito grande | o bloco explica em uma linha, mesmo corpo, sem ícone nem itálico | N/A |
| Execução truncada no banco | 1 a 3 linhas | erro que diz **como consertar**, não que cite a §9 | lança |
| Tipo dinâmico ampliado | corpo de acessibilidade | nada de dimensão fixa; a coluna de rótulos respeita o teto | N/A |

</frozen-after-approval>

## Code Map

- `mobile/src/app/revista/[tipo]/[inicio].tsx:981-1096` -- `Caderno`, **genérico** sobre
  `CadernoId`. O **pé** é a cauda de `styles.corpo`, nesta ordem: lápides `:1075-1079`,
  assinatura `:1081-1083`, botão de ação `:1086-1092`. A linha da lua entra aí, condicionada a
  `c.caderno === 'sono'`.
- `[inicio].tsx:615` -- `lapides={lapides[c.caderno]}`: **o padrão de prop por caderno**, e o
  molde da fiação. `CadernoNaVista` (`store/edicao.store.ts:460-480`) **não** tem campo por
  caderno.
- `[inicio].tsx:382-396,316,369,534,570` -- `antesDaCapa: React.ReactNode`, o precedente de nó
  injetado, renderizado em **dois** lugares de propósito (o bloco existe quando o texto não veio).
- `[inicio].tsx:603-610` -- **cada `Caderno` é filho direto do `ScrollView`**. Embrulhar o `map`
  quebra todas as âncoras do sumário **com a suíte verde**.
- `mobile/src/hooks/useRolagemAncorada.ts:46-70` -- as duas invariantes: filho direto do
  rolável, e **a última medida manda** — um bloco que entra tarde muda a origem das âncoras já
  medidas, e o conserto é o `onLayout` reemitido. Política da casa: **remedir, não reservar**.
- `mobile/src/app/sono/saude.tsx:122-126` -- o molde de sub-página: `Stack.Screen` com
  `headerShown: false` + `ScreenHeader`. `mobile/src/app/_layout.tsx:198-201,221-225` -- o
  registro, com `animation: 'slide_from_right'`.
- `mobile/src/components/ui/ScreenHeader.tsx:41-48` -- o voltar é `router.back()` puro. **A
  rolagem do chamador se preserva porque o `Stack` mantém a tela montada** — não há hook.
  `router.replace` **não** serve.
- `mobile/src/hooks/useAnuarioDoAno.ts:44-49` -- união discriminada
  `carregando | pronto | sem-tiras` por `useReducer`. **É o molde direto do veredito lunar**:
  carregando e "nada" desenham o mesmo nada e são estados diferentes.
- `mobile/src/store/sono.store.ts` -- o padrão de store: Zustand 5, leitura pelo
  `@vitale/shared`, `loading`/`loaded`/`error` planos, `userId` lido fora do render.
- `packages/shared/src/data/lua-execucoes.ts` -- `fetchUltimaExecucaoLunar`,
  `contarExecucoesLunares`. `packages/shared/src/sleep/lua-protocolo.ts` -- `ResultadoDaFase`,
  `VereditoLunarCompleto`, `UNIDADE_DO_MOTIVO`. `sleep/lua-carimbo.ts` -- a cadeia e as versões.
- `mobile/src/lib/__tests__/anuario-fiacao.test.ts` -- **o molde da barreira**, 118 linhas:
  `semComentario`, `corpoDe` por contagem de chaves, e as asserções de que o ramo monta o
  componente **e** o entrega na prop. Declara o modo de falha na cara: `antesDaCapa={null}`
  compila e passa em tudo.
- `mobile/src/theme/tokens.ts:113` -- `moduleColors(key, fallback?)`; `theme/index.tsx:142-147`
  -- `useThemedStyles`, memoizado por eixo. **Eixo esquecido na lista é o bug mais caro do
  tema** — devolve a folha velha, sem erro.
- `docs/decisions/0045-*.md` § *Emenda de 2026-10-01* -- o que a linha de entrada tem de
  cumprir, e por que a garantia é sobre ela e não sobre a página.

## Tasks & Acceptance

**Execution:**
- [ ] `packages/shared/src/sleep/lua-frase.ts` -- **novo**: a regra de composição dos quatro
  passos como função pura, recebendo as quatro `ResultadoDaFase` + `acervo.noitesSemLuz` e
  devolvendo as duas linhas com os dois compartimentos. Inclui o estado pré-execução.
- [ ] `packages/shared/src/sleep/lua-frase.test.ts` -- a regra varrida por **tupla**, não por
  caso escolhido: as 81 combinações geram texto, nenhuma lança, nenhuma devolve compartimento
  vazio, o placar concorda com o numeral nos dois denominadores, e a luz global ganha de
  qualquer outro motivo.
- [ ] `mobile/src/hooks/useVereditoLunar.ts` -- **novo**: união discriminada no molde de
  `useAnuarioDoAno`, lendo `fetchUltimaExecucaoLunar` e `contarExecucoesLunares`. **Não** chama
  `vereditoLunar`.
- [ ] `mobile/src/app/sono/lua.tsx` -- **novo**: a sub-página. A figura das quatro janelas, a
  frase coletiva, a moldura em campos, os quatro blocos agrupados por família com o α e a razão
  no cabeçalho de cada grupo, e o rodapé do método com a cadeia, o contador e `aritmética v1`.
- [ ] `mobile/src/app/_layout.tsx` -- registrar a rota, com `slide_from_right`.
- [ ] `mobile/src/app/revista/[tipo]/[inicio].tsx` -- a **linha de entrada** no pé do caderno
  Sono, carregando o mesmo texto da frase coletiva e abrindo a sub-página. Ver Design Notes
  para a fiação.
- [ ] `mobile/src/lib/__tests__/lua-fiacao.test.ts` -- **novo**, no molde de
  `anuario-fiacao.test.ts`: a linha de entrada **carrega o veredito**, não um rótulo autorado.
  Sem esta barreira, apagar a leitura deixa a emenda da ADR 0045 **falsa com tudo verde**.
- [ ] `packages/shared/src/index.ts` -- exportar `./sleep/lua-frase`.

**Acceptance Criteria:**
- Given as 81 tuplas, when a regra roda em cada uma, then nenhuma lança e nenhuma devolve
  compartimento vazio.
- Given a leitura do veredito apagada da linha de entrada, when a suíte roda, then a barreira
  nova **reprova**. A prova é revertida depois.
- Given o `map` dos cadernos embrulhado numa `View`, when o teste da rolagem ancorada roda,
  then ele **reprova** — hoje isso passa verde. A prova é revertida depois.
- Given nenhuma linha em `lua_execucoes`, when a página abre, then o 4º estado aparece inteiro
  e nada lança.
- Given os oito portões, when rodam, then todos saem **exit 0**.

## Design Notes

**A fiação da linha de entrada — a decisão que vai ao CHECKPOINT.** O `Caderno` é genérico
sobre `CadernoId` e já recebe `lapides={lapides[c.caderno]}`; `CadernoNaVista` não tem campo
por caderno. Duas formas:

1. **Prop no `Caderno` carregando a frase já composta** (recomendado). A rota lê o veredito,
   compõe pela regra e passa o texto. O `Caderno` continua sem saber o que é a lua, e a
   barreira cobra exatamente o que a emenda precisa: *a rota lê o veredito e entrega*. É o
   molde do `lapides`.
2. **Nó injetado, como `antesDaCapa`.** Funciona, mas põe o `Caderno` recebendo JSX de uma
   feature específica — e a `anuario-fiacao` existe justamente porque um nó injetado pode virar
   `null` sem nada reclamar.

**A âncora que esta story pode quebrar em silêncio.** A linha entra **dentro** do caderno Sono,
então não muda a origem das âncoras acima dele — mas muda a posição dos cadernos **depois**. A
invariante do `useRolagemAncorada` é *a última medida manda*: o `onLayout` reemitido conserta,
e guardar a primeira medida faria toda linha do sumário cair curta, calada. **Teste a âncora de
um caderno posterior a Sono**, não só a do próprio.

**Carregando não é nada.** O 4º estado é *"ainda não rodou"* e é onde a página vive hoje; o
estado de leitura em voo é **outro**. Desenhar os dois iguais faria a página afirmar silêncio
antes de saber — a união discriminada de `useAnuarioDoAno` existe por essa razão e está
documentada lá.

**Por que a regra no núcleo e não na tela.** 81 tuplas, e o mobile **não tem renderizador de
teste** — é por isso que as barreiras da casa leem texto-fonte. Uma regra na tela só seria
coberta por barreira de texto; no núcleo ela é varrida por tupla, de verdade.

**Portões sempre com `--filter`.** Há 9.813 symlinks sob `mobile/ios` neste worktree e **zero
pendurados** — medido —, e os scripts de teste escopam o `find` ao próprio pacote. O risco da
memória *"teste do núcleo morre em symlink do Pods"* **não é reproduzível aqui hoje**; se
aparecer `exit 1` sem `not ok`, a causa é outra e pede `/orbe-depurar` em vez de culpar o Pods.

## Verification

**Commands:**
- `pnpm --filter @vitale/shared lint` -- expected: exit 0
- `pnpm --filter @vitale/shared test` -- expected: **exit 0**
- `pnpm --filter @vitale/web build` -- expected: exit 0
- `pnpm --filter @vitale/web test` -- expected: exit 0
- `pnpm --filter @vitale/scripts lint` -- expected: exit 0
- `pnpm --filter @vitale/scripts test` -- expected: exit 0
- `cd mobile && pnpm exec tsc --noEmit` -- expected: exit 0
- `cd mobile && pnpm exec jest` -- expected: exit 0
- `shasum -a 256` dos **quatro** documentos da cadeia -- expected: idênticos aos de antes da
  story. A barreira do hash já os cobra; isto é a conferência de que a story não os tocou.

**Provas negativas — rodar, anotar e reverter. `cp` de backup, NUNCA `git checkout --`.**
Confira a restauração por **sha256** e confirme que a mutação **entrou** antes de acreditar no
resultado — uma prova que não muta nada é indistinguível de uma barreira que não guarda nada.
- Apagar a leitura do veredito na linha de entrada **reprova** a barreira nova.
- Trocar a frase composta por um rótulo autorado **reprova**.
- Embrulhar o `map` dos cadernos numa `View` **reprova** o teste da rolagem ancorada.
- `decidir` voltando a significar só `achado` **reprova** o teste da regra.
- Somar as unidades de motivos diferentes **reprova**.
