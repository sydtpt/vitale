---
title: 'Curva de forma — núcleo puro no shared'
type: 'feature'
created: '2026-09-03'
status: 'done'
baseline_commit: 'e8967d662a6ae5e4fc3eef4ce4e3fba8c9784b12'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** O Orbe não sabe dizer se o atleta está fresco ou enterrado hoje. Tem carga por semana (`weekly-load`) e prontidão diária (`readiness`), mas nada que separe o que foi construído (lento) do que está pesando agora (rápido). É análise que o Strava cobra e que intervals.icu e Runalyze dão de graça com receita pública.

**Approach:** Um módulo puro em `fitness/` que deriva carga diária de `activity.hrZones`, roda duas médias exponenciais (42 e 7 dias) sobre a série e devolve base, cansaço, saldo, o típico pessoal de 90 dias e a confiança do resultado. Sem UI, sem migration, sem rede.

## Boundaries & Constraints

**Always:**
- Puro e determinístico: entra `Activity[]` e um `now`, sai objeto. Zero I/O.
- `alpha = 1 - e^(-1/n)`, convenção da literatura de carga. Janelas por parâmetro, padrão 42 e 7.
- Escala equivalente-semanal: multiplicar por 7 na saída, para conversar com o hábito da meta semanal.
- Pesos de zona **próprios**, crescendo no topo, exportados como constante nomeada e documentada.
- Atividade sem `hrZones` cai num piso por tipo, com a mesma lógica de `activityWeight`/`ACTIVITY_MET` que `effectiveSeconds` já usa.
- Expor confiança em vez de fingir, como `readiness.ts` faz com `coverage`/`missing`.
- Identificadores em inglês, documentação em português, como todo o `fitness/`.
- Teste é script autoexecutável com `node:assert/strict`, sem framework. Modelo: `weekly-load.test.ts`.
- Reexportar em `src/index.ts` com `export *`, senão não chega aos apps.

**Ask First:**
- Se a implementação concluir que precisa alterar `who-activity.ts`, `weekly-load.ts` ou o tipo `Activity`.
- Se os pesos de zona escolhidos derem resultados que contradigam a intuição nos testes com dados reais.

**Never:**
- Nenhuma UI, migration, componente ou serviço. Etapa 2 é o cartão do mobile.
- Não tocar em `HR_ZONE_WEIGHTS` de `who-activity.ts`: aqueles respondem "bati o mínimo da OMS?" e têm teto na duração. São outra pergunta.
- Nada que dependa da API do Strava. A fonte é o que já está no banco.
- Não importar de `web/src` nem `mobile/src`; não chamar `createClient(` (barreiras de `architecture.test.ts`).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Histórico completo | 120 dias, atividades com `hrZones` | `base`, `fatigue`, `form` em escala semanal; `trusted: true` | N/A |
| Janela curta | 20 dias de histórico | `shortWindow: true` — a base ainda sobe do zero e o saldo aparece inflado | N/A |
| Sincronização parada | última atividade há 12 dias | `trusted: false`, `daysSinceLastActivity: 12` | N/A |
| Atraso curto | última atividade há 2 dias | `trusted: true`, `daysSinceLastActivity: 2` | N/A |
| Sem zonas de FC | atividade com `hrZones` ausente | carga pelo piso de MET, nunca zero | N/A |
| Atividade oculta | `hidden: true` | ignorada na carga, como `consistency.ts` faz | N/A |
| Lista vazia | `[]` | série vazia, zeros, `trusted: false`; não lança | N/A |
| Dias parados | lacunas entre atividades | contam como carga zero, não são puladas | N/A |

</frozen-after-approval>

## Code Map

- `packages/shared/src/models/index.ts:302-370` — `Activity`. Usar `startAt: string` ISO (L308), `durationS` (L310), `movingTimeS?` (L312), `hrZones?: Record<string,number>` (L338), `hrZonesEstimated?` (L351), `hidden?` (L356), `activityId: number` (L305).
- `packages/shared/src/fitness/weekly-load.ts:82-110` — vizinho mais próximo, mesma origem de dado. Copiar o estilo do cabeçalho e a assinatura `build*(activities, ..., now)`.
- `packages/shared/src/fitness/consistency.ts:139-151` — o padrão de agrupar **por dia** num `Map<string,number>`, o filtro `if (a.hidden) continue` e o loop que reconstrói dias com `new Date(y, m, d - i)`.
- `packages/shared/src/health/who-activity.ts:153-237` — `activityWeight`, `ACTIVITY_MET` (L90), `DEFAULT_ACTIVITY_MET = 4.0` (L111), `metToWeight` (L124). Piso sem zonas: `durationS * activityWeight(activityId)`. **Somente leitura.**
- `packages/shared/src/health/readiness.ts:31-53` — o contrato de confiança a espelhar (`coverage`, `missing`).
- `packages/shared/src/date/local.ts:13,19` — `localDateStr(d?)`, `localDateOf(iso)`. Não há iteração de dias em `date/`; `addDays` vive em `todo/logic.ts:71`.
- `packages/shared/src/health/trends.ts:18` — `movingAverage` é simples, não exponencial. Não há EWMA no shared: é código novo.
- `packages/shared/src/index.ts:70-84` — bloco `fitness/`, `export *` em ordem de append.
- `packages/shared/src/architecture.test.ts:115,122` — as duas únicas barreiras que varrem `packages/shared/src` e portanto se aplicam aqui.
- `docs/decisions/0002-minutos-de-esforco-ancorados-no-vigoroso.md` — a decisão que estes pesos novos deliberadamente não seguem. A ADR nova precisa citá-la.

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/fitness/form-curve.ts` -- criar o módulo: pesos de zona exportados, carga diária, EWMA configurável, base/cansaço/saldo em escala semanal, típico de 90 dias, confiança e janela curta -- é o núcleo que os dois apps vão consumir
- [x] `packages/shared/src/fitness/form-curve.test.ts` -- cobrir cada linha da matriz de I/O, mais um caso que fixa o alpha (série constante converge para o valor da série) -- o alpha e os pesos são as duas decisões que silenciosamente mudam todo o resultado
- [x] `packages/shared/src/index.ts` -- acrescentar `export * from './fitness/form-curve';` ao bloco `fitness/` -- sem isso o símbolo não existe para web e mobile
- [x] `docs/decisions/0025-carga-de-treino-tem-pesos-proprios.md` -- registrar por que a curva não reusa `HR_ZONE_WEIGHTS`, citando a ADR 0002 -- é uma segunda ponderação de zona convivendo com a primeira, exatamente o que ADR existe para explicar (o spec previa 0021; 0021–0024 já existiam, então saiu como 0025)

**Acceptance Criteria:**
- Dado um atleta com histórico suficiente, quando a carga diária é constante por mais de 42 dias, então base e cansaço convergem para o mesmo valor e o saldo tende a zero.
- Dado um bloco duro seguido de descanso, quando o cansaço cai mais rápido que a base, então o saldo cruza de negativo para positivo — é o comportamento que dá sentido ao polimento.
- Dado que os pesos de zona são exportados, quando outro módulo precisar da mesma carga diária, então ele reusa a constante em vez de redeclarar.
- Dado `pnpm --filter @vitale/shared lint` e `test`, quando rodados, então passam, incluindo as barreiras de arquitetura.

## Design Notes

Os pesos crescem no topo, ao contrário dos da OMS: lá z4 e z5 valem igual porque a pergunta é "foi vigoroso?"; aqui é custo de recuperação, e tiro em z5 custa mais que rodízio em z4. A forma exata fica a critério da implementação, desde que documentada e testada.

O alpha escolhido é o da literatura, e ele é metade da velocidade da convenção comum:

```
1 - e^(-1/42) ≈ 0,0236        2/(42+1) ≈ 0,0465
```

Importa porque dobra a rapidez da curva. A convenção adotada é a que intervals.icu e TrainingPeaks mostram, então os números ficam comparáveis com o que o atleta vê lá.

## Verification

**Commands:**
- `pnpm --filter @vitale/shared lint` -- expected: `tsc --noEmit` sem erro
- `pnpm --filter @vitale/shared test` -- expected: todos os scripts passam, incluindo `form-curve.test.ts` e `architecture.test.ts`
- `npx tsx packages/shared/src/fitness/form-curve.test.ts` -- expected: imprime a contagem de testes e sai com código 0

## Suggested Review Order

**Ponto de entrada**

- Os pesos que diferem da OMS de propósito, e o porquê, no docblock.
  [`form-curve.ts:91`](../../packages/shared/src/fitness/form-curve.ts#L91)

**Carga por atividade**

- Sem zona nenhuma, o treino inteiro é estimativa por tipo, nunca zero.
  [`form-curve.ts:188`](../../packages/shared/src/fitness/form-curve.ts#L188)

- Com zonas, o resto da duração é cobrado a z1, não ao tipo.
  [`form-curve.ts:198`](../../packages/shared/src/fitness/form-curve.ts#L198)

- Só chaves próprias de `FORM_ZONE_WEIGHTS` contam como zona.
  [`form-curve.ts:137`](../../packages/shared/src/fitness/form-curve.ts#L137)

**A curva e a confiança**

- Saída em minutos equivalentes por semana, o vocabulário da meta semanal.
  [`form-curve.ts:43`](../../packages/shared/src/fitness/form-curve.ts#L43)

- O alpha da literatura, metade da velocidade da convenção financeira.
  [`form-curve.ts:131`](../../packages/shared/src/fitness/form-curve.ts#L131)

- `trusted` cai no quarto dia sem atividade, a regra do cartão.
  [`form-curve.ts:118`](../../packages/shared/src/fitness/form-curve.ts#L118)

- Contrato de saída: típico como mediana, último ponto intradiário, duas flags independentes.
  [`form-curve.ts:232`](../../packages/shared/src/fitness/form-curve.ts#L232)

- `shortWindow` declara a imaturidade em vez de semear a média.
  [`form-curve.ts:413`](../../packages/shared/src/fitness/form-curve.ts#L413)

**Guardas de entrada**

- `now` inválido devolve o objeto vazio, sem lançar.
  [`form-curve.ts:334`](../../packages/shared/src/fitness/form-curve.ts#L334)

- Nulo sai antes de virar data: `new Date(null)` é 1970, não NaN.
  [`form-curve.ts:353`](../../packages/shared/src/fitness/form-curve.ts#L353)

- Dia futuro é pulado para `trusted` não mentir.
  [`form-curve.ts:361`](../../packages/shared/src/fitness/form-curve.ts#L361)

- Opção inválida cai no padrão em vez de virar alpha 1 ou `slice(-0)`.
  [`form-curve.ts:304`](../../packages/shared/src/fitness/form-curve.ts#L304)

**Decisão registrada**

- Por que uma segunda ponderação de zona convive com a da ADR 0002.
  [`0025-carga-de-treino-tem-pesos-proprios.md:27`](../../docs/decisions/0025-carga-de-treino-tem-pesos-proprios.md#L27)

- As decisões companheiras que também exigem ADR nova para mudar.
  [`0025-carga-de-treino-tem-pesos-proprios.md:47`](../../docs/decisions/0025-carga-de-treino-tem-pesos-proprios.md#L47)

**Periféricos**

- Alpha fixado por teste; `2/(n+1)` reagiria no dobro da velocidade.
  [`form-curve.test.ts:105`](../../packages/shared/src/fitness/form-curve.test.ts#L105)

- O critério de aceite do polimento: saldo cruza de negativo para positivo.
  [`form-curve.test.ts:132`](../../packages/shared/src/fitness/form-curve.test.ts#L132)

- Chave desconhecida, data futura e opção inválida, cada uma com seu caso.
  [`form-curve.test.ts:268`](../../packages/shared/src/fitness/form-curve.test.ts#L268)

- Reexportação no barrel, sem a qual o símbolo não chega aos apps.
  [`index.ts:85`](../../packages/shared/src/index.ts#L85)

- Dois diferidos: modelo de carga de força e convenção de spec em `docs/specs`.
  [`deferred-work.md:100`](deferred-work.md#L100)
