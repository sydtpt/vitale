# Plan: Histórico de Treinos (web)

> Plano técnico para [spec.md](./spec.md). Modelo de dados em [data-model.md](./data-model.md); tarefas em [tasks.md](./tasks.md).

## 1. Contexto técnico

| Item | Valor |
|------|-------|
| Frontend | Angular 21, standalone components, OnPush, signals/`computed()`, `inject()` |
| Backend | Supabase (Postgres + Auth + RLS) — client web em [supabase.client.ts](../../../web/src/app/core/supabase/supabase.client.ts) |
| Tabelas | `activities`, `activity_routes` (já criadas pelo sync — ver [data-model do sync](../sync-atividades/data-model.md)) |
| Tokens/estilo | SCSS com variáveis CSS + tokens do `@vitale/shared` (`T`, `MOD`, `accents`) — sem magic values |
| Gráficos | **SVG feito à mão** (padrão do projeto, ver [runs-chart](../../../web/src/app/features/semana/components/runs-chart.component.ts)) — sem lib de chart |
| Ícones | `IconComponent` web ([icon.component.ts](../../../web/src/app/core/services/icon.component.ts)) |
| Roteamento | Lazy `loadComponent` em [main.ts](../../../web/src/main.ts) |

## 2. Constitution Check (convenções do projeto)

- ✅ **Standalone + OnPush** em todos os componentes novos.
- ✅ **Estado via signals/`computed()`** — sem NgRx; um service com `signal()` segura os dados e tudo deriva por `computed()`.
- ✅ **Tokens, sem magic values** — cores por tipo a partir de `MOD`/`accents`; cores do gráfico do design system.
- ✅ **Shared read-only** — o mapa `activityId → {label, slug, cor, ícone}` é **dado de exibição da web**, fica em `web/src/app/core/models/` (não em `packages/shared`, que não recebe lógica/derivação de UI).
- ⚠️ **Cross-feature:** a decisão "travar do sync" exige (a) **migration** adicionando colunas a `activities` e (b) **mudança no sync mobile** para não sobrescrever linhas travadas. Isso toca a feature [sync-atividades](../sync-atividades/spec.md) — coordenar (ver §4 e §8).

## 3. Arquitetura

```
Supabase (Postgres, RLS: user_id = auth.uid())
   │  select activities (colunas leves)        ── leitura analítica
   │  update activities (edição + locally_edited=true)
   ▼
web/src/app/features/historico-treinos/
   ├── data/activities.store.ts        ← signal<Activity[]> + load() + computeds
   ├── data/activity-types.ts (core)   ← activityId → {label, slug, icon, color}, GPS ids
   ├── pages/
   │     historico-treinos-page        ← empty-state | overview + grid de tipos
   │     tipo-atividade-page           ← lista/cards + filtros + paginação
   │     atividade-detalhe-page        ← form de edição (ou drawer)
   └── components/
         period-selector               ← Semana | Ano | Sempre
         overview-card                 ← stats do período + stacked-bar-chart + metric toggle
         stacked-bar-chart             ← SVG empilhado por tipo
         tipo-card                     ← card clicável por tipo (agregados de sempre)
         activity-row / activity-card  ← item de lista / card
         activity-filters              ← filtros da página de tipo
```

**Princípio:** uma única carga das atividades do usuário alimenta um `signal`; visão geral, cards por tipo e listas filtradas são todos `computed()` sobre esse signal (sem refetch por interação). A edição faz `update` direto e atualiza o signal localmente.

### Rotas (adicionar em [main.ts](../../../web/src/main.ts))

| Rota | Componente |
|------|------------|
| `/historico-treinos` | `HistoricoTreinosPageComponent` (empty-state ou dashboard) |
| `/historico-treinos/:slug` | `TipoAtividadePageComponent` (lista do tipo) |
| `/historico-treinos/:slug/:id` | `AtividadeDetalhePageComponent` (edição) |

Sidebar: novo item em [sidebar.component.ts](../../../web/src/app/shared/layouts/sidebar.component.ts) → `{ path: '/historico-treinos', icon: '📊', label: 'Histórico' }`.

## 4. Decisões técnicas chave

### 4.1 Agregação no cliente (MVP)
`activities.store.ts` faz **um** `select` das colunas leves (sem rotas) de todas as atividades do usuário, guarda em `signal<Activity[]>`. O fetch traz a coluna `hidden`; **todas as derivações analíticas excluem `hidden = true`** (um filtro opcional "ver ocultas" pode reexpô-las). Derivações:
- `isEmpty = computed(() => activities().length === 0)` → estado vazio (FR-001).
- `overview(period, metric)` → filtra por janela móvel do período, agrupa por bucket × tipo, soma a métrica → series do gráfico + stat tiles.
- `typeSummaries` → agrupa **tudo** por label, soma nº/distância/duração/calorias (FR-006).
- `listByType(slug, filters, page)` → filtra/ordena/pagina em memória.

**Por que cliente (decisão de performance):** para um usuário com ≤ poucos milhares de treinos, o dataset é pequeno (<~1 MB) e a latência de rede domina; um fetch único deixa as trocas de período/métrica **instantâneas** (zero round-trip). Caminho de escala server-side em §7.

### 4.2 Metadados de tipo na web
Criar `web/src/app/core/models/activity-types.ts` espelhando `getActivityMeta`/`GPS_ACTIVITY_IDS` de [workout-types.ts](../../../mobile/src/lib/workout-types.ts), porém com **ícone do `IconComponent` web** e **cor do design system** (não os nomes MaterialCommunityIcons do mobile). Expõe:
```ts
export interface TypeMeta { activityId: number; label: string; slug: string; icon: string; color: string; }
export function metaForActivity(activityId: number): TypeMeta;
export function slugToLabel(slug: string): string;
export const GPS_ACTIVITY_IDS: Set<number>;
```
> Risco: divergência com o mobile se um dos mapas mudar. Mitigação: comentar a fonte (mobile) e manter os mesmos `case`/labels.

### 4.3 Gráfico de barras empilhadas (SVG)
Componente `stacked-bar-chart` no padrão de [runs-chart](../../../web/src/app/features/semana/components/runs-chart.component.ts): recebe `buckets` (rótulo + segmentos `{typeLabel, value, color}`) e a métrica; calcula `y`/`height` por segmento empilhado, eixo e grid. Sem dependências.

**Bucketing por período (janelas móveis):**
- Semana → 7 dias: hoje + os 6 dias anteriores.
- Ano → 12 meses: mês atual + os 11 meses anteriores.
- Sempre → 1 bucket por ano com dados.

**Métricas (toggle):** `distance_m`→km · `duration_s`→h · `calories`→kcal · contagem. Tipos sem distância contribuem 0 na métrica distância.

### 4.4 Edição + travar do sync (cross-feature)
1. **Schema** (migration nova): adicionar a `activities`:
   - `locally_edited boolean not null default false`
   - `edited_at timestamptz`
2. **Web** salva: `update activities set <campos>, locally_edited = true, edited_at = now() where id = :id` (RLS garante `user_id`). Atualiza o signal local.
3. **Sync mobile** deixa de sobrescrever linhas travadas. Duas opções:
   - **(preferida) RPC com conflito condicional:** função Postgres `sync_upsert_activities(rows jsonb)` que faz `insert ... on conflict (id) do update set ... where not activities.locally_edited`. Atômico, robusto a qualquer cliente. O mobile troca o `upsert` de [activity-sync.ts:60](../../../mobile/src/services/activity-sync.ts#L60) por `rpc('sync_upsert_activities', ...)`.
   - **(fallback simples) filtro no cliente:** antes do upsert, o mobile faz `select id from activities where locally_edited = true` e remove esses ids dos lotes. Tem janela de corrida pequena; aceitável.
4. **Delta de delete** ([activity-sync.ts](../../../mobile/src/services/activity-sync.ts), fluxo `syncDelta`): para ids deletados no HealthKit que sejam `locally_edited`, **marcar `hidden = true`** em vez de apagar (preserva a edição e habilita multi-source futuro). Ids não editados são apagados normalmente.

> Este item é a única parte que **modifica a feature de sync**. Tratar como pré-requisito coordenado (ver §8). Edição **por campo** e reconciliação multi-source ficam no backlog (ver [spec §10](./spec.md)).

## 5. Contratos

### 5.1 Store/Service web
```ts
// features/historico-treinos/data/activities.store.ts
loadActivities(): Promise<void>;                 // select leve, popula signal
readonly activities: Signal<Activity[]>;
readonly isEmpty: Signal<boolean>;
overview(period: Period, metric: Metric): Signal<{ buckets: Bucket[]; totals: Totals }>;
readonly typeSummaries: Signal<TypeSummary[]>;   // agregados de sempre, por tipo
listByType(slug: string, filters: Filters, page: Page): Signal<ActivityPage>;
getActivity(id: string): Activity | undefined;
updateActivity(id: string, patch: Partial<Activity>): Promise<void>; // seta locally_edited

type Period = 'semana' | 'ano' | 'sempre';
type Metric = 'distance' | 'duration' | 'calories' | 'count';
```

### 5.2 SQL de leitura/escrita
- Leitura: `from('activities').select('id,activity_id,activity_name,calories,start_at,end_at,duration_s,distance_m,source_name,tracked,has_route,locally_edited,hidden').eq('user_id', uid).order('start_at', { ascending: false })`. Derivações de métricas/listas filtram `hidden === false` no cliente.
- Edição: `from('activities').update({ ...patch, locally_edited: true, edited_at: new Date().toISOString() }).eq('id', id)`.
- (Cross-feature) RPC `sync_upsert_activities` — ver §4.4 e [data-model.md](./data-model.md).

## 6. Fases de entrega

| Fase | Entrega | Histórias | Verificável |
|------|---------|-----------|-------------|
| **F0 — Schema + tipos** | Migration `locally_edited`/`edited_at`/`hidden`; `activity-types.ts` (web) | infra | Colunas existem; mapa de tipos resolve label/slug/cor |
| **F1 — Leitura + estado vazio** | `activities.store.ts` (load + signal), rota, sidebar, empty-state | US1 | SC-001 |
| **F2 — Visão geral** | `overview-card`, `period-selector`, `stacked-bar-chart`, toggle de métrica | US2 | SC-002, SC-004 |
| **F3 — Cards por tipo** | `tipo-card` + grid, agregados de sempre, navegação | US3 | SC-003 |
| **F4 — Página de tipo** | `tipo-atividade-page`, lista/cards, filtros, paginação | US4 | SC-006 |
| **F5 — Edição + travar sync** | `atividade-detalhe-page`, `updateActivity`, sync mobile (RPC/filtro de travadas + `hidden` no delete) | US5 | SC-005 |

> F0–F4 são **só web** e não tocam o sync. F5 é a fase cross-feature (coordenar com [sync-atividades](../sync-atividades/spec.md)). **A UI de edição da F5 está bloqueada** até decidir os campos editáveis ([spec §9](./spec.md)); a mudança no sync (travar + `hidden`) pode avançar antes.

## 7. Riscos e mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| **Edição sobrescrita pelo sync** | Perda do dado editado (quebra SC-005) | Migration + RPC condicional / filtro de ids travados + skip no delete (§4.4) |
| **Divergência do mapa de tipos** web×mobile | Tipos/labels inconsistentes | Espelhar `getActivityMeta`; comentar a fonte; testar labels |
| **Volume grande** (muitos anos/atividades) | Fetch único pesado, UI lenta | MVP client-side; migrar agregados para **RPC `group by`** e listagem para `.range()` server-side se passar de ~poucos milhares |
| **Linha travada deletada no HealthKit** | Estado divergente HealthKit×Supabase | Default: preservar travadas no delta de delete; documentar como decisão |
| **Tipo catch-all "Treino"** | Card genérico mistura `activityId`s | Mesma semântica do mobile; aceitável no MVP (mesmo [NEEDS CLARIFICATION] do sync) |
| **`activityId` editável reclassifica o treino** | Atividade muda de card/tipo | Tornar edição de tipo opt-in explícita ou fora do MVP (ver clarification na spec) |

## 8. Dependências e pré-requisitos

- **Sync já entregue** persistindo atividades em `activities` (F0–F5 do [sync](../sync-atividades/plan.md)).
- **Migration** `locally_edited`/`edited_at` aplicada **antes** de F5.
- **Coordenação com o sync mobile** para o conflito condicional + skip de delete (F5). Sem isso, a edição é entregável mas frágil (seria sobrescrita).
- **Supabase CLI** para versionar a migration em `supabase/migrations/`.

## 9. Estratégia de testes

- **Unit (puro):** funções de agregação (bucketing por período, soma por métrica/tipo) e de filtro/paginação — entrada `Activity[]`, saída determinística.
- **Unit:** `activity-types.ts` — `metaForActivity`, `slugToLabel`, ida-e-volta de slug.
- **Componente:** `stacked-bar-chart` calcula alturas/segmentos esperados para um conjunto fixo.
- **Integração (manual/dev):** com conta de teste, conferir totais da web contra `count`/`sum` em SQL; editar uma atividade e rodar o sync do tipo → valor editado permanece (SC-005).
- **UI:** rodar `npm run web:dev` e validar empty-state, troca de período/métrica, navegação por tipo, filtros/paginação e edição no browser.
