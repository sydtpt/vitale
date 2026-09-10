---
title: 'Story 1.6 — A camada de luz entra nos quatro pacotes'
type: 'feature'
created: '2026-09-09'
status: 'done'
review_loop_iteration: 5
baseline_commit: '36e845b'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — renegotiated by the owner on 10/09/2026, after the second review failed">

## Intent

**Problem:** A narrativa não sabe se o período foi de dias curtos ou longos, então não separa
*"você fez menos"* de *"você fez menos do que se faz em novembro"*. Um novembro escuro e um
julho claro produzem comportamentos diferentes pela mesma pessoa, e hoje o modelo lê os dois
como se fossem o mesmo mundo.

**Approach:** A luz entra como **texto sem número** — *"dias curtos"*, *"dias longos"*, *"dias
em transição"* —, derivada na leitura das horas de luz que o `astro/sun.ts` mede a partir de
uma coordenada **constante do núcleo**, e nunca gravada. É **propriedade do período**, não de
um caderno: mora em `periodo`, que os quatro pacotes compartilham, e o prompt a escreve **uma
vez**, no cabeçalho. O modelo passa a saber a estação; não passa a poder citar horas.

## Boundaries & Constraints

**Always:**
- **Zero número.** A luz não põe valor nenhum no alfabeto de caderno nenhum, em mês nenhum.
  Duas tentativas puseram um número e as duas foram revertidas — ver `Spec Change Log`.
- **Zero vocabulário de base e zero nome de mês** no texto da luz. Nem *"ano passado"*, nem
  *"período anterior"*, nem *"normal"*, nem *"agosto"*: a quinta regra lê essas palavras como
  nomeação, e a segunda tentativa provou que ela as captura mesmo com a nomeação certa por
  perto.
- **Propriedade do período, escrita uma vez.** Não entra em `metricas` nem em `textos` de
  caderno nenhum; não altera `semDado`; não ressuscita caderno vazio em **nenhum** dos dois
  grãos do prompt.
- **A coordenada é constante do núcleo** (~50,8° N), **nunca** `deviceCoords()` (AD-10).
- **Toda asserção varre os meses, nunca um mês só.** As duas tentativas anteriores passaram
  verdes ancoradas no agosto de 14,5 h, que era o caso sortudo.

**Ask First:**
- Qualquer número na luz, em qualquer forma.
- Qualquer quarto nível de estação, ou trajetória (*"alongando"*, *"encurtando"*).

**Never:**
- Não modelar viagem — período fora do país recebe a luz de casa (decisão do dono, 07/09).
- Não comparar com o ano anterior: a luz de agosto é a mesma todo agosto, e a direção que a
  segunda tentativa escrevia era ruído de arredondamento, não sinal.
- Não tocar na lua (Épico 4). Não escrever tela.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Mês escuro | Dezembro | `periodo.luz` diz dias **curtos** | N/A |
| Mês claro | Junho | `periodo.luz` diz dias **longos** | N/A |
| Mês de equinócio | Março, setembro | `periodo.luz` diz dias **em transição** | N/A |
| Semana e trimestre | Qualquer | O mesmo critério, sobre a média do intervalo | N/A |
| Ano e `all` | Período que cobre todas as estações | `periodo.luz` é `null` — não há estação a relatar | N/A |
| Alfabeto | **Cada mês de 2023 a 2027**, em **cada caderno** | Nenhum valor novo, nenhum inteiro novo | N/A |
| Quinta regra | Texto que copia a frase da luz perto de um valor de base | Veredito **idêntico** ao do mesmo texto sem a frase | N/A |
| Caderno vazio | Caderno sem fato próprio, no prompt da edição | Não aparece — a luz não o ressuscita | N/A |
| Fuso e ordem | O mesmo período em fusos e ordens de cálculo diferentes | Texto **idêntico** | N/A |

</frozen-after-approval>

## Code Map

- `/private/tmp/claude-501/-Users-sydtpt-Projects-life-organizer/e6542ba7-c99a-4370-ac25-e87d1b61b490/scratchpad/luz-ref/`
  -- **o núcleo astronômico da tentativa 2, guardado antes do revert**: `sun.ts.ref`,
  `casa.ts.ref`, `sun.test.ts.ref`. `daylightHours`, `meanDaylightHours` e o memo de chave
  completa passaram em três rodadas de revisão — reconstrua a partir deles, **sem** o atalho
  de ano inteiro
- `packages/shared/src/astro/sun.ts:233` -- `solarEvents` com `SUNRISE_DEG`: a efeméride a
  reusar (AD-3 herdada)
- `packages/shared/src/astro/timezone-coords.ts:81` -- `deviceCoords()`: **proibido aqui**
- `packages/shared/src/ia/pacote.ts:228-249` -- `PacoteDeFatos.periodo`: o objeto que os
  quatro pacotes compartilham. `rotuloAnterior` é o precedente: campo de **texto** posto ali
  justamente por custar zero no alfabeto
- `packages/shared/src/ia/pacote.ts:682-717` -- `numerosDoPacote` / `procedenciaDoPacote`:
  leem `periodo.diasNoPeriodo` e mais nada de `periodo` — um campo de texto novo não os toca
- `packages/shared/src/ia/prompt.ts` -- os cabeçalhos de `montarPrompt` e de
  `montarPromptDaEdicao`, onde a luz é escrita **uma vez**; e `PROMPT_VERSAO`
- `packages/shared/src/ia/verificar.ts:99-136` -- `B1_GENERICO`, `B1_POR_TIPO`, `B2_VOCAB`,
  `B3_VOCAB`: o vocabulário que o texto da luz **não pode** conter. `MONTHS_PT` idem
- `packages/shared/src/ia/verificar.test.ts` -- a varredura "nenhum vocabulário de base em lugar
  nenhum do SISTEMA": o molde do teste que o texto da luz precisa ter

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/astro/casa.ts` -- a coordenada de casa como constante do núcleo, e os
      **limiares** das três estações de luz, derivados do mínimo e do máximo anuais medidos
      ali — com a derivação escrita, não só o valor
- [x] `packages/shared/src/astro/sun.ts` -- `daylightHours` e `meanDaylightHours` com o memo de
      chave completa (latitude, longitude, data com ano), reconstruídos da referência; **sem**
      o atalho de ano inteiro, que só servia a `all`, que agora não tem luz
- [x] `packages/shared/src/ia/pacote.ts` -- `periodo.luz: string | null`, com o texto da estação
      para `week`, `month` e `season`, e `null` para `year` e `all`
- [x] `packages/shared/src/ia/prompt.ts` -- a luz escrita uma vez no cabeçalho dos dois grãos;
      `PROMPT_VERSAO` 3 → 4, porque o texto que sai mudou
- [x] `packages/shared/src/ia/pacote.test.ts` -- a medição do alfabeto **para cada mês de 2023 a
      2027**, por caderno: a luz não acrescenta nada, em nenhum
- [x] `packages/shared/src/ia/verificar.test.ts` -- o texto de cada estação contra o vocabulário
      de base inteiro e contra os doze meses, normalizado como a quinta regra normaliza; e a ida
      e volta: o mesmo texto com e sem a frase da luz tem o **mesmo** veredito
- [x] `packages/shared/src/ia/verificar.test.ts` -- `montarPromptDaEdicao` sobre pacotes de
      `montarPacotes` com um caderno vazio: o caderno não aparece, e a luz aparece **uma vez**
- [x] `packages/shared/src/astro/sun.test.ts` -- os limiares e a estação de cada mês publicados
      na saída; invariância de fuso e de ordem

**Acceptance Criteria:**
- Given o mesmo resumo montado em cada mês, semana e trimestre de 2023 a 2027, when a
  procedência de cada caderno é lida, then o número de entradas e o conjunto de chaves são
  **os mesmos em todo período** — nenhum número novo, sob chave nenhuma, constante ou não.
- Given dois períodos do mesmo comprimento em estações diferentes, when os alfabetos são
  comparados, then são **idênticos**.
- Given qualquer texto de estação, when ele é normalizado, then não contém dígito, termo de
  vocabulário de base nem nome de mês.
- Given o prompt de uma edição real, when ele é lido, then a luz aparece exatamente uma vez.
- Given a story fecha, when `PROMPT_VERSAO` é lido, then vale 4.

## Spec Change Log

### Iteração 1 — a luz custava quatro números e entregava um (09/09/2026)

A luz como `FatoNumero` com B2 valorada: o `delta` estruturalmente zero autorizava o inteiro
`0` em Sono e Coração, e `B2.valor === atual` desarmava a quinta regra para a própria luz.
Revertida. Detalhe completo no histórico do git deste arquivo.

### Iteração 2 — o número único ainda poluía, e a frase anual capturava a quinta regra (10/09/2026)

**Achado que disparou.** A luz como **um** `FatoNumero` sem base, mais um `FatoTexto` anual. As
três camadas de revisão, com execução:

1. **A asserção "nenhum inteiro novo" passava ancorada em agosto de novo** — o mesmo mês
   sortudo que a iteração 1 tinha denunciado. Julho (16), novembro (9) e dezembro (8)
   acrescentam um inteiro pequeno a três ou quatro cadernos: *"Foram 16 noites acima da meta."*
   passava na regra 1 com a luz e era recusado sem ela. O critério era falso em 28% dos meses.
2. **A luz desarmava a quinta regra para OUTROS fatos.** Quando o valor dela colidia com um
   valor de base, a guarda de ambiguidade calava sobre aquele número, e uma troca de B1 por B2
   era gravada.
3. **"de agosto do ano passado" é a frase prescrita de B2**, e ela capturava números de B1 mesmo
   com a nomeação certa na frase: *"Sob a mesma luz de agosto do ano passado, 820 km em julho
   viraram 333."* era recusado, com "julho" a 7 caracteres do 820 e "ano passado" a 2.
4. **O portão de caderno mudo só existia no grão que a produção não usa**; a produção passava a
   ter quatro linhas de luz e cadernos vazios ressuscitados pela camada.
5. **"Mais/menos luz" era decidido por arredondamento**, não pela diferença — 49,6 s por dia
   dizia "a mesma luz", 46,3 s dizia "mais luz".

**Por que é emenda de intenção, não de código.** A spec congelada exigia a luz como número com
uma casa decimal **e** exigia que ela não acrescentasse inteiro pequeno a caderno nenhum. As
duas coisas não cabem juntas: horas de luz são redondas por natureza em 28% dos meses. Pela
política do `AGENTS.md`, defeito da mesma classe de novo quer dizer que a spec está errada. O
dono renegociou em 10/09: a luz vira **texto, sem número**.

**KEEP — o que sobrevive:**
- **O núcleo astronômico**, guardado em `luz-ref/`: `daylightHours` / `meanDaylightHours` sobre
  `solarEvents` com `SUNRISE_DEG`, entrada em `YYYY-MM-DD`, ramos polares definidos, memo de
  chave completa. Conferido: Bruxelas no solstício de junho deu 16,512 h contra 16 h 31 min do
  almanaque, e todo período que a revista imprime deu exato ao bit contra a soma dia a dia.
- **`casa.ts` com a razão da AD-10** escrita onde alguém a editaria.
- **A lição de teste**: asserção de alfabeto varre os meses. Duas tentativas passaram verdes
  sobre um mês só.

**Descartado de propósito:** o atalho de ano inteiro. Ele acelerava `all`, que nunca é narrado
em produção e agora não tem luz; e mudava o decimal publicado em 9 de cada 7.054 datas.

### Iteração 3 — o invariante segurou; os testes eram mais fracos do que diziam (10/09/2026)

**O que a rodada mediu.** Pela primeira vez, **nada chegou ao alfabeto**: `periodo.luz` não é
lido pela procedência, pelo alfabeto nem pela quinta regra. Foi exatamente isso que caiu duas
vezes. O que voltou foi de outra natureza, e por isso foi remendo, não revert:

1. **O teste do alfabeto só pegava a luz pelo nome.** Ele comparava cada pacote com ele mesmo
   "sem a luz", tirando `periodo.luz` e os fatos de chave `luz` — e tirar `periodo.luz` não
   muda nada, porque a procedência nunca o lê. A revisão devolveu as horas sob a chave `sol` e
   os 240 pacotes passaram. **Trocado por isomorfia**, que não pergunta nome: com o mesmo
   resumo, meses do mesmo comprimento e estações diferentes (janeiro e julho têm 31 dias), toda
   semana, e o 3º e o 4º trimestres (92 dias cada) têm que ter alfabetos **idênticos**. Com a
   mutação `sol`, os três reprovam.
2. **Nenhum teste conferia QUAL texto um mês recebe.** Trocar "curtos" por "longos" passava:
   o texto continuava sem dígito e igual nos quatro cadernos. Agora cada mês é cobrado contra
   a estação dele, e a matriz da spec é cobrada com o texto literal nos cinco anos.
3. **Semana e trimestre nunca eram montados.** A tela abre na semana. Agora toda semana e
   todo trimestre de 2023 a 2027 são cobrados.
4. **A lei não dizia ao modelo o que fazer com a linha nova**, e o modelo que a usasse para o
   que ela serve — situar a estação — escreveria *"a corrida subiu graças aos dias longos"*,
   recusado pela regra de causa. A FORMA ganhou a instrução: contexto, nunca explicação, nunca
   comparada com a luz de outro ano, nunca em horas.
5. **Guardas baratas**: a coordenada congelada e cobrada pelo valor literal (um
   `= deviceCoords()` avaliado no import passaria no teste de fuso); longitude fora do globo e
   data torta viram `NaN` antes do memo; a duração presa a [0, 24] junto do círculo polar.

**Uma afirmação falsa, minha, corrigida.** A prova negativa desta spec dizia que pôr horas no
texto da luz reprovava a medição do alfabeto. Não reprova — só a varredura de dígito pega.

**O que não se resolve aqui, declarado:**
- **O modelo pode escrever horas de luz de cabeça**, por extenso ou por coincidência com um
  valor que o pacote já autoriza. A lei agora proíbe, mas nenhuma regra mecânica cobra — isso
  mexeria na severidade da conferência.
- **O modelo pode parafrasear a luz com vocabulário de base** (*"os mesmos dias longos do ano
  passado"*) e reabrir a captura da quinta regra. A lei proíbe comparar com outro ano; a
  frase literal da luz é provadamente inerte, a paráfrase não.
- **Trimestre nunca dá "em transição"**: o equinócio está dentro de Q1 e de Q3, e a média os
  aplaina em curtos e longos. É honesto sobre a média e pobre sobre a estação — assunto da
  Story 3.3, que é justamente o destaque de luz no trimestre.

### Iteração 4 — as conferências eram circulares (10/09/2026)

**O que a rodada mediu.** O invariante segurou pela segunda rodada seguida: nada de luz no
alfabeto nem na quinta regra. Voltaram de novo **testes mais fracos do que alegavam**, e os
remendos foram todos de rigor, cada um com prova negativa que morde:

1. **As conferências de estação eram circulares.** Mês, semana e trimestre eram cobrados contra
   `estacaoDaLuz`, a própria função — só quatro meses estavam presos em valor. Ler a estação só
   do primeiro dia, só do último ou numa latitude errada, **dentro do `casa.ts`**, passava tudo.
   Agora os **doze meses e os quatro trimestres** são literais, nos cinco anos.
2. **A isomorfia comparava conjuntos, e não via colisão.** Uma luz constante de 11 — o B1 das
   sessões de ciclismo — passava invisível e desarmava a quinta regra pela guarda de
   ambiguidade. Entrou a **assinatura da procedência**: entradas e chaves por caderno, literais,
   em todo mês, semana e trimestre. Só ela pegou a mutação.
3. **O cabeçalho era cobrado numa linha só** — horas numa segunda linha ou coladas no `Período:`
   passavam. Agora o cabeçalho inteiro.
4. **A lei da luz prometia o que a conferência não cobra** (*"qualquer número delas invalida o
   texto"* — "16h de sol" passa pela isenção de hora de relógio) e não proibia comparar com o
   período anterior nem descrever a luz como mudança. Reescrita.
5. **A ida e volta inseria a frase antes do primeiro número**, que era o `atual` — a vizinhança
   dos valores de base nunca era testada. Agora antes e depois de **cada** número.
6. **O teste da guarda [0, 24] nunca a acionava.** Agora usa os pontos em que ela age.
7. **Guardas que não dependem de teste**: `periodo.luz` tipado como a união dos três textos
   (dígito vira erro de compilação), `TEXTO_DA_ESTACAO` congelado, e a **barreira da AD-10**.

**Declarado, não resolvido:** o modelo pode escrever horas de luz de cabeça — *"16h de sol"*
passa pela isenção de hora de relógio da regra 1, e a lei proíbe mas nada mecânico cobra; a
guarda [0, 24] prende, não conserta, o erro da efeméride perto do círculo polar, anterior a esta
story e longe da coordenada da revista; `VOCAB_DE_BASE` do teste é cópia à mão do vocabulário do
verificador, e a guarda real é a ida e volta, que usa o verificador de verdade.

### Iteração 5 — revisão enxuta, dois furos de teste, e o critério de parada (10/09/2026)

Uma camada só (lacunas de verificação), sobre os remendos da iteração 4. Tudo o que ela atacou
reprovou quando quebrado — menos dois:

1. **O título do cabeçalho era pulado sem conferência** — ele tem o ano, então saía da varredura
   de dígito, e `# Julho 2026 · 16,0 h de luz` passava. Agora o título tem que ser exatamente o
   rótulo.
2. **A invariância de fuso só olhava meses.** Datas interpretadas em hora local mudavam a estação
   de quatro semanas entre UTC e Bruxelas, e nenhum mês nem trimestre de 2023 a 2027 — então o
   teste ficava verde. Agora as semanas entram no laço dos fusos.

**O critério de parada.** É a terceira rodada seguida em que volta o mesmo tipo: teste mais fraco
do que diz. Mas o que se repete **não é defeito de produto** — o comportamento é o mesmo desde a
iteração 3, e nenhuma das três rodadas achou luz no alfabeto ou na quinta regra. O que se repete
é a revisão sempre construir mais uma mutação hipotética que escapa, e essa fonte não seca:
sempre haverá uma. Os dois furos desta rodada foram fechados porque um deles guarda a AD-10 na
semana, que é onde a tela abre. A revisão da story para aqui, por esse motivo, e fica escrito.

## Design Notes

**Por que `periodo`, e não `textos` de caderno.** A luz é propriedade do período: agosto é
claro em Sono e em Movimento pelo mesmo motivo. Posta em `textos`, ela aparecia quatro vezes no
prompt da edição, tornava `semDado` falso em todo caderno e ressuscitava caderno vazio. Em
`periodo` ela está nos quatro pacotes por construção — é o mesmo objeto —, o cabeçalho a escreve
uma vez, e nenhum dos três problemas pode acontecer. O precedente é `rotuloAnterior`, campo de
texto posto em `periodo` pela Story 1.4 justamente por custar zero no alfabeto.

**Por que três níveis, e por que ano não tem luz.** Três é o que um leitor na Bélgica reconhece
sem régua: o inverno escuro, o verão claro, e as duas passagens. Um ano cobre as três estações —
a média dele cai sempre no meio, e dizer "dias em transição" sobre 2025 inteiro seria falso. Por
isso `year` e `all` recebem `null`, que é ausência declarada, não esquecimento.

**O limiar é constante, e a borda é aceita.** Os limiares saem do mínimo e do máximo anuais em
casa e ficam fixos no código. Um período cuja média cai na borda pode ir para um lado ou outro;
o texto é contexto, não número verificado, e *"dias curtos"* e *"dias em transição"* são ambos
verdadeiros para um outubro. A estação de cada mês fica **publicada** na saída do teste, para
quem quiser discordar ter com o que discordar.

**Uma correção pendente fora desta story.** A CAP-6 em `docs/specs/revista-retrospectiva/spec.md`
ainda promete *"o delta contra o mesmo período do ano anterior"* — o desenho que duas iterações
reverteram. Não é editada aqui: `docs/specs/` é do `bmad-spec`. Fica declarada.

## Verification

**Commands:**
- `pnpm --filter @vitale/shared lint` -- expected: 0 erros
- `pnpm --filter @vitale/shared test` -- expected: exit 0; o alfabeto **idêntico** em cada mês e
  caderno; a estação de cada mês publicada; barreiras verdes
- `cd mobile && pnpm exec tsc --noEmit && pnpm exec jest` -- expected: sem regressão
- `pnpm --filter @vitale/web build && pnpm --filter @vitale/web test` -- expected: sem regressão

**Provas negativas (rodar e reverter):**
- Pôr as horas de luz como número no texto (*"14,5 h de luz"*) -- expected: a varredura de
  dígito reprova. **Só ela**: a primeira redação desta prova dizia que a medição do alfabeto
  também reprovava, e é falso — a procedência nunca lê `periodo.luz`. Corrigido na iteração 3.
- Devolver as horas como `FatoNumero` **sob qualquer chave** -- expected: a **assinatura da
  procedência** reprova, inclusive para valor **constante** ou que **colide** com um já existente
  (a revisão usou 11, o B1 das sessões de ciclismo, e só a assinatura pegou). A isomorfia pega só
  as que variam com a estação.
- Pôr *"do ano passado"* no texto -- expected: a varredura de vocabulário de base reprova, e a ida
  e volta muda de veredito.
- Mover a luz para `textos` de caderno -- expected: o teste do caderno vazio reprova, e a luz
  aparece quatro vezes.
- Dar luz a `year` -- expected: o teste de `null` reprova.
- Trocar a constante de casa por `deviceCoords()`, no import ou na chamada, ou ler o ambiente --
  expected: a **barreira da AD-10** em `architecture.test.ts` reprova. O teste de fuso sozinho não
  via a avaliação no import.
- Deixar `PROMPT_VERSAO` em 3 -- expected: a asserção da versão reprova.
- Trocar `curtos` por `longos` no texto -- expected: os doze meses literais reprovam.
- Dar luz só a `month` -- expected: os testes de semana e trimestre reprovam.
- Ler a estação só do primeiro dia, só do último, ou numa latitude errada — **em `casa.ts`**, onde
  a média mora -- expected: os doze meses e os quatro trimestres literais reprovam. Antes da
  iteração 4 as conferências eram circulares e essas três mutações passavam.
- Acrescentar horas em **qualquer** linha do cabeçalho -- expected: o teste do cabeçalho reprova.
- Pôr dígito em `periodo.luz` -- expected: **erro de compilação** — o campo é a união literal dos
  três textos.
- Tirar a guarda [0, 24] de `daylightHours` -- expected: o teste dos pontos polares reprova.

**Manual checks:**
- Nenhum. Sem superfície; a primeira tela é a Story 1.11.
