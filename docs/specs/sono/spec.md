---
id: SPEC-sono
companions:
  - data-model.md
  - plan.md
sources:
  - _bmad-output/planning-artifacts/research/competitive-apps-e-wearables-de-analise-de-sono-2026-09-04/research.md
---

> **Contrato canônico.** Este SPEC e os arquivos em `companions:` são o contrato completo
> do que construir, testar e validar.
>
> **Origem:** pesquisa competitiva de 04/09/2026 (49 fontes, verificação de citações
> aplicada) + party mode de 04/09/2026, que consultou as **308 noites reais** em produção e
> derrubou duas premissas da pesquisa. Onde os dois divergem, **o dado do banco vale** — as
> divergências estão registradas em §7.

# Sono — a tela do fato, não do placar

## 1. Why

O Orbe **não tem uma feature de sono**. Tem um número que alimenta outras features: a
prontidão em `/recuperacao`, o cruzamento da retrospectiva e o chip de nota 1–5 no Hoje.
A única superfície de leitura é `Saúde › Sono`, que usa o **template genérico de métrica**
(`mobile/src/app/saude/[metric].tsx`) e por isso erra de três formas:

| Defeito | Causa |
|---|---|
| No modo "Dia", a noite inteira vira uma barra na hora em que o usuário **acordou** | `bucketize` posiciona pelo `s.start`, e o `start` do sono é o instante de acordar |
| O número grande é a **soma do mês** ("217 h · total no período") | `kind: 'cumulative'` no catálogo de métricas |
| A legenda diz **"média/hora"** | herdada de passos/calorias |

O usuário confirmou o sintoma: *"não abro, a view está confusa"*.

E o app **sabe coisas que nunca contou**. Desde o bump de `AGG_VERSION` 3 e 4, com 500 dias
de backfill já rodados, cada noite grava no `extra` de `health_daily`: `deep`, `rem`,
`core`, `unspecified`, `awake`, `inbed` e `onset`. **Nenhuma tela do Orbe lê qualquer um
deles.** O usuário não sabia que estavam lá.

O que ele quer ver de manhã, nas palavras dele: **"que horas eu dormi de fato — e também a
hora que deitei"**. É hora do relógio, e é exatamente o que
`mobile/src/lib/health-buckets.ts:356-362` calcula (`n.onset`) e **descarta**, gravando o
horário de acordar duas vezes em `start` e `end`.

## 2. Princípio

**A tela entrega o fato e para de falar.**

Não existe nota de sono, score, streak, seta de tendência ou meta. A regularidade — a
métrica com maior poder preditivo demonstrado na literatura — **não aparece como índice**:
ela aparece como *forma*, porque barras alinhadas parecem alinhadas. O usuário lê o gráfico,
não um número sobre o gráfico.

Isso não é preferência estética. É a resposta a três achados convergentes da pesquisa: o
padrão nº 1 de reclamação da categoria inteira é "a nota discorda do corpo" (4 fontes
independentes, + class action contra a Oura em 08/2026); ortossonia é entidade clínica com
prevalência de ~3–5%; e a especificidade sono/vigília destes aparelhos contra polissonografia
tem médias de 30% a 61%. **Um placar que a categoria mede mal, e que documentadamente causa
dano, não é o que falta ao Orbe.**

## 3. Capabilities

- **CAP-1** — Ver a que horas dormi
  - **intent:** Ao acordar, o usuário abre a tela e lê, em texto, os instantes da noite:
    deitou · apagou · acordou.
  - **success:** Os três horários vêm de `sleep_periods` (não de duração reconstruída). A
    tela **nunca faz a subtração** entre deitar e apagar, nem rotula "latência" — o buraco
    entre dois relógios é lido pelo usuário. Quando `in_bed_at` não existe, o campo aparece
    vazio com a explicação ("seu relógio não registra a hora de deitar"), **nunca** preenchido
    com o horário de apagar e nunca oculto.

- **CAP-2** — Ver a forma das minhas noites
  - **intent:** O usuário vê as últimas ~14 noites posicionadas na hora do dia e percebe
    regularidade ou desordem sem ler número nenhum.
  - **success:** Eixo Y é hora do dia invertido (deitar em cima, acordar embaixo); eixo X são
    as noites; cada noite é uma barra vertical; os despertares são **buracos dentro da barra**;
    o tempo na cama é o contorno tracejado ao redor; noite sem dado é célula hachurada, não
    barra de altura zero. Cabe na largura de um telefone sem rolagem horizontal. **Sem seletor
    de período** — a janela rolante é a forma do gráfico, não um controle.

- **CAP-3** — Cruzar minha percepção com a medição
  - **intent:** O usuário vê a nota 1–5 que deu ao acordar contra o que foi medido naquelas
    noites, e o app admite quando os dois discordam.
  - **success:** Agrupa as noites que têm nota **e** medição, mostrando por nota o intervalo
    mín–máx, a média e **o n**. Sem seta, sem "melhorou", sem correlação declarada. Um
    agrupamento com n < 5 é exibido com o n visível para que o usuário saiba que é curiosidade,
    não conclusão.

- **CAP-4** — Ver o detalhe de uma noite
  - **intent:** O usuário abre uma noite e vê a composição por estágio que o app já grava.
  - **success:** Faixa proporcional (profundo · REM · leve · sem estágio) com as durações
    absolutas, **cortada pelos despertares nas posições em que ocorreram** — a vigília é um
    corte na faixa, não uma fatia empilhada no fim. Ao lado, o par bruto: *n despertares ·
    tempo total acordado*. **Rótulo de incerteza obrigatório e legível** — "estimativa do seu
    relógio; vale para comparar você com você mesmo, não é medida clínica". Nunca percentual
    contra norma clínica, nunca base de conselho, nunca texto interpretativo gerado pelo app.

- **CAP-5** — Ver o padrão dos meus despertares
  - **intent:** O usuário quer saber **quando** a noite dele quebra — não quantas vezes na
    média, mas em que ponto da noite, e se isso se repete.
  - **success:** Três leituras da mesma matéria-prima, em três altitudes:
    1. **Dentro da noite** — os buracos na barra de CAP-2 e o corte na faixa de CAP-4.
    2. **Relógio de vigília** — os despertares de todas as noites da janela sobrepostos num
       **único eixo de hora do dia**, revelando se eles se concentram num horário. Responde
       "eu acordo sempre às 3h?", que nenhum score da categoria responde. Densidade, não
       contagem: bandas mais escuras onde mais noites coincidem.
    3. **Duração acordado por noite** — série simples ao lado do timing chart, para o usuário
       ver se a vigília está crescendo, **sem meta e sem faixa de referência**.
  - **success (negativo):** O app **não** deriva score, índice de fragmentação, nem qualquer
    número composto a partir dos despertares. Ver o quadro em §6.
  - **dependência dura:** exige `awakenings` individuais. A fonte atual **reporta** —
    medido em 04/09/2026 — mas a agregação descarta 36 de 38 noites; a correção é
    pré-requisito desta capability e mora na Fase 3. Ver §6.

- **CAP-6** — Substituir `Saúde › Sono`
  - **intent:** Existe **uma** superfície de leitura de sono no app.
  - **success:** O cartão da categoria Sono na aba Saúde navega para `/sono`; `/saude/sono`
    deixa de ser alcançável. O id `'sono'` **permanece** em `metric-catalog.ts` — a prontidão
    (`health-readiness.ts`) e a retrospectiva leem `seriesFor('sono')` e não podem quebrar.

## 4. Constraints

- **Mobile primeiro.** A web não pauta nenhuma decisão desta entrega e entra numa segunda
  rodada, no mesmo contrato de núcleo.
- **Núcleo puro no `packages/shared`.** SRI, midpoint, jetlag social e a derivação de
  `health_daily.sono` a partir dos períodos são funções puras testadas; os apps só renderizam.
  Padrão de `fitness/overview` e `period/retro`.
- **Sem Reanimated** ([ADR 0010](../../decisions/0010-sem-reanimated-no-mobile.md)). Animação
  é o `Animated` do React Native.
- **Cor vem do tema.** Sono usa `moduleOf('agua')` — o papel `blue`. **Sono não é módulo**;
  ver [ADR 0031](../../decisions/0031-sono-e-categoria-nao-modulo.md). Nenhum hex em tela.
- **Sem captura manual noturna.** Decisão explícita do usuário (04/09/2026): o app já cobra
  a nota de manhã, e um segundo ritual à noite cobra caro por um campo. **Custo assumido:**
  quando a janela do sensor errar, não há conserto — é o padrão nº 3 de reclamação da
  pesquisa (3 fontes), aceito conscientemente.
- **Sem notificação matinal com número**, sem streak, sem meta de horas. Guarda-corpo de
  ortossonia (R6 da pesquisa).
- PostgREST corta em 1000 linhas sem erro: todo fetch de série longa usa `range`+`order`
  (`packages/shared/src/data/paginate.ts`).
- RLS por usuário em toda tabela nova.
- **Done inclui conferência visual em escala real e build Release no iPhone.** Mergeado sem
  rodar no aparelho não conta como entregue.

## 5. Recorte do V1

**Entra:** CAP-1 a CAP-6. CAP-5 depende da correção do agregador na Fase 3 (§6) — sem ela
nasce vazia na fonte atual; com ela, viva em todo o histórico.

**Fica para depois:**

| Fora do V1 | Por quê |
|---|---|
| Score / nota de sono de qualquer tipo | §2 — é o princípio, não um corte de escopo |
| Hipnograma com scrub | O card de estágio (CAP-4) já entrega o que o dado sustenta |
| Tendência com seletor Semana/Ano/Sempre | É a segunda tela; reusa o componente do Histórico, não um primo |
| Latência como número rotulado | CAP-1 mostra dois relógios; a latência fica gravada para cruzamento futuro |
| `is_nap` | **Zero cochilos em 308 dias** — infraestrutura especulativa |
| Web | Segunda rodada |
| Correção manual da janela | Recusado pelo usuário (§4) |

## 6. Estado dos dados (medido em 04/09/2026)

Consulta só-leitura em produção, 312 noites de 24/03/2025 a 04/09/2026.

| Fato | Valor | Consequência |
|---|---|---|
| Noites com `inbed` | 259/308 (84,1%) | O denominador de eficiência existe |
| Noites com `onset` (latência) | 220/308 (71,4%) | Mediana 24 min · p90 81 min · **41% acima de 30 min** |
| **Era Garmin (18/07→), `inbed`** | **42/42 (100%)** | — |
| **Era Garmin, `onset`** | **1/42** | Ver abaixo |
| Folga mediana `inbed − dormido` | Apple **100 min** · Garmin **9,5 min** | — |
| Dias com mais de um período | 12/312, todos mar–mai, todos com 0–2h20 no total | Não são cochilos |
| Noites com nota **e** medição | 51 | Matéria-prima de CAP-3 |

### Interrupções — a matéria-prima de CAP-5

| Fato | Valor |
|---|---|
| Noites com vigília **gravada no banco**, era Apple | **233/270** |
| Tempo acordado médio nessas noites | **60,2 min** · máximo **3h19** |
| Noites com mais de 1h acordado | **101 de 233 (43%)** |
| Noites com vigília **gravada no banco**, era Garmin | **0/42** |
| Noites em que o **HealthKit tem** `AWAKE` (últimos 60 dias) | **38** |
| Dessas, quantas a agregação **descarta** | **36** |
| Noites que são **um único período** | 258/270 na era Apple |

Três leituras saem daí, e as três são estruturais:

**A vigília mora *dentro* do período, não entre períodos.** 258 de 270 noites da era Apple
são um único bloco de sono contínuo — e ainda assim 43% delas têm mais de uma hora acordado.
Interrupção **não** é fragmentação em vários períodos: é buraco dentro de um. Por isso
`awakenings` é um `jsonb` de intervalos dentro da linha, e não linhas separadas em
`sleep_periods`.

**O zero da era Garmin é bug nosso, não silêncio da fonte.** Medido no aparelho em
04/09/2026: das 38 noites com amostra `AWAKE` no HealthKit, **36 são creditadas como zero**.
`aggregateSleepNights` só conta vigília que se **sobrepõe** a um intervalo dormindo
(`overlapMs(iv, awake)`), e o Garmin escreve segmentos **encostados** — `CORE·AWAKE·CORE`.
O `AWAKE` preenche o buraco *entre* os intervalos em vez de cair *dentro* deles, a
sobreposição dá zero, e a noite passa como registrada com sucesso enquanto a vigília some.

**Consequência: CAP-5 nasce viva, não histórica.** As interrupções do Garmin existem, e a
correção é aditiva — o `value` da linha diária não muda, porque cada intervalo dormindo já
é sono puro; o que falta é creditar o `AWAKE` que cai no vão da noite. A correção entra na
Fase 3, junto do bump de `AGG_VERSION` que o backfill já exige, para não gastar duas
releituras de 500 dias.

> **Correção registrada.** Uma versão anterior desta seção afirmava que "a fonte atual não
> reporta interrupção nenhuma" e que a folga entre cama e sono no Garmin ficava "quase toda
> depois de acordar". As duas estavam erradas: a folga **é** a vigília. Cinco noites
> conferidas ao minuto (04/09: 23 · 03/09: 27 · 02/09: 1 · 01/09: 33 · 31/08: 12), com o
> `AWAKE` do HealthKit batendo exatamente com `inbed − dormido` do banco. Na era Apple os
> dois **não** batem (diferença média de 67 min), porque lá o `INBED` começa antes do sono e
> a folga inclui a latência.
>
> **Recuperável pelo backfill, sem depender do aparelho:** 42 noites da era Garmin, vigília
> mediana de **12 min**, média 16,1, máximo **1h43**, 9 noites acima de meia hora. *(14 noites
> do histórico tinham mais sono do que cama — o agregador pegava uma só amostra `INBED`;
> corrigido na Fase 3 com a união alargada ao sono, `inbed ≥ dormido` como invariante.)*

### O achado que justifica o princípio da §2

Cruzando o tempo acordado com a nota que o usuário deu ao acordar, nas noites que têm os
dois:

| Nota ao acordar | n | Tempo acordado médio |
|---|---|---|
| 3 | 5 | **36,8 min** |
| 4 | 6 | **69,3 min** |
| 5 | 2 | **83,3 min** |

**A relação corre ao contrário.** Nas noites em que ele ficou *mais* tempo acordado, ele
acordou se sentindo *melhor*.

Com n = 13 no total, isso é ruído — e é exatamente esse o ponto. Qualquer produto da
categoria transformaria WASO em penalidade no score e diria a ele que a noite foi ruim,
contra a percepção dele, com esse lastro. **É o padrão nº 1 de reclamação da categoria
reproduzido no dado dele, medido.** A tela mostra os despertares; nunca os pontua.

**O achado que governa CAP-1.** `MIN_ONSET_MS = 60_000` (`health-buckets.ts:261`). Em 37 das
38 noites da era Garmin a janela `INBED` abre **dentro de um minuto** do instante em que o
sono começa, e a folga sobra quase toda *depois* de acordar. O Garmin não mede quando o
usuário deitou: ele renomeia a janela de sono. **A hora de deitar deixou de ser medida em
18/07/2026, com a troca de relógio.**

Por isso CAP-1 é especificado para funcionar com **dois** relógios e exibir o terceiro
quando ele existir — o V1 não depende de ele voltar.

> **Aberto (04/09/2026):** se o **Foco de Sono agendado** no iPhone faz o iOS escrever
> `inBed` mesmo com o Garmin no pulso. Era o que produzia os 100 min de folga na era Apple.
> Custo zero, decide se CAP-1 tem dois ou três relógios. Teste ligado em 04/09; resultado
> pendente.
>
> **Resolvido em 04/09:** a lacuna de 01 a 04/09 era atraso de sync, não perda. As quatro
> noites entraram (7,33 h · 8,47 h · 6,13 h · 6,53 h), todas com `inbed`, nenhuma com `onset`
> ou `awake` — o padrão Garmin confirmado em dado novo, não só em histórico.

## 7. Onde este spec diverge da pesquisa

A pesquisa é a fonte de direção; o banco é a fonte de fato. Três correções:

1. **Eficiência e latência não são incalculáveis.** A tabela D2 do relatório as lista como
   impossíveis por falta de denominador. `extra.inbed` e `extra.onset` estão gravados desde
   o `AGG_VERSION` 4. O buraco real é **um só: hora do dia**.
2. **`is_nap` não tem caso de uso.** A R1 pede um booleano de cochilo decidido na captura.
   Zero cochilos em 308 dias. Fora do V1.
3. **`inBed` precisa ser instante, não grandeza.** A R1 pede "`inBed` como grandeza separada
   da soma dos estágios" — horas. O usuário pediu **que horas**. São campos diferentes, e a
   pesquisa não pediu o que ele quer.

A R7 (correção manual como caminho de primeira classe) foi **rejeitada** pelo usuário — ver
§4. As demais recomendações (R2 a R6, R8) estão absorvidas acima.
