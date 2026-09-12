---
title: 'Story 5.4 — A bancada no Mac, marco A (F1)'
type: 'feature'
created: '2026-09-12'
status: 'done'
baseline_commit: 'e1c91602cd733e2a2273202de62db8d1efa200d5'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-5-3-a-leitura-da-saude-do-sono-sem-modelo.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A leitura da Saúde do sono existe com um motor só — o template — e nada mediu se o texto
de um modelo vale mais que ele nas leituras reais do dono. Sem esse número, o limiar do portão sairia
de impressão, a 1.10 dependeria de um caminho nunca exercido de ponta a ponta, e ninguém sabe quanto a
conferência reprova na prática. Nenhum hospedeiro percorreu a porta ainda: `motorPara` e
`criarMotorDeNuvem` não aparecem em app nenhum.

**Approach:** Nasce o quarto workspace, `scripts/`, e dentro dele a bancada: ela exporta o acervo de
sono sob demanda para fora do git, monta as entradas com `entradaDaSaude`, roda o orquestrador em modo
`medicao` uma vez por janela e por motor — sem modelo e nuvem —, e escreve um relatório chaveado por
recurso, `MotorId` e build do sistema, com o pedido, o desfecho, a classe da falha e os problemas de
cada conferência. O relatório é para o dono ler; o limiar é dele.

## Boundaries & Constraints

**Always:**
- A nuvem entra com **JWT de usuário**, com a credencial vinda do ambiente de quem roda — nunca chave
  de serviço, nunca credencial versionada, nunca impressa.
- Nenhum dado de saúde de produção entra no git: o export e o relatório vão para diretório ignorado, e
  só o **manifesto** é versionado — as janelas, o `hoje` e o hash do export.
- A bancada chama `entradaDaSaude` e o orquestrador em modo `medicao`; o pedido é o mesmo da tela, pelo
  mesmo hash. Ela não reimplementa caso, contagem, pedido nem conferência.
- O literal `ia-narrar` e a construção do transporte vivem **só** no ponto de injeção que a guarda (1)
  já reconhece: `scripts/bancada/motores.ts`.
- A leitura do banco pagina por `fetchAllPages`, com ordenação total, pelos módulos donos das tabelas.
- O workspace novo entra no portão do CI e na barreira do `.from()` no mesmo commit.

**Ask First:**
- Mudar qualquer coisa em `packages/shared/src` que não seja `architecture.test.ts`.
- Subir o teto de uma catraca, ou tirar arquivo do alcance de uma barreira.
- Gastar chamada de nuvem fora da amostra declarada nas Design Notes.

**Never:**
- O marco B: `Engine.swift`, a ponte, a coluna do aparelho e a sonda de fidelidade (o motor escolhendo
  dimensão) — dependem do macOS 27 e vêm depois do veredito de 14/09.
- Deploy: a `ia-narrar` fica como está e não aprende o fio (é a 5.6); nenhuma migration, nenhuma tabela.
- Tocar `mobile/`, `web/`, `supabase/` ou as ferramentas Python de `scripts/github/`.
- Montar a fórmula do período fora do núcleo: a catraca tem teto 2 e a bancada não é o terceiro. A
  comparação `ultima` entre `nightScore` e o `periodScore` da tela fica para a 5.5.
- Fixar limiar, nota de corte ou veredito — isso é do dono, lendo o relatório.

## I/O & Edge-Case Matrix

| Cenário | Entrada / estado | Esperado | Falha |
|---|---|---|---|
| Export sob demanda | credencial no ambiente | noites e notas num diretório ignorado pelo git, mais o manifesto com as janelas, o `hoje` e o hash | — |
| Sem credencial | `ORBE_*` ausente | para antes de qualquer rede, dizendo **quais** variáveis faltam | sai com código ≠ 0 |
| Coluna sem modelo | todas as janelas do acervo | uma linha por janela, com o pedido, o hash e a frase do template | — |
| Coluna da nuvem | a amostra declarada | uma linha por janela medida, com desfecho, `ms`, tokens e a frase | classe da falha na linha |
| Motor que reprova | resposta com algarismo ou contradição | desfecho `reprovada` com os problemas da conferência, regra por regra | — |
| Motor que recusa | recusa em texto livre | desfecho `recusa-do-modelo` | — |
| Nuvem fora do ar | transporte sem rede ou 5xx | a linha traz a classe (`indisponivel`/`transitoria`) e a medição continua nas outras janelas | — |
| Motor não injetado | `MotorId` sem motor | tentativa sintética `indisponivel`, sem chamada de rede | — |
| Relatório | duas execuções do mesmo manifesto | comparáveis, porque o relatório carrega o hash do manifesto | execução de manifesto diferente é recusada na comparação |
| Repetição | mesma janela, mesmo caso | mesmo hash de pedido nas duas execuções | — |

</frozen-after-approval>

## Code Map

- `packages/shared/src/ia/orquestrar.ts:719-727` -- `ler`, sobrecarregado por modo. `OpcoesComuns`
  `:251-258` (`motorPara`, `registrar`, `agora`); medição `:267-270` (`{ modo: 'medicao', motor }`), que
  roda **um** motor, sem recuo nem piso (`medicao()` `:630`; `regimeMaximo` vale, `grava.admite` não,
  `:655-676`). `motor: SEM_MODELO` devolve `{ tipo: 'template' }` `:641-645`; pedido nulo, `'mudo'`
  `:648-651`; motor ausente ou acima do teto, tentativa `sintetica: true` `:665-676`. `Medicao<V>`
  `:201-216`, `Tentativa` `:157-171` (`hash`, `desfecho`, `ms`, `problemas?`), `EventoDoAnel` `:226-247`.
- `packages/shared/src/ia/motor.ts:107` -- `Motor = (pedido) => Promise<Resposta | Falha>`, que nunca
  rejeita. `Falha` `:99-104`, `Resposta` `:85-89`, `hashDoPedido` `:301`.
- `packages/shared/src/ia/fio.ts:44-58` -- as sete classes; `MotorId` `:92`, `SEM_MODELO`/`NUVEM_PADRAO`
  `:71-77`, `lerMotorId` `:120`; `CorpoDoPedido` `:338-342`, `CorpoDaResposta` `:348-357`.
- `packages/shared/src/ia/nuvem.ts:149-159` -- `criarMotorDeNuvem(invocar)`. `Transporte` `:31`:
  `(corpo: CorpoDoPedido) => Promise<{ status; corpo } | { semRede: true; detalhe? }>` — status não-2xx é
  **dado**. Tradução pura em `:100`; `'ia-narrar'` não aparece aqui, é do hospedeiro.
- `packages/shared/src/sleep/leitura.ts:181` -- `entradaDaSaude(noites, notas, { range, offset, hoje })`;
  `:742` `descritorDaSaudeDoSono`. `packages/shared/src/ia/recursos.ts:24` -- o catálogo.
- `packages/shared/src/data/sleep.ts:54` -- `fetchSleepPeriodsSince(db, userId, since)`;
  `packages/shared/src/data/daily-ratings.ts:58` -- `fetchDailyRatingScores(db, userId, since)`;
  `packages/shared/src/data/paginate.ts:43` -- `fetchAllPages`, com o teto de 1000 e a ordenação total.
- `supabase/functions/ia-narrar/index.ts:43-58` -- corpo `{ sistema, usuario, json? }`, teto de 60.000
  caracteres, erros `405/400/413/503/502` **sem** campo `classe` (a 5.6 muda isso);
  `supabase/config.toml:30-31` -- `verify_jwt = true`, então o 401 é do gateway. Resposta: o `Narracao`
  de `supabase/functions/_shared/ia/narrador.ts:30-45` (`texto`, `provedor`, `modelo`, `tokens`,
  `motivoDeParada`). URL: `POST {SUPABASE_URL}/functions/v1/ia-narrar`.
- `packages/shared/src/architecture.test.ts:1127-1175` -- guarda (1): `PONTOS_DE_INJECAO` **já** aceita
  `^scripts/[^/]+/motores\.ts$` e `walk` **já** varre `scripts/`; teto 2, que não sobe. `:132-143` --
  barreira do `.from()`, hoje só `[...webFiles, ...mobileFiles]` (`:57-58`); `:152-162` -- o núcleo não
  constrói client; `:1232-1245` -- guarda (7), `TETO_PECAS_DE_IA = 1`; `:1379-1412` -- a catraca da
  fórmula do período, teto 2.
- `_bmad-output/planning-artifacts/epics.md:1033-1067` -- os quatro critérios do quarto workspace (a
  2.1), e `:1678-1713` -- o marco A. `pnpm-workspace.yaml:13-16` -- só `packages/*`, `web`, `mobile`.
- `.github/workflows/ci.yml:28-53` -- o molde de um job (Node `22`, `pnpm/action-setup`, install
  `--frozen-lockfile`, `lint`, `test`); jobs em `:32`, `:56`, `:76`.
- `packages/shared/package.json:9-10` -- o jeito de rodar teste sem framework:
  `find src -name '*.test.ts' -print0 | xargs -0 -n1 tsx`, e `lint` é `tsc --noEmit`.
- `~/Orbe-dados/sono-2026-09-12/` -- fora do git: o formato do export (293 noites, 89 notas) e o
  `medir-casos-3.ts` da 5.3, que mostra como as janelas são enumeradas.

## Tasks & Acceptance

**Execution:**
- [ ] `scripts/package.json` + `scripts/tsconfig.json` + `pnpm-workspace.yaml` -- o quarto workspace
  `@vitale/scripts`, com `@supabase/supabase-js`, `tsx` e `typescript` declarados, `lint` = `tsc --noEmit`
  e `test` no molde do núcleo; o `tsconfig` cobre só `.ts` e deixa `github/` (Python) de fora -- critérios
  1 e 4 da 2.1
- [ ] `scripts/bancada/supabase.ts` -- o client construído **aqui**, com URL e chave anônima do ambiente,
  e a sessão por `signInWithPassword` com a credencial do ambiente -- critério 4; AD-14 da revista
- [ ] `scripts/bancada/motores.ts` -- o único arquivo que nomeia `ia-narrar`: o transporte (POST com
  `Authorization: Bearer`), `criarMotorDeNuvem` e o `motorPara` da bancada -- guarda (1)
- [ ] `scripts/bancada/exportar.ts` -- export sob demanda pelos módulos donos das tabelas, para
  diretório ignorado, mais o manifesto (janelas, `hoje`, hash do export, amostra, motores) -- AD-11
- [ ] `scripts/bancada/janelas.ts` -- puro: enumera as janelas do acervo (7d, 4s, 12m e as noites) e
  aplica a amostra da nuvem; é o que o manifesto descreve
- [ ] `scripts/bancada/medir.ts` -- o laço: para cada janela, `entradaDaSaude` e `ler` em `medicao`, um
  motor por coluna, com `registrar` recolhendo o anel; falha de rede não interrompe a medição
- [ ] `scripts/bancada/relatorio.ts` -- puro: a forma do relatório (chave, linhas, agregados por caso e
  por regra) em JSON e em Markdown para leitura -- AD-11
- [ ] `scripts/bancada/bancada.ts` -- o executável, com as bandeiras `--hoje`, `--motor`, `--limite`,
  `--so-exportar` e `--export <dir>` (medir sobre um export já em disco, pelo manifesto dele, sem abrir
  rede); sem credencial, para antes de qualquer rede dizendo quais variáveis faltam
- [ ] `packages/shared/src/architecture.test.ts` -- a barreira do `.from()` passa a varrer `scripts/`
  (critério 2), e a guarda (7) também, com o teto ainda em 1; nada mais muda no núcleo
- [ ] `.github/workflows/ci.yml` + `.gitignore` -- o quarto job, no molde dos outros (critério 3), e o
  diretório de saída da bancada ignorado
- [ ] testes -- `scripts/bancada/*.test.ts`, puros e sem rede: a enumeração das janelas e a amostra, a
  forma do relatório e seus agregados, o manifesto (mesmo export e mesmas janelas → mesmo hash), o
  transporte traduzindo status e ausência de rede em classe, e a medição com motor injetado de mentira
  cobrindo cada linha da matriz

**Acceptance Criteria:**
- Given o acervo de produção e `hoje` fixo, when a bancada roda só com a coluna sem modelo, then há uma
  linha por janela com pedido, hash e frase, e duas execuções seguidas dão o mesmo hash em toda linha.
- Given a coluna da nuvem e a amostra declarada, when ela roda, then cada linha traz `MotorId`, desfecho,
  `ms`, tokens e — quando reprovada — a regra e o detalhe de cada problema, e o relatório fecha com o
  número de aprovadas, reprovadas e recusas por caso.
- Given o relatório pronto, when o dono o lê, then ele tem, lado a lado, a frase do template e a do
  motor para a mesma janela, e nenhum número de corte foi decidido por agente.
- Given o diff, then `mobile/`, `web/`, `supabase/` e `scripts/github/` não mudaram, nenhuma credencial
  nem dado de saúde aparece em arquivo versionado, e o CI roda os quatro workspaces.

- **2026-09-12 — o "Ask First" da guarda (7), resolvido pelo dono.** O implementador parou para
  perguntar antes de estreitar o alcance de uma barreira: a bancada precisa de `casoDaSaude` para
  agregar o relatório por caso e para o critério da amostra ("duas janelas por caso × alcance"), e a
  guarda (7) barra peça do núcleo fora dele. **O dono aprovou liberar o nome só em `scripts/`**
  (`LIVRES_NA_BANCADA`): nas telas `casoDaSaude` segue barrado, porque lá o orquestrador já devolve a
  frase pronta e um caso lido na tela poderia discordar dela. As alternativas, descartadas por ele: a
  bancada classificar o caso sozinha (a segunda implementação que a catraca existe para impedir) e
  expor o caso pelo núcleo, que mexeria em assinatura que a 1.10 vai usar. O teto da catraca **não**
  subiu, e uma asserção nova obriga cada nome liberado a ser usado de fato em `scripts/` — liberação que
  ninguém usa sai da lista.

## Design Notes

**O desenho em uma frase:** a bancada é um hospedeiro, não uma biblioteca — ela injeta motor e lê o que
o núcleo já decide. Todo arquivo dela é puro, menos três: `supabase.ts` (rede e credencial),
`motores.ts` (rede) e `exportar.ts` (rede e disco).

**A credencial, e o que acontece sem ela:** `ORBE_SUPABASE_URL` e `ORBE_SUPABASE_ANON_KEY` (caindo para
os `EXPO_PUBLIC_*` quando existirem), mais `ORBE_EMAIL` e `ORBE_SENHA`. A sessão sai de
`signInWithPassword`; o `access_token` vai no `Authorization` do transporte e some com o processo.
Faltando qualquer uma, a bancada para antes de abrir rede e **nomeia as que faltam**. Nada é gravado em
disco, nada é impresso — nem em log de erro.

**Duas entradas, e é o que separa os portões:** com credencial, a bancada puxa o acervo e mede. Com
`--export <dir>`, ela mede sobre um export já em disco — o manifesto dele diz o `hoje` e as janelas — e
**não abre rede nenhuma**. A coluna sem modelo fecha por esse caminho, em qualquer máquina; a da nuvem
precisa do JWT do dono, e é portão dele.

**A amostra da nuvem, declarada:** a coluna sem modelo mede **todas** as janelas (é determinística e de
graça). A da nuvem mede, por padrão, até **duas janelas por caso × alcance**, as mais recentes — no
máximo 28 chamadas, e todos os sete casos cobertos nos dois alcances. `--limite` muda o número, e o
manifesto registra o que valeu. Pedir a nuvem sobre as 387 janelas é decisão do dono (Ask First).

**As janelas:** as quatro que o AC nomeia — `7d`, `4s`, `12m` e as noites (`ultima`) —, com todos os
passos para trás que o acervo alcança, como na medição da 5.3 (73 + 19 + 2 + 293). `ano` fica fora: o
acervo cobre dois anos parciais, ambos `sem-contagem`, e a tela já aparece nas outras quatro.

**O relatório** é JSON (a fonte) mais um Markdown (a leitura). A chave é
`{ recurso, motor, sistema: { plataforma, versao }, manifesto }` — `versao` vem de `os.release()` no Mac,
e é o que vai distinguir a coluna do aparelho no marco B. Cada linha: `range`, `offset`, `caso`,
`alcance`, `hashDoPedido`, `desfecho`, `ms`, `tokens?`, `frase?`, `problemas?`. Os agregados: por caso
(aprovadas, reprovadas, recusas), por regra da conferência (quantas vezes cada uma reprovou) e por
classe de falha. O Markdown mostra **a frase do template ao lado da do motor**, na mesma linha — é assim
que o dono julga se o texto do modelo vale mais, e é onde paráfrase e sinônimo que a conferência não pega
aparecem para ele.

**O manifesto** é o único arquivo versionado da bancada, e não tem dado de saúde: `hoje`, a lista de
janelas (range e quantos passos), o sha256 do export, a regra da amostra, os `MotorId` medidos e a
`versao` do descritor. Dois relatórios só se comparam com o mesmo hash de manifesto — a comparação recusa
manifestos diferentes em vez de somar maçã com laranja.

**O que o núcleo não ganha:** nada. Se a bancada precisar de uma peça que a guarda (7) não deixa passar,
isso é sinal de que a peça está no lugar errado — pare e pergunte, não suba o teto.

## Verification

**Commands:**
- `pnpm --filter @vitale/scripts lint` -- exit 0
- `pnpm --filter @vitale/scripts test` -- exit 0, e nenhum teste abre rede
- `pnpm --filter @vitale/shared lint` e `pnpm --filter @vitale/shared test` -- exit 0 (as barreiras novas)
- `pnpm --filter @vitale/web build` e `cd mobile && pnpm exec tsc --noEmit` -- exit 0 (o workspace novo
  não pode mexer na resolução dos outros)
- `git diff --stat main -- mobile web supabase scripts/github` -- vazio
- `git status --porcelain` depois de uma execução real -- nenhum arquivo de export, relatório ou
  credencial aparece como não rastreado
- `pnpm --filter @vitale/scripts exec tsx bancada/bancada.ts --export ~/Orbe-dados/sono-2026-09-12`
  -- a coluna sem modelo sobre as 387 janelas do acervo, sem rede: o relatório existe, com uma linha por
  janela, e uma segunda execução dá os mesmos hashes. **Este portão é da máquina, e eu o fecho.**

**Portão do dono (não é meu):**
- a coluna da **nuvem** exige o JWT dele no ambiente: só ele pode rodá-la, e o relatório dela é o que
  fixa o limiar. Sem isso, a story fica "construída, falta você medir" — nunca "pronta".

## Suggested Review Order

**O hospedeiro novo, e o que ele promete**

- O executável inteiro numa tela: as bandeiras, a ordem do `hoje`, os dois caminhos de entrada e o que cada saída significa.
  [`bancada.ts:124`](../../scripts/bancada/bancada.ts#L124)
- A regra que mantém dado de saúde fora de qualquer repositório — resolve o caminho real e sobe procurando `.git`.
  [`bancada.ts:261`](../../scripts/bancada/bancada.ts#L261)
- Quando a execução precisa de rede, e por isso de credencial: é o que separa "esqueci de exportar a variável" de "a nuvem caiu".
  [`bancada.ts:278`](../../scripts/bancada/bancada.ts#L278)
- Só a execução padrão atualiza a linha de base versionada.
  [`bancada.ts:308`](../../scripts/bancada/bancada.ts#L308)

**A medição: o orquestrador é quem decide**

- O laço, uma linha por janela e por coluna; falha de rede não interrompe, e defeito vira linha.
  [`medir.ts:160`](../../scripts/bancada/medir.ts#L160)
- As janelas do acervo, passo a passo, com o teto que agora lança em vez de truncar calado.
  [`janelas.ts:96`](../../scripts/bancada/janelas.ts#L96)
- A amostra da nuvem: duas janelas por caso × alcance, as mais recentes — o que limita o custo sem cegar um caso.
  [`janelas.ts:160`](../../scripts/bancada/janelas.ts#L160)
- Os quatro alcances medidos, e o `ano` de fora por decisão declarada.
  [`janelas.ts:47`](../../scripts/bancada/janelas.ts#L47)

**A nuvem, e o segredo**

- O único arquivo que nomeia a function: transporte com prazo, `criarMotorDeNuvem` e o `motorPara` da bancada.
  [`motores.ts:106`](../../scripts/bancada/motores.ts#L106)
- A redação de segredo, aplicada também ao corpo que a function devolve.
  [`motores.ts:88`](../../scripts/bancada/motores.ts#L88)
- O client construído no próprio workspace, com a sessão que se fecha no fim.
  [`supabase.ts:116`](../../scripts/bancada/supabase.ts#L116)

**O acervo e o manifesto**

- A leitura do export em disco, nas duas grafias, com o hash conferido e cada campo que a medição usa validado.
  [`exportar.ts:205`](../../scripts/bancada/exportar.ts#L205)
- O corpo canônico do manifesto: só contagens e hashes, com a regra da amostra por identificador, nunca por prosa.
  [`relatorio.ts:71`](../../scripts/bancada/relatorio.ts#L71)

**O relatório, que é o artefato do dono**

- A forma do relatório e os agregados por caso, por regra e por classe.
  [`relatorio.ts:96`](../../scripts/bancada/relatorio.ts#L96)

**As barreiras e o portão**

- O quarto hospedeiro entra na varredura — com a asserção de que ele existe, senão a barreira fica sem alvo.
  [`architecture.test.ts:151`](../../packages/shared/src/architecture.test.ts#L151)
- A liberação de um nome só, válida só na bancada, e obrigada a ser usada.
  [`architecture.test.ts:1264`](../../packages/shared/src/architecture.test.ts#L1264)
- O quarto job do CI, no molde dos outros três.
  [`ci.yml`](../../.github/workflows/ci.yml)
