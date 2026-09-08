# Epic 1 Context: A edição

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

O dono abre um mês fechado no iPhone e lê **a revista** — capa, sumário e os cadernos na
ordem que o dado escolheu, com cada número dizendo contra o quê está sendo comparado. E ela
congela: reaberta seis semanas depois, devolve exatamente o mesmo texto e a mesma ordem,
mesmo que a função que os produziu tenha mudado.

Hoje a Retrospectiva imprime **um** parágrafo seco por período fechado — não porque o prompt
seja ruim, mas porque o pacote de fatos é magro: a camada que narra recebe `{ resumo, agora }`
e nada mais. Atrás dela há um balde de dado já pago, já gravado e invisível para a narrativa.
Este épico troca o parágrafo único por uma edição composta de cadernos independentes, cada um
com sua assinatura, sua verificação e sua posição.

As stories 1.1 a 1.8 **não produzem tela**: o núcleo é puro e a primeira coisa visível aparece
na 1.11. Aceito de propósito — antecipar a tela para vê-la mudar três vezes contradiz a forma
constante que a frente promete.

## Stories

- Story 1.1: `AGG_VERSION` vira vocabulário do núcleo
- Story 1.2: `onAccent` no sistema de tema
- Story 1.3: O pacote fala por caderno, com bases nomeadas
- Story 1.4: O texto é obrigado a nomear a base
- Story 1.5: O prompt aprende as regras novas
- Story 1.6: A camada de luz entra nos quatro pacotes
- Story 1.7: O ranqueamento do miolo e a lápide
- Story 1.8: A chamada sai de uma função só
- Story 1.9: A migração e a leitura da forma nova
- Story 1.10: A sequência da impressão sobe para o núcleo
- Story 1.11: A rota da revista, e os estados da edição
- Story 1.12: Os cadernos desenhados
- Story 1.13: A capa na edição, com o véu medido
- Story 1.14: O sumário e a rolagem ancorada
- Story 1.15: O piloto de três edições

## Requirements & Constraints

**É um jornal: informa, não aconselha.** Não recomenda, não motiva, não parabeniza. Escolher
qual fato lidera é jornalismo; dizer o que fazer com ele não é.

**Estatística acha; o modelo prioriza e narra.** Nunca calcula, nunca deriva número que não
recebeu pronto, nunca afirma causa. Todo número citado existe no pacote, por verificação
mecânica e numérica exata. Cobertura desigual obriga ressalva no texto.

**Período fechado congela.** Dado que muda vira errata, não reescrita. A ordem congela na
**última** impressão: reabrir nunca reordena, e só um ato explícito de reimprimir reordena.

**A revista nunca gera sozinha.** Abrir só lê; imprimir é ato do usuário — senão folhear seis
meses dispara seis chamadas pagas. Nenhum caminho de leitura escreve.

**Verifica antes de gravar**, sempre, em qualquer hospedeiro.

**Mais números autorizados enfraquecem a verificação.** Medido no pacote real de agosto: 71
valores, dos quais 16 são inteiros entre 0 e 100 — um inteiro alucinado nessa faixa passa a
conferência **16%** das vezes com uma base só; com uma casa decimal, **3,6%**. Quem
acrescentar número ao pacote tem que dizer como compensa.

**Mobile-first.** Web, PDF e e-mail são não-objetivos declarados — nenhuma superfície de
browser nesta frente.

**Um bump de `AGG_VERSION` marca errata em todas as edições.** É global e isso está certo: se
a agregação mudou, toda edição anterior é potencialmente velha. O custo é declarado.

## Technical Decisions

**Fronteira pelo conjunto de imports.** O que é puro sobe para `packages/shared`; API de
plataforma fica no adaptador. O núcleo de IA proíbe import não-relativo, `fetch`/XHR/WebSocket,
leitura de ambiente e nome de fornecedor — **inclusive em literal de string**. Barreiras vivem
em `architecture.test.ts` e `theme.test.ts`, rodam offline, e entram no mesmo commit da regra
que cobram.

**Dono único do vocabulário.** Cada conceito tem um dono só no núcleo. `CadernoId`
(`sono`/`movimento`/`coracao`/`rotina`) nasce lá; `RetroBlockId` não é alargado, porque um
caderno herdaria `order`, `kinds` e `fixed` — e `order` é a ordem do leitor que o
ranqueamento aposentou.

**A edição é uma linha por caderno.** Chave `(user_id, tipo_periodo, inicio, fim, caderno)`.
A ordem é **coluna, não array** — com a chave por caderno, um array com a ordem do conjunto
guardado em cada parte é uma chance de divergir por linha.

**A posição é constraint deferida e a ordem é recalculada no banco.** O `unique` da posição
nasce `deferrable initially deferred` — sem isso a permutação é ilegal em qualquer formulação.
Uma função no banco recebe os cadernos que a edição passa a ter, grava o texto só dos
regenerados, ajusta as posições de todos e **apaga** a linha do caderno que saiu. Isso elimina
o read-modify-write do cliente, o lost update entre dois hospedeiros, e a reassinatura dos
cadernos que a reimpressão não regenerou. Posições contíguas de 1 a N sobre os cadernos que a
edição tem — que raramente são quatro.

**A escrita é do conjunto inteiro, numa chamada.** Mostrar é progressivo; gravar é atômico.
Gravar caderno a caderno em laço é proibido: daria posição 1, depois 1 e 2, recalculando a
ordem de um conjunto ainda em crescimento. É o caminho natural de quem implementa, e por isso
está dito.

**O que congela guarda valor, não ponteiro a re-derivar.** Vale para a capa (a escolha e a
legenda já formatada) e para a chave da métrica que liderou o ranqueamento. Um ponteiro
re-derivado depois lê um estado que já andou.

**A sequência da impressão é do núcleo, com três portas injetadas** — narrar, ler e gravar —,
nunca um cliente de banco. Cada hospedeiro liga as portas ao que tem. `upsertEdicao` passa a
ser importável só pela sequência, por barreira: "verifica antes de gravar" deixa de ser
promessa em comentário.

**A migração e o build que a lê são uma operação só.** Instância de banco única, sem OTA: o
caminho de leitura atual casa uma linha por período, e quando o caderno entrar na chave ele
passa a casar até quatro. Dentro da migração, as sete edições em produção saem **antes** de as
colunas obrigatórias nascerem.

**`AGG_VERSION` sobe para o núcleo com dono único.** Hoje é const privada de um módulo do
mobile, a gravação recebe nulo, e a comparação de errata devolve falso para nulo — nenhuma
edição em produção é elegível a errata. Sem consertar antes, o arquivo inteiro nasce
inelegível e o conserto vira backfill do backfill.

**Sol e lua são derivados na leitura, nunca gravados** — o que os torna retroativos de graça.
A coordenada é **constante do núcleo**, nunca a do aparelho: os dois hospedeiros podem estar
em fusos diferentes e precisam produzir a mesma edição verificada. A luz entra no pacote com
uma casa decimal, como compensação medida da regra do alfabeto.

**Ausência tem gramática.** `null` é "não foi medido"; zero é uma medida — com uma exceção
nomeada, a versão de agregação, que deixa de aceitar ausência. Caderno vazio some; métrica
morta vira lápide e lidera só na edição do período em que morreu; base inexistente entra no
pacote como fato. **A lápide vence o vazio.**

## UX & Interaction Patterns

A edição vive em **rota própria**, onde a capa não disputa o topo com o seletor de período; a
Retrospectiva atual não perde nada e vira a porta de entrada.

**A ordem do miolo é variável**, então o leitor não pode reconhecer a seção pela posição —
reconhece pela cara. Cada caderno abre com faixa sangrada na cor do módulo, e **a cor não é o
único portador da identidade**: dois dos quatro cadernos medem separação insuficiente em cinco
das seis paletas, e é o ícone que os separa — resolvendo daltonismo no mesmo gesto. Isso exige
um primeiro plano legível sobre cor saturada, que o sistema de tema ainda não tem.

**Sete estados por caderno**, não por edição: período em curso (mostra **nada** — não é botão
desabilitado nem aviso, é ausência), fechado e não escrito, escrevendo, pronta, reprovada na
conferência (que diz **por quê** — não é erro do app, é a conferência funcionando), errata
(que declara e não reescreve), erro.

**O sumário é a única navegação**, e mostra a chamada de cada caderno, não o nome. Alvo de
toque de linha inteira; a rolagem é ancorada e **move o foco do leitor de tela junto**.

**Três famílias com papéis fixos:** serifada é o que a máquina escreveu e passou pela
conferência, mono é o que ela mediu, sans é o cromo. Número dentro de frase fica na serifada
da frase. Informação obrigatória nunca usa a tinta mais fraca. Nenhum hex escrito em tela.

**Nenhum gesto horizontal, nenhum compartilhar, nenhum tooltip** em lugar nenhum da revista.

## Cross-Story Dependencies

- **1.1 precede tudo**, inclusive o piloto da 1.15: uma edição impressa antes do conserto
  nasce inelegível a errata.
- **1.3 → 1.4 → 1.5**: as bases nomeadas existem antes de a regra que as cobra existir, e a
  regra existe antes de o prompt mandar obedecê-la.
- **1.7 → 1.9**: a ordem precisa ser calculável antes de a coluna que a congela nascer.
- **1.9 → 1.10, 1.11, 1.13**: a forma nova no banco precede a sequência que grava nela, a tela
  que a lê e a capa carimbada.
- **1.2 → 1.12**: o primeiro plano sobre cor saturada precede a faixa que o usa.
- **1.8 → 1.14**: a extração da chamada precede o sumário que a consome.
- **1.15 depende de todas** e é **portão humano** — nenhum agente a conclui.
- **Para fora:** a chave da métrica líder é gravada aqui desde a primeira impressão, mas só o
  anuário do Épico 3 a lê; o Épico 2 imprime o arquivo inteiro sobre o que a 1.15 validar.
