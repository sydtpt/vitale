# Spec: Histórico de Treinos (mobile)

> **Feature:** `mobile-historico-treinos` · **Status:** 📐 Especificação · **Data:** 2026-05-20  
> **Referência:** [spec web](../historico-treinos/spec.md) · [plan web](../historico-treinos/plan.md)

## 1. Por quê (problema)

As atividades já são sincronizadas do HealthKit para o Supabase via **Sync de Atividades** (`/fitness`), e o **web** tem uma visão analítica completa em `/historico-treinos`. No **mobile**, porém, só existem as telas de sync — não há visão geral por período, sumário por tipo, filtros na lista, nem edição de nenhum dado.

O usuário que está no celular:
- Não consegue ver o histórico durável (do Supabase) das suas atividades em forma analítica.
- Não consegue corrigir um nome ou duração incorreta de um treino pelo celular.
- Não tem o gráfico de evolução por período.

**Objetivo:** criar no mobile a feature **Histórico de Treinos** com paridade de funcionalidade em relação ao web — mesma navegação em 3 níveis, mesmas funcionalidades de visualização e edição.

---

## 2. Decisões de produto

| Decisão | Escolha | Implicação |
|---------|---------|------------|
| Data source | **Supabase `activities`** (não HealthKit) | A leitura analítica vem do banco; o Sync de Atividades (`/fitness`) continua independente |
| Hierarquia de rotas | Nova pasta `/historico/` | Não toca `/fitness/`; coexistem |
| Entry point | Substituir "Treinos" (disabled) no Mais por "Histórico de Treinos" | Sem entrada nova, reutiliza slot existente |
| Gráfico | SVG com `react-native-svg` (já instalado) | Sem biblioteca extra de chart; lógica portada do web |
| Filtros | Painel expansível inline — sem bottom-sheet extra | Simples, sem dependência |
| Edição | Nome (sempre) + duração (só sem GPS) — igual ao web | `locally_edited = true` protege contra sobrescrita |

---

## 3. Usuários e plataforma

- Usuário único autenticado (Supabase Auth). Toda leitura isolada por `user_id` via RLS.
- Plataforma: **iOS** (React Native / Expo). A captura de dados continua sendo feita pelo HealthKit; esta feature só **lê e edita** o Supabase.
- Pré-condição: conteúdo só existe se o usuário já sincronizou ao menos um tipo pelo Sync de Atividades.

---

## 4. Histórias de usuário

### US1 — Estado vazio (P1) 🎯 MVP

Como usuário **sem** atividades sincronizadas, quero abrir o Histórico e entender que preciso sincronizar pelo Sync de Atividades, sem ver uma tela quebrada.

**Aceite:**
- Dado que não tenho atividades, quando abro `/historico`, vejo tela limpa orientando ir a Sync de Atividades.
- Dado que tenho ao menos uma atividade, quando abro, vejo o conteúdo completo.

### US2 — Visão geral por período (P1) 🎯 MVP

Como usuário, quero um card de visão geral com seletor **Semana / Ano / Sempre** e um gráfico de evolução das atividades.

**Aceite:**
- Dado que troco o período, as stats e o gráfico recalculam para o recorte correto (janelas móveis).
- Dado o gráfico de barras empilhadas, quando troco a métrica (distância / duração / calorias / nº), as barras recalculam mantendo separação por tipo.

### US3 — Sumários por tipo (P1) 🎯 MVP

Como usuário, quero ver abaixo da visão geral um card por tipo com agregados **de todo o histórico** (independentes do período do topo), clicáveis.

**Aceite:**
- Cada tipo presente nos dados tem um card com nº total de atividades e distância/duração/calorias acumuladas.
- Tipos sem distância (ex.: Musculação) exibem duração e calorias.
- Tocar o card navega para a lista do tipo.

### US4 — Lista por tipo com filtros (P2)

Como usuário, quero entrar num tipo e ver todas as atividades daquele tipo, com paginação e filtros.

**Aceite:**
- Lista ordenada por data (mais recente primeiro), paginada (load-more na FlatList).
- Filtros: intervalo de datas, faixa de distância, faixa de duração, fonte (sourceName), com/sem rota GPS.
- Aplicar filtro recalcula a lista.

### US5 — Editar uma atividade (P2)

Como usuário, quero abrir uma atividade e corrigir seus dados, e essa edição **não pode ser desfeita** pelo próximo sync.

**Aceite:**
- Posso editar: nome (sempre), duração (só se sem GPS — sem rota e distância = 0).
- Ao salvar, a atividade fica marcada como "editado manualmente" (`locally_edited = true`).
- O próximo sync não sobrescreve a linha editada (garantido pelo `sync_upsert_activities` do lado do Supabase — ver [data-model.md](./data-model.md)).
- Atividade editada exibe badge "editado manualmente" no detalhe e na lista.

### US6 — Incluir / excluir de métricas (P2)

Como usuário, quero marcar uma atividade para ser excluída das estatísticas (toggle `hidden`), sem apagá-la.

**Aceite:**
- Toggle "Incluir nas métricas" no detalhe; desativar marca `hidden = true` → some do gráfico e dos cards de tipo.
- A atividade permanece no banco e pode ser reincluída.

---

## 5. Requisitos funcionais

- **FR-001** A tela de overview DEVE exibir estado vazio orientando ao Sync quando não há atividades.
- **FR-002** Leitura DEVE ser isolada pelo `user_id` autenticado (RLS do Supabase).
- **FR-003** O seletor Semana / Ano / Sempre DEVE usar janelas móveis: Semana = 7 dias (hoje + 6 anteriores); Ano = 12 meses (mês atual + 11 anteriores); Sempre = todo o histórico.
- **FR-004** O gráfico DEVE ser de barras empilhadas por tipo, com buckets temporais derivados do período.
- **FR-005** O gráfico DEVE ter toggle de métrica: distância (km), duração (h), calorias (kcal), nº de atividades.
- **FR-006** Os cards de tipo DEVEM agregar **todo o histórico** (não o período do topo). Tipos sem distância exibem duração/calorias.
- **FR-007** Cada card de tipo DEVE ser clicável, navegando para a lista daquele tipo.
- **FR-008** A lista por tipo DEVE ter paginação (load-more) e filtros (datas, distância, duração, fonte, rota).
- **FR-009** O detalhe de atividade DEVE mostrar mapa GPS se `has_route = true` e houver pontos de rota.
- **FR-010** A edição DEVE seguir as regras: nome sempre editável; duração editável apenas sem GPS; demais campos read-only.
- **FR-011** Ao salvar edição, DEVE setar `locally_edited = true` e `edited_at = now()` via PATCH no Supabase.
- **FR-012** Atividades com `locally_edited = true` DEVEM exibir badge "editado manualmente".
- **FR-013** Atividades com `hidden = true` DEVEM ser excluídas de todas as métricas e listas, mas preservadas no banco.
- **FR-014** O agrupamento por tipo DEVE usar a **mesma função** `getActivityMeta(activityId)` de `mobile/src/lib/workout-types.ts`.

---

## 6. Entidades-chave

- **Activity** — linha de `activities` (Supabase). Esta feature **lê** todas as colunas e **escreve** ao editar, marcando `locally_edited`. `hidden = true` preserva mas exclui da UI analítica.
- **TipoAtividade** — agrupamento derivado de `getActivityMeta(activityId).label`. Não é tabela.
- **Período** — `'semana' | 'ano' | 'sempre'`. Janela móvel temporal para o gráfico e stats.
- **Métrica** — `'distance' | 'duration' | 'calories' | 'count'`. Toggle do gráfico.

---

## 7. Critérios de sucesso

- **SC-001** Sem atividades → só estado vazio, sem seções analíticas.
- **SC-002** Trocar período recalcula 100% das stats e do gráfico para o recorte correto.
- **SC-003** Somas dos cards de tipo conferem contra `count`/`sum` em SQL.
- **SC-004** Trocar a métrica mantém a composição por tipo, só muda a grandeza.
- **SC-005** Atividade editada no mobile mantém os valores após novo sync do tipo.
- **SC-006** Filtros e paginação na lista produzem subconjuntos corretos.
- **SC-007** Usuário nunca vê atividades de outro (RLS).

---

## 8. Fora de escopo

- Capturar ou importar atividades no mobile por esta feature (continua via Sync de Atividades + HealthKit).
- Criar atividades manualmente do zero.
- Sincronização reversa mobile → HealthKit.
- Métricas de saúde fora de treinos (passos, FC, sono).
- Edição de campos como distância, calorias, datas (campos adicionais podem entrar no backlog, mesma decisão do web).
- Edição por campo (travar só campos editados, não a linha inteira) — backlog.
- Multi-source (Strava/Garmin) — backlog.

---

## 9. Pontos esclarecidos

- ✅ **Campos editáveis** — nome (todas) e duração (só sem GPS), mesma regra do web.
- ✅ **Travar do sync** — linha inteira (`locally_edited = true`). Granularidade por campo é backlog.
- ✅ **`hidden` na deleção de linha editada** — quando o sync propagação de deleções for implementada, deve marcar `hidden = true` em vez de apagar. Bloqueado enquanto `react-native-health` não propaga deleções.
- ✅ **Gráfico** — SVG com `react-native-svg`, sem biblioteca extra. Lógica portada do web.
- ✅ **Filtros** — painel expansível inline, sem bottom-sheet extra. Consistente com o resto do mobile.

---

## 10. Backlog (pós-MVP)

- Travar do sync **por campo** (preservar campos não editados nas atualizações do HealthKit).
- Editar campos adicionais: distância, calorias, datas, tipo.
- Multi-source (Strava/Garmin): reconciliar mesma atividade de origens diferentes.
- Propagação de deleções no sync → marcar `hidden = true` em linhas `locally_edited`.
