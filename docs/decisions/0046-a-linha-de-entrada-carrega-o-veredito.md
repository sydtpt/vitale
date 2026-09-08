# ADR 0046 — A linha de entrada carrega o veredito, e é ela que satisfaz a paridade

- **Status:** aceita
- **Data:** 08/09/2026
- **Contexto:** Revista da Retrospectiva · CAP-12 · a página da lua
- **Supersede em parte:** [0045](0045-o-resultado-negativo-publica-com-o-mesmo-destaque.md),
  **cláusula 3**, e **só** ela. As cláusulas 1, 2 e 4 da 0045 continuam valendo intactas.
- **Relacionada:** [0044](0044-o-cruzamento-so-fala-quando-as-duas-colunas-concordam.md),
  [0040](0040-o-provedor-de-modelo-e-configuracao-nao-arquitetura.md)
- **Numeração:** 0046 conferida em 08/09/2026 contra `main` e contra todas as branches
  locais e remotas — nenhuma reserva. A 0045 pediu essa conferência por escrito, e ela foi
  feita: a colisão já aconteceu duas vezes neste repositório.

## Contexto

A ADR 0045 fixou que o resultado negativo do teste lunar publica com o mesmo destaque do
positivo. A cláusula 3 diz, literalmente:

> *"**Sem atenuação visual.** O negativo não vai em cinza, em itálico apologético, em corpo
> menor, **atrás de um toque**, nem acompanhado de ícone de aviso."*

Em 08/09/2026 a passagem de UX pôs a página da lua **atrás de um toque** — sub-página em tela
própria, aberta por uma linha no pé do caderno Sono. A tensão foi apresentada ao dono com a
cláusula citada na mão, e ele **manteve a sub-página**.

Ficou registrado ali mesmo que mitigação não revoga cláusula, e que a regra da casa é
**quem derruba uma lei, derruba declarando**. Esta ADR é essa declaração. A 0045 não é
editada — ela é imutável, como toda ADR deste repositório.

## Decisão

**A página da lua pode ficar atrás de um toque, com uma condição, e a condição é substantiva:
a linha de entrada carrega o veredito por extenso.**

A cláusula 3 da 0045 passa a ler-se assim: o negativo não vai em cinza, em itálico
apologético, em corpo menor, nem acompanhado de ícone de aviso — e **pode** ficar atrás de um
toque **enquanto** a linha que leva até ele satisfizer as três exigências abaixo. Nenhuma
delas é opcional; a falha de qualquer uma restaura a proibição original por inteiro.

1. **A linha nomeia o veredito, não o assunto.** *"Faltam cerca de 106 noites para o teste
   ter poder"* é linha de entrada; *"Ver o teste lunar"* não é. Quem nunca tocar tem que ter
   lido o resultado.
2. **A linha é idêntica nos três vereditos** em papel tipográfico e em tratamento — mesmo
   corpo, mesma família, mesma cor, mesma posição no pé do caderno Sono, e o mesmo número de
   linhas no tipo dinâmico padrão. Não existe versão curta para quando não deu nada.
3. **O quarto estado entra junto.** Antes dos três vereditos existe *o teste ainda não
   rodou*, que é o estado em que a página passa a maior parte do tempo. Ele também tem linha
   de entrada, com as mesmas três exigências.

## Por que isto não é a 0045 enfraquecida

A cláusula 3 lista cinco formas de atenuação, e quatro delas — cinza, itálico, corpo menor,
ícone de aviso — atenuam **sozinhas**, independentemente do que mais exista na tela. A
quinta, *atrás de um toque*, é diferente em espécie: ela atenua **por privação**. Um toque a
mais só esconde o resultado se quem não der o toque ficar sem ele.

A linha de entrada elimina a privação. O leitor que nunca tocar lê exatamente a mesma coisa
que o leitor que tocar leria na primeira frase da página. O toque deixa de ser a fronteira
entre saber e não saber, e passa a ser a fronteira entre o veredito e o **método** — a
moldura de cinco campos, o desenho, os portões, a covariável.

O que a 0045 cobra, dito no seu próprio texto de contexto, é **paridade entre negativo e
positivo**: que a ausência de achado não seja indistinguível de "ainda não rodou", e que a
revista não fabrique interesse mencionando a lua só quando ela correlaciona. Profundidade de
navegação nunca foi o alvo — foi um dos meios listados, e é o único dos cinco cuja nocividade
depende de outra coisa na tela.

E a paridade sai **fortalecida** num ponto: sob a 0045 sozinha, a moldura ficava inline no
caderno Sono, competindo por espaço com o resto dele. Com a página própria, os três vereditos
ganham a mesma tela inteira — a paridade deixa de depender de quanto espaço sobrou.

## Consequências

**A favor.** O caderno Sono não carrega uma ficha técnica de cinco campos em toda edição,
inclusive nas dezenas em que o veredito não mudou. A moldura ganha uma tela onde a altura
cresce com o texto — que é o que a acessibilidade exige, porque caixa fixa corta o veredito
no tipo dinâmico grande, e quem lê em AX3 é exatamente quem tem baixa visão.

**Contra, e aceito.** Existe agora um caminho pelo qual esta ADR pode ser esvaziada sem que
ninguém perceba: basta a linha de entrada encolher para *"Teste lunar ›"* numa refatoração
qualquer. **Isso revoga a permissão**, não a condição — e a página volta a ter que ser inline.
Quem encurtar a linha está derrubando esta ADR, e vale a mesma regra: derruba declarando.

**O que fica sem cobrança mecânica.** As três exigências são de conteúdo e de tratamento, não
de contraste — o `theme.test.ts` mede cor, e nenhuma barreira do repositório sabe ler se uma
frase nomeia um veredito. Esta é a raridade: uma lei desta casa que depende de leitura humana.
Ela fica declarada aqui em vez de fingir que um teste a sustenta.

## Alternativas rejeitadas

- **Manter a página inline no caderno Sono**, obedecendo a 0045 §3 ao pé da letra. Rejeitada
  por decisão do dono em 08/09/2026, com a cláusula citada literalmente na frente dele.
- **Editar a cláusula 3 da 0045.** Proibida: ADR é numerada e append-only, e mudar de ideia
  escreve outra que a supersede. O registro de decisão que envelhece como documento vivo
  deixa de ser registro.
- **Declarar que a sub-página nunca contrariou a 0045.** Seria a leitura conveniente, e é
  falsa — a cláusula nomeia *atrás de um toque* explicitamente. Ler uma lei como se ela não
  dissesse o que diz é pior que revogá-la, porque não deixa rastro.
- **Uma quinta exigência: um selo na linha dizendo que há mais atrás dela.** Rejeitada como
  ruído. Se a linha carrega o veredito, ela já cumpriu o trabalho; um "ver mais" é o ícone de
  aviso da cláusula 3 com outra roupa.
