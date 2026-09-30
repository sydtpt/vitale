---
title: 'Story 4.3 — A barreira do hash, incondicional e offline'
type: 'feature'
created: '2026-09-29'
status: 'in-progress'
review_loop_iteration: 0
baseline_commit: 'e5a30981d6ff3c9efd11ad941b684a6b0dfb16cb'
context:
  - '{project-root}/docs/specs/revista-retrospectiva/pre-registro-lua.md'
  - '{project-root}/docs/specs/revista-retrospectiva/correcao-pre-registro-lua.md'
  - '{project-root}/docs/specs/revista-retrospectiva/pre-registro-lua-outras-fases.md'
  - '{project-root}/docs/specs/revista-retrospectiva/correcao-2-pre-registro-lua-outras-fases.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A cobrança da cadeia existe, mas **no lugar errado e com um furo de
auto-referência**. `lua-carimbo.test.ts` compara cada elo com o arquivo em disco lendo a
lista `CADEIA_DO_PRE_REGISTRO` — então **editar o documento e a constante no mesmo commit
passa**. E a régua que decide qual noite entra em qual coluna (`sleep/lua.ts`) é
*carimbada* em cada execução e **nunca impedida**.

**Approach:** A barreira canônica vai para `architecture.test.ts` (AD-7), com as sha256
**escritas como literais dela**, independentes da constante que elas guardam. E a régua
ganha `JANELA_LUNAR_VERSAO` com golden do fonte de `lua.ts`, simétrica ao
`MOTOR_LUNAR_VERSAO` da 4.2b, carimbada por execução.

## Boundaries & Constraints

**Always:**
- **Nenhum dado lunar é consultado por ninguém.** Proveniência não precisa de noite medida.
- **Os quatro documentos são imutáveis.** Correção só por documento novo que cite os
  anteriores. Esta story **não escreve** documento de correção.
- **A barreira é pura e offline.** `tsx`, sem banco e sem rede: um teste que dependesse de
  rede ficaria verde por não executar.
- **Incondicional.** Quebra o build tenha havido execução ou não — é a Correção 2 de 08/09.
- **As sha256 esperadas são literais da barreira**, nunca lidas de `CADEIA_DO_PRE_REGISTRO`.
  Uma barreira que confia na constante que guarda não guarda nada.
- **Uma fonte de verdade por sha.** Duas asserções sobre a mesma sha é o defeito que este
  repositório persegue.
- **A régua e o motor têm versões separadas.** Uma mudança de janela não sobe a versão do
  motor: o motor não mudou, a régua mudou (é o que o golden da 4.2b declara).

**Ask First:**
- Se a coluna nova entra editando a migração já mergeada (ver Design Notes) — depois de o
  dono aplicar, isso custa uma segunda janela.
- Qualquer mudança em `lua.ts` que não seja a constante nova.

**Never:**
- Aplicar a migração, tocar banco ou rede, executar o teste.
- A página da lua (4.4). Mudar α, janela, desfecho, portões, vereditos ou limiar.
- Criar uma segunda migração para a coluna — edite a existente.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Um byte em qualquer um dos quatro documentos | sha divergente | a barreira **reprova**, nomeando o arquivo, o sha de hoje e o que fazer | derruba o runner |
| O documento **e** a constante editados juntos | `CADEIA_DO_PRE_REGISTRO` "concorda" com o disco | a barreira **ainda reprova** — os literais dela divergem | derruba o runner |
| Um elo removido da cadeia | 3 elos | reprova: a cadeia é append-only | derruba o runner |
| Um quinto elo acrescentado | 5 elos, sha nova | reprova até os literais da barreira subirem no mesmo commit | derruba o runner |
| `lua.ts` muda sem subir a versão | sha do fonte divergente | reprova, com a distinção escrita: comentário sobe só o golden, fórmula sobe os dois | derruba o runner |
| `lua.ts` muda **com** a versão subida e o golden atualizado | os dois no mesmo commit | passa | N/A |
| Um documento da cadeia é apagado | arquivo ausente | reprova por **alvo ausente**, nunca por vacuidade | derruba o runner |
| Nenhuma execução gravada | tabela vazia | a barreira reprova igual — é incondicional | N/A |

</frozen-after-approval>

## Code Map

- `packages/shared/src/architecture.test.ts:2795-2934` -- o análogo mais próximo: barreira
  que calcula sha256 de fontes e compara com valor pinado em JSON. Tem as quatro partes do
  molde e imprime **o hash de hoje pronto para colar** (`:2897`). `hashDosFontes` em `:3281`.
- `packages/shared/src/architecture.test.ts:57` -- `ROOT = join(import.meta.dirname, '..','..','..')`,
  como a suíte alcança `docs/`, `supabase/` e os outros workspaces. Nunca `process.cwd()`.
- `packages/shared/src/architecture.test.ts:50-56` -- `check()` sem try/catch: uma barreira
  que dispara **derruba o runner**, e é por isso que se confere por exit code.
- `packages/shared/src/sleep/lua-carimbo.test.ts:58-206` -- as asserções da cadeia que
  **saem daqui**. `:210-250` o golden de `MOTOR_LUNAR_VERSAO`, cujo docblock diz por que
  `lua.ts` ficou de fora: *"o motor não mudou, a régua mudou"*. É o molde da simétrica.
- `packages/shared/src/sleep/lua-carimbo.ts:82` -- `CADEIA_DO_PRE_REGISTRO`, `:137`
  `DIGEST_DA_CADEIA` (literal), `:165` `MOTOR_LUNAR_VERSAO`. O arquivo **também** precisa ser
  pinado: ele contém a lista que a barreira guarda.
- `packages/shared/src/sleep/lua.ts:87,90` -- `JANELA_LUNAR_NOITES = 5` e
  `HORA_UTC_DO_FIM_DA_NOITE = 8`; `:150` `janelaLunarDoInstante`, onde a borda vive.
  `lua.test.ts:44` fixa os dois valores — e um teste se edita junto com a constante.
- `supabase/migrations/20260928130000_lua_execucoes.sql:174` -- `motor_versao` e as vizinhas
  `janela_noites`, `hora_utc_do_fim_da_noite`, `borda_direita`. A coluna nova entra aqui.
- `_bmad-output/implementation-artifacts/revista-4-2b/aplicar.sh` -- **pina a sha256 do
  `.sql`**. Editar a migração obriga a atualizar essa sha no mesmo commit.
- `packages/shared/src/architecture.test.ts:921,947,1006` -- as barreiras da 4.2b que vão
  cobrar a coluna nova (texto da migração, vocabulário nos dois sentidos, `NULO =`).
- `packages/shared/src/data/lua-execucoes.ts:200` -- `LUA_EXECUCAO_COLUMNS`; `LuaExecucaoRow`,
  `toLuaExecucao` e a assinatura de `gravarExecucaoLunar` acompanham a coluna.
- `supabase/ensaio/cenarios/lua-execucoes.sql` -- o cenário da janela acompanha a coluna.

## Tasks & Acceptance

**Execution:**
- [ ] `packages/shared/src/architecture.test.ts` -- a barreira canônica da cadeia: os quatro
  documentos com as sha256 **como literais daqui**, mais os fontes de `lua.ts`,
  `lua-protocolo.ts` e `lua-carimbo.ts`. Molde de quatro partes: alvo existe (nunca vácuo),
  detector provado contra o dono, fronteira provada dos dois lados, varredura real. A
  mensagem imprime o sha de hoje pronto para colar e diz o que fazer **e o que não fazer**.
- [ ] `packages/shared/src/sleep/lua-carimbo.ts` -- `JANELA_LUNAR_VERSAO = 1`, ao lado de
  `MOTOR_LUNAR_VERSAO`, com o docblock dizendo por que são duas e não uma.
- [ ] `packages/shared/src/sleep/lua-carimbo.test.ts` -- remover as asserções da cadeia e o
  golden do motor que **migraram**; fica só o que é da forma do módulo (a sonda da borda, a
  operacionalização). Sem duplicata de sha.
- [ ] `supabase/migrations/20260928130000_lua_execucoes.sql` -- `janela_versao smallint not
  null check (janela_versao >= 1)`, com `comment on column`, ao lado de `motor_versao`.
- [ ] `_bmad-output/implementation-artifacts/revista-4-2b/aplicar.sh` -- atualizar a sha256
  pinada do `.sql`.
- [ ] `packages/shared/src/data/lua-execucoes.ts` -- a coluna em `LUA_EXECUCAO_COLUMNS`,
  `LuaExecucaoRow`, `toLuaExecucao` e no carimbo de `gravarExecucaoLunar`.
- [ ] `supabase/ensaio/cenarios/lua-execucoes.sql` -- a coluna no cenário.
- [ ] `docs/specs/revista-retrospectiva/` -- **nada**. Os quatro documentos não se tocam.

**Acceptance Criteria:**
- Given um byte a mais num documento **e** a sha correspondente atualizada em
  `CADEIA_DO_PRE_REGISTRO`, when a suíte roda, then a barreira **reprova** — é o furo de
  auto-referência que esta story fecha. A prova é revertida depois.
- Given `lua.ts` alterado sem subir `JANELA_LUNAR_VERSAO`, when a suíte roda, then reprova.
- Given as sha256 dos quatro documentos antes da story, when ela termina, then as quatro são
  **idênticas**.
- Given cada sha da cadeia, when se procura no repositório, then ela aparece **num lugar só**
  como valor esperado.
- Given os oito portões, when rodam, then todos saem **exit 0**.

## Design Notes

**O furo que esta story fecha, e por que ele não é teórico.** `lua-carimbo.test.ts` faz
`for (const { arquivo, sha256 } of CADEIA_DO_PRE_REGISTRO)` e compara com o disco. Quem
quiser mudar a regra depois de ver o resultado edita o documento e a constante no mesmo
commit, e a suíte fica verde — porque a barreira está conferindo a constante contra si
mesma. A §7.3 quer o contrário: *"não para impedir — para obrigar a dizer em voz alta"*.
Com as sha256 escritas como literais da barreira, a edição continua possível (o dono tem o
repositório) mas passa a exigir **três** edições em lugares diferentes, e a do
`architecture.test.ts` é a que aparece no diff de quem revisa.

**Por que duas versões, e não uma.** `MOTOR_LUNAR_VERSAO` cobre `lua-protocolo.ts` — a
aritmética que produz efeito, p e poder. `JANELA_LUNAR_VERSAO` cobre `lua.ts` — qual noite
entra em qual coluna. Juntá-las faria uma mudança de janela subir a versão do motor, dizendo
a coisa errada. O docblock do golden da 4.2b já declarou essa separação; esta story só
constrói o outro lado.

**O limite honesto do sha de fonte, que já está escrito e tem de continuar.** Um hash não
distingue comentário de fórmula. A mensagem de falha do golden do motor resolve isso pedindo
que quem sobe só o golden **diga isso na mensagem do commit** — porque ninguém consegue
distinguir as duas coisas por um hash. Repita a mesma frase na barreira nova; ela é o que
torna o mecanismo honesto em vez de mágico.

**A coluna, e a janela do dono.** A migração está mergeada e **não aplicada**, então
acrescentar coluna é de graça — depois custaria uma segunda janela. Três valores da janela já
são carimbados, mas a **lógica** de `lua.ts` pode mudar sem nenhum deles mudar: foi o que
aconteceu duas vezes em setembro (entardecer → fim da noite; 11:00 → 08:00 UTC). Sem
`janela_versao`, duas execuções com a mesma janela, a mesma hora e a mesma borda seriam
indistinguíveis mesmo com a régua reescrita no meio.

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
- `shasum -a 256 docs/specs/revista-retrospectiva/correcao-2-pre-registro-lua-outras-fases.md`
  -- registre o valor; ele é o quarto elo e nasceu na 4.2b.

**Provas negativas — rodar, anotar e reverter. Use `cp` de backup, NUNCA
`git checkout --`**, que restaura ao commit e apaga edição não commitada; confira a
restauração por **sha256**, não por `git status`. Prove **isolado**
(`cd packages/shared && pnpm exec tsx <arquivo>`).
- Um byte num documento **com** a constante atualizada **reprova** (o furo de auto-referência).
- `lua.ts` alterado sem subir `JANELA_LUNAR_VERSAO` **reprova**.
- Um elo removido da cadeia **reprova**.
- Apagar um documento **reprova por alvo ausente**, não por vacuidade.
- A coluna nova fora de `LUA_EXECUCAO_COLUMNS` **reprova** na barreira da 4.2b.
