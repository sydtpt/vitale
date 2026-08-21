# Intent — Insights de IA analítica no Orbe

> Destilado da sessão de brainstorming de 2026-08-21. Input para a fase de análise
> (spec / PRD / product brief). Contém apenas decisões e descobertas; não descreve o percurso.

## 1. Escopo e timing

O usuário está na **fase de criação/coleta de features do "super app pessoal"**. Chat com IA e
auto-análise por LLM são a **feature principal do futuro — explicitamente não agora**.

O motivo não é "IA é prematura". É assimetria de recuperabilidade:

- **Gaps do relógio são recuperáveis.** As amostras cruas sobrevivem no HealthKit (e nos provedores
  Strava/intervals.icu). O `health-sync.ts` já tem o mecanismo: bump de `AGG_VERSION` dispara backfill
  de até 500 dias e reprocessa o histórico com a agregação nova.
- **Gaps de contexto humano são perdidos para sempre.** Por que o streak quebrou, se o dia foi atípico,
  qual foi o RPE — nada disso tem fonte crua a que voltar. Cada dia sem instrumentação é dado morto.

**Conclusão de escopo: a instrumentação de contexto é o que tem prazo; a camada de IA não.**
O trabalho de agora é logar/estruturar para não fechar portas de análise futura.

## 2. Decisões travadas

| Tema | Decisão |
|---|---|
| Congelado vs. vivo | **Análise de treino é congelada no momento do save**, baseada apenas no histórico até aquele dia. **Retrospectiva é dinâmica**, recalculada a cada recorrência (mais dados a cada semana/mês). |
| Privacidade | **Não é bloqueio.** Qualquer dado pode ir para API externa desde que anonimizado. Strava/intervals.icu já são precedente de dado saindo hoje. |
| Barra de qualidade do insight de treino | Nada de "bom treino". O insight precisa cruzar **tempo, distância, rota GPS, frequência cardíaca E dados do dia** (sono, humor). |
| Instrumentação — backlog confirmado | **Motivo relâmpago quando um streak quebra** (viagem/doença/preguiça/lesão) e **flag universal de "dia atípico"** (doente/viajando/evento) aplicável a todos os módulos do dia. |
| Gap do relógio a atacar | Apenas **fases do sono**; o resto vira backlog anotado. |

### Já implementado nesta sessão (não commitado)

1. **Fases do sono** — `health-buckets.ts` (`Sample.stages`, `subtractIntervals`, `STAGE_PRIORITY`
   deep>rem>core), `health-aggregate.ts` (`aggregateSleep` → `extra` jsonb), `AGG_VERSION` 2→3.
   Invariante: `deep+rem+core+unspecified = total dormido`; `awake` fica **fora** da soma (é WASO).
2. **Latência de início do sono** — `INBED` deixou de ser descartado; `stages` ganha `inbed`/`onset`
   (fora da soma). `AGG_VERSION` 3→4.

Contexto que motivou (2): a insônia do usuário é do **tipo 1 (início — demora para pegar no sono)**,
o único dos três tipos que não deixa rastro nas fases. Duas noites de 4h dormidas eram a mesma linha
no banco, uma com `onset=2h30` e outra sem latência.

## 3. Divisão de trabalho: estatística × LLM

`triggerImpact` (no shared, consumido por `retro.ts`) **já calcula correlações de forma determinística
e gratuita**. O que falta não é achar o número — é decidir qual dos N números merece o topo do card.

> **Estatística acha; LLM prioriza e narra.** Não é escolha entre os dois: são posições diferentes
> no pipeline.

Isso também limita o risco de correlação espúria: o dataset é de uma pessoa e poucos meses, e a LLM
não deve ser a peça que calcula ou afirma causalidade.

## 4. Ranking por superfície, não global

Cada tela tem um trabalho diferente e portanto um ranking próprio:

- **Tela da manhã:** sono + dia anterior + foco do dia à frente. (A latência de início é justamente o
  número que falta nessa tela.)
- **Retrospectiva:** critério de ranking **ainda a decidir**.

**Consequência estrutural:** a lista única ordenada por `priority` em `retro.ts` tem o **formato
errado, não só os pesos**. Hoje `priority = |deltaPct| + 3` compete na mesma lista com gasto e
tarefas, então "R$ 340 em compras" (priority 40) enterra "sono −10% nos dias com cerveja" (priority 13).

## 5. Diferencial competitivo

O Morning Report do Garmin é bom, mas **só enxerga dados do relógio**. É cego para hábitos, tarefas,
gastos, ratings subjetivos e metas.

> Garmin diz "recuperação baixa". O Orbe pode dizer **por quê**.

A vantagem não é o dado do relógio — é o **contexto de vida**. A instrumentação de contexto
(motivo do streak, dia atípico, dose, hora exata) não é dívida técnica: é o fosso, a única coisa que
um relatório de relógio estruturalmente nunca terá.

## 6. Gaps confirmados no código

### Correlação (`retro.ts:669-690` → `triggerImpact`)

A correlação **já existe**; está estrangulada por quatro limites:

1. Só a métrica **sono** (com fallback para VFC); nenhuma outra métrica é testada.
2. Só hábitos com `bad=true` e registros entram como gatilho — **hábito bom e treino nunca são testados**.
3. Dois portões: `>=3` dias de cada lado **e** `|deltaPct| >= 5%`.
4. O pior: `priority` numa lista única compartilhada com gasto/tarefas (ver §4).

Além disso, a correlação **roda numa direção só** (gatilho → sono); nunca **sono → desempenho do dia
seguinte**.

Com `onset`/`awake`/estágios agora em `extra`, o mesmo motor pode cruzar gatilho × **latência**
("nos dias com cerveja você demora +40% para pegar no sono") — muito mais acionável que "sono −6%".

### Captura e persistência (health)

- **Granularidade:** tudo que vai para `health_daily` vira **1 linha agregada/dia** (soma/média/min/max),
  nunca amostra intradiária. Decisão intencional documentada em `health-aggregate.ts`.
- **Macros:** carboidrato e gordura são lidos e **descartados no persist** (`case 'macros': return []`);
  só proteína sobrevive. Corrigir exige reestruturar `macrosFetch`, que hoje pré-soma o período inteiro
  com timestamp `now` — mais trabalho que o caso do sono.
- **FC de treino:** a curva segundo-a-segundo vira apenas 5 zonas agregadas (`hr_zones`); a forma da
  curva se perde.
- **Backfill de FC** é limitado a 60 dias (`HEAVY_METRICS`/`HEAVY_MAX_DAYS`) — teto menor que o das
  demais métricas.
- **Cadência e potência** não são pedidas a ninguém (nem HealthKit, nem streams Strava/intervals.icu),
  embora ambas as APIs suportem.
- **Perfil estático** (idade/sexo biológico/tipo sanguíneo) nunca é persistido. Avaliado como o de
  **menor valor analítico**: não varia, e o único uso real (`max_hr`) já é configurado à mão em
  `user_preferences`.
- **Deleção de treino no relógio nunca propaga** para o banco; `activities` só é ocultável manualmente
  (`hidden`).
- **Arquitetura:** há 2 capturas (HealthKit direto no mobile + ingest server-side Strava/intervals.icu)
  e 2 leituras (ao vivo em Saúde/Fitness; histórica via Supabase em Histórico/web), desacopladas.

### Ressalva de dados

O buraco no hipnograma em 31/07 é **ausência real de dado** (3–4 dias sem relógio), não falha de sync
Garmin→Apple Health. Não tratar como bug nem como outlier a explicar.

## 7. Explicitamente fora de escopo agora

- Chat com IA e auto-análise por LLM (feature principal do **futuro**).
- Decisão de stack/modelo/provedor. Custo foi considerado desprezível (usuário único; a caber em plano
  gratuito tipo Firebase/Gemini), mas **não foi verificado** — é questão aberta, não decisão.
- Todos os gaps do relógio **exceto fases do sono + latência de início**: macros completos,
  cadência/potência, curva de FC, propagação de deleção, perfil estático.
- Rankeamento da retrospectiva (critério ainda a decidir); apenas o **formato** da lista única está
  julgado como errado.

### Catálogo de instrumentação (levantado, não decidido)

Fora dos dois itens confirmados em §2, ficaram catalogadas sem decisão: timestamp de hora exata em
logs manuais; chip de contexto em 1 toque ao logar hábito ruim; RPE por evento (a divergência entre
métrica objetiva e sensação percebida **é** o insight); timing relativo na alimentação; tag de gatilho
emocional em gastos por impulso; dose/intensidade em vez de binário.

### Autorização permanente do usuário

O usuário autorizou trazer o tema "o que logar hoje para não fechar portas de análise futura"
espontaneamente em conversas futuras, não apenas nesta sessão.
