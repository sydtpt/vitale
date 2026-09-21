---
title: 'Story 5.7 — O nome de rota pela porta'
type: 'refactor'
created: '2026-09-21'
status: 'done'
baseline_commit: 'dbb8df7a77693957e75cb707679f332152b87508'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** O nome da pedalada é o último caminho do app que fala com modelo **por fora da porta**:
`mobile/src/services/route-name.ts` nomeia a function `'ia-narrar'` à mão e chama `nomearRota(…, chamar)`
pela costura legada `ChamadorDeModelo`. Por isso o recurso não aparece no seletor, não respeita
preferência de motor, não tem cadeia, recuo nem classes de falha — e duas catracas de arquitetura
seguem em 1 esperando esta story.

**Approach:** Escrever `descritorDoNomeDeRota` em `packages/shared/src/routes/`, registrá-lo no
`CATALOGO_DE_RECURSOS` e trocar o serviço do app por uma leitura do orquestrador em modo `produto`.
As cinco desistências de hoje viram causas do piso, e só as permanentes gravam. A costura legada
morre, as duas catracas vão a zero e viram barreira.

## Boundaries & Constraints

**Always:**
- **O corpo que chega à `ia-narrar` não muda.** `saida: { tipo: 'esquema' }` vira `{sistema, usuario,
  json:true}` no fio (`nuvem.ts:60-68`), e o texto de `montarPromptDeNome` fica **byte a byte** igual,
  com `PROMPT_NOME_VERSAO` em 2 — os 133 nomes aprovados continuam comparáveis.
- **A nuvem continua o padrão, por herança:** `cadeiaPadrao: ['nuvem:padrao', SEM_MODELO]`. Decisão do
  dono em 21/09; a spec declara que é herança **não medida** e a medição do nome de rota na bancada
  entra em `deferred-work.md`.
- **Só causa permanente grava**: `mudo` → `degenerada`; `saida-invalida` → `ilegivel` (com o `detalhe`,
  que é onde o truncamento passa a aparecer); `reprovada` → `reprovado`, ou `sem-molde` quando a regra
  que reprovou for essa. Qualquer outro desfecho **não escreve nada** e a pedalada volta ao gatilho.
- `grava.recusaEResultado` **passa a ser lido**: é ele que manda o piso carregar a tentativa recusada.
- O gatilho segue um por pedalada, ao abrir o detalhe, protegido pela marca gravada. Nunca retry da porta.
- Só acréscimo em `ia/motor.ts` e `ia/orquestrar.ts`: assinatura existente não muda.

**Ask First:**
- Mudar o texto do pedido ou subir `PROMPT_NOME_VERSAO` — muda o nome que sai e rompe a comparação.
- Pôr `aparelho:sistema` na `cadeiaPadrao` (ele entra como **escolha** no seletor, não como padrão).
- Qualquer mudança visual na tela do seletor ou no detalhe da pedalada.

**Never:**
- Renomear, reprocessar ou apagar nome já gravado. Nenhum backfill.
- Tocar `web/`, `supabase/functions/` ou o worktree `life-organizer-wt-revista-1-13`.
- Centralizar a conferência de `Esquema` dentro do orquestrador (avaliado: muda o contrato de todo
  descritor). Um helper compartilhado, sim.
- Mostrar "quem escreveu" no detalhe da pedalada.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Nome sai | pedalada de bike com rota e cidades, sem preferência | nuvem responde; `origem:'motor'`; grava `route_name` + meta com `provedor`, `modelo`, `tokens`, `justificativa`, `versaoPrompt:2` | N/A |
| Rota degenerada | pontas coincidentes | `montarPedido` devolve `null` → piso `mudo`; grava meta `recusa:'degenerada'` | **zero chamada** ao motor |
| Resposta ilegível | JSON quebrado, sem `justificativa`, ou fora do esquema — **respondido e assinado por um motor** | `interpretar` → `Falha('saida-invalida')`; piso; grava `recusa:'ilegivel'` + `detalhe` | permanente: não tenta de novo |
| Truncado, e o que nem chega a ser resposta | `motivoDeParada ≠ STOP`, corpo 2xx ilegível, resposta sem texto ou sem assinatura | `saida-invalida` **sem tentativa assinada**: piso, **nada gravado** | tenta na próxima abertura — **emenda do dono, 21/09/2026**: nada fica queimado por um corte que um pedido melhor resolveria depois |
| Conferência reprova | justificativa cita cidade não enviada | piso `reprovada` com `recusado`; grava `recusa:'reprovado'` com provedor/modelo/tokens/justificativa | idem |
| Molde não monta | peças válidas, `montarNome` devolve `null` | `conferir` reprova com regra `sem-molde`; grava `recusa:'sem-molde'` | idem |
| Rede caiu, prazo, function fora | classe `transitoria`/`indisponivel`/`capacidade` | piso; **nada gravado**; `routeNameChecked` segue falso | tenta na próxima abertura |
| Preferência = aparelho, sem ponte | `aparelho:sistema` escolhido num build sem a ponte | `indisponivel` → recua só para `sem-modelo` (a exposição não sobe até a nuvem) → piso `ausencia` | nada gravado |

</frozen-after-approval>

## Code Map

> **Os números de linha e os alvos abaixo são os do `baseline_commit`** (`dbb8df7`), não os de depois da
> implementação. Onde a 5.7 apagou ou moveu o alvo, a entrada diz o que aconteceu — o mapa serve para
> ler o ponto de partida, e reescrevê-lo apagaria a razão de cada mudança.

- `packages/shared/src/ia/orquestrar.ts:124-146` -- `Descritor<F,V>`; `:92-98` `Conferencia`; `:101` `Piso`;
  `:174-191` `Leitura`/`LeituraDoMotor`/`LeituraDoPiso` (**o piso não carrega assinatura, tokens nem
  valor** — é a dívida desta story); `:363-368` `pisoDe` poda; `:440` `recusa ? 'recusa-do-modelo' :
  'reprovada'`; `:293` `RECUA`; `:719` `ler`.
- `packages/shared/src/sleep/sonda.ts:126-207` -- **o molde a imitar**: regime `'molde'`, `saida` por
  `Esquema`, `montarPedido` devolvendo `null`, `interpretar` com `JSON.parse` + `conformeAoEsquema` →
  `saida-invalida`, `conferir` com `reprova(regra, detalhe)`, `semModelo` entre `frase` e `ausencia`.
- `packages/shared/src/ia/fio.ts:170-184` `Esquema`; `:293` `conformeAoEsquema`; `:44-52` as sete classes.
- `packages/shared/src/ia/nuvem.ts:60-68` esquema→`json:true`; `:141-142` truncamento→`saida-invalida`.
- `packages/shared/src/ia/motor.ts:310-344` -- `PromptLegado`/`RespostaDoModelo`/`ChamadorDeModelo`,
  `@deprecated` "morre na 5.7" — **apagados pela 5.7**; no lugar deles, a mesma seção do arquivo passou
  a ter `interpretarPorEsquema`. `:125` `CONCLUSAO` fica.
- `packages/shared/src/routes/nomear.ts:67-137` -- a sequência inteira; `:32-37` `MotivoDaRecusa`;
  `:40-55` `RouteNameMeta`; `:101` a comparação com `'STOP'` (a catraca); `:30` o reexport que morre.
- `packages/shared/src/routes/prompt.ts:120-183` `montarPromptDeNome`/`lerRespostaDoModelo`/`:29`
  `PROMPT_NOME_VERSAO`; `verificar.ts:38-98` `verificarNome`; `molde.ts:75-106` `montarNome`;
  `shape.ts:110` `lerRota`. **Todas puras e reaproveitadas como estão.**
- `packages/shared/src/ia/recursos.ts:19-27` -- `'nome-de-rota'` já em `RECURSOS`, sem descritor;
  `recursos.test.ts:203-215,280` `GOLDENS` (descritor novo sem golden reprova).
- `packages/shared/src/data/activities.ts:169-183` `saveRouteName` (duas colunas); `:75`
  `routeNameChecked = route_name_meta != null` — **não existe coluna**, é derivado.
- `mobile/src/services/route-name.ts:49-74,98-130` -- o hospedeiro a reescrever (o `catch {}` de `:127`
  é a política de hoje); chamador único em `mobile/src/app/historico/[label]/[id].tsx:149-163`.
- `mobile/src/lib/motores/index.ts:467,498` `criarMotorPara`/`motorPara`; `:750` `catalogoDoRecurso`;
  `preferencia.ts:70` `lerPreferencia`; `anel.ts:74` `anel`. Molde de uso ponta a ponta:
  `mobile/src/lib/leitura-da-saude.ts:174-199`.
- `mobile/src/lib/motores/catalogo.ts:450-456` `HOSPEDAGEM['nome-de-rota'].hospedado === false` (bloqueia
  todos os motores do recurso); `mobile/src/app/configuracoes/motores/index.tsx:56-60` já tem o rótulo.
- `packages/shared/src/architecture.test.ts:2962` `TETO_STOP = 1`; `:3028`
  `TETO_PORTA_POR_HOSPEDEIRO = 1`; `:3169` só `descritor*` e a porta saem do núcleo de IA;
  `:3609`/`:3624` funções do descritor só pelo orquestrador; `:2749` `Motor` não se reapelida.
- `mobile/src/lib/__tests__/motores-catalogo.test.ts:100` afirma hoje que o nome de rota **não** está ligado.

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/ia/orquestrar.ts` -- `LeituraDoPiso<V = unknown>` ganha `recusado?: { motor,
      resposta: RespostaAssinada, valor?: V, problemas? }`, preenchido **só** quando
      `grava.recusaEResultado` é `true`, um motor respondeu e a causa é permanente -- é o que permite
      gravar a recusa sem perder provedor/modelo/tokens/justificativa, e faz o campo declarado ser lido.
- [x] `packages/shared/src/ia/motor.ts` -- acrescentar `interpretarPorEsquema(esquema, resposta)`
      (parse + `conformeAoEsquema` → `Falha('saida-invalida')`); **apagar** `PromptLegado`,
      `RespostaDoModelo` e `ChamadorDeModelo`.
- [x] `packages/shared/src/sleep/sonda.ts` -- passar a usar o helper, com detalhe e comportamento
      idênticos -- dois usuários provam que o helper não é fachada.
- [x] `packages/shared/src/routes/descritor.ts` (novo) -- `descritorDoNomeDeRota`: `versao:
      PROMPT_NOME_VERSAO`, `regimeDeNumeros:'molde'`, `regimeMaximo:'nuvem'`, `cadeiaPadrao:
      ['nuvem:padrao', SEM_MODELO]`, `grava:{admite:['nuvem','aparelho'], recusaEResultado:true}`;
      `montarPedido` `null` na degenerada; `conferir` = `verificarNome` + `montarNome` nulo → regra
      `sem-molde`; `semModelo` → `{ausencia}`.
- [x] `packages/shared/src/routes/nomear.ts` -- tirar o parâmetro `chamar`, o reexport e a comparação
      com `'STOP'`; passar a exportar `metaDaLeitura(leitura, fatos, agora)`, puro, que traduz
      `Leitura` → `{nome, meta} | null` (null = não grava). O segundo argumento é a `FatosDoNome` do
      descritor (rota **e** âncoras), e não a rota sozinha: a meta grava `forma` e `lingua`, que saem
      de `lerRota(rota, ancoras)` — sem as âncoras não há forma a derivar.
- [x] `packages/shared/src/ia/recursos.ts` + `recursos.test.ts` -- registrar o descritor e acrescentar o
      golden (fatos fixos de `__fixtures__/golden.json`, versão e hash).
- [x] `mobile/src/services/route-name.ts` -- reescrever sobre `ler(descritorDoNomeDeRota, …, {modo:
      'produto', cadeia: resolverCadeia(…), motorPara, registrar: anel.registrar, agora})`, com
      `lerPreferencia`/`catalogoDoRecurso` como em `leitura-da-saude.ts`; grava só quando
      `metaDaLeitura` devolver algo -- o literal `'ia-narrar'` sai do arquivo.
- [x] `mobile/src/lib/motores/catalogo.ts` -- `HOSPEDAGEM['nome-de-rota'] = { hospedado: true }`.
- [x] `packages/shared/src/architecture.test.ts` -- `TETO_STOP` e `TETO_PORTA_POR_HOSPEDEIRO` a **0**,
      com o texto virando barreira e a não-vacuidade provada.
- [x] `packages/shared/src/routes/nomear.test.ts` + `routes/descritor.test.ts` (novo) -- reescrever os 8
      casos para atravessar `ler()` com um `Motor` falso, cobrindo **cada linha da matriz**, e provar que
      a rota degenerada não gasta chamada.
- [x] `mobile/src/lib/__tests__/route-name.test.ts` (novo) -- o hospedeiro: corpo idêntico ao de hoje,
      grava só nas permanentes, não grava nas transitórias, e a preferência do aparelho não recua para a
      nuvem.
- [x] `mobile/src/lib/__tests__/motores-catalogo.test.ts` -- atualizar a afirmação do recurso ligado.
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` -- registrar: a medição do nome de rota na
      bancada (o padrão é herdado, não medido) e a avaliação de centralizar o `Esquema`, com o motivo da
      recusa.

**Acceptance Criteria:**
- Given nenhuma preferência gravada, when uma pedalada nova é aberta, then o corpo enviado à
  `ia-narrar` é **idêntico** ao de hoje (teste compara o objeto) e o nome gravado é o mesmo.
- Given o descritor registrado, when a tela `/configuracoes/motores` abre, then "Nome de rota" lista os
  motores **sem bloqueio**, e escolher um grava a preferência daquele recurso.
- Given um recurso com `recusaEResultado: false` (a retrospectiva), when o desfecho é piso permanente,
  then o resultado **não** traz `recusado` — o campo é lido, não preenchido sempre.
- Given as duas catracas a zero, when alguém escrever `'ia-narrar'` ou `'STOP'` fora do dono, then o teste
  falha (caso-espelho provando não-vacuidade).
- Given uma falha transitória, when a pedalada é reaberta, then ela é tentada de novo — nada foi gravado.

## Spec Change Log

**21/09 — ✅ VEREDITO DADO: o truncado volta a tentar.** O dono leu as duas saídas e escolheu **deixar
como ficou**: pedalada com resposta cortada não é marcada, e é tentada de novo na próxima abertura —
"nada fica queimado por um corte que um pedido melhor resolveria depois". A linha `Truncado` da matriz
foi emendada por ele, com data; a opção (b) (reclassificar os três casos em `ia/nuvem.ts`) fica
descartada para esta story. O registro do conflito segue abaixo, como foi levantado.

**21/09 — o truncado deixou de gravar.** A revisão pediu (achado 1) que
`saida-invalida` só grave `ilegivel` quando houver tentativa recusada **com resposta assinada**, porque
a mesma classe chega da borda da nuvem em três casos que não são o modelo respondendo — "corpo
ilegível" (um 2xx com HTML de gateway), "resposta sem texto" e "resposta sem assinatura". Como
`route_name_meta` é a própria marca do gatilho e a spec proíbe reprocessar, um soluço de proxy deixaria
a pedalada sem nome **para sempre**. O conserto foi feito e tem caso-espelho.

A consequência **contradiz a linha `Truncado` da matriz congelada**, que manda gravar
`recusa:'ilegivel'` com o detalhe preservado. O truncado não tem resposta assinada — o motivo de parada
que não é conclusão para na borda (`ia/nuvem.ts:142`), antes de o texto virar `Resposta` —, então ele
passou a **não gravar nada e a ser tentado de novo**. Não há como separá-lo dos três casos de proxy sem
farejar a string do `detalhe`, que as Design Notes recusam explicitamente.

O comportamento novo é defensável (um estouro de tokens pode não se repetir no pedido seguinte, e
nenhuma pedalada é queimada por infraestrutura), mas **é mudança no bloco congelado e não foi
ratificada**. Duas saídas, se ele não gostar: (a) restaurar o `Truncado`, aceitando que um HTML de
gateway queime a rota; (b) reclassificar os três casos de "não é resposta" como `transitoria` em
`ia/nuvem.ts` — mais correto, e mexe num contrato que serve também a revista e à Saúde, fora do que
esta story autoriza. Nada no bloco congelado foi editado.

**21/09 — `LeituraDoPiso<V = never>` virou `<V = unknown>`.** Com `never`, `LeituraDoPiso<string>` não é
atribuível a `LeituraDoPiso` (o parâmetro é covariante em `recusado.valor`), e `ia/imprimir-sequencia.ts`
e `ia/imprimir.ts`, que escrevem o tipo sem argumento, param de compilar. `unknown` é o que o nome sem
parâmetro já significa ali — "o piso de um recurso qualquer" — e mantém as duas escritas válidas.

**21/09 — `metaDaLeitura(leitura, fatos, agora)`, não `(leitura, rota, agora)`.** O segundo argumento é
a `FatosDoNome` do descritor (rota **e** âncoras). A meta grava `forma` e `lingua`, que saem de
`lerRota(rota, ancoras)`: com a rota sozinha não há como derivar a forma, e o hospedeiro teria de
refazer a leitura por fora — a segunda sequência que a AD-2 proíbe.

**21/09 — o corpo ganha `esquema`, e é a única diferença.** A constraint diz que `saida: { tipo:
'esquema' }` vira `{sistema, usuario, json:true}` no fio. Ele vira — e, desde a 5.6, `corpoDoPedido`
(`nuvem.ts:65`) **também** põe o `esquema` no corpo, como diagnóstico; nenhum adaptador o lê, e a
`ia-narrar` o ignora. Não há como pedir `json: true` sem declarar saída por esquema, então o corpo tem
quatro chaves em vez de três. O que a constraint protege está preservado e medido: `sistema` e
`usuario` byte a byte iguais aos de `montarPromptDeNome`, `json` em `true`, `PROMPT_NOME_VERSAO` em 2,
e nenhum `motor` (o padrão é o servidor escolhendo). Dois testes prendem isso —
`routes/descritor.test.ts` ("o corpo da ia-narrar é o de hoje") compara chave a chave, e
`mobile/src/lib/__tests__/route-name.test.ts` refaz a conferência do lado do hospedeiro.

**21/09 — `interpretarPorEsquema` ficou com um usuário, não dois.** A task previa que a sonda e o nome
de rota provassem juntos que o helper não é fachada. O nome de rota **não pode** usá-lo: `Esquema` não
tem `null` (ausência ali é propriedade opcional), e o prompt deste recurso manda o modelo responder
`null` no caso mais comum de todos — "Se as cidades não formarem uma região que você reconheça de
verdade, devolva `regiao`: null". Passar a resposta de hoje por `conformeAoEsquema` reprovaria a maioria
das pedaladas como `saida-invalida`, que é exatamente a regressão que a constraint "o nome gravado é o
mesmo" proíbe. A interpretação continua sendo `lerRespostaDoModelo` (pura, já reaproveitada como está),
e o impedimento virou teste: `routes/descritor.test.ts` afirma, sobre a mesma resposta, que
`conformeAoEsquema` a reprova e que a interpretação a aceita — para a troca quebrar no CI, e não sobre
as 138 pedaladas. O helper foi escrito e a sonda passou a usá-lo, com detalhe e comportamento idênticos;
a dívida está registrada em `deferred-work.md`.

**21/09 — a dep de gravação do hospedeiro chama-se `salvar`, não `gravar`.** A barreira "só a sequência
grava a edição" (`architecture.test.ts`) reprova **qualquer** leitura de um membro `.gravar` fora de
`ia/imprimir-sequencia.ts`, por AST. Um `deps.gravar` no serviço do nome de rota a derrubava, sem ter
nada a ver com `edicoes_ia`. Renomeado para `salvar`.

## Design Notes

**Por que `truncado` deixa de ser escrito.** Com a porta, o truncamento chega como
`saida-invalida` com `detalhe: 'motivo de parada: …'` (`nuvem.ts:142`) — a mesma classe do JSON ilegível.
Distinguir os dois exigiria farejar a string do detalhe. As escritas novas usam `ilegivel` e guardam o
motivo em `meta.detalhe`; o valor `'truncado'` continua no tipo porque linhas antigas o têm.

**Por que `sem-molde` vive na conferência.** `montarFrase` não pode desistir (devolve `string`). Então
`conferir` monta o nome e reprova com a regra `sem-molde` quando sai `null`; `montarFrase` refaz a
mesma conta, como o descritor da Saúde refaz o caso — nada de estado guardado entre as funções.

**Por que a nuvem pode ser padrão sem medição.** É o comportamento que já roda em produção desde antes
da porta existir; tirá-lo pararia de nomear pedaladas. A ADR 0050 não é afrouxada: nenhuma aprovação é
registrada, o par recurso × motor segue **não medido**, e isso está escrito aqui e na dívida.

## Verification

**Commands:**
- `pnpm --filter @vitale/shared lint` -- expected: tsc limpo
- `pnpm --filter @vitale/shared test` -- expected: verde, com as barreiras novas em zero
- `pnpm --filter @vitale/web build` -- expected: compila (o barril mudou)
- `pnpm --filter @vitale/scripts lint && pnpm --filter @vitale/scripts test` -- expected: verde
- `cd mobile && pnpm exec tsc --noEmit && pnpm exec jest` -- expected: verde
- `git grep -n "ia-narrar\|ChamadorDeModelo" -- mobile/src packages/shared/src` -- expected: só
  `mobile/src/lib/motores/`

**Manual checks (if no CLI):**
- No iPhone (build próprio, sem migração junto): abrir uma pedalada **sem nome** e ver o nome aparecer
  como antes; em Configurações → Motores, "Nome de rota" aparece com os motores escolhíveis.

## Suggested Review Order

**O recurso novo: o nome de rota vira descritor**

- O ponto de entrada: o caminho inteiro declarado como dado e funções puras.
  [`descritor.ts:117`](../../packages/shared/src/routes/descritor.ts#L117)

- `montarPedido` nulo na degenerada — rota de 0 km não custa um token.
  [`descritor.ts:125`](../../packages/shared/src/routes/descritor.ts#L125)

- `sem-molde` vive na conferência porque `montarFrase` não pode desistir.
  [`descritor.ts:153`](../../packages/shared/src/routes/descritor.ts#L153)

- O esquema declarado: diagnóstico na nuvem, geração guiada no aparelho.
  [`descritor.ts:84`](../../packages/shared/src/routes/descritor.ts#L84)

- Registrado no catálogo do núcleo — é daqui que o seletor o lista.
  [`recursos.ts:24`](../../packages/shared/src/ia/recursos.ts#L24)

**O que grava, e o que não grava**

- A tradução piso → recusa: quatro causas gravam, todas as outras voltam ao gatilho.
  [`nomear.ts:103`](../../packages/shared/src/routes/nomear.ts#L103)

- A regra do achado 1: sem tentativa assinada não é recusa, é soluço de rede.
  [`nomear.ts:150`](../../packages/shared/src/routes/nomear.ts#L150)

- A dívida paga: o piso permanente passa a carregar a tentativa recusada.
  [`orquestrar.ts:197`](../../packages/shared/src/ia/orquestrar.ts#L197)

- `recusaEResultado` deixa de ser campo decorativo e passa a decidir.
  [`orquestrar.ts:561`](../../packages/shared/src/ia/orquestrar.ts#L561)

- O conjunto das causas permanentes, explícito — `transitoria` e `defeito` fora.
  [`orquestrar.ts:537`](../../packages/shared/src/ia/orquestrar.ts#L537)

**O hospedeiro: o app pede pela porta**

- A fiação de produção: preferência, catálogo, motor, anel e a escrita.
  [`route-name.ts:96`](../../mobile/src/services/route-name.ts#L96)

- O gatilho segue um por pedalada; preferência ilegível aborta a tentativa.
  [`route-name.ts:121`](../../mobile/src/services/route-name.ts#L121)

- O recurso deixa de ser bloqueado no seletor.
  [`catalogo.ts:458`](../../mobile/src/lib/motores/catalogo.ts#L458)

**A costura legada morre, e as catracas viram barreira**

- `interpretarPorEsquema` nasce onde `ChamadorDeModelo` morreu.
  [`motor.ts:348`](../../packages/shared/src/ia/motor.ts#L348)

- `'STOP'` agora só na constante — inclusive um segundo literal no próprio dono.
  [`architecture.test.ts:2990`](../../packages/shared/src/architecture.test.ts#L2990)

- A function e a ponte só no ponto de injeção, com os três padrões provados.
  [`architecture.test.ts:3128`](../../packages/shared/src/architecture.test.ts#L3128)

**Testes e periféricos**

- O corpo que chega à `ia-narrar` comparado chave a chave com o de hoje.
  [`descritor.test.ts:70`](../../packages/shared/src/routes/descritor.test.ts#L70)

- A fiação sem `deps` injetadas — o teste que a mutação de argumentos derruba.
  [`route-name.test.ts:404`](../../mobile/src/lib/__tests__/route-name.test.ts#L404)

- A sequência antiga reescrita para atravessar o orquestrador.
  [`nomear.test.ts:1`](../../packages/shared/src/routes/nomear.test.ts#L1)

- As emendas: o que valia, o que mudou e desde quando.
  [`0042:1`](../../docs/decisions/0042-o-passe-de-nome-roda-no-aparelho.md#L1)
