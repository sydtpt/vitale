# Brief — Busca textual nas atividades

> Levantamento de 07/09/2026. Entrada para `bmad-spec`. As decisões abaixo já
> foram tomadas pelo Sydnei — a spec parte delas, não as reabre.
>
> **Consumido em 07/09/2026 → [docs/specs/busca-textual/](../../docs/specs/busca-textual/spec.md)**
> (spec.md + data-model.md). O slug ficou `busca-textual`, não `pesquisa-por-cidade`:
> cidade é um dos quatro campos, não o todo. As cinco questões da seção "Aberto para a
> spec" estão respondidas lá. Este brief continua sendo o registro do levantamento —
> **onde ele divergir da spec, a spec vale**; as divergências conhecidas estão marcadas
> abaixo.

## O recorte

Um campo de busca por **texto livre** sobre as atividades. Digitar um pedaço de
texto e achar as atividades que casam — em **qualquer** dos campos de texto
relevantes, não só na cidade.

Casos que precisam funcionar:

- `Tervuren` → as atividades que passaram pela cidade
- `Tour de la Meuse` → a pedalada renomeada à mão
- `Garmin` → o que foi gravado pelo relógio novo
- `Brussels` → tem que achar **Bruxelles** (ver D2)

**Rua, bairro e ponto de interesse ficaram de fora** (ver "O que ficou de fora").

## Os campos de texto: o que existe e o que está preenchido

555 atividades em produção (07/09).

| Campo | Preenchido | Conteúdo real | Vale buscar? |
|---|---|---|---|
| `cities` (jsonb) | 138 | 253 cidades distintas, 5 países | **Sim** — o pedido original |
| `activity_name` | 555 (**só 33 editados**) | 185 "Yoga", 175 "Cycling", 105 "Treino", 61 "Running" | **Sim, com ressalva** ⚠️ |
| `source_name` | 555 | Apple Watch (430), Strava (106), iGPSPORT (8), Nike Run Club (8), Runna (3) | Sim |
| `device` | 540 | Watch6,14 · Apple Watch · Garmin Venu 4 · iPhone18,1 · GARMIN 4644 | Sim |
| `gear.name` / `gear.notes` | **0 atividades** | A tabela tem 2 bikes ("Riverside", "Cube Nuroad SLX" com notas), mas **nenhuma atividade tem `gear_id`** | Não hoje ⚠️ |
| `route_name` | **0** | Coluna existe (vinda de rotas-e-subidas), vazia em prod | Não hoje ⚠️ |
| `provider` | 555 | `healthkit` em 100% — zero poder de discriminação | Não |

### A ressalva do `activity_name`

Só **33 de 555** nomes foram editados à mão. O resto é rótulo genérico do
HealthKit. Buscar `Cycling` devolveria 175 resultados e nenhuma informação.

Mas os 33 editados são exatamente os que importam: *Tour de la Wallonie Picarde*,
*Tour de la Meuse-Rhin*, *Half Marathon*, *Morning Ride*. A coluna
**`name_edited` (boolean) separa os dois casos de graça** — é o sinal pronto para
ranquear ou filtrar.

## O achado: os campos se cobrem

Cruzando nome e cidades no mesmo registro:

| `activity_name` | `cities[0]` |
|---|---|
| **Schaarbeek** Cycling | **Schaerbeek** |
| **Brussels** Cycling | Schaerbeek |
| **Brussels** Running | `null` |

Duas consequências, e as duas ajudam:

1. **A mesma cidade aparece com duas grafias no mesmo registro** — o nome vem do
   Strava (inglês/holandês), as cidades vêm do Nominatim (francês, pela regra de
   região). Confirma a D2 com dado de dentro de casa.
2. **As corridas não têm `cities`, mas carregam a cidade no nome.** A busca
   multi-campo já resgata parte delas antes mesmo do backfill da D1.

## O que já existe no código

| Peça | Onde | Estado |
|---|---|---|
| `activities.cities` (jsonb: `name`, `state`, `country`, `countryCode`, `lat`, `lng`) | `supabase/migrations/20260722120000_activities_cities.sql` | em prod |
| Passe de reverse-geocode no ingest (Nominatim, `zoom=10`) | `supabase/functions/_shared/geocode.ts` | rodando |
| Leitura por país/cidade | `packages/shared/src/geo/country-explorer.ts` | alimenta o mapa-por-país |

`cities` é escrita **só** pelo UPDATE server-side do passe — a RPC
`sync_upsert_activities` não referencia a coluna, então re-push do HealthKit não
sobrescreve.

## Cobertura de cidades hoje

| Tipo | `activity_id` | Atividades | Com rota GPS | Com cidade |
|---|---|---|---|---|
| Ciclismo | 13 | 196 | 138 | **138** |
| Caminhada | 52 | 90 | 80 | **0** |
| Corrida | 37 | 72 | 57 | **0** |

**137 atividades têm rota e nenhuma cidade** — o passe só roda para bike.

Cidades mais frequentes: Bruxelles (281 marcas), Auderghem (96),
Woluwe-Saint-Pierre (84), Ixelles (82), Etterbeek (60), Watermael-Boitsfort (59),
Tervuren (43).

## Decisões travadas

### D1 — Cobertura: todas as atividades com GPS

Estender o passe de cidades para corrida e caminhada. ~137 rotas × ~27 chamadas,
1,1 s entre elas ≈ **70 min**, uma vez só. Sem provider novo.

> ⚠️ **Superado pela medição (07/09).** As corridas e caminhadas são curtas — 8,7 e
> 3,8 km medianos — e nunca chegam perto das ~27 amostras de uma pedalada: são **738
> chamadas ≈ 14 min**, não 70. E o backfill dos apelidos (D2) não exige re-geocodificar
> as 138 pedaladas: são **254 cidades distintas** para 1.376 marcas, logo 254 chamadas
> ≈ 5 min. Total real: **~992 chamadas ≈ 19 min**. Conta em
> [data-model.md §7](../../docs/specs/busca-textual/data-model.md).

**Por quê:** busca que cobre só pedaladas esconde 137 atividades sem avisar — o
resultado parece completo e está pela metade.

### D2 — Guardar os apelidos de idioma que o OSM já devolve

O `preferredLang()` localiza o nome pela região (Flandres → `nl`; Bruxelas e
Valônia → `fr`), então o acervo tem **Bruxelles**, **Leuven**, **Mechelen**,
**Brugge**, **Schaerbeek**. Digitar `Brussels`, `Brussel` ou `Bruxelas` não acha
as 281 marcas de Bruxelles; `Louvain` não acha Leuven; `Schaarbeek` não acha
Schaerbeek — mesmo o Strava tendo escrito assim no nome da atividade ao lado.

O `geocode.ts` **já pede `namedetails=1`** e já recebe todas as variantes — usa
uma e descarta o resto. Persistir os apelidos custa **zero chamadas extras**;
custa o re-run que a D1 já vai pagar.

### D3 — iPhone e web no mesmo passo

Histórico no celular **e** `/workout-history` no navegador.

### D4 — Campos no escopo da v1

Dentro: `cities` (+ apelidos), `activity_name`, `source_name`, `device`.
Fora por ora, porque estão **vazios em produção**, não por decisão de produto:
`route_name` e `gear.name`/`gear.notes`. Voltam sozinhos quando tiverem conteúdo
— vale a spec desenhar a busca de modo que **acrescentar campo não seja
reescrita**.

`provider` fica fora: `healthkit` em 100% das linhas não discrimina nada.

## Aberto para a spec — ✅ respondido em 07/09

As cinco foram fechadas na [spec](../../docs/specs/busca-textual/spec.md); o resumo
fica aqui para quem chegar pelo brief.

1. **Forma de persistir os apelidos (D2)** — `aliases[]` **dentro do `CityMark`**, não
   tabela normalizada: o jsonb já é snapshot denormalizado e a busca roda sobre o store
   já carregado, então normalizar exigiria fetch e join novos sem ganho. O conjunto é
   **fechado** (`name:fr/nl/de/en/pt`, `alt_name`, `short_name`) — a resposta de
   Bruxelas traz **188 chaves** em `namedetails`, e guardar todas é ruído. Nenhuma
   migration: `aliases` entra dentro do jsonb.
2. **Onde a busca roda** — **no cliente**, função pura no `packages/shared`.
   `fetchActivities` já traz o histórico inteiro paginado nos dois apps. Medido: ~1.100
   atividades em set/2028 no ritmo de pico (277/ano) e 462 bytes de texto por atividade
   dão ~1 ms por tecla, com o índice normalizado derivado **uma vez por carga do store**.
   O contrato `(consulta, atividades) → resultados ranqueados com proveniência` deixa a
   troca por Postgres ser uma implementação, não uma reescrita das telas.
3. **Ranqueamento** — cidade (100) > apelido de cidade (90) > nome editado (80) >
   aparelho (50) > fonte (45) > nome genérico (20). Genérico é **deranqueado, nunca
   excluído**: é ele que resgata as corridas sem `cities`. ⚠️ `name_edited` **não está**
   em `ACTIVITY_COLUMNS` nem no modelo `Activity` — precisa subir até o cliente.
4. **Mostrar onde casou** — proveniência obrigatória: cada resultado nomeia o campo e o
   texto que casou. O desenho do selo é questão aberta na spec.
5. **Normalização** — minúscula + sem acento (NFD), casamento por **prefixo de palavra**
   tokenizando em não-alfanumérico (`pierre` acha Woluwe-Saint-Pierre, `elles` não acha
   Ixelles). Consulta de várias palavras casa por **E**.

## Sinais de risco conhecidos

- **PostgREST corta em 1000 linhas sem erro.** São 555 atividades hoje — não
  estoura ainda, mas o filtro não deve nascer dependendo de "trouxe tudo".
- **Overpass público é inalcançável da edge function** (ADR 0035: 504 e timeout
  nos três espelhos). Não vale para o Nominatim, que funciona — mas é o aviso de
  que provider público dentro do ingest é terreno instável.
- A migration original prevê `null` = pendente e `[]` = enriquecida sem
  resultado. A busca precisa distinguir os dois, senão **"não achei" e "não sei"
  viram a mesma frase** na tela.

## O que ficou de fora

**Rua, bairro e ponto de interesse.** O passe geocodifica em `zoom=10` (nível
município) amostrando a cada 1.500 m, teto de 40 amostras. Rua exigiria zoom
~16–17 e amostragem na casa dos 100 m: ~400 chamadas ≈ 7 min por rota, vezes o
acervo, contra a política de uso do Nominatim público.

Isso provavelmente pede Overpass próprio ou extrato Geofabrik no Postgres — a
mesma alternativa que a ADR 0035 listou e não escolheu para o piso das rotas.
**Se rua voltar à mesa, decidir junto com o piso: uma infra, dois consumidores.**
