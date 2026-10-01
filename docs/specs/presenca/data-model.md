# Presença — modelo de dados

> Spec: [spec.md](spec.md) ·
> Decisão: [ADR 0059](../../decisions/0059-os-dois-motores-de-presenca-escrevem-na-mesma-tabela.md)
>
> **Estado em 30/09/2026:** a Fase 0 está em produção no iPhone e **não toca no Postgres** —
> §1. Nenhuma das tabelas da §2 existe ainda; nenhuma migration foi escrita.

## 1. Fase 0 — o que existe hoje, só no aparelho

Três chaves de AsyncStorage, todas locais, todas descartáveis. Nenhuma sobe para o Supabase.

| Chave | Conteúdo | Arquivo |
|---|---|---|
| `vitale:presence-places` | os lugares âncora — id, nome, centro, raio, carimbos | [`lib/presence-places.ts`](../../../mobile/src/lib/presence-places.ts) |
| `vitale:presence-log` | o diário cru de eventos, teto de 500 | [`lib/presence-events.ts`](../../../mobile/src/lib/presence-events.ts) |
| `vitale:presence-state` | último estado conhecido por região (`in`/`out`) | idem |

```ts
interface PresencePlace {
  id: string; name: string;
  lat: number; lon: number; radiusM: number;   // piso 100 m, teto 500 m
  createdAt?: string;
  geometryChangedAt?: string;  // centro/raio mudou = o instrumento trocou
}

interface PresenceEvent {
  id: string;                  // `${placeId}:${kind}:${at}` — o iOS reentrega evento
  placeId: string; kind: 'enter' | 'exit';
  at: string; tz: string;      // ISO + fuso NA ENTREGA
  lat?: number; lon?: number; accuracyM?: number;
  fixAgeS?: number;            // idade do fix reaproveitado do cache do iOS
  appState: string;            // 'background' é a prova do relançamento
  redundant?: boolean;         // reavaliação de estado, não travessia
}
```

**Três invariantes da Fase 0 que a Fase 1 herda:**

1. `redundant` é o divisor de águas. Relatório de estado **nunca** vira visita — senão cada
   lançamento do app inventa uma chegada (spec §2.1).
2. `tz` é gravado na entrega, não derivado depois. O "dia" de uma visita depende dele.
3. `accuracyM` é gravado sempre, porque o casamento ponto↔lugar é
   `dist < radius_m + accuracy_m` e nunca distância pura.

O teto de **500 eventos** poda **relatório antes de travessia** (`aparar()`). Em 30/09 o log
tinha 363 eventos (73 travessias + 290 relatórios) e nada havia sido descartado.

## 2. Fase 1 — o esqueleto

> Uma migration só, aplicada à mão e registrada em `supabase_migrations.schema_migrations`
> (política do AGENTS.md). RLS por `user_id` em todas as quatro tabelas, no molde das
> existentes.

### 2.1 `places` — o lugar nomeado

```sql
create table places (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users on delete cascade,
  name          text not null,          -- "Casa", "Delhaize Flagey"
  kind          text not null,          -- home|work|gym|grocery|food|culture|other
  module        text,                   -- casa|treino|compras|cultura… → moduleOf()
  lat           double precision not null,
  lon           double precision not null,
  radius_m      int  not null default 150 check (radius_m between 100 and 500),
  geofence_slot smallint check (geofence_slot between 0 and 19),
  alert_arrive  text,                   -- texto do alerta na chegada; null = sem alerta
  alert_depart  text,                   -- idem na saída
  alert_route   text,                   -- rota do app que o alerta abre; a ponte pra fase 4
  alert_cooldown_min smallint not null default 60,
  is_private    boolean not null default false,
  created_at    timestamptz not null default now(),
  archived_at   timestamptz,
  unique (user_id, geofence_slot)
);
```

- **`radius_m`: piso de 100 m, teto de 500 m, padrão 150.** O piso não é gosto: é o erro de
  posição medido (mediana ±19,8 m, com outliers) mais folga. O teto não é do iOS, que
  monitora bem mais — é do problema: nenhum lugar da rotina precisa de meio quilômetro, e um
  raio grande demais não dá erro, **ele mente devagar, engolindo o vizinho**. O padrão de 150
  é o que ele escolheu para Casa depois de 23 dias. `MIN_RADIUS_M` e `MAX_RADIUS_M` no mobile
  são os mesmos números e **movem junto**.
- **`geofence_slot` é o orçamento dos alertas**, não um detalhe de implementação: o iOS
  monitora 20 regiões por app e, passando disso, para de entregar as excedentes **em
  silêncio**. `unique (user_id, geofence_slot)` é o que impede duas linhas disputarem a mesma
  vaga.
- **`module` aponta, não colore.** Nenhum hex aqui (spec §9).

### 2.2 `visits` — a visita crua, os dois motores

```sql
create table visits (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users on delete cascade,
  place_id        uuid references places on delete set null,
  source          text not null,        -- geofence|clvisit|manual
  client_event_id text,                 -- id do evento no aparelho; idempotência da fila
  arrived_at      timestamptz not null,
  departed_at     timestamptz,          -- null = visita aberta
  departed_source text,                 -- geofence|clvisit|inferred|manual
  tz              text not null,        -- fuso local NA CHEGADA. viagem depende disto.
  lat             double precision,
  lon             double precision,
  accuracy_m      real,
  status          text not null default 'provisional',  -- provisional|confirmed|merged
  merged_into     uuid references visits on delete set null,
  raw             jsonb,                -- "grava tudo + botão esquecer"
  agg_version     int not null default 1,
  created_at      timestamptz not null default now()
);

-- o CLVisit reentrega a MESMA chegada quando a saída fica conhecida.
-- sem isto, toda visita vira duas.
create unique index visits_clvisit_key on visits
  (user_id, arrived_at, round(lat::numeric,4), round(lon::numeric,4))
  where source = 'clvisit';

create unique index visits_geofence_key on visits
  (user_id, place_id, arrived_at) where source = 'geofence';

-- a fila local pode reenviar o mesmo evento: rede caiu, app foi morto, retry.
create unique index visits_client_event on visits (user_id, client_event_id)
  where client_event_id is not null;

create index visits_user_arrived on visits (user_id, arrived_at desc);
```

`client_event_id` não estava na proposta de 06/09 e entra agora porque a Fase 0 já provou
que **o iOS reentrega evento**: o log local deduplica por
`${placeId}:${kind}:${at}` desde o primeiro dia. Levar essa chave até o banco faz a fila e a
importação dos 23 dias (§4) serem idempotentes pelo mesmo mecanismo, em vez de dois.

### 2.3 `place_days` — o rollup que os módulos leem

```sql
create table place_days (
  user_id        uuid not null,
  day            date not null,   -- dia LOCAL; visita que cruza a meia-noite é dividida
  place_id       uuid,            -- null = fora de qualquer lugar conhecido
  seconds        int not null,
  arrivals       smallint not null,
  inferred_edges smallint not null default 0,  -- quantas bordas foram estimadas
  incomplete     boolean not null default false, -- permissão caiu neste dia
  primary key (user_id, day, place_id)
);
```

Existe por uma razão medida: **o PostgREST corta em 1000 linhas sem erro**. Uma
Retrospectiva anual lendo `visits` bateria nesse teto e devolveria um ano curto, calado.

`inferred_edges` é o que impede a tela de mentir — "3 h 40 em casa *(1 borda estimada)*".
`incomplete` é o antídoto do risco nº 1 (permissão cai, app emudece): o dia afetado aparece
como buraco, nunca como número menor.

### 2.4 `forgotten_days` — a lápide

```sql
-- o dia lembra QUANTO esqueceu, nunca O QUE.
-- tabela separada de propósito: dentro de place_days a própria chave
-- (place_id) denunciaria o lugar que ele mandou esquecer.
create table forgotten_days (
  user_id uuid not null,
  day     date not null,
  seconds int  not null default 0,
  visits  smallint not null default 0,
  primary key (user_id, day)
);
```

Invariante que nenhuma tela pode quebrar: **`medido + esquecido + não coberto` = o dia.**

O guarda de 48 h contra ressurreição (spec §8) guarda **só o instante** da chegada esquecida,
nunca a coordenada, e é purgado depois. Ele só passa a ser necessário na fase 3, quando o
`CLVisit` reentrega chegadas — mas a coluna nasce na fase 1 para a lápide não ter que mudar
de forma depois.

## 3. O que a fase 3 acrescenta

Nada de estrutural: `source = 'clvisit'` nas mesmas tabelas, o índice
`visits_clvisit_key` que já está no DDL, e as regras de sobreposição (spec §5.1). É essa a
aposta inteira da [ADR 0059](../../decisions/0059-os-dois-motores-de-presenca-escrevem-na-mesma-tabela.md).

## 4. A semeadura: os 23 dias da Fase 0

O log local vira `visits` numa passada, sem migration especial:

1. Descartar todo evento com `redundant = true`. **Só travessia vira visita.**
2. Por `placeId`, parear `enter` → `exit` em ordem cronológica. `enter` sem par fecha por
   `inferred` (teto de 16 h); o último `enter` em aberto é a visita em curso e fica com
   `departed_at is null`.
3. Aplicar colagem (< 20 min) e passagem (< 8 min) — as mesmas funções puras que a fila usa
   daí em diante, exercitadas de graça contra 73 eventos reais.
4. `source='geofence'`, `client_event_id` = o id do evento de chegada, `tz` e `accuracy_m`
   copiados do evento.
5. Os dois `PresencePlace` locais viram duas linhas em `places`, e o `id` local é preservado
   como `places.id` — assim o `identifier` da região no iOS não muda e o monitoramento não
   precisa ser rearmado.

Rendimento esperado: **~36 visitas** a partir de 73 travessias, cobrindo 07→30/09/2026.

**Por que vale a pena:** esse histórico não é recuperável por nenhum outro caminho (spec §1),
e o log morre junto com o container do app numa reinstalação que apague dados.
