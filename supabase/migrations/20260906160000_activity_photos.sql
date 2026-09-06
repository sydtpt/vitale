-- Orbe — Fotos na pedalada: a foto ligada à atividade, agrupada por parada.
-- ADR 0037 · spec: docs/specs/fotos-na-pedalada/spec.md
-- tasks: _bmad-output/implementation-artifacts/fotos-na-pedalada/tasks.md
--
-- **A imagem não mora aqui, nem em lugar nenhum do Supabase.** O que sobe é o
-- fato: quando a foto foi tirada, onde, e em que ponto do traçado isso cai. O
-- arquivo continua na biblioteca do iPhone, e a web nunca renderiza imagem —
-- ela desenha o pin, marca o trecho e conta quantas foram. Decisão do dono em
-- 06/09/2026, com o caminho de volta documentado na ADR (subir só a capa custa
-- uma coluna e ~55 MB para as 275 rotas de hoje).
--
-- **`asset_id` é ponteiro descartável, não chave.** A Apple documenta que o
-- `localIdentifier` do PhotoKit "é válido para se referir a objetos apenas no
-- contexto de um dispositivo local", e há relatos de mudança ao migrar por
-- Quick Start, ao restaurar backup e após atualização do iOS. Usá-lo como chave
-- mataria todas as ligações na primeira troca de iPhone, em silêncio.
--
-- A chave real é `(user_id, activity_id, taken_at)`. O instante da captura é
-- imutável e existe dos dois lados do casamento — a foto e a rota vêm do mesmo
-- relógio. Quando o ponteiro não resolve, o app varre a janela de novo, re-casa
-- pelo instante e reescreve o `asset_id`. A cura é silenciosa e não precisa de
-- tela. Isso só é possível porque TODO ponto de rota tem `t`: conferido em
-- 275 de 275 rotas de produção, desde julho de 2023.
--
-- **A parada não está aqui de propósito.** É derivada de `activity_routes.points`
-- por `detectStops` (4 min dentro de 60 m), determinística e barata; gravá-la
-- seria cache com risco de divergir quando a rota for reprocessada. Mudar o
-- limiar não pede migration.

create table if not exists public.activity_photos (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  activity_id  text        not null references public.activities(id) on delete cascade,

  -- Ponteiro para a biblioteca local. Nulo enquanto não resolve; reescrito pela cura.
  asset_id     text,
  -- Metade da chave real. Casa com `points[].t` sem conversão.
  taken_at     timestamptz not null,
  lat          numeric,
  lng          numeric,

  media_type   text        not null default 'photo'
                           check (media_type in ('photo','video')),
  duration_s   numeric,

  -- Posição resolvida no traçado, gravada no vínculo. `route_distance_m` já vem
  -- reescalado para `activities.distance_m`: somar o track ponto a ponto
  -- SUPERESTIMA (67,3 km contra 57,05 km medidos na travessia de 29/08 — 18% de
  -- jitter de GPS), e o cartão de fotos precisa falar o mesmo quilômetro que o
  -- cabeçalho da atividade.
  route_index      int,
  route_distance_m numeric,
  offset_m         numeric,
  on_route         boolean not null default false,

  -- `dismissed` faz a foto NÃO voltar na próxima varredura. Sem isto, a foto que
  -- o dono desligou reaparece a cada abertura da atividade.
  state        text        not null default 'linked'
                           check (state in ('linked','dismissed')),
  is_cover     boolean     not null default false,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.activity_photos
  drop constraint if exists activity_photos_video_dur,
  add constraint activity_photos_video_dur
    check (media_type <> 'video' or duration_s is not null),
  drop constraint if exists activity_photos_dur_positive,
  add constraint activity_photos_dur_positive
    check (duration_s is null or duration_s > 0),
  drop constraint if exists activity_photos_coords,
  add constraint activity_photos_coords
    check ((lat is null) = (lng is null)),
  drop constraint if exists activity_photos_route_index_range,
  add constraint activity_photos_route_index_range
    check (route_index is null or route_index >= 0),
  -- "Na rota" é uma afirmação sobre posição: sem posição, não se afirma.
  drop constraint if exists activity_photos_on_route_needs_pos,
  add constraint activity_photos_on_route_needs_pos
    check (not on_route or route_index is not null);

-- A chave de cura. Duas fotos no mesmo instante da mesma atividade seriam a
-- mesma foto; rajada gera instantes distintos.
create unique index if not exists activity_photos_key_uq
  on public.activity_photos (user_id, activity_id, taken_at);

-- O caminho quente: as fotos ligadas de uma atividade.
create index if not exists activity_photos_act_idx
  on public.activity_photos (activity_id) where state = 'linked';

-- Uma capa por atividade — é a foto que o cartão de compartilhar abre.
create unique index if not exists activity_photos_cover_uq
  on public.activity_photos (activity_id) where is_cover;

alter table public.activity_photos enable row level security;

drop policy if exists "own activity_photos" on public.activity_photos;
create policy "own activity_photos" on public.activity_photos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists activity_photos_touch on public.activity_photos;
create trigger activity_photos_touch before update on public.activity_photos
  for each row execute function public.touch_updated_at();

-- Marcador de varredura: evita reabrir a folha de sugestão a cada visita à
-- atividade. Nulo = nunca foi procurada foto nesta pedalada.
alter table public.activities
  add column if not exists photos_checked_at timestamptz;
