---
title: 'Story 4.2b — `lua_execucoes` e a cadeia do pré-registro'
type: 'feature'
created: '2026-09-28'
status: 'in-progress'
review_loop_iteration: 0
baseline_commit: 'fb9b71c0db20d30d0a141a059680fb61f0d419fb'
context:
  - '{project-root}/docs/specs/revista-retrospectiva/pre-registro-lua.md'
  - '{project-root}/docs/specs/revista-retrospectiva/correcao-pre-registro-lua.md'
  - '{project-root}/docs/specs/revista-retrospectiva/pre-registro-lua-outras-fases.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A 4.2a entrega o veredito das quatro fases, e nada o grava. Sem a tabela não
existe o **acumula** que a §7 exige, nem o contador de execuções, nem as constantes que
pinam a cadeia de documentos. E o §10 do documento de 28/09 cita a §7 no estado **anterior**
às correções de 08/09 — a cadeia está incoerente e só um documento novo a conserta.

**Approach:** A tabela `lua_execucoes` com **uma linha por fase por execução**, escrita por
uma porta única que recebe as quatro de uma vez; o módulo dono do acesso; as constantes que
pinam os **quatro** documentos; e a **terceira correção**, que fecha a cadeia.

## Boundaries & Constraints

**Always:**
- **Nenhum dado lunar é consultado por ninguém.** Nem mediana por fase, nem contagem por
  coluna. "Medir em produção antes de desenhar" é o método da casa e **aqui está proibido**.
- **Os três documentos são imutáveis e não se editam**, nem para corrigir um erro neles. A
  saída é o documento novo, como a própria cadeia prescreve.
- **A terceira correção não muda nada do desenho do teste.** α, janela, desfecho, portões,
  vereditos e limiar ficam intocados. Ela cai inteira dentro do §10 — mecânica anti-gaveta.
- **A tabela acumula, nunca substitui.** `insert`, jamais `upsert`.
- **As quatro fases numa escrita só.** Escrita parcial tem de ser impossível, não proibida.
- **Nulo é "não foi medido", nunca zero.** Efeito, p, poder e z saem nulos quando um portão
  reprovou antes de medir, e cada coluna nullable ganha `comment on column` começando com
  `NULO = …`.
- **A leitura entrega uma linha por noite.** A 4.2a **recusa** `wakeDay` repetido na porta.
- Migração e o JS que a lê saem na **mesma entrega** (AD-15), partidos em commits se preciso.

**Ask First:**
- O grão da tabela, e se o "quatro ou nenhuma" é cobrado pelo banco ou só pela porta em TS.
- Como uma noite com **dois** períodos de sono colapsa numa só (ver Design Notes).
- Qualquer coisa que exija uma segunda janela de migração depois de aplicada.

**Never:**
- Aplicar a migração, escrever em produção, tocar rede ou banco.
- A barreira do hash (4.3 — esta story só cria as constantes) e a página (4.4).
- Resolver o campo do "efeito na direção não pré-registrada" — é da 4.4 e é do dono.
- Mudar `escolherCapa`, `edicoes_ia`, ou qualquer coisa do desenho do teste.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Execução gravada | um `VereditoLunarCompleto` | 4 linhas, uma por fase, mesmo `execucao_id`, numa transação | N/A |
| Tentativa de gravar 3 fases | payload incompleto | a escrita **falha** — nenhuma linha entra | erro alto |
| Segunda execução | a tabela já tem 4 linhas | **acumula**: 8 linhas, 2 `execucao_id` distintos | N/A |
| Portão reprovou numa fase | veredito `inconclusivo` por luz | linha com `efeito`/`p`/`poder`/`z` **nulos** e `falta` com a unidade certa | N/A |
| Leitura da última execução | tabela com 3 execuções | as 4 linhas da mais recente, e o **contador** = 3 | N/A |
| Tabela vazia | nenhuma execução | leitura devolve `null`, contador 0 — "ainda não rodou" | não lança |
| Noite com dois períodos de sono | dois `sleep_periods` no mesmo `wakeDay` | a leitura entrega **uma** noite, pela regra declarada | N/A |
| Coluna que o JS pede e a migração não cria | divergência | a barreira de `COLUNAS_PEDIDAS` **reprova o build** | N/A |
| Um dos quatro documentos muda um byte | sha divergente | a constante da cadeia deixa de bater (o guarda é da 4.3) | N/A |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20260912120000_edicao_por_caderno.sql:123-176` -- o molde literal de
  `create table` + RLS + `comment on table`: sem `if not exists` (fail-fast declarado),
  CHECKs nomeados por extenso, campos de carimbo **sem FK de propósito**. `:90-97` tem o
  único `deferrable initially deferred` do repositório; `:238-245` o `pg_advisory_xact_lock`.
- `supabase/migrations/20260928120000_activities_type_edited.sql` -- a última migration. A
  nova tem de ser **depois** dela: `20260928130000_lua_execucoes.sql`.
- `supabase/migrations/20260912120000_edicao_por_caderno.sql:61-67,79-80,99-106` --
  `metrica_lider`: o precedente de coluna nullable com `comment on column` começando com
  `NULO = …`, e a doutrina "`null` é 'não foi medido' em toda a base".
- `packages/shared/src/architecture.test.ts:761-763` -- `chavesDaInterface(arquivo, 'XRow')`
  lê a interface do fonte; `:765-790` a lista `COLUNAS_PEDIDAS` e a barreira. A entrada nova
  são três linhas, e a barreira lê as **migrations em disco** — pura e offline.
- `packages/shared/src/data/edicoes-capa.ts` -- o molde do módulo: `COLUMNS` como string
  única, `XRow` (snake_case, `numeric` chega como **string**), `toX` como único tradutor,
  `fetch…`/`gravar…`, `if (error) throw error`, `.select(COLUMNS).single()` na escrita.
- `packages/shared/src/data/paginate.ts:43` -- `fetchAllPages`, e a regra da **ordenação
  total** (acrescente a PK como último critério).
- `packages/shared/src/architecture.test.ts:170` -- a barreira que proíbe `.from()` fora do
  núcleo, teto **zero**: a query nova vai no módulo dono.
- `packages/shared/src/sleep/lua-protocolo.ts` -- `VereditoLunarCompleto`, `ResultadoDaFase`
  (com `falta: { quanto, unidade }`, `zDeMannWhitney`, `efeitoMinimoDetectavelMin`,
  `noitesPara80`) e `AcervoLunar`. É o que a tabela serializa.
- `packages/shared/src/sleep/lua.ts:87,90` -- `JANELA_LUNAR_NOITES` e
  `HORA_UTC_DO_FIM_DA_NOITE`: a operacionalização **fora de documento hasheado**.
- `packages/shared/src/data/sleep.ts` -- de onde as noites vêm. `sleep_periods` tem PK
  `(user_id, onset_at)`, então **dois períodos podem compartilhar um `wakeDay`**.
- `packages/shared/src/ia/recursos.test.ts:300-340` -- o molde de **hash de hashes**
  (`sha256Hex(hashes.join('\n'))`); `ia/verificar.test.ts:2181-2189` o de sha pinada com
  comentário datado; `ia/sha256.ts:65` o `sha256Hex`, **fora do barril de propósito**.
- `_bmad-output/implementation-artifacts/revista-1-9/aplicar.sh` -- o roteiro de janela do
  dono: três atos, sha do `.sql` pinada, e o registro em `schema_migrations`.

## Tasks & Acceptance

**Execution:**
- [x] `docs/specs/revista-retrospectiva/correcao-2-pre-registro-lua-outras-fases.md` -- **a
  terceira correção**, no molde da de 08/09: data, o que corrige (§10 do de 28/09), o sha do
  arquivo corrigido, a tabela do que fica **intocado**, e o resumo. Os dois trechos revogados
  que ela conserta estão nomeados no Intent.
- [x] `supabase/migrations/20260928130000_lua_execucoes.sql` -- a tabela, RLS com uma policy,
  CHECKs nomeados, `comment on table` e `comment on column` em toda coluna, e o mecanismo que
  torna "quatro ou nenhuma" **impossível de violar** (ver Design Notes).
- [x] `packages/shared/src/data/lua-execucoes.ts` -- `LUA_EXECUCAO_COLUMNS`,
  `LuaExecucaoRow`, `toLuaExecucao`, a leitura da última execução, o contador, e
  `gravarExecucaoLunar` como **porta única** que recebe o `VereditoLunarCompleto` inteiro.
- [x] `packages/shared/src/data/lua-execucoes.ts` -- a leitura que alimenta o motor,
  entregando **uma linha por noite** pela regra das Design Notes, com as horas de luz já
  resolvidas (o motor não importa `astro/sun`).
- [x] `packages/shared/src/architecture.test.ts` -- `CHAVES_DE_LUA_EXECUCAO_ROW` e a entrada
  de `lua_execucoes` em `COLUNAS_PEDIDAS`.
- [x] `packages/shared/src/sleep/lua-protocolo.ts` (ou vizinho) -- `CADEIA_DO_PRE_REGISTRO`:
  os **quatro** documentos e suas sha256, em ordem append-only, mais o digest da cadeia. O
  guarda é da 4.3; aqui nasce a constante.
- [x] `packages/shared/src/data/lua-execucoes.test.ts` -- a matriz inteira, com `SupabaseClient`
  falso no molde da casa.
- [x] `packages/shared/src/index.ts` -- exportar `./data/lua-execucoes`.

**Acceptance Criteria:**
- Given uma tentativa de gravar três fases, when a escrita roda, then **nenhuma linha** entra.
- Given duas execuções gravadas, when a tabela é lida, then há 8 linhas e o contador diz 2.
- Given as sha256 dos três documentos existentes antes da story, when ela termina, then as
  três são **idênticas** — e a nova constante tem quatro entradas.
- Given `pnpm --filter @vitale/shared test`, when roda, then **exit 0**.
- Given uma coluna removida da migração sem sair de `LUA_EXECUCAO_COLUMNS`, when o teste roda,
  then a barreira **reprova**. A prova é revertida depois.

## Design Notes

**O grão: uma linha por FASE por execução.** PK `(user_id, execucao_id, fase)`, no precedente
da 1.9 — `edicoes_ia` virou uma linha por caderno com `caderno` na chave. A alternativa (uma
linha por execução com quatro vereditos dentro) espreme quatro conjuntos de veredito, efeito,
p, poder, contagens e portão numa linha larga ou num JSON sem tipo, e perde o CHECK. Com o
grão por fase, `veredito`, `motivo` e `falta_unidade` ganham CHECK de verdade.

**"Quatro ou nenhuma" (§9) tem de ser do banco, não da porta.** Um `insert` de quatro linhas
numa statement já é atômico, e isso resolve o caminho felizes — mas deixa a regra dependendo
de o único chamador estar certo, e **este par de documentos existe para não depender de
disciplina**. Recomendação: um `constraint trigger ... deferrable initially deferred` que, no
commit, cobra que todo `execucao_id` tem exatamente quatro linhas, uma por fase. O
`deferrable` é o que permite as quatro entrarem antes da cobrança — o mesmo mecanismo que a
1.9 usou para a permutação de posições. **Não** é preciso `pg_advisory_xact_lock`: execuções
acumulam e nunca permutam, então não há a corrida que a 1.9 tinha.

**A dívida da operacionalização, mitigada de graça.** `JANELA_LUNAR_NOITES`,
`HORA_UTC_DO_FIM_DA_NOITE` e a borda aberta vivem em código, fora de documento hasheado —
mudá-los depois de ver o resultado desloca a coluna testada **sem quebrar o build**. Grave os
valores **em cada execução**. A 4.3 decide se a barreira os cobra; enquanto isso, as linhas
acumuladas tornam a mudança **visível depois do fato**, que é o propósito declarado da §7.3:
não impedir, obrigar a dizer em voz alta.

**A noite com dois períodos de sono — decisão que vai ao CHECKPOINT.** `sleep_periods` tem PK
`(user_id, onset_at)`, então um `wakeDay` pode ter dois períodos, e a 4.2a **recusa** o
repetido. Recomendação: colapsar pelo **`onset_at` mais cedo** da noite, declarado na coluna e
no docblock. O argumento: o desfecho é *a hora de apagar*, e apagar é quando o sono começou; um
período posterior na mesma noite é um despertar, que `awakenings` já modela. Isso é
operacionalização, como o 08:00 UTC foi — não muda o desfecho do §3 —, mas é escolha e fica
escrita.

**A cadeia são quatro elos, em ordem.** `pre-registro-lua.md` → `correcao-pre-registro-lua.md`
→ `pre-registro-lua-outras-fases.md` → a correção nova. Guarde a lista ordenada de
`{ arquivo, sha256 }` **e** o digest da cadeia; a linha da execução carrega a lista, porque a
pergunta que um leitor futuro faz é *quais documentos autorizaram isto*, não *qual era o
digest*.

## Verification

**Commands:**
- `pnpm --filter @vitale/shared lint` -- expected: exit 0
- `pnpm --filter @vitale/shared test` -- expected: **exit 0**
- `pnpm --filter @vitale/web build && pnpm --filter @vitale/web test` -- expected: exit 0
- `pnpm --filter @vitale/scripts lint && pnpm --filter @vitale/scripts test` -- expected: exit 0
- `cd mobile && pnpm exec tsc --noEmit && pnpm exec jest` -- expected: exit 0
- `shasum -a 256 docs/specs/revista-retrospectiva/pre-registro-lua.md` -- expected:
  `d09365de54bb6bbd6fa8d99af9d1f26cddaebc3492029a63d6b1b6e4f6759664`
- `shasum -a 256 docs/specs/revista-retrospectiva/correcao-pre-registro-lua.md` -- expected:
  `aad967aae5f9fddd563dfd5f97fd274d236f511fb20f5cdad2dfd45a7e46c308`
- `shasum -a 256 docs/specs/revista-retrospectiva/pre-registro-lua-outras-fases.md` --
  expected: `1227264d01b5f0f35bf7bfcf90fb4241ac89fefef4b28dadfe399918a51251bc`

**Provas negativas — rodar, anotar o resultado e reverter, conferindo `git status` limpo.**
Prove **isolado** (`cd packages/shared && pnpm exec tsx <arquivo>`): na suíte cheia um
`exit 1` pode vir de qualquer arquivo, e a saída traz texto de erro que é fixture de mock.
- Uma coluna a mais em `LUA_EXECUCAO_COLUMNS`, sem a migração, **reprova** a barreira.
- Gravar três fases em vez de quatro **falha**.
- Um byte a mais em qualquer um dos quatro documentos faz a constante da cadeia **divergir**.
