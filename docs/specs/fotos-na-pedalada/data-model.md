# Data Model: Fotos na pedalada — `activity_photos`

> Tabela nova, mais **uma** coluna em `activities`. Nenhum arquivo vai para o Supabase
> Storage. Segue o padrão de RLS / `touch_updated_at` de
> [health_series](../../../supabase/migrations/20260905120000_health_series.sql) e
> [piso das rotas](../../../supabase/migrations/20260906130000_piso_das_rotas.sql).
> Decisão e alternativas: [ADR 0037](../../decisions/0037-a-foto-e-ponteiro-com-chave-de-cura.md).
> Spec: [spec.md](spec.md).

## 1. Tabela

Arquivo a criar na Fase 2: `20260906150000_activity_photos.sql`.

```sql
create table if not exists public.activity_photos (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  activity_id  text        not null references public.activities(id) on delete cascade,

  -- ponteiro descartável: muda em Quick Start, restore e às vezes em update do iOS
  asset_id     text,
  -- chave de cura: reencontra a foto sem o ponteiro
  taken_at     timestamptz not null,
  lat          numeric,
  lng          numeric,

  media_type   text        not null default 'photo'
                           check (media_type in ('photo','video')),
  duration_s   numeric     check (duration_s is null or duration_s > 0),

  -- posição resolvida no traçado, gravada no vínculo
  route_index      int     check (route_index is null or route_index >= 0),
  route_distance_m numeric,
  offset_m         numeric,
  on_route         boolean not null default false,

  state        text        not null default 'linked'
                           check (state in ('linked','dismissed')),
  is_cover     boolean     not null default false,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint activity_photos_video_dur
    check (media_type <> 'video' or duration_s is not null),
  constraint activity_photos_coords
    check ((lat is null) = (lng is null)),
  constraint activity_photos_on_route_needs_pos
    check (not on_route or route_index is not null)
);

create unique index if not exists activity_photos_key_uq
  on public.activity_photos (user_id, activity_id, taken_at);
create index if not exists activity_photos_act_idx
  on public.activity_photos (activity_id) where state = 'linked';
create unique index if not exists activity_photos_cover_uq
  on public.activity_photos (activity_id) where is_cover;

alter table public.activity_photos enable row level security;
create policy activity_photos_own on public.activity_photos for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger activity_photos_touch before update on public.activity_photos
  for each row execute function public.touch_updated_at();

-- marcador de varredura: evita reabrir a folha a cada visita à atividade
alter table public.activities add column if not exists photos_checked_at timestamptz;
```

| Coluna | Tipo | Uso |
|---|---|---|
| `asset_id` | `text` | `localIdentifier` do `expo-media-library`. **Ponteiro, não chave.** Pode ser reescrito pela cura; nulo enquanto não resolve |
| `taken_at` | `timestamptz` | **Metade da chave real.** Instante da captura, em ms. Casa com `points[].t` sem conversão — mesmo relógio dos dois lados |
| `lat`/`lng` | `numeric` | Coordenada da foto. Nulos quando o *Local* estava desligado; os dois juntos, nunca um só (`activity_photos_coords`) |
| `route_index` | `int` | Índice do ponto mais próximo em `activity_routes.points`. É o que o mapa e o trilho consomem |
| `route_distance_m` | `numeric` | Distância acumulada até `route_index` — o "km 38,2" da tela |
| `offset_m` | `numeric` | Distância da foto ao traçado. É o que decide o grupo na folha de confirmação |
| `on_route` | `boolean` | `offset_m <= 40` no momento do vínculo. Desnormalizado porque o corredor pode mudar sem reprocessar o passado |
| `state` | `text` | `dismissed` faz a foto não voltar na próxima varredura (ADR 0037 §5) |
| `is_cover` | `boolean` | A foto que o cartão de compartilhar abre. Uma por atividade, garantido por índice parcial |

## 2. Por que a chave é `(user_id, activity_id, taken_at)`

O `asset_id` é a coisa mais natural para ser chave e é a **errada**: a Apple documenta que
o `localIdentifier` só vale no contexto do dispositivo local, e há relatos de mudança em
Quick Start, restore de backup e atualização do iOS. Uma troca de iPhone apagaria todas as
ligações sem nenhum erro visível.

O instante da captura, ao contrário, é imutável e existe dos dois lados do casamento.
Quando a varredura encontra uma foto cujo `asset_id` não resolve, ela procura pela linha
de mesmo `taken_at` e reescreve o ponteiro. A cura é silenciosa e não precisa de tela.

Isso só é possível porque **todo ponto de rota tem `t`** — conferido em 275 de 275 rotas.

## 3. O que NÃO está aqui

- **A parada.** Derivada de `points` por `detectStops`, determinística e barata. Gravá-la
  seria cache com risco de divergir quando a rota for reprocessada (ADR 0037 §4).
- **O arquivo.** Nenhum bucket, nenhum `storage_path`. Se um dia a Retrospectiva na web
  incomodar, o caminho de volta é uma coluna e um job — o modelo já está preparado, e
  55 MB cobrem uma capa comprimida por atividade nas 275 rotas existentes.
- **A miniatura.** Vem do `expo-media-library` na hora do render, no aparelho.

## 4. O que a web enxerga

Sem imagem, mas não sem dado. Com `route_index`, `route_distance_m`, `taken_at` e a
coordenada, a web desenha o pin no mapa, marca o trecho no trilho e escreve a contagem por
período. A regra que decorre disso: **toda tela que mostrar foto precisa ter uma leitura
equivalente em texto**, ou não entra na web.

## 5. Volume esperado

275 rotas hoje. Numa estimativa generosa de 10 fotos por pedalada com foto, e metade das
pedaladas com foto, dá ~1 400 linhas — sem arrays, sem blob. A tabela é irrelevante em
tamanho; o custo da feature está no aparelho, não no banco.
