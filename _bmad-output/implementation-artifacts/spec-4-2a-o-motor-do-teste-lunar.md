---
title: 'Story 4.2a — O motor do teste lunar: as quatro fases, os portões e o veredito'
type: 'feature'
created: '2026-09-28'
status: 'in-progress'
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

- `packages/shared/src/sleep/lua.ts:150` -- `janelaLunarDoInstante(t, fase)` / `janelaLunar(wakeDay, fase)`, já generalizadas na iteração 1. `JanelaLunar` tem `instante` + `fase`.
- `packages/shared/src/sleep/lua.test.ts:255` -- a guarda de pureza (regex `PROIBIDO`). Cobre os dois arquivos.
- `packages/shared/src/astro/moon.ts:246` -- `LunarPhaseKind`; `:256` `PHASE_ORDER` (hoje **não exportado** — exporte e derive dele, em vez de recopiar as quatro strings em três arquivos); `:438` `nextLunarPhase`.
- `packages/shared/src/sleep/timing.ts:65` -- `axisPosition(iso, tzOffset, originH)`; `:SLEEP_AXIS_ORIGIN_H = 18`. Há também `fitsAxis`, que diz quando a noite começou antes da origem.
- `packages/shared/src/sleep/buckets.ts:69,74` -- `median`/`quantile`. **Atenção:** este módulo reprovaria o regex de pureza (`weekKey` usa `new Date` local e `getDay`). Nada impuro é alcançado hoje, mas a guarda só olha um nível de import.
- `packages/shared/src/health/trends.ts:11` -- `stdDev` (amostral, n−1) — o SD marginal do §5.
- `packages/shared/src/sleep/triggers.ts:53` -- `TRIGGER_MIN_PER_CELL = 5`. É constante **de outra feature**: calibrá-la lá moveria um portão pré-registrado daqui.
- `packages/shared/src/models/index.ts` -- `SleepPeriod.onsetAt` = **apagou**; `tzOffset`, `wakeDay`.
- `packages/shared/src/index.ts` -- o barril exporta `./sleep/lua` e `./sleep/lua-protocolo`.

## Tasks & Acceptance

**Execution:**
- [ ] `packages/shared/src/sleep/lua-protocolo.ts` -- **o veredito passa pelo portão de poder primeiro.** Ver a tabela literal nas Design Notes. `poder < PODER_MINIMO` ⇒ `inconclusivo`, **antes** de olhar significância ou limiar.
- [ ] `packages/shared/src/sleep/lua-protocolo.ts` -- **`inconclusivo` por poder diz quantas noites faltam.** Inverter `efeitoMinimoDetectavel` para n, mantendo a razão de colunas observada. Documentar a regra de arredondamento: o §6 imprime 1.864 onde o modelo dá 1.863, e a página não pode discordar do documento em silêncio.
- [ ] `packages/shared/src/sleep/lua-protocolo.ts` -- `PROTOCOLO_LUNAR` tipado como `QuatroLinhas` **no literal** (não por `as`), para que a quinta linha não compile — é o que o docblock e a AC afirmam.
- [ ] `packages/shared/src/sleep/lua-protocolo.ts` -- constante própria `NOITES_MINIMAS_POR_COLUNA = 5`, documentada como igual à do gatilho, no lugar de importar `TRIGGER_MIN_PER_CELL`.
- [ ] `packages/shared/src/sleep/lua-protocolo.ts` -- guardas numéricas: `sd <= 0` ou coluna vazia ⇒ poder `null`, nunca 100%; `onsetAt`/`tzOffset` que não dão número finito lançam `RangeError`; `luzH` fora de `[0,24]` conta como luz ausente.
- [ ] `packages/shared/src/sleep/lua-protocolo.ts` -- o resultado carrega **proveniência e diagnóstico**: intervalo do acervo, noites distintas, e `noitesSemLuz` com o primeiro `wakeDay` ofensor. O portão da luz não pode sair indistinguível de um bug.
- [ ] `packages/shared/src/sleep/lua-protocolo.test.ts` -- a matriz inteira, mais os quatro casos que a revisão provou ausentes: **(a)** significante com poder baixo ⇒ `inconclusivo` nos dois ramos (limiar passado e não passado); **(b)** apagar a residualização da luz tem de **reprovar** — compare `efeitoMin`/`p` do motor contra HL/MW sobre resíduos *e* contra os do cru, exigindo igualdade com o primeiro e diferença do segundo; **(c)** buraco de luz **junto** com coluna curta ⇒ `portaoReprovado: 'luz'`, provando a precedência; **(d)** origem do eixo com observações **dos dois lados** dela.
- [ ] `packages/shared/src/sleep/lua-protocolo.test.ts` -- a guarda de superfície pública fecha `export {}`, `export default` e `export *`, não só as declarações — é ela que implementa a §9.

**Acceptance Criteria:**
- Given um acervo com efeito de 60 min, p < α e poder de 28%, when o motor roda, then o veredito é `inconclusivo` — nunca `achado`.
- Given um `inconclusivo` por poder com os três portões abertos, when o resultado é lido, then ele diz quantas noites faltam.
- Given uma quinta linha acrescentada a `PROTOCOLO_LUNAR`, when `tsc` roda, then **não compila**.
- Given `pnpm --filter @vitale/shared test`, when roda, then sai com **exit code 0**.

## Spec Change Log

- **28/09/2026 — revisão, iteração 1 (bad_spec).**
  - *Achado:* o veredito não consultava o poder em dois dos quatro ramos. `significante && passaLimiar` devolvia `achado` e `significante && !passaLimiar` devolvia `nenhum_padrao`, ambos **sem olhar `poder`**. A §5 de 07/09 e a §6 de 28/09 exigem `poder ≥ 80%` para **achado** e mandam `inconclusivo` sempre que `poder < 80%`. Com 290 noites o poder para 15 min é de 39% a 69% nas três fases — o ramo defeituoso é o **provável**, não o exótico.
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

**Provas negativas — rodar e reverter, registrando o resultado:**
- Uma cópia do motor com o SD residual no poder **reprova** o teste.
- Apagar a residualização da luz (`residuo = apagou`) **reprova** o teste.
- Mover o portão da luz para depois do de amostra **reprova** o teste.
- Uma quinta linha em `PROTOCOLO_LUNAR` **não compila**.
