---
title: 'Story 1.2 — onAccent no sistema de tema'
type: 'feature'
created: '2026-09-09'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'ba016ccd6440f6df289336975d2541f700e68668'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Não existe primeiro plano legível para `accent` **sólido** por papel de paleta.
O `on` que os papéis têm hoje é para o `soft` (o tint), e medido **sobre o `accent` ele dá
1,00 a 1,94** nas 36 combinações — o pior caso é o amarelo do Orbe claro, que é a combinação
padrão do app. A revista precisa disso porque a ordem do miolo é variável: o leitor não
reconhece o caderno pela posição, reconhece pela cara, e a cara é uma faixa sangrada no
`accent` do módulo com o nome dentro.

**Approach:** `onAccent` nasce como token derivado, no molde do `onPrimary`: o melhor entre a
tinta do tema e o `bgPure` por contraste **medido**, não escolhido. Entra em **`RoleTokens`**
(no laço dos papéis de `resolveTokens`) **e** em **`ModuleTokens`** (devolvido por
`moduleOf`), porque é `moduleOf()` que a faixa lê.

## Boundaries & Constraints

**Always:**
- `onAccent` existe nos **dois** lugares — `RoleTokens` e `ModuleTokens` — e a barreira cobre
  os dois com **dois laços**. Cobrir só um deixa `moduleOf()` sem garantia, que é exatamente a
  regressão que esta story existe para impedir.
- A derivação é **argmax de contraste medido** entre `ink` e `bgPure`. Nunca um hex autorado,
  nunca `#FFF` cravado.
- O piso cobrado é o de **objeto gráfico (3,0)**, com a razão escrita no teste.
- Os hex históricos do Orbe claro e escuro **não se mexem**: o teste que os trava não muda.

**Ask First:**
- Qualquer mudança no piso cobrado.
- Qualquer alteração nos valores travados de `ORBE_LIGHT` / `ORBE_DARK`.

**Never:**
- **Sem alias plano** (`yellowOnAccent`, `greenOnAccent`…) e **sem variável CSS**. Os aliases
  planos servem à web, e web é não-objetivo declarado desta frente.
- **Não cobrar `TEXT_FLOOR` (4,5)** na barreira: o mínimo medido é 4,246, e cobrar 4,5
  derrubaria o build sem que nada esteja errado. Ver Design Notes.
- **Não criar um segundo array de combinações.** O `COMBOS` que já existe é 3 temas × 2
  esquemas × 6 paletas = 36; só o comentário acima dele está velho.
- Não tocar em `on`, `text`, `graphic`, `wash` nem `ramp` — `onAccent` é token novo, não
  redefinição de um existente.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Papel qualquer, combinação qualquer | Um dos papéis nas 36 combinações | `onAccent` é o argmax de contraste entre `ink` e `bgPure` sobre aquele `accent` | N/A |
| Piso sobre o sólido | `onAccent` desenhado sobre `accent` | `contrast >= 3,0` nas 36 | N/A |
| A faixa do caderno | `moduleOf(key, …)` para os 10 módulos | Devolve `onAccent`, e ele passa o piso sobre o `accent` do módulo | N/A |
| Pior caso conhecido | Amarelo, tema orbe, esquema claro | Passa o piso — hoje `on` sobre `accent` mede 1,00 aqui | N/A |
| Não-regressão histórica | `resolveTokens('orbe','light','orbe')` | Todos os hex de `ORBE_LIGHT` idênticos; idem `ORBE_DARK` | N/A |
| Web continua fora | Busca por alias plano ou variável CSS de `onAccent` | Não existe nenhum | N/A |

</frozen-after-approval>

## Code Map

- `packages/shared/src/theme/derive.ts:267-284` -- `interface RoleTokens`: `onAccent` entra
  aqui, com docstring dizendo que é para o **sólido**, ao contrário do `on`, que é para o tint
- `packages/shared/src/theme/derive.ts:386-408` -- o laço `for (const role of ROLE_KEYS)` que
  monta cada papel; a linha nova fica ao lado de `on: onTintOf(accent, soft)`
- `packages/shared/src/theme/derive.ts:380` -- `const neutrals = neutralsOf(theme, scheme)`, de
  onde saem `ink` e `bgPure` (confirme os nomes exatos no `ThemeNeutrals` de `themes.ts`)
- `packages/shared/src/theme/derive.ts:444-446` -- **o molde**: `onPrimary` escolhendo por
  `contrast(a, base) >= contrast(b, base)`. Mesma forma, outros dois candidatos
- `packages/shared/src/theme/derive.ts:467-472` -- `interface ModuleTokens`: hoje
  `{ tint, accent, onTint }`
- `packages/shared/src/theme/derive.ts:474-487` -- `moduleOf`: devolve
  `{ tint: r.soft, accent: r.accent, onTint: r.on }`; ganha `onAccent: r.onAccent`
- `packages/shared/src/theme/derive.ts:76,78` -- `GRAPHIC_FLOOR = 3` e `TEXT_FLOOR = 4.5`
- `packages/shared/src/theme/themes.ts:36` -- `bgPure` no `ThemeNeutrals`
- `packages/shared/src/theme/theme.test.ts:35-37` -- o `COMBOS` das 36; **o comentário acima
  dele diz "As 24 combinações" e está errado desde algum refactor** — corrigir, não duplicar
- `packages/shared/src/theme/theme.test.ts:55-93` -- os hex travados de `ORBE_LIGHT`/`ORBE_DARK`
  e o teste de não-regressão; **read-only**
- `packages/shared/src/theme/theme.test.ts:228-238` -- o molde do laço de **módulos**
  (`COMBOS` × `MODULE_KEYS` chamando `moduleOf`)
- `packages/shared/src/theme/theme.test.ts:300-312` -- o molde do laço de **papéis** e a
  docstring que explica por que o piso é 3,0 e não 4,5; o mesmo argumento vale aqui

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/theme/derive.ts` -- `onAccent` em `RoleTokens`, derivado no laço dos
      papéis como argmax entre `ink` e `bgPure` -- é o token que falta para a faixa
- [x] `packages/shared/src/theme/derive.ts` -- `onAccent` em `ModuleTokens` e devolvido por
      `moduleOf` -- é `moduleOf()` que a faixa lê; sem isto o token existe e não chega
- [x] `packages/shared/src/theme/theme.test.ts` -- barreira com **dois** laços: papéis
      (`COMBOS` × `roles`) e módulos (`COMBOS` × `MODULE_KEYS` via `moduleOf`), cada um
      asserindo argmax **e** piso de 3,0 -- um laço só deixa metade sem garantia
- [x] `packages/shared/src/theme/theme.test.ts` -- escrever no teste a razão do piso 3,0 e
      registrar o mínimo medido como folga -- para ninguém "consertar" para 4,5 depois
- [x] `packages/shared/src/theme/theme.test.ts:35` -- corrigir o comentário de "24" para 36

**Acceptance Criteria:**
- Given as 36 combinações, when a suíte de tema roda, then `onAccent` é o argmax de contraste
  entre `ink` e `bgPure`, e `contrast(onAccent, accent) >= 3,0`, **nos dois laços**.
- Given `moduleOf(key, …)` para cada um dos módulos, when a faixa pede o primeiro plano, then
  recebe `onAccent` e ele passa o piso.
- Given o recorte histórico Orbe, when `resolveTokens` roda depois da mudança, then os hex de
  `ORBE_LIGHT` e `ORBE_DARK` continuam idênticos.
- Given que web é não-objetivo, when se procura por alias plano ou variável CSS de `onAccent`,
  then não existe nenhum.

## Design Notes

**Por que dois laços, e não um.** `RoleTokens` e `ModuleTokens` são objetos diferentes:
`moduleOf` **recompõe** um a partir do outro (`{ tint: r.soft, accent: r.accent, onTint: r.on }`).
Uma barreira que só percorre `tokens.roles` prova que o token foi derivado, nunca que ele
**chegou** a quem desenha. A story anterior desta frente ensinou a mesma lição noutra forma:
uma garantia que cobre um caminho garante um caminho — não a intenção.

**Por que 3,0 e não 4,5.** O nome do caderno é 22 px peso 700, e isso é *texto grande* na
WCAG, cuja faixa começa em 18,66 px negrito. O mínimo medido nas 36 é **4,246**: passa
folgado em 3,0 e raspa em 4,5. Cobrar 4,5 derrubaria o build por rigor no critério errado —
exatamente o erro que a docstring do `onPrimary` já documenta ter cometido uma vez. Os 4,246
ficam registrados **como folga, nunca como piso**: virar catraca é decisão separada, e a
espinha a deixou explicitamente adiada.

**O `on` que já existe não serve, e não é bug.** Ele é o primeiro plano do `soft` — o ícone
dentro da caixa clara do módulo. Sobre o `accent` cheio ele não tem por que passar, e não
passa. São dois contextos, dois tokens.

## Verification

**Commands:**
- `pnpm --filter @vitale/shared lint` -- expected: 0 erros
- `pnpm --filter @vitale/shared test` -- expected: exit 0; a checagem nova aparece na saída
- `cd mobile && pnpm exec tsc --noEmit` -- expected: 0 erros
- `cd mobile && pnpm exec jest` -- expected: sem regressão
- `pnpm --filter @vitale/web build && pnpm --filter @vitale/web test` -- expected: sem regressão

**Provas negativas (rodar e reverter — teste verde não demonstra reprovação):**
- Forçar `onAccent` ao candidato **errado** (o de menor contraste) -- expected: os dois laços
  reprovam, não só um.
- Fazer `moduleOf` devolver `r.on` no lugar de `r.onAccent` -- expected: **o laço de módulos
  reprova**. Se passar, a barreira tem um laço só e a story não está feita.

**Manual checks:**
- Nenhum nesta story: não há superfície. A faixa desenhada é a Story 1.12, e é lá que a
  conferência no aparelho acontece.

## Suggested Review Order

**A derivação, e por que ela é medida e não escolhida**

- O ponto de entrada: argmax entre a tinta e o `bgPure`, no molde do `onPrimary`.
  [`derive.ts:154`](../../packages/shared/src/theme/derive.ts#L154)

- O token no papel — irmão do `on`, que serve ao tint e não ao sólido.
  [`derive.ts:294`](../../packages/shared/src/theme/derive.ts#L294)

**A entrega até quem desenha**

- `moduleOf` recompõe um objeto novo; sem esta linha o token existe e não chega.
  [`derive.ts:518`](../../packages/shared/src/theme/derive.ts#L518)

- O token no módulo — é este que a faixa do caderno vai ler.
  [`derive.ts:503`](../../packages/shared/src/theme/derive.ts#L503)

**As três guardas**

- Laço dos papéis: prova que foi derivado certo nas 36 combinações.
  [`theme.test.ts:201`](../../packages/shared/src/theme/theme.test.ts#L201)

- Laço dos módulos: prova que chegou. Sabotar `moduleOf` deixa o de cima verde.
  [`theme.test.ts:311`](../../packages/shared/src/theme/theme.test.ts#L311)

- O arame: guarda uma ausência deliberada, e diz como se aposenta.
  [`architecture.test.ts:512`](../../packages/shared/src/architecture.test.ts#L512)
