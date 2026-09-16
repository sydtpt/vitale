---
title: 'Story 1.8 — A chamada sai de uma função só'
type: 'feature'
created: '2026-09-16'
status: 'in-progress'
review_loop_iteration: 0
baseline_commit: '6bcb3fc738d63d4fa5ff8348cdb0f910d8e8e271'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A capa, o sumário e a parede da revista vão mostrar a **chamada** de cada caderno — a
primeira frase do texto que ele já escreveu —, e nenhuma função a extrai. Sem dono único, cada tela
escreveria o próprio corte, e o jeito óbvio (`indexOf('.')`) quebra na primeira frase com milhar em
pt-BR: "1.210 fotos em 2026." viraria "1.". A 1.11, a primeira story com tela, já a consome.

**Approach:** Uma função pura no núcleo, `chamadaDoTexto`, que devolve a primeira frase ou **nada**.
A regra de "o que termina uma frase" sai de dentro da conferência (`verificar.ts`) para um dono único
em `format/`, e a conferência e a chamada passam a usar a mesma — assim as duas nunca discordam sobre
onde uma frase acaba.

## Boundaries & Constraints

**Always:**
- **Ausência não é string vazia.** O retorno é `string | null`, e nunca `''`.
- **Caderno sendo escrito, reprovado ou não impresso não tem chamada.** Os três chegam à função do
  mesmo jeito — sem linha no banco, logo sem texto —, e a resposta é `null`.
- **A chamada nunca corta antes da conferência.** Todo ponto em que a chamada corta é um ponto em que
  a conferência também considera fim de frase. A chamada pode ser mais longa, nunca mais curta.
- **A conferência não muda de comportamento.** Extrair a regra de `verificar.ts` é refatoração pura:
  `ia/verificar.test.ts` **não é editado** e continua verde.
- A função mora **fora de `ia/`**, e nenhum arquivo de `ia/` a reexporta.
- Só `chamadaDoTexto` sai pelo barril; a regra de fim de frase fica interna ao núcleo.

**Ask First:**
- Subir qualquer teto de `architecture.test.ts`.
- Mudar o que a conferência reprova, por qualquer motivo — inclusive para "consertar" algo achado aqui.
- Pôr na lista de abreviações uma que possa terminar frase.

**Never:**
- Tela, banco, migração. Tocar `mobile/`, `web/`, `supabase/`, `scripts/`.
- Tocar `ia/imprimir.ts`, `ia/pacote.ts` ou `ia/prompt.ts` — a 1.10 corre em paralelo.
- Dado de saúde real em fixture.

## I/O & Edge-Case Matrix

| Cenário | Entrada | Saída |
|---|---|---|
| Frase simples | `"O sono caiu. Depois subiu."` | `"O sono caiu."` |
| Milhar com ponto | `"1.210 fotos em 2026. Mais …"` | `"1.210 fotos em 2026."` |
| Decimal com vírgula | `"Dormiu 7,2 h em média. …"` | `"Dormiu 7,2 h em média."` |
| Abreviação que precede | `"Foram aprox. 40 min a menos. …"` | `"Foram aprox. 40 min a menos."` |
| Abreviação com ponto interno | `"Houve p.ex. 3 noites curtas. …"` | `"Houve p.ex. 3 noites curtas."` |
| Reticências | `"Dormiu pouco... e acordou."` | `"Dormiu pouco..."` |
| Interrogação ou exclamação | `"Foi a menor? Sim."` | `"Foi a menor?"` |
| Sem terminador | `"O sono foi estável"` | `"O sono foi estável"` |
| Quebra de parágrafo antes do ponto | `"Sono estável\nDepois …"` | `"Sono estável"` |
| Espaço à frente | `"  \n O sono caiu. …"` | `"O sono caiu."` |
| Texto vazio ou só espaço | `""`, `"   "` | `null` |
| Sem caderno | `null`, `undefined` | `null` |

</frozen-after-approval>

## Code Map

- `packages/shared/src/ia/verificar.ts:678-697` — `limitesDaFrase(texto, pos)`, com a regra inline
  `corta`: termina frase em `\n`, `!`, `?` e em `.` **exceto** entre dois dígitos ("16.315"). Não
  trata abreviação. É a regra que sai para `format/`. Usada em `:894` pela regra da base (1.4).
- `packages/shared/src/ia/verificar.ts:919-934` — o **segundo passe** da regra da base: sem base
  colada ao número, **o parágrafo absolve**. É a limitação registrada nas Design Notes.
- `packages/shared/src/format/numero.ts` — `format/` já é alcançado por `ia/`
  (`ia/interpolar.ts:48`, `ia/prompt.ts:32`), então `ia/verificar.ts` importar de `format/` segue
  precedente. **A armadilha, em `:18-23`:** `formatarNumero` conta como peça de IA na guarda (7)
  porque `ia/prompt.ts` a reexporta.
- `packages/shared/src/architecture.test.ts:1769-1793` — guarda (7): `PORTA_DE_IA`,
  `TETO_PECAS_DE_IA = 1`, com **um** ofensor (`mobile/src/lib/edicao-ia.ts` → `periodoFechado`). Toda
  peça em `ia/` fora da porta conta — daí a chamada morar fora. `:212` — barreira dos módulos lidos
  pelo Deno: `verificar.ts` **não** está entre eles (só `fitness/dedupe`, `fitness/streams`,
  `health/wellness`, `cultura/tipos`), então ganhar import não a quebra.
- `packages/shared/src/architecture.test.ts:281-324` — molde de dono único (`AGG_VERSION`).
  `:1623-1656` — molde de barreira com lista de exceção nomeada (`'STOP'`).
- `packages/shared/src/index.ts:27-43` — como o barril reexporta; `format/numero` é o precedente de
  módulo fora de `ia/` que sai por lá.
- `packages/shared/src/ia/ranqueamento.test.ts:901-914` — o teste de **ausência** no barril
  (`nome in barril`). A chamada segue a regra **oposta**: tem de estar lá.
- `packages/shared/src/data/edicoes-ia.ts:86-118` — `CadernoImpresso.texto: string` (não nulo) e
  `Edicao = readonly CadernoImpresso[]`, vazia = "ainda não impressa". **Não há campo de estado**:
  sendo escrito, reprovado e não impresso colapsam na ausência da linha.
- `packages/shared/src/ia/prompt.ts:459-460` — o que o modelo ouve: "A PRIMEIRA FRASE é a manchete
  […] lida sozinha e fora de contexto. Escreva-a curta, inteira em si mesma, e termine-a com ponto."
- `docs/specs/revista-retrospectiva/cadernos.md:119-123` — a decisão de 08/09: extração mecânica,
  sem campo novo e sem valor novo a verificar.
- `packages/shared/package.json:8-11` — cada `*.test.ts` roda sozinho por `tsx`;
  `packages/shared/src/ia/sha256.test.ts:1-2` — o idioma: `node:test` + `node:assert/strict`.

## Tasks & Acceptance

**Execution:**
- [ ] `packages/shared/src/format/frase.ts` — criar `terminaFrase(texto, i): boolean` com a regra de
  `corta`, **idêntica**. Sem imports. Doc de dono único.
- [ ] `packages/shared/src/ia/verificar.ts` — `limitesDaFrase` passa a chamar `terminaFrase`. Nada
  mais muda no arquivo, e ele não reexporta a função.
- [ ] `packages/shared/src/revista/chamada.ts` — criar `chamadaDoTexto(texto: string | null |
  undefined): string | null` pela matriz, sobre `terminaFrase`, mais a lista fechada de abreviações
  que **precedem** o complemento (Design Notes).
- [ ] `packages/shared/src/index.ts` — reexportar `chamadaDoTexto`, e só ela.
- [ ] `packages/shared/src/format/frase.test.ts` e `packages/shared/src/revista/chamada.test.ts` —
  a matriz inteira, mais a propriedade "nunca corta antes de `terminaFrase`" sobre uma bateria de
  textos sintéticos, e o teste de barril (`chamadaDoTexto` sai; `terminaFrase` não).
- [ ] `packages/shared/src/architecture.test.ts` — **barreira**: nenhum arquivo de `mobile/src` ou
  `web/src`, fora de teste, corta frase à mão (`indexOf('.')`, `split('.')`, `split(/[.!?]`), com
  lista de exceção nomeada e vazia. A não-vacuidade prova o casador **pelo caminho real** da
  barreira, não por um literal paralelo.

**Acceptance Criteria:**
- Given a matriz de I/O, when os testes rodam, then cada linha tem um teste que rodou e passou.
- Given a regra saiu de `verificar.ts`, when a suíte do núcleo roda, then `ia/verificar.test.ts`
  passa **sem ter sido editado**.
- Given as três telas futuras vão importar a chamada, when a guarda (7) roda, then o teto continua
  em 1 e o ofensor continua sendo só `edicao-ia.ts`.
- Given a chamada é pedida de dentro do barril, when `import('../index')` roda, then
  `chamadaDoTexto` existe nele e `terminaFrase` não.

## Spec Change Log

## Design Notes

**Por que a regra sai de `verificar.ts`.** A conferência usa os limites da frase para decidir qual
base está "colada" a um número (regra 1.4). Se a chamada cortasse num ponto onde a conferência não
corta, um número poderia chegar à capa separado da base que a conferência achou **na mesma frase**.
Com uma regra só, a chamada corta onde a conferência corta — e só pula os pontos de abreviação, o
que a deixa mais longa, nunca mais curta.

**As abreviações: lista fechada, pelo critério de preceder.** Só entra abreviação que **sempre
precede o complemento** e por isso nunca termina frase: `aprox.`, `p.ex.`, `p. ex.`, `Sr.`, `Sra.`,
`Dr.`, `Dra.`. Ficam de fora de propósito `etc.`, `máx.` e `mín.`, que podem terminar frase
("chegou ao máx."). As abreviações ficam **só na chamada** — pô-las na regra compartilhada mudaria o
que a conferência reprova. Na amostra das sete edições antigas não há nenhuma abreviação com ponto
(as unidades vêm sem ponto: `km`, `h`, `bpm`), e o prompt pede frase curta que termina com ponto: a
lista cobre o critério de aceite sem inventar vocabulário.

**Reticências e "?!" entram inteiros.** A chamada inclui a sequência de terminadores colados, para não
devolver `"Dormiu pouco."` de `"Dormiu pouco..."`. A posição do corte é a mesma da conferência.

**Limitação conhecida, fora do alcance desta story.** A conferência aceita um número de comparação na
primeira frase cuja base só é nomeada na segunda, porque o segundo passe da regra da base deixa o
parágrafo absolver (`verificar.ts:919`). A chamada, que é essa primeira frase lida **sozinha**,
levaria o número sem a base para a capa. O conserto é uma regra nova na conferência — reprovar mais —,
o que esta story não pode fazer. Vai para o trabalho adiado.

## Verification

**Commands:**
- `pnpm --filter @vitale/shared lint` — exit 0.
- `pnpm --filter @vitale/shared test` — exit 0, incluindo a barreira nova e a guarda (7) em teto 1.
- `git diff 6bcb3fc -- packages/shared/src/ia/verificar.test.ts` — **vazio**.
- `git diff --stat 6bcb3fc -- mobile web supabase scripts packages/shared/src/ia/imprimir.ts packages/shared/src/ia/pacote.ts packages/shared/src/ia/prompt.ts` — **vazio**.
- `pnpm --filter @vitale/web build` e `cd mobile && pnpm exec tsc --noEmit` — exit 0: os apps
  compilam o núcleo como fonte, e o barril mudou.
