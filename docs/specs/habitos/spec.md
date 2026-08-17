# Spec: Habitos — contadores diários

> **Feature:** `habitos` · **Status:** 🔧 F0–F3 implementadas (mobile + análise web; falta validar em device) · **Data:** 2026-05-20

## 1. Por quê (problema)

Hoje só existe o conceito de hábito **binário** ([`Habit`](../../../packages/shared/src/models/index.ts#L16-L22) = `done`/`streak`, ex.: meditação, leitura) e a água é um caso isolado e fixo no mobile (`water: number`, 0–8 copos, mock — ver [store](../../../mobile/src/store/index.ts#L81-L82)). Não há como o usuário **criar** os próprios controles **quantitativos** que vai incrementando ao longo do dia (beber 4 L de água em goles, contar cigarros), nem ver esse histórico de forma durável.

**Objetivo:** uma seção **Habitos** para criar hábitos do tipo **contador**, capturar a quantidade do dia rapidamente no mobile (stepper `[−] valor [＋]`) e analisar a adesão no web — tudo persistido no Supabase, isolado por usuário e com **reset diário**.

## 2. Decisões de produto (fechadas)

| Decisão | Escolha | Implicação |
|---------|---------|------------|
| Escopo | **Só contadores** (quantitativos) | Os checks binários (`Habit` atual) ficam separados, intocados. Esta feature trata só hábitos com **valor** que acumula no dia |
| Direção da meta | **Mínimo e teto** | `at_least` (água: bom passar, anel enche) e `at_most` (cigarro: ruim passar, alerta ao estourar). `target` opcional → contador puro sem meta |
| Captura no mobile | **Hoje + config no Mais** | Steppers na tela principal (Hoje); criar/editar hábitos numa tela **Habitos** acessível pela aba **Mais**. Sem aba nova |
| Persistência | **Supabase agora** | Tabelas `habits` + `habit_logs` com RLS por usuário, como `activities`. Reset diário pela **data local**; sync web↔mobile |
| Valor / unidade | **`numeric` na unidade do hábito** | `step`, `target` e `value` na mesma unidade (ex.: água em L com step 0,25). `numeric` evita erro de ponto flutuante |
| Componente de captura | **`HabitStepper`** | `[−]` à esquerda, valor + progresso no meio (`1,5 / 4 L`), `[＋]` à direita. Long-press no `−` zera o dia |

## 3. Usuários e plataforma

- Usuário único autenticado (Supabase Auth — ver [auth.md](../auth.md)). Toda leitura/escrita é isolada por `user_id` via RLS.
- **Mobile (Expo)** = captura: steppers na Hoje + CRUD na tela Habitos (via Mais).
- **Web (Angular)** = análise: página `/habitos` com adesão, streaks, médias e gráfico por hábito (CRUD também disponível no web — ver §5).
- Pré-condição: a captura só mostra hábitos que o usuário **criou** e marcou como ativos.

## 4. Histórias de usuário (priorizadas)

Cada história é entregável e testável de forma independente.

### US1 — Registrar consumo na tela principal (P1) 🎯 MVP
Como usuário, quero tocar `＋`/`−` no card de um hábito na tela **Hoje** para somar/subtrair a quantidade do dia, e ver o valor atual com o progresso da meta.

**Cenários de aceite**
- **Dado** um hábito "Água" (step 0,25 L, meta 4 L), **quando** toco `＋`, **então** o valor do dia sobe 0,25 L, o progresso atualiza e o novo valor **persiste** (visível ao reabrir o app).
- **Dado** que toquei `−` com o valor em 0, **quando** solto, **então** o valor permanece em 0 (nunca negativo).
- **Dado** que fiz um long-press no `−`, **quando** confirmo, **então** o valor do dia volta a 0 (sem apagar dias anteriores).
- **Dado** que estou **offline**, **quando** incremento, **então** a mudança aplica localmente e sincroniza ao reconectar, sem perda nem duplicata.

### US2 — Criar e configurar um hábito contador (P1) 🎯 MVP
Como usuário, quero criar um hábito escolhendo nome, ícone, **unidade**, **incremento (step)**, **meta** e **direção** (atingir / não passar).

**Cenários de aceite**
- **Dado** o formulário de novo hábito, **quando** defino "Água", unidade L, step 0,25, meta 4, direção *atingir*, **então** o hábito passa a aparecer na captura da Hoje com `[−] 0 / 4 L [＋]`.
- **Dado** um hábito "Cigarro", **quando** escolho direção *não passar* com teto 5 (ou **sem** meta), **então** ele conta para cima e, com teto, sinaliza quando ultrapassa.
- **Dado** que mudei o step de um hábito de 0,25 para 0,5, **quando** volto à Hoje, **então** o `＋` passa a somar 0,5.

### US3 — Ver progresso e estado da meta no dia (P1) 🎯 MVP
Como usuário, quero ver de relance se já bati a meta (ou se estourei o teto) de cada hábito hoje.

**Cenários de aceite**
- **Dado** um hábito `at_least` com valor ≥ meta, **quando** vejo o card, **então** ele mostra estado **batida** (anel cheio / destaque positivo).
- **Dado** um hábito `at_most` com valor > teto, **quando** vejo o card, **então** ele mostra estado de **alerta** (estourou o limite).
- **Dado** um hábito sem meta (`target` nulo), **quando** vejo o card, **então** ele só exibe a contagem, sem barra de meta.

### US4 — Analisar adesão no web (P2)
Como usuário, quero abrir `/habitos` no desktop e ver, por hábito, um **heatmap** de adesão, o **streak** atual, a **média** por período e um gráfico do valor ao longo do tempo.

**Cenários de aceite**
- **Dado** que tenho histórico, **quando** abro a página, **então** vejo um card por hábito com streak atual, média (ex.: L/dia) e um heatmap dos últimos N dias.
- **Dado** um hábito `at_least`, **quando** vejo o heatmap, **então** os dias que bateram a meta aparecem destacados; em `at_most`, os dias dentro do teto.
- **Dado** que não criei nenhum hábito, **quando** abro a página, **então** vejo um estado vazio orientando a criar o primeiro hábito.

### US5 — Editar e arquivar um hábito (P2)
Como usuário, quero editar a configuração de um hábito ou arquivá-lo sem perder o histórico.

**Cenários de aceite**
- **Dado** um hábito ativo, **quando** o **arquivo** (`active = false`), **então** ele some da captura da Hoje, mas seu histórico continua na análise.
- **Dado** um hábito arquivado, **quando** o reativo, **então** ele volta à captura mantendo o histórico.
- **Dado** que edito nome/ícone/meta, **quando** salvo, **então** a captura e a análise refletem a nova config (logs passados ficam com os valores em que foram gravados).

## 5. Requisitos funcionais

- **FR-001** O usuário DEVE poder criar um hábito contador com: `name`, `icon`, `color`, `unit`, `step`, `target` (opcional) e `direction` (`at_least` | `at_most`).
- **FR-002** A captura na Hoje DEVE oferecer um `HabitStepper` por hábito ativo: `＋` soma `step`, `−` subtrai `step` com piso em **0**.
- **FR-003** O valor do dia DEVE ser persistido em `habit_logs` com **uma linha por hábito por dia** (chave `habit_id` + `log_date`), gravando imediatamente a cada toque.
- **FR-004** O dia DEVE **resetar automaticamente** pela **data local** do dispositivo: um novo dia começa em 0 sem apagar os dias anteriores.
- **FR-005** O progresso DEVE refletir a direção: `at_least` enche até a meta e **permite ultrapassar**; `at_most` sinaliza **alerta** ao ultrapassar o `target`. Sem `target`, exibe só a contagem.
- **FR-006** Cada usuário SÓ PODE ler/escrever os próprios hábitos e logs (isolamento via RLS).
- **FR-007** A escrita no mobile DEVE tolerar **offline**: incrementos enfileiram localmente e reprocessam ao reconectar, sem perda nem duplicata.
- **FR-008** Long-press no `−` (ou ação explícita) DEVE **zerar** o valor do dia atual, sem afetar dias anteriores.
- **FR-009** O usuário DEVE poder **editar** e **arquivar/reativar** (`active`) um hábito; arquivar remove da captura mas **preserva** o histórico.
- **FR-010** A ordem dos hábitos na captura DEVE ser controlável (`sort`).
- **FR-011** O web DEVE exibir, por hábito: **streak atual**, **média** por período e **heatmap** de adesão (dias que cumpriram a meta segundo a direção).
- **FR-012** O `streak` (dias consecutivos cumprindo a meta) DEVE ser **derivado** dos logs — `at_least`: `value ≥ target`; `at_most`: `value ≤ target` — não armazenado como verdade.

## 6. Entidades-chave

- **Habit (contador)** — definição do hábito. Atributos: `name`, `icon`, `color`, `unit`, `step`, `target?`, `direction`, `active`, `sort`. Identidade = `id` (uuid). *Distinto* do `Habit` binário atual de `@vitale/shared` — ver naming em [data-model.md](./data-model.md).
- **HabitLog (valor do dia)** — quantidade acumulada de um hábito num dia. Uma linha por `(habit_id, log_date)`; `value numeric`. Reset diário = ausência de linha no dia ⇒ valor 0.
- **Direção (`direction`)** — `at_least` (meta a atingir) | `at_most` (teto a respeitar). Governa progresso, estado e streak.

## 7. Critérios de sucesso (mensuráveis)

- **SC-001** Tocar `＋` N vezes resulta em `value = N × step` persistido e **visível após reabrir** o app.
- **SC-002** Ao virar o dia (data local muda), o valor exibido reinicia em **0** e o valor do dia anterior **permanece** consultável na análise.
- **SC-003** Um hábito `at_least` com `value ≥ target` mostra estado **batida**; um `at_most` com `value > target` mostra **alerta**.
- **SC-004** Um hábito arquivado **some** da captura da Hoje, mas seu histórico continua aparecendo na análise web.
- **SC-005** Um usuário nunca lê hábitos nem logs de outro (verificável por teste de RLS).
- **SC-006** Incrementos feitos **offline** aparecem no Supabase ao reconectar, sem perda nem duplicata (idempotência por `(habit_id, log_date)`).
- **SC-007** O streak/heatmap no web batem com a regra de direção conferida em SQL.

## 8. Fora de escopo

- Hábitos **binários** (check sim/não) — continuam no `Habit` atual; podem ser unificados no futuro (backlog).
- Lembretes / push notifications ("beba água") — feature separada ([backend.md](../backend.md) §Push).
- Múltiplos presets de quick-add por hábito (ex.: +250 / +500 juntos) — um `step` único no MVP (backlog).
- Metas semanais/mensais (só meta **diária** no MVP).
- Integração com HealthKit (água do Apple Health) — captura é manual no MVP.
- Importação/migração da água mock atual (`water: number`) — opcional, ver clarifications.

## 9. Pontos a esclarecer

> Resolvidos com um **default** (assumido em [plan.md](./plan.md)/[data-model.md](./data-model.md)); confirmar ou corrigir.

- **[NEEDS CLARIFICATION] Unidade base** — manter `numeric` na unidade do hábito (água em L, step 0,25). **Default:** `numeric(8,3)`. Alternativa: armazenar em unidade inteira mínima (ml) + fator de exibição (mais robusto a arredondamento, mais campos).
- **[NEEDS CLARIFICATION] Fuso/virada do dia** — `log_date` é a **data local do dispositivo** no momento do toque. **Default:** data local; sem virada às 00:00 configurável (ex.: "meu dia vira às 04:00") no MVP.
- **[NEEDS CLARIFICATION] CRUD no web** — o web faz análise **e** CRUD, ou só análise (CRUD só no mobile)? **Default:** web faz **ambos** (mesma tabela; tela maior facilita o setup). A fase de CRUD web é separável.
- **[NEEDS CLARIFICATION] Água mock existente** — substituir o `water: number` da Hoje por um hábito "Água" semente, ou conviver com os dois no início? **Default:** substituir a água mock por um hábito contador "Água" assim que F1 entrar.
- **[NEEDS CLARIFICATION] Editar valor passado** — permitir corrigir o valor de um dia anterior no web? **Default:** fora do MVP (só leitura do histórico); entra no backlog.

## 10. Backlog (pós-MVP)

- **Unificar** binário + contador num só modelo (`kind: 'binary' | 'counter'`) e numa só seção.
- **Quick-add múltiplo** (vários botões de preset por hábito).
- **Lembretes/push** por hábito (Expo Notifications).
- **Metas semanais/mensais** e tendência ("menos é melhor" com queda esperada).
- **Editar logs passados** no web; anotações por dia.
- **HealthKit**: importar água/registros de unidades já capturados pelo Apple Health.
- Virada do dia configurável (ex.: dia começa às 04:00).
