# Spec: Correlações de Gatilho — hábito-ruim/registro × saúde

> **Feature:** `correlacoes-gatilho` · **Status:** 🔧 implementada (web; análise) · **Data:** 2026-06-06

## 1. Por quê (problema)

A Saúde já tem um card de **Correlações** ([saude-page](../../../web/src/app/features/saude/pages/saude-page.component.ts)), mas é **Pearson entre duas séries contínuas** de `health_daily` (ex.: Sono × FC repouso) via [`correlate`](../../../packages/shared/src/health/trends.ts) do shared. Não há nada que cruze um **gatilho comportamental** — um hábito-ruim ([`CounterHabit.bad`](../../../packages/shared/src/models/index.ts#L35-L49) com `HabitLog`) ou um [`Registro`](../../../packages/shared/src/models/index.ts#L317-L333) (álcool, pizza) — contra a saúde.

Esse cruzamento é o diferencial: o app é o único lugar que tem hábito-ruim + métricas do Apple Health na mesma base. A pergunta de produto é **"o que afeta meu bem-estar?"** — ex.: "dias com álcool: FC repouso +6 bpm, VFC −15%".

**Objetivo:** um card na Saúde que, para um gatilho escolhido, compara a **média** de métricas de bem-estar nos dias **com** o gatilho vs nos dias **sem**.

## 2. Decisões de produto (fechadas)

| Decisão | Escolha | Implicação |
|---------|---------|------------|
| Tipo de análise | **Diferença de médias (com × sem)** | Gatilho é evento categórico por dia, não série contínua → distinto do `correlate` Pearson existente |
| Gatilhos | **Hábitos-ruins (`bad`) + Registros** | Hábito: dia conta se `value > 0`; Registro: dia conta se marcado |
| Métricas de bem-estar | **FC repouso, VFC, Sono** | Presentes em `health_daily` (confirmado). Polaridade fixa: FC repouso ↑ = pior; VFC/Sono ↑ = melhor |
| Universo de dias | **Dias com valor da métrica, desde `createdAt` do gatilho** | Não compara com período em que o gatilho nem existia |
| Amostra mínima | **≥ 3 dias de cada lado** | Abaixo disso, "dados insuficientes" — não conclui de 1–2 dias |
| Causalidade | **Só associação** | Rodapé deixa explícito: observacional, não prova causa |

## 3. Histórias de usuário

### US1 — Ver o impacto de um gatilho (P1) 🎯 MVP
Como usuário, quero escolher um hábito-ruim ou registro e ver como minhas métricas de bem-estar mudam nos dias em que ele acontece.

**Cenários de aceite**
- **Dado** um hábito-ruim "Álcool" com ≥3 dias marcados e ≥3 sem, **quando** seleciono, **então** vejo, por métrica, a média sem → com, o delta com sinal e a contagem de dias.
- **Dado** que o delta piora a métrica (FC repouso sobe / VFC ou sono caem ≥2%), **então** o delta aparece em vermelho; se melhora, verde; se ~igual, neutro.
- **Dado** um gatilho com <3 dias de um dos lados, **quando** seleciono, **então** a métrica mostra "dados insuficientes" com a contagem — sem número enganoso.
- **Dado** que não há hábitos-ruins nem registros, **então** o card não aparece.

## 4. Arquitetura

- Derivação pura [`trigger-impact.ts`](../../../web/src/app/features/saude/data/trigger-impact.ts): `triggerImpact(metric, eventDays, valuesByDay, sinceDate)` → médias/delta/contagens/`enough`. Reusa `mean` do shared.
- Componente [`trigger-impact-card`](../../../web/src/app/features/saude/components/trigger-impact-card.component.ts): injeta `HealthStore` + `HabitsStore` + `RegistrosStore`, monta gatilhos, deixa selecionar e renderiza as linhas. Renderizado na Saúde após o card de Correlações.
- Sem migration, sem modelo novo.

## 5. Fora de escopo

- Significância estatística (p-valor / teste t) — só média e contagem por ora.
- Lag temporal (efeito no dia seguinte).
- Cruzar com readiness diário composto (extensão futura — exige montar inputs de readiness por dia no histórico).
