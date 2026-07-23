# Plan: Visão detalhada por país

> Plano técnico para [spec.md](./spec.md). Modelo de dados em [data-model.md](./data-model.md); tarefas em [tasks.md](./tasks.md).

## 1. Contexto técnico

| Item | Valor |
|------|-------|
| Frontend | Angular 20, standalone components, OnPush, signals/`computed()`, `inject()` |
| Backend | Supabase (Postgres + Auth + RLS); geocoding server-side em [`geocode.ts`](../../../supabase/functions/_shared/geocode.ts) (Deno, edge function) |
| Tabelas | `activities` (coluna `cities` jsonb, sem migration nova), `activity_routes` (rota GPS, já existe) |
| Mapa | Leaflet + camada MapLibre GL (OpenFreeMap), mesmo padrão de [`activity-map.component.ts`](../../../web/src/app/features/workout-history/components/activity-map.component.ts) |
| Tokens/estilo | SCSS com variáveis CSS + tokens do `@vitale/shared` — sem magic values |
| Roteamento | Lazy `loadComponent` em [main.ts](../../../web/src/main.ts) |

## 2. Constitution Check (convenções do projeto)

- ✅ **Standalone + OnPush** nos componentes novos.
- ✅ **Estado via signals/`computed()`** — a tela de país deriva tudo de `ActivitiesStore.activities()` já carregado; o único fetch novo é o carregamento em lote das rotas GPS do país selecionado.
- ✅ **Tokens, sem magic values** — cores das rotas/UI do design system, igual ao mapa de atividade única.
- ✅ **Shared read-only + derivação em módulo próprio** — `CityMark.countryCode` é campo de modelo (fica em `models/index.ts`); toda a lógica de agrupamento/geometria fica em `geo/country-explorer.ts`, ao lado de `fitness/dedupe.ts` e `health/aggregate.ts` (mesmo padrão: módulo de derivação pura fora de `models/`).
- ⚠️ **Cross-feature (backend):** `geocode.ts` muda o *shape* gravado em `activities.cities`; não é migration, mas é uma mudança de contrato do ingest — coordenar com a feature `sync-atividades`/conexões (mesmo pipeline que grava `cities` hoje).

## 3. Arquitetura

```
packages/shared/src/
   models/index.ts                    ← CityMark ganha countryCode?: string
   constants/country-bboxes.ts (novo) ← COUNTRY_BBOXES + flagEmoji()
   geo/country-explorer.ts (novo)     ← ridesByCountry, activitiesInCountry,
                                          citiesInCountry, countryViewport, countryForCity
   index.ts                           ← + export * from './constants/country-bboxes'
                                          + export * from './geo/country-explorer'

supabase/functions/_shared/geocode.ts ← reverseGeocode passa a ler address.country_code

web/src/app/features/workout-history/
   data/activities.store.ts           ← + loadRoutes(ids: string[]) em lote
   pages/
     activity-type-page.component.*   ← + botão "Visão detalhada" no header
     activity-country-page.component.* (novo) ← grade de países | mapa+cidades+treinos
   components/
     country-picker.component.* (novo)   ← grade de países (US1)
     country-map.component.* (novo)      ← várias polylines + fitBounds ao viewport
     country-city-list.component.* (novo) ← lista de cidades (US3)
```

**Princípio:** zero refetch de `activities` — a tela de país deriva do mesmo `signal<Activity[]>` já em memória (mesma decisão de performance do [historico-treinos](../historico-treinos/plan.md#41-agregação-no-cliente-mvp)). Só as rotas GPS completas (pesadas, não vêm no `SELECT` inicial) são buscadas sob demanda, em lote, quando o país é selecionado.

### Rotas (adicionar em [main.ts](../../../web/src/main.ts))

| Rota | Componente | Ordem |
|------|------------|-------|
| `/workout-history/:slug/mapa` | `ActivityCountryPageComponent` (novo) | **Deve vir antes** de `workout-history/:slug/:id` |
| `/workout-history/:slug/:id` | `ActivityDetailPageComponent` (já existe) | — |

> ⚠️ **Armadilha de roteamento:** o Angular Router casa rotas na ordem em que aparecem no array. `:id` é um parâmetro — casa com **qualquer** segmento, inclusive `"mapa"`. Se a rota de detalhe continuar registrada antes da nova, `/workout-history/ciclismo/mapa` vai tentar abrir o detalhe da atividade `"mapa"` (id inexistente) em vez da tela nova. A rota `.../mapa` **precisa** ser inserida no array de rotas do `main.ts` antes de `workout-history/:slug/:id` (linhas [56-61](../../../web/src/main.ts#L56-L61) hoje).

País selecionado trafega via query param (`?country=BE`), no mesmo padrão dos filtros existentes ([`filtersToQueryParams`/`queryParamsToFilters`](../../../web/src/app/features/workout-history/data/activity-list.ts)) — bookmarkable, e a troca de país (US5) só atualiza o query param sem recarregar a página.

## 4. Fluxo da tela nova (`ActivityCountryPageComponent`)

1. Lê `:slug` (igual à `activity-type-page`) e `?country=`.
2. Calcula `countries = ridesByCountry(store.activities().filter(a => a.activityId === activityIdForSlug(slug)))`.
3. **Sem `?country=`:**
   - `countries.length === 0` → estado vazio ("nenhuma cidade resolvida ainda — o enriquecimento roda aos poucos").
   - `countries.length === 1` → redireciona (`replaceUrl`) para `?country=<único código>`.
   - `countries.length > 1` → renderiza `country-picker` (US1); clique navega para `?country=<code>`.
4. **Com `?country=`:**
   - `rides = activitiesInCountry(...)`, `cities = citiesInCountry(...)`.
   - Carrega rotas em lote (`store.loadRoutes(rides.map(r => r.id))`).
   - `viewport = countryViewport(code, rotas carregadas)`.
   - Renderiza cabeçalho (bandeira + nome + stats), `country-map` (US2), `country-city-list` (US3), lista de treinos reusando `rt-activity-item` (US4).
   - Seletor de país no cabeçalho (US5) troca só o query param.

## 5. Decisões técnicas chave

### 5.1 Classificação de país: `countryCode` primeiro, bbox como fallback
Ver [data-model §1 e §4](./data-model.md). Evitar depender só de string livre (`city.country`) porque o Nominatim não recebe `accept-language` em `geocode.ts` hoje — o idioma da resposta não é garantido estável entre chamadas, o que tornaria o agrupamento por nome frágil. `countryCode` (ISO2) é determinístico independente de idioma.

### 5.2 Enquadramento do mapa (bbox do país + buffer de 50 km)
`countryViewport` nunca *encolhe* abaixo do bbox do país (US2, cenário 2) e nunca estica além de 50 km por eixo (US2, cenário 3), mesmo que uma rota vá muito mais longe (ex. uma viagem para outro continente com o GPS ainda ligado por engano) — esses pontos ficam fora do enquadramento por design, evitando que um outlier raro zere o zoom útil do mapa do país.

### 5.3 Carregamento de rotas em lote
Hoje [`ActivitiesStore.loadRoute`](../../../web/src/app/features/workout-history/data/activities.store.ts#L152-L169) busca uma rota por vez (`activity_routes` filtrado por um `activity_id`). Para a tela de país (dezenas de rotas de uma vez), adicionar `loadRoutes(ids: string[])`:
```ts
async loadRoutes(ids: string[]): Promise<Map<string, ActivityRoutePoint[]>> {
  const missing = ids.filter((id) => !this._routes.has(id));
  if (missing.length > 0) {
    const { data, error } = await supabase
      .from('activity_routes')
      .select('activity_id, points')
      .in('activity_id', missing);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      this._routes.set(row.activity_id, (row.points ?? []).filter(/* mesmo filtro de loadRoute */));
    }
  }
  return new Map(ids.map((id) => [id, this._routes.get(id) ?? []]));
}
```
Reusa o mesmo cache `_routes` (Map) já existente — abrir o país duas vezes, ou abrir o detalhe de uma atividade já vista no mapa do país, não refaz o fetch.

### 5.4 Coexistência com backfill parcial
Enquanto o backfill de `countryCode` (data-model §5) drena o histórico (3 atividades por run do ingest), a tela funciona com uma mistura de marcas com/sem `countryCode` — `countryForCity` cobre os dois casos transparentemente. Nenhuma feature-flag ou estado de "carregando backfill" é necessário; o resultado só fica mais preciso à medida que o drain avança.

### 5.5 Performance de renderização (muitas rotas)
`country-map.component` desenha uma polyline por atividade — sem a casing branca dupla do mapa de atividade única (custo 2x por rota, dispensável quando são dezenas delas). Cada rota é reduzida a no máximo ~150 pontos antes de desenhar (mesma função `downsample` já usada em [`share-card-html.ts`](../../../mobile/src/lib/share-card-html.ts#L115-L123) — mover para um lugar compartilhável se for reusada aqui, ou reimplementar localmente: é uma função de ~8 linhas). Isso mantém o mapa fluido mesmo com um histórico de centenas de pedaladas no mesmo país, sem perder a forma visível da rota nesse nível de zoom.

## 6. Sequenciamento

1. **Shared** — `CityMark.countryCode`, `country-bboxes.ts`, `geo/country-explorer.ts` + testes puros (bbox±buffer, dedupe de cidade, agrupamento por país). Não depende de nada além do modelo já existente.
2. **Backend** — `geocode.ts` grava `countryCode`; rodar o UPDATE de backfill (data-model §5) e deixar o ingest drenar.
3. **Web** — rota nova (respeitando a ordem no `main.ts`), `loadRoutes` no store, botão na `activity-type-page`, e os 3 componentes novos (`country-picker`, `country-map`, `country-city-list`) + a página que os orquestra.

Etapas 1 e 2 podem ir juntas num PR (mudança pequena, sem migration); a etapa 3 é o grosso do trabalho e pode ser desenvolvida em paralelo assumindo que `countryCode` eventualmente chega (o fallback de bbox já cobre o caso "ainda não").

## 7. Prontidão para mobile (implementação futura)

A feature foi construída **de propósito** com toda a lógica de domínio no `@vitale/shared`, para o mobile replicar só a UI depois — sem duplicar regra nenhuma.

**Já pronto e reusável no mobile hoje** (mobile mapeia `@vitale/shared` → `packages/shared/src` em [`tsconfig`](../../../mobile/tsconfig.json#L6) e [`babel.config.js`](../../../mobile/babel.config.js#L10), então importa direto da fonte, sem build):
- `CityMark.countryCode`, `COUNTRY_BBOXES`/`flagEmoji`/`countryName`, e todo o `geo/country-explorer.ts` (`ridesByCountry`, `activitiesInCountry`, `citiesInCountry`, `countryViewport`, `countryForCity`). Só usam `Math`, `String.fromCodePoint` e `String.normalize('NFD')` — todos suportados pelo Hermes (RN). Nenhuma dependência de DOM/Angular.
- O mobile já lê `Activity.cities` nos stores e no cartão de compartilhamento, então o dado de entrada já circula lá.

**O que faltaria para o mobile (só UI + plumbing, nenhuma regra nova):**
1. **Carregar rotas em lote** — o [`activities.store` do mobile](../../../mobile/src/store/activities.store.ts) precisa de um equivalente ao `loadRoutes(ids)` do web (mesma query `in('activity_id', ids)` no Supabase).
2. **Mapa multi-rota** — o mobile desenha rotas num WebView Leaflet ([`map-html.ts`](../../../mobile/src/lib/map-html.ts)); estender para receber várias polylines + o `viewport` calculado por `countryViewport` (o web usa Leaflet nativo, o mobile usa o mesmo Leaflet dentro do WebView — a lógica de enquadramento é a mesma `ViewportBounds`).
3. **Telas RN** — grade de países, lista de cidades e cabeçalho como componentes React Native (equivalentes aos 3 componentes Angular), plus a entrada (botão "Visão detalhada") na tela de tipo do histórico mobile ([mobile-historico-treinos](../mobile-historico-treinos/spec.md)).

Ou seja: quando for a hora do mobile, é um spec de UI puro — a camada de dados/derivação deste spec serve os dois.
