---
title: 'Story 5.3 — A leitura da Saúde do sono, sem modelo (F0)'
type: 'feature'
created: '2026-09-11'
status: 'done'
baseline_commit: '1fc9ae114ff655c34ac295051791050b0f9cde9f'
review_loop_iteration: 2
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-5-2-o-descritor-da-retrospectiva-e-as-listas-com-dono.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A Saúde do sono ainda não tem leitura: não há caso classificado pelo código, nem entrada
pura comum à tela e à bancada, nem o regime interpolado (marcador, conferência de presença) que a
ADR 0049 exige — e sem o template não existe o piso contra o qual cada motor vai ser julgado. O fato
da percepção ainda sai com ponto ("3.3/5").

**Approach:** `casoDaSaude` põe cada `SleepScore` em exatamente um dos sete casos da CAP-13;
`entradaDaSaude` monta, de forma pura, o que a tela e a bancada leem; `ia/interpolar.ts` é dono do
marcador e da conferência interpolada; o descritor da Saúde entra no catálogo com a cadeia só
`sem-modelo` e o template como piso; a vírgula da percepção é consertada na origem.

## Boundaries & Constraints

**Always:**
- O motor nunca recebe pontos para decidir: o pedido leva o caso, as dimensões a nomear e os
  marcadores do caso.
- A conferência da revista não muda: `verificarTexto` e o casamento por trecho de `causa` ficam como
  estão; `verificar.test.ts` e `pacote.test.ts` passam sem edição.
- Toda função nova é pura e roda offline; os testes novos passam em `TZ=UTC` (o fuso do CI) e em
  `Europe/Brussels`.
- Nenhum dado de produção entra no git: a conferência contra a medição de 10/09 roda fora dele.

**Ask First:**
- Frase do template ou termo de lista que case com o texto que a Saúde já escreve.
- Qualquer número da distribuição que divirja de 10/09 por outro motivo que não a borda
  `medidas-insuficientes` ou a separação dos empates.
- Tocar `mobile/`, `web/`, `supabase/`, `ia/pacote.ts`, `ia/prompt.ts` ou `period/` (a 1.7 corre
  em paralelo neles).

**Never:**
- O botão, a ponte, a tela e a troca do cálculo de `/sono/saude` por `entradaDaSaude` — são da 5.5.
- A bancada, a sonda e o pedido de escolher a dimensão por esquema — são da 5.4.
- `formatarNumero` com −0 e não finito (a Saúde só formata a média das notas, positiva e finita).

## I/O & Edge-Case Matrix

| Cenário | Entrada / estado | Esperado | Falha |
|---|---|---|---|
| Uma no mínimo | período medido, só a regularidade em 0 | caso `uma`; piso "A dimensão mais baixa é a regularidade: SRI 50 · 7 seguidas." | — |
| Duas | duas no mínimo, alguma acima | caso `duas`, as duas nomeadas | — |
| Fora do empate | três ou mais no mínimo | caso `fora-do-empate`, nomeia as de fora: "no máximo" se todas em 2, senão "acima das outras" | — |
| Todas iguais | todas as medidas em 1 | caso `todas-iguais`, com a contagem real por extenso | — |
| Tudo no máximo | todas em 2 | caso `tudo-no-maximo`, sem elogio | — |
| Uma medida só | `scored`, uma dimensão medida | caso `medidas-insuficientes` | — |
| Sem contagem | cobertura abaixo do piso; período sem noite; noite sem medida | caso `sem-contagem`, diz a cobertura quando houver, nunca "conjunto" | — |
| Produto, sem preferência | cadeia padrão | piso com a frase do template | causa `preferencia` |
| Motor bom (medição) | texto sem algarismo, marcadores do caso, dimensões do caso | frase interpolada, fatos em pt-BR | — |
| Motor que calcula ou aconselha | algarismo, marcador fora do caso, dimensão a mais ou termo proibido | problemas da conferência | `reprovada` |
| Motor que contradiz o caso | expressão que afirma outro caso: "mais alta" em `uma`, "abaixo" em `tudo-no-maximo` | problemas da conferência | `reprovada` |
| Motor que omite | falta dimensão do caso (inclui recusa em texto livre) | problemas + recusa | `recusa-do-modelo` |
| Percepção do período | notas com média 3,25 | fato "3,3/5 · 4 notas" | — |

</frozen-after-approval>

## Code Map

- `packages/shared/src/sleep/score.ts` -- `SleepDimensionKey` :134, `DIMENSION_LABEL` :141, `SleepDimension {key,label,points,fact,absent?}` :149, `SleepScore {dimensions,points,max,coverage,scored}` :171, `SCORE_COVERAGE_FLOOR` :122. `nightScore(p, history, rating)` :333 (4 dimensões, sem regularidade); `periodScore(nights, expected, ratings, history)` :434 (5; vazio em :447). O `toFixed` da percepção é o único do `sleep/`: :498. `coverageNote` :518.
- `packages/shared/src/sleep/ranges.ts` -- `SonoRange` :22 (`ultima|7d|4s|12m|ano`), `rangeBounds` :61 (datas locais), `filterByRange` :100, `rangeNights` :125.
- `mobile/src/app/sono/saude.tsx:55-69` -- só leitura: a fórmula da tela (`filterByRange`, `rangeNights`, histórico = noites antes de `since`, `periodScore`), igual à da web (`sono-saude-page.component.ts:49-59`) e à de `dist-dimensoes.ts`. Em `ultima` a tela roda `periodScore` sobre uma noite; o cartão da aba (`(tabs)/sono.tsx:155`) e a medição de 10/09 usam `nightScore`. As notas da tela vêm só dos últimos 90 dias (`mobile/src/store/sono.store.ts:17,41-45`).
- `packages/shared/src/ia/orquestrar.ts:92-98` -- `Conferencia` com `recusa?: true`, que o orquestrador vira `recusa-do-modelo` (:440). `Descritor` :124. Molde de descritor: `ia/retrospectiva.ts`.
- `packages/shared/src/ia/verificar.ts:76` -- `VOCABULARIO_PROIBIDO`, congelado; `verificarTexto` casa `causa` por trecho (revista, intocável).
- `packages/shared/src/ia/recursos.ts:18,23` -- `'saude-do-sono'` já é `RecursoId`; catálogo. `recursos.test.ts:106` `GOLDENS`: todo descritor do catálogo precisa do seu.
- `packages/shared/src/ia/verificar-vocabulario.test.ts:174-210` -- o corpus da Saúde e as frases dos casos; fixa o conteúdo das listas.
- `packages/shared/src/sleep/score.test.ts:50-108` -- `night`, `run`, `dim`; `:317` fixa "3.5/5 · 2 notas".
- `packages/shared/src/format/numero.ts:24` -- `formatarNumero`.
- `packages/shared/src/architecture.test.ts:799-844` -- guarda (2): arquivo de `sleep/` que importa módulo da porta entra no fecho sem rede, SDK nem fornecedor. `:1209-1247` guarda (7): apps só importam `descritor*` de `ia/`.
- `packages/shared/src/index.ts:27-54` -- barril de `ia/` e `sleep/`; nenhum nome `caso*`, `interpolar*`, `marcador*`.
- `/private/tmp/claude-501/-Users-sydtpt-Projects-life-organizer/a4c40f5d-3c04-4ffa-aa5e-7204ebf4d10b/scratchpad/53-implementacao-2.patch` -- a segunda implementação, o KEEP desta volta (aplica limpo na baseline). Âncoras nela: `ia/interpolar.ts` `EMBRULHO` :53, `limparResposta` :117, `RegraInterpolada` :161, `NUMERAIS` :202, `conferirInterpolado` :223 (forma :237, vocabulário :282, presença :287); `sleep/leitura.ts` `semNoite` :134, `entradaDaSaude` :168, `nomeDaJanela` :243, `porcentagem` :268, `valoresDe` :286, `exigidos` :336, `regraDe` :376, `semContagem` :391, `SISTEMA` :439, `casoEmPalavras` :467, `TAMANHO_DA_JANELA` :490, `sentidoDoMarcador` :499; `sleep/caso.ts` `motivoSemContagem` :89; `ia/verificar.ts` listas :125-199, `CONTRACOES` :232, `compilar` :254; `sleep/leitura.test.ts` motor bom :616, reprovadas :649, recusa :676; `ia/recursos.test.ts:142` (o `0.7` literal); `ia/interpolar.test.ts:73` (`{tostring}`); `architecture.test.ts:1258` `PECA_PROFUNDA_DE_SONO`.
- `/private/tmp/claude-501/-Users-sydtpt-Projects-life-organizer/a4c40f5d-3c04-4ffa-aa5e-7204ebf4d10b/scratchpad/` -- o reexport de 12/09 (`sleep_periods.json`, 293 noites; `daily_ratings.json`, 89), `medir-casos-3.ts` e `53c-medicao.log`. Fora do git, e o `/private/tmp` some no reboot.
- `/private/tmp/claude-501/-Users-sydtpt-Projects-life-organizer/f4896030-407d-4ee4-af98-a39e60930a6f/scratchpad/` -- o export de 10/09 (apagado em 11/09; sobrou o método) (`sleep_periods.json`, 293 linhas; `daily_ratings.json`, 89) e o método (`dist-dimensoes.ts`, `today = 2026-09-10T12:00:00`). Fora do git.

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/format/numero.ts` -- `porExtenso(n, genero)` de 1 a 10 -- a contagem entra por extenso
- [x] `packages/shared/src/sleep/score.ts` -- o fato da percepção por `formatarNumero(noteAvg, 1)` -- conserto na origem; `score.test.ts:317` passa a "3,5/5 · 2 notas", e o comentário de `verificar.ts` que cita "3.3/5" acompanha; o comentário novo não promete dono único para os outros fatos, que são inteiros
- [x] `packages/shared/src/sleep/caso.ts` -- `casoDaSaude(score)` e o tipo `CasoDaSaude`, união discriminada por `caso`, com `nomear` em tupla (`uma`: uma chave, `duas`: duas) e `switch` exaustivo; `sem-contagem` com o motivo (`cobertura` só abaixo do piso; nenhuma medida → `sem-medida`, mesmo com `scored`) -- AD-7
- [x] `packages/shared/src/ia/verificar.ts` -- `termosProibidosEm(texto, subconjuntos)`: palavra inteira, acento dobrado, plural em -s/-es de termo de uma palavra (fora `melhore` e `piore`), contração da preposição final (a/à, de, em, com as formas das Design Notes, lida por `Object.hasOwn`), um achado por termo dobrado; as flexões das Design Notes entram nas listas; `casaPorPalavra` exportado sem cache que cresça sem limite -- AD-6
- [x] `packages/shared/src/ia/interpolar.ts` -- a sintaxe do marcador, `marcadoresEm`, `interpolar(texto, valores)` (maiúscula na primeira letra) e `conferirInterpolado(texto, regra)`: forma, número (`\p{N}` e por extenso, com lugar), marcador fora do conjunto, repetido ou fora do lugar, chave malformada e embrulhos, item a mais, contradição, vocabulário (antes e depois da troca), sinal de recusa; exigido ausente ou sinal de recusa → `recusa` -- AD-6, ADR 0049
- [x] `packages/shared/src/sleep/leitura.ts` -- `entradaDaSaude(noites, notas, { range, offset, hoje })`, com `hoje` um dia local `AAAA-MM-DD` e `offset` inteiro ≥ 0, → `{ alcance, range, hoje, janela: { since, until }, score }` (nada depois de `hoje` entra; `ultima` → `nightScore`, e sem noite → `sem-contagem` por `sem-noite`; período → a fórmula da tela, notas recortadas à janela); o template; `descritorDaSaudeDoSono`, que deriva o caso do `score` -- AD-11, AD-2
- [x] `packages/shared/src/ia/recursos.ts` + `packages/shared/src/index.ts` -- o descritor no catálogo; o barril exporta `sleep/caso`, `sleep/leitura` e `ia/interpolar`
- [x] `packages/shared/src/architecture.test.ts` -- guarda (7): os nomes de valor de `sleep/leitura` e `sleep/caso` entram no conjunto de peças, fora `entradaDaSaude` (que a tela chama) e `descritor*`; o import profundo com extensão (`.js`, `.mjs`, `.ts`) também; o teto segue 1
- [x] testes -- `sleep/caso.test.ts` (todas as combinações de ponto × presença, noite e período, em exatamente um caso), `ia/interpolar.test.ts`, `sleep/leitura.test.ts` (a matriz; a recusa em **todo** caso, inclusive a que cita a palavra exigida; a contradição de cada caso; um termo de **cada** subconjunto pelo `conferir` da Saúde; "duas" fora de `duas`; forma; número por extenso; a cobertura contra oráculo independente; noite e nota depois de `hoje`; entrada igual à fórmula da tela fora de `ultima`; cada frase do template passa na conferência; a pureza com `Date` sabotado), o golden da Saúde em `recursos.test.ts` sobre todas as variantes (com `SCORE_COVERAGE_FLOOR`, nunca `0.7` literal), e as listas, contrações e flexões em `verificar-vocabulario.test.ts`

**Acceptance Criteria:**
- Given o descritor da Saúde, when `validarDescritor` roda, then não há problema, e ele declara interpolado, amostragem gulosa, saída texto, não grava, `regimeMaximo` nuvem e cadeia padrão só `sem-modelo`.
- Given o export de 10/09 e `hoje` = 10/09 12:00, when a leitura roda nas janelas de `dist-dimensoes.ts` (7d, 4s, 12m e as noites), then `sem-contagem` bate com 10/09, `todas-iguais` + `duas` + `fora-do-empate` = o "empate" de lá, e `uma` + `tudo-no-maximo` + `medidas-insuficientes` = o "mínimo claro" + o "tudo no máximo" de lá — só a borda `medidas-insuficientes` move número; o resultado, só com contagens, vai para o Spec Change Log.
- Given o diff, then `mobile/`, `web/`, `supabase/`, `ia/pacote.ts`, `ia/prompt.ts` e `period/` não mudaram, e o `tsc` do mobile e o build da web seguem verdes.

## Spec Change Log

- **2026-09-11 — a conferência contra a medição de 10/09.** Script fora do git
  (`/private/tmp/claude-501/-Users-sydtpt-Projects-life-organizer/a4c40f5d-3c04-4ffa-aa5e-7204ebf4d10b/scratchpad/medir-casos.ts`),
  sobre o export de 10/09, `hoje` = 10/09 12:00, nas janelas de `dist-dimensoes.ts`. Ao lado de cada
  entrada, o classificador de 10/09 rodado sobre a fórmula de 10/09: o `SleepScore` de `entradaDaSaude`
  é idêntico ao dela em **todas** as janelas, e o resultado é o mesmo em `TZ=UTC` e `Europe/Brussels`.

  | Janela | n | 10/09 | 5.3 |
  |---|---|---|---|
  | 7d | 73 | 11 mínimo claro · 17 empate · 45 sem contagem | 11 `uma` · 2 `todas-iguais` + 9 `duas` + 6 `fora-do-empate` · 45 `sem-contagem` |
  | 4s | 19 | 2 · 4 · 13 | 2 `uma` · 2 `duas` + 2 `fora-do-empate` · 13 `sem-contagem` |
  | 12m | 2 | 2 sem contagem | 2 `sem-contagem` |
  | noites | 293 | 136 mínimo claro · 139 empate · 18 tudo no máximo | 132 `uma` + 11 `tudo-no-maximo` + 11 `medidas-insuficientes` · 25 `todas-iguais` + 109 `duas` + 5 `fora-do-empate` |

  `sem-contagem` bate nas quatro; o empate de 10/09 é exatamente `todas-iguais` + `duas` +
  `fora-do-empate`; e `uma` + `tudo-no-maximo` + `medidas-insuficientes` é o mínimo claro + o tudo no
  máximo (11, 2, 0, 154). Só a borda `medidas-insuficientes` move número: 11 noites com uma dimensão
  medida só (a duração, sem base nem nota) — 7 saíram de "tudo no máximo" e 4 de "mínimo claro".

- **2026-09-11 — implementação, decisões que a spec não fixava literalmente.**
  (1) `sem-contagem` carrega o `motivo` (`cobertura`, `sem-noite`, `sem-medida`). O `sem-medida` de
  **período** — que o `periodScore` não produz, porque duração e horário são sempre medidos, mas o tipo
  admite — ganhou a frase "Este período não tem medida para contar.", o par da frase da noite, para o
  template nunca dizer "poucas para contar" sobre cobertura cheia. (2) `{medidas}` está no conjunto de
  todo caso fora `sem-contagem`: ali a frase só fala de cobertura, e `porExtenso` não tem zero.
  (3) `casaPorPalavra` sai exportado de `ia/verificar.ts`: a presença pelo rótulo, em
  `ia/interpolar.ts`, usa o mesmo casador do vocabulário — sem o plural, porque a presença é palavra
  inteira. (4) A Saúde compõe os seis subconjuntos por um `Record<SubconjuntoProibido, boolean>`, não
  por lista: uma lista com `'placar'` reprovaria na barreira do vocabulário (o nome do subconjunto é
  termo), e o mapa obriga a decidir quando nascer um sétimo. (5) `ultima` com noite tem janela
  `{ since: dia, until: dia }`; sem noite, `null`/`null` e as quatro dimensões da noite ausentes, no
  molde do período vazio do `periodScore`. (6) O pedido não leva fato nem ponto: é função só do
  alcance, do caso e das dimensões citáveis — semanas no mesmo caso têm o mesmo hash, e o teste fixa
  isso. (7) `porExtenso` lança fora de 1 a 10. (8) A barreira (2) do `architecture.test.ts` passou de
  63 para 67 arquivos (`ia/interpolar`, `sleep/leitura` como semente, `sleep/caso` e `sleep/ranges`
  pelo fecho); o comentário que registra a contagem acompanha.

- **2026-09-11 — o que a spec pede à letra e fica para a revisão decidir.** (1) Nos quatro casos que
  não exigem nada (`sem-contagem`, `medidas-insuficientes`, `tudo-no-maximo`, `todas-iguais`), a recusa
  em texto livre ("Desculpe, não posso ajudar com isso.") passa na conferência e viraria leitura — e o
  "diz a cobertura quando houver" só o template cumpre, o motor não é cobrado. Exigir `{cobertura}` e
  `{medidas}` nesses casos fecharia os dois; as Design Notes dizem "sem exigir nenhuma", e a mudança é
  do dono. (2) Número por extenso não é conferido: "as cinco dimensões", com quatro medidas, passa —
  só o algarismo é barrado. (3) A presença é palavra inteira à letra: "horários" e "durações" não
  contam como presença nem como dimensão a mais.

- **2026-09-11 — revisão 1 (três revisores): `bad_spec`, volta ao passo 3.**
  *Achado que disparou:* os três revisores reproduziram a recusa em texto livre ("Desculpe, não posso
  ajudar com isso.") passando com `{ ok: true }` em `sem-contagem`, `medidas-insuficientes`,
  `tudo-no-maximo` e `todas-iguais` — as Design Notes diziam "sem exigir nenhuma", contra a linha
  "Motor que omite (inclui recusa em texto livre)" da matriz. Vieram junto, da mesma raiz (regras da
  conferência e do pedido nas Design Notes): o eco do pedido ou várias frases aceitos como leitura;
  "as cinco dimensões" com quatro medidas e "½"; o fato de uma dimensão ao lado do nome de outra;
  `[regularidade]` e `${regularidade}` sobrando na frase; "devido ao", "graças aos" e "por conta do"
  passando na Saúde, e "devido a"/"devido à" contando dois; "Os dias pioram." fixado como limpo em
  teste; "nesta semana" numa janela de 12 meses sem jeito de o motor nomear a janela; "70% … poucas
  para contar" abaixo do piso e "0%" com noite gravada; o golden cego em seis dos sete casos; o
  `hoje` como instante, que muda a janela entre fusos; o caso guardado ao lado do `score` sem ser
  rederivado; a guarda (7) sem ver as peças da Saúde em `sleep/`; o teste de pureza que não sabotava o
  relógio.
  *O que mudou:* Tasks e Design Notes — presença que fecha a recusa em todo caso, forma, número por
  extenso, `{janela}`, marcador de fato só em `uma`, embrulhos de marcador, contrações e flexões nas
  listas, cobertura pelo piso, `hoje` como dia local, caso derivado no descritor, tipos em tupla,
  golden de todas as variantes, guarda (7) com as peças de `sleep/`. A intenção congelada não muda.
  *KEEP:* a primeira implementação está em
  `/private/tmp/claude-501/-Users-sydtpt-Projects-life-organizer/a4c40f5d-3c04-4ffa-aa5e-7204ebf4d10b/scratchpad/53-implementacao-1.patch`
  e aplica limpo na baseline com `git apply` — é a base: aplique e mude só o que esta emenda muda.
  Mantenha a partição de `casoDaSaude` e o teste das 256 + 4.096 combinações contra as sete
  definições escritas à parte; `entradaDaSaude` idêntica à fórmula da tela fora de `ultima`, em toda
  janela e passo; o recorte das notas à janela; a composição por `Record<SubconjuntoProibido,
  boolean>`; `porExtenso` lançando fora de 1 a 10; a vírgula da percepção; o barril; o comentário da
  guarda (2) com 67 arquivos; o script `medir-casos.ts` (mesmo diretório) e a tabela de 10/09 acima,
  que esta emenda não move — ela não toca `score` nem caso, e a medição roda de novo para provar.

- **2026-09-11 — a emenda implementada sobre o patch da primeira volta; o que ela não fixava à letra.**
  A medição rodou de novo (`medir-casos.ts` adaptado: `hoje` como dia, caso tirado do `score`) e a
  tabela acima saiu **idêntica**, em `TZ=UTC` e `Europe/Brussels`, com o `SleepScore` igual ao da
  fórmula de 10/09 em toda janela. Decisões:
  (1) **O ano corrente é janela aberta.** `rangeBounds` fecha `ano` em 31/12 também no `offset` 0; a
  entrada devolve `until: null` nele, como nas outras correntes — é o que deixa `{janela}` dizer "este
  ano" sem a entrada guardar o passo. O `score` não muda (o filtro é o de `rangeBounds`), e o recorte das
  notas também não, porque não há nota depois de hoje.
  (2) **`{janela}` além dos exemplos:** a janela de trás que atravessa um ano leva o ano nas duas pontas
  ("de 27/12/2025 a 02/01/2026"; toda `12m` de trás, "de 11/09/2024 a 10/09/2025"); `ultima` sem noite é
  "esta noite", a palavra do próprio template.
  (3) **`sem-contagem` é `!scored` ou nenhuma medida.** O motivo, em ordem: sem noite → `sem-noite`;
  com medida e abaixo do piso → `cobertura`; o resto → `sem-medida` — inclusive o `scored` falso com
  medida e cobertura no piso, que `nightScore`/`periodScore` não produzem: a frase não inventa cobertura
  baixa. `caso.test.ts` ganhou a volta das 256 + 4.096 combinações com o `scored` trocado.
  (4) **Presença pelo marcador só com marcador do conjunto** — é o que faz "em `uma`, pelo marcador" sem
  caso especial. O rótulo é lido na prosa, sem os marcadores bem formados nem os embrulhos: `{duracao}`
  não nomeia a duração pelo rótulo. Em `duas`, um `{duracao}` fora do conjunto reprova e ainda conta
  como ausência (recusa).
  (5) **A regra ganhou forma de dado:** `exigidos` é `{ item } | { marcador } | { palavra }`; `antesDe`
  diz onde um marcador vale (`{medidas}` só antes de "dimensão"/"dimensões"); `numerais` diz o que o caso
  deixa escrever por extenso (`['duas']` em `duas`). Os numerais proibidos saem de `porExtenso` (dois a
  dez, nos dois gêneros) mais cem, mil, metade, dobro, triplo e "por cento" — **só esses**. As regras dos
  problemas: `forma`, `algarismo`, `extenso`, `chave`, `marcador`, `a-mais`, `vocabulario`, `ausente`.
  (6) **O pedido** tem uma linha `Janela: {janela}`, o sentido de cada marcador e uma linha para cada
  exigência que não é dimensão ("A frase tem de usar {medidas}", "…de dizer "período""). O `range` entra
  só pelo tamanho da janela que o sentido de `{janela}` descreve. `VERSAO` segue 1 — a primeira volta
  nunca saiu da branch. O golden da Saúde é o sha256 das linhas `nome: hash` de 17 variantes (os sete
  casos, noite e período, os três motivos, os cinco alcances); o da revista segue com uma entrada e o
  mesmo hash.
  (7) **O casador:** `casaPorPalavra(texto, termo, { plural?, contracao? })` compila a cada chamada; só o
  vocabulário, que é congelado, tem os padrões compilados uma vez, num mapa pela forma dobrada. O achado
  de "devido à" sai como "devido a", a primeira grafia.
  (8) `limparResposta` (o `interpretar`) sai de `ia/interpolar.ts`, e por isso a guarda (7) já a conta
  como peça. `interpolar` põe maiúscula só no primeiro caractere, e só se ele for letra minúscula.
  (9) O `tsconfig` da web tem `noPropertyAccessFromIndexSignature`, que o do núcleo não tem: os valores
  dos marcadores saem em literal de objeto.

- **2026-09-11 — o que fica para a revisão decidir (volta 2).** (1) As listas são as das Design Notes à
  letra: "ótima" e "perfeita" (o feminino) não estão, e "Uma semana ótima" passa; "melhorias" está
  listada, e como o plural de "melhoria" também a casa, "as melhorias" dá dois achados. (2) Numeral acima
  de dez ("onze", "vinte") não é conferido. (3) O valor de `{janela}` não tem forma gramatical única ("os
  últimos 7 dias" é sintagma nominal; "de 28/08 a 03/09", preposicional), e o pedido, que não depende do
  passo, não pode dizer qual vem: "Em {janela}" passa na conferência e sai "Em os últimos 7 dias". É
  medida da bancada (5.4). (4) Sem noite e sem medida exigem a palavra do alcance à letra: "{janela} não
  têm noite gravada" é recusa.

- **2026-09-11 — revisão 2 (três revisores): um `intent_gap` e `bad_spec`, volta ao passo 2.**
  *Achados que dispararam:* (`intent_gap`) a conferência lia forma e presença, não o que a frase afirma:
  "A percepção é a dimensão mais alta: {percepcao}." passava em `uma`, e "A duração e a regularidade estão
  no máximo.", em `duas`. O dono decidiu **barrar a contradição** — a linha "Motor que contradiz o caso"
  entrou na matriz congelada com o aval dele. (`bad_spec`, raiz nas Design Notes) a recusa que cita a
  palavra exigida ("Desculpe, não posso analisar a percepção.", "Não posso comentar esta noite.") passava
  como leitura, contra a ADR 0049; `uma` aceitava só o marcador, e "fica em ± 22 min" não diz de que
  dimensão é; `{janela}` mudava de forma gramatical com o passo ("De 28/08 a 03/09 têm…", "Em os últimos 7
  dias") e perdia o ano da janela inteira em ano passado; o motor podia nomear a janela do jeito dele
  ("nesta semana", "hoje"); o vocabulário só lia o texto antes da troca ("devido {janela}" → "devido as
  últimas 4 semanas"); numeral acima de dez, "duas noites" em `duas`, "as cinco dimensão"; "ótima" e
  "perfeita" fora, e "piore" pegando "as piores noites"; "resultou na", "por conta disso"; tamanho medido
  antes da troca (286 caracteres passavam) e marcador repetido; "…", "- ", "Frase:", U+200B, `$percepcao`;
  o plural do rótulo não contava; o `sistema` citava `{cobertura}` e `{medidas}` para todo caso, e o caso
  `duas` escrevia "Duas"; noite e nota depois de `hoje` entravam (hoje 01/09 lia "a noite de 10/09"), e
  `offset` NaN dava "De Na/aN a Na/aN"; a cobertura em ponto flutuante (29 de 100 → 28%); `ultima` sem
  noite saía como `sem-medida`.
  *O que mudou:* a matriz congelada (a linha nova, pelo dono); Tasks e Design Notes — o pedido; o
  marcador (`{quando}`, forma gramatical por `range`, o ano, uma vez só, onde vale, a janela dita de outro
  jeito, as chaves malformadas novas); a presença pelo nome, com as formas; a recusa por sinal; a
  contradição por caso; forma; número por extenso; vocabulário depois da troca; cobertura inteira;
  entrada até `hoje`; `sem-noite` da noite; listas e contrações.
  *Estado ruim evitado:* uma frase que diz o contrário do caso, ou uma recusa que cita a dimensão,
  chegando à tela como leitura; a porcentagem um ponto abaixo; a bancada lendo o futuro de um dia passado.
  *KEEP:* a segunda implementação está em
  `/private/tmp/claude-501/-Users-sydtpt-Projects-life-organizer/a4c40f5d-3c04-4ffa-aa5e-7204ebf4d10b/scratchpad/53-implementacao-2.patch`
  (sha256 `9b101651…`), aplica limpo na baseline com `git apply` e reproduz a árvore revisada byte a byte
  — aplique e mude só o que esta emenda muda. Vale tudo o que o KEEP da volta 1 mandou manter. Da volta
  2, mantenha: a regra como dado (`exigidos` `{item}|{marcador}|{palavra}`, `antesDe`, `numerais`), o
  embrulho tirado antes de achar marcador, `limparResposta` só com par que embrulha tudo, `interpolar`
  numa passada e com maiúscula só na primeira letra, os padrões do vocabulário compilados uma vez, o
  pedido sem fato nem passo e o teste que fixa isso, o ano corrente como janela aberta, as 17 variantes
  do golden, e o `caso.test.ts` com o `scored` trocado. Vêm junto os consertos pequenos: `sentidoDoMarcador`
  com `switch` exaustivo, sem `as`; `CONTRACOES` lido por `Object.hasOwn`; o teste `{tostring}` sai (só
  `{constructor}` alcança o protótipo); `SCORE_COVERAGE_FLOOR` no lugar do `0.7` de `recursos.test.ts`.
  A medição de 10/09 roda de novo e tem de sair idêntica: a emenda não toca `score` nem caso, salvo
  `ultima` sem noite, que o export não tem.
  *Fica para a 5.4 medir:* palavra que traz uma dimensão sem o nome dela ("noites curtas", "tarde",
  "acordou") e a contradição por paráfrase.

- **2026-09-11 — a emenda da revisão 2 implementada sobre o patch da segunda volta.** Decisões que a
  spec não fixava à letra:
  (1) **A regra virou dado inteiro.** `RegraInterpolada` leva `valores` (o conjunto é o das chaves),
  `antesDe`, `naoDepoisDe`, `soPeloMarcador`, `contradiz`, `numerais` (mapa numeral → palavras de que
  ele tem de vir logo antes) e, em cada item, `formas` — o campo `marcadores` saiu. A conferência lê
  duas coisas: o texto do motor e a **frase interpolada** (o tamanho e o termo que só a troca forma).
  (2) **O "não depois de" do `{janela}`/`{quando}` é maior que as cinco preposições.** Entraram os
  artigos, as contrações delas e os demonstrativos ("nos os últimos"), porque o valor já traz o artigo;
  e os **radicais das locuções de causa** (`devido`, `graças`, `função`, `razão`, `conta`): em `7d`,
  "devido {janela}" vira "devido os últimos 7 dias", que não forma "devido a", e a causa passaria
  calada. O exemplo da spec (`4s`, "devido as últimas 4 semanas") cai nas duas regras.
  (3) **Sinal de chave.** Qualquer `$`, `%` ou `@` na prosa — colado a um nome (`$percepcao`,
  `%percepcao%`) ou solto (`{cobertura} %`, a unidade acrescentada) — e `:` colado ao nome que vem
  depois (`:percepcao`) são `chave`. O `:` **depois** de uma palavra não é: "a regularidade:
  {regularidade}" é a frase do próprio template.
  (4) **A chave sem acento é regra genérica:** o item cuja `chave` é o rótulo dobrado (`duracao` de
  "duração") reprova quando a chave aparece solta na prosa, como palavra inteira, na grafia dela.
  (5) **A aspa que sobra é medida, não suposta:** a reta em número ímpar numa ponta, a curva que abre
  sem fechar (ou fecha sem abrir). Aspa na ponta com par dentro ("“Duração” e “horário” ficam…") é do
  texto, e passa.
  (6) **Numeral:** os de uma palavra casam com o plural ("dezenas", "terços"); o numeral que o caso diz
  é conferido **por ocorrência**, com a palavra seguinte separada só por espaço — "duas" vale em "duas
  dimensões", e não em "as duas noites", "e são duas" nem "duas {medidas} dimensões".
  (7) **Recusa:** os sinais casam com o plural ("desculpas"); texto vazio é o problema `recusa` "o
  texto veio vazio". A recusa que cita o exigido é recusa só pelo sinal, sem `ausente` — e o teste
  cobra isso em **todas** as 18 variantes.
  (8) **Um achado por palavra:** em `soPeloMarcador` e em `contradiz`, o termo que o plural de um
  anterior já casa sai da volta ("meses" é o plural de "mês"), senão uma palavra daria dois problemas.
  (9) **O pedido.** O `sistema` não escreve chave nenhuma (teste: `!/[{}]/`), e ganhou "Não diga nada
  que o caso não diga". O caso em palavras perdeu o numeral: `duas` é a frase da spec ("Empatam no
  ponto mais baixo: a duração e a regularidade."), `uma` é "Só a regularidade está abaixo de todas as
  outras dimensões; o caso não diz como as outras estão entre si.", e `medidas-insuficientes` é "A
  dimensão medida neste período é a única: não há o que comparar." O sentido de `{janela}` diz o gênero
  e o número; o de `{quando}`, por que forma ele começa ("nos", "nas", "na", "neste" ou "no"); o de
  `{medidas}`, antes de que palavra vai. **O tamanho da janela saiu do pedido**: "semana", "mês" e
  "ano" são justamente as palavras que a prosa não pode usar, e plantá-las no pedido convidava o erro —
  com isso `7d` e `12m` têm o mesmo pedido no mesmo caso, o que é o certo (a frase é a mesma).
  (10) **A entrada** carrega `hoje`, corta noite e nota depois dele, e lança `RangeError` em `offset`
  que não seja inteiro ≥ 0. A data da janela leva o ano quando o ano de alguma ponta não é o de `hoje`
  — o que cobre a janela que atravessa o ano e a que está inteira no ano passado.
  (11) **A cobertura é inteira de ponta a ponta:** `(n×100 − (n×100 mod e)) / e`, piso 1. O teste a
  confere contra um oráculo que **só soma**, nas 46.812 coberturas abaixo do piso, e fixa as três
  bordas: 48/69 = 69%, 29/100 = 29%, 1/365 = 1%.
  (12) `ultima` sem noite tem cobertura `{ nights: 0, expected: 1, ratio: 0 }` → `sem-noite`, frase
  "Não há noite gravada.", janela "a última noite".
  (13) **O golden tem 18 variantes** (a noite ganhou `sem-noite`), e o hash novo é
  `93ef779a…`; a `VERSAO` segue 1 — nenhuma volta saiu da branch.
  (14) Vieram os consertos pequenos do KEEP: `CONTRACOES` lido por `Object.hasOwn` (com as formas de
  `em`), `SEM_PLURAL` para "melhore" e "piore", `sentidoDoMarcador` com `switch` exaustivo sobre
  `MarcadorDaSaude` (sem `as`), o teste `{tostring}` fora e `SCORE_COVERAGE_FLOOR` no lugar do `0.7`.
  A guarda (7) passou a ver o import profundo **com extensão** (`.ts`, `.tsx`, `.js`, `.mjs`, `.cjs`),
  com não-vácuo nos dois casadores; o teto segue 1 e o fecho da barreira (2), 67 arquivos.
  *A árvore desta volta* está em
  `/private/tmp/claude-501/-Users-sydtpt-Projects-life-organizer/a4c40f5d-3c04-4ffa-aa5e-7204ebf4d10b/scratchpad/53-implementacao-3.patch`
  (sha256 `d6ea4df5…`), e aplica limpo na baseline com `git apply`.

- **2026-09-12 — a medição de 10/09 rodou de novo, sobre reexport, e saiu idêntica.** O
  `sleep_periods.json` e o `daily_ratings.json` tinham saído do scratchpad de 10/09 (o diretório foi
  mexido às 18:37 de 11/09), então o implementador não a rodou e disse isso. O export foi **puxado de
  novo** pela Management API (o mesmo caminho de `supabase/scripts/check-schema-drift.sh`, token do
  keychain), para fora do git, com `wake_day <= '2026-09-10'`: **293 noites** e **89 notas** (87 com
  `sleep_quality`) — as mesmas contagens do export de 10/09. `medir-casos-3.ts`, em `TZ=UTC` e
  `Europe/Brussels`, reproduz a tabela de 10/09 **linha por linha** (7d: 11 `uma` · 2 `todas-iguais` + 9
  `duas` + 6 `fora-do-empate` · 45 `sem-contagem`; 4s: 2 · 2+2 · 13; 12m: 2; noites: 132 `uma` + 11
  `tudo-no-maximo` + 11 `medidas-insuficientes` · 25 `todas-iguais` + 109 `duas` + 5 `fora-do-empate`),
  com `score diferente da fórmula de 10/09: 0` e `grupo diferente: 0` em todas as janelas, e o mesmo
  cruzado (7 `medidas-insuficientes` de "tudo no máximo", 4 de "mínimo claro"). Log em
  `53c-medicao.log`, no scratchpad desta sessão. **O AC 2 está fechado com dado real.**

  Antes disso, o implementador tinha rodado o mesmo método sobre um arquivo **sintético** de 320 noites
  (`medir-casos-sintetico.ts`; log `53d-medicao-sintetica.log`), que prova o mecanismo: `score
  diferente: 0` e `grupo diferente: 0` nas 46 janelas de `7d`, 12 de `4s`, 1 de `12m` e 282 noites.

- **2026-09-11 — o que fica para a revisão decidir (volta 3).** (1) A palavra do alcance é exigida **na
  prosa**: "{janela} não tem medida para contar", na noite, é recusa, porque "noite" está só no valor.
  (2) A contração de `em` é a da spec (`no, na, nos, nas, num, numa`): "resultou neste ano" não forma
  "resultou em". (3) Ficam sem conferência o numeral que não é numeral ("ambas", "primeira", "meia"
  sozinho) e a janela dita por paráfrase ("últimas noites", "recentemente") — 5.4 mede. (4) `7d` e
  `12m` têm o mesmo pedido no mesmo caso, porque o sentido do marcador só diz gênero e número. (5) O
  apóstrofo numa ponta, em número ímpar, reprova como aspa que sobra.

- **2026-09-12 — revisão 3: 23 correções de patch, nenhuma volta à spec.** Os achados eram de
  conferência frouxa, defeito calado e teste vácuo; nenhum mexeu na intenção. O que entrou:
  **`ia/interpolar.ts`** — os pares de aspas viraram **uma fonte só** (`PARES_DE_ASPAS`, sete pares: o
  `‚…‘` era reprovado sem ser desembrulhado); caractere de **controle** (`\p{Cc}`, fora dos que a quebra
  de linha já pega) é `forma`; **rótulo de mais de uma palavra** no começo ("Resposta final:") reprova,
  por palavra-chave de rótulo em até 24 caracteres antes do dois-pontos — o dois-pontos no meio da frase
  segue sendo pontuação; chave de `valores` fora de `[a-z]+`, exigência de marcador fora do conjunto e
  palavra exigida vazia **lançam** `TypeError` (um erro de digitação fazia toda leitura do caso virar
  `recusa-do-modelo`, calada); **recusa é sinal, ou a falta e nada mais** — quem nomeia a dimensão
  errada acumula `a-mais` + `ausente` e é `reprovada`, porque errar não é recusar e a bancada conta as
  duas coisas separadas; o vocabulário depois da troca desconta só os **valores que o texto usou**; e o
  detalhe de "a janela dita de outro jeito" nomeia **todos** os marcadores que a dizem (`{janela}` e
  `{quando}`), com `trimestre`, `semestre`, `década` e `fim de semana` na lista.
  **`ia/verificar.ts`** — `CONTRACOES.em` ganhou as formas com demonstrativo e pronome ("resultou
  nisso", "resultou nele"), e `de`, `dum`/`duma` — com isso o item (2) do "fica para a revisão decidir"
  da volta 3 deixou de valer: "resultou neste ano" reprova; `conselho` ganhou "vale a pena" e `tendencia-e-meta`,
  "tendência" (nenhum dos dois colide com o corpus da Saúde nem com a barreira do vocabulário —
  medido); e o casador **perdeu o lookbehind** (`(?:^|[^\p{L}\p{N}])`), porque o barril reexporta este
  módulo e o padrão compila no boot do app, onde não há precedente de lookbehind no Hermes — a
  equivalência num teste booleano é testada, ocorrência adjacente inclusive ("aa" não casa "a").
  **`sleep/leitura.ts`** — `porcentagem` lança em cobertura incoerente em vez de escrever "NaN%";
  `sem-contagem` por cobertura lança numa noite (o `nightScore` passa `coverage: null`: a frase
  chamaria uma noite de "período", e o piso morreria com marcador sem valor); e `levou`/`resultou`
  entraram no "não depois de" da janela.
  **`sleep/caso.ts`** — ponto fora de 0–2, ou não inteiro, lança: um 3 passaria por "no máximo".
  **`architecture.test.ts`** — a guarda (7) **acha** as peças de `sleep/` por varredura (semente: o
  arquivo que importa a porta de IA; fecho dentro de `sleep/`, menos `SONO_DAS_TELAS`, que é conferido
  contra os apps), no lugar da lista de dois nomes; e nasceu a catraca **da fórmula do período** —
  `periodScore`/`rangeNights`/`rangeBounds` fora do núcleo, teto **2** (as duas telas de `/sono/saude`),
  que a 5.5 leva a 0.
  **Testes** — os ajudantes que montam `SleepScore` à mão lançam quando faltam pontos (lista curta dava
  `points: undefined`, que contava como medida); o corpus da Saúde ganhou as **frases aprovadas** pela
  conferência, e o teste cobra que cada termo excluído de propósito (`deve`, `precisa`, `melhor`,
  `pior`) apareça nele; uma varredura nova em `score.test.ts` prova que nenhum `fact` escreve número com
  ponto decimal (a regra `algarismo` lê só o texto do motor, então o pt-BR do fato não tinha rede); o
  golden hasheia **só os hashes** dos pedidos, com `quantas` separando "o conjunto de variantes mudou"
  de "o pedido mudou" (renomear fixture não manda mais subir a `VERSAO`); os fixtures de `12m`, `4s` e
  `ano` ganharam janela coerente com o alcance; `>= 7` virou `=== 7` e o conjunto caso × alcance, `=== 17`;
  e cada correção que muda comportamento ganhou teste. O golden da Saúde agora é `383022d1…`, com a
  `VERSAO` ainda em 1 — o pedido não mudou nesta volta, a forma do hash mudou.
  *Fora por barreira, não por decisão minha:* "provocou" e "causou" **não** entraram no "não depois de"
  da janela — são termos de uma palavra do `VOCABULARIO_PROIBIDO`, já pegos no texto do motor, e
  repeti-los numa lista de `sleep/leitura.ts` é exatamente a segunda lista que a barreira da AD-6
  reprova (ela reprovou, e há teste provando que "o que provocou a noite curta" é `vocabulario`).
  *A medição real rodou de novo depois das correções* (`medir-casos-3.ts` sobre o reexport, em `TZ=UTC` e
  `Europe/Brussels`; log `53f-medicao.log`) e saiu **idêntica** à de 12/09 — as 73 + 19 + 2 janelas e as
  293 noites, com `score diferente: 0` e `grupo diferente: 0` nas oito passagens: o ponto fora de 0–2 e a
  cobertura incoerente, que agora lançam, não existem no acervo dele. *A árvore depois da revisão 3* está
  em `53-implementacao-4.patch` (sha256 `a72f58e3…`), no mesmo scratchpad, e aplica limpo na baseline.

- **2026-09-12 — revisão 3: o que foi rejeitado, e por quê.** Dez achados não viraram código, e ficam
  escritos para não voltarem como novidade. (1) **Exigir o marcador do fato em `uma`:** a frase sem o
  número continua verdadeira, e a tela mostra o fato das cinco dimensões ao lado dela — o limiar é do
  dono, com o relatório da 5.4 na mão. (2) **`sem-medida` com medida e cobertura no piso:** estado que
  `nightScore`/`periodScore` não produzem, decidido e registrado na volta 2; o `points` fora de 0–2, que
  é o vizinho dele, passou a lançar. (3) **Palavra que traz uma dimensão sem o nome** ("noites curtas",
  "despertares", "a nota"): léxico aberto, e a 5.4 mede quanto escapa. (4) **Validar as notas na
  entrada:** o banco já tem `check (sleep_quality between 1 and 5)`
  (`supabase/migrations/20260607130000_daily_ratings.sql:10`) e o reexport de 12/09 não tem nota fora da
  faixa; lançar na leitura quebraria a tela por dado sujo. (5) **Regex recompilada por chamada:**
  decisão da volta 2 (nenhum cache que cresça sem limite); a tela escreve uma frase por toque, e a
  bancada, alguns milhares. (6) **`meioDiaDe` recusar dia que não existe no fuso do processo**
  (30/12/2011 em `Pacific/Apia`): a ida-e-volta é o que prova que o dia existe. (7) **O barril exportar
  `ia/interpolar`:** a bancada da 5.4 lê pelo barril, e quem cobra o app é a guarda (7). (8) **O fixture
  de `SleepScore` repetido em quatro testes:** dívida aceita — juntar agora vira módulo de fixture e
  mexe nos quatro arquivos; os ajudantes já lançam quando falta ponto. (9) **`ultima` pelo `nightScore`
  contra o `periodScore` da tela:** já adiado na revisão 1, e a 5.5 mostra a diferença ao dono.
  (10) **Falta de doc no diff:** a ADR 0049 e a CAP-13 estão na `main` desde 10/09. Um achado virou
  **adiado**: o ◀ de `ultima` anda por período, não por dia, e 1 dos 293 dias do acervo tem dois.

## Design Notes

**O pedido do motor** (para a bancada da 5.4): `sistema` com as regras — uma frase só, sem quebra de
linha nem marcação, registro de jornal, nenhum número (nem por extenso: a contagem, quando houver, vem
por marcador), marcador exatamente como dado, sem unidade acrescentada e só os do pedido, nomeie só as
dimensões listadas, não diga nada que o caso não diga, sem conselho, elogio, placar, tendência,
comparação com outras pessoas nem causa, sem somar dimensões. O `sistema` não cita marcador pelo nome:
o que cada um traz (unidade, sinal de porcentagem, forma gramatical) vai no sentido dele. `usuario` com o
caso em palavras, sem numeral por extenso (em `duas`: "Empatam no ponto mais baixo: a duração e a
regularidade."), o alcance, a janela por `{janela}`, as dimensões a nomear (ou "não é preciso nomear
dimensão") e os marcadores do caso com o sentido de cada um, sem valor. Todo caso gera pedido; ele
depende só do alcance, do `range`, do caso e das dimensões — nunca de fato, ponto, passo ou `hoje`.
Amostragem `gulosa`, saída texto, guardrail padrão. Versão 1.

**Marcador:** `{nome}`, nome em `[a-z]+`, cada um **no máximo uma vez** na frase. Conjunto por caso:
`{janela}` e `{quando}` sempre; `{medidas}` fora de `sem-contagem`; `{cobertura}` em `sem-contagem` por
cobertura; `{<chave>}` só em `uma` — marcador de fato só onde há uma dimensão, e a troca de fato entre
dimensões fica impossível. A regra leva os `valores` do caso, e o conjunto é o das chaves deles.
- `{janela}` é sempre nome com artigo ou demonstrativo, e o gênero e o número dependem só do `range` — o
  sentido no pedido os diz: `7d` "os últimos 7 dias" / "os 7 dias de 28/08 a 03/09"; `4s` "as últimas 4
  semanas" / "as 4 semanas de 07/08 a 03/09"; `12m` "os últimos 12 meses" / "os 12 meses de 11/09/2024 a
  10/09/2025"; `ano` "este ano" / "o ano de 2025"; `ultima` "a noite de 10/09" / sem noite "a última
  noite". `{quando}` é o mesmo nome com a preposição contraída: "nos últimos 7 dias", "nas 4 semanas de
  07/08 a 03/09", "neste ano", "no ano de 2025", "na noite de 10/09", "na última noite". Nenhum dos dois
  vale logo depois de "em", "de", "a", "à" ou "por".
- A data leva o ano quando a janela atravessa um **ou quando o ano dela não é o de `hoje`** ("a noite de
  09/01/2025"); por isso a entrada carrega `hoje`.
- `{medidas}` é por extenso no feminino e vale só logo antes de "dimensão" quando é "uma", e de
  "dimensões" quando é mais.
- Chave malformada (`chave`): os embrulhos `[nome]`, `${nome}`, `<nome>`, `｛nome｝`; o nome de marcador
  colado a `$`, `%`, `@` ou `:` (`$percepcao`, `%percepcao%`); a chave sem acento de um item cujo rótulo
  tem acento (`duracao`, `horario`, `percepcao`) solta na prosa.
- A janela dita de outro jeito (`marcador`): na prosa, hoje, ontem, anteontem, amanhã, dia, semana,
  quinzena, mês, meses e ano, com o plural. "Noite" e "período" ficam de fora — são as palavras do alcance.

**Presença** (o que fecha a omissão): `uma`, `duas`, `fora-do-empate` exigem as nomeadas **pelo nome**,
na prosa — o marcador da dimensão, em `uma`, é opcional e não conta como nome, porque o fato ("± 22 min")
não diz de que dimensão é; `tudo-no-maximo`, `todas-iguais`, `medidas-insuficientes` exigem `{medidas}`;
`sem-contagem` por cobertura exige `{cobertura}`; sem noite e sem medida exigem a palavra do alcance
("noite" ou "período"). O nome casa por palavra inteira, acento dobrado, nas formas da dimensão — o
rótulo, o plural (durações, continuidades, horários, regularidades, percepções) e, para a regularidade,
"irregular(es)" —, para a presença e para a dimensão a mais. Citáveis pelo nome: as nomeadas; em
`tudo-no-maximo`, `todas-iguais` e `medidas-insuficientes`, as medidas; em `sem-contagem`, nenhuma.

**Recusa** (a que cita a palavra exigida): `ia/interpolar.ts` é dono dos sinais — desculpe, desculpa,
lamento, sinto muito, não posso, não consigo, não sou capaz, não tenho acesso, como modelo, como
assistente, modelo de linguagem, inteligência artificial, sorry, unable, "as an ai", "i cannot" —,
casados por palavra na prosa. Qualquer um é problema `recusa` e `recusa: true`, com o exigido presente
ou não. Texto vazio também é recusa.

**Contradição** (a linha nova da matriz): cada caso declara as expressões que afirmam outro caso, ou um
nível que o pedido não deu — em `uma` o motor sabe que uma dimensão está abaixo das outras, não se as
outras empatam nem se chegam ao máximo. Na prosa, por palavra, é problema `contradicao` (`reprovada`).
Termo de uma palavra casa com o plural; o de várias, só nas formas escritas:

| Caso | Contradiz |
|---|---|
| `uma` | máximo, mínimo, empata, empatam, empate, empatada, empatado, mesmo ponto, iguais, mais alta, mais alto, a melhor, o melhor, está acima, fica acima — só o singular: "as outras são mais altas" é verdade |
| `duas` | máximo, mínimo, mais alta, mais alto, a mais baixa, o mais baixo, a melhor, o melhor, a pior, o pior, está acima, fica acima |
| `fora-do-empate` | mínimo, a mais baixa, o mais baixo, a pior, o pior; e máximo quando as de fora não estão no máximo |
| `tudo-no-maximo` | mais alta(s), mais alto(s), mais baixa(s), mais baixo(s), acima, abaixo, mínimo, a pior, o pior, a melhor, o melhor |
| `todas-iguais` | as de `tudo-no-maximo`, e máximo |
| `medidas-insuficientes`, `sem-contagem` | as de `todas-iguais`, e empata, empatam, empate, empatada, empatado, mesmo ponto, iguais |

A frase do template de cada caso passa na lista do próprio caso — é teste. Paráfrase e negação ("nenhuma
abaixo das outras" em `tudo-no-maximo`) ficam para a 5.4 medir; a negação reprova, e a leitura cai no
template.

**Forma e número:** `interpretar` tira espaço e aspas que embrulham a resposta. Reprova (`forma`): quebra
de linha; marcação (`*`, `_`, `#`, crase, `~`); marcador de lista ou citação no começo (`-`, `•`, `>`, `–`,
`—` e espaço); caractere invisível de formatação (`\p{Cf}`); rótulo de uma palavra com dois-pontos no
começo ("Frase:", "Resposta:", "Caso:"); aspa que sobra no começo ou no fim; pontuação final (`.`, `!`,
`?`, `…`) antes do fim; mais de 280 caracteres **na frase interpolada**. Reprova `algarismo` todo `\p{N}`,
e `extenso`, fora de marcador: dois a dez nos dois gêneros (de `porExtenso`), zero, onze a dezenove
(catorze e quatorze), vinte, trinta… noventa, cem, cento, duzentos a novecentos nos dois gêneros, mil,
milhão, milhões, bilhão, bilhões, dezena, dúzia, metade, dobro, triplo, terço, meia hora, meia-noite,
meio-dia e "por cento" — "um" e "uma" são artigo. O numeral que o caso diz vale só no lugar dele: "duas",
em `duas`, só logo antes de "dimensões". `montarFrase` põe em maiúscula a primeira letra.

**Vocabulário:** confere o texto do motor e a frase interpolada. O termo que só nasce na troca, entre a
prosa e um valor ("devido {janela}" → "devido as últimas 4 semanas"), reprova; o que está inteiro dentro
de um valor, não — os achados do texto, mais os da frase interpolada que nenhum valor sozinho dá.

**Cobertura:** `{cobertura}` é o piso da porcentagem em aritmética inteira —
`Math.max(1, Math.floor(nights * 100 / expected))` —: nunca "70%" abaixo do piso de 70%, nem "0%" com
noite gravada, nem "28%" para 29 de 100.

**A entrada:** noite com dia de acordar depois de `hoje` e nota depois de `hoje` não entram — a bancada
relê dias passados contra o arquivo inteiro. `offset` que não seja inteiro ≥ 0 lança `RangeError`, como o
`hoje` inválido. `ultima` sem noite é `sem-contagem` por `sem-noite`: a cobertura da noite que não existe
é `{ nights: 0, expected: 1, ratio: 0 }`, no molde do período vazio.

**O template** (piso; escrito com marcadores e passado pelo mesmo `interpolar`):

| Caso | Frase |
|---|---|
| sem-contagem | "Este período tem {cobertura} das noites gravadas — poucas para contar." · sem noite: "Este período não tem noite gravada." (noite: "Não há noite gravada.") · sem medida: "Esta noite não tem medida para contar." (período: "Este período não tem medida para contar.") |
| medidas-insuficientes | "Só {medidas} dimensão foi medida neste período — não há o que comparar." (noite: "nesta noite") |
| tudo-no-maximo | "As {medidas} dimensões medidas estão no máximo." |
| todas-iguais | "As {medidas} dimensões medidas estão no mesmo ponto." |
| uma | "A dimensão mais baixa é a regularidade: {regularidade}." |
| duas | "A duração e a regularidade empatam no ponto mais baixo." |
| fora-do-empate | "Só o horário está no máximo." · "Só o horário e a percepção estão acima das outras." |

Artigos: a duração, a continuidade, o horário, a regularidade, a percepção.

**Listas:** `conselho` + recomenda, recomendamos, recomendam, recomendar, recomendado, recomendável,
recomendação, recomendações, sugere, sugerimos, sugerir, sugerido, sugestão, sugestões, experimentar,
deveria, deveriam, evite, evitar, tente, tentar, procure, procurar, considere, considerar, mantenha, o
ideal; `elogio` + ótimo, ótima, excelente, perfeito, perfeita, muito bem; `placar` + pontuações;
`tendencia-e-meta` + melhorar, melhoram, melhoraram, melhorando, melhorado, melhore, melhoria, piorar,
pioram, pioraram, piorando, piorado, piore, subiu, subiram, subir, caiu, caíram, cair, aumentou,
aumentaram, aumentar, diminuiu, diminuíram, diminuir, evoluiu, evoluir, em alta, em queda. "Melhorias"
sai (o plural de "melhoria" já a casa), e "melhore" e "piore" casam sem o plural — "as piores noites"
passa. Ficam de fora "deve", "precisa", "melhor" e "pior" — "precisa de 5 noites seguidas" é fato da
Saúde. Termo novo que case com o corpus da Saúde em `verificar-vocabulario.test.ts`, ou que a barreira do
vocabulário ache no código, é **Ask First**. `causa` não muda; na Saúde ela casa por palavra, e a
preposição final contrai: a/à → ao, aos, às, as, àquele(s), àquela(s), àquilo; de → do, da, dos, das,
disso, disto, daquilo, desse(s), dessa(s), deste(s), desta(s), daquele(s), daquela(s), dele(s), dela(s);
em → no, na, nos, nas, num, numa ("resultou na", "por conta disso"). "devido a" e "devido à" dobram para
um achado só.

**Golden:** `GOLDENS['saude-do-sono']` junta o hash dos pedidos de todas as variantes — os sete casos,
noite e período, os três motivos de `sem-contagem`, os cinco alcances —, sobre fatos montados à mão. O
pedido muda nesta volta e o hash acompanha; a `VERSAO` segue 1 (nenhuma volta saiu da branch).

## Verification

**Commands:**
- `pnpm --filter @vitale/shared lint` -- exit 0
- `pnpm --filter @vitale/shared test` -- exit 0
- os testes novos (`sleep/caso`, `sleep/leitura`, `ia/interpolar`, `ia/recursos`, `ia/verificar-vocabulario`) com `TZ=UTC pnpm exec tsx <arquivo>` -- exit 0 (a suíte inteira em UTC já falha em `fitness/overview.test.ts`, pré-existente)
- `cd mobile && pnpm exec tsc --noEmit` e `pnpm --filter @vitale/web build` -- exit 0
- `git diff --stat main -- mobile web supabase packages/shared/src/ia/pacote.ts packages/shared/src/ia/prompt.ts packages/shared/src/period` -- vazio
- um script fora do git sobre o export de 10/09 -- a tabela de casos por janela, comparada com a CAP-13

## Suggested Review Order

**A entrada: o que a tela e a bancada leem**

- O começo de tudo: janela, noites, notas e `score`, puro e sem relógio — nada depois de `hoje`.
  [`leitura.ts:181`](../../packages/shared/src/sleep/leitura.ts#L181)
- O caso é do código, em sete, por precedência — a ADR 0049 em função pura.
  [`caso.ts:96`](../../packages/shared/src/sleep/caso.ts#L96)
- O motivo de `sem-contagem`, na ordem em que um exclui o outro.
  [`caso.ts:89`](../../packages/shared/src/sleep/caso.ts#L89)

**O recurso: pedido, conferência, frase e piso**

- O descritor inteiro numa tela: interpolado, não grava, cadeia só `sem-modelo`, caso derivado a cada passo.
  [`leitura.ts:742`](../../packages/shared/src/sleep/leitura.ts#L742)
- A regra do caso como dado — é ela que o motor tem de satisfazer.
  [`leitura.ts:537`](../../packages/shared/src/sleep/leitura.ts#L537)
- O que cada caso proíbe afirmar: a linha nova da matriz, em lista por caso.
  [`leitura.ts:516`](../../packages/shared/src/sleep/leitura.ts#L516)
- O piso, frase por frase — o texto que aparece quando não há motor.
  [`leitura.ts:568`](../../packages/shared/src/sleep/leitura.ts#L568)
- As regras que o motor recebe, sem nome de marcador e sem número.
  [`leitura.ts:606`](../../packages/shared/src/sleep/leitura.ts#L606)
- O pedido: função do alcance, do caso e das dimensões — nunca do fato nem do passo.
  [`leitura.ts:702`](../../packages/shared/src/sleep/leitura.ts#L702)

**A conferência interpolada (genérica, sem saber o que é sono)**

- Forma, número, chave, marcador, item a mais, contradição, vocabulário e presença, em leitura única.
  [`interpolar.ts:416`](../../packages/shared/src/ia/interpolar.ts#L416)
- O contrato que o recurso declara — o vocabulário da regra.
  [`interpolar.ts:211`](../../packages/shared/src/ia/interpolar.ts#L211)
- A recusa que chega como texto comum, e é o que a ADR 0049 manda barrar.
  [`interpolar.ts:343`](../../packages/shared/src/ia/interpolar.ts#L343)
- A troca do marcador pelo fato, numa passada, com maiúscula só na primeira letra.
  [`interpolar.ts:135`](../../packages/shared/src/ia/interpolar.ts#L135)

**O casamento de palavras e as listas**

- Palavra inteira, acento dobrado, plural e contração — **sem lookbehind**, porque compila no boot do app.
  [`verificar.ts:337`](../../packages/shared/src/ia/verificar.ts#L337)
- As contrações da preposição final: "devido ao", "por conta disso", "resultou nisso".
  [`verificar.ts:275`](../../packages/shared/src/ia/verificar.ts#L275)
- Os dois termos sem plural — é o que deixa "as piores noites" passar.
  [`verificar.ts:294`](../../packages/shared/src/ia/verificar.ts#L294)

**Os números em pt-BR**

- A contagem pequena por extenso, que lança fora de 1 a 10.
  [`numero.ts:52`](../../packages/shared/src/format/numero.ts#L52)
- A vírgula da percepção, consertada na origem: sai "3,3/5", não "3.3/5".
  [`score.ts:504`](../../packages/shared/src/sleep/score.ts#L504)
- A cobertura pelo piso, em aritmética inteira — 29 de 100 é 29%.
  [`leitura.ts:321`](../../packages/shared/src/sleep/leitura.ts#L321)

**As barreiras**

- A guarda (7) acha as peças de `sleep/` por varredura: peça nova nasce proibida ao app.
  [`architecture.test.ts:1234`](../../packages/shared/src/architecture.test.ts#L1234)
- Catraca nova: a fórmula do período fora do núcleo, teto 2 — a 5.5 leva a 0.
  [`architecture.test.ts:1393`](../../packages/shared/src/architecture.test.ts#L1393)

**Catálogo, barril e testes**

- O descritor no catálogo, ao lado do da Retrospectiva.
  [`recursos.ts:26`](../../packages/shared/src/ia/recursos.ts#L26)
- O barril publica entrada, caso e o regime interpolado.
  [`index.ts:58`](../../packages/shared/src/index.ts#L58)
- A matriz inteira, a recusa em todas as variantes e a contradição dos sete casos.
  [`leitura.test.ts:263`](../../packages/shared/src/sleep/leitura.test.ts#L263)
- O golden dos pedidos, por variante, e a mensagem que separa "o pedido mudou" de "as variantes mudaram".
  [`recursos.test.ts:1`](../../packages/shared/src/ia/recursos.test.ts#L1)
- O corpus da Saúde, as listas e as exclusões provadas.
  [`verificar-vocabulario.test.ts:1`](../../packages/shared/src/ia/verificar-vocabulario.test.ts#L1)
