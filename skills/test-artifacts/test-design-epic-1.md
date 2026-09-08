---
workflowStatus: 'completed'
totalSteps: 5
stepsCompleted:
  - 'step-01-detect-mode'
  - 'step-02-load-context'
  - 'step-03-risk-and-testability'
  - 'step-04-coverage-plan'
  - 'step-05-generate-output'
lastStep: 'step-05-generate-output'
nextStep: ''
lastSaved: '2026-09-08'
---

# Test Design — A revista da Retrospectiva

**Data:** 08/09/2026
**Autor:** Sydnei
**Modo:** Epic-Level · `epic_num = 1`, com pontuação estendida à frente inteira
**Status:** Draft

---

## O que esta passagem faz, e o que ela não faz

**Não faz:** não reescreve critério de aceite, não renomeia barreira, não redecide nada
do contrato. As 27 stories já têm Given/When/Then e as barreiras estão nomeadas AD por AD.

**Faz:** pontua risco por story (P × I), diz **por quê** com evidência do código, e nomeia
**que evidência cada story exige antes de fechar** — inclusive quando a resposta é "nenhum
nível automatizado alcança isto, e a evidência é humana".

O escopo de pontuação é a **frente inteira (27 stories)**, não só o Épico 1: os riscos
dados como entrada nomeiam 1.1, 1.9, 1.15, 2.3 e 3.3. O Épico 1 leva o plano de cobertura
completo; os Épicos 2–4 levam pontuação e exigência de evidência.

---

## Sumário executivo

**Riscos:** 42 identificados · **19 altos (≥6)** · 3 no teto (score 9)
**Categorias dominantes:** DATA (14) · TECH (12) · BUS (10) · OPS (4) · SEC (1) · PERF (1)

**As três de score 9 são duas stories:** 1.9 (a migração) e 1.1 (o `AGG_VERSION`).

**Quatro riscos novos**, confirmados contra o código e ausentes da lista de entrada:

1. **`upsertEdicao` quebra junto com `fetchEdicao`** na Story 1.9 — o raio da migração é o
   dobro do que estava mapeado.
2. **`edicoes_ia` vai de 7 para ~1.744 linhas e não tem leitura em lista hoje** — o backfill
   da 2.3 cria, para a parede da 2.4, exatamente o corte de 1.000 linhas que o contrato
   temia noutro lugar.
3. **"Mesmo texto verificado nos dois hospedeiros" não é assertável** sobre um modelo
   não-determinístico. O teste obrigatório do CAP-13, como está escrito, não fecha.
4. **O backfill não declara idempotência** — o contrato não diz o que acontece quando o
   script morre na edição 200 de 436.

**Um risco rebaixado por evidência:** a paginação da Story 2.3. Todas as tabelas que
alimentam os quatro cadernos **já paginam** hoje. O risco não desapareceu — **mudou de
lugar** (ver achado novo nº 2).

**Esforço de evidência:** ~58–96 h (~1,5–3 semanas), sendo ~22–34 h nos P0.

---

## Testabilidade — quatro achados estruturais

Estes precedem os riscos por story: eles são a razão de vários scores.

### T-1 · Não existe nível de teste de render. Doze das 27 stories são de superfície

Conferido: zero arquivos `.test.tsx` em `mobile/src`, nenhuma dependência de
`@testing-library/react-native` nem `react-test-renderer`, nenhum diretório `.maestro/`,
sem Detox e sem Appium. O `jest` do mobile roda **só lógica**, em `mobile/src/lib/__tests__`.

As stories 1.11, 1.12, 1.13, 1.14, 2.4, 3.1, 3.2, 4.4 — e as fatias de superfície da 1.9 e
da 2.5 — **não têm nível automatizável neste stack**. A evidência delas é humana, no
aparelho.

**Recomendação — e é uma só, não um cardápio:** *não* introduzir um framework de render
nesta frente. O custo (jest-expo + testing-library + o preset que a RN 0.86 exige) cai
inteiro sobre a frente de maior risco de migração do repo, e resolveria a metade menos
arriscada do problema. O lever certo é o que a arquitetura já escolheu: **empurrar decisão
para função pura no núcleo**, onde `npx tsx` já alcança, e deixar para o aparelho só o que
é genuinamente pixel.

Concretamente, isto já está previsto e deve ser **cobrado como entrega**, não como bônus:

- `ordenarCadernos` (1.7) — a ordem é pura, o layout não.
- a extração da chamada (1.8) — pura.
- **o estado do caderno (1.11)** — os sete estados de UX-DR9 são uma função
  `(edição, caderno) → EstadoCaderno`. Se ela nascer dentro do `.tsx`, os sete estados
  ficam sem prova nenhuma. Se nascer no núcleo, ficam com prova exaustiva e o `.tsx` vira
  um `switch`. **Esta é a maior alavanca de testabilidade da frente inteira**, e ela não
  está escrita em AD nenhuma.
- **o cálculo do véu (1.13)** — a AD-18 já parte o problema certo: dada uma luminância,
  quanto véu falta é puro e testável; a amostragem do pixel é do aparelho. Cobrar que a
  parte pura exista separada.

### T-2 · Não existe nível de teste de banco, e a story de maior risco é uma migração

55 migrations no repo, nenhuma com teste. O único nível disponível para a Story 1.9 é
**aplicar e olhar**. Não há ambiente de staging: instância Supabase única (AD-8 herdada).

Isto não se resolve nesta frente. O que **se** resolve é ensaiar antes: a evidência exigida
pela 1.9 inclui um ensaio da migração fora de produção (banco local via `supabase start`, ou
um projeto descartável), com as sete linhas reais restauradas do
`primeiras-edicoes-prompt-v2.md`. Isso converte "descobrir em produção" em "descobrir no
ensaio", que é a única melhoria disponível ao preço certo.

**De-escalada honesta, para não superdimensionar o medo:** o Supabase CLI envolve cada
migration numa transação. A ordem interna (as 7 edições saem antes das colunas `not null`
nascerem, AD-15) protege contra a migração **falhar**, não contra ela **corromper** — uma
falha no meio faz rollback limpo. Confirmar, no ensaio, que nenhuma statement do arquivo é
não-transacional (`create index concurrently`, por exemplo) — se não houver, o risco de
corrupção parcial é ~zero e sobra só o risco de a migração não passar.

### T-3 · O texto do modelo não é determinístico, e o teste obrigatório do CAP-13 assume que é

`mudancas-mecanicas.md` põe como teste obrigatório: *"mesmo pacote, dois hospedeiros, mesmo
texto verificado"*. A Story 2.2 repete: *"o texto verificado é **o mesmo**"*.

Isso não é assertável. Mesmo com temperatura 0, provedores não garantem reprodutibilidade
entre chamadas — e a assinatura grava `modelo` como *"o id que RESPONDEU, não o pedido"*,
o que é o próprio repo reconhecendo que a ponta remota se move sozinha.

**Isto não é defeito do contrato — é uma restrição que só o test design encontra**, e ela
não muda nenhuma decisão: muda o que conta como prova. O invariante testável é o que é
determinístico dos dois lados:

1. **O pacote é idêntico** — mesma entrada, `montarPacote` dos dois hospedeiros produz
   estrutura byte a byte igual. Isto é puro, e é onde a divergência real moraria (fuso,
   `deviceCoords()`, coordenada, arredondamento da luz).
2. **A assinatura é idêntica** — provedor, modelo, `prompt_versao`, `PACOTE_VERSAO`,
   `agg_version_no_momento`. Já está na AC, e é assertável.
3. **Os dois textos passam nas mesmas cinco regras contra o mesmo pacote.** O que o
   contrato quer garantir é *"não existem duas implementações da mesma conta"* — e a conta
   é o pacote e o verificador, não a prosa.

O texto igual continua sendo um bom **sinal** para inspecionar à mão uma vez. Não é portão.

### T-4 · Barreira pode passar por vacuidade, e três barreiras novas correm esse risco

`architecture.test.ts` já conhece esta armadilha e se defende dela numa das guardas
(linha 173: `assert.ok(targets.size > 0, 'nenhuma edge function importa do núcleo — a guarda
ficou sem alvo')`). As barreiras novas desta frente **não herdam** essa defesa
automaticamente:

- a barreira do `ordenarCadernos` (1.9) varre `mobile/src` e `web/src` procurando um import;
- a barreira do `upsertEdicao` (1.10) varre procurando importadores ilegais;
- a barreira do `.from()` estendida ao quarto workspace (2.1) varre um diretório que **ainda
  não existe** no momento em que a barreira é escrita.

Uma varredura que aponta para caminho errado, ou que roda antes de o alvo existir, fica
**verde para sempre** — e uma barreira verde por vacuidade é pior que barreira nenhuma,
porque compra confiança.

**Exigência, para as três:** cada barreira nova carrega uma asserção de não-vacuidade no
mesmo commit — que o conjunto varrido é não-vazio, e (onde couber) um caso-espelho que
prova que ela reprova quando deve. A barreira do `.from()` da 2.1 exige a segunda forma: o
diretório novo tem um arquivo, então `walk()` sobre ele devolve pelo menos um caminho.

---

## Fora de escopo

| Item | Razão | Como o risco é tratado |
|---|---|---|
| **Playwright / browser** | Web, PDF e e-mail são não-objetivos declarados do spec. Não há superfície de browser nesta frente | `tea_browser_automation` pulado por irrelevância, não por indisponibilidade |
| **Pact / contract testing** | Não há microserviço, broker, nem consumidor HTTP versionado. `ia-narrar` é edge function do mesmo repo, chamada por dois hospedeiros que compartilham o núcleo | A equivalência entre hospedeiros é coberta pelo T-3 acima, no nível certo (pacote + assinatura) |
| **Framework de render no mobile** | Ver T-1 — o custo cai sobre a frente errada e resolve a metade menos arriscada | Empurrar decisão para função pura; nomear o manual no aparelho |
| **Testes da web (Vitest)** | A frente não toca `web/src`. `onAccent` nasce **sem** alias plano e sem variável CSS por AD-8 | O CI valida a web mesmo assim (AD-17) — regressão, não cobertura nova |
| **Carga / performance** | Um usuário, um aparelho. O único número de volume é o custo em dólares do backfill (~US$ 1,20), já medido | Coberto como OPS no orçamento do backfill, não como PERF |

---

## Riscos por story — a tabela que você pediu

Ordenada por risco. `#` é a contagem de riscos daquela story; **Score** é o do pior deles.

| # | Story | Score | Categoria | Por que | Nível de evidência |
|---|---|---|---|---|---|
| 1 | **1.9** A migração e a leitura da forma nova | **9** | DATA/TECH/OPS | 5 riscos, 2 no teto. Quebra garantida do app instalado, sem OTA, sem staging, e o raio é **o dobro** do mapeado | Ensaio fora de prod + 2 barreiras + inspeção |
| 2 | **1.1** `AGG_VERSION` no núcleo | **9** | DATA/TECH | Defeito **vivo em produção**, e precede o backfill. Errar aqui torna ~1.744 linhas inelegíveis a errata | Núcleo + barreira + verificação em prod |
| 3 | **1.10** A sequência sobe para o núcleo | **6** | TECH/DATA | A NFR19 ("verifica antes de gravar") é hoje **comentário**. E o laço narrar-e-gravar é o caminho natural de quem implementa — a própria AC diz isso | 2 barreiras não-vácuas + sequência com portas falsas |
| 4 | **2.3** Impressão em massa | **6** | DATA/OPS | 436 edições numa passada, sem idempotência declarada, criando o volume que quebra a 2.4 | Ensaio parcial + auditoria de leitura + carimbo |
| 5 | **2.2** O script imprime idêntico | **6** | TECH/SEC | O teste obrigatório do contrato não é assertável como escrito (T-3); e é aqui que a chave de serviço é tentadora | Pacote byte-a-byte + assinatura + revisão de credencial |
| 6 | **1.3** O pacote por caderno | **6** | BUS/DATA | O alfabeto da verificação é o mecanismo de segurança inteiro. Um split que vaze números **não falha** — só enfraquece em silêncio | Núcleo + **medição** do alfabeto, não asserção |
| 7 | **1.11** A rota e os sete estados | **6** | BUS/PERF | Sete estados por caderno **sem nível de teste**, mais a superfície onde "nunca gera sozinha" morre | Função pura de estado (T-1) + aparelho |
| 8 | **1.13** A capa e o véu medido | **6** | DATA/TECH | Capa não carimbada na 1ª impressão **não é recuperável** — o estado que se leria já andou | Núcleo (cálculo) + aparelho (amostragem) |
| 9 | **1.4** A quinta regra | **6** | BUS | Uma regra frouxa passa no teste "existe caso que reprova" e continua deixando a inversão B1/B2 passar | Núcleo, com caso de inversão obrigatório |
| 10 | **1.15** O piloto de três | **6** | BUS | **Portão humano.** O Épico 2 imprime 53 períodos sobre esta aposta | Julgamento do dono — nenhum agente fecha |
| 11 | **4.1** O instante da lua cheia | **6** | TECH | Janela deslocada **não falha**: mede ruído com cara de protocolo. 0,8 dia numa janela de 5 embaralha as colunas | Núcleo contra efeméride de referência |
| 12 | **4.2** O teste lunar e `lua_execucoes` | **6** | BUS/DATA | Três portões × três vereditos × nulo≠zero. Puro e determinístico — testável, mas só se alguém escrever a matriz | Núcleo, matriz de portões completa |
| 13 | **1.6** A camada de luz | **4** | DATA/BUS | `deviceCoords()` é o caminho natural e errado; e a compensação do NFR17 é uma casa decimal (3,6% vs 16%) | Núcleo + barreira da coordenada |
| 14 | **1.2** `onAccent` | **4** | TECH | Harness maduro (36 combos). O risco é a barreira cobrir `RoleTokens` e **não** `ModuleTokens` — e é `moduleOf()` que a faixa lê | `theme.test.ts`, **dois** laços |
| 15 | **1.5** O prompt aprende as regras | **4** | BUS | **Única story sem portão mecânico algum.** Falha aparece como "o verificador está errado" | Piloto 1.15 + revisão de texto |
| 16 | **1.14** O sumário e o foco | **4** | TECH | `sendAccessibilityEvent` é código novo sobre API nova; VoiceOver só se prova no aparelho | Aparelho, com VoiceOver ligado |
| 17 | **2.1** O quarto workspace | **4** | TECH | A barreira estendida corre o risco de vacuidade (T-4) no pior momento: o alvo nasce no mesmo commit | Barreira + asserção de não-vacuidade |
| 18 | **2.4** A parede de capas | **4** | TECH/DATA | `'loading'` vs `null`; e o volume que a 2.3 cria | Aparelho + auditoria de paginação |
| 19 | **3.2** O anuário | **4** | DATA | A lacuna declarada depende de o carimbo ter sido gravado **desde a primeira impressão** — decisão que já foi tomada no Épico 1 | Núcleo + inspeção do carimbo |
| 20 | **4.3** A barreira do hash | **4** | OPS | Risco de **falso-vermelho**: normalização de fim de linha por editor quebra o build sem nada de errado | Barreira + procedimento escrito |
| 21 | **4.4** A página da lua | **4** | BUS | UX-DR8: altura cresce com o texto, igual nos três vereditos. AX3 só se vê no aparelho | Aparelho, em tipo dinâmico AX3 |
| 22 | **1.7** O ranqueamento | **3** | BUS | Risco **mecânico** baixo — pura, determinística, 6 passos nomeados, desempate fixo. O risco de produto está na 1.15, não aqui | Núcleo, exaustivo |
| 23 | **3.3** O destaque de luz | **3** | BUS | **Não pronta.** Metade dos critérios depende de UX adiada. Dano baixo, bloqueio alto | Nenhuma até a passagem de UX |
| 24 | **1.8** A chamada | **2** | TECH | O modo de falha (`indexOf('.')` no milhar) está nomeado e o teste também | Núcleo |
| 25 | **1.12** Os cadernos desenhados | **2** | BUS | Visual, bem especificado, e a cor já tem barreira pela 1.2 | Aparelho |
| 26 | **2.5** Silenciar um caderno | **1** | BUS | Sem migration, `resolveRetroPrefs` já defensivo, chave desconhecida já descartada | Núcleo |
| 27 | **3.1** O postal | **1** | BUS | Uma tela, acromática, não grava. A menor superfície da frente | Aparelho |

---

## Registro de riscos

### Altos (score ≥ 6)

| ID | Cat | Story | Descrição | P | I | Score |
|---|---|---|---|---|---|---|
| R-01 | DATA | 1.1 | `agg_version_no_momento` grava `null` e `precisaErrata` devolve `false` para nulo. **Nenhuma edição em produção é elegível a errata hoje** | 3 | 3 | **9** |
| R-02 | TECH | 1.1 | `EdicaoInput.aggVersionNoMomento` é **opcional** (`?:`) e o upsert faz `?? null`. Tornar a coluna `not null` sem tornar o campo obrigatório troca "grava null calado" por "o backfill estoura 436 vezes em produção" | 2 | 3 | 6 |
| R-03 | DATA | 1.9 | `fetchEdicao` termina em `.maybeSingle()` sobre 4 colunas; com `caderno` na PK casa até 4 linhas e quebra o app instalado | 3 | 3 | **9** |
| R-04 | DATA | 1.9 | **NOVO** — `upsertEdicao` quebra junto: `onConflict: 'user_id,tipo_periodo,inicio,fim'` deixa de casar uma constraint única, e o `.select().single()` recebe até 4 linhas. O raio da migração é o dobro do mapeado | 3 | 3 | **9** |
| R-05 | TECH | 1.9 | A barreira do `ordenarCadernos` ausente — ou presente e **vácua** (T-4). Sem ela, uma edição fechada se reordena sozinha no dia em que o peso da confiança mudar | 2 | 3 | 6 |
| R-06 | TECH | 1.9 | `unique … deferrable initially deferred` + a função de reordenação no banco, **sem nenhum nível de teste de banco** no repo | 2 | 3 | 6 |
| R-07 | TECH | 1.10 | A barreira do `upsertEdicao` ausente ou vácua. "Verifica antes de gravar" é a NFR19 e hoje é comentário | 2 | 3 | 6 |
| R-08 | DATA | 1.10 | Gravar caderno a caderno em laço — o caminho natural de quem implementa — quebra a contiguidade de 1..N que a AD-4 exige | 2 | 3 | 6 |
| R-09 | BUS | 1.3 | O split por caderno feito como união silenciosa não falha em teste nenhum: só devolve o alfabeto ao tamanho antigo, e a taxa de alucinação aprovada volta de 3,6% para ~16% | 2 | 3 | 6 |
| R-10 | BUS | 1.4 | A quinta regra escrita frouxa passa em "existe caso que reprova por base sem nome" e continua aprovando a **inversão** B1/B2, que é o defeito que ela existe para pegar | 2 | 3 | 6 |
| R-11 | BUS | 1.11 | Sete estados por caderno (UX-DR9) sem nível de teste de render. O estado *reprovada* é o clímax da jornada 2 e não sobrevive ao relançamento — por decisão declarada | 3 | 2 | 6 |
| R-12 | DATA | 1.13 | Capa não carimbada na primeira impressão **não é recuperável**: `coverOf` lê `isCover` e `state==='linked'`, ambos mutáveis, e o estado que se releria já andou | 2 | 3 | 6 |
| R-13 | BUS | 1.15 | O portão humano não fechado. O Épico 2 imprime 53 períodos sobre uma aposta não validada — e é a aposta que o dono fez contra a mesa | 2 | 3 | 6 |
| R-14 | TECH | 2.2 | **NOVO** — "mesmo texto verificado nos dois hospedeiros" não é assertável sobre modelo não-determinístico. O teste obrigatório do CAP-13, como escrito, não fecha (T-3) | 3 | 2 | 6 |
| R-15 | SEC | 2.2 | Chave de serviço no script desligaria a RLS, que é a única proteção das linhas; e a credencial de sessão pode ser versionada por descuido | 2 | 3 | 6 |
| R-16 | DATA | 2.3 | **NOVO** — `edicoes_ia` vai de **7 para ~1.744 linhas** e **não tem leitura em lista hoje**. A parede da 2.4 é código novo lendo uma tabela que este próprio backfill infla além do corte de 1.000 do PostgREST | 2 | 3 | 6 |
| R-17 | DATA | 2.3 | Edições de 2026 impressas sem o carimbo de capa. Herda R-12 e o multiplica por todo o arquivo | 2 | 3 | 6 |
| R-18 | TECH | 4.1 | Janela lunar deslocada (fechada à direita, ou derivada de idade sinódica com ~0,8 dia de erro). **Não falha** — mede ruído com aparência de protocolo | 2 | 3 | 6 |
| R-19 | BUS | 4.2 | Três portões × três vereditos × "nulo é não medido, nunca zero". Um portão que reprova em silêncio publica "nenhum padrão" onde deveria dizer "inconclusivo" — que é a inversão exata que o pré-registro existe para impedir | 2 | 3 | 6 |

### Médios (score 3–4)

| ID | Cat | Story | Descrição | P | I | Score |
|---|---|---|---|---|---|---|
| R-20 | TECH | 1.2 | A barreira do `onAccent` cobrir `RoleTokens` e não `ModuleTokens` — e é `moduleOf()` que a faixa lê | 2 | 2 | 4 |
| R-21 | DATA | 1.3 | `PACOTE_VERSAO` 1→2 com o golden set existente (`ia/pacote.test.ts`, 255 l) escrito sobre a forma velha de `FatoNumero` | 2 | 2 | 4 |
| R-22 | BUS | 1.5 | O prompt não tem portão mecânico. Se ele não ensinar as regras novas, tudo reprova e a depuração culpa o verificador | 2 | 2 | 4 |
| R-23 | DATA | 1.6 | `deviceCoords()` em vez da constante do núcleo: os dois hospedeiros divergem só quando estiverem em fusos diferentes | 2 | 2 | 4 |
| R-24 | BUS | 1.6 | Luz entrando como inteiro em vez de uma casa decimal — a compensação medida do NFR17 (16% vs 3,6%) | 2 | 2 | 4 |
| R-25 | OPS | 1.9 | Ordem interna da migração. **Mitigado** pela transação por migration do Supabase CLI — confirmar no ensaio que nenhuma statement é não-transacional | 2 | 2 | 4 |
| R-26 | PERF | 1.11 | Geração preguiçosa disparada por render. Rota endereçável + parede longa é onde seis chamadas pagas por rolagem passam despercebidas | 2 | 2 | 4 |
| R-27 | TECH | 1.13 | O véu medido a 4,5 contra o pixel mais claro, no aparelho. Sem nível — a menos que a parte pura do cálculo nasça separada (T-1) | 2 | 2 | 4 |
| R-28 | TECH | 1.14 | `sendAccessibilityEvent(ref,'focus')` é código novo; `setAccessibilityFocus` está deprecado e é o que os documentos de UX nomeiam | 2 | 2 | 4 |
| R-29 | TECH | 2.1 | A barreira do `.from()` estendida ao quarto workspace, escrita no mesmo commit em que o alvo nasce — o cenário exato da vacuidade (T-4) | 2 | 2 | 4 |
| R-30 | OPS | 2.3 | **NOVO** — o backfill não declara idempotência. O contrato não diz o que acontece se o script morrer na edição 200 de 436 | 2 | 2 | 4 |
| R-31 | TECH | 2.4 | `'loading'` e `null` como estados distintos (precedente do `useAssetUri`); capa cuja imagem morreu ainda tem que dizer o que era | 2 | 2 | 4 |
| R-32 | DATA | 3.2 | A lacuna declarada do anuário depende de `metrica_lider` ter sido gravada desde a primeira impressão. Se o Épico 1 não gravar, o arquivo inteiro desenha lacuna | 2 | 2 | 4 |
| R-33 | BUS | 4.4 | Altura que cresce com o texto, igual nos três vereditos (UX-DR8). Caixa fixa corta o veredito em AX3 e anula a ADR 0045 em silêncio | 2 | 2 | 4 |
| R-34 | OPS | 4.3 | **Falso-vermelho** do hash: normalização de fim de linha ou espaço em branco por editor quebra o build sem nada substantivo ter mudado | 2 | 2 | 4 |
| R-35 | BUS | 1.7 | O ranqueamento estar mecanicamente certo e ainda assim não convencer. Risco real, mas medido pela 1.15, não por teste | 1 | 3 | 3 |
| R-36 | BUS | 3.3 | Story não pronta — metade dos critérios depende de UX adiada de propósito | 3 | 1 | 3 |
| R-37 | DATA | 2.3 | Paginação dos pacotes do backfill. **Rebaixado por evidência:** todas as tabelas dos quatro cadernos já paginam (ver auditoria abaixo) | 1 | 3 | 3 |

### Baixos (score 1–2)

| ID | Cat | Story | Descrição | P | I | Score | Ação |
|---|---|---|---|---|---|---|---|
| R-38 | TECH | 1.8 | Corte no separador de milhar pt-BR (`1.210 fotos` → `1.`) | 1 | 2 | 2 | Teste nomeado |
| R-39 | BUS | 1.12 | Movimento × Coração a ΔE 4,1–9,9; o ícone é o segundo portador | 2 | 1 | 2 | Aparelho |
| R-40 | BUS | 2.5 | Silenciar caderno; sem migration, resolução já defensiva | 1 | 1 | 1 | Monitorar |
| R-41 | BUS | 3.1 | O postal — uma tela, acromática, não grava | 1 | 1 | 1 | Monitorar |
| R-42 | OPS | 1.15 | Custo do piloto (~3 centavos, medido) | 1 | 1 | 1 | Monitorar |

**Legenda:** TECH arquitetura · SEC segurança · PERF desempenho · DATA integridade ·
BUS impacto de produto · OPS operação

---

## Auditoria de paginação — o rebaixamento do R-37, e de onde o risco mudou

Varredura de `packages/shared/src/data/*.ts` em 08/09/2026, cruzando tabela × uso de
`fetchAllPages`:

| Caderno | Tabelas que ele lê | Pagina? |
|---|---|---|
| Sono | `sleep_periods` · `daily_ratings` | ✅ ✅ |
| Movimento | `activities` · `activity_routes` · `activity_photos` | ✅ ✅ ✅ |
| Coração | `health_daily` · `health_series` | ✅ ✅ |
| Rotina | `todo_occurrences` · `habit_logs` · `registro_logs` · `registros` | ✅ ✅ ✅ ✅ |

**Todas paginam.** `fetchHealthDailySince` e `fetchHealthDailyValues` usam `fetchAllPages`
com ordenação total (`day` + `metric`) — as 4.385 linhas de `health_daily` que o contrato
cita já estão cobertas no caminho de leitura que o backfill vai usar.

As que **não** paginam são catálogos de cardinalidade limitada — `habits` (4 linhas),
`gear`, `goals`, `places`, `profiles`, `user_preferences`, `linked_accounts`,
`synced_activity_types`, `todo_templates` (102), `meals` (zerada) — **mais uma exceção que
importa**:

> **`edicoes-ia.ts` não pagina, e não tem leitura em lista nenhuma hoje.** Só
> `fetchEdicao` (uma linha) e `upsertEdicao`. Depois do backfill a tabela passa a ter
> ~1.744 linhas, e a parede de capas (2.4) é o primeiro código do repo a querer lê-las em
> lista. **É aí que o corte de 1.000 do PostgREST volta** — criado pelo próprio backfill
> desta frente, na story seguinte à que o cria.

Dois apontamentos menores da mesma varredura, sem risco atribuído:

- `health-daily.ts` carrega uma **segunda cópia local de `fetchAllPages`** (linha 57) em vez
  de importar `data/paginate.ts`. Duas implementações da mesma paginação; o backfill é o que
  vai exercitá-las mais. Limpeza de baixo custo, fora do escopo desta frente.
- O comentário do `theme.test.ts` na linha 35 diz *"As 24 combinações"*, mas o array
  `COMBOS` é `3 temas × 2 esquemas × 6 paletas` = **36**. O comentário está velho, o harness
  está certo. Vale corrigir junto da 1.2 para ninguém criar um segundo array "das 36".

---

## Plano de cobertura

> **P0–P3 é prioridade e risco, não momento de execução.** Quando cada faixa roda está na
> seção *Estratégia de execução*, adiante — e neste repo a resposta é quase sempre "no PR",
> porque a suíte inteira do núcleo é offline e roda em segundos.

Níveis usados: **Núcleo** (`npx tsx`, puro) · **Barreira** (`architecture.test.ts` /
`theme.test.ts`, offline) · **Mobile** (Jest, lógica) · **Ensaio** (migração fora de
produção) · **Aparelho** (humano, iPhone) · **Produção** (verificação pós-aplicação).

**Dono:** um só — Sydnei — nos três papéis (dev, QA, PM). A coluna "dono" foi omitida por
ser constante; onde ela mudaria alguma coisa, o texto diz "portão humano" e nomeia o ato.

### P0 — crítico

**Critério:** bloqueia a jornada central **e** risco ≥ 6 **e** sem alternativa.

| Story | Evidência exigida | Nível | Risco | Testes |
|---|---|---|---|---|
| 1.1 | `precisaErrata` devolve `true` após bump para edição gravada antes dele — o caso que hoje devolve `false` | Núcleo | R-01 | 4 |
| 1.1 | O campo deixa de ser opcional no tipo, não só `not null` na coluna. Barreira que falha se o caminho de gravação puder omitir o valor, **rodando offline** | Barreira | R-02 | 2 |
| 1.1 | Uma linha real em produção, gravada após o conserto, com `agg_version_no_momento` preenchido | Produção | R-01 | 1 |
| 1.9 | **Ensaio da migração fora de produção**, com as 7 linhas reais restauradas do `primeiras-edicoes-prompt-v2.md`; confirmar rollback limpo e nenhuma statement não-transacional | Ensaio | R-03/06/25 | 1 |
| 1.9 | `fetchEdicao` **e** `upsertEdicao` reescritos juntos — nenhum `.maybeSingle()`/`.single()` sobre a chave nova, `onConflict` casando a PK nova | Núcleo + Ensaio | R-03, R-04 | 4 |
| 1.9 | Barreira: `ordenarCadernos` não importável por `mobile/src` nem `web/src`, **com asserção de não-vacuidade** | Barreira | R-05 | 2 |
| 1.9 | Permutação de posições numa transação, com a constraint deferida; e a linha do caderno que saiu **apagada**, não órfã | Ensaio | R-06 | 3 |
| 1.9 | Abrir a Retrospectiva no aparelho com o build novo, migração já aplicada | Aparelho | R-03/04 | 1 |
| 1.10 | Barreira: `upsertEdicao` importável só pela sequência e por `data/`, **não-vácua**, com caso-espelho que prova que reprova | Barreira | R-07 | 2 |
| 1.10 | Sequência inteira (montar→narrar→verificar→gravar) com as três portas falsas, **sem rede** — inclusive o caminho em que o texto reprova e nada chega ao banco | Núcleo | R-07 | 5 |
| 1.10 | A escrita é do conjunto inteiro, numa chamada. Teste que **falha** se a gravação for por caderno | Núcleo | R-08 | 2 |
| 1.4 | Caso que reprova por **inversão** B1/B2 (a regra confere número **e** preposição), além do caso que reprova por base sem nome e do que aprova | Núcleo | R-10 | 4 |
| 1.13 | O carimbo acontece na 1ª impressão e na reimpressão **inteira**; **nunca** na parcial | Núcleo | R-12 | 3 |
| 2.2 | Nenhuma chave de serviço no workspace, credencial só do ambiente, nada versionado | Barreira + revisão | R-15 | 2 |
| 2.3 | Auditoria: toda leitura do backfill passa por `fetchAllPages` com ordenação **total**; e `edicoes_ia`/`edicoes_capa` ganham leitura paginada **antes** da 2.4 | Núcleo | R-16, R-37 | 3 |
| 2.3 | Nenhuma edição de 2026 gravada sem carimbo de capa — verificação em produção após o backfill | Produção | R-17 | 1 |

**Total P0:** ~40 testes · **~22–34 h**

> **P0 fica em ~31% do total, contra os <10% que a heurística do checklist recomenda.**
> Isto está sendo reportado, não escondido, e não vou ajustar a classificação para caber no
> número. A razão é a forma da frente: 19 dos 42 riscos são ≥6 porque ela junta uma
> **migração sem staging e sem OTA**, um **defeito vivo em produção** e um **pipeline de
> modelo**. Todo item acima falha os três testes do critério estrito de uma vez — bloqueia a
> jornada, pontua ≥6, e não tem alternativa. Se algo aqui deve sair de P0, a conversa é
> sobre qual risco aceitar, não sobre a proporção.

### P1 — alto

**Critério:** funcionalidade importante · risco 3–6 com alternativa · fluxo comum.

| Story | Evidência exigida | Nível | Risco | Testes |
|---|---|---|---|---|
| 1.3 | **Medição** do alfabeto por caderno, não asserção: `valoresDoPacote` de cada caderno e a contagem de inteiros 0–100 em cada um, publicados ao lado dos 71/16 de hoje | Núcleo | R-09 | 3 |
| 1.3 | O pacote de Sono não contém nenhum número de ciclismo — asserção sobre chaves, não sobre amostra | Núcleo | R-09 | 2 |
| 1.11 | Função pura `(edição, caderno) → EstadoCaderno` no núcleo, com os sete estados exaustivos — a alavanca do T-1 | Núcleo | R-11 | 7 |
| 2.2 | Pacote idêntico entre hospedeiros, byte a byte, sobre a mesma entrada; assinatura idêntica nos cinco campos; e os dois textos passam nas 5 regras contra o mesmo pacote **(no lugar de "mesmo texto" — T-3)** | Núcleo | R-14 | 3 |
| 4.1 | Erro do instante das fases contra efeméride de referência **na casa dos minutos**; janela `[cheia−5d, cheia)` **aberta à direita**, com o caso de fronteira que a fechada erraria | Núcleo | R-18 | 4 |
| 4.2 | Matriz completa: 3 portões × 3 vereditos, mais "nulo é não medido, nunca zero" quando o portão reprovou antes de medir | Núcleo | R-19 | 9 |
| 1.2 | `onAccent` é o argmax entre `ink` e `bgPure` **e** `contrast(onAccent, accent) ≥ 3,0` — em **dois** laços: `roles` e `MODULE_KEYS`, nas 36 combinações | Barreira | R-20 | 2 |
| 1.2 | Os hex históricos do Orbe claro não se movem; sem alias plano e sem variável CSS | Barreira | — | 2 |
| 1.3 | Fixtures puras do pacote sobre dado real, no mesmo commit; `PACOTE_VERSAO` = 2 | Núcleo | R-21 | 4 |
| 1.6 | Barreira: a coordenada é constante do núcleo, `deviceCoords()` não alcança o caminho da efeméride | Barreira | R-23 | 1 |
| 1.6 | A luz entra com **uma** casa decimal; fato de luz existe para 2023 sem coluna nova | Núcleo | R-24 | 3 |
| 1.7 | Ranqueamento exaustivo: passo 5 vence passo 6; julho/2026 com lápide em dois cadernos e Movimento liderando pelo catálogo; setembro/2026 **sem** liderar; Rotina não lidera por amostra pequena | Núcleo | R-35 | 6 |
| 1.11 | Nenhum caminho de leitura escreve — abrir, rolar e folhear custam zero chamadas | Núcleo + aparelho | R-26 | 2 |
| 1.13 | O cálculo do véu (dada luminância, quanto falta) separado e puro; e a saída "texto vai para baixo da imagem" como parte da regra | Núcleo | R-27 | 3 |
| 2.1 | Barreira do `.from()` estendida ao 4º workspace **com** asserção de não-vacuidade; o workspace entra no portão do CI | Barreira + CI | R-29 | 2 |
| 2.3 | Comportamento declarado para falha no meio: reexecutar não duplica nem pula | Núcleo | R-30 | 2 |
| 2.4 | Leitura da parede paginada desde o nascimento; `'loading'` ≠ `null`; capa com imagem morta ainda diz o que era | Núcleo | R-16, R-31 | 4 |
| 3.2 | Mês sem carimbo desenha **lacuna declarada**, nunca valor recalculado | Núcleo | R-32 | 2 |
| 4.3 | Barreira do hash pinando **a cadeia** (2 documentos hoje), incondicional e offline; procedimento escrito para o falso-vermelho | Barreira | R-34 | 2 |

**Total P1:** ~63 testes · **~26–41 h**

### P2 — médio

**Critério:** fluxo secundário · risco 1–2 · caso de borda.

| Story | Evidência | Nível | Testes |
|---|---|---|---|
| 1.8 | Milhar com ponto, decimal com vírgula, abreviação; chamada **ausente** (nunca string vazia) quando não há texto | Núcleo | 5 |
| 1.5 | Revisão do prompt contra as cinco regras + NFR1/2/4 + a regra da primeira frase; `PROMPT_VERSAO` = 3; nenhum literal de fornecedor | Revisão + barreira | 3 |
| 1.14 | Sumário em estado misto (linha permanece, sem chamada); alvo de toque ≥ 44 px | Núcleo + aparelho | 3 |
| 2.5 | Caderno silenciado não aparece **nem** quando o ranqueamento o poria em primeiro; chave desconhecida descartada | Núcleo | 3 |
| 3.1 | Postal não grava; reabrir volta aos três fatos sem prosa | Núcleo | 2 |

**Total P2:** ~16 testes · **~8–16 h**

### P3 — baixo

**Critério:** exploratório · conferência visual · nada mecanizável.

Todos humanos, e todos com o mesmo formato de evidência: **uma conferência nomeada, num
build nomeado**.

| Story | O que conferir | Testes |
|---|---|---|
| 1.12 | As quatro faixas distinguíveis nas seis paletas; `bicycle-outline` presente; lápide em dois estados e nunca um terceiro | 3 |
| 1.14 | VoiceOver: tocar a linha do sumário move o foco junto da rolagem | 1 |
| 4.4 | Tipo dinâmico **AX3**: a moldura cresce igual nos três vereditos e no quarto estado | 2 |
| 1.13 / 2.4 | O véu alcançando 4,5 numa foto de céu branco; a fronteira traçado→foto visível sem legenda | 2 |

**Total P3:** ~8 conferências · **~2–5 h**

---

## Estratégia de execução

**Filosofia: roda tudo no PR.** A suíte inteira do núcleo é offline — sem rede, sem banco,
sem browser — e o CI já executa os três workspaces em minutos a cada push (`ci.yml`). Não há
nada caro o bastante para justificar uma faixa noturna, e criar uma seria inventar operação
que este projeto não tem.

| Quando | O quê | Custo |
|---|---|---|
| **Todo PR / push** | `pnpm --filter @vitale/shared lint && test` (núcleo + as barreiras) · `pnpm --filter @vitale/web build && test` · `cd mobile && pnpm exec tsc --noEmit && pnpm exec jest`. **Tudo que é automatizável desta frente cabe aqui**, P0 a P2 | minutos |
| **Uma vez, por story** | O **ensaio da migração** (1.9) e as **verificações em produção** (1.1, 2.3). Não são recorrentes: provam um evento que acontece uma vez | ~1 h cada |
| **Por build de entrega** | As **8 conferências no aparelho** (P3 e as fatias de superfície de P1/P2). Agrupar por build — não vale queimar um build por conferência | ~30 min por lote |

Não há faixa noturna nem semanal, e isso é decisão, não omissão: sem k6, sem caos, sem suíte
longa, uma faixa noturna só adicionaria latência entre escrever e saber.

---

## Risco residual — o que sobra depois de tudo isto

Nomeado para não virar surpresa. Estes não são mitigáveis dentro desta frente:

| Residual | Por que sobra | Quem absorve |
|---|---|---|
| **A janela da AD-15** | Migração aplicada em instância única, sem OTA, com build pronto para instalar. O ensaio encurta a janela; não a elimina. Medida em minutos, e declarada | Aceito pelo contrato (AD-15) |
| **12 stories sem nível de render** | T-1. Empurrar o estado da 1.11 para o núcleo cobre a decisão, não o pixel | Conferência humana no aparelho |
| **A prosa do modelo** | Nenhum teste sabe ler se um texto informa em vez de aconselhar (NFR1) ou se nomeia um veredito por extenso (ADR 0046, que já declara isso em vez de fingir) | Portão humano — 1.15 e a leitura das edições |
| **`metrica_lider` dos períodos antigos** | Nada recupera qual métrica liderou antes da coluna existir | Lacuna declarada (3.2), por desenho |
| **A reprovação não sobrevive ao relançamento** | `edicoes_ia` é tabela de edição publicada, não de tentativa. Decisão de produto declarada na 1.11 | Aceito e documentado na própria story |

---

## Planejamento de NFR

| Categoria | Requisito / limiar | Risco | Validação planejada | Evidência esperada |
|---|---|---|---|---|
| Integridade (NFR3, NFR17) | Todo número citado existe no pacote. Alfabeto: inteiro 0–100 passa **16%**; com uma decimal, **3,6%** | R-09, R-24 | Medição do alfabeto por caderno, comparada com os 71/16 de hoje | Números no relatório de teste do núcleo |
| Integridade (NFR5, NFR16) | Período fechado congela; ordem vem de `posicao`, contígua 1..N | R-05, R-06, R-08 | Barreira + ensaio da transação | Barreira verde e não-vácua; log do ensaio |
| Integridade (NFR13) | Bump de `AGG_VERSION` marca errata em **todas** | R-01, R-02 | Núcleo + verificação em produção | `precisaErrata=true`; linha real com o campo preenchido |
| Confiabilidade (NFR18) | Nenhuma leitura por intervalo perde linha ao passar de 1.000 | R-16, R-37 | Auditoria de `fetchAllPages` + ordenação total | Tabela de auditoria (acima), reexecutada após a 2.3 |
| Confiabilidade (NFR19) | Verifica antes de gravar, em **qualquer** hospedeiro | R-07, R-14 | Barreira do `upsertEdicao` + sequência com portas falsas | Barreira verde; caso de reprovação que não grava |
| Segurança (AD-14) | Sem chave de serviço; credencial não versionada | R-15 | Revisão + varredura do workspace | Revisão registrada |
| Acessibilidade (UX-DR1/7/8) | `onAccent` ≥ 3,0 nas 36; obrigatório em `ink2`; altura cresce em AX3 | R-20, R-33 | `theme.test.ts` (2 laços) + aparelho em AX3 | Barreira verde; conferência nomeada |
| Custo (OPS) | ~US$ 0,011/chamada; ~US$ 1,20 no backfill de mês/trimestre/ano | R-42 | Contagem de chamadas do backfill | Total gasto vs. orçado |
| Manutenibilidade (AD-7 herdada) | Barreira nova entra no mesmo commit da regra, e roda offline | T-4 | Asserção de não-vacuidade em cada barreira nova | 3 barreiras com alvo comprovado |

**Limiares UNKNOWN — não inventados:**

- **Poder do teste lunar.** O desvio-padrão da hora de apagar ainda não foi consultado; o
  pré-registro autoriza essa consulta única, e é ela que decide se a primeira execução tem
  poder. Até lá, "faltam ~106 noites" é estimativa, não limiar.
- **Determinismo do provedor.** Não há limiar publicado de reprodutibilidade. É a razão do
  T-3, e a razão de o portão ser pacote + assinatura, não texto.
- **Tempo de render da parede** com ~1.744 linhas. Nenhum número no contrato, e nenhum
  inventado aqui — a auditoria de paginação (R-16) é o que impede que isso vire descoberta.

---

## Critérios de entrada e saída

### Entrada

- [ ] `main` verde nos três workspaces (`shared` lint+test · `web` build+test · `mobile` tsc+jest)
- [ ] Worktree conferido contra `origin/main` antes de qualquer build de entrega
- [ ] Ambiente de ensaio da migração disponível (banco local ou projeto descartável)
- [ ] As 7 edições em produção exportadas — já estão, em `primeiras-edicoes-prompt-v2.md`
- [ ] Build do iPhone **compilado e pronto para instalar** antes de a migração da 1.9 rodar (AD-15)

### Saída

- [ ] 100% dos P0 verdes
- [ ] ≥95% dos P1 verdes, com dispensa registrada para o resto
- [ ] Nenhum risco ≥6 sem mitigação ou dispensa nomeada
- [ ] **As três barreiras novas provadamente não-vácuas** (T-4)
- [ ] `precisaErrata` verificado contra uma linha **real** de produção (R-01)
- [ ] **Portão humano 1.15 fechado pelo dono** — três edições lidas, e ele consegue dizer
      qual caderno liderou cada uma e por quê
- [ ] **Portão humano das 8 stories de superfície** — conferência nomeada no aparelho

---

## Portões de qualidade

- **P0:** 100%, sem exceção
- **P1:** ≥95%, dispensa registrada
- **P2/P3:** ≥90%, informativo
- **Riscos ≥6:** 100% mitigados ou dispensados por escrito
- **Barreiras:** verdes **e** com alvo comprovado — barreira verde por vacuidade conta como
  vermelha

**Não-negociáveis:**

- [ ] Nenhuma edição gravada por caminho que não passe pela sequência (R-07)
- [ ] Nenhum `.maybeSingle()`/`.single()` sobrevivente sobre a chave nova (R-03, R-04)
- [ ] Nenhuma leitura por intervalo sem `fetchAllPages` + ordenação total (R-16)
- [ ] Nenhuma chave de serviço em lugar nenhum (R-15)
- [ ] A 1.15 não é fechada por agente nenhum

---

## Planos de mitigação — os que mudam a sequência de trabalho

> **Dono de toda mitigação:** Sydnei (projeto de um desenvolvedor). **Prazo** aqui é
> **ordem**, não data — este projeto planeja por sequência e por veredito, não por
> calendário, e inventar datas seria precisão falsa. A ordem obrigatória está em
> *Dependências*, adiante.

### R-01/R-02 · `AGG_VERSION` (score 9) — **precede tudo**

A ordem já está no contrato e o test design só a confirma com um detalhe novo: **tornar a
coluna `not null` sem tornar o campo TS obrigatório troca um defeito silencioso por um
ruidoso em produção** — o backfill estouraria 436 vezes. As duas mudanças são uma só.

**Verificação:** `precisaErrata` devolve `true` para uma edição gravada antes de um bump —
o caso que hoje devolve `false`. Mais uma linha real em produção, gravada após o conserto,
com o campo preenchido. Só a segunda prova que o caminho de gravação real mudou.

### R-03/R-04 · A migração (score 9) — o raio é o dobro do mapeado

`fetchEdicao` estava na lista. **`upsertEdicao` não estava e quebra pela mesma causa**: o
`onConflict: 'user_id,tipo_periodo,inicio,fim'` deixa de nomear uma constraint única quando
a PK ganha `caderno` — o Postgres recusa —, e o `.select().single()` que ele encadeia passa
a receber até quatro linhas.

Consequência prática: a janela de AD-15 não é só de leitura. **Um build antigo que tente
imprimir depois da migração falha na gravação**, não só na abertura. Os dois caminhos entram
no mesmo commit e no mesmo ensaio.

**Verificação:** ensaio fora de produção com as 7 linhas reais; depois, no aparelho, abrir a
Retrospectiva **e** imprimir uma edição.

### R-09 · O alfabeto (score 6) — medir, não asserir

O split por caderno é a maior mitigação de segurança da frente: seis pacotes de 40 em vez
de um de 240. Mas um split malfeito **não falha nenhum teste** — só devolve o alfabeto ao
tamanho antigo.

**Verificação:** não "o pacote de Sono não tem ciclismo" (isso é o sintoma). A prova é a
**medição**: `valoresDoPacote` por caderno e a contagem de inteiros 0–100 em cada um,
publicadas ao lado dos 71/16 de hoje. Se a soma dos quatro se aproximar de 71, o split é
nominal.

### R-14 · O teste dos dois hospedeiros (score 6) — reformular a prova, não a decisão

Ver T-3. A decisão do contrato está certa — *"não existem duas implementações da mesma
conta"*. A prova é que não fecha como escrita. O portão passa a ser pacote byte-a-byte +
assinatura idêntica + os dois textos passando nas mesmas cinco regras contra o mesmo pacote.
Comparar os textos à mão uma vez continua valendo como sinal.

### R-16 · A parede lendo o que o backfill inflou (score 6) — ordem de trabalho

A 2.3 cria o volume; a 2.4 o lê. Se a leitura em lista de `edicoes_ia`/`edicoes_capa` nascer
sem paginação, o defeito aparece **depois** do backfill, com todo o arquivo já gravado, e o
sintoma ("faltam capas") aponta para a impressão, não para a leitura — exatamente o modo de
falha assimétrico que o `paginate.ts` documenta.

**Mitigação:** a leitura paginada nasce **na 2.3**, junto do backfill que cria o volume, não
na 2.4 que o consome.

### R-13 · O portão humano da 1.15 (score 6) — e o que ele bloqueia

Nenhum agente fecha esta story. O que o test design acrescenta é **o que está a jusante**: o
Épico 2 imprime 53 períodos sobre esta aposta, e o Épico 3 constrói o anuário sobre a
`metrica_lider` que ela valida. Se a 1.15 não fechar, esses dois não devem começar.

Sugestão de forma, para o julgamento não ficar difuso: as três edições impressas, uma
pergunta só — *"qual caderno liderou, e por quê?"* —, respondida antes de ler o texto do
caderno líder.

### R-36 · A 3.3 não está pronta (score 3)

Não há plano de teste a escrever. A evidência que ela exige antes de fechar é uma decisão:
**a passagem de UX aconteceu, ou a story morreu**. O contrato já autoriza a segunda saída
("pode acabar não sendo necessária — se a luz na prosa já bastar"). Deixá-la aberta sem
decisão é o único desfecho que custa.

---

## Interoperação e regressão

| Componente | Como é afetado | Regressão que precisa continuar passando |
|---|---|---|
| `/retrospectiva` | Não perde nada (AD-1): seletor, 13 blocos, painel Diagramação. O `EdicaoCard` vira porta | Abrir a retro nos cinco tipos de período, inclusive `all` e período em curso |
| `health-sync` (mobile) | `AGG_VERSION` deixa de ser dele e passa a vir do núcleo | Sync completo com backfill por versão (`cursor.version < AGG_VERSION`) |
| Sistema de temas | `onAccent` entra em `RoleTokens` **e** `ModuleTokens` | `theme.test.ts` inteiro — inclusive a trava dos hex históricos do Orbe claro |
| `architecture.test.ts` | Ganha 3 barreiras e estende a varredura do `.from()` | As barreiras existentes continuam com alvo |
| `edicoes_ia` | Chave, colunas e forma de escrita mudam | As 7 edições saem na migração; nenhum caminho de leitura antigo sobrevive |
| Web (Angular) | **Não é tocada** — web é não-objetivo | `pnpm --filter @vitale/web build && test` verde no CI (AD-17) |

---

## Estimativa de esforço

| Prioridade | Testes | Horas | Notas |
|---|---|---|---|
| P0 | ~40 | **22–34** | Inclui o ensaio da migração e as verificações em produção |
| P1 | ~63 | **26–41** | Barreiras e núcleo, quase tudo offline |
| P2 | ~16 | **8–16** | Cenários simples |
| P3 | ~8 | **2–5** | Conferências no aparelho, humanas |
| **Total** | **~127** | **58–96** | **~1,5–3 semanas** |

Intervalos, não números exatos: a maior fonte de variação é o ensaio da migração, que pode
levar uma hora ou uma tarde dependendo de o banco local subir de primeira. As faixas já
incluem o tempo de montar as fixtures.

**Pré-requisitos:** ambiente de ensaio da migração; as fixtures puras do pacote e do
verificador (que a Story 1.3 já entrega); credencial de sessão de usuário para o script,
vinda do ambiente. **Nenhuma ferramenta nova** — tudo cabe em `npx tsx`, Jest e o aparelho.

---

## Assunções e dependências

**Assunções**

1. O ensaio da migração roda em banco local ou projeto descartável. Se não houver nenhum
   dos dois, R-03/R-04/R-06 sobem para 9 e a única mitigação restante é a revisão dupla.
2. Provedor e modelo continuam configuração (ADR 0040) — nenhum teste os pina.
3. O contrato do backfill não muda: mês, trimestre e ano; semana não grava.
4. O dono continua sendo o único usuário — nada aqui assume concorrência real, exceto o
   *lost update* entre iPhone e script que a AD-4 já resolve no banco.

**Dependências**

1. **1.1 antes de qualquer impressão** — inclusive antes do piloto da 1.15, senão as três
   edições do piloto nascem inelegíveis a errata.
2. **1.9 e o build na mesma sessão** (AD-15), com o build compilado antes de a migração rodar.
3. **1.13 (o carimbo) antes de 2.3** — carimbar depois não recupera nada.
4. **1.15 fechada antes de 2.3** — o backfill imprime 53 períodos sobre a aposta.
5. **A `metrica_lider` gravada desde a primeira impressão** — senão o anuário da 3.2 desenha
   lacuna no arquivo inteiro.
6. **Passagem de UX antes de 3.3**, ou a decisão de matar a story.

**Riscos ao próprio plano**

- **Não haver ambiente de ensaio.** Impacto: a story de maior risco fica sem nível nenhum.
  Contingência: revisão dupla dos dois caminhos (`fetchEdicao` e `upsertEdicao`) mais janela
  de aplicação escolhida com o build já instalado no aparelho.
- **A 1.15 demorar a fechar.** Impacto: os Épicos 2 e 3 param. Contingência: adiantar 2.1
  (workspace) e 2.2 (script), que não dependem do veredito, e segurar só a 2.3.
- **T-1 ser resolvido do jeito caro.** Se alguém introduzir framework de render no meio da
  frente, o custo cai sobre a story de maior risco. Contingência: a recomendação de empurrar
  o estado do caderno para função pura (1.11) está no P0 justamente para tornar isso
  desnecessário.

---

## Fluxos seguintes (manuais)

- `/bmad-testarch-atdd` — gera os testes P0 vermelhos, quando a implementação começar.
- `/bmad-testarch-trace` — matriz de rastreabilidade CAP → story → teste, depois da 1.9.
- `/bmad-testarch-nfr` — auditoria de evidência de NFR, **depois** de haver implementação.

---

## Apêndice

**Base de conhecimento:** `risk-governance` · `probability-impact` ·
`test-levels-framework` · `test-priorities-matrix` · `mobile-test-strategy` · `nfr-criteria`

**Documentos de entrada:** [spec.md](../../docs/specs/revista-retrospectiva/spec.md) ·
[cadernos.md](../../docs/specs/revista-retrospectiva/cadernos.md) ·
[bases-e-ranqueamento.md](../../docs/specs/revista-retrospectiva/bases-e-ranqueamento.md) ·
[mudancas-mecanicas.md](../../docs/specs/revista-retrospectiva/mudancas-mecanicas.md) ·
[epics.md](../../_bmad-output/planning-artifacts/epics.md) ·
[ARCHITECTURE-SPINE.md](../../_bmad-output/planning-artifacts/architecture/architecture-Orbe-revista-2026-09-08/ARCHITECTURE-SPINE.md)

**Evidência de código, conferida em 08/09/2026:**
[edicoes-ia.ts](../../packages/shared/src/data/edicoes-ia.ts) ·
[paginate.ts](../../packages/shared/src/data/paginate.ts) ·
[health-sync.ts:90](../../mobile/src/services/health-sync.ts#L90) ·
[architecture.test.ts](../../packages/shared/src/architecture.test.ts) ·
[theme.test.ts](../../packages/shared/src/theme/theme.test.ts) ·
[ci.yml](../../.github/workflows/ci.yml)

---

**Gerado por:** BMad TEA — Master Test Architect · `bmad-testarch-test-design` v4.0 (BMad v6)
