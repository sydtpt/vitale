---
title: 'Story 5.2 — O descritor da retrospectiva, e as listas com dono (F0)'
type: 'feature'
created: '2026-09-10'
status: 'done'
baseline_commit: '9883cb98d4f1145a1315427da43422ebdbae368b'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-5-1-a-porta-o-fio-e-o-orquestrador.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A revista ainda percorre pedido → modelo → conferência fora da porta, e a 1.10 precisa de
um descritor para chamar o orquestrador. Os termos proibidos têm um pedaço privado (`CAUSA`) e nenhum
dono para os que a Saúde do sono vai compor; `formatarNumero` mora no prompt da revista, longe de quem
vai interpolar. E a 5.1 não deu ao descritor como declarar os tipos de motor que um recurso que grava
admite (AD-12) — sem isso, "a revista admite só nuvem" não tem onde morar.

**Approach:** Declarar a retrospectiva como descritor sobre as peças que já existem, sem mudar uma
regra; dar à lista de termos proibidos um dono exportado, com subconjuntos nomeados; mudar
`formatarNumero` para `format/numero.ts`; e acrescentar `admite` ao `grava`, respeitado pela
resolução da cadeia, pela validação e pelo orquestrador — que no modo produto passa a recusar
também o elo acima do `regimeMaximo`, porque a cadeia marcada não diz de que recurso veio.

## Boundaries & Constraints

**Always:**
- Nenhuma regra da revista muda: os testes de `pacote.ts` e de `verificar.ts` (onde moram os do
  prompt) passam sem edição; `PROMPT_VERSAO` e `PACOTE_VERSAO` não sobem; a conferência reprova
  exatamente o que reprovava.
- A revista compõe só o subconjunto `causa`, com o casamento de hoje (trecho, em minúsculas).
- Recurso que não grava resolve a cadeia exatamente como na 5.1.
- Barreira nova entra com o código que cobra, e roda offline.

**Ask First:**
- Termo de lista que colida com texto que a revista ou a Saúde já escrevem.
- Tocar qualquer arquivo de `mobile/`, `web/` ou `supabase/`.
- Mudar a resolução da cadeia para recurso que não grava.

**Never:**
- A sequência da impressão (`ia/imprimir.ts`) e as portas `buscar`/`gravar` — são da 1.10.
- O casamento dos subconjuntos novos (palavra inteira, acento) — é da 5.3, que os compõe.
- `ia/interpolar.ts` e o descritor da Saúde do sono — 5.3. Coluna nova no banco.

## I/O & Edge-Case Matrix

| Cenário | Entrada / estado | Esperado | Falha |
|---|---|---|---|
| Caderno com fato | período fechado, pacote com dado | Pedido = o `montarPrompt` de hoje, com `amostragem: 'padrao'`, saída texto e guardrail padrão | — |
| Caderno mudo | `montarPrompt` devolve `usuario: ''` | `montarPedido` → null; nenhuma chamada | piso ausência, causa `mudo` |
| Período em curso | `periodo.fechado` falso | `montarPedido` → null — recurso que grava não narra período em curso (§3 do `ia-analitica`) | piso ausência, causa `mudo` |
| Texto bom | o motor de nuvem devolve texto que passa em `verificarTexto` | `origem: 'motor'`; a frase é o texto | — |
| Texto reprovado | número inventado, ou causa | os problemas são os de `verificarTexto` | piso ausência, causa `reprovada` |
| Preferência não admitida | a revista, com preferência `aparelho:sistema` | a cadeia é `[sem-modelo]` — nunca sobe para a nuvem | piso, causa `preferencia` |
| Elo fora do recurso | cadeia resolvida com outro regime (sem `grava`, ou `regimeMaximo` maior) e passada ao `ler` da revista | o elo de tipo fora do `admite`, ou acima do `regimeMaximo`, vira tentativa sintética `indisponivel`, sem chamada | recua |
| Medição fora do `admite` | modo `medicao`, a revista com `aparelho:sistema` | mede normalmente — é a bancada que abre o `admite`; o `regimeMaximo` segue valendo | — |

</frozen-after-approval>

## Code Map

- `packages/shared/src/ia/prompt.ts:529-532` -- `montarPrompt(p)` devolve `usuario: ''` para caderno mudo (`semDado`, sem cobertura, lacunas, eventos nem correlações); a `ia-narrar` responde 400 a isso. `:38-44` `formatarNumero`, chamado em `:128-133` e `:474`. `:435` `PROMPT_VERSAO = 4`. `:333-414` o `SISTEMA`, que cita frases de conselho (`:339-340`) — prosa, não lista.
- `packages/shared/src/ia/pacote.ts:225-285` -- `PacoteDeFatos`: `caderno` `:227`, `periodo.fechado` `:249`, `semDado` `:284`. `:64` `PACOTE_VERSAO = 2`. `montarPacotes` `:604` devolve os quatro cadernos.
- `packages/shared/src/ia/verificar.ts:46-50` -- `CAUSA`, 16 termos, casados por `baixo.includes(termo)` em `:489-494` (trecho, sem fronteira nem dobra de acento). `:463` `verificarTexto` → `Veredito {ok, problemas}`; `Problema` `:32-35` cabe em `ProblemaDaConferencia`. Não detecta recusa.
- `packages/shared/src/ia/verificar.test.ts:9-11` -- importa `formatarNumero` de `./prompt`; o reexport mantém o teste intacto. `:690-840` edições reais — corpus de falso positivo. `:192` fixa 5 termos de causa.
- `packages/shared/src/ia/orquestrar.ts:98` `Grava`; `:107-129` `Descritor`; `:521-578` `produto` (hoje confia na cadeia marcada; só `medicao` confere o regime, `:606-619` — o molde da tentativa sintética). `ia/recursos.ts:23` `CATALOGO_DE_RECURSOS` vazio; `:32-85` `validarDescritor`. `ia/motor.ts:157-160` `RegimeDoRecurso`; `:171` `elosDoPadrao`; `:222-239` `resolverCadeia`. `motor.ts` não importa `orquestrar.ts` (o contrário sim): o tipo dos que gravam nasce em `motor.ts`. `orquestrar.ts:47` importa `RecursoId` de `recursos` só como tipo — o descritor não pode importar valor de `recursos`, ou nasce ciclo.
- `mobile/src/lib/edicao-ia.ts:91` -- só leitura: a impressão de hoje já para em período em curso (`estado: 'aberto'`) antes de montar; o `null` do descritor é a mesma regra dentro do núcleo.
- `packages/shared/src/ia/recursos.test.ts:55,58,96`, e os descritores de teste de `orquestrar.test.ts` -- montam `grava: { recusaEResultado }` sem `admite`; passam a declará-lo.
- `packages/shared/src/sleep/score.ts:141,333,434,518` -- o texto que a Saúde escreve hoje (`DIMENSION_LABEL`, `fact`/`absent` de `nightScore`/`periodScore`, `coverageNote`); com as frases dos casos em `docs/specs/sono/spec.md:340-355`, é o corpus do teste de palavra inteira.
- `packages/shared/src/index.ts:27-29` -- `export *` de `ia/`; `:71-72` os de `format/`. Nenhum nome novo colide.
- `packages/shared/src/architecture.test.ts` -- a guarda (7) aceita nomes `descritor*` vindos de `ia/`; o idioma das barreiras e o `semComentario` no topo.

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/format/numero.ts` -- `formatarNumero`, movido sem mudar uma linha do corpo -- AD-6
- [x] `packages/shared/src/ia/prompt.ts` -- importa `formatarNumero` de `../format/numero` e o reexporta com o mesmo nome (o teste e o barril seguem pelo caminho de hoje); o barril não ganha `format/numero` -- nenhuma edição de teste
- [x] `packages/shared/src/ia/verificar.ts` -- `VOCABULARIO_PROIBIDO` exportado (`as const`), com os subconjuntos das Design Notes e o tipo `SubconjuntoProibido`; `verificarTexto` passa a ler `VOCABULARIO_PROIBIDO.causa`, na mesma ordem e com o mesmo casamento -- AD-6
- [x] `packages/shared/src/ia/motor.ts` -- o tipo dos que gravam (`'aparelho' | 'nuvem'`); `RegimeDoRecurso` ganha `grava?` (ausente = não grava, e os testes da 5.1 seguem); `resolverCadeia` filtra o padrão por `admite` e trata preferência não admitida como a que passa do regime -- AD-5, AD-12
- [x] `packages/shared/src/ia/orquestrar.ts` -- `Grava` ganha `admite`; no modo produto, elo de tipo fora do `admite` ou acima do `regimeMaximo` vira tentativa sintética `indisponivel`, sem chamada, e a cadeia recua; `medicao` não lê `admite` -- AD-5, AD-12
- [x] `packages/shared/src/ia/retrospectiva.ts` -- `descritorDaRetrospectiva` -- AD-13
- [x] `packages/shared/src/ia/recursos.ts` + `packages/shared/src/index.ts` -- `validarDescritor` cobra: `admite` não vazio, sem repetição, só `aparelho`/`nuvem`, nenhum tipo acima do `regimeMaximo`, e todo elo do padrão (fora `sem-modelo`) admitido; o descritor entra no catálogo; o barril exporta `ia/retrospectiva`
- [x] `packages/shared/src/ia/{retrospectiva,verificar-vocabulario}.test.ts` + os de `motor`, `orquestrar`, `recursos` -- a matriz; `admite` na propriedade exaustiva da AD-5; os termos novos não casam, por palavra inteira, com o corpus da Saúde do Code Map
- [x] `packages/shared/src/architecture.test.ts` -- barreira: fora de `ia/verificar.ts` (e de teste), nenhum arquivo do núcleo declara lista com termo de `VOCABULARIO_PROIBIDO`

**Acceptance Criteria:**
- Given o descritor da retrospectiva, when `validarDescritor` roda, then não há problema, ele está no catálogo, e o teste que percorre o catálogo deixa de ser vácuo.
- Given qualquer preferência × padrão × catálogo × `admite` (ausente, só nuvem, só aparelho, os dois), when `resolverCadeia` roda, then valem todas as propriedades da 5.1 e nenhum elo além de `sem-modelo` tem tipo fora de `admite`.
- Given `VOCABULARIO_PROIBIDO.causa`, then ele é a `CAUSA` de hoje, termo a termo e na mesma ordem, e os testes de `verificar.ts` passam sem edição.
- Given a barreira nova, when um arquivo do núcleo fora de `ia/verificar.ts` declara um array com um termo proibido, then ela reprova — e o `SISTEMA` do prompt, que é texto e não lista, não conta.
- Given `formatarNumero`, then ele é declarado só em `format/numero.ts`, e toda saída formatada é a mesma de antes.
- Given o diff, then nada em `mobile/`, `web/` ou `supabase/` mudou, e o `tsc` do mobile e o build da web seguem verdes.

## Spec Change Log

- **2026-09-11 — implementação, três decisões que a spec não fixava literalmente.**
  (1) No modo produto, o elo que **nem se lê** (só uma cadeia forjada o traria; `resolverCadeia`
  nunca o produz) também vira tentativa sintética `indisponivel`, sem chamada: sem tipo, não há
  exposição a conferir, e na dúvida o dado não sai. A matriz só nomeia "fora do `admite`" e
  "acima do `regimeMaximo`". (2) A barreira lê a árvore do compilador (`typescript`, que já é
  devDependency do núcleo) em vez de regex, porque o `SISTEMA` escreve `"continue assim", "tente
  dormir mais"` — aspas e vírgula — dentro de um template literal, e só um parser separa lista de
  texto. (3) As fontes ao lado de cada termo citam arquivo e seção, não número de linha: as linhas
  de `prompt.ts` já mudaram com esta própria story.

- **2026-09-11 — revisão (três revisores), sem `bad_spec` nem `intent_gap`.** 13 patches e 10
  adiados (`deferred-work.md`). Dois ajustes às decisões acima: (1) o id ilegível vira sintética
  `indisponivel` também na medição, não só no produto; (2) a barreira varre também
  `supabase/functions/` e `scripts/` — `mobile/src` e `web/src` ficam fora de propósito, porque ali os
  termos de uma palavra são vocabulário de domínio (`saldo`, `meta`, `streak`) —, desembrulha `as`,
  `satisfies` e parênteses, e lê alternância de regex com `\s` como espaço. Entrou também o golden do
  pedido por descritor em `recursos.test.ts`, adiado da 5.1 para esta story.

## Design Notes

```ts
export const descritorDaRetrospectiva: Descritor<PacoteDeFatos, string> = {
  recurso: 'retrospectiva', versao: PROMPT_VERSAO * 1000 + PACOTE_VERSAO,   // 4002 hoje
  regimeDeNumeros: 'copiado-e-conferido', regimeMaximo: 'nuvem', cadeiaPadrao: [NUVEM_PADRAO, SEM_MODELO],
  grava: { admite: ['nuvem'], recusaEResultado: false },
  montarPedido: (p) => /* null se período em curso ou usuario === '' */,
  interpretar: (r) => r.texto, conferir: (t, p) => /* verificarTexto(t, p) */,
  montarFrase: (t) => t, semModelo: () => ({ ausencia: 'a revista não imprime sem modelo' }),
};
```

**A versão** é o par que `edicoes_ia` já grava (`prompt_versao`, `pacote_versao`) num número só —
nenhuma coluna nova; um teste fixa `PACOTE_VERSAO < 1000`, senão o par deixa de ser recuperável.
Mudança só na conferência não a sobe: é o ponto cego que já existe hoje.

**`admite`** lista os tipos que o recurso aceita que **gravem** (`'aparelho' | 'nuvem'`). Padrão
filtrado por ele; preferência fora dele é recusada como a que passa do regime — o padrão filtrado à
exposição dela, então quem pede o aparelho para a revista fica em `sem-modelo`, nunca vai à nuvem.
A medição não o lê: medir não grava, e é pela bancada que um tipo novo entra no `admite` (AD-9).

**As listas.** Cada termo com a fonte ao lado, no código. `causa` casa por trecho, como hoje; os
subconjuntos novos só são compostos na 5.3, e **têm de casar por palavra inteira** — o comentário da
lista diz isso, porque por trecho "tente" casa com "consistente" e "meta" com "metade".

| Subconjunto | Termos | Fonte |
|---|---|---|
| `conselho` | continue assim · tente dormir mais · vale a pena acompanhar de perto · que tal · experimente · verifique suas conexões · recomendo · sugiro | `prompt.ts:338-340`; story 1.5; `bases-e-ranqueamento.md:121` |
| `elogio` | parabéns · continue assim · conquista | `prompt.ts:340`; `review-rubrica.md:204`; `v2-jornal.md:172` |
| `placar` | placar · score · pontuação · pontos · de 0 a 100 · saldo | `sono/spec.md:49,132,414`; ADR 0036; `v2-jornal.md:350` |
| `tendencia-e-meta` | melhorou · piorou · melhora · piora · streak · meta · seta | `sono/spec.md:106,366`; ADR 0036:65,181; `bases-e-ranqueamento.md:128` |
| `comparacao` | outras pessoas · a maioria das pessoas · média da população · norma clínica · para a sua idade | derivados do princípio (`sono/spec.md:118-119`; `sleep/retro.ts:27`) — sem fonte literal |

Ficam **fora de propósito**, por colidirem com texto legítimo (`sono/spec.md:345-352`, `score.ts:411-420`): "nota" (a percepção é `… notas`),
"ponto" no singular ("no mesmo ponto" é a frase de todas-iguais), "seguidas" (o fato da
regularidade), "máximo" ("só o horário está no máximo") e "comparar" (medidas-insuficientes diz que
"não há o que comparar").

## Verification

**Commands:**
- `pnpm --filter @vitale/shared lint` -- exit 0
- `pnpm --filter @vitale/shared test` -- exit 0; o catálogo tem um descritor válido
- `cd mobile && pnpm exec tsc --noEmit` -- exit 0
- `pnpm --filter @vitale/web build` -- exit 0
- `git diff --stat feat/motores-5-1 -- mobile web supabase` -- vazio

## Suggested Review Order

**O descritor da revista**

- Entrada: as peças de hoje ditas no idioma do orquestrador, versão = o par gravado.
  [`retrospectiva.ts:46`](../../packages/shared/src/ia/retrospectiva.ts#L46)

- Nulo em período em curso e caderno mudo — a regra da impressão de hoje, no núcleo.
  [`retrospectiva.ts:64`](../../packages/shared/src/ia/retrospectiva.ts#L64)

- Confere por caderno: mais estrito que a edição de hoje, é o recorte da 1.10.
  [`retrospectiva.ts:78`](../../packages/shared/src/ia/retrospectiva.ts#L78)

**O `admite` (AD-12) na resolução**

- Quem grava declara os tipos; ausente ou `false`, a 5.1 segue igual.
  [`motor.ts:164`](../../packages/shared/src/ia/motor.ts#L164)

- `admite` malformado não admite nada — o piso, nunca a nuvem.
  [`motor.ts:186`](../../packages/shared/src/ia/motor.ts#L186)

- O padrão é filtrado antes da exposição, então o elo cortado não baixa o teto.
  [`motor.ts:217`](../../packages/shared/src/ia/motor.ts#L217)

- Preferência não admitida é tratada como a que passa do regime: nunca sobe.
  [`motor.ts:281`](../../packages/shared/src/ia/motor.ts#L281)

**O orquestrador confere a própria cadeia**

- A cadeia marcada não diz de que recurso veio; cada elo é conferido antes do `motorPara`.
  [`orquestrar.ts:468`](../../packages/shared/src/ia/orquestrar.ts#L468)

- No produto, elo recusado vira sintética `indisponivel` e a cadeia recua.
  [`orquestrar.ts:590`](../../packages/shared/src/ia/orquestrar.ts#L590)

- Na medição, só o regime e o id ilegível; o `admite` fica para a bancada abrir.
  [`orquestrar.ts:660`](../../packages/shared/src/ia/orquestrar.ts#L660)

- `Grava` ganha o `admite`, com o tipo que nasce em `motor.ts`.
  [`orquestrar.ts:113`](../../packages/shared/src/ia/orquestrar.ts#L113)

**As listas com dono**

- Seis subconjuntos, fonte ao lado de cada termo, congelados em runtime.
  [`verificar.ts:76`](../../packages/shared/src/ia/verificar.ts#L76)

- `causa` é a `CAUSA` de antes, termo a termo; os novos casam por palavra na 5.3.
  [`verificar.ts:85`](../../packages/shared/src/ia/verificar.ts#L85)

- A barreira lê a árvore do compilador: lista reprova, o texto do `SISTEMA` não.
  [`architecture.test.ts:1367`](../../packages/shared/src/architecture.test.ts#L1367)

- Escopo: núcleo, `supabase/functions` e `scripts/`; apps fora por vocabulário de domínio.
  [`architecture.test.ts:1287`](../../packages/shared/src/architecture.test.ts#L1287)

**O catálogo e o número**

- `validarDescritor` cobra o `admite`; a revista é o primeiro descritor do catálogo.
  [`recursos.ts:33`](../../packages/shared/src/ia/recursos.ts#L33)

- `formatarNumero` mudou de casa sem mudar uma linha; o prompt o reexporta.
  [`numero.ts:24`](../../packages/shared/src/format/numero.ts#L24)

**Testes**

- A matriz de I/O inteira, com o descritor e o orquestrador de verdade.
  [`retrospectiva.test.ts:115`](../../packages/shared/src/ia/retrospectiva.test.ts#L115)

- A revista compõe só `causa`; nenhum termo novo casa com o texto da Saúde.
  [`verificar-vocabulario.test.ts:94`](../../packages/shared/src/ia/verificar-vocabulario.test.ts#L94)

- O golden do pedido: pedido que muda sem subir a versão reprova.
  [`recursos.test.ts:114`](../../packages/shared/src/ia/recursos.test.ts#L114)

- A propriedade exaustiva da AD-5 ganhou a dimensão `grava`.
  [`motor.test.ts:252`](../../packages/shared/src/ia/motor.test.ts#L252)

- O recurso confere a própria cadeia, e a causa é a de quem recuou por último.
  [`orquestrar.test.ts:613`](../../packages/shared/src/ia/orquestrar.test.ts#L613)
