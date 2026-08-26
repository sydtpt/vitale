# 0018 — Cor de módulo deriva de papel cromático, e o limite passa a ser medido

**Status:** aceita · supersede [0017](0017-mod-esgota-a-paleta-quente-na-nona-cor.md)
**Data:** 2026-08-26

## Contexto

A [0017](0017-mod-esgota-a-paleta-quente-na-nona-cor.md) registrou que `MOD` — o map
`tint`/`accent` por módulo — esgotava as faixas cromáticas na nona entrada, e criou um
portão: **do décimo módulo em diante, sem trocar de estratégia, não entra cor nova.**

O portão funcionou. Ele foi encontrado ao acrescentar `saude` como décimo módulo, no
trabalho que introduziu o sistema de temas com quatro eixos. E a estratégia de fato mudou,
que é a condição que a 0017 exigia.

O que mudou, e por que isso desfaz a restrição que a 0017 descreveu:

**Cor deixou de ser hex escolhido à mão.** Cada paleta declara **papéis** — `orange`,
`blue`, `green`, `yellow`, `rose`, `brown`, `teal`, `purple`, `red`, `deep`, `ink` — e um
módulo aponta para um papel (`MODULE_ROLE`). O `tint` não é mais autorado: sai de
`softOf(accent, esquema)`, em OKLab. O `MOD` que sobrou é o recorte histórico daquele
mapeamento, derivado, não escrito.

**O limite deixou de ser julgado e passou a ser medido.** A 0017 dizia, corretamente, que
a escassez não era de hex mas de *faixas que continuam distinguíveis quando duas séries
aparecem lado a lado*. Aquilo era avaliado por conversa. Agora `theme.test.ts` calcula
`deltaE` entre todos os pares de módulos, em toda paleta, e reprova abaixo do piso — foi
assim que a paleta `bruma` reprovou na primeira tentativa, com treino×saúde a 3,0.

**A faixa cromática deixou de ser única.** A 0017 raciocinava sobre *a* paleta quente do
Orbe, onde só sobrava roxo. Hoje são seis paletas, e cada uma redistribui os papéis por
chroma e luminosidade. "Que faixa está livre" não é mais pergunta com uma resposta: é
pergunta por paleta, respondida pelo teste.

## Decisão

**`MOD` não recebe mais cor; recebe papel.** Um módulo novo declara em `MODULE_ROLE` para
qual papel cromático aponta, e todas as paletas o servem automaticamente.

**O portão da 0017 continua existindo, mas mudou de forma.** Ele deixa de ser um ADR e
passa a ser o teste de separação: um módulo novo entra se — e só se — `theme.test.ts`
continuar passando em todas as paletas. O teste é o portão, e ele é mais rigoroso que a
conversa que substituiu, porque mede as seis em vez de discutir uma.

`saude` (papel `red`) entra como décima entrada sob essa regra.

## Alternativas rejeitadas

**Manter o portão como ADR por módulo.** Era o que a 0017 previa. Perdeu porque o portão
existia para forçar uma discussão que a derivação agora resolve com um número: quando o
critério é computável e verificado a cada build, exigir um documento por cor troca uma
garantia forte por uma cerimônia.

**Um papel novo por módulo novo.** Manteria a identidade cromática individual que a 0017
protegia. Perdeu porque é a mesma escassez com outro nome — onze papéis já é o que o olho
separa com folga, e o décimo segundo reencontraria o problema. Compartilhar papel entre
módulos que não aparecem no mesmo gráfico é a saída barata, e já é o que
`ACTIVITY_ROLE` faz com dezessete tipos de treino sobre oito papéis.

**Paleta separada para análise**, a terceira saída que a 0017 listava e chamava de "a que
resolve a causa, e a mais cara". Perdeu por ter deixado de ser necessária: a unificação da
paleta de gráficos com a do app pôs as séries e os módulos no mesmo vocabulário de papéis,
com a separação medida nos dois usos. A causa foi resolvida por outro caminho, mais barato.

## Consequências

- Módulo novo é uma linha em `MODULE_ROLE`, não um hex em seis paletas.
- O teto passa a ser **quantos papéis o olho separa**, e quem responde é
  `theme.test.ts`, não uma conversa. Paleta ou módulo que reprove não entra.
- A promessa da 0017 de que "as oito cores existentes ficam como estão" foi mantida
  literalmente: `resolveTokens('orbe','light','orbe')` devolve os hex históricos, com teste
  que trava isso. Uma exceção deliberada — `compras` vestia o `tint` do laranja com acento
  rosa, copiar-colar antigo que a derivação corrigiu.
- **O portão foi atravessado antes de ser escrito.** `saude` entrou e a estratégia mudou
  registrada apenas num comentário em `tokens.ts`; este ADR chega depois do fato. Vale
  anotar como o modo de falha do portão: ele avisa quem lê a ADR, e não quem escreve o
  código — quem estava mexendo em `MODULE_ROLE` não passou por `0017`.
