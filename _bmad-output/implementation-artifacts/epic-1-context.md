# Epic 1 Context: A edição

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

O dono abre um mês fechado no iPhone e lê **a revista** — capa, sumário e os cadernos na ordem
que o dado escolheu, com cada número dizendo contra o quê está sendo comparado. E ela congela:
reaberta seis semanas depois devolve o mesmo texto e a mesma ordem, mesmo que a função que os
produziu tenha mudado. Antes desta frente a Retrospectiva imprimia **um** parágrafo seco por
período — não por prompt ruim, mas porque a camada que narra recebia `{ resumo, agora }` e nada
mais, com um balde de dado já pago invisível para a narrativa. O épico troca o parágrafo único
por uma edição composta de cadernos independentes, cada um com sua assinatura, sua verificação e
sua posição.

As stories 1.1 a 1.8 **não produzem tela** — o núcleo é puro e a primeira coisa visível aparece
na 1.11. Aceito de propósito: antecipar a tela para vê-la mudar três vezes contradiz a forma
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
- Story 1.10: A sequência da impressão sobe para o núcleo, como cliente do orquestrador
- Story 1.11: A rota da revista, e os estados da edição
- Story 1.12: Os cadernos desenhados
- Story 1.13: A capa na edição, com o véu medido
- Story 1.14: O sumário e a rolagem ancorada
- Story 1.16: A capa aberta, e a troca *(ordem: depois da 1.14, antes da 1.15)*
- Story 1.15: O piloto de três edições *(portão humano — nenhum agente a conclui)*

Da 1.1 à 1.13 está na `main`. A próxima a construir é a **1.14**.

## Requirements & Constraints

**É um jornal: informa, não aconselha.** Não recomenda, não motiva, não parabeniza. Escolher qual
fato lidera é jornalismo; dizer o que fazer com ele não é.

**Estatística acha; o modelo prioriza e narra.** Nunca calcula, nunca deriva número que não
recebeu pronto, nunca afirma causa. Todo número citado existe no pacote, por verificação mecânica
e numérica exata, e toda base comparada é **nomeada** (B1 período anterior, B2 mesmo período do
ano anterior, B3 a normal dele; trajetória é direção, nunca valor bruto). Cobertura desigual
obriga ressalva no texto.

**Período fechado congela.** Dado que muda vira errata, não reescrita. A ordem congela na
**última** impressão: reabrir nunca reordena, e só um ato explícito de reimprimir reordena.

**A revista nunca gera sozinha.** Abrir só lê; imprimir é ato do usuário — senão folhear seis
meses dispara seis chamadas pagas. Nenhum caminho de leitura escreve. **Verifica antes de
gravar**, sempre, em qualquer hospedeiro.

**Mais números autorizados enfraquecem a verificação.** Medido no pacote real: um inteiro
alucinado entre 0 e 100 passa a conferência 16% das vezes; com uma casa decimal, 3,6%. Quem
acrescentar número ao pacote tem que dizer como compensa.

**Mobile-first.** Web, PDF e e-mail são não-objetivos declarados — nenhuma superfície de browser
nesta frente.

## Technical Decisions

**Fronteira pelo conjunto de imports.** O que é puro sobe para `packages/shared`; API de
plataforma fica no adaptador. O núcleo de IA proíbe import não-relativo, `fetch`/XHR/WebSocket,
leitura de ambiente e nome de fornecedor — **inclusive em literal de string**. Barreiras vivem em
`architecture.test.ts` e `theme.test.ts`, rodam offline, e entram no mesmo commit da regra que
cobram.

**Dono único do vocabulário.** `CadernoId` (`sono`/`movimento`/`coracao`/`rotina`) nasce no
núcleo; `RetroBlockId` não é alargado, porque um caderno herdaria `order`, `kinds` e `fixed` — e
`order` é a ordem do leitor que o ranqueamento aposentou. O mesmo molde vale para listas de CHECK
novas (a da 1.16, por exemplo): dono único no núcleo, com barreira.

**A edição é uma linha por caderno**, chave `(user_id, tipo_periodo, inicio, fim, caderno)`. A
ordem é **coluna, não array**, com `unique` de posição `deferrable initially deferred`, e é
recalculada por uma função no banco — porta única que grava o texto só dos regenerados, ajusta as
posições de todos e apaga a linha do caderno que saiu. Elimina o read-modify-write do cliente e a
reassinatura dos cadernos que a reimpressão não regenerou. **Gravar é do conjunto inteiro, numa
chamada**; gravar caderno a caderno em laço é proibido, mesmo sendo o caminho natural de quem
implementa. Mostrar, esse sim, é progressivo.

**O que congela guarda valor, não ponteiro a re-derivar** — vale para a capa (a escolha, o motivo
e a legenda já formatada) e para a chave da métrica que liderou. Um ponteiro re-derivado depois lê
um estado que já andou.

**A sequência da impressão é do núcleo e é cliente do orquestrador dos motores.** Chama o
orquestrador uma vez por caderno, com o descritor da retrospectiva, e recebe só duas portas —
`buscar` e `gravar` —, nunca um cliente de banco. Só resposta de motor grava, e piso é ausência.

**Migração e build que a lê são uma operação só** (há OTA, mas o JS novo publicado antes da
migração quebra do outro lado). O épico carrega **duas** janelas de migração: a da 1.9, já
aplicada, e a da 1.16, que acrescenta colunas a `edicoes_capa`.

**Ausência tem gramática.** `null` é "não foi medido"; zero é uma medida — com uma exceção
nomeada, a versão de agregação, que deixa de aceitar ausência. Caderno vazio some; métrica morta
vira lápide e lidera só na edição do período em que morreu; base inexistente entra no pacote como
fato. **A lápide vence o vazio.**

**Sol e lua são derivados na leitura, nunca gravados** — retroativos de graça. A coordenada é
**constante do núcleo**, nunca a do aparelho: os dois hospedeiros podem estar em fusos diferentes
e precisam produzir a mesma edição verificada.

**A chamada sai de uma função pura única**, consumida por porta, sumário e capa — e "primeiro
ponto final" não é `indexOf('.')`, porque o milhar em pt-BR usa ponto. Sem texto, a chamada **não
existe**: quem a consome trata ausência, nunca string vazia. Três limites que as telas herdam: ela
não tem teto de tamanho, reticência não tem resposta (`…` junta duas frases; `...` seguido de
minúscula corta uma no meio), e **Markdown sai cru**, porque nenhuma tela da revista o interpreta.

**Foco de acessibilidade é do adaptador**, nunca do núcleo: `AccessibilityInfo.sendAccessibilityEvent(ref, 'focus')`,
nunca `setAccessibilityFocus` (deprecado na doc atual) e nunca `findNodeHandle`. Mora num hook
**genérico** em `mobile/src/hooks/` — *rolar até uma âncora e mover o foco junto* —, porque a
revista não é a última tela a querer isso.

## UX & Interaction Patterns

**A edição vive em rota própria** (`/revista/[tipo]/[inicio]`), onde a capa não disputa o topo com
o seletor de período; a Retrospectiva não perde nada e vira a porta de entrada, com miniatura da
capa ao lado da chamada. Período em curso e Total não têm rota de revista. "Escrever a edição" só
existe na rota — o ato pago nunca acontece no meio da lista de cartões.

**A ordem do miolo é variável**, então o leitor não reconhece a seção pela posição — reconhece
pela cara: faixa sangrada de 56 px no `accent` do módulo, nome em `onAccent` e **ícone** como
segundo portador da identidade (dois dos quatro cadernos medem separação insuficiente em cinco das
seis paletas; o ícone resolve isso e o daltonismo no mesmo gesto).

**Sete estados por caderno**, não por edição: período em curso (mostra **nada** — é ausência, não
botão desabilitado), fechado e não escrito, escrevendo, pronta, reprovada na conferência (que diz
**por quê**), errata (que declara e não reescreve), erro. Seis causas permanentes oferecem
"Escrever este caderno de novo"; só as duas passageiras oferecem "Tentar de novo". A reprovação
vive uma sessão e não sobrevive ao relançamento do app.

**O sumário é a única navegação**, e mostra a **chamada** de cada caderno, não o nome, na ordem
impressa. Alvo de toque de linha inteira, mínimo 44 px; toque rola com âncora até a faixa do
caderno, na mesma página, sem navegação e sem entrada na pilha — e **move o foco do leitor de tela
junto**, senão a única navegação da revista fica inerte no VoiceOver. Em estado misto a linha
**permanece**, com o nome e sem chamada: sumir seria mentir por omissão, e esperar o sumário ficar
completo esconderia os cadernos que deram certo por causa de um que falhou. O sumário existe
sempre, mesmo com um caderno — 22 das 39 edições mensais do arquivo têm um caderno só. A capa
repete a chamada da primeira linha, e isso é **forma, não defeito**: a capa é identidade do
período, a linha é o alvo de toque.

**A chamada aparece inteira, sempre** — sem corte e sem "…". As primeiras frases reais medem 104 a
148 caracteres (até cinco linhas no sumário), e cortar esconderia o fim da frase, onde costuma
estar a base contra a qual o número compara. Chamada longa demais se conserta no prompt, não na
tela.

**Três famílias com papéis fixos:** serifada é o que a máquina escreveu e passou pela conferência
(texto de caderno, chamada, manchete de capa), mono é o que ela mediu (números expostos como dado,
legenda, assinatura), sans é o cromo (nome de caderno, rótulo, lápide de pé). Número dentro de
frase fica na serifada da frase. Informação obrigatória nunca usa `ink3` (2,87 sobre `bg`) —
assinatura e rótulos vão em `ink2`. Nenhum hex escrito em tela: cor sai de `moduleOf()` e
`resolveTokens()`.

**Nenhum gesto horizontal, nenhum compartilhar, nenhum hover/tooltip** em lugar nenhum da revista.

*Achados da revisão de acessibilidade ainda não convertidos em critério, que tocam o sumário:*
esconder a manchete da capa da fila de leitura quando a linha 1 carrega a mesma string; e honrar
**Reduzir Movimento** (rolagem ancorada instantânea) e **Reduzir Transparência** (véu chapado no
lugar do gradiente).

## Cross-Story Dependencies

- **1.1 precede tudo**, inclusive o piloto da 1.15: edição impressa antes do conserto nasce
  inelegível a errata.
- **1.3 → 1.4 → 1.5**: as bases nomeadas existem antes da regra que as cobra, e a regra antes de o
  prompt mandar obedecê-la. **1.7 → 1.9**: a ordem precisa ser calculável antes de a coluna que a
  congela nascer. **1.2 → 1.12**: o primeiro plano sobre cor saturada precede a faixa que o usa.
- **1.9 → 1.10, 1.11, 1.13**: a forma nova no banco precede a sequência que grava nela, a tela que
  a lê e a capa carimbada.
- **Épico 5 (5.1, 5.2, 5.4 no marco A, 5.5) → 1.10**: a porta, o orquestrador e o descritor
  existem antes de a impressão depender deles. A 5.5 chegou primeiro e `mobile/src/lib/motores/`
  já existe — a 1.10 **acrescenta ali, não recria**; ver
  [contrato-motores-para-1-10.md](contrato-motores-para-1-10.md).
- **1.8 → 1.11 e 1.14**: a extração da chamada precede a porta e o sumário que a consomem.
- **1.14 → 1.16**: as duas mexem na mesma tela da edição; fazer a capa aberta antes do sumário
  custaria duas costuras no mesmo arquivo. **1.16 → 1.15**: chegar ao piloto sem poder trocar a
  capa ruim desperdiça o julgamento das três capas.
- **1.15 depende de todas** e é portão humano. Carrega uma medida: nas três edições do piloto,
  anotar toda chamada com número de comparação **sem a base dentro dela** — zero mantém a
  aceitação já assinada; uma ou mais põe o conserto antes de o Épico 2 imprimir o arquivo inteiro.
- **Para fora:** a chave da métrica líder é gravada aqui desde a primeira impressão, mas só o
  anuário do Épico 3 a lê; o Épico 2 imprime o arquivo inteiro sobre o que a 1.15 validar.
