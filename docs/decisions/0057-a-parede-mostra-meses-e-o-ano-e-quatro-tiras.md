# 0057 — A parede mostra meses, o ano é quatro tiras, e o trimestre fica de fora

**Status:** aceita
**Data:** 2026-09-25
**Complementa:** [0038](0038-a-chamada-ao-modelo-sai-da-edge-function.md) e
[0040](0040-o-provedor-de-modelo-e-configuracao-nao-arquitetura.md) (a edição escrita por modelo),
[0037](0037-a-foto-e-ponteiro-com-chave-de-cura.md) (a foto é ponteiro, e por isso a capa carimba
valor) e [0018](0018-cor-de-modulo-deriva-de-papel-cromatico.md) (cor de módulo deriva de papel)
**Story:** 2.4b do Épico 2 da Revista —
[spec](../../_bmad-output/implementation-artifacts/spec-2-4b-a-parede-de-capas.md)

## Contexto

O arquivo tem **39 meses impressos** e uma porta só até eles: o cartão do período corrente na
Retrospectiva. Para ver junho de 2023 era preciso saber que ele existe e navegar até lá. Folhear não
existia.

A mesa tinha três grãos possíveis — semana, mês e trimestre —, mais o ano, que é outra coisa: desde a
Story 1.9 a edição existe para os quatro tipos de período, e todos têm capa carimbada em
`edicoes_capa`. A pergunta não era *o que cabe na tela*, era **o que a parede é para**.

O que ela é para está no mockup aprovado em 07/09/2026 (`key-arquivo.html`): *"a grade é uma parede
de capas, não um seletor de data"*. E o que ela tem a mostrar é uma coisa que nenhum texto do Épico 2
diz tão bem quanto as capas lado a lado: **a mudança de textura na fronteira dos anos**. A biblioteca
do iPhone só passa a alimentar a capa em 2026; antes disso o registro visual de um período é o
desenho da rota, ou a grade dos dias. *2023 tem que parecer 2023* — uma capa genérica ali apagaria o
fato e faria 2023 parecer 2026 com a foto faltando.

### A medição do acervo

- **antes de 2025**: 6 meses com capa de foto contra **13 sem**;
- **do outro lado da fronteira**: 19 de 20 meses com foto (spec da 2.4b: 13 dos 21 meses até
  mar/2025 sem foto, contra 19 de 20 depois);
- **trimestres**: 4 de 6 com capa de foto.

O trimestre é o número que decide sozinho. Com 4 de 6 já com foto, **ele não tem textura para
mostrar** — a fronteira que a parede existe para revelar já passou por cima dele. Ele custaria
fileira e não pagaria em informação nenhuma.

A semana cai por outro motivo, de volume: são 52 por ano contra 12 meses, e uma parede em que 81% dos
ladrilhos são semanas afoga exatamente os doze que carregam a textura — volta a ser a lista de datas
que a tese recusa.

O ano é o caso oposto: ele tem o que dizer e **não tem capa que o diga**. `cadernos.md` já o tinha
resolvido, em 2026-09-07: *"O anuário não tem capa. As quatro tiras são a capa do ano."*

## Decisão

**1. O ladrilho da parede é o mês.** É o grão em que a capa existe, em que a textura muda e em que o
dono reconhece o período pela imagem.

**2. O ano entra como as quatro tiras do anuário**, no lugar onde os meses têm duas colunas — uma
tira por caderno, doze células, lendo a `metrica_lider` **carimbada** de cada mês daquele ano.
Ler, e nunca recalcular: recalcular seria inventar um ranqueamento novo a cada abertura, e a edição
impressa deixaria de concordar com a tira que a anuncia.

**3. O trimestre e a semana não têm ladrilho.** Eles continuam impressos, continuam com capa
carimbada e continuam abrindo pela rota `/revista/[tipo]/[inicio]`. O que eles não têm é lugar na
parede.

**4. A parede só lê.** Período fechado que ninguém imprimiu **não aparece** — nem como convite, nem
como lacuna. O ato pago mora na rota da edição, na página que o explica (decisão 4-a de 16/09, Story
1.11).

## Alternativas rejeitadas

- **Um seletor de grão na própria parede** (semana / mês / trimestre). É o calendário voltando pela
  porta dos fundos: um controle no topo transforma a parede num filtro de datas, e a tese do mockup
  é explicitamente a recusa disso. Também multiplicaria por três o custo de toda leitura em lote.
- **O trimestre como ladrilho, para "completar" o arquivo.** 4 de 6 já têm foto: ele não mostra a
  fronteira, e o que ele acrescenta é volume. Completude não é o objetivo da parede — reconhecimento é.
- **A semana como ladrilho.** 52 por ano contra 12. O mês já é o grão em que a textura se lê.
- **O ano como uma capa, igual aos meses.** `edicoes_capa` tem capa para o ano, então isto era o
  caminho de menor esforço. Mas o ano não tem *uma* imagem: ele tem doze formas, e `cadernos.md`
  já tinha decidido que as tiras são a capa dele. Uma capa de ano seria a foto de um mês passando por
  representante dos outros onze.
- **A tira medindo a magnitude do fato líder.** É o que `cadernos.md` prometia (ver a seção
  *Estreitamento* de lá). Impossível sem recalcular: `metrica_lider` guarda **qual** fato liderou, e
  nunca **quanto** ele mediu. Recalcular é proibido pela decisão 2 acima.
- **A parede convidando a imprimir o mês que falta.** Poria o ato pago no meio de uma lista de
  miniaturas — exatamente o que a 1.11 tirou do cartão da Retrospectiva.

## Consequências

- **O arquivo fica navegável, e a textura vira o assunto da tela** sem que ninguém escreva uma linha
  a respeito. É o que a story existia para entregar.
- **A parede mostra menos do que o arquivo tem.** Um dono que imprima só semanas vê uma parede vazia
  com edições no banco — por isso a tela distingue *nada impresso* de *nada que a parede desenhe*
  (`motivoDoVazio`), com frases diferentes. Sem essa distinção, a primeira frase mentiria.
- **A tira diz identidade, não grandeza.** O leitor vê em que meses cada caderno saiu, quais foram
  liderados e onde o líder trocou — não quanto cada um mediu. O custo está declarado em `cadernos.md`.
- **A ausência na tira é separada por forma, não por cor.** Medição: `tint` contra `line` fica abaixo
  de ΔE 10 nas **144** combinações de tema × esquema × paleta × caderno, e abaixo de 3 em 49 delas —
  pior par 1,2. Um tri-estado por cor seria um bi-estado com uma promessa a mais. O `theme.test.ts`
  trava o par que a cor **pode** carregar (`accent` × `tint`, pior caso ΔE 21,8) e sinaliza se um dia
  a medição mudar.
- **Reverter é barato de um lado e caro do outro.** Acrescentar o trimestre é uma linha na constante
  do recorte (`recortarAcervo`), que os ponteiros já leem junto — e é por isso que o recorte é um só,
  com teste comparativo. Tirar as tiras, por outro lado, deixaria o ano sem representação nenhuma na
  parede, já que ele não tem capa por decisão anterior.
