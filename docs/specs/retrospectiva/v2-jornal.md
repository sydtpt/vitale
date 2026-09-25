# Retrospectiva v2 — o jornal

> Status: **especificado, não implementado** · decidido em 2026-08-25
> Base: [`spec.md`](spec.md) (v1, implementado). Este documento descreve **só o delta**.

## Princípio declarado

> **A Retrospectiva é um jornal.** Ela informa o que aconteceu; não aconselha o que fazer.

Decisão do usuário. Vale como **regra de desempate** para toda dúvida que este spec não
antever:

| O jornal tem | Aqui é |
|---|---|
| Manchete — uma por edição | O parágrafo (§3), no topo da tela |
| Editor que escolhe a manchete | A ordenação por classe (§2.2) |
| Diagramação estável — mesmas seções, mesma ordem | Sistema de blocos (§6) — congelada desde a Story 2.5 |
| Gráfico como apoio, nunca como a matéria | Heatmap (§4) e séries (§5), dentro de seções |
| Caixa de correções | Exibição do `n` (§2.3) e do "não medido" |
| Página de opinião, separada | **Fora deste escopo** → F3 no `backlog-de-features.md` |

**Plataforma: mobile primeiro.** O usuário lê a retro **sempre no celular**, semanal e
mensalmente. A web recebe o mesmo trabalho depois — e só se sentir falta. Como toda a
agregação vive no `@vitale/shared` e as plataformas só renderizam, isso **não duplica
lógica nenhuma**.

---

## Por que a v1 não entrega o que promete

Três defeitos verificados no código, não suspeitas. São a razão de a v2 existir e de a
Camada 0 vir antes de qualquer forma nova.

**D1 — O insight cruzado nunca aparece no modo mais usado.**
`retroSince` ([`mobile/src/store/retro.store.ts:179`](../../../mobile/src/store/retro.store.ts),
e a mesma expressão inline em
[`retrospectiva-page.component.ts:62`](../../../web/src/app/features/retrospectiva/pages/retrospectiva-page.component.ts))
busca a partir do **início do período anterior** — no modo semanal, uma janela de 14 dias.
`triggerImpact` exige `MIN_DAYS_PER_SIDE = 3` de cada lado. Numa semana de 7 dias, o
gatilho precisa cair em exatamente 3 ou 4 dias para o insight existir. Na prática:
`enough === false`, `continue`, nada na tela.

**D2 — Quando aparece, perde.**
`buildRetroHighlights` ordena por `priority` decrescente
([`retro.ts:692`](../../../packages/shared/src/period/retro.ts)), e `priority` é
`Math.abs(deltaPct)`. Dois treinos virarem três = **+50% → prioridade 50**. O insight
gatilho×saúde recebe `Math.abs(deltaPct) + 3` — sono −8% = **prioridade 11**.
Estatística de volume esmaga o achado, estruturalmente, sempre.

**D3 — A tela joga fora a amostra.**
`MetricImpact` já devolve `nWith` e `nWithout`
([`trigger-impact.ts:29-30`](../../../packages/shared/src/health/trigger-impact.ts)).
Nenhuma das duas plataformas exibe. Uma afirmação estatística sem `n` é opinião com
fonte bonita.

---

## 1. Escopo

**Dentro:**
- **Camada 0** — quatro correções (§2). Bloqueia tudo o mais.
- **Forma 05 — o parágrafo** (§3). A manchete.
- **Forma 02 — heatmap genérico em N** (§4).
- **Forma 03 — seletor das séries do `MonthBucket`** (§5).
- **Sistema de blocos** (§6). *A prova de gráfica e o congelamento que estavam aqui foram
  revogados na Story 2.5 — ver §6.1.*

**Fora:**
- Seção de dicas/conselho → **F3** no `backlog-de-features.md`.
- Faixa de 7 dias (aposta 01) e números grandes (aposta 04) → **na fila**, não mortas.
  A 01 sai quase de graça depois da §4, por construção.
- Web. Depois do mobile, se fizer falta.
- Tabela real de `transactions` (limitação conhecida da v1, inalterada).

---

## 2. Camada 0 — o conserto

> Sem isto, a Forma 05 escreve *"3 treinos, +1 vs. semana anterior"* — a tabela em prosa.
> **É pré-requisito, não recomendação.**

### 2.1 Janela de análise ≠ janela de exibição

Você **exibe** o período selecionado. Você **analisa** os últimos **90 dias**. O insight
fala de você, não da semana; a semana é só quando você olha.

- `retroSince(now, kind, offset)` passa a devolver o **menor** entre (a) o início do
  período anterior e (b) `hoje − ANALYSIS_WINDOW_DAYS`.
- Nova constante exportada no shared: `ANALYSIS_WINDOW_DAYS = 90`, num lugar só.
- A mesma mudança na expressão inline da web — ou, melhor, **extrair `retroSince` para o
  shared** e as duas plataformas passarem a importar. Hoje a regra está duplicada.
- Custo de rede: `ensure()` já guarda `loaded <= since`
  ([`retro.store.ts:72`](../../../web/src/app/features/retrospectiva/data/retro.store.ts)),
  então a janela larga é paga **uma vez** e navegar ‹ › não refaz fetch.
- `activities` não muda: `ActivitiesStore` já carrega histórico completo.

> **Invariante:** a janela larga afeta **só** os derivadores de associação
> (`triggerImpact`). Todos os `RecapValue` (soma, média, delta vs. período anterior)
> continuam calculados **estritamente dentro do período exibido**. Misturar os dois é o
> jeito mais fácil de quebrar a v1.

### 2.2 Ordenação por classe

`buildRetroHighlights` deixa de ordenar por `Math.abs(deltaPct)` puro. Cada destaque
ganha uma **classe**, e a classe domina a ordem; o `deltaPct` só desempata dentro dela.

| Classe | Peso | O que é |
|---|---|---|
| `cross` | 1000 | Insight cruzado (gatilho × saúde). A manchete candidata. |
| `health` | 300 | Métrica de saúde com variação relevante. |
| `anomaly` | 200 | Recorde, maior esforço, extremo do período. |
| `volume` | 100 | Contagem/soma/distância. O que hoje ganha sempre. |

Ordenação final: `(peso da classe, |deltaPct|)` decrescente.

- `WeekHighlight` ganha o campo **opcional** `kind?: HighlightKind` em
  [`week/highlights.ts`](../../../packages/shared/src/week/highlights.ts). **Opcional é
  obrigatório aqui** — o mesmo tipo alimenta os destaques da tela Semana, que não deve
  mudar de comportamento.
- Ausência de `kind` = `volume`.

### 2.3 O `n` na tela

Todo destaque de classe `cross` exibe a amostra. Formato:

> Nos dias com "cerveja", sono −8%
> `24 dias com · 66 sem · associação, não causa`

- A linha de apoio é **parte do destaque**, não tooltip: no celular não existe hover.
- `MetricImpact` já carrega `nWith`/`nWithout`. É trabalho de render, não de cálculo.

### 2.4 `sinceDate` no `triggerImpact`

O parâmetro existe na assinatura
([`trigger-impact.ts:44`](../../../packages/shared/src/health/trigger-impact.ts)) e o
retro nunca passa. Com a janela de 90 dias isso deixa de ser cosmético: um hábito criado
há 20 dias compararia contra dias em que ele **nem existia**.

- Passar `sinceDate` = data de criação do gatilho, quando conhecida.
- Quando desconhecida, o começo da janela de análise.

### 2.5 O universo do insight cruzado

Hoje o cruzamento olha **uma** métrica: `sono ?? vfc`
([`retro.ts:670-671`](../../../packages/shared/src/period/retro.ts)). Com 90 dias de
amostra, abrir para todas as métricas de saúde disponíveis + os ratings subjetivos passa
a ser viável — e é o que multiplica o valor da janela larga.

- Manter o piso `|deltaPct| >= 5` para não publicar ruído.
- **Um destaque `cross` por edição** (o de maior `|deltaPct|`) chega à manchete; os demais
  ficam na lista. Um jornal tem uma manchete.

---

## 3. Forma 05 — o parágrafo (a manchete)

Duas ou três frases em PT-BR sobre o período, no **topo** da tela, antes de qualquer
número.

- Fonte: os destaques já ordenados pela §2.2, costurados em prosa. Não é um gerador novo
  — é `buildRetroHighlights` **promovido**.
- Assinatura sugerida: `buildRetroLede(summary, highlights, input): RetroLede`, no shared,
  puro, ao lado de `buildRetroHighlights`.
- Vale nos cinco modos (`week` · `month` · `season` · `year` · `all`). Em `all` sai **sem
  delta** — a v1 já degenera o `prev` ali, e o texto tem que respeitar isso.
- Estrutura: 1ª frase = o fato do período · 2ª = a variação que importa · 3ª = o insight
  `cross` com o `n`.
- **Honestidade obrigatória:** quando a amostra não basta ou a fonte não mediu, a frase
  diz que não sabe. Isso não enfraquece o texto — é a caixa de correções.

> **Caso concreto a respeitar:** o Garmin escreve `INBED` 1 s antes do sono, então o
> `onset` é **0 por não-medição**, não por virtude (corrigido no `AGG_VERSION` 5 em
> 2026-08-25). Nenhuma frase pode narrar um gap de firmware como conquista.

### 3.1 A notificação de domingo

O parágrafo tem três frases e o usuário lê sempre no celular. Então ele **cabe numa
notificação** — e abrir o app vira o passo opcional, não o requisito.

- Reusa o que já existe: notificações locais + retros agendadas, prefs em
  `user_preferences.notification_prefs` (jsonb).
- Gatilho: fechamento da semana (domingo ≥ 20h — a mesma regra de
  `latestAvailableOffset`).
- Corpo = as duas primeiras frases do lede. Toque abre a retro no período certo.
- **Depende da migration de `notification_prefs` estar aplicada em produção** — pendência
  conhecida, anterior a este spec.

---

## 4. Forma 02 — heatmap **genérico em N**

Uma célula por dia, uma métrica por vez, **escala divergente em torno de uma meta**.

**A decisão que carrega o resto:** o componente é `N` células, **não** "calendário de 31
dias". Com isso a aposta 01 (faixa de 7 dias no modo semanal) vira **um parâmetro**, não
um projeto — e sai depois praticamente de graça.

- **Escala divergente, não sequencial.** Quente abaixo da meta, frio acima, neutro em
  cima da linha. Sequencial deixaria a noite ruim **pálida** — apagaria exatamente o que
  importa.
- Steps validados (ordem: pior → melhor), monotônicos em luminosidade por braço:
  `#B83C12` · `#F25C2B` · `#FBAF8C` · `#EFE6D8` (neutro) · `#AFC0E2` · `#6E8CC9`
- **Sem hover.** Toque numa célula → o valor aparece numa **leitura fixa** abaixo da
  grade e **fica lá**. Nada some quando o dedo sai.
- Dia sem dado é visualmente distinto de dia neutro. Um jornal não finge que mediu.
- Dimensão real: 7 colunas em ~311 px de largura útil = células de **~40 px**. Alvo de
  toque confortável.
- Seletor de métrica **compartilhado com a §5** — construído uma vez.

### 4.1 Meta por métrica

O divergente exige saber a meta. **No dia 1 a meta é uma constante no shared** — sono
7 h — e não uma preferência configurável.

- Racional: descobre-se se o número está certo **usando**, num domingo real. Se ele
  reclamar do 7 h, aí se constrói o campo. Isso é sequenciamento, não dívida.
- Quando virar configurável, seguir o padrão que já existe no repo:
  `DEFAULT_* / MIN_* / MAX_* / resolve*()` de
  [`who-activity.ts:41-55`](../../../packages/shared/src/health/who-activity.ts), lendo de
  `user_preferences`.
- **Invariante:** a constante mora em **um** arquivo. Meta chumbada em três lugares é
  como isto vira dívida de verdade.

---

## 5. Forma 03 — as séries do `MonthBucket`

`buildYearByMonth` já calcula **seis** séries: `workouts`, `distanceKm`, `tasks`,
`spend`, `habitDays`, `floors`. A tela desenha **uma**. Esta forma não constrói gráfico —
**coloca um seletor em cima de um que já existe.**

- Zero trabalho de agregação. `MonthBucket` fica intacto.
- **Rótulo por barra morre.** Doze barras em ~311 px = ~22 px cada; `402 km` em cima de
  cada uma é fisicamente impossível. O rótulo vira **um por vez**, o da barra tocada, na
  mesma leitura fixa da §4.
- **Os seis chips rolam na horizontal**, não quebram linha. Três fileiras de chip comem a
  tela antes do gráfico começar.
- A cauda vazia do ano corrente (Set–Dez em agosto) é estado normal e deve ler como
  "ainda não aconteceu", não como zero.

---

## 6. Sistema de blocos

O usuário pediu explicitamente: *"incluir ideias, ver quais uso mais, e depois refinar ou
remover."* Isso só funciona se remover for barato.

- Cada seção da retro vira um **bloco** com `id`, ordem e visibilidade, persistidos em
  `user_preferences` (a mesma jsonb do `notification_prefs`).
- Adicionar bloco = uma entrada. Matar bloco = deletar uma entrada. Sem cirurgia no
  template.
- **Reordenar era o sensor.** O que ele mais usava subia. Sem telemetria — o app tem um
  usuário; a decisão explícita vale mais que o evento. *(As setas saíram na Story 2.5 — ver
  §6.1.)*

### 6.1 Prova de gráfica → congelamento — **revogada na Story 2.5**

Aqui existia uma tensão real:

> Um jornal é **igual toda edição** — é a definição. Isso briga com blocos que o leitor
> rediagrama toda semana. Um jornal reordenável não é jornal, é feed.

**A resolução original** foram os primeiros **60 dias** como *prova de gráfica*: ele testa,
esconde, mata; depois disso, bloco escondido por 60 dias sem reativação sairia do código, e a
diagramação **congelaria** — o controle de ordem deixando de ser exposto.

**As duas regras saíram em 23/09/2026** (Story 2.5), e o motivo de cada uma:

- **o congelamento**, porque o que ele protegia já é verdade sem ele: a ordem do miolo da
  revista vem da coluna `posicao`, gravada na impressão, e não da `order` desta tela. O que
  restava era um botão que sumiria em 24/10/2026 e levaria junto o único caminho até o painel;
- **os 60 dias**, porque `deadBlocks` nunca teve um chamador de produção. Regra que ninguém
  executa não é regra, é prosa — e o campo que ela lia (`hidden[id]`, a data) ficou na forma
  sem ninguém para lê-lo. Isso está declarado no TSDoc de `RetroPrefs`, para não ser
  redescoberto como defeito.

**A `order` já gravada fica e continua valendo** — ela só deixou de ser editável na tela.
`proofStartedOn` sai de `RetroPrefs`; um jsonb antigo que ainda o tenha perde a chave em
silêncio na primeira gravação, porque `resolveRetroPrefs` monta o objeto do zero.

**O custo novo, declarado:** um bloco criado **depois** da 2.5 entra no fim da `order` já
salva — é o que `resolveRetroPrefs` sempre fez, para que uma seção nova nunca suma — e
**fica lá para sempre**, porque não há mais UI para movê-lo. Hoje a `order` do dono tem 13
entradas e as cinco primeiras são as que ele lê; o 14º bloco nasceria abaixo delas, sem
recurso. As saídas, quando isso incomodar, são três e nenhuma é gratuita: devolver as setas,
dar ao bloco novo uma posição autoral no catálogo com um passe de resolução que a respeite,
ou zerar a `order` dele de propósito. É o mesmo tipo de custo que a data não lida em
`hidden` e a perda silenciosa por app antigo — declarado aqui para não ser redescoberto
como defeito.

### 6.2 Silenciar um caderno da revista (Story 2.5)

O painel ganhou uma **segunda lista**, e ela é de outro vocabulário: os quatro **cadernos da
revista** (`CadernoId`, dono único em `period/cadernos.ts`), com um olho cada, em
`RetroPrefs.cadernosOcultos`.

Silenciar é a única forma de **contrariar a revista**. O caderno silenciado:

- some do miolo, do sumário e da manchete — que passa para o **primeiro caderno visível**,
  nunca nula por causa do buraco na `posicao`;
- **deixa de ser pedido à nuvem** quando o telefone imprime: o filtro entra em
  `OpcoesDaImpressao.cadernos`, a lista de candidatos, **antes da primeira chamada paga**;
- **continua gravado**. Silenciar nunca escreve em `edicoes_ia`, e caderno fora de `pedidos`
  sobrevive à sequência — dessilenciar traz de volta tudo o que já foi impresso.

O núcleo não conhece preferência: quem filtra é o hospedeiro. O telefone lê
`cadernosVisiveis(prefs)` e passa; `scripts/revista/imprimir.ts` segue sem passar, e imprime
os quatro.

---

## 7. Testes

`mobile/src/lib/__tests__/retro.test.ts` já existe e cobre `periodBounds`,
`latestAvailableOffset`, `buildRetrospective` e `buildYearByMonth`. O acréscimo é puro,
sem I/O:

| # | Teste | Prova |
|---|---|---|
| T1 | `retroSince` no modo `week` devolve ≥ 90 dias | §2.1 |
| T2 | `RecapValue` inalterado com janela larga | invariante da §2.1 |
| T3 | Destaque `cross` fica **acima** de um `volume` com `deltaPct` maior | §2.2 — se o topo não muda, o conserto não funcionou |
| T4 | `kind` ausente ⇒ tratado como `volume`; destaques da Semana intactos | não-regressão |
| T5 | `cross` renderiza `nWith`/`nWithout` | §2.3 |
| T6 | `sinceDate` descarta dias anteriores à criação do gatilho | §2.4 |
| T7 | Heatmap genérico: `N = 7`, `N = 28`, `N = 31`, mês começando no domingo | §4 — testar o genérico, **não** "julho" |
| T8 | Dia sem dado ≠ dia neutro | §4 |
| T9 | Lede em `all` sai sem delta | §3 |

**Story 2.5 — o silêncio (§6.2).** As suítes vivem em três arquivos, e a divisão é o
critério: o núcleo com o núcleo, a tela com as fixtures da tela, e a fiação numa barreira
de código-fonte.

| # | Teste | Onde | Prova |
|---|---|---|---|
| T10 | `cadernosVisiveis` sobre jsonb bom, podre (`7`, `'x'`, `[]`, id inventado, valor não-string) e **ausente** | `retro.test.ts` | §6.2 — o guarda é `isCadernoId`, e chave ausente ⇒ os quatro |
| T11 | Carimbo `''` não atravessa a resolução, nos **dois** mapas | `retro.test.ts` | §6.2 — `resolveRetroPrefs` e o `if (ocultos[id])` dos leitores têm que concordar |
| T12 | `toggleCaderno` sobre `RetroPrefs` **legado**, sem a chave | `retro.test.ts` | o caminho real de todo aparelho vindo do build anterior |
| T13 | A `order` salva sobrevive; `proofStartedOn` cai em silêncio | `retro.test.ts` | §6.1 — o editor saiu, o dado ficou |
| T14 | Manchete passa ao **primeiro caderno visível**; miolo e sumário sem o silenciado | `edicao-store.test.ts` | §6.2 — `find(posicao === 1)` devolveria `undefined` |
| T15 | Os candidatos que chegam à sequência: 3 em vez de 4; ausente sem silêncio; **nenhuma chamada** com os quatro calados | `edicao-store.test.ts` | §6.2 — o efeito econômico, antes da primeira chamada paga |
| T16 | jsonb **cru** do cache: a ação vê a mesma lista que as telas | `edicao-store.test.ts` | a hidratação do boot não resolve; o caminho que paga não pode dispensar a resolução |
| T17 | Silenciar **no meio** de uma impressão não tira o caderno da corrida já paga | `edicao-store.test.ts` | comportamento declarado (o retrato único), não acidente |
| T18 | O beco: miolo vazio por silêncio ganha aviso; com convite ou impressão correndo, cala | `edicao-store.test.ts` | §6.2 — rota sem saída é defeito |
| T19 | As duas telas passam a lista, e a derivam de `resolveRetroPrefs` | `silencio-fiacao.test.ts` | o 4º argumento tem padrão: apagá-lo desliga a feature com a suíte verde |

---

## 8. Ordem de implementação

1. **Camada 0** (§2) — shared primeiro, depois as duas plataformas. Provado por T1–T6.
2. **Forma 05** (§3) — a manchete. Só faz sentido depois de 1.
3. **Forma 03** (§5) — a mais barata: um seletor sobre agregação existente.
4. **Forma 02** (§4) — o componente novo, genérico em `N`.
5. **Sistema de blocos** (§6) — ~~quando houver mais de um bloco para ordenar~~. *Feito, e a
   ordenação foi revogada na Story 2.5 (§6.1): os blocos se escondem, não se movem. O que
   nasceu no lugar foi o silêncio por caderno da revista (§6.2).*
6. *(Depois, quase de graça)* Aposta 01: o heatmap da §4 com `N = 7` no modo semanal.

> **Não comece pela forma.** As três formas em cima da v1 decoram números que o usuário
> já lia. É a Camada 0 que muda o que a retro é capaz de dizer.

---

## 9. O bloco Sono (05/09/2026)

> Pedido do usuário: *"incluir análises de sono na retrospectiva — uma média de quanto
> estou acordando por noite, tempos de sono por fase, e outras ideias"*. E a direção:
> *"a retrospectiva vai virar um relatório, com análises e números para eu revisar por
> período"*. Proposta com dados reais aprovada no artifact "Sono no Jornal"
> (`claude.ai/code/artifact/73f0edb9-ae85-42d5-9216-0d51b39c2d0c`); as quatro decisões
> pendentes foram todas "sim".

**Fonte.** `sleep_periods` (a noite como evento), não `health_daily.sono` (uma soma por
dia). O `RetroInput` ganha `sleepPeriods`; o `RetroSummary` ganha `sleep: SleepRetro |
null`. Tudo puro em `packages/shared/src/sleep/retro.ts`, testado em `sleep-retro.test.ts`.

**A noite típica** (`sleepRetro(cur, prev, ratings, markers)`), em cinco linhas do bloco
`sleep` (id novo em `RETRO_BLOCKS`, entra no fim da ordem salva):

| Linha | O que diz | Regra |
|---|---|---|
| Quanto dormi | média por noite · diferença em **minutos** vs período anterior · noites com 7 h ou mais | \|Δ\| < 5 min é "o mesmo" |
| Quando | apagou · acordou como **medianas**, com o miolo p25–p75 | regularidade como fato, sem índice |
| Acordado por noite | minutos, despertares por noite, noites com despertar, o mais longo | `null` = a fonte não reporta ≠ zero |
| Por fase | a noite média como **uma barra** (REM · Leve · Profundo · acordado) e os minutos de cada, com Δ | estimativa do relógio, comparável com você mesmo |
| Como acordou | nota média e, por lado (≥ 4 · ≤ 3), quanto dormiu e ficou acordado | o par que só o Orbe tem |

Em **Mês** e **Estação** entram a faixa **semana a semana** (noite típica de cada semana com
≥ 3 noites) e **fim de semana × semana** — o jetlag social de Roenneberg dito em minutos,
só com ≥ 2 noites de cada tipo. Em **Total** os deltas somem, como nos outros blocos.

**A linha "Sono" sai do card Saúde**, e "Sono percebido" também, enquanto o bloco existir:
dois lugares dizendo horas dormidas é o que a v1 fazia com volume. O id `sono` continua em
`HEALTH_SPECS` — a grade diária e o cruzamento gatilho × saúde dependem dele.

**A manchete aprende sono** (`sleepHighlights`): horas e vigília como `health`; **nota ×
medição como `cross`**, tom neutro, só com ≥ 3 noites de cada lado — e pode abrir a edição
do mês (decisão do usuário). A caixa de correções nomeia o `n` do período anterior e o
marcador de troca de relógio: quando a comparação o cruza, `delta.awakeMin` é `null`.

**Gatilho × noite** (mesmo dia, "seguir"): o cruzamento da §2.5 passa a comparar também
**dormido, acordado, REM e profundo** das noites (`sleepCrossMetrics`), **chaveados pelo dia
em que a noite começou** — a soma diária comparava a noite anterior ao gatilho, e sai do
universo assim que há noites. Texto em valores absolutos: *nas noites depois de "Cerveja",
dormiu 5h52 contra 6h47 · 9 noites com · 49 sem*. **Séries do ano:** `MonthBucket` ganha
`sleepH` e `awakeMin`, e o bloco "Por mês" dois chips — Sono (azul da água) e Acordado
(amarelo).

**Fora, por decisão:** saldo contra 7 h (tem cara de placar), SRI como número (fórmula não
conferida no original), qualquer nota composta. **Fila:** grade diária de "acordado"
centrada na mediana, extremos do período.

### 9.1 A página completa (06/09/2026)

> Pedido: *"quero levar a Saúde do sono para a retrospectiva também… é uma das seções mais
> importantes e quero que seja bem completa, seguindo a ideia de ser um jornal"*. Proposta com
> dados reais de agosto de 2026 no artifact "O Sono no Jornal"
> (`claude.ai/code/artifact/a0f5d8f4-5439-46c9-a0d2-de54ab391dce`); as quatro decisões
> respondidas: selo **dentro** do bloco, **todas** as seis pautas, semana **também** com selo,
> web **junto**.

**Duas das três exclusões acima caducaram**, e por motivo, não por gosto:

- **SRI como número** estava fora porque a fórmula não fora conferida no original. O
  [Phillips 2017](https://www.nature.com/articles/s41598-017-03171-4) foi lido em 06/09; a
  implementação em `regularity.ts` está correta. Ele entra — como dimensão do selo e como a
  faixa semana a semana.
- **Nota composta** estava fora porque não havia uma defensável. Agora há: a **Saúde do sono**
  da [ADR 0036](../../decisions/0036-saude-do-sono-e-contagem-nao-placar.md), que é contagem e
  não placar.
- **Saldo contra 7 h continua fora**, e o selo não o reintroduz: ele conta quantas noites
  chegaram a 7 h, nunca quantas faltaram.

**O selo** entra no bloco Sono, depois da tarja e antes do corpo — é o resumo em caixa da
página, não a chamada de capa. Vale em **Semana, Mês, Estação e Ano**; em **Total** não há
selo, porque "sempre" não tem denominador de cobertura. Abaixo de 70% das noites a contagem
some e as medidas ficam, e a caixa de correções passa a dizer isso.

**As seis pautas**, todas medidas em agosto de 2026 (27 noites de 31):

| Pauta | O que muda | Regra |
|---|---|---|
| Média × mediana | o número grande passa a ser a **mediana**; a média entra embaixo quando discordam | `MEAN_MEDIAN_GAP_MIN` = 10 min. Em agosto: média 6h38, mediana 7h02, e a diferença inteira é a noite de 58 min do dia 7 |
| A que horas a noite quebra | faixa de barras por hora sob "Acordado", com o pico cheio | conta **noites**, não eventos. Em agosto: 12 noites entre 4h e 5h |
| Duração dos despertares | linha "acima de 5 min: 27 de 85" | é o critério de contagem do consenso Ohayon 2017 — a contagem crua sugere uma noite picada que a distribuição desmente |
| Regularidade por semana | segunda faixa de barras, ao lado das horas por semana | o índice roda só no **trecho contíguo** de cada semana; buraco não vira constância |
| Nota por faixa de duração | dentro de "Como você acordou", o corte ao contrário | responde "vale a pena dormir mais?", que o corte por nota não responde. Em agosto: 3,00 abaixo de 6 h, 4,00 acima de 7 |
| Os extremos com data | duas ou três linhas que fecham a página | jornal nomeia. Sem adjetivo, sem elogio |

**No Ano e no Total a contagem não serve, e dizer isso é o conteúdo.** Rodada nos doze meses
do histórico, ela existe em **dois**: só outubro/25 e agosto/26 passam do piso de cobertura.

**Onde:** `sleepRetro` ganha `opts` (`expectedNights`, `history`) e devolve `score`, `medianH`,
`meanMedianSplit`, `bands`, `awakeHours`, `awakeSpread`, `regularityWeeks` e `extremes`; o
`period/retro.ts` calcula o denominador pelo calendário do período, com a janela corrente
valendo até hoje. `SleepRetroCard.tsx` no mobile e `sleep-retro-card.component.ts` na web — a
**web recebe o bloco pela primeira vez**; ela já calculava `summary.sleep` desde 05/09 e não o
desenhava.

---

## Procedência

Sessão de round-table de 2026-08-25 (`_bmad-output/party-mode/memories/installed/.memlog.md`).
Mockups: "Cinco Apostas da Retro" (as 5 opções, web) e "As Três no Telefone" (as 3
escolhidas, pele mobile real, toque no lugar de hover).
