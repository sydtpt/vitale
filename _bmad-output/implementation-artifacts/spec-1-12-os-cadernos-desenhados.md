---
title: 'Story 1.12 — Os cadernos desenhados'
type: 'feature'
created: '2026-09-17'
status: 'done'
review_loop_iteration: 0
baseline_commit: '399b095b163ac0a6785ad55e03d17d823b9159d0'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A ordem do miolo muda a cada edição, e hoje os quatro cadernos abrem com o mesmo rótulo de 15 px em sans. Em revista de ordem fixa o leitor reconhece pela posição; aqui a posição muda e a cara não existe. E a lápide — o único jeito de a revista dizer que ficou cega — não está desenhada em lugar nenhum.

**Approach:** Cada caderno passa a abrir com a faixa sangrada de 56 px no `accent` do módulo dele, resolvida por `moduleOf()`, com o nome em `onAccent` e ícone em traço — o segundo portador da identidade, que separa Movimento de Coração e resolve daltonismo no mesmo gesto. A lápide ganha os dois estados, alimentada pela entrada (decisão do dono, 17/09), por uma função nova da porta do núcleo. `DESIGN.md` e `EXPERIENCE.md` são a lei e vencem o mockup.

## Boundaries & Constraints

**Always:**
- **A ponte caderno → módulo → papel é uma só e mora no núcleo:** Sono→`agua`, Movimento→`treino`, Coração→`saude`, Rotina→`habito` (DESIGN §Os quatro cadernos). Cor sai de `moduleOf()`; nenhuma tela escolhe cor.
- **Faixa:** sangra de borda a borda, altura **mínima** de 56 px (nunca fixa — tipo dinâmico), fundo `accent`, nome em `onAccent` (sans 700, 22), ícone de 20 px em traço na mesma cor. **Não é tocável**, não colapsa, não vira barra fixa. Para o leitor de tela é cabeçalho de seção com o nome do caderno; o ícone é decorativo.
- **Ícones:** Sono `moon-outline`, Coração `heart-outline`, Rotina `checkmark-circle-outline`, Movimento `bicycle-outline` — novo, com o viés declarado no docblock (a pedalada domina o acervo; corrida e caminhada ficam sob ele).
- **Lápide, dois estados e nunca um terceiro:** a do período em que a métrica morreu vai ao **topo** do caderno, sob a faixa, em serifada 17/25 `ink`; as outras ficam no **pé**, em sans 12,5/18 `ink2`. Nos dois, régua de 2 px à esquerda no `accent` do caderno. Frase: `{nome} — última medida em DD/MM/AAAA.`, com a data em mono. **Não é tocável** e não leva a Conexões.
- **Quem separa os dois estados é o núcleo**, pela mesma régua da impressão (lápide posterior ao fim do período fica de fora): a tela chama uma função nova da porta `ia/imprimir.ts` e **nunca** importa `ia/pacote`. A guarda (7) segue em zero.
- **A lápide aparece em qualquer estado do caderno** — ela é fato da entrada, não da edição, e não depende de haver texto impresso.
- **Papéis tipográficos:** serifada é o texto da edição (e número dentro de frase fica nela), mono é dado exposto (assinatura, data da lápide), sans é o cromo (nome na faixa, lápide de pé, rótulos). A assinatura continua visível, em `ink2`, no formato `modelo · data`.

**Ask First:**
- Mudar frase, corpo, posição ou cor de qualquer item do `DESIGN.md` — inclusive a data da lápide em mono.
- Desenhar detector de métrica morta, gravar lápide no banco, ou mexer na errata.

**Never:**
- Capa com foto, traçado, véu ou `edicoes_capa` (1.13); sumário e rolagem ancorada (1.14).
- Faixa tocável, colapsável ou fixa; lápide tocável; alvo de toque novo em lugar nenhum.
- Recalcular ordem no cliente; mexer em `edicao.store.ts`, na conferência ou no prompt.
- Hex literal, `StyleSheet` de escopo de módulo lendo tema, `ink3` em informação obrigatória.

## I/O & Edge-Case Matrix

| Cenário | Estado | Esperado | Erro |
|---|---|---|---|
| Lápides por caderno | agosto/2026, anéis 17/08 e VO₂max 14/07 | movimento: anéis `doPeriodo: true`, VO₂max `false`; os outros três vazios | N/A |
| Morte posterior ao fim | a mesma entrada, edição de julho/2026 | VO₂max do período; anéis **fora**, porque 17/08 é depois do fim | N/A |
| Entrada recusada | métrica fora do catálogo, ou data impossível | o núcleo lança; a tela registra no log e desenha o caderno sem lápide | nunca derruba a rota |
| Os dois estados juntos | Movimento em agosto/2026 | anéis no topo com o degrau, VO₂max no pé no corpo normal, mesma régua | N/A |
| Duas lápides antigas | Coração em agosto: respiração 10/07, SpO₂ 16/07 | as duas no pé, em ordem de data | N/A |
| Lápide sem texto | caderno `nao-escrito` com lápide do período | faixa + lápide no topo + a frase do estado + o botão de escrever | N/A |
| Caderno sem lápide | Rotina | faixa, texto e assinatura; nenhum espaço reservado | N/A |
| Tipo dinâmico AX3 | nome longo na faixa | a faixa cresce; nada de corte nem de reticências | N/A |

</frozen-after-approval>

## Code Map

- `mobile/src/app/revista/[tipo]/[inicio].tsx:238-297` — o `Caderno` da 1.11: `styles.rotulo` em sans vira a faixa, e o corpo passa a ser o bloco recuado. `createStyles:317` tem `caderno`, `texto`, `assinatura`, `lab`, `errata`.
- `mobile/src/theme/index.tsx:141` `useThemedStyles`; `mobile/src/theme/tokens.ts:113` `moduleColors(key, fallback)` — chamada no render, dentro de componente que assina o tema. Molde: `mobile/src/app/registros/index.tsx:41`.
- `packages/shared/src/theme/derive.ts:506` `moduleOf()` devolve `{tint, accent, onTint, onAccent}`; `theme/palettes.ts:80` `MODULE_ROLE` e `ModuleKey`. `theme/theme.test.ts:205` já cobra o contraste de `onAccent` nas 36 combinações — não há trabalho de tema aqui.
- `packages/shared/src/period/cadernos.ts` — `CadernoId`/`CADERNO_IDS` (32), `rotuloDoCaderno` (180), `LAPIDES` (261: caderno, `nome` em prosa e verbo de cada métrica), `METRICAS_COM_LAPIDE`. `cadernos.test.ts` é o molde do teste.
- `packages/shared/src/ia/pacote.ts` — `FatoLapide` (226), `lapidesPorCaderno` (941, privada), `lapideDoPeriodo` (1017), `montarPacotes`. **Fora da porta**: a tela não importa daqui.
- `packages/shared/src/ia/imprimir.ts:175` `cadernosComDado` — o precedente exato da função nova: porta, sem ranqueamento, sobre `montarPacotes(comCoberturaDoSono(entrada))`.
- `mobile/src/lib/edicao-ia.ts:397-434` — `dataDaAssinatura`, `assinaturaDoCaderno` (a assinatura já é `modelo · data` em `ink2`) e `comDadoDaEntrada`, que é o molde do `try/catch` que engole a recusa do núcleo.
- `mobile/src/app/retrospectiva/index.tsx:73` `ICON_MAP` — de onde vêm três dos quatro ícones; não tem bicicleta.
- `packages/shared/src/architecture.test.ts:1795` `PORTA_DE_IA` (a guarda 7) e `:1198` a catraca de hex.
- `_bmad-output/planning-artifacts/ux-designs/ux-revista-retrospectiva-2026-09-07/DESIGN.md` §Colors, §Typography, §Components (faixa, lápide) + `EXPERIENCE.md` §Accessibility Floor. O mockup `mockups/key-edicao.html` ilustra, e **perde onde conflita**: a lápide de pé é sans 12,5 pelo DESIGN, não serifada 14.

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/period/cadernos.ts` + `cadernos.test.ts` — `MODULO_DO_CADERNO: Record<CadernoId, ModuleKey>` com a ponte do DESIGN, e o teste de que os quatro caem em **quatro papéis distintos** de `MODULE_ROLE`: é o que sustenta CAP-7 na origem.
- [x] `packages/shared/src/ia/imprimir.ts` + `imprimir.test.ts` — `lapidesDosCadernos(entrada)`: por caderno, as lápides até o fim do período, cada uma com `doPeriodo`, em ordem de data. Cobre as três primeiras linhas da matriz.
- [x] `mobile/src/lib/edicao-ia.ts` + teste — `ICONE_DO_CADERNO`, `fraseDaLapide(metrica, ultimaMedidaISO)` (sem `Date`, para a data não andar com o fuso) e `lapidesDaEntrada(entrada)`, o wrapper que engole a recusa e devolve tudo vazio.
- [x] `mobile/src/app/revista/[tipo]/[inicio].tsx` — o `Caderno` ganha a faixa sangrada (cor de `moduleColors`), o corpo recuado e as lápides nos dois lugares, com as famílias por papel e os rótulos de acessibilidade.

**Acceptance Criteria:**
- Given a edição de agosto/2026 no iPhone, when o dono rola o miolo, then os quatro cadernos abrem com faixas de cores diferentes, cada uma com ícone e nome legíveis, e nenhuma responde ao toque.
- Given a paleta acessível no esquema escuro, when a mesma edição é aberta, then faixa e nome continuam saindo de `moduleOf()`, sem hex, e o nome continua legível.
- Given a suíte, when roda, then a guarda (7) segue em zero, a catraca de hex não sobe, e a matriz tem teste nas funções puras.

## Design Notes

**Por que a lápide vem da entrada** (decisão do dono, 17/09): a edição não guarda lápide no banco. Alimentando-a pela entrada, os dois estados ficam desenhados e testados hoje, com lápides sintéticas; no aparelho ela fica **invisível enquanto não houver detector de métrica morta** — isso é esperado, não defeito.

**Por que a função nova é da porta:** `lapideDoPeriodo`, `montarPacotes` e `LAPIDES` decidem juntos quem morreu *neste* período. Repetir essa régua na tela criaria uma segunda resposta, e a guarda (7) proíbe importar as peças.

```ts
lapidesDosCadernos({ resumo /* agosto/2026 */, agora, lapides: [
  { metrica: 'aneis', ultimaMedidaISO: '2026-08-17' },
  { metrica: 'vo2max', ultimaMedidaISO: '2026-07-14' },
] });
// → { sono: [], coracao: [], rotina: [],
//     movimento: [ { metrica:'vo2max', ultimaMedidaISO:'2026-07-14', doPeriodo:false },
//                  { metrica:'aneis',  ultimaMedidaISO:'2026-08-17', doPeriodo:true  } ] }
```

**A data da lápide em mono, dentro da frase:** é carimbo de medida, do mesmo tipo da assinatura. A regra "número dentro de frase continua serifado" vale para a prosa narrada; a lápide é registro, e o mockup a marca assim.

## Verification

**Commands:**
- `pnpm --filter @vitale/shared lint && pnpm --filter @vitale/shared test` — barreiras verdes, guarda (7) em zero, catraca de hex sem subir.
- `pnpm --filter @vitale/web build` — o núcleo mudou; o web compila do fonte.
- `cd mobile && pnpm exec tsc --noEmit && pnpm exec jest` — tipos e testes do celular.

**Manual checks (if no CLI):**
- A rota `/revista/mes/2026-08-01` no iPhone: quatro faixas sangradas, ícone à esquerda do nome, nenhuma reagindo ao toque, e o texto de cada caderno recuado em `{spacing}` — **portão do dono**.

## Suggested Review Order

**A ponte caderno → módulo → papel**

- A entrada: o mapa que dá cor a cada caderno, com o porquê de cada escolha.
  [`cadernos.ts:217`](../../packages/shared/src/period/cadernos.ts#L217)

- A barreira na origem: os quatro têm de cair em quatro papéis distintos.
  [`cadernos.test.ts:232`](../../packages/shared/src/period/cadernos.test.ts#L232)

**A lápide, do núcleo à tela**

- A porta responde em qual dos dois estados cada morte aparece.
  [`imprimir.ts:220`](../../packages/shared/src/ia/imprimir.ts#L220)

- O tipo que carrega a diferença visual inteira — `doPeriodo`.
  [`imprimir.ts:190`](../../packages/shared/src/ia/imprimir.ts#L190)

- A frase partida onde a família muda: a data sai em mono, sem `Date`.
  [`edicao-ia.ts:510`](../../mobile/src/lib/edicao-ia.ts#L510)

- A recusa do núcleo engolida: a rota nunca cai por lápide inválida.
  [`edicao-ia.ts:535`](../../mobile/src/lib/edicao-ia.ts#L535)

**O caderno desenhado**

- A faixa sangrada, o ícone e o nome — cor resolvida no render, nunca na folha.
  [`[inicio].tsx:306`](../../mobile/src/app/revista/[tipo]/[inicio].tsx#L306)

- Os dois estados da lápide: topo com o degrau, pé no corpo normal.
  [`[inicio].tsx:269`](../../mobile/src/app/revista/[tipo]/[inicio].tsx#L269)

- A folha: `minHeight` e o porquê de a faixa não ter `lineHeight`.
  [`[inicio].tsx:465`](../../mobile/src/app/revista/[tipo]/[inicio].tsx#L465)

- O ícone novo, com o viés da pedalada declarado.
  [`edicao-ia.ts:461`](../../mobile/src/lib/edicao-ia.ts#L461)

**Os testes**

- A matriz da story, linha a linha, incluindo as duas mortes do mesmo dia.
  [`imprimir.test.ts:700`](../../packages/shared/src/ia/imprimir.test.ts#L700)

- Ícones, frase e wrapper no celular.
  [`edicao-ia.test.ts:683`](../../mobile/src/lib/__tests__/edicao-ia.test.ts#L683)
