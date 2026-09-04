# 0028 — Rota recorrente por célula e ligação completa; subida é recorte do perfil

**Data:** 2026-09-04
**Status:** aceita

## Contexto

O item R4 da pesquisa competitiva (`_bmad-output/planning-artifacts/research/competitive-strava-e-apps-de-analise-de-exercicio-2026-09-02/research.md`, linha 206) pedia
três coisas — Best Efforts por distância, PRs por rota recorrente e subidas com
score — e mandava conferir a sobreposição com o que já estava mergeado. A
conferência achou a primeira **pronta** (`best-efforts.ts`, `best-effort-trend.ts`
e os cartões de 01/09). Sobraram as outras duas.

Antes de desenhar, a detecção foi rodada sobre as 223 rotas de produção. O
resultado é a razão de as duas features terem escopos diferentes:

| | Corrida | Ciclismo |
|---|---|---|
| Atividades com traçado | 52 | 136 |
| Rotas recorrentes (3+) | **4**, cobrindo 29 (55%) | **0** |
| Elevação média | 42 m | 233 m |

Corrida repete volta; pedalada é exploratória. Rota recorrente é uma feature de
corrida e subida é uma feature de ciclismo, e tratá-las como “análise de rota”
genérica entregaria metade inútil para cada esporte.

## Decisão

### 1. Semelhança de rota é sobreposição de células, não distância entre traçados

Cada traçado vira um conjunto de células de **150 m** e a semelhança é o índice
de Jaccard desses conjuntos. É robusto ao que importa — sentido invertido, ponto
de partida deslocado, pausa no meio, GPS oscilando — porque nada disso muda o
conjunto de células visitadas.

O que ele **não** distingue é uma volta de duas voltas pelas mesmas ruas. Por
isso o filtro de distância (85%) **faz parte da definição**, e não é refinamento:
sem ele, seis quilômetros e doze quilômetros no mesmo quarteirão seriam a mesma
rota.

### 2. O limiar é 0,7, escolhido com os dois cenários medidos

A 0,7 o circuito de 10 km do dono fica inteiro, com 13 corridas. A 0,8 ele racha
em 6 + 5 — duas variações da mesma volta com um quarteirão de diferença.
Treze pontos de comparação valem mais que a precisão de separar o que o dono
considera a mesma volta. Nada é gravado: o agrupamento é derivado a cada leitura,
então mudar o limiar é recalcular, não migrar.

### 3. Agrupamento por ligação completa

Uma atividade só entra num grupo se passar no limiar contra **todas** as que já
estão nele. A ligação simples foi testada primeiro e encadeou por transitividade:
fundiu 36 corridas de 5,3 a 12,3 km num “grupo” só, porque cada uma parecia com a
vizinha. Ligação completa produz grupos que o dono reconhece como uma rota.

### 4. Subida é um recorte do perfil já desenhado

`findClimbs` recebe o `ElevationProfile` de `route-profile.ts` — a mesma série
suavizada que a tela de detalhe desenha. As faixas destacadas caem sobre o traço
que o usuário vê, em vez de sobre uma segunda versão dele.

Uma subida vai do começo do ganho até o pico anterior a uma queda maior que 8 m.
A tolerância existe porque subida de verdade tem respiro. Os pisos são 25 m de
ganho, 2,5% de inclinação média e 50 m de extensão. O score é `ganho × inclinação`
— unidade arbitrária, como o strain da ADR 0027: ordena as subidas de uma mesma
atividade, e não se compara com o de outras ferramentas.

### 5. O cartão de subidas não mostra fração da elevação

Medido: o ganho do perfil desenhado e o `elevationM` publicado pelo sync usam
janelas de suavização diferentes e divergem muito — **1.378 m contra 860 m** numa
pedalada de 124 km. “531 de 832” comporia dois números que não se somam. A
afirmação qualitativa (“o resto está em terreno ondulado”) sobrevive à
divergência; a quantitativa, não.

## Consequências

- O ganho em subida separa duas coisas que a elevação misturava: um passeio de
  114 km com 1.225 m de ganho tem **395 m** em subidas contínuas, enquanto uma
  pedalada de 58 km com 832 m tem **531 m**. A segunda escala mais que a
  primeira, e a elevação sozinha diz o contrário.
- Comparar ritmo na mesma rota é mais honesto que na mesma distância: a rota
  controla desnível, curvas e semáforos. Não substitui `best-efforts.ts`, que
  continua respondendo “qual foi o meu melhor 10 km”, independente de onde.
- O cartão de rotas **some** no ciclismo, e isso é o comportamento correto, não
  uma falha a consertar.
- A divergência entre `profileGainM` e `elevationM` fica **declarada e não
  resolvida**. Ela sugere que uma das duas suavizações está errada, e isso é uma
  investigação própria — não desta história.

## Alternativas rejeitadas

**Distância de Fréchet ou Hausdorff entre traçados.** Mais correta como medida de
curva, e sensível justamente ao que não importa aqui: o ponto de partida e o
sentido. Custa O(n·m) contra o O(n) do conjunto de células, e o ganho não aparece
no caso de uso.

**Agrupar pelo ponto de partida.** Barato e inútil neste histórico: todas as
atividades saem do mesmo endereço.

**Ligação simples (união por qualquer par).** Rejeitada com evidência, ver a
decisão 3.

**Gravar o grupo no banco.** Daria identidade estável e nome próprio à rota, e
custa uma migration, um backfill e uma decisão sobre o que fazer quando o limiar
mudar. Enquanto tudo é derivado, o custo de errar o limiar é um recálculo.

**Score de subida no padrão de outras ferramentas** (categorias 4 a HC, ou
FIETS). Prometeriam comparabilidade externa que o app não tem como sustentar sem
uma tabela de referência; a ordenação interna é o que a tela precisa.

## Referências

- `packages/shared/src/fitness/recurring-routes.ts`, `packages/shared/src/fitness/climbs.ts`
- ADR 0027 (faixas herdadas e unidade arbitrária), ADR 0019 (elevação publicada vence o cálculo sobre o track)
- Runalyze, *Recurring Routes* — a referência que a pesquisa cita como equivalente gratuito
