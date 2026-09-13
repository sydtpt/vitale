---
title: 'Story 5.5 — O botão Ler e a escolha do motor, marco A (F2)'
type: 'feature'
created: '2026-09-12'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'ca7724d3354f12bf926944e82cbebe3a6e8bf99f'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-5-4-a-bancada-no-mac-marco-a.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A camada de motores existe inteira no núcleo e foi medida no Mac — a nuvem passou nas
quatro condições da ADR 0050 —, mas **nenhum app a percorreu**. No iPhone a Saúde do sono continua
sem frase, e o dono não tem como julgar no aparelho o que a bancada mediu: não há botão, não há
escolha de motor, e nada na tela diria quem escreveu. A `/sono/saude` ainda monta a fórmula do
período à mão, o que faz a noite única mostrar "horário ± 0 min" com 2 pontos automáticos.

**Approach:** O app vira o primeiro hospedeiro: nasce `mobile/src/lib/motores/` com `motorPara`,
`invocar`, catálogo, preferência e anel; a `/sono/saude` passa a chamar `entradaDaSaude` e ganha a
frase como manchete, com um ícone no cabeçalho que a pede; `/configuracoes/motores` deixa o dono
escolher quem escreve; e uma tela de desenvolvimento roda os motores lado a lado em modo `medicao`.
**Marco A: sem a ponte do aparelho** — ela é o marco B, depois de 15/09.

## Boundaries & Constraints

**Always:**
- Leitura **efêmera e só por toque**: nunca ao abrir a tela, nunca gravada (`grava: false`).
- A tela **sempre diz quem escreveu**, e quando cai no piso diz o motivo **em palavras**.
- Toque repetido com o mesmo `hashDoPedido` se junta ao primeiro; resultado cujo hash não é o do
  pedido corrente é **descartado**, não exibido.
- `cadeiaPadrao` da Saúde continua **`[sem-modelo]`** — decisão do dono em 12/09: a nuvem está
  habilitada, não imposta, e entra por escolha no seletor.
- A preferência é um mapa `RecursoId` → `MotorId` em AsyncStorage, com **um módulo dono da chave** e
  fila no molde de `sync-breadcrumbs`. `user_preferences` não é tocada (AD-8).
- O catálogo lista **todo motor conhecido**, disponível ou não, com motivo — os recursos saem de
  `CATALOGO_DE_RECURSOS`, nunca de lista à mão.
- O literal `'ia-narrar'` só aparece dentro de `mobile/src/lib/motores/`.
- O anel guarda a trilha e **nunca sai do aparelho**.
- As sete decisões visuais do dono (artifact "O botão Ler", 12/09) valem à letra — ver Design Notes.

**Ask First:**
- Subir qualquer teto de `architecture.test.ts`. Se uma peça do núcleo não passa na guarda (7), ela
  está no lugar errado: pare e pergunte.
- Mudar `SONO_WINDOW_DAYS` (90) — é lido por outros consumidores.
- Qualquer chamada de nuvem em teste automatizado, ou fixture com dado de saúde real.

**Never:**
- `mobile/modules/on-device-engine/`, `Engine.swift`, cola do Expo, `runtimeVersion` — marco B.
  `mobile/app.base.json` **não muda**: sem código nativo, o marco A alcança o runtime 1.0.5.
- Tocar `web/`, `supabase/`, `scripts/github/`, `ia/pacote.ts`, `ia/prompt.ts`, `period/`.
- Gravar leitura, texto cru ou pedido em banco, arquivo ou log que saia do aparelho.
- Barra de progresso na espera: o orquestrador não sabe quanto falta.
- Chamar `montarPedido`/`conferir`/`montarFrase`/`interpretar`/`semModelo` de um descritor fora do
  orquestrador — é a segunda sequência que a AD-2 proíbe.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Piso por escolha | preferência `sem-modelo`, toque | frase do template, instantânea; assinatura "escrito sem modelo · instantâneo" | N/A |
| Nuvem escreve | preferência `nuvem:padrao`, 2xx conferido | frase do motor; assinatura "escrito pela nuvem · 17 s" | N/A |
| Nuvem recusa | classe `recusa-do-modelo` | frase do **template** + "a nuvem recusou · escrito sem modelo" | piso, nada gravado |
| Sem rede | `semRede: true` → `indisponivel` | template + "a nuvem não atendeu · escrito sem modelo" | piso |
| Reprovada na conferência | `desfecho: 'reprovada'` | template + "a nuvem escreveu fora das regras · escrito sem modelo" | piso; problemas só no anel |
| Toque repetido | mesmo hash, chamada em curso | o segundo toque **não** dispara nada e espera a primeira | N/A |
| Janela trocada durante a espera | resposta chega com hash antigo | descartada em silêncio; a vaga volta a repouso | N/A |
| Pedido nulo | `montarPedido` devolve `null` | vaga fica em repouso com o texto de convite; nenhuma chamada sai | N/A |
| Noite única (`ultima`) | uma noite no período | quatro dimensões por `nightScore`; horário mede desvio do habitual, não "± 0 min" | N/A |
| Janela maior que 90 dias | `12m`/`ano` | as notas da janela inteira são carregadas antes de contar | se a busca falhar, conta com o que há e a cobertura cai |
| Motor indisponível no seletor | `aparelho:sistema` | aparece na lista, apagado, com o motivo escrito | não selecionável |
| Preferência ilegível | valor corrompido no AsyncStorage | `resolverCadeia` cai no padrão do recurso | preferência não é apagada |

</frozen-after-approval>

## Code Map

**O núcleo (só consumir — nada muda aqui, exceto onde dito):**
- `packages/shared/src/ia/orquestrar.ts:719-727` — `ler` sobrecarregado. `OpcoesComuns` `:251-258` são
  três campos **obrigatórios**: `motorPara: (id) => Motor | undefined`, `registrar: (e) => void`,
  `agora: () => Date`. Produto `:260-262` (`{ modo:'produto', cadeia }`), medição `:264-270`
  (`{ modo:'medicao', motor }`). Retornos: `Leitura<V>` `:174-191` (`origem:'motor'` com `frase`,
  `motor`, `resposta`, `trilha`; ou `origem:'piso'` com `causa`, `trilha` e `{frase}|{ausencia}`) e
  `Medicao<V>` `:201-216` (`tipo: 'template'|'mudo'|'tentativa'`). `Tentativa` `:157-171` traz
  `desfecho`, `ms`, `problemas?`. `EventoDoAnel` `:226-247`.
- `packages/shared/src/ia/motor.ts:263-267` — `resolverCadeia(recurso, preferencia, catalogo)`. O
  `catalogo` são os ids que o hospedeiro **conhece**, disponíveis ou não. Preferência ilegível,
  desconhecida ou acima de `regimeMaximo` → cai no padrão, nunca sobe exposição (`:271-283`).
  `Cadeia` `:155` é marcada: só `resolverCadeia` a constrói.
- `packages/shared/src/ia/nuvem.ts:26-31,149-159` — `criarMotorDeNuvem(invocar)`;
  `Transporte = (corpo: CorpoDoPedido) => Promise<{status;corpo} | {semRede:true;detalhe?}>`.
  Status não-2xx é **dado**, não exceção; tabela `CLASSE_POR_STATUS` `:39-49`. `'ia-narrar'` não
  aparece aqui — é do hospedeiro.
- `packages/shared/src/ia/fio.ts:71-77,92` — `SEM_MODELO`, `NUVEM_PADRAO`, `MotorId`;
  `lerMotorId` `:120`, `formatarMotorId`. `CLASSES_DE_FALHA` `:44-51`. `CorpoDoPedido` `:338-342`.
- `packages/shared/src/sleep/leitura.ts:181-217` — `entradaDaSaude(noites, notas, {range, offset,
  hoje})`; `hoje` é **dia local `AAAA-MM-DD`**, e lança se for instante. `'ultima'` usa `nightScore`
  (4 dimensões, `:194-201`); os demais rodam a fórmula da tela (`:204-216`).
  `descritorDaSaudeDoSono` `:742-768`: `cadeiaPadrao: [SEM_MODELO]` `:747`, `regimeMaximo: 'nuvem'`
  `:746`, `grava: false` `:748`.
- `packages/shared/src/ia/recursos.ts:19-27` — `CATALOGO_DE_RECURSOS`; achar o descritor por
  `d.recurso === 'saude-do-sono'`. `validarDescritor` `:63-119`.
- `packages/shared/src/sleep/score.ts:290-301` (`timingDim`) vs `:474-518` (`spreadDim`) — a origem da
  diferença da noite única: dispersão de um ponto só é sempre 0, logo 2 pontos e "± 0 min".

**O app (é aqui que a story escreve):**
- `mobile/src/app/sono/saude.tsx:59-69` — monta `filterByRange` + `rangeBounds` + `rangeNights` +
  `periodScore` à mão; **sai inteiro** para `entradaDaSaude`. Cabeçalho `:74-80`, com
  `<HeaderSpacer />` `:79` no slot direito. `SleepScoreDims` `:93-97`.
- `mobile/src/components/ui/HeaderSpacer.tsx:25-27` — `View` de 36×36, sem tema. É o slot que o botão
  ocupa; o molde do botão é o `backBtn` de `saude.tsx` (`Pressable`, 38×38, `hitSlop={12}`).
- `mobile/src/store/sono.store.ts:17,41,53-71` — `SONO_WINDOW_DAYS = 90`; `load()` traz **todos** os
  períodos (`fetchSleepPeriodsSince(..., '2000-01-01')` `:62`) mas só 90 dias de notas (`:63`, via
  `sinceDay`). É o buraco de 12m/ano.
- `mobile/src/lib/edicao-ia.ts:37-59` — como o app chama a function hoje:
  `supabase.functions.invoke('ia-narrar', { body })`, sem `Authorization` manual (o client injeta o
  Bearer), **sem timeout e sem retry**. É o molde de `invocar` — e um dos dois ofensores atuais da
  catraca, que sai na 1.10. O outro é `mobile/src/services/route-name.ts:49-65` (sai na 5.7).
- `mobile/src/lib/sync-breadcrumbs.ts:27,90-107` — o molde da preferência: chave `vitale:<domínio>`
  dona do módulo, `getJSON`/`setJSON` de `mobile/src/lib/local-store.ts:7-27` com `KVStore`
  injetável, e **fila de promises** encadeada em módulo porque AsyncStorage não tem read-modify-write
  atômico. Teste-molde: `mobile/src/lib/__tests__/sync-breadcrumbs.test.ts` (store lento fake).
- `mobile/src/app/configuracoes/paleta.tsx:66-73,85-106,134` — o molde da lista de escolha: header,
  `ScrollView`, um `Pressable` por opção com `accessibilityState={{selected}}` e borda `colors.primary`
  no selecionado. `mobile/src/app/configuracoes/index.tsx:41-66` — a linha do hub que leva à tela nova.
- `mobile/jest.config.js` + `mobile/package.json:13` — Jest `jest-expo`; testes em
  `mobile/src/lib/__tests__/`, puros, com dependências injetadas.

**As barreiras:**
- `packages/shared/src/architecture.test.ts:1161-1206` — guarda (1). `PONTOS_DE_INJECAO` **já** aceita
  `/^mobile\/src\/lib\/motores\//`; `TETO_PORTA_POR_HOSPEDEIRO = 2` `:1166` **não muda nesta story**
  (os dois ofensores saem na 1.10 e na 5.7).
- `:1247-1438` — guarda (7), `TETO_PECAS_DE_IA = 1` `:1271`. `PORTA_DE_IA` `:1247` libera
  `fio, motor, orquestrar, nuvem, recursos`; `LIVRES_DE_SONO = {entradaDaSaude}` `:1249`;
  `ehDescritor` `:1359` libera todo nome com prefixo `descritor`. Tudo que o app vai importar já é
  livre — **o teto não sobe**.
- `:1441-1476` — catraca da fórmula do período, `TETO_DA_FORMULA_DO_PERIODO = 2` `:1453`, detector
  `/\b(periodScore|rangeNights|rangeBounds)\s*\(/`. Os dois ofensores são as duas telas de
  `/sono/saude`; a mobile sai nesta story, a web fica → **teto vai a 1**.
- `:148-162` — barreira do `.from()`, teto zero, escopo web+mobile+scripts. Não muda: o anel é
  memória, e as notas vêm de `packages/shared/src/data`.

## Tasks & Acceptance

**Execution:**

- [x] `mobile/src/lib/motores/catalogo.ts` — declarar os `MotorId` que o app conhece, cada um com
  `disponivel: boolean` e `motivo?: string`. No marco A: `sem-modelo` e `nuvem:padrao` disponíveis;
  `aparelho:sistema` **listado e indisponível**, motivo "a ponte para o modelo do sistema ainda não
  existe neste build". Exportar `idsConhecidos` para alimentar `resolverCadeia`. Puro, testado.
- [x] `mobile/src/lib/motores/index.ts` — o ponto de injeção: `invocar` sobre
  `supabase.functions.invoke('ia-narrar', …)` traduzindo para `{status, corpo} | {semRede}` **sem
  lançar**, `motorPara(id)` devolvendo `criarMotorDeNuvem(invocar)` para `nuvem:*` e `undefined` para
  o resto, e a serialização por motor (uma chamada de nuvem por vez). É o **único** arquivo do app
  que cita `'ia-narrar'`.
- [x] `mobile/src/lib/motores/preferencia.ts` — mapa `RecursoId` → `MotorId` em AsyncStorage sob
  `vitale:motores-preferencia`, com `KVStore` injetável e fila encadeada no molde de
  `sync-breadcrumbs`. Ler nunca lança; valor ilegível devolve `null`.
- [x] `mobile/src/lib/motores/anel.ts` — buffer em memória com teto, alimentado por `registrar`;
  expõe leitura para a tela de desenvolvimento. Não persiste, não sai do aparelho.
- [x] `mobile/src/lib/assinatura.ts` — funções **puras**: `textoDaAssinatura(estado)` e
  `motivoDaFalha(classe)`, cobrindo as sete classes por `switch` exaustivo. É o texto da pergunta 3
  e da pergunta 5 do dono.
- [x] `mobile/src/lib/leitura-da-saude.ts` — o hook `useLeituraDaSaude(entrada)`: máquina de quatro
  estados (repouso, escrevendo, lida, piso), `resolverCadeia` com a preferência, `ler` em modo
  produto, dedupe por `hashDoPedido` e descarte de resposta fora do hash corrente.
- [x] `mobile/src/store/sono.store.ts` — acrescentar `carregarNotasDesde(dia)` que estende o mapa de
  notas sem mexer em `SONO_WINDOW_DAYS`; a tela a chama quando a janela pede mais de 90 dias.
- [x] `mobile/src/app/sono/saude.tsx` — trocar a fórmula à mão por `entradaDaSaude` (com `hoje` como
  **dia local**), pôr o botão de ícone no slot do `HeaderSpacer` e a vaga da frase entre o `PeriodNav`
  e o `SleepScoreDims`.
- [x] `mobile/src/app/configuracoes/motores/index.tsx` + a linha no hub
  (`mobile/src/app/configuracoes/index.tsx`) — os recursos vindos de `CATALOGO_DE_RECURSOS`, os
  motores do catálogo do app, indisponível apagado com motivo, escolha gravada na preferência.
- [x] `mobile/src/app/configuracoes/motores/bancada.tsx` — a tela de desenvolvimento: `PeriodNav`
  para escolher a janela e, por motor conhecido, uma linha com a frase do template à esquerda e a do
  motor à direita, mais `desfecho`, `ms`, tokens e o **texto cru** — modo `medicao`, um motor por vez.
- [x] `packages/shared/src/architecture.test.ts` — baixar `TETO_DA_FORMULA_DO_PERIODO` de 2 para 1 e
  acrescentar a **barreira nova**: nenhum arquivo de `mobile/src`, `web/src` ou `scripts/` chama
  `.montarPedido(`, `.interpretar(`, `.conferir(`, `.montarFrase(`, `.semModelo(` ou `.pedidoCurto(`.
- [x] `mobile/src/lib/__tests__/` — testes puros da matriz de I/O: catálogo, preferência (incluindo a
  corrida de duas escritas), assinatura nas sete classes, e a máquina de estados com motores falsos.

**Acceptance Criteria:**

- Given a tela abre, when nada é tocado, then nenhuma chamada de motor sai e a vaga mostra o convite.
- Given o dono escolheu `nuvem:padrao`, when ele toca o ícone e a nuvem responde, then a frase é a do
  motor e a assinatura nomeia a nuvem e o tempo; nada é gravado em lugar nenhum.
- Given o alcance é `ultima`, when a tela conta, then são **quatro** dimensões e o horário mede o
  desvio contra o habitual — não "± 0 min" com dois pontos.
- Given a janela é `12m`, when a tela conta a percepção, then as notas de toda a janela foram
  carregadas, e não só as dos últimos 90 dias.
- Given `/configuracoes/motores` abre, when a lista é montada, then os recursos vieram de
  `CATALOGO_DE_RECURSOS` e `aparelho:sistema` aparece indisponível com motivo.
- Given os seis comandos do portão da máquina rodam, when a story fecha, then todos passam, incluindo
  `expo-doctor` 21/21 — e o veredito final é do dono, no iPhone.

## Spec Change Log

- **2026-09-13 — a barreira nova nasceu partida em duas, porque uma das seis tem passivo.** A spec pede
  uma barreira de teto zero sobre `.montarPedido(`, `.interpretar(`, `.conferir(`, `.montarFrase(`,
  `.semModelo(` e `.pedidoCurto(`. Cinco delas estão mesmo em zero e entraram como **barreira**. A
  sexta não: `scripts/bancada/medir.ts:186` chama `D.montarPedido(e)` desde a 5.4, e por um motivo que
  ainda vale — ela precisa do **corpo** do pedido para o relatório (o `sistema` e o `usuario` que o dono
  lê) e do hash da coluna do template, que o `Medicao` do modo `medicao` não devolve. Seguindo a regra
  do épico ("as guardas que têm passivo nascem catraca"), `montarPedido` entrou como **catraca com teto
  1**, com o histórico escrito e o caminho para zerá-la: fazer o `Medicao` do template carregar o
  pedido. Nenhum teto subiu, e a bancada não ficou com liberação implícita — ela aparece nomeada na
  falha da catraca no dia em que um segundo arquivo a acompanhar.

- **2026-09-13 — o descarte compara a janela, não o `hashDoPedido`: o app não pode calcular o hash.**
  A spec descreve o dedupe e o descarte por `hashDoPedido`. O hash sai de `montarPedido`, que é do
  descritor — e chamá-lo do app é exatamente o que a barreira acima passa a proibir. O que o app tem é
  a **pré-imagem**: a entrada. `chaveDaJanela(entrada)` carrega o `range`, o dia local, as bordas
  apuradas **e a contagem** (ponto e fato de cada dimensão, cobertura, se pontuou) — e o pedido é função
  só disso, porque o caso sai do `score`. Mesma chave, mesmo pedido, mesmo hash.

  A diferença aparece num caso, e ela **corrige** em vez de afrouxar: duas janelas no mesmo caso têm o
  mesmo hash de propósito, e comparar por hash as trataria como intercambiáveis. Não são — `montarFrase`
  já interpolou `{janela}` e `{quando}` com as datas da janela em que a frase nasceu, então a frase da
  janela anterior afirmaria datas erradas sob a janela nova. A chave descarta o que o hash aprovaria, e
  faz bem. O hash continua existindo na tela: ele vem **do anel** (`EventoDoAnel.hash`), e vai até a
  tela de desenvolvimento.

  Medido na prática ao escrever isto: a contagem tinha de entrar na chave. A tela carrega 90 dias de
  nota e só depois estende a janela para `12m`, então a percepção muda **depois** de a frase já estar na
  tela — sem a contagem na chave, a manchete ficaria afirmando um caso que as cinco linhas abaixo dela
  já não mostram.

- **2026-09-13 — PERGUNTA ABERTA (linha 10 da matriz): "a cobertura cai" nomeia um campo que notas não
  movem.** A coluna de falha da linha "janela maior que 90 dias" diz: "se a busca falhar, conta com o
  que há e a cobertura cai". A primeira metade é inequívoca e está coberta por teste. A segunda tem
  duas leituras, e **uma delas é falsa no código**:
  - `score.coverage` (o que `coverageNote` imprime, e o único campo que se chama cobertura) é
    `noites gravadas / noites esperadas` — `periodScore` o calcula antes de olhar qualquer nota. Nota
    que falta **não o move**, e medimos isso: com 200 noites, a cobertura é idêntica com 365 notas e
    com 89.
  - O que cai de fato é o **alcance da contagem**: `percepcao` fica `absent` ("você não deu nota"), o
    denominador encolhe (`max` 10 → 8) e o fato da linha mostra o `n` menor de notas.

  Implementei e testei a segunda leitura, que é a verdadeira — mas **não escolhi** por ninguém: o
  teste afirma só o que é observável (o fato muda, `max` encolhe, a cobertura de noites **não** muda)
  e diz por escrito que este é o ponto em que a matriz e o código não falam da mesma grandeza. Se o
  dono quis dizer o campo `coverage`, a linha é falsa como escrita e a decisão é dele — nota não é
  noite, e fazer a cobertura de noites reagir a nota seria mentir em outra direção.

- **2026-09-13 (revisão) — a assinatura do piso por falha ganhou o tempo, e o texto da matriz virou o
  começo dela.** A matriz cita três assinaturas de falha sem tempo ("a nuvem recusou · escrito sem
  modelo"), enquanto as duas linhas de sucesso o trazem. O tempo entrou também nas de falha, porque a
  razão escrita para **não** haver um "Reler" no cabeçalho é que "quem diz que o botão foi apertado
  outra vez é a assinatura trocando o tempo" — e sem ele duas tentativas seguidas davam texto
  idêntico, justamente no caso em que o dono mais tenta de novo. O texto que a matriz cita é
  preservado **à letra** como começo da assinatura, e há teste que afirma isso como prefixo. **Se o
  dono quis as três linhas sem tempo, é reverter uma linha** — a decisão é dele.

- **2026-09-13 (revisão) — o estouro do prazo é `transitoria`, declarado pelo hospedeiro.** Não havia
  prazo em camada nenhuma: uma chamada pendurada deixava a vaga em `escrevendo` para sempre. Agora o
  transporte do app aborta em 60 s (o mesmo `PRAZO_MS` da bancada) pelo **seu próprio `AbortSignal`**,
  e não pela opção `timeout` do cliente: abortando nós mesmos, sabemos que o aborto foi nosso e o
  classificamos como `transitoria` (que é a definição do núcleo para timeout, e cai no piso sem
  recuar). Deixar o cliente abortar devolveria um erro indistinguível de "o wi-fi caiu", que vira
  `indisponivel` e **recua para o próximo elo**. A classe sobe num `CorpoDaFalha` com o status que a
  5.6 vai emitir para ela — usar o contrato, não falsificar uma resposta HTTP.
  **Divergência conhecida:** `scripts/bancada/motores.ts` ainda mapeia o próprio timeout para
  `semRede`/`indisponivel`. Não foi tocado (é código da 5.4, fora deste diff), mas a bancada e a tela
  classificam o mesmo evento de formas diferentes.

- **2026-09-13 (revisão) — a camada de motores passou a declarar quais recursos ela hospeda.** O
  seletor oferecia escolha para a Retrospectiva, cujo caminho (`lib/edicao-ia.ts`) nunca consulta a
  preferência: um controle inerte, que mente tanto quanto uma opção escondida. Em vez de esconder, a
  camada declara (`HOSPEDAGEM`, fechada sobre `RecursoId`, então recurso novo não compila até alguém
  responder) e o seletor bloqueia com "ainda não usado nesta versão", no mesmo idioma do motor
  indisponível. Sai junto a razão por `grava.admite` e a gramática de id, que agora vem de
  `lerMotorId` e não de `startsWith`.

- **2026-09-13 (revisão) — a guarda nova do `montarPedido` nomeia o ofensor, e detecta por AST.** O
  teto sozinho ficaria verde com a ofensa mudando de lugar (a bancada para, uma tela começa, o número
  continua 1), então a asserção é a lista **exata**. E o detector virou AST: um casador com ponto
  deixava passar `d['montarFrase'](…)` e `const { conferir } = d`. A não-vacuidade passa pelo caminho
  real — arquivos de fixture num diretório temporário, pelo mesmo `chamamMetodo` que as guardas
  chamam —, não por um `RegExp` irmão que poderia divergir do de verdade. `supabase/functions/` entrou
  no alcance, porque é onde a 5.6 vai morar.

- **2026-09-13 (revisão) — o toque numa janela nova durante a espera custa duas chamadas em série.**
  `emCurso` passou a ser chaveado pela janela, então o toque na janela nova dispara leitura própria em
  vez de ser engolido. Mas a fila do motor (uma chamada de nuvem por vez) faz a segunda esperar a
  primeira, que já está condenada ao descarte: o dono pode esperar ~28 s. Cancelar a primeira exigiria
  levar o aborto da máquina até o transporte, que é mudança maior do que esta correção — fica
  anotado, não feito.

- **2026-09-13 — a bancada põe o template junto do motor, empilhado, não "à esquerda".** A spec pede a
  frase do template à esquerda e a do motor à direita, na mesma linha. Num telefone não cabem duas
  colunas de prosa: cada bloco de motor repete a frase do template rotulada logo acima da dele. O que
  faz a comparação é a adjacência na mesma janela, que está preservada; a geometria não.

## Design Notes

**As sete decisões do dono** (artifact "O botão Ler", 12/09 — o pré-requisito de proposta visual está
cumprido):

1. A frase é **manchete**, acima das cinco dimensões, logo abaixo do `PeriodNav`.
2. O gatilho é no **cabeçalho**, no slot que hoje é `HeaderSpacer`.
3. A autoria é uma linha discreta sob a frase, **com o tempo**: `escrito pela nuvem · 17 s`.
4. Na espera: **esqueleto varrendo** na vaga **mais** o motor nomeado ("a nuvem está escrevendo…").
5. Quando o escolhido não escreve, o motivo é **sempre visível**, em palavras, na assinatura.
6. O seletor entra nesta story, já com o aparelho listado como indisponível.
7. No cabeçalho vai **só o ícone**, sem palavra (`reader-outline`).

**O que a decisão 7 obriga.** Sem palavra, o ícone precisa carregar o significado por outros meios,
e isso é critério de aceite, não polimento:
- `accessibilityLabel="Ler esta janela"` e `accessibilityRole="button"` — é o **único texto** que o
  botão tem, e é o que o VoiceOver fala.
- Três temperaturas, nunca some: `colors.primary` quando não há frase · `colors.ink4` e sem toque
  (`accessibilityState={{ disabled: true, busy: true }}`) enquanto escreve · `colors.ink3` depois,
  ainda tocável.
- Não cabe "Reler": quem prova que houve chamada nova é a **assinatura trocando o tempo**.
- Enquanto a vaga está vazia, o texto dela aponta para o ícone; some quando a frase nasce.

**Por que o hook e não a tela.** O dedupe por hash e o descarte de resposta velha são a parte que
erra fácil: o dono troca a janela durante os 13,6 s e a frase da janela anterior chegaria depois. O
hook guarda o hash corrente e compara na volta — a tela só desenha estado.

**A espera é longa por medida, não por suposição:** mediana 13,6 s, pior caso 25,8 s na medição de
12/09. É o que justifica esqueleto e motor nomeado, e o que proíbe barra de progresso.

**A catraca não zera.** O comentário em `architecture.test.ts:1449-1451` diz que a 5.5 leva a fórmula
do período a 0. Não nesta story: a `web/` está congelada, então sobra um ofensor e o teto vai a **1**.
Quem zera é quem trocar a tela da web.

## Verification

**Commands:**
- `pnpm --filter @vitale/shared lint` — exit 0.
- `pnpm --filter @vitale/shared test` — verde, incluindo a catraca em 1 e a barreira nova.
- `pnpm --filter @vitale/web build` e `pnpm --filter @vitale/web test` — verdes (a web não muda, mas
  compila o núcleo como fonte).
- `cd mobile && pnpm exec tsc --noEmit && pnpm exec jest` — verdes.
- `cd mobile && pnpm dlx expo-doctor` — 21/21.
- `git diff --stat -- mobile/app.base.json web supabase scripts/github` — **vazio**.

**Manual checks:**
- `grep -rn "ia-narrar" mobile/src` devolve `motores/index.ts`, `edicao-ia.ts` e `route-name.ts` — e
  mais nada.
- Nenhuma chamada de nuvem roda em teste: `grep -rn "functions.invoke" mobile/src/lib/__tests__`
  devolve vazio.
- O portão do dono fica aberto: ele aperta o ícone no iPhone, lê a frase, troca o motor no seletor e
  compara na tela de desenvolvimento. Verde no CI nunca quer dizer motor funcionando.

## Suggested Review Order

**O caminho da leitura**

- O ponto de partida: a máquina de quatro estados, e quem pode pedir uma leitura.
  [`leitura-da-saude.ts:143`](../../mobile/src/lib/leitura-da-saude.ts#L143)

- A decisão que substituiu o `hashDoPedido`: o app não pode calcular o hash, então usa a pré-imagem.
  [`leitura-da-saude.ts:82`](../../mobile/src/lib/leitura-da-saude.ts#L82)

- O dedupe é por chave, não global — o toque numa janela nova abre a sua própria leitura.
  [`leitura-da-saude.ts:271`](../../mobile/src/lib/leitura-da-saude.ts#L271)

**A porta da nuvem, no aparelho**

- O único arquivo do app que pode nomear a function; tudo o mais entra pela porta do núcleo.
  [`motores/index.ts:42`](../../mobile/src/lib/motores/index.ts#L42)

- O prazo é nosso, com `AbortController` próprio: só assim o estouro é `transitoria` e não recua.
  [`motores/index.ts:130`](../../mobile/src/lib/motores/index.ts#L130)

- Status não-2xx é dado, não exceção — o desembrulho depende de um contrato de versão do cliente.
  [`motores/index.ts:125`](../../mobile/src/lib/motores/index.ts#L125)

**O que a tela diz, e como diz**

- O gatilho de ícone puro: o rótulo de acessibilidade é o único texto que ele tem.
  [`saude.tsx:124`](../../mobile/src/app/sono/saude.tsx#L124)

- A contagem passou a sair da entrada pura — é o conserto do "± 0 min" na noite única.
  [`saude.tsx:90`](../../mobile/src/app/sono/saude.tsx#L90)

- O ícone não aceita toque enquanto as notas da janela não chegaram: chamada paga não se descarta.
  [`saude.tsx:107`](../../mobile/src/app/sono/saude.tsx#L107)

- O motivo da queda ao piso, em palavras — nenhuma classe do núcleo vira jargão na tela.
  [`assinatura.ts:143`](../../mobile/src/lib/assinatura.ts#L143)

- A assinatura por estado, com o tempo também no piso: é ele que prova a chamada nova.
  [`assinatura.ts:189`](../../mobile/src/lib/assinatura.ts#L189)

- A legenda muda com o alcance: quatro dimensões na noite, e o horário mede outra coisa.
  [`saude.tsx:169`](../../mobile/src/app/sono/saude.tsx#L169)

**A escolha do motor**

- Que recursos o app de fato hospeda — fechado sobre `RecursoId`, então um recurso novo não compila.
  [`motores/catalogo.ts:136`](../../mobile/src/lib/motores/catalogo.ts#L136)

- Um só lugar decide por que um motor está bloqueado: indisponível, não admitido ou não usado ainda.
  [`motores/catalogo.ts:173`](../../mobile/src/lib/motores/catalogo.ts#L173)

- Os recursos vêm do catálogo do núcleo, nunca de lista à mão.
  [`motores/index.tsx:112`](../../mobile/src/app/configuracoes/motores/index.tsx#L112)

- Uma chave, um dono, e fila encadeada porque AsyncStorage não tem read-modify-write atômico.
  [`motores/preferencia.ts:87`](../../mobile/src/lib/motores/preferencia.ts#L87)

**As barreiras que a story fecha**

- A barreira que faltava: só o orquestrador percorre a sequência do descritor (AD-2).
  [`architecture.test.ts:1616`](../../packages/shared/src/architecture.test.ts#L1616)

- A catraca irmã nomeia o ofensor, para a ofensa não mudar de lugar em silêncio.
  [`architecture.test.ts:1631`](../../packages/shared/src/architecture.test.ts#L1631)

- A fórmula do período caiu de 2 para 1: sobra a tela da web, congelada nesta story.
  [`architecture.test.ts:1460`](../../packages/shared/src/architecture.test.ts#L1460)

**A contagem e as notas**

- `load()` mescla em vez de substituir — sem isso, `12m` contava 90 dias de nota em silêncio.
  [`sono.store.ts:98`](../../mobile/src/store/sono.store.ts#L98)

- A falha da busca de notas ganhou nome próprio: "quebrou" e "você não deu nota" não são a mesma coisa.
  [`sono.store.ts:145`](../../mobile/src/store/sono.store.ts#L145)

**Periféricos**

- A bancada abandona o que for de outra janela — medir e repintar sob outro cabeçalho é o erro dela.
  [`bancada.tsx:106`](../../mobile/src/app/configuracoes/motores/bancada.tsx#L106)

- A regra escrita onde o próximo agente vai procurar, antes de criar um quarto cliente da function.
  [`mobile/AGENTS.md`](../../mobile/AGENTS.md)
