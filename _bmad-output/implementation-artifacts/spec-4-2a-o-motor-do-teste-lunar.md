---
title: 'Story 4.2a — O motor do teste lunar: as quatro fases, os portões e o veredito'
type: 'feature'
created: '2026-09-28'
status: 'in-review'
review_loop_iteration: 1
baseline_commit: '7e5f26db5b3cd02d23de117821b4f932b3d9c94d'
context:
  - '{project-root}/docs/specs/revista-retrospectiva/pre-registro-lua.md'
  - '{project-root}/docs/specs/revista-retrospectiva/correcao-pre-registro-lua.md'
  - '{project-root}/docs/specs/revista-retrospectiva/pre-registro-lua-outras-fases.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A 4.1 entregou a efeméride das quatro fases e os dois pré-registros fixam o
protocolo inteiro, mas não existe código que classifique uma noite por fase que não a cheia,
nem nada que calcule portão, efeito, p, poder ou veredito — `packages/shared` não tem **um
único** utilitário de teste de hipótese, p-valor, poder ou intervalo de confiança.

**Approach:** Um motor puro, vizinho de `sleep/lua.ts`, que recebe as noites já medidas
(com as horas de luz junto) e devolve, **numa chamada só**, o veredito das quatro fases. O
protocolo entra como dado — cada fase carrega seu α e sua lateralidade —, nunca como `if`
no corpo do teste.

## Boundaries & Constraints

**Always:**
- **Nenhum dado lunar é consultado por ninguém durante esta story.** Nem mediana por fase,
  nem contagem por coluna, nem "só para ver se o portão passaria". O único número permitido
  é o desvio-padrão **marginal** da hora de apagar. Medir em produção antes de desenhar é o
  método padrão deste repositório e aqui está **proibido**.
- As quatro fases saem de **uma chamada**: a §9 do pré-registro de 28/09 manda que rodem
  juntas ou nenhuma rode. Não exponha porta que calcule uma fase sozinha.
- α e lateralidade são **dado do protocolo**: cheia 5% unilateral (atraso); nova, quarto
  crescente e quarto minguante 1,67% **bilateral**.
- A janela é `[fase − 5 d, fase)`, e a noite é 08:00 UTC do `wakeDay`. `JANELA_LUNAR_NOITES`
  e `HORA_UTC_DO_FIM_DA_NOITE` **não mudam de valor**.
- Cada fase é comparada contra **todas as outras noites**, nunca contra as ~93 de nenhuma
  janela (§7 de 28/09 — o viés é para o nulo e está declarado).
- Portão reprovado ⇒ `inconclusivo`, **nunca** `nenhum_padrao`, e efeito/p/poder saem
  **nulos** — nulo é "não foi medido", jamais zero.
- A pureza de `sleep/lua.ts` continua cobrada pelo regex de `lua.test.ts:255`; o arquivo novo
  entra na mesma guarda.

**Ask First:**
- Qualquer coisa que toque α, janela, desfecho, portões, limiar de 15 min ou vereditos.
- Trocar o teste estatístico proposto nas Design Notes por outro.
- Fazer o poder usar o desvio-padrão **residual** em vez do marginal bruto.

**Never:**
- Banco, migração, `data/lua-execucoes.ts`, entrada em `COLUNAS_PEDIDAS`, constantes de
  sha256 e o **terceiro documento de correção** — tudo isso é a 4.2b.
- Executar o teste contra produção; escrever em produção; tocar rede.
- Pôr número na luz do dia. Importar `astro/sun` ou `astro/casa` dentro do motor.
- A página da lua (4.4) e a barreira do hash (4.3).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Quatro fases, portões passam | noites com `onsetAt`, `tzOffset`, `wakeDay`, `luzH` | 4 resultados, cada um com fase, α, lateralidade, efeito em minutos **com sinal**, p, poder, n dentro/fora, ciclos, veredito | N/A |
| Noite que atravessa a meia-noite | uma noite apagou 23:50, outra 00:10 | distam **20 min**, não 1.420 — eixo contínuo com origem 18h | N/A |
| Portão de amostra reprova numa fase | < 5 noites de um lado | só aquela fase vira `inconclusivo`, com `noitesFaltantes`; efeito/p/poder `null` | N/A |
| Portão de ciclos reprova | < 10 ciclos sinódicos distintos contribuindo | `inconclusivo` com `portaoReprovado: 'ciclos'` | N/A |
| Uma noite sem horas de luz | `luzH` ausente numa noite de qualquer coluna | **todas** as fases viram `inconclusivo` com `portaoReprovado: 'luz'` — a luz é pré-requisito, não ressalva | N/A |
| Efeito significante abaixo de 15 min | p < α e \|Δ\| = 9 min | `nenhum_padrao`, com o efeito relatado — é nulo prático | N/A |
| Poder < 80% e nada significante | dispersão alta | `inconclusivo`, nunca `nenhum_padrao` | N/A |
| Acervo vazio ou sem noite nenhuma | lista vazia | as 4 fases `inconclusivo`, `portaoReprovado: 'amostra'` | não lança |
| `wakeDay` torto | `'2026-02-30'` | `RangeError`, como `instanteDaNoite` já faz | lança |

</frozen-after-approval>


## Code Map

> Âncoras conferidas em 28/09/2026, iteração 3 — as da iteração 1 tinham deslocado.

- `packages/shared/src/sleep/lua-protocolo.ts` -- o motor. `:213` `PROTOCOLO_LUNAR`; `:311` `UNIDADE_DO_MOTIVO` (a unidade de cada motivo do `inconclusivo`); `:676` `desdobrarEixo`; `:931` `rodarLinha`; `:1052` `vereditoLunar`, a porta única.
- `packages/shared/src/sleep/lua-protocolo.test.ts` -- `rodarEConferir` é a porta de **todo** caso do arquivo: ela roda o motor e cobra as invariantes de saída (campos de protocolo casados com a linha, poder/MDE/noites recalculados, unidade do que falta, `z` batendo com o `p`).
- `packages/shared/src/sleep/lua.ts:150` -- `janelaLunarDoInstante(t, fase)` / `janelaLunar(wakeDay, fase)`, já generalizadas na iteração 1. `JanelaLunar` tem `instante` + `fase`.
- `packages/shared/src/sleep/lua.test.ts:341` -- a guarda de pureza (regex `PROIBIDO`). Cobre os dois arquivos.
- `packages/shared/src/astro/moon.ts:246` -- `LunarPhaseKind`; `:270` `PHASE_ORDER` (**já exportado**, e `moon.test.ts` passou a importá-lo na iteração 3 — não restou cópia das quatro strings em teste nenhum); `:452` `nextLunarPhase`.
- `packages/shared/src/sleep/timing.ts:65` -- `axisPosition(iso, tzOffset, originH)`; `:41` `SLEEP_AXIS_ORIGIN_H = 18`. Há também `fitsAxis`, que diz quando a noite começou antes da origem.
- `packages/shared/src/sleep/buckets.ts:69,74` -- `median`/`quantile`. **Atenção:** este módulo reprovaria o regex de pureza (`weekKey` usa `new Date` local e `getDay`). Nada impuro é alcançado hoje, mas a guarda só olha um nível de import.
- `packages/shared/src/health/trends.ts:11` -- `stdDev` (amostral, n−1) — o SD marginal do §5.
- `packages/shared/src/sleep/triggers.ts:53` -- `TRIGGER_MIN_PER_CELL = 5`. É constante **de outra feature**: calibrá-la lá moveria um portão pré-registrado daqui.
- `packages/shared/src/models/index.ts` -- `SleepPeriod.onsetAt` = **apagou**; `tzOffset`, `wakeDay`.
- `packages/shared/src/index.ts` -- o barril exporta `./sleep/lua` e `./sleep/lua-protocolo`.

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/sleep/lua-protocolo.ts` -- **o veredito passa pelo portão de poder primeiro.** Ver a tabela literal nas Design Notes. `poder < PODER_MINIMO` ⇒ `inconclusivo`, **antes** de olhar significância ou limiar.
- [x] `packages/shared/src/sleep/lua-protocolo.ts` -- **`inconclusivo` por poder diz quantas noites faltam.** Inverter `efeitoMinimoDetectavel` para n, mantendo a razão de colunas observada. Documentar a regra de arredondamento: o §6 imprime 1.864 onde o modelo dá 1.863, e a página não pode discordar do documento em silêncio.
- [x] `packages/shared/src/sleep/lua-protocolo.ts` -- `PROTOCOLO_LUNAR` tipado como `QuatroLinhas` **no literal** (não por `as`), para que a quinta linha não compile — é o que o docblock e a AC afirmam.
- [x] `packages/shared/src/sleep/lua-protocolo.ts` -- constante própria `NOITES_MINIMAS_POR_COLUNA = 5`, documentada como igual à do gatilho, no lugar de importar `TRIGGER_MIN_PER_CELL`.
- [x] `packages/shared/src/sleep/lua-protocolo.ts` -- guardas numéricas: `sd <= 0` ou coluna vazia ⇒ poder `null`, nunca 100%; `onsetAt`/`tzOffset` que não dão número finito lançam `RangeError`; `luzH` fora de `[0,24]` conta como luz ausente.
- [x] `packages/shared/src/sleep/lua-protocolo.ts` -- o resultado carrega **proveniência e diagnóstico**: intervalo do acervo, noites distintas, e `noitesSemLuz` com o primeiro `wakeDay` ofensor. O portão da luz não pode sair indistinguível de um bug.
- [x] `packages/shared/src/sleep/lua-protocolo.test.ts` -- a matriz inteira, mais os quatro casos que a revisão provou ausentes: **(a)** significante com poder baixo ⇒ `inconclusivo` nos dois ramos (limiar passado e não passado); **(b)** apagar a residualização da luz tem de **reprovar** — compare `efeitoMin`/`p` do motor contra HL/MW sobre resíduos *e* contra os do cru, exigindo igualdade com o primeiro e diferença do segundo; **(c)** buraco de luz **junto** com coluna curta ⇒ `portaoReprovado: 'luz'`, provando a precedência; **(d)** origem do eixo com observações **dos dois lados** dela.
- [x] `packages/shared/src/sleep/lua-protocolo.test.ts` -- a guarda de superfície pública fecha `export {}`, `export default` e `export *`, não só as declarações — é ela que implementa a §9.

**Iteração 3 — os consertos da revisão em três camadas (28/09/2026), todos aditivos:**
- [x] Os campos de protocolo **do resultado** casados com a linha, posição a posição (`familia`, `alfa`, `lateralidade`, `direcao`), mais `noitesPara80` e `efeitoMinimoDetectavelMin` recalculados na asserção. Em `rodarEConferir`, que é a porta de todo caso do arquivo.
- [x] `noitesFaltantes` virou `falta: { quanto, unidade }`, com `UNIDADE_DO_MOTIVO` congelando as quatro unidades. No ramo do poder ele nunca sai zero.
- [x] `direcao` passou a ser **lida** no veredito (`naDirecaoDeclarada`), com a coerência `unilateral ⟺ direcao ≠ null` asserida em toda fase de todo caso.
- [x] `zDeMannWhitney` publicado — o `p` fica auditável contra a tabela normal. `null` no empate perfeito, onde o p é 1 por decisão e não por conta.
- [x] Guardas de entrada: `wakeDay` repetido **recusado** (duplicata infla poder), `onsetAt` a mais de dois dias da noite, `tzOffset` fora de ±840, `alfa` fora de `(0,1)` e `efeitoMin` zero/`NaN`.
- [x] Casos novos: três noites sem luz (contagem + primeira em ordem de entrada), acervo embaralhado (`de`/`ate` cronológicos), rotação canônica do eixo, direção, `z`.
- [x] `moon.test.ts` importa `PHASE_ORDER`; o docblock dele deixou de dizer que é o único lugar que fixa o quatro.
- [x] Declarada a **atenuação da residualização** (docblock + Design Notes) e corrigido o número 39%–69%.

**Acceptance Criteria:**
- Given um acervo com efeito de 60 min, p < α e poder de 28%, when o motor roda, then o veredito é `inconclusivo` — nunca `achado`.
- Given um `inconclusivo` por poder com os três portões abertos, when o resultado é lido, then ele diz quantas noites faltam.
- Given uma quinta linha acrescentada a `PROTOCOLO_LUNAR`, when `tsc` roda, then **não compila**.
- Given `pnpm --filter @vitale/shared test`, when roda, then sai com **exit code 0**.

## Spec Change Log

- **28/09/2026 — revisão, iteração 1 (bad_spec).**
  - *Achado:* o veredito não consultava o poder em dois dos quatro ramos. `significante && passaLimiar` devolvia `achado` e `significante && !passaLimiar` devolvia `nenhum_padrao`, ambos **sem olhar `poder`**. A §5 de 07/09 e a §6 de 28/09 exigem `poder ≥ 80%` para **achado** e mandam `inconclusivo` sempre que `poder < 80%`. Na geometria das tabelas (49 × 241) o poder para 15 min é de **39%** nas três fases a SD 45, e de 9% a 79% nas cinco linhas de SD que o §6 tabela — o ramo defeituoso é o **provável**, não o exótico. *(Correção de 28/09, iteração 3: a redação original dizia "de 39% a 69% nas três fases". Os 69% são a **cheia** a SD 45, que é a outra tabela e a outra família — o argumento fica de pé, o número citado é que era de outra família.)*
  - *Causa-raiz na spec:* a linha da matriz dizia "Poder < 80% **e nada significante**", estreitando uma condição que os documentos escrevem sem conjunção. O código obedeceu à matriz e desobedeceu ao protocolo. A matriz é frozen e **não foi editada**; a tabela literal de veredito entrou nas Design Notes, que são a autoridade para esta iteração.
  - *Estado ruim evitado:* a revista imprimindo **achado** — a manchete — sobre um teste sem poder, que é exatamente o que o par de pré-registros existe para impedir. E `nenhum_padrao` sobre silêncio, que a §5 chama de "mentir com o mesmo tom de voz".
  - *Segundo achado, mesma origem:* "quantas noites faltam" só existia para o portão de amostra, enquanto os dois documentos o pedem em **todo** inconclusivo.
  - *KEEP — o que funcionou e tem de sobreviver à re-derivação:*
    - **As duas tabelas de poder reproduzidas à risca, impressas pelo teste:** 11,7 / 17,5 / 23,4 / 29,2 / 35,1 min e 94/69/48/36/28 % (cheia, §5); 15,2 / 22,8 / 30,4 / 38,0 / 45,6 e 79/39/21/13/9 % (as três, §6). Vinte células, no dígito que os documentos imprimem.
    - **A prova de que o SD residual muda o veredito**: acervo sintético com marginal 85,0 min (55% de poder) e residual 49,8 min (92%), um de cada lado do corte — trocar um pelo outro vira `inconclusivo` em `nenhum_padrao`.
    - `janelaLunarDoInstante(t, fase='full')` e `janelaLunar(wakeDay, fase='full')`: quem foi escrito contra o documento de 07/09 não muda de resposta.
    - `ALFA_DAS_TRES = 0.05 / 3` — a divisão escrita, mais estrita que o `0,0167` arredondado.
    - A precedência dos portões **luz → amostra → ciclos**, e a luz sendo global às quatro.
    - O eixo de origem 18h para o desfecho, e a invariância do efeito à origem.
    - Os testes: nenhuma noite em duas janelas em cinco anos; cinco noites por fase por ciclo; invariância de fuso; bilateral achando o adiantamento que a cheia recusa.
    - `resolverFase` privado, e `vereditoLunar` como porta única das quatro.

- **28/09/2026 — patches da iteração 3 (revisão em três camadas).** O código estava certo no
  essencial — portão de poder, estatística e as quatro provas negativas seguraram. Os catorze
  consertos foram **aditivos**, e estão marcados em Tasks & Acceptance. O tema dos sete
  primeiros: **os revisores mutaram campos publicados e a suíte inteira ficou verde** — eram
  campos que `vereditoLunar` devolve e que nenhum teste lia de volta. A resposta é
  `rodarEConferir`, uma porta única no teste que cobra as invariantes de saída em **todo**
  veredito do arquivo, em vez de num caso só.

  **Duas divergências que ficam declaradas, e não corrigidas:**

  1. **A matriz congelada ainda diz *"Efeito significante abaixo de 15 min → `nenhum_padrao`"*
     sem a precondição de poder.** O código faz o **certo pela tabela das Design Notes**: sem
     `poder ≥ 80%` aquele ramo é `inconclusivo`, não `nenhum_padrao`, e há caso para as duas
     pontas dele. A matriz está dentro do bloco `<frozen-after-approval>` e **não foi editada**
     — mexer nela é renegociação com o dono. A autoridade desta iteração continua sendo a
     tabela de veredito das Design Notes, e a divergência fica escrita aqui para que ninguém a
     descubra como se fosse bug.
  2. **O congelado diz α 1,67% e o código usa `0.05 / 3`.** A divisão escrita é 0,016666…, mais
     **estrita** que o arredondado — e o arredondado é mais frouxo que o protocolo. É
     deliberado, está documentado na constante `ALFA_DAS_TRES` e asserido no teste
     (`ALFA_DAS_TRES < 0.0167`). Fica declarado porque é diferença entre o que o documento
     imprime e o que o código faz, mesmo sendo na direção conservadora.

## Design Notes

**A TABELA DE VEREDITO, literal — a autoridade desta seção.** Os dois documentos a escrevem igual; o poder é portão, não desempate:

| Veredito | Condição |
|---|---|
| **achado** | `abs(Δ) >= 15 min` **e** `p < α` **e** `poder >= 80%` (na cheia, só na direção do atraso) |
| **nenhum_padrao** | `poder >= 80%` **e** (não significante **ou** `abs(Δ) < 15 min`) |
| **inconclusivo** | `poder < 80%` **ou** qualquer portão reprovado |

A ordem de avaliação que isso implica: portões → **poder** → significância → limiar. Um `significante` que não passa pelo portão de poder **não vira nada**: vira `inconclusivo`.

**Qual teste, e por que este.** A §3 pede *"comparação das medianas com covariável de luz"*, e isso vira três peças puras: a luz sai por **resíduo** de MQO sobre todas as noites (estratificar estilhaça 49 noites e reprova o portão dos 5 por célula); o efeito é o **desvio de Hodges–Lehmann**, a mediana das diferenças par a par, que é literalmente "comparação das medianas"; e o p é de **Mann–Whitney**, unilateral na cheia e bilateral nas três.

**Por que isso não invalida a tabela de poder pré-registrada:** a eficiência relativa assintótica do Mann–Whitney contra o t é 0,955 sob normalidade e ≥ 0,864 em qualquer contínua. A tabela do §5 segue valendo, ligeiramente conservadora. Um método que a invalidasse seria desvio de protocolo, não refinamento.

**O poder usa o SD marginal BRUTO.** O §5 indexa a tabela por *"SD da hora de apagar"* e autoriza consultar esse número — o marginal. Residualizar encolhe o SD e **inflaria** o poder; o bruto subestima e empurra para `inconclusivo`. Conservador e fiel, nessa ordem.

**A meia-noite, e a origem também.** `apagou` em minutos desde a meia-noite põe 23h50 a 1.420 minutos de 00h10. O eixo de origem 18h resolve — mas **tem a mesma borda deslocada para as 18:00**: um `onsetAt` de 17h50 cai em 1430. Isso precisa de guarda e de teste, não só de comentário. O efeito relatado é uma **diferença**, logo invariante à origem, que é o que reconcilia o eixo com a letra do §4 — escreva essa frase no docblock, no mesmo lugar em que a ARE já recebe esse tratamento.

**Declare o que não está nos documentos.** A correção de continuidade do Mann–Whitney não aparece em nenhum dos dois; ela é conservadora e padrão, mas tem de estar dita em voz alta, com uma asserção que a observe — hoje removê-la deixa a suíte verde.

**A residualização ATENUA o efeito — declarado em 28/09, iteração 3.** O MQO da luz é ajustado no conjunto inteiro, **sem indicador de exposição**: a inclinação é estimada sobre as noites de dentro e as de fora juntas. Se fase e luz se correlacionarem no acervo — e correlacionam sempre que as janelas de uma fase caírem desequilibradas entre as estações —, parte do efeito lunar é absorvida pela inclinação da luz e o efeito medido **encolhe para o nulo**. As alternativas (ajustar a luz só nas noites de fora, ou pôr o indicador de exposição no MQO) não estão nos documentos, mudam o estimador que a §3 nomeia e empurram na direção **oposta** à conservadora. Fica como está, e fica dito: é viés para o nulo, do mesmo sentido do que a §7 de 28/09 já declara, e o custo dele é deixar de achar — nunca achar demais. Está no docblock de `lua-protocolo.ts`, na seção da correção de continuidade.

**Por que `direcao` é lida mesmo sendo redundante.** O sinal do Hodges–Lehmann e o de `U − μ` são o mesmo sinal (HL > 0 ⟺ mais da metade dos pares positiva ⟺ `U > n₁n₂/2`), então um p unilateral pequeno **já implica** efeito positivo, e a guarda de direção nunca dispara com o estimador de hoje. Ela existe porque `direcao` é invariante pré-registrada, e uma invariante que ninguém lê é comentário: trocar o HL pela diferença de duas medianas desfaria o laço e o motor voltaria a poder "achar" do lado errado. O teste assere a redundância (`p < α ⇒ efeito > 0` em toda linha unilateral) — é ela que vira alarme quando o laço se desfizer.

## Verification

**Commands:**
- `pnpm --filter @vitale/shared lint` -- expected: exit 0
- `pnpm --filter @vitale/shared test` -- expected: **exit 0**, com as duas tabelas de poder impressas
- `pnpm --filter @vitale/web build && pnpm --filter @vitale/web test` -- expected: exit 0
- `pnpm --filter @vitale/scripts lint && pnpm --filter @vitale/scripts test` -- expected: exit 0
- `cd mobile && pnpm exec tsc --noEmit && pnpm exec jest` -- expected: exit 0
- `shasum -a 256 docs/specs/revista-retrospectiva/pre-registro-lua.md` -- expected: `d09365de54bb6bbd6fa8d99af9d1f26cddaebc3492029a63d6b1b6e4f6759664`
- `shasum -a 256 docs/specs/revista-retrospectiva/correcao-pre-registro-lua.md` -- expected: `aad967aae5f9fddd563dfd5f97fd274d236f511fb20f5cdad2dfd45a7e46c308`
- `shasum -a 256 docs/specs/revista-retrospectiva/pre-registro-lua-outras-fases.md` -- expected: `1227264d01b5f0f35bf7bfcf90fb4241ac89fefef4b28dadfe399918a51251bc`

**Provas negativas — RODADAS E REVERTIDAS em 28/09/2026, iteração 2.** Cada uma foi
aplicada ao código, o portão rodado, o resultado anotado e o arquivo restaurado por
`git checkout --`, com `git status` limpo depois:

| Mutação | Portão | Resultado |
|---|---|---|
| poder passa a usar o SD **residual** | `shared test` | **exit 1** — reprova ✓ |
| residualização da luz apagada (`residuo` = apagou cru) | `shared test` | **exit 1** — reprova ✓ |
| portão da luz movido para **depois** de amostra e ciclos | `shared test` | **exit 1** — reprova ✓ |
| quinta linha em `PROTOCOLO_LUNAR` | `shared lint` | **exit 2, TS2322** — não compila ✓ |

As duas do meio são as que a revisão da iteração 1 provou **abertas** — naquela versão
as duas mutações deixavam a suíte inteira verde.

**Os seis portões — oito comandos, porque `web`, `scripts` e `mobile` têm dois cada.**
Conferidos por **exit code**, nunca por grep na saída (é a lição da story 2.8):

| # | Comando | Portão |
|---|---|---|
| 1 | `pnpm --filter @vitale/shared lint` | shared |
| 2 | `pnpm --filter @vitale/shared test` | shared |
| 3 | `pnpm --filter @vitale/web build` | web |
| 4 | `pnpm --filter @vitale/web test` | web |
| 5 | `pnpm --filter @vitale/scripts lint` | scripts |
| 6 | `pnpm --filter @vitale/scripts test` | scripts |
| 7 | `cd mobile && pnpm exec tsc --noEmit` | mobile |
| 8 | `cd mobile && pnpm exec jest` | mobile |
