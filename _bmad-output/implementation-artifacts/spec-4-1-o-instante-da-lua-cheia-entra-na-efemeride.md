---
title: 'Story 4.1 — O instante da lua cheia entra na efeméride'
type: 'feature'
created: '2026-09-17'
status: 'done'
review_loop_iteration: 1
baseline_commit: 'a859300d578234131935ce405785c05112f19fc2'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md'
  - '{project-root}/docs/specs/revista-retrospectiva/pre-registro-lua.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** O teste lunar precisa saber se cada noite cai nas 5 que antecedem a lua cheia, mas `astro/moon.ts` só dá a fração iluminada. A idade em dias sai dela com até ~0,8 dia de erro, o que embaralha a coluna testada com a de controle. Uma janela deslocada não quebra teste nenhum: mede ruído com cara de protocolo (R-18).

**Approach:** `astro/moon.ts` ganha o instante verdadeiro das **quatro** fases (Meeus cap. 49), conferido contra o USNO. `sleep/lua.ts` nasce com duas coisas só: o instante que representa a noite, fixado no **fim** dela, e a janela `[cheia − 5 d, cheia)`. A decisão do dono de 17/09 troca "entardecer" por "fim da noite" nos documentos de planejamento, com nota datada.

## Boundaries & Constraints

**Always:**
- A noite de `wakeDay` é representada por **08:00 UTC do próprio `wakeDay`** (9h no inverno, 10h no verão em Bruxelas), fixo em UTC. Nunca pelo `apagou` medido, e nunca por hora local, porque a mudança de horário daria 4 ou 6 noites numa janela. Decisão do dono em 17/09, na revisão: 11:00 UTC tirava a −1 da janela em cerca de um quarto dos ciclos.
- A janela é fechada à esquerda e aberta à direita: `cheia − 5 d ≤ t < cheia`. A noite que contém a cheia fica de fora.
- Os dois erros de qualquer hora fixa ficam **declarados** no docblock de `sleep/lua.ts` e nas notas dos documentos, sem número que não seja reproduzível: se ele acorda antes das 08:00 UTC e a cheia cai entre o despertar e 08:00 UTC, a noite que terminou antes dela fica de fora (erro contra o achado); se ele acorda depois das 08:00 UTC e a cheia cai entre 08:00 UTC e o despertar, a noite que a contém entra como −1 (erro a favor do achado).
- Toda cheia tem **exatamente 5** noites na janela, numeradas de −5 a −1.
- Os instantes estão em UT. ΔT é constante declarada, com o valor e a fonte no comentário.
- `moon.ts` continua sem devolver idade em dias.
- A tolerância contra o USNO é de 2 min **por fase**, e o pior erro medido é impresso no fim do teste. Acima dela, o teste cobra o viés e a dispersão dos erros com sinal nas fases todas, para que perder o ΔT ou os termos planetários reprove.
- Todo arquivo de `sleep/lua.ts` é puro: sem fuso, sem ambiente, sem coordenada.

**Ask First:**
- Qualquer mudança em `pre-registro-lua.md` ou `correcao-pre-registro-lua.md`. As sha256 não podem mudar.
- Mudar a hora fixa da noite, o tamanho da janela ou a tolerância.

**Never:**
- Consultar dado de sono ou de produção. O pré-registro proíbe olhar antes de rodar.
- Portões, vereditos, `PRE_REGISTRO_LUA_SHA` ou migração (4.2), ou barreira em `architecture.test.ts` (4.3, e arquivo da 1.10).
- Janela para nova ou quartos: isso é o pré-registro novo que está no `deferred-work`.
- Tocar `ia/`, `data/`, `mobile/`, `web/`, ou mudar `moonPhase`.

## I/O & Edge-Case Matrix

| Cenário | Entrada / Estado | Esperado | Erro |
|---|---|---|---|
| Borda esquerda | `t = cheia − 5 d` exato | `{ cheia, noite: -5 }` | N/A |
| Borda direita | `t = cheia` exato | `null` (a janela fechada à direita erraria aqui) | N/A |
| Um ms antes | `t = cheia − 1 ms` | `noite: -1` | N/A |
| Noite que contém a cheia | cheia às 03:00 UTC de W; `wakeDay = W` | `null` | N/A |
| Cheia à tarde | cheia às 15:00 UTC de W | `wakeDay = W` → −1; `W+1` → `null` | N/A |
| Cheia entre 08:00 e 11:00 UTC | cheia de 20/05/2027, 10:59 UTC pelo USNO | `wakeDay = 2027-05-20` → −1; `2027-05-21` → `null` (com 11:00 UTC, a de 20/05 ficaria fora) | N/A |
| Fora | `t = cheia − 5 d − 1 ms` | `null` | N/A |
| `wakeDay` malformado | `'2026-9-1'`, `''`, `'2026-02-30'` | — | lança `RangeError` com o valor |

</frozen-after-approval>

## Code Map

- `packages/shared/src/astro/moon.ts:1-29` -- docblock que recusa a idade; acrescentar o instante das fases e manter a recusa. `:41` `moonPhase`, que é Meeus 47 de baixa precisão, **não muda**: serve de conferência cruzada.
- `packages/shared/src/astro/moon.test.ts:1-26,29` -- molde de teste (`tsx`, `node:assert`, `check`) e da tabela de efeméride com fonte datada.
- `packages/shared/src/astro/sun.test.ts:1-19` -- molde do docblock da referência USNO: tolerância que absorve o arredondamento ao minuto, erro medido impresso no fim.
- `packages/shared/src/astro/sun.ts:47-50` -- `DAY_MS` e `J2000_MS`, a convenção das constantes de tempo.
- `packages/shared/src/models/index.ts:886` -- `SleepPeriod.wakeDay` ('YYYY-MM-DD' local), a chave da noite.
- `packages/shared/src/sleep/triggers.ts:51` -- `TRIGGER_MIN_PER_CELL`, vizinho da 4.2; não tocar.
- `packages/shared/src/index.ts:59` -- acrescentar `./sleep/lua` depois de `./sleep/leitura`. A 1.10 foi commitada em `f1554c7` (branch `feat/revista-1-10-sequencia`) e insere nas linhas 43 e 64: a mescla tem de ser provada limpa contra esse commit.
- `https://aa.usno.navy.mil/api/moon/phases/year?year=AAAA` -- referência em UT, ao minuto; respondeu em 17/09/2026. Cobrir de 2023 a 2027.
- `_bmad-output/planning-artifacts/epics.md:148,388,1393-1396`, `.../architecture-Orbe-revista-2026-09-08/ARCHITECTURE-SPINE.md:227-231`, `epic-4-context.md` -- os três lugares que dizem "entardecer".
- `skills/test-artifacts/test-design-epic-1.md:236,371` -- a evidência que o R-18 exige.

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/astro/moon.ts` -- `LunarPhaseKind` (`new` · `firstQuarter` · `full` · `lastQuarter`), `lunarPhaseInstant(kind, lunacao)`, `lunarPhasesBetween(de, ate)` (intervalo `[de, ate)`, ordenado) e `nextLunarPhase(kind, t)` (estritamente depois de `t`), com as correções periódicas, planetárias e o W dos quartos de Meeus 49 -- é o módulo dono do conceito.
- [x] `packages/shared/src/astro/moon.test.ts` -- tabela USNO 2023–2027, todas as fases, erro ≤ 2 min, pior erro impresso; ordem nova → crescente → cheia → minguante sem buraco; `moonPhase` > 0,98 na cheia e < 0,02 na nova; nenhum export com `age` ou `idade` -- a efeméride é a única verdade do teste. Uma tabela grande pode ir para um arquivo `.data.ts` irmão.
- [x] `packages/shared/src/sleep/lua.ts` -- `JANELA_LUNAR_NOITES = 5`, `HORA_UTC_DO_FIM_DA_NOITE = 8`, `instanteDaNoite(wakeDay)`, `janelaLunarDoInstante(t)` e `janelaLunar(wakeDay)`, os dois devolvendo `{ cheia, noite: -5..-1 } | null` -- a cheia identifica o ciclo, que o portão de ciclos da 4.2 conta.
- [x] `packages/shared/src/sleep/lua.test.ts` -- a matriz inteira, mais: para cada cheia de 22/05/2023 a 2027, exatamente 5 `wakeDay` com −5..−1, cada um uma vez, e o `wakeDay` da noite que contém a cheia devolvendo `null`.
- [x] `packages/shared/src/index.ts` -- exportar `./sleep/lua` -- o barril é a única porta até os apps.
- [x] `epics.md`, `ARCHITECTURE-SPINE.md` e `epic-4-context.md` (linhas no Code Map) -- "instante fixo do entardecer" vira "instante fixo do fim da noite (08:00 UTC do `wakeDay`)", com nota datada de 17/09/2026: o entardecer punha a noite da cheia na janela sempre que a cheia caía entre ele e o fim da noite, e os dois erros que sobram com 08:00 UTC ficam declarados. A nota completa vive na AD-6 e no docblock de `lua.ts`; os outros lugares apontam para ela. A 4.2 e as dependências do épico ganham a regra de ordem: o pré-registro das outras fases nasce antes da primeira execução -- o pré-registro não muda.

**Acceptance Criteria:**
- Given as sha256 dos dois documentos do pré-registro antes da story, when ela termina, then as duas são idênticas.
- Given a 1.10 em `f1554c7`, when `git merge-file` simula a mescla do `index.ts` com base `a859300`, then não há conflito.
- Given uma cópia local de `janelaLunarDoInstante` fechada à direita, when roda o teste, then ele reprova. A prova é revertida depois.

## Spec Change Log

- **17/09/2026 — revisão, iteração 1 (intent_gap resolvido pelo dono).**
  - *Achado:* 11:00 UTC está longe do despertar real. Quando a cheia cai entre o despertar e 11:00 UTC, a noite que terminou antes dela sai da janela e a −6 entra; a coluna vira −6..−2 em cerca de um quarto dos ciclos. A afirmação da checkpoint ("as 5 noites são as que terminam antes da cheia") só valia com despertar perto das 11:00 UTC. A revisão também mostrou que a tolerância de 2 min deixa passar ΔT zerado e os termos planetários removidos, e que um coeficiente da cheia estava com o valor da nova.
  - *Emenda:* hora da noite 11 → **8** (decisão do dono, opção a); os dois erros residuais passam a ser declarados; viés e dispersão contra o USNO entram no teste; a matriz ganha a cheia de 20/05/2027 (10:59 UTC). Por decisão do dono (opção a), o código **não foi revertido**: a mudança é uma constante, os casos de borda e texto.
  - *Estado ruim evitado:* uma coluna testada deslocada em um quarto dos ciclos, e uma efeméride que perde o ΔT com o teste verde.
  - *KEEP:* a forma de `moon.ts` (Meeus 49 completo, `lunacao` inteira, `RangeError` na entrada torta, ΔT documentado); a tabela do USNO em `moon-usno.data.ts`; a varredura das 57 cheias com exatamente 5 noites; a invariância de fuso; a varredura de pureza de `lua.ts`; a prova da janela fechada à direita; o export no `index.ts`.

## Design Notes

Por que o fim da noite: com o entardecer às 20:00 e a cheia às 03:00, a noite que contém a cheia tem o instante representativo antes da cheia e entra como −1. Isso acontece sempre que a cheia cai entre o entardecer e o fim da noite. Com o instante no fim, a noite só entra se terminou antes da cheia, que é o sentido literal de "antecedem" no §3 — com a exatidão de quanto 08:00 UTC fica perto do despertar real.

`noite = −⌈(cheia − t) / 1 d⌉`, e só a próxima cheia estritamente depois de `t` pode conter `t` na janela.

## Verification

**Commands:**
- `pnpm --filter @vitale/shared lint` -- expected: sem erro
- `pnpm --filter @vitale/shared test` -- expected: todas as suítes verdes, com o pior erro contra o USNO impresso
- `shasum -a 256 docs/specs/revista-retrospectiva/pre-registro-lua.md` -- expected: `d09365de54bb6bbd6fa8d99af9d1f26cddaebc3492029a63d6b1b6e4f6759664`
- `shasum -a 256 docs/specs/revista-retrospectiva/correcao-pre-registro-lua.md` -- expected: `aad967aae5f9fddd563dfd5f97fd274d236f511fb20f5cdad2dfd45a7e46c308`

## Suggested Review Order

**A noite e a janela — onde o protocolo vira código**

- Comece aqui: por que o fim da noite, por que 08:00 UTC, e os dois erros declarados.
  [`lua.ts:11`](../../packages/shared/src/sleep/lua.ts#L11)

- A hora fixa em UTC, a decisão do dono na revisão.
  [`lua.ts:75`](../../packages/shared/src/sleep/lua.ts#L75)

- A janela `[cheia − 5 d, cheia)`: a borda aberta é o "estritamente" da próxima cheia.
  [`lua.ts:132`](../../packages/shared/src/sleep/lua.ts#L132)

- A data torta lança em vez de rolar para março.
  [`lua.ts:103`](../../packages/shared/src/sleep/lua.ts#L103)

- O ciclo é `cheia.getTime()`, o que o portão da 4.2 vai contar.
  [`lua.ts:83`](../../packages/shared/src/sleep/lua.ts#L83)

**A efeméride — as quatro fases de Meeus 49**

- Instante em UT a partir da lunação inteira; ΔT declarado, entrada torta vira `RangeError`.
  [`moon.ts:286`](../../packages/shared/src/astro/moon.ts#L286)

- Correções da nova e da cheia; −0,00515 é o coeficiente que a revisão corrigiu.
  [`moon.ts:312`](../../packages/shared/src/astro/moon.ts#L312)

- O W dos quartos, a única correção que muda o sinal entre crescente e minguante.
  [`moon.ts:370`](../../packages/shared/src/astro/moon.ts#L370)

- ΔT de 69,2 s, com fonte e o limite de viés que o protege.
  [`moon.ts:243`](../../packages/shared/src/astro/moon.ts#L243)

- A busca estritamente depois de `t`, e o `+ 1` do limite que o teste agora cobra.
  [`moon.ts:438`](../../packages/shared/src/astro/moon.ts#L438)
  [`moon.ts:463`](../../packages/shared/src/astro/moon.ts#L463)

**Documentos — a mudança declarada fora do pré-registro**

- A nota completa da AD-6: entardecer → fim da noite → 08:00 UTC.
  [`ARCHITECTURE-SPINE.md:227`](../planning-artifacts/architecture/architecture-Orbe-revista-2026-09-08/ARCHITECTURE-SPINE.md#L227)

- O critério da 4.1 reescrito, com a nota curta apontando para a AD-6.
  [`epics.md:1402`](../planning-artifacts/epics.md#L1402)

- A regra de ordem: o pré-registro das outras fases vem antes da 1ª execução.
  [`epics.md:1420`](../planning-artifacts/epics.md#L1420)

**Testes e periféricos**

- As bordas que a janela fechada à direita erraria.
  [`lua.test.ts:58`](../../packages/shared/src/sleep/lua.test.ts#L58)

- Os dois casos reais perto da hora fixa, lidos do USNO com a incerteza do minuto.
  [`lua.test.ts:130`](../../packages/shared/src/sleep/lua.test.ts#L130)

- As 57 cheias, cada uma com exatamente 5 noites seguidas.
  [`lua.test.ts:184`](../../packages/shared/src/sleep/lua.test.ts#L184)

- 2 min por fase, e o viés/RMS que pega ΔT zerado e termos planetários perdidos.
  [`moon.test.ts:172`](../../packages/shared/src/astro/moon.test.ts#L172)
  [`moon.test.ts:200`](../../packages/shared/src/astro/moon.test.ts#L200)

- O limite de cima e a concordância das duas funções de busca.
  [`moon.test.ts:244`](../../packages/shared/src/astro/moon.test.ts#L244)

- A tabela do USNO, 2023–2027, a única verdade da efeméride.
  [`moon-usno.data.ts:15`](../../packages/shared/src/astro/moon-usno.data.ts#L15)

- O export no barril.
  [`index.ts:64`](../../packages/shared/src/index.ts#L64)
