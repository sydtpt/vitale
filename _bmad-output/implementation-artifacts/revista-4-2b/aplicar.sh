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
# O ensaio. Ele não é opcional: o `constraint trigger`, as policies por verbo e os 45
# CHECKs deste arquivo (17 nomeados + 28 de coluna) só são exercidos por um Postgres de
# verdade, e o cenário existe. **E ele não foi rodado**: `ENSAIADO_EM` abaixo está vazio.
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
# ## Duas perguntas, dois campos — e elas não são a mesma pergunta
#
# `SHA_ESPERADO` responde *"é o arquivo que este roteiro espera?"*. `ENSAIADO_EM` responde
# *"isto passou por um Postgres de verdade?"*. Até 30/09/2026 havia **um** campo chamado
# `SHA_ENSAIADO`, e o roteiro imprimia `✓ o arquivo é o que foi ensaiado` — uma afirmação
# **falsa**, porque nada foi ensaiado: o campo era só o sha de hoje, atualizado no mesmo
# commit que editava o `.sql`. Um guarda que falharia alto tinha virado um carimbo que mente.
#
# `SHA_ESPERADO` é cobrado por barreira: `architecture.test.ts` calcula o sha256 do `.sql`
# que a linha `SQL=` abaixo aponta e compara com este valor. Editar a migração sem atualizar
# aqui reprova a suíte do núcleo, e não mais só na janela com o token já no keychain.
#
# `ENSAIADO_EM` fica **vazio enquanto ninguém ensaiar** — e é assim que ele está hoje. O ato
# 1 diz isso em letras grandes e não deixa passar em silêncio.
SHA_ESPERADO=cf6dd5fb2960c79eccd81b9b13884da05532ef7310f0d552961c3686410ff6e9
ENSAIADO_EM=
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
[ "$sha" = "$SHA_ESPERADO" ] \
  || falha "o .sql não é o que este roteiro espera (sha $sha, esperado $SHA_ESPERADO).
       Se a migração mudou de propósito, atualize SHA_ESPERADO — e ENSAIADO_EM volta a vazio,
       porque o arquivo ensaiado deixou de existir."
ok "o .sql é o que este roteiro espera (sha bate)"

# A prova de ensaio, que é OUTRA pergunta. Vazio não é um detalhe: é o estado de hoje.
if [ -z "$ENSAIADO_EM" ]; then
  printf '\n  ⚠ este .sql NÃO foi ensaiado — ENSAIADO_EM está vazio.\n'
  printf '    O `constraint trigger`, as policies por verbo e os 45 CHECKs não foram exercidos\n'
  printf '    por Postgres nenhum. Rode o ensaio (as cinco linhas acima), preencha ENSAIADO_EM\n'
  printf '    com a data e só então aplique. Seguir sem isso é aplicar em produção um SQL que\n'
  printf '    ninguém executou.\n'
else
  ok "ensaiado em $ENSAIADO_EM"
fi

antes=$(consultar "select
  (select count(*) from information_schema.tables
     where table_schema = 'public' and table_name = 'lua_execucoes') as tabela,
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'lua_execucoes'
       and column_name = 'janela_versao') as tem_janela_versao,
  (select count(*) from supabase_migrations.schema_migrations) as migrations,
  (select count(*) from supabase_migrations.schema_migrations where version = '$VERSAO') as ja_registrada") \
  || falha "produção não respondeu à leitura"
tabela=$(jq -r '.[0].tabela' <<< "$antes")
tem_jv=$(jq -r '.[0].tem_janela_versao' <<< "$antes")
migrations=$(jq -r '.[0].migrations' <<< "$antes")
ja=$(jq -r '.[0].ja_registrada' <<< "$antes")

# ## O estado PARCIALMENTE aplicado, e quando usar o `alter table`
#
# A coluna `janela_versao` entrou na migração em 30/09 (story 4.3), depois de ela ser
# mergeada e antes de ser aplicada. Se por qualquer motivo a tabela já estiver de pé **sem**
# a coluna — alguém aplicou de um checkout anterior, ou aplicou à mão —, o roteiro não tem
# como seguir: a coluna é `not null` e a story proíbe segunda migração. Sem este ramo o
# script abortava sem saída nenhuma.
#
# Isto **não é uma migração**, é um resgate: é por isso que ele é impresso e não executado, e
# por isso ele não vale como caminho normal (o normal é `drop constraint` + `add constraint`
# em migration, como a barreira do vocabulário lembra). Depois dele o arquivo `.sql` continua
# dizendo a verdade sobre o schema, que é o que um `db diff` futuro compara.
#
# `default 1` é o valor certo por dois motivos: se a tabela está vazia ele é indiferente, e se
# tem linha, essa linha rodou com a régua da v1 — que é justamente o que a coluna afirma. O
# default sai logo depois, senão um insert que esqueça a coluna carimba 1 em silêncio.
if [ "$tabela" != "0" ] && [ "$tem_jv" = "0" ]; then
  falha "a tabela lua_execucoes existe SEM a coluna janela_versao — estado parcialmente aplicado.
       Rode isto UMA vez, e depois volte ao ato 3 deste roteiro:

         alter table public.lua_execucoes
           add column if not exists janela_versao smallint not null default 1
           check (janela_versao >= 1 and janela_versao <= 1000);
         alter table public.lua_execucoes alter column janela_versao drop default;
       — e o \`comment on column\` da coluna, copiado do .sql, palavra por palavra.

       Confira depois que \`colunas\` deu 39, que \`checks\` deu 45 e que o CHECK apareceu
       com o nome lua_execucoes_janela_versao_check."
fi

[ "$tabela" = "0" ] \
  || falha "a tabela lua_execucoes JÁ existe, com a coluna janela_versao — a migração já foi aplicada. Pule para o ato 3."
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
# O aviso do ato 1 rolou para cima trinta linhas atrás. Ele volta aqui, onde a decisão é.
[ -z "$ENSAIADO_EM" ] && printf '\n⚠ ESTE .sql NÃO FOI ENSAIADO (ENSAIADO_EM está vazio).\n\n'
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
# ser aplicada) e `checks` 45: **17 nomeados + 28 de coluna**, contados do próprio `.sql`.
#
# O piso antigo era `-ge 19`, e ele era folgado de um jeito que escondia o próprio propósito:
# numa tabela com 45 constraints `contype='c'`, aceitar 19 é passar com **26 ausentes**. Agora
# é igualdade, e os dois números são cobrados contra o `.sql` por barreira offline
# (`architecture.test.ts`) — se um deles estiver errado, a suíte do núcleo reprova ANTES da
# janela, em vez de o ato 3 descobrir a divergência depois de escrever em produção.
#
# A conferência exata dos NOMES é do `architecture.test.ts`; aqui o que se quer é que nada
# tenha sumido no caminho até o Postgres.
esperado='{"linhas":0,"colunas":39,"com_rls":1,"policies":2,"policy_select":1,"policy_insert":1,"policy_proibida":0,"gatilho_deferido":1,"funcoes":2,"checks":45}'
for k in linhas colunas com_rls policies policy_select policy_insert policy_proibida gatilho_deferido funcoes checks; do
  v=$(jq -r ".[0].$k" <<< "$depois"); e=$(jq -r ".$k" <<< "$esperado")
  [ "$v" = "$e" ] || falha "conferência falhou em $k: esperado $e, veio $v"
done
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
