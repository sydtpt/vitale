---
title: 'Story 1.3 — O pacote fala por caderno, com bases nomeadas'
type: 'refactor'
created: '2026-09-09'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'baef0be2e734d4011704c5da519b0e29d7b66f15'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** O pacote é **um só** para o período inteiro, e cada número que entra nele
enfraquece a conferência de todos os outros. Medido no pacote real de agosto: 71 valores, dos
quais **16 são inteiros entre 0 e 100** — um inteiro alucinado nessa faixa passa a conferência
**16% das vezes**. A frente vai acrescentar três bases nomeadas e o balde de dado que hoje
não entra; com um pacote só, o alfabeto cresce para todos ao mesmo tempo.

**Approach:** O pacote passa a ser **um por caderno**, e o caderno de Sono deixa de saber
quantos quilômetros o dono pedalou. Seis pacotes de 40 são muito mais seguros que um de 240.
No mesmo movimento, `FatoNumero` troca `anterior`/`delta` por **`bases[]` identificadas**, e
nascem `FatoTendencia` (direção sem valor bruto) e `FatoTexto` (cidades, piso, lápides).

## Boundaries & Constraints

**Always:**
- **O alfabeto é MEDIDO, não afirmado.** O teste publica, por caderno, o tamanho de
  `valoresDoPacote` e a contagem de inteiros de 0 a 100, ao lado dos 71/16 de hoje. Um split
  que devolva o alfabeto ao tamanho antigo **não falha nenhuma asserção** — só a medição o
  denuncia, e é por isso que ela é entrega e não bônus.
- **`CadernoId` nasce aqui**, no núcleo, com dono único: `sono` · `movimento` · `coracao` ·
  `rotina`, minúsculas sem acento, igual do Postgres ao componente.
- **Base inexistente entra no pacote COMO FATO**, nunca some. O modelo não pode descobrir
  sozinho que não há ano anterior — tem que ser informado de que não há.
- `PACOTE_VERSAO` sobe de 1 para 2, e as fixtures puras nascem **no mesmo commit** que muda a
  forma que as torna necessárias.

**Ask First:**
- Qualquer campo do catálogo de `cadernos.md` que não couber em nenhum dos quatro cadernos.
- Qualquer número novo no pacote além dos que a mudança de forma já traz.

**Never:**
- **Não** acrescentar a quinta regra do verificador — é a Story 1.4. Esta story muda a forma;
  a regra que a cobra vem depois.
- **Não** criar `ordenarCadernos` nem a extração da chamada — são 1.7 e 1.8. Aqui nasce o
  vocabulário e o catálogo, não o ranqueamento.
- **Não** deixar dado do balde órfão: todo campo do catálogo cai em algum caderno, ou a
  ausência dele é declarada.
- Não mexer em `PROMPT_VERSAO` nem no prompt — é a 1.5.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Isolamento entre cadernos | Pacote de Sono de um período com ciclismo | Nenhuma chave nem valor de ciclismo aparece nele | N/A |
| O alfabeto encolhe | `valoresDoPacote` de cada caderno | Cada um **menor** que o do pacote único equivalente, e a medição fica publicada | N/A |
| Base que existe | Métrica com período anterior disponível | `bases[]` traz B1 identificada, com valor | N/A |
| Base que não existe | Rotina antes de mai/2027 (sem B2 nem B3) | B2 e B3 entram **como fato declarado de ausência**, não somem | N/A |
| Trajetória | Métrica com 3+ períodos consecutivos | `FatoTendencia` com direção, nº de períodos e desde quando — **sem valor bruto** | N/A |
| Fato de texto | Cidades e piso do período | `FatoTexto`, não `FatoNumero` — não entra no alfabeto numérico | N/A |
| Caderno sem dado | Período sem nenhuma noite registrada | O pacote de Sono existe e declara a ausência; não inventa métrica | N/A |
| Versão da forma | Qualquer pacote montado | `versao === 2` | N/A |

</frozen-after-approval>

## Code Map

- `packages/shared/src/ia/pacote.ts:30` -- `PACOTE_VERSAO = 1` → 2
- `packages/shared/src/ia/pacote.ts:36-45` -- `FatoNumero`: `anterior`/`delta`/`deltaPct` dão
  lugar a `bases[]`; `chave`, `rotulo`, `atual`, `unidade`, `casas` ficam
- `packages/shared/src/ia/pacote.ts:66-71` -- `ModuloFatos` (`modulo`, `rotulo`, `metricas`,
  `cobertura`): é a peça que vira **caderno**
- `packages/shared/src/ia/pacote.ts:106-124` -- `PacoteDeFatos`: hoje um só, com `modulos[]`
- `packages/shared/src/ia/pacote.ts:259-384` -- `montarPacote` e os **cinco** módulos que ele
  produz hoje: `registros`, `saude`, `atividade`, `percepcao`, `dia-a-dia`. **Não é
  renomeação** — ver Design Notes
- `packages/shared/src/ia/pacote.ts:397-434` -- `numerosDoPacote`: percorre
  `atual`/`anterior`/`delta`/`deltaPct`; passa a percorrer `atual` + `bases[]`
- `packages/shared/src/ia/pacote.ts:436-470` -- `valoresDoPacote`: idem, e é **a função que a
  medição do alfabeto usa**
- `packages/shared/src/ia/pacote.test.ts:220-246` -- a introspecção do alfabeto de hoje: ela
  **afirma números específicos**, não mede tamanho. É onde a medição nova entra
- `packages/shared/src/ia/verificar.ts:86-101` -- a regra 1 consome `numerosDoPacote`;
  confirme que ela continua funcionando com a forma nova, **sem** ganhar a quinta regra
- `packages/shared/src/period/` -- onde `cadernos.ts` nasce (`CadernoId` + catálogo)
- `docs/specs/revista-retrospectiva/cadernos.md` -- **o catálogo é lei**: cada campo listado
  ali diz a que caderno pertence
- `mobile/src/lib/edicao-ia.ts:63,76` -- os dois chamadores de `montarPacote`; a assinatura
  muda e eles acompanham

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/period/cadernos.ts` -- criar com `CadernoId` e o catálogo dos
      quatro, dono único -- é o vocabulário que a AD-2 exige
- [x] `packages/shared/src/ia/pacote.ts` -- `FatoNumero` com `bases[]` identificadas; base
      inexistente é fato, não ausência
- [x] `packages/shared/src/ia/pacote.ts` -- `FatoTendencia` e `FatoTexto` novos
- [x] `packages/shared/src/ia/pacote.ts` -- `montarPacote` passa a montar por caderno,
      reparticionando os cinco módulos de hoje segundo `cadernos.md`
- [x] `packages/shared/src/ia/pacote.ts` -- `numerosDoPacote` e `valoresDoPacote` percorrem a
      forma nova, incluindo `bases[]`
- [x] `packages/shared/src/ia/pacote.ts` -- `PACOTE_VERSAO` = 2
- [x] `packages/shared/src/ia/pacote.test.ts` -- **a medição do alfabeto por caderno**,
      publicada ao lado dos 71/16 -- é a única coisa que denuncia um split nominal
- [x] `packages/shared/src/ia/pacote.test.ts` -- fixtures puras sobre o dado real de agosto,
      cobrindo as linhas da matriz
- [x] `mobile/src/lib/edicao-ia.ts` -- acompanhar a assinatura nova

**Acceptance Criteria:**
- Given um período com ciclismo, when o pacote de Sono é montado, then nenhuma chave nem valor
  de ciclismo aparece nele.
- Given os quatro cadernos, when `valoresDoPacote` roda em cada um, then cada alfabeto é menor
  que o do pacote único equivalente, **e os números ficam publicados na saída do teste**.
- Given o caderno Rotina antes de mai/2027, when o pacote é montado, then B2 e B3 aparecem
  como ausência declarada, e a trajetória existe.
- Given qualquer pacote, when ele é montado, then `versao === 2`.

## Design Notes

**Não é renomeação, é reparticionamento — e é aqui que se erra.** Os cinco módulos de hoje
não mapeiam um-para-um nos quatro cadernos. `saude` **se parte** (as métricas de sono vão para
Sono, FC e VFC vão para Coração) e `percepcao` **se parte** (a nota do sono vai para Sono, a
do dia vai para Rotina). Quem tratar isto como um `rename` vai produzir um caderno de Sono com
FC dentro, e nenhum teste de tamanho pega isso — só o teste de isolamento pega.

**Por que a medição é entrega e não bônus.** O modo de falha desta story é silencioso: um
split malfeito — cada caderno recebendo a união em vez da fatia — **passa em toda asserção
que se possa escrever sobre conteúdo**. O pacote de Sono teria os números de Sono, e a
asserção "Sono não tem ciclismo" ainda poderia passar se a partição fosse quase certa. O que
denuncia é o **tamanho**: se a soma dos quatro alfabetos se aproximar dos 71 de hoje, o split
é nominal. Publique os números, não só compare.

**Por que não dividir esta story.** Ela é grande e a tentação é separar "o pacote por caderno"
de "as bases nomeadas". O estado intermediário seria **pior que os dois extremos**: três bases
sem nome num pacote único levam a taxa de alucinação aprovada de 16% para perto de 50%, pela
mesma medição do `bases-e-ranqueamento.md`. Entregar isso e parar é deixar a conferência mais
frouxa do que estava.

**Ausência é fato, não silêncio.** `null` continua sendo "não foi medido" e zero continua
sendo uma medida. Uma base que não existe **entra no pacote dizendo que não existe**, porque
a regra que fecha o buraco é: o modelo não pode descobrir sozinho que não há ano anterior —
ele tem que ser informado.

## Verification

**Commands:**
- `pnpm --filter @vitale/shared lint` -- expected: 0 erros
- `pnpm --filter @vitale/shared test` -- expected: exit 0; **a medição do alfabeto aparece na
  saída**, com um número por caderno
- `cd mobile && pnpm exec tsc --noEmit` -- expected: 0 erros
- `cd mobile && pnpm exec jest` -- expected: sem regressão
- `pnpm --filter @vitale/web build && pnpm --filter @vitale/web test` -- expected: sem regressão

**Provas negativas (rodar e reverter):**
- Fazer um caderno receber a união em vez da fatia -- expected: a **medição** o denuncia (o
  alfabeto dele salta), mesmo que as asserções de conteúdo continuem passando.
- Remover uma base inexistente em vez de declará-la -- expected: reprova.

**Manual checks:**
- Nenhum. Esta story não tem superfície; o texto que a consome é a 1.5, e a tela é a 1.11.

## Suggested Review Order

**O vocabulário, e a lei que ele transcreve**

- O ponto de entrada: `CadernoId` e o catálogo, com `noPacote` por campo.
  [`cadernos.ts`](../../packages/shared/src/period/cadernos.ts)

- Onde "não é renomeação" mora: a saúde se parte entre Sono e Coração.
  [`cadernos.ts:163`](../../packages/shared/src/period/cadernos.ts#L163)

**A forma nova do fato**

- `bases[]` sempre com as três, e a que não existe entra dizendo que não existe.
  [`pacote.ts:36`](../../packages/shared/src/ia/pacote.ts#L36)

- A montagem por caderno, na ordem do catálogo.
  [`pacote.ts:529`](../../packages/shared/src/ia/pacote.ts#L529)

- A cobertura do Coração conta só as métricas dele — o filtro que a fixture escondia.
  [`pacote.ts:562`](../../packages/shared/src/ia/pacote.ts#L562)

**As três guardas que denunciam o silêncio**

- A medição do alfabeto: a única coisa que pega um split nominal.
  [`pacote.test.ts`](../../packages/shared/src/ia/pacote.test.ts)

- O catálogo cobrado, não prometido — marca sem prova reprova.
  [`cadernos.test.ts:213`](../../packages/shared/src/period/cadernos.test.ts#L213)

- O prompt: B1 e os subtítulos de grupo, que o verificador não consegue defender.
  [`prompt.ts:46`](../../packages/shared/src/ia/prompt.ts#L46)
