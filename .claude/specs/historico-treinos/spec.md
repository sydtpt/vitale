# Spec: Histórico de Treinos (web)

> **Feature:** `historico-treinos` · **Status:** 📐 Especificação · **Data:** 2026-05-20

## 1. Por quê (problema)

Os treinos do HealthKit já são sincronizados para o Supabase (ver [sync-atividades](../sync-atividades/spec.md)), mas no **web** ainda não existe nenhuma tela que leia essas atividades reais — a página `/treinos` atual usa dados mock (lifts, runs, planner). O usuário não consegue, no desktop, ver o histórico durável das atividades que capturou no celular, analisar tendências por período, nem corrigir um dado errado de um treino.

**Objetivo:** criar uma página web de **Histórico de Treinos** que lê as atividades sincronizadas do Supabase, oferece uma visão geral analítica por período, um resumo por tipo de atividade, e uma navegação completa (lista/cards, filtros, paginação) até a edição de uma atividade individual.

## 2. Decisões de produto (fechadas)

| Decisão | Escolha | Implicação |
|---------|---------|------------|
| Gráfico do card principal | **Barras empilhadas + toggle de métrica** | Barras por bucket do período, empilhadas por tipo; toggle entre distância / duração / calorias / nº de atividades |
| Edição de atividade | **Editar tudo + travar a linha do sync** | A web edita qualquer campo; a linha é marcada como `locally_edited` e o sync mobile **deixa de sobrescrevê-la** |
| Localização da página | **Nova página + item no menu** | Rota `/historico-treinos` + item de sidebar; a `/treinos` mock permanece intacta |
| Origem dos dados | **Somente leitura do Supabase** (exceto a edição) | iOS/HealthKit continua a fonte de captura; web não importa nada |
| Agrupamento por tipo | **Por label** de `getActivityMeta(activityId)` | Mesma regra do mobile; vários `activityId` colapsam num rótulo (catch-all "Treino") |

## 3. Usuários e plataforma

- Usuário único autenticado (Supabase Auth — ver [auth.md](../auth.md)). Toda leitura é isolada por `user_id` via RLS já existente.
- Plataforma: **web (Angular)**. A captura continua sendo iOS; a web só lê (e edita pontualmente).
- Pré-condição de dados: a página só tem conteúdo se o usuário já sincronizou ao menos um tipo de treino pelo app.

## 4. Histórias de usuário (priorizadas)

### US1 — Estado vazio guiando à importação (P1) 🎯 MVP
Como usuário **sem** atividades importadas, quero abrir a página e entender que preciso importar pelo mobile, sem ver uma tela quebrada ou vazia sem contexto.

**Cenários de aceite**
- **Dado** que não tenho nenhuma atividade em `activities`, **quando** abro `/historico-treinos`, **então** vejo uma tela limpa explicando que preciso importar os dados pelo app mobile (com orientação de como).
- **Dado** que sincronizei ao menos uma atividade, **quando** abro a página, **então** vejo o conteúdo completo (visão geral + cards por tipo) — nunca o estado vazio.

### US2 — Visão geral por período (P1) 🎯 MVP
Como usuário, quero um card principal no topo com a visão geral de todas as atividades, podendo alternar entre **Semana / Ano / Sempre**, e ver um gráfico das atividades realizadas no período.

**Cenários de aceite**
- **Dado** que estou na página, **quando** seleciono um período, **então** as estatísticas do card (nº de atividades, distância, duração, calorias) e o gráfico passam a refletir **apenas** aquele período.
- **Dado** o período "Semana", **quando** vejo o gráfico, **então** os buckets são os últimos 7 dias (hoje + 6 anteriores); em "Ano", os últimos 12 meses (mês atual + 11 anteriores); em "Sempre", um bucket por ano com dados.
- **Dado** o gráfico de barras empilhadas, **quando** alterno a métrica (distância / duração / calorias / nº), **então** as barras recalculam mantendo a separação por tipo de atividade (cor por tipo) e a legenda.

### US3 — Resumo por tipo de atividade (P1) 🎯 MVP
Como usuário, quero ver abaixo da visão geral um card por tipo de atividade (corrida, ciclismo, musculação…) com valores **agregados de todo o histórico** (independentes do filtro de período do topo).

**Cenários de aceite**
- **Dado** que tenho atividades de vários tipos, **quando** vejo a seção, **então** há um card por tipo presente nos meus dados, cada um com nº total de atividades e distância total acumulada (de sempre, não do filtro do topo).
- **Dado** um tipo sem distância (ex.: musculação), **quando** vejo seu card, **então** ele exibe uma métrica adaptada (duração/calorias) em vez de distância zero.
- **Dado** um card de tipo, **quando** clico nele, **então** navego para a página completa daquele tipo.

### US4 — Página completa de um tipo (P2)
Como usuário, quero entrar num tipo e ver todas as atividades dele, alternando entre **lista e cards**, com **paginação** e **filtros**.

**Cenários de aceite**
- **Dado** que entrei num tipo, **quando** a lista carrega, **então** vejo as atividades daquele tipo ordenadas por data (mais recente primeiro), paginadas.
- **Dado** o seletor de visualização, **quando** alterno entre lista e cards, **então** o mesmo conjunto é re-renderizado no formato escolhido.
- **Dado** os filtros (intervalo de datas, faixa de distância/duração, fonte, com/sem rota), **quando** aplico um filtro, **então** a lista e a paginação recalculam para o subconjunto.

### US5 — Editar uma atividade (P2)
Como usuário, quero abrir uma atividade específica e corrigir suas informações; minha edição **não pode** ser desfeita pelo próximo sync.

**Cenários de aceite**
- **Dado** que abri uma atividade, **quando** edito campos (ex.: distância, duração, calorias, nome, início/fim) e salvo, **então** os novos valores persistem em `activities` e a atividade fica marcada como editada manualmente.
- **Dado** que editei uma atividade, **quando** o sync mobile roda de novo para aquele tipo, **então** a atividade editada **não é sobrescrita** pelos dados do HealthKit.
- **Dado** uma atividade editada, **quando** a vejo na lista/detalhe, **então** há um indicador visual de "editado manualmente".

## 5. Requisitos funcionais

- **FR-001** A página DEVE detectar ausência de atividades do usuário e exibir um **estado vazio** orientando a importar pelo mobile (sem o restante da UI).
- **FR-002** A página DEVE ler atividades **apenas do usuário autenticado** (RLS já garante isolamento — SC isolamento herdado do sync).
- **FR-003** O card principal DEVE permitir alternar entre **Semana / Ano / Sempre** e refletir o período em **todas** as suas estatísticas e no gráfico.
- **FR-004** O gráfico DEVE ser de **barras empilhadas por tipo de atividade**, com buckets temporais derivados do período (dias / meses / anos).
- **FR-005** O gráfico DEVE permitir alternar a **métrica** exibida entre distância, duração, calorias e nº de atividades.
- **FR-006** A seção de tipos DEVE exibir **um card por tipo** presente nos dados, com agregados **de todo o histórico** (independentes do filtro do topo): nº de atividades e distância total. Tipos sem distância exibem **tempo (duração) e calorias**, mostrados só **quando houver** valor.
- **FR-007** Cada card de tipo DEVE ser **clicável**, navegando para a página completa do tipo.
- **FR-008** A página de tipo DEVE listar todas as atividades do tipo com **alternância lista/cards**, **paginação** e **filtros** (datas, faixa de distância/duração, fonte, com/sem rota).
- **FR-009** Uma atividade individual DEVE poder ser aberta e ter suas informações **editadas e persistidas**.
- **FR-010** Ao salvar uma edição, a linha DEVE ser **marcada para que o sync não a sobrescreva** (`locally_edited`), atendendo à decisão "editar tudo + travar do sync".
- **FR-011** O agrupamento por tipo DEVE usar a **mesma regra de label** de `getActivityMeta(activityId)` do mobile, para coerência entre plataformas.
- **FR-012** Atividades editadas manualmente DEVEM exibir **indicador visual** distinto.
- **FR-013** Atividades **ocultas** (`hidden` — ex.: editadas e depois apagadas no HealthKit) DEVEM ser **excluídas das métricas e listas** por padrão, mas **preservadas** no banco (não apagadas).

## 6. Entidades-chave

- **Activity (Treino)** — linha de `activities` (ver [data-model do sync](../sync-atividades/data-model.md)). Esta feature **lê** todas as colunas e **escreve** em edição, marcando `locally_edited`. Linhas `hidden` (apagadas na origem após edição) são preservadas, mas excluídas de métricas/listas.
- **TipoAtividade (grupo)** — agrupamento de `activityId` pelo label de `getActivityMeta`. Não é tabela; é uma derivação na leitura. Carrega metadados de exibição (label, slug, ícone web, cor).
- **PeríodoVisãoGeral** — Semana | Ano | Sempre. Determina o recorte temporal e o bucketing do gráfico.

## 7. Critérios de sucesso (mensuráveis)

- **SC-001** Sem atividades, a página mostra o estado vazio e **nenhuma** seção analítica.
- **SC-002** Com atividades, trocar o período recalcula 100% das estatísticas e do gráfico para o recorte correto.
- **SC-003** Os agregados por tipo somam corretamente todo o histórico do usuário (conferível contra `count`/`sum` em SQL).
- **SC-004** Alternar a métrica do gráfico nunca altera a composição por tipo, só a grandeza medida.
- **SC-005** Uma atividade editada na web mantém os valores editados **após** um novo sync do seu tipo (não é sobrescrita).
- **SC-006** Filtros e paginação na página de tipo produzem subconjuntos corretos e estáveis.
- **SC-007** Um usuário nunca vê atividades de outro (herdado do RLS do sync).

## 8. Fora de escopo

- Importar/capturar atividades na web (continua iOS/HealthKit).
- Criar atividades manualmente do zero na web.
- ~~Renderização do mapa da rota GPS~~ — **implementado**: o detalhe de uma atividade com `hasRoute` mostra o mapa OpenStreetMap (Leaflet) com a polyline da rota.
- Métricas de saúde fora de treinos (passos, FC, sono).
- Sincronização reversa web→HealthKit.

## 9. Pontos esclarecidos

> Resolvidos em 2026-05-20 (exceto onde indicado ⏳). Refletidos em [plan.md](./plan.md) e [data-model.md](./data-model.md).

- ✅ **Definição dos períodos** — janelas **móveis** (não ano/mês-calendário). O seletor mantém os rótulos Semana / Ano / Sempre:
  - **Semana** = hoje + os 6 dias anteriores (7 dias). Buckets = dias.
  - **Ano** = mês atual + os 11 meses anteriores (12 meses). Buckets = meses.
  - **Sempre** = todo o histórico. Buckets = 1 por ano.
- ✅ **Quais campos são editáveis** — **nome** (todas as atividades) e **tempo/duração** apenas em atividades **sem GPS** (sem rota e sem distância). Atividades com GPS têm a duração vinda do rastreamento e ficam read-only nesse campo. Demais campos (distância, calorias, datas, tipo) não são editáveis por ora — podem entrar no backlog.
- ✅ **Travar do sync: granularidade** — **linha inteira** imune ao sync quando `locally_edited = true`. Melhoria futura (travar só os campos editados) registrada no **backlog**, não no MVP.
- ✅ **Deleção no HealthKit de linha editada** — **não apagar**: a linha é marcada como **oculta** (`hidden`) e **excluída de métricas/listas**, mas preservada. Habilita o cenário **multi-source** futuro (Strava/Garmin), em que o treino pode existir em outra origem.
- ✅ **Métrica adaptada do card de tipo** — tipos sem distância exibem **tempo (duração) e calorias**, mostrados só **quando houver** valor.
- ✅ **Volume de dados / agregação** — **agregação no cliente** sobre **um único fetch** das atividades do usuário, tudo derivado por `computed()`. É a melhor performance para a escala desta app (um usuário, ≤ poucos milhares de treinos): o dataset é pequeno (<~1 MB) e evita ida-e-volta de rede a cada troca de período/métrica. Escape hatch (RPC `group by` + `.range()` server-side) documentado em [plan.md](./plan.md) §7 caso o volume cresça muito.

## 10. Backlog (pós-MVP)

- Travar do sync **por campo** (em vez de linha inteira), preservando atualizações do HealthKit nos campos não editados.
- **Multi-source** (Strava/Garmin): reconciliar a mesma atividade vinda de origens diferentes; usar `hidden`/origem para deduplicar.
- ~~Render do **mapa da rota GPS** (`activity_routes`) no detalhe da atividade.~~ ✅ Feito — mapa OpenStreetMap via Leaflet, carregando os pontos sob demanda (`ActivitiesStore.loadRoute`).
