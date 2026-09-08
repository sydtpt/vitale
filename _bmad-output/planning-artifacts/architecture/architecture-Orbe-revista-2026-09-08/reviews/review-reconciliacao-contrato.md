---
tipo: review-de-reconciliacao
alvo: ../ARCHITECTURE-SPINE.md
entradas:
  - ../../../../../docs/specs/revista-retrospectiva/spec.md
  - ../../../../../docs/specs/revista-retrospectiva/cadernos.md
  - ../../../../../docs/specs/revista-retrospectiva/bases-e-ranqueamento.md
  - ../../../../../docs/specs/revista-retrospectiva/mudancas-mecanicas.md
  - ../../../../../docs/specs/revista-retrospectiva/pre-registro-lua.md
data: '2026-09-08'
pergunta: 'o que das entradas NÃO aterrissou na espinha?'
---

# Revisão de reconciliação — a espinha contra o contrato

> Esta revisão não julga as decisões da espinha. Ela pergunta uma coisa só: **o que
> o contrato diz e a espinha não carrega?** Onde a espinha decidiu diferente do
> contrato de propósito e disse que estava decidindo, está certo por definição — o
> problema é quando ela decide diferente **em silêncio**, ou quando um requisito
> some entre a última restrição e a primeira AD.

## Veredito

A espinha é forte onde o contrato lhe pediu invariantes mecânicas — a chave e a
posição deferida (AD-4), a tabela da capa (AD-3), a barreira do hash (AD-7), a
recusa em alargar `RetroBlockId` (AD-2) — e **fraca exatamente onde o contrato
falou em prosa**: quatro das dezenove restrições não aterrissaram em lugar
nenhum, e três das quatro são as que protegem o produto de si mesmo (o tom, a
geração não solicitada, e o teto do alfabeto da verificação). O arquivo onde
essas três seriam implementadas — `packages/shared/src/ia/prompt.ts` — **não
aparece uma única vez** na espinha: nem numa AD, nem no Structural Seed, nem no
mapa de capacidades.

## Contagem

| Severidade | N |
|---|---|
| Crítico | 2 |
| Alto | 4 |
| Médio | 10 |
| Baixo | 5 |
| **Total** | **21** |

---

## Achados críticos

### C1 — O prompt não tem dono, e com ele some a lei do tom

**Onde:** espinha inteira (ausência); mapa de capacidades, linha CAP-5.
**Contra:** restrição 1 (*"É um jornal: informa, não aconselha"*), CAP-5,
`cadernos.md` §"O sumário", `mudancas-mecanicas.md` §Núcleo.

`packages/shared/src/ia/prompt.ts` existe (168 linhas, `PROMPT_VERSAO = 2`) e é o
único lugar onde três obrigações do contrato podem ser implementadas. A espinha
não o menciona. A consequência tem três camadas:

1. **A lei do tom perde o único ponto de apoio que tinha.** Conferido no código:
   `verificar.ts` reprova por quatro regras — `'numero' | 'causa' | 'correlacao'
   | 'ressalva'` (`verificar.ts:22`). **Não há regra de conselho.** *"Informa,
   não aconselha"* nunca foi mecânico e nunca vai ser; ele vive nas leis do
   prompt. A espinha adiciona uma quinta regra ao verificador (base sem nome) e
   nada ao prompt — então a restrição que abre a lista de restrições do contrato
   é a única sem nenhum dono na arquitetura. A tabela *Consistency Conventions*
   governa nomeação, ausência, escrita, carimbo, cor, barreira e efeméride. Não
   governa voz.

2. **CAP-5 está mapeada só para o verificador.** A linha do mapa é
   `CAP-5 nomear a base | ia/verificar.ts | bases-e-ranqueamento.md`. Mas
   *"o texto é obrigado a nomear a base"* é uma obrigação do **gerador**, cobrada
   pelo verificador. Sem trabalho correspondente no prompt, a quinta regra
   reprova quase todo texto e o resultado observável é uma frente que não imprime
   — não uma frente que imprime melhor. `bases-e-ranqueamento.md` é explícito:
   *"Três bases com nome é uma gramática"* — gramática se ensina no prompt.

3. **A regra da primeira frase perdeu a contrapartida declarada.** A AD-11 trata
   a chamada como pura extração e vende isso como barateamento: *"não há valor
   novo a verificar"*. Mas `cadernos.md:116` já tinha declarado o preço: *"A
   contrapartida é uma regra a mais no prompt — o modelo escreve a primeira frase
   sabendo que ela vira capa e sumário."* A espinha ficou com o benefício e
   deixou o custo fora. E o efeito é maior do que parece: a primeira frase passa
   a ser o texto **mais exposto do produto** (capa + sumário + parede de 436
   capas) e é o único que nenhuma das cinco regras avalia. `"Este mês foi
   tranquilo."` passa em todas as cinco e vira manchete de capa.

**Correção mínima:** uma AD que dê dono ao prompt, declare `PROMPT_VERSAO 3` como
o veículo das três obrigações (tom, gramática das bases, primeira frase-manchete)
e registre no mapa que CAP-5 mora em `ia/prompt.ts` **e** `ia/verificar.ts`.

---

### C2 — *"A revista nunca gera sozinha"* não aterrissou, e a AD-1 constrói justamente a superfície onde ela cai

**Onde:** AD-1; Structural Seed (`app/revista/[tipo]/[inicio].tsx`); mapa, CAP-9.
**Contra:** restrição 9, CAP-9, `cadernos.md` §"Postal — semana", Assunção 1.

A restrição diz, com o mecanismo junto: *"Abrir a retro só lê; imprimir é ato do
usuário, **senão folhear seis meses dispara seis chamadas pagas**."* A espinha
nunca a cita, e a AD-1 cria a única superfície do sistema onde ela pode ser
violada: uma rota **endereçável** `/revista/[tipo]/[inicio]` mais uma parede de
436 capas navegáveis. A AD-1 declara o que **não** tem rota (*"período em curso e
`all`"*) e fica muda sobre o que acontece quando a rota existe e as linhas não —
que é o caso de 436 edições até o backfill rodar, e de toda edição nova para
sempre.

Pior: **o postal da semana não tem rota nenhuma.** CAP-9 exige três formas e abre
dizendo que não são *"a mesma forma em profundidades diferentes"*; `cadernos.md`
declara o postal *"sem sumário"*, *"não grava edição"*, *"calcula na hora"*; a
Assunção 1 diz *"a semana é impressa sob demanda"*. O Structural Seed dá **um
arquivo só** — `[tipo]/[inicio].tsx` — para os três objetos, e a única outra
menção à semana na espinha inteira está no *Deferred*, como argumento para não
fazer backfill dela.

Isso deixa em aberto a pergunta mais cara da frente: `/revista/week/2026-08-24`
existe? Se existe e "calcula na hora", **abrir a URL é uma chamada paga** — o
cenário literal que a restrição nomeia. Se não existe, CAP-9 não tem como ser
satisfeita. A espinha é a dona da decisão de roteamento (foi ela que criou a
rota) e não decidiu.

**Correção mínima:** estender a AD-1 com a regra de geração — *ler uma rota nunca
imprime; imprimir é ato explícito, e o postal, por não gravar, ou é ato explícito
sem cache ou não é rota* — e dizer no seed como as três formas se separam.

---

## Achados altos

### A1 — O portão de verificação é desenho, não invariante

**Contra:** restrição 19 (*"verifica antes de gravar, sempre, em qualquer
hospedeiro"*), restrição 3, paradigma da própria espinha.

O paradigma é *"pipeline puro com **portão de verificação**"* e o mermaid põe
`verificarTexto` entre a narração e o `upsert`. Conferido no código: `upsertEdicao`
(`packages/shared/src/data/edicoes-ia.ts:108`) recebe `EdicaoInput` com `texto:
string` e grava. **Nada — nem tipo, nem barreira, nem AD — impede gravar sem
passar pelo portão.** O docblock do arquivo até avisa (*"um texto só vira edição
pelo `verificarTexto`"*), mas aviso em comentário é revisão de código, que é
exatamente o que a AD-7 herdada proíbe como mecanismo.

O que torna isso um achado e não uma observação: a AD-12 aplica o raciocínio
certo à barreira errada. Ela estende a varredura do `.from()` para `scripts/` com
a frase *"invariante que vale só para quem chegou primeiro não é invariante"* — e
não aplica a mesma régua à restrição mais forte do contrato, que é justamente
sobre hospedeiros novos. O hospedeiro novo é o que vai gravar **436 edições de
uma vez**.

**Correção mínima:** ou um tipo que só o verificador produz (`TextoVerificado`)
como entrada de `upsertEdicao`, ou uma barreira que recuse `upsertEdicao` fora do
módulo que verifica. Uma das duas, no mesmo commit — pela própria convenção da
espinha.

---

### A2 — AD-3 e AD-4 se contradizem sobre quando a capa pode ser recarimbada

**Contra:** restrição 5 (*"período fechado congela"*), CAP-7, CAP-10.

- **AD-3:** a capa é *"carimbada na **primeira** impressão e **nunca tocada por
  reimpressão parcial**"*.
- **AD-4:** *"toda impressão — inteira ou parcial — é **um `upsert` das quatro
  linhas numa chamada só**"*.

A AD-4 **apaga a distinção** de que a AD-3 depende. Depois dela não existe estado
que diga ao gravador em qual dos dois casos ele está: as duas operações são
literalmente a mesma escrita. E a AD-3, ao proibir só a reimpressão *parcial*,
deixa a reimpressão *inteira* indefinida — o que produz dois desfechos, ambos
ruins:

- se a reimpressão inteira **pode** recarimbar, a capa de agosto muda em outubro,
  que é exatamente o que `cadernos.md:81-85` e `mudancas-mecanicas.md:38-41`
  criaram o carimbo para impedir;
- se **não pode**, a regra deveria dizer *"nunca tocada por reimpressão"*, ponto —
  e aí "carimbada na primeira impressão" vira a regra inteira.

Vale notar o que a espinha acertou aqui e não conectou: a manchete da capa
continua derivada (`cadernos.md:79`, AD-11 *"nenhum campo novo no banco"*), e
toda reimpressão recalcula `posicao`. Logo **a manchete da capa de uma edição
fechada pode mudar sem que a foto mude**. As entradas aceitam isso; a espinha não
o menciona, e é uma consequência direta de duas ADs suas.

---

### A3 — *"Mais números autorizados enfraquecem a verificação"*: a espinha acrescenta números e não paga

**Contra:** restrição 17, `bases-e-ranqueamento.md` §"Por que ela é conserto".

A restrição termina com uma obrigação explícita e endereçada: **"Quem acrescentar
número tem que dizer como compensa."** A espinha acrescenta e não diz.

O caso mais afiado é da própria AD-10. CAP-6 põe *"as horas de luz do período e o
delta contra o mesmo período do ano anterior"* nos **quatro** pacotes. As horas de
luz na Bélgica vão de **~8 a ~16** — inteiro pequeno entre 0 e 100, que é
precisamente o formato que `bases-e-ranqueamento.md` mediu como o de maior risco:

> *inteiros entre 0 e 100 presentes no alfabeto: 16* … *um inteiro alucinado entre
> 0 e 100 passa na conferência 16% das vezes* … *o risco é inteiro pequeno.*

A AD-10 decide **onde a coordenada mora** e não toca no efeito sobre o alfabeto.
Somam-se: o quilômetro carimbado na legenda (AD-3), o `periodos: n` de
`FatoTendencia`, e os números da moldura lunar. O contrato tinha um teste de
admissão para número novo; nenhuma AD o aplicou.

Para calibrar: `bases-e-ranqueamento.md` **paga** esse preço duas vezes — nomear a
base como gramática, e a trajetória como *"um inteiro"* em vez de N. A espinha
herdou o padrão e não o seguiu.

---

### A4 — A migration não roda: as 7 edições em produção somem da espinha

**Contra:** Assunção 3, `mudancas-mecanicas.md` §"As 7 edições hoje em produção".

Conferido na migration existente (`20260906150000_edicoes_ia.sql`): a tabela tem
`primary key (user_id, tipo_periodo, inicio, fim)` e sete linhas em produção. A
espinha muda a PK para incluir `caderno` e adiciona `posicao smallint not null`.
**Uma coluna `not null` com CHECK sobre sete linhas existentes falha**, a menos
que elas sejam removidas ou recebam valor.

O contrato resolve isso duas vezes:
- Assunção 3: *"as sete edições são removidas **junto com a migration**, não
  antes"*;
- `mudancas-mecanicas.md:82`: o argumento a favor de remover *"passa a valer no
  dia em que `pacote_versao` sobe"* — e a Stack da própria espinha pina
  `PACOTE_VERSAO 1 → 2`. **Esse dia é este épico.**

A linha do Structural Seed é `supabase/migrations/ # edicoes_ia (chave + posicao
deferida) · edicoes_capa · lua_execucoes`. Nada sobre as sete linhas. É a única
coisa nesta frente que impede o primeiro commit de banco de aplicar.

---

## Achados médios

### M1 — Repetição divergente de `mudancas-mecanicas.md` no Structural Seed

A espinha declara na abertura: *"Onde `mudancas-mecanicas.md` já decide — … o que
sai do código … — esta espinha **cita e não repete**."* E aí repete, incompleto.

| `mudancas-mecanicas.md` §"O que sai do código" | Structural Seed |
|---|---|
| `RetroPrefs.order` · `moveBlock` | `order`, `moveBlock` ✓ |
| `layoutEditable` · `proofStartedOn` · `PROOF_DAYS` | só `PROOF_DAYS` |
| `DEATH_DAYS` · `deadBlocks` | só `DEATH_DAYS` |

Os três omitidos existem hoje: `proofStartedOn` (`retro-blocks.ts:89`, campo de
`RetroPrefs`), `layoutEditable` (`:170`), `deadBlocks` (`:183`). O de
`proofStartedOn` não é cosmético: é **campo do jsonb**, e portanto toca
diretamente a afirmação *"sem migration continua verdade"* da AD-2 — se ele sai
do tipo, o jsonb em produção passa a carregar uma chave que ninguém resolve.
Repetição divergente num ponto que a espinha usa como argumento noutro lugar.

### M2 — O diagrama ER contradiz a AD-3 e apaga a linha de crédito

```
edicoes_ia ||--|| edicoes_capa : "uma capa por edição"
```

`||--||` é **um para exatamente um**. A razão de existir da AD-3 é que uma edição
são **quatro** linhas em `edicoes_ia` e uma capa — *"quatro cópias da mesma capa …
o mesmo defeito que o contrato recusou para a ordem"*. O diagrama desenha
exatamente o que a AD nega.

No mesmo bloco, `edicoes_ia` aparece com sete campos e **sem a linha de crédito**:
`provedor`, `modelo`, `prompt_versao`, `pacote_versao`, `motivo_de_parada`,
`agg_version_no_momento`. Todos `not null` na migration atual (menos o último), e
todos load-bearing: são a *"assinatura completa"* que CAP-13 exige do backfill
(condição 2 de `mudancas-mecanicas.md`) e o mecanismo inteiro da errata
(`precisaErrata` lê `agg_version_no_momento`). O diagrama é da espinha; a omissão
é dela.

### M3 — O teste dos dois hospedeiros é impossível como escrito, e a AD-10 o repete

`mudancas-mecanicas.md:173`: *"**Teste obrigatório:** mesmo pacote, dois
hospedeiros, mesmo texto verificado."* CAP-13: *"a edição de agosto assim
produzida é **idêntica** à que o telefone produz."* A AD-10 repete a exigência para
justificar a coordenada constante: *"os dois hospedeiros produzem a mesma edição
verificada"*.

Mas o texto sai de um modelo, através de `ia-narrar`, e a **própria Stack da
espinha** declara: *"Provedor e modelo de IA — configuração, não arquitetura
(ADR 0040) — nenhuma versão aqui, por desenho."* Identidade byte a byte entre dois
hospedeiros não é obtenível, e não é obtenível **por decisão desta espinha**.

O invariante testável é outro — *mesmo pacote, mesma ordem, mesma assinatura,
ambos verificados* — e escolher qual dos dois vale era trabalho de reconciliação.
A espinha repetiu a frase impossível em vez de resolvê-la, e o teste obrigatório
não aparece em nenhuma AD nem na convenção de barreiras.

### M4 — "Três hospedeiros" no paradigma, dois no diagrama

O parágrafo central diz *"quatro estágios e **três hospedeiros** que o executam
igual"*. O subgrafo `host` desenha **dois**: `H1 iPhone` e `H2 backfill`. Ou é erro
de contagem na frase que define o paradigma inteiro, ou o terceiro é a web — que é
**não-objetivo declarado** e que a AD-8 recusa explicitamente doze linhas antes.
Um leitor de boa-fé pode ler a espinha como autorizando a web; é a forma mais
barata de reintroduzir um não-objetivo.

### M5 — O terceiro hospedeiro nasce fora do portão do AD-17 herdado

A AD-12 põe `scripts/` *"fora dos três"* workspaces e estende **uma** varredura (a
do `.from()`) para cobri-lo. Não estende o portão. Os comandos de validação do
repositório são por workspace (`--filter @vitale/shared`, `@vitale/web`, `cd
mobile`): `scripts/` não recebe `tsc --noEmit`, não recebe teste, não recebe lint,
e não entra no CI. É o hospedeiro que grava 436 edições em produção.

A espinha usa o argumento certo — *"invariante que vale só para quem chegou
primeiro não é invariante"* — e para na barreira menor. A AD-17 herdada
(*"o portão cobre os três workspaces"*) é citada na tabela de herdadas para outra
coisa (`onAccent`) e não para o hospedeiro novo.

### M6 — A cadência do pré-registro foi relaxada em silêncio

Restrição 11: *"Reexecução a cada +100 noites, com contador visível."* Pré-registro
§7.5: *"**Cadência pré-fixada:** reexecuta a cada +100 noites, **não por
vontade**."*

AD-5: *"nada impede reexecutar — o §7 do pré-registro pede que cada tentativa seja
*permanente e contável*, não que seja impedida."* Isso é leitura fiel dos §7.1–7.4
e **omite o §7.5**, que é justamente a trava contra refazer até dar certo. A
espinha converte uma cadência em um contador. Como a AD-5 é a que enumera *"as
colunas que a moldura fixa obriga"*, era ali que a cadência precisava virar dado —
e não virou: **a "próxima leitura" que CAP-12 manda imprimir não está na lista de
colunas** e nenhuma AD diz de onde ela sai.

### M7 — A AD-7 contradiz uma restrição do SPEC, e o documento de correção não vai cobri-la

A AD-7 torna a barreira do hash **incondicional** e declara: *"Isto corrige o
pré-registro e entra no documento de correção junto com o AD-5."* Correto quanto
ao §7.3. Mas a condicional também é **restrição 11 do `spec.md`**: *"hash
divergente **com execução já gravada** quebra o build"* — e o `spec.md` se declara
*"contrato canônico … o contrato completo do que construir, testar e validar"*.

O documento de correção previsto cita o **pré-registro**. A divergência com o
contrato canônico fica sem registro em lugar nenhum. É uma decisão boa (mais
estrita, offline, fiel ao cabeçalho do documento imutável) documentada contra o
arquivo errado.

### M8 — `app/revista/lua.tsx` é rota irmã da edição, e nenhuma AD a governa

Pré-registro §8: *"Não é caderno. É uma **página dentro do caderno Sono**."*
Não-objetivo 4: *"**Caderno de lua.**"* — com o mecanismo explicado (*"pressão para
ter o que dizer todo mês é o mecanismo que produz o problema da gaveta"*).

O Structural Seed cria `app/revista/lua.tsx` como irmã de `[tipo]/[inicio].tsx`, e
a AD-1 — que é a AD das portas, e que se dá ao trabalho de declarar que a parede
de capas *"é irmã da rota, não filha dela"* — **não menciona a lua**. A contenção
navegacional que separa "página dentro do Sono" de "caderno próprio" existe hoje
só como prosa num arquivo imutável.

No mesmo tema, a AD-5 enumera *"colunas que a moldura fixa obriga"* sem fechar a
lista, e o §6 do pré-registro (*secundários … sem valor de p promovido a manchete,
e **sem entrar na capa da edição sob nenhuma condição***) não tem dono na espinha —
nem na AD-5, nem na AD-3, que é a AD da capa.

### M9 — `CadernoId` passa a ser persistido em dois lugares, e só um tem guarda

A convenção de nomeação da espinha diz: *"o CHECK de `edicoes_ia.caderno` é **a
lista canônica**"*. A AD-2 grava o mesmo vocabulário num segundo lugar —
`retro_prefs.cadernosOcultos` — e escolhe esse lugar **porque ele não tem CHECK de
forma**, usando a ausência de cobertura como argumento de barateamento (*"sem
migration continua verdade"*).

A barreira que o repositório já tem (*"todo CHECK de id em `user_preferences` cobre
os ids que o app grava"*) varre colunas de id; jsonb não entra. Resultado: um
vocabulário canônico novo nasce com duas sedes de persistência e uma guarda. A
espinha, que criou a convenção "lista canônica", não exigiu que o escritor do jsonb
validasse contra ela.

### M10 — As contradições que o levantamento achou não sobreviveram ao artefato durável

O `.memlog.md` desta passagem registra quatro contradições *"trazidas e não
resolvidas (o dono pediu assim)"*. Nenhuma aparece na espinha, que não tem seção de
divergências conhecidas. Duas ainda mordem:

- **(i) a efeméride não é nova.** `mudancas-mecanicas.md:96` lista *"efeméride (sol
  e lua) | **novo**"*. Conferido: `packages/shared/src/astro/` já existe com
  `sun.ts`, `moon.ts`, `timezone-coords.ts` e testes. A espinha **declara
  `mudancas-mecanicas.md` autoritativo** (*"onde ele decide, esta espinha cita"*) e
  sabe que ele afirma uma falsidade — e não marca. Um construtor que siga a
  instrução de citar vai escrever efeméride do zero.
- **(ii) *"a capa não ganha coluna no banco"*** continua escrito em
  `cadernos.md:72` e em `DESIGN.md:379` (companion adotado). A AD-3 supersede na
  prática; nada no contrato diz isso a quem ler o companion primeiro.

O memlog é efêmero por decisão herdada (AD-10 da iniciativa: `_bmad-output/`
efêmero, `docs/` durável). O achado morre com ele.

---

## Achados baixos

### B1 — A AD-8 mede o piso num ponto de uso e publica um token de sistema

A justificativa do piso 3,0 é nominal e específica: *"o nome do caderno é 22 px
peso 700, e **isso é texto grande no WCAG**"*. Mas `onAccent` entra em `RoleTokens`
**e** `ModuleTokens` — está disponível para qualquer consumidor, em qualquer
tamanho. A barreira certifica *"≥ 3,0 nas 36 combinações"*, que é uma afirmação
sobre o token; a justificativa é sobre uma chamada. Um rótulo de 13 px com
`onAccent` passa na barreira e é ilegível. Falta a metade da regra que diz **onde
o token pode ser usado**.

### B2 — "Configuração" trocada por "constante" sem declarar a troca

Assunção 5 do spec: a coordenada é *"definida em **configuração**"*.
`mudancas-mecanicas.md` §Coordenada: *"o lugar do usuário passa a ser
**configuração** … onde exatamente ela mora, e o que acontece com viagem, é questão
aberta."* A AD-10 decide *"constante no núcleo"* — resolução legítima da questão
aberta, mas "configuração" é termo de arte neste contrato (ADR 0040, restrição 6), e
a espinha troca o termo sem dizer que trocou.

### B3 — AD-10 e AD-5 se cruzam sobre "nunca gravado"

AD-10 afirma a restrição 14: *"Sol e lua continuam derivados na leitura e **nunca
gravados**"*. AD-5 lista **"a janela medida"** entre as colunas de `lua_execucoes` —
que é valor derivado da efeméride, persistido. É defensável (registro de execução,
não efeméride corrente) e provavelmente necessário para o §7 do pré-registro, mas as
duas ADs se contradizem na letra e nenhuma diz qual vence.

### B4 — Grounding/Search perde o dono

Não-objetivo 11: *"Grounding / Search no modelo (ADR 0040 — retenção de 30 dias em
qualquer tier)"* — uma proibição com razão de privacidade. A Stack arquiva
provedor e modelo como *"configuração, não arquitetura"*, e com isso a proibição
sai da arquitetura sem entrar em lugar nenhum: nenhuma barreira, nenhuma AD,
nenhuma linha de *Deferred*.

### B5 — A emenda à ADR 0045 perde a condição bloqueante

Assunção 4: *"A ADR 0045 precisa de emenda **antes de construir** a página da
lua."* No Structural Seed, `correcao-pre-registro-lua.md` carrega a ordenação
(*"obrigatório antes de construir a lua"*); a linha da ADR carrega só *"ADR nova que
supersede em parte"*. Dois pré-requisitos de construção, um deles marcado.

---

## Passagem pelas 19 restrições

| # | Restrição | Status | Onde / achado |
|---|---|---|---|
| 1 | É um jornal: informa, não aconselha | **não aterrissou** | C1 |
| 2 | Estatística acha; o modelo prioriza e narra | coberto por delegação | regra `causa` já existe em `verificar.ts` |
| 3 | Todo número citado existe no pacote | coberto | paradigma + AD-11; mas ver A1 (o portão não é obrigatório) |
| 4 | Cobertura desigual obriga ressalva | coberto por delegação | regra `ressalva` existe; com um pacote por caderno, `ressalvasObrigatorias` passa a ser por caderno e ninguém declarou o efeito |
| 5 | Período fechado congela; `all` não tem edição | **parcialmente contradito** | AD-1 cobre `all`; A2 abre a capa |
| 6 | Provedor e modelo são configuração; núcleo puro | coberto | Stack; ver M5 sobre o hospedeiro fora do portão |
| 7 | A camada narra, nunca decide | coberto por delegação | `bases-e-ranqueamento.md` tira o alerta operacional da revista; a espinha não cita, nada reintroduz |
| 8 | Mobile-first | coberto | AD-8 e o seed recusam a web explicitamente |
| 9 | A revista nunca gera sozinha | **não aterrissou** | C2 |
| 10 | O sol é pré-requisito da lua | coberto | AD-5 lista `luz` entre os portões |
| 11 | Pré-registro imutável, hash, cadência +100 | **parcialmente contradito** | M6 (cadência), M7 (a condicional é do SPEC, não só do §7.3) |
| 12 | Correção do pré-registro antes de construir | **coberto exemplarmente** | `companions:` + seed + AD-5/AD-7 |
| 13 | Bump de `AGG_VERSION` marca errata em tudo | **sem dono** | nenhuma AD governa errata; o ER apaga `agg_version_no_momento` (M2) |
| 14 | Sol e lua derivados, nunca gravados | coberto, com cruzamento | AD-10; ver B3 |
| 15 | `season` continua trimestre civil | silêncio benigno | nada contradiz; mas a *"camada de luz em destaque no trimestre"* (`cadernos.md`) fica sem dono junto com as três formas (C2) |
| 16 | A ordem é coluna, congela na última impressão | **coberto exemplarmente** | AD-4 |
| 17 | Mais números enfraquecem a verificação | **não aterrissou** | A3 |
| 18 | O backfill pagina | coberto | AD-12 cita `fetchAllPages` |
| 19 | Verifica antes de gravar, em qualquer hospedeiro | **prosa, não invariante** | A1 |

---

## Passagem pelos 11 não-objetivos

| Não-objetivo | Reintroduzido? |
|---|---|
| Captura nova de qualquer espécie | não |
| As 8 métricas que nunca chegaram + tabelas zeradas | não |
| Web, PDF e e-mail | **risco** — "três hospedeiros" com dois desenhados (M4); a AD-8 recusa explicitamente, o que salva o caso |
| Caderno de lua | **estruturalmente exposto** — M8 |
| Caderno "Onde" | não — a legenda de três campos da AD-3 é o substituto, e a AD-3 diz por quê |
| Base anual e normal sazonal para Rotina | não — está em *Deferred* com data |
| Backfill em massa de semanas | não — em *Deferred*; mas o postal sob demanda fica sem rota (C2) |
| Secundários da lua como manchete; lua × 14 métricas | **sem guarda** — M8 |
| Reordenação manual do miolo | não — **a melhor defesa da espinha**, a AD-2 nomeia a porta dos fundos (`visibleBlocks`) e a fecha |
| Investigação das 4 métricas mortas | não |
| Grounding / Search no modelo | **perdeu o dono** — B4 |

---

## Onde a espinha repete em vez de citar

A instrução que ela mesma se deu está na abertura: *"Onde `mudancas-mecanicas.md`
já decide — chave de `edicoes_ia`, mudanças do núcleo, o que sai do código,
paginação do backfill — esta espinha **cita e não repete**."*

| Trecho | Repete? | Diverge? |
|---|---|---|
| AD-4, a tupla do `unique` | sim | não — e o `deferrable initially deferred` é decisão nova legítima |
| ER, colunas de `edicoes_ia` | sim | **sim** — apaga a linha de crédito e desenha 1:1 (M2) |
| Seed, "o que sai do código" | sim | **sim** — perde `layoutEditable`, `proofStartedOn`, `deadBlocks` (M1) |
| Stack, `PACOTE_VERSAO` / `PROMPT_VERSAO` | sim | não — cita a fonte na mesma célula |
| AD-5, os três impedimentos de `edicoes_ia` | sim | não — redundante com `mudancas-mecanicas.md` §"A lua não cabe aqui" e com CAP-12 |
| AD-3, o raciocínio do carimbo (`isCover`, `state === 'linked'`, `ph://`) | sim | não — verbatim de `cadernos.md:81-85` |
| AD-10, *"a mesma edição verificada"* | sim | **sim de fato** — repete uma exigência que a própria Stack torna inatingível (M3) |
| AD-12, as três condições do backfill | **não — cita pelo nome** | modelo do que a abertura prometeu |

---

## Contradições dentro das entradas que a espinha deveria ter trazido

1. **`mudancas-mecanicas.md` diz que a efeméride é "novo"; `astro/` já existe.**
   Resolvida de fato pelas AD-6/AD-10, nunca registrada — e a espinha manda citar
   o documento errado (M10).
2. **`cadernos.md:72` — *"não ganha coluna no banco"* — contra `cadernos.md:81` —
   *"a capa é carimbada"*.** A AD-3 supersede as duas com uma tabela; nada avisa
   quem ler o companion (M10).
3. **"Mesmo texto" entre dois hospedeiros × modelo não determinístico e provedor
   como configuração** (M3).
4. **§7.5 do pré-registro (cadência) × "nada impede reexecutar" da AD-5** (M6).
5. **Restrição 11 do `spec.md` × AD-7 incondicional** — a espinha vê a divergência
   com o §7.3 e não com o SPEC (M7).
6. **CAP-9 ("três objetos distintos") × um único arquivo de rota no seed**, com o
   postal tendo semântica de geração diferente das outras duas formas (C2).
7. **`EXPERIENCE.md` e o validation-report nomeiam `setAccessibilityFocus`**, API
   deprecada. A AD-9 decide certo e **é a única das quatro contradições do memlog
   que a espinha registra por escrito** — o padrão que as outras três deveriam ter
   seguido.

---

## O que a espinha acertou (calibração)

Para que a lista acima não se leia como condenação: AD-4 (deferida + um upsert,
com a saída por RPC nomeada sob a AD-5 herdada) e AD-2 (recusar alargar
`RetroBlockId` porque `order` seria a porta dos fundos do não-objetivo 9) são
raciocínio de arquitetura no melhor sentido — elas impedem coisas que dois
construtores fariam diferente e que o contrato não conseguia impedir sozinho. A
AD-3 encontra um defeito real (quatro cópias da capa) que nenhuma entrada tinha
visto. A AD-7 é mais estrita que o documento que corrige, e diz por quê. A AD-1
fecha um grafo circular que o `EXPERIENCE.md` tinha deixado aberto. A restrição
12 — a única do contrato que tem forma de pré-requisito de processo — é a mais
bem servida de todas.

O padrão dos defeitos é único e nomeável: **a espinha reconciliou tudo que tinha
forma de esquema, chave, tipo ou barreira, e nada do que tinha forma de promessa.**
As quatro restrições que não aterrissaram são as quatro que não viram tabela.
