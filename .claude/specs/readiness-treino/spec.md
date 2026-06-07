# Spec: Readiness → Treino — prontidão acionável

> **Feature:** `readiness-treino` · **Status:** 🔧 implementada (web; recomendação) · **Data:** 2026-06-06

## 1. Por quê (problema)

O score de prontidão já é calculado por [`computeReadiness`](../../../packages/shared/src/health/readiness.ts) (sono + FC repouso + VFC + anéis) e exibido como donut no [day-score-card](../../../web/src/app/features/semana/components/day-score-card.component.ts) da Semana. Mas o número é **inerte**: não diz o que fazer com ele. Um 42 e um 88 produzem a mesma tela.

**Objetivo:** transformar o score numa **recomendação curta** para o dia, cruzando a prontidão com a **intensidade do treino planejado** — liberar quando está pronto, sugerir aliviar quando está baixo num dia forte, confirmar quando o dia já é leve/descanso.

## 2. Decisões de produto (fechadas)

| Decisão | Escolha | Implicação |
|---------|---------|------------|
| Escopo | **Só web (Semana)** | Reusa o score já exibido; sem captura nova |
| Fonte do treino do dia | **`TREINOS_SEMANA[TODAY_IDX]`** (mock) | Treino real ainda não existe; o `classifyWorkout` isola a dependência → troca trivial quando houver dado real |
| Faixas do score | **<50 baixa · 50–69 moderada · ≥70 alta** | Limiares fixos, sem config |
| Intensidade do treino | **força / endurance / leve / descanso / nenhum** | `rest` > `run`(endurance) > `vol>0`(força) > `dur>0`(leve) |
| Sem dados de saúde | **orientação neutra** | Não inventa conselho; pede sincronizar a Saúde |
| Onde aparece | **banner no `day-score-card`** | Abaixo do donut, acima do rodapé explicativo; cor por tom |

## 3. Matriz de recomendação

| Prontidão \ Dia | Forte (força/endurance) | Leve | Descanso |
|---|---|---|---|
| **Baixa (<50)** | ⚠️ aliviar/trocar por mobilidade (`caution`) | priorizar sono (`rest`) | confirma recuperação (`rest`) |
| **Moderada (50–69)** | seguir, monitorar esforço (`neutral`) | adequado (`neutral`) | adequado (`neutral`) |
| **Alta (≥70)** | ✅ ir com tudo (`go`) | pode puxar mais (`go`) | dá p/ adiantar treino leve (`go`) |

Tom → cor: `go` verde · `caution` laranja · `rest` azul · `neutral` terra (alinhado ao design system / `MOD`).

## 4. Histórias de usuário

### US1 — Recomendação do dia (P1) 🎯 MVP
Como usuário, quero uma frase curta dizendo se devo encarar ou aliviar o treino de hoje, com base na minha prontidão.

**Cenários de aceite**
- **Dado** prontidão 42 e um dia de força ("Pernas — Volume"), **então** vejo aviso de cautela citando o treino e sugerindo aliviar.
- **Dado** prontidão 88 e um dia de força, **então** vejo liberação ("vá com tudo").
- **Dado** prontidão 60 e dia de endurance, **então** vejo orientação neutra ("monitore o esforço").
- **Dado** que não há dados de saúde sincronizados, **então** vejo orientação neutra pedindo sincronizar — nunca um conselho inventado.

## 5. Fora de escopo

- Push/lembrete da recomendação (depende de notificações).
- Reescrever o treino planejado automaticamente (só sugere).
- Cruzar com carga semanal de FC (ver [carga-semanal](../carga-semanal/spec.md)) — futura fusão "carga × prontidão".
