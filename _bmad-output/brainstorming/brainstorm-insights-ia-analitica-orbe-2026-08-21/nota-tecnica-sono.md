# Nota técnica — detalhamento do sono (estágios + latência de início)

**Data:** 2026-08-21 · **Origem:** sessão de brainstorming *insights de IA analítica no Orbe* (`.memlog.md` desta pasta)
**Escopo:** workspace `mobile` · **Status:** implementado, validado, **não commitado**

Arquivos tocados:

- `mobile/src/lib/health-buckets.ts` — `Sample.stages`, `subtractIntervals`, `STAGE_PRIORITY`, `aggregateSleepNights`
- `mobile/src/lib/health-aggregate.ts` — `aggregateSleep`
- `mobile/src/services/health-sync.ts` — `AGG_VERSION`
- `mobile/src/lib/__tests__/health-sleep.test.ts` — 13 testes novos

---

## 1. O que mudou e por quê

Duas mudanças incrementais, na mesma trilha, feitas em sequência dentro da sessão.

### (a) Detalhamento do sono por estágio

`aggregateSleepNights` **já lia** as fases do HealthKit (`CORE`/`DEEP`/`REM`/`AWAKE`) para
calcular o total dormido, e **já as colapsava** em um único número de horas antes de
devolver a noite. A informação existia em memória e era jogada fora no caminho para o
banco — lacuna já registrada como v2 em `docs/specs/mobile-saude.md`.

Agora cada noite sai também com `stages: Record<string, number>` (horas por estágio), e
`aggregateSleep` (em `health-aggregate.ts`) soma esses estágios por dia e grava o mapa no
campo `extra jsonb` de `health_daily` — coluna que já existia e já era usada por outras
métricas (pressão arterial, anéis). Quando a noite não traz estágio nenhum, `extra` fica
`null` em vez de virar um objeto vazio.

Motivação analítica: 7h de sono com 20min de REM e 7h com 1h40 de REM eram **a mesma
linha no banco**.

### (b) Tempo na cama e latência para pegar no sono (`inbed` / `onset`)

O `INBED` do HealthKit era lido e **descartado de propósito**: `toIntervals` só casava
`CORE`/`DEEP`/`REM`/`AWAKE`/`ASLEEP`, e havia até um teste (`'ignora "na cama" (INBED)'`)
fixando esse comportamento. A intenção original era correta — tempo na cama não é tempo
dormido e não pode entrar no total. Mas junto com ele foi embora o **único sinal de
insônia de início** disponível no dado.

Isso importa porque a insônia do usuário é justamente a de início (demora para pegar no
sono) — o único dos três tipos (início / manutenção / terminal) que **não deixa rastro nas
fases**: a noite sai curta mas "limpa", com as horas rolando na cama invisíveis.

`aggregateSleepNights` agora ancora no trecho `INBED` que **cobre o instante em que se
apagou** (`bed.start <= onset && bed.end >= onset`; o `>=` no fim aceita fontes que
encerram o `INBED` no próprio adormecer) e deriva duas chaves:

- `inbed` — duração total do trecho na cama;
- `onset` — `primeiro instante dormindo − início do INBED`, gravado só quando é positivo.

O teste que prova o valor: duas noites de **4h dormidas idênticas**, uma com
`onset = 2h30` e outra sem latência nenhuma. Antes eram a mesma linha.

---

## 2. A invariante e por que ela existe

```
deep + rem + core + unspecified = value
```

`awake`, `inbed` e `onset` ficam **deliberadamente fora da soma**: `awake` é WASO (métrica
à parte), e `inbed`/`onset` descrevem a janela da noite, não o sono. O teste guarda isso
explicitamente com o conjunto `NOT_ASLEEP = {awake, inbed, onset}` e o helper
`asleepStages()`, comparado contra `value` em praticamente todo caso do arquivo.

**Mecanismo de prioridade.** O Apple Health aceita várias fontes escrevendo o mesmo
período, e elas podem discordar do estágio do mesmo minuto (Watch diz `DEEP` 23:00→01:00,
Garmin diz `CORE` 00:00→02:00). `STAGE_PRIORITY = ['DEEP', 'REM', 'CORE']` resolve o
conflito fatiando o tempo: cada estágio, na ordem, reivindica via `subtractIntervals` só o
que os anteriores — e o `AWAKE`, que nem é sono — ainda não reivindicaram. O tempo dormido
que sobra sem hipnograma por baixo vira `unspecified`. Assim a soma **fecha** com o total
em vez de estourá-lo.

**Por que a invariante existe neste repo.** A agregação de sono já produziu dois bugs em
produção, ambos por dupla contagem de fontes sobrepostas (o pior chegava a ~2× o real, e
foi o que motivou o `AGG_VERSION` v1: união de intervalos + priorização da fonte detalhada
sobre o `ASLEEP` genérico + atribuição da noite ao dia em que se acordou). O detalhamento
por estágio é exatamente o tipo de mudança que reabre essa classe de erro em outra
dimensão. A invariante é a barreira que impede o terceiro.

---

## 3. Efeito do backfill

`AGG_VERSION` foi de **2 → 3** (estágios) e **3 → 4** (inbed/onset) na mesma sessão.

O mecanismo, em `health-sync.ts`: o cursor local guarda a versão da agregação com que o
dispositivo sincronizou. Se `cursor.version < AGG_VERSION`, `needsBackfill` liga e a janela
do ciclo passa de `SYNC_DAYS` (14) para `BACKFILL_DAYS` (**500 dias**). Esse backfill não
apenas preenche buracos — ele **reprocessa e sobrescreve** o histórico já gravado, via o
RPC idempotente `sync_upsert_health_daily`. Funciona porque as amostras cruas continuam no
HealthKit do aparelho: a fonte de verdade nunca foi o `health_daily`, que é derivado.

Consequência prática: assim que o app rodar no device, **todo o histórico de sono ganha
estágios e latência retroativamente**, sem migration e sem intervenção manual. É o que
sustenta o reframe da sessão — gaps do relógio são recuperáveis; gaps de contexto humano
(motivo de streak quebrado, dia atípico, RPE) são perdidos a cada dia que passa.

**Limite conhecido, que não afeta o sono:** `HEAVY_METRICS = {'fc'}` corta a janela de
frequência cardíaca em `HEAVY_MAX_DAYS = 60` mesmo durante o backfill (puxar FC crua de um
ano é caro demais). Ou seja, recuperação retroativa de FC tem teto de 60 dias; sono,
peso, passos e as demais métricas vão aos 500. Vale registrar porque é o tipo de assimetria
que engana na hora de interpretar uma série histórica.

O cursor só avança se **todos** os lotes subiram (`failed.length === 0`); um push parcial
mantém a versão antiga e o backfill é tentado de novo no ciclo seguinte.

---

## 4. O que verificar ao rodar no device

- **Buraco por volta de 31/07/2026 é real, não é bug.** O usuário ficou 3-4 dias sem
  relógio. A ausência de hipnograma nesse trecho é ausência de dado na origem — não é falha
  do sync nem da ponte Garmin → Apple Health. Não investigar como regressão.
- **Dias sem hipnograma não somem: viram `unspecified`.** Fonte que só grava o `ASLEEP`
  genérico (iPhone, aparelho antigo, relógio fora do pulso) produz uma noite com o total
  correto e `stages.unspecified` igual ao total. Um `extra` com só `unspecified` é
  esperado, não erro. `extra` só sai `null` quando a noite não trouxe estágio algum.
- **`onset` só aparece se a fonte gravar `INBED`**, e só quando a latência é positiva.
  Ausência de `onset` significa uma de três coisas — fonte não grava `INBED`, adormeceu
  imediatamente, ou o `INBED` não cobre o instante do adormecer — e as três são
  indistinguíveis pelo campo. Não tratar ausência como zero.
- **Conferir a invariante em dados reais:** para algumas noites, checar que
  `deep + rem + core + unspecified ≈ value` e que `inbed >= value`. Divergência aí é sinal
  de fonte nova se comportando fora do modelo.
- **Comparar totais com o app Saúde da Apple** depois do backfill, para garantir que a
  fatia por prioridade não mudou o `value` de nenhuma noite (não deveria: `value` continua
  vindo da união de intervalos menos `AWAKE`, exatamente como antes).

---

## 5. Estado de validação

- `tsc --noEmit` limpo no workspace mobile.
- **392/392** testes passando (386 após a mudança (a); 392 após a (b) — 7 + 6 testes novos
  em `health-sleep.test.ts`).
- **Não commitado.** As quatro alterações estão apenas na working tree.
- Sem migration: `extra jsonb` já existia em `health_daily`. Nada a aplicar em produção.
