# Nome das rotas — o molde é do código, a região é do modelo

> **Status:** especificada em 07/09/2026, **nada construído**. Os nomes desta spec foram
> gerados à mão sobre o payload real, como prova barata antes do código — o modelo ainda não
> rodou uma única vez.
> Decisão: [ADR 0041](../../decisions/0041-o-nome-da-rota-e-molde-com-lacuna.md).
> Data-model: [data-model.md](data-model.md).
> Tarefas: [tasks](../../../_bmad-output/implementation-artifacts/nome-das-rotas/tasks.md).

## 1. Problema

175 das 196 pedaladas do dono se chamam literalmente **`Cycling`**.

Ele chegou com uma queixa mais específica — numa pedalada **Casa → B**, o nome vem com a
cidade **onde ele mora**, quando o passeio foi para o outro lado. Isso é verdade, e acontece
em ~10 pedaladas (`Schaarbeek Cycling`, `Brussels Cycling`). Mas é a minoria: o problema
dominante não é o nome errado, é a **ausência de nome**.

O Orbe nunca gerou nome. Copia o `activityName` do HealthKit ou o `raw.name` do
intervals.icu, que por sua vez espelha o Garmin — e o Garmin nomeia pelo **ponto de partida**.
Numa Casa → B ele acerta por acidente quando o passeio é loop, e erra sempre que o dono vai
embora.

## 2. O que ele quer, provado pelo que ele mesmo escreveu

Duas pedaladas em 196 foram nomeadas à mão:

| Nome dele | km | O que a rota atravessou |
|---|---|---|
| `Tour de la Wallonie Picarde` | 151 | Tournai, Antoing, Mons, Condé-sur-l'Escaut, La Louvière |
| `Tour de la Meuse-Rhin` | 114 | Aachen (DE), Maastricht (NL), Vaals, Gemmenich, Liège |

O critério não é geográfico, é **cultural**: ele nomeia pela região histórica que o passeio
explorou. A segunda pegou a Euregio de três países, incluindo o ponto tríplice em Gemmenich.

Isso define o teto da feature. Nomes como *Pajottenland*, *Hageland*, *Petit-Brabant*,
*Rupelstreek* ou *Groene Hart* **não existem em nenhum campo do banco** — não são deriváveis,
só conhecidos.

## 3. O terreno, medido em produção (07/09/2026)

| Medida | Valor |
|---|---|
| Pedaladas | 196 |
| Com rota | 138 |
| Com `cities` preenchido | **138 de 138**, média de 10 cidades ordenadas |
| Com `name_edited = true` | **1** |

A cobertura total do `cities` é o que torna a feature barata: o payload já existe, ordenado
ao longo do percurso, escrito pelo passe `enrichCities`
([ingest.ts:597](../../../supabase/functions/_shared/ingest.ts#L597)).

### As formas

| Forma | Pedaladas | km médio |
|---|---|---|
| Casa → loop → Casa | 75 | 36 |
| Casa → B | 23 | 43 |
| A → B | 19 | 45 |
| A → Casa | 18 | 37 |
| A → loop → A (em viagem) | 3 | 27 |

Cobrem 97%. A quinta forma não estava no pedido do dono — apareceu no dado.

### A Casa mudou de lugar

| Cluster de partida | Vezes | Vigência |
|---|---|---|
| `50.852, 4.344` | ~83 | jan/2025 → **07/06/2026** |
| `50.872, 4.373` | 9 | **21/06/2026** → hoje |

~3 km de distância, **zero meses de sobreposição**. Casa é entidade com vigência, não
constante. Ver [ADR 0034](../../decisions/0034-bicicleta-e-entidade-com-heranca-por-data.md),
cujo molde de `active_from`/`active_to` esta spec copia.

## 4. O desenho

Duas camadas com naturezas diferentes — a separação que sustenta tudo o mais.

```
packages/shared/src/routes/     PURO — sem rede, sem SDK, testável
  anchor.ts    agrupa pontos de partida → vigências de Casa
  shape.ts     (rota, âncora) → forma + ponta notável + país dominante
  molde.ts     (forma, região, artigo, língua) → a frase final
  verificar.ts a justificativa do modelo se sustenta nas cidades enviadas?

supabase/functions/_shared/ingest.ts
  enrichRouteNames()   um passe, no molde do enrichCities
    → Narrador (ADR 0040), provedor via AI_PROVIDER
```

O modelo entra **uma vez por pedalada, para sempre**, e devolve campos, não frase:

```json
{ "regiao": "Pajottenland", "artigo": "le", "lingua": "fr",
  "justificativa": ["Sint-Martens-Lennik", "Strijtem", "Pamel"] }
```

O molde contrai a gramática do lado determinístico (*de* + *le* → **du**), porque contração é
regra e regra mora em código.

## 5. A gramática dos nomes

**Região vence trajeto.** Quando uma região forte domina a rota, ela ganha, seja qual for a
forma. A forma só escolhe o verbo quando não há região.

Língua: **país dominante na rota**, empate desempatado pela partida. Bélgica → francês,
inclusive nas rotas flamengas, por decisão do dono (ADR 0041, invariante 5).

| Situação | Molde (fr) | Molde (nl) | Molde (pt) |
|---|---|---|---|
| Região forte, passeio longo | `Tour du/de la {região}` | `Ronde van {streek}` | `Tour do/da {região}` |
| Região forte, loop curto | `Boucle de/du {região}` | `Rondje {streek}` | `Volta pelo/pela {região}` |
| Casa → B, sem região | `Aller à {destino}` | `Naar {stad}` | `Ida a {destino}` |
| A → Casa, sem região | `Retour de {origem}` | `Terug van {stad}` | `Volta de {origem}` |
| A → B, sem região | `De {A} à {B}` | `Van {A} naar {B}` | `De {A} a {B}` |
| Sem região e sem forma útil | *(sem nome)* | | |

O destino é a cidade **notável** da ponta, não literalmente a última do array — `Steenokkerzeel`
é a última, mas `Zaventem` é a que o dono reconhece.

## 6. Os 20 exemplos aprovados (07/09/2026)

Gerados à mão sobre o payload real, aprovados pelo dono, e **é isto que o passe tem que
reproduzir**. Servem de golden set — ver T1.6 do tasks.

| Dia | km | Hoje | Nome esperado |
|---|---|---|---|
| 15/08/26 | 75 | `Schaarbeek Cycling` | **Tour du Pajottenland** |
| 25/07/26 | 106 | `Schaarbeek Cycling` | **Boucle d'Anvers par le Rupel** |
| 23/08/26 | 103 | `Schaarbeek Cycling` | **Tour du Petit-Brabant** |
| 21/07/26 | 151 | `Tour de la Wallonie Picarde` | **Tour de la Wallonie picarde** |
| 18/07/26 | 114 | `Tour de la Meuse-Rhin` | **Tour de la Meuse-Rhin** |
| 24/08/25 | 55 | `Cycling` | **Tour du Hageland** |
| 27/07/26 | 50 | `Schaarbeek Cycling` | **Aller à Hal** |
| 29/07/26 | 33 | `Brussels Cycling` | **Boucle de la forêt de Soignes** |
| 02/07/26 | 41 | `Cycling` | **La grande ceinture de Bruxelles** |
| 21/01/26 | 27 | `Cycling` | **Boucle du canal de Charleroi** |
| 25/05/26 | 29 | `Cycling` | **De Namur à Dinant par la Meuse** |
| 28/12/25 | 58 | `Cycling` | **Retour de Mortsel par Malines** |
| 21/06/26 | 27 | `Cycling` | **Retour de Malines** |
| 12/08/26 | 15 | `Zaventem Cycling` | **Retour de Zaventem** |
| 12/08/26 | 14 | `Brussels Cycling` | **Aller à Zaventem** |
| 29/08/26 | 57 | `Rotterdam Cycling` | **Van Rotterdam naar Amsterdam door het Groene Hart** |
| 23/02/26 | 24 | `Cycling` | **Volta por São Paulo** |
| 02/07/26 | 0 | `Cycling` | *(sem nome)* |
| 21/06/25 | 0 | `Cycling` | *(sem nome)* |
| 31/08/26 | 5 | `Amsterdam Cycling` | *(sem nome)* |

**A calibração.** As duas que o dono já havia nomeado entraram às cegas.
`Tour de la Meuse-Rhin` saiu idêntica. `Tour de la Wallonie picarde` **divergiu** — o molde
por forma diria `Aller à Tournai` — e foi essa divergência que produziu a regra
região-vence-trajeto da §5. O erro ensinou mais que o acerto.

## 7. Quando não nomear

**15% da amostra não é nomeável**, e isso é resultado válido, não falha:

- rota degenerada — menos de 2 km, ou uma única cidade;
- a `justificativa` do modelo cita cidade que não foi enviada;
- a rota não tem `cities`, ou a chamada falhou.

Nos três casos `route_name` fica **nulo** e a leitura cai para o nome da fonte. Um nome
inventado é pior que `Cycling`, porque `Cycling` não mente.

## 8. Onde aparece

Precedência de leitura, única em todo o app:

```
nome editado pelo usuário → route_name → activity_name da fonte → rótulo do tipo
```

Hoje a leitura é `activity_name || meta.label` em quatro lugares — o cartão e o detalhe da web
([activity-item](../../../web/src/app/features/workout-history/components/activity-item.component.html),
[activity-detail](../../../web/src/app/features/workout-history/pages/activity-detail-page.component.html)),
o detalhe do celular ([historico/[label]/[id]](../../../mobile/src/app/historico/[label]/[id].tsx))
e a Retrospectiva. Todos passam a chamar um helper único do shared.

**Fora de escopo nesta versão:** o cartão de compartilhar (que tem título próprio, editável),
e pedir um nome novo sob demanda para uma pedalada específica.

## 9. Retroativo

O dono pediu explicitamente. As 138 rotas são nomeadas de uma vez, em backfill — ~21 mil
tokens de entrada no total. Depois o passe roda no ingest, ~4 pedaladas por mês.

## 10. O conflito de língua, declarado

O [geocode.ts](../../../supabase/functions/_shared/geocode.ts) grava as cidades **na língua da
região** (Flandres → nl). O nome da rota sai em **francês** para toda a Bélgica. O mesmo
passeio vai portanto mostrar `Mechelen` na lista de cidades do mapa e `Malines` no nome.

Não é bug. São dois campos com políticas diferentes, de propósito, e está escrito aqui para
que ninguém "conserte" isso daqui a seis meses.
