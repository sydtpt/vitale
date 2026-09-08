---
review: reconciliação UX × espinha
alvo: ../ARCHITECTURE-SPINE.md
entradas:
  - ../../ux-designs/ux-revista-retrospectiva-2026-09-07/DESIGN.md
  - ../../ux-designs/ux-revista-retrospectiva-2026-09-07/EXPERIENCE.md
  - ../../ux-designs/ux-revista-retrospectiva-2026-09-07/validation-report.md
  - ../../ux-designs/ux-revista-retrospectiva-2026-09-07/.memlog.md
conferido-contra:
  - docs/specs/revista-retrospectiva/{spec,cadernos,bases-e-ranqueamento,mudancas-mecanicas}.md
  - código em 2026-09-08 (retro-blocks.ts, theme/css-vars.ts, architecture.test.ts, services/asset-uri.ts, photos/retro.ts)
rodado: 2026-09-08
achados: 18 — 3 críticos · 6 altos · 5 médios · 4 baixos
---

# Reconciliação — o que das espinhas de UX não aterrissou na arquitetura

> **Pergunta desta revisão.** `DESIGN.md` e `EXPERIENCE.md` são **companions
> declarados de `spec.md`** (`spec.md:8-9`) — lei, não sugestão. A espinha os lista
> apenas em `sources:`. Esta revisão percorre o que eles decidiram e pergunta, item a
> item, se a decisão aterrissou, foi deferida em voz alta, ou sumiu calada.

**Veredito.** A espinha fecha bem exatamente o que uma barreira mecânica consegue
cobrar — os sete defeitos de contrato, a moradia da revista, o token de cor — e deixa
cair quase tudo o que depende de guarda de interface ou de dono nomeado: **três dos
quatro críticos de acessibilidade não têm uma linha sequer**, a tira do anuário e a
manchete da capa perdem o congelamento que CAP-7 promete, e a espinha ainda **inventa
uma invariante — "as quatro linhas" — que contradiz a forma de 22 das 39 edições do
próprio backfill**.

---

## 1 — Open Questions do EXPERIENCE.md, item a item

### 1.1 Os itens 1 a 7 (defeitos de contrato) — confirmados fechados, mas nem todos pela espinha

| # | O quê | Onde fechou |
|---|---|---|
| 1 | lua sem chave legal | **AD-5** — `lua_execucoes`, chave surrogate, colunas enumeradas |
| 2 | `hidden` não fala a língua dos cadernos | **AD-2** — `RetroPrefs.cadernosOcultos`, sem alargar `RetroBlockId` |
| 3 | emenda à ADR 0045 | **Structural Seed** (`docs/decisions/00xx-…-emenda-a-0045.md`) + AD-11 herdada |
| 4 | a capa não congela | **AD-3** — carimbo com valores resolvidos |
| 5 | lápide × caderno vazio | **a montante**: `bases-e-ranqueamento.md:92-96` ("o passo 5 vence o passo 6", 08/09). A espinha delega pela coluna *Governada por* de CAP-11 |
| 6 | `posicao` × reimpressão parcial | **AD-4** — `unique` deferida + upsert único |
| 7 | errata em massa | **a montante**: `mudancas-mecanicas.md:21-24` + Constraint do `spec.md`. A espinha não a cita |

Nada a corrigir aqui — mas registre-se que **5 e 7 foram fechados pelo contrato, não
pela espinha**. Quem ler só a espinha não encontra nenhuma das duas decisões.

### 1.2 Os itens 8 a 14 — o que se pediu para verificar

| # | Situação | Achado |
|---|---|---|
| **8** — de onde sai a chamada | **Fechado** | AD-11 fecha melhor do que o contrato: função pura, dono único, o corte que não é `indexOf('.')`, teste com milhar/decimal/abreviação, e ausência ≠ string vazia. Sem ressalva |
| **9** — o que a tira do anuário mede | **Fechado no contrato, consequência perdida** | R-1 |
| **10** — a camada de luz não tem superfície | **Sumiu** | R-2 |
| **11** — o sumário em estado misto | **Parcial** (forma do dado sim, resolução de tela não) | R-3 |
| **12** — a manchete da capa sem `posicao = 1` | **Sumiu, e a espinha ainda abriu uma incoerência nova** | R-4 |
| **13** — a ressalva de cobertura desigual | **Sumiu** | R-5 |
| **14** — o Arquivo não tem estados | **Parcial** (foto sumida sim, o resto não) | R-6 |

### 1.3 O item 15 — fechado, com um defeito de contagem

**AD-1** fecha os dois buracos (o seletor e os blocos) e ainda fecha o grafo circular de
entrada, que era achado próprio da passagem de arquitetura. Mas a mesma AD diz **"os doze
blocos"** no *Prevents* e **"os treze blocos"** no *Rule*. O código tem **13**
(`retro-blocks.ts:64-78`); a lista do `EXPERIENCE.md:103` tem 12 porque omite
`purchases`. Ver R-7.

---

## 2 — Os quatro críticos de acessibilidade do validation-report

| Crítico | Na espinha? |
|---|---|
| rolagem ancorada não move o foco | **Preservado e melhorado** — AD-9, com a API corrigida (`sendAccessibilityEvent`, não a deprecada `setAccessibilityFocus`) e o hook genérico no adaptador |
| tipo dinâmico corta a moldura da lua | **Ausente** — R-8 |
| `ink3` carrega informação obrigatória | **Ausente** — R-9 |
| o véu da capa não tem piso | **Ausente** — R-10 |

A assimetria é o achado, mais do que cada item: **a espinha converteu em barreira o
único dos quatro que já vinha medido e é barato de cobrar (`onAccent`, AD-8) e não
declarou nenhum dos três que exigem guarda de interface ou código de imagem** — nem como
regra, nem como convenção, nem como linha em *Deferred*.

Residual da mesma família, também sem remissão: *"a faixa é cabeçalho de seção para o
leitor de tela, o ícone é decorativo"*, *"ordem de leitura = ordem impressa"* e *"a
imagem da capa tem descrição textual"* (`EXPERIENCE.md` §Accessibility Floor). Ver R-14.

---

## 3 — Decisões que a espinha contradiz sem declarar

### Verificado e **não** contrariado

- *"a edição é um documento contínuo, não há paginação nem abas"* — a rota única
  `/revista/[tipo]/[inicio]` é compatível.
- *"a página da lua é a única tela filha"* — a espinha põe `arquivo.tsx` como **irmã**
  (AD-1), o que é fiel à leitura de que a parede não é filha da edição.
- *"não há gesto horizontal"* e *"não existe compartilhar em lugar nenhum"* — não
  contrariados. Mas também não referenciados: ver R-14.
- *"`onAccent` não ganha alias plano nem variável CSS"* (AD-8) — **verificado no
  código**: `theme/css-vars.ts:43-53` enumera os nove campos de papel à mão, então
  acrescentar `onAccent` a `RoleTokens` não gera var nem quebra barreira nenhuma. A
  afirmação da AD-8 se sustenta.
- *"a barreira do `.from()` varre só web e mobile"* (AD-12) — **verificado**:
  `architecture.test.ts:105-116` usa `[...webFiles, ...mobileFiles]`, e `scripts/` ainda
  não existe. A AD está certa e o commit de extensão é obrigatório.

### Contrariado

- **"a capa NÃO ganha coluna no banco"** (`DESIGN.md:379`, e `cadernos.md:72`): a
  espinha cria uma tabela inteira e nunca declara que derruba a frase. O contrato já a
  havia superseded doze linhas abaixo (`cadernos.md:84`) e em `mudancas-mecanicas.md:36`
  — mas para uma **coluna em `edicoes_ia`**, não para tabela própria, e `DESIGN.md` é
  companion adotado e continua dizendo o contrário. Ver R-12.
- **"as quatro linhas"** — contradição nova, criada pela própria espinha. Ver R-11.
- **o carimbo da capa na *primeira* impressão × a ordem que congela na *última*** —
  contradição nova entre AD-3 e AD-4. Ver R-4.

---

## 4 — Achados

### Críticos

#### R-1 — A tira do anuário mede um fato que nada congela

`cadernos.md:147-150` e o *success* de CAP-9 decidem o que a tira mede: **"o fato que
liderou o ranqueamento daquele caderno naquele mês"**. A espinha aponta CAP-9 para
`app/revista/` governada só por AD-1 (rota) e não diz de onde esse fato sai.

Só há dois caminhos, e os dois precisam de decisão:

1. **Recalcular** os doze pacotes mensais na leitura do anuário — e então a tira se
   remede sozinha quando `ordenarCadernos` ou `montarPacote` mudarem, que é literalmente
   a reescrita silenciosa de período fechado que CAP-7, a restrição *período fechado
   congela* e o sinal de sucesso do spec existem para impedir. É o mesmo defeito da
   ordem, um nível acima.
2. **Carimbar** o fato líder (chave, valor, unidade) na impressão — campo que ninguém
   declarou, em tabela nenhuma. `edicoes_ia` guarda `posicao`, que é a *ordem*, não o
   *fato*; `edicoes_capa` guarda capa.

A espinha até tem a convenção certa — *"o que congela guarda **valor**, não ponteiro a
re-derivar… vale para qualquer campo novo que a impressão congele"* — e não a aplicou ao
único lugar onde ela ainda faltava. Custo adicional: 12 pacotes por caderno por anuário,
recalculados, também é a leitura mais cara da revista inteira.

#### R-10 — O piso do véu da capa não tem dono, módulo nem menção

`DESIGN.md` §Elevation & Depth: *"o véu se aprofunda até o texto alcançar **4,5 contra o
pixel mais claro sob ele**, medido, não estimado"* — e o *Don't* correspondente: *"não
ponha texto sobre foto sem medir o véu"*.

Isto **não é regra de estilo, é código**: exige amostrar pixels de uma foto da
biblioteca em tempo de render, no aparelho, ou declarar o fallback que o próprio
`DESIGN.md` oferece (*"aí o texto sai da imagem e vai para baixo dela"*). Não há AD, não
há dono, não há módulo no *Structural Seed*, não há linha na *Stack*, não há item em
*Deferred*. É a única exigência de acessibilidade do contrato que precisa de
processamento de imagem, e é exatamente a classe de coisa que a espinha diz existir para
resolver: *"as invariantes que a construção precisaria inventar, e que dois construtores
inventariam diferente"*. Dois construtores vão inventar: um mede, o outro chuta 45% de
preto.

Agrava: a parede tem 436 capas com a mesma sobreposição de rótulo, e o `EXPERIENCE.md`
diz que **o texto sobre a capa é o único ponto em que o contraste depende de uma imagem
que o app não escolhe**.

#### R-11 — "As quatro linhas" é invariante nova, e ela contradiz a forma de 22 das 39 edições

AD-4: *"toda impressão — inteira ou parcial — é **um `upsert` das quatro linhas numa
chamada só**"*. Convenções: *"Sempre o conjunto das quatro linhas numa chamada. Nunca uma
linha avulsa"*. O diagrama do paradigma repete: *"upsert 4 linhas + capa"*. A ER desenha
`edicoes_ia ||--|| edicoes_capa`, um-para-um.

Contra isso, quatro leis:

- `EXPERIENCE.md`: *"um caderno vazio **não ocupa lugar**: a edição pode ter dois
  cadernos, ou um"*;
- CAP-11: *"caderno vazio não aparece"*;
- `mudancas-mecanicas.md:48`: *"nenhuma linha órfã, **nenhuma posição reservada sem
  texto**"*;
- o backfill da própria espinha: **22 das 39 edições mensais têm um caderno só**, e
  Rotina só existe desde 01/05/26.

Um construtor que leia a espinha literalmente grava quatro linhas sempre — e ressuscita
o caderno vazio que CAP-11 existe para matar, com espaço reservado e tudo. A invariante
verdadeira é *"o conjunto das linhas **daquela edição**, numa chamada só"*, e o número
quatro é um teto, nunca uma contagem.

### Altos

#### R-2 — A camada de luz perdeu dono e superfície

CAP-6 exige o fato de luz **nos quatro pacotes**, derivado na leitura; `cadernos.md:137`
exige *"no trimestre, a camada de luz em destaque"*; o validation-report registra CAP-6
como **contrariada por omissão** na passagem de UX.

A espinha decide a **coordenada** (AD-10) e nada mais. O *Capability Map* aponta CAP-6
para `astro/sun.ts`, mas o *Structural Seed* **não lista nenhuma mudança em
`astro/sun.ts`** — só `astro/casa.ts` e `astro/moon.ts`. E o que falta ali, registrado no
próprio `.memlog` da passagem, é a **agregação de horas de luz por período** e o delta
contra B2: função nova, sem dono declarado, candidata natural a nascer duas vezes (em
`ia/pacote.ts` e em `astro/`) — que é precisamente o que a AD-3 herdada proíbe. A
omissão de superfície tampouco entrou em *Deferred*.

#### R-4 — A capa carimba na primeira impressão; a manchete dela vem da última

AD-3: a capa é *"carimbada na **primeira** impressão e **nunca tocada por reimpressão
parcial**"*. AD-4 e o contrato: cada impressão, mesmo parcial, **recalcula e regrava as
posições**, e a ordem *"congela na **última** impressão"*.

Mas a manchete da capa é *"a do caderno em `posicao = 1` — derivada, não armazenada"*
(`cadernos.md:79`, `DESIGN.md:379`), e AD-11 confirma que ela não ganha campo no banco.
Logo: reimprimir o caderno que reprovou pode mover outro caderno para `posicao = 1` e **a
manchete da capa muda embaixo de uma imagem que a espinha declarou intocável**. Metade da
capa congela na primeira impressão e a outra metade na última — sem que nada diga qual é
o comportamento desejado.

No mesmo nó, a pergunta 12 continua sem resposta: **o que a capa imprime quando o caderno
em `posicao = 1` está sendo escrito, foi reprovado, ou não foi impresso?** AD-11 diz que
a chamada *não existe* e que o consumidor trata ausência — mas a capa é o consumidor cuja
ausência é uma tela vazia de 45vh.

#### R-5 — A ressalva de cobertura desigual não tem mecanismo

*"Cobertura desigual obriga ressalva no texto"* é **Constraint do `spec.md`**, repetida
no `EXPERIENCE.md`. A UX registrou (item 13) que ela não tem forma. A espinha não a
menciona uma vez — a palavra "cobertura" não aparece no documento.

E ela não cai em nenhum mecanismo existente por acaso: a **quinta regra** de
`verificar.ts` cobra *nomear a base*, não *ressalvar cobertura*; e `cobertura.comparavel`
é entrada do **passo 2 do ranqueamento**, não gatilho de texto. Ou o pacote carrega um
fato de cobertura que o prompt é obrigado a usar (e aí é campo novo, e vale a restrição
*"quem acrescentar número tem que dizer como compensa"*), ou é uma sexta regra de
verificação, ou a restrição é decorativa. Três construtores, três respostas.

#### R-6 — A parede de 436 capas: o estado que faltava é o caro

AD-3 resolve **um** dos estados do item 14 — a foto que sumiu da biblioteca, porque a
legenda foi carimbada. Os outros ficaram, e são de construção:

- Cada miniatura de foto exige `resolveAssetUri` →
  `Asset.getUri()`, que **exporta o recurso**, não devolve ponteiro
  (`mobile/src/services/asset-uri.ts:54-67`). O teto de **6 extrações em voo** existe
  porque disparar tudo de uma vez **derrubou o app** com 372 fotos, conferido no aparelho
  em 07/09/2026. A parede é ~6 capas por tela sobre 436 e é feita para rolagem rápida: é
  o mesmo modo de falha, já pago uma vez.
- As capas de **traçado** (três quartos do arquivo, por `cadernos.md:91`) exigem
  geometria de rota para até 436 períodos — e o repositório já tem o precedente
  `route_overview`, criado por timeout ao carregar rotas em massa.
- Carregando, rolagem longa e virtualização não têm dono nem menção.

A espinha nomeia `photos/retro.ts` no *Capability Map* e para por aí.

#### R-8 — Tipo dinâmico e a moldura da lua: o crítico que morre calado

`DESIGN.md` proíbe altura fixa no bloco do veredito e explica por quê: *"caixa fixa corta
o texto no tipo dinâmico grande, e aí a garantia da ADR 0045 morre calada"* — para quem
tem baixa visão, que é o leitor que a ADR mais protege. `EXPERIENCE.md` generaliza:
*"nada de altura fixa onde há texto"*, a faixa cresce com o nome.

A espinha não menciona tipo dinâmico, altura, nem a moldura. Como AD-5 enumera com
precisão as **colunas** de `lua_execucoes` e AD-6 decide onde o teste mora, a página da
lua parece coberta — e a única exigência dela que um construtor erra por default (altura
fixa, `overflow: hidden`) é a que não está lá.

#### R-9 — A linha "Cor" das Convenções repete metade da lei de cor

A tabela de *Consistency Conventions* tem uma linha **Cor** que restata três regras do
`DESIGN.md` (`moduleOf()` para a faixa, `onAccent` sobre `accent`, `on` só sobre `soft`,
nenhum hex em tela) e **omite a quarta**, que era um crítico do validation-report:
*"informação obrigatória não usa `ink3`"* — 3,05 sobre `surface` e **2,87 sobre `bg`**,
abaixo até do piso de objeto gráfico, atingindo assinatura, os cinco rótulos da ficha da
lua e o período de cada capa na parede.

Omissão seletiva dentro da linha que existia justamente para carregar essa lei. E como o
`.memlog` da UX registra que essa decisão **já foi reaberta uma vez** por um erro de
medição ("aumenta para 14 px" era falso), é uma das que mais precisava de registro
durável.

### Médios

#### R-12 — Três leis derrubadas, e só uma com documento de correção

A regra da casa aparece duas vezes no material: *"quem derruba uma lei, derruba
declarando"*. A espinha a cumpre para o pré-registro da lua — companion de correção
obrigatório, citado no frontmatter. Não a cumpre para as outras três:

1. **`DESIGN.md:379` / `cadernos.md:72`** — *"a capa não ganha coluna no banco"*. A
   espinha cria `edicoes_capa` (AD-3) e nunca nomeia a frase que derruba.
2. **`EXPERIENCE.md` §Accessibility Floor e o validation-report** — nomeiam
   `setAccessibilityFocus`, API deprecada. AD-9 corrige, e declara a correção *dentro da
   AD* (bom) — mas os documentos-lei seguem errados.
3. **`mudancas-mecanicas.md:96`** — lista a efeméride como *"novo"* quando `astro/` já
   existe com `sun.ts`, `moon.ts` e `timezone-coords.ts`.

As três estão registradas no `.memlog` da arquitetura como *"contradições trazidas e não
resolvidas"* — e `_bmad-output/` é **efêmero por AD-10 herdada**. Quem construir lendo os
companions adotados constrói contra a espinha em três pontos.

Raiz formal do mesmo problema: a espinha lista `DESIGN.md` e `EXPERIENCE.md` em
`sources:`, enquanto `spec.md:8-9` os declara **companions** — ver R-20.

#### R-14 — As primitivas de interação não têm remissão

`EXPERIENCE.md` §Interaction Primitives e §Component Patterns decidem, entre outras
coisas: **compartilhar não existe em lugar nenhum da revista**; **nenhum gesto
horizontal**; **alvo de toque ≥ 44 px** nos três alvos; a faixa **não é tocável e não
vira barra fixa**; a lápide **não leva a Conexões**; a tira do anuário **não é gráfico
interativo**; o botão de imprimir **só aparece em período fechado e não escrito**.

A espinha não cita nenhuma, nem por remissão ("as primitivas do `EXPERIENCE.md` valem
como escritas"). Duas delas têm risco concreto de reintrodução por reuso, e não por
esquecimento: CAP-10 é mapeada para **`photos/retro.ts`**, o módulo que já alimenta a
tira de fotos da Retrospectiva e vive ao lado do `ShareComposerModal`; e o
`EdicaoCard` — que AD-1 promove a **porta da revista** — é componente existente, com o
comportamento que já tem.

#### R-15 — O postal não foi modelado, e a trava que a espinha usou não o protege

CAP-9 tem três objetos; a espinha só modela um. A palavra "postal" aparece **uma vez**,
dentro da justificativa de uma linha de *Deferred* sobre backfill.

O que ficou sem invariante: *"não grava edição — calcula na hora"*, *"ao reabrir volta
aos três fatos apurados, sem prosa"*, *"não há terceiro estado de persistência"*, e o
postal **acromático**.

E o argumento que a espinha usou para `all` não vale aqui: AD-1 apoia-se em
`periodoFechado('all') === false` e no CHECK do banco — mas **o CHECK de `tipo_periodo`
aceita `week`**, e o diagrama do paradigma leva *todo* texto verificado ao `upsert`. Nada
mecânico impede gravar um postal; a única coisa que impede é uma frase que não está na
espinha.

#### R-16 — "A revista nunca gera sozinha" não virou invariante

É Constraint do `spec.md`, é seção inteira do `EXPERIENCE.md`, e é o estado *"período em
curso: **nada** — não é botão desabilitado nem aviso: é ausência"*. Sem ela, folhear seis
meses dispara seis chamadas pagas.

A espinha descreve o pipeline e nunca diz que **a entrada dele é um ato do usuário** — e
o terceiro hospedeiro que ela cria (AD-12) é justamente o que imprime 436 edições sem
ninguém tocar em nada. A distinção *"o hospedeiro de lote imprime em massa; a tela nunca
imprime sozinha"* é de arquitetura, não de UX, e é a única coisa entre folhear e US$
4,80.

#### R-17 — O ícone do caderno é portador de significado e não tem dono

*"Cor nunca é o único portador de significado. A identidade do caderno é cor + ícone +
nome"* é piso de acessibilidade, e não é retórica: **Movimento × Coração medem ΔE 4,1 a
9,9 em cinco das seis paletas**, e o ícone é o que sustenta a distinção — inclusive sob
daltonismo. `bicycle-outline` é ícone **novo**, com viés declarado.

A espinha tem uma AD inteira sobre cor (AD-8) que cobre só contraste, e não nomeia o dono
do catálogo de ícones nem do mapa **caderno → módulo** (`Sono = agua`, não `saude` — é
decisão de vocabulário, não obviedade). O `period/cadernos.ts` do *Seed* diz "catálogo",
o que pode ou não incluir isso. Precedente no repositório para resolver de graça:
`HABIT_ICONS`, fonte única no shared, com web e mobile alinhados.

### Baixos

#### R-3 — O sumário em estado misto ficou entre as duas espinhas

AD-11 fecha a forma do dado (*a chamada não existe; quem consome trata ausência, nunca
string vazia*) e não diz o que a tela faz — a linha some, fica sem chamada, ou o sumário
só aparece completo? Legítimo como decisão de tela; ilegítimo é ninguém dizer que
continua aberta, já que era item bloqueante na lista da UX.

#### R-7 — "Doze blocos" e "treze blocos" na mesma AD

AD-1 diz os dois. O código tem **13** (`retro-blocks.ts`); a lista do `EXPERIENCE.md`
omite `purchases`. O número certo é treze, e a lista do companion também precisa da
correção.

#### R-18 — A forma da pilha de navegação

AD-1 fixa as rotas e não a pilha. Com `arquivo` irmã da edição e cada capa abrindo uma
edição, a pilha cresce sem fim (edição → arquivo → edição → arquivo…), contra *"voltar
sai da edição inteira"*. E a **porta para o Arquivo** continua sendo *"ação na revista"*,
sem lugar declarado — embora a AD-1 se proponha justamente a fechar o grafo de entrada, e
o `EXPERIENCE.md` liste só três alvos de toque na edição, nenhum deles o Arquivo.

#### R-20 — Os companions de UX entraram como `sources`

`spec.md:3-9` declara `DESIGN.md` e `EXPERIENCE.md` **companions** — parte do contrato
canônico. A espinha os lista em `sources:`, e o campo `binds:` cita CAP-1..14 e as AD
herdadas, não eles. O corpo do documento faz a coisa certa ("`spec.md` e seus seis
companions continuam sendo a lei", contagem correta), mas o cabeçalho os rebaixa — e é a
raiz formal de por que tanta lei de UX ficou sem remissão nesta reconciliação.

---

## 5 — Contagem

| Severidade | Nº | Ids |
|---|---|---|
| Crítico | 3 | R-1, R-10, R-11 |
| Alto | 6 | R-2, R-4, R-5, R-6, R-8, R-9 |
| Médio | 5 | R-12, R-14, R-15, R-16, R-17 |
| Baixo | 4 | R-3, R-7, R-18, R-20 |
| **Total** | **18** | |

---

## 6 — Remendo mínimo

Ordenado por custo de errar, não por esforço:

1. **AD-4 e Convenções:** trocar *"as quatro linhas"* por *"o conjunto das linhas daquela
   edição"*, no texto, no diagrama do paradigma e na cardinalidade da ER (R-11).
2. **AD nova — o que a impressão congela:** a tira do anuário carimba o fato líder do mês
   (chave, valor, unidade), ou o anuário é declaradamente recalculado e a promessa de
   congelamento passa a ter exceção escrita (R-1).
3. **AD nova — o véu medido:** dono, caminho de medição no aparelho, e o fallback
   nomeado (texto abaixo da imagem) quando o piso não é alcançável (R-10).
4. **AD-3 + AD-4:** dizer o que acontece com a manchete da capa quando a reimpressão
   parcial muda o `posicao = 1`, e o que a capa imprime sem líder com texto (R-4).
5. **AD-10 ou seed:** nomear o dono da agregação de horas de luz por período; incluir
   `astro/sun.ts` no *Structural Seed*; registrar em *Deferred* que a superfície da luz
   (CAP-6, o trimestre em destaque) segue sem desenho (R-2).
6. **Convenções:** acrescentar a linha de tinta (`ink2` onde a informação é obrigatória),
   a proibição de altura fixa onde há texto, e uma remissão de uma linha às primitivas de
   interação do `EXPERIENCE.md` (R-9, R-8, R-14).
7. **AD-1 ou uma AD de CAP-9:** o postal não grava, mesmo com `week` aceito pelo CHECK;
   e imprimir é ato do usuário, exceto no hospedeiro de lote (R-15, R-16).
8. **Deferred:** a ressalva de cobertura (R-5), os estados e o custo de extração da
   parede (R-6), o sumário misto (R-3), a pilha de navegação (R-18).
9. **Frontmatter e higiene:** `DESIGN.md`/`EXPERIENCE.md` para `companions`/`binds`
   (R-20); "treze blocos" nas duas ocorrências (R-7); e uma nota de correção para as três
   frases-lei derrubadas sem declaração, no molde do companion do pré-registro (R-12).
