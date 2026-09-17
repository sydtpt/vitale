---
title: 'Story 1.11 — A rota da revista, e os estados da edição'
type: 'feature'
created: '2026-09-17'
status: 'done'
review_loop_iteration: 0
baseline_commit: '91cb6d71681be4ae3f57e599fd2f6678ef580b35'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Desde a 1.10 a edição é escrita e lida dentro do cartão da Retrospectiva. Ali a capa disputa o topo com o seletor de período, o botão pago aparece no meio da lista de cartões e um caderno que falha não tem para onde ir. Pior: o estado é da **edição inteira**. Não dá para dizer "Coração reprovou, os outros três saíram", nem escrever de novo só o Coração.

**Approach:** A edição ganha a rota `/revista/[tipo]/[inicio]`. O cartão da Retrospectiva vira a **porta**. Os estados passam a valer **por caderno**, com reimpressão de um caderno só pela sequência do núcleo e errata por linha. Tudo segue a proposta visual aprovada em 16/09 ("A rota da revista", decisões 1-a 2-a 3-b 4-a 5-a 6-a no `epics.md`). Três decisões do dono de 17/09 recortam a story: miniatura em **papel com o período**, capa impressa em **papel com a manchete**, e faixa, ícone e sumário ficam para a 1.12 e a 1.14.

## Boundaries & Constraints

**Always:**
- **`/retrospectiva` não perde nada.** O `EdicaoCard` do bloco `lede` vira a porta, um alvo de toque só que leva à rota. Com edição impressa, mostra miniatura em papel (o período curto, em serifada) + a **chamada inteira** (`chamadaDoTexto` do caderno em `posicao` 1) + seta. Fechado e não escrito, mostra *"Este período fechou e ainda não foi escrito."* + seta, **sem botão**. Em período em curso e no Total, **nada**.
- **"Escrever a edição" só existe na rota.** Aparece na capa em papel de período fechado sem nenhum caderno impresso, só com os dados prontos (`dadosProntosParaImprimir`, da 1.10), e nunca durante uma impressão.
- **A rota nunca escreve ao abrir.** A capa em papel mostra o período em serifada e, com edição impressa, a manchete: a chamada do caderno em `posicao` 1, inteira e sem corte. O miolo mostra os cadernos impressos na ordem de `posicao` e, depois deles, os cadernos com dado e sem linha, em **ordem de catálogo**. Caderno sem dado **não aparece**.
- **Estado por caderno, derivado de duas fontes.** O banco diz o que está impresso. A **sessão** (memória, nunca persistida) diz o que acabou de acontecer: na fila, escrevendo, reprovado com problemas, erro. A reprovação não sobrevive ao relançamento, e isso é decisão declarada.
- **As causas** (decisão 3-b):
  - **reprovada**, com "Escrever este caderno de novo" (botão principal): `reprovada`, `recusa-do-modelo`, `guarda`, `saida-invalida`, `capacidade`, `janela`.
  - **erro**, com "Tentar de novo" (contorno): `indisponivel` e `transitoria`, e também `defeito`, `preferencia` e o desfecho `incompleto`, porque nenhum deles é culpa do texto.
  - `mudo`: o caderno some.
  - Nenhum estado mostra texto cru do fornecedor.
- **Reimprimir um caderno** chama a sequência do núcleo com `cadernos: [c]`. Os outros ficam intactos e não são reassinados, e a ordem é recalculada pela função do banco. **Uma impressão por período de cada vez**: durante uma, nenhum botão de escrever aparece.
- **Errata por caderno:** `precisaErrata(c, AGG_VERSION)` marca **só** aquele caderno com *"Os números abaixo foram reprocessados depois desta edição."*, acima do texto, sem reescrever nada.
- **Quem sabe quais cadernos têm dado é o núcleo.** A tela chama `cadernosComDado(entrada)`, exportado pela porta `ia/imprimir.ts`, em ordem de catálogo. Nunca importa pacote nem ranqueamento, e as barreiras continuam em zero.
- **Tokens e fontes do tema** (`moduleOf`/`resolveTokens`, `fonts.*`). Nenhum hex, nenhum `StyleSheet` de escopo de módulo lendo tema, nenhuma barra de rolagem visível.

**Ask First:**
- Mudar qualquer frase da proposta aprovada ou a classificação das causas.
- Persistir a reprovação (tabela, AsyncStorage), porque isso muda a decisão declarada.

**Never:**
- Faixa sangrada, ícone de caderno, lápide desenhada ou famílias de fonte por papel (1.12). Capa com foto, traçado, véu ou escrita em `edicoes_capa` (1.13). Sumário ou rolagem ancorada (1.14).
- Recalcular ordem ou posição no cliente. Botão desabilitado no lugar de ausência. Escrever ao abrir a rota ou a porta.
- Migração nova, mudança na conferência ou no prompt.

## I/O & Edge-Case Matrix

| Cenário | Estado | Esperado | Erro |
|---|---|---|---|
| Porta, impresso | agosto, 3 cadernos | miniatura "ago 2026" + chamada do `posicao` 1 inteira + seta; o toque abre `/revista/mes/2026-08-01` | N/A |
| Porta, não escrito | abril, 0 linhas | frase + seta, sem botão; o toque abre a rota | N/A |
| Porta, em curso ou Total | setembro / Total | nada | N/A |
| Rota, não escrito | abril, dados prontos | capa em papel + frase + "Escrever a edição"; miolo vazio | dados não prontos: sem botão |
| Imprimir a edição | toque | cadernos em fila e escrevendo um a um; no fim, os impressos em `posicao` e os que falharam com o estado deles | porta falha: `erro` com releitura |
| Estado misto | Mov impresso, Sono escrevendo, Coração `reprovada`, Rotina errata | cada caderno com o seu estado; Coração com problemas + "Escrever este caderno de novo" | N/A |
| Reimprimir um caderno | Coração reprovado | só o Coração escrevendo; Mov e Rotina intactos; a releitura traz a ordem nova | segundo toque ignorado |
| Erro passageiro | Sono `transitoria` | "O caderno não foi escrito: {motivo}." + "Tentar de novo" (contorno) | N/A |
| Relançamento | Coração reprovado antes | Coração "Este caderno ainda não foi escrito." + "Escrever este caderno" | N/A |
| Caderno sem dado | Rotina vazia | não aparece | N/A |
| Errata | `agg_version_no_momento` ≠ `AGG_VERSION` só no Sono | marca só no Sono | N/A |
| Rota inválida | tipo `total`, início inexistente ou período em curso | cabeçalho e nada mais; nunca imprime | N/A |

</frozen-after-approval>

## Code Map

- `mobile/src/components/EdicaoCard.tsx`: o cartão atual, com o botão da 1.10. Vira a porta e perde o botão.
- `mobile/src/store/edicao.store.ts`: fases por edição (`pronta`, `nao-escrita`, `imprimindo`…), `imprimir(entrada, dadosProntos)`, `dadosProntosParaImprimir`, `podeEscrever`, `chaveDe`/`estadoDe`. Passa a guardar a sessão por caderno.
- `mobile/src/lib/edicao-ia.ts`:
  - `imprimirEdicao(userId, entrada, avisos, deps)` repassa `cadernos` para a sequência;
  - `naoImpressoDe(desfecho)` é o motivo em palavras;
  - `buscarEdicao` fica como está.
- `mobile/src/lib/assinatura.ts:143`: `motivoDaFalha`, as frases da proposta.
- `mobile/src/app/retrospectiva/index.tsx:325-355,426-450`: prontidão, `imprimirEdicao` e o bloco `lede`. Extrair a entrada e a prontidão para um hook compartilhado com a rota.
- `mobile/src/app/_layout.tsx:190-210`: `Stack.Screen` com `slide_from_right`. Registrar `revista/[tipo]/[inicio]`.
- `mobile/src/app/sono/[day].tsx:47-51`: molde de rota dinâmica (`useLocalSearchParams`, `useRouter`, safe area).
- `packages/shared/src/ia/imprimir.ts`: `imprimir(…, { cadernos })`, `DesfechoDoCaderno`, `ResultadoDaImpressao`. É a porta, então pode exportar `cadernosComDado`. `ia/imprimir-sequencia.ts` é a sequência e tem `comCoberturaDoSono`.
- `packages/shared/src/period/bounds.ts:92,111,197`: `periodLabel`, `periodBounds`, `latestAvailableOffset`. Nasce aqui o inverso `offsetDoInicio(now, kind, startISO)`.
- `packages/shared/src/data/edicoes-ia.ts`: `precisaErrata`, `Edicao`, `CadernoImpresso`. `AGG_VERSION` sai do barril.
- `packages/shared/src/revista/chamada.ts`: `chamadaDoTexto`. `period/cadernos.ts`: `CADERNO_IDS`, `rotuloDoCaderno`.
- `packages/shared/src/architecture.test.ts`: guarda (7) em zero, a barreira do ranqueamento, os hex, o `StyleSheet` de módulo e a lista rolável sem barra. Nenhuma pode subir.
- Proposta aprovada: `https://claude.ai/artifact/Tr4axGdQAgmkr3cn1ENGYp`, quadros 1 a 5, com frases, pesos de botão e capa em papel.
- Testes-molde: `mobile/src/store/__tests__/edicao-store.test.ts`, `mobile/src/lib/__tests__/edicao-ia.test.ts`, `packages/shared/src/ia/imprimir.test.ts`.

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/period/bounds.ts` + teste: `offsetDoInicio(now, kind, startISO)` devolve o `offset` do período que começa em `startISO`, ou `null` se `kind` é `all` ou a data não é início de período. Com isso a rota vira `periodBounds`.
- [x] `packages/shared/src/ia/imprimir.ts` + teste: `cadernosComDado(entrada)`, com os cadernos não vazios dos pacotes (com a cobertura do Sono), em ordem de catálogo, sem ranqueamento.
- [x] `mobile/src/lib/edicao-ia.ts` + teste:
  - `imprimirEdicao` aceita `cadernos`;
  - `classeDoDesfecho(desfecho)` devolve `'reprovada' | 'erro' | null` pela tabela das causas;
  - `slugDoTipo`/`tipoDoSlug` traduzem `semana|mes|estacao|ano` ↔ `week|month|season|year`.
- [x] `mobile/src/store/edicao.store.ts` + teste:
  - a edição lida carrega a sessão por caderno;
  - `imprimir(entrada, dadosProntos)` imprime a edição e `imprimirCaderno(entrada, dadosProntos, caderno)` imprime um;
  - as duas relêem antes, ignoram o segundo toque, preenchem a sessão caderno a caderno e relêem o banco no fim;
  - `vistaDaEdicao(estado, comDado, aggVersion)` é pura e devolve a capa (papel, manchete, botão ou não) e os cadernos com o estado de cada um, na ordem da regra;
  - `portaDe(estado)` é pura e devolve impressa, não escrita, escrevendo, erro, sem sessão ou nada.
- [x] `mobile/src/hooks/useEntradaDaEdicao.ts`: a entrada e a prontidão, a partir de `kind` e `offset`. A Retrospectiva e a rota passam a usá-lo.
- [x] `mobile/src/app/revista/[tipo]/[inicio].tsx` + `_layout.tsx`: a rota, com cabeçalho (voltar + período), capa em papel e miolo por caderno, nos estados e frases da proposta (quadros 2 a 5) e o botão principal ou de contorno por classe. Assinatura `modelo · data` em `ink2`.
- [x] `mobile/src/components/EdicaoCard.tsx` + `app/retrospectiva/index.tsx`: a porta conforme o quadro 1-a e o quadro 5 (a porta só leva à rota), sem botão de escrever, com os docblocks refeitos.
- [x] `_bmad-output/implementation-artifacts/deferred-work.md`: `resolucao:` na volta da errata (era "1.12", saiu aqui), em `precisaErrata` sem chamador e na chamada sem teto (decisão 6-a: inteira, sempre).

**Acceptance Criteria:**
- Given agosto/2026 impresso no iPhone, when o dono toca a porta, then a rota abre com a capa em papel, a manchete inteira e os cadernos em `posicao`, e voltar devolve a Retrospectiva intacta.
- Given um caderno reprovado na sessão, when o dono toca "Escrever este caderno de novo", then só aquele caderno é chamado e os outros não mudam de texto nem de assinatura.
- Given a suíte, when roda, then as barreiras seguem verdes (guarda (7) em zero, ranqueamento fora da tela, sem hex), e a matriz inteira tem teste nas funções puras e na store.

## Design Notes

**Por que a sessão fica em memória.** Um texto reprovado nunca chega ao banco (o `CHECK` proíbe texto vazio), e `edicoes_ia` é tabela de edição publicada, não de tentativa. Guardar a reprovação criaria o que a 1.11 declarou não ter. O custo, com nome: o motivo da reprovação vive uma sessão.

**Por que `defeito`, `preferencia` e `incompleto` vão para o erro.** A tabela da proposta cobre as oito classes de motor. Essas três não dizem nada sobre o texto: são o app (defeito), a escolha do motor ou a resposta sem contagem. "Escrever este caderno de novo" sugeriria que o texto é o problema; "Tentar de novo" é honesto.

**Forma de `vistaDaEdicao`, exemplo:**
```ts
{ capa: { periodo: 'Agosto de 2026', manchete: 'Agosto somou 435 km — …' | null, escrever: boolean },
  cadernos: [
    { caderno: 'movimento', estado: 'pronta', texto, assinatura, errata: false },
    { caderno: 'sono', estado: 'escrevendo' },
    { caderno: 'coracao', estado: 'reprovada', motivo, problemas: ['"186" não está no pacote'], acao: 'escrever-de-novo' },
    { caderno: 'rotina', estado: 'nao-escrito', acao: 'escrever' } ] }
```

## Verification

**Commands:**
- `pnpm --filter @vitale/shared lint && pnpm --filter @vitale/shared test`: expected 0 erros e as barreiras verdes.
- `cd mobile && pnpm exec tsc --noEmit && pnpm exec jest`: expected verde. A rota nova tem de entrar nas typed routes; num worktree sem `.expo/types`, o `tsc` é a condição do CI.
- `pnpm --filter @vitale/web build`: expected sem regressão (a web não muda).

**Manual checks (iPhone):**
- **Retrospectiva:** porta de agosto impresso, porta de um mês fechado sem edição e nada em setembro nem no Total.
- **Rota, impressão da edição:** num mês sem edição, escrever a edição e ver os cadernos chegando.
- **Rota, um caderno:** para ver o erro passageiro, pôr o iPhone em modo avião antes de escrever. Cada caderno cai em `indisponivel`, com "Tentar de novo". Sair do modo avião e tentar **um** caderno só: os outros continuam no erro. O reprovado não se força no aparelho; a tela dele é coberta pelas funções puras.
- **Relançamento:** fechar e reabrir o app com um caderno reprovado e ver o convite no lugar do motivo.

## Suggested Review Order

**O estado por caderno — comece aqui**

- A vista da rota: capa, cadernos na ordem da regra e o botão pela mesma decisão da ação.
  [`edicao.store.ts:344`](../../mobile/src/store/edicao.store.ts#L344)

- A decisão única de imprimir: lida, sem impressão correndo, dados prontos e com dado.
  [`edicao.store.ts:213`](../../mobile/src/store/edicao.store.ts#L213)

- Imprimir a edição ou um caderno: relê antes de pagar, sessão caderno a caderno, relê no fim.
  [`edicao.store.ts:634`](../../mobile/src/store/edicao.store.ts#L634)

- A geração por chave: leitura lenta não sobrescreve impressão que já terminou.
  [`edicao.store.ts:544`](../../mobile/src/store/edicao.store.ts#L544)

- A porta da Retrospectiva: impressa, não escrita, escrevendo ou nada.
  [`edicao.store.ts:246`](../../mobile/src/store/edicao.store.ts#L246)

**As causas e o endereço**

- A tabela 3-b: seis causas escrevem de novo, e o resto tenta de novo.
  [`edicao-ia.ts:239`](../../mobile/src/lib/edicao-ia.ts#L239)

- O endereço da rota, e a rota inválida que nunca imprime.
  [`edicao-ia.ts:353`](../../mobile/src/lib/edicao-ia.ts#L353)

- O href da porta, no formato que o endereço lê de volta.
  [`edicao-ia.ts:324`](../../mobile/src/lib/edicao-ia.ts#L324)

**O núcleo**

- Quem tem o que dizer, pela régua da impressão e sem ranqueamento.
  [`imprimir.ts:175`](../../packages/shared/src/ia/imprimir.ts#L175)

- O inverso de `periodBounds`: do início do período ao offset.
  [`bounds.ts:151`](../../packages/shared/src/period/bounds.ts#L151)

**As telas**

- A rota: cabeçalho, capa em papel, cadernos com o estado e a ação de cada um.
  [`[inicio].tsx:98`](../../mobile/src/app/revista/[tipo]/[inicio].tsx#L98)

- A porta no bloco lede: miniatura em papel e chamada inteira, sem botão.
  [`EdicaoCard.tsx:54`](../../mobile/src/components/EdicaoCard.tsx#L54)

- A entrada e a prontidão, uma só para a Retrospectiva e para a rota.
  [`useEntradaDaEdicao.ts:46`](../../mobile/src/hooks/useEntradaDaEdicao.ts#L46)

- A Retrospectiva abre a rota pelo href da porta.
  [`retrospectiva/index.tsx:326`](../../mobile/src/app/retrospectiva/index.tsx#L326)

**Periféricos**

- A matriz da rota, em funções puras.
  [`edicao-store.test.ts:783`](../../mobile/src/store/__tests__/edicao-store.test.ts#L783)

- A rota registrada na pilha.
  [`_layout.tsx:221`](../../mobile/src/app/_layout.tsx#L221)
