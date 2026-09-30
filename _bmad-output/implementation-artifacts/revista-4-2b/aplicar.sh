#!/usr/bin/env bash
# A janela da Story 4.2b — cria `lua_execucoes` em PRODUÇÃO, registra a versão e confere.
#
# LEIA ANTES: a seção 6 de _bmad-output/implementation-artifacts/revista-1-9/janela-da-migracao.md
# ("O que só se aprendeu fazendo"). As cinco lições de lá valem inteiras aqui, e três delas
# não têm nada a ver com o banco:
#
#   1. O build sai da ÁRVORE ERRADA se a worktree estiver atrás — confira o bundle, não o
#      nome da branch (conferir-bundle.py).
#   2. O Hermes guarda acento em UTF-16: `grep` no main.jsbundle mente se você procurar só
#      numa codificação.
#   3. `mobile/.env` não acompanha worktree, e sem ele o app morre no lançamento com
#      `supabaseUrl is required` — antes de qualquer tela, e sem relação com o schema.
#   4. Ler o LOG antes de nomear a causa. O app fechar no minuto esperado não é prova.
#   5. `eas update` publicado de branch SEM esta migração quebra o app sem ninguém tocar em
#      nada. O canal `preview` está em rollBackToEmbedded desde 13/09; mantenha assim até o
#      build novo estar instalado.
#
# ## O que esta janela tem de diferente da 1.9
#
# **Ela não apaga nada e não muda nada que já existe.** A 1.9 trocou a chave de `edicoes_ia`
# e apagou sete edições; esta só CRIA: uma tabela, duas funções e um constraint trigger. O
# app instalado continua funcionando durante e depois — nenhuma tela lê `lua_execucoes` até a
# story 4.4 existir. Isso torna a janela barata, e é por isso que ela não pede build junto.
#
# **O rollback é um `drop table` limpo**, e está no fim deste arquivo, comentado. Como não há
# dado a preservar (a tabela nasce vazia), desfazer é seguro em qualquer momento antes da
# primeira execução autorizada — e depois dela, nunca, porque a pilha de tentativas é a peça
# anti-gaveta inteira.
#
# ## Antes de rodar isto
#
# O ensaio. Ele não é opcional: o `constraint trigger`, as policies por verbo e os dezenove
# CHECKs deste arquivo só são exercidos por um Postgres de verdade, e o cenário existe.
#
#   supabase/ensaio/subir.sh
#   supabase/ensaio/preparar.sh
#   cat supabase/migrations/20260928130000_lua_execucoes.sql \
#       supabase/ensaio/cenarios/lua-execucoes.sql > /tmp/candidata-com-cenario.sql
#   supabase/ensaio/ensaiar.sh /tmp/candidata-com-cenario.sql
#   supabase/ensaio/descer.sh
#
# Roda em três atos, e para em qualquer erro:
#   1. Antes  — confere token, arquivo (sha pinada) e o estado de produção.
#   2. Aplica — o arquivo inteiro numa chamada só (transação implícita: tudo ou nada),
#               e registra a versão em supabase_migrations.schema_migrations.
#   3. Depois — confere a forma nova, item por item.
#
# Escreve em produção. Pede confirmação por extenso antes do ato 2.
#
#   bash aplicar.sh            # roda
#   bash aplicar.sh --ensaio   # só o ato 1 e o que ele diria (nada é escrito)
set -uo pipefail

# A raiz sai da posição deste arquivo, não de um caminho fixo: ele roda de qualquer checkout
# ou worktree, desde que a migração ensaiada esteja lá (o sha confere).
REPO=$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)
SQL="$REPO/supabase/migrations/20260928130000_lua_execucoes.sql"
VERSAO=20260928130000
NOME=lua_execucoes
# O arquivo que foi ensaiado — se o sha não bater, alguém mexeu depois do ensaio.
# Atualizada em 30/09/2026 (story 4.3): a coluna `janela_versao` entrou na migração ANTES de
# ela ser aplicada — depois custaria uma segunda janela. Reensaie: o `.sql` mudou desde o
# ensaio de 29/09.
SHA_ENSAIADO=05c46bc9a04449365d9f1173a88577182fdf7f6e35c54d1ed3708a56fa7c713b
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

antes=$(consultar "select
  (select count(*) from information_schema.tables
     where table_schema = 'public' and table_name = 'lua_execucoes') as tabela,
  (select count(*) from supabase_migrations.schema_migrations) as migrations,
  (select count(*) from supabase_migrations.schema_migrations where version = '$VERSAO') as ja_registrada") \
  || falha "produção não respondeu à leitura"
tabela=$(jq -r '.[0].tabela' <<< "$antes")
migrations=$(jq -r '.[0].migrations' <<< "$antes")
ja=$(jq -r '.[0].ja_registrada' <<< "$antes")

[ "$tabela" = "0" ] \
  || falha "a tabela lua_execucoes JÁ existe — a migração já foi aplicada. Pule para o ato 3."
[ "$ja" = "0" ] \
  || falha "a versão $VERSAO já está em schema_migrations sem a tabela existir. Alguém registrou à mão; resolva isso antes."
ok "lua_execucoes ainda não existe, e $migrations migrations estão registradas"

if [ "$SO_ENSAIO" = 1 ]; then
  printf '\n(--ensaio) Tudo pronto para aplicar. Nada foi escrito.\n'
  exit 0
fi

printf '\n── 2. Aplicar ──────────────────────────────────────────\n'
printf 'Isto CRIA a tabela lua_execucoes, duas funções e um constraint trigger em PRODUÇÃO.\n'
printf 'Nada existente é alterado, e o app instalado continua funcionando.\n'
printf 'Digite "aplicar" para seguir: '
read -r resposta
[ "$resposta" = "aplicar" ] || falha "cancelado — nada foi escrito"

jq -Rs '{query: .}' "$SQL" \
  | curl -sS --fail-with-body -X POST "$URL" \
      -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d @- > /tmp/orbe-4-2b-aplicar.json \
  || falha "a migração NÃO aplicou. A transação é única: nada mudou. Resposta em /tmp/orbe-4-2b-aplicar.json"
ok "migração aplicada"

consultar "insert into supabase_migrations.schema_migrations (version, name) values ('$VERSAO', '$NOME')" > /dev/null \
  || falha "a migração aplicou, mas o REGISTRO falhou. Rode à mão:
       insert into supabase_migrations.schema_migrations (version, name) values ('$VERSAO', '$NOME');"
ok "versão $VERSAO registrada"

printf '\n── 3. Depois ───────────────────────────────────────────\n'
depois=$(consultar "select
  (select count(*) from public.lua_execucoes) as linhas,
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'lua_execucoes') as colunas,
  (select count(*) from pg_class where relname = 'lua_execucoes' and relrowsecurity) as com_rls,
  (select count(*) from pg_policies where tablename = 'lua_execucoes') as policies,
  (select count(*) from pg_policies where tablename = 'lua_execucoes' and cmd = 'SELECT') as policy_select,
  (select count(*) from pg_policies where tablename = 'lua_execucoes' and cmd = 'INSERT') as policy_insert,
  (select count(*) from pg_policies where tablename = 'lua_execucoes' and cmd in ('ALL','UPDATE','DELETE')) as policy_proibida,
  (select count(*) from pg_trigger where tgname = 'lua_execucoes_quatro_ou_nenhuma' and tgdeferrable and tginitdeferred) as gatilho_deferido,
  (select count(*) from pg_constraint c join pg_class t on t.oid = c.conrelid
     where t.relname = 'lua_execucoes' and c.contype = 'c') as checks,
  (select count(*) from pg_proc where proname in ('lua_execucao_conferir','lua_execucao_completa')) as funcoes,
  (select count(*) from supabase_migrations.schema_migrations) as migrations") \
  || falha "a migração aplicou, mas a conferência não respondeu. Rode as consultas do ato 3 à mão."

jq -r '.[0] | to_entries[] | "  \(.key): \(.value)"' <<< "$depois"
# `colunas` 39 (38 da 4.2b + `janela_versao`, que a story 4.3 acrescentou antes de a migração
# ser aplicada) e `checks` >= 19: os 17 nomeados mais os de coluna. A conferência exata dos
# nomes é do `architecture.test.ts`, que roda offline; aqui o que se quer é que nada tenha
# sumido no caminho até o Postgres.
esperado='{"linhas":0,"colunas":39,"com_rls":1,"policies":2,"policy_select":1,"policy_insert":1,"policy_proibida":0,"gatilho_deferido":1,"funcoes":2}'
for k in linhas colunas com_rls policies policy_select policy_insert policy_proibida gatilho_deferido funcoes; do
  v=$(jq -r ".[0].$k" <<< "$depois"); e=$(jq -r ".$k" <<< "$esperado")
  [ "$v" = "$e" ] || falha "conferência falhou em $k: esperado $e, veio $v"
done
checks=$(jq -r '.[0].checks' <<< "$depois")
[ "$checks" -ge 19 ] || falha "a tabela tem $checks CHECKs e eram ao menos 19 — algum sumiu no caminho"
m=$(jq -r '.[0].migrations' <<< "$depois")
[ "$m" = "$((migrations + 1))" ] || falha "migrations registradas: esperado $((migrations + 1)), veio $m"

printf '\n✓ lua_execucoes está de pé, vazia, com RLS por verbo e o gatilho deferido.\n\n'
printf 'A partir daqui:\n'
printf '  1. Nada muda no app instalado — nenhuma tela lê esta tabela ainda (a 4.4 é quem lê).\n'
printf '  2. NÃO rode o teste lunar ainda. A primeira execução é uma decisão do dono, e ela\n'
printf '     é permanente e contável: a §7.4 conta tentativas, e a primeira já conta.\n'
printf '  3. Ao voltar a publicar `eas update`, publique da main — e nunca de branch que não\n'
printf '     contenha esta migração já aplicada.\n'
printf '\n'
printf 'Rollback (só enquanto a tabela estiver VAZIA — depois da primeira execução, nunca):\n'
printf "  drop trigger if exists lua_execucoes_quatro_ou_nenhuma on public.lua_execucoes;\n"
printf "  drop table if exists public.lua_execucoes;\n"
printf "  drop function if exists public.lua_execucao_completa();\n"
printf "  drop function if exists public.lua_execucao_conferir(uuid, uuid);\n"
printf "  delete from supabase_migrations.schema_migrations where version = '%s';\n" "$VERSAO"
