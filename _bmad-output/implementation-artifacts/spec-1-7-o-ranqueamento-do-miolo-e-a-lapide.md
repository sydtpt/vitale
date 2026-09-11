---
title: 'Story 1.7 — O ranqueamento do miolo e a lápide'
type: 'feature'
created: '2026-09-11'
status: 'done'
review_loop_iteration: 1
baseline_commit: '2e276ea5d8f5079d63bf2301583dcb90b89b7515'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/docs/specs/revista-retrospectiva/bases-e-ranqueamento.md'
---

<frozen-after-approval reason="human-owned intent — renegotiated by the owner on 11/09/2026, after the first review (the distance sample)">

## Intent

**Problem:** A edição não tem como decidir que caderno abre. Não existe função de ordem, a
lápide não existe no pacote (o catálogo a declara ausente, e `FatoTexto` não tem data), e o
passo 2 do ranqueamento não tem com o que operar — nenhum fato carrega amostra. Sem isso a
1.9 não tem o que congelar em `posicao`, e uma métrica morta some justamente no mês em que
morreu.

**Approach:** `ordenarCadernos(pacotes) → CadernoId[]`, pura, com os seis passos de
`bases-e-ranqueamento.md`. A lápide vira fato próprio do pacote — métrica e data da última
medida — e o prompt aprende a escrevê-la. O fato numérico ganha dois campos que **só o
ranqueamento lê**, `amostra` e `comparavel`, fora do alfabeto e fora do prompt. Quem morreu
**não** é decidido aqui: a lápide chega pronta na entrada.

## Boundaries & Constraints

**Always:**
- **A precedência dos passos:** lápide do período na frente (5); depois os que passam no
  portão, por afastamento × peso (1, 2, 3); depois os que não passam, na ordem do catálogo;
  todo empate pelo catálogo (4); vazio fora (6). **O passo 5 vence o 6.**
- **Afastamento de um fato** = `|deltaPct|` da base **mais confiável que ele tem** (B3, depois
  B2, depois B1) × o peso dela — B2/B3 = 1, B1 = 0,5. Nunca a maior das três. O do caderno é
  o maior entre os fatos que passam no portão, e a chave desse fato é a **métrica líder**.
- **O portão:** cobertura do caderno não desigual (caderno sem cobertura não é desigual)
  **e** `comparavel` **e** `amostra ≥ 7`. `amostra` é o menor lado da comparação com B1, em
  observações **que carregam a medida** — a própria contagem; as atividades **com distância**
  para a distância, no total e em cada esporte; as sessões do grupo para o tempo; as compras
  para o gasto; os dias com valor para saúde e notas; `null` quando não se sabe (passos,
  andares, **elevação**), e `null` não passa. `comparavel` é falso para hábito ou registro
  criado depois do início do período anterior.
- **Nada disso entra no alfabeto:** `amostra`, `comparavel` e a data da lápide ficam fora de
  `procedenciaDoPacote` — a assinatura da procedência da 1.6 continua idêntica.
- **O vazio tem dono único:** a mesma função decide o passo 6 e o prompt mudo, **nos dois
  grãos**. Lápide antiga não ressuscita caderno vazio; lápide do período ressuscita.
- **Lápide só das quatro do catálogo**, com nome em prosa **sem dígito**: *consumo máximo de
  oxigênio* e *anéis de atividade* em Movimento; *frequência respiratória* e *saturação de
  oxigênio* em Coração. Entra no pacote se a última medida ≤ fim do período; é **do período**
  se também ≥ início. A data vai ao prompt por extenso — *"14 de julho de 2026"*.
- `PACOTE_VERSAO` 2 → 3 e `PROMPT_VERSAO` 4 → 5.

**Ask First:**
- Mudar o passo 1 (ex.: afastamento contra a oscilação típica da métrica) — é contrato.
- Mudar o N, os pesos, ou pôr amostra ou data no alfabeto.
- Qualquer mudança de severidade em `verificar.ts`.

**Never:**
- Detectar métrica morta, consultar banco ou fixar limiar de silêncio — vai ao `deferred-work`.
- Exportar `ordenarCadernos` pelo `index.ts`: é função de impressão (1.10), nunca de render (1.9).
- Tocar migração, tela, silenciar caderno (2.5) ou a chamada (1.8).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Julho/2026 | VO₂max 14/07; respiração 10/07 e SpO₂ 16/07 | `movimento`, `coracao` na frente, pelo catálogo | N/A |
| Agosto/2026 | fixture real + anéis 17/08 | Movimento 1º; métrica líder `ciclismo.distancia` (amostra 7); corrida +381% (amostra 2) barrada; Sono atrás (27 × 14 noites) | N/A |
| Setembro/2026 | as quatro lápides, nenhuma no período | ninguém forçado | N/A |
| Só lápide antiga | Coração sem dado, lápides de julho, em setembro | Coração fora da lista **e** prompt mudo | N/A |
| Só lápide do período | Coração sem métrica, em julho | Coração presente e forçado; prompt não mudo | N/A |
| Rotina nova | hábitos criados 20/05, 11 → 26 dias em junho | Rotina atrás | N/A |
| Rotina legítima | hábito antigo, 20 → 30 dias, maior afastamento | Rotina pode liderar — portão, não proibição | N/A |
| Fronteira do N | amostra 7 · amostra 6 | disputa · não disputa | N/A |
| Confiança | fato com B3 −10% e B1 −60% | usa B3 (10), não B1 (30) | N/A |
| Lápide posterior | julho, anéis 17/08 | anéis fora do pacote de julho | N/A |
| Distância sem base | fev → mar/2026: 8 → 24 atividades, **2** → 17 com distância | a distância não disputa (amostra 2); Movimento lidera por `atividades` | N/A |
| Elevação | qualquer variação de elevação | nunca disputa — amostra nula | N/A |
| Entrada | 24 permutações; objetos congelados | mesma saída; nada mutado | N/A |
| Entrada inválida | caderno repetido; períodos diferentes | — | lança erro |

</frozen-after-approval>

## Code Map

- `packages/shared/src/ia/pacote.ts:113` `FatoNumero` -- ganha `amostra` e `comparavel`,
  **obrigatórios**: todo produtor de fato decide a própria amostra
- `packages/shared/src/ia/pacote.ts:465,484,528,540,546` -- `deRecap`, `deMetrica`, `esporte`,
  `habitos`, `registros`: onde a amostra nasce, porque só ali se sabe de onde o número veio
- `packages/shared/src/ia/pacote.ts:225,550,604,725` -- `PacoteDeFatos` (+`lapides`),
  `EntradaPacote` (+`lapides`), `montarPacotes`, o `semDado`
- `packages/shared/src/ia/pacote.ts:746-867` -- alfabeto e procedência: **não tocar**; a
  assinatura em `pacote.test.ts:923` é a prova
- `packages/shared/src/ia/prompt.ts:529-531` -- o `mudo` inline de `montarPrompt` vira a
  função de vazio; `:454` `montar()` passa a pular caderno vazio (o grão da edição, que é o
  da produção); `:230` `blocoDeCaderno` ganha a seção da lápide; `:396` FORMA; `:435` versão
- `packages/shared/src/ia/verificar.ts:411-423` -- `ignoravel` já dispensa "14 de julho" e
  "2026"; `:322` parágrafo é linha em branco; `:59` `NUM` casa o "2" de "VO2" — daí nome sem dígito
- `packages/shared/src/period/cadernos.ts:104,120,186-198` -- as duas linhas de lápide; o
  padrão de `cadernoDaMetricaDeSaude` joga VO₂max e anéis em Coração — a lápide precisa de mapa próprio
- `packages/shared/src/period/cadernos.test.ts:129` `ENTREGUE` -- predicado das duas linhas
- `packages/shared/src/period/retro.ts:257,281,536-572` -- linhas de hábito e registro, sem `createdOn`
- `packages/shared/src/week/recap.ts:144-163` -- `MetricRecap` só tem o `n` do período corrente
- `packages/shared/src/period/bounds.ts:138` -- `previousPeriodLabel`: o início do anterior
  sai pelo **mesmo** caminho (`periodBounds(inicio, kind, -1)`)
- `packages/shared/src/architecture.test.ts:760-800` -- a barreira do núcleo de IA varre `ia/`
  inteiro: arquivo novo lá nasce coberto
- `packages/shared/src/ia/verificar.test.ts:886` -- as sete edições reais, base da ida e volta;
  ~7 pacotes e ~9 fatos montados à mão ganham os campos novos

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/week/recap.ts` -- `nAnterior?` em `MetricRecap`, preenchido nas duas funções
- [x] `packages/shared/src/period/retro.ts` -- `createdOn?` nas linhas de hábito e registro, copiado da entrada
- [x] `packages/shared/src/period/bounds.ts` -- `previousPeriodStartISO` ao lado de `previousPeriodLabel`
- [x] `packages/shared/src/period/cadernos.ts` -- mapa das quatro lápides (caderno + nome em
      prosa) e o tipo `MetricaComLapide`; as duas linhas viram `noPacote: true`
- [x] `packages/shared/src/ia/pacote.ts` -- `amostra`, `comparavel`, `FatoLapide`, `lapides`,
      `cadernoVazio(p)` exportada, `semDado` com a lápide do período, `PACOTE_VERSAO` 3
- [x] `packages/shared/src/ia/prompt.ts` -- seção "Métricas que pararam de chegar" com a data
      por extenso; linha na FORMA (parágrafo próprio; a do período abre o caderno, as antigas
      fecham; nome e data, nada mais); `cadernoVazio` nos dois grãos; `PROMPT_VERSAO` 5
- [x] `packages/shared/src/ia/ranqueamento.ts` -- **novo**: `AMOSTRA_MINIMA`, `PESO_DA_BASE`,
      `liderDoCaderno`, `ordenarCadernos`
- [x] `packages/shared/src/ia/ranqueamento.test.ts` -- **novo**: a matriz inteira, a costura
      com o prompt e a ausência no `index.ts`
- [x] `packages/shared/src/ia/pacote.test.ts`, `ia/verificar.test.ts`, `period/cadernos.test.ts`
      -- lápide na montagem e no prompt; sentinela fora do alfabeto; ida e volta; predicados; versões
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` -- o detector de métrica morta e
      o domínio de Movimento (ver Design Notes)

**Remendo da revisão 1** (ver `Spec Change Log`):
- [x] `packages/shared/src/period/retro.ts` + `ia/pacote.ts` -- a contagem de atividades **com
      distância**, dos dois lados, no total e por esporte; a amostra da distância sai dela, e a da
      elevação vira `null`
- [x] `packages/shared/src/period/cadernos.ts` + `ia/prompt.ts` -- a lápide carrega o verbo
      ("pararam" para anéis); a do período sai no topo do bloco, as antigas no pé; a FORMA diz
      as duas formas do verbo
- [x] `packages/shared/src/period/cadernos.ts` -- VO₂max e anéis em Movimento também no mapa de
      saúde: uma rota só, e o teste cobra a concordância dos dois mapas
- [x] `packages/shared/src/ia/pacote.ts` + `ia/ranqueamento.ts` -- data de lápide impossível
      explode com mensagem certa; `createdOn` malformado não é comparável; "tem lápide do
      período" com dono único; a doc de `Lider` e do barril sem prometer demais; nota nas duas
      linhas de lápide do catálogo
- [x] testes -- as linhas novas da matriz; as cláusulas de cobertura, evento e correlação do
      vazio com asserção absoluta; lápide no último dia do período; lápides no mesmo dia; ida e
      volta contra o mesmo pacote; sentinela pelo prompt inteiro; `nAnterior` das notas de ponta a
      ponta; semana que cruza o horário de verão; `versao` dos pacotes à mão

**Remendo da revisão 2:**
- [x] `period/retro.ts` + `ia/pacote.ts` -- a amostra do gasto são as compras **com preço**
- [x] `ia/pacote.ts` -- `createdOn` só `YYYY-MM-DD` (carimbo de hora não é comparável); início do
      anterior desconhecido com B1 existente não é comparável
- [x] `ia/pacote.ts` + `ia/prompt.ts` + `ia/ranqueamento.ts` -- a validação da lápide com dono
      único (catálogo, calendário, ≤ fim do período, caderno dela), usada também em pacote montado à mão
- [x] `date/local.ts` -- `isValidDate` passa a morar com as datas locais; `ia/` deixa de depender de `todo/`
- [x] testes -- fuso fixado nos testes de data local; caderno vazio com a forma do celular; a
      linha "Distância sem base" com os números da matriz; fallback de base; `nAnterior` semanal;
      a marca da lápide copiada na ida e volta
- [x] documentação -- a justificativa do N refeita com a regra da iteração 1; números da spec

**Remendo da revisão 3** (só teste e texto — ver `Spec Change Log`):
- [x] `ia/ranqueamento.test.ts` -- B2 na matriz da confiança; período misto por uma coordenada
      só (tipo, fim) e caderno desconhecido; lápide inválida no caderno vazio, nos dois grãos e
      no ranqueamento
- [x] `ia/pacote.ts` + `ia/prompt.ts` -- a doc de `lapideDoPeriodo` sem "uma vez só"; a FORMA com
      o nome por extenso, nunca por sigla
- [x] `ia/pacote.test.ts` + `ia/verificar.test.ts` -- o comentário dos fusos com o que cada um
      pega, medido; a origem do lado de julho do fixture; a FORMA sem sigla
- [x] documentação -- AC 3 com "pararam"; trimestre e ano sem simulação própria; três provas
      negativas novas; `deferred-work` sem as duplicatas da rodada 2

**Acceptance Criteria:**
- Given os pacotes de qualquer fixture da suíte, when `ordenarCadernos` roda, then todo caderno
  da saída tem `montarPrompt` não vazio e bloco em `montarPromptDaEdicao`, e nenhum outro tem.
- Given `amostra: 777` num fato e uma lápide datada, when alfabeto e prompt são lidos, then 777
  não aparece em nenhum dos dois e a assinatura da procedência não muda.
- Given a frase que a FORMA prescreve para a lápide (nome, "parou de chegar em" — ou
  "pararam", que é o verbo dos anéis —, data por extenso), como parágrafo próprio antes e depois de cada parágrafo das sete edições reais, when
  `verificarTexto` roda, then o veredito é o mesmo sem ela.
- Given a entrada sem `lapides` — o que o celular manda hoje —, when o prompt de agosto é
  montado, then o `usuario` é idêntico, byte a byte, a um golden capturado no commit base.

## Spec Change Log

### Iteração 1 — a amostra da distância contava ioga (11/09/2026)

**Achado que disparou.** Três camadas de revisão (cega, casos de borda, lacunas de
verificação). A cega e a de borda acharam o mesmo furo, independentes: a amostra da distância
contava **toda** sessão do grupo, e ioga e força não têm distância. Medido em produção: fev/26
teve 8 atividades e **2** com distância, então o "+971% de distância" de março passava no portão
com amostra 8. Em ago/26 eram 32 contra 15 (contagem crua de produção, antes do dedupe
multi-fonte; o fixture de agosto, depois dele, tem 21 atividades). E a elevação de uma rota que não sincronizou virava
"−100%" com a amostra cheia.

**Emenda.** O dono renegociou o texto congelado em 11/09: a amostra conta observações **que
carregam a medida** — as atividades com distância para a distância, e `null` para a elevação.
Refeita a simulação dos 39 meses com a regra nova: o N = 7 continua certo, e março/26 passa a
abrir com "atividades +200%" (8 → 24), a mesma história sobre base honesta. A linha de agosto da
matriz não muda.

**Por que remendo, e não revert.** O `bmad-build` manda reverter; o `AGENTS.md` (§ Revisão:
quando reverter e quando remendar) manda remendar quando a emenda **aperta** uma regra que a
spec já dizia — aqui, "em observações". Re-derivar produziria as mesmas 1.400 linhas com outra
semente. O preço, que o `AGENTS.md` cobra, é uma rodada nova de revisão depois do remendo.

**Estado ruim evitado.** Manchete de Movimento apoiada em 2 atividades com a amostra dizendo 8;
"elevação −100%" como notícia de uma falha de sincronização.

**KEEP — tudo o que a iteração 0 entregou, e em especial:**
- o ranqueamento em `ia/ranqueamento.ts`, fora do barril, com a precedência e a validação;
- `cadernoVazio` como dono único nos dois grãos e a costura cobrada nos três arquivos;
- o golden do celular capturado no commit base, e a sentinela 777;
- a ida e volta sobre as sete edições reais, com a lápide lida do prompt renderizado.

**Junto no remendo, da mesma rodada:** a concordância de "anéis de atividade" (o verbo vai
com a lápide), a lápide do período no topo do bloco, uma rota só para VO₂max e anéis, validação
de data e de `createdOn`, e sete testes que a revisão provou faltarem — três deles com mutação
que deixava a suíte verde.

### Rodada 2 — só remendo, sem emenda (11/09/2026)

Nenhum achado tocou a intenção. O principal é da mesma família da iteração 1: a amostra do
gasto contava compras sem preço — lido como aplicação direta do princípio emendado ("observações
que carregam a medida"), não como emenda nova. O resto é rigor: a validação da lápide passa a
valer também para pacote montado à mão; `createdOn` fica estrito; os testes de data local ganham
fuso fixo (o CI roda em UTC, onde duas mutações passavam); o caderno vazio ganha fixture com a
forma que o celular manda (linhas presentes, todo `atual` nulo), onde uma mutação de `semDado`
passava. Adiados: a amostra por contagem barra colapso real (hábito 20 → 0), o nascimento para
B2/B3, e a lápide contra dado vivo da mesma métrica. A justificativa do N foi refeita com a regra
da iteração 1: com 5 passam duas manchetes sobre 5–6 sessões; com 10 somem três histórias cujo
lado fino tinha 8 atividades (mar/26 "atividades +200%" vira "VFC +23%"); Movimento segue abrindo
24 dos 39 meses.

### Rodada 3 — três testes que faltavam, e o critério de parada (11/09/2026)

Três camadas sobre os remendos da rodada 2. Nenhum achado tocou a intenção nem o comportamento
em produção. Voltaram três proteções que a spec afirma e nenhum teste cobrava — cada uma com
mutação que passava verde e agora reprova:

1. **Nenhum teste passava B2.** A ordem de confiança (B3, depois B2, depois B1) está no texto
   congelado, e três ordens erradas de `POR_CONFIANCA` passavam. Duas linhas novas na confiança.
2. **O período misto só era testado com início e fim diferentes.** Tirar a comparação de tipo
   ou a de fim passava. A de tipo só é pega com datas idênticas e tipo diferente — forma que só
   pacote montado à mão tem, porque mês e trimestre reais nunca dividem início e fim. Entrou
   também o caderno desconhecido.
3. **A lápide inválida em caderno vazio.** `montar()` promete explodir "seja ou não vazio", e
   filtrar o vazio antes de validar passava. O loop das lápides erradas roda agora sobre um
   Coração vazio, e as três portas lançam a mesma mensagem.

Texto: a lápide lidera o mês, o trimestre e o ano em que parou — não "uma vez só"; o comentário
dos fusos diz o que cada um pega, medido (Nova York não pega `toISOString()`, só a semana em
milissegundos na virada da primavera); o fixture de agosto diz de onde vem o lado de julho; a
FORMA manda o nome por extenso, nunca por sigla — uma linha de prosa, `PROMPT_VERSAO` segue 5,
que ainda não saiu. No `deferred-work`, três pares duplicados da rodada 2 viraram três entradas.

**Adiados:** a lápide antiga sem prazo (pergunta do detector); a barreira contra import profundo
de `ia/ranqueamento` (1.9); o celular não manda `coberturaSono`, e a perna de cobertura do portão
está dormente no Sono em produção (1.10). **Descartados, com motivo:** `all` não tem edição (o
CHECK de `tipo_periodo` recusa); `montarPromptDaEdicao` é transitória e morre na 1.10, e dar a ela
a validação de caderno e período do ranqueamento não protege caminho nenhum de produção; pacote
nunca é serializado entre versões.

**O critério de parada — o da 1.6, iteração 5.** É a terceira rodada seguida em que o que volta
é teste mais fraco do que a spec diz, e não defeito de produto: o comportamento em produção é o
mesmo desde a rodada 2, e esta rodada não mudou código de produção além de uma linha de prosa da
FORMA. A regra do `AGENTS.md` sobre a terceira vez fala de **defeito**; o que se repete aqui é a
revisão construir mais uma mutação hipotética que escapa, e essa fonte não seca. O preço de não
fazer a rodada 4 foi pago de outro jeito: cada teste novo foi conferido contra a mutação que ele
existe para pegar, e duas delas foram refeitas por fora do implementador. A revisão da story para
aqui, por esse motivo, e fica escrito.

**Verificação da rodada:** shared lint 0; 421 testes `node:test` verdes (ranqueamento 71 → 80);
mobile `tsc` 0 e jest 691 + 3 pulados; web build e 141 testes verdes.

## Design Notes

**Por que `ia/ranqueamento.ts`, e não `period/cadernos.ts` como diz a espinha.** O ranqueamento
precisa de `cadernoVazio`, que é do pacote, e `ia/pacote.ts` já importa `period/cadernos.ts` em
runtime — pôr a função lá fecharia um ciclo. Em `ia/` ela nasce sob a barreira do núcleo de IA.
Correção pendente na espinha (Structural Seed), que não se edita aqui.

**Por que N = 7, e não um número redondo.** Simulado sobre os 39 meses fechados (17 com dois
cadernos ou mais), dado de produção, refeito com a regra da iteração 1 (a distância conta só as
atividades com distância; a elevação não disputa): com 5 passam duas manchetes sobre 5–6
sessões; com 10 somem três histórias cujo lado fino tinha 8 atividades (mar/26 "atividades
+200%" vira "VFC +23%"). 7 é o menor valor sem nenhum dos dois, e Movimento segue abrindo 24
dos 39 meses. O "+971% de distância" que a primeira simulação dava a março não era história —
era ruído sobre 2 atividades com distância, e é o que a regra nova barra. Os dois vazamentos de
ruído que a primeira simulação deixava (mai/25, jan/26) não foram remedidos com a regra nova.
O N foi calibrado em **meses**. Trimestre e ano usam o mesmo piso de observações, **sem
simulação própria** — num ano o lado fino é da ordem de doze vezes o de um mês, e o 7 quase não
filtra; quem mede se isso incomoda é o piloto da 1.15. A semana é postal (não grava edição,
CAP-9) e não ordena; `all` não tem edição (o CHECK de `tipo_periodo` o recusa).

**Por que o portão de nascimento.** O caso da AC aconteceu: em junho/2026 Rotina abriria com
"Café +136%", porque os hábitos nasceram em 20/05 — maio teve 12 dias de existência deles, e o
Café marcou 11. Nenhum N até 11 o barra — não é amostra pequena, é caderno novo.

**Por que peso, e não ordem lexicográfica.** Lexicográfica faria 2% contra a normal vencer 60%
contra o mês anterior. Hoje ninguém passa B2/B3, então o peso ainda não muda ordem nenhuma.

**Por que nome sem dígito.** `NUM` lê o "2" de "VO2" como número fora do alfabeto — o mesmo
defeito que o `deferred-work` já registra para rótulos com dígito (1.5). "VO₂" copiado é
inerte; normalizado, reprova a edição.

**Entrega para a 1.9 e a 1.10.** `liderDoCaderno` pode devolver `null` — caderno que só tem
lápide, ou que não passou no portão. `metrica_lider not null` na 1.9 precisa decidir esse caso;
a 1.10 carimba a partir desta função e nunca recalcula.

**Achado para a 1.15, fora desta story.** Com os passos como estão, Movimento abre 24 dos 39
meses e Sono e Coração nunca: contagem de atividade oscila dezenas de %, FC oscila 1–5%. É o
R-35 aparecendo cedo. Vai ao `deferred-work` com o dado.

## Verification

**Commands:**
- `pnpm --filter @vitale/shared lint` -- expected: 0 erros
- `pnpm --filter @vitale/shared test` -- expected: exit 0, barreiras verdes, assinatura da procedência inalterada
- `cd mobile && pnpm exec tsc --noEmit && pnpm exec jest` -- expected: sem regressão
- `pnpm --filter @vitale/web build && pnpm --filter @vitale/web test` -- expected: sem regressão

**Provas negativas (rodar e reverter):**
- Lápide do período atrás do portão -- julho e "só lápide do período" reprovam
- `>` no lugar de `≥` no N -- a fronteira reprova
- A maior das três bases no lugar da mais confiável -- a confiança reprova
- `amostra` na procedência -- a sentinela e a assinatura reprovam
- Lápide antiga contando como conteúdo, ou `montar()` sem pular o vazio -- a costura reprova
- `export * from './ia/ranqueamento'` no `index.ts` -- o teste da ausência reprova
- Tirar `vo2max` ou `aneis` do mapa de saúde -- a concordância dos dois mapas reprova (desde a
  iteração 1 eles são uma rota só; a prova antiga, "`cadernoDaMetricaDeSaude` roteando a
  lápide", deixou de morder por desenho)
- Amostra da distância pelas atividades todas -- "Distância sem base" reprova
- Elevação com amostra -- "Elevação" reprova
- `POR_CONFIANCA` como `['B2','B3','B1']`, `['B3','B1','B2']` ou `['B3','B1']` -- as linhas
  de B2 da confiança reprovam (até a rodada 3, nenhum teste passava B2)
- Tirar só a comparação de `tipo`, ou só a de `fimISO`, do período misto -- a entrada inválida
  reprova
- Em `montar()`, filtrar o vazio antes de validar a lápide -- a paridade da lápide inválida no
  caderno vazio reprova

**Manual checks:**
- Nenhum. Sem superfície; a primeira tela é a 1.11.

## Suggested Review Order

**A ordem da edição**

- A entrada: os seis passos numa função pura; lápide na frente, vazio fora.
  [`ranqueamento.ts:207`](../../packages/shared/src/ia/ranqueamento.ts#L207)

- O líder do caderno: o maior afastamento entre os fatos que passam no portão.
  [`ranqueamento.ts:148`](../../packages/shared/src/ia/ranqueamento.ts#L148)

- Afastamento pela base mais confiável, nunca pela maior das três.
  [`ranqueamento.ts:118`](../../packages/shared/src/ia/ranqueamento.ts#L118)

- O portão: cobertura não desigual, nascimento e amostra ≥ 7.
  [`ranqueamento.ts:134`](../../packages/shared/src/ia/ranqueamento.ts#L134)

- N = 7 e os pesos, com a justificativa medida em produção.
  [`ranqueamento.ts:75`](../../packages/shared/src/ia/ranqueamento.ts#L75)

- Entrada inválida explode: caderno repetido ou desconhecido, período misto, lápide errada.
  [`ranqueamento.ts:176`](../../packages/shared/src/ia/ranqueamento.ts#L176)

**A amostra e o nascimento — só o ranqueamento lê**

- Dois campos obrigatórios no fato, fora do alfabeto e do prompt.
  [`pacote.ts:157`](../../packages/shared/src/ia/pacote.ts#L157)

- O menor lado da comparação; `null` quando não se sabe, e `null` não passa.
  [`pacote.ts:556`](../../packages/shared/src/ia/pacote.ts#L556)

- Hábito criado depois do início do anterior não é comparável.
  [`pacote.ts:587`](../../packages/shared/src/ia/pacote.ts#L587)

- A distância conta só atividades com distância — o achado da revisão 1.
  [`pacote.ts:805`](../../packages/shared/src/ia/pacote.ts#L805)

- O gasto conta só compras com preço — a mesma regra, revisão 2.
  [`pacote.ts:874`](../../packages/shared/src/ia/pacote.ts#L874)

- Onde as contagens nascem: com distância, com preço, data de criação.
  [`retro.ts:203`](../../packages/shared/src/period/retro.ts#L203)

- O lado anterior do `n` de saúde e notas.
  [`recap.ts:176`](../../packages/shared/src/week/recap.ts#L176)

- O início do anterior sai pelo mesmo caminho do rótulo.
  [`bounds.ts:155`](../../packages/shared/src/period/bounds.ts#L155)

**A lápide**

- Métrica e data, nada mais; entra se parou até o fim do período.
  [`pacote.ts:225`](../../packages/shared/src/ia/pacote.ts#L225)

- Validação com dono único: catálogo, calendário, fim do período, caderno.
  [`pacote.ts:1001`](../../packages/shared/src/ia/pacote.ts#L1001)

- "Do período" é o passo 5: lidera o mês, o trimestre e o ano.
  [`pacote.ts:1030`](../../packages/shared/src/ia/pacote.ts#L1030)

- O vazio com dono único: a lápide do período ressuscita, a antiga não.
  [`pacote.ts:1076`](../../packages/shared/src/ia/pacote.ts#L1076)

- As quatro do catálogo: nome sem dígito, verbo que concorda.
  [`cadernos.ts:261`](../../packages/shared/src/period/cadernos.ts#L261)

- VO₂max e anéis em Movimento também no mapa de saúde — uma rota só.
  [`cadernos.ts:202`](../../packages/shared/src/period/cadernos.ts#L202)

**O prompt**

- Valida toda lápide antes; pula o vazio nos dois grãos.
  [`prompt.ts:542`](../../packages/shared/src/ia/prompt.ts#L542)

- A do período no topo do bloco, as antigas no pé.
  [`prompt.ts:288`](../../packages/shared/src/ia/prompt.ts#L288)

- A frase da lápide, com a marca de quando parou.
  [`prompt.ts:259`](../../packages/shared/src/ia/prompt.ts#L259)

- Data por extenso no formato que a conferência já dispensa.
  [`prompt.ts:242`](../../packages/shared/src/ia/prompt.ts#L242)

- A lei: parágrafo próprio, nome por extenso, nada além de nome e data.
  [`prompt.ts:474`](../../packages/shared/src/ia/prompt.ts#L474)

**Periféricos**

- `isValidDate` mora com as datas locais; `todo/` só reexporta.
  [`local.ts:32`](../../packages/shared/src/date/local.ts#L32)

- A matriz da spec, uma `describe` por linha.
  [`ranqueamento.test.ts:159`](../../packages/shared/src/ia/ranqueamento.test.ts#L159)

- A costura: ordem e prompt leem o mesmo vazio.
  [`ranqueamento.test.ts:817`](../../packages/shared/src/ia/ranqueamento.test.ts#L817)

- O golden do celular, capturado no commit base, byte a byte.
  [`pacote.test.ts:1850`](../../packages/shared/src/ia/pacote.test.ts#L1850)

- A sentinela 777: amostra e lápide fora do alfabeto.
  [`pacote.test.ts:1732`](../../packages/shared/src/ia/pacote.test.ts#L1732)

- A ida e volta da lápide sobre as sete edições reais.
  [`verificar.test.ts:2219`](../../packages/shared/src/ia/verificar.test.ts#L2219)
