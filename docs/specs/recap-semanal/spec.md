# Spec: Recap Semanal — resumo automático da semana

> **Feature:** `recap-semanal` · **Status:** 🔧 implementada (web; análise) · **Data:** 2026-06-06

## 1. Por quê (problema)

A página **Semana** abre com stats chamativas, mas hoje são **hardcoded** (`"Semana 21 · 18 — 24 maio"`, big-stats fixos, gasto via `FINANCAS` mock). Não há um resumo da semana derivado de **dado real** que mostre evolução vs a semana anterior.

**Objetivo:** um card **"Resumo da semana"** no topo da Semana que agrega o que já é real e populado — atividades (HealthKit) e saúde (`health_daily`) — comparando esta semana com a anterior, com hábitos/registros entrando só quando há dado.

## 2. Decisões de produto (fechadas)

| Decisão | Escolha | Implicação |
|---------|---------|------------|
| Fontes | **Só dado real**: atividades + `health_daily` (+ hábitos/registros condicional) | Finanças, lifts e runs são mock → **fora** até virarem reais |
| Comparação | **Esta semana vs anterior** (seg–dom) | Delta com sinal e tom (melhorou/piorou/estável) |
| Treinos | count · distância · tempo · calorias (soma) | "Mais" é positivo (verde ao subir) |
| Saúde | média de **FC repouso, VFC, Sono** | Polaridade: FC repouso ↑ = pior; VFC/Sono ↑ = melhor |
| Hábitos/registros | contagem por semana, **só se houver evento** | Cada gatilho vira uma linha com Δ; some quando vazio |
| Estável | Δ relativo **< 2%** | Tratado como neutro (evita ruído de variação mínima) |
| Seções vazias | **ocultas** | Card nunca mostra seção alimentada por nada |

## 3. Histórias de usuário

### US1 — Resumo da semana (P1) 🎯 MVP
Como usuário, quero abrir a Semana e ver, num card, como foi minha semana vs a anterior em treino e saúde.

**Cenários de aceite**
- **Dado** treinos nesta e na semana anterior, **então** vejo tiles de nº de treinos, km, tempo e calorias, cada um com a variação vs anterior.
- **Dado** médias de FC repouso/VFC/sono na semana, **então** vejo cada uma com a média e o delta colorido pela polaridade (FC repouso subindo = vermelho).
- **Dado** um hábito-ruim ou registro com eventos na semana, **então** aparece uma linha com a contagem e a variação; **sem** eventos nas duas semanas, a linha some.
- **Dado** que não há nenhum dado real na janela, **então** o card mostra estado vazio — nunca números inventados.

## 4. Arquitetura

- Derivação pura [`weekly-recap.ts`](../../../web/src/app/features/semana/data/weekly-recap.ts): `activityRecap`, `metricRecap`, `countRecap`, `weekBounds`/`weekLabel`. Sem dependência de store.
- Componente [`weekly-recap-card`](../../../web/src/app/features/semana/components/weekly-recap-card.component.ts): injeta `ActivitiesStore` + `HealthStore` + `HabitsStore` + `RegistrosStore`; renderiza seções condicionais. No topo da Semana, antes das stats mock.
- Sem migration, sem modelo novo.

## 5. Fora de escopo

- Finanças no recap (depende de transações reais — hoje mock).
- Recordes novos (PRs batidos na semana) — exige detecção de "melhor de todos os tempos atingido nesta janela".
- Recap mensal e push notification do recap (futuros).
- Substituir as big-stats mock do topo (este card coexiste; limpeza do mock fica para depois).
