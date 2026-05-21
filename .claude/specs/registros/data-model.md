# Data Model: Registros — marcação diária de atividades avulsas

> Esquema novo (não reusa `habits`/`todo_*`). Segue o padrão de RLS/`touch_updated_at`
> de [habitos](../../../supabase/migrations/20260520140000_habitos.sql).

## 1. Tabelas (migration nova)

Arquivo `supabase/migrations/20260521130000_registros.sql`:

```sql
-- registros — definição do item avulso
create table if not exists public.registros (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  name       text        not null,
  icon       text,                                   -- nome do ícone (HABIT_ICONS)
  color      text,                                   -- token do design system (MOD)
  module     text        not null default 'geral'
               check (module in ('financas','compras','casa','saude','geral')),
  active     boolean     not null default true,
  sort       int         not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists registros_user_active_idx on public.registros (user_id, active, sort);

-- registro_logs — marca binária por dia (1 linha por registro/dia)
create table if not exists public.registro_logs (
  id          uuid        primary key default gen_random_uuid(),
  registro_id uuid        not null references public.registros(id) on delete cascade,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  log_date    date        not null,                  -- data LOCAL do dispositivo
  created_at  timestamptz not null default now(),
  unique (registro_id, log_date)                     -- idempotência: 1×/dia
);
create index if not exists registro_logs_user_date_idx     on public.registro_logs (user_id, log_date desc);
create index if not exists registro_logs_registro_date_idx on public.registro_logs (registro_id, log_date desc);
```

| Coluna `registros` | Tipo | Uso |
|---|---|---|
| `module` | `text` (check) | Categoria/cor — mesmo conjunto de `TodoModule` |
| `icon` | `text` | Nome do ícone canônico (`HABIT_ICONS`) |
| `color` | `text` | Token `MOD` (accent/tint) |
| `active` | `boolean` | `false` = arquivado (some da captura, mantém histórico) |
| `sort` | `int` | Ordem na captura |

`registro_logs` é **append/delete**, não atualiza valores ⇒ sem `updated_at`/trigger nem RPC:
- **Marcar hoje:** `insert (registro_id, user_id, log_date) on conflict do nothing`.
- **Desmarcar hoje:** `delete where registro_id = :id and log_date = :today`.
- O `unique (registro_id, log_date)` garante "1×/dia" mesmo com toques concorrentes.

## 2. Tipos no shared

Em [@vitale/shared](../../../packages/shared/src/models/index.ts). Só campos, sem lógica.
Reusa `TodoModule` (mesmo conjunto das tarefas).

```ts
/** Registro — atividade avulsa marcada como feita num dia (sem meta/recorrência). */
export interface Registro {
  id: string;
  name: string;
  icon: string;        // nome do ícone (HABIT_ICONS)
  color: string;       // token MOD
  module: TodoModule;  // categoria/cor
  active: boolean;
  sort: number;
  createdAt: string;   // ISO
}

/** Marca diária de um Registro (1 por registro/dia). Mapeia `registro_logs`. */
export interface RegistroLog {
  id: string;
  registroId: string;
  logDate: string;     // 'YYYY-MM-DD' (data local)
}
```

## 3. Derivações (sem persistência)

Computadas no cliente sobre os logs da janela — nenhuma coluna derivada no banco:

- **doneToday(registro):** existe linha com `log_date = hoje` (local).
- **countInWindow(registro):** nº de dias marcados na janela carregada.
- **lastDone(registro):** maior `log_date` marcado (ou null). "Há N dias" = `daysBetween(lastDone, hoje)`.
- **heatmap(registro, days):** série dos últimos N dias com flag marcado/não.

## 4. Migration (ordem)

1. `create table registros` + índice.
2. `create table registro_logs` (unique `(registro_id, log_date)`) + índices.
3. Trigger `touch_updated_at` em `registros` (função já existe de migrations anteriores).
4. `enable row level security` + policies `own registros` / `own registro_logs`.
