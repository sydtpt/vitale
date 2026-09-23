# 0054 — Ausência tem dois critérios: contagem de ato e medição passiva

**Status:** aceita
**Data:** 2026-09-23
**Complementa:** [0036](0036-saude-do-sono-e-contagem-nao-placar.md) (os limiares saem da distribuição do próprio usuário)
e [0049](0049-o-motor-escreve-palavras-e-o-codigo-escreve-numeros.md) (o código escreve os números)
**Story:** 2.6 do Épico 2 da Revista — [spec](../../_bmad-output/implementation-artifacts/spec-2-6-o-que-ainda-nao-era-registrado-nao-vira-zero.md)

## Contexto

"Ausência é fato, não silêncio" já estava escrito no pacote da revista desde a 1.3, e o canal existia:
`FatoNumero.atual = null` significa "não medido", e o alfabeto da conferência, o prompt, o `semDado` e
o `cadernoVazio` já o respeitavam. Mas um único `?? 0` na montagem dos fatos de contagem tornava a
regra inalcançável para onze grandezas — hábito, registro, tarefa, compra, gasto, passos, andares,
atividade, distância, tempo e esporte.

O piloto de três edições (story 1.15, 18/09/2026) mostrou o preço. Setembro de 2023 saiu impresso com
*"água, café, cerveja e smoke somaram 0 dias"* e *"passos por dia: 0"* — mas os hábitos nascem em
**20/05/2026** e o primeiro dia de saúde é **24/03/2025**. Não era zero: era ausência de medida, e a
edição a narrou como falta. A impressão em massa (story 2.3) espalharia isso por quase todas as
edições de 2023 a 2025.

A tentação é um critério só — "sem linha no período, não foi medido". Ele erra metade dos casos: um
hábito que existia e não foi marcado **é** zero, e esse zero é o dado mais honesto que a retro tem
sobre ele.

## Decisão

**Ausência tem dois critérios, e a natureza da grandeza decide qual vale.**

1. **Medição passiva** — saúde, passos, andares. Não há medida quando **nenhum dia do período carregou
   valor**. Dia sem linha é dia sem relógio, nunca "zero passos". É a régua que as métricas de saúde já
   seguiam; passos e andares passam a segui-la.

2. **Contagem de ato** — hábito, registro, tarefa, compra, atividade e esporte. Zero é medida legítima
   quando **o registro já existia** e o período passou sem ocorrência; é ausência quando o registro
   **ainda não existia**.

3. **O marco sai do dado, nunca do código.** A data de criação do hábito, do registro e da série de
   tarefa; a primeira atividade do acervo. Nenhuma data escrita em constante, e nenhuma leitura nova ao
   banco — tudo isso já chegava carregado. Marco que não é dia de calendário é "não se sabe", e não se
   sabe não vira alegação.

4. **A válvula é de mão única.** Ocorrência no período **anterior** prova que o registro existia, e
   então o lado atual também é medível. A recíproca é falsa: ocorrência agora não prova existência
   antes — é exatamente o caso que esta decisão conserta.

5. **A base anterior só esvazia quando o registro não existia de todo nela.** Nascido dentro do período
   anterior, o número real (menor) fica, e `comparavel: false` o marca. Apagar um número medido seria
   trocar uma mentira por outra.

## Alternativas rejeitadas

- **Um critério só: "sem linha no período, não foi medido".** É o desenho mais simples, e erra metade
  dos casos — apaga o zero do hábito que existia e não foi marcado, que é o dado mais honesto que a
  retro tem sobre ele. A própria story nomeia os dois lados ("zero continua sendo medida quando o
  registro já existia").
- **Uma data de corte em constante** (`HABITOS_DESDE = '2026-05-20'`). Custa uma linha e mente no dia
  em que o dono criar um hábito novo — e mente calada, porque nada no código relaciona a constante com
  a linha do banco.
- **Buscar o primeiro dia de cada métrica de saúde no banco.** Era o caminho que parecia necessário, e
  o desenho atual o dispensa: medição sem dia com valor já é ausência, e a pergunta "quando esta
  métrica nasceu?" só faz falta para a lápide (2.7). Teria custado uma consulta nova por métrica, ou
  uma função no Postgres com migração, para responder o que não era preciso perguntar.
- **Anunciar a ausência no prompt** ("esta métrica não foi medida neste período"). O fato nulo já
  desaparece da lista e do alfabeto, o que basta para o texto não a citar. Anunciar convidaria o modelo
  a narrar ausência de métrica — que é o assunto da lápide, com forma própria, e não desta decisão.
- **Zerar também a base anterior amputada** (o registro nascido dentro dela). Trocaria um número real,
  medido, por um vazio; e o desconto da comparação já existe, em `comparavel`, desde a 1.3.

## Consequências

- **A edição antiga encolhe para o que ela tem a dizer.** Movimento e Rotina, que nunca conseguiam
  ficar vazios porque sempre carregavam um `0`, passam a poder sumir pela regra do vazio que já existe.
  Em setembro de 2023 isso é o resultado certo: só havia atividades.
- **`PACOTE_VERSAO` foi a 4.** A forma do pacote mudou, então a versão do descritor mudou e o hash de
  todo pedido mudou com ela. O texto do prompt **não** mudou um byte — e isso deixou de ser prosa: o
  gabarito do contrato passa a guardar o hash do texto separado do hash do pedido.
- **A conferência fica mais estrita de graça.** Um fato sem valor não entra no alfabeto, então o modelo
  perde a licença de escrever "0 compras" — antes ele a tinha, e usava.
- **Nada lidera o caderno sem número.** O afastamento precisa de um valor atual, então um fato não
  medido nunca vira `metrica_lider`.
- **O que esta decisão não cobre:** a métrica que **parou** de chegar, que é a lápide (story 2.7); as
  bases externas B2 e B3, que ainda não recebem o veredito e hoje não têm produtor em produção; e as
  telas da Retrospectiva, que seguem mostrando o zero — elas não são a edição, e a edição é que
  congela. Os três estão no `deferred-work.md`.
- **O arquivo herda o defeito até ser reimpresso.** Toda edição gravada sob `PACOTE_VERSAO` 3 pode
  conter um zero falso. O dono decidiu em 23/09/2026 reimprimir setembro e outubro de 2023 na 2.3,
  exportando antes o texto atual das duas para `docs/specs/revista-retrospectiva/` — como se fez com as
  sete edições antigas na janela da 1.9. Se a lista cresce para além dessas duas, é decisão da 2.3.
