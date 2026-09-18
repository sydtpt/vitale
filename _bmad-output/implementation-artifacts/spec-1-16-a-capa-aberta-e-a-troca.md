---
title: 'Story 1.16 — A capa aberta, e a troca'
type: 'feature'
created: '2026-09-18'
status: 'done'
review_loop_iteration: 0
baseline_commit: '276356f36f3a99fca61b21068bfe8a7e395ed89d'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A capa carimbada (1.13) não abre, não diz **por que** aquela foto está ali, e não tem conserto quando o app escolheu mal — o que desperdiçaria o julgamento das três capas no piloto (1.15). E o porquê não pode ser reconstruído depois: `coverOf` lê `isCover` e o vínculo, os dois mutáveis depois do carimbo.

**Approach:** A migração acrescenta `motivo` e `foto_activity_id` a `edicoes_capa`, e toda impressão passa a carimbá-los. Tocar a capa `foto` abre a foto expandida com a **ficha em papel embaixo** — o porquê carimbado, quando, em que atividade e a rota dela — e a ficha oferece **Trocar a capa**: um seletor com as fotos do período, agrupadas por atividade, que recarimba só a capa. Decisões de UX do dono (18/09): [canvas](https://claude.ai/artifact/1ACfhm4dfgDMMrvm8SvKsc).

## Boundaries & Constraints

**Always:**
- **Vocabulário com dono único:** `MotivoDaCapa`/`MOTIVOS_DA_CAPA` (`estrela`, `rajada`, `unica`, `trocada`, `sem-foto`) em `data/edicoes-capa.ts`, com a barreira do CHECK no molde de `NATUREZAS_DA_CAPA`. `toCapa` recusa motivo desconhecido como já recusa natureza.
- **O motivo sai da escolha, na impressão:** `estrela` se a foto escolhida tem `isCover`; senão `unica` se era a única foto elegível e vinculada do período; senão `rajada`. `tracado`/`grade` → `sem-foto`. `coverOf` **não muda**. `foto_activity_id` = `foto.activityId`.
- **A troca recarimba e só:** identidade nova, legenda recalculada por `legendaDaFoto` com as cidades do período, motivo `trocada`, `carimbada_em` novo — pela **mesma porta** `gravarCapa` (upsert). Texto, ordem, assinaturas, errata e manchete não mudam. Sem histórico da escolha anterior.
- **Marca do toque:** um disco translúcido (`onMedia` com alfa) no canto do véu. A capa inteira é alvo para quem vê; para o VoiceOver, o disco é **o** botão ("Ver a foto da capa") — embrulhar a capa num botão calaria período e manchete.
- **Tocável ⇔ `capa.comFoto`** (decisão da vista). Inclui a capa que caiu no papel porque a imagem não resolveu: a ficha sabe o que a foto era.
- **Ficha embaixo da foto, em papel** (`bg`), nunca por cima. Mono no que é medida, serifada só no porquê. Rótulos em `ink2`. Cores por token (`mediaVeil`/`onMedia` na área da foto).
- **A troca mora só na ficha**, e o seletor é a segunda face do **mesmo** `Modal` (nada de terceiro modal — o iOS não empilha). O `Modal` fica **fora** do `ScrollView`, que continua montado: fechar devolve a posição de rolagem.
- **Seletor:** só fotos (`mediaType === 'photo'`), instante legível, `linked`, com `assetId`; agrupadas por atividade, a mais recente primeiro, fotos em ordem cronológica. A foto atual leva anel e o rótulo "na capa"; o botão do ato só acende com **outra** selecionada. Virtualizado (julho tem 372 fotos).
- **A troca falha em voz alta** (ato do dono — ao contrário do carimbo da impressão, que só loga): a mensagem aparece no seletor, a seleção fica. Não troca com impressão em curso. Sucesso sobe a geração da chave, para uma leitura em voo não repor a capa velha.

**Ask First:**
- Mudar as frases do porquê, os rótulos da ficha ou o desenho aprovado; dependência nova no mobile.
- Qualquer escrita em produção fora do roteiro da janela, abaixo.

**Never:**
- Reconstruir o motivo de capa já carimbada (as duas de produção ficam `null`); tocar `edicao_imprimir`, `coverOf`, `setPhotoCover` ou a estrela da atividade.
- Toque longo na capa, segundo caminho para a troca, histórico de capas, vídeo no seletor, ficha por cima da foto.
- Editar a migration `20260912120000` (já aplicada); `motivo not null` ou apertar `capa_identidade_bate_com_natureza` — o build antigo grava sem as colunas novas.

## I/O & Edge-Case Matrix

| Cenário | Estado | Esperado | Erro |
|---|---|---|---|
| Escolha com estrela | foto escolhida com `isCover` | `motivo: 'estrela'`, `fotoActivityId` preenchido | N/A |
| Escolha de uma foto só | uma elegível e vinculada | `unica` | N/A |
| Escolha por rajada | várias, nenhuma estrela | `rajada` | N/A |
| Escolha sem foto | `tracado` ou `grade` | `sem-foto`, `fotoActivityId: null` | N/A |
| Capa anterior à 1.16 | `motivo` nulo | a ficha diz que foi impressa antes do porquê | N/A |
| Atividade não achada | `foto_activity_id` nulo ou fora do acervo | a ficha mostra porquê e quando, sem atividade e sem rota | N/A |
| Troca | outra foto elegível do período | capa recarimbada com `trocada`; a capa, a ficha e o véu se refazem | gravação falha: mensagem, seleção mantida, capa intacta |
| Foto inválida na troca | vídeo, fora do período, instante ilegível | recusada antes do banco | erro, nada gravado |
| Capa `tracado`/`grade` | natureza sem foto | sem alvo de toque, sem disco | N/A |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20260912120000_edicao_por_caderno.sql:123-176` — DDL de `edicoes_capa`; o CHECK de `natureza` e `capa_identidade_bate_com_natureza`. Não editar. `activities.id` é `text` → `foto_activity_id text`. A foto é única por `(user_id, activity_id, taken_at)`: o `activity_id` dela não muda, então o backfill é valor, não reconstrução.
- `packages/shared/src/data/edicoes-capa.ts` — `NATUREZAS_DA_CAPA` (44), `CapaRow` (52), `Capa` (65), `CAPA_COLUMNS` (87), `toCapa` (101), `CapaACarimbar` (156), `gravarCapa` (190: guarda de sessão, upsert, `carimbada_em` à mão). Testes: `edicoes-capa.test.ts` (`linhaDoBanco` 20, `A_CARIMBAR` 174).
- `packages/shared/src/architecture.test.ts` — `ID_COLUMNS_DA_EDICAO` (616; a linha de `natureza` em 620 é o molde); `idsAceitosPeloCheck` (454) só lê `check (motivo in (…))` com a coluna **logo depois** do parêntese; `COLUNAS_PEDIDAS` (744) exige as colunas em `CapaRow`, `CAPA_COLUMNS` e na migration; "só `gravarCapa` escreve `edicoes_capa`" (2618) reprova `.update`.
- `packages/shared/src/revista/capa.ts` — `escolherCapa` (234), `coverOf` na 238, `fotosElegiveis` (171, privada), `legendaDaFoto` (106), `horaDe` (86, por componentes), `quilometro` (69, via `formatarNumero`). `photos/retro.ts:44` `coverOf`: estrela primeiro, senão o meio da maior sequência com ≤ 600 s entre fotos. `routes/molde.ts:171` `nomeDaAtividade(a, rotulo)`.
- `mobile/src/lib/edicao-ia.ts` — `atividadesDoPeriodo` (146), `cidadesDoPeriodo` (165), `DepsDoCarimbo`/`depsDoCarimbo` (183–212; o nome `carimbar`, e não `gravar`, é exigência de barreira), `carimbarCapa` (242, engole erro — a troca **não**).
- `mobile/src/store/edicao.store.ts` — fase `lida` (119, com `capa` e `imprimindo`), `EdicaoState` (129), `geracoes`/`novaGeracao` (630), `ler` (654), `vistaDaEdicao` e o `comFoto` (444–456). Testes: `__tests__/edicao-store.test.ts` (`CAPA_DE_AGOSTO` 1470).
- `mobile/src/components/revista/CapaComFoto.tsx` — props (133), raiz (216), véu (238), texto (249), estilos com `mediaVeil`/`onMedia` (385). Nenhum toque hoje.
- `mobile/src/hooks/useFotoDaCapa.ts` — resolve `fotoId` → `uri`, re-resolve quando o `fotoId` muda (97).
- `mobile/src/app/revista/[tipo]/[inicio].tsx` — o ramo `edicao` (230–284): `CapaComFoto`/`CapaEmPapel` (251–258); `Caderno` tem de seguir filho direto do `ScrollView` (invariante da 1.14).
- `mobile/src/components/photos/PhotoGalleryModal.tsx` — referência, **não** reuso: `GridTile` (56) e a `SectionList` virtualizada (690–731); o `Viewer` põe o rodapé por cima da foto e a estrela é da atividade. `services/asset-uri.ts` `useAssetUri` resolve a miniatura (teto de 6 em voo). `mobile/src/app/retrospectiva/index.tsx:238-261` é o agrupamento de referência; `lib/workout-types.ts:270` `getActivityMeta(...).label`.
- `_bmad-output/implementation-artifacts/revista-1-9/` — `aplicar.sh` e `conferir-bundle.py` (molde); `janela-da-migracao.md` §6 (leitura obrigatória).

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20260918120000_capa_motivo.sql` — `add column motivo text constraint edicoes_capa_motivo_check check (motivo in (…))`, `add column foto_activity_id text`, backfill de `foto_activity_id` pela `activity_photos` (natureza `foto`). Cabeçalho diz que a 1.9 se declarou "a única" e que o dono abriu a segunda em 18/09.
- [x] `packages/shared/src/data/edicoes-capa.ts` + teste — o vocabulário, as duas colunas em `CapaRow`/`Capa`/`CapaACarimbar`/`CAPA_COLUMNS`/`toCapa`/`gravarCapa`.
- [x] `packages/shared/src/architecture.test.ts` — a linha de `motivo` em `ID_COLUMNS_DA_EDICAO`.
- [x] `packages/shared/src/revista/capa.ts` + teste — `escolherCapa` com motivo e `fotoActivityId`; `capaTrocada(periodo, foto, cidades)` (recusa inelegível); `secoesDoSeletor(fotos, atividades)`; `fichaDaCapa(capa, atividade, rotuloDoTipo)` → porquê, nota, quando (`18/07/2026 · 17:09` de `fotoTakenAt`), atividade (nome + `114,4 km`), rota (cidades em ordem, ` · `). Cobre a matriz inteira que é pura.
- [x] `mobile/src/lib/edicao-ia.ts` + teste — `fotosParaCapa(uid, entrada)` e `trocarCapa(uid, entrada, foto, deps?)`, reusando as deps do carimbo; a troca recusa acervo não carregado e foto fora do período, e propaga erro.
- [x] `mobile/src/store/edicao.store.ts` + teste — ação `trocarCapa`: só em `lida` sem impressão em curso; sucesso põe a capa nova e sobe a geração; falha devolve a mensagem sem tocar o estado.
- [x] `mobile/src/components/revista/CapaComFoto.tsx`, `[inicio].tsx` (`CapaEmPapel`) — `onAbrir` e o disco.
- [x] `mobile/src/components/revista/CapaAberta.tsx` (+ `SeletorDaCapa.tsx`) — o `Modal` de duas faces: foto `contain` sobre `mediaVeil` (sem imagem: a legenda carimbada), ficha, "Trocar a capa" + "Trocar recarimba a capa. O texto da edição não muda."; o seletor com carregando/erro/vazio e a barra do ato; troca bem-sucedida volta à face da ficha, já com a foto nova e "Você escolheu esta.". Montado em `[inicio].tsx` **fora** do `ScrollView`.
- [x] `_bmad-output/implementation-artifacts/revista-1-16/aplicar.sh` + `conferir-bundle.py` — no molde da 1.9 (ver a janela).
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` — o ensaio local não serve mais: `preparar.sh` reprova edições impressas depois da 1.10 e não carrega `edicoes_capa`.

**Acceptance Criteria:**
- Given julho/2026 com a capa carimbada, when o dono toca a capa, then a foto abre com a ficha embaixo, e fechar devolve a edição na mesma posição.
- Given a ficha aberta, when ele troca a foto, then a capa da edição passa a ser a nova, e o texto, a ordem e as assinaturas continuam idênticos.
- Given a suíte, when roda, then a matriz tem teste nas funções puras, nas portas e na store, e as barreiras — com a do `motivo` — seguem verdes.

## Spec Change Log

## Design Notes

**As frases do porquê** (serifada 17/25 + nota em sans `ink2`), com dono único em `fichaDaCapa` e um `Record` exaustivo sobre o motivo:

| motivo | porquê | nota |
|---|---|---|
| `estrela` | A que você marcou com a estrela. | A estrela vence a escolha do app. |
| `rajada` | A do meio da maior rajada do período — fotografa-se mais onde valeu a pena parar. | Nenhuma foto do período tinha estrela. |
| `unica` | A única foto do período. | — |
| `trocada` | Você escolheu esta. | `trocada em 18/09/2026` (mono, de `carimbadaEm`) |
| `null` | Impressa antes de o app guardar o porquê. | — |

**Três divergências declaradas do canvas:** `trocada` diz "Você escolheu esta." e não "…no lugar da que o app tinha escolhido" (falso na segunda troca); a nota da rajada perde "N fotos, das HH:MM às HH:MM" (seria reconstrução — só o motivo é carimbado); e a linha da atividade perde "km 80,7 da rota · 73 fotos" (o km já está na legenda da capa; a contagem pediria consulta nova). O rótulo é "Na atividade", não "Na pedalada".

**Quando, atividade e rota são lidos ao vivo** (nota do canvas): a ficha é bastidor, não a edição impressa — renomear a pedalada muda a ficha, e está certo. Só o porquê é carimbado, e o quando sai de `fotoTakenAt`, que já era.

## Verification

**Commands:**
- `pnpm --filter @vitale/shared lint && pnpm --filter @vitale/shared test` — barreiras verdes, com `motivo` contra o CHECK.
- `pnpm --filter @vitale/web build` — o núcleo mudou.
- `cd mobile && pnpm exec tsc --noEmit && pnpm exec jest`.

**Manual checks:**
- `/revista/mes/2026-07-01` no iPhone, depois da janela: abrir, ler a ficha, trocar, fechar — **portão do dono**.

## Janela da migração

Aditiva e compatível nos dois sentidos, por construção: colunas **nulas**, `CAPA_COLUMNS` explícito, e a porta de leitura da capa já engole erro. App velho contra o schema novo segue lendo e gravando (a troca feita por ele não existe; uma reimpressão inteira dele manteria o motivo antigo na linha — janela de minutos, declarado). JS novo contra o schema velho: `fetchCapa` recebe `42703`, a capa cai no papel e a troca falha em voz alta — degradado, sem quebra. **Ordem: migração, depois build.**

**Antes (sessão de dev, sem produção):**
1. PR mesclado na `main`; build de entrega **da `main`**, com `xcodebuild -version` = 27 e `mobile/.env` presente no worktree (§6.3).
2. `conferir-bundle.py` da 1.16 sobre o `main.jsbundle`, em ASCII e UTF-16 (§6.1–6.2): `foto_activity_id`, `Por que esta foto`, `Trocar a capa`.
3. O `sha256` da migration fica fixo no `aplicar.sh` da 1.16.

**Na janela (com o dono — escreve em produção):**
4. `aplicar.sh --ensaio`: confere token, sha e produção (68 migrations, coluna `motivo` ausente, e conta as capas `foto` — 2 em 18/09). Primeiro uma **sonda** prova que a API aplica o payload numa transação só (tabela descartável + exceção; a tabela não pode sobrar). Depois manda o arquivo seguido de um bloco que **lança exceção** com as conferências — a transação implícita aborta e nada fica (o mesmo truque do `--falhar-no-fim`). Substitui o ensaio local, que hoje não prepara.
5. `aplicar.sh`: digitar `aplicar`; o arquivo inteiro, o `insert` em `supabase_migrations.schema_migrations` (versão `20260918120000`) e o `notify pgrst, 'reload schema'` vão **no mesmo payload** — ou tudo, ou nada.
6. Conferências: duas colunas novas, `edicoes_capa_motivo_check` presente, toda capa `foto` cuja foto ainda existe com `foto_activity_id` preenchido, `motivo` nulo em todas, 69 migrations.
7. Instalar o build, abrir julho: a capa desenha, o disco aparece, a ficha diz "Impressa antes de o app guardar o porquê.", e a atividade é Tour de la Meuse-Rhin.

**Se der errado:** migração que falha não deixa nada (transação única); falha de rede no ato 2 não é "nada mudou" — o script relê produção e diz o estado real. Desfazer, se um dia for preciso, é o SQL que o script imprime no fim (nunca executa): as duas colunas e a versão registrada. App que fecha: **ler o log antes de nomear a causa** (§6.4) — `xcrun devicectl device process launch --device <id> --console --terminate-existing com.sydtpt.vitale`. Não publicar `eas update` nesta janela: o canal `preview` está em `rollBackToEmbedded` e o JS entra pelo build (§6.5).

## Suggested Review Order

**O porquê — decidido na impressão, com dono único**

- A entrada: a cascata de sempre, agora carimbando o motivo e a atividade da foto.
  [`capa.ts:243`](../../packages/shared/src/revista/capa.ts#L243)

- estrela → única → rajada, sem tocar `coverOf`: exato porque a rajada só roda sem estrela.
  [`capa.ts:305`](../../packages/shared/src/revista/capa.ts#L305)

- As frases do porquê num `Record` exaustivo — motivo novo não compila sem frase.
  [`capa.ts:482`](../../packages/shared/src/revista/capa.ts#L482)

- A ficha: porquê carimbado; quando, atividade e rota lidos ao vivo.
  [`capa.ts:600`](../../packages/shared/src/revista/capa.ts#L600)

**A migração e o vocabulário**

- Duas colunas nulas, CHECK no molde da natureza; o risco aceito do build antigo está declarado.
  [`20260918120000_capa_motivo.sql:56`](../../supabase/migrations/20260918120000_capa_motivo.sql#L56)

- O backfill da atividade da foto é valor, não reconstrução — `activity_id` não muda.
  [`20260918120000_capa_motivo.sql:78`](../../supabase/migrations/20260918120000_capa_motivo.sql#L78)

- A lista com dono único, e `toCapa` recusando motivo desconhecido como recusa natureza.
  [`edicoes-capa.ts:77`](../../packages/shared/src/data/edicoes-capa.ts#L77)

- A barreira: a lista do TS e a do CHECK têm de ser a mesma.
  [`architecture.test.ts:626`](../../packages/shared/src/architecture.test.ts#L626)

**A troca — ato do dono, em voz alta**

- A capa trocada: recusa o inelegível antes do banco, legenda pela mesma função.
  [`capa.ts:392`](../../packages/shared/src/revista/capa.ts#L392)

- A porta: mesmas deps do carimbo, mas a falha sobe em vez de ser engolida.
  [`edicao-ia.ts:345`](../../mobile/src/lib/edicao-ia.ts#L345)

- A ação: mesma foto recusada, troca em voo recusada, geração só quando aplica.
  [`edicao.store.ts:995`](../../mobile/src/store/edicao.store.ts#L995)

- A guarda por chave que impede duas trocas fora de ordem.
  [`edicao.store.ts:957`](../../mobile/src/store/edicao.store.ts#L957)

**A tela**

- Tocável ⇔ `comFoto`: a decisão continua da vista; o `Modal` fica fora do `ScrollView`.
  [`[inicio].tsx:282`](../../mobile/src/app/revista/%5Btipo%5D/%5Binicio%5D.tsx#L282)

- A marca do toque: o único botão para o VoiceOver, sem calar período e manchete.
  [`MarcaDoToque.tsx:31`](../../mobile/src/components/revista/MarcaDoToque.tsx#L31)

- Um `Modal`, duas faces; o voltar do sistema fica inerte com troca em voo.
  [`CapaAberta.tsx:98`](../../mobile/src/components/revista/CapaAberta.tsx#L98)

- A ficha em papel embaixo da foto, e o ato "Trocar a capa".
  [`CapaAberta.tsx:132`](../../mobile/src/components/revista/CapaAberta.tsx#L132)

- O seletor virtualizado, quatro por linha; só seleciona o que desenhou.
  [`SeletorDaCapa.tsx:114`](../../mobile/src/components/revista/SeletorDaCapa.tsx#L114)

- A miniatura: posição no rótulo, "já está na capa" desabilitada.
  [`SeletorDaCapa.tsx:339`](../../mobile/src/components/revista/SeletorDaCapa.tsx#L339)

**A janela**

- A sonda do transporte: prova a transação única antes de qualquer DDL.
  [`aplicar.sh:179`](revista-1-16/aplicar.sh#L179)

- Migração, registro e `notify pgrst` no mesmo payload — ou tudo, ou nada.
  [`aplicar.sh:269`](revista-1-16/aplicar.sh#L269)

- O desfazer, só impresso.
  [`aplicar.sh:111`](revista-1-16/aplicar.sh#L111)

**Os testes**

- A matriz da escolha, motivo a motivo.
  [`capa.test.ts:360`](../../packages/shared/src/revista/capa.test.ts#L360)

- A ficha, incluindo o motivo nulo e a atividade não achada.
  [`capa.test.ts:549`](../../packages/shared/src/revista/capa.test.ts#L549)

- A ação sob espiãs: mesma foto, troca em voo, leitura em voo, falha intacta.
  [`edicao-store.test.ts:1784`](../../mobile/src/store/__tests__/edicao-store.test.ts#L1784)

- A porta: fora do período, vídeo, acervo ausente, falha que sobe.
  [`edicao-ia.test.ts:1212`](../../mobile/src/lib/__tests__/edicao-ia.test.ts#L1212)
