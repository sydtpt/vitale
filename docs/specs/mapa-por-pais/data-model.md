# Data-model: Visão detalhada por país

> **Sem migration nova.** `activities.cities` já é `jsonb` — aceita um campo novo na forma sem alterar schema. O único trabalho de dado é (a) mudar o *shape* do `CityMark` no shared + no geocoder, e (b) reprocessar os registros já enriquecidos antes da mudança (§5).

## 1. `CityMark.countryCode`

Adicionar um campo opcional a [`CityMark`](../../../packages/shared/src/models/index.ts#L359-L365):

```ts
export interface CityMark {
  name: string;
  state?: string;
  country?: string;
  /** ISO 3166-1 alpha-2 (ex.: "BR", "BE"), do `address.country_code` do Nominatim.
   *  Fonte estável p/ agrupar por país — independe do idioma da resposta.
   *  Ausente em marcas gravadas antes desta feature (ver backfill, §5). */
  countryCode?: string;
  lat: number;
  lng: number;
}
```

`country` (nome livre, já existente) continua só para exibição de fallback quando `countryCode` está ausente; deixa de ser a chave de agrupamento.

## 2. `geocode.ts` — capturar o código do país

Em [`reverseGeocode`](../../../supabase/functions/_shared/geocode.ts#L61-L96), o Nominatim já devolve `address.country_code` (ISO2 minúsculo) em toda resposta com endereço resolvido — hoje ignorado. Passa a preencher:

```ts
return {
  name: String(name),
  state: a.state ? String(a.state) : undefined,
  country: a.country ? String(a.country) : undefined,
  countryCode: a.country_code ? String(a.country_code).toUpperCase() : undefined,
  lat,
  lng,
};
```

Espelhar o mesmo campo na interface `CityMark` redefinida em `geocode.ts` ([linha 22](../../../supabase/functions/_shared/geocode.ts#L22-L28) — arquivo não importa `models/index.ts`, ver comentário no topo do arquivo).

## 3. Dataset estático de países — `packages/shared/src/constants/country-bboxes.ts`

Novo arquivo, mesmo padrão de [`map.ts`](../../../packages/shared/src/constants/map.ts) (dado + poucos helpers puros, sem I/O):

```ts
/** Bounding box [minLng, minLat, maxLng, maxLat]. */
export type Bbox = [number, number, number, number];

export const COUNTRY_BBOXES: Record<string /* ISO2 */, { name: string; bbox: Bbox }> = {
  BR: { name: 'Brasil', bbox: [-73.99, -33.75, -28.84, 5.27] },
  BE: { name: 'Bélgica', bbox: [2.51, 49.50, 6.16, 51.51] },
  FR: { name: 'França', bbox: [-5.14, 41.33, 9.56, 51.09] },
  // ... crescer conforme o histórico do usuário cobrir novos países.
};

/** Emoji de bandeira a partir do ISO2 — regional indicator symbols (sem dataset por país). */
export function flagEmoji(code: string): string {
  return [...code.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('');
}
```

> **Cobertura do dataset:** só precisa ter entrada para países onde o usuário efetivamente pedalou — cresce sob demanda (não é preciso um dataset mundial completo no dia 1). Um país sem entrada em `COUNTRY_BBOXES` fica sem classificação por bbox (fallback do fallback): nesse caso a cidade é ignorada na agregação por país em vez de quebrar.

## 4. Módulo de derivação pura — `packages/shared/src/geo/country-explorer.ts`

Mesmo padrão de [`fitness/dedupe.ts`](../../../packages/shared/src/fitness/dedupe.ts) / [`health/aggregate.ts`](../../../packages/shared/src/health/aggregate.ts): funções puras sobre `Activity[]`, sem I/O, reusáveis por web (e mobile, se um dia replicar).

```ts
/** Resumo de um país no histórico — insumo da grade de seleção (US1) e do
 *  cabeçalho da tela de mapa. */
export interface CountrySummary {
  code: string;          // ISO2
  name: string;          // COUNTRY_BBOXES[code].name, ou o `city.country` bruto se código ausente do dataset
  flag: string;          // flagEmoji(code)
  rideCount: number;
  distanceM: number;
  lastRideAt: string;    // ISO — mais recente
}

/** Cidade agregada dentro de um país — uma linha da lista de cidades (US3). */
export interface CountryCityMark extends CityMark {
  visitCount: number;    // quantas pedaladas passaram por ela
}

/** Bounds Leaflet-style [[south,west],[north,east]] — enquadramento inicial do mapa. */
export type ViewportBounds = [[number, number], [number, number]];

/** Resolve o país de uma marca: countryCode direto; sem ele, testa lat/lng
 *  contra cada bbox de COUNTRY_BBOXES esticado 50 km (fallback p/ registros
 *  antigos ainda não reprocessados — ver §5). null se nenhum bbox bate. */
export function countryForCity(city: CityMark): string | null;

/** Agrupa as atividades do tipo por país cruzado (rideCount conta atividades
 *  distintas, não cidades). Só considera atividades com `cities` não-vazio.
 *  Ordenado por rideCount desc. */
export function ridesByCountry(activities: readonly Activity[]): CountrySummary[];

/** Atividades cujo `cities` inclui ao menos uma marca do país `code`. */
export function activitiesInCountry(activities: readonly Activity[], code: string): Activity[];

/** Cidades distintas do país, dedupe por nome normalizado (NFD sem acento,
 *  lowercase), ordenadas alfabeticamente. Filtra por dentro do bbox do país
 *  ±50 km mesmo quando a marca já tem countryCode == code (uma marca pode ter
 *  o country_code do Nominatim correto mas ainda cair fora do buffer, num
 *  ponto de fronteira ambíguo — bbox é o critério final de inclusão na lista,
 *  countryCode é o critério de "pertence a este país"). */
export function citiesInCountry(activities: readonly Activity[], code: string): CountryCityMark[];

/** Enquadramento do mapa: bbox do país como piso; para cada atividade do país,
 *  estica os 4 lados até no máx. `MAX_BORDER_BUFFER_KM` (50) para incluir
 *  pontos de rota que ultrapassam a borda — nunca além disso (pontos mais
 *  distantes ficam fora do enquadramento, por design). */
export function countryViewport(
  code: string,
  routes: readonly ActivityRoutePoint[][],
): ViewportBounds | null;
```

### Regras de cálculo

- **`countryForCity`** — critério 1: `city.countryCode` igual ao código do país (comparação direta, sem geometria). Critério 2 (fallback): `COUNTRY_BBOXES[code]` existe e `[city.lng, city.lat]` cai dentro do bbox esticado 50 km em todos os lados (conversão km→graus: `dLat = km/111`; `dLng = km/(111 * cos(lat))`).
- **`ridesByCountry`** — para cada atividade com `cities?.length`, resolve o conjunto de países distintos cruzados (`countryForCity` por marca, dedupe); incrementa `rideCount`/`distanceM`/`lastRideAt` de cada país presente. Uma pedalada que passa por 2 países conta como 1 pedalada nos dois, mas com a **distância rateada** — ver §4.1.
- **`citiesInCountry`** — filtra `activitiesInCountry`, achata as `cities`, mantém as que passam no teste de bbox±50km do país (mesmo critério de `countryForCity`, aplicado sempre — não só no fallback), agrupa por nome normalizado somando `visitCount`.
- **`countryViewport`** — começa com o bbox de `COUNTRY_BBOXES[code]`. Para cada ponto de cada rota em `routes`, se estiver fora do bbox mas dentro do buffer de 50 km, estica o lado correspondente até esse ponto (nunca além do limite de 50 km, mesmo que o ponto esteja mais longe). Retorna `null` se `code` não está no dataset (chamador mantém o enquadramento anterior ou usa um fallback genérico de `fitBounds` só nas rotas).

## 4.1. Rateio por país (`countryShares`)

> Adicionado em 2026-08-24. Até então todo agregado somava a atividade **inteira** em cada país que ela tocou: uma pedalada BE→FR de 85 km contava 85 km na Bélgica *e* 85 km na França (idem subida, tempo, calorias e os máximos).

```ts
/** Fração (0..1) de cada atividade que aconteceu dentro de `code`, por activity.id. */
export function countryShares(
  activities: readonly Activity[],
  routes: ReadonlyMap<string, readonly ActivityRoutePoint[]>,
  code: string,
): Map<string, number>;

/** Agregados do país. Todo volume entra multiplicado pela fração; `rideCount` não. */
export function countryStats(
  activities: readonly Activity[],
  shares: ReadonlyMap<string, number>,
): CountryStats;

/** As linhas do mapa: as rotas recortadas ao território do país, pela mesma
 *  atribuição por segmento. Achatado — mapa e enquadramento não se importam com
 *  de qual treino é cada linha. Uma rota que sai e volta vira vários pedaços. */
export function routesInCountry(
  activities: readonly Activity[],
  routes: ReadonlyMap<string, readonly ActivityRoutePoint[]>,
  code: string,
): ActivityRoutePoint[][];
```

### Cascata de três níveis

| Situação | Fração | Custo |
|---|---|---|
| A atividade não cruza o país | `0` | — |
| Cruza só esse país (caso comum) | `1` | não olha a rota |
| Cruza N países, com rota disponível | rateio geométrico (abaixo) | 1 haversine por segmento do overview |
| Cruza N países, sem rota (carregando, ou sem GPS) | `cidades no país / total de cidades resolvidas` | — |

**Invariante:** para uma mesma atividade, a soma das frações de todos os países que ela cruza é 1 — nenhum metro se perde nem se duplica.

### Rateio geométrico

Cada ponto da rota é classificado num país; cada segmento vale seu comprimento (haversine, de `geo/distance.ts`), e o segmento que cruza a fronteira entra partido no ponto exato do cruzamento. `share = metrosNoPaís / metrosTotais`.

**A fronteira é a de verdade** — `countryAt` (§4.2), ponto-em-polígono contra o contorno real do país. Quando ele não decide (país fora do asset, ponto sobre a água), cai na **`CityMark` da atividade mais próxima**; a busca do vizinho mais próximo usa distância planar com a longitude encolhida pelo `cos(lat)`, já que só precisamos da ordem entre candidatos.

Esse fallback nunca é bom perto da fronteira, e foi o que motivou os polígonos: entre Aachen (DE, 6.083) e Vaals (NL, 5.921) a bissetriz corre em ~6.00, enquanto a fronteira real passa em ~6.02 — o traçado do mapa era cortado ~2 km dentro da Alemanha, no meio da B1. Também não dá para usar `inBbox`: com o buffer de `MAX_BORDER_BUFFER_KM` (50 km) os bboxes de vizinhos se sobrepõem exatamente na faixa que interessa (o bbox da Alemanha começa em 5.87 — Vaals cai dentro dele).

O ponto de cruzamento sai por **bissecção sobre o próprio classificador** (20 iterações ≈ centímetros), então a linha termina em cima da fronteira e não no ponto de rota mais próximo dela. Vale para os dois classificadores.

## 4.2. Contornos dos países (`country-borders`)

`countryAt(lng, lat, candidates)` responde de que país é um ponto, testando só os candidatos (as cidades da atividade já dizem quais países estão em jogo — quase sempre 2).

- **Asset:** [`geo/country-borders.data.ts`](../../../packages/shared/src/geo/country-borders.data.ts), gerado por [`scripts/build-country-borders.mjs`](../../../packages/shared/scripts/build-country-borders.mjs) a partir do `@geo-maps/countries-land-100m@0.6.0` (120 MB, **não** é dependência do repo — o script recebe o caminho do arquivo, ver o cabeçalho dele).
- **Como 120 MB viram ~1 MB:** só os países do `COUNTRY_BBOXES`; ilhotas com menos de 2 km de diagonal fora; **fronteira terrestre preservada em resolução cheia** (~100 m) — todo vértice a ≤2 km de vértice de outro país é âncora intocável — e litoral simplificado a ~2 km, que não separa ninguém; cada anel codificado como polyline (delta + varint base64, precisão 1e-4 ≈ 11 m). Só a codificação tira 3,7 MB → 0,93 MB.
- **Runtime:** decodifica um país no primeiro uso e cacheia; bbox por anel descarta a maioria dos testes antes de percorrer vértice nenhum; ray casting sobre `Float64Array`.
- **Peso:** o asset é injetado (`resolve?: CountryResolver`), não importado pelo `country-explorer`. Com `"sideEffects": false` no `packages/shared/package.json`, ele fica **só no chunk da tela de país** (1,05 MB / 640 kB gzip) — o bundle inicial da web não o vê. No mobile não há code splitting, então soma ~1 MB ao app.

### Recorte do traçado (`routesInCountry`)

O mesmo critério que mede também **corta**: o mapa de um país desenha só os trechos atribuídos a ele, terminando **em cima da fronteira** (o segmento que cruza é partido no ponto interpolado, não descartado inteiro). Um trecho é uma sequência contígua de segmentos do país — uma rota que sai e volta vira mais de uma linha, e a emenda é exata (a linha do país vizinho retoma no ponto onde esta parou). Pedaços de um ponto só são descartados; quando não dá para atribuir (pedalada de um país só, ou sem contorno nem cidade resolvida) a rota entra inteira.

Efeito colateral no enquadramento: como `countryViewport` recebe as rotas já recortadas, ele praticamente não precisa mais esticar além da borda — o trecho estrangeiro que motivava o buffer de 50 km não é mais desenhado. O buffer continua no código como guarda (US2) e para pontos de fronteira que a atribuição manteve.

### Aproximações aceitas

- **Subida, tempo e calorias são rateados pela fração de DISTÂNCIA**, não por geometria própria: o `route_overview` que alimenta o cálculo é só `[lat,lng]`, sem altitude nem timestamp ([activities.ts](../../../packages/shared/src/data/activities.ts#L216-L218)). Um trecho de 30% da distância leva 30% da subida, mesmo que a serra tenha ficado do outro lado da fronteira.
- **A rota é o overview reduzido** (1 ponto a cada 40, §T15/T16 do tasks): o comprimento absoluto sai subestimado, mas o viés é uniforme ao longo da rota e some na razão.
- **`rideCount` não é rateado** — a pedalada aconteceu nos dois países e conta como 1 em cada. Consequência: a soma dos `rideCount` de todos os países é maior que o nº de pedaladas distintas.
- **`longestRideM`/`maxClimbM` passam a ser o maior TRECHO dentro do país**, não a maior pedalada que passou por ele — daí o "aqui" nos rótulos da faixa.
- **`CountrySummary.distanceM` usa sempre o rateio por cidades**, nunca o geométrico: a grade de seleção (US1) é desenhada antes de qualquer rota ser carregada.

## 5. Backfill dos registros já enriquecidos

Atividades de bike já processadas pelo `enrichCities` antes desta mudança têm `cities` não-nulo mas **sem** `countryCode` em cada marca. Como `enrichCities` só reprocessa linhas com `cities is null` ([ingest.ts:556](../../../supabase/functions/_shared/ingest.ts#L556)), essas linhas não seriam refeitas sozinhas.

**Passo único, manual** (mesmo padrão de operação direta no Postgres de prod já usado no projeto — ver memória `supabase-management-api`):

```sql
update public.activities
set cities = null
where activity_id = 13 and cities is not null;
```

Depois disso, o `enrichCities` (chamado a cada ingest, [até 3 atividades por run](../../../supabase/functions/_shared/ingest.ts#L540)) drena o histórico normalmente e repopula `cities` já com `countryCode`. Não é preciso nenhum código novo de backfill — só esse UPDATE de uma vez, e paciência (ou disparar o ingest manualmente algumas vezes) até o histórico de bike inteiro voltar a ficar não-nulo.

Enquanto o drain roda, `countryForCity` cobre as duas situações (com/sem `countryCode`) pelo fallback de bbox — a tela funciona mesmo com o backfill parcialmente concluído.
