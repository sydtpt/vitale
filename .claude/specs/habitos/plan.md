# Plan: Habitos — contadores diários

> Plano técnico para [spec.md](./spec.md). Modelo de dados em [data-model.md](./data-model.md); tarefas em [tasks.md](./tasks.md).

## 1. Contexto técnico

| Item | Valor |
|------|-------|
| Mobile | Expo / React Native, Expo Router, **Zustand**, Reanimated 3, tokens de [theme](../../../mobile/src/theme/index.ts) |
| Web | Angular 20, standalone + OnPush, signals/`computed()`, `inject()`, SCSS + tokens `@vitale/shared` |
| Backend | Supabase (Postgres + Auth + RLS) — clients [mobile](../../../mobile/src/lib/supabase.ts) e [web](../../../web/src/app/core/supabase/supabase.client.ts) |
| Tabelas | `habits`, `habit_logs` (novas — ver [data-model.md](./data-model.md)) |
| Offline (mobile) | Fila local já existente em [sync-queue.ts](../../../mobile/src/lib/sync-queue.ts) / [local-store.ts](../../../mobile/src/lib/local-store.ts) |
| Gráficos (web) | **SVG à mão** (padrão do projeto, ver charts de [semana](../../../web/src/app/features/semana/components/)) — sem lib |
| Ícones | `IconComponent` web; MaterialCommunityIcons no mobile |
| Roteamento web | Lazy `loadComponent` em [main.ts](../../../web/src/main.ts) |

## 2. Constitution Check (convenções do projeto)

- ✅ **Mobile:** componentes funcionais + hooks; estado global em **Zustand** (`mobile/src/store/`); estilos com `StyleSheet.create()` usando tokens; animações com Reanimated.
- ✅ **Web:** standalone + OnPush; estado via `signal()`/`computed()`; `inject()`; SCSS com tokens, sem magic values.
- ✅ **Shared read-only:** `CounterHabit`/`HabitLog`/`HabitDirection` entram em `packages/shared` como **só campos**, sem lógica. O `Habit` binário **não muda**.
- ✅ **Supabase + RLS:** mesmas policies `auth.uid() = user_id` de `activities`; nenhuma exceção.
- ⚠️ **Reset diário** depende da **data local** — derivar `today` no cliente (não no servidor) e usar como `log_date`.

## 3. Arquitetura

```
Supabase (Postgres, RLS: user_id = auth.uid())
   habits        ── definição (CRUD)
   habit_logs    ── valor por (habit_id, log_date); rpc habit_log_add (soma atômica)
        ▲                                   ▲
        │ CRUD + leitura                    │ ＋/− (incremento) + leitura do dia
        │                                   │
  WEB  features/habitos/                  MOBILE
   ├── data/habits.store.ts (signal)        store/habits.store.ts (zustand)
   │     habits[], logs[], computeds          habits[], todayLogs{}, increment/decrement
   ├── pages/habitos-page                   app/(tabs)/index.tsx (Hoje)
   │     empty-state | grid de cards          └── <HabitStepper/> por hábito ativo
   │     análise: streak, média, heatmap    app/habitos/  (CRUD via Mais)
   └── components/                            ├── index (lista/arquivar)
         habit-analytics-card                 └── editor (criar/editar)
         habit-heatmap (SVG)                 components/cards/HabitStepper.tsx
         habit-editor (form CRUD)
```

**Princípio:** uma carga dos hábitos + logs alimenta o estado; valor do dia, progresso, streak e heatmap são **derivados**. O incremento grava **na hora** (rpc/upsert) e atualiza o estado local de forma otimista.

## 4. Decisões técnicas chave

### 4.1 Incremento atômico e reset diário
- `＋`/`−` chamam `rpc('habit_log_add', { p_habit, p_date: today, p_delta: ±step })` ([data-model §2](./data-model.md)) → soma no servidor com piso 0, devolve o novo valor. Update otimista no cliente; em erro, reverte.
- `today` = **data local** do dispositivo (`YYYY-MM-DD`). Reset diário é emergente: outro dia ⇒ outra `log_date` ⇒ valor 0 (sem job de reset).
- **Fallback sem RPC:** upsert por `(habit_id, log_date)` com `value` calculado no cliente (aceita pequena janela de corrida — um usuário).

### 4.2 Estado mobile (Zustand) — `store/habits.store.ts`
```ts
interface HabitsState {
  habits: CounterHabit[];
  todayLogs: Record<string /*habitId*/, number>;   // valor de hoje
  load(): Promise<void>;                            // habits ativos + logs de hoje
  increment(id: string): Promise<void>;             // +step (otimista + rpc)
  decrement(id: string): Promise<void>;             // -step, piso 0
  resetToday(id: string): Promise<void>;            // zera o dia
  // CRUD
  createHabit(input: NewHabit): Promise<void>;
  updateHabit(id: string, patch: Partial<CounterHabit>): Promise<void>;
  archiveHabit(id: string, active: boolean): Promise<void>;
}
```
- Offline: enfileira o delta em [sync-queue.ts](../../../mobile/src/lib/sync-queue.ts); reprocessa ao reconectar. Como o backend **soma deltas** (não grava valor absoluto), reaplicar a fila é seguro **se** cada item da fila for aplicado uma única vez (dedup por id de operação na fila).

### 4.3 Componente `HabitStepper` (mobile)
- Layout: `[−]` · centro (`valor / meta unit` + anel ou barra de progresso, Reanimated) · `[＋]`.
- `at_least`: barra/anel enche até `target`, continua destacado se passar (estado **batida**).
- `at_most`: barra mostra `value/target`; ao passar `target`, vira **alerta** (cor de erro). Sem `target`: só o número.
- Haptic no toque; long-press no `−` → confirma e `resetToday`.

### 4.4 Estado web (signals) — `features/habitos/data/habits.store.ts`
- `loadHabits()` + `loadLogs(rangeDays)` → `signal<CounterHabit[]>` + `signal<HabitLog[]>`.
- `computed()`: `analytics(habit)` = `{ valueToday, streak, average, heatmap[] }` ([data-model §4](./data-model.md)).
- CRUD: `create/update/archive` via Supabase, atualizando os signals.

### 4.5 Heatmap (web, SVG)
- `habit-heatmap`: grade de N dias (estilo GitHub), célula colorida por `isMet`/intensidade do `value` relativa à meta. Sem lib, no padrão dos charts de [semana](../../../web/src/app/features/semana/components/).

## 5. Contratos

### 5.1 SQL / Supabase
- **Criar:** `from('habits').insert({ name, icon, color, unit, step, target, direction, sort })` (RLS injeta `user_id`).
- **Listar (captura):** `from('habits').select('*').eq('active', true).order('sort')`.
- **Log de hoje:** `from('habit_logs').select('habit_id,value').eq('log_date', today)`.
- **Incrementar:** `rpc('habit_log_add', { p_habit, p_date: today, p_delta })` → `numeric` novo valor.
- **Zerar:** `from('habit_logs').update({ value: 0 }).eq('habit_id', id).eq('log_date', today)`.
- **Análise (web):** `from('habit_logs').select('habit_id,log_date,value').gte('log_date', since).order('log_date')`.

### 5.2 Tipos compartilhados
`CounterHabit`, `HabitLog`, `HabitDirection` em `@vitale/shared` ([data-model §3](./data-model.md)).

## 6. Fases de entrega

| Fase | Entrega | Histórias | Verificável |
|------|---------|-----------|-------------|
| **F0 — Schema + tipos** | Migration `habits`/`habit_logs` + RLS + `habit_log_add`; tipos no shared | infra | Tabelas existem; RLS isola; rpc soma com piso 0 |
| **F1 — Captura mobile** | `habits.store.ts` (zustand), `HabitStepper`, render na Hoje, incremento/reset persistidos (offline) | US1, US3 | SC-001, SC-002, SC-003, SC-006 |
| **F2 — CRUD mobile** | Tela `app/habitos/` (criar/editar/arquivar) + entrada no Mais | US2, US5 | SC-004; criar hábito aparece na Hoje |
| **F3 — Análise web** | `/habitos`, sidebar, `habits.store` (signals), cards de analytics + `habit-heatmap`, empty-state | US4 | SC-007 |
| **F4 — CRUD web** (opcional) | `habit-editor` no web (criar/editar/arquivar) | US2/US5 (web) | Paridade com mobile |

> F1 é o **MVP de uso diário** (depende só de F0). F2 destrava criar hábitos pelo app (até lá, semear via SQL/F4). F3 é só web. F4 é opcional (CRUD já existe no mobile).

## 7. Riscos e mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| **Reaplicar fila offline duplica incremento** | Valor do dia inflado | Backend soma **deltas**; dedup por id de operação na fila ([sync-queue.ts](../../../mobile/src/lib/sync-queue.ts)); aplicar cada item 1×, remover após confirmar |
| **Virada do dia / fuso** | Incremento cai no dia errado perto da meia-noite | `log_date` = data local no toque; documentar; virada configurável fica no backlog |
| **Ponto flutuante** (0,25 L) | Soma com erro de arredondamento | `numeric` no Postgres; no cliente, somar em passos do `step` (ou inteiros de ml) e arredondar na exibição |
| **Colisão de naming** `Habit` (binário) × contador | Confusão de tipos | `CounterHabit`/`HabitLog` separados; `Habit` binário intocado |
| **Toques rápidos concorrentes** | Perda de incremento | `habit_log_add` soma no servidor (atômico); update otimista no cliente |
| **Água mock duplicada** | Dois controles de água | Ao entrar F1, substituir o `water:number` da Hoje por hábito "Água" semente |

## 8. Dependências e pré-requisitos

- **Supabase Auth** já implementado ([auth.md](../auth.md)); RLS por `user_id`.
- **Supabase CLI** para versionar a migration em `supabase/migrations/`.
- Fila offline ([sync-queue.ts](../../../mobile/src/lib/sync-queue.ts)) reutilizada — sem nova infra de offline.
- F2/F4 dependem de F0; F1 depende de F0; F3 depende de F0 (e de ter algum log para análise).

## 9. Estratégia de testes

- **Unit (puro):** `isMet`/`isOver`/`streak`/`average`/`heatmap` — entrada `HabitLog[]` + config, saída determinística (ambas as direções; dias sem log).
- **Unit:** lógica de incremento/piso-0 e de dedup da fila offline.
- **Integração (dev):** com conta de teste, `＋` N vezes → conferir `value = N×step` no SQL; virar a data do dispositivo → valor zera e o dia anterior persiste; teste de RLS (dois usuários).
- **UI mobile:** `npm run mobile:ios` — stepper soma/subtrai, estado batida/alerta, long-press zera, offline + reconectar.
- **UI web:** `npm run web:dev` — empty-state, cards de analytics, heatmap conferindo com SQL.
