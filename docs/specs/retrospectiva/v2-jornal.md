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
| Diagramação estável — mesmas seções, mesma ordem | Sistema de blocos (§6) |
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
- **Sistema de blocos** com prova de gráfica e congelamento (§6).

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

## 6. Sistema de blocos — e o critério de morte

O usuário pediu explicitamente: *"incluir ideias, ver quais uso mais, e depois refinar ou
remover."* Isso só funciona se remover for barato.

- Cada seção da retro vira um **bloco** com `id`, ordem e visibilidade, persistidos em
  `user_preferences` (a mesma jsonb do `notification_prefs`).
- Adicionar bloco = uma entrada. Matar bloco = deletar uma entrada. Sem cirurgia no
  template.
- **Reordenar é o sensor.** O que ele mais usa sobe. Sem telemetria — o app tem um
  usuário; a decisão explícita vale mais que o evento.

### 6.1 Prova de gráfica → congelamento

Aqui existe uma tensão real e ela tem resolução:

> Um jornal é **igual toda edição** — é a definição. Isso briga com blocos que o leitor
> rediagrama toda semana. Um jornal reordenável não é jornal, é feed.

**Resolução:** os primeiros **60 dias** são a *prova de gráfica*. Ele testa, esconde,
mata. Depois disso:

- **bloco escondido por 60 dias sem reativação → sai do código;**
- a diagramação **congela** e o controle de ordem deixa de ser exposto.

Portfólio primeiro, publicação depois. A regra é a mesma; ganhou linha de chegada.

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

---

## 8. Ordem de implementação

1. **Camada 0** (§2) — shared primeiro, depois as duas plataformas. Provado por T1–T6.
2. **Forma 05** (§3) — a manchete. Só faz sentido depois de 1.
3. **Forma 03** (§5) — a mais barata: um seletor sobre agregação existente.
4. **Forma 02** (§4) — o componente novo, genérico em `N`.
5. **Sistema de blocos** (§6) — quando houver mais de um bloco para ordenar.
6. *(Depois, quase de graça)* Aposta 01: o heatmap da §4 com `N = 7` no modo semanal.

> **Não comece pela forma.** As três formas em cima da v1 decoram números que o usuário
> já lia. É a Camada 0 que muda o que a retro é capaz de dizer.

---

## Procedência

Sessão de round-table de 2026-08-25 (`_bmad-output/party-mode/memories/installed/.memlog.md`).
Mockups: "Cinco Apostas da Retro" (as 5 opções, web) e "As Três no Telefone" (as 3
escolhidas, pele mobile real, toque no lugar de hover).
