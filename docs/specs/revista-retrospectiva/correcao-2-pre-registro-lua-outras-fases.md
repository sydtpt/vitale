# Segunda correção, quarto elo da cadeia — o §10 das outras fases citava a §7 antes de ela ser corrigida

> **Como contar, porque há duas contagens e elas não coincidem.** Este arquivo é a
> **segunda correção** (o segundo documento de correção da cadeia, depois do de
> 08/09/2026) e o **quarto elo da cadeia** (o quarto documento no total, contando os
> dois pré-registros). As duas contagens aparecem juntas, sempre, em todo este texto.
>
> Há uma terceira contagem, a dos **ajustes**: a correção de 08/09 trouxe a Correção 1
> e a Correção 2; este documento traz a **Correção 3** e a **Correção 4**. Por isso as
> seções abaixo continuam a numeração em vez de recomeçar — "Correção 1" já existe, e
> é de outro documento.

- **Data:** 28/09/2026
- **Contagem:** segunda correção · quarto elo da cadeia · traz as Correções 3 e 4
- **Corrige:** [`pre-registro-lua-outras-fases.md`](pre-registro-lua-outras-fases.md), **§10**
- **sha256 do arquivo corrigido:**
  `1227264d01b5f0f35bf7bfcf90fb4241ac89fefef4b28dadfe399918a51251bc`
- **Cadeia que este documento fecha**, em ordem:
  1. [`pre-registro-lua.md`](pre-registro-lua.md) — 07/09/2026 ·
     `d09365de54bb6bbd6fa8d99af9d1f26cddaebc3492029a63d6b1b6e4f6759664`
  2. [`correcao-pre-registro-lua.md`](correcao-pre-registro-lua.md) — 08/09/2026 ·
     `aad967aae5f9fddd563dfd5f97fd274d236f511fb20f5cdad2dfd45a7e46c308`
  3. [`pre-registro-lua-outras-fases.md`](pre-registro-lua-outras-fases.md) — 28/09/2026 ·
     `1227264d01b5f0f35bf7bfcf90fb4241ac89fefef4b28dadfe399918a51251bc`
  4. **este arquivo** — 28/09/2026
- **Origem:** a story 4.2b, quando a tabela foi escrita e o §10 deixou de fechar com a §7

> **Por que este documento existe.** A correção de 08/09 previu a própria sucessora:
> *"se uma terceira correção for necessária, ela é **outro documento**, que cita este e o
> pré-registro"*. É o que este é — e ele traz a terceira **e** a quarta. **Nenhum dos três
> arquivos anteriores foi editado** — as três sha256 acima são a prova, e são as mesmas
> constantes que o código compara.

## O defeito: uma citação que envelheceu entre dois documentos

O §10 do documento de 28/09 repete a máquina da §7 de 07/09 para valer também sobre as
três fases novas. A intenção está certa e continua valendo. O problema é que ele repete a
§7 **no texto original dela**, e duas cláusulas desse texto já tinham sido revogadas
vinte dias antes, pela [correção de 08/09](correcao-pre-registro-lua.md).

O §10 diz, literalmente:

> *"Toda a máquina da §7 do documento de 07/09 se aplica a este arquivo, sem exceção: a
> **sha256 deste texto** entra no código como constante ao lado da do outro; toda execução
> grava linha em `edicoes_ia` com `caderno='lua'` e **os dois hashes** que a autorizaram;
> hash divergente com execução já gravada **quebra o build**; a página mostra o contador
> de execuções."*

Duas das quatro cláusulas dessa frase citam o estado revogado:

| Trecho do §10 | Situação | Quem o revogou |
|---|---|---|
| *"grava linha em `edicoes_ia` com `caderno='lua'`"* | **revogado** | Correção 1 de 08/09 |
| *"hash divergente **com execução já gravada** quebra o build"* | **revogado** | Correção 2 de 08/09 |
| *"a sha256 deste texto entra no código como constante ao lado da do outro"* | vigente | — |
| *"a página mostra o contador de execuções"* | vigente | — |

Isso não é um erro de conteúdo: é a cadeia ficando **incoerente**. Um leitor que abrisse só
o documento de 28/09 — que é o mais recente dos três e o que cobre três das quatro fases —
leria a regra errada em dois pontos, e leria com a autoridade de um pré-registro. E como os
três arquivos são imutáveis, a única saída é esta.

## Correção 3 — a execução grava em `lua_execucoes`, e o §10 não muda isso

**Onde o §10 diz** *"grava linha em `edicoes_ia` com `caderno='lua'`"*, **leia-se:** grava
linha em **`lua_execucoes`**, com **os hashes de toda a cadeia** que a autorizou. Nunca
substitui — **acumula**.

A razão é inteira da correção de 08/09, e não se repete aqui: são três impedimentos
independentes em `edicoes_ia` — o CHECK de `caderno` recusa `'lua'`, a chave primária
transforma o *acumula* em *substitui*, e não existe `tipo_periodo` para "todo o histórico".
Ver a [Correção 1 de 08/09](correcao-pre-registro-lua.md#correção-1--a-execução-não-é-gravada-em-edicoes_ia).

O que o §10 acrescentava de próprio — que a linha carrega **os dois hashes**, não um —
**continua valendo, e cresce**: a linha carrega a cadeia **inteira**, que a partir daqui são
quatro documentos. A pergunta que um leitor futuro faz não é *qual era o digest*, é *quais
documentos autorizaram isto*; por isso o que fica gravado é a **lista ordenada** de arquivo
e sha256, e o digest ao lado dela.

## Correção 4 — o build quebra sempre, e o §10 não muda isso

**Onde o §10 diz** *"hash divergente **com execução já gravada** quebra o build"*,
**leia-se:** hash divergente **quebra o build**, tenha havido execução ou não.

A razão, também de 08/09: a condicional **não é construível**. O teste é puro e offline —
roda com `npx tsx`, sem cliente de banco e sem rede —, e *"execução já gravada"* mora no
Postgres. Ver a
[Correção 2 de 08/09](correcao-pre-registro-lua.md#correção-2--o-build-quebra-sempre-não-só-depois-da-primeira-execução),
inclusive o preço declarado: corrigir uma vírgula em qualquer um dos quatro documentos
quebra o build, e a saída é outro documento de correção, como este.

**Onde essa quebra mora hoje, e o que fica para a 4.3.** Desde a story 4.2b ela é real e
incondicional: `packages/shared/src/sleep/lua-carimbo.test.ts` recalcula as quatro sha256 do
conteúdo em disco, e roda em `pnpm --filter @vitale/shared test` como qualquer outro teste do
núcleo — um byte a mais em qualquer um dos quatro documentos reprova a suíte, tenha havido
execução ou não. **A 4.3 decide outras duas coisas**, e nenhuma delas é "se o build quebra":
se a cobrança migra para `architecture.test.ts`, onde as barreiras valem sobre o repositório
inteiro e não só sobre o workspace do núcleo; e se ela passa a cobrir também a
**operacionalização** do acréscimo abaixo, que hoje é carimbada e nunca impedida.

## Acréscimo — o que a §10 nomeou como buraco, e o que o fecha pela metade

O §10 nomeia uma dívida, e a nomeia bem:

> *"`JANELA_LUNAR_NOITES`, `HORA_UTC_DO_FIM_DA_NOITE` e a borda aberta à direita vivem em
> `packages/shared/src/sleep/lua.ts`, **fora de qualquer documento hasheado**. Mudar uma
> delas depois de ver o resultado desloca a coluna testada **sem quebrar o build**. A story
> 4.3 decide se a barreira passa a cobrir essas constantes também; até ela existir, a
> proteção deste par de documentos tem esse buraco, e ele está escrito."*

Isso continua inteiro — **este documento não decide pela 4.3**. O que se acrescenta é uma
mitigação que não custa nada e que é do mesmo tipo do contador de execuções da §7.4: **cada
execução gravada carimba os três valores**, ao lado do veredito que eles produziram.

E, pelo mesmo raciocínio, mais três que o §10 não nomeava e que decidem o resultado tanto
quanto os dele: a **versão do motor** (a aritmética que produz efeito, p e poder — trocar o
Hodges–Lehmann, o Mann–Whitney ou a conta de poder *depois de ver o resultado* não deixava
rastro nenhum), o **alcance pedido** (o `desde` da leitura, que decide quais noites entram e
mora no chamador) e as **noites colapsadas** (abaixo). Seis carimbos, todos do mesmo tipo:
nenhum impede, todos obrigam a dizer em voz alta.

A barreira do build continua sendo a única coisa que *impede*. O carimbo não impede: ele
torna a mudança **visível depois do fato**, porque duas execuções com janelas diferentes
ficam lado a lado na mesma tabela, e a página que mostra o contador mostra de qual
operacionalização cada linha saiu. É exatamente o propósito que a §7.3 declara para si
mesma — *"não para impedir: para obrigar a dizer em voz alta"*.

### O grão da tabela, declarado para não virar decisão tácita

A §9 de 28/09 manda que *"uma execução autorizada calcula as quatro fases, grava as quatro
e publica as quatro"*. `lua_execucoes` tem, por isso, **uma linha por fase por execução** —
as quatro compartilham o identificador da execução, e o banco cobra no commit que todo
identificador tenha exatamente quatro linhas, uma por fase. Escrita parcial não é proibida:
é **impossível**.

A alternativa — uma linha por execução com os quatro vereditos dentro — espremeria quatro
conjuntos de veredito, efeito, p, poder, contagens e portão numa linha larga ou num JSON sem
tipo, e perderia o CHECK de cada um. A §9 é uma regra sobre as quatro rodarem juntas; ela não
pede que as quatro morem na mesma linha, e o grão por fase é o que deixa `veredito`, `motivo`
e a unidade do que falta serem vocabulário fechado no banco.

## O que este documento **não** decide

**Nada do desenho do teste.** Seguem intocados, palavra por palavra, nos dois pré-registros:

| Onde | O que fica fixado | Estado |
|---|---|---|
| §3 de 28/09 · §3 de 07/09 | sujeito, desfecho primário (hora de apagar), janela `[fase − 5 d, fase)`, colunas, covariável | intocado |
| §3 de 28/09 | a cheia é família própria a 5%; as três dividem 1,67% cada | intocado |
| §5 de 28/09 | as três são **bilaterais**; a cheia segue unilateral no atraso | intocado |
| §6 de 28/09 · §4–§5 de 07/09 | os três portões, os três vereditos, o limiar de 15 min, as tabelas de poder | intocado |
| §7 de 28/09 | comparar contra todas as outras noites, com o viés para o nulo declarado | intocado |
| §8 de 28/09 · §6 de 07/09 | secundários: exploratórios só na cheia, nenhum nas três | intocado |
| §9 de 28/09 | as quatro rodam juntas ou nenhuma roda; cadência de +100 noites | intocado |
| §11 de 28/09 · §8 de 07/09 | uma página só, dentro do caderno Sono, mostrando os dois α | intocado |

**Nenhum dado foi consultado para escrever isto.** Nem mediana por fase, nem contagem por
coluna, nem o desvio-padrão que a §5 autoriza. As quatro correções desta cadeia são sobre
**onde uma linha é gravada**, **quando um teste de build falha** e **qual o grão da tabela**
— armazenamento e ferramenta, que não carregam informação nenhuma sobre a hipótese. A única
exceção está dita em voz alta logo abaixo, e é o colapso da noite com dois períodos: essa
**é** uma escolha de desfecho, e foi feita sem olhar o dado porque olhá-lo é o que o
protocolo proíbe.

**Uma operacionalização que os quatro documentos não cobrem**, e que fica dita aqui para que
ninguém a descubra lendo código: `sleep_periods` tem chave `(user_id, onset_at)`, então uma
noite pode ter **dois** períodos de sono, e o motor recusa `wakeDay` repetido. A leitura que
o alimenta colapsa a noite pelo **`onset_at` mais cedo** — o desfecho é *a hora de apagar*, e
apagar é quando o sono começou; um período posterior na mesma noite é um despertar, que
`awakenings` já modela. A regra está declarada no comentário da coluna e no docblock da
leitura. É do mesmo tipo que a escolha das 08:00 UTC: não muda o desfecho do §3, e é escolha.

**E esta escolha foi feita às cegas, o que precisa estar escrito.** As duas acima —
onde a linha é gravada, quando o build falha — são sobre armazenamento e ferramenta, e
não carregam informação nenhuma sobre a hipótese. Esta carrega: ela muda *a hora de
apagar* de toda noite que tenha dois períodos, que é o desfecho primário do §3. Saber
**quantas noites** ela afeta exigiria contar noites com dois períodos no acervo — dado
que o protocolo proíbe olhar antes da execução autorizada. Então a regra foi escolhida
pelo argumento, sem o número, e é assim que ela tem de ser lida: uma decisão de
desfecho tomada sem medir o que ela desloca.

O que fecha a metade possível dessa dívida é o mesmo mecanismo do acréscimo: **cada
execução carimba quantas noites colapsaram**, em `acervo_noites_colapsadas`. A primeira
execução autorizada é, portanto, também a primeira vez em que esse número existe — e ele
fica ao lado do veredito que ele ajudou a produzir, em vez de ser descoberto depois lendo
código. Como os outros carimbos, ele não impede nada: obriga a dizer em voz alta.

## Resumo do que este documento altera

| § | Antes | Depois |
|---|---|---|
| 10 (endereço) | grava em `edicoes_ia` com `caderno='lua'` | grava em `lua_execucoes`, com a cadeia inteira |
| 10 (barreira) | quebra o build *com execução já gravada* | quebra o build sempre |
| 10 (sha da cadeia) | — | intocado: a sha de cada documento é constante |
| 10 (contador) | — | intocado |
| 10 (dívida) | nomeada, e aberta | nomeada, aberta, e **carimbada em cada execução** |
| 1 · 2 · 3 · 4 · 5 · 6 · 7 · 8 · 9 · 11 | — | intocados |

## Este documento também é imutável, e a cadeia tem quatro elos

A cadeia é **append-only**, e o gesto é o mesmo da correção de 08/09: este arquivo
acrescenta um par `{ arquivo, sha256 }` à lista que o código guarda, e a barreira do build
pina os **quatro**. Divergiu qualquer um, o build quebra.

Se uma **terceira correção** for necessária, ela é **outro documento** — o **quinto elo** da
cadeia —, e cita os quatro. (Na contagem corrida dos ajustes, ela abre na Correção 5: esta
trouxe a 3 e a 4.) Esta cadeia é o registro de quantas vezes a regra mudou — e o contador de
execuções é o registro de quantas vezes o teste rodou. Os dois existem pelo mesmo motivo, e
nenhum dos dois impede nada.
