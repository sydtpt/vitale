-- Vitale — O guard da rota protege o TRAÇADO, não a linha inteira
--
-- Cenário real, medido no iPhone em 10/10/2026. O passe de piso roda no
-- aparelho (ADR 0035) e grava em `activity_routes.surface_segments`. Numa
-- pedalada que também chegou pela Strava/intervals, essa escrita era
-- **cancelada em silêncio**:
--
--   piso 94E3A0EF-…: a marca de falha não casou nenhuma linha
--
-- O `activity_routes_guard` é `BEFORE UPDATE` e devolve `null` quando um
-- cliente não privilegiado toca a rota de uma atividade com provider (ADR
-- 0020). Um trigger `BEFORE` que devolve `null` **cancela o update sem erro**:
-- zero linhas, `error: null` no PostgREST. O guard é cego a QUAL coluna está
-- sendo escrita, então ele barrava também o carimbo do piso — que não
-- substitui traçado nenhum.
--
-- O estrago não era só o piso faltando. O `saveActivitySurface` escreve em
-- duas tabelas: a rota (bloqueada, em silêncio) e depois a atividade
-- (liberada). O banco ficou com `activities.surface_mix` de 106.635 m e
-- `activity_routes.surface_segments` NULO — mix sem segmento, um estado que o
-- código não sabe produzir. E como a fila do piso é "quem tem
-- `surface_segments` nulo", a rota voltava a cada sync, era recalculada, o mix
-- reescrito, para sempre, sem um único erro em lugar nenhum.
--
-- O conserto é estreitar o guard ao que ele sempre quis proteger. As duas
-- razões da ADR 0020 — rota pobre sobre rota rica, e cópia do HealthKit sobre
-- rota de provider — falam das MESMAS duas colunas: `points` e `point_count`.
-- Um update que não as toca não é substituição de rota, e não tem por que ser
-- barrado.
--
-- O que NÃO muda: com o traçado mudando, as duas guardas valem exatamente como
-- antes, para qualquer cliente, inclusive um build antigo ainda instalado.

create or replace function public.activity_routes_guard()
returns trigger language plpgsql as $$
declare
  privileged boolean := current_user in ('postgres', 'service_role', 'supabase_admin');
  has_provider boolean;
begin
  -- Escrita que não toca o traçado passa direto. É o caso do piso
  -- (`surface_segments`/`surface_meta`) e de qualquer carimbo futuro na linha.
  -- O `point_count` vem primeiro porque é O(1) e resolve quase tudo antes de
  -- comparar o jsonb dos pontos.
  if new.point_count is not distinct from old.point_count
     and new.points is not distinct from old.points then
    return new;
  end if;

  if not privileged then
    -- Sob RLS o usuário enxerga a própria linha; linha invisível ⇒ null ⇒
    -- falha aberta, que é o lado seguro para o dono do dado.
    select coalesce(a.external_ids ?| array['strava', 'intervals'], false)
      into has_provider
    from public.activities a
    where a.id = new.activity_id;

    -- Rota de atividade com provider é do ingest. A cópia que a ponte
    -- (app da Strava/Garmin Connect) deixa no HealthKit não a substitui.
    if coalesce(has_provider, false) then
      return null;
    end if;
  end if;

  -- Para todo o resto: rota mais pobre não substitui a mais rica. Mesma
  -- heurística que `planMerge` já usa (`attachRoute` exige mais pontos).
  -- Contagem igual passa — é o re-push idempotente do mesmo track.
  if new.point_count < old.point_count then
    return null;
  end if;

  return new;
end $$;

comment on function public.activity_routes_guard() is
  'Impede que uma rota mais pobre substitua uma mais rica, e que um cliente não-privilegiado substitua a rota de atividade com provider (ADR 0020). Só UPDATE, e só quando o TRAÇADO muda: escrita que não toca `points`/`point_count` (o carimbo do piso, por exemplo) passa direto — barrá-la cancelava o update em silêncio e deixava `surface_mix` sem `surface_segments` (10/10/2026).';
