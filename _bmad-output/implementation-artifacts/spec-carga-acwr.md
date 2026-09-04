---
title: 'ACWR, monotonia e strain — núcleo puro sobre a carga diária'
type: 'feature'
created: '2026-09-04'
status: 'done'
baseline_commit: 'af7e347c418b6ac6c521c9473d2f0a47366035c3'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A curva de forma diz se o atleta está fresco ou enterrado, mas não diz se ele está **subindo a carga rápido demais** nem se a semana foi monótona. São as métricas de Foster, de literatura aberta, que a Runalyze expõe só no tier pago (recomendação R3 da pesquisa competitiva).

**Approach:** Um módulo puro em `fitness/` que recebe a série diária que a curva de forma já produz e devolve ACWR, monotonia, strain, as faixas interpretativas e a confiança do resultado. Sem UI, sem migration, sem rede, sem recalcular carga.

## Boundaries & Constraints

**Always:**
- Entrada é `readonly FormCurveDay[]` — a `series` de `buildFormCurve`, que já vem por dia local, do mais antigo a hoje, com dia parado como zero. A carga usada é `dailyLoadMin`. Nada de `Activity[]`, nada de recalcular carga.
- ACWR padrão é a forma **desacoplada**: a janela crônica exclui os dias da aguda. A acoplada fica exposta ao lado, para comparação com outras ferramentas.
- Divisão por zero nunca vira `Infinity` nem `NaN`: devolve `null`, e quem exibe decide o que dizer.
- Faixas interpretativas são constantes exportadas e nomeadas, com a ressalva de que são contestadas — nada de número solto no meio do código.
- Confiança explícita, como `readiness.ts` e `form-curve.ts` fazem: dias de histórico e uma flag para janela crônica incompleta.
- Teste é script autoexecutável com `node:assert/strict` e `check(nome, fn)` local, sem framework. Modelo: `form-curve.test.ts`.
- Reexportar em `src/index.ts`, senão não chega aos apps. Identificadores em inglês, documentação em português.

**Ask First:**
- Se a implementação concluir que precisa alterar `form-curve.ts` ou o tipo `FormCurveDay`.
- Se as faixas escolhidas produzirem, nos testes com série realista, classificação que contradiga a intuição.

**Never:**
- Nenhuma UI, migration, componente ou serviço. Etapa 2 é a superfície.
- Não reusar nem alterar `weekly-load.ts`: aquele soma **segundos por zona** com os pesos da OMS (ADR 0002) e responde "bati o mínimo de saúde?". Misturar as duas unidades é o que a ADR 0025 existe para impedir.
- Nada que dependa de rede ou de dado que não esteja na série.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Histórico completo | 60 dias com carga | `acwr`, `monotony`, `strain` finitos; `shortWindow: false` | N/A |
| Carga estável | mesma carga diária há 60 dias | `acwr ≈ 1`; `monotony` alta (desvio pequeno) | N/A |
| Semana pesada após base leve | últimos 7 dias muito acima | `acwr > 1.5`, na faixa de risco | N/A |
| Janela crônica incompleta | 20 dias de histórico | `shortWindow: true`; ACWR calculado com o que há, e declarado imaturo | N/A |
| Crônica zerada | 28 dias parados, semana com carga | `acwr: null` — não `Infinity` | N/A |
| Semana constante | 7 dias com a mesma carga (desvio 0) | `monotony: null`, `strain: null` | N/A |
| Semana toda zero | 7 dias parados | `weeklyLoad: 0`, `monotony: null`, `strain: null` | N/A |
| Série curta | menos de 7 dias | `monotony`/`strain` `null`; sem lançar | N/A |
| Série vazia | `[]` | tudo `null`, `historyDays: 0`, `shortWindow: true`; não lança | N/A |
| Acoplado × desacoplado | mesma série | os dois valores presentes e diferentes quando a semana difere da base | N/A |
| Faixa | `acwr` em cada faixa | classificação bate com as constantes exportadas | N/A |

</frozen-after-approval>

## Code Map

- `packages/shared/src/fitness/form-curve.ts:202-217` — `FormCurveDay`: `day`, `dailyLoadMin` (**a entrada**), `base`, `fatigue`, `form`. L329 `buildFormCurve` devolve `series`. L100-104 exporta `FORM_FATIGUE_DAYS = 7`, a mesma janela da aguda — reusar em vez de redeclarar 7. **Somente leitura.**
- `packages/shared/src/fitness/weekly-load.ts:1-64` — o vizinho que **não** se reusa: segundos por zona, pesos da OMS, semana seg–dom. Serve como modelo de estilo de cabeçalho e de constantes de limiar exportadas (`HIGH_LOAD_FACTOR`, `MIN_BASELINE_WEEKS`).
- `packages/shared/src/health/readiness.ts:31-53` — o contrato de confiança a espelhar (`coverage`, `missing`).
- `packages/shared/src/fitness/form-curve.ts:263-291` — como a curva declara imaturidade (`shortWindow`, `historyDays`) e documenta o porquê; mesmo tom aqui.
- `packages/shared/src/fitness/form-curve.test.ts:1-60` — a convenção de teste: helper `check`, fixtures `daily(from, to, carga)`, asserções com mensagem.
- `packages/shared/src/index.ts:70-90` — bloco `fitness/`, `export *` em ordem de append.
- `packages/shared/src/architecture.test.ts:115,122` — as barreiras que varrem `packages/shared/src`.
- `docs/decisions/0002-minutos-de-esforco-ancorados-no-vigoroso.md` e `0025-carga-de-treino-tem-pesos-proprios.md` — as duas unidades de carga e por que não se misturam. A ADR nova cita as duas.

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/fitness/training-load.ts` -- criar o módulo: ACWR desacoplado (padrão) e acoplado, monotonia e strain de Foster, faixas exportadas, confiança e janela curta -- é o núcleo que a etapa 2 vai consumir
- [x] `packages/shared/src/fitness/training-load.test.ts` -- cobrir cada linha da matriz, mais um caso que fixa a diferença entre acoplado e desacoplado -- é a decisão que muda o número sem quebrar nada visivelmente
- [x] `packages/shared/src/index.ts` -- acrescentar o `export *` ao bloco `fitness/` -- sem isso o símbolo não existe para web e mobile
- [x] `docs/decisions/0027-acwr-desacoplado-e-faixas-contestadas.md` -- registrar a forma desacoplada contra a acoplada, as faixas e o quanto são contestadas, e por que o insumo é o `dailyLoadMin` da curva e não o `weekly-load` -- citar 0002 e 0025

**Acceptance Criteria:**
- Dada uma série com carga diária constante por mais de 28 dias, quando o ACWR é calculado, então fica próximo de 1 nas duas formas.
- Dada uma semana pesada sobre uma base leve, quando o ACWR desacoplado é calculado, então ele é maior que o acoplado — porque o acoplamento dilui o pico no próprio denominador.
- Dado qualquer denominador zero, quando o cálculo roda, então o resultado é `null` e nunca `Infinity` ou `NaN`.
- Dado `pnpm --filter @vitale/shared lint` e `test`, quando rodados, então passam, incluindo as barreiras de arquitetura.

## Spec Change Log

- **2026-09-04 · implementação (contradição na matriz congelada, sem loopback).** Duas linhas se contradizem lidas ao pé da letra: "Carga estável — mesma carga diária há 60 dias → `monotony` alta" e "Semana constante — 7 dias com a mesma carga (desvio 0) → `monotony: null`". Carga idêntica por 60 dias *é* desvio zero na última semana. O parêntese da própria linha ("desvio pequeno") desfaz o empate e dá uma leitura só, então não houve volta ao planejamento: a série "estável" usa variação pequena mas não nula, e o desvio exatamente zero é a outra linha. KEEP: os dois casos têm teste separado, e a distinção entre "constante" e "parada" virou campo do resultado (`monotonyReason`), porque o `null` sozinho não a carregava.

## Design Notes

O acoplamento é a crítica central de Impellizzeri e colegas ao ACWR: na forma clássica os 7 dias da aguda estão **dentro** dos 28 da crônica, então o numerador entra no denominador e cria correlação espúria — o índice tende a 1 por construção quando a carga é estável, e amortece justamente o pico que ele deveria denunciar. A desacoplada usa dias 8 a 28, e é a que vira padrão aqui.

As faixas ("ideal" perto de 0,8–1,3, risco acima de ~1,5, monotonia de alerta acima de ~2) vêm de estudos cujo desenho é contestado, e não são lei da natureza. O módulo as expõe como constantes e classifica, mas o docblock e a ADR precisam dizer que são orientação, não diagnóstico.

## Verification

**Commands:**
- `pnpm --filter @vitale/shared lint` -- expected: `tsc --noEmit` sem erro
- `pnpm --filter @vitale/shared test` -- expected: todos os scripts passam, incluindo o novo e `architecture.test.ts`
- `npx tsx packages/shared/src/fitness/training-load.test.ts` -- expected: imprime a contagem e sai com código 0
- `git diff --stat packages/shared/src/fitness/form-curve.ts` -- expected: vazio

## Suggested Review Order

**Ponto de entrada**

- Por que o desacoplado é o padrão, e o que a razão de 6,0 contra 2,7 significa.
  [`training-load.ts:351`](../../packages/shared/src/fitness/training-load.ts#L351)

**As armadilhas de aritmética**

- Truncar antes de validar: `0,5` passaria por positivo, viraria zero e `slice(-0)` devolve a série inteira.
  [`training-load.ts:262`](../../packages/shared/src/fitness/training-load.ts#L262)

- `Array.from` e não `map`: um furo no array escaparia como `undefined` para dentro das contas.
  [`training-load.ts:367`](../../packages/shared/src/fitness/training-load.ts#L367)

- O acoplado cala quando degeneraria em 1 por construção.
  [`training-load.ts:383`](../../packages/shared/src/fitness/training-load.ts#L383)

**O que o `null` não dizia**

- Semana constante e semana parada eram o mesmo `null`; agora têm motivo, e a constante é o extremo da monotonia.
  [`training-load.ts:394`](../../packages/shared/src/fitness/training-load.ts#L394)

- O vocabulário dos três motivos.
  [`training-load.ts:148`](../../packages/shared/src/fitness/training-load.ts#L148)

**Honestidade das faixas**

- As fronteiras vieram do acoplado e classificam o desacoplado; a ressalva é obrigatória.
  [`training-load.ts:53`](../../packages/shared/src/fitness/training-load.ts#L53)

- Fora das janelas padrão o número sai, a faixa não.
  [`training-load.ts:363`](../../packages/shared/src/fitness/training-load.ts#L363)

- Congelar as fronteiras: `as const` é só do compilador.
  [`training-load.ts:112`](../../packages/shared/src/fitness/training-load.ts#L112)

**Os modos de falha declarados**

- Sync parado se disfarça de semana leve, e leve é a faixa mais tranquilizadora.
  [`training-load.ts:68`](../../packages/shared/src/fitness/training-load.ts#L68)

- O último ponto é intradiário e enviesa a janela aguda para baixo.
  [`training-load.ts:76`](../../packages/shared/src/fitness/training-load.ts#L76)

- Quem volta de um período parado fica sem número, justamente no maior salto.
  [`training-load.ts:82`](../../packages/shared/src/fitness/training-load.ts#L82)

- `seriesDays`, e não `historyDays`: o nome da curva significa outra coisa.
  [`training-load.ts:423`](../../packages/shared/src/fitness/training-load.ts#L423)

**Periféricos**

- As fixtures passaram a usar datas consecutivas de verdade; antes violavam o contrato que o módulo documenta.
  [`training-load.test.ts:46`](../../packages/shared/src/fitness/training-load.test.ts#L46)

- Entrada ausente, nula ou com furo não lança.
  [`training-load.test.ts:283`](../../packages/shared/src/fitness/training-load.test.ts#L283)

- A fração que reabria o `slice(-0)`, agora fixada.
  [`training-load.test.ts:401`](../../packages/shared/src/fitness/training-load.test.ts#L401)

- O que a revisão acrescentou à decisão.
  [`0027-acwr-desacoplado-e-faixas-contestadas.md:78`](../../docs/decisions/0027-acwr-desacoplado-e-faixas-contestadas.md#L78)

- Três diferidos: a etapa 2, a calibração das faixas e o spec durável.
  [`deferred-work.md:139`](deferred-work.md#L139)
