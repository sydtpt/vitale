---
title: 'Story 5.14 — O artigo tem de ser da língua do nome'
type: 'feature'
created: '2026-09-21'
status: 'done'
baseline_commit: '2ad3dbc'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Quando o modelo propõe uma região, ele também diz o artigo que vai com ela, e é esse artigo
que o `molde.ts` transforma em contração (`la Forêt de Soignes`, `le Pajottenland`). Ninguém confere que
ele é da língua do nome. A medição de 21/09 contra as 135 rotas aprovadas mostrou o tamanho do buraco:
**127 de 135** respostas do modelo aberto trouxeram artigo fora da língua pedida — artigo português em
rota francesa —, e **29 delas tinham região**, ou seja, sairiam com a frase errada.

**Approach:** uma regra pura em `routes/verificar.ts`, com uma tabela de três línguas. Artigo nulo passa;
artigo de outra língua reprova. A regra é **segura por medição**: dos 135 nomes que o dono aprovou, os
únicos artigos gravados são `le` (11) e `la` (4), ambos franceses em rotas francesas — nenhum é
reprovado.

## Boundaries & Constraints

**Always:**
- **Nenhum dos 135 nomes aprovados em produção é reprovado.** Conferido antes da spec: artigo `le` × 11,
  `la` × 4, nulo × 120.
- Artigo **nulo passa** — é o caso de 120 das 135, e significa "nome próprio sem artigo".
- A tabela é por língua e a mesma palavra pode valer numa e não noutra: `de` é **artigo em neerlandês** e
  **preposição em francês**.
- `Lingua` são três (`fr`, `nl`, `pt`). Língua fora da tabela não reprova.
- Puro: sem rede, sem fornecedor, sem gazetteer.

**Ask First:**
- Reprovar, por esta regra, qualquer nome que o dono já aprovou.
- Reprovar artigo **nulo** em qualquer situação.

**Never:**
- **A regra da grafia não entra nesta story.** Decisão do dono em 21/09, depois de o caso `Hal`/`Halle`
  aparecer: a lista de aliases é incompleta por natureza (vem do Nominatim), `Hal` é o nome francês de
  `Halle` e seria reprovado como grafia inventada. Vai para a dívida, com os números.
- Tocar o prompt, `PROMPT_NOME_VERSAO`, o molde ou o descritor.
- Reprocessar, renomear ou apagar nome gravado. Nenhum backfill.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Artigo certo em francês | `lingua:'fr'`, `artigo:"la"` | passa | N/A |
| Artigo certo em neerlandês | `lingua:'nl'`, `artigo:"de"` | passa — `de` é artigo em nl | N/A |
| Artigo de outra língua | `lingua:'fr'`, `artigo:"a"` | **reprova**, regra `artigo`, detalhe nomeando a língua | permanente |
| Preposição francesa | `lingua:'fr'`, `artigo:"de"` | **reprova** — em francês `de` é preposição | permanente |
| Artigo nulo | `artigo: null` | passa (120 das 135) | N/A |
| Elisão | `lingua:'fr'`, `artigo:"l'"` | passa — a elisão é forma legítima do artigo | N/A |
| Caixa e acento | `lingua:'fr'`, `artigo:"LA "` | passa — a comparação normaliza como `chave()` | N/A |
| Artigo da via | `lingua:'fr'`, `viaArtigo:"via"` | **reprova** — mesma regra, mesmo campo de problema | permanente |

</frozen-after-approval>

## Code Map

> **Os números de linha e os alvos abaixo são os do `baseline_commit`** (`2ad3dbc`), não os de depois da
> implementação — o golden, por exemplo, já não está na linha `:110` do `verificar.test.ts`. O mapa serve
> para ler o ponto de partida, e reescrevê-lo apagaria a razão de cada mudança.

- `packages/shared/src/routes/verificar.ts:19-22` -- `ProblemaDeNome.regra`, quatro valores hoje: ganha
  `'artigo'`; `:24-27` `VereditoDeNome`; `:30-36` `chave()` (sem acento, sem caixa, trim) — **é a
  normalização a reusar, e ela já resolve a linha "caixa e acento" da matriz**; `:38-42` a assinatura,
  com `leitura: Pick<RouteReading, 'forma'>` — **precisa ganhar `'lingua'`**; `:54-64` a regra da
  justificativa é o molde de como empilhar problema; `:69-74` a regra da região.
- `packages/shared/src/routes/types.ts:29` `Lingua = 'fr'|'nl'|'pt'`; `:31+` o docblock de `artigo`
  ("`null` = nome próprio sem artigo"), que a regra não pode contrariar; `:90-111` `NomePreenchido`,
  onde vivem `artigo` e `viaArtigo`.
- `packages/shared/src/routes/molde.ts:108-125` -- `comRegiao`, e as contrações `frDe` (`:27-33`),
  `ptDe` (`:52-58`), `nlVan` (`:42-44`): é aqui que o artigo errado vira frase errada, e é o argumento
  da story. `:198-202` `sufixoVia`, que usa `viaArtigo`.
- `packages/shared/src/routes/descritor.ts:153` -- o `conferir` do descritor chama `verificarNome`; a
  `leitura` ali já tem `lingua`, então ampliar o `Pick` **não muda o chamador**.
- `packages/shared/src/routes/verificar.test.ts:20-126` -- as 6 reprovações de hoje e o golden de 20
  (`:110`), que **tem de continuar verde**; `__fixtures__/golden.json` -- as 20 pedaladas aprovadas.
- Produção, só `select` (Management API, projeto `svyyuhxkblufhfvfvqte`): `activities` com
  `activity_id = 13 and route_name is not null` são as 135; `route_name_meta->>'lingua'` e
  `->>'artigo'` dão a distribuição que sustenta a AC. **`viaArtigo` não é persistido na meta** — a prova
  de corpus cobre `artigo`; para `viaArtigo` a prova é o golden.

## Tasks & Acceptance

- [x] `packages/shared/src/routes/verificar.ts` -- `leitura` passa a
      `Pick<RouteReading, 'forma' | 'lingua'>`; `ProblemaDeNome.regra` ganha `'artigo'`; a tabela das três
      línguas e a regra, aplicada a `artigo` **e** a `viaArtigo`, reusando `chave()`.
- [x] `packages/shared/src/routes/verificar.test.ts` -- cada linha da matriz, mais o caso-espelho: com a
      regra desligada, os casos de artigo errado passam (prova de não-vacuidade). O golden de 20 verde.
- [x] **A prova de corpus.** Um teste sobre um fixture novo com os pares `(lingua, artigo)` reais das 135
      metas aprovadas — **nenhum reprovado**, e o teste imprime a contagem, para a afirmação não depender
      de leitura humana. Só língua e artigo entram no fixture; nenhum dado de saúde, nenhum topônimo.
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` -- registrar a **regra da grafia**, com o
      que foi medido e por que não entrou: 29 topônimos corrompidos em 135 pelo qwen3-1.7b (seis grafias
      para Woluwe-Saint-Pierre), `verificarNome` confere só a justificativa por decisão da ADR 0041, e o
      caso que derrubou o desenho — `Hal` é o nome francês de `Halle`, `Halle` não tem alias nenhum, e a
      regra reprovaria um nome que a nuvem produziu e o dono aceitou. Registrar também que a nuvem
      produziu **zero** corrupções em 135.

**Da revisão de três camadas (21/09) — consertos que a implementação incorporou:**

- [x] **A regra é amarrada ao uso do campo:** `artigo` só é conferido com `regiao`, `viaArtigo` só com
      `via`. Sem isso, ~98 das 135 respostas medidas viravam recusa permanente gravada sobre um campo
      que o molde nunca lê. Dois testes novos, um por campo, com o caso-espelho mostrando que o molde
      escreve a **mesma frase** com e sem o campo solto.
- [x] `packages/shared/src/routes/prompt.ts` -- `lerRespostaDoModelo` normaliza `artigo` e `viaArtigo`
      (minúsculas, `trim`, aspa curva → apóstrofo reto), para a linha "caixa e acento" da matriz valer
      **ponta a ponta**: o molde compara com `===` cru, e `"La"` sumia calado da frase. `NOME_DA_LINGUA`
      passa a ser exportado — havia duas cópias do mesmo rótulo, e divergir faria a reprovação nomear
      uma língua que o pedido nunca pediu. O texto do prompt e `PROMPT_NOME_VERSAO` não mudam.
- [x] `packages/shared/src/routes/prompt.test.ts` -- costura de `lerRespostaDoModelo` até `montarNome`:
      `"Le"` → `Tour du Pajottenland`, e a aspa curva nas duas línguas (`l’`, `’t`).
- [x] A tabela vira `ARTIGOS_POR_LINGUA`, exportada e **exaustiva por tipo** — sem cast e sem o ramo
      morto `if (!tabela)`, cujo comentário estava invertido: uma quarta `Lingua` é erro de compilação,
      de propósito, aqui e no `NOME_DA_LINGUA`.
- [x] A prova de corpus ganha guarda contra deriva e vacuidade: existe artigo não nulo no corpus, toda
      língua do corpus está na tabela, e o fixture carrega `query`, `medido_em` e `manutencao`. O texto
      passa a dizer que é um instantâneo transcrito à mão, e não uma leitura da produção de hoje.
- [x] O arnês dos testes usa `Partial<NomePreenchido>` em vez de `Record<string, unknown>` com cast —
      com o cast, um campo mal escrito (`viaArtgio`) compilava e o teste ficava verde testando nada.
- [x] `deferred-work.md` ganha mais quatro entradas: a causa-raiz no pedido (lista de artigos sem
      partição por língua, `ESQUEMA_DO_NOME` sem `enum`), o artigo embutido no topônimo
      (`'Le Pajottenland'` → `Tour de Le Pajottenland`), a consequência de `shape.ts` mandar toda rota
      belga para `fr`, e `ptPor` perdendo `os`/`as`.

**Acceptance Criteria:**
- Given as 135 metas aprovadas em produção, when a regra roda sobre todas, then **nenhuma é reprovada**,
  e a contagem sai no resultado do teste.
- Given a regra desligada, when os casos de artigo errado da matriz rodam, then eles passam — a regra
  morde algo que ninguém mais morde.
- Given o golden de 20, when a regra entra, then continua verde.
- Given uma resposta de trajeto com artigo de outra língua e **sem região**, when a conferência roda,
  then ela **passa** — e o molde escreve a mesma frase que escreveria sem o campo solto.
- Given `artigo: "Le"` na resposta crua, when o caminho vai da leitura até o molde, then a frase sai
  `Tour du Pajottenland` — o artigo contrai, não some.

## Design Notes

**Os dois números, e por que só um deles é o defeito.** "127 de 135" é o total de respostas do modelo
aberto com artigo fora da língua pedida — é a medida do descontrole, não do estrago. Só **29** dessas
tinham `regiao`, e portanto só 29 podiam sair com a frase errada. As outras **~98** trazem artigo solto
numa resposta de trajeto, e `semRegiao` nunca lê `artigo`: o molde escreveria `De Tournai à Antoing`,
que é um nome perfeito.

**A regra é amarrada ao uso do campo** por causa disso. `artigo` só é conferido quando há `regiao`, e
`viaArtigo` só quando há `via` — com `via` ausente o `sufixoVia` nem é chamado. A primeira versão desta
story conferia os dois incondicionalmente, e como o descritor declara `recusaEResultado: true`, cada
artigo solto viraria **recusa permanente gravada**: ~98 das 135 pedaladas ficariam sem nome para sempre,
para consertar um campo que ninguém lê. Uma regra que reprova mais do que o molde consegue estragar não
é rigor, é estrago.

**A normalização do artigo mora na leitura, não na conferência.** O molde compara com `===` na string
crua (`frDe`: `artigo === 'le'`), então `"La"` com maiúscula passava por uma conferência que normaliza e
depois **sumia calado** na frase: `Tour de Wallonie picarde` em vez de `Tour de la Wallonie picarde` — o
artigo aprovado desaparecendo, que é exatamente o defeito que esta story existe para combater. Por isso
o `lerRespostaDoModelo` passa a minusculizar o artigo e a dobrar a aspa curva (`l’` → `l'`), e a linha
"caixa e acento" da matriz é provada **ponta a ponta**, da resposta crua até a frase. É leitura, não
pedido: o texto do prompt e `PROMPT_NOME_VERSAO` não mudam.

**Por que `de` é o caso interessante.** Ele é artigo definido em neerlandês e preposição em francês, então
a mesma palavra reprova numa língua e passa noutra. É o teste que prova que a tabela é por língua e não
uma lista global.

**Por que `viaArtigo` entra, com evidência mais fraca.** É o mesmo defeito no mesmo tipo de campo, e o
`sufixoVia` o usa do mesmo jeito. Mas a meta gravada não persiste `viaArtigo`, então a prova de corpus
não o cobre — ele é coberto pelo golden de 20. Está dito aqui para ninguém acreditar que os dois campos
têm a mesma força de prova.

## Verification

**Commands:**
- `pnpm --filter @vitale/shared lint` -- expected: tsc limpo
- `pnpm --filter @vitale/shared test` -- expected: verde, com o golden de 20 e a prova de corpus
- `pnpm --filter @vitale/web build` -- expected: compila
- `cd mobile && pnpm exec tsc --noEmit && pnpm exec jest` -- expected: verde

## Suggested Review Order

**A regra, e o que a torna segura**

- A tabela por língua: as formas que o molde sabe escrever, e só elas.
  [`verificar.ts:59`](../../packages/shared/src/routes/verificar.ts#L59)

- A conferência do artigo — reusa `chave()` e nomeia a língua no detalhe.
  [`verificar.ts:79`](../../packages/shared/src/routes/verificar.ts#L79)

- **O conserto que mais importa:** o artigo só é conferido quando o molde o usa.
  [`verificar.ts:150`](../../packages/shared/src/routes/verificar.ts#L150)

**A normalização, na origem**

- O artigo lido vira minúscula, sem espaço e com apóstrofo reto — antes de qualquer conferência.
  [`prompt.ts:177`](../../packages/shared/src/routes/prompt.ts#L177)

- O rótulo da língua passa a ter um dono só, e o portão importa dele.
  [`prompt.ts:52`](../../packages/shared/src/routes/prompt.ts#L52)

**Os testes que provam, e não só afirmam**

- A costura crua → peças → conferência → frase: "Le" tem de virar `Tour du Pajottenland`.
  [`prompt.test.ts:153`](../../packages/shared/src/routes/prompt.test.ts#L153)

- Artigo solto não reprova — e o molde escreve a mesma frase com e sem ele.
  [`verificar.test.ts:239`](../../packages/shared/src/routes/verificar.test.ts#L239)

- O mesmo para o artigo da via, que sem `via` nunca chega à frase.
  [`verificar.test.ts:259`](../../packages/shared/src/routes/verificar.test.ts#L259)

- A prova de corpus: os pares reais das 135 metas aprovadas, com guarda contra vacuidade.
  [`artigo-corpus.test.ts:1`](../../packages/shared/src/routes/artigo-corpus.test.ts#L1)

- O retrato transcrito à mão, com a query e quem o atualiza.
  [`artigos-producao.json:1`](../../packages/shared/src/routes/__fixtures__/artigos-producao.json#L1)
