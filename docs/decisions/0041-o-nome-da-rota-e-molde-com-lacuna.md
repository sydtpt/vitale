# ADR 0041 — O nome da rota é molde determinístico com lacuna preenchida pelo modelo

**Data:** 2026-09-07 · **Status:** aceita

> **Numeração:** quando esta foi escrita, 0040 estava tomado duas vezes — a frente de sono e a
> de IA. **Resolvido em 07/09/2026:** a de sono virou [0044](0044-o-cruzamento-so-fala-quando-as-duas-colunas-concordam.md)
> e a de IA ficou com o 0040, que é o número que quatorze referências usam. Esta nasceu 0041 na main.

**Complementa:** [0038](0038-a-chamada-ao-modelo-sai-da-edge-function.md) — de onde sai a
chamada · [0040](0040-o-provedor-de-modelo-e-configuracao-nao-arquitetura.md) — para quem, e
como trocar. Esta decide **o que se pede ao modelo, e o que nunca se pede.**

## Contexto

O Orbe nunca gerou nome de atividade. Ele copia o que a fonte mandou: o `activityName` do
HealthKit ([healthkit-workouts.ts:90](../../mobile/src/lib/healthkit-workouts.ts#L90)) ou o
`raw.name` do intervals.icu ([intervals.ts:195](../../supabase/functions/_shared/providers/intervals.ts#L195)),
ambos aterrissando em `activities.activity_name` — coluna comentada, desde a primeira
migration, como *"nome cru do HealthKit"*.

Em 07/09/2026 o dono do app trouxe a queixa assim: numa pedalada **Casa → B**, o nome vem
com o nome da cidade **onde ele mora**, quando o passeio foi justamente para outro lugar.

### O que o banco de produção disse

O levantamento desmentiu a queixa por baixo — o problema é maior e mais simples do que ele
descreveu.

| Medida | Valor |
|---|---|
| Pedaladas (`activity_id = 13`) | 196, de 30/11/2023 a 31/08/2026 |
| Com rota | 138 |
| Com `cities` preenchido | **138 de 138** — cobertura total, média de 10 cidades por rota |
| Chamadas literalmente `Cycling` | **175** |
| Com nome de cidade no título | ~10 (`Schaarbeek Cycling`, `Brussels Cycling`, …) |
| Nomeadas à mão pelo dono | **2** (`Tour de la Wallonie Picarde`, `Tour de la Meuse-Rhin`) |
| Com `name_edited = true` | **1 em 196** |

O caso que incomodava é minoria. **89% das pedaladas não têm nome nenhum.** O ganho real não
é corrigir — é preencher. E como só uma linha em 196 tem edição manual, não há trabalho do
usuário a proteger.

### A forma do passeio, medida

Com a âncora de Casa derivada dos próprios pontos de partida, as cinco formas cobrem 97%:

| Forma | Pedaladas | km médio |
|---|---|---|
| Casa → loop → Casa | 75 | 36 |
| Casa → B | 23 | 43 |
| A → B | 19 | 45 |
| A → Casa | 18 | 37 |
| A → loop → A (em viagem) | 3 | 27 |

**A Casa mudou.** O cluster de partida `50.852, 4.344` roda de jan/2025 a **07/06/2026**; o
cluster `50.872, 4.373`, a ~3 km a nordeste, começa em **21/06/2026**. Não há um único mês de
sobreposição. Casa não é constante — é entidade com vigência, exatamente como a bicicleta da
[ADR 0034](0034-bicicleta-e-entidade-com-heranca-por-data.md).

### Por que geometria não basta

Os dois nomes que o dono escreveu à mão revelaram o critério dele, e ele não é geométrico:

- **`Tour de la Meuse-Rhin`** — 114 km por Liège, Gemmenich, Aachen, Vaals, Maastricht. É a
  Euregio Meuse-Rhin, e a rota passa pelo ponto tríplice.
- **`Tour de la Wallonie Picarde`** — 151 km até Tournai, formalmente uma Casa → B.

Ele nomeia pela **região histórica que o passeio explorou**. Nenhuma regra de primeira/última
cidade produz *Pajottenland*, *Hageland*, *Petit-Brabant*, *Rupelstreek* ou *Groene Hart* —
esses nomes não existem em lugar nenhum do dado. Vêm de conhecimento de mundo.

Somando: o `cities` do Nominatim roda em zoom 10 e, dentro de Bruxelas, oscila entre
`Bruxelles` e a comuna. É excelente para a **ponta longe** e inútil para a **ponta de casa** —
o que é precisamente o defeito de que o dono reclamou, reproduzido por outro caminho.

## A prova barata, antes da decisão

Vinte pedaladas reais, espalhadas pelas cinco formas e por faixa de distância, foram nomeadas
à mão a partir de **exatamente o payload que o modelo receberia**. Duas delas eram as que o
dono já havia nomeado, incluídas às cegas como calibração.

- `Tour de la Meuse-Rhin` saiu **idêntica** ao nome dele.
- `Tour de la Wallonie picarde` **divergiu**: o molde por forma diria `Aller à Tournai`.

A divergência é o achado que mais moldou esta ADR — ver invariante 3.

Três pedaladas em vinte (15%) se mostraram **não nomeáveis**: duas rotas de 0 km e uma de
5 km dentro de uma cidade só.

## Decisão

Sete invariantes.

### 1. Duas camadas, com naturezas diferentes

| Camada | Onde | Natureza |
|---|---|---|
| **A forma** — Casa→B, loop, A→Casa; a âncora; o ponto mais distante | `packages/shared/src/routes/`, puro | Determinística, testável, grátis, sem rede |
| **O nome do lugar** — "Pajottenland", "Petit-Brabant" | Passe no ingest, uma chamada por pedalada | Não determinística, custa, precisa de rede |

O núcleo **nunca importa SDK nem faz rede**, herdando a invariante 1 da
[ADR 0040](0040-o-provedor-de-modelo-e-configuracao-nao-arquitetura.md). Se todo provedor do
mundo sumir, a forma continua sendo calculada e testada.

### 2. O modelo preenche campos — não escreve a frase

O modelo **não** devolve um nome pronto. Devolve os campos que faltam:

```json
{ "regiao": "Pajottenland", "artigo": "le", "lingua": "fr",
  "justificativa": ["Sint-Martens-Lennik", "Strijtem", "Pamel"] }
```

O molde monta a frase do lado determinístico, com teste. Isso importa por gramática, não só
por controle: em francês não dá para concatenar `"Tour de " + região` — *le* Pajottenland faz
**du**, *la* Wallonie picarde faz **de la**. Contração é regra, e regra mora em código.

A `justificativa` é a costura da verificação: as cidades citadas têm que estar na lista
enviada. É o mesmo princípio do [verificar.ts](../../packages/shared/src/ia/verificar.ts) —
*"todo número citado existe no pacote"* vira *"toda cidade citada foi enviada"*.

### 3. Região vence trajeto

Quando uma região histórica forte domina a rota, ela vence o molde de trajeto,
**independentemente da forma**. A forma só escolhe o verbo (`Tour de` / `Aller à` /
`Retour de` / `Boucle par`) quando *não há* região forte.

Foi essa regra que a calibração ensinou: sem ela, `Tour de la Wallonie picarde` teria virado
`Aller à Tournai`, e o dono já demonstrou preferir a primeira.

### 4. `route_name` é coluna separada de `activity_name`

O nome derivado **não** pode morar em `activity_name`. A regra `setName` do
[dedupe.ts:249](../../packages/shared/src/fitness/dedupe.ts#L249) reescreve esse campo a cada
sync quando a fonte entrante é mais rica. Escrever ali significa ou ser apagado pelo Strava na
próxima sincronização, ou marcar `name_edited = true` — que é mentira, e que passaria a
**bloquear atualizações legítimas da fonte** (distância, zonas, best efforts).

Precedência na leitura, do mais forte ao mais fraco:

```
nome editado pelo usuário  →  route_name  →  activity_name da fonte  →  rótulo do tipo
```

### 5. A língua sai do país dominante — e a Bélgica é francês por decisão do dono

O país dominante na rota decide a língua do nome; empate desempata pela partida. Holanda →
neerlandês, Brasil → português, Alemanha → alemão.

**A Bélgica é francês, inclusive nas rotas flamengas.** Isso é escolha declarada do dono em
07/09/2026, não inferência: ele mora na Bélgica e seus dois nomes autorais são franceses.

Na prática "apenas francês" significa **francês na gramática e nos exônimos estabelecidos**
(`Mechelen` → *Malines*, `Antwerpen` → *Anvers*, `Halle` → *Hal*, `Klein-Brabant` →
*Petit-Brabant*), e **topônimo local quando não há forma francesa** — ninguém escreve "Pays du
Pajot". Daí `Tour du Pajottenland`: artigo francês, nome flamengo.

> **Conflito declarado, para não parecer bug depois.** O
> [geocode.ts](../../supabase/functions/_shared/geocode.ts) grava as cidades **na língua da
> região** (Flandres → nl), por decisão anterior. O mesmo passeio vai portanto exibir
> `Mechelen` na lista de cidades do mapa e `Malines` no nome. São dois campos com políticas
> diferentes, de propósito.

### 6. A Casa é cluster derivado, com vigência

Uma tabela `places`, no molde exato do `gear` da [ADR 0034](0034-bicicleta-e-entidade-com-heranca-por-data.md):
`active_from` / `active_to` (NULL = vigente), janela conferida por `check`, índice por
`(user_id, active_from)`.

**Preenchida por derivação, não por formulário.** O passe agrupa os pontos de partida e
fecha uma vigência quando o cluster muda. O dono pode renomear ou corrigir; não precisa
cadastrar nada para o sistema funcionar. Zero configuração era requisito, porque a alternativa
é uma tela de ajustes que ele nunca vai abrir.

### 7. Recusar é resultado válido

15% da amostra não é nomeável. Quando a rota é degenerada (menos de 2 km, ou uma cidade só),
ou quando a `justificativa` não se sustenta nas cidades enviadas, o passe **deixa
`route_name` nulo** e a leitura cai para o nome da fonte.

Um nome inventado é pior que `Cycling`, porque `Cycling` não mente.

## Alternativas rejeitadas

**Mandar os pontos do GPX.** Foi a proposta inicial do dono. Perde nos três eixos: qualidade
(o modelo raciocina bem sobre `Tournai · Antoing · Mons` e mal sobre 200 pares de decimais,
com confiança injustificada nos dois casos), custo (~2.500 tokens contra ~150) e redundância —
o `cities`, ordenado ao longo do percurso, **já é** a rota comprimida.

**Mandar a imagem do mapa.** Também proposta pelo dono, e rejeitada por um motivo estrutural
antes do de custo: **o mapa não existe no servidor.** O
[map-html.ts](../../mobile/src/lib/map-html.ts) renderiza numa WebView, no aparelho. Mandar
imagem exigiria construir renderização server-side inexistente — subsistema novo, para
resultado pior que o da lista de nomes.

**Derivar na leitura, como o `habits.unit_price`.** O precedente não se aplica. Aquele deriva
na leitura porque é uma multiplicação: determinística, instantânea, grátis. Chamada de modelo
não é nenhuma das três; derivar na leitura significaria chamar o provedor a cada render, com
nome diferente a cada vez.

**Gravar em `activity_name`.** Ver invariante 4 — o sync apaga, ou a mentira do
`name_edited` bloqueia campos legítimos.

**Gazetteer do OSM em vez de modelo.** As relações administrativas do OSM têm comuna,
província e região, mas não têm *Pajottenland*, *Hageland* nem *Groene Hart* como entidades
consultáveis de forma confiável — são regiões culturais, de fronteira difusa. E a
[ADR 0035](0035-o-piso-e-calculado-no-aparelho.md) já registrou que a edge function não
alcança o Overpass.

**Custo como eixo de decisão.** Considerado e descartado. O payload de nomear é uma ordem de
grandeza menor que o de narrar uma retrospectiva, cujo caminho pago a
[ADR 0040](0040-o-provedor-de-modelo-e-configuracao-nao-arquitetura.md) mediu em menos de
US$ 1/ano. O backfill inteiro das 138 rotas cabe em ~21 mil tokens de entrada, uma vez.
Vale a regra da casa: ignorar custo, priorizar risco.

## Consequências

**O que isso compra.** 175 pedaladas sem nome ganham um; e ganham nomes que o dado não tinha
como produzir — *Pajottenland*, *Hageland*, *forêt de Soignes*, *Groene Hart*, *Petit-Brabant*.
A queixa original (o nome da cidade de casa numa Casa → B) some por construção: o molde de
Casa → B só tem lacuna para o destino.

**O que custa.** Uma coluna, uma tabela, um passe no ingest e uma dependência nova de rede num
caminho que já tinha uma. O nome de uma pedalada passa a depender de um terceiro — mitigado
pela invariante 7: falha de rede deixa nulo e tenta no próximo tick, como o `enrichCities`.

**O que custa reverter.** Pouco. `route_name` é aditiva; apagar a coluna devolve o
comportamento de hoje, porque `activity_name` nunca foi tocado. É o principal benefício da
invariante 4.

**O que não está decidido aqui.** Se o dono vai poder pedir um nome novo para uma pedalada
específica (rerodar o passe sob demanda), e se o nome derivado entra no cartão de
compartilhar. Ambos são de produto, não de arquitetura.

**Segundo inquilino.** Esta é a segunda costura a usar o `Narrador` da ADR 0040 — a primeira
foi a narração da Retrospectiva. A regra de três ainda não fechou; se um terceiro uso
aparecer, vale revisitar se `Prompt`/`Narracao` continuam sendo a interface certa, ou se
querem virar algo com nome próprio.
