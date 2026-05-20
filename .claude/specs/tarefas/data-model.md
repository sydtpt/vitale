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
  | { kind: 'stock'; shopItemRef?: string };

interface TodoTemplate {
  id; name; icon; color; module; recurrence;
  overdue; cancelPolicy; meter?; meterAtLastDone?;
  active; sort; createdAt;
}
interface TodoOccurrence {
  id; templateId; dueDate: string | null; status;
  doneAt?; meta?: Record<string, unknown>; createdAt;
}
```

## Tabelas (Supabase) — `supabase/migrations/20260520160000_tarefas.sql`

- **`todo_templates`**: `recurrence jsonb`, `overdue`/`cancel_policy`/`module` text com `check`,
  `meter`/`meter_at_last_done numeric`, RLS por `user_id`, trigger `touch_updated_at`.
- **`todo_occurrences`**: `template_id` FK cascade, `due_date date` nullable, `status` text com `check`,
  `done_at`, `meta jsonb`. **Unique parcial** `(template_id, due_date) where due_date is not null`
  → geração idempotente. Índices `(user_id, status, due_date)` e `(template_id, due_date desc)`.
- **RPC `todo_resolve(p_occ, p_status, p_meta)`** `security invoker`: seta status + `done_at`
  (idempotente por id). A geração da próxima ocorrência é feita no cliente.

## Lógica pura — `mobile/src/lib/todo-logic.ts` (espelhado na web)

- `firstDueDate(rec, today)` — primeira data (inclusiva); `after_completion` começa hoje; none/usage/event/stock → null.
- `nextDueDate(rec, occDueDate, completedAt)` — próxima após resolver. Âncora: calendário em `occDueDate`,
  `after_completion` em `completedAt`.
- `isOverdue(occ, today)` / `daysLate(occ, today)` — pendente vencida e dias de atraso.
- `dueUsage(template)` — `meter - meterAtLastDone >= every`.
- `reconcileTemplate(t, occ, today)` → ações `{create|expire}`: expira vencidas (`expire`),
  gera a próxima de calendário quando não há corrente/futura, mantém vencidas (`carry`). **Idempotente.**

Coberto por `mobile/src/lib/__tests__/todo-logic.test.ts` (23 casos).

## Geração de ocorrências (regras)

- **Criação da série:** `none` → 1 ocorrência sem data; calendário/`after_completion` → primeira data;
  `usage`/`event`/`stock` → nenhuma (esperam gatilho).
- **Ao resolver (done/skip/cancel):** gera a próxima via `nextDueDate` (null para none/usage/event/stock);
  `usage` done atualiza `meter_at_last_done`.
- **No load:** `reconcile` expira vencidas/gera próximas de calendário.
- **Idempotência:** inserts ignoram violação de unicidade (`23505`).
