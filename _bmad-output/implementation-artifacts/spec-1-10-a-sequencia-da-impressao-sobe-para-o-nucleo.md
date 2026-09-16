---
title: 'Story 1.10 — A sequência da impressão sobe para o núcleo, como cliente do orquestrador'
type: 'feature'
created: '2026-09-16'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'ce9cd2f0dbfb6df5f8746745f538b2fd9d8fd0fe'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/contrato-motores-para-1-10.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Desde a 1.9 o celular não escreve edição. `edicao_imprimir` grava o texto que receber, sem conferência nenhuma, e ela recebe `agg_version_no_momento` na carga. Enquanto ninguém escrevia, isso não pesava. Pesa a partir do momento em que a escrita voltar: "verifica antes de gravar" (NFR19) hoje é só comentário, e nada impede gravar caderno a caderno em laço.

**Approach:** A sequência passa a morar em `ia/imprimir.ts`. Ela chama `ler(descritorDaRetrospectiva, …)` uma vez por caderno e grava o **conjunto** numa chamada só, pela porta `gravar`. Cada hospedeiro injeta as portas `buscar` e `gravar`, e só leitura de motor vira linha. O iPhone liga as portas ao client dele e volta a ter o botão **mínimo** "Escrever a edição" no cartão atual. Barreiras passam a cobrar três coisas: só a sequência grava, a versão da agregação não vem de fora do núcleo, e o núcleo de IA só se importa pela porta.

## Boundaries & Constraints

**Always:**
- A sequência nunca recebe `SupabaseClient` nem chama `Motor`. Ela recebe `buscar`, `gravar`, `cadeia`, `motorPara`, `registrar` e `agora`, e só percorre a cadeia pelo `ler`, em modo `produto`.
- **Mostrar é progressivo, gravar é atômico.** Cada caderno avisa o hospedeiro quando termina, e `gravar` roda **no máximo uma vez** por impressão, com `ordem` e `linhas` do conjunto inteiro.
- Linha só nasce de `LeituraDoMotor`. Piso é ausência, e recusa não é resultado. O motivo de parada gravado é `CONCLUSAO`. Prompt e pacote saem de `versaoDoDescritor`, decodificados no núcleo. `metrica_lider` é `liderDoCaderno(pacote)?.chave ?? null`.
- `agg_version_no_momento` é carimbada por `data/edicoes-ia.ts` a partir de `AGG_VERSION`. O campo não existe no tipo da porta.
- A ordem é `ordenarCadernos` sobre os pacotes do momento, aplicada ao conjunto que a edição passa a ter, e as posições são contíguas pela função do banco.
- **Imprimir nunca apaga texto publicado por falha de motor.** Caderno já impresso que cai no piso continua na ordem e fica sem linha nova. Só sai da ordem o caderno **pedido** que ficou vazio, e só quando há gravação.
- `coberturaSono` é derivada de `resumo.sleep` (`cur.nights` e `prev?.nights ?? 0`) quando a entrada não a traz, e nunca quando `resumo.sleep` é nulo.
- Resposta sem tokens não grava, porque zero é medida e não se inventa.
- `HOSPEDAGEM.retrospectiva` passa a ser `{ hospedado: true }`.
- Toda barreira nova tem asserção de não-vacuidade e caso-espelho que prova que ela reprova.

**Ask First:**
- Por onde o JS chega ao iPhone: build ou `eas update`. O canal `preview` está em `rollBackToEmbedded`.
- Mudar a conferência, o prompt, `PROMPT_VERSAO` ou `PACOTE_VERSAO`.
- Qualquer escrita em produção fora do toque do dono no aparelho.

**Never:**
- Chamar `gravar` dentro do laço por caderno, ou em mais de um lugar.
- Reimpressão na tela, os sete estados, a rota da revista ou a capa (1.11–1.13). O botão só existe em `nao-escrita`.
- Mudar a conferência (manchete com base, Markdown, recusa disfarçada, "levou a") ou construir detector de lápide.
- Migração nova, ou `upsertEdicao` sobrevivendo como porta de escrita.

## I/O & Edge-Case Matrix

| Cenário | Entrada / Estado | Esperado | Erro |
|---|---|---|---|
| Primeira impressão | 3 cadernos com dado e nuvem aprovando | `buscar` 1×, `ler` 3× na ordem do ranqueamento, `gravar` 1× com `ordem` de 3 e 3 linhas → `gravada` | N/A |
| Um cai no piso | Sono `reprovada` ou `transitoria` | `gravar` 1× só com os 2 que escreveram, ordem contígua; o desfecho de Sono traz causa e trilha | N/A |
| Caderno vazio ou mudo | Rotina vazia, ou `montarPedido` nulo | nenhuma chamada paga, e fora da ordem | N/A |
| Período aberto ou Total | `periodo.fechado` falso | `aberto`, sem `buscar` e sem motor | N/A |
| Ninguém escreve | todos no piso, inclusive preferência `sem-modelo` | `nada-gravado`, `gravar` não é chamado | N/A |
| Já impresso e cai no piso | linha de Sono existe, e a regeneração dá `transitoria` | Sono fica na `ordem`, sem linha nova | N/A |
| Reimpressão parcial | `cadernos: ['rotina']` com 3 impressos | só Rotina é chamada; a ordem é recalculada sobre todos os que ficam; 1 linha | N/A |
| Pedido que ficou vazio | Coração impresso e agora vazio, com gravação | Coração sai da `ordem` (a função o apaga) | N/A |
| Sem tokens | leitura de motor sem `tokens` | desfecho `incompleto`, não grava | N/A |
| Porta falha | `buscar` ou `gravar` lança | — | `buscar`: rejeita antes de qualquer chamada paga. `gravar`: rejeita, e o texto mostrado se perde (declarado) |
| Aviso lança | `aoLer` lança | a impressão segue | engolido |

</frozen-after-approval>

## Code Map

- `packages/shared/src/ia/orquestrar.ts:124-146,173-191,719-727` -- `Descritor`, `LeituraDoMotor`/`LeituraDoPiso`, `ler`. Não muda
- `packages/shared/src/ia/retrospectiva.ts:36-86` -- o descritor; `VERSAO = PROMPT_VERSAO*1000 + PACOTE_VERSAO` só se decodifica no teste
- `packages/shared/src/ia/motor.ts:125,263` -- `CONCLUSAO`, `resolverCadeia`
- `packages/shared/src/ia/ranqueamento.ts:148,207` -- `liderDoCaderno`, `ordenarCadernos` (fora do barril, de propósito)
- `packages/shared/src/ia/pacote.ts:385-403,709-746,780,856,1076` -- `diaLocal`/`periodoFechado` (mudam de pasta), `EntradaPacote.coberturaSono`, `montarPacotes`, a cobertura do Sono, `cadernoVazio`
- `packages/shared/src/sleep/retro.ts:105-106,248-251` -- `SleepSide.nights`, `SleepRetro.cur/prev`
- `packages/shared/src/data/edicoes-ia.ts:148-205,207-286` -- `toCadernoImpresso`/`fetchEdicao` ficam; `EdicaoInput`/`upsertEdicao` saem
- `supabase/migrations/20260912120000_edicao_por_caderno.sql:191,347-352,374` -- assinatura de `edicao_imprimir` (`p_tipo_periodo, p_inicio, p_fim, p_ordem, p_linhas`), colunas do recordset (a carga tem de bater), chave `metrica_lider` obrigatória
- `packages/shared/src/architecture.test.ts:1631-1725` -- catracas de `'STOP'` e `'ia-narrar'`, que **ficam em 1**; `:1773-1964` guarda (7), teto 1 → barreira (0); `:2010-2100` `chamamMetodo`/`provarODetector` (AST), a reusar para `.gravar`; `:282` docblock que cita `upsertEdicao`
- `mobile/src/lib/motores/{index.ts:211,anel.ts:51,preferencia.ts:70,catalogo.ts:81,136-146}` -- `motorPara`, `anel`, `lerPreferencia`, `idsConhecidos`, `HOSPEDAGEM`
- `mobile/src/lib/leitura-da-saude.ts:90-120,160-170` -- molde de hospedeiro com deps injetáveis
- `mobile/src/lib/assinatura.ts:143` -- `motivoDaFalha(causa, motor)`, o motivo em palavras (`preferencia` devolve nulo)
- `mobile/src/lib/edicao-ia.ts:54-62` · `store/edicao.store.ts:26-52,156-190` · `components/EdicaoCard.tsx:136-143` (a frase provisória) · `app/retrospectiva/index.tsx:285-325,413`
- `git show 9f4f18d:mobile/src/components/EdicaoCard.tsx` -- o botão de antes da 1.9: rótulo, ícone `create-outline`, estilo
- Testes-molde: `ia/retrospectiva.test.ts:23-115`, `ia/ranqueamento.test.ts:67-124,203`, `data/edicoes-ia.test.ts`, `mobile/src/lib/__tests__/{edicao-ia,motores-catalogo}.test.ts`, `mobile/src/store/__tests__/edicao-store.test.ts`

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/period/fechado.ts` (novo) + `ia/pacote.ts` + `index.ts` -- `periodoFechado` e `diaLocal` saem de `ia/`, sem reexport por `ia/pacote`, e os testes passam a importar do lugar novo -- é o último import de peça no app; a guarda (7) zera
- [x] `packages/shared/src/ia/retrospectiva.ts` -- exportar `versoesDaRetrospectiva(v) → { prompt, pacote }`, com teste de ida e volta -- a assinatura vira colunas no núcleo
- [x] `packages/shared/src/ia/imprimir.ts` (novo) + `index.ts` -- `imprimir(entrada, portas, opcoes)`: monta os pacotes com a cobertura, sai `aberto` se não fechou, ranqueia, `buscar`, chama `ler` em sequência sobre os pedidos com dado (`aoComecar`/`aoLer` protegidos), monta a `ordem` e as linhas, e faz `gravar` só se houver linha. `descritor` injetável para teste -- a sequência única
- [x] `packages/shared/src/ia/imprimir.test.ts` -- a matriz inteira, com motores, `buscar` e `gravar` falsos, sem rede. Inclui caso que **reprova se `gravar` for chamada mais de uma vez** e caso de texto reprovado que não chega a `gravar`
- [x] `packages/shared/src/data/edicoes-ia.ts` + teste -- tirar `upsertEdicao`/`EdicaoInput` e criar `portasDaEdicao(db, userId)`: `buscar` sobre `fetchEdicao`, e `gravar` por `db.rpc('edicao_imprimir')` carimbando `AGG_VERSION` e mapeando as linhas devolvidas. O teste confere as chaves da carga contra as colunas do recordset lidas da migração
- [x] `packages/shared/src/architecture.test.ts` -- (a) guarda (7) em teto 0, com `imprimir` na porta; (b) BARREIRA: `edicao_imprimir` só em `data/edicoes-ia.ts`, nenhum `.upsert/.insert/.update/.delete` em `edicoes_ia`, e `.gravar` lido (AST) só em `ia/imprimir.ts`, entre núcleo e hospedeiros; (c) BARREIRA: literal `agg_version_no_momento` em código TS só em `packages/shared/src/data/`. As três com não-vacuidade e caso-espelho, e históricos e docblocks atualizados
- [x] `mobile/src/lib/motores/catalogo.ts` + `motores-catalogo.test.ts` -- a retrospectiva passa a ser hospedada
- [x] `mobile/src/lib/edicao-ia.ts` + teste -- `buscarEdicao` importa `periodoFechado` do lugar novo. `imprimirEdicao(userId, entrada, avisos, deps?)` resolve a cadeia pela preferência e liga `portasDaEdicao(supabase, uid)`, `motorPara`, `anel.registrar` e o relógio. `naoImpressoDe(desfecho)` dá o motivo em palavras, com até 3 problemas da conferência e frase própria para `preferencia` e `incompleto`
- [x] `mobile/src/store/edicao.store.ts` + teste -- nova fase `imprimindo` com a lista por caderno (`na-fila`/`escrevendo`/`escrito` com texto/`nao-escrito` com motivo). A ação `imprimir` só age a partir de `nao-escrita` e ignora o segundo toque. `gravada` vira `pronta` (com os não impressos), `nada-gravado` volta a `nao-escrita` com os motivos, `sem-caderno` vira `nao-escrita` com o aviso "nenhum caderno deste período tem o que dizer" e sem botão, `aberto` vira `ausente`, e exceção de porta vira `erro`
- [x] `mobile/src/components/EdicaoCard.tsx` + `app/retrospectiva/index.tsx` -- a frase provisória sai. `nao-escrita` ganha o botão "Escrever a edição" e mostra os motivos da última tentativa. `imprimindo` desenha caderno a caderno, e `pronta` lista embaixo os que não saíram. Nenhum hex, e os docblocks param de dizer que a escrita está parada
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` -- `resolucao:` nas entradas fechadas (verifica antes de gravar, AGG no RPC, frase provisória, `upsertEdicao` direto, `coberturaSono`, normalizador do `invocar`) e uma entrada nova: `montarPromptDaEdicao` segue sem chamador (o descritor é por caderno), vivo só como oráculo de teste

**Acceptance Criteria:**
- Given a sequência com portas e motores falsos, when roda do começo ao fim, then montar → orquestrar → conferir → gravar é exercitado sem rede, e há caso em que um caderno cai no piso e os outros gravam.
- Given uma segunda chamada de `gravar`, ou um `.gravar` fora de `ia/imprimir.ts`, when as suítes rodam, then um teste reprova — e as barreiras provam que veem (caso-espelho).
- Given o app, when um arquivo de `mobile/src` importa peça do núcleo de IA que não seja porta ou descritor, then a guarda (7) reprova com teto 0.
- Given agosto/2026 fechado e não escrito no iPhone, when o dono toca "Escrever a edição", then os cadernos aparecem um a um, a edição relida sai na ordem de `posicao` com assinatura por caderno, e a frase "A impressão está parada…" não existe mais em lugar nenhum.

## Design Notes

**Por que `buscar` é necessário numa sequência que só imprime.** Sem ele, a `ordem` sairia só dos cadernos que escreveram. Aí um caderno já impresso que caísse em `transitoria` seria **apagado** pela função, e uma falha passageira viraria perda permanente, contra a AD-12.

**Por que a barreira mede `.gravar` e não o import.** A AC do épico manda restringir quem importa `upsertEdicao` a "a sequência ou `data/`". Só que a sequência não pode importar `data/`: o fecho do núcleo de IA recusa o pacote do SDK. A escrita vira porta devolvida por `portasDaEdicao`. Quem lê `.gravar` é quem grava, e a AST fecha colchete e desestruturação, como na barreira da AD-2.

**Formas.**
```ts
imprimir<E>(entrada: EntradaPacote, portas: { buscar(p): Promise<readonly { caderno: CadernoId }[]>; gravar(i: Impressao): Promise<E> },
  opcoes: { cadeia; motorPara; registrar; agora; cadernos?; aoComecar?; aoLer?; descritor? }): Promise<
  { estado: 'aberto' } | { estado: 'sem-caderno' } | { estado: 'nada-gravado'; desfechos } | { estado: 'gravada'; edicao: E; desfechos }>
DesfechoDoCaderno = { tipo: 'escrito'; leitura: LeituraDoMotor<string> } | { tipo: 'nao-escrito'; leitura: LeituraDoPiso }
                  | { tipo: 'incompleto'; leitura: LeituraDoMotor<string>; falta: 'tokens' }
ordem = ranqueados ∩ (escritos ∪ mantidos) ++ (mantidos fora do ranqueamento, pelo catálogo)
mantidos = existentes − (pedidos que ficaram vazios ou mudos)
```

**Custo aceito.** O app ir para o fundo no meio da impressão pode derrubar a chamada em curso (`transitoria`, cai no piso). Se `gravar` falhar, os textos já mostrados se perdem e a nova tentativa paga de novo. Numa edição parcial, os cadernos que faltaram não ganham botão aqui: isso é a 1.11.

## Verification

**Commands:**
- `pnpm --filter @vitale/shared lint && pnpm --filter @vitale/shared test` -- expected: 0 erros, a guarda (7) em teto 0 e as duas barreiras novas verdes e não vácuas
- `cd mobile && pnpm exec tsc --noEmit && pnpm exec jest` -- expected: verde
- `pnpm --filter @vitale/web build && pnpm --filter @vitale/web test` · `pnpm --filter @vitale/scripts lint && pnpm --filter @vitale/scripts test` -- expected: sem regressão

**Provas negativas (rodar e reverter):** `gravar` dentro do laço → o teste de chamada única reprova · um `.gravar` num arquivo de `mobile/src` → a barreira (b) reprova · `agg_version_no_momento` em `mobile/src` → a (c) reprova · importar `montarPacotes` em `mobile/src` → a guarda (7) reprova · a sequência mantendo linha de piso → o caso do `transitoria` reprova.

**Manual checks:** no iPhone, com o JS novo, abrir um mês fechado e sem edição e tocar "Escrever a edição". Conferir os cadernos aparecendo em sequência, a edição relida na ordem e `metrica_lider`/`agg_version_no_momento` na linha gravada. Com a preferência da Retrospectiva em "Sem modelo", conferir que nada é chamado e que o motivo aparece. Nos dois casos, o dono decide se a edição de teste fica ou é apagada.

## Suggested Review Order

**A sequência — comece aqui**

- A impressão inteira: valida antes de pagar, busca o impresso, lê caderno a caderno, grava uma vez.
  [`imprimir-sequencia.ts:128`](../../packages/shared/src/ia/imprimir-sequencia.ts#L128)

- A ordem nasce do que já está impresso: falha de motor nunca apaga texto publicado.
  [`imprimir-sequencia.ts:183`](../../packages/shared/src/ia/imprimir-sequencia.ts#L183)

- A única chamada a `gravar`, depois do laço, com o conjunto inteiro.
  [`imprimir-sequencia.ts:212`](../../packages/shared/src/ia/imprimir-sequencia.ts#L212)

- As validações que antes só rodavam depois das chamadas pagas.
  [`imprimir-sequencia.ts:135`](../../packages/shared/src/ia/imprimir-sequencia.ts#L135)

- A cobertura de noites do Sono, derivada de `resumo.sleep` e nunca inventada.
  [`imprimir-sequencia.ts:81`](../../packages/shared/src/ia/imprimir-sequencia.ts#L81)

- O que o app enxerga: tipos das portas e `imprimir` com o descritor fixo.
  [`imprimir.ts:80`](../../packages/shared/src/ia/imprimir.ts#L80)

**A gravação — a porta do banco**

- As portas do app: `buscar` sobre `fetchEdicao`, `gravar` pela função `edicao_imprimir`.
  [`edicoes-ia.ts:292`](../../packages/shared/src/data/edicoes-ia.ts#L292)

- A conta que imprime tem de ser a que grava; senão lança antes do RPC.
  [`edicoes-ia.ts:299`](../../packages/shared/src/data/edicoes-ia.ts#L299)

- A versão da agregação é carimbada aqui, e só aqui.
  [`edicoes-ia.ts:242`](../../packages/shared/src/data/edicoes-ia.ts#L242)

- A assinatura vira colunas no núcleo: prompt e pacote saem da versão do descritor.
  [`retrospectiva.ts:61`](../../packages/shared/src/ia/retrospectiva.ts#L61)

**As barreiras**

- Só a sequência grava: a função do banco no dono, nenhuma escrita direta, `.gravar` num arquivo.
  [`architecture.test.ts:2441`](../../packages/shared/src/architecture.test.ts#L2441)

- `agg_version_no_momento` nomeada só pelo dono da gravação.
  [`architecture.test.ts:2544`](../../packages/shared/src/architecture.test.ts#L2544)

- A guarda (7) em zero: `imprimir` é porta, `imprimirCom` (aceita descritor) é peça.
  [`architecture.test.ts:1830`](../../packages/shared/src/architecture.test.ts#L1830)

- O detector por AST passou a ver chave computada de literal na desestruturação.
  [`architecture.test.ts:2193`](../../packages/shared/src/architecture.test.ts#L2193)

**O iPhone**

- A ligação: cadeia pela preferência deste aparelho, portas, motor, anel e relógio.
  [`edicao-ia.ts:124`](../../mobile/src/lib/edicao-ia.ts#L124)

- A impressão só começa com os números do período carregados.
  [`edicao.store.ts:159`](../../mobile/src/store/edicao.store.ts#L159)

- A ação: relê a edição antes de imprimir, e mostra caderno a caderno.
  [`edicao.store.ts:300`](../../mobile/src/store/edicao.store.ts#L300)

- O botão mínimo, sem a frase provisória; nenhum botão desabilitado.
  [`EdicaoCard.tsx:195`](../../mobile/src/components/EdicaoCard.tsx#L195)

- A edição chegando em peças, antes da gravação.
  [`EdicaoCard.tsx:127`](../../mobile/src/components/EdicaoCard.tsx#L127)

- O motivo em palavras de cada caderno que não saiu.
  [`edicao-ia.ts:159`](../../mobile/src/lib/edicao-ia.ts#L159)

- A Retrospectiva passa a ser hospedada no seletor de motores.
  [`catalogo.ts:139`](../../mobile/src/lib/motores/catalogo.ts#L139)

- A tela liga a prontidão dos dados e o toque.
  [`index.tsx:445`](../../mobile/src/app/retrospectiva/index.tsx#L445)

**Periféricos**

- `periodoFechado` saiu de `ia/`: era o último import de peça no app.
  [`fechado.ts:35`](../../packages/shared/src/period/fechado.ts#L35)

- A matriz inteira, com motores e portas falsos, sem rede.
  [`imprimir.test.ts:207`](../../packages/shared/src/ia/imprimir.test.ts#L207)

- `gravar` chamada mais de uma vez reprova.
  [`imprimir.test.ts:535`](../../packages/shared/src/ia/imprimir.test.ts#L535)

- A carga conferida contra a função da migração, sem aceitar definição velha.
  [`edicoes-ia.test.ts:298`](../../packages/shared/src/data/edicoes-ia.test.ts#L298)

- A preferência real da Retrospectiva lida no teste, e não substituída.
  [`edicao-ia.test.ts:318`](../../mobile/src/lib/__tests__/edicao-ia.test.ts#L318)
