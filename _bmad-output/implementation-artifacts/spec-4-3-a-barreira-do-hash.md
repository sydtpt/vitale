---
title: 'Story 4.3 — A barreira do hash, incondicional e offline'
type: 'feature'
created: '2026-09-29'
status: 'done'
review_loop_iteration: 1
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

> **Âncora por símbolo, e não por linha.** A versão anterior deste mapa apontava
> `architecture.test.ts:2795-2934` para o análogo do golden de fonte, e o próprio commit da
> story deslocou o arquivo em 441 linhas: aquele intervalo hoje cai no meio da barreira do
> **alvo mínimo do iOS**, que não tem nada a ver. Um número de linha num arquivo de 7.000
> linhas envelhece no commit seguinte; um nome de símbolo se acha com `grep`.

- `packages/shared/src/architecture.test.ts` → `hashDosFontes` e o `check` *"mudar
  mobile/modules/ exige subir o runtimeVersion junto"* -- o análogo mais próximo: barreira
  que calcula sha256 de fontes e compara com valor pinado em JSON, com as quatro partes do
  molde e o hash de hoje impresso pronto para colar.
- `packages/shared/src/architecture.test.ts` → `const ROOT = join(import.meta.dirname, …)` --
  como a suíte alcança `docs/`, `supabase/` e os outros workspaces. Nunca `process.cwd()`.
- `packages/shared/src/architecture.test.ts` → `function check` -- sem try/catch: uma barreira
  que dispara **derruba o runner**, e é por isso que se confere por exit code.
- `packages/shared/src/sleep/lua-carimbo.test.ts` -- as asserções da cadeia e o golden do
  motor que **saíram daqui**. O que fica é a forma do módulo (a sonda da borda, a
  operacionalização, o piso) e o docblock que diz onde o disco passou a ser cobrado.
- `packages/shared/src/sleep/lua-carimbo.ts` → `CADEIA_DO_PRE_REGISTRO`, `CADEIA_MINIMA`,
  `DIGEST_DA_CADEIA` (literal), `MOTOR_LUNAR_VERSAO`, `JANELA_LUNAR_VERSAO`. O arquivo
  **também** é pinado: ele contém a lista que a barreira guarda.
- `packages/shared/src/sleep/lua.ts` → `JANELA_LUNAR_NOITES`, `HORA_UTC_DO_FIM_DA_NOITE`,
  `janelaLunarDoInstante` (onde a borda vive). `lua.test.ts` fixa os dois valores — e um
  teste se edita junto com a constante, que é por que o golden existe.
- `packages/shared/src/astro/moon.ts` → `nextLunarPhase`, `PHASE_ORDER`;
  `packages/shared/src/sleep/timing.ts` → `axisPosition`, `SLEEP_AXIS_ORIGIN_H`;
  `packages/shared/src/health/trends.ts` → `stdDev` -- **os três importados**, que decidem
  desfecho e não tinham golden. Quem cobre `axisPosition` é `sleep/sleep.test.ts`
  (`sleep/timing.test.ts` **não existe** — um `tsx` nele sai 1 por módulo ausente, que é
  indistinguível de "a mutação foi pega").
- `packages/shared/src/architecture.test.ts` → `FONTES_PINADOS_DA_LUA`,
  `CADEIA_PINADA_DA_LUA`, `fechoDeImportsDeValor`, `queixasDaProvenienciaLunar` -- a barreira
  canônica e o fecho de imports que fecha a porta de escape do "pinar por nome".
- `supabase/migrations/20260928130000_lua_execucoes.sql` → `motor_versao`, `janela_versao` e
  as vizinhas `janela_noites`, `hora_utc_do_fim_da_noite`, `borda_direita`.
- `_bmad-output/implementation-artifacts/revista-4-2b/aplicar.sh` → `SHA_ESPERADO`,
  `ENSAIADO_EM`, o JSON `esperado` do ato 3 -- os três são cobrados por barreira offline.
- `packages/shared/src/architecture.test.ts` → `EXIGIDO_NA_MIGRACAO_LUNAR`,
  `VOCABULARIO_DE_LUA_EXECUCOES`, `comentariosDeColuna` -- as barreiras da 4.2b que cobram a
  coluna nova (texto da migração, vocabulário nos dois sentidos, `NULO =`).
- `packages/shared/src/data/lua-execucoes.ts` → `LUA_EXECUCAO_COLUMNS`, `LuaExecucaoRow`,
  `toLuaExecucao`, `gravarExecucaoLunar` -- acompanham a coluna.
- `supabase/ensaio/cenarios/lua-execucoes.sql` → `v_base`, o bloco **E** -- o cenário da
  janela acompanha a coluna, e os literais dele são cobrados contra as constantes.

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/architecture.test.ts` -- a barreira canônica da cadeia: os quatro
  documentos com as sha256 **como literais daqui**, mais os fontes de `lua.ts`,
  `lua-protocolo.ts` e `lua-carimbo.ts`. Molde de quatro partes: alvo existe (nunca vácuo),
  detector provado contra o dono, fronteira provada dos dois lados, varredura real. A
  mensagem imprime o sha de hoje pronto para colar e diz o que fazer **e o que não fazer**.
- [x] `packages/shared/src/sleep/lua-carimbo.ts` -- `JANELA_LUNAR_VERSAO = 1`, ao lado de
  `MOTOR_LUNAR_VERSAO`, com o docblock dizendo por que são duas e não uma.
- [x] `packages/shared/src/sleep/lua-carimbo.test.ts` -- remover as asserções da cadeia e o
  golden do motor que **migraram**; fica só o que é da forma do módulo (a sonda da borda, a
  operacionalização). Sem duplicata de sha.
- [x] `supabase/migrations/20260928130000_lua_execucoes.sql` -- `janela_versao smallint not
  null check (janela_versao >= 1)`, com `comment on column`, ao lado de `motor_versao`.
- [x] `_bmad-output/implementation-artifacts/revista-4-2b/aplicar.sh` -- atualizar a sha256
  pinada do `.sql`.
- [x] `packages/shared/src/data/lua-execucoes.ts` -- a coluna em `LUA_EXECUCAO_COLUMNS`,
  `LuaExecucaoRow`, `toLuaExecucao` e no carimbo de `gravarExecucaoLunar`.
- [x] `supabase/ensaio/cenarios/lua-execucoes.sql` -- a coluna no cenário.
- [x] `docs/specs/revista-retrospectiva/` -- **nada**. Os quatro documentos não se tocam.

**Rodada 2 (a revisão em três camadas, 30/09):**
- [x] Os **três importados** pinados: `astro/moon.ts` (régua), `sleep/timing.ts` e
  `health/trends.ts` (motor). Mutar `axisPosition` deixava a suíte em exit 0.
- [x] O **fecho transitivo de imports** como conjunto fechado, nos dois sentidos — pinar por
  nome não impedia import novo de entrar sem golden.
- [x] `SHA_ENSAIADO` → `SHA_ESPERADO` + `ENSAIADO_EM` **vazio**, e o roteiro dizendo em voz
  alta que o `.sql` **não** foi ensaiado. O campo antigo afirmava um ensaio que não houve.
- [x] Barreira sobre o `aplicar.sh`: `SHA_ESPERADO` contra o sha do `.sql` que ele aponta, e
  `"colunas"`/`"checks"` contra o próprio SQL. Nenhum portão lia o roteiro.
- [x] O piso `-ge 19` virou igualdade em **45** (17 nomeadas + 28 de coluna): ele passava com
  26 constraints ausentes.
- [x] Ramo do estado parcialmente aplicado no ato 1, com o `alter table` e quando usá-lo.
- [x] Varredura real de `docs/specs/revista-retrospectiva/`: `pre-registro*`/`correcao*` fora
  da cadeia **reprova**. Era a quarta parte do molde que faltava.
- [x] Caminhos distintos, versões consumidas, hash de **bytes** (não de texto decodificado),
  `try/catch` no lugar de `existsSync`, caixa do basename, `.gitattributes -text`, forma dos
  literais, provas negativas do lado pinado (lista encurtada e alvo substituído).
- [x] Histórico **append-only** `versão → sha256` por alvo, teto de 1000 nas duas versões no
  SQL, caso de ensaio para os dois CHECKs de coluna, literal do cenário cobrado contra a
  constante.
- [x] Ordem do digest e cruzamento das duas implementações de sha256 restaurados no harness.

**Acceptance Criteria:**
- Given um byte a mais num documento **e** a sha correspondente atualizada em
  `CADEIA_DO_PRE_REGISTRO`, when a suíte roda, then a barreira **reprova** — é o furo de
  auto-referência que esta story fecha. A prova é revertida depois.
- Given `lua.ts` alterado sem subir `JANELA_LUNAR_VERSAO`, when a suíte roda, then reprova.
- Given `astro/moon.ts` ou `axisPosition` alterados, when a suíte roda, then reprova — era o
  achado mais grave da revisão: os dois mudavam o desfecho e nenhuma versão subia.
- Given um import novo em `lua.ts` sem golden, when a suíte roda, then reprova.
- Given as sha256 dos quatro documentos antes da story, when ela termina, then as quatro são
  **idênticas**.
- Given cada sha256 da cadeia, when se procura no repositório, then ela aparece **num lugar
  só como valor esperado de asserção** — em `CADEIA_PINADA_DA_LUA`. Ela aparece em outros
  lugares como **dado guardado** (`CADEIA_DO_PRE_REGISTRO`, que é o alvo, não o esperado), e
  as três primeiras aparecem **citadas em prosa** dentro dos próprios documentos congelados e
  nos `shasum` da seção Verification. O comando que comprova a forma verificável:

  ```bash
  # cada sha aparece UMA vez como valor esperado de asserção (só em CADEIA_PINADA_DA_LUA):
  for s in d09365de54bb6bbd6fa8d99af9d1f26cddaebc3492029a63d6b1b6e4f6759664 \
           aad967aae5f9fddd563dfd5f97fd274d236f511fb20f5cdad2dfd45a7e46c308 \
           1227264d01b5f0f35bf7bfcf90fb4241ac89fefef4b28dadfe399918a51251bc \
           95cf3e729e9c832a4865ffa10c8e526fd494a1cba67bc61d9d83b4d7524c5b52; do
    printf '%s: %s\n' "${s:0:8}" "$(grep -c "$s" packages/shared/src/architecture.test.ts)"
  done   # os quatro têm de dar 1
  ```
- Given os oito portões, when rodam **separados**, then todos saem **exit 0**.

## Design Notes

**O furo que esta story fecha, e por que ele não é teórico.** `lua-carimbo.test.ts` faz
`for (const { arquivo, sha256 } of CADEIA_DO_PRE_REGISTRO)` e compara com o disco. Quem
quiser mudar a regra depois de ver o resultado edita o documento e a constante no mesmo
commit, e a suíte fica verde — porque a barreira está conferindo a constante contra si
mesma. A §7.3 quer o contrário: *"não para impedir — para obrigar a dizer em voz alta"*.
Com as sha256 escritas como literais da barreira, a edição continua possível (o dono tem o
repositório) mas passa a exigir **cinco** edições em lugares diferentes, e a do
`architecture.test.ts` é a que aparece no diff de quem revisa. Uma rodada anterior deste
documento dizia *três*, e contou mal — **o número maior é o argumento mais forte**, e são
cinco:

1. o **documento** novo de correção (nenhum antigo se edita);
2. o **elo** no fim de `CADEIA_DO_PRE_REGISTRO`;
3. `DIGEST_DA_CADEIA`, que muda com qualquer elo;
4. o **literal** em `CADEIA_PINADA_DA_LUA` (`architecture.test.ts`), mais o `4` da
   não-vacuidade, que sobe no mesmo lugar;
5. o **golden de `lua-carimbo.ts`**, porque as edições 2 e 3 mudam o sha do arquivo.

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

**A contradição dentro do bloco congelado, registrada em vez de corrigida.** O `Ask First`
diz *"se a coluna nova entra editando a migração já mergeada"* e o `Never` diz *"criar uma
segunda migração para a coluna — edite a existente"*. As duas linhas decidem a **mesma**
pergunta em sentidos opostos: uma a manda perguntar, a outra já a respondeu. O bloco é
`frozen-after-approval` e não se edita, então fica aqui o que valeu na prática: **o `Never`
ganhou** — a coluna entrou editando a migração de 28/09, que está mergeada e **não aplicada**,
e é por isso que ela era de graça. O `Ask First` continua valendo para o dia em que a
migração **estiver aplicada**: aí a coluna custa uma segunda janela, e aí a pergunta é real.

**O que os três fontes importados ensinaram sobre o molde.** A rodada 1 pinou os três
arquivos que *se chamam* lua e mediu nada sobre o que eles importam. O resultado foi um golden
que dava exit 0 sobre uma mutação de meia hora em `axisPosition` — uma mutação que muda o
desfecho de toda noite. A lição é do molde, não da lua: **um golden de arquivo nomeado mede o
arquivo, e o arquivo não é o cálculo**. O cálculo é o fecho de imports, e é ele que tem de ser
o alvo. Foi o que a rodada 2 fez, e é por isso que ela conta o fecho em vez de contar nomes.

**Por que a efeméride é régua e não motor.** `astro/moon.ts` serve aos dois — `lua.ts` lhe
pede `nextLunarPhase`, `lua-protocolo.ts` lhe pede `PHASE_ORDER`. O que decide é o **papel**:
o instante da fase põe cada noite dentro ou fora da janela (régua), e `PHASE_ORDER` é ordem de
nomes, que não produz efeito, p nem poder (não é motor). Uma mudança na efeméride move a
coluna testada e não move a aritmética — logo `JANELA_LUNAR_VERSAO`.

## Verification

**Os oito portões, um comando por linha.** Nunca com `&&`: uma corrente esconde o segundo
comando quando o primeiro cai, e o que se quer saber é o exit code de **cada um**.

1. `pnpm --filter @vitale/shared lint` -- expected: exit 0
2. `pnpm --filter @vitale/shared test` -- expected: **exit 0**
3. `pnpm --filter @vitale/web build` -- expected: exit 0 (e apagar `web/dist` depois)
4. `pnpm --filter @vitale/web test` -- expected: exit 0
5. `pnpm --filter @vitale/scripts lint` -- expected: exit 0
6. `pnpm --filter @vitale/scripts test` -- expected: exit 0
7. `cd mobile && pnpm exec tsc --noEmit` -- expected: exit 0
8. `cd mobile && pnpm exec jest` -- expected: exit 0

> **O `test` do shared sai 123, não 1.** O script é
> `find src -name '*.test.ts' -print0 | xargs -0 -n1 tsx`: o `xargs` **continua depois de um
> arquivo vermelho** e sai **123** quando qualquer invocação falhou. Quer dizer duas coisas na
> hora de ler o portão: (a) conferir por exit code, e `-ne 0`, nunca `grep` na saída; (b) um
> arquivo que morre não interrompe os outros, então a saída pode ter dezenas de `ok` **depois**
> da falha. `123` é falha.

**As sha256 dos quatro documentos** (da raiz do repositório):
- `shasum -a 256 docs/specs/revista-retrospectiva/pre-registro-lua.md` -- expected:
  `d09365de54bb6bbd6fa8d99af9d1f26cddaebc3492029a63d6b1b6e4f6759664`
- `shasum -a 256 docs/specs/revista-retrospectiva/correcao-pre-registro-lua.md` -- expected:
  `aad967aae5f9fddd563dfd5f97fd274d236f511fb20f5cdad2dfd45a7e46c308`
- `shasum -a 256 docs/specs/revista-retrospectiva/pre-registro-lua-outras-fases.md` --
  expected: `1227264d01b5f0f35bf7bfcf90fb4241ac89fefef4b28dadfe399918a51251bc`
- `shasum -a 256 docs/specs/revista-retrospectiva/correcao-2-pre-registro-lua-outras-fases.md`
  -- expected: `95cf3e729e9c832a4865ffa10c8e526fd494a1cba67bc61d9d83b4d7524c5b52` (o quarto
  elo, nascido na 4.2b).

**As sha256 dos seis fontes**, como a barreira as pina (30/09/2026). Diferente das quatro de
cima, **estas envelhecem**: as dos documentos são congeladas para sempre, as dos fontes sobem
a cada mudança legítima. A fonte de verdade é `FONTES_PINADOS_DA_LUA`; esta lista é um retrato
do dia, para quem lê o spec sem abrir o teste.
- `sleep/lua.ts` — `3bfd41e5c6d49e1308691f64832c25903b1eb560a6c6f5d539f8dc9a461d0b8c` (régua v1)
- `astro/moon.ts` — `c64fa84ba9132a466dd12ee2061a9d9c2bf25fd618f27e4393c0c9cc910ab52f` (régua v1)
- `sleep/lua-protocolo.ts` — `9c53db13a275096fb0b3cd6080f1f97e431d0ffba8574565ac0786973d5179bb` (motor v1)
- `sleep/timing.ts` — `6ec21cc977989428c14b8337eac79c36ce9ea855c7bf90509427206401cc468a` (motor v1)
- `health/trends.ts` — `d8ffa51b5791c613765b7c0b7fce62c986f2df36f7009605dd0c50c8f5edafe1` (motor v1)
- `sleep/lua-carimbo.ts` — `4a8fbe0788647f95867544d307ee32d0011b7d0304c8d9235a1bfa45827485f6` (sem versão própria)

**Provas negativas — rodar, anotar e reverter. Use `cp` de backup, NUNCA
`git checkout --`**, que restaura ao commit e apaga edição não commitada; confira a
restauração por **sha256**, não por `git status`. Prove **isolado**
(`cd packages/shared && pnpm exec tsx <arquivo>`).

> **Um aviso medido:** `packages/shared/src/sleep/timing.test.ts` **não existe**. Um `tsx`
> nele sai **1 por módulo ausente**, indistinguível de "a mutação foi pega". Quem cobre
> `axisPosition` é `sleep/sleep.test.ts`.

- Um byte num documento **com** a constante atualizada **reprova** (o furo de auto-referência).
- `lua.ts` alterado sem subir `JANELA_LUNAR_VERSAO` **reprova**.
- **`astro/moon.ts` mutado reprova** (rodada 2 — antes dela, exit 0).
- **`axisPosition` mutado em meia hora reprova** (rodada 2 — antes dela, exit 0).
- **Um import novo em `lua.ts`, sem golden, reprova** pelo fecho de imports.
- **Um documento `correcao*` novo no diretório, fora da cadeia, reprova** pela varredura real.
- **Um elo duplicado reprova**; **um alvo substituído na lista pinada reprova** (a troca
  mantém o comprimento, e é o que uma contagem nunca pega).
- **`SHA_ESPERADO` divergente reprova**; **`"colunas"` errado no `aplicar.sh` reprova.**
- Um elo removido da cadeia **reprova**.
- Apagar um documento **reprova por alvo ausente**, não por vacuidade.
- A coluna nova fora de `LUA_EXECUCAO_COLUMNS` **reprova** na barreira da 4.2b.

## Suggested Review Order

**O furo que a story fecha — comece aqui**

- Os quatro elos com as sha256 **como literais daqui**, independentes da constante que guardam.
  [`architecture.test.ts:1201`](../../packages/shared/src/architecture.test.ts#L1201)

- A varredura real: um documento de correção novo fora da cadeia **reprova**.
  [`architecture.test.ts:1693`](../../packages/shared/src/architecture.test.ts#L1693)

**A porta de escape, que era o achado mais grave da revisão**

- Os seis fontes pinados: a régua, a efeméride, o motor, o eixo e o desvio-padrão.
  [`architecture.test.ts:1252`](../../packages/shared/src/architecture.test.ts#L1252)

- O fecho transitivo de imports **de valor**: import novo sem golden reprova, nos dois sentidos.
  [`architecture.test.ts:1413`](../../packages/shared/src/architecture.test.ts#L1413)

**A proveniência das versões**

- O histórico `versão → sha256` é append-only: voltar de 2 para 1 reprova.
  [`architecture.test.ts:1169`](../../packages/shared/src/architecture.test.ts#L1169)

- A régua e o motor são duas versões, e não uma — o motor não muda quando a régua muda.
  [`lua-carimbo.ts:219`](../../packages/shared/src/sleep/lua-carimbo.ts#L219)

**As bordas que faziam a barreira passar verde**

- Hash de **bytes**, não de texto decodificado: UTF-8 inválido colapsava em U+FFFD.
  [`architecture.test.ts:1343`](../../packages/shared/src/architecture.test.ts#L1343)

- Alvo ilegível vira `ausente` em vez de exceção crua, e a **caixa** do nome é conferida.
  [`architecture.test.ts:1374`](../../packages/shared/src/architecture.test.ts#L1374)

- `.gitattributes` com `-text`: um checkout com CRLF quebraria os dez goldens de uma vez.
  [`.gitattributes`](../../.gitattributes)

**A janela do dono**

- `SHA_ESPERADO` e `ENSAIADO_EM` são perguntas diferentes, e a segunda está **vazia**.
  [`aplicar.sh:76`](revista-4-2b/aplicar.sh#L76)

- As expectativas do ato 3 passam a ser cobradas por barreira, não conferidas à mão.
  [`architecture.test.ts:2139`](../../packages/shared/src/architecture.test.ts#L2139)
