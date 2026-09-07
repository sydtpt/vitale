# ADR 0045 — O resultado negativo publica com o mesmo destaque do positivo

- **Status:** aceita
- **Data:** 07/09/2026
- **Contexto:** Revista da Retrospectiva · CAP-12 · a página da lua
- **Relacionada:** [0044](0044-o-cruzamento-so-fala-quando-as-duas-colunas-concordam.md)
  (o cruzamento só fala quando as duas colunas concordam),
  [0040](0040-o-provedor-de-modelo-e-configuracao-nao-arquitetura.md) (o provedor é
  configuração), [0036](0036-saude-do-sono-e-contagem-nao-placar.md) (contagem, não placar)
- **Numeração:** 0045 conferida contra `main` e contra todas as branches locais e remotas
  em 07/09/2026 — nenhuma reserva. A colisão já aconteceu duas vezes neste repositório
  (ver `adr-numero-colide-entre-branches`); quem abrir branch longa a partir daqui
  confere de novo antes de gravar 0046.

## Contexto

A revista vai testar se há relação entre a fase da lua e o sono. O pedido é do dono, e
ele veio com uma frase que muda o desenho:

> *"Achar padrões entre fases da lua (caso haja). Pessoalmente, estou me observando nisso
> já faz um tempo."*

**Há um prior declarado.** Um sistema que procura o que o dono já acredita encontra — e a
aritmética piora: lua × 14 métricas de saúde já são 14 testes; com hábitos e registros
passa de 30. A 5%, o acaso entrega "achado", e a camada que narra imprime esse achado com
a mesma tipografia de um fato medido.

O campo tem exatamente esse problema, documentado. O paper que tentou replicar o efeito
lunar em mais de 23 mil noites se chama, literalmente, *"Lunar cycle effects on sleep and
**the file drawer problem**"* — e relata múltiplos resultados nulos **não publicados**. A
literatura de lua × sono é contestada em parte porque o negativo nunca saiu da gaveta.

Um app pessoal tem a mesma gaveta, com uma agravante: aqui o autor do teste, o sujeito do
teste e o leitor do resultado **são a mesma pessoa**. Nenhum revisor externo vai perguntar
quantas vezes o teste rodou.

O pré-registro (`docs/specs/revista-retrospectiva/pre-registro-lua.md`) fixa desfecho,
janela, direção e limiar antes de olhar. Mas pré-registro sozinho não basta: ele impede
escolher a pergunta depois da resposta, e **não** impede publicar só quando a resposta
agrada.

## Decisão

**Um resultado negativo é publicado com o mesmo destaque tipográfico, a mesma posição e o
mesmo espaço de um resultado positivo.**

Quatro consequências operacionais, todas verificáveis:

1. **A moldura é fixa, o veredito é variável.** A página imprime sempre os mesmos campos
   — janela testada, desfecho, contagem de noites e de ciclos, próxima leitura — e só o
   bloco do resultado muda. Não há variante "curta" da página para quando não deu nada.

2. **São três vereditos, não dois.**
   - **achado** — efeito ≥ limiar prático, significante, com poder ≥ 80%;
   - **nenhum padrão** — não significante **com poder ≥ 80%**;
   - **inconclusivo** — poder < 80% ou portão reprovado; imprime **quantas noites faltam**.

   "Nenhum padrão" e "inconclusivo" **não são a mesma coisa**. Um teste com poder que não
   acha nada é informação. Um teste sem poder que não acha nada é silêncio, e imprimi-lo
   como "nenhum padrão" seria mentir com o mesmo tom de voz.

3. **Sem atenuação visual.** O negativo não vai em cinza, em itálico apologético, em corpo
   menor, atrás de um toque, nem acompanhado de ícone de aviso. Tipografia de caderno de
   laboratório.

4. **O contador de execuções é visível na página.** Não se impede o dono de reexecutar —
   é o banco dele, o repositório dele e o dado dele, e qualquer catraca cai em dois
   minutos. O que se faz é **tornar cada tentativa permanente e contável**: cada execução
   grava linha com o hash do pré-registro que a autorizou, nunca substitui, e a página diz
   *"6ª execução"* se foram seis.

## Consequências

**A favor.** O resultado mais provável da primeira execução é *inconclusivo* — pelo
cálculo de poder feito antes de olhar, o dono precisaria de 396 a 1.101 noites conforme a
dispersão, e tem 290. Sem esta ADR, uma página que só existisse quando houvesse achado
tornaria a ausência de página **indistinguível de "ainda não rodou"**, e a primeira coisa
que a revista publicasse sobre a lua seria, mais cedo ou mais tarde, um falso positivo.

**Contra, e aceito.** A revista vai gastar uma página inteira para dizer "não sei ainda",
possivelmente por anos. É espaço pago com conteúdo negativo, num produto cujo objetivo
declarado é ser relido.

**O ganho colateral que justifica o custo:** essa página é a única da revista que declara
a própria metodologia na cara. Ela ensina, numa página só, que este app distingue *medir*
de *achar* — e isso contamina a leitura do resto no bom sentido.

**A lei que ela estende.** O brief da revista já declarava *"é um jornal: informa, não
aconselha"*. Esta ADR acrescenta o outro lado: **informar inclui informar que não há o que
informar.** Uma revista que só menciona a lua quando ela correlaciona não está informando
— está fabricando.

## Alternativas rejeitadas

- **Publicar só o achado.** É a gaveta, com outro nome. Rejeitada pelo motivo que a
  literatura documenta.
- **Publicar o negativo em nota de rodapé.** Atenuação visual é a gaveta em versão
  educada: depois da segunda edição o leitor para de ver.
- **Impedir a reexecução por catraca.** Impossível de garantir e desonesto de prometer —
  o dono tem acesso a tudo. Visibilidade contável é mais forte que proibição fingida.
- **Um caderno de lua.** Rejeitada em 07/09: o teste roda a cada 100 noites, e um caderno
  que aparece uma vez por ano e repete a mesma frase cria **pressão para ter o que dizer**
  — que é exatamente o mecanismo que produz o problema da gaveta. A lua é uma **página
  dentro do caderno Sono**.
