# 0055 — A morte de uma métrica é medida contra o ritmo dela, e precisa de testemunha

**Status:** aceita
**Data:** 2026-09-23
**Complementa:** [0054](0054-ausencia-tem-dois-criterios-ato-e-medicao.md) (a outra face da ausência: o que
**nunca** foi registrado), [0036](0036-saude-do-sono-e-contagem-nao-placar.md) (os limiares saem da
distribuição do próprio usuário) e [0049](0049-o-motor-escreve-palavras-e-o-codigo-escreve-numeros.md)
(o código escreve os números)
**Story:** 2.7 do Épico 2 da Revista — [spec](../../_bmad-output/implementation-artifacts/spec-2-7-o-detector-de-metrica-morta.md)

## Contexto

A revista sabe receber, conferir, narrar, ranquear e desenhar a lápide desde as stories 1.7 e 1.12 —
e **ninguém a produz**. `entrada.lapides` chega vazia da tela e da impressão, então a lápide é
invisível no aparelho e a edição impressa sai sem ela.

O preço está medido. Em 07/09/2026, sobre a `health_daily` de produção, quatro métricas têm última
medida no passado e não voltaram: **respiração 10/07/2026, VO₂max 14/07/2026, SpO₂ 16/07/2026 e anéis
17/08/2026**. As três primeiras morrem numa janela de seis dias, o que aponta causa comum — relógio,
permissão do HealthKit ou o Foco de Sono. Nenhuma tela do Orbe avisou, e a revista narra esse silêncio
como calmaria: *"sua respiração está estável"* quando não há respiração há dois meses.

O mesmo acervo tem três casos que qualquer detector ingênuo erra:

1. **A VFC caiu na mesma janela e voltou.** Ela parou no Apple Watch em 17/07/2026 e voltou pelo
   intervals.icu (ADR 0026). A fonte mudou; a métrica não morreu.
2. **O peso tem uma linha na vida inteira** (16/07/2026), e oito métricas que o app pede ao HealthKit
   nunca receberam dado nenhum. O cano existe, a fonte é que está vazia — e o que nunca viveu não
   morre.
3. **Há um período em que uma família inteira de sensores calou**, de 11/07 a 16/09/2025. Um detector
   que só olhasse dias de silêncio declararia todas elas mortas de uma vez.

E as grandezas não têm o mesmo ritmo. O VO₂max só é estimado em treino ao ar livre e cala semanas
inteiras sem nada de errado; a FC de repouso chega toda noite, e duas semanas mudas nela já são
notícia. Um limiar único mente nos dois sentidos.

### A medição de 23/09/2026, e o que ela corrigiu no raciocínio

A cadeia inteira foi rodada com o SQL de verdade contra o banco, e o resultado alimentado em
`lapidesDoAcervo`. Ela declara exatamente as quatro, e nada mais; o peso fica de fora pelas dez
medidas. Isso fecha o risco de a emulação do SQL nos testes ter divergido da função.

Ela também **desmentiu a justificativa que esta decisão tinha em rascunho** para a segunda condição.
Em **11/07–16/09/2025** — 68 dias — a contagem de **dias com valor** por métrica foi: VFC 62, SpO₂
62, respiração 40, sono 37, FC de repouso 24. Do outro lado, a família de atividade teve **um único
dia** cada: passos 1, distância 1, andares 1, exercício 1, vo2max 1, energia 3. Ou seja, os sensores
fisiológicos seguiram trabalhando quase todo dia e quem emudeceu foi só a atividade — e, portanto, `outra_chegou` é
**verdadeira em todos os silêncios deste acervo**, inclusive naquele. Ela **não** distingue "uma
família de sensores parou" de "a métrica morreu" — e, pelo dado, essas duas coisas são o mesmo
evento.

O que a segunda condição de fato protege é o caso **catastrófico**: o sync quebrar por inteiro
(troca de telefone, permissão revogada), quando **nada** chega e sem ela a edição sairia com lápide
em todas as métricas de uma vez. Ela fica, com essa justificativa no lugar da antiga.

E foi a medição que fixou o piso. O risco real que sobra não é lápide tardia: é **lápide falsa por
pausa curta**. Sono, VFC, SpO₂ e respiração têm recorde próprio de **15 a 17 dias**, então com piso
de 14 bastariam vinte dias de interrupção — uma viagem, um relógio no conserto — para as quatro serem
declaradas mortas de uma vez.

## Decisão

**Uma função no banco devolve fatos; o núcleo aplica quatro regras.** A fronteira é essa: a função
responde *"quando foi a primeira e a última medida de cada métrica, quantas houve, quais foram os
silêncios e se o aparelho continuou gravando durante cada um"*. Quem decide o que é morte é código
puro (`packages/shared/src/period/lapides.ts`), onde a regra tem teste barato e mudá-la não pede
migração.

As quatro regras, decididas pelo dono em 23/09/2026:

1. **Uma métrica morre quando o silêncio corrente passa do maior silêncio próprio de que ela voltou**,
   com **piso de 30 dias**, **e** outra métrica chegou naquele intervalo.

   **As duas metades protegem coisas diferentes, e não a mesma.** O **recorde próprio** é quem faz o
   trabalho no caso comum — a família de sensores que para —, porque a régua é a própria métrica: o
   recorde dela é o que ela já provou conseguir atravessar. A **testemunha** não ajuda ali (a medição
   acima mostra que ela é verdadeira naquele silêncio também); o que ela barra é o **blecaute**, em
   que nada chega.

   **O piso é 30, e não 14**, pela medição acima: com 14, uma pausa de vinte dias mataria sono, VFC,
   SpO₂ e respiração de uma vez. Com 30 a pausa curta não vira lápide, e as quatro mortes de hoje
   continuam declaradas — a mais apertada é a dos anéis, com 37 dias. O preço é ver a morte cerca de
   duas semanas mais tarde, e a latência já o acomoda (ver Consequências). O número é **parâmetro**
   nos dois lados — o da função e o da regra —, para poder ser movido com um teste em vez de uma
   migração.
2. **A lápide é do período da última medida.** Agosto/2026 é o mês em que os anéis pararam, e o
   trimestre e o ano que o contêm; setembro não é. Quem separa isso já existe desde a 1.7
   (`lapideDoPeriodo`), e é a mesma régua na tela e na impressão.
3. **A morte antiga é repassada por doze meses**, ou até a métrica voltar.
4. **Métrica com menos de dez medidas na vida nunca ganha lápide.**

E três invariantes que sustentam as quatro:

- **A regra olha a métrica, nunca a fonte.** O detector não sabe quem gravou a linha, e é assim que a
  VFC escapa: ela voltou a chegar, e isso basta.
- **Nenhum veredito é persistido.** O backfill reescreve até 500 dias e o `updated_at` é reescrito a
  cada sync; tudo se recalcula a cada leitura. É também o que torna a mudança de régua barata: não há
  arquivo de vereditos para corrigir.
- **A leitura é aditiva e a falha dela é lápide nenhuma.** Banco sem a função, rede fora do ar,
  hospedeiro que não a conhece — a edição sai exatamente como saía antes desta decisão, e o prompt não
  muda um byte com lista vazia.

### O que as regras dão sobre o acervo

Exatamente as quatro mortes, e nenhuma outra: a VFC voltou, o peso nunca foi série, e a família que
calou em 2025 voltou a chegar — o recorde próprio de cada uma dela subiu junto, e nenhuma foi
declarada morta por causa dela.

O caso mais apertado é o dos **anéis**, e é ele que fixa a forma da regra. Eles pararam em 17/08/2026,
o mais tarde dos quatro: em 23/09/2026 são 37 dias de silêncio, contra os 69 da SpO₂ e os 75 da
respiração. Um limiar fixo teria de caber entre esses 37 dias e o maior buraco que cada métrica já
atravessou sem nada de errado — e não há folga confortável entre os dois. O recorde próprio resolve
por métrica o que um número só não resolve para todas: cada uma é medida contra o que ela mesma já
provou conseguir atravessar.

## Alternativas rejeitadas

- **Um limiar fixo de dias de silêncio** (30, 45, 60). É o desenho de uma linha, e a medição mostra
  que ela não existe: teria de ficar acima do maior buraco que cada métrica já atravessou e abaixo
  dos 37 dias dos anéis, ao mesmo tempo. O ritmo próprio de cada grandeza é o que separa os dois
  casos — a mesma lição da ADR 0036, onde os limiares de continuidade do sono saem da distribuição
  do usuário. (O piso de 30 **não** é esse limiar: ele é um mínimo absoluto, que age *junto* com o
  recorde e nunca no lugar dele.)
- **Exigir que a maioria do acervo tenha seguido viva** durante o silêncio, em vez de "qualquer outra
  métrica". Parece a correção natural depois de descobrir que a testemunha não vê família parando, e
  falha pela assimetria do acervo: protegeria julho de 2025 (5 de 13 métricas chegando, minoria) e
  **não** protegeria o espelho — os quatro sensores de pulso parando enquanto a atividade segue —,
  porque há mais métricas de atividade que de pulso. Uma regra que só funciona numa das direções é
  pior que a simples, porque dá a impressão de cobrir as duas.
- **Só a primeira condição, sem a testemunha.** Barata, e errada no dia em que o telefone for trocado
  ou a permissão revogada: o acervo inteiro para junto, o recorde próprio de cada métrica é superado
  ao mesmo tempo, e a revista abre com quatro lápides de uma vez — narrando como morte o que é um
  cano cortado. Esse caso **nunca aconteceu neste acervo**, e é justamente por isso que ele precisa
  de uma condição explícita: não há dado histórico que o pegue.
- **Olhar a fonte** (`extra.source`), para declarar morta a métrica que parou numa fonte. Mataria a
  VFC, que é justamente o contraexemplo: ela parou no Apple Watch e voltou pelo intervals.icu. A
  pergunta da revista é "o dado chegou?", não "quem o trouxe".
- **Decidir a morte no banco.** A função já percorre as linhas, e devolver `morta: true` pareceria
  mais direto. Mas então cada ajuste de régua vira migração, o teste da regra vira teste de SQL que
  nenhum CI roda (não há Postgres no portão), e o número passa a viver longe do lugar onde a edição é
  montada. Fatos no banco, juízo no núcleo.
- **Ler o acervo inteiro no cliente e decidir lá.** Medido: cinco idas à rede e ~200 KB **hoje**, em
  toda abertura da Retrospectiva e em toda impressão, crescendo uma ida a cada 43 dias — e pago a cada
  leitura, porque nada pode ser persistido. A função devolve uma linha por métrica, pouco mais de
  vinte hoje, alguns KB. **Não é tamanho fixo**: o `jsonb` de cada linha carrega todos os silêncios
  da vida daquela métrica, então ele cresce devagar, com o número de silêncios acima do piso — e não
  com o tamanho do acervo, que é a diferença que importa.
- **Persistir o veredito** numa tabela de mortes. Congelaria a resposta num acervo que se reescreve
  sozinho: uma métrica declarada morta na véspera de um backfill de 500 dias continuaria morta na
  tela depois de o backfill a ressuscitar.
- **Repassar a morte para sempre.** Toda edição futura de Movimento e de Coração fecharia com
  *"saturação de oxigênio — última medida em 16 de julho de 2026"*, em parágrafo próprio pela FORMA, e
  isso valeria em 2028. O argumento que a 1.7 usou contra a lápide que lidera para sempre — *"depois
  da terceira o leitor para de ver"* — vale igual para a do pé.
- **Alertar em vez de narrar** (*"verifique suas conexões"*). Conselho está proibido na revista, e o
  alerta operacional é de Conexões, que tem o tempo do agora. A edição congela: em 2030 a de
  agosto/2026 ainda dirá que os anéis pararam, o que como história está certo e como alerta seria
  ruído.

## Consequências

- **O passo 5 do ranqueamento deixa de ser ramo morto.** A lápide do período força o caderno dela à
  frente da edição, e isso está escrito desde a 1.7 sem nunca ter acontecido. O gabarito do contrato
  da edição mudou por isso: a ordem de maio na fixture passou de `rotina, movimento, sono` para
  `movimento, rotina, sono`.
- **A latência cresceu com o piso, e a regra 2 a acomoda.** Com 30 dias a morte é vista cerca de duas
  semanas mais tarde do que seria com 14. Isso não move a lápide de lugar: ela é do período da
  **última medida**, então a reimpressão daquele mês a põe no topo do mês certo. O que a latência
  custa é a edição impressa **no fechamento** não ver a morte recente — e a edição seguinte a recebe
  como antiga, no pé do caderno, pelos doze meses do repasse.
- **Reimprimir um mês antigo pode dar outro texto.** A lápide depende do relógio de quem imprime (o
  prazo de doze meses) e do acervo de hoje (uma métrica que voltou perde a lápide). Isso é a mesma
  propriedade que a revista já tem — a edição congela no que foi impresso —, agora com uma entrada a
  mais.
- **O silêncio corrente é medido até hoje, pelo relógio do banco** (`current_date`, em UTC). O app usa
  data local em todo o resto (`localDateStr`), e a diferença é de no máximo um dia sobre um piso de
  trinta. Fechá-lo no fim do acervo, em vez de hoje, tornaria a testemunha vazia por construção —
  haveria sempre outra métrica no último dia do intervalo.
- **A migração é do dono, e é aditiva.** `stable`, sem mudança de schema e sem índice novo, então
  nenhum app instalado quebra e não há janela acoplada a build. O índice existente
  `(user_id, metric, day desc)` serve à **agregação** por métrica; ele **não** serve ao `exists` da
  testemunha, que filtra `metric <> ...` numa faixa de dia — esse ramo varre a partição do usuário.
  Fica assim de propósito: são poucas dezenas de silêncios acima do piso, sobre um acervo pessoal de
  alguns milhares de linhas. Antes de a migração ser aplicada, a leitura falha, o log diz **uma vez
  por sessão** que a função ainda não existe, e a edição sai sem lápide.
- **O que esta decisão não cobre:** o veredito **visual** da lápide, que a 1.12 deixou pendente e que
  só o dono pode dar, no iPhone; e o caderno cujo único conteúdo seria a lápide **antiga**, que o
  núcleo calcula e a tela não lista (a regra do vazio da 1.3/1.7 diz que a lápide antiga não vence o
  vazio). Os dois estão no `deferred-work.md`.
