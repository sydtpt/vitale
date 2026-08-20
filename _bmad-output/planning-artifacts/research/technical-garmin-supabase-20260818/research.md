# Deep Recon — piloto BMAD: Fitness mobile via Supabase + Garmin Venu 4

## Decisão

A pergunta técnica central não é “a app consegue ler treino do Supabase?” — ela já consegue. O problema real é: “quais métricas do Garmin Venu 4 precisam ser tratadas como dados de primeira classe, e como evitar cair num stub do Apple Health que omite rota, HR stream e VFC/VO₂max/SpO₂?”

## Evidência do repositório

### 1) O pipeline de sync HealthKit → Supabase já existe

- `mobile/src/services/activity-sync.ts` monta o fluxo: coleta treinos, rota GPS, HR zones, best efforts, sincronização incremental, filas offline.
- `mobile/src/store/fitness.store.ts` já usa `syncType`, `syncDelta` e `hydrateSyncedTypes` para controlar inscrição (`syncedTypes`) por tipo de treino.
- As tabelas/contratos do backend foram pensadas para esse fluxo em `docs/specs/sync-atividades/data-model.md`.

### 2) A classificação por tipo de treino já é modelada e testada

- `packages/shared/src/fitness/activity-types.ts` define os tipos HealthKit canônicos, `GPS_ACTIVITY_IDS`, `ENDURANCE_IDS`, `STRENGTH_IDS`, `EASY_IDS` e `kindForActivity`.
- O contrato manda que os conjuntos sejam disjuntos, com teste em `packages/shared/src/fitness/activity-types.test.ts`.

### 3) O código já reconhece que Garmin via HealthKit é um stub pobre

- `packages/shared/src/fitness/dedupe.ts` documenta que o mesmo treino pode chegar por mais de um caminho: Apple Watch → HealthKit; Garmin → HealthKit (stub sem rotae/FC densa); Garmin → Strava/intervals.icu.
- Isso reforça a hipótese de que a infraestrutura atual cobre o caso “Apple Health + ponte Garmin”, mas não o caso “Garmin completo” sem suplementação.

### 4) O que o app ainda não faz no piloto

- A aba Fitness do mobile ainda é alimentada localmente por `HealthKit`, não por um consumo mais direto do Supabase para a visão do usuário final, conforme a nota do deferred-work.
- O estado de dados que o Garmin não grava em Apple Health exige um tratamento explícito: VFC, VO₂max, SpO₂, rota GPS e stream de FC.

## Conclusão técnica

O stack atual tem três blocos funcionalmente prontos:

1. leitura/normalização de treinos locais;
2. upload para Supabase com rotas e zonas de FC;
3. deduplicação e classificação por tipo/ intensidade.

O que ainda falta é a camada de “fonte de verdade Garmin”, não a infraestrutura de sincronização em si. Em outras palavras, o sistema já sabe sincronizar; ele ainda não sabe como preencher dados que o HealthKit não entrega quando a origem é Garmin.

## Recomendações de implementação

### Opção recomendada: “Supabase como fonte de leitura + suplemento Garmin fora do HealthKit”

Adicionar um caminho de ingestão para dados vindos de Garmin Connect/Strava/intervals.icu quando o HealthKit produzir apenas um stub. Fluxo:

- manter a UX do app lendo do Supabase;
- em `activities`, priorizar a linha com melhor riqueza de dados;
- para treinos Garmin sem rota/FC densa, complementar via `activity_routes` + `hr_zones` + campos de meta (VO₂max/VFC/SpO₂) quando disponíveis;
- marcar a fonte e a qualidade do dado para não misturar “stub HealthKit” com “dado completo Garmin”.

### Por que esta é a melhor opção

- respeita o padrão já implementado de sync push-only do HealthKit;
- reusa modelagem de `activities`, `activity_routes`, `synced_activity_types` e dedupe;
- reduz risco de reescrever a camada de leitura do app sem resolver o problema da fidelidade dos dados.

## Riscos principais

- Dados distintos da mesma sessão chegam em múltiplas fontes e precisam ser deduplicados sem perder riqueza.
- O Garmin pode registrar uma “atividade” no HealthKit sem escrever o stream completo de FC, rota ou métricas extras. Sem distinção entre stub e dados finos, a tela dá a impressão de que a fonte está completa quando não está.
- A decisão de como mapear `Remo`, `Caminhada`, `HIIT` e similares deve ser tratada como decisão de produto, não como detalhe técnico, porque a classificação impacta a jornada e o matching com treinos planejados.

## Próximo passo operacional

1. Validar o contrato de dados no Supabase para VFC, VO₂max, SpO₂ e rota GPS.
2. Implementar a camada de “suplemento Garmin” em vez de só guardar o stub do HealthKit.
3. Trocar a tela de Fitness para consumir os dados do Supabase no mesmo formato da store atual.
4. Cobrir os casos de regressão com testes em shared/mobile para garantir que `GPS_ACTIVITY_IDS` e `kindForActivity` continuem disjuntos e corretos.

## Arquivos relevantes

- `mobile/src/services/activity-sync.ts`
- `mobile/src/store/fitness.store.ts`
- `packages/shared/src/fitness/activity-types.ts`
- `packages/shared/src/fitness/dedupe.ts`
- `docs/specs/sync-atividades/data-model.md`
- `_bmad-output/implementation-artifacts/deferred-work.md`
