# Plan: Sincronização de Atividades

> Plano técnico para [spec.md](./spec.md). Schema detalhado em [data-model.md](./data-model.md); tarefas em [tasks.md](./tasks.md).

## 1. Contexto técnico

| Item | Valor |
|------|-------|
| Origem dos dados | Apple HealthKit (`react-native-health`) — iOS apenas |
| Backend | Supabase (Postgres + Auth + RLS) — `@supabase/supabase-js@2` já instalado |
| Cliente mobile | `mobile/src/lib/supabase.ts` (já configurado, SecureStore adapter) |
| Estado mobile | Zustand (`mobile/src/store/fitness.store.ts`) |
| Auth | Já implementado — `auth.store.ts`, sessão Supabase com `user.id` |
| Fila offline | Persistência local (AsyncStorage / SecureStore) — **a adicionar** |
| Inscrição por tipo | Conjunto de tipos opt-in, persistido (servidor + cache local) — **a adicionar** |
| Background | Observer/background delivery do HealthKit (entitlement `healthkit.background-delivery` **já habilitado** no `app.json`); âncora incremental via `getAnchoredWorkouts`, com push filtrado aos tipos inscritos |

## 2. Constitution Check (convenções do projeto)

Confronto com as regras de `CLAUDE.md`:

- ✅ **Mobile state via Zustand** — sync vive em store + camada de serviço; sem novas libs de estado.
- ✅ **Shared models read-only** — adicionar `Activity`/`ActivityRoute` como *interfaces* em `packages/shared` (sem lógica).
- ✅ **Estilos com tokens** — qualquer UI de status reusa `colors`/`MOD.treino`/`spacing`.
- ✅ **Sem servidor próprio** — Supabase como BaaS, alinhado com [backend.md](../backend.md) (opção B) e [auth.md](../auth.md).
- ⚠️ **Risco a observar:** lógica de mapeamento/sync NÃO deve ir para `packages/shared` (proibido lógica de negócio lá). Fica em `mobile/src/services` e `mobile/src/lib`.

Resultado: **sem violações.** O shared recebe só tipos.

## 3. Arquitetura

```
HealthKit (iOS, fonte da verdade)
        │  ① toque no botão do tipo  → backfill por tipo (data range, 3 anos)
        │  ② observer (bg + fg)      → getAnchoredWorkouts(anchor) → added[]/deleted[]
        ▼
mobile/src/services/activity-sync.ts        ← orquestra o ciclo
        │  FILTRO: só tipos inscritos (syncedTypes)
        │  map WorkoutItem → ActivityRow      (mobile/src/lib/activity-map.ts)
        │  fila offline (retry)               (mobile/src/lib/sync-queue.ts)
        ▼
Supabase  ── upsert activities (onConflict: id) ──┐
          ── upsert activity_routes              │  RLS: user_id = auth.uid()
          ── delete activities (deleted[])       │
          ── upsert synced_activity_types        │
                                                  ▼
                                            Postgres
        ▲
        │  select activities / activity_routes
   web (Angular) — leitura (trabalho derivado, fora do MVP de escrita)
```

**Princípio:** abrir a aba só lê o HealthKit para exibir (sem escrita). A escrita acontece **só** por ① toque no botão de um tipo (backfill + inscrição) ou ② evento do observer, sempre **filtrado aos tipos inscritos**.

### Camadas (mobile)

| Arquivo | Responsabilidade |
|---------|------------------|
| `lib/activity-map.ts` | `WorkoutItem` → linha do banco e vice-versa (puro, testável) |
| `lib/sync-queue.ts` | Fila persistida de pendências + retry com backoff |
| `lib/synced-types.ts` | Cache local do conjunto de tipos inscritos + helper `isSubscribed(label)` |
| `services/activity-sync.ts` | `syncType(label)` (backfill) e `syncDelta()` (observer), ambos filtrando por tipos inscritos |
| `services/healthkit-observer.ts` | Liga observer + background delivery; chama `syncDelta()` |
| `store/fitness.store.ts` | `syncedTypes`, estado por tipo (`typeStatus`), `lastSyncedAt` por tipo + ações `syncType`/`unsubscribeType` |

## 4. Algoritmo de sincronização (push-only, opt-in por tipo)

Dois fluxos. Nenhum é disparado por abrir/ler a lista (FR-003).

### 4.1 `syncType(label)` — toque no botão de um tipo (backfill + inscrição)

```
syncType(label):
  1. session = getSession()                       → aborta se não autenticado
  2. inscreve o tipo: syncedTypes.add(label)       (local + upsert synced_activity_types)
  3. workouts = todos do HealthKit (3 anos, paginado por data)
              .filter(w => meta(w.activityId).label === label)
  4. rows = workouts.map(toActivityRow(userId))    // descarta/deriva IDs instáveis
  5. para cada lote de N rows: upsert('activities', rows, { onConflict: 'id' })
  6. para w com hasGpsRoute(activityId):
        points = fetchWorkoutRoute(w.id)
        if points.length: upsert('activity_routes', {...})
  7. em erro de rede (5/6): enfileira pendências (sync-queue)
  8. em sucesso: typeStatus[label] = 'synced', lastSyncedAt[label] = now
```

### 4.2 `syncDelta()` — observer (background + foreground), só tipos inscritos

```
syncDelta():
  1. se syncedTypes vazio → não faz nada (nada inscrito)
  2. anchor = readLocalAnchor()
  3. { added, deleted, newAnchor } = getAnchoredWorkouts({ anchor, limit: PAGE_SIZE })  // pagina
  4. added  = added.filter(w => syncedTypes.has(meta(w.activityId).label))   // FILTRO
  5. upsert das rows + rotas (igual 5/6 acima)
  6. deleted (já no servidor) → delete('activities').in('id', deleted)        // rota cai por cascade
  7. em erro de rede: enfileira pendências, NÃO avança a âncora
  8. em sucesso: writeLocalAnchor(newAnchor)
```

**Backfill vs âncora.** A âncora é **global** ao dispositivo e governa só o *delta para frente*. Por isso o histórico de um tipo recém-inscrito é feito por **range de data** (4.1, passo 3), não pela âncora — senão um tipo inscrito depois perderia o histórico anterior ao último anchor.

**Idempotência:** `upsert` com `onConflict: 'id'` (UUID do HealthKit). Re-rodar é seguro — SC-003.

**Offline (FR-010):** se a escrita falha por rede, as rows entram em `sync-queue` (persistida); no `syncDelta` a âncora **não** avança; ao reconectar, a fila drena antes do próximo delta. Garante SC-005.

**Gatilhos (FR-004, FR-007):**
- *Toque no botão do tipo:* `store.syncType(label)` → 4.1.
- *Observer (bg + fg):* `services/healthkit-observer.ts` registra observer de Workout + `enableBackgroundDelivery`; cada evento chama `syncDelta()` (4.2). O observer é **global**, mas o push é filtrado aos tipos inscritos. iOS only; degrada com segurança onde indisponível.
- *Abrir/ler a lista:* **não dispara nada** (apenas leitura para exibição).

## 5. Contratos

### 5.1 Service API (mobile)

```ts
// mobile/src/services/activity-sync.ts
export interface SyncResult {
  pushed: number;      // upserts aplicados
  deleted: number;     // remoções aplicadas
  routes: number;      // rotas enviadas
  queued: number;      // pendências enfileiradas (offline/erro)
  ok: boolean;
}
export function syncType(label: string): Promise<SyncResult>;   // backfill + inscrição (4.1)
export function unsubscribeType(label: string): Promise<void>;  // para de rastrear (default: não apaga dados)
export function syncDelta(): Promise<SyncResult>;               // observer, só tipos inscritos (4.2)

// mobile/src/lib/synced-types.ts
export function loadSyncedTypes(): Promise<Set<string>>;         // hidrata do servidor + cache local
export function isSubscribed(label: string): boolean;

// mobile/src/lib/activity-map.ts
export function toActivityRow(w: WorkoutItem, userId: string): ActivityRow | null; // null = ID instável descartado
export function toRouteRow(id: string, points: RoutePoint[]): ActivityRouteRow;
```

### 5.2 Contrato de tabela (Supabase) — resumo

`activities` (PK `id` = UUID HealthKit, FK `user_id`), `activity_routes` (PK/FK `activity_id`), `synced_activity_types` (PK `user_id,type_key`), `sync_state` (PK `user_id,device_id`). Colunas, tipos, índices e políticas RLS completas em **[data-model.md](./data-model.md)**.

### 5.3 Estado do store (Zustand)

```ts
type TypeSyncStatus = 'unsubscribed' | 'syncing' | 'synced' | 'pending' | 'error';

interface FitnessState {
  // ...campos atuais...
  syncedTypes: Set<string>;                       // labels inscritos
  typeStatus: Record<string, TypeSyncStatus>;     // estado por tipo (UI do card)
  lastSyncedAt: Record<string, string>;           // último sync por tipo
  syncError: Record<string, string | null>;
  syncType: (label: string) => Promise<void>;     // chama service.syncType()
  unsubscribeType: (label: string) => Promise<void>;
}
```

## 6. Fases de entrega

Mapeadas às histórias da spec — cada fase é entregável e verificável isolada.

| Fase | Entrega | Histórias | Resultado verificável |
|------|---------|-----------|-----------------------|
| **F0 — Fundação** | Schema + RLS + migration + tipos no shared | infra | Tabelas existem com RLS; `select` vazio autenticado funciona |
| **F1 — Sync por tipo (backfill)** | `activity-map`, `synced-types`, `syncType()`, botão do card inscreve+envia | US1 | SC-001, SC-002, SC-003, SC-007 |
| **F2 — Offline + estado por tipo** | `sync-queue`, estado por tipo no store, UI no card | US1, US4 | SC-005 |
| **F3 — Delta incremental (foreground)** | âncora persistida, `syncDelta()` filtrado, observer em foreground | US2 | SC-004 (foreground) |
| **F4 — Background delivery** | observer HealthKit + background, só tipos inscritos | US2 | SC-004 (background) |
| **F5 — Rotas GPS** | `activity_routes`, envio de polyline | US3 | SC-006 |
| **F6 — Leitura web (derivado)** | página Treinos lê do Supabase | — | fora do MVP de escrita |

## 7. Riscos e mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| **ID instável** (`String(Math.random())` no map atual) | Duplicatas, quebra dedup | Derivar chave determinística (`start+sourceId+activityId`) ou descartar; resolver [NEEDS CLARIFICATION] da spec antes da F1 |
| **Inconsistência de env var** | Sync não conecta | `supabase.ts` lê `EXPO_PUBLIC_SUPABASE_URL`, mas `app.config.js` expõe via `extra.supabaseUrl` (de `SUPABASE_URL`). Padronizar **antes** da F1 (ver §8) |
| Payload de rota grande (corridas longas) | Upload lento, custo | Lote separado; avaliar simplificação na leitura; `point_count` para decidir |
| Background delivery não confiável no iOS | SC-003 falha | Tratar background como *best-effort*; foreground garante convergência |
| **Deleções não expostas** pela lib | FR-008 não cumprido | `react-native-health` não retorna `deleted[]` no fluxo anchored. Mitigação futura: reconciliação periódica (comparar IDs do HealthKit × Supabase) ou migrar de lib |
| Backfill por tipo (3 anos) | Timeout/UX ruim | Paginar (`PAGE_SIZE`) + batch upsert + estado "sincronizando" no card |
| Tipo genérico "Treino" (catch-all) | Inscrição ampla involuntária | Resolver [NEEDS CLARIFICATION] de identidade do tipo na spec antes da F1 |
| `syncType` relê todo o HealthKit por tipo | Custo se muitos tipos inscritos | Aceitável p/ ação manual pontual; deltas futuros vêm só pela âncora (`syncDelta`) |
| Limites de rate/payload do Supabase | Erros 4xx | Batches de tamanho fixo; backoff na fila |

## 8. Dependências e pré-requisitos

- **Padronizar env vars:** decidir entre `process.env.EXPO_PUBLIC_*` (atual em `supabase.ts`) **ou** `Constants.expoConfig.extra.*` (atual em `app.config.js`). Recomendação: manter `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_ANON_KEY` (já usado pelo client) e ajustar `app.config.js` para coerência.
- **Projeto Supabase** criado, com URL + anon key disponíveis (ver [auth.md](../auth.md)).
- **Supabase CLI** para versionar migrations em `supabase/migrations/` (diretório a criar na raiz).
- **AsyncStorage** (ou reuso do SecureStore) para âncora + fila offline — adicionar dependência se ausente.

## 9. Estratégia de testes

- **Unit (puro):** `activity-map.ts` — mapeamento, descarte de ID instável, omissão de rota indoor. (Jest já configurado no mobile.)
- **Unit:** `sync-queue.ts` — enfileira em erro, drena em sucesso, sem duplicar.
- **Integração (manual/dev):** rodar sync com conta de teste; conferir contagem HealthKit × `activities`; re-sync = 0 novos.
- **RLS:** com dois usuários, garantir que um não lê treinos do outro (SC-006).
- **Offline:** simular falha de rede no meio do sync; reconectar; conferir ausência de perda/duplicata.
