---
title: 'Story 5.1 — A porta, o fio e o orquestrador (F0)'
type: 'feature'
created: '2026-09-10'
status: 'done'
review_loop_iteration: 0
baseline_commit: '2e276ea5d8f5079d63bf2301583dcb90b89b7515'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-Orbe-ia-no-aparelho-2026-09-10/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** O Orbe fala com modelo por uma costura de um recurso só (`ChamadorDeModelo`, do nome de
rota), e cada inquilino percorre pedido → modelo → conferência por conta própria: o app já tem duas
cópias do cliente da `ia-narrar`, e a story 1.10 escreveria uma segunda sequência em `ia/`. A Saúde do
sono seria a terceira.

**Approach:** Criar no núcleo, sem deploy e sem tela, a porta única `Motor`, o fio da nuvem sem
imports, o orquestrador único que percorre a cadeia pelas classes de falha do Orbe, o motor de nuvem
único — que lê a `ia-narrar` de hoje — e o catálogo de recursos, com as guardas que já têm alvo. É do
que a 1.10, a 5.3 e a 5.4 dependem.

## Boundaries & Constraints

**Always:**
- Tudo novo mora em `packages/shared/src/ia/` e é puro: só import relativo, sem `fetch`, sem ambiente,
  sem nome de fornecedor — nem em literal de string.
- `Motor` nunca rejeita: falha é valor, com classe. Nenhuma decisão lê `detalhe`.
- `ia/fio.ts` e `ia/sha256.ts` não importam nada.
- Guarda nova roda offline e entra no mesmo commit do código que cobra; a que tem passivo nasce
  catraca, no número medido.
- Os testes que já existem no shared passam sem edição.

**Ask First:**
- Guarda que precise nascer com número diferente do medido (`'ia-narrar'` 2, `'STOP'` 2, guarda (7)
  1), ou catraca onde este spec diz barreira.
- Tocar qualquer arquivo de `mobile/`, `web/` ou `supabase/`.
- Mudar o comportamento de `nomearRota` ou de `ia/pacote.ts`, `ia/prompt.ts`, `ia/verificar.ts`.

**Never:**
- Mudar ou deployar a `ia-narrar` — ela aprende o fio na 5.6.
- Descritor de recurso real (é a 5.2 e a 5.3), `VOCABULARIO_PROIBIDO`, `format/numero.ts`,
  `ia/interpolar.ts`.
- Dependência nova em `package.json`. Retry automático de `transitoria`.

## I/O & Edge-Case Matrix

| Cenário | Entrada / estado | Esperado | Falha |
|---|---|---|---|
| Resposta boa | cadeia [nuvem:padrao, sem-modelo]; texto passa na conferência | `origem:'motor'`, frase de `montarFrase`, assinatura com `versaoDoDescritor` e `instante`, trilha com 1 | — |
| Pedido mudo | `montarPedido` → null | nenhuma chamada | piso, causa `mudo` |
| Só template | cadeia ['sem-modelo'] | nenhuma chamada | piso, causa `preferencia` |
| Motor ausente | `motorPara(id)` → undefined | tentativa sintética `indisponivel`, recua | — |
| Recua | 1º `indisponivel`/`capacidade`, 2º responde | `origem:'motor'` pelo 2º; trilha com 2 | — |
| Esgotada | todos os motores recuam | trilha com todos | piso, causa = classe do último |
| Janela | `janela`, com `pedidoCurto` | repete 1× no mesmo motor com o pedido curto | 2ª `janela` ou sem pedido curto → piso, causa `janela` |
| Permanente | `guarda`/`recusa-do-modelo`/`saida-invalida` | não repete nem recua | piso com a causa; anel recebe o pedido |
| Reprovada | conferência reprova | problemas na trilha | piso, causa `reprovada`; anel recebe o pedido |
| Recusa em texto | conferência marca `recusa` | problemas na trilha | piso, causa `recusa-do-modelo` |
| Passageira | `transitoria` | não repete | piso, causa `transitoria` |
| Defeito | o motor lança | anel recebe a pilha e o pedido | piso, causa `defeito` — nunca `transitoria` |
| Medição | `modo:'medicao'`, um `MotorId` | roda só ele, sem recuo nem piso; devolve a tentativa com a classe e, se passou, a frase; `sem-modelo` devolve o template | — |

</frozen-after-approval>

## Code Map

- `packages/shared/src/routes/nomear.ts:27-36` -- `RespostaDoModelo` e `ChamadorDeModelo` se mudam para `ia/motor.ts`, estruturais (`PromptDeNome` é `{sistema, usuario, json?}`, `routes/prompt.ts:31-39`); se ficarem declarados nos dois, o `export *` do barril (`index.ts:127`) quebra por nome duplicado.
- `packages/shared/src/routes/nomear.ts:98-116` -- o molde que o orquestrador generaliza (recusa como valor, `agora` injetado). O `'STOP'` de `:107` fica: é catraca e morre na 5.7.
- `packages/shared/src/ia/verificar.ts:32-40` -- `Problema {regra, detalhe}` e `Veredito`: a forma que `ProblemaDaConferencia` generaliza.
- `packages/shared/src/index.ts:27-29` -- onde entram os `export *` de `fio`, `motor`, `orquestrar`, `nuvem`, `recursos` (o `sha256` fica interno).
- `supabase/functions/ia-narrar/index.ts:42-83` -- o que a function devolve hoje: 405; 400 `json_invalido`/`prompt_vazio`; 413; 503 `provedor_nao_configurado`; 502 `narracao_falhou`; 200 `{texto, provedor, modelo, tokens, motivoDeParada, uso}`. O gateway devolve 401 sem JWT (`config.toml:30-31`). Só leitura.
- `@supabase/functions-js` `FunctionsClient.js:266-297` -- não-2xx vira `FunctionsHttpError` antes de ler o corpo (legível só em `error.context`): é por isso que o transporte chega ao núcleo já normalizado.
- `packages/shared/src/architecture.test.ts` -- `check` `:30-34`; `walk` `:38-52` (não exclui `.test.ts`); `webFiles`/`mobileFiles` `:54-55`; idioma da catraca `:670-744` (teto `max` com o histórico em comentário; queda só loga); barreira de IA `:746-806` (`dirs=['ia','routes']`, `PROIBIDO` `:773-780`); CHECK lido da última migration `:276-324` (a regex só lê `in (...)`); Deno sem imports `:155-193` (acha alvos varrendo `supabase/functions`, e `ia-narrar` ainda não importa nada do núcleo); `semComentario` duplicado em `:461` e `:788`.
- `supabase/migrations/20260906150000_edicoes_ia.sql:36` -- `check (motivo_de_parada = 'STOP')`: a forma `=` que a guarda (6) precisa ler.
- `packages/shared/src/ia/verificar.test.ts:1-2` -- estilo: `node:test` + `node:assert/strict`, um arquivo por `tsx`.
- Medido no planejamento: o fecho de `ia/` + `routes/` + dependências (55 arquivos, 17 diretórios) tem **zero** ofensor com a lista de fornecedores ampliada; nenhum nome novo colide no barril.

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/ia/fio.ts` -- sem imports: `CLASSES_DE_FALHA`; gramática de `MotorId` (`lerMotorId`, `formatarMotorId`, `SEM_MODELO`, `APARELHO_SISTEMA`, `NUVEM_PADRAO`); `Esquema`, `validarEsquema`, `conformeAoEsquema`; corpos do pedido, da resposta e da falha; `STATUS_POR_CLASSE` -- AD-4, AD-8, AD-14
- [x] `packages/shared/src/ia/sha256.ts` -- SHA-256 puro, sem imports -- `hashDoPedido` sem `node:crypto`, que a barreira proíbe
- [x] `packages/shared/src/ia/motor.ts` -- `Pedido`, `Resposta`, `Falha`, `Motor`, `ehFalha`, `CONCLUSAO` (`'STOP'`), exposição, `Cadeia` marcada e `resolverCadeia`, `serializarPedido`, `hashDoPedido`; `ChamadorDeModelo`, `RespostaDoModelo` e `PromptLegado`, marcados para morrer na 5.7 -- AD-1, AD-5, AD-11, AD-12
- [x] `packages/shared/src/ia/orquestrar.ts` -- `Descritor`, `ler` nos modos `produto` e `medicao`, resultados discriminados, trilha com `ms` por tentativa, evento do anel -- AD-2, AD-4, AD-12
- [x] `packages/shared/src/ia/nuvem.ts` -- `criarMotorDeNuvem(invocar)` e a tabela de tradução -- AD-14
- [x] `packages/shared/src/ia/recursos.ts` -- `RECURSOS`/`RecursoId` (`retrospectiva`, `saude-do-sono`, `nome-de-rota`), `CATALOGO_DE_RECURSOS` vazio, `validarDescritor` -- AD-2
- [x] `packages/shared/src/routes/nomear.ts` + `packages/shared/src/index.ts` -- os dois tipos passam a vir de `ia/motor`; o barril exporta os módulos novos
- [x] `packages/shared/src/ia/{fio,sha256,motor,orquestrar,nuvem,recursos}.test.ts` -- a matriz inteira com motores falsos; propriedade exaustiva da AD-5; vetores do SHA-256 conferidos contra `node:crypto`
- [x] `packages/shared/src/architecture.test.ts` -- guardas (1), (2), (6), (7); `fio.ts` e `sha256.ts` sem imports; `Motor` não se reexporta com outro nome; `semComentario` sobe para o topo

**Acceptance Criteria:**
- Given qualquer preferência (legível, ilegível, desconhecida do catálogo, acima do `regimeMaximo`, ausente) × padrão × catálogo, when `resolverCadeia` roda, then a cadeia termina em `sem-modelo` uma vez, a exposição não cresce ao longo dela nem passa da preferência gravada ou do `regimeMaximo`, a nuvem tem um destinatário só, preferência ilegível dá só `sem-modelo`, e preferência legível e conhecida é o primeiro elo.
- Given o transporte devolve cada status da tabela, falta de rede, 2xx com `motivoDeParada` ≠ `CONCLUSAO`, 2xx sem texto ou 2xx ilegível, when `criarMotorDeNuvem` traduz, then cada caso vira a classe da tabela, status fora dela vira `transitoria` com `naoMapeado`, e um corpo com `classe` válida vence o status.
- Given a guarda (2), when ela roda, then o alvo é o fecho por import relativo de quem importa `ia/motor`, mais `ia/` e `routes/`; ele contém `ia/motor.ts` (não vácua); e a lista proibida ganha `coreai|qwen|llama|mlx|gemma|foundationmodels|privatecloudcompute`, sem `apple`.
- Given a guarda (6), when ela roda, then `CONCLUSAO` é igual ao `CHECK` de `edicoes_ia.motivo_de_parada` na última migration que o define, lendo `=` e `in (...)`; e `'STOP'` fora de teste e da definição de `CONCLUSAO` é catraca em 2.
- Given as guardas (1) e (7), when rodam, then `'ia-narrar'` e import de `on-device-engine` fora de `mobile/src/lib/motores/`, `web/src/app/core/motores/` e `scripts/<script>/motores.ts` são catraca em 2; e import **de valor** de `ia/` — fora da porta (`fio`, `motor`, `orquestrar`, `nuvem`, `recursos`) e de nomes `descritor*` — em `mobile/src` e `web/src` é catraca em 1.
- Given o diff, when o portão roda, then nada em `mobile/`, `web/` ou `supabase/` mudou, e o `tsc` do mobile e o build do web seguem verdes com o barril novo.

## Spec Change Log

## Design Notes

A forma dos tipos, não o código final:

```ts
type Pedido = { sistema: string; usuario: string; amostragem: 'gulosa' | 'padrao' } & (
  | { saida: { tipo: 'texto' }; guardrails: 'padrao' | 'permissivo' }
  | { saida: { tipo: 'esquema'; esquema: Esquema }; guardrails: 'padrao' });  // o par inválido não compila
type Falha = { classe: ClasseDeFalha; detalhe?: string; naoMapeado?: true };
type Conferencia = { ok: true } | { ok: false; problemas: readonly ProblemaDaConferencia[]; recusa?: true };
type Causa = ClasseDeFalha | 'reprovada' | 'defeito' | 'mudo' | 'preferencia';
type Piso = { frase: string } | { ausencia: string };   // ausência com motivo é piso válido
// Descritor<F, V>: recurso, versao, regimeDeNumeros, regimeMaximo, cadeiaPadrao, grava,
//   montarPedido(f), pedidoCurto?(f), interpretar(resposta): V | Falha, conferir(v, f), montarFrase(v, f), semModelo(f)
// ler(d, f, { modo: 'produto', cadeia, motorPara, registrar, agora }) · ler(d, f, { modo: 'medicao', motor, … })
```

**`MotorId`:** `sem-modelo` · `aparelho:sistema` · `aparelho:<provedor>/<pesos>` · `nuvem:padrao` ·
`nuvem:<provedor>/<modelo>`. O tipo vai até o primeiro `:`, o provedor até o primeiro `/`, e o resto é
literal. Exposição: sem-modelo < aparelho < nuvem; na nuvem, o destinatário é o provedor, e `padrao` é
destinatário próprio. Id desconhecido do catálogo degrada para o padrão filtrado à exposição dele.

**`Esquema`** é um subconjunto das palavras do JSON Schema — `object` (`properties`, `required`),
`string` (`enum`), `integer` (`minimum`, `maximum`), `boolean`, `array` (`items`, `minItems`,
`maxItems`) —, sem `null`, `$ref`, `oneOf` nem `format`, e chave desconhecida reprova. É a língua que
os dois tradutores (Gemini e `DynamicGenerationSchema`) já falam.

**O transporte** chega normalizado: `type Transporte = (corpo: CorpoDoPedido) => Promise<{ status:
number; corpo: unknown } | { semRede: true; detalhe?: string }>`. O corpo que a 5.1 manda é o que a
function lê hoje — `{ sistema, usuario, json }`, com `json` derivado de `saida.tipo === 'esquema'` —;
`motor` e `esquema` entram no corpo na 5.6. A assinatura da nuvem é `{ tipo: 'nuvem', provedor,
modelo }` como a function os reportou; `instante` e `versaoDoDescritor` são carimbados pelo
orquestrador, com o `agora` injetado.

**A tabela da nuvem.** Os status de hoje e os fixados por classe coincidem onde se tocam, então ler só
o status já dá a classe segura:

| status | classe | status | classe |
|---|---|---|---|
| 503, sem rede, 401, 403 | `indisponivel` | 413 | `janela` |
| 502, 429, 504 | `transitoria` | 400, 422 | `capacidade` |

`STATUS_POR_CLASSE`, o que a function passa a emitir na 5.6: indisponivel 503; capacidade, guarda e
recusa-do-modelo 422; janela 413; saida-invalida e transitoria 502. O corpo leva a classe, e é ela que
decide.

**Lacuna da espinha, fechada aqui:** a exceção que escapa de um motor precisava de uma causa. É
`defeito`, que nunca grava — e a 1.11 a mostra como *erro*.

**A guarda (7) conta só import de valor** (ignora `import type` e `type X`): tipo não sequencia nada,
e contá-lo faria a catraca nascer em 3 e não virar barreira na 1.10. `routes/` fica fora até a 5.7,
porque `nomeDaAtividade` e `nomeProprio` são exibição, usados em seis telas.

**O catálogo nasce vazio:** a 5.2 registra a retrospectiva e a 5.3 a Saúde; `validarDescritor` é
provado com descritores falsos. **O anel** recebe uma chamada por execução, com a trilha; o pedido vai
junto só se houve falha permanente, reprovação, defeito ou erro não mapeado. Exceção dentro de
`registrar` é engolida — o anel não derruba uma leitura. Já exceção de função do **descritor** não é
engolida: é bug de código puro, e tem de aparecer no teste, não virar piso.

## Verification

**Commands:**
- `pnpm --filter @vitale/shared lint` -- exit 0
- `pnpm --filter @vitale/shared test` -- exit 0; as guardas novas aparecem como `ok`, e as catracas logam o teto
- `cd mobile && pnpm exec tsc --noEmit` -- exit 0 (o barril mudou; o app não)
- `pnpm --filter @vitale/web build` -- exit 0
- `git diff --stat main -- mobile web supabase` -- vazio

## Suggested Review Order

**A porta e o caminho**

- Comece aqui: o orquestrador único, nos modos produto e medição.
  [`orquestrar.ts:660`](../../packages/shared/src/ia/orquestrar.ts#L660)

- O percurso do produto: recuo pela classe, piso, e o anel antes de subir exceção.
  [`orquestrar.ts:521`](../../packages/shared/src/ia/orquestrar.ts#L521)

- O que cada recurso declara: piso obrigatório, regime de números, teto de exposição.
  [`orquestrar.ts:107`](../../packages/shared/src/ia/orquestrar.ts#L107)

- A porta: nunca rejeita; falha é valor, com classe.
  [`motor.ts:106`](../../packages/shared/src/ia/motor.ts#L106)

**Para onde o dado pode ir (AD-5)**

- A cadeia: a exposição não cresce, um destinatário de nuvem, fecha em sem-modelo.
  [`motor.ts:222`](../../packages/shared/src/ia/motor.ts#L222)

- Assinatura de outro tipo que o id pedido é defeito: a AD-5 vira mecânica.
  [`orquestrar.ts:310`](../../packages/shared/src/ia/orquestrar.ts#L310)

- A medição respeita o `regimeMaximo`: nem a bancada manda dado acima do teto.
  [`orquestrar.ts:608`](../../packages/shared/src/ia/orquestrar.ts#L608)

**Falha e diagnóstico (AD-4, AD-12)**

- A janela que esgota é permanente, e o pedido — que é a prova — vai ao anel.
  [`orquestrar.ts:289`](../../packages/shared/src/ia/orquestrar.ts#L289)

- O evento do anel: hash da execução e hash do pedido anexado andam juntos.
  [`orquestrar.ts:209`](../../packages/shared/src/ia/orquestrar.ts#L209)

- Exceção do descritor sobe, mas o anel sabe antes — é o único diagnóstico em produção.
  [`orquestrar.ts:503`](../../packages/shared/src/ia/orquestrar.ts#L503)

**O fio da nuvem (AD-14)**

- A tradução lê a `ia-narrar` de hoje e a classe que ela aprende na 5.6.
  [`nuvem.ts:100`](../../packages/shared/src/ia/nuvem.ts#L100)

- Os status de hoje e os fixados por classe coincidem onde se tocam.
  [`nuvem.ts:39`](../../packages/shared/src/ia/nuvem.ts#L39)

- O único motor de nuvem; o hospedeiro só injeta o transporte.
  [`nuvem.ts:149`](../../packages/shared/src/ia/nuvem.ts#L149)

- As sete classes, sem imports — o Deno lê este arquivo na 5.6.
  [`fio.ts:44`](../../packages/shared/src/ia/fio.ts#L44)

- O status que a function passa a emitir por classe.
  [`fio.ts:377`](../../packages/shared/src/ia/fio.ts#L377)

- A gramática do `MotorId`; palavra reservada vale em qualquer caixa.
  [`fio.ts:120`](../../packages/shared/src/ia/fio.ts#L120)

- O subconjunto fechado do JSON Schema que um pedido pode exigir.
  [`fio.ts:170`](../../packages/shared/src/ia/fio.ts#L170)

**Identidade e catálogo**

- Pedido idêntico é mesmo hash: JSON canônico com a versão do descritor.
  [`motor.ts:262`](../../packages/shared/src/ia/motor.ts#L262)

- SHA-256 puro, porque `node:crypto` é import de pacote e a barreira o recusa.
  [`sha256.ts:65`](../../packages/shared/src/ia/sha256.ts#L65)

- A grafia da conclusão, com dono único — é ela que o CHECK do banco espelha.
  [`motor.ts:124`](../../packages/shared/src/ia/motor.ts#L124)

- O catálogo nasce vazio; a 5.2 e a 5.3 registram os primeiros descritores.
  [`recursos.ts:18`](../../packages/shared/src/ia/recursos.ts#L18)

- A validação que todo descritor registrado passa.
  [`recursos.ts:32`](../../packages/shared/src/ia/recursos.ts#L32)

- A costura antiga mora aqui até a 5.7 — um lugar só a apagar.
  [`motor.ts:300`](../../packages/shared/src/ia/motor.ts#L300)

- O nome de rota passa a tirar os tipos da porta, sem mudar comportamento.
  [`nomear.ts:20`](../../packages/shared/src/routes/nomear.ts#L20)

**As guardas**

- O alvo sai do código: fecho por import, e não pode voltar às sementes.
  [`architecture.test.ts:831`](../../packages/shared/src/architecture.test.ts#L831)

- CONCLUSAO igual ao CHECK, nunca comparada contra uma migration velha.
  [`architecture.test.ts:1011`](../../packages/shared/src/architecture.test.ts#L1011)

- Catraca do `'STOP'`: 2 hoje, 1 na 1.10, 0 na 5.7.
  [`architecture.test.ts:1089`](../../packages/shared/src/architecture.test.ts#L1089)

- Catraca da `ia-narrar` e da ponte, inclusive por URL e por nome nativo.
  [`architecture.test.ts:1143`](../../packages/shared/src/architecture.test.ts#L1143)

- Catraca das peças de `ia/` nos apps: 1 hoje, barreira na 1.10.
  [`architecture.test.ts:1184`](../../packages/shared/src/architecture.test.ts#L1184)

- O fio e o hash sem imports; `Motor` sem apelido, nem em dois passos.
  [`architecture.test.ts:931`](../../packages/shared/src/architecture.test.ts#L931)

**Periféricos**

- A matriz inteira do orquestrador, com motores falsos e relógio injetado.
  [`orquestrar.test.ts:179`](../../packages/shared/src/ia/orquestrar.test.ts#L179)

- A propriedade exaustiva da AD-5 sobre preferência × padrão × catálogo.
  [`motor.test.ts:135`](../../packages/shared/src/ia/motor.test.ts#L135)

- A tabela da nuvem, incluindo cada resposta que a function manda hoje.
  [`nuvem.test.ts:59`](../../packages/shared/src/ia/nuvem.test.ts#L59)

- O barril exporta os cinco módulos da porta; o SHA-256 fica interno.
  [`index.ts:32`](../../packages/shared/src/index.ts#L32)
