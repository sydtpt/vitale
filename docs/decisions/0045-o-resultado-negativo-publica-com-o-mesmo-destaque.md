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

---

## Emenda de 2026-10-01 — a página fica atrás de um toque, e o que satisfaz o §3 é a linha de entrada

**O §3 proíbe o negativo "atrás de um toque", e a página da lua está atrás de um toque.** A
decisão é do dono, tomada em 08/09/2026 com a cláusula na mão e mantida em 01/10. Regra da casa:
quem derruba uma lei, derruba declarando — e esta emenda é a declaração.

**O que satisfaz a regra anti-atenuação.** A **linha de entrada**, no pé do caderno Sono, carrega
o veredito **por extenso**. Quem nunca tocar lê o resultado assim mesmo. A emenda declara essa
garantia sobre a linha, e não sobre a página.

**A garantia vale para toda tupla que o protocolo possa produzir.** Desde 28/09 são quatro fases
em duas famílias, e o espaço pós-execução é de **81 combinações**, não três. A linha não carrega
três frases autoradas: ela carrega o texto que a **regra de composição** produz — quatro passos,
definidos em `EXPERIENCE.md` § *A regra de composição*, em
`_bmad-output/planning-artifacts/ux-designs/ux-revista-retrospectiva-2026-09-07/`. Dois
compartimentos por família, as duas famílias sempre presentes, nenhum compartimento desaparece,
e não há variante curta para quando não deu nada.

**O "corpo menor" do §3 é enfrentado, não contornado.** A linha de entrada é menor que a abertura
da página — 19/25 e 15/22 contra 24/29 e 17/24. Isso **não** é a atenuação que o §3 proíbe: a
paridade que ele cobra é entre o **negativo e o positivo**, e a linha é idêntica em tipografia e
extensão nos quatro estados. O que a cláusula impede é o negativo ser menor que o positivo no
mesmo lugar; ela não exige que uma superfície de entrada tenha o corpo da superfície que ela abre.
As outras três atenuações nomeadas no §3 não são invocadas: os rótulos obrigatórios são `ink2`
(contraste medido 7,52 sobre `surface` e 7,09 sobre `bg`), nunca `ink3` (2,87, abaixo até do piso
de objeto gráfico); não há itálico apologético; e a página **não tem ícone** nenhum.

**O que esta emenda NÃO afirma, e é a parte medida.** Ela não diz que a *página* entrega o
veredito na primeira tela. Medido em 01/10 a 390 × 844, com as fontes reais do app e no pior dos
quatro estados: a frase coletiva cabe inteira até a escala **1,45**, com **71 px de folga no
XXXL** — o maior corpo não-acessibilidade — e **quebra a partir de 1,5**, faltando 252 px no AX1
e 1.019 px no AX3. Nenhum arranjo de ordem fecha o AX3: dos 400 px acima da frase, 86 são SVG de
dimensão fixa.

A linha de entrada, por outro lado, **não tem dobra própria** — ela vive no pé do caderno Sono e
ninguém a lê sem rolar, em corpo nenhum — e é **íntegra em todas as escalas**: 141 px no padrão,
290 px no AX1, os dois compartimentos das duas famílias nos quatro estados. É por isso que a
garantia é declarada sobre ela. A tentativa de 08/09 declarava a mitigação sobre a página, e a
medição de 01/10 mostrou que ali ela seria falsa.

**Uma limitação fica declarada, com a mitigação ao lado.** No **AX3** a segunda linha de família
começa 216 px abaixo da dobra: a página não mostra, sem rolar, que existem **duas** famílias — o
efeito que o §11 do `pre-registro-lua-outras-fases.md` proíbe. É consequência do placar por
família, que entrou para obedecer ao §2 do mesmo documento, e não tem conserto de ordem. A
mitigação é a mesma desta emenda: a linha de entrada carrega as duas famílias em toda escala,
então o que o AX3 esconde na página, a linha mostra.

**O que não muda.** Os quatro parágrafos da Decisão seguem valendo palavra por palavra, inclusive
o §3 — esta emenda não o revoga, declara o que o satisfaz. A numeração, o status e as
alternativas rejeitadas ficam como estão.
