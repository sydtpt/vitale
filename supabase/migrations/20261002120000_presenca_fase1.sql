-- Orbe — Presença, Fase 1: a visita vira linha.
--
-- Spec: docs/specs/presenca/spec.md · data-model.md · retrospectiva.md
-- Decisão: docs/decisions/0059-os-dois-motores-de-presenca-escrevem-na-mesma-tabela.md
-- Núcleo puro já em produção de código: packages/shared/src/presence/ (54 checagens).
--
-- ── A TABELA `places` JÁ EXISTIA, E ISSO MUDOU O DESENHO ────────────────────
--
-- O data-model da Presença mandava **criar** `places`. Conferido contra produção em
-- 02/10/2026, ela já existe desde `20260907170000_nome_das_rotas.sql`, com 2 linhas
-- (`kind='home'`, `derived=true`, desde 2025-01-24) e com uma coisa que o spec da
-- Presença não tinha: **vigência**. Uma das duas linhas tem `active_to` — o dono
-- mudou de casa, e o banco já sabia disso enquanto o spec tratava Casa como ponto fixo.
--
-- Criar uma segunda tabela de lugar daria duas respostas para "onde é a casa dele",
-- que é o oposto exato da ADR 0059 ("lugar é dimensão, não módulo"). Então a Presença
-- **adota** a tabela existente. A AD-4 é cumprida e não contrariada: ela manda que
-- cada tabela tenha um só módulo dono do acesso, e esse módulo continua sendo
-- `packages/shared/src/data/places.ts`.
--
-- ── `identidade`: A COLUNA QUE EXISTE POR UMA EXIGÊNCIA DO DONO ─────────────
--
-- Pedida em 02/10, nestas palavras: *"se eu mudar de casa, mudarei o local mas não
-- quero perder as métricas"* — e o mesmo para o escritório.
--
-- A vigência sozinha **não** atende isso. Com uma linha por endereço, somar "tempo em
-- casa" por `place_id` parte a série em duas no dia da mudança. Separar as duas coisas
-- resolve as duas:
--
--   * a LINHA (`id`) é um endereço, com o raio e a janela em que ele valeu — e é dela
--     que a feature de rotas precisa para responder "onde era a casa naquela pedalada";
--   * a IDENTIDADE (`identidade`) atravessa mudanças — é dela que a métrica precisa.
--
-- **A visita aponta para a linha. A métrica agrega pela identidade.** Mudar de casa
-- são duas linhas de SQL: fecha a atual (`active_to`) e abre outra com a mesma
-- `identidade`. Nenhuma métrica se perde, e a história geográfica fica de pé.
--
-- De brinde, resolve um caso que `kind` não resolvia: três mercados são três
-- identidades distintas, enquanto `kind='grocery'` os fundiria num só.
--
-- ⚠ O modo de falha, nomeado: qualquer leitura que agregue por `place_id` em vez de
-- `identidade` **parte a série da mudança em duas, em silêncio**. É por isso que
-- `place_days` carrega as duas colunas, e que isso vira barreira no núcleo.
--
-- ── DOIS RAIOS, PORQUE SÃO DUAS PERGUNTAS ──────────────────────────────────
--
-- `radius_m` em produção é **400 m** nas duas linhas: é a folga com que a feature de
-- rotas decide "esta pedalada começou em casa". O geofence precisa do contrário — o
-- menor raio que ainda mede movimento, medido em 150 m no aparelho dele, com piso de
-- 100 m (a precisão mediana real é ±19,8 m). Um raio de 400 m engoliria o vizinho.
--
-- São grandezas diferentes com o mesmo nome, então ganham nomes diferentes.
--
-- ── O QUE ESTA MIGRAÇÃO NÃO FAZ ────────────────────────────────────────────
--
-- Não declara GRANT. Produção nasceu com o padrão antigo do Supabase (`alter default
-- privileges` concede ALL em `public` para anon/authenticated/service_role) e quem
-- protege é a RLS — ver `supabase/ensaio/privilegios.sql`. Declarar os GRANTs nas
-- migrations é decisão do dono, e ele a adiou; fazer diferente aqui criaria uma linha
-- que o resto do schema não tem.

-- ── 1. `places` adota a Presença ───────────────────────────────────────────

alter table public.places
  add column if not exists identidade          text,
  add column if not exists module              text,
  add column if not exists geofence_slot       smallint,
  add column if not exists geofence_radius_m   int,
  add column if not exists alert_arrive        text,
  add column if not exists alert_depart        text,
  add column if not exists alert_route         text,
  add column if not exists alert_cooldown_min  smallint not null default 60,
  add column if not exists is_private          boolean  not null default false,
  add column if not exists archived_at         timestamptz;

-- As duas linhas que já existem são as duas casas dele, ambas com `label = 'Casa'`.
-- Sem este passo elas nasceriam órfãs da própria coluna que existe para uni-las.
update public.places set identidade = 'casa' where identidade is null and kind = 'home';
update public.places set identidade = kind   where identidade is null;

alter table public.places
  alter column identidade set not null;

comment on column public.places.identidade is
  'Identidade estável do lugar, que ATRAVESSA mudança de endereço. A visita aponta para a linha (id); a métrica agrega por aqui. Mudar de casa = fechar a linha e abrir outra com a mesma identidade.';
comment on column public.places.geofence_radius_m is
  'Raio do geofence do iOS, em metros — piso de 100 (a precisão mediana medida é ±19,8 m). NULO = este lugar não é monitorado. Não confundir com radius_m, que é a folga da âncora de rota (400 m em produção).';
comment on column public.places.geofence_slot is
  'Uma das 20 vagas de região do iOS. NULO = sem vaga, logo sem alerta. Passar do teto não dá erro: o iOS para de entregar as excedentes em silêncio.';
comment on column public.places.alert_cooldown_min is
  'Silêncio entre alertas do mesmo lugar. Sem ele, flapping na borda vira spam e a feature é desligada numa tarde.';
comment on column public.places.is_private is
  'Lugar de terceiro: entra no tempo total, nunca aparece nomeado na Retrospectiva nem em export.';

-- O teto de 20 regiões do iOS é o orçamento real dos alertas, e duas linhas não podem
-- disputar a mesma vaga.
create unique index if not exists places_geofence_slot
  on public.places (user_id, geofence_slot) where geofence_slot is not null;

create index if not exists places_identidade
  on public.places (user_id, identidade, active_from);

alter table public.places
  drop constraint if exists places_geofence_radius_check;
alter table public.places
  add constraint places_geofence_radius_check
  check (geofence_radius_m is null or geofence_radius_m between 100 and 500);

alter table public.places
  drop constraint if exists places_geofence_slot_range;
alter table public.places
  add constraint places_geofence_slot_range
  check (geofence_slot is null or geofence_slot between 0 and 19);

-- ── 2. `visits` — a visita crua, os dois motores na mesma tabela ───────────
--
-- Sem `if not exists`, de propósito, pelo mesmo motivo de `edicoes_capa` e
-- `lua_execucoes`: ele transformaria "a tabela já existe com OUTRA forma" em sucesso
-- calado, e a `create policy` abaixo não é idempotente de qualquer jeito.

create table public.visits (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  place_id        uuid references public.places(id) on delete set null,
  source          text not null check (source in ('geofence','clvisit','manual')),
  client_event_id text,
  arrived_at      timestamptz not null,
  departed_at     timestamptz,
  departed_source text check (departed_source in ('geofence','clvisit','inferred','manual')),
  tz              text not null,
  lat             double precision,
  lon             double precision,
  accuracy_m      real,
  status          text not null default 'provisional'
                    check (status in ('provisional','confirmed','merged')),
  merged_into     uuid references public.visits(id) on delete set null,
  raw             jsonb,
  agg_version     int not null default 1,
  created_at      timestamptz not null default now(),
  constraint visits_ordem check (departed_at is null or departed_at >= arrived_at)
);

comment on column public.visits.place_id is
  'A LINHA do lugar — o endereço em que a visita foi medida. NULO = fora de qualquer lugar conhecido, que é um valor legítimo e não ausência de dado. Para agregar métrica, use places.identidade.';
comment on column public.visits.departed_at is
  'NULO = visita em curso. Não é erro nem dado faltando: é agora.';
comment on column public.visits.departed_source is
  'Como a saída ficou conhecida. `inferred` é o que impede a tela de mentir — "3 h 40 em casa (1 borda estimada)". NULO enquanto a visita estiver aberta.';
comment on column public.visits.client_event_id is
  'O id do evento no aparelho (`placeId:kind:instante`). A fila pode reenviar — rede caiu, app foi morto — e é por aqui que o reenvio não duplica. NULO = linha que não veio da fila (semeadura antiga, correção manual).';
comment on column public.visits.tz is
  'Fuso local NA CHEGADA. O "dia" de uma visita sai daqui, não do fuso de quem lê: uma semana em outro fuso desloca todos os dias e ninguém percebe.';

-- O `CLVisit` reentrega a MESMA chegada quando a saída fica conhecida (fase 3).
-- Sem isto, toda visita vira duas.
create unique index visits_clvisit_key on public.visits
  (user_id, arrived_at, round(lat::numeric, 4), round(lon::numeric, 4))
  where source = 'clvisit';

create unique index visits_geofence_key on public.visits
  (user_id, place_id, arrived_at) where source = 'geofence';

create unique index visits_client_event on public.visits (user_id, client_event_id)
  where client_event_id is not null;

create index visits_user_arrived on public.visits (user_id, arrived_at desc);

alter table public.visits enable row level security;
create policy "own visits" on public.visits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── 3. `place_days` — o rollup que a leitura longa consulta ────────────────
--
-- Existe por um defeito já pago nesta casa: o PostgREST corta em 1000 linhas SEM
-- ERRO. Uma Retrospectiva anual lendo `visits` devolveria um ano curto e calado.

create table public.place_days (
  user_id        uuid not null references auth.users(id) on delete cascade,
  day            date not null,
  place_id       uuid references public.places(id) on delete set null,
  identidade     text,
  seconds        int not null check (seconds >= 0),
  arrivals       smallint not null default 0,
  inferred_edges smallint not null default 0,
  incomplete     boolean  not null default false
);

comment on column public.place_days.place_id is
  'NULO = fora de qualquer lugar conhecido. É daqui que sai "horas fora de casa", e é isto que faz a soma do dia fechar.';
comment on column public.place_days.identidade is
  'Cópia de places.identidade no momento do rollup. Existe para a métrica agregar por aqui e ATRAVESSAR a mudança de casa — agregar por place_id partiria a série em duas, em silêncio. NULO quando place_id é nulo.';
comment on column public.place_days.inferred_edges is
  'Quantas bordas deste dia foram estimadas. Não é enfeite: é o que permite escrever "3 h 40 em casa (1 borda estimada)".';
comment on column public.place_days.incomplete is
  'A permissão caiu neste dia. O dia aparece como BURACO, nunca como número menor — é o risco nº 1 da feature, e o modo de falha dos buracos de sono até 18/07.';

-- `place_id` é nulo no lugar "fora", e coluna de PRIMARY KEY é implicitamente NOT
-- NULL — a chave composta do data-model não existiria. `nulls not distinct` (PG 15+;
-- produção está no 17.6) dá a mesma unicidade sem proibir o nulo.
create unique index place_days_chave
  on public.place_days (user_id, day, place_id) nulls not distinct;

create index place_days_identidade on public.place_days (user_id, identidade, day);

alter table public.place_days enable row level security;
create policy "own place_days" on public.place_days
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── 4. `forgotten_days` — a lápide ─────────────────────────────────────────
--
-- Tabela separada de propósito: dentro de `place_days` a própria chave (`place_id`)
-- denunciaria o lugar que ele mandou esquecer. O dia lembra QUANTO, nunca O QUÊ.
--
-- E ela não se soma ao dia: ela se DESCONTA do que o rollup recolocou como "fora".
-- Apagar uma visita não deixa buraco, deixa vão — o rollup calcula o fora como
-- complemento, e o tempo apagado volta sozinho. Somar a lápide por cima contava duas
-- vezes, e um dia de 24 h fechava em 25 h 10. Ver `presence/esquecer.ts`.

create table public.forgotten_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  day     date not null,
  seconds int not null default 0 check (seconds >= 0),
  visits  smallint not null default 0,
  primary key (user_id, day)
);

comment on table public.forgotten_days is
  'A lápide: o dia lembra quanto foi esquecido, nunca o quê nem onde. medido = rollup − esquecido; naoCoberto = total − rollup.';

alter table public.forgotten_days enable row level security;
create policy "own forgotten_days" on public.forgotten_days
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
