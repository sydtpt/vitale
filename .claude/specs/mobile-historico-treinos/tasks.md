# Tasks: Histórico de Treinos (mobile)

> Derivado de [plan.md](./plan.md). Fases entregáveis e verificáveis isoladas.  
> Pré-requisito: migration `locally_edited`/`edited_at`/`hidden` **já aplicada** (T001 do [web](../historico-treinos/tasks.md)).

---

## F0 — Infra: store + libs puras

- [x] **T001** Verificar que as colunas `locally_edited`, `edited_at`, `hidden` existem em `activities`. Se não, aplicar migration do web antes de continuar.
- [x] **T002** Adicionar `locally_edited`, `edited_at`, `hidden` ao tipo `ActivityRow` em `mobile/src/lib/activity-map.ts` ([data-model §3](./data-model.md)).
- [x] **T003** Criar `mobile/src/store/activities.store.ts` — Zustand com: estado `_all`, `loading`, `error`, `routes`; getters `activities` (filtra hidden) e `isEmpty`; ações `load()`, `findById()`, `updateActivity()`, `setHidden()`, `loadRoute()` ([data-model §4](./data-model.md)).
- [x] **T004** Criar `mobile/src/lib/activity-overview.ts` — função pura `buildOverview(activities, period, metric, now)` com bucketing (7 dias / 12 meses / anos históricos) e agregação por tipo × métrica ([data-model §5](./data-model.md)).
- [x] **T005** Criar `mobile/src/lib/activity-type-summary.ts` — função pura `buildTypeSummaries(activities)` com agregados all-time por tipo ([data-model §5](./data-model.md)).
- [x] **T006** Criar `mobile/src/lib/activity-list-filter.ts` — função pura `applyFilters(activities, filters)` com filtros de data, distância, duração, fonte, rota ([data-model §5](./data-model.md)).
- [x] **T007** Exportar `useActivitiesStore` em `mobile/src/store/index.ts`.
- [x] **T008** Escrever testes unitários para as 3 funções puras (T004–T006) — entradas fixas `Activity[]`, verificar: buckets corretos por período; somas por tipo; filtros de data/distância. Arquivo: `mobile/src/lib/__tests__/activity-overview.test.ts` etc.

---

## F1 — Overview básico (US1 + US2 parcial)

- [x] **T010** Criar pasta `mobile/src/app/historico/` com `index.tsx` — chamar `store.load()` em `useEffect`, mostrar `ActivityIndicator` enquanto carrega.
- [x] **T011** Implementar **estado vazio** em `historico/index.tsx`: se `isEmpty`, renderizar card orientando a usar Sync de Atividades (`/fitness`). Nenhuma seção analítica visível.
- [x] **T012** Adicionar **seletor de período** (Semana / Ano / Sempre) — 3 botões segmentados, `useState` local. Troca de período recalcula `buildOverview()` via `useMemo`.
- [x] **T013** Implementar **stat tiles** do período (nº de atividades, distância, duração, calorias) acima do gráfico.
- [x] **T014** Substituir entrada "Treinos" (disabled) por "Histórico de Treinos" em `mobile/src/app/(tabs)/mais.tsx`, apontando para `/historico`.

---

## F2 — Gráfico + cards de tipo (US2 + US3)

- [x] **T020** Criar `mobile/src/components/charts/StackedBarChart.tsx` — SVG via `react-native-svg`. Props: `buckets: Bucket[]`. Barras empilhadas por tipo, eixo inferior com labels de bucket, cores por tipo. Rolar horizontalmente se `buckets.length > 7` ([plan §6](./plan.md)).
- [x] **T021** Adicionar **toggle de métrica** (distância / duração / calorias / nº) abaixo do gráfico em `historico/index.tsx`. Troca de métrica recalcula `buildOverview()`.
- [x] **T022** Implementar **cards de tipo** usando `buildTypeSummaries()` — ícone do tipo, label, nº total, distância total (ou duração/calorias para tipos sem distância). Cards em `FlatList` horizontal (ou `ScrollView` + `flexWrap`).
- [x] **T023** Navegar do card de tipo para `/historico/[label]` ao tocar.
- [ ] **T024** Verificar SC-002: trocar período recalcula gráfico + stats. Verificar SC-003: somas dos cards conferem contra valores do Supabase. Verificar SC-004: trocar métrica mantém composição por tipo.

---

## F3 — Lista por tipo com filtros (US4)

- [x] **T030** Criar `mobile/src/app/historico/[label].tsx` — `FlatList` com atividades filtradas por label, paginação via `onEndReached` + `useState(PAGE_SIZE)`.
- [x] **T031** Reutilizar (ou extrair) `WorkoutCard` de `mobile/src/app/fitness/[label].tsx` para exibir cada item da lista.
- [x] **T032** Implementar **painel de filtros expansível** — `Pressable` "Filtros ▼/▲" que mostra/oculta painel com campos: intervalo de datas (dois `TextInput` no formato dd/mm/aaaa ou date pickers nativos), faixa de distância (km), faixa de duração (min), fonte (`TextInput`), toggle rota (sim/não/todos).
- [x] **T033** Aplicar `applyFilters()` via `useMemo` ao mudar os filtros; recalcular lista e paginação.
- [x] **T034** Navegar do item da lista para `/historico/[label]/[id]` ao tocar.
- [ ] **T035** Verificar SC-006: filtros produzem subconjuntos corretos; paginação estável.

---

## F4 — Detalhe + edição (US5 + US6)

- [x] **T040** Criar `mobile/src/app/historico/[label]/[id].tsx` — chamar `findById(id)`, exibir estado de "não encontrado" se ausente; chamar `loadRoute(id)` em `useEffect` se `hasRoute`.
- [x] **T041** Implementar **hero** (ícone, tipo, data, hora, stats: duração, kcal, distância, pace, elevação) usando formatters de `workout-format.ts`.
- [x] **T042** Exibir **mapa GPS** reutilizando `WorkoutMap` (passando `store.routes[id]`) quando houver pontos de rota.
- [x] **T043** Implementar **campos editáveis** — `TextInput` para nome (sempre) e duração em minutos (só se `!hasGps`); nota explicativa "duração calculada pelo rastreamento" quando GPS presente.
- [x] **T044** Implementar botão **"Salvar"** (aparece só se há mudança) que chama `store.updateActivity(id, patch)`. Exibir indicador de loading durante o PATCH.
- [x] **T045** Exibir **badge "editado manualmente"** quando `activity.locallyEdited === true`.
- [x] **T046** Implementar **toggle "Incluir nas métricas"** (`Switch`) que chama `store.setHidden(id, !activity.hidden)`.
- [x] **T047** Exibir **card "Todos os dados"** (read-only) com tipo, nome original (Health), código, início, fim, duração, calorias, distância, fonte, dispositivo, rastreado.
- [ ] **T048** Verificar SC-005: editar atividade → verificar no Supabase `locally_edited = true`; rodar sync → valor editado permanece.

---

## Validação final

- [ ] **T050** `npm run lint` sem erros no código novo.
- [ ] **T051** `npm run mobile:ios` — percurso completo: Mais → Histórico → empty-state (sem dados) → com dados: overview → período/métrica → card de tipo → lista → filtros → detalhe → edição → salvar → badge aparece → toggle hidden → atividade some das métricas.
- [ ] **T052** Conferir totais do overview × `count`/`sum` em SQL para uma conta de teste real.
