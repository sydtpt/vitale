# Spec: Ratings diários subjetivos — Sono (ao acordar) + Dia (janela noturna)

> **Feature:** `daily_ratings` · **Status:** ✅ implementação inicial (mobile captura + web/mobile agregação) · **Data:** 2026-06-07

## 1. Por quê (problema)

O app captura dados "duros" (HealthKit, hábitos contadores, registros binários, treinos),
mas não captura **percepção subjetiva**: como a pessoa *sente* a própria noite de sono e o
dia como um todo. Esse sinal é deliberadamente **desacoplado** dos outros dados — é a leitura
da pessoa, não uma derivação de métricas.

**Objetivo:** na tela **Hoje** do mobile, registrar com um toque:
1. **Qualidade do sono (1–5)** — ao acordar (card só aparece a partir das 06h).
2. **Qualidade do dia (1–5)** + **anotação opcional** — ao fim do dia, na janela noturna
   (22h–04h59). Na madrugada (00h–04h59) o card avalia/grava o **dia anterior**.

E revisitar isso em **agregações** semanais/mensais: recap web, gráfico de tendência web (30
dias) e destaques da Semana mobile.

## 2. Decisões de produto (fechadas)

| Decisão | Escolha | Implicação |
|---------|---------|------------|
| Escala | **1–5, pílulas numeradas** com cor graduada (vermelho→verde) | Combina com o design system; neutro/analítico |
| Captura | **Só mobile** (tela Hoje) | Alinha com "mobile = captura rápida"; web é só análise |
| Sono | Card no topo da Hoje, **só com `getHours() >= 6`**, visível até preencher e depois colapsa em chip | "Ao acordar"; reabre ao toque p/ corrigir |
| Dia | Card no fim da Hoje, **janela noturna 22h–04h59** (`getHours() >= 22 \|\| getHours() < 5`) | "Fim do dia"; na madrugada grava o dia anterior (label "Como foi ontem?") |
| Anotação | **Texto livre opcional** no rating do dia | Ex.: "dia corrido mas produtivo" |
| Acoplamento | **Nenhum** — valor 100% subjetivo | Não deriva de sono HealthKit nem de prontidão |
| Persistência | **Supabase** — `daily_ratings`, 1 linha por `(user, dia)` | Sono e dia moram juntos; upsert por campo; RLS por usuário |
| Agregação | Reusa `metricRecap` do `@vitale/shared` | Sem lógica nova; média semana vs. anterior |

## 3. Entidades-chave

- **DailyRating** (`packages/shared/src/models/index.ts`) — `day` (YYYY-MM-DD local),
  `sleepQuality` (1–5 | null), `dayQuality` (1–5 | null), `dayNote` (string | null).
- Tabela `daily_ratings`: PK `(user_id, day)`, `check between 1 and 5`, trigger `updated_at`,
  RLS `auth.uid() = user_id`. Migration `supabase/migrations/20260607130000_daily_ratings.sql`.

## 4. Requisitos funcionais

- **FR-001** O usuário DEVE poder dar nota 1–5 ao **sono** na Hoje (**a partir das 06h**); persiste e colapsa em chip.
- **FR-002** O usuário DEVE poder dar nota 1–5 ao **dia** + anotação opcional, na **janela 22h–04h59**;
  resposta na madrugada (00h–04h59) é atribuída ao **dia anterior**.
- **FR-003** Cada campo é **upsert independente** na mesma linha do dia (`onConflict: user_id,day`),
  com update otimista e revert em erro.
- **FR-004** Reset pela **data local**: novo dia começa em branco; dias anteriores ficam no histórico.
- **FR-005** RLS: cada usuário só lê/escreve as próprias linhas.
- **FR-006** O **recap web** DEVE mostrar média X,X/5 de sono e dia vs. semana anterior (tom: subir = bom).
- **FR-007** O **gráfico web** DEVE plotar tendência de 30 dias (duas séries, escala 1–5).
- **FR-008** A **Semana mobile** DEVE incluir sono/dia percebidos nos destaques quando houver dado.

## 5. Arquivos

| Camada | Arquivo |
|---|---|
| Migration | `supabase/migrations/20260607130000_daily_ratings.sql` |
| Shared | `packages/shared/src/models/index.ts` (`DailyRating`) |
| Mobile store | `mobile/src/store/daily-ratings.store.ts` |
| Mobile UI | `components/ui/RatingPills.tsx`, `components/cards/SleepRatingCard.tsx`, `DayRatingCard.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/semana.tsx` |
| Web store | `web/src/app/features/semana/data/daily-ratings.store.ts` |
| Web UI | `components/weekly-recap-card.component.*`, `components/ratings-trend-card.component.*`, `pages/semana-page.component.*` |

## 6. Fora de escopo / Backlog

- Captura no web.
- Notificações/push lembrando de preencher (sono de manhã, dia à noite).
- Mais de um rating por dia, ou outras dimensões subjetivas (energia, estresse, humor).
- Correlação automática entre sono/dia percebidos e métricas duras (HealthKit, treino).
- Edição retroativa de dias anteriores.
