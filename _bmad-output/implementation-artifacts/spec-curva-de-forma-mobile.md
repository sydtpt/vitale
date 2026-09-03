---
title: 'Curva de forma — cartão em carrossel na aba Hoje (mobile)'
type: 'feature'
created: '2026-09-03'
status: 'done'
baseline_commit: '8e0df57c0b7768f328eb62f30c4d0303bcd15074'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** O núcleo da curva de forma existe (`buildFormCurve`, etapa 1), mas nenhuma tela o mostra. A Hoje é a única tela que o atleta olha todo dia e ela não diz se ele está fresco ou enterrado.

**Approach:** Um cartão em carrossel de altura fixa na Hoje, logo abaixo da saudação: o slide 1 mostra saldo, frase de estado e faísca de 42 dias; o slide 2, as barras Base/Cansaço com o traço do típico pessoal. Design fechado com a UX: canvas em `_bmad-output/design/curva-de-forma/`.

## Boundaries & Constraints

**Always:**
- Bloco de altura fixa: trilho 206 pt + 9 de respiro + 8 de pílulas = 223 pt, sempre. Trocar de slide ou de estado não move o que vem depois; alerta, nota de aquecimento e rótulos do eixo ocupam a mesma linha.
- Casca do slide = a dos outros cards da Hoje (`colors.surface`, raio 24, padding 18, `shadows.card`). Sem herói preto.
- Zero hex. Base = `mix(roleColors('blue').text, colors.ink, 0.4)` (renegociado na revisão: o `.text` cru tinha luminância igual à do rose), Cansaço = `roleColors('rose').text`; número em `roleColors('green'|'red').text`; traços da faísca em `.accent`; sem confiança → `ink3`. Marca só no ícone do alerta (`colors.primaryDeep`).
- Fonte pela chave de família (`fonts.serif`, `fonts.sansBold`, `fonts.mono`…), nunca `fontWeight`. Folha via `useThemedStyles(createStyles)`.
- Lógica de apresentação pura em `lib/form-curve-view.ts`, testada com Jest; o componente só desenha.
- Copy em pt-BR conforme o canvas. O traço do típico é **mediana**: a legenda não pode dizer "média".

**Ask First:**
- Se `roleColors('blue').text` e `('rose').text` não separarem as barras a olho nos seis temas.
- Se precisar de outro store, hook ou mudança em `activities.store.ts` além de chamar `load()`.
- Se algo exigir mudança em `packages/shared`.

**Never:**
- Tocar em `form-curve.ts` ou `Sparkline.tsx`. Importar `react-native-reanimated`.
- Linha "Ver a curva completa": sem tela destino, fica fora (diferido).
- Estado vazio desenhado, animação de entrada, espiada do próximo slide.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Fresco | `trusted`, `form ≥ 0` | número verde com `+`, "Dá para forçar hoje.", rótulos "42 dias" / "hoje" | N/A |
| Enterrado | `trusted`, `form < 0` | número vermelho, "Hoje é dia de perna leve." | N/A |
| Sem confiança | `!trusted`, `daysSinceLastActivity = 12` | número e ponto em `ink3`, "Não dá para confiar neste número.", selo "12 DIAS SEM SINCRONIZAR", alerta pressável → `/configuracoes/conexoes` | N/A |
| Aquecendo | `trusted && shortWindow`, `historyDays = 20` | "Base ainda aquecendo · 20 de 42 dias" no lugar dos rótulos | N/A |
| Faísca | últimos 42 `series[].form` cruzando zero | segmentos verdes acima e vermelhos abaixo, cortados no cruzamento interpolado; zero tracejado com rótulo "0"; ponto final na cor do estado | N/A |
| Faísca curta | `series` com 1 ponto | um ponto, sem `NaN` no path | N/A |
| Barras | base 93, cansaço 57, típico 96/101 | escala = 1,1 × 101 para as duas; larguras e traços proporcionais; valores inteiros | N/A |
| Detalhe | ≥ 8 pontos | "O cansaço caiu 36 em uma semana e a base segurou em 93." (\|Δ\| ≤ 1 → "segurou em X"; senão "subiu/caiu Δ para X") | N/A |
| Detalhe curto | < 8 pontos | frase omitida, altura mantida | N/A |
| Sem dado | store não `loaded`, ou `series.length = 0` | cartão não renderiza | N/A |

</frozen-after-approval>

## Code Map

- `mobile/src/app/(tabs)/index.tsx:63-123,189-207` — a Hoje. Stores carregam em `useEffect` por `[load, user?.id]` (L77) e no `useRefreshOnForeground` (L123); `now` em L189; o cartão entra entre a saudação (L202) e o `SleepRatingCard` (L205). Ainda não carrega `useActivitiesStore`.
- `mobile/src/store/activities.store.ts:83-98,131` — `_all` (inclui ocultas), `loaded`, `load(force?)`. Assinar `s._all` e `s.loaded`; `buildFormCurve` já ignora `hidden`.
- `packages/shared/src/fitness/form-curve.ts:232-291` — o contrato `FormCurve`; L329 `buildFormCurve(activities, options?, now?)`. **Somente leitura.**
- `mobile/src/components/cards/SleepRatingCard.tsx:50-58` — casca de card da Hoje a copiar; `Ionicons` de `@expo/vector-icons` (L3) para ícone e chevron.
- `mobile/src/components/cards/ConsistencyCard.tsx:85-101` — padrão `activities` por prop + `useMemo` sobre o núcleo.
- `mobile/src/components/charts/Sparkline.tsx` — como o app usa `react-native-svg` (`Svg`, `Path`). Monocromático: não reutilizar nem alterar.
- `mobile/src/theme/tokens.ts:119,226,249` — `roleColors(role)`, `fonts`, `shadows`. `colors` é proxy vivo: ler só em `createStyles`/render (`architecture.test.ts` cobra).
- `packages/shared/src/theme/derive.ts:134,169` — `textOf` = acento corrigido a 4,5 sobre a superfície; `RoleTokens {accent, soft, on, text}`; os quatro papéis existem em toda paleta.
- `mobile/src/app/configuracoes/conexoes.tsx` + `_layout.tsx:215` — rota tipada `/configuracoes/conexoes`.
- `_bmad-output/design/curva-de-forma/build_temas.py:100-196` — medidas e copy dos dois slides; `canvas.json` (notas `sally-carrossel`, `sally-alerta`, `sally-barras`).

## Tasks & Acceptance

**Execution:**
- [x] `mobile/src/lib/form-curve-view.ts` -- criar `formState(curve)`, `sparkSegments(values, w, h)`, `barScale(curve)`, `detailSentence(series)`, `staleLabel(days)`, `warmupLabel(historyDays)` -- puro e determinístico, é o que se testa
- [x] `mobile/src/lib/__tests__/form-curve-view.test.ts` -- cobrir cada linha da matriz -- Jest (`describe/it/expect` de `@jest/globals`, como `readiness.test.ts`), sem renderizar
- [x] `mobile/src/components/cards/FormCurveCard.tsx` -- criar o carrossel (`ScrollView` horizontal `pagingEnabled`, largura por `onLayout`, pílula ativa por `onMomentumScrollEnd`) e os dois slides conforme o canvas; props `{ activities, loaded }`; `useMemo` em `[activities, localDateStr()]` -- só desenho
- [x] `mobile/src/app/(tabs)/index.tsx` -- carregar `useActivitiesStore` (mount, `user?.id`, foreground) e renderizar o cartão abaixo da saudação -- sem isso a Hoje não tem atividades
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` -- registrar "Ver a curva completa" (tela da curva) como diferido

**Acceptance Criteria:**
- Dado histórico confiável, quando abre a Hoje, então vê saldo com sinal, frase e faísca segmentada; ao arrastar, as barras com o traço do típico; saudação e `SleepRatingCard` não mudam de lugar.
- Dados 12 dias sem sincronizar, quando abre a Hoje, então número e ponto ficam neutros, o selo aparece e tocar no alerta abre Conexões.
- Dados os seis temas × esquemas, quando o cartão renderiza, então nenhuma cor nasce de hex no componente e Base/Cansaço continuam distinguíveis.
- Dados os comandos de Verification, quando rodados, então passam com `form-curve.ts` intocado.

## Spec Change Log

- **2026-09-03 · revisão (Ask First disparado, sem loopback).** Achado: medido nos 36 casos de tema × esquema × paleta, `roleColors('blue').text` e `roleColors('rose').text` têm separação de luminância de 1,00 a 1,26 — só o matiz distinguia as barras, o caso que a UX rejeitou. Amendado pelo humano: Base = `mix(blue.text, ink, 0.4)` (separação 1,19–2,13; ≥ 7,6 sobre a superfície), encapsulado em `baseBarColor()` e fixado por teste em todos os casos. Estado ruim evitado: barras iguais para quem tem deficiência de visão de cor ou olha o telefone no sol. KEEP: zero hex no componente; a derivação vive na lógica pura, não na tela.

## Design Notes

A faísca é o único desenho novo. Segmentar por sinal exige cortar a polilinha no cruzamento de zero, não colorir ponto a ponto:

```
p[i] = -4, p[i+1] = +6  →  t = 4/10; x_c = x_i + t·dx
o vermelho termina em (x_c, y0); o verde começa ali
```

Domínio y = [min(form, 0), max(form, 0)] com 2 pt de margem: o zero fica sempre dentro; viewbox com folga para o rótulo "0" e o ponto final.

## Verification

**Commands:**
- `cd mobile && pnpm exec expo customize tsconfig.json && pnpm exec tsc --noEmit` -- expected: sem erro
- `cd mobile && pnpm exec jest` -- expected: todas as suítes passam, incluindo `form-curve-view.test.ts`
- `pnpm --filter @vitale/shared test` -- expected: passa, incluindo `architecture.test.ts`
- `git diff --stat packages/shared/` -- expected: vazio

## Suggested Review Order

**Ponto de entrada**

- O carrossel de altura fixa: por que nada abaixo se move e onde mora a casca de card.
  [`FormCurveCard.tsx:51`](../../mobile/src/components/cards/FormCurveCard.tsx#L51)

**Carrossel e altura fixa**

- Casca no trilho: o `ScrollView` recorta os filhos e cortaria a sombra do slide.
  [`FormCurveCard.tsx:316`](../../mobile/src/components/cards/FormCurveCard.tsx#L316)

- Trilho recortado pelo raio; os slides medem a altura útil, já sem o contorno do Clean.
  [`FormCurveCard.tsx:322`](../../mobile/src/components/cards/FormCurveCard.tsx#L322)

- Reencaixe do slide ativo quando a largura muda (rotação, split view).
  [`FormCurveCard.tsx:93`](../../mobile/src/components/cards/FormCurveCard.tsx#L93)

- Pílulas pressáveis, com rótulo e estado para o leitor de tela.
  [`FormCurveCard.tsx:272`](../../mobile/src/components/cards/FormCurveCard.tsx#L272)

**Estado e cor**

- Sem dado, sem cartão: `canShow` antes de qualquer desenho.
  [`FormCurveCard.tsx:98`](../../mobile/src/components/cards/FormCurveCard.tsx#L98)

- Base num passo mais fundo que `.text`: a renegociação da revisão, com os números.
  [`form-curve-view.ts:33`](../../mobile/src/lib/form-curve-view.ts#L33)

- Tom decidido pelo número impresso, não pelo float: "0" nunca é vermelho.
  [`form-curve-view.ts:103`](../../mobile/src/lib/form-curve-view.ts#L103)

- Rodapé de três variantes na mesma altura; o alerta leva a Conexões.
  [`FormCurveCard.tsx:218`](../../mobile/src/components/cards/FormCurveCard.tsx#L218)

**Faísca e barras**

- Corte no cruzamento de zero por interpolação, um segmento por sinal.
  [`form-curve-view.ts:161`](../../mobile/src/lib/form-curve-view.ts#L161)

- As duas barras na mesma escala, com 10% de folga.
  [`form-curve-view.ts:216`](../../mobile/src/lib/form-curve-view.ts#L216)

- Frase de detalhe sobre valores arredondados; variação de 1 é ruído.
  [`form-curve-view.ts:237`](../../mobile/src/lib/form-curve-view.ts#L237)

- Rótulos de janela derivados do núcleo, não de literais.
  [`form-curve-view.ts:45`](../../mobile/src/lib/form-curve-view.ts#L45)

**Dados**

- `load(true)`: sem `force` o store é no-op depois de carregado.
  [`index.tsx:132`](../../mobile/src/app/(tabs)/index.tsx#L132)

- Recarga ao voltar do background, para o selo limpar depois de sincronizar.
  [`index.tsx:136`](../../mobile/src/app/(tabs)/index.tsx#L136)

- O cartão entra logo abaixo da saudação.
  [`index.tsx:218`](../../mobile/src/app/(tabs)/index.tsx#L218)

**Periféricos**

- A matriz de estados, linha a linha.
  [`form-curve-view.test.ts:54`](../../mobile/src/lib/__tests__/form-curve-view.test.ts#L54)

- Separação de cor fixada nos 36 casos de tema × esquema × paleta.
  [`form-curve-view.test.ts:280`](../../mobile/src/lib/__tests__/form-curve-view.test.ts#L280)

- Segmentação da faísca, inclusive zero exato e valor não finito.
  [`form-curve-view.test.ts:151`](../../mobile/src/lib/__tests__/form-curve-view.test.ts#L151)

- O spec durável da Hoje ganha o cartão.
  [`mobile-hoje.md:44`](../../docs/specs/mobile-hoje.md#L44)

- Três diferidos: tela da curva, descanso × sync parado, falso positivo da barreira.
  [`deferred-work.md:106`](deferred-work.md#L106)

- O registro da renegociação de cor.
  [`spec-curva-de-forma-mobile.md:84`](spec-curva-de-forma-mobile.md#L84)
