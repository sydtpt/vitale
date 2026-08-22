# 0017 — O map `MOD` esgota a paleta quente na nona cor

**Status:** aceita
**Data:** 2026-08-22

## Contexto

`MOD`, em `packages/shared/src/constants/tokens.ts`, dá a cada módulo do app um par
`tint`/`accent`. Web e mobile leem os dois do mesmo lugar, então a cor de um módulo é
definida uma vez e vale nas duas plataformas. Até hoje eram oito chaves:

| Chave | `accent` | Faixa |
|---|---|---|
| `treino` | `#F25C2B` | Laranja |
| `food` | `#F5B946` | Amarelo |
| `agua` | `#6E8CC9` | Azul |
| `habito` | `#6FA86A` | Verde |
| `casa` | `#B4825B` | Marrom |
| `compras` | `#E26A8A` | Rosa |
| `financas` | `#1F1B16` | Tinta |
| `tarefa` | `#4F9D90` | Teal |

O módulo Cultura ([spec](../specs/cultura/spec.md)) precisa
da nona. Ao escolhê-la, ficou visível que **roxo era a única faixa cromática ainda livre**
dentro da paleta quente e orgânica do Orbe. Não é escassez de hex: é escassez de faixas
que continuam distinguíveis quando duas séries aparecem lado a lado num gráfico.

O uso que aperta não é o ícone da tela do módulo — ali qualquer cor serve, porque só há
uma na tela. É a **análise agregada**: heatmap da Semana, gráficos de Retrospectiva e
Recap, onde várias séries de módulos diferentes dividem o mesmo eixo. Duas faixas
vizinhas ali deixam de ser dois módulos e viram um borrão.

A escolha foi feita para Cultura sem que a restrição estivesse escrita em lugar nenhum.
O décimo módulo vai reencontrá-la sem contexto.

## Decisão

Registrar que **`cultura` (`accent: #8B6BB1`, `tint: #EBE3F3`) é a última entrada que a
estratégia atual de cor comporta.** As nove chaves esgotam as faixas cromáticas mutuamente
distinguíveis dentro da paleta quente.

Do décimo módulo em diante, `MOD` não recebe cor nova sem antes trocar de estratégia.
As saídas conhecidas, nenhuma escolhida agora:

- **Dois eixos por módulo** — cor por *domínio* (saúde, casa, dinheiro, cultura) e forma
  ou ícone por módulo dentro do domínio. Distingue sem exigir faixa nova, ao custo de o
  módulo deixar de ter identidade cromática própria.
- **Variação de luminosidade dentro da faixa** — dois roxos, um claro e um escuro.
  Barato, mas devolve o problema do borrão exatamente na superfície que motivou este ADR.
- **Paleta separada para análise** — `MOD` segue sendo identidade de módulo, e os gráficos
  passam a usar uma escala categórica própria, dimensionada para N séries. É a saída que
  resolve a causa, e a mais cara.

## Alternativas rejeitadas

**Escolher o nono hex e seguir sem registrar nada.** Era o caminho de menor esforço e o
que quase aconteceu: a cor de Cultura foi decidida numa conversa, pelo argumento "roxo é
o que sobrou", sem que "o que sobrou" estivesse escrito. Perdeu porque a restrição é
invisível no código — nada em `tokens.ts` sugere que o map está cheio, e o décimo módulo
descobriria isso do zero.

**Sair da paleta quente para achar a décima faixa.** Ciano, magenta e verde-limão estão
livres justamente por estarem fora do sistema. Perdeu porque a paleta quente e orgânica é
identidade do Orbe, não acidente — e uma faixa fria isolada leria como erro, não como
módulo novo.

**Trocar a estratégia de cor agora, junto com Cultura.** Adotar já a paleta separada para
análise resolveria a causa em vez de registrá-la. Perdeu por sequenciamento: acoplaria uma
mudança transversal, que toca todos os gráficos existentes, a uma feature que ainda não
tem uma linha escrita. O ADR é o portão que garante a discussão acontecer antes do décimo
módulo — que é cedo o suficiente, e mais barato.

## Consequências

- Adicionar módulo com cor nova passa a exigir ADR que supersede este, não um hex a mais
  no map. É o portão que faz a discussão acontecer antes do décimo módulo, e não durante.
- `ModuleKey` continua sendo o tipo que enumera os módulos coloridos; nada no código muda
  hoje além da nona entrada.
- Módulos futuros podem existir sem entrada em `MOD`, reusando a cor de um domínio. Isso
  já é verdade tecnicamente e passa a ser a saída preferida enquanto a estratégia não muda.
- Este ADR não retroage: as oito cores existentes ficam como estão.
