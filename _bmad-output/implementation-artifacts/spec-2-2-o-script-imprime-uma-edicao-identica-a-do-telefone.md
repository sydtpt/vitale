---
title: 'Story 2.2 — O script imprime uma edição, e ela é idêntica à do telefone'
type: 'feature'
created: '2026-09-21'
status: 'done'
baseline_commit: '5169a3071d65ad7eda9ee24922325b29d2333229'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/scripts/README.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A sequência da impressão já está no núcleo, mas a **entrada** dela não: as nove leituras, as `HEALTH_SPECS`, a conversão das tarefas e o `buildInput` moram na `retro.store` do app — um script teria de reescrevê-los (duas implementações da mesma conta). E o telefone não é determinístico: o quadro de gatilhos e a base do Sono leem todas as noites **carregadas**, e a store não rebusca quando já tem janela mais larga — o mesmo mês gera pacotes diferentes conforme o que foi aberto antes.

**Approach:** A montagem da entrada sobe para o núcleo, cortada na janela `retroSince` do período com os mesmos predicados das leituras, e os dois hospedeiros a chamam. `portasDaEdicao` ganha a guarda contra impressão concorrente. O script em `scripts/revista/` só injeta sessão, transporte e as portas; a igualdade é provada por um gabarito de hashes do pedido (AD-11) que o teste do app e o do script cobram, o mesmo para os dois.

## Boundaries & Constraints

**Always:** só `origem: 'motor'` grava; texto reprovado não chega ao banco; a escrita passa só por `edicao_imprimir` (via `portasDaEdicao`); JWT de usuário pela sessão da bancada, credencial do ambiente, nunca chave de serviço; o núcleo não conhece rede nem SDK de modelo; nenhum dado de saúde real versionado — a fixture é sintética; o stdout do script mostra contagens, hashes e a forma, nunca o texto; a refatoração da store preserva comportamento, exceto o corte da janela (decisão 2a do dono, 21/09).

**Ask First:** mudar prompt, pacote, conferência ou ranqueamento; migração; qualquer escrita em produção feita pelo agente — a execução ao vivo é do dono, com o JWT dele.

**Never:** capa — o script não toca em `edicoes_capa` (decisão 3a; é da 2.3); impressão em massa (2.3), parede (2.4), silenciar (2.5); `--motor`/preferência e `--cadernos` no script (a cadeia é a padrão do descritor, a do telefone sem preferência); ler `.gravar` fora da sequência; `.from()` fora do núcleo; nomear `ia-narrar` fora de `scripts/bancada/motores.ts`; mexer no `scripts/bancada/manifesto.json` (a versão gravada sai da resposta, nunca dele).

## I/O & Edge-Case Matrix

| Cenário | Entrada / Estado | Esperado | Erro |
|---|---|---|---|
| Imprime | período fechado sem edição | um `ler` por caderno, conjunto gravado numa chamada; stdout: caderno, desfecho, hash curto, métrica líder; exit 0 | — |
| Já impresso | edição existe, sem `--reimprimir` nem `--sem-gravar` | recusa depois de ler o banco e antes de chamar o modelo | exit 1, nomeia a bandeira |
| Sem gravar | `--sem-gravar` | chama o modelo e confere; nada gravado; tabela compara com as linhas do banco: posição, provedor, modelo, `prompt_versao`, `pacote_versao`, `agg_version`, métrica líder | — |
| Período inválido | em curso, `all`, ou início que não abre período | recusa antes de abrir rede | exit 1 |
| Sem credencial | variável faltando | para antes da rede e nomeia só o nome da variável | exit 1 |
| Reprovado | texto de um caderno reprova | não entra nas linhas; ninguém escreveu → `nada-gravado` | exit 1 |
| Concorrência | outro hospedeiro grava entre `buscar` e `gravar` | `gravar` relê, vê o conjunto mudado e lança `EdicaoMudouNaImpressao` sem chamar a função | exit 1; no celular, a mensagem genérica de impressão que não terminou |
| Janela larga | dados carregados antes de `retroSince` | mesma entrada que a janela exata | — |

</frozen-after-approval>

## Code Map

- `mobile/src/store/retro.store.ts` -- sai daqui: `HEALTH_SPECS` :40, `buildInput` :89-135, leituras e conversão das tarefas em `ensure` :160-213. Ninguém de fora lê os campos crus, só as funções.
- `packages/shared/src/period/retro.ts` -- `RetroInput` :140; `sleepTriggers` e `history` :715-777 leem todas as noites (a razão do corte).
- `packages/shared/src/period/bounds.ts` -- `retroSince` :319, `offsetDoInicio` :151.
- `packages/shared/src/data/` -- predicados que o corte repete: `health-daily` :90 e `daily-ratings` :58 (`day`), `habit-logs` :25 e `registros` :135 (`log_date`), `sleep` :54 (`wake_day`), `todo-occurrences` :110 (**`done_at >= '${since}T00:00:00'`, instante**); `activities` :118 (`fetchActivities`, sem janela).
- `packages/shared/src/data/edicoes-ia.ts` -- `portasDaEdicao` :292 recebe a guarda; `fetchEdicao` :189; `ContaTrocadaNaImpressao` :282 é o molde do erro novo.
- `packages/shared/src/ia/imprimir.ts` / `imprimir-sequencia.ts` -- a porta e a sequência; só leitura. A sequência chama `buscar` antes de `gravar`, sempre.
- `mobile/src/lib/edicao-ia.ts` :398-460 -- `DepsDaImpressao`/`imprimirEdicao`, o molde do hospedeiro; não muda.
- `mobile/src/hooks/useEntradaDaEdicao.ts` :79 -- entrada = `{ resumo, agora }`; não muda.
- `mobile/src/store/edicao.store.ts` :904 -- erro do `gravar` → `naoTerminou(mensagemDeImpressao)`; já cobre a guarda.
- `scripts/bancada/supabase.ts` -- `lerCredenciais` :173, `abrirSessao` :348; reusar.
- `scripts/bancada/motores.ts` -- `motoresDaBancada` :855 com `Buscar` injetável :88; reusar, é o único que nomeia a function.
- `scripts/bancada/bancada.ts` :712-725 -- molde de CLI (`require.main`, `process.exitCode`).
- `packages/shared/src/architecture.test.ts` -- `PONTOS_DE_INJECAO` :3534, `PORTA_DE_IA` :3705, gravação única :4384 (`.gravar` lido reprova; definir `{ gravar }` não).
- `packages/shared/src/ia/imprimir.test.ts` :105-115 -- como se fabrica texto que a conferência aprova; `ia/fio.ts` :355 `CorpoDaResposta`.
- `mobile/src/store/__tests__/retro-janela.test.ts` -- falsifica os nove fetchers pelo barril.

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/period/retro-dados.ts` -- novo, puro: `DadosDaRetro` (os resultados crus das nove leituras), `HEALTH_SPECS`, `recortarNaJanela(dados, since)` com os predicados acima, `retroInputDe(dados, atividades, agora, tipo, offset)` (corta em `retroSince`, converte as tarefas, filtra `hidden`), `entradaDaRetrospectiva(...)` → `EntradaPacote`.
- [x] `packages/shared/src/data/retro-dados.ts` -- novo: `fetchDadosDaRetro(db, userId, since)`, as nove em paralelo.
- [x] `packages/shared/src/index.ts` -- exportar os dois.
- [x] `packages/shared/src/data/edicoes-ia.ts` -- `buscar` guarda o conjunto de cadernos; `gravar`, depois da conferência da conta, relê e lança `EdicaoMudouNaImpressao` se o conjunto mudou ou se não houve `buscar`.
- [x] `mobile/src/store/retro.store.ts` -- estado `dados`; `ensure` → `fetchDadosDaRetro`; `buildInput` e `taskGrid` → `retroInputDe`.
- [x] `mobile/src/store/__tests__/retro-janela.test.ts` -- falsificar `fetchDadosDaRetro`.
- [x] `packages/shared/src/period/__tests__/contrato-da-edicao.ts` -- novo: fixture sintética de um mês fechado, robusta a `TZ` (`AGORA` em componentes locais, instantes longe da meia-noite), transporte falso por caderno (três aprovam, um cita número inventado), um db falso que responde `getSession`/`fetchEdicao` e captura a carga do `rpc`, e o `GABARITO`: hash por caderno e a carga (`p_ordem`, `p_linhas` com `agg_version_no_momento`).
- [x] `packages/shared/src/period/retro-dados.test.ts` -- novo: cada predicado do corte (inclusive a borda do `done_at`), `hidden`, paridade com a store antiga, janela larga = janela exata, e o núcleo contra o `GABARITO`.
- [x] `packages/shared/src/data/edicoes-ia.test.ts` -- a guarda: conjunto igual grava; mudado ou sem `buscar` lança sem `rpc`.
- [x] `mobile/src/store/__tests__/contrato-da-edicao.test.ts` -- novo: `ensure` → `summary` → `imprimirEdicao` com `portasDaEdicao(db falso)` e `criarMotorDeNuvem(transporte da fixture)` bate o `GABARITO`, também com janela mais larga já carregada.
- [x] `scripts/revista/imprimir.ts` -- novo: CLI `--tipo --inicio [--sem-gravar] [--reimprimir] [--ajuda]`; lê com `fetchDadosDaRetro` na janela `retroSince` e `fetchActivities`; `imprimirPeriodo(deps)` testável; imprime o fuso no cabeçalho; hashes pelo `registrar`, pareados por `aoComecar`.
- [x] `scripts/revista/imprimir.test.ts` -- novo: o caminho do script (`motoresDaBancada` com `Buscar` falso, `portasDaEdicao` sobre o db falso) bate o `GABARITO`; bandeiras; recusas da matriz; `--sem-gravar` nunca chega ao `rpc`.
- [x] `scripts/package.json` -- `"revista:imprimir": "tsx revista/imprimir.ts"`.
- [x] `scripts/README.md` -- seção "Imprimir uma edição": comando, `--sem-gravar` antes, fuso igual ao do iPhone, não imprimir pelos dois ao mesmo tempo, capa não carimbada.
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` -- 2.1 `done` com a evidência (workspace, barreira, CI :70-72); 2.2 em andamento.
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` -- `resolucao:` na entrada da concorrência (:425): estreitada pela guarda, a migração continua aberta.

**Acceptance Criteria:**
- Given a fixture do contrato, when o app e o script imprimem, then os dois batem o mesmo `GABARITO`: hash por caderno, ordem, provedor, modelo, `prompt_versao`, `pacote_versao` e `agg_version_no_momento`.
- Given a árvore depois da mudança, when as barreiras rodam, then passam sem teto novo e sem nome novo liberado.
- Given o script, when se procura cliente da `ia-narrar`, leitura de corpo de erro ou tradução de classe fora do núcleo e de `bancada/motores.ts`, then não há.

## Design Notes

O `GABARITO` vale por ser **um só para os dois hospedeiros**, não pelos números: ele é fixado da primeira execução do núcleo, e mudá-lo é ato deliberado, como o golden de `pacote.test.ts`. Se o script esquecer o `hidden`, o hash do Movimento diverge e o teste daquele lado fica vermelho. O corte da janela **não** muda hash nenhum hoje — o pacote não lê nada anterior a `retroSince` —, e por isso quem o prende é outra conferência: o resumo com a janela do Ano já carregada tem de ser igual ao da janela exata (medido: desligar o corte deixa esse teste vermelho). Corrigido na revisão de 22/09; a versão anterior desta nota afirmava que o hash divergiria.

O corte repete o predicado **do banco**, não o dia local: nas tarefas, o literal `'${since}T00:00:00'` é lido no fuso da sessão do PostgREST (UTC no Supabase), então o corte compara o instante `done_at` com `${since}T00:00:00Z`. Cortar pelo `doneDay` local reabriria a diferença justo na borda, onde uma tarefa das 00:30 de Bruxelas cai no dia anterior em UTC. Todas as outras leituras comparam string de dia com string de dia.

A guarda mora no núcleo porque o script não pode embrulhar o `gravar`. Ela estreita a janela de minutos para uma ida e volta e não a fecha; a migração continua no deferred-work. Uma `portasDaEdicao` por impressão, como os dois hospedeiros já fazem.

## Verification

**Commands:**
- `pnpm --filter @vitale/shared lint && pnpm --filter @vitale/shared test` -- verde, barreiras incluídas
- `pnpm --filter @vitale/scripts lint && pnpm --filter @vitale/scripts test` -- verde
- `cd mobile && pnpm exec tsc --noEmit && pnpm exec jest` -- verde
- `pnpm --filter @vitale/web build` -- verde (o barril mudou)

**Manual checks (do dono, com o JWT dele):**
- `--sem-gravar` num período que o telefone já imprimiu: provedor, modelo, versões e `agg_version` iguais; posição e métrica líder iguais, salvo dado novo no período.
- Uma impressão de verdade num período de 2026 sem edição, e a edição aberta no iPhone.

**Feitas pelo dono em 22/09/2026 — as duas passaram:**
- Ensaio em agosto/2026 (o mês do piloto): zero `≠` na tabela. Posição, provedor `google`,
  modelo `gemini-3.6-flash`, `prompt_versao` 5, `pacote_versao` 3, `agg_version` 9 e métrica
  líder iguais nos quatro cadernos — inclusive o **nulo** do Sono —, e a ordem do
  ranqueamento igual à congelada em 18/09. O caderno movimento caiu em `transitoria` nesse
  ensaio e a linha antiga ficou de pé, como a sequência promete; na impressão seguinte ele
  escreveu.
- Impressão real da semana de 17/08: os quatro cadernos escritos, ordem contígua de 1 a 4,
  gravados numa chamada, e a edição aberta no iPhone pelo dono ("funcionou"). É a primeira
  edição gravada por um hospedeiro que não é o telefone. Sem capa, como a decisão 3a previu.
- De quebra, a semana de 14/09 provou a recusa do já impresso em produção: parou depois da
  leitura e antes de qualquer chamada paga.

## Suggested Review Order

**A entrada da edição sobe para o núcleo**

- Ponto de entrada: a conta única que telefone e script chamam — corta, filtra ocultas, converte tarefas.
  [`retro-dados.ts:257`](../../packages/shared/src/period/retro-dados.ts#L257)

- O corte repete o predicado de cada leitura do banco, e não o dia local.
  [`retro-dados.ts:189`](../../packages/shared/src/period/retro-dados.ts#L189)

- `done_at` comparado como instante UTC — é como o PostgREST lê o filtro.
  [`retro-dados.ts:38`](../../packages/shared/src/period/retro-dados.ts#L38)

- A entrada pronta para `imprimir`: o resumo e o relógio, nada mais.
  [`retro-dados.ts:339`](../../packages/shared/src/period/retro-dados.ts#L339)

- As nove leituras em paralelo, cruas; rejeita se qualquer uma falhar.
  [`retro-dados.ts:30`](../../packages/shared/src/data/retro-dados.ts#L30)

- O telefone guarda só os dados crus e monta tudo pela conta do núcleo.
  [`retro.store.ts:72`](../../mobile/src/store/retro.store.ts#L72)

**A guarda contra impressão concorrente**

- O `buscar` lembra período e conjunto; o `gravar` relê e recusa se mudou.
  [`edicoes-ia.ts:390`](../../packages/shared/src/data/edicoes-ia.ts#L390)

- Período trocado recusa antes de reler: porta reusada não passa.
  [`edicoes-ia.ts:408`](../../packages/shared/src/data/edicoes-ia.ts#L408)

- O erro não afirma a causa: diz que o conjunto mudou e nada foi gravado.
  [`edicoes-ia.ts:280`](../../packages/shared/src/data/edicoes-ia.ts#L280)

**O script**

- A impressão de um período: recusa o já impresso, lê na janela, chama `imprimir`.
  [`imprimir.ts:504`](../../scripts/revista/imprimir.ts#L504)

- `buscar` embrulhado por espalhamento — fecha a corrida do "já impresso" sem ler `.gravar`.
  [`imprimir.ts:571`](../../scripts/revista/imprimir.ts#L571)

- Do lado do modelo, só o transporte da bancada; o motor é o do núcleo.
  [`imprimir.ts:745`](../../scripts/revista/imprimir.ts#L745)

- Escritos, mantidos e os que saíram — o dono vê o que a função apagou.
  [`imprimir.ts:465`](../../scripts/revista/imprimir.ts#L465)

- `TZ` com nome errado recusa: o ICU cairia calado para UTC.
  [`imprimir.ts:382`](../../scripts/revista/imprimir.ts#L382)

- Período inválido recusa antes da credencial e da rede.
  [`imprimir.ts:219`](../../scripts/revista/imprimir.ts#L219)

- O executável: bandeiras, fuso, período, credencial — nessa ordem.
  [`imprimir.ts:674`](../../scripts/revista/imprimir.ts#L674)

**A prova — um gabarito para os dois hospedeiros**

- A fixture sintética e o `GABARITO`: hash por caderno e a carga do `rpc`.
  [`contrato-da-edicao.ts:602`](../../packages/shared/src/period/__tests__/contrato-da-edicao.ts#L602)

- O telefone bate o gabarito, também com a janela do Ano já carregada.
  [`contrato-da-edicao.test.ts:109`](../../mobile/src/store/__tests__/contrato-da-edicao.test.ts#L109)

- O script bate o mesmo gabarito, pelo transporte real da bancada.
  [`imprimir.test.ts:121`](../../scripts/revista/imprimir.test.ts#L121)

- Janela larga = janela exata, pelo núcleo.
  [`retro-dados.test.ts:176`](../../packages/shared/src/period/retro-dados.test.ts#L176)

- A guarda, com o falso que filtra por período de verdade.
  [`edicoes-ia.test.ts:597`](../../packages/shared/src/data/edicoes-ia.test.ts#L597)

- Concorrência no script: outro hospedeiro grava no meio, e nada chega ao `rpc`.
  [`imprimir.test.ts:316`](../../scripts/revista/imprimir.test.ts#L316)

**Periféricos**

- Como imprimir, o `--sem-gravar` antes, e o que não imprimir até a 2.6/2.7.
  [`README.md:9`](../../scripts/README.md#L9)

- O barril exporta a conta e a leitura novas.
  [`index.ts:147`](../../packages/shared/src/index.ts#L147)

- O comando `revista:imprimir`.
  [`package.json:10`](../../scripts/package.json#L10)
