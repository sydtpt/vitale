#!/usr/bin/env bash
# Detecta desvio entre o schema de produção e o que as migrations criam.
# Ver ADR docs/decisions/0011-schema-mora-em-migrations.md — objeto em produção
# que nenhuma migration cria é defeito, porque some num ambiente novo.
#
# Uso: supabase/scripts/check-schema-drift.sh
# Sai com código != 0 quando há desvio.
set -euo pipefail

PROJECT_REF="svyyuhxkblufhfvfvqte"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

TOKEN=$(security find-generic-password -s "Supabase CLI" -w 2>/dev/null) || {
  echo "erro: token do CLI do Supabase não encontrado no keychain (service 'Supabase CLI')." >&2
  exit 2
}

prod=$(curl -sf -X POST "https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"select table_name from information_schema.tables where table_schema='"'"'public'"'"' and table_type='"'"'BASE TABLE'"'"' order by table_name;"}' \
  | jq -r '.[].table_name' | sort)

migs=$(grep -rhoiE "create table (if not exists )?(public\.)?[a-z_]+" "$ROOT"/supabase/migrations/*.sql \
  | awk '{print $NF}' | sed 's/public\.//' | sort -u)

only_prod=$(comm -23 <(echo "$prod") <(echo "$migs"))
only_mig=$(comm -13 <(echo "$prod") <(echo "$migs"))

status=0
if [ -n "$only_prod" ]; then
  echo "DESVIO — em produção, nenhuma migration cria:"
  echo "$only_prod" | sed 's/^/  /'
  status=1
fi
if [ -n "$only_mig" ]; then
  echo "DESVIO — migration cria, não existe em produção:"
  echo "$only_mig" | sed 's/^/  /'
  status=1
fi
[ $status -eq 0 ] && echo "sem desvio: $(echo "$prod" | wc -l | tr -d ' ') tabelas, todas versionadas."
exit $status
