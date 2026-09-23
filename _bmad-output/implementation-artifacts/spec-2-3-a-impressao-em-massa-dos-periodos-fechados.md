---
title: 'Story 2.3 — A impressão em massa dos períodos fechados'
type: 'feature'
created: '2026-09-23'
status: 'done'
baseline_commit: 'b8c2659'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/scripts/README.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** O arquivo tem **onze** edições, todas em `pacote_versao` 3 — anteriores à gramática da ausência (2.6) e à lápide (2.7). Não há trimestre nenhum, e de 2023 a 2025 quase nada. A parede de capas (2.4) não teria o que mostrar, e o anuário do Épico 3 não teria com o que variar. O script da 2.2 imprime **um** período por vez, à mão.

**Approach:** O mesmo script ganha o modo em massa: enumera os períodos fechados desde 22/05/2023 — mês, trimestre e ano, **nunca semana** —, pula o que já existe, imprime um de cada vez pela mesma porta, e carimba a capa de cada edição que gravar. A retomada é o próprio banco: cada período é uma transação, e rodar de novo pula o que ficou pronto. Antes de gastar, ele mostra o plano e exige um "sim".

## Boundaries & Constraints

**Always:** um período por vez, pela mesma sequência do núcleo e pela porta única (`edicao_imprimir`); a capa é carimbada na impressão que grava, nunca depois; toda leitura de intervalo que cresce com o tempo passa por `fetchAllPages` com ordenação total; falha de um período não derruba a corrida, e o relatório do fim diz quais falharam; nada é reimpresso sem ser nomeado; o dono roda — o agente não executa nada contra produção.

**As decisões do dono (23/09):** (1) **reimprimir cinco** — set/2023, out/2023 e o ano 2023, pelo zero falso, e jul/2026 e ago/2026, porque as mortes de julho e a dos anéis em 17/08 são lápides **do período** e mudam a ordem gravada; junho/2026 fica, porque nada nela muda; (2) as **cinco semanas** já impressas ficam como estão — semana não grava edição, e apagá-las é ato destrutivo sem ganho; (3) o **script passa a carimbar a capa**.

**Ask First:** apagar qualquer edição; imprimir período anterior a 22/05/2023; mudar prompt, conferência ou ranqueamento; migração.

**Never:** a parede de capas (2.4) e silenciar caderno (2.5); imprimir semana; reimprimir período fora da lista nomeada; rodar sem o plano na tela e sem o "sim" explícito.

## I/O & Edge-Case Matrix

| Cenário | Entrada / Estado | Esperado | Erro |
|---|---|---|---|
| O plano | modo em massa, sem o "sim" | lista o que imprimiria, o que pularia e o que reimprimiria, com a conta de chamadas e o tempo estimado; **não chama modelo nenhum** | sai 0, dizendo o que falta |
| A corrida | com o "sim" | um período por vez, em ordem cronológica; cada um gravado numa chamada e com a capa carimbada | — |
| Já impresso | período que existe e não está na lista de reimpressão | pulado, sem chamada paga | — |
| Reimpressão nomeada | um dos cinco | imprime os quatro cadernos e recarimba a capa | — |
| Falha num período | rede, prazo, conferência reprovada | a corrida segue; o período entra no relatório do fim; rodar de novo o tenta outra vez | sai ≠0 se algum falhou |
| Retomada | corrida interrompida no meio | rodar de novo pula o que gravou e continua | — |
| Semana | `--tipo semana` no modo em massa | recusado antes de qualquer leitura | sai ≠0 |
| Sem refresh token | só o token de acesso | recusa antes da rede: a corrida é longa e o token vence em uma hora | sai ≠0, nomeia a variável |
| Exportar antes | a lista de reimpressão | grava num arquivo o texto atual das edições que serão substituídas | — |

</frozen-after-approval>

## Code Map

- `scripts/revista/imprimir.ts` -- a base: `BANDEIRAS` :111-115, `imprimirPeriodo(pedido, deps)` :504 (lê, monta a entrada, chama `imprimir`, compara), `principal(argv, p)` :678, `avisoDeValidade` :736. O modo novo reusa `imprimirPeriodo` inteiro, uma vez por período.
- `scripts/bancada/bancada.ts` :76-84 -- **o molde do portão de gasto**: acima de N chamadas, exige `--sim-gastar-chamadas`. Copiar a forma, não o número.
- `scripts/bancada/supabase.ts` -- `abrirSessao` e o aviso de validade do token; a corrida longa **exige** `ORBE_REFRESH_TOKEN`.
- `packages/shared/src/period/bounds.ts` -- `periodBounds`, `offsetDoInicio` :151, `periodoFechado` (em `period/fechado.ts`): a enumeração nasce daqui, pura.
- `packages/shared/src/revista/capa.ts` -- `escolherCapa`, `capaTrocada`, `secoesDoSeletor` **já são do núcleo**; `data/edicoes-capa.ts` tem `gravarCapa`; `data/activity-photos.ts` tem `fetchPhotosForActivities`.
- `mobile/src/lib/edicao-ia.ts` -- **as três peças que sobem**: `atividadesDoPeriodo` :149, `cidadesDoPeriodo` :168 e `rotuloDaEdicao` (o rótulo por extenso). `carimbarCapa` :245 é o molde do comportamento: **nunca rejeita** — falha de capa vira aviso, nunca apaga texto —, e não carimba sobre acervo que não chegou.
- `packages/shared/src/data/{habits,registros,todo-templates}.ts` -- as três leituras de resumo **sem paginação**, registradas no `deferred-work` desde a 2.2. O critério do épico as alcança.
- `packages/shared/src/data/edicoes-ia.ts` -- `fetchEdicao` e `portasDaEdicao` com a guarda da 2.2; `edicao_imprimir` é a porta única.
- `_bmad-output/implementation-artifacts/deferred-work.md` -- as duas entradas que esta story fecha: o zero falso além de 2023, e jul/ago de 2026 sem lápide.

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/period/periodos.ts` -- novo, puro: `periodosFechadosDesde(desdeISO, agora)` devolve mês, trimestre e ano fechados, em ordem cronológica, **sem semana**, com tipo, início, fim e offset. É a lista que o modo em massa percorre.
- [x] `packages/shared/src/revista/capa.ts` (ou vizinho) -- recebem `atividadesDoPeriodo`, `cidadesDoPeriodo` e o rótulo por extenso, vindos do app; `mobile/src/lib/edicao-ia.ts` passa a importá-los do núcleo, sem mudar comportamento.
- [x] `packages/shared/src/data/{habits,registros,todo-templates}.ts` -- as três leituras de resumo passam por `fetchAllPages` com ordenação total, como as outras nove.
- [x] `scripts/revista/imprimir.ts` -- o modo em massa: enumera, classifica cada período (imprimir, pular, reimprimir), **mostra o plano e para** sem o "sim"; com ele, percorre em ordem, usando `imprimirPeriodo` por período, e carimba a capa de cada edição gravada. Exige `ORBE_REFRESH_TOKEN`. Relatório final: gravadas, puladas, falhadas, com o total de chamadas.
- [x] `scripts/revista/imprimir.ts` -- `--exportar <arquivo>`: grava o texto atual das edições da lista de reimpressão, para o dono commitar em `docs/specs/revista-retrospectiva/` antes de substituí-las. É a pré-condição que a 2.6 registrou.
- [x] `scripts/revista/imprimir.test.ts` -- a matriz inteira com banco e motor falsos: o plano que não chama modelo, a ordem cronológica, o pulo do já impresso, a reimpressão só do que foi nomeado, a falha que não derruba a corrida, a retomada e a recusa da semana.
- [x] `packages/shared/src/period/periodos.test.ts` -- a enumeração: o primeiro mês e o primeiro trimestre depois de 22/05/2023, o período em curso fora, o ano ainda aberto fora, e a contagem total contra a data de hoje.
- [x] `scripts/README.md` -- a seção do modo em massa: o plano antes do gasto, o "sim", o que fazer se a corrida morrer no meio, e a exportação antes da reimpressão.
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` -- `resolucao:` nas duas entradas que esta story fecha.

**Acceptance Criteria:**
- Given o arquivo de hoje, when o plano roda, then lista **cerca de 50** períodos a imprimir, **cinco** a reimprimir e o restante a pular, sem chamar modelo nenhum.
- Given a corrida, when ela termina, then toda edição gravada tem posições contíguas de 1 a N e capa carimbada, e nenhuma semana foi tocada.
- Given uma corrida interrompida, when ela roda de novo, then nada do que já gravou é repetido.
- Given a mudança, when as suítes dos quatro workspaces rodam, then passam, com as barreiras incluídas.

## Design Notes

**A retomada é o banco, não um arquivo de estado.** Cada período é uma transação própria pela `edicao_imprimir`; se a corrida morrer, o que gravou está gravado. Rodar de novo reenumera e pula. Um arquivo de progresso seria um segundo lugar para a verdade morar, e ficaria podre no primeiro `--reimprimir`.

**O plano antes do gasto.** São ~50 períodos e até quatro cadernos cada — 150 a 200 chamadas, com mediana de 13,6 s: perto de uma hora de relógio. O molde é o da bancada: mostrar a conta e exigir o "sim" explícito. O token de acesso dura uma hora, e é por isso que o refresh passa a ser obrigatório aqui.

**A capa segue a regra do telefone.** Impressão que grava carimba; falha de capa **nunca** derruba a edição nem apaga texto — vira aviso no relatório. Para os períodos antigos, sem foto no acervo, a capa nasce `tracado` ou `grade`, que é o que faz a fronteira de 2025 ser visível na parede sem legenda nenhuma.

## Verification

**Commands:**
- `pnpm --filter @vitale/shared lint && pnpm --filter @vitale/shared test` -- verde, barreiras incluídas
- `pnpm --filter @vitale/scripts lint && pnpm --filter @vitale/scripts test` -- verde
- `cd mobile && pnpm exec tsc --noEmit && pnpm exec jest` -- verde
- `pnpm --filter @vitale/web build` -- verde

**Manual checks (do dono, com o JWT dele):**
- O plano, sem o "sim": a lista bate com o inventário (cerca de 50 a imprimir, 5 a reimprimir, 6 a pular).
- `--exportar` das cinco, e o arquivo commitado antes de qualquer reimpressão.
- A corrida, e depois uma edição antiga aberta no iPhone: sem zero falso, e com a lápide onde ela é do período.

## Suggested Review Order

**O plano — o que decide o gasto**

- Ponto de entrada: a classificação de cada período em imprimir, reimprimir ou pular.
  [`imprimir.ts:1136`](../../scripts/revista/imprimir.ts#L1136)

- A lista nomeada: os cinco, com o motivo de cada um e a versão a partir da qual contam como renovados.
  [`imprimir.ts:1051`](../../scripts/revista/imprimir.ts#L1051)

- A enumeração pura: mês, trimestre e ano fechados, nunca semana.
  [`periodos.ts:90`](../../packages/shared/src/period/periodos.ts#L90)

**A corrida — o que gasta**

- Um período por vez, com o freio de três falhas seguidas e o recorte do `--limite`.
  [`imprimir.ts:1408`](../../scripts/revista/imprimir.ts#L1408)

- A capa: lê antes de escolher, e nunca passa por cima da que o dono trocou à mão.
  [`imprimir.ts:729`](../../scripts/revista/imprimir.ts#L729)

- A conta das chamadas pagas sai da trilha, não das respostas com hash.
  [`imprimir.ts:672`](../../scripts/revista/imprimir.ts#L672)

- A exportação, que é a única cópia do texto que vai ser substituído.
  [`imprimir.ts:1358`](../../scripts/revista/imprimir.ts#L1358)

**As leituras**

- O arquivo inteiro, agrupado por período e paginado com ordem total.
  [`edicoes-ia.ts:277`](../../packages/shared/src/data/edicoes-ia.ts#L277)

- As três peças da capa que subiram do app — com a borda do período agora exclusiva.
  [`capa.ts:190`](../../packages/shared/src/revista/capa.ts#L190)

- O teste que corta em mil linhas como o servidor, e prende as cinco leituras.
  [`paginacao-das-leituras.test.ts:26`](../../packages/shared/src/data/paginacao-das-leituras.test.ts#L26)
