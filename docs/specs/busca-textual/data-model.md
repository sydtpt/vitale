# Busca textual — data model

Companion de [spec.md](spec.md). Estruturas, contrato do núcleo e aritmética do backfill.

## 1. Nenhuma migration

As colunas envolvidas já existem em produção (conferido em 07/09/2026):

| Coluna | Tipo | Situação |
|---|---|---|
| `cities` | `jsonb` | em uso; `aliases` entra **dentro** do jsonb, sem DDL |
| `name_edited` | `boolean` | já no SELECT (subiu com o nome das rotas); **a busca não a usa** — ver §3 |
| `source_name` | `text` | já no SELECT |
| `device` | `text` | já no SELECT |
| `route_name` | `text` | **133 linhas** desde 07/09 — entrou na v1 |

O único DDL desejável é cosmético: atualizar o `comment on column public.activities.cities` para descrever `aliases`. Sem ele nada quebra.

## 2. `CityMark` ganha `aliases`

```ts
export interface CityMark {
  name: string;          // canônico, na língua da região (preferredLang)
  state?: string;
  country?: string;
  countryCode?: string;  // ISO 3166-1 alpha-2
  lat: number;           // centro do município
  lng: number;
  /** Variantes de nome vindas do OSM. Nunca repete `name`. Ausente = ainda não colhido. */
  aliases?: string[];
}
```

A forma é redefinida em dois lugares por restrição do Deno (`supabase/functions/_shared/geocode.ts` não resolve imports do shared) — as duas precisam do campo.

### Quais chaves viram apelido

`reverseGeocode` já pede `namedetails=1` (geocode.ts:74) e hoje lê **uma** chave, descartando o resto na linha 91. A colheita passa a ler, do mesmo objeto `namedetails`:

```
name:fr · name:nl · name:de · name:en · name:pt · alt_name · short_name
```

Regras de colheita:

- `alt_name` e `short_name` podem vir com várias grafias separadas por `;` — separar.
- Deduplicar **sem acento e em minúscula** contra `name` e entre si; o canônico nunca aparece em `aliases`.
- Descartar vazios e o que sobrar com menos de 2 caracteres.
- A lista é fechada de propósito: a resposta de Bruxelas traz **188 chaves** em `namedetails` (medido em 07/09/2026), e guardar todas infla 1.376 marcas com texto que ninguém digita. `pt` está na lista porque o dono do app é brasileiro e digitaria *Bruxelas*; `en` porque é o que o Strava escreve.
- Só sobrevive escrita latina — a normalização (§4) reduz a `[a-z0-9]`, então uma variante em cirílico ou grego viraria string vazia. Não é perda: nenhuma delas está na lista.

Resposta real de Bruxelas, conferida contra o Nominatim:

| Chave | Valor | Destino |
|---|---|---|
| `name` | Bruxelles - Brussel | descartado (bilíngue; é por isso que `geocode.ts` escolhe `name:fr`) |
| `name:fr` | **Bruxelles** | canônico — já é o `name` guardado |
| `name:nl` | Brussel | alias |
| `name:de` | Brüssel | **descartado** — dedupe sem acento colide com `Brussel` |
| `name:en` | Brussels | alias |
| `name:pt` | Bruxelas | alias |
| `short_name` | BXL | alias |

Ou seja `aliases = ["Brussel", "Brussels", "Bruxelas", "BXL"]` — **conferido rodando o código de produção contra o Nominatim ao vivo em 07/09/2026**, e cobrindo os três casos que o brief levantou.

O descarte de *Brüssel* é o dedupe funcionando, não uma perda: ele normaliza para `brussel`, igual ao neerlandês, e a busca normaliza do mesmo jeito — digitar `Brüssel` ou `brussel` acha a mesma marca. Uma string a menos por cidade, zero casos perdidos.

Leuven, na mesma checagem, devolveu `["Louvain", "Löwen", "Lovaina"]`. `alt_name` não existe em nenhuma das duas; a regra do `;` vale para as cidades que têm.

## 3. O peso do nome sai da frequência, não de `name_edited`

**Nenhuma mudança em `ACTIVITY_COLUMNS`, `ActivityRow`, `toActivity` ou no modelo `Activity`** — e desde `18b260b` nem seria preciso: a frente do nome das rotas já subiu `name_edited` e `route_name` até o cliente. Só que, medido em produção (07/09/2026), `name_edited` não sustenta o ranqueamento:

| Nome editado à mão | Ocorrências |
|---|---|
| Yoga | **31** |
| Tour de la Wallonie Picarde | 1 |
| Half Marathon | 1 |

São 33 marcados, 31 deles rótulo repetido — 6% de precisão. E os nomes que de fato informam **não estão marcados**: *Tour de la Meuse-Rhin*, *Morning Ride*, *Rotterdam Cycling*, *Amsterdam Cycling*, *Zaventem Cycling*, *Schaarbeek Running*, *Essen Cycling* têm `name_edited = false`, porque vieram já nomeados do Strava. Cobertura: 2 de 12.

A frequência do nome no acervo separa quase perfeitamente:

| Faixa | Nomes distintos | Atividades | Peso |
|---|---|---|---|
| >20 ocorrências | 4 (Yoga, Cycling, Treino, Running) | **526** | 20 |
| 4–20 | 2 | 12 | 45 |
| 1–3 | 12 | 17 | **80** |

Os 9 nomes que aparecem **uma única vez** são exatamente os informativos. A contagem é derivada da própria lista carregada, ao montar o índice — nenhuma coluna, nenhuma migration, nenhum plumbing. E se um dia ele nomear 200 pedaladas de "Commute", o nome vira rótulo sozinho, sem ninguém reconfigurar nada.

## 4. Normalização e casamento

```ts
const norm = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const tokenize = (s: string) => norm(s).split(/[^a-z0-9]+/).filter(Boolean);
```

- **Prefixo de palavra**, não trecho solto: `pierre` acha *Woluwe-Saint-Pierre* (o hífen é separador), `elles` não acha *Ixelles*.
- **Consulta de várias palavras casa por E**: `tour meuse` exige que ambos os tokens casem, em qualquer campo — `Tour de la Meuse-Rhin` casa, `Tour de la Wallonie Picarde` não.
- Consulta com menos de 2 caracteres não busca: devolve a lista íntegra.

## 5. Registro de campos buscáveis

O que torna CAP-8 verdade: um campo é uma entrada, não um ramo de código.

```ts
export type SearchFieldId = 'cidade' | 'cidade-apelido' | 'rota' | 'nome' | 'aparelho' | 'fonte';

export interface SearchableField {
  id: SearchFieldId;
  label: string;                        // rótulo de proveniência na tela
  weight: number;                       // faixa de ranqueamento
  extract(a: Activity): readonly string[];
}
```

| `id` | Peso | `extract` | Rótulo |
|---|---|---|---|
| `cidade` | 100 | `cities[].name` | "cidade" |
| `cidade-apelido` | 90 | `cities[].aliases[]` | "cidade" (mostrando o canônico) |
| `rota` rara (1–3) | 85 | `routeName` | — (visível no cartão) |
| `rota` comum (4–20) | 50 | `routeName` | — (visível no cartão) |
| `rota` rótulo (>20) | 22 | `routeName` | — (visível no cartão) |
| `nome` raro (1–3 no acervo) | 80 | `activityName` | "nome" |
| `aparelho` | 50 | `device` | "aparelho" |
| `fonte` | 45 | `sourceName` | "fonte" |
| `nome` comum (4–20) | 45 | `activityName` | "nome" |
| `nome` rótulo (>20) | 20 | `activityName` | "nome" |

O nome genérico fica na base da tabela, **não fora dela**: são os rótulos de fábrica que resgatam as corridas sem `cities` que carregam a cidade no próprio nome, como *Brussels Running*. Buscar `Cycling` continua devolvendo 175 atividades — mas nunca por cima de um casamento em cidade.

Desempate dentro da faixa: `startAt` decrescente, a mesma ordem do histórico.

`route_name` é o **único campo buscável visível no cartão** (proposta C, `18b260b`): quando ele casa, o texto é grifado onde está e nenhuma linha de proveniência nasce. Por isso não tem rótulo. As mesmas faixas de raridade do nome valem para ele — e são elas que rebaixam sozinhas os 22 "Boucle de Bruxelles" para peso 22, abaixo de qualquer casamento por cidade.

Entrada pronta para quando houver conteúdo (CAP-8): `gear.name`/`gear.notes` — hoje nenhuma atividade tem `gear_id`.

## 6. Índice e contrato

```ts
export interface IndexedActivity {
  activity: Activity;
  entries: readonly {
    field: SearchFieldId;
    label: string;
    weight: number;
    text: string;      // original, para a proveniência na tela
    tokens: readonly string[];  // normalizados, para casar
  }[];
}

export interface SearchHit {
  activity: Activity;
  score: number;
  match: { field: SearchFieldId; label: string; text: string };  // a entrada de maior peso que casou
  alsoMatched: readonly SearchFieldId[];
}

export function buildSearchIndex(activities: readonly Activity[]): IndexedActivity[];
export function searchActivities(query: string, index: readonly IndexedActivity[]): SearchHit[];
```

`buildSearchIndex` roda **uma vez por carga do store** — é o que mantém cada tecla em comparação de string pré-normalizada. Web e mobile memoizam sobre a mesma lista que já alimenta o histórico; nenhum dos dois normaliza no evento de digitação.

`searchActivities` é pura: mesma entrada, mesma saída, testável no shared junto das barreiras de arquitetura. É também a fronteira de troca — uma implementação futura sobre Postgres devolve o mesmo `SearchHit[]` e as telas não sabem a diferença.

### Custo, medido

| | Hoje (07/09/2026) | Set/2028 no ritmo de pico |
|---|---|---|
| Atividades | 555 | ~1.100 |
| Texto buscável / atividade | 462 bytes | ~500 bytes |
| Índice em memória | ~256 KB | ~550 KB |
| Custo por tecla | ~0,5 ms | ~1 ms |

Ritmo real do acervo: 78 atividades em 2023, 43 em 2024, 277 em 2025, 157 até setembro de 2026. O que fica pesado antes do filtro é o próprio `fetchActivities`, que já carrega o histórico inteiro hoje, com busca ou sem.

## 7. Backfill

Dois passes, ~992 chamadas, **~19 min** de relógio a 1,1 s por chamada. Rodam fora da edge function (ADR 0006/0007): `enrichCities` tem teto de 3 atividades por run porque 3 pedaladas × ~27 chamadas já encostam no wall-clock da edge, e drenar 275 atividades a 3 por tick seriam ~92 syncs.

### Passe B — cidades para corrida e caminhada (~738 chamadas, ~14 min)

A mudança em `enrichCities` (`supabase/functions/_shared/ingest.ts:597`) é **remover uma linha**:

```diff
-     .eq('activity_id', BIKE_ACTIVITY_ID)
      .eq('has_route', true)
      .is('cities', null)
```

`has_route = true` já é o filtro certo: ioga e musculação não têm rota e nunca entram. Medido em produção:

| Tipo | `activity_id` | Atividades | km mediano | Chamadas estimadas |
|---|---|---|---|---|
| Caminhada | 52 | 80 | 3,8 | 323 |
| Corrida | 37 | 57 | 8,7 | 415 |

As marcas criadas aqui já nascem com `aliases`, colhidos da mesma resposta.

### Passe A — apelidos nas 138 pedaladas já enriquecidas (254 chamadas, ~5 min)

O apelido depende da **cidade**, não da atividade. São 1.376 marcas em produção e apenas **254 cidades distintas** (`name` + `countryCode`):

1. Levantar as cidades distintas cujas marcas ainda não têm `aliases`.
2. Uma chamada por cidade, no **centro guardado na própria marca** (`lat`/`lng` do município), `zoom=10&namedetails=1`.
3. Carimbar o resultado em todas as marcas daquele par `name`+`countryCode`, sem tocar em `name`, na ordem das marcas, nem em marca que já tenha `aliases`.

Re-geocodificar as 138 atividades inteiras custaria ~3.700 chamadas (~68 min) para o mesmo resultado — é de onde vinham os 70 min estimados no brief.

**Ordem:** B primeiro, A depois. Os dois passes escrevem em conjuntos disjuntos de linhas (B só onde `cities is null`, A só onde `cities is not null`), então não correm risco de sobrescrita mútua nem com um sync em andamento.

### Verificação

```sql
-- deve devolver 0 depois de B
select count(*) from activities where has_route and cities is null;

-- deve devolver 0 depois de A
select count(*) from activities a
cross join lateral jsonb_array_elements(a.cities) c
where a.cities is not null and not (c ? 'aliases');

-- prova viva da CAP-3
select count(*) from activities a
cross join lateral jsonb_array_elements(a.cities) c
where c->'aliases' ? 'Brussels';
```

## 8. Os quatro estados de `cities`

`cities IS NULL` **não** quer dizer "pendente". Medido em produção (07/09/2026):

| `has_route` | `cities` | Qtd | Leitura na tela |
|---|---|---|---|
| `true` | `null` | **137** | pendente de verdade — o alvo do backfill |
| `true` | preenchida | 138 | pronto |
| `false` | `null` | **244** | ioga, musculação — nunca terá cidade; **não é pendência** |
| `false` | `[]` | 36 | resíduo: o passe rodou quando `has_route` ainda era `true` e a rota tinha <2 pontos |

Consequência para a CAP-7: a contagem de pendentes é

```sql
count(*) filter (where has_route and cities is null)
```

— hoje 137, **zero** depois do backfill, e daí em diante só atividade recém-sincronizada esperando o passe. Contar `cities is null` puro daria 381 e mentiria: as 244 sem rota não estão esperando nada.

Nota sobre `[]`: hoje, na prática, ele nunca significa "geocodificou e não achou cidade nenhuma" — as 36 linhas são todas rota inutilizável. O estado continua distinto de `null` por desenho (a migration original o previu), mas a tela não precisa de uma terceira frase para ele: sem rota, não há o que dizer sobre cidade.
