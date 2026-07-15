-- Vitale — Correção do ganho de elevação (histerese)
--
-- O cálculo anterior somava apenas deltas > 1 m entre pontos CONSECUTIVOS.
-- Com altímetro/GPS a ~1 Hz, uma subida contínua gera deltas de ~0,2–0,5 m
-- por ponto — todos descartados —, então o ganho ficava muito subestimado
-- (parecia o "líquido" subida−descida). O algoritmo novo usa histerese:
-- mantém uma âncora e só a avança quando a variação ACUMULADA desde ela
-- passa do limiar (subida ⇒ soma; descida ⇒ só re-ancora). Assim subidas
-- graduais contam por inteiro e ruído < 1 m continua filtrado.
-- Espelha `elevationGainFromPoints` (shared) e `elevationGain` (mobile).

-- ─────────────────────────────────────────────────────────────
-- Função temporária replicando o algoritmo novo.
-- Retorna NULL quando nenhum ponto tem altitude (distingue "plano 0"
-- de "desconhecido").
-- ─────────────────────────────────────────────────────────────
create or replace function public._elevation_gain(points jsonb, threshold numeric default 1)
returns numeric language plpgsql immutable as $$
declare
  gain numeric := 0;
  ref numeric := null;
  alt numeric;
  has_alt boolean := false;
  p jsonb;
begin
  for p in select * from jsonb_array_elements(points) loop
    alt := nullif(p->>'alt', '')::numeric;
    if alt is null then continue; end if;
    has_alt := true;
    if ref is null then
      ref := alt;
    elsif alt - ref > threshold then
      gain := gain + (alt - ref);
      ref := alt;
    elsif ref - alt > threshold then
      ref := alt;
    end if;
  end loop;
  return case when has_alt then gain else null end;
end $$;

-- Recalcula TODAS as linhas com rota (os valores existentes vieram do
-- algoritmo antigo). Só sobrescreve quando a rota tem altitude, para não
-- apagar valores herdados de merge cuja rota persistida não tem `alt`.
update public.activities a
set elevation_m = g.gain
from public.activity_routes r
cross join lateral (select public._elevation_gain(r.points) as gain) g
where r.activity_id = a.id
  and g.gain is not null;

drop function public._elevation_gain(jsonb, numeric);

comment on column public.activities.elevation_m is
  'Ganho de elevação acumulado (m) do track GPS, com histerese de 1 m (subidas graduais contam; ruído < 1 m não). Null sem rota/altitude.';
