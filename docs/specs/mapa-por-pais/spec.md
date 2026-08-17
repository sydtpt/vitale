# Spec: Visão detalhada por país (Ciclismo)

> **Feature:** `mapa-por-pais` · **Status:** 📝 especificado (aguardando implementação) · **Data:** 2026-07-22

## 1. Por quê (problema)

Desde o enriquecimento geográfico do ingest ([`enrichCities`](../../../supabase/functions/_shared/ingest.ts#L549-L584), [`geocode.ts`](../../../supabase/functions/_shared/geocode.ts)), toda pedalada com rota GPS ganha uma lista ordenada de cidades atravessadas em [`Activity.cities`](../../../packages/shared/src/models/index.ts#L351). Hoje esse dado só aparece **por treino**, no cartão de compartilhamento ([`share-card-html.ts`](../../../mobile/src/lib/share-card-html.ts)) — não existe nenhuma visão **agregada** que responda "por onde eu já pedalei, no total?".

Sem essa visão, o usuário não consegue:
- Ver, país por país, **todas as pedaladas já feitas** ali, sobrepostas num mapa.
- Ver a **lista de cidades** já visitadas de bike em cada país.

**Objetivo:** um botão **"Visão detalhada"** na lista de Ciclismo do Histórico de Treinos (web) que leva a uma tela por país: mapa com todas as rotas sobrepostas, enquadrado no território do país, e a lista de cidades já visitadas ali.

## 2. Decisões de produto (fechadas)

| Decisão | Escolha | Implicação |
|---------|---------|------------|
| Escopo inicial | **Só Ciclismo** (`activityId` 13) | Único tipo enriquecido com `cities` hoje ([`BIKE_ACTIVITY_ID`](../../../supabase/functions/_shared/ingest.ts#L537)). O botão se baseia em "existe alguma atividade do tipo com `cities` preenchido" — se Corrida/Trilha ganharem enriquecimento depois, o botão aparece lá sem mudança nesta feature |
| Ponto de entrada | Botão **"Visão detalhada"** no topo direito de [`activity-type-page`](../../../web/src/app/features/workout-history/pages/activity-type-page.component.html#L16-L32) (ao lado do título) | Só renderiza quando há ao menos 1 país no histórico do tipo |
| Navegação | Um clique → nova rota `/workout-history/:slug/mapa` (sem menu suspenso) | A própria tela resolve 0/1/N países — ver US1 |
| Seleção de país | **1 só país no histórico** → abre direto nele. **N países** → grade de seleção (bandeira + nome + nº de pedaladas) antes do mapa | Evita passo extra quando é óbvio qual país mostrar |
| Identificação de país | `CityMark.countryCode` (ISO 3166-1 alpha-2, do Nominatim) como fonte principal | Estável e independente de idioma — ver [data-model §1](./data-model.md#1-citymarkcountrycode) |
| Enquadramento do mapa | `fitBounds` ao **bbox do país**; estica por eixo até no máx. **+50 km** além da borda quando alguma rota ultrapassa — nunca mais que isso | Mesma regra pedida para a lista de cidades (§ abaixo); ver [data-model §4](./data-model.md#4-enquadramento-do-mapa-countryviewport) |
| Lista de cidades | Todas as cidades distintas cruzadas pelas pedaladas do país, **limitadas ao território do país ou no máx. 50 km fora** (rotas que cruzam fronteira) | Dedupe por nome normalizado; ordenada alfabeticamente com contador de vezes visitada |
| Lista de treinos | Todas as pedaladas já feitas naquele país, mais recentes primeiro | Reusa [`rt-activity-item`](../../../web/src/app/features/workout-history/components/activity-item.component.ts) em modo lista — sem filtros próprios no MVP |
| Plataforma | **Só web** (pedido explícito) | Mobile fica fora deste spec |

## 3. Usuários e plataforma

- Usuário único autenticado; dados via [`ActivitiesStore`](../../../web/src/app/features/workout-history/data/activities.store.ts) (já carrega `cities` no `SELECT`, [linha 10](../../../web/src/app/features/workout-history/data/activities.store.ts#L10)).
- **Web (Angular)** — nova página dentro da feature `workout-history` existente.
- Sem novo endpoint: rotas GPS já são carregáveis sob demanda via `store.loadRoute(id)`; esta feature precisa apenas de uma variante em lote (ver [plan.md §5.3](./plan.md#53-carregamento-de-rotas-em-lote)).

## 4. Histórias de usuário (priorizadas)

### US1 — Abrir a visão por país a partir da lista de Ciclismo (P1) 🎯 MVP
Como usuário, quero um botão "Visão detalhada" na lista de Ciclismo, para navegar a uma visão agregada de onde já pedalei.

**Cenários de aceite**
- **Dado** que tenho pedaladas com cidades resolvidas em 1 único país, **quando** clico "Visão detalhada", **então** vou direto para o mapa daquele país (sem tela intermediária).
- **Dado** que tenho pedaladas em mais de um país, **quando** clico "Visão detalhada", **então** vejo uma grade com cada país (bandeira, nome, nº de pedaladas), ordenada da mais pedalada para a menos.
- **Dado** que nenhuma pedalada tem `cities` resolvido ainda (enriquecimento pendente), **quando** olho a lista de Ciclismo, **então** o botão "Visão detalhada" não aparece.

### US2 — Ver o mapa com todas as rotas do país selecionado (P1) 🎯 MVP
Como usuário, quero ver, num único mapa, as linhas de todas as pedaladas já feitas num país, enquadradas no território dele, para visualizar minha cobertura ali.

**Cenários de aceite**
- **Dado** um país selecionado, **quando** o mapa carrega, **então** vejo uma polyline por pedalada feita naquele país.
- **Dado** o mesmo país, **quando** o mapa enquadra a vista inicial, **então** ela cobre pelo menos todo o bbox do país (nunca fica menor que o país).
- **Dado** uma rota que atravessa a fronteira para o país vizinho, **quando** o mapa enquadra a vista, **então** ela estica no máximo 50 km além da borda para incluir esse trecho — não mais.

### US3 — Ver a lista de cidades já visitadas no país (P1) 🎯 MVP
Como usuário, quero uma lista de todas as cidades por onde já passei de bike naquele país, para ter um registro do meu "mapa pessoal" de exploração.

**Cenários de aceite**
- **Dado** um país selecionado, **quando** vejo a lista de cidades, **então** ela mostra cada cidade distinta cruzada por qualquer pedalada ali, uma vez só, com quantas pedaladas passaram por ela.
- **Dado** uma cidade cruzada apenas por causa de uma rota que entrou 60 km no país vizinho, **quando** monto a lista do país selecionado, **então** essa cidade **não** aparece (está além do limite de 50 km).

### US4 — Ver a lista de todos os treinos daquele país (P2)
Como usuário, quero ver a lista de pedaladas feitas naquele país (não só o mapa), para poder abrir o detalhe de uma específica.

**Cenários de aceite**
- **Dado** um país selecionado, **quando** rolo a página, **então** vejo a lista de pedaladas daquele país, mais recentes primeiro, cada uma navegável para o detalhe existente (`/workout-history/ciclismo/:id`).

### US5 — Trocar de país sem voltar à lista (P2)
Como usuário, quero trocar de país diretamente na tela do mapa, para comparar países sem navegar de volta.

**Cenários de aceite**
- **Dado** que estou vendo o mapa de um país, **quando** uso o seletor de país da própria tela, **então** o mapa, a lista de cidades e a lista de treinos atualizam para o novo país sem recarregar a página (só troca o `?country=`).

## 5. Fora de escopo

- **Mobile** — só web por ora (replicar depois é um spec à parte, se fizer sentido).
- **Estender enriquecimento a Corrida/Trilha/Caminhada** — o botão já aparece automaticamente quando algum tipo tiver `cities`; estender o `enrichCities` do ingest para outros `activityId` é uma mudança de backend separada, fora deste spec.
- **Fronteira real (polígono)** — a classificação usa bbox ± 50 km, não a fronteira geográfica exata. Pode classificar errado um ponto muito próximo da linha divisória entre dois países vizinhos com bboxes sobrepostos (ex. Benelux). Aceitável para um registro pessoal; ver [data-model §1](./data-model.md#1-citymarkcountrycode) para o critério principal (mais preciso) usado quando disponível.
- **Filtros/ordenação avançados** na lista de treinos do país (US4) — herda só ordenação por data mais recente no MVP.
- **Heatmap tipo Strava** (mapa-múndi único com todas as rotas de todos os países) — aqui a visão é sempre por-país.
