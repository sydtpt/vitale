# 0058 — A execução lunar é uma linha por fase, e é o banco que cobra as quatro

**Status:** aceita
**Data:** 2026-09-29
**Complementa:** [0057](0057-a-parede-mostra-meses-e-o-ano-e-quatro-tiras.md) e
[0055](0055-a-morte-de-uma-metrica-e-medida-contra-o-ritmo-dela.md) (a mesma casa: o que a revista
afirma tem de ser cobrável), [0036](0036-saude-do-sono-e-contagem-nao-placar.md) (o sono como
contagem declarada) e [0049](0049-o-motor-escreve-palavras-e-o-codigo-escreve-numeros.md)
(o código escreve os números)
**Story:** 4.2b do Épico 4 da Revista —
[spec](../../_bmad-output/implementation-artifacts/spec-4-2b-lua-execucoes-e-a-cadeia.md)
**Autoridade:** os quatro documentos imutáveis de `docs/specs/revista-retrospectiva/` —
`pre-registro-lua.md` (07/09), `correcao-pre-registro-lua.md` (08/09),
`pre-registro-lua-outras-fases.md` (28/09) e
`correcao-2-pre-registro-lua-outras-fases.md` (28/09, a segunda correção e o quarto elo)

## Contexto

O teste lunar é o primeiro experimento pré-registrado do Orbe: ele pergunta se a hora de apagar
muda nas cinco noites que antecedem cada fase principal da lua. A 4.2a entregou o motor — quatro
fases, três portões, três vereditos — e **nada o gravava**.

O campo da lua tem o **problema da gaveta** como risco dominante: Cordi 2014 o nomeia no título,
e a literatura é um museu de análises que rodaram até dar. A §7 de 07/09 responde a isso não
impedindo que o dono rode o teste de novo, mas tornando **cada tentativa permanente e contável** —
a página imprime *"sexta execução"* se foram seis.

E a §9 de 28/09 acrescenta a regra que fecha a porta dos fundos: *"uma execução autorizada calcula
as quatro fases, grava as quatro e publica as quatro. É proibido rodar uma fase, ver o resultado e
decidir se roda as outras."* Sem ela, o jardim dos caminhos que se bifurcam tem quatro portas em
vez de uma.

Três coisas eram verdade quando esta decisão foi tomada:

1. **A tabela não existe ainda.** A migração `20260928130000_lua_execucoes.sql` **não foi
   aplicada**. Mudar o schema hoje é de graça; depois custa uma segunda janela do dono.
2. **`edicoes_ia` não serve**, por três impedimentos independentes já escritos na correção de
   08/09: o CHECK de `caderno` recusa `'lua'`, a chave primária transforma o *acumula* em
   *substitui*, e não existe `tipo_periodo` para "todo o histórico".
3. **O SQL não era lido por teste nenhum.** Medido em 29/09: apagar o bloco inteiro do
   `create constraint trigger`, ou o `enable row level security`, ou qualquer `constraint … check`
   nomeada deixava as duas suítes do núcleo **verdes**. Só as listas `in (…)` e os nomes de coluna
   eram cobrados.

## Decisão

**1. O grão é uma linha por FASE por execução**, com chave primária
`(user_id, execucao_id, fase)`. É o precedente literal da story 1.9, quando `edicoes_ia` passou a
ter `caderno` na chave. As colunas de execução — identificador, hora, cadeia, operacionalização,
acervo — repetem nas quatro linhas: denormalização deliberada, quatro linhas por execução numa
cadência de uma execução a cada cem noites.

**2. "As quatro ou nenhuma" é cobrado pelo BANCO**, por um
`create constraint trigger … deferrable initially deferred` que, no commit, exige que todo
`execucao_id` tenha exatamente quatro linhas e quatro fases distintas. Escrita parcial não é
proibida: é **impossível**. O `deferrable` é o que torna a regra cobrável — sem ele a primeira das
quatro linhas já violaria a contagem e a escrita inteira ficaria impossível. É o mesmo mecanismo
que a 1.9 usou para permutar posições, pelo mesmo motivo: a invariante vale no fim da transação,
não no meio dela.

**3. A tabela ACUMULA, e a RLS é por verbo.** `insert` e `select`, e mais nada: **não há policy de
`update`** (um veredito reescrito no lugar é o oposto do *acumula, nunca substitui* da §7.2) **nem
de `delete`** (a execução sumiria pela API sem deixar rastro de ter sumido). Apagar uma execução
**inteira** continua sendo o único desfazer que existe, e passa a exigir o dono agindo como
superusuário — de propósito, e em voz alta. O ramo `DELETE` do gatilho fica, porque é esse caminho
que ele precisa cobrar.

A policy de `select` não é enfeite: o gatilho é `security invoker` e **conta pelos olhos de quem
escreveu**. Sem `select`, a contagem enxerga zero, o ramo "execução vazia" retorna calado, e o
"quatro ou nenhuma" para de ser cobrado sem que nada acuse.

**4. Nulo é "não foi medido", nunca zero**, e o `comment on column` de toda coluna nullable
**contém** a cláusula `NULO = …`. Quinze colunas. Contém, e não "começa por": a frase útil vem
antes, e exigir a posição seria exigir a pior das duas redações — o precedente
(`edicoes_ia.metrica_lider`) também contém.

**5. Cada execução carimba o que decide o resultado e não vive em documento hasheado.** Seis
carimbos: a janela, a hora do fim da noite e a borda direita (a dívida que o §10 de 28/09 nomeia);
a **versão do motor**, presa por golden do sha256 de `sleep/lua-protocolo.ts`; o **alcance pedido**
(`pedido_desde`); e as **noites colapsadas**. Nenhum impede nada — todos obrigam a dizer em voz
alta, que é o propósito declarado da §7.3.

**6. O SQL é cobrado por teste.** `architecture.test.ts` passou a exigir, no texto da migração, o
gatilho pelo nome, o `deferrable initially deferred`, a RLS, as policies **por verbo** e a lista
fechada das dezessete `constraint … check` nomeadas — com prova de não-vacuidade por mutação. O
comportamento é cobrado pelo cenário `supabase/ensaio/cenarios/lua-execucoes.sql`, que roda num
Postgres de verdade e confere cada CHECK **pelo nome da constraint**, não pela mensagem.

## Alternativas rejeitadas

**Uma linha por execução, com os quatro vereditos dentro.** Espremeria quatro conjuntos de
veredito, efeito, p, poder, contagens e portão numa linha larga ou num `jsonb` sem tipo, e
**perderia o CHECK** de cada um. A §9 é uma regra sobre as quatro *rodarem juntas*; ela não pede
que morem na mesma linha.

**"Quatro ou nenhuma" só na porta em TypeScript.** Um `insert` de quatro linhas numa statement já
é atômico, e isso resolve o caminho feliz — mas deixa a regra dependendo de o único chamador estar
certo, e este par de documentos existe **para não depender de disciplina**. Um script, um backfill
ou uma chamada à mão não passam pela porta.

**`for all` na policy, como nas tabelas irmãs.** É o que as outras fazem, e é por isso que quase
passou. `for all` concede `update`: o arquivo argumenta por três parágrafos que "acumula, nunca
substitui" tem de ser do banco, e a policy dava ao app exatamente a faca que o argumento recusa.

**`pg_advisory_xact_lock`, como em `edicao_imprimir`.** Não é preciso: execuções acumulam e nunca
permutam, então duas concorrentes escrevem `execucao_id` distintos e não disputam linha nenhuma. A
corrida que a 1.9 tinha não existe aqui.

**Cobrar no banco que as colunas de execução concordem entre as quatro linhas.** Exigiria um
`having` sobre valores que podem ser nulos, cuja semântica de `distinct` com nulo é uma armadilha,
e um erro ali custaria uma segunda janela de migração. A conferência mora na fronteira de leitura,
que é onde a discordância produziria a mentira.

**Gerar o `execucao_id` no cliente.** O Hermes não tem `crypto.randomUUID`, o repositório nunca
gerou uuid fora do banco, e um `default gen_random_uuid()` daria **um id por linha** — a própria
coisa que o gatilho recusa. O default é um `md5` de `auth.uid()`, `txid_current()` e o instante da
transação: constante para as quatro linhas por construção.

## Consequências

**O que isso dá.** A §9 deixa de ser disciplina e vira atomicidade. O contador da §7.4 passa a
contar tentativas de verdade, porque nada as apaga pela API. E o SQL, que era um arquivo de texto
que ninguém abria, passa a ter duas redes: o texto (offline, no build) e o comportamento (o cenário
do ensaio, na janela).

**O que isso custa.** Dezessete constraints nomeadas são dezessete coisas a manter, e a lista
fechada do teste reprova tanto quem apaga uma quanto quem acrescenta sem listar — de propósito, e é
atrito real. O `delete` fechado significa que corrigir uma execução gravada por engano exige acesso
de superusuário; isso é o desenho, e vai doer no dia em que doer.

**O que custa reverter.** Enquanto a tabela estiver **vazia**, quase nada: um `drop table` limpo,
que está escrito no fim do `aplicar.sh`. Depois da primeira execução autorizada, **reverter é
destruir a pilha de tentativas** — que é a peça anti-gaveta inteira, e a única coisa que este
desenho existe para proteger. A janela de reversão barata fecha no dia em que o dono roda o teste
pela primeira vez.

**O que fica em aberto.** A story 4.3 decide se a barreira do hash migra de
`sleep/lua-carimbo.test.ts` (onde ela já reprova o build hoje, incondicionalmente) para
`architecture.test.ts`, e se passa a cobrir também a operacionalização — que hoje é carimbada e
nunca impedida. E a 4.4 é quem lê: nenhuma tela toca esta tabela até ela existir.
