# 0032 — Cor de sono é gramática derivada, não tokens de UI como degraus

**Status:** aceita
**Data:** 2026-09-05

## Contexto

A tela de Sono (spec [sono](../specs/sono/spec.md), CAP-7) desenhava os estágios com os
tokens de UI do papel `blue`: Profundo = `text`, REM = `accent`, Leve = `soft`, Sem estágio =
`ink4`. Medido nas 36 combinações de tema × esquema × paleta (05/09/2026, review de UX):

| Fato | Medida |
|---|---|
| Leve (`soft`, o tint) contra a superfície | **1,14–1,43** nas 36 — é token de fundo, não de dado |
| REM = Profundo (ΔE 0) | **22 de 36** combinações, inclusive Orbe escuro — `text` só se afasta do `accent` quando ele reprova em 4,5, e no escuro ele passa |
| REM × Profundo no Orbe claro | ΔE 7,3 (piso de visão normal é 15) |
| Amarelo do despertar sobre branco (Orbe claro) | 1,76 — o contorno de 1 px era remendo |
| Significados do azul na mesma feature | **três**: dormindo (visão geral), despertar (relógio de vigília), fim de semana (subview) |

A causa não era a escolha das cores: era usar tokens de **interface** (`soft` é tint de chip,
`text` é letra) como degraus de uma rampa que o tema não tinha.

O usuário, ao ver a proposta em rampa de um matiz só, perguntou se "ter diferentes cores não
facilita a leitura". Facilita, para o REM: ele aparece em fatias curtas e espalhadas, e matiz
separa mais rápido que luminosidade. REM também não é profundidade — é sono paradoxal, outro
estado —, então um degrau da rampa mentiria sobre a natureza do dado.

## Decisão

**1. O tema ganha três tokens por papel, derivados e medidos** (`packages/shared/src/theme/derive.ts`):

- `graphic` — o acento empurrado até o piso de 3,0 sobre a superfície, **sem pino histórico**.
  Difere do `accent` só onde o pino o deixa abaixo do piso (amarelo e verde do Orbe claro).
- `wash` — o traço misturado na superfície até 1,6:1: fundo de gráfico que existe sem destacar.
- `ramp` — `{ pale, mid, strong }`: ponta clara ≥ 2,0, meio e escuro ≥ 3,0, vizinhos a ΔE ≥ 10.
  No escuro o piso empurra o escuro para cima; quando ele encosta no meio, a rampa inteira sobe.

`theme.test.ts` cobra os pisos e as separações nas 36 combinações, para todos os papéis.

**2. Sono tem uma gramática só** (`packages/shared/src/sleep/colors.ts`, `sleepColorsOf`):

| cor | diz | de onde vem |
|---|---|---|
| `sleep` / `light` | sono; sono leve | `blue.ramp.mid` |
| `deep` | profundo | `blue.ramp.strong` |
| `rem` | REM | `rose.graphic`, **em todas as paletas** |
| `awake` | vigília, em toda tela | `yellow.graphic` |
| `bed` | cama, faixa p25–p75 | `blue.wash` |
| `unknown` | sem hipnograma — **hachura** | `blue.ramp.mid`, em traço |

O rosa é o único papel que separa do azul **e** do amarelo em visão normal nas seis paletas
(ΔE ≥ 12,2). Sob deuteranopia separa com folga (≥ 11); sob protanopia raspa na Terra, na Joia
e na Acessível — 5,3 contra o azul na Acessível, acima do piso de 5 que a própria paleta cobra
entre módulos (`theme.test.ts`) e abaixo dos 8 da skill de dataviz. A primeira versão fazia o
REM voltar à ponta clara da rampa azul na Acessível; o usuário, que usa essa paleta, viu as
duas no aparelho e escolheu **o rosa em todas** (05/09/2026). A Garmin desenha o REM em rosa
vivo sobre azul claro/escuro; a Apple, em azul-esverdeado — o teal foi medido e colapsa com o
azul em visão normal na Bruma e na Terra (ΔE 7,5–8,2).

`sleep/colors.test.ts` cobra: piso gráfico das cinco cores, Leve ≠ tint, ΔE ≥ 10 entre REM,
Leve, Profundo e vigília, e separação ≥ 5 sob deuteranopia e protanopia na paleta que promete.

**3. As formas.** O despertar é o **vão** da barra em toda tela (spec CAP-2); nas subviews o vão
ganha a **marca amarela ao lado** (3 pt, à direita), escolhida pelo usuário entre três formas
mostradas em mockup. Sono sem hipnograma é hachura, não cinza; noite sem dado continua a
célula tracejada. Os dias da semana têm uma cor só; fim de semana é rótulo em tinta forte.

**4. Os dois apps leem a mesma função.** Mobile: `sleepColors()` em `theme/tokens.ts`. Web:
`sleepCssVars()` escrito no `:root` pelo `ThemeService` como `--sleep-*`. Nenhuma tela decide cor.

## Alternativas rejeitadas

**Manter `text` como Profundo com "escurece mais no escuro".** Resolve o ΔE 0 e mantém o Leve
no tint. Trata o sintoma.

**Rampa de um matiz só (a primeira proposta).** Passa nas 36 por construção — e cobra do REM
exatamente a leitura lenta que o usuário não quer fazer. Chegou a ficar como fallback da
Acessível; ele a viu no aparelho e a descartou.

**REM em teal (Apple) ou roxo.** Teal colapsa com o azul em visão normal em duas paletas; roxo
reprova nas seis sob daltonismo e em cinco em visão normal.

## Consequências

- Sono empresta **dois** papéis: `blue` (ADR 0031) e, para o REM, `rose`, que é o de Compras.
  Mesmo guarda-corpo: enquanto REM e Compras não coocorrerem num gráfico, não custa nada.
- `soft` e `text` deixam de aparecer em marca de dado nas telas de sono. Onde um gráfico
  futuro precisar de fundo, o token é `wash`; onde precisar de degraus, `ramp`.
- O `graphic` torna o contorno do amarelo desnecessário; o `theme.test.ts` já não precisa de
  exceção nomeada para a rampa, porque `graphic` não tem pino.
- O mockup que sustenta esta decisão, com as suas 287 noites e o seletor dos 36 temas:
  `claude.ai/code/artifact/b6db5657-2531-42c2-a91d-7c532ab10601`.
