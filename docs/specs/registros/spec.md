# Spec: Registros — marcação diária de atividades avulsas

> **Feature:** `registros` · **Status:** 🔧 implementação inicial (web + mobile) · **Data:** 2026-05-21

## 1. Por quê (problema)

Existe `Habitos` (contadores diários, com meta e recorrência implícita) e `Tarefas`
(to-do com agendamento e conclusão). Falta um modelo para **atividades que se repetem
sem frequência definida** e que o usuário quer apenas **registrar que fez naquele dia**,
para consulta e análise futura — sem meta, sem recorrência, sem controle quantitativo.

Exemplos do usuário: **Pizza**, **Comida japonesa**, **Dentista**, **Médico**.

**Objetivo:** uma seção **Registros** onde o usuário cria itens livres, associa cada um a
um **módulo** (com ícone e cor), e marca **"feito hoje"** com um toque — uma vez por dia.
O histórico fica durável no Supabase para análise (com que frequência, quando foi a
última vez, em que dias).

## 2. Decisões de produto (fechadas)

| Decisão | Escolha | Implicação |
|---------|---------|------------|
| Granularidade | **Marca binária por dia** | "Feito / não feito" hoje. Sem valor/contador (≠ Habitos). 1 linha por `(registro, dia)` |
| Frequência | **Nenhuma** | Sem recorrência nem agendamento (≠ Tarefas). Itens só existem para serem marcados quando acontecem |
| Marcação | **Toggle, 1×/dia** | Marcar grava o dia; tocar de novo **desmarca** (corrigir engano). No dia seguinte volta a "não marcado" |
| Categoria | **Módulo (como Tarefas)** | Reusa `TodoModule` (`financas`/`compras`/`casa`/`saude`/`geral`) para categorizar e colorir |
| Ícone/cor | **Set canônico** | Reusa `HABIT_ICONS` (web `<rt-icon>` / mobile Ionicons) e tokens `MOD` para a cor |
| Persistência | **Supabase agora** | Tabelas `registros` + `registro_logs` com RLS por usuário; reset diário pela data local |
| Plataformas | **Web (análise + CRUD) e Mobile (captura + CRUD)** | Espelha o padrão de Habitos |

## 3. Usuários e plataforma

- Usuário único autenticado (Supabase Auth). Leitura/escrita isolada por `user_id` via RLS.
- **Mobile (Expo)** = captura: tela **Registros** (via aba **Mais**) lista os itens com botão
  "marcar hoje"; CRUD no editor.
- **Web (Angular)** = análise + CRUD: página `/registros` com lista (marcar hoje), contagem
  por período, dias desde a última vez e heatmap.

## 4. Histórias de usuário (priorizadas)

### US1 — Marcar uma atividade como feita hoje (P1) 🎯 MVP
Como usuário, quero tocar no botão de um registro para marcar que **fiz isso hoje**, e ver
de relance o que já marquei no dia.

**Cenários de aceite**
- **Dado** um registro "Pizza", **quando** toco em "marcar", **então** o dia de hoje fica
  registrado e o estado **persiste** (visível ao reabrir).
- **Dado** que já marquei "Pizza" hoje, **quando** toco de novo, **então** **desmarca** o dia
  (sem afetar dias anteriores).
- **Dado** que virou o dia (data local), **quando** abro a tela, **então** todos voltam a
  "não marcado", e os dias anteriores continuam no histórico.

### US2 — Criar e configurar um registro (P1) 🎯 MVP
Como usuário, quero criar um registro escolhendo **nome**, **módulo**, **ícone** e **cor**.

**Cenários de aceite**
- **Dado** o formulário, **quando** defino "Dentista", módulo Saúde, ícone tooth, **então** o
  item passa a aparecer na lista pronto para marcar.
- **Dado** um registro existente, **quando** edito nome/ícone/cor/módulo, **então** a lista e a
  análise refletem (marcas passadas permanecem).

### US3 — Analisar histórico no web (P2)
Como usuário, quero ver, por registro, **quantas vezes** fiz no período, **quando foi a última
vez** e um **heatmap** dos dias marcados.

**Cenários de aceite**
- **Dado** que tenho histórico, **quando** abro `/registros`, **então** vejo um card por
  registro com total no período, "última vez há N dias" e o heatmap.
- **Dado** que nunca criei nenhum, **quando** abro a página, **então** vejo um estado vazio
  orientando a criar o primeiro.

### US4 — Editar e arquivar (P2)
Como usuário, quero arquivar um registro sem perder o histórico, e reativá-lo depois.

**Cenários de aceite**
- **Dado** um registro ativo, **quando** o arquivo (`active = false`), **então** some da captura
  mas o histórico continua na análise.
- **Dado** um arquivado, **quando** o reativo, **então** volta à lista mantendo o histórico.

## 5. Requisitos funcionais

- **FR-001** O usuário DEVE poder criar um registro com `name`, `icon`, `color` e `module`.
- **FR-002** A lista DEVE oferecer, por registro ativo, um botão **marcar/desmarcar hoje**.
- **FR-003** A marca DEVE ser **binária por dia**: 1 linha por `(registro_id, log_date)`;
  marcar grava, desmarcar remove a linha do dia.
- **FR-004** O dia DEVE **resetar pela data local**: novo dia começa "não marcado" sem apagar o histórico.
- **FR-005** Cada usuário SÓ PODE ler/escrever os próprios registros e logs (RLS).
- **FR-006** O usuário DEVE poder **editar** e **arquivar/reativar** (`active`); arquivar some da
  captura mas **preserva** o histórico.
- **FR-007** A ordem na captura DEVE ser controlável (`sort`).
- **FR-008** O web DEVE exibir, por registro: **contagem** no período, **dias desde a última vez**
  e **heatmap** dos dias marcados.

## 6. Entidades-chave

- **Registro** — definição do item. `name`, `icon`, `color`, `module`, `active`, `sort`, `createdAt`.
- **RegistroLog** — marca de um dia. 1 linha por `(registro_id, log_date)`. Ausência de linha ⇒
  não feito naquele dia.

## 7. Critérios de sucesso (mensuráveis)

- **SC-001** Marcar e reabrir o app mantém o dia marcado; desmarcar remove só o dia atual.
- **SC-002** Ao virar o dia local, tudo volta a "não marcado"; dias anteriores seguem consultáveis.
- **SC-003** Um registro arquivado some da captura, mas seu histórico continua na análise web.
- **SC-004** Um usuário nunca lê registros nem logs de outro (RLS).

## 8. Fora de escopo

- Contagem de **mais de uma vez por dia** (é binário; backlog: `count` por dia).
- Anotações por marca (ex.: "pizza calabresa") — backlog (`note`/`meta`).
- Recorrência, lembretes/push, metas/streak esperado (não há frequência alvo).
- Surfacing na tela "Hoje" do mobile (vive na própria tela de Registros no v1).
- Ponte com Compras/Finanças (esses módulos ainda são mock).

## 9. Backlog (pós-MVP)

- Marcar com **data retroativa** (registrar que fiz ontem).
- **Contagem/anotação** por dia (`count`, `note`).
- Filtro/agrupamento por **módulo** na lista e na análise.
- Surfacing rápido no "Hoje" do mobile (flag tipo `showOnHome`).
- Unificar Habitos + Registros num modelo com `kind` (`counter` | `mark`).
