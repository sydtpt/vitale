# ADR 0042 — O passe de nome roda no aparelho, porque o núcleo não cabe no Deno

**Data:** 2026-09-07 · **Status:** aceita

**Complementa:** [0041](0041-o-nome-da-rota-e-molde-com-lacuna.md), corrigindo o **onde** de uma
frase da invariante 1 — *"passe no ingest, no molde do `enrichCities`"*. O **o quê** daquela
ADR segue inteiro de pé.

## Contexto

A 0041 foi escrita antes de alguém abrir a `ia-narrar`. Ao começar a Fase 3, a primeira
leitura da function existente desmentiu a premissa.

O docblock dela é explícito sobre o desenho, e sobre o motivo:

> *"Ela não monta o pacote de fatos, não escreve o prompt e não confere a resposta. Tudo isso
> é derivação pura e mora em `packages/shared/src/ia/`, onde roda no aparelho... Duplicar essa
> lógica aqui criaria duas implementações da mesma conta, e é assim que a manchete passa a
> divergir da tela que o usuário está olhando."*

E há uma restrição mecânica por baixo da estilística. Uma barreira do `architecture.test.ts`
cobra que **todo módulo do núcleo importado por uma edge function não tenha import nenhum** —
o Deno não resolve specifier sem extensão, e o deploy quebra longe de onde o erro nasceu.

Os cinco módulos de `packages/shared/src/routes/` importam: `./types`, `../geo/distance`,
`../gear/assign`. **Nenhum é importável pelo Deno como está.**

Então a versão da 0041 custaria uma de duas coisas: duplicar em Deno as ~500 linhas testadas
de âncora, forma, molde e conferência; ou achatar `routes/` em módulos sem import, com os
tipos copiados arquivo a arquivo. As duas produzem a divergência que o docblock nomeia.

### O que o `enrichCities` prova, e o que não prova

O passe de cidades roda no servidor, e isso parecia precedente. Não é: ele precisa de rede
para o Nominatim e de quase nenhuma lógica de núcleo. O nome de rota é o inverso — precisa de
muito núcleo e a rede é só a chamada ao modelo, que já tem casa.

Os precedentes de verdade são dois, e apontam para o mesmo lado: a **narração da
Retrospectiva** (núcleo no aparelho, function burra) e a **varredura de fotos** da ADR 0037,
que roda uma vez por pedalada quando o dono abre o detalhe.

## Decisão

**A orquestração do nome roda no aparelho; o servidor continua guardando só a chave.**

1. O aparelho lê as âncoras de `places`, deriva a leitura com `lerRota`, monta o prompt com
   `montarPromptDeNome` e chama a `ia-narrar`.
2. A `ia-narrar` segue burra: recebe `{ sistema, usuario, json }`, devolve texto e uso.
   Nada de novo sobre nome de rota entra nela — se entrasse, ela deixaria de ser burra.
3. O aparelho lê a resposta, confere com `verificarNome`, monta a frase com `montarNome` e
   grava `route_name` e `route_name_meta`.
4. **Quando:** ao abrir o detalhe de uma pedalada sem nome, uma vez por pedalada — o mesmo
   gatilho e o mesmo teto da varredura de fotos. O backfill das 138 é uma rodada do mesmo
   caminho, também do aparelho.

O que **não** muda da 0041: a chamada continua saindo da edge function (ADR 0038), o provedor
continua sendo configuração (ADR 0040), o nome continua **gravado** e não derivado na leitura,
o cursor continua sendo `route_name is null`, e recusar continua sendo resultado válido.

### A costura ganha um campo, e só um

`Prompt` passa a ter `json?: boolean`. É **intenção, não formato de fio**: o adaptador é quem
sabe que no provedor atual isso vira `responseMimeType`. Sem esse campo o modelo devolve o
objeto embrulhado em prosa ou em cerca de código, e a leitura passa a depender de heurística
de texto — que é fragilidade gratuita quando a API oferece a garantia.

## Alternativas rejeitadas

**Duplicar o núcleo em Deno.** É o custo que a 0041 existe para não pagar, e o docblock da
`ia-narrar` já o nomeou antes de nós. Duas implementações da forma de rota divergem no dia em
que alguém mexer num limiar — e o sintoma seria o nome do cartão discordando da tela.

**Achatar `routes/` em módulos sem import.** Passaria na barreira e é pior: os tipos viram
cópia em cinco arquivos, o `haversineM` volta a ter cópia privada (o `geo/distance.ts` existe
justamente porque já havia duas), e o núcleo fica moldado pela limitação de um runtime que
nem é o principal consumidor.

**Nomear no servidor sem núcleo, mandando as cidades cruas ao modelo e pedindo a frase
pronta.** Elimina a duplicação eliminando a garantia: sem `montarNome` não há contração
conferida, e sem `verificarNome` não há como reprovar região inventada. Vira o desenho que a
0041 rejeitou na invariante 2.

## Consequências

**O que custa.** Uma pedalada nova só ganha nome quando o dono abre o detalhe dela. Para um
app de um usuário só, que abre o detalhe justamente para ver a pedalada, o atraso é invisível
— e é exatamente o contrato que a varredura de fotos já tem, aprovado em uso.

**O que compra.** Zero duplicação, e o núcleo continua testável sem rede: a orquestração
recebe a função que chama o modelo como **argumento**, então o caminho inteiro — prompt,
leitura, conferência, frase — roda nos testes com um chamador falso.

**O que fica em aberto.** Se um dia o nome precisar existir sem o app ser aberto (uma
notificação, um relatório por e-mail), a conta muda e esta ADR volta à mesa. Hoje não há esse
requisito.
