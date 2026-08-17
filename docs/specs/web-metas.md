# Spec: Web — Metas (`/metas`)

## Objetivo

Metas **anuais que se contabilizam sozinhas** a partir de dados que já existem no app
(atividades HealthKit, tarefas concluídas, hábitos) ou informadas à mão. Ex.: "correr
ao menos 1x/mês", "1 meia-maratona no ano", "comer banana 1x/semana", "ler 12 livros".

## Status: ✅ v1 implementado (leitura/contabilização) · 🔧 nudge = fase 2

O progresso é **derivado** por `evaluateGoal` (shared) — nunca persistido. A tabela `goals`
guarda só a definição. Aplicação da migration `20260701120000_goals.sql` é manual.

## Modelo de domínio

`Goal` (shared, `packages/shared/src/models/index.ts`) — mapeia a tabela `goals`:

- `family`: como mede progresso
  - `cadence`    → "≥N por período" ao longo do ano (períodos cumpridos / total)
  - `milestone`  → marco único no ano (limiar / best-effort / contagem)
  - `cumulative` → soma no ano até um alvo
- `source` (`GoalSource`): de onde vem o sinal
  - `activity` — contagem / distância / best-effort (`bestEfforts["half"]` p/ meia-maratona)
  - `task` — conta occurrences `done` de um `TodoTemplate`
  - `habit` — conta dias que bateram a meta de um hábito contador
  - `manual` — valor digitado (`manualCurrent`)
- `period` + `perPeriodTarget` (só cadence): sub-período (semana|mês) e mínimo por período
- `target`: interpretado pela família (períodos a cumprir / total anual / limiar)
- `unit`, `year`, `cat` (token de módulo p/ cor), `active`, `sort`

Avaliação: `evaluateGoal(goal, ctx) → GoalProgress { current, target, pct, achieved,
periodsTotal?, periodsMet?, currentPeriodMet?, periods? }` — pura, testada em
`packages/shared/src/goals/evaluate.test.ts` (rodar: `cd packages/shared && npx tsx src/goals/evaluate.test.ts`).

## Camada web

- **Store**: `web/src/app/features/metas/data/goals.store.ts` (Injectable + signals).
  Busca metas + fontes do ano (ocorrências `done`, `habit_logs`); atividades e definições
  de hábito reusam `ActivitiesStore`/`HabitsStore`. `progressById` deriva via `evaluateGoal`.
- **Formatação**: `web/src/app/features/metas/data/goal-format.ts` (texto atual/alvo por família;
  distância em km; marco binário como Concluída/Pendente). Reusado pela página e pelo preview da Semana.
- **Página**: `metas-page.component` — grid de cards (título, família·ano, valor, barra, badge
  de concluída), filtro por categoria (`selectedCat`/`filtered`), botão "Nova meta". Metas de
  **cadência** ainda exibem o detalhamento por sub-período (`GoalProgress.periods`): 12 células
  de mês rotuladas — ou faixa de semanas — coloridas por estado (cumprido / não cumprido / mês
  atual / futuro), via `goalPeriodCells` em `goal-format.ts`.
- **Editor**: `goal-editor.component` — modal com família + fonte (dropdown de atividade /
  tarefa / hábito / manual), período/mínimo (cadence) e alvo (milestone/cumulative).
- **Preview Semana**: `MetasListComponent` (`features/semana/components/lists.component.ts`)
  consome o `GoalsStore` — lista compacta de progresso real.

## Fase 2 — "nudge" (meta cria a própria tarefa)

Quando o prazo de um sub-período aperta (ex.: faltam N dias no mês e a cadência não foi
batida), a meta cria uma tarefa acumulável no to-do (aparece no mobile). Config por meta:
`nudge { leadDays, templateId }`. Cria via `resolveAndAdvance` (herda offline + ponte
corrida→tarefa) e cancela nudges obsoletos na virada do período.

**Lacuna de modelo**: Tarefas tem `carry` (acumula pra sempre) OU `expire` (some ao passar do
dia); falta "acumula até uma data-limite futura". Saída preferida: a reconciliação da própria
meta expira o nudge na virada do período (sem tocar no schema de Tarefas).

## Próximos passos
- [ ] Fase 2: nudge + tela/entrada de Metas no mobile
- [ ] Histórico de progresso por meta (linha do tempo)
- [ ] Confetti ao atingir 100%
- [ ] Conversão de unidade mais rica no editor (ex.: alvo em km/min)
