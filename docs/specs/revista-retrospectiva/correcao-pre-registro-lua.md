# Correção ao pré-registro da lua — onde a execução é gravada, e quando o build quebra

- **Data:** 08/09/2026
- **Corrige:** [`pre-registro-lua.md`](pre-registro-lua.md), **§7.2** e **§7.3**
- **sha256 do arquivo corrigido:**
  `d09365de54bb6bbd6fa8d99af9d1f26cddaebc3492029a63d6b1b6e4f6759664`
- **Origem:** a passagem de arquitetura da revista
  (`_bmad-output/planning-artifacts/architecture/architecture-Orbe-revista-2026-09-08/`),
  AD-5 e AD-7

> **Por que este documento existe.** O pré-registro é imutável, e ele próprio prescreve a
> única saída: *"correção só por documento novo, que cita este e diz o que mudou e por
> quê"*. É o que este é. **O arquivo corrigido não foi editado** — a sha256 acima é a prova,
> e é a mesma constante que o código compara antes de rodar o teste.

## A garantia que sustenta as duas correções

**Nada aqui toca o desenho do teste.** As duas correções caem inteiras dentro do **§7**, que
é a seção de mecânica anti-gaveta — *como* cada tentativa se torna permanente e contável.

Seguem **intocados, palavra por palavra**:

| Seção | O que ela fixa | Estado |
|---|---|---|
| §3 | sujeito, desfecho primário, exposição, colunas, direção, covariável, teste | intocada |
| §4 | os três portões, e que portão reprovado ⇒ inconclusivo | intocada |
| §5 | o limiar de 15 min, os três vereditos, a tabela de poder, o único número consultável antes | intocada |
| §6 | secundários exploratórios, e o que está fora de escopo | intocada |
| §8 | a lua é página dentro do caderno Sono | intocada |

**Nenhum dado foi consultado para escrever isto.** Nem mediana por fase, nem contagem por
coluna, nem o desvio-padrão que o §5 autoriza. As duas correções são sobre **onde uma linha
é gravada** e **quando um teste de build falha** — questões de armazenamento e de ferramenta,
que não carregam informação nenhuma sobre a hipótese.

Uma correção que mexesse no §3, no §4 ou no §5 **invalidaria o pré-registro**, e a saída
correta ali seria abandoná-lo e escrever outro, datado, antes de olhar de novo. Não é o caso.

## Correção 1 — a execução não é gravada em `edicoes_ia`

**O §7.2 diz:**

> *"Toda execução grava linha em `edicoes_ia` com `caderno='lua'` e o hash do pré-registro
> que a autorizou. Nunca substitui — **acumula**."*

**Passa a ser:** toda execução grava linha em **`lua_execucoes`**, com o hash do pré-registro
que a autorizou. Nunca substitui — **acumula**.

### Por quê

`edicoes_ia` não a comporta, e são **três impedimentos independentes**, nenhum dos quais se
conserta sem descaracterizar a tabela:

1. **O CHECK recusa.** A coluna `caderno` é
   `check (caderno in ('sono','movimento','coracao','rotina'))`. `'lua'` bate na parede.
2. **A chave primária torna o *acumula* impossível.** Ela é
   `(user_id, tipo_periodo, inicio, fim, caderno)`, e a gravação é `upsert`: uma segunda
   execução **substituiria** a primeira. É o oposto exato do que o §7.2 pede — e a exigência
   de acumular é justamente a que dá sentido ao contador de execuções do §7.4.
3. **Não há `tipo_periodo` para "todo o histórico".** O teste roda sobre as 290 noites
   inteiras, que não são `week`, `month`, `season` nem `year`; e `all` o CHECK também recusa,
   por desenho — período que nunca fecha não tem edição.

`lua_execucoes` tem chave própria, uma linha por execução, e acumular vira o comportamento
natural em vez de uma exceção a defender.

### O que **não** muda

O hash continua sendo gravado junto com cada execução, continua sendo o do pré-registro que
a autorizou, e continua nunca substituindo. **A intenção do §7.2 é preservada por inteiro** —
só o endereço mudou, porque o endereço original não existia.

## Correção 2 — o build quebra sempre, não só depois da primeira execução

**O §7.3 diz:**

> *"Hash divergente **com execução já gravada** ⇒ **o build quebra** (`architecture.test.ts`).
> Não para impedir: para obrigar a dizer em voz alta que o teste mudou depois de ver o
> resultado."*

**Passa a ser:** hash divergente ⇒ **o build quebra**, tenha havido execução ou não.

### Por quê

A condicional **não é construível**, e isso só apareceu quando alguém foi escrever o teste.

`architecture.test.ts` é puro e offline — roda com `npx tsx`, sem cliente de banco e sem
rede, e essa pureza é uma invariante do repositório, não um detalhe. *"Execução já gravada"*
mora no Postgres. Para cobrar a condicional, o teste precisaria consultar o banco: passaria a
depender da rede, falharia no CI por motivo alheio, e — pior — seria a espécie de teste que
fica verde por não ter executado, que é exatamente o modo de falha que a suíte proíbe.

As saídas consideradas foram três, e duas foram descartadas:

- **Livro-razão versionado no repositório**, uma linha por execução, commitada à mão, que o
  teste leria. Cria uma segunda fonte de verdade ao lado de `lua_execucoes`, mantida
  manualmente, e depende de um passo humano que acontece **uma vez a cada cem noites** — que
  é a definição de passo que se esquece. Uma divergência entre o livro e a tabela seria
  descoberta anos depois.
- **O teste consulta o banco.** Descartada pelo parágrafo acima.
- **Barreira incondicional.** Adotada.

### Por que a versão incondicional é mais forte, e não mais frouxa

Ela é **mais estrita** que o texto original: cobra em mais casos, nunca em menos. E é mais
fiel ao cabeçalho do próprio pré-registro, que não condiciona nada:

> *"**Este arquivo é imutável.** (…) Correção só por documento novo."*

Um arquivo declarado imutável não deveria poder ser editado nem **antes** da primeira
execução. A condicional do §7.3 abria, sem querer, uma janela em que a edição silenciosa era
permitida — e é exatamente na janela antes da primeira execução que mudar a regra é mais
tentador e menos visível.

O preço, declarado: **corrigir uma vírgula no pré-registro quebra o build**. A saída é a
mesma de sempre — outro documento de correção, como este. Para um arquivo que se declara
imutável, esse é o comportamento certo, não um efeito colateral.

### O que **não** muda

O propósito do §7.3, escrito nele mesmo: *"não para impedir — para obrigar a dizer em voz
alta que o teste mudou"*. Continua sendo isso. O dono continua tendo o repositório, e
continua podendo mudar o hash em dois minutos; o que ele não consegue é fazer isso **em
silêncio**.

## Resumo do que este documento altera

| § | Antes | Depois |
|---|---|---|
| 7.2 | grava em `edicoes_ia` com `caderno='lua'` | grava em `lua_execucoes` |
| 7.3 | quebra o build *com execução já gravada* | quebra o build sempre |
| 7.1 · 7.4 · 7.5 | — | intocados |
| 1 · 2 · 3 · 4 · 5 · 6 · 8 | — | intocados |

Se uma terceira correção for necessária, ela é **outro documento**, que cita este e o
pré-registro. Esta cadeia é o registro de quantas vezes a regra mudou — que é a mesma coisa
que o contador de execuções faz com o teste, e pela mesma razão.

## Este documento também é imutável, e o build o cobra

A correção de um texto imutável não pode ser um texto mutável — senão o §7.3 continuaria
valendo no papel e a regra que ele passou a delegar seria editável em silêncio.

Por isso a barreira do build **pina a cadeia inteira**, não só o pré-registro: a sha256 dele
e a **deste arquivo**, cada uma como constante. Um terceiro documento acrescenta um par à
lista, no mesmo gesto append-only da cadeia. Divergiu qualquer um, o build quebra.

