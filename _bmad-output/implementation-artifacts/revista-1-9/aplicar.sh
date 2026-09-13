#!/usr/bin/env bash
# A janela da Story 1.9 — aplica a migração em PRODUÇÃO, registra a versão e confere.
#
# Roda em três atos, e para em qualquer erro:
#   1. Antes  — confere token, arquivo, e o estado de produção (7 edições, 67 migrations).
#   2. Aplica — o arquivo inteiro numa chamada só (transação implícita: tudo ou nada),
#               e registra a versão em supabase_migrations.schema_migrations.
#   3. Depois — confere a forma nova, item por item.
#
# Escreve em produção. Pede confirmação por extenso antes do ato 2.
#
#   bash aplicar-1-9.sh            # roda
#   bash aplicar-1-9.sh --ensaio   # só o ato 1 e o que ele diria (nada é escrito)
set -uo pipefail

# A raiz sai da posição deste arquivo, não de um caminho fixo: ele roda de qualquer
# checkout ou worktree, desde que a migração ensaiada esteja lá (o sha confere).
REPO=$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)
SQL="$REPO/supabase/migrations/20260912120000_edicao_por_caderno.sql"
VERSAO=20260912120000
NOME=edicao_por_caderno
# O arquivo que foi ensaiado — se o sha não bater, alguém mexeu depois do ensaio.
SHA_ENSAIADO=f870f5e405d719d059d1d17f0a995ae083aa04a192a538e1b264d2adc49b3b5e
REF=svyyuhxkblufhfvfvqte
URL="https://api.supabase.com/v1/projects/$REF/database/query"
SO_ENSAIO=0
[ "${1:-}" = "--ensaio" ] && SO_ENSAIO=1

falha() { printf '\n✗ %s\n' "$*" >&2; exit 1; }
ok()    { printf '  ✓ %s\n' "$*"; }

consultar() {  # $1 = SQL; devolve JSON
  jq -n --arg q "$1" '{query: $q}' \
    | curl -sS --fail-with-body -X POST "$URL" \
        -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d @-
}

echo "── 1. Antes ────────────────────────────────────────────"

TOKEN=$(security find-generic-password -s "Supabase CLI" -w 2>/dev/null) \
  || falha "token do Supabase CLI ausente no keychain. Rode: supabase login"
ok "token no keychain"

[ -f "$SQL" ] || falha "não achei a migração em $SQL"
sha=$(shasum -a 256 "$SQL" | cut -d' ' -f1)
[ "$sha" = "$SHA_ENSAIADO" ] \
  || falha "o arquivo mudou depois do ensaio (sha $sha, esperado $SHA_ENSAIADO). Reensaie antes de aplicar."
ok "o arquivo é o que foi ensaiado (sha bate)"

antes=$(consultar "select (select count(*) from public.edicoes_ia) as edicoes,
                          (select count(*) from supabase_migrations.schema_migrations) as migrations,
                          (select count(*) from information_schema.tables where table_name = 'edicoes_capa') as capa") \
  || falha "produção não respondeu à leitura"
edicoes=$(jq -r '.[0].edicoes' <<< "$antes")
migrations=$(jq -r '.[0].migrations' <<< "$antes")
capa=$(jq -r '.[0].capa' <<< "$antes")

[ "$capa" = "0" ] || falha "a tabela edicoes_capa JÁ existe — a migração já foi aplicada. Pule para o ato 3."
[ "$edicoes" = "7" ] \
  || falha "produção tem $edicoes edições, e a migração só aceita apagar 7.
       Exporte o texto das novas para docs/specs/revista-retrospectiva/primeiras-edicoes-prompt-v2.md
       e ajuste o número esperado no bloco guarda_das_sete da migração."
ok "produção tem 7 edições, $migrations migrations registradas, e a capa ainda não existe"

if [ "$SO_ENSAIO" = 1 ]; then
  printf '\n(--ensaio) Tudo pronto para aplicar. Nada foi escrito.\n'
  exit 0
fi

printf '\n── 2. Aplicar ──────────────────────────────────────────\n'
printf 'Isto APAGA as 7 edições e muda a chave de edicoes_ia em PRODUÇÃO.\n'
printf 'O app instalado para de funcionar até o JS novo estar ativo.\n'
printf 'Digite "aplicar" para seguir: '
read -r resposta
[ "$resposta" = "aplicar" ] || falha "cancelado — nada foi escrito"

jq -Rs '{query: .}' "$SQL" \
  | curl -sS --fail-with-body -X POST "$URL" \
      -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d @- > /tmp/orbe-1-9-aplicar.json \
  || falha "a migração NÃO aplicou. A transação é única: nada mudou. Resposta em /tmp/orbe-1-9-aplicar.json"
ok "migração aplicada"

consultar "insert into supabase_migrations.schema_migrations (version, name) values ('$VERSAO', '$NOME')" > /dev/null \
  || falha "a migração aplicou, mas o REGISTRO falhou. Rode à mão:
       insert into supabase_migrations.schema_migrations (version, name) values ('$VERSAO', '$NOME');"
ok "versão $VERSAO registrada"

printf '\n── 3. Depois ───────────────────────────────────────────\n'
depois=$(consultar "select
  (select count(*) from public.edicoes_ia) as edicoes,
  (select count(*) from information_schema.columns
     where table_name = 'edicoes_ia' and column_name in ('caderno','posicao','metrica_lider')) as colunas_novas,
  (select count(*) from pg_constraint where conname = 'edicoes_ia_pkey'
     and pg_get_constraintdef(oid) like '%caderno%') as chave_com_caderno,
  (select count(*) from pg_constraint where conname = 'edicoes_ia_posicao_unica' and condeferrable) as unique_deferida,
  (select count(*) from information_schema.tables where table_name = 'edicoes_capa') as capa,
  (select count(*) from pg_class where relname = 'edicoes_capa' and relrowsecurity) as capa_com_rls,
  (select count(*) from pg_proc where proname = 'edicao_imprimir') as funcao,
  (select count(*) from supabase_migrations.schema_migrations) as migrations") \
  || falha "a migração aplicou, mas a conferência não respondeu. Rode o passo 6 do roteiro à mão."

jq -r '.[0] | to_entries[] | "  \(.key): \(.value)"' <<< "$depois"
esperado='{"edicoes":0,"colunas_novas":3,"chave_com_caderno":1,"unique_deferida":1,"capa":1,"capa_com_rls":1,"funcao":1}'
for k in edicoes colunas_novas chave_com_caderno unique_deferida capa capa_com_rls funcao; do
  v=$(jq -r ".[0].$k" <<< "$depois"); e=$(jq -r ".$k" <<< "$esperado")
  [ "$v" = "$e" ] || falha "conferência falhou em $k: esperado $e, veio $v"
done
m=$(jq -r '.[0].migrations' <<< "$depois")
[ "$m" = "$((migrations + 1))" ] || falha "migrations registradas: esperado $((migrations + 1)), veio $m"

printf '\n✓ A forma nova está de pé, e a versão registrada.\n\n'
printf 'Agora, na ordem:\n'
printf '  1. Instale o build novo no iPhone (pnpm mobile:device).\n'
printf '  2. Abra a Retrospectiva num mês fechado — não pode dar erro.\n'
printf '  3. Semeie uma edição e confira a tela (o SQL está nos "Manual checks" da spec).\n'
printf '  4. Desfaça a semeadura quando terminar de olhar.\n'
