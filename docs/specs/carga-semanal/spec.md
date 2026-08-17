# Spec: Carga Semanal — agregação de zonas de FC

> **Feature:** `carga-semanal` · **Status:** 🔧 em implementação (web; análise) · **Data:** 2026-06-06

## 1. Por quê (problema)

O tempo em cada zona de FC já é derivado no sync e gravado em [`activities.hr_zones`](../../../packages/shared/src/models/index.ts#L201-L206) (402/403 treinos populados). Hoje esse dado **só é exibido por treino** ([activity-detail-page](../../../web/src/app/features/workout-history/pages/activity-detail-page.component.ts#L72-L88)) — não há nenhuma visão **agregada** que responda "como ficou minha carga e intensidade esta semana?".

Sem agregação semanal, o usuário não enxerga:
- **Polarização** — quanto do volume foi fácil (Z1–Z2) vs forte (Z4–Z5). O modelo 80/20 recomenda volume majoritariamente leve.
- **Tendência de carga forte** — acúmulo de tempo em alta intensidade semana a semana, sinal precoce de overtraining.

**Objetivo:** um card **"Carga semanal"** na página de Histórico de Treinos que empilha o tempo por zona de FC nas últimas N semanas, mostra a polarização da semana atual e alerta quando a carga forte sobe muito acima da linha de base.

## 2. Decisões de produto (fechadas)

| Decisão | Escolha | Implicação |
|---------|---------|------------|
| Escopo | **Só web (análise)** | Reusa dado já sincronizado; nenhuma captura nova no mobile |
| Janela | **Últimas 8 semanas** (seg–dom) | Janela móvel; suficiente para tendência sem poluir |
| Unidade do gráfico | **Tempo (s → h)** por zona | Reusa formatação `duration` do [StackedBarChartComponent](../../../web/src/app/features/workout-history/components/stacked-bar-chart.component.ts) |
| Fonte das cores | **`HR_ZONES`** do shared | Zona = segmento; cor já definida (frio→quente) |
| Polarização | **Leve = Z1+Z2 · Forte = Z4+Z5** | Z3 é "zona cinza", fica fora dos dois lados; mostra-se % leve da semana atual |
| Alerta de carga | **Z4+Z5 da semana > 1,5× baseline** | Baseline = média das semanas anteriores na janela (exclui a atual). Heurística pura, sem config |
| Treinos sem FC | **Ignorados** | `hrZones` ausente/vazio não entra na soma; não quebra |

## 3. Usuários e plataforma

- Usuário único autenticado; dados via [`ActivitiesStore`](../../../web/src/app/features/workout-history/data/activities.store.ts) (fetch único em memória, `activities` já exclui ocultas).
- **Web (Angular)** = análise. Card novo na [workout-history-page](../../../web/src/app/features/workout-history/pages/workout-history-page.component.ts), abaixo da Visão Geral.
- Sem migration, sem novo modelo no shared — só derivação + UI.

## 4. Histórias de usuário (priorizadas)

### US1 — Ver tempo por zona nas últimas 8 semanas (P1) 🎯 MVP
Como usuário, quero um gráfico de barras empilhadas (uma por semana) com o tempo total em cada zona de FC, para enxergar minha carga e distribuição de intensidade ao longo do tempo.

**Cenários de aceite**
- **Dado** treinos com `hr_zones` nas últimas 8 semanas, **quando** abro o Histórico, **então** vejo 8 barras (seg–dom), cada uma empilhando Z1…Z5 com a cor do `HR_ZONES`, e o eixo em horas.
- **Dado** uma semana sem treino com FC, **quando** ela cai na janela, **então** aparece como barra vazia (mantém o eixo do tempo).
- **Dado** um treino sem amostras de FC (`hrZones` ausente), **quando** agrego, **então** ele não contribui para nenhuma zona.

### US2 — Ver a polarização da semana atual (P1) 🎯 MVP
Como usuário, quero ver que % do meu tempo na semana foi leve (Z1–Z2), para saber se estou treinando majoritariamente fácil.

**Cenários de aceite**
- **Dado** a semana atual com tempo nas zonas, **quando** vejo o card, **então** leio "X% leve" (Z1+Z2 ÷ total da semana) e o tempo absoluto leve vs forte.
- **Dado** uma semana sem nenhum tempo em zona, **quando** vejo o card, **então** a polarização mostra estado vazio (sem divisão por zero).

### US3 — Ser alertado de carga forte crescente (P2)
Como usuário, quero um aviso quando meu tempo em alta intensidade (Z4+Z5) da semana sobe muito acima das semanas anteriores, para reduzir risco de overtraining.

**Cenários de aceite**
- **Dado** baseline de Z4+Z5 das semanas anteriores e a semana atual > 1,5× esse baseline, **quando** vejo o card, **então** aparece um aviso ("Carga forte acima do habitual — considere recuperar").
- **Dado** menos de 2 semanas com dado de FC na janela, **quando** avalio, **então** **não** há alerta (baseline insuficiente).

## 5. Fora de escopo

- Captura/edição no mobile.
- Configuração de FCmáx/FCrep por usuário (zonas vêm prontas do sync).
- Cruzamento com readiness/sono (feature seguinte — ver §1 do brainstorm: A1).
