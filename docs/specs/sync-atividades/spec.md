# Spec: Sincronização de Atividades (HealthKit → Supabase)

> **Feature:** `sync-atividades` · **Status:** 📐 Especificação · **Data:** 2026-05-20

## 1. Por quê (problema)

Hoje os treinos da aba **Fitness** são lidos do Apple HealthKit e mantidos **só em memória** (Zustand). Ao fechar o app eles somem; o botão "sync" da UI apenas relê o HealthKit — não persiste nada. Consequências:

- Os treinos **não aparecem no web** (dashboard de Treinos analítico).
- Não há histórico durável independente do dispositivo.
- Cada abertura do app refaz a leitura completa (3 anos), custosa.

**Objetivo:** persistir os treinos do HealthKit no Supabase, por usuário, de forma **idempotente e incremental**, para que sirvam de fonte única para web e mobile.

## 2. Decisões de produto (fechadas)

| Decisão | Escolha | Implicação |
|---------|---------|------------|
| Escopo | **Só treinos (workouts)** | Métricas de saúde (passos, FC, sono) ficam fora desta feature |
| Direção | **Push-only** — HealthKit é a fonte da verdade | Mobile faz `upsert`; web só lê. Sem merge de edição; dedup por ID |
| Rotas GPS | **Resumo + rota** | Polyline sincronizado para render do mapa também no web |
| Gatilho | **Opt-in por tipo de treino** | Abrir/ler a lista NÃO sincroniza. O botão de cada tipo envia o histórico daquele tipo e o **inscreve**; só treinos de tipos inscritos sobem (histórico + futuros) |

## 3. Usuários e plataforma

- Usuário único autenticado (Supabase Auth já implementado — ver [auth.md](../auth.md)).
- Origem dos dados: **iOS apenas** (HealthKit). Em Android/web não há captura — apenas leitura do que já foi sincronizado.

## 4. Histórias de usuário (priorizadas)

Cada história é entregável e testável de forma independente.

### US1 — Sincronizar um tipo de treino sob demanda (P1) 🎯 MVP
Como usuário, na lista de tipos de treino quero tocar o botão **sincronizar** de um tipo (ex.: Corrida) para enviar todo o histórico daquele tipo ao Supabase — e só dele.

**Cenários de aceite**
- **Dado** que autorizei o HealthKit, **quando** toco em sincronizar no card de um tipo, **então** todos os treinos **desse tipo** dos últimos 3 anos passam a existir em `activities`, e os demais tipos permanecem **não sincronizados**.
- **Dado** que apenas abri a aba Fitness (li a lista), **quando** não toco em nenhum botão, **então** **nada** é enviado ao Supabase.
- **Dado** que já sincronizei um tipo, **quando** toco em sincronizar de novo sem treinos novos, **então** nenhum registro é duplicado (idempotente por ID do HealthKit).
- **Dado** que estou **offline**, **quando** toco em sincronizar, **então** os treinos pendentes são marcados e sincronizam automaticamente ao reconectar, sem perda nem duplicata.

### US2 — Rastrear automaticamente só os tipos inscritos (P2)
Como usuário, quero que treinos novos subam sozinhos **apenas dos tipos que já sincronizei** — sem reativar tudo a cada leitura e sem tocar nos tipos não inscritos.

**Cenários de aceite**
- **Dado** que inscrevi o tipo Corrida, **quando** registro uma corrida nova no Apple Health, **então** ela é enviada automaticamente (background + foreground), sem eu abrir nem tocar em nada.
- **Dado** que **não** inscrevi o tipo Musculação, **quando** registro uma musculação nova, **então** ela **não** é enviada.
- **Dado** o app em background, **quando** o Apple Health grava um treino de um tipo inscrito, **então** o sync dispara via background delivery sem o app estar em primeiro plano.
- **Dado** que um treino de um tipo inscrito foi **apagado** no Apple Health, **quando** o sync roda, **então** ele é removido do Supabase.

### US3 — Ver o percurso da corrida no web (P3)
Como usuário, quero ver no web o mapa do trajeto das minhas corridas/pedais.

**Cenários de aceite**
- **Dado** um treino com rota GPS (corrida, caminhada, ciclismo, trilha), **quando** ele sincroniza, **então** seus pontos GPS ficam disponíveis para render do mapa.
- **Dado** um treino indoor (musculação), **quando** sincroniza, **então** nenhuma rota é enviada (payload enxuto).

### US4 — Feedback de status por tipo (P2)
Como usuário, quero ver em cada card de tipo se ele está inscrito, sincronizando, pendente ou com erro, e a hora do último sync daquele tipo.

**Cenários de aceite**
- **Dado** um tipo inscrito, **quando** vejo seu card, **então** ele mostra "sincronizado" + hora do último sync; um tipo não inscrito mostra a ação de sincronizar.
- **Dado** um sync em andamento, **quando** olho o card, **então** vejo o estado "sincronizando".
- **Dado** um erro de sync, **quando** ele ocorre, **então** o card mostra um estado de erro recuperável (sem travar a tela).

## 5. Requisitos funcionais

- **FR-001** O sistema DEVE persistir cada treino sincronizado como uma linha em `activities`, vinculada ao `user_id` autenticado.
- **FR-002** O sync DEVE ser **idempotente**: a chave natural é o **UUID do treino no HealthKit**; reenviar não cria duplicatas (`upsert` por ID).
- **FR-003** **Abrir/exibir a lista de tipos NÃO PODE disparar sync.** Ler o HealthKit para montar a tela é apenas leitura local, sem escrita no Supabase.
- **FR-004** A sincronização é **opt-in por tipo de treino**: tocar o botão de um tipo (a) envia todo o histórico daquele tipo e (b) **inscreve** o tipo para rastreamento futuro.
- **FR-005** Apenas treinos de **tipos inscritos** podem ser enviados — históricos ou futuros. Tipos não inscritos nunca sincronizam.
- **FR-006** O conjunto de tipos inscritos DEVE ser **persistido** e sobreviver a fechar/reabrir o app (e idealmente entre dispositivos do mesmo usuário).
- **FR-007** Para tipos inscritos, o sync DEVE ser **incremental**: treinos novos sobem via observer do HealthKit (background delivery + enquanto em foreground), filtrando para os tipos inscritos.
- **FR-008** O sync DEVE propagar **deleções** de treinos de tipos inscritos: treino apagado no HealthKit é removido do Supabase.
- **FR-009** Treinos com rota GPS DEVEM ter seus pontos persistidos (`activity_routes`); treinos sem rota NÃO geram registro de rota.
- **FR-010** Operações de escrita DEVEM tolerar **offline**: pendências enfileiram localmente e reprocessam ao reconectar.
- **FR-011** Cada usuário SÓ PODE ler/escrever seus próprios treinos e suas próprias inscrições (isolamento via RLS).
- **FR-012** O app DEVE expor estado de sync **por tipo** (não inscrito / sincronizando / sincronizado / pendente / erro) e o último sync de cada tipo.
- **FR-013** O envio histórico de um tipo DEVE ser em **lote** (batch upsert), paginando o HealthKit para cobrir os 3 anos.
- **FR-014** Treinos sem UUID estável do HealthKit NÃO DEVEM receber ID aleatório (quebraria a dedup); ver [NEEDS CLARIFICATION] abaixo.

## 6. Entidades-chave

- **Activity (Treino)** — um treino do HealthKit. Identidade = UUID do HealthKit. Atributos: tipo (`activityId`/`activityName`), início/fim, duração, calorias, distância, fonte/dispositivo, `tracked`, metadata.
- **ActivityRoute (Rota)** — pontos GPS (lat/lng/alt) de um treino outdoor. 1:1 com Activity (opcional).
- **SyncedType (Tipo inscrito)** — um tipo de treino que o usuário optou por sincronizar. Identidade = a chave do tipo agrupado na UI (label de `getActivityMeta`). Governa o que pode ser enviado.
- **SyncState (Estado de sync)** — âncora/marca da última sincronização por dispositivo do usuário, para o delta incremental dos tipos inscritos.

## 7. Critérios de sucesso (mensuráveis)

- **SC-001** Ao inscrever um tipo, 100% dos treinos **daquele tipo** dos últimos 3 anos existem no Supabase, sem duplicatas.
- **SC-002** Abrir/ler a lista sem tocar em botões resulta em **zero** escritas no Supabase.
- **SC-003** Um re-sync de um tipo sem treinos novos resulta em **zero** novos registros e nenhuma alteração de dados inalterados.
- **SC-004** Um treino novo de um tipo **inscrito** aparece no Supabase em **≤ 5 min** (background) sem abrir o app em foreground; um treino de tipo **não inscrito** nunca aparece.
- **SC-005** Com perda de conexão durante o sync, nenhum treino é perdido nem duplicado após reconectar.
- **SC-006** A rota GPS de uma corrida (tipo inscrito) fica disponível para render de mapa no web.
- **SC-007** Um usuário nunca consegue ler treinos nem inscrições de outro (verificável por teste de RLS).

## 8. Fora de escopo

- Métricas de saúde (passos, FC, sono, nutrição) — feature separada.
- Edição manual de treinos / criação fora do HealthKit (bidirecional).
- Sincronização a partir de Android (Health Connect) ou Garmin/Strava.
- Push notifications sobre sync.
- Resolução de conflito de edição (não existe edição no modelo push-only).

## 9. Pontos a esclarecer

> Os itens abaixo foram resolvidos com um **default** (assumido no [plan.md](./plan.md)); confirmar ou corrigir.

- **[NEEDS CLARIFICATION] Identidade do tipo** — o agrupamento da UI é por *label* de `getActivityMeta` (ex.: "Corrida"). Vários `activityId` colapsam no rótulo genérico **"Treino"** (caso `default`). Inscrever esse balde inscreve um catch-all amplo. **Default assumido:** a chave do tipo é o label; inscrever "Treino" cobre todos os `activityId` que mapeiam para ele. Alternativa: inscrição por `activityId` específico (mais granular, mas a UI não expõe isso hoje).
- **[NEEDS CLARIFICATION] Desinscrever um tipo** — ao tocar para "parar de sincronizar" um tipo: (a) **manter** os dados já enviados e só parar o rastreamento futuro (default, não destrutivo); ou (b) **remover** do Supabase os treinos daquele tipo. **Default assumido:** (a).
- **[NEEDS CLARIFICATION] ID instável** (FR-014): hoje a store usa `id: w.id ?? String(Math.random())`. Para dedup precisamos de ID estável. Opções: (a) **descartar** treinos sem UUID; (b) derivar chave determinística de `start + sourceId + activityId`. **Default assumido:** (b) como fallback.
- **[NEEDS CLARIFICATION] Retenção da rota**: guardar **todos** os pontos ou aplicar simplificação (ex.: Douglas-Peucker) para reduzir payload de corridas longas? **Default assumido:** bruto no MVP, simplificar só na leitura web se necessário.
- **[NEEDS CLARIFICATION] Web**: esta feature cobre só a escrita (mobile→Supabase). A leitura/integração na página de Treinos do web é trabalho derivado — confirmar se entra neste ciclo.
