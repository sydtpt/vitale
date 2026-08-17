# Plan: Histórico de Treinos (mobile)

> Plano técnico para [spec.md](./spec.md). Modelo de dados em [data-model.md](./data-model.md); tarefas em [tasks.md](../../../_bmad-output/implementation-artifacts/mobile-historico-treinos/tasks.md).  
> Referência web: [plan web](../historico-treinos/plan.md).

## 1. Contexto técnico

| Item | Valor |
|------|-------|
| Framework | React Native 0.81 / Expo 54, componentes funcionais, hooks |
| Roteamento | Expo Router (file-based, `Stack` com `animation: 'slide_from_right'`) |
| Estado global | Zustand 5 |
| Gráficos | SVG via `react-native-svg` 15 (já instalado) — sem lib extra |
| Backend | Supabase JS (`@supabase/supabase-js`) com RLS |
| Mapa de rota | `WorkoutMap` existente em `mobile/src/components/WorkoutMap.tsx` (reutilizar) |
| Formatação | `mobile/src/lib/workout-format.ts` (reutilizar) |
| Tipos de atividade | `getActivityMeta` em `mobile/src/lib/workout-types.ts` (reutilizar) |
| Tema | `mobile/src/theme` — `colors`, `spacing`, `radii`, `shadows`, `MOD` |

## 2. Arquitetura

```
Supabase (Postgres, RLS: user_id = auth.uid())
   │  select activities (colunas completas, sem rotas)
   │  update activities (edição + locally_edited=true)
   │  select activity_routes (lazy, por id)
   ▼
mobile/src/store/activities.store.ts     ← Zustand; carga única, derivações por getState()
   │
   ├── mobile/src/lib/activity-overview.ts       ← buildOverview() — puro
   ├── mobile/src/lib/activity-type-summary.ts   ← buildTypeSummaries() — puro
   └── mobile/src/lib/activity-list-filter.ts    ← applyFilters() — puro

mobile/src/app/historico/
   ├── index.tsx            ← Overview (empty-state | período + gráfico + cards de tipo)
   ├── [label].tsx          ← Lista do tipo (filtros + paginação)
   └── [label]/[id].tsx     ← Detalhe + edição + mapa GPS

mobile/src/components/charts/
   └── StackedBarChart.tsx  ← SVG empilhado por tipo

mobile/src/app/(tabs)/mais.tsx   ← "Treinos" disabled → "Histórico de Treinos" → /historico
```

**Princípio (idêntico ao web):** uma única carga das atividades do usuário alimenta o store; o gráfico, os cards de tipo e as listas filtradas derivam desse dataset em memória sem refetch. A edição faz PATCH direto no Supabase e atualiza o estado local.

## 3. Rotas

| Rota | Arquivo | Analogia web |
|------|---------|-------------|
| `/historico` | `historico/index.tsx` | `/historico-treinos` |
| `/historico/[label]` | `historico/[label].tsx` | `/historico-treinos/:slug` |
| `/historico/[label]/[id]` | `historico/[label]/[id].tsx` | `/historico-treinos/:slug/:id` |

Navegação:
```typescript
// Overview → tipo
router.push({ pathname: '/historico/[label]', params: { label } });

// Tipo → detalhe
router.push({ pathname: '/historico/[label]/[id]', params: { label, id } });

// Voltar
router.back();
```

Todas as telas usam `Stack.Screen options={{ headerShown: false }}` e cabeçalho customizado com `chevron-back` (mesmo padrão das telas `/fitness/`).

## 4. Store: `activities.store.ts`

```typescript
// mobile/src/store/activities.store.ts
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { ActivityRoutePoint } from '@vitale/shared';
import type { Activity, ActivityPatch } from './activities.store';

interface ActivitiesStore {
  _all: Activity[];
  loading: boolean;
  error: string | null;
  routes: Record<string, ActivityRoutePoint[]>;

  // getters (uso inline: store.activities)
  get activities(): Activity[];   // filtra hidden=false
  get isEmpty(): boolean;

  load: (force?: boolean) => Promise<void>;
  findById: (id: string) => Activity | undefined;
  updateActivity: (id: string, patch: ActivityPatch) => Promise<void>;
  setHidden: (id: string, hidden: boolean) => Promise<void>;
  loadRoute: (activityId: string) => Promise<void>;
}
```

**`load()`** — faz select de todas as colunas (exceto `points` de rotas), salva em `_all`. Idempotente: se já carregado e `!force`, retorna sem refetch.

**`findById()`** — procura em `_all` (inclui hidden, para abrir detalhe de uma atividade hidden).

**`updateActivity()`** — PATCH no Supabase (`locally_edited=true`, `edited_at=now()`), depois atualiza o item correspondente em `_all` otimisticamente.

**`setHidden()`** — PATCH `hidden` no Supabase, atualiza `_all`.

**`loadRoute()`** — lazy: só busca se `routes[id]` for `undefined`. Cache em memória.

## 5. Telas

### 5.1 Overview (`historico/index.tsx`)

```
┌──────────────────────────────┐
│  ← [chevron]   Histórico     │  ← cabeçalho customizado
├──────────────────────────────┤
│  [Estado vazio]              │  ← só se isEmpty
│   Sincronize pelo Sync →     │
├──────────────────────────────┤
│  [Semana] [Ano] [Sempre]     │  ← seletor de período
│  Atividades  Distância  ...  │  ← stat tiles (4)
│  [Gráfico SVG empilhado]     │  ← StackedBarChart
│  [dist] [dur] [kcal] [nº]    │  ← toggle de métrica
├──────────────────────────────┤
│  Por tipo (de sempre)        │
│  ┌──────────┐ ┌──────────┐  │
│  │ Corrida  │ │ Musc...  │  │  ← cards horizontais em FlatList
│  │ 42 · ...km│ │ 18 · ...h│  │
│  └──────────┘ └──────────┘  │
└──────────────────────────────┘
```

- Estado vazio: renderizado antes do restante, se `isEmpty`.
- Seletor: `useState('semana')` local. Troca recalcula `buildOverview()` em `useMemo`.
- Cards de tipo: `FlatList` horizontal ou `ScrollView` com `flexWrap: 'wrap'`, usando `buildTypeSummaries()`.
- Navegação para tipo: `router.push({ pathname: '/historico/[label]', params: { label } })`.

### 5.2 Lista por tipo (`historico/[label].tsx`)

```
┌──────────────────────────────┐
│  ←   Corrida   · 42 atv.    │
├──────────────────────────────┤
│  [▼ Filtros]                 │  ← Pressable para expandir painel
│  ┌── Painel expansível ──┐   │
│  │ De: [data]  Até: [dt] │   │
│  │ Distância: [min]–[max]│   │
│  │ Com rota: [sim|não|td]│   │
│  └───────────────────────┘   │
├──────────────────────────────┤
│  ┌──────────────────────┐    │
│  │ 🏃 17 mai · 1h20     │    │
│  │ ⏱ 1h20  🔥 680 kcal  │    │  ← WorkoutCard (mesmo da /fitness/[label])
│  └──────────────────────┘    │
│  ...                         │
│  [Carregar mais]             │  ← onEndReached
└──────────────────────────────┘
```

- Parâmetro de rota: `label` (string, ex.: "Corrida"). Filtra `activities` via `getActivityMeta(a.activityId).label === label`.
- Filtros: `useState<ActivityFilters>({})` local. `useMemo` aplica `applyFilters()`.
- Paginação: `useState(PAGE_SIZE)` + `onEndReached` (mesmo padrão de `/fitness/[label].tsx`).
- Toque no card: `router.push({ pathname: '/historico/[label]/[id]', params: { label, id } })`.

### 5.3 Detalhe + edição (`historico/[label]/[id].tsx`)

```
┌──────────────────────────────┐
│  ←   Corrida         [salvar]│  ← botão "Salvar" só se há edição
├──────────────────────────────┤
│  ┌────────────────────────┐  │
│  │  🏃  17 maio 2026      │  │  ← hero
│  │  07:30 – 08:50         │  │
│  │  1h20  680kcal  12km   │  │  ← stats
│  │  [editado manualmente] │  │  ← badge se locally_edited
│  └────────────────────────┘  │
│                              │
│  Percurso                    │
│  ┌──────────────────────┐   │
│  │  [WorkoutMap]        │   │
│  └──────────────────────┘   │
│                              │
│  Editar                      │
│  Nome: [____________]        │  ← TextInput, sempre habilitado
│  Duração: [____] min         │  ← só se !hasGps; com nota explicativa
│                              │
│  Incluir nas métricas [⬛]  │  ← Switch para hidden
│                              │
│  Todos os dados              │
│  ┌──────────────────────┐   │
│  │ Tipo    Corrida      │   │  ← infoCard (read-only)
│  │ Fonte   Apple Health │   │
│  │ ...                  │   │
│  └──────────────────────┘   │
└──────────────────────────────┘
```

- `findById(id)` do store. Se não encontrar, exibe erro de "não encontrado".
- `hasGps = hasRoute || (distanceM ?? 0) > 0`.
- Edição: `useState` local para nome e duração. Botão "Salvar" aparece só se houver mudança.
- Salvar: chama `store.updateActivity(id, patch)`.
- Toggle: chama `store.setHidden(id, !activity.hidden)`.
- Rota GPS: `store.loadRoute(id)` em `useEffect` se `hasRoute`.

## 6. Componente de gráfico: `StackedBarChart`

```typescript
// mobile/src/components/charts/StackedBarChart.tsx
interface Props {
  buckets: Bucket[];    // de buildOverview()
  height?: number;      // default 160
  barWidth?: number;    // calculado dinamicamente
}
```

Usa `react-native-svg` (`Rect`, `Text`, `Line`, `G`). Lógica de `y`/`height` por segmento portada de `web/.../stacked-bar-chart.component.ts`. Cores por tipo fixas (de `MOD.treino.accent` / palette do tema — mesmas cores que o web usa para cada label de tipo).

## 7. Fases de entrega

| Fase | Entrega | US |
|------|---------|----|
| **F0 — Infra** | Schema ok (pré-req); store + lib puras | — |
| **F1 — Overview básico** | Rota `/historico`, estado vazio, seletor de período, stats tiles | US1, US2 parcial |
| **F2 — Gráfico + cards** | `StackedBarChart`, cards de tipo clicáveis | US2, US3 |
| **F3 — Lista + filtros** | `/historico/[label]`, painel de filtros, paginação | US4 |
| **F4 — Detalhe + edição** | `/historico/[label]/[id]`, mapa GPS, edição, badge, toggle | US5, US6 |

F0–F3 são só mobile (leitura). F4 inclui escrita no Supabase.

## 8. Riscos e mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Edição sobrescrita pelo sync | Perda do dado editado | `sync_upsert_activities` RPC (já no web) garante `WHERE NOT locally_edited` |
| Gráfico SVG em telas pequenas | Labels cortados, barras muito estreitas | Usar `ScrollView` horizontal para o gráfico se `buckets.length > 7` |
| Colunas `locally_edited`/`hidden` inexistentes | Erro de select | Verificar migration antes de implementar F0 |
| `findById` retorna `undefined` em deep-link | Tela quebrada | Sempre exibir estado de erro explícito; recarregar store se necessário |

## 9. Reutilização de código existente

| Código existente | Onde reutilizar |
|-----------------|-----------------|
| `WorkoutMap` (`mobile/src/components/WorkoutMap.tsx`) | Detalhe de atividade — sem modificação |
| `workout-format.ts` (`formatDuration`, `formatDistance`, etc.) | Formatação nos 3 novos screens |
| `getActivityMeta` / `hasGpsRoute` (`workout-types.ts`) | Store, lista, detalhe |
| `supabase` client (`mobile/src/lib/supabase.ts`) | Store `activities.store.ts` |
| `WorkoutCard` de `/fitness/[label].tsx` | Extrair como componente compartilhado ou duplicar para `/historico/[label].tsx` |
| Padrão de cabeçalho com `chevron-back` | Todos os 3 screens |

## 10. Estratégia de testes

- **Unit:** `buildOverview()`, `buildTypeSummaries()`, `applyFilters()` — funções puras com entradas `Activity[]` fixas → saídas determinísticas. Mínimo: buckets corretos por período; somas corretas por tipo; filtros de data/distância.
- **Manual:** `npm run mobile:ios` → Mais → Histórico de Treinos; percorrer o fluxo completo (empty-state, overview, tipo, detalhe, edição, toggle de métricas).
- **Integração:** editar atividade no mobile → conferir no Supabase que `locally_edited = true`; rodar sync → valor editado permanece.
