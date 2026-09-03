# 0026 — A VFC do intervals.icu entra na mesma métrica do Apple Health

**Status:** aceita
**Data:** 2026-09-04

## Contexto

A VFC parou de chegar em 17/07/2026. O Garmin Venu virou o relógio de dormir, e o Garmin **não escreve HRV no Apple Health** — o `HKQuantityTypeIdentifierHeartRateVariabilitySDNN` só vem do Apple Watch. A prontidão (`packages/shared/src/health/readiness.ts`) seguiu rodando com 75% da informação; foi para isso que `coverage` passou a existir, mas medir o buraco não o fecha.

O Garmin manda a VFC noturna para o intervals.icu, e o conector do intervals.icu já roda a cada 15 minutos pela edge function `connections-ingest` — só não pedia esse dado. O endpoint `GET /athlete/{id}/wellness?oldest&newest` devolve um registro por dia com `hrv` (o RMSSD que o Garmin calcula) e, quando a fonte informa, `hrvSDNN`.

As duas fontes medem coisas diferentes. O Apple Watch grava **SDNN** (desvio padrão dos intervalos RR, amostrado ao longo do dia); o Garmin reporta **RMSSD** (raiz da média dos quadrados das diferenças sucessivas, medido durante o sono). Para a mesma pessoa e a mesma noite os números não coincidem — o RMSSD costuma sair mais baixo, e a razão entre eles varia com a pessoa.

Tudo que consome VFC hoje chaveia em `health_daily.metric = 'vfc'`: a prontidão, as tendências de 30/90 dias, o recap semanal, a retrospectiva, as correlações de gatilho e os cards de Saúde dos dois apps. Todos comparam o valor de hoje com a **própria baseline** (média móvel de 7 leituras), nunca com uma tabela externa de "VFC normal".

## Decisão

**A VFC do intervals.icu é gravada em `health_daily` sob a mesma métrica `'vfc'`**, com a origem no `extra`:

```json
{ "source": "intervals", "kind": "rmssd" }
```

`kind` é `'sdnn'` quando o registro traz `hrvSDNN` e `'rmssd'` quando só há `hrv`. `count` é 1, e `min_value`/`max_value` repetem o valor — é uma medida por noite.

**O Apple Health tem precedência.** O passo só grava no dia **sem linha `'vfc'`** ou cuja linha já tem `extra.source === 'intervals'`. Uma linha do Apple Health (sem `extra.source`, porque `aggregateDiscrete` não grava `extra`) nunca é tocada por este caminho. O RPC do mobile, `sync_upsert_health_daily`, continua sobrescrevendo incondicionalmente — se o Watch voltar a medir um dia que o intervals já preencheu, o Watch vence no próximo sync, que é o desejado.

**Janela de 14 dias por run; 120 dias na primeira vez** do usuário (nenhuma linha `'vfc'` com `source = 'intervals'`). Datas locais sem fuso, como o fetch de atividades, com `newest` em amanhã para absorver a diferença entre o fuso do atleta e o UTC do runtime.

**Best-effort.** O passo roda depois das atividades e antes de avançar o cursor; nunca lança. Erro vai para `summary.wellness.error`, e atividades, cursor, `last_error` e `status` seguem como se ele não existisse.

**A normalização e a janela são puras, no núcleo** (`packages/shared/src/health/wellness.ts`), sem imports — a function Deno importa por caminho relativo, como faz com `fitness/dedupe.ts`. A function só busca e grava.

**O mobile ganha um fallback, não uma leitura nova.** O cartão de prontidão lê as summaries do HealthKit em memória; quando não há `'vfc'` na janela de 7 dias, `buildReadinessInput` cai para as linhas `'vfc'` de `health_daily` da mesma janela, com a mesma regra de último valor + baseline móvel de 7. Quem já lê a tabela (Semana, Recuperação, o web inteiro) vê a VFC sem mudar nada.

## Alternativas rejeitadas

**Métrica nova (`'vfcRmssd'`).** É a resposta "correta" para duas escalas. Perde: cada consumidor de VFC — prontidão, tendências, recap, retro, correlações, catálogo de métricas, dois apps — teria de aprender a segunda métrica e a regra de qual usar quando, e o histórico ficaria partido em duas séries que nunca se comparam. O buraco desde 17/07 continuaria no `'vfc'` que todo mundo lê. A separação que essa alternativa daria já está disponível em `extra.kind` se algum dia for necessária.

**Converter RMSSD em SDNN antes de gravar.** Não existe fator universal; a razão depende da pessoa e do momento da medição (noite × dia). Um fator calibrado no histórico do usuário seria uma estimativa disfarçada de medida, e `extra.kind` deixaria de dizer a verdade sobre a coluna.

**Deixar o intervals sobrescrever o Apple Health.** Simplifica o passo (um upsert cego), mas inverte a hierarquia das fontes: o Watch, quando mede, mede SDNN — a escala do histórico. E o dedupe multi-fonte ([ADR 0004](0004-dedupe-multi-fonte-do-healthkit.md)) existe justamente para uma métrica não ter dois donos no mesmo dia.

**Trazer também sono e FC de repouso do `/wellness`.** Estão no mesmo registro, a um campo de distância. O Apple Watch cobre os dois com estágios e amostras de verdade, e misturar fontes é o problema que o dedupe resolve. Uma fonte só entra onde a outra não chega.

**Integração Garmin direta (Garmin Connect API).** Exige credenciamento de desenvolvedor, OAuth, migration, UI de vínculo e uma quinta edge function — para um dado que já chega pela ponte existente.

## Consequências

**Duas escalas numa coluna.** É o que esta ADR existe para registrar. Enquanto uma fonte só medir por vez, a série é internamente consistente e a prontidão compara com a própria baseline. O risco é o **degrau**: se o Watch voltar ao pulso à noite, os dias passam a SDNN e a baseline de 7 leituras fica misturada por uma semana — a prontidão leria a troca de escala como mudança fisiológica.

A revisão mostrou que isso não é hipótese distante: basta o relógio medir uma noite no meio da semana, porque a precedência dá aquele dia ao Apple e os outros seis à ponte. Então a mitigação **foi implementada junto**, e não adiada: `latestAndBaselineFromRows` monta a baseline só com as leituras que têm o mesmo `extra.kind` da leitura mais recente, e sem par do mesmo tipo devolve baseline nula — o componente sai do score e `coverage` diz que faltou. Vale só para a prontidão. Os demais consumidores de `'vfc'` (retrospectiva, tendências, recap, correlações) continuam lendo a série crua e vão narrar o degrau como fisiologia; está registrado como trabalho diferido.

**Os dois apps podem discordar sobre o mesmo dia.** Quem lê `health_daily` — o web inteiro, a Semana e a Recuperação do mobile — vê a VFC da ponte assim que ela é gravada. A aba Saúde do mobile lê só o HealthKit, então segue sem VFC; e a Hoje só a alcança pelo fallback do cartão de prontidão. É consequência direta de manter o escopo mobile no cartão, e some quando a aba Saúde passar a ler a tabela.

**Uma corrida possível entre as duas fontes.** O passo lê as linhas existentes e faz o upsert em seguida; um sync do mobile que grave uma linha do Apple nesse intervalo é sobrescrito. O próximo sync do mobile a restaura, porque o RPC sobrescreve sem condição. Aceito por ser janela de milissegundos com correção automática.

**A tabela passa a ter dois escritores.** `data/health-daily.ts` continua sendo só leitura; a escrita do intervals acontece na edge function com service role, filtrando `user_id` como todo o resto do ingest.

**O deploy é manual** (`supabase functions deploy connections-ingest`) e fica fora do fluxo de código, como as outras functions. Até o deploy, nada muda em produção.

**Reverter** é apagar o passo e as linhas com `extra->>'source' = 'intervals'` — a marca está em cada linha, então a limpeza é um `delete` só.
