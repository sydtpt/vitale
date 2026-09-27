---
title: 'Story 3.2 — O anuário do ano'
type: 'feature'
created: '2026-09-25'
status: 'done'
baseline_commit: '1b3e112ad1f1b04a2306b888666d1e107deb050c'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** O ano abre como um mês grande — capa, sumário, quatro cadernos —, e procura uma manchete que ele não tem. Um ano não tem *um* fato: tem doze formas. A parede já desenha essas formas em miniatura desde a 2.4b, e é a única peça do app que sabe ler o ano como série; a rota do ano, que é onde ele se lê, ainda não.

**Approach:** A rota ganha um terceiro ramo. O ano abre **serial**: quatro tiras de doze meses a **34 px**, uma por caderno, **antes de qualquer texto**, com os meses rotulados uma vez só sob a última. As tiras leem a `metrica_lider` carimbada e nunca recalculam. Quando nenhum mês do ano liderou, **uma linha em palavras ocupa o lugar das faixas** — quatro faixas brancas pareceriam tela quebrada.

## Boundaries & Constraints

**Always:**
- A tira **lê o carimbo** (AD-17) e **nunca recalcula**: recalcular é reescrita silenciosa de período fechado, proibida desde a 1.9.
- **Identidade, nunca grandeza** — decisão do dono de 25/09, registrada em `docs/specs/revista-retrospectiva/cadernos.md`. A promessa de magnitude está **recusada**, não aberta; reabri-la exige medição nova.
- **A cor carrega só `accent` × `tint`.** Presença × ausência é **forma**, porque `tint` × `line` fica abaixo de ΔE 10 nas 144 combinações de tema (pior par 1,2). A catraca em `theme.test.ts:785` é invertida de propósito e avisa se isso mudar.
- A tira é **formato, não visualização**: sem toque, sem tooltip, sem scrub. A da parede é `Pressable`; **esta não é**.
- **Mês sem carimbo é lacuna declarada**, nunca um valor recalculado fingindo ser o de então.
- O ano continua sendo **a mesma rota e a mesma edição** — as tiras entram antes do texto, não no lugar dele.

**Ask First:**
- Produzir **extremos datados** (`EventoFato`). O critério do épico os pede, e **nenhum caderno além do Sono os tem**; a forma e a seção `### Eventos` do prompt já existem, e falta o produtor. Fica **fora** desta story, por decisão do dono de 25/09: vale mais como story própria, porque serviria as quatro tiras **e** o texto, em todos os períodos. A dívida já está nomeada em `period/cadernos.ts:83`.
- Leitura nova recortada por ano em `edicoes_ia`.
- Mexer na parede, em `escolherCapa`, ou nos três números já aprovados em tela.

**Never:** a 3.3; a web; escrever em produção; magnitude; tocar em `mobile/ios/` (saída de build).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Ano com série | 2025 — 20 de 41 pares com líder | Quatro tiras de doze, 34 px, antes da capa; meses rotulados **uma vez**, sob a última | N/A |
| Ano sem líder nenhum | **2024 — 23 pares, zero líderes** | Uma linha em palavras no lugar das faixas; o texto do ano (1.393 caracteres) segue igual | N/A |
| Caderno que não saiu | um dos quatro sem edição naquele ano | A tira existe e é toda ausência — as quatro sempre aparecem | N/A |
| Mês sem carimbo | edição impressa antes da coluna | Lacuna declarada, distinta de "saiu calado" **por forma** | N/A |
| Troca de líder | `distancia → atividades` | Vão maior entre as duas células | N/A |
| Toque na tira | ele toca | **Nada acontece** — sem tooltip, sem scrub, sem navegação | N/A |
| Leitor de tela | as quatro tiras | Cada uma fala os três estados e as trocas; nunca "em 0 meses" | N/A |
| Arquivo em voo | os meses ainda não chegaram | O ano não afirma silêncio antes de saber — distinga carregando de vazio | falha ⇒ o texto abre sem as tiras |

</frozen-after-approval>

## Code Map

- `packages/shared/src/revista/parede.ts` — `tirasDoAno(arquivo, ano)` :243, `TiraDoAno` :213 (sempre as quatro, sempre doze células), `CelulaDaTira` :189 (`ausente` | `sem-metrica` | `metrica` com `mudou`). Colisão de mês resolvida por `fim` maior :257-273; `anterior` **não** zera num mês mudo :283-289. **Reusar inteiro.**
- `mobile/src/components/revista/TirasDoAnuario.tsx` — o desenho da parede. Geral: `tiraEmPalavras` :92, `corDaCelula` :152, a regra forma-vs-cor, `VAO_DO_MES`/`VAO_DA_TROCA` :70-71. **Específico da miniatura**, que o anuário não herda: `ALTURA_DA_TIRA = 16` :74, o `Pressable` :118-124, o eyebrow :126, a legenda :141-148, a largura fixa 74 do nome :226.
- `mobile/src/app/revista/[tipo]/[inicio].tsx:158-163` — a ramificação de hoje (`TIPO_DO_POSTAL` → postal, resto → `Revista`). `Revista` recebe `TipoComRevista` **de propósito**, para que trocar os braços não compile (TSDoc :260-267) — o ramo novo precisa do mesmo cuidado.
- `mobile/src/app/revista/[tipo]/[inicio].tsx:450-503` — a ordem de desenho: `ScrollView` :450, capa :455-471, aviso do silêncio :476, sumário :484, cadernos :494. As tiras entram como **primeiro filho do `ScrollView`**.
- `mobile/src/hooks/useRolagemAncorada.ts:52-60` — **a armadilha**: `onLayout` dá `layout.y` relativo ao pai imediato, e isso só é o deslocamento certo enquanto cada `Caderno` for filho **direto** do `contentContainer`. Inserir um irmão acima é seguro; **embrulhar** as tiras e o resto numa `View` quebra todas as âncoras em silêncio.
- `packages/shared/src/data/edicoes-ia.ts:325` — `fetchArquivoDeEdicoes(db, userId)`: o arquivo inteiro, paginado, sem `texto`. **É a única fonte dos doze meses**; não há leitura por ano. Hoje só `mobile/src/hooks/useAcervoDaParede.ts:99` a usa.
- `packages/shared/src/date/ptbr.ts:22` — `MESES_INICIAIS`, usado como rótulo de doze colunas em `habitos/detalhe.tsx:202` e `registros/detalhe.tsx:173`.
- `mobile/src/components/cards/ConsistencyCard.tsx:155` — `const BAR_H = 34`, o precedente de altura fixa declarada (e o mesmo número que o critério pede). Não há escala de `fontSize` em `tokens.ts`; tamanho de fonte é literal por componente.
- `packages/shared/src/theme/theme.test.ts:785` — a catraca do ΔE, com asserção **invertida**: enquanto alguma combinação for indistinguível, a decisão de separar por forma vale; se todas passarem, o teste reprova e a decisão reabre.

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/revista/` — a montagem pura do anuário sobre `tirasDoAno`: as quatro tiras do ano, e o veredito "nenhum mês liderou" como estado próprio, com a frase saindo do núcleo e não da tela.
- [x] `mobile/src/components/revista/` — a tira a 34 px, extraindo de `TirasDoAnuario` o que é geral; **sem `Pressable`**, sem legenda de parede, com os meses rotulados uma vez sob a última tira.
- [x] `mobile/src/app/revista/[tipo]/[inicio].tsx` — o terceiro ramo, com o tipo estreitado pelo compilador; as tiras como primeiro filho do `ScrollView`, **sem embrulhar** o que vem depois.
- [x] `mobile/src/hooks/` — os doze meses do ano por `fetchArquivoDeEdicoes`, com o custo declarado (lê o arquivo inteiro para desenhar um ano) e os estados carregando × vazio distintos.
- [x] testes — a matriz de I/O; a fala do leitor de tela; e uma barreira de que a tira do anuário **não** é tocável.

**Acceptance Criteria:**
- Given o ano de 2024, when o anuário abre, then há uma linha em palavras no lugar das faixas, e o texto do ano aparece igual.
- Given o ano de 2025, when as tiras desenham, then são quatro, de doze células, a 34 px, **antes** da capa, com os meses rotulados uma vez só.
- Given qualquer tira, when ela é tocada, then nada acontece.
- Given os cadernos do ano, when se rola até eles, then as âncoras do sumário continuam certas.

## Spec Change Log

**2026-09-26 — o contrato saiu do artifact e entrou no spec (P15 da revisão).**
Três divergências entre o que a tela faz e o que o contrato escrito dizia, reconciliadas
onde elas moravam — sem mudar comportamento nenhum:

1. `cadernos.md` §Anuário afirmava, **como regra geral**, *"O anuário não tem capa. As
   quatro tiras são a capa do ano."* Lendo o épico, a frase é sobre a **parede** (onde o
   ano é representado pelas quatro tiras em miniatura), não sobre a rota — e na rota o ano
   agora mostra as tiras **e** a capa. A frase passou a nomear as duas superfícies e a
   dizer qual governa cada uma;
2. o mesmo arquivo dizia que a promessa de **magnitude** ficava *"em aberto"*. Ela foi
   **recusada** pelo dono em 25/09, quando a tira subiu para 34 px — a decisão que esta
   story cita como frozen. O parágrafo passou a registrar a recusa e o que a reabriria
   (medição nova, coluna nova, migração);
3. **CAP-16** nasceu no [spec da revista](../../docs/specs/revista-retrospectiva/spec.md),
   no molde da CAP-15 da 2.4b: a forma, o carimbo que nunca se recalcula, identidade em vez
   de grandeza, o silêncio em palavras, "formato e não visualização", "nada se afirma antes
   de saber" — e o que fica **fora**, declarado (os extremos datados e a web). A CAP-9, que
   prometia magnitude na série do ano, ganhou o estreitamento por CAP-16.

## Design Notes

**Por que ler o arquivo inteiro para um ano.** `tirasDoAno` pede as edições de **mês** daquele ano, e a rota só tem a edição do ano. Não existe leitura por intervalo, e escrever uma agora seria otimizar antes de medir: o arquivo tem ~170 linhas sem `texto`, e a leitura já é paginada e provada pela parede. O custo fica declarado; se um dia doer, o recorte é uma linha de `.gte`/`.lte`.

**Por que a frase do silêncio sai do núcleo.** "Nenhum mês de 2024 reuniu medida bastante para liderar" é um **veredito sobre o dado**, não um rótulo de tela — e é a mesma gramática da 2.6 e da 2.4b. No núcleo ela tem teste; na tela, só revisão.

**O que esta story não entrega, e por quê.** Os extremos datados. Só o Sono os tem hoje (`SleepExtremes`), e o critério os pede nos quatro. A forma (`EventoFato`) e a seção `### Eventos` do prompt já existem; falta o produtor — que serviria as tiras **e** o texto, em todos os períodos, e por isso vale mais como story própria que como apêndice desta.

## Verification

**Commands:**
- `pnpm --filter @vitale/shared lint` e `test` — 0 falhas
- `cd mobile && pnpm exec tsc --noEmit && pnpm exec jest` — 0 falhas
- `pnpm --filter @vitale/web build` — 0 erros
- `pnpm --filter @vitale/scripts lint` e `test` — 0 falhas

Os **quatro**, por **exit code**. E o barril do shared **não pode mencionar** `imprimir-sequencia`, nem em comentário.

**Manual checks:**
- Abrir 2025 (tem série) e **2024** (não tem): é o par que mostra se o silêncio em palavras funciona.

## Suggested Review Order

**O veredito do ano — puro, e com três silêncios**

- O corte: o ano tem série a mostrar, ou tem uma frase a dizer.
  [`anuario.ts:155`](../../packages/shared/src/revista/anuario.ts#L155)

- A frase do silêncio em quatro formas — nenhum mês impresso, um, N, os doze.
  [`anuario.ts:128`](../../packages/shared/src/revista/anuario.ts#L128)

- A voz única do leitor de tela, que a parede e o anuário compartilham.
  [`anuario.ts:234`](../../packages/shared/src/revista/anuario.ts#L234)

**O estado, fora do React**

- O redutor: carregando ≠ vazio, e a carga superada não sobrescreve.
  [`anuario.ts:99`](../../mobile/src/lib/anuario.ts#L99)

**O desenho**

- 34 px contra os 16 da parede, com o porquê e o filete de 9.
  [`AnuarioDaEdicao.tsx:69`](../../mobile/src/components/revista/AnuarioDaEdicao.tsx#L69)

- O terceiro ramo, estreitado pelo compilador — trocar os braços não compila.
  [`[inicio].tsx:181`](../../mobile/src/app/revista/[tipo]/[inicio].tsx#L181)

**O contrato, reconciliado**

- "O anuário não tem capa" passa a dizer de qual das duas telas fala.
  [`cadernos.md:178`](../../docs/specs/revista-retrospectiva/cadernos.md#L178)

- CAP-16, e o estreitamento anotado na CAP-9 que prometia o mesmo número.
  [`spec.md:115`](../../docs/specs/revista-retrospectiva/spec.md#L115)
