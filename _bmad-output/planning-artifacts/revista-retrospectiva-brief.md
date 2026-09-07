# A Retrospectiva vira revista — brief para a mesa

> **Como usar:** este arquivo é o prompt de abertura de uma sessão de party mode.
> Invoque com `/bmad-party-mode` e aponte para cá. A mesa que importa: **Sally (UX)**,
> **Winston (arquitetura)** e **Mary (analista / deep recon)**; **John (PM)** para cortar
> escopo e **Murat (TEA)** para dizer como se testa. Não é uma pergunta que fecha em uma
> rodada — é o desenho da seção que o Sydnei chamou de "uma das mais importantes do app no
> futuro".
>
> Datas e contagens abaixo foram **lidas em produção em 07/09/2026**. Não são estimativa.

---

## 1. O que está sendo pedido

Hoje a Retrospectiva imprime **um** parágrafo por período fechado. Funciona, está em produção
desde 06/09, e o Sydnei conferiu no iPhone.

O pedido é outro, e é maior:

- **Uma revista, não uma notícia.** Algo que se relê — não um resumo que se consome uma vez e
  vira histórico morto.
- **Vários cadernos por período.** Pelo menos: um **geral** (o que já existe, mas com análise
  de verdade, não recitação de números) e um de **sono**, bem detalhado. Os demais são parte da
  discussão.
- **Quanto maior o período, mais fundo.** Semana é rasa; mês, estação e ano ganham a análise
  completa — correlações, o que melhorou, o que piorou, o que merece atenção.
- **Sempre comparar.** Com períodos anteriores *e* com o mesmo período de anos anteriores.
- **Futuro provável:** versão web, PDF e/ou e-mail da edição do período.

E a pergunta que a mesa tem que responder antes de tudo: **quais dados a revista leva.**

---

## 2. As leis que já valem (não são pauta, são o chão)

Quem quiser derrubar uma delas tem que dizer em voz alta que está derrubando.

| Lei | Origem |
|---|---|
| **É um jornal: informa, não aconselha.** Não recomenda, não motiva, não parabeniza. | declarada pelo Sydnei |
| **Estatística acha; LLM prioriza e narra.** O modelo nunca calcula, nunca deriva número que não recebeu, nunca afirma causa. | intent de 21/08, §3 |
| **Todo número citado existe no pacote de fatos.** Verificação mecânica, não confiança. | spec §5 · `ia/verificar.ts` |
| **Cobertura desigual obriga ressalva no texto.** | spec §4 — existe porque julho tinha 14 noites e agosto 27 |
| **Período fechado congela.** Dado que muda vira errata, não reescrita. `all` não tem edição. | spec §3 · CHECK na tabela |
| **Provedor e modelo são configuração.** Núcleo puro, sem SDK, um adaptador por provedor. | ADR 0040 |
| **A camada narra, nunca decide** — nada de ação automática a partir de inferência de saúde. | política do Google §1.8 |
| **Mobile-first.** Se não está no celular, ele não vê. | lei da casa |

**Tensão número um para a mesa:** "revista" e "pontos de atenção" empurram contra "informa, não
aconselha". Escolher qual fato merece a capa é jornalismo. Dizer o que fazer com ele é conselho.
Onde exatamente fica a linha — e a revista muda a lei ou herda ela inteira?

---

## 3. O inventário real — o que se tem, o que se perde, o que falta

### 3.1 Está salvo e chega à tela

| Fonte | Volume | Desde |
|---|---|---|
| `activities` | 555 | 22/05/2023 |
| `activity_photos` | **1.210** | 2026 |
| `health_daily` | 4.385 linhas · 14 métricas · 527 dias | 24/03/2025 |
| `sleep_periods` | 290 noites (com estágios e segmentos) | 23/04/2025 |
| `activity_routes` | 275 | — |
| `health_series` (FC minuto a minuto) | 179 dias | 20/02/2026 |
| `todo_occurrences` | 551 · 102 templates | — |
| `habit_logs` | 336 · 4 hábitos | 20/05/2026 |
| `registro_logs` | 96 · 6 registros | 01/05/2026 |
| `daily_ratings` | 80 dias | 07/06/2026 |
| `cultura_items` · `goals` · `gear` | 4 · 4 · 2 | — |

Dentro das atividades: `best_efforts` em **554** de 555, `hr_zones` em 418, elevação em 275,
**cidades em 174**, piso das rotas em 138.

### 3.2 Está salvo e **não chega à análise** — o balde mais gordo

Isto é dado pago, gravado, e invisível para a camada que narra. O pacote de fatos hoje recebe
só `{ resumo, agora }` — sem correlações, sem eventos, sem lacunas.

- **1.210 fotos** com hora e parada. A revista tem imagem; o jornal não tinha.
- **174 cidades** e **138 rotas com piso**. "Onde o período aconteceu" não entra em texto nenhum.
- **179 dias de FC intradiária** — a curva do dia, a noite, o treino.
- **554 conjuntos de recordes** e 418 distribuições de zona.
- **O sono inteiro:** SRI, jetlag social, despertares por hora, as cinco dimensões da Saúde do
  sono, a leitura de duas colunas dos gatilhos (a que mediu cerveja em −33 min). Tudo calculado,
  nada narrado.
- **551 ocorrências de tarefa** — aderência, séries diárias.
- **As correlações do `triggerImpact`**, que rodam na tela e não entram no pacote.

### 3.3 Parou de chegar — e ninguém percebeu

| Métrica | Última medida |
|---|---|
| respiração | 10/07/2026 |
| VO₂max | 14/07/2026 |
| SpO₂ | 16/07/2026 |
| anéis | 17/08/2026 |

Quatro métricas morreram em julho e agosto. A VFC caiu na mesma janela e **voltou** (ponte do
intervals.icu); estas não. Isso é ou um cano quebrado, ou um hábito que mudou — e nenhuma tela
avisou. **Uma revista que não sabe que ficou cega não é confiável.**

### 3.4 O cano existe, a fonte está vazia

O app pede **22 métricas** ao HealthKit. Oito nunca voltaram com dado nenhum:

`pressão` · `IMC` · `gordura` · `massa magra` · `cintura` · `água` · `calorias/macros/proteína`

E **peso tem exatamente 1 medida** (16/07/2026).

Duas tabelas de captura estão **zeradas**: `meals` (0) e `transactions` (0) — o QuickAdd existe,
funciona, e nunca foi usado. `planned_workouts` também está em 0.

→ Aqui não falta código. Falta **fonte**: uma balança, um registro de comida, um hábito de
anotar. A pergunta para a mesa é qual desses paga o próprio custo de captura.

### 3.5 Não existe ainda — captura nova a debater

Levantado, nunca implementado: **presença / onde o dia foi** (proposta fechada em 06/09,
geofence primeiro). Outros candidatos que a mesa deve aceitar ou matar: clima e temperatura da
pedalada · humor ao longo do dia (hoje só há a nota única do dia) · café e álcool com hora ·
dor e lesão · viagem e fuso · dias de escritório · peso recorrente.

---

## 4. O limite duro: nem todo caderno tem ano passado

Este é o achado que corta escopo sozinho.

| Fonte | Começa | Tem "mesmo período do ano anterior"? |
|---|---|---|
| Atividades | 22/05/2023 | **Sim**, três anos |
| Saúde | 24/03/2025 | Sim, para períodos a partir de mar/2026 |
| Sono | 23/04/2025 | De raspão — e com o buraco até 18/07/2025 (perda do Apple Watch) |
| Registros | 01/05/2026 | **Não antes de mai/2027** |
| Hábitos | 20/05/2026 | **Não antes de mai/2027** |
| Notas do dia | 07/06/2026 | **Não antes de jun/2027** |

Cerveja e fumo têm quatro meses de vida. Um caderno de hábitos que promete comparação anual vai
mentir por oito meses.

**Regra que a mesa precisa formalizar:** a ausência entra **no pacote**, como fato declarado —
igual à `cobertura`. O modelo não pode descobrir sozinho que não há ano anterior; ele tem que ser
informado de que não há.

---

## 5. O contexto que não precisa ser captado — sol e lua

Pedido direto do Sydnei, e os dois itens compartilham uma propriedade que muda o peso deles:
**são função pura de data e lugar.** Não exigem sensor, não exigem hábito novo, não exigem que
ele mude nada — e retroagem até o primeiro dia de histórico (22/05/2023) de graça. São o único
"dado novo" desta discussão inteira que não custa captura. Todo o resto da §3.4 e §3.5 depende de
ele passar a fazer alguma coisa.

### 5.1 A estação como contexto, não como período

> *"Rotina de verão não é igual à de inverno, meias estações são diferentes. Dar esse contexto
> para a IA."*

Ele mora na Bélgica, ~50,8° N. A luz do dia vai de cerca de **8 h** no solstício de inverno a
cerca de **16 h 30** no de verão — o dobro. Isso não é pano de fundo: é a variável que explica
metade do que a revista vai narrar. Quilometragem caindo em novembro é o inverno ou é ele?

**Sem baseline sazonal, a revista não consegue separar "você fez menos" de "você fez menos do que
costuma fazer em novembro".** E é aqui que a tese dele — *período maior, análise melhor* — deixa
de ser intuição e vira mecânica: com três anos de atividade ele tem **três novembros**; com um ano
de sono, tem **um**.

**Achado que a mesa precisa resolver antes de desenhar:** o `PeriodKind` chamado `season` é
**trimestre civil** (Q1 Jan–Mar, Q2 Abr–Jun, Q3 Jul–Set, Q4 Out–Dez). Está deslocado um mês da
estação real — o Q1 mistura o fundo do inverno com o começo da primavera; o Q3 mistura o auge do
verão com o início do outono. **A tela diz "estação" e calcula trimestre.** Ou as fronteiras
mudam, ou a estação vira um fato à parte do período. As duas opções têm custo, e há uma edição de
`season` já gravada em produção.

Perguntas: a luz do dia entra no pacote como fato por período (média de horas de luz, e o delta
contra o mesmo período do ano anterior)? A comparação sazonal substitui a comparação com o período
anterior nos casos em que o anterior é de outra estação, ou anda ao lado dela?

### 5.2 A lua — e a armadilha de já ter uma hipótese

> *"Achar padrões entre fases da lua (caso haja). Pessoalmente, estou me observando nisso já faz
> um tempo."*

O ciclo sinódico é de 29,53 dias. As 290 noites cobrem **~9,8 ciclos** — em 8 fases dá ~36 noites
por caixa; em duas metades (perto da cheia × perto da nova), ~145 de cada lado. O portão que já
existe (`TRIGGER_MIN_PER_CELL = 5`) passa com folga.

**E é exatamente por isso que ele é perigoso aqui.** O portão diz que há amostra; não diz que o
efeito é real. Três riscos, e a mesa tem que endereçar os três:

1. **Comparações múltiplas.** Lua × 14 métricas de saúde já são 14 testes; com hábitos e
   registros passa de 30. A 5%, aparece "achado" por acaso — e o texto vai narrá-lo com a mesma
   confiança tipográfica de um fato.
2. **Ele tem um prior.** Está se observando nisso há tempo. Um sistema que procura o que o dono já
   acredita encontra. A saída honesta é **pré-registrar**: fixar a fase, a métrica e o limiar
   **antes** de olhar, e publicar *"nenhum padrão"* com o mesmo destaque de um achado. Se a
   revista só menciona a lua quando ela correlaciona, ela fabrica.
3. **O mecanismo plausível não sobrevive à Bélgica.** A hipótese usual é luz noturna; céu encoberto
   a maior parte do ano derruba isso. Vale distinguir *achar o padrão* de *explicar o padrão* — a
   segunda coisa a camada não pode fazer, por lei (nunca afirma causa).

**Para a Mary:** a literatura de lua × sono existe e é **contestada** — há estudos relatando
adormecer mais tarde e dormir menos perto da cheia, e há reanálises grandes que não acham nada.
Não tratar nenhum dos lados como assentado; trazer o estado real da discussão e, principalmente,
**qual desenho de teste os próprios autores usaram**, que é o que o Orbe precisa copiar.

---

## 6. O que hoje bloqueia mecanicamente

Três travas concretas, para ninguém desenhar no ar:

1. **A chave da tabela é `(user_id, tipo_periodo, inicio, fim)`** — literalmente *um texto por
   período*. Vários cadernos exigem migration.
2. **O pacote carrega o atual e UM anterior.** `FatoNumero` tem `atual`/`anterior`/`delta`. Mais
   bases é mudança de forma, e ela atravessa `numerosDoPacote`, `valoresDoPacote` e o verificador.
3. **Mais números autorizados enfraquecem a verificação.** `numerosDoPacote` aprova qualquer
   número presente no pacote; com quatro bases o alfabeto quadruplica e um número inventado tem
   mais chance de bater por acaso. **Contexto melhor se paga com conferência mais fraca** — quem
   defender N bases tem que dizer como compensa isso.

Referência de custo, medida: as 6 edições em produção usam ~1.250 tokens de entrada e ~170 de
saída cada, em `gemini-3.6-flash`. Volume não é o problema; desenho é.

---

## 7. O que cada cadeira precisa responder

**Sally — UX.** O que é uma revista que se relê, num telefone? Tem sumário? Capa? A ordem dos
cadernos é fixa ou muda conforme o que o período teve? Quantos cadernos cabem antes de virar
dever de casa? Como se volta a uma edição antiga — e por que se voltaria? A foto entra (são
1.210 esperando) e, se entra, ela ilustra ou ela informa? E o que muda visualmente entre a
semana rasa e o ano fundo — mesma forma em profundidades diferentes, ou formas diferentes? E como
a estação e a lua (§5) aparecem sem que a revista escorregue para o horóscopo: qual é o tom que
apresenta um ciclo lunar como observação medida, e o que a página faz quando a resposta é
*"nenhum padrão"*?

**Winston — arquitetura.** A chave da tabela, o pacote por caderno e as bases nomeadas. Onde a
montagem roda: o núcleo é puro e roda **no telefone**, e um ano fundo com quatro bases pede muito
dado carregado — isso continua sendo do cliente? O backfill (~228 períodos × N cadernos) roda
onde? E a saída futura: se a edição é **texto gravado**, web, PDF e e-mail são *renderização*, não
geração — confirme isso ou derrube. `PACOTE_VERSAO` e errata sobrevivem a cadernos?

E o sol e a lua da §5: efeméride é função pura de data e coordenada, então o precedente já existe
neste repositório — o **preço do hábito**, derivado na leitura e nunca gravado, o que o torna
retroativo de graça. Sol e lua seguem a mesma regra ou viram coluna? Falta uma coordenada: as
rotas têm lat/long, os dias sem atividade não têm nenhuma. O lugar do usuário passa a ser
configuração?

**Mary — analista / deep recon.** Com 4 hábitos, 6 registros e 80 dias de nota, quais comparações
são honestas e quais são ruído com aparência de achado? O que a prática de *personal informatics*
já sabe sobre relatórios periódicos que as pessoas releem — o que faz alguém voltar a uma edição?
Quais das capturas da §3.4 e §3.5 pagam o próprio custo (esforço diário × valor analítico)? E o
que uma revista faz com o período em que uma métrica morreu no meio (§3.3)? E o deep recon da
§5.2: o estado real — contestado — da literatura de lua × sono, com atenção ao **desenho de teste**
que os autores usaram, não só ao que concluíram.

**John — PM.** Quantos cadernos nascem na v1 e o que espera. O backfill volta até onde. O que
**não** entra — dito em voz alta, não omitido.

**Murat — TEA.** Como se testa uma revista. Golden set por caderno? As três verificações
mecânicas mudam por caderno? E qual é o comportamento correto quando um caderno não tem dado
suficiente: silêncio, edição curta, ou o caderno some daquela edição? Some a pergunta mais difícil
da §5.2: **como se testa um "nenhum padrão"** — e como se impede que a busca por padrão lunar seja
refeita até dar certo.

---

## 8. O que a sessão precisa produzir

1. **A lista dos cadernos**, com o que cada um leva **campo a campo** — e o que fica fora.
2. **A decisão sobre bases de comparação**: quantas, quais, e o que o texto faz quando elas não
   existem.
3. **A lista de captura**: o que passa a ser gravado a partir de agora, e o que se aceita perder.
4. **O destino do dado da §3.2** — as fotos, as cidades, o piso, a FC intradiária, os recordes.
   Ou entram na revista, ou alguém explica por que ficaram de fora.
5. **O veredito sobre sol e lua (§5):** entram na v1 ou não; se entram, como (fato derivado na
   leitura ou coluna), o que se faz com o `season` que hoje é trimestre, e — para a lua — **o teste
   escrito antes de rodá-lo**, com o limiar e o compromisso de publicar o resultado negativo.
6. **O corte da v1**, explícito.

**Fora da pauta, mas não fora do mundo:** as quatro métricas mortas da §3.3 precisam de
investigação independente desta discussão. Uma revista construída sobre um sensor que parou em
julho vai narrar o silêncio como se fosse fato.
