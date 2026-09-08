---
name: 'review-adversarial'
type: architecture-review
lens: adversarial
target: '../ARCHITECTURE-SPINE.md'
created: '2026-09-08'
method: 'duas unidades um nível abaixo, escritas por pessoas que nunca se falaram, ambas obedecendo cada AD à risca'
---

# Revisão adversarial — a espinha da revista

> **Método.** Para cada costura, construí **duas stories do épico** como se tivessem
> sido escritas por pessoas diferentes que nunca se falaram, cada uma obedecendo
> **cada AD à risca**, e procurei o estado incompatível que as duas produzem juntas.
> Não há aqui nenhuma crítica de gosto: toda entrada é um par concreto, com as
> unidades nomeadas, a AD que as duas citam como autoridade, e o estado resultante.
> Onde a acusação é verificável no código, ela vem com arquivo e linha.

## Veredito

A espinha é boa no que decidiu — e o que ela não decidiu está quase todo no **verbo**,
não no substantivo. Ela nomeia com precisão *onde as coisas moram* (tabela, módulo,
hospedeiro) e quase nunca *quem escreve, em que ordem, e o que acontece quando dois
escrevem*. Dezesseis pares passam por todas as ADs e ainda assim divergem; três deles
produzem corrupção silenciosa em produção, e um destrói exatamente a disciplina que a
capacidade mais cara do épico (CAP-12) existe para sustentar.

## Placar

| # | Par | Severidade |
|---|---|---|
| P1 | Carimbo da capa × verificação — a capa órfã | alta |
| P2 | Reimpressão parcial × backfill — lost update e assinatura falsificada | **crítica** |
| P3 | `AGG_VERSION` não tem dono — 436 edições que nunca aceitam errata | **crítica** |
| P4 | "as quatro linhas" × "caderno vazio some" | alta |
| P5 | O que é uma *execução* da lua? | **crítica** |
| P6 | `natureza` tem dois valores; o arquivo tem três casos | alta |
| P7 | Quem lê a manchete da parede? | alta |
| P8 | Caderno silenciado em `posicao = 1` | média |
| P9 | `CadernoId → ModuleKey` não tem dono | média |
| P10 | `periodoFechado` usa o relógio do hospedeiro | média |
| P11 | Reimpressão parcial sob `PACOTE_VERSAO` novo | alta |
| P12 | A credencial do terceiro hospedeiro | alta |
| P13 | A migration e o caminho de escrita têm que pousar juntos | média |
| P14 | `PRE_REGISTRO_LUA_SHA` — o executor não tem o arquivo | média |
| P15 | `resolveRetroPrefs` descarta na leitura; o store persiste o resolvido | média |
| P16 | `edicoes_capa` sem o CHECK que a AD-1 promete | baixa |

**Crítica 3 · alta 6 · média 6 · baixa 1.**

---

## P1 — Carimbo da capa × verificação: a capa órfã · **alta**

**S-CAPA — "a capa carimbada"** cria `edicoes_capa`, `data/edicoes-capa.ts` e o carimbo.
**S-IMPRESSAO — "imprimir a edição no iPhone"** monta, narra, verifica, grava.

**A AD que as duas obedecem:** AD-3 (*"carimbada na primeira impressão e nunca tocada
por reimpressão parcial"*) e AD-4 (*"toda impressão é um upsert das quatro linhas numa
chamada só"*).

**O estado incompatível.** AD-4 governa `edicoes_ia`; a capa é **outra tabela, outra
chamada, outra transação**. A espinha nunca diz onde a segunda chamada entra na
sequência, e as duas leituras são igualmente fiéis:

- S-CAPA lê *"na primeira impressão"* como **no início da impressão** — carimbar antes
  de narrar é o que torna a capa estável mesmo quando a narração é repetida por erro de
  rede. Grava `edicoes_capa`, depois pede o texto.
- S-IMPRESSAO lê a lei da casa — *"verifica antes de gravar", "não é uma edição ruim,
  não é uma edição"* — e carimba **depois** do upsert das quatro linhas.

Numa edição em que os quatro cadernos reprovam na quinta regra (CAP-5, base sem nome —
que é exatamente a regra nova, a menos exercitada, a que mais vai reprovar nas primeiras
semanas), o resultado de S-CAPA é uma **linha em `edicoes_capa` sem nenhuma linha
correspondente em `edicoes_ia`**. E como AD-3 diz que a parede *"pede uma linha por
edição"*, a parede de capas passa a exibir uma capa de agosto que não abre em lugar
nenhum — com legenda formatada, `Ittre · km 31,1 · 12:38`, e nenhum texto atrás.

Pior: a capa está agora carimbada. Quando a impressão for refeita e passar, AD-3 proíbe
tocá-la — a edição publicada herda a capa escolhida por uma tentativa que **nunca virou
edição**.

**Agravante estrutural.** O `erDiagram` da Structural Seed declara
`edicoes_ia ||--|| edicoes_capa : "uma capa por edição"`. Essa cardinalidade é
**indeclarável no banco**: a PK de `edicoes_ia` inclui `caderno`, então não há FK possível
de `edicoes_capa` para ela sem escolher um caderno arbitrário. O `||--||` é decoração — o
banco aceita capa sem edição e edição sem capa, e nenhuma das duas unidades tem motivo
para suspeitar disso lendo o diagrama.

**A costura.** AD nova: **a capa é carimbada na mesma passagem que grava o primeiro
texto aprovado, e nunca antes.** Impressão que não produz nenhuma linha em `edicoes_ia`
não produz capa. E a leitura da parede é `edicoes_capa ⋈ edicoes_ia`, nunca
`edicoes_capa` sozinha — ou o `||--||` do diagrama sai, porque promete o que o banco não
cobra.

---

## P2 — Reimpressão parcial × backfill concorrente · **crítica**

**S-IMPRESSAO — "reimprimir um caderno"** (CAP-7: *"reimprimir um caderno recalcula e
regrava a ordem do conjunto inteiro"*).
**S-BACKFILL — "imprimir o arquivo em massa"** (CAP-13, AD-12).

**A AD que as duas obedecem:** AD-4, palavra por palavra — *"toda impressão — inteira ou
parcial — é um `upsert` das quatro linhas numa chamada só"*.

**O estado incompatível.** AD-4 força a reimpressão parcial a escrever **quatro linhas**,
mas a unidade só produziu **um** texto novo. `edicoes_ia.texto` é
`not null check (length(trim(texto)) > 0)`
([`20260906150000_edicoes_ia.sql:26`](../../../../../supabase/migrations/20260906150000_edicoes_ia.sql)),
e `EdicaoInput` exige `provedor`, `modelo`, `promptVersao`, `pacoteVersao`,
`motivoDeParada`, `tokensEntrada`, `tokensSaida`
([`packages/shared/src/data/edicoes-ia.ts:85`](../../../../../packages/shared/src/data/edicoes-ia.ts)).
Ou seja: **a reimpressão parcial é obrigada a ler os outros três cadernos e escrevê-los de
volta**. Isso é um read-modify-write, e a espinha não declara nenhum controle de
concorrência sobre ele.

Duas consequências, as duas silenciosas:

1. **Lost update.** O backfill reimprime Sono de agosto às 14h03; o iPhone tinha lido a
   edição às 14h02 para reimprimir Rotina e escreve às 14h04. O texto novo de Sono é
   **revertido para o antigo**, sem erro, sem conflito, sem log. A transação por
   requisição (AD-4) protege a *permutação de posições* e não protege nada disso: as
   duas transações são válidas isoladamente.

2. **Assinatura falsificada — o dano pior.** Nada em AD-4 manda preservar a assinatura
   **por linha** ao reescrever as três não tocadas. O autor de S-IMPRESSAO monta um
   payload de quatro linhas a partir do resultado da sua chamada e preenche
   `provedor`/`modelo`/`prompt_versao`/`pacote_versao`/`gerado_em` com os valores **da
   corrida atual** — é a leitura natural do tipo. Resultado: três cadernos passam a
   declarar que foram escritos por um modelo que nunca os viu. Isso viola de frente a
   promessa de CAP-1 (*"marcar errata no caderno de Sono não altera a linha do de
   Movimento"*), a razão declarada de `mudancas-mecanicas.md` para manter a assinatura
   por linha, e a regra editorial de `cadernos.md` (*"jornal assina coluna"*). E é
   irrecuperável: depois disso não há como saber qual texto veio de qual cabeça, que é
   literalmente o comentário no topo da migration.

**A costura.** Duas ADs, e nenhuma delas é opcional:

- **A reimpressão parcial escreve texto de um caderno e posição de quatro.** O upsert
  parcial toca `posicao` das linhas não reimpressas e **mais nada** — `texto`,
  assinatura e `gerado_em` são imutáveis por linha fora da reimpressão daquela linha.
  (PostgREST faz isso com `upsert` de payload de colunas parciais, ou com a saída
  nomeada da AD-4: uma função no banco, autorizada pela AD-5 herdada.)
- **Impressão do mesmo período é exclusiva entre hospedeiros.** Um token de impressão —
  `gerado_em` como versão otimista, ou o próprio conjunto lido — que faz a segunda
  escrita falhar alto em vez de vencer calada.

---

## P3 — `AGG_VERSION` não tem dono: as 436 edições que nunca aceitam errata · **crítica**

**S-BACKFILL — "o script do arquivo"** (AD-12).
**S-IMPRESSAO — "imprimir no iPhone"**.

**A AD que as duas obedecem:** AD-12 local (*"o script vive fora dos três… constrói o
próprio client e chama `shared/src/data/` exatamente como os apps fazem"*) e a condição
2 de `mudancas-mecanicas.md` (*"assinatura idêntica — provedor · modelo · `prompt_versao`
· `PACOTE_VERSAO` · `agg_version_no_momento`"*).

**O estado incompatível.** `AGG_VERSION` **não mora no núcleo**. Ela é uma constante de
módulo em [`mobile/src/services/health-sync.ts:90`](../../../../../mobile/src/services/health-sync.ts)
(`const AGG_VERSION = 9`), num arquivo que importa HealthKit. O script de S-BACKFILL,
que por AD-12 vive fora dos três workspaces, **não tem de onde importá-la** sem arrastar
API nativa. Suas opções, todas conformes:

- cravar `9` no script → duplicação de constante de domínio, que a **AD-3 herdada**
  proíbe, e que passa despercebida porque nenhuma barreira varre `scripts/`;
- gravar `null` → é o que o parâmetro opcional permite
  ([`mobile/src/lib/edicao-ia.ts:74`](../../../../../mobile/src/lib/edicao-ia.ts):
  `aggVersion?: number`).

E aqui a acusação vira medição: **o iPhone hoje já grava `null`.** A tela chama
`gerarEdicaoFn(entradaPacote)` sem segundo argumento
([`mobile/src/app/retrospectiva/index.tsx:294`](../../../../../mobile/src/app/retrospectiva/index.tsx)),
o store repassa `aggVersion` como `undefined`
([`mobile/src/store/edicao.store.ts:78`](../../../../../mobile/src/store/edicao.store.ts)),
e `upsertEdicao` grava `e.aggVersionNoMomento ?? null`. Como `precisaErrata` devolve
`false` quando o campo é nulo
([`data/edicoes-ia.ts:143`](../../../../../packages/shared/src/data/edicoes-ia.ts)), **as
sete edições em produção são estruturalmente inelegíveis a errata** — e as 436 do
arquivo herdam o mesmo defeito se S-BACKFILL escolher a opção honesta.

Isso demole três coisas de uma vez: a constraint declarada do spec (*"um bump de
`AGG_VERSION` marca errata em todas as edições"*), o critério de sucesso de CAP-13 (*"a
edição de agosto assim produzida é idêntica à que o telefone produz"* — não é: uma tem
`9`, outra tem `null`), e o custo declarado em `mudancas-mecanicas.md` (*"~1.744 linhas"*),
que pressupõe que as linhas carreguem o número.

**A costura.** AD nova sob a AD-3 herdada: **`AGG_VERSION` é vocabulário de domínio e
sobe para o núcleo** (`packages/shared/src/health/agg-version.ts`), com
`mobile/src/services/health-sync.ts` passando a importá-la. E `aggVersionNoMomento`
deixa de ser opcional em `EdicaoInput` — campo que sustenta a errata não pode ser
esquecido por omissão de argumento.

---

## P4 — "as quatro linhas" × "caderno vazio some" · **alta**

**S-BACKFILL — "imprimir o arquivo desde 22/05/2023"**.
**S-NUCLEO — "`ordenarCadernos` e a ausência declarada"** (CAP-11).

**A AD que as duas obedecem:** a Consistency Convention *"Escrita de edição: sempre o
conjunto das quatro linhas numa chamada (AD-4). Nunca uma linha avulsa"* — e, do outro
lado, CAP-11 (*"caderno vazio não aparece"*) mais a regra 6 de
`bases-e-ranqueamento.md` (*"Vazio — fora da lista"*).

**O estado incompatível.** Elas se contradizem **na maior parte do arquivo**. A própria
tabela de backfill de `mudancas-mecanicas.md` diz que Coração começa em 24/03/2025, Sono
em 23/04/2025 e Rotina em 01/05/2026: **as 39 edições de mês anteriores a mar/2025 têm um
caderno só**, Movimento. Então:

- S-BACKFILL, lendo a convenção ao pé da letra, escreve quatro linhas sempre — e bate no
  `check (length(trim(texto)) > 0)`, ou inventa texto para um caderno cego, que é
  precisamente o que CAP-11 existe para proibir (*"nenhuma edição narra silêncio como
  estabilidade"*);
- S-NUCLEO devolve um array de um elemento, e quem imprime escreve **uma linha avulsa** —
  a coisa que a convenção diz "nunca".

E o desdobramento que nenhuma AD cobre: **`posicao` é 1..n sobre os cadernos presentes,
ou slot fixo 1..4?** As duas unidades escolherão diferente, e a escolha vaza para a
manchete: AD-11 e `cadernos.md` definem a manchete da capa como *"a do caderno em
`posicao = 1`"*. Sob slot fixo, uma edição de 2023 sem Sono pode simplesmente não ter
`posicao = 1` — e a capa fica muda.

**Agravante — o caderno-fantasma.** `upsert` não apaga. Um período que tinha quatro
cadernos e reimprime com três (Rotina ficou vazia no mês) deixa a quarta linha **viva,
com a posição antiga**. Ou a `unique` deferida estoura no `COMMIT` com um erro que
ninguém vai saber ler, ou — se a posição antiga não colidir — sobra um caderno de agosto
que a revista imprime com texto de outra impressão. AD-4 fala de `upsert` e nunca de
`delete`.

**A costura.** AD nova: **a edição é o conjunto exato dos cadernos que têm texto naquela
impressão, e a gravação é um `replace` do conjunto (upsert + delete do complemento) numa
transação.** `posicao` é `1..n` denso sobre os presentes; a manchete é a do menor
`posicao`, nunca a do literal `1`.

---

## P5 — O que é uma *execução* da lua? · **crítica**

**S-LUA-NUCLEO — "`sleep/lua.ts`, o teste sob protocolo"** (AD-6).
**S-LUA-PAGINA — "`/revista/lua`, a única tela filha"** (AD-5, CAP-12).

**A AD que as duas obedecem:** AD-6 (*"a página é **calculada** sob protocolo, não
narrada"*) e AD-5 (*"`lua_execucoes`, uma linha por execução… o contador da página é a
contagem de linhas"*).

**O estado incompatível.** As duas ADs, juntas, deixam a pergunta central sem resposta:
**abrir a página é uma execução?**

- S-LUA-PAGINA lê AD-6 e faz o que a arquitetura do repositório sempre fez — deriva na
  leitura. A tela roda `testeLunar()` sobre o dado atual a cada abertura e imprime o
  veredito. Não grava nada, porque gravar na leitura seria efeito colateral no
  adaptador. O contador (AD-5) diz *"primeira execução"* para sempre, enquanto o
  veredito impresso **muda em silêncio** conforme noites entram — de *"faltam 106
  noites"* para *"achado"*, sem que nenhuma linha registre a transição.
- S-LUA-NUCLEO lê AD-5 e o §7 do pré-registro (*"tornar cada tentativa permanente e
  contável"*) e conclui que toda avaliação é uma tentativa: grava linha a cada abertura.
  O contador diz *"quadragésima execução"* depois de uma semana de curiosidade, e a
  moldura fixa vira ruído.

Isto não é um detalhe de implementação: é **a capacidade inteira**. CAP-12 existe porque
há um prior declarado, e a única defesa que o pré-registro oferece contra "refazer até dar
certo" é que cada tentativa seja permanente e contável (§7.2 e §7.4). Sob S-LUA-PAGINA,
**olhar não conta** — que é exatamente o furo que o documento existe para tapar. Sob
S-LUA-NUCLEO, o contador perde significado, e a cadência dos +100 noites (§7.5) não tem
guardião nenhum: nenhuma AD diz quem calcula `noitesDesdeAUltimaExecucao`, nem quem
recusa a execução 101 noites cedo demais.

**A costura.** AD nova, e é a mais importante desta revisão:

> **Execução é ato, leitura é leitura.** A página **lê a última linha de
> `lua_execucoes`** e imprime aquele veredito, com a data em que ele foi produzido —
> nunca recalcula para exibir. Executar é ato explícito do dono, gravado, e o portão de
> cadência (+100 noites desde a última linha) é avaliado em `sleep/lua.ts`, no núcleo,
> com a recusa sendo um valor de retorno e não uma condição de tela.

Isto tem consequência de esquema que a AD-5 ainda não tem: a linha precisa guardar
**tudo que a moldura imprime**, incluindo a próxima leitura, porque nada será
recalculado na abertura.

---

## P6 — `natureza` tem dois valores; o arquivo tem três casos · **alta**

**S-CAPA — "`edicoes_capa` e o carimbo"**.
**S-BACKFILL — "as 436 edições do arquivo"**.

**A AD que as duas obedecem:** AD-3 — `natureza (foto | tracado)` e *"os três campos da
legenda já formatados — parada, quilômetro e hora"*.

**O estado incompatível.** Três buracos, e o backfill cai nos três porque **as fotos são
só de 2026** (`cadernos.md`: *"três quartos do arquivo não tem imagem"*):

1. **`cadernos.md` declara três fontes de imagem**, não duas: `coverOf`, *"o traçado do
   próprio período (`activity_routes`, 275)"* **ou a grade diária**. O CHECK de AD-3 tem
   dois valores. Um mês de 2023 sem atividade com GPS não é `foto` nem `tracado` — e o
   autor de S-BACKFILL, obedecendo o CHECK, ou pula a capa (buraco na parede) ou mente
   com `tracado`.
2. **A legenda de três campos é vocabulário de foto.** Parada, quilômetro e hora não
   existem para um traçado de período nem para uma grade diária. AD-3 pede os três
   *"já formatados"* sem condicional; S-CAPA declara as colunas `not null` e S-BACKFILL
   não tem o que pôr nelas em ~330 das 436 edições.
3. **A parede pede uma linha por edição** (AD-3). Edição sem linha de capa = buraco. A
   unidade da parede (P7) vai então inventar um fallback local, e a mesma edição passa a
   ter uma cara na parede e outra aberta.

**A costura.** Ampliar a AD-3: **`natureza` tem três valores (`foto` · `tracado` ·
`grade`), a legenda é opcional e só existe para `foto`, e toda edição gravada tem
exatamente uma linha em `edicoes_capa` — inclusive a de natureza `grade`, que é a que
garante que a parede não tenha buraco.**

---

## P7 — Quem lê a manchete da parede? · **alta**

**S-PAREDE — "`/revista/arquivo`, a parede de capas"** (AD-1, CAP-10).
**S-CHAMADA — "a chamada, função pura no núcleo"** (AD-11).

**A AD que as duas obedecem:** AD-3 (*"a leitura da parede pede **uma linha por edição**,
contra quatro em `edicoes_ia`"* — é a justificativa declarada da tabela existir) e AD-11
(*"a chamada é derivada por uma função pura no núcleo, consumida por sumário, **capa e
parede**. **Nenhum campo novo no banco**"*).

**O estado incompatível.** As duas não podem ser verdade ao mesmo tempo. A chamada é
extraída **do texto do caderno em `posicao = 1`**, que mora em `edicoes_ia`. Então:

- S-PAREDE, honrando AD-3, lê só `edicoes_capa` → **436 capas mudas**, com imagem e
  legenda e nenhuma manchete. A parede vira um mosaico de fotos sem jornal, e CAP-10
  perde o que a diferencia de um seletor de data;
- S-PAREDE, honrando AD-11, lê também `edicoes_ia` filtrando `posicao = 1` → o benefício
  declarado da AD-3 (*uma linha por edição*) **deixa de existir**: são duas consultas,
  436 + 436 linhas, e a tabela `edicoes_capa` perde metade da sua justificativa;
- ou alguém acrescenta `manchete` a `edicoes_capa`, o que **AD-11 proíbe por escrito**.

**A costura.** Decidir e escrever: ou a parede é `edicoes_capa ⋈ edicoes_ia (posicao
mínima)` e a AD-3 corrige a sua própria justificativa, ou a manchete da parede é a
**legenda** e a chamada fica só no sumário e na abertura da edição. As duas são
defensáveis; nenhuma está escrita, e por isso as duas serão construídas.

---

## P8 — Caderno silenciado em `posicao = 1` · **média**

**S-CAP14 — "silenciar caderno"** (AD-2, `RetroPrefs.cadernosOcultos`).
**S-CAPA / S-PAREDE — "a capa e a manchete"** (AD-3, AD-11).

**A AD que as duas obedecem:** AD-2 (silenciar é preferência de leitura, resolvida no
núcleo, gravada pelo store) e AD-11 (*"se um caderno ainda não tem texto — sendo escrito,
reprovado, ou não impresso —, a chamada não existe"*).

**O estado incompatível.** AD-11 enumera **três** casos de ausência e não enumera o
quarto: *silenciado*. Um caderno silenciado **tem** texto — ele foi impresso antes de o
leitor o silenciar, e a posição está congelada. CAP-14 exige que ele *"não apareça nem
quando o ranqueamento o colocaria em primeiro"*, mas a capa e a parede leem `posicao = 1`
sem consultar preferência nenhuma (e não deveriam mesmo consultar: preferência é estado
do app, AD-12 herdada; a capa é dado carimbado).

Resultado: o leitor silencia Rotina, abre a revista de agosto, e a **capa anuncia com
manchete um caderno que a revista não contém**. Na parede, 436 capas continuam vendendo
seções silenciadas.

Há ainda a pergunta gêmea, também sem dono: **o caderno silenciado é impresso?** S-CAP14
dirá que é (silenciar é leitura, e desilenciar depois tem que devolver o texto);
S-IMPRESSAO dirá que não é (a lei *"a revista nunca gera sozinha"* e o custo por chamada
tornam absurdo pagar por um texto que ninguém vai ler). As duas leituras são conformes, e
produzem edições com número de linhas diferente para o mesmo período — que é P4 outra vez,
por outra porta.

**A costura.** Apertar a AD-11 para quatro casos de ausência, e declarar em AD-2 que
**silenciar é filtro de leitura e nunca de impressão**: a edição grava o que o dado
manda, e a tela esconde. Quando o caderno de `posicao` mínima está silenciado, a manchete
da capa é a do próximo visível — regra que precisa existir em um lugar só.

---

## P9 — `CadernoId → ModuleKey` não tem dono · **média**

**S-TELA-EDICAO — "o cabeçalho de caderno forte"** (`cadernos.md`: *"cor de módulo por
`moduleOf()`"*).
**S-ANUARIO — "as quatro tiras de doze meses, na cor do caderno"**.

**A AD que as duas obedecem:** a Consistency Convention *"Cor: `moduleOf()` para a
faixa"* e AD-8 (*"`onAccent` entra em `ModuleTokens`, porque quem lê a faixa é
`moduleOf()`"*).

**O estado incompatível.** `moduleOf()` recebe uma `ModuleKey`, e as chaves são as dez de
`MODULE_ROLE` ([`packages/shared/src/theme/palettes.ts:80`](../../../../../packages/shared/src/theme/palettes.ts)):
`treino · food · agua · habito · casa · compras · financas · tarefa · cultura · saude`.
**Nenhum `CadernoId` está lá** — e nem podia estar: sono é categoria de Saúde e não
módulo (ADR 0031), "movimento" não é "treino", "coração" e "rotina" não existem como
módulo. Logo há um mapa `CadernoId → ModuleKey` obrigatório, e **nenhuma AD o nomeia**.
As duas unidades vão inventá-lo, cada uma no seu arquivo, cada uma achando que é a
primeira: Sono vira `saude` no cabeçalho e `agua` na tira do ano, e a mesma tela imprime
o caderno em vermelho com a série em azul.

É a violação clássica da **AD-3 herdada** — a mesma de `GPS_ACTIVITY_IDS`, citada na
espinha-mãe como precedente — reencenada por omissão.

**A costura.** Uma linha na AD-2: **`period/cadernos.ts` é dono também de
`CADERNO_MODULE`**, e nenhuma tela mapeia caderno para cor por conta própria. Com
barreira, se valer o esforço: `moduleOf(` fora de uma allowlist não recebe literal.

---

## P10 — `periodoFechado` usa o relógio do hospedeiro · **média**

**S-BACKFILL** × **S-IMPRESSAO**.

**A AD que as duas obedecem:** AD-10 — e o par nasce da *justificativa* dela: *"o script
de backfill e o iPhone podem estar em fusos diferentes, e `mudancas-mecanicas.md` exige
que os dois hospedeiros produzam a mesma edição verificada"*.

**O estado incompatível.** AD-10 fixa a **coordenada** e não diz nada sobre o **relógio**.
`periodoFechado` compara `diaLocal(agora)` — timezone do dispositivo — com `fimISO`
([`packages/shared/src/ia/pacote.ts:143`](../../../../../packages/shared/src/ia/pacote.ts)),
e a convenção herdada manda justamente isso (*"data local derivada da timezone do
dispositivo, nunca UTC"*). Se os dois hospedeiros podem estar em fusos diferentes — e a
AD-10 diz que podem —, então em toda virada de mês existe uma janela em que **o mesmo
período está fechado para um hospedeiro e aberto para o outro**. O backfill pula a edição
mais recente do lote sem dizer nada (`{ estado: 'aberto' }` não é erro), e o dono
descobre semanas depois que setembro não foi impresso.

O mesmo relógio decide `bases[]` (o que é "o período anterior") e a lápide (*"a última
medida cai dentro deste período"*), então a divergência não é só de agenda.

**A costura.** Estender a AD-10 do lugar para o **tempo**: *o fuso da edição é o mesmo
fuso da coordenada de casa, constante no núcleo* — `periodoFechado` e `diaLocal` recebem
o fuso da edição, não o do processo.

---

## P11 — Reimpressão parcial sob `PACOTE_VERSAO` novo · **alta**

**S-NUCLEO-V3 — "subir `PACOTE_VERSAO` para 3"** (a próxima frente; a espinha já normaliza
1 → 2 como coisa que acontece).
**S-IMPRESSAO — "reimprimir um caderno"**.

**A AD que as duas obedecem:** AD-4 (o upsert das quatro linhas), CAP-7 (*"reimprimir um
caderno recalcula e regrava a ordem do conjunto inteiro"*) e `mudancas-mecanicas.md`
(*"`PACOTE_VERSAO`… segue por linha"*).

**O estado incompatível — e nenhuma AD o cobre.** Reimprimir só Rotina numa edição
impressa sob `PACOTE_VERSAO` 2, com o código já em 3, produz:

- uma linha `pacote_versao = 3` e três linhas `pacote_versao = 2` — legítimo, é o desenho;
- **e uma `posicao` recalculada por `ordenarCadernos` sobre os pacotes v3 dos quatro
  cadernos**, porque a função é pura sobre pacotes e o código só sabe montar pacote v3.

A ordem da edição passa a descrever um conjunto de fatos que **nenhuma linha da tabela
contém**. E como a manchete da capa é a chamada do caderno em `posicao` 1 (AD-11), a capa
da edição pode passar a anunciar um caderno escolhido por um afastamento medido em fatos
v3, com um texto escrito sob v2 que não os menciona. O critério de sucesso do spec —
*"reaberta seis semanas depois, devolve exatamente o mesmo texto e a mesma ordem"* —
sobrevive à letra (nada reordena ao reabrir) e morre no espírito.

O mesmo raciocínio vale para o bump global de `AGG_VERSION`: a errata é marcada em tudo,
o dono reimprime um caderno, e a edição fica meio errata meio não, com uma ordem derivada
de um estado misto.

**A costura.** AD nova: **`posicao` só é recalculada sobre um conjunto homogêneo.** Se
`pacote_versao` (ou `agg_version_no_momento`) divergir entre as linhas do período,
reimpressão parcial é recusada — reimprime-se a edição inteira, ou não se reimprime.
Recusar é barato; a incoerência não é detectável depois.

---

## P12 — A credencial do terceiro hospedeiro · **alta**

**S-BACKFILL — "o script em `scripts/`"** (AD-12).
**S-OPS — "a Deferred de distribuição"** (a espinha declara: *"esta frente **não muda o
envelope operacional**"*).

**A AD que as duas obedecem:** AD-12 (*"constrói o próprio client e chama
`shared/src/data/` exatamente como os apps fazem"*) e a convenção herdada de Segredos
(*"segredo real só em edge function; `.env` e `mobile/.env` nunca são lidos, editados nem
commitados"*).

**O estado incompatível.** *"Exatamente como os apps fazem"* é impossível: os apps
constroem o client **com a sessão do usuário logado**, e é ela que satisfaz a RLS
(`auth.uid() = user_id`, [`20260906150000_edicoes_ia.sql:57`](../../../../../supabase/migrations/20260906150000_edicoes_ia.sql))
e o `verify_jwt = true` da `ia-narrar`
([`supabase/config.toml:29`](../../../../../supabase/config.toml)). Um script `tsx` na
máquina não tem sessão. As saídas conformes são três, e nenhuma está autorizada em lugar
nenhum:

- **service-role key na máquina do dono** — passa o `verify_jwt`, atravessa a RLS,
  e coloca no laptop a credencial que a convenção diz que só existe dentro de edge
  function;
- **login programático com a senha do dono** num script versionado;
- **sessão exportada à mão** a cada corrida, que é operação não documentada e é
  exatamente o tipo de coisa que a Deferred *"Distribuição e deploy"* diz não estar
  versionada em doc nenhum.

A frase da Deferred — *"a `ia-narrar` já existe e atende os dois hospedeiros; esta frente
não muda o envelope operacional"* — é **falsa como escrita**: o segundo hospedeiro é novo
e não tem identidade. E é o hospedeiro que vai fazer 436 chamadas pagas.

**A costura.** A AD-12 precisa de um parágrafo sobre **identidade**: qual credencial, de
onde ela vem, e por que ela não é a service-role. A opção mais barata e conforme é o
script fazer `signInWithPassword` com credenciais lidas de variável de ambiente **do
shell, nunca de arquivo**, mantendo a RLS de pé e a `ia-narrar` com JWT de usuário — mas
a decisão precisa estar escrita antes de alguém escolher a service-role por ser mais
fácil.

---

## P13 — A migration e o caminho de escrita têm que pousar juntos · **média**

**S-MIGRATION — "`edicoes_ia` ganha `caderno` e `posicao`"**.
**S-IMPRESSAO — "a impressão passa a escrever quatro linhas"**.

**A AD que as duas obedecem:** AD-4 e a convenção herdada *"migrations: ledger
append-only; aplicada nunca é reescrita"*.

**O estado incompatível.** Migrations costumam ser a primeira story de um épico, e essa
não pode ser. Assim que `caderno` e `posicao` existirem como `not null` sem default:

- `upsertEdicao` (singular) quebra em produção — ela não manda os dois campos
  ([`data/edicoes-ia.ts:108`](../../../../../packages/shared/src/data/edicoes-ia.ts)), e é
  o caminho vivo do `EdicaoCard` no iPhone do dono;
- `fetchEdicao` usa `.maybeSingle()` e passa a **estourar** assim que um período tiver
  duas linhas — hoje ele devolve `Edicao | null` e a tela trata `null`, não exceção.

Some-se que a espinha manda remover as 7 edições de produção **na** migration
(`mudancas-mecanicas.md`), o que significa que a janela entre as duas stories é uma janela
com a Retrospectiva **sem manchete nenhuma** no aparelho do único usuário.

**A costura.** Não é uma AD nova, é uma linha na Structural Seed ou no plano de stories:
**migration, `data/edicoes-ia.ts` e o caminho de impressão do iPhone são uma unidade
indivisível**, e `upsertEdicao`/`fetchEdicao` na forma singular **saem do núcleo no mesmo
commit** — função exportada de `@vitale/shared` que não deve mais ser usada é uma armadilha
com dono zero.

---

## P14 — `PRE_REGISTRO_LUA_SHA`: o executor não tem o arquivo · **média**

**S-BARREIRA — "o hash no `architecture.test.ts`"** (AD-7).
**S-LUA-NUCLEO — "o executor compara antes de rodar"** (§7.1 do pré-registro, que é
contrato).

**A AD que as duas obedecem:** AD-7 (*"`architecture.test.ts` calcula o sha256 de
`docs/specs/revista-retrospectiva/pre-registro-lua.md` e compara com
`PRE_REGISTRO_LUA_SHA`"*) e AD-5 (*"colunas que a moldura fixa obriga: o **hash do
pré-registro que autorizou**"*).

**O estado incompatível.** O `.md` **não existe em tempo de execução no iPhone** — não é
recurso de bundle, e o núcleo é puro (sem `fs`). O executor só pode comparar a constante
consigo mesma. Logo:

- a checagem de tempo de execução que o §7.1 exige (*"o executor compara antes de rodar"*)
  é **vazia**, e S-LUA-NUCLEO ou a omite (e o pré-registro fica contrariado por omissão,
  sem documento de correção que o diga) ou embute o conteúdo do arquivo como string no
  bundle — segunda cópia do pré-registro, que a AD-3 herdada proíbe;
- `lua_execucoes.pre_registro_sha` guarda **o que o código afirma**, não o que o arquivo
  é. Um commit que mova o `.md` e a constante juntos passa na AD-7 e grava o hash novo
  como se fosse o autorizador original.

A AD-7 acerta ao tornar a barreira incondicional; o que falta é dizer, no documento de
correção que ela mesma exige, que **a verificação do hash é de build, não de execução**, e
que o §7.1 fica corrigido nesse ponto — senão a próxima pessoa a ler o pré-registro vai
procurar um comparador em tempo de execução que nunca existiu.

**A costura.** Uma linha a mais em `correcao-pre-registro-lua.md`, junto com as duas
correções que a espinha já lista (AD-5 e AD-7): o §7.1 passa a ler *"o build compara"*.

---

## P15 — `resolveRetroPrefs` descarta na leitura; o store persiste o resolvido · **média**

**S-CAP14 — "`cadernosOcultos` no mesmo jsonb"** (AD-2).
**S-LIMPEZA — "sai `order`, `moveBlock`, `proofStartedOn`, `PROOF_DAYS`, `DEATH_DAYS`"**
(`mudancas-mecanicas.md`, "O que sai do código").

**A AD que as duas obedecem:** AD-2 (*"`resolveRetroPrefs` ganha um ramo defensivo e nada
mais; chave desconhecida continua sendo descartada em silêncio"*) e AD-12 herdada (*"quem
grava é o store do app"*).

**O estado incompatível.** AD-2 trata *"descartada em silêncio"* como propriedade
**inócua de leitura**. Não é: o store persiste o **objeto resolvido**, não o jsonb
original —
[`mobile/src/store/settings.store.ts:168`](../../../../../mobile/src/store/settings.store.ts)
grava `retro_prefs: next.retroPrefs ?? {}`, e `next.retroPrefs` saiu de
`resolveRetroPrefs`. E essa gravação acontece a **cada mudança de qualquer preferência** —
tema, paleta, marca, papel de parede, meta de proteína: tudo passa pelo mesmo
`upsertUserPreferences`. Portanto **descartar na leitura é apagar na escrita**, um passo
depois.

Consequência prática: qualquer build que não conheça `cadernosOcultos` — um rollback, um
TestFlight anterior, o build de release enquanto o dono usa o de dev — **apaga os cadernos
silenciados do dono ao ele trocar de tema**. O dado não é grande, mas é a única forma de
ele discordar da revista (CAP-14), e some sem erro.

**Conferido e ilibado:** a web **não** escreve `retro_prefs` — `theme.service.ts:206`
manda quatro colunas, e o `upsert` do PostgREST só atualiza as colunas presentes no corpo.
O risco é entre **builds do mobile**, não entre apps.

**A costura.** Ou a AD-2 declara que **a escrita preserva as chaves desconhecidas**
(resolver para ler, mesclar para gravar), ou declara conscientemente que não preserva — mas
não pode continuar apresentando o descarte como se ele custasse nada.

---

## P16 — `edicoes_capa` sem o CHECK que a AD-1 promete · **baixa**

**S-CAPA** × **S-ROTA** (AD-1).

**A AD que as duas obedecem:** AD-1 — *"Período em curso e `all` não têm rota de revista —
`periodoFechado` devolve `false` para `'all'` sempre, **e o CHECK do banco o recusa**"*.

**O estado incompatível.** Esse CHECK existe em `edicoes_ia`
([`20260906150000_edicoes_ia.sql:22`](../../../../../supabase/migrations/20260906150000_edicoes_ia.sql));
a AD-3 descreve `edicoes_capa` por chave e colunas e **não menciona CHECK nenhum**. O autor
de S-CAPA, escrevendo uma tabela nova a partir da AD-3, não tem por que replicá-lo — e
`all` passa a poder ter capa, que é a única metade da edição que a AD-1 dizia estar
protegida pelo banco.

**A costura.** Uma cláusula na AD-3: **`edicoes_capa` repete os CHECKs de
`edicoes_ia`** (`tipo_periodo`, `fim >= inicio`). Invariante que vale só para a tabela que
chegou primeiro não é invariante — que é, aliás, o argumento da própria AD-12.

---

## O que ataquei e não caiu

Registrado para não ser reinvestigado:

- **AD-4 e a `unique` deferida.** A leitura está tecnicamente certa: PostgREST envolve a
  requisição numa transação, constraint deferida é cobrada no `COMMIT`, e usar a PK
  (não-deferrable) como árbitro do `ON CONFLICT` contorna a limitação do Postgres. A
  permutação de posições dentro de uma chamada realmente não é vista pelo caminho. O que
  a AD não cobre é o que sobra fora da chamada — P2, P4, P11.
- **AD-2 e o "sem migration".** Verdadeiro: `retro_prefs` é
  `jsonb not null default '{}'::jsonb` **sem CHECK de forma**
  ([`20260825120000_user_preferences_retro_prefs.sql:12`](../../../../../supabase/migrations/20260825120000_user_preferences_retro_prefs.sql)).
  Chave nova no jsonb não pede migration. O furo é o da escrita (P15), não o da forma.
- **AD-9 e a API de foco.** `sendAccessibilityEvent` é a substituta documentada de
  `setAccessibilityFocus`, e o RN instalado expõe as duas. Nada a apontar.
- **AD-8 e o piso de 3,0.** A justificativa é do WCAG e é correta: 22 px peso 700 passa o
  limiar de texto grande (18,66 px negrito). Registrar os 4,25 como folga e não como piso
  é a decisão certa, e a Deferred já prevê a catraca.
- **A web apagando `retro_prefs`.** Investigado e descartado — ver P15.

## As ADs que faltam, em ordem de custo de não escrevê-las

1. **Execução da lua é ato gravado; a página lê a última linha** (P5).
2. **Reimpressão parcial preserva texto e assinatura por linha; impressão do mesmo
   período é exclusiva entre hospedeiros** (P2).
3. **`AGG_VERSION` é vocabulário do núcleo, e `aggVersionNoMomento` não é opcional** (P3).
4. **A edição é o conjunto exato dos cadernos com texto; a gravação é `replace`, não
   `upsert`** (P4, P8).
5. **`posicao` só se recalcula sobre conjunto homogêneo de `pacote_versao` /
   `agg_version`** (P11).
6. **A capa carimba junto com o primeiro texto aprovado, tem três naturezas, legenda
   opcional, e os mesmos CHECKs** (P1, P6, P16).
7. **A parede lê capa + manchete — e a AD-3 corrige a sua justificativa** (P7).
8. **O terceiro hospedeiro tem identidade declarada** (P12).
9. **`period/cadernos.ts` é dono de `CADERNO_MODULE`** (P9).
10. **O fuso da edição é constante, como a coordenada** (P10).
