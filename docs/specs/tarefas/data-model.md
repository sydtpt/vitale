# Tarefas — Modelo de dados

## Tipos (shared) — `packages/shared/src/models/index.ts`

```ts
type TodoModule = 'financas' | 'compras' | 'casa' | 'saude' | 'geral';
type TodoCancelPolicy = 'none' | 'manual' | 'auto';
type TodoOverduePolicy = 'carry' | 'expire';
type TodoStatus = 'pending' | 'done' | 'skipped' | 'canceled' | 'expired';

type TodoRecurrence =
  | { kind: 'none' }
  | { kind: 'monthly'; day: number }
  | { kind: 'weekly'; weekdays: number[] }          // 0=dom … 6=sáb (getDay)
  | { kind: 'yearly'; month: number; day: number }  // month 1..12
  | { kind: 'after_completion'; intervalDays: number }
  | { kind: 'usage'; meterUnit: string; every: number }
  | { kind: 'event'; label: string }
  | { kind: 'stock'; shopItemRef?: string }
  | { kind: 'on_workout'; activityId?: number; dueInDays?: number };

interface TodoSpawnRule {
  templateId: string;                                   // série-filha a instanciar
  ifPending: 'ignore' | 'duplicate';                    // já tem pendente?
}

interface TodoTemplate {
  id; name; icon; color; module; recurrence;
  overdue; cancelPolicy; meter?; meterAtLastDone?;
  linkedActivityId?; onComplete?: TodoSpawnRule[];
  triggerOnly?: boolean;                                // só nasce por gatilho
  startDate?: string;                                   // 'YYYY-MM-DD' — "a partir de": série oculta antes desse dia (null = Agora)
  startTime?: string;                                   // 'HH:MM' — ocorrência do dia só aparece a partir daqui
  endTime?: string;                                     // 'HH:MM' — após o horário no dia, cancela automaticamente
  meta?; active; sort; createdAt;
}
interface TodoOccurrence {
  id; templateId; dueDate: string | null; status;
  doneAt?; meta?: Record<string, unknown>; createdAt;
}
```

## Tabelas (Supabase) — `supabase/migrations/20260520160000_tarefas.sql`
## Encadeamento — `supabase/migrations/20260527130000_todo_on_complete.sql`
## Janela de horário — `supabase/migrations/20260603120000_todo_time_window.sql` (`start_time`/`end_time text`)
## "A partir de" — `supabase/migrations/20260625120000_todo_start_date.sql` (`start_date date`)

- **`todo_templates`**: `recurrence jsonb`, `overdue`/`cancel_policy`/`module` text com `check`,
  `meter`/`meter_at_last_done numeric`, `on_complete jsonb` (lista de `TodoSpawnRule`),
  RLS por `user_id`, trigger `touch_updated_at`.
- **`todo_occurrences`**: `template_id` FK cascade, `due_date date` nullable, `status` text com `check`,
  `done_at`, `meta jsonb`. **Unique parcial** `(template_id, due_date) where due_date is not null`
  → geração idempotente. Índices `(user_id, status, due_date)` e `(template_id, due_date desc)`.
- **RPC `todo_resolve(p_occ, p_status, p_meta)`** `security invoker`: seta status + `done_at`
  (idempotente por id). A geração da próxima ocorrência é feita no cliente.

## Lógica pura — `mobile/src/lib/todo-logic.ts` (espelhado na web)

- `firstDueDate(rec, today, startDate?)` — primeira data (inclusiva); `after_completion` começa na âncora; none/usage/event/stock → null. `startDate` futuro vira a âncora (a primeira data não retroage antes do "a partir de").
- `isStarted(t, today)` — "a partir de": `false` antes de `startDate` (série oculta em todos os baldes), `true` a partir dele (inclusive) ou sem `startDate`. Aplicado no filtro-base das listas (web + mobile Hoje/Tarefas).
- `nextDueDate(rec, occDueDate, completedAt)` — próxima após resolver. Âncora: calendário em `occDueDate`,
  `after_completion` em `completedAt`.
- `isOverdue(occ, today)` / `daysLate(occ, today)` — pendente vencida e dias de atraso.
- `dueUsage(template)` — `meter - meterAtLastDone >= every`.
- `reconcileTemplate(t, occ, today, now)` → ações `{create|expire|cancel}`: cancela pendentes
  que passaram do `endTime` (precede expire/carry; suprime o `create` de calendário no mesmo passe,
  pois o avanço do cancel gera a próxima), expira vencidas (`expire`), gera a próxima de calendário
  quando não há corrente/futura, mantém vencidas (`carry`). **Idempotente.**
- `localTimeStr()` / `isValidTime(s)` — hora local `'HH:MM'` e validação.
- `isVisibleNow(t, occ, today, now)` — exibição: esconde a ocorrência do dia antes do `startTime`.
- `isPastEnd(t, occ, today, now)` — pendente com data cujo dia/horário (`endTime`) já passou.

### Dia lógico (virada às 02h)

Todo `today`/`now` das tarefas é o **dia lógico**, não a data do calendário:

- `TODO_ROLLOVER_HOUR = 2` — hora da virada.
- `todoDayStr(d?)` → `'YYYY-MM-DD'`: antes das 02h locais devolve o dia anterior.
- `todoTimeStr(d?)` → `'HH:MM'` no mesmo relógio: 00:30 vira `'24:30'`, 01:45 vira `'25:45'`.
  Mantém a comparação por string com `startTime`/`endTime` (≤ `'23:59'`) válida na
  madrugada — sem isso, um `endTime` de 22h "voltaria a valer" à meia-noite.
- `msUntilTodoRollover(now?)` — ms até a próxima virada; as stores agendam re-load nela.

Os defaults das funções acima já usam os dois; quem chama passa `todoDayStr()`/`todoTimeStr()`
(nunca `localDateStr`/`localTimeStr`). O mesmo vale para o dia de conclusão (`completedAt`,
`fireOnComplete`) e para os filtros de "concluídas hoje". Hábitos, refeições e treinos
continuam na data do calendário — só o módulo de tarefas (incluindo Compras) vira às 02h.

Coberto por `mobile/src/lib/__tests__/todo-logic.test.ts` (23 casos) e, para a virada,
`packages/shared/src/todo/day.test.ts` (16 casos).

## Geração de ocorrências (regras)

- **Criação da série:** `none` → 1 ocorrência sem data; calendário/`after_completion` → primeira data;
  `usage`/`event`/`stock`/`on_workout` → nenhuma (esperam gatilho).
  **Exceção:** `triggerOnly=true` pula a criação inicial em qualquer recurrence.
- **Ao resolver (done/skip/cancel):** gera a próxima via `nextDueDate` (null para
  none/usage/event/stock/on_workout); `usage` done atualiza `meter_at_last_done`.
- **Encadeamento (done):** `fireOnComplete` percorre `template.onComplete`; cria ocorrência
  da filha com `dueDate = completedAt`. `ifPending: 'ignore'` pula se já há pendente.
- **No load:** `reconcile` expira vencidas/gera próximas de calendário.
- **Idempotência:** inserts ignoram violação de unicidade (`23505`).
