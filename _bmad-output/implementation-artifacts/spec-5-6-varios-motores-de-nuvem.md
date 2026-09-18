---
title: 'Story 5.6 — Vários motores de nuvem (F3)'
type: 'feature'
created: '2026-09-17'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'af96818d6659d1a03ea6bc66848c9049a1672132'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-5-5-o-botao-ler-e-a-escolha-do-motor-marco-a.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A lista de motores de nuvem é fixa no código do app (só `nuvem:padrao`), e a
`ia-narrar` devolve falha solta sem classe — o app não pode oferecer outro provedor por recurso
nem confiar no motivo de uma queda ao piso.

**Approach:** A function passa a falar em classes de `ia/fio.ts` (status fixado por classe); o
servidor publica, via `secrets`, a lista de motores aprovados por recurso; o catálogo do app funde
essa lista com o que já conhece, cacheada com instante. `nuvem:padrao` continua sempre elegível.

## Boundaries & Constraints

**Always:**
- Toda falha da function tem `classe` de `CLASSES_DE_FALHA`, status = `STATUS_POR_CLASSE[classe]`.
- `supabase/functions/` só cita classe do que importa de `ia/fio.ts` — nunca literal solto.
- `nuvem:padrao` fica elegível sempre que há rede, mesmo se a leitura da lista do servidor falhar.
- Corpo sem `motor` se comporta como hoje: resolve pelo padrão do recurso.
- A function nunca loga `sistema` nem `usuario` (já cumprido — não regredir).

**Ask First:**
- Subir `TETO_STOP` ou `TETO_PORTA_POR_HOSPEDEIRO` em `architecture.test.ts`.
- Configurar um segundo provedor de nuvem real (chave, endpoint) — fora do escopo.

**Never:**
- Inventar ou configurar um segundo provedor concreto. A lista do servidor continua nomeando só
  `nuvem:padrao` hoje; esta story entrega a **mecânica**, não um segundo provedor ao vivo.
- Tocar `mobile/app.base.json`, código nativo, ou qualquer coisa do marco B (story 5.9).
- Acrescentar campo de "motores aprovados" em `Descritor` — a aprovação por recurso vive na lista
  do servidor, não no núcleo (AD-9).
- Reintroduzir a leitura do formato antigo `{error, detalhe}` em `traduzirDaNuvem`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Motor pedido está na lista | `corpo.motor = 'nuvem:padrao'` | usa o motor pedido | N/A |
| Motor pedido ausente | corpo sem `motor` | usa o padrão do recurso | N/A |
| Motor pedido fora da lista | `corpo.motor` desconhecido | falha com classe `indisponivel`, status fixo | classe correta, nunca crash |
| Lista do servidor falha ao ler | erro no fetch/parse dos `secrets` | catálogo remove só as variantes nomeadas | `nuvem:padrao` continua |
| Function recebe erro inesperado | exceção não mapeada | ainda devolve `CorpoDaFalha` com classe | nunca `{error}` solto |
| Provedor novo sem tabela de regime | tentativa de listar um 2º provedor | não entra na lista | doc ausente é o motivo |

</frozen-after-approval>

## Code Map

- `packages/shared/src/ia/fio.ts:338-342,363-367` -- `CorpoDoPedido` ganha `motor?`/`esquema?`;
  `CorpoDaFalha` (`:363-367`) e `STATUS_POR_CLASSE` (`:377-385`) já existem, comentário próprio já
  anuncia a mudança na 5.6.
- `supabase/functions/ia-narrar/index.ts` (85 linhas) -- hoje devolve `{error,detalhe}` solto
  (`:48,56,58,68,83`), não importa `ia/fio.ts`, não lê `motor` do corpo. É o arquivo que a story
  reescreve por dentro.
- `supabase/functions/_shared/ia/narrador.ts:150-163` -- `resolverNarrador` lê `AI_PROVIDER`/
  `AI_MODEL`/chave; é aqui (ou módulo novo ao lado) que a lista de motores aprovados por recurso
  entra, lida de um novo secret.
- `packages/shared/src/ia/nuvem.ts:100-142` -- `traduzirDaNuvem` ainda lê o formato antigo; a
  leitura antiga morre aqui. `corpoDoPedido` (`:52-54`) ganha `motor`.
- `packages/shared/src/ia/nuvem.test.ts:187-211` -- describe do formato antigo; remover e cobrir
  os cenários da matriz acima.
- `packages/shared/src/architecture.test.ts` -- **guarda nova** (a "guarda 3" da AD-10, nunca
  implementada): nenhum arquivo de `supabase/functions/` declara classe de falha fora do que
  importa de `ia/fio.ts`. Molde: a barreira de import relativo em `:216-247`.
- `mobile/src/lib/motores/catalogo.ts` (185 linhas) -- `MOTORES_CONHECIDOS` é lista estática; ganha
  função de fusão com a lista do servidor (cache + instante), mantendo `nuvem:padrao` sempre.
- `mobile/src/lib/motores/index.ts` (212 linhas) -- `invocar` sobre `ia-narrar`; passa a enviar
  `motor` quando a preferência resolver um motor nomeado, e a buscar a lista do servidor.
- `docs/decisions/0040-o-provedor-de-modelo-e-configuracao-nao-arquitetura.md:85-86,119-121` --
  registra a tabela de regime como pendência; criar `docs/decisions/regime-<provedor>.md` (ou anexo
  à 0040) no formato tier/envio/retenção/DPA/treino/guardrails **antes** de listar um 2º provedor.

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/ia/fio.ts` -- acrescentar `motor?: MotorId`, `esquema?: Esquema` a
  `CorpoDoPedido` -- ACs 1 e 3. *Feito, e mais: `MotorDeNuvemAprovado` e
  `lerMotoresDeNuvemAprovados` (nunca lança; só aceita `nuvem:<provedor>/<modelo>`).*
- [x] `supabase/functions/ia-narrar/index.ts` -- importar `ia/fio.ts` por caminho relativo; mapear
  cada erro hoje solto para `CorpoDaFalha` com `classe` + status de `STATUS_POR_CLASSE`; ler
  `motor` do corpo e repassar -- AC 1, 3. *Feito. Nenhum `{error}` sobrou; o status do provedor
  vira classe por tabela própria (a do fornecedor, não a do cliente), e `ErroDoProvedor` sem
  status é `saida-invalida` — o que o comentário do adaptador já anunciava.*
- [x] `supabase/functions/_shared/ia/*` -- ler o novo secret com a lista de motores aprovados por
  recurso; expor essa lista para o app (mesma function, modo/branch novo) -- AC 2, 4. *Feito:
  o GET do `index.ts` devolve `{ motores }`, e `resolverNarrador` passou a aceitar a escolha
  `{provedor, modelo}` — a chave continua vindo sempre do segredo do provedor, nunca do corpo.*
- [x] `packages/shared/src/ia/nuvem.ts` -- remover a leitura do formato antigo em
  `traduzirDaNuvem`; incluir `motor` em `corpoDoPedido` -- AC 1.
- [x] `packages/shared/src/architecture.test.ts` -- nova guarda: `supabase/functions/` só cita
  classe de falha do que importa de `ia/fio.ts` -- AC 1. *Pela AST, não por regex.*
- [x] `mobile/src/lib/motores/catalogo.ts` -- fundir `MOTORES_CONHECIDOS` com a lista do servidor,
  cacheada com instante; falha na leitura remove só as variantes nomeadas -- AC 4. *Feito, e a
  fusão é **por recurso**: a lista aprova um motor para recursos nomeados, não para todos.*
- [x] `mobile/src/lib/motores/index.ts` -- buscar a lista do servidor ao carregar; enviar `motor`
  no corpo quando a preferência resolver um motor nomeado -- AC 3, 4. *Feito. Um motor por id, a
  fila serializada mudou de camada (do `Motor` para o `Transporte`) para continuar sendo uma só.*
- [x] Testes puros novos/ajustados em `packages/shared/src/ia/nuvem.test.ts` e
  `mobile/src/lib/__tests__/` cobrindo a matriz de I/O acima. *`nuvem.test.ts` ajustado e
  ampliado; `mobile/src/lib/__tests__/motores-lista.test.ts` é novo (24 casos), e
  `motores-porta.test.ts` ganhou o corpo com `motor` e a fila entre variantes.*

**Acceptance Criteria:**
- Given a lista do servidor nunca foi lida, when o app abre, then `nuvem:padrao` está disponível e
  nenhuma variante nomeada aparece.
- Given a lista foi lida com sucesso, when um motor nomeado está aprovado para o recurso corrente,
  then ele aparece selecionável no seletor.
- Given o deploy da function com a lista nova ainda não aconteceu, when o build novo do app já lê,
  then a leitura falha graciosamente e `nuvem:padrao` continua a única variante de nuvem.
- Given as seis suítes do portão (`shared` lint+test, `web` build+test, `mobile` tsc+jest) rodam,
  when a story fecha, then todas passam, incluindo a guarda nova e `expo-doctor` 21/21.

## Spec Change Log

**18/09/2026 — a auditoria da matriz moveu duas decisões para onde há teste.** Quatro linhas da
matriz decidem dentro da `ia-narrar`, e **nenhuma suíte deste repositório executa Deno**: o
`alvoDoMotor` e a `CLASSE_POR_STATUS_DO_PROVEDOR` tinham nascido na function, sem rede. A AD-4 é
explícita — *"a tradução é tabela de borda, com teste"*. Ambos foram para `ia/fio.ts` como
`alvoDoMotorPedido(bruto, aprovados)` (puro: a lista entra por parâmetro, nunca do ambiente) e
`classeDoStatusDoProvedor(status)`, com **14 casos novos** em `fio.test.ts`. A function ficou só
com o reconhecimento do tipo do erro e a costura; `motorAprovado`, em `_shared/ia/motores.ts`,
morreu — a decisão que ele fazia agora é do núcleo, e aquele arquivo só sabe ler o secret. A
guarda nova foi provada **não vazia**: removido o import do fio de `ia-narrar/index.ts`, ela falha
nomeando as quatro classes citadas; restaurado, volta a verde.

**18/09/2026 — revertido um `"workspaces"` acrescentado ao `package.json` da raiz.** Fora do
escopo e perigoso: os workspaces deste monorepo são do `pnpm-workspace.yaml` (AD-14, resolução
isolada), e esse campo é o que faz um `npm install` acidental achar que pode montar árvore plana —
exatamente a colisão que o CLAUDE.md alerta. Nenhuma dependência foi tocada nesta story.

**18/09/2026 — os checkboxes passaram a dizer a verdade.** A story foi retomada por uma sessão
nova, e encontrou trabalho já escrito e **sem commit** na worktree: `ia/fio.ts`, `ia/nuvem.ts`,
`ia/nuvem.test.ts`, a guarda nova do `architecture.test.ts`, `_shared/ia/narrador.ts`
(`ErroDoProvedor`) e o arquivo novo `_shared/ia/motores.ts`. Nenhuma tarefa estava marcada, o que
faria a próxima sessão refazer cinco delas por cima. Marcadas as três concluídas e anotadas as duas
parciais. **Nada foi alterado no que já estava escrito** — `pnpm --filter @vitale/shared lint` e
`test` passam nesse estado (`fail 0`), incluindo a guarda nova. A metade que falta é a que dá
trabalho: o `ia-narrar/index.ts` inteiro e as duas peças do mobile.

**18/09/2026 — o catálogo do app deixou de ser constante, e três consumidores sentiram.** A spec
nomeia `catalogo.ts` e `motores/index.ts`. Mas `resolverCadeia(recurso, preferencia, catalogo)`
**descarta calada** a preferência que o catálogo não contém (`ia/motor.ts:281`), e a variante
nomeada só existe depois que a lista do servidor chega. Com o catálogo estático, o dono escolheria
`nuvem:acme/x` no seletor e leria a frase do padrão, sem nada explicando — exatamente o "controle
inerte" que a 5.5 combateu. Então `DepsDoLeitor.catalogo` e `DepsDaImpressao.catalogo` deixaram de
ser `readonly string[]` e viraram `() => Promise<readonly string[]>`, com
`catalogoDoRecurso(recurso)` no app. Custa uma ida à rede por janela de validade (10 min), em
paralelo com a leitura da preferência, num caminho que já espera 13,6 s pelo modelo.

**18/09/2026 — a fila de uma chamada por vez mudou de camada.** Havia um `Motor` de nuvem só, e a
fila era dele. Agora há **um motor por `MotorId`** (cada variante carrega o seu `motor` no corpo),
e uma fila por motor deixaria duas variantes saírem juntas. A serialização desceu para o
`Transporte`, que continua sendo um só. O teste da 5.5 que afirmava
`motorPara(NUVEM_PADRAO) === motorPara('nuvem:acme/modelo-9')` foi **substituído**, não afrouxado:
agora afirma que o mesmo id dá o mesmo objeto, que ids diferentes dão objetos diferentes, e que a
fila continua sendo uma só entre três variantes.

**18/09/2026 — `nuvem:padrao` não vai no corpo.** A matriz licencia as duas leituras (linha 1
manda `corpo.motor = 'nuvem:padrao'`; linha 2, corpo sem `motor`). O app **omite**: o corpo fica
byte por byte igual ao de antes da 5.6, e a janela entre o build novo e o deploy da function nova
custa zero — o app velho e o app novo mandam o mesmo corpo para o caminho que 100% dos usos toma
hoje. A function aceita as duas formas, e há teste nos dois lados.

**18/09/2026 — a bancada entrou junto, e não estava na lista.** `bancada.tsx` percorria
`MOTORES_CONHECIDOS`. Uma variante que o dono pode **escolher** no seletor e não consegue
**comparar** na tela feita para comparar motores é uma tela que esconde justamente o motor novo.
Passou a percorrer `motoresDoRecurso(...)` com a lista. São quatro linhas, e só rodam sob o toque
de "Medir".

**18/09/2026 — a tabela de regime NÃO foi escrita, de propósito.** O Code Map pede
`docs/decisions/regime-<provedor>.md` **antes** de listar um 2º provedor, e o "Never" da spec
proíbe listar um. Sem provedor para descrever, o documento seria ficção. O que existe agora é a
**regra no caminho de quem a violaria**: o cabeçalho de `_shared/ia/motores.ts` traz o formato
exato do `secret` e diz, ali, que provedor novo só entra com a tabela de regime versionada. A
lista mora fora do git — nenhuma barreira mecânica a alcança, então a rede é onde a mão passa.

## Design Notes

**Por que a mecânica sem um segundo provedor real.** As ACs descrevem a lista, o formato, a
resolução e a queda graciosa — nenhuma delas exige que um segundo provedor concreto exista hoje.
Configurar credencial/endpoint de um provedor novo é decisão de produto (qual provedor, qual
custo) que ninguém tomou ainda; inventar um aqui seria uma decisão fantasma. A story entrega o
tubo; encher o tubo é a próxima decisão do dono.

**Por que a guarda nova em vez de esperar o marco B.** O `epics.md` previa a "guarda 3" nascendo
junto de `Engine.swift` (5.4/5.5), que não existe ainda (é a 5.9). Como a 5.6 é a primeira story a
fazer `supabase/functions/` de fato falar em classes, ela é quem cria a asserção — não tem sentido
adiar uma guarda para o único código que hoje a violaria por padrão.

## Verification

**Commands:**
- `pnpm --filter @vitale/shared lint` -- exit 0.
- `pnpm --filter @vitale/shared test` -- verde, incluindo a guarda nova.
- `pnpm --filter @vitale/web build` e `pnpm --filter @vitale/web test` -- verdes (web não muda).
- `cd mobile && pnpm exec tsc --noEmit && pnpm exec jest` -- verdes.
- `cd mobile && pnpm dlx expo-doctor` -- 21/21.
- `grep -rn "'ia-narrar'" mobile/src` -- só `motores/index.ts`, `edicao-ia.ts`, `route-name.ts`.

**Manual checks (if no CLI):**
- Deploy manual da function (`supabase functions deploy ia-narrar`) e do secret novo, **antes** de
  instalar o build que lê a lista -- confirmar que a ordem foi respeitada, não só declarada.

**Resultado medido em 18/09/2026 (worktree `feat/motores-5-6`, sem commit):**

| Comando | Resultado |
|---|---|
| `shared lint` | exit 0 |
| `shared test` | exit 0 -- 24 suítes `fail 0`, incluindo a guarda nova e os 14 casos novos do fio |
| `web build` / `web test` | exit 0 / exit 0 |
| `scripts lint` / `scripts test` | exit 0 / exit 0 |
| `mobile tsc --noEmit` | exit 0 |
| `mobile jest` | exit 0 -- 64 suítes, 968 passaram, 3 pulados (splash, exigem prebuild -- alheios) |
| `expo-doctor` | **20/21** -- 1 check falhou: 5 pacotes Expo atrás de um patch |

O `expo-doctor` é **pré-existente, não regressão**: esta branch não tem nenhuma diferença de
`package.json`, `pnpm-workspace.yaml` ou lockfile contra a `main`, então o resultado dela é o
resultado da `main` (a memória do projeto já registra a mesma falha com 3 pacotes em 11/09; a
deriva é upstream). Consertar pediria mexer em dependência, que esta story não autoriza.

**Prova negativa da guarda nova:** removido o import de `ia/fio.ts` de `ia-narrar/index.ts`, a
suíte do shared falha (exit 1) com *"classe de falha citada sem importar ia/fio.ts:
supabase/functions/ia-narrar/index.ts (capacidade, indisponivel, janela, transitoria)"*.
Restaurado o import, volta a verde. A guarda **não é vazia**.

**Auditoria da matriz de I/O:**

| Linha | Coberta por | Rodou e passou? |
|---|---|---|
| Motor pedido está na lista | `fio.test.ts` -- alvoDoMotorPedido, casos 2 e 3 | sim |
| Motor pedido ausente | `fio.test.ts` -- caso 1 | sim |
| Motor fora da lista → `indisponivel`, status fixo | `fio.test.ts` -- casos 4, 5, 6 + "toda classe tem status fixado" | sim |
| Lista do servidor falha ao ler | `motores-lista.test.ts` -- 24 casos | sim |
| Erro inesperado → `CorpoDaFalha` com classe | `fio.test.ts` -- "é total: todo status devolve uma das sete" | **parcial** |
| Provedor novo sem tabela de regime | -- | **não** |

Duas ressalvas honestas, nenhuma consertável dentro desta story:

1. **"Erro inesperado" está coberto pela metade.** A *classificação* é total e testada; o
   *envelope sempre sair* depende do `try` de topo do `Deno.serve`, e não há harness de Deno neste
   repositório para exercê-lo. Criar um é infraestrutura nova -- "Ask First".
2. **"Provedor novo sem tabela de regime" não é testável por construção.** A lista mora num
   `secret`, fora do git; nenhuma barreira mecânica a alcança. **Veredito do dono, 18/09/2026:**
   fica como regra escrita — é governança, não mecanismo —, mas sai do cabeçalho do `.ts`, que
   ninguém abre para rodar CLI, e vira item de checklist do runbook do deploy:
   [`motores-5-6/deploy-da-lista.md`](motores-5-6/deploy-da-lista.md). O cabeçalho de
   `_shared/ia/motores.ts` passa a apontar para lá.

   O portão **não é acionado por esta story**: o `Never` do spec mantém a lista vazia hoje, e
   `nuvem:padrao` nunca entra nela (o leitor do núcleo o rejeita), logo nenhum provedor entra.

   ⚠️ **Divergência aberta:** o `epics.md` manda o contrário — *"os dois recursos que existem
   entram aprovados para o modelo em produção hoje"*. O spec aprovado vence e a lista fica vazia;
   mas se o dono decidir pela variante nomeada do Google, **a tabela de regime dele vira
   pré-requisito do deploy** e ainda não existe. Três dos seis campos (tier, DPA, uso para treino)
   não se deduzem do código.

## Suggested Review Order

**O contrato do fio — comece aqui**

- A decisão que diz se um motor pedido é atendido; pura, e a lista entra por parâmetro.
  [`fio.ts:523`](../../packages/shared/src/ia/fio.ts#L523)

- O status **do fornecedor** vira classe do Orbe. Não é a tabela do cliente, e é total.
  [`fio.ts:568`](../../packages/shared/src/ia/fio.ts#L568)

- A forma da lista, e a leitura que nunca lança e descarta entrada solta em silêncio.
  [`fio.ts:402`](../../packages/shared/src/ia/fio.ts#L402)

- O `motor` opcional no corpo: ausente, a function se comporta como antes da 5.6.
  [`fio.ts:347`](../../packages/shared/src/ia/fio.ts#L347)

**A function — a falha passou a ter classe**

- O verbo novo. Sempre 200: lista vazia é resposta, não erro.
  [`ia-narrar/index.ts:103`](../../supabase/functions/ia-narrar/index.ts#L103)

- O status nunca é escolha daqui — sai de `STATUS_POR_CLASSE`.
  [`ia-narrar/index.ts:75`](../../supabase/functions/ia-narrar/index.ts#L75)

- A rede de topo: nem um defeito nosso sai sem classe.
  [`ia-narrar/index.ts:193`](../../supabase/functions/ia-narrar/index.ts#L193)

- O secret, e o log de toda entrada descartada — o typo mais provável da operação.
  [`_shared/ia/motores.ts:61`](../../supabase/functions/_shared/ia/motores.ts#L61)

**O catálogo do app — onde a lista vira escolha**

- O fio que leva a lista fundida às duas leituras de produção. Assíncrono de propósito.
  [`motores/index.ts:410`](../../mobile/src/lib/motores/index.ts#L410)

- O cache com instante, uma ida só para pedidos simultâneos, e a falha que não apaga.
  [`motores/index.ts:346`](../../mobile/src/lib/motores/index.ts#L346)

- `null` é "não perguntei"; vazio é "perguntei e não há". A distinção sustenta o módulo.
  [`motores/index.ts:326`](../../mobile/src/lib/motores/index.ts#L326)

- A fusão é **por recurso**: a lista aprova para recursos nomeados, não para todos.
  [`motores/catalogo.ts:208`](../../mobile/src/lib/motores/catalogo.ts#L208)

- O nome sai do próprio id, sem depender do cache: "o modelo-9 da acme".
  [`motores/catalogo.ts:258`](../../mobile/src/lib/motores/catalogo.ts#L258)

**Os dois hospedeiros do motor de nuvem — leia em par**

- Um motor por id, com o id injetado; `nuvem:padrao` segue sem `motor` no corpo.
  [`motores/index.ts:236`](../../mobile/src/lib/motores/index.ts#L236)

- O gêmeo da bancada. Divergiram na revisão: media o padrão e reportava o nomeado.
  [`bancada/motores.ts:233`](../../scripts/bancada/motores.ts#L233)

- A costura que os dois compartilham: o `motor` entra no corpo, ou não entra.
  [`nuvem.ts:175`](../../packages/shared/src/ia/nuvem.ts#L175)

**A barreira**

- Classe citada em `supabase/functions/` sem importar o fio reprova. Pela AST, não por regex.
  [`architecture.test.ts:1433`](../../packages/shared/src/architecture.test.ts#L1433)

**Periféricos**

- Os 14 casos das duas decisões de borda — a razão de elas terem saído da function.
  [`fio.test.ts`](../../packages/shared/src/ia/fio.test.ts)

- A lista, o cache e a fusão, em 24 casos mais os que a revisão exigiu.
  [`motores-lista.test.ts`](../../mobile/src/lib/__tests__/motores-lista.test.ts)

- O roteiro do deploy, e a regra que nenhuma máquina cobra.
  [`deploy-da-lista.md`](motores-5-6/deploy-da-lista.md)
