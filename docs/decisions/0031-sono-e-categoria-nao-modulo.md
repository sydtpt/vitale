# 0031 — Sono é categoria de Saúde, não módulo

**Status:** aceita
**Data:** 2026-09-04

## Contexto

A [tela de Sono](../specs/sono/spec.md) nasceu com a suposição de que Sono viraria o **11º
módulo** do app e ganharia papel cromático próprio — hoje são 10 (`treino`, `food`, `agua`,
`habito`, `casa`, `compras`, `financas`, `tarefa`, `cultura`, `saude`).

Desde a [ADR 0018](0018-cor-de-modulo-deriva-de-papel-cromatico.md), cor de módulo não é hex
autorado: cada paleta declara **papéis** e cada módulo aponta para um papel via `MODULE_ROLE`
(`packages/shared/src/theme/palettes.ts`). Um módulo novo exige, portanto, um papel novo — seis
hex, um por paleta.

O usuário escolheu o **azul** para Sono. O azul é o papel `blue`, e o papel `blue` já pertence
ao módulo `agua`.

`theme.test.ts:545` cobra que **todo par de módulos** se distinga dentro de cada paleta:

```ts
const d = deltaE(a, b);
if (d < 3.5) bad.push(`${p.id} ${MODULE_KEYS[i]}×${MODULE_KEYS[j]} ${d.toFixed(1)}`);
```

Com `MODULE_ROLE.sono = 'blue'`, o par `sono × agua` mede **ΔE = 0,0** — mesmo hex — e o teste
falha nas seis paletas. E não há para onde mover a água: dos onze papéis, dez estão ocupados
por módulo e o décimo primeiro (`deep`) pertence ao domínio da marca.

## Decisão

**Sono não entra em `MODULE_ROLE`.** Continua sendo uma **categoria de Saúde**, ao lado de
Atividade, Coração, Corpo e Nutrição, e toma emprestada a cor de um módulo — `moduleOf('agua')`,
o papel `blue` — exatamente como já faz hoje em `health-metrics.ts:53` e em
`recuperacao/index.tsx:36`.

Custo: zero. Nenhum hex novo, nenhuma migration de paleta, nenhum teste afrouxado.

**A justificativa não é o custo — é a semântica.** Módulo no Orbe é um **domínio da vida**:
treino, comida, casa, dinheiro, cultura. Sono não é um domínio da vida; é uma **medição do
corpo**. Ele pertence à mesma família de Coração e Corpo, que também emprestam cor (`saude` e
`casa`, respectivamente) e também não são módulos. Promover Sono a módulo seria dar status de
domínio a uma métrica porque ela ganhou tela própria — e ter tela própria não é o que define
um módulo.

**Guarda-corpo.** Enquanto Sono e Água não aparecerem juntos no mesmo gráfico, eles serem a
mesma cor não custa nada. Verificado em 04/09/2026: não coocorrem em lugar nenhum — nem na
Recuperação (que plota sono, VFC e FC de repouso), nem na Retrospectiva, nem no Hoje. **No dia
em que um gráfico plotar os dois na mesma área, esta decisão reabre.**

## Alternativas rejeitadas

**Papel novo (`indigo`) para Sono.** Seis hex, um por paleta, passando no piso de ΔE 3,5
contra os outros dez em quatro esquemas. É factível e é barato de escrever — mas caro de
errar, e resolve com cor um problema que era de taxonomia. Além disso contraria a escolha
explícita do usuário pelo azul, que é a associação óbvia (lua, noite) e a que o app já usa.

**Mover Água para outro papel e dar `blue` a Sono.** Não há papel livre: os onze são
`orange`, `red`, `rose`, `purple`, `blue`, `teal`, `green`, `yellow`, `brown`, `deep` e `ink`,
com `deep` reservado à marca. Mover Água exigiria criar um papel novo para ela — o mesmo custo
da alternativa anterior, com a desvantagem de mexer num módulo que já existe e já é conhecido.

**Afrouxar o piso de ΔE ou isentar o par `sono × agua`.** O teste de distinção entre módulos é
uma das três barreiras que a arquitetura do tema cobra. Uma isenção pontual é como esses pisos
morrem: a exceção seguinte cita esta.

## Consequências

**Custo:** Sono e Água pintam idêntico. Enquanto não coocorrerem num gráfico, o custo é zero;
quando coocorrerem, é uma ambiguidade real e a decisão reabre.

**Custo de reverter:** baixo, e é justamente por isso que a decisão é segura. Promover Sono a
módulo depois exige criar um papel novo (seis hex + o teste de ΔE) e trocar as duas chamadas
de `moduleOf('agua')` que hoje pintam sono — `health-metrics.ts:53` e `recuperacao/index.tsx:36`
— mais o que a tela `/sono` acrescentar. Nada disso é estrutural.

**Efeito colateral bom:** as categorias de Saúde ficam coerentes entre si. Todas emprestam cor
de um módulo, e nenhuma delas é módulo. Antes desta ADR isso era um acidente do
`health-metrics.ts`; agora é uma regra escrita.
