-- Orbe — Overview reduzido da rota (mapa de "Visão detalhada por país")
-- Spec: .claude/specs/mapa-por-pais
--
-- O mapa agregado por país sobrepõe DEZENAS de rotas de uma vez. Puxar a coluna
-- `points` cheia (jsonb ~7,7k pontos/rota; ~28 MB só nas bikes) num único
-- `in(...)` estoura o statement_timeout de 8s do role `authenticated`. O mapa em
-- escala de país não precisa de resolução cheia — esta coluna gerada guarda ~1 a
-- cada 40 pontos (só lat/lng), calculada NA ESCRITA. Leitura vira O(pequeno) e é
-- reusada por web e mobile (mobile lê a mesma coluna). O `points` cheio continua
-- servindo o detalhe (moving-time/elevação/arte de compartilhamento).

-- ─────────────────────────────────────────────────────────────
-- Função de redução — IMMUTABLE (determinística, sem acesso a tabela), pré-
-- requisito para uso em coluna gerada. Devolve pares compactos [[lat,lng],...]:
-- 1 a cada `every` pontos.
--
-- PERF: expande `points` UMA vez (jsonb_array_elements) e filtra por aritmética
-- pura na ordinalidade. NÃO recomputar comprimento/typeof no WHERE — isso reparsa
-- o blob de pontos (MBs) por elemento e leva a rota grande a >60s (medido). Por
-- isso não guardamos o "último ponto" (irrelevante em escala de país).
-- ─────────────────────────────────────────────────────────────
create or replace function public._route_overview(p jsonb, every int default 40)
returns jsonb
language sql
immutable
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_array((elem->>'lat')::float8, (elem->>'lng')::float8) order by ord
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements(case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end)
       with ordinality as t(elem, ord)
  where (ord - 1) % greatest(every, 1) = 0;
$$;

-- ─────────────────────────────────────────────────────────────
-- Coluna gerada STORED: computa na escrita, cobre todos os caminhos (push do
-- sync HealthKit, ingest Strava/intervals, edição manual) sem tocá-los. O ALTER
-- reescreve a tabela uma vez (aplicar fora de uma janela de sync).
-- ─────────────────────────────────────────────────────────────
alter table public.activity_routes
  add column if not exists route_overview jsonb
  generated always as (public._route_overview(points)) stored;

comment on column public.activity_routes.route_overview is
  'Rota reduzida [[lat,lng],...] (~1/40 pontos + último), derivada de points. Alimenta o mapa agregado por país sem puxar points cheio (evita timeout). Leitura O(pequeno).';
