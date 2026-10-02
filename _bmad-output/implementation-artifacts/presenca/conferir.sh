#!/usr/bin/env bash
# Confere o que o iPhone subiu depois do botão "Enviar para o banco".
#
# Ele é o terceiro ato do rito desta casa (antes / aplica / depois), aplicado ao passo
# do aparelho: o botão é o "aplica", e isto é o "depois". Só lê — não escreve nada.
#
# Os números esperados vêm do núcleo, rodado sobre o log real de 24 dias
# (`packages/shared/src/presence/fixture-24-dias.ts`) e já conferidos contra produção
# numa transação desfeita em 02/10/2026:
#
#   30 visitas · 25 dias no rollup · 23 dias fechando em 86 400 s · 2 parciais (as bordas)
#
#   bash _bmad-output/implementation-artifacts/presenca/conferir.sh
set -uo pipefail

REF=svyyuhxkblufhfvfvqte
URL="https://api.supabase.com/v1/projects/$REF/database/query"

TOKEN=$(security find-generic-password -s "Supabase CLI" -w 2>/dev/null) || {
  printf '✗ token do Supabase CLI ausente no keychain. Rode: supabase login\n' >&2
  exit 1
}

consultar() {
  jq -n --arg q "$1" '{query: $q}' \
    | curl -sS --fail-with-body -X POST "$URL" \
        -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d @-
}

echo "── o que chegou ───────────────────────────────────────"
consultar "
select
  (select count(*) from public.visits)                              as visitas,
  (select count(*) from public.visits where departed_at is null)    as em_curso,
  (select count(*) from public.visits where departed_source = 'inferred') as bordas_estimadas,
  (select count(distinct day) from public.place_days)               as dias,
  (select count(*) from public.place_days where incomplete)         as dias_incompletos,
  (select count(*) from public.places)                              as lugares,
  (select string_agg(distinct identidade, ', ') from public.places) as identidades;
" | jq -r '.[0] | to_entries | map("  \(.key): \(.value)") | .[]'

echo
echo "── a invariante, em SQL ───────────────────────────────"
consultar "
select
  count(*) filter (where s = 86400) as dias_fechando_24h,
  count(*) filter (where s <> 86400) as dias_parciais,
  min(day)::text as de, max(day)::text as ate
from (select day, sum(seconds) s from public.place_days group by day) t;
" | jq -r '.[0] | to_entries | map("  \(.key): \(.value)") | .[]'

echo
echo "── o que NÃO pode acontecer ───────────────────────────"
consultar "
select
  (select count(*) from public.visits v join public.places p on p.id = v.place_id
     where v.arrived_at::date < p.active_from
        or (p.active_to is not null and v.arrived_at::date > p.active_to)) as visita_fora_da_vigencia,
  (select count(*) from public.visits where departed_at < arrived_at)      as saida_antes_da_chegada,
  (select count(*) from public.visits where client_event_id is null)       as sem_id_de_evento,
  (select count(*) from public.place_days where seconds < 0)               as segundos_negativos;
" | jq -r '.[0] | to_entries | map("  \(.key): \(.value)  \(if .value == 0 then "✓" else "✗ OLHE ISTO" end)") | .[]'

echo
echo "── a manchete, do banco ───────────────────────────────"
consultar "
select
  round(sum(seconds) filter (where identidade = 'casa')  / 3600.0, 1) as horas_em_casa,
  round(sum(seconds) filter (where place_id is null)     / 3600.0, 1) as horas_fora,
  count(distinct day) filter (where identidade = 'escritorio')        as dias_de_escritorio
from public.place_days;
" | jq -r '.[0] | to_entries | map("  \(.key): \(.value)") | .[]'
