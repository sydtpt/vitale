#!/usr/bin/env bash
# A janela da Story 1.16 — acrescenta `motivo` e `foto_activity_id` a `edicoes_capa` em
# PRODUÇÃO, registra a versão e confere. No molde do `aplicar.sh` da 1.9.
#
# Três atos, e para em qualquer erro:
#   1. Antes  — confere token, arquivo (sha) e o estado de produção: 68 migrations, a coluna
#               `motivo` ainda ausente, e quantas capas `foto` existem (2 em 18/09/2026).
#   2. Aplica — a migração, o registro da versão e o `notify pgrst` num PAYLOAD SÓ: uma
#               transação implícita, então ou os três ou nenhum.
#   3. Depois — confere a forma nova, item por item, e a contagem de capas contra a do ato 1.
#
#   bash aplicar.sh --ensaio   # o ato 1; a SONDA que prova o transporte transacional; e o
#                              # payload do ato 2 inteiro SEGUIDO DE UMA EXCEÇÃO que carrega as
#                              # conferências — a transação aborta e nada fica.
#   bash aplicar.sh            # escreve em produção; pede "aplicar" por extenso antes do ato 2.
#
# **Por que o ensaio é em produção, e não no banco local.** O ensaio local da 1.9
# (`supabase/ensaio/`) não prepara mais: o `preparar.sh` reprova toda edição impressa depois da
# 1.10 (confere o texto contra o .md das sete edições antigas) e não carrega `edicoes_capa`,
# que é justamente a tabela que esta migração muda. O truque aqui é o mesmo do
# `--falhar-no-fim` de lá: a Management API executa o payload como UMA consulta simples, que o
# Postgres roda como UMA transação implícita — e uma exceção no último bloco desfaz tudo o que
# veio antes dela. O que a exceção leva na mensagem é a conferência do ato 3, medida DENTRO da
# transação, com o backfill já feito.
#
# **Mas o truque inteiro depende de o transporte ser transacional**, e isso a janela da 1.9
# afirmou pela documentação do Postgres, não pela API. Um Postgres local (ou o PGlite, onde
# este SQL foi validado) prova o SQL, não o caminho até produção. Por isso o `--ensaio` começa
# por uma SONDA: uma tabela criada e uma exceção logo depois, no mesmo payload. Se a tabela
# sobreviver, o transporte não é transacional — e nada mais deve ser mandado por este script.
#
# Leitura obrigatória antes da janela: revista-1-9/janela-da-migracao.md, seção 6.
set -uo pipefail

# A raiz sai da posição deste arquivo, não de um caminho fixo: ele roda de qualquer checkout
# ou worktree, desde que a migração ensaiada esteja lá (o sha confere).
REPO=$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)
SQL="$REPO/supabase/migrations/20260918120000_capa_motivo.sql"
VERSAO=20260918120000
NOME=capa_motivo
# O arquivo que foi revisado — se o sha não bater, alguém mexeu depois. Rode o --ensaio de novo
# e só então atualize este número.
SHA_ENSAIADO=cd9b2c72aacc9a62ad72d536ccc66039a6bd1c7b75d87d7fff79c3ff391f0c3c
# As migrations registradas em produção antes desta (conferido em 13/09, sem nenhuma desde então).
MIGRATIONS_ANTES=68
# A tabela da sonda. Nome próprio desta janela, para nunca colidir com nada que exista.
SONDA=_sonda_aplicar_1_16
REF=svyyuhxkblufhfvfvqte
URL="https://api.supabase.com/v1/projects/$REF/database/query"
SO_ENSAIO=0
[ "${1:-}" = "--ensaio" ] && SO_ENSAIO=1

falha() { printf '\n✗ %s\n' "$*" >&2; exit 1; }
ok()    { printf '  ✓ %s\n' "$*"; }

consultar() {  # $1 = SQL; devolve JSON. Falha em qualquer resposta não-2xx.
  jq -n --arg q "$1" '{query: $q}' \
    | curl -sS --fail-with-body -X POST "$URL" \
        -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d @-
}

mandar_sem_falhar() {  # $1 = arquivo com o payload; devolve o corpo, com ou sem erro HTTP.
  jq -Rs '{query: .}' "$1" \
    | curl -sS -X POST "$URL" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d @-
}

# Os payloads montados vivem num diretório só, apagado na saída. (Um diretório, e não uma
# lista de arquivos: o bash do macOS é o 3.2, e um array preenchido dentro de `$(…)` some com
# o subshell.)
TMP=$(mktemp -d -t orbe-1-16) || falha "não consegui criar o diretório temporário"
trap 'rm -rf "$TMP"' EXIT

# O payload do ato 2 — o MESMO que o ensaio manda antes da exceção. A migração, o registro da
# versão e o aviso ao PostgREST numa consulta só: se o registro falhasse depois de a migração
# aplicar (como a 1.9 permitia, em duas chamadas), a migration ficaria "pendente" para sempre e
# um `db push` futuro tentaria repeti-la. O `notify` só é entregue no commit, junto com o resto.
montar_carga() {  # $1 = arquivo de saída
  {
    cat "$SQL"
    # O ';' solto garante que a última instrução do arquivo fechou, mesmo que ele termine
    # num comentário de linha.
    printf '\n;\n'
    printf "insert into supabase_migrations.schema_migrations (version, name) values ('%s', '%s');\n" "$VERSAO" "$NOME"
    printf "notify pgrst, 'reload schema';\n"
  } > "$1"
}

# A conferência, uma consulta só: é o mesmo SQL que o ensaio mede dentro da transação e que o
# ato 3 mede depois do commit — duas réguas diferentes dariam dois vereditos sobre a mesma coisa.
#
# - colunas: as duas novas existem;
# - check: a constraint do motivo, pelo nome;
# - fotos: capas de natureza `foto`;
# - vivas: dessas, as cuja foto ainda existe em activity_photos (do mesmo dono);
# - preenchidas: das vivas, as que ganharam `foto_activity_id` igual ao da foto;
# - motivo_preenchido: capas com motivo — tem de ser ZERO: o porquê não é reconstruído.
CONFERENCIA="select
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'edicoes_capa'
       and column_name in ('motivo', 'foto_activity_id')) as colunas,
  (select count(*) from pg_constraint where conname = 'edicoes_capa_motivo_check') as \"check\",
  (select count(*) from public.edicoes_capa where natureza = 'foto') as fotos,
  (select count(*) from public.edicoes_capa c
     join public.activity_photos p on p.id = c.foto_id and p.user_id = c.user_id
    where c.natureza = 'foto') as vivas"

# O caminho de volta — SÓ IMPRESSO, nunca executado por este script.
imprimir_desfazer() {
  cat <<DESFAZER

── Desfazer, se for preciso ─────────────────────────────
NÃO é executado por este script. Só com o dono, e depois de ler o log do aparelho.
Antes de rodar, saiba o preço: o motivo de toda capa carimbada ou trocada depois da
janela se perde (não há de onde reconstruí-lo), e o JS da 1.16 contra o schema de
volta lê a capa em papel e a troca falha em voz alta — degradado, sem quebra.

begin;
alter table public.edicoes_capa drop constraint if exists edicoes_capa_motivo_check;
alter table public.edicoes_capa drop column if exists motivo, drop column if exists foto_activity_id;
delete from supabase_migrations.schema_migrations where version = '$VERSAO';
notify pgrst, 'reload schema';
commit;
DESFAZER
}

# Falha depois de a migração ter entrado: diz o que houve e mostra o caminho de volta.
falha_depois() { printf '\n✗ %s\n' "$*" >&2; imprimir_desfazer >&2; exit 1; }

echo "── 1. Antes ────────────────────────────────────────────"

command -v jq > /dev/null || falha "jq não está instalado (brew install jq)"

TOKEN=$(security find-generic-password -s "Supabase CLI" -w 2>/dev/null) \
  || falha "token do Supabase CLI ausente no keychain. Rode: supabase login"
ok "token no keychain"

[ -f "$SQL" ] || falha "não achei a migração em $SQL"
sha=$(shasum -a 256 "$SQL" | cut -d' ' -f1)
[ "$sha" = "$SHA_ENSAIADO" ] \
  || falha "o arquivo mudou depois da revisão (sha $sha, esperado $SHA_ENSAIADO). Rode o --ensaio de novo antes de aplicar, e só então atualize SHA_ENSAIADO."
ok "o arquivo é o que foi revisado (sha bate)"

antes=$(consultar "select
  (select count(*) from supabase_migrations.schema_migrations) as migrations,
  (select count(*) from supabase_migrations.schema_migrations where version = '$VERSAO') as registrada,
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'edicoes_capa' and column_name = 'motivo') as motivo,
  (select count(*) from public.edicoes_capa where natureza = 'foto') as fotos,
  (select count(*) from public.edicoes_capa c
     join public.activity_photos p on p.id = c.foto_id and p.user_id = c.user_id
    where c.natureza = 'foto') as vivas,
  (to_regclass('public.$SONDA') is null) as sem_sonda") \
  || falha "produção não respondeu à leitura"
migrations=$(jq -r '.[0].migrations' <<< "$antes")
registrada=$(jq -r '.[0].registrada' <<< "$antes")
motivo=$(jq -r '.[0].motivo' <<< "$antes")
fotos_antes=$(jq -r '.[0].fotos' <<< "$antes")
vivas_antes=$(jq -r '.[0].vivas' <<< "$antes")
sem_sonda=$(jq -r '.[0].sem_sonda' <<< "$antes")

[ "$motivo" = "0" ] || falha "a coluna edicoes_capa.motivo JÁ existe — a migração já foi aplicada. Não repita: rode só a conferência do ato 3 (o SQL está em CONFERENCIA, neste arquivo)."
[ "$registrada" = "0" ] || falha "a versão $VERSAO já está registrada, mas a coluna não existe. Estado incoerente: pare e investigue antes de aplicar."
[ "$migrations" = "$MIGRATIONS_ANTES" ] \
  || falha "produção tem $migrations migrations registradas, e esta janela espera $MIGRATIONS_ANTES.
       Alguma migração entrou (ou saiu) depois de 13/09 — descubra qual antes de seguir, e só então
       ajuste MIGRATIONS_ANTES."
[ "$sem_sonda" = "true" ] \
  || falha "a tabela public.$SONDA existe em produção — sobra de uma sonda anterior que o transporte
       NÃO desfez. Não mande nada: investigue, e só então a apague à mão (drop table public.$SONDA)."
ok "produção tem $migrations migrations registradas, e a coluna motivo ainda não existe"
ok "capas de foto: $fotos_antes (2 em 18/09/2026), das quais $vivas_antes com a foto ainda no acervo"

if [ "$SO_ENSAIO" = 1 ]; then
  # O rótulo entra no dollar-quote e na MENSAGEM: com uma frase fixa, um erro da própria
  # migração que contivesse a frase seria creditado como a exceção do ensaio.
  tag="ensaio_1_16_$(date +%s)_$$"
  grep -q "$tag" "$SQL" && falha "o rótulo $tag aparece na migração; rode de novo"

  printf '\n── Ensaio (a): a sonda do transporte ───────────────────\n'
  # Uma tabela criada e uma exceção no mesmo payload. Se a API mandar as instruções uma a uma
  # (ou em autocommit), a tabela sobrevive à exceção — e o ensaio abaixo, que depende de a
  # exceção desfazer a migração, aplicaria a migração de verdade.
  sonda="$TMP/sonda.sql"
  printf 'create table public.%s (x int);\ndo $%s$ begin raise exception %s; end $%s$;\n' \
    "$SONDA" "$tag" "'sonda do aplicar 1.16 [$tag]'" "$tag" > "$sonda"
  resposta=$(mandar_sem_falhar "$sonda") || falha "a chamada da sonda não chegou a produção"
  limpa=$(consultar "select to_regclass('public.$SONDA') is null as limpa") \
    || falha "produção não respondeu depois da sonda — confira à mão: select to_regclass('public.$SONDA');"
  if [ "$(jq -r '.[0].limpa' <<< "$limpa")" != "true" ]; then
    consultar "drop table if exists public.$SONDA" > /dev/null \
      || printf '  (e o drop da sonda também falhou: apague à mão — drop table public.%s)\n' "$SONDA" >&2
    falha "O TRANSPORTE NÃO É TRANSACIONAL: a tabela da sonda sobreviveu à exceção do mesmo payload.
       A premissa deste script (e do ensaio por exceção) é falsa. NÃO mande mais nada — nem o
       ensaio, nem a migração. A sonda foi apagada; a janela para aqui."
  fi
  grep -q "sonda do aplicar 1.16 \[$tag\]" <<< "$resposta" \
    || { printf '%s\n' "$resposta" >&2
         falha "a sonda não voltou com a exceção dela — a resposta acima é outra coisa. Nada ficou, mas investigue antes de seguir."; }
  ok "a API aplica o payload numa transação só: a tabela da sonda não sobreviveu à exceção"

  printf '\n── Ensaio (b): o payload do ato 2, e uma exceção no fim ─\n'
  carga="$TMP/ensaio.sql"
  montar_carga "$carga"
  cat >> "$carga" <<SQLFIM
do \$$tag\$
declare
  v record;
  v_preenchidas integer;
  v_motivo integer;
  v_migrations integer;
  v_registrada integer;
begin
  $CONFERENCIA
    into v;
  select count(*) into v_preenchidas
    from public.edicoes_capa c
    join public.activity_photos p on p.id = c.foto_id and p.user_id = c.user_id
   where c.natureza = 'foto' and c.foto_activity_id = p.activity_id;
  select count(*) into v_motivo from public.edicoes_capa where motivo is not null;
  select count(*) into v_migrations from supabase_migrations.schema_migrations;
  select count(*) into v_registrada from supabase_migrations.schema_migrations where version = '$VERSAO';
  raise exception '$tag colunas=% check=% fotos=% vivas=% preenchidas=% motivo_preenchido=% migrations=% registrada=%',
    v.colunas, v."check", v.fotos, v.vivas, v_preenchidas, v_motivo, v_migrations, v_registrada;
end
\$$tag\$;
SQLFIM

  # Sem --fail-with-body: o erro é o resultado esperado, e o corpo dele é o que se lê.
  resposta=$(mandar_sem_falhar "$carga") || falha "a chamada do ensaio não chegou a produção"
  linha=$(grep -o "$tag colunas=[0-9]* check=[0-9]* fotos=[0-9]* vivas=[0-9]* preenchidas=[0-9]* motivo_preenchido=[0-9]* migrations=[0-9]* registrada=[0-9]*" <<< "$resposta" | head -1)
  if [ -z "$linha" ]; then
    printf '%s\n' "$resposta" >&2
    falha "a migração falhou ANTES da conferência — a mensagem acima é do Postgres, não do ensaio. Nada ficou (transação única, provada pela sonda)."
  fi
  valor() { sed -n "s/.* $1=\([0-9]*\).*/\1/p" <<< " ${linha#"$tag"}"; }
  e_colunas=$(valor colunas); e_check=$(valor check); e_fotos=$(valor fotos)
  e_vivas=$(valor vivas); e_preenchidas=$(valor preenchidas); e_motivo=$(valor motivo_preenchido)
  e_migrations=$(valor migrations); e_registrada=$(valor registrada)
  printf '  dentro da transação: colunas=%s check=%s fotos=%s vivas=%s preenchidas=%s motivo_preenchido=%s migrations=%s registrada=%s\n' \
    "$e_colunas" "$e_check" "$e_fotos" "$e_vivas" "$e_preenchidas" "$e_motivo" "$e_migrations" "$e_registrada"
  [ "$e_colunas" = "2" ] || falha "ensaio: esperava 2 colunas novas, veio $e_colunas"
  [ "$e_check" = "1" ] || falha "ensaio: o CHECK edicoes_capa_motivo_check não apareceu"
  [ "$e_fotos" = "$fotos_antes" ] || falha "ensaio: capas de foto mudaram de $fotos_antes para $e_fotos dentro da migração"
  [ "$e_preenchidas" = "$e_vivas" ] || falha "ensaio: $e_vivas capas com a foto viva, e só $e_preenchidas ganharam foto_activity_id"
  [ "$e_motivo" = "0" ] || falha "ensaio: $e_motivo capas saíram com motivo — o porquê não se reconstrói"
  [ "$e_migrations" = "$((migrations + 1))" ] || falha "ensaio: esperava $((migrations + 1)) migrations dentro da transação, veio $e_migrations"
  [ "$e_registrada" = "1" ] || falha "ensaio: a versão $VERSAO não foi registrada no mesmo payload"
  ok "a migração e o registro rodam inteiros, e a conferência passa dentro da transação"

  # A prova de que a exceção desfez tudo: a coluna não existe, e nada foi registrado.
  depois=$(consultar "select
    (select count(*) from information_schema.columns
       where table_schema = 'public' and table_name = 'edicoes_capa' and column_name = 'motivo') as motivo,
    (select count(*) from supabase_migrations.schema_migrations where version = '$VERSAO') as registrada,
    (select count(*) from supabase_migrations.schema_migrations) as migrations") \
    || falha "produção não respondeu à leitura depois do ensaio — confira à mão que a coluna motivo NÃO existe"
  [ "$(jq -r '.[0].motivo' <<< "$depois")" = "0" ] \
    || falha "a coluna motivo EXISTE depois do ensaio — a exceção não desfez a transação. Pare e investigue."
  [ "$(jq -r '.[0].registrada' <<< "$depois")" = "0" ] \
    || falha "a versão $VERSAO FICOU registrada depois do ensaio. Pare e investigue."
  [ "$(jq -r '.[0].migrations' <<< "$depois")" = "$migrations" ] \
    || falha "o número de migrations mudou durante o ensaio"
  ok "a exceção desfez tudo: a coluna não existe, nada foi registrado, e continuam $migrations migrations"

  printf '\n(--ensaio) Tudo pronto para aplicar. Nada foi escrito.\n'
  exit 0
fi

printf '\n── 2. Aplicar ──────────────────────────────────────────\n'
printf 'Isto acrescenta motivo e foto_activity_id a edicoes_capa em PRODUÇÃO, preenche\n'
printf 'foto_activity_id das capas de foto e registra a versão — tudo numa transação.\n'
printf 'É aditiva: o app instalado continua funcionando.\n'
printf 'Rodou o --ensaio (com a sonda) antes? Se não, pare e rode.\n'
printf 'Digite "aplicar" para seguir: '
read -r resposta
[ "$resposta" = "aplicar" ] || falha "cancelado — nada foi escrito"

carga="$TMP/aplicar.sql"
montar_carga "$carga"
# A resposta fica fora da lista de temporários: se algo der errado, é ela que se lê depois.
saida=$(mktemp -t orbe-1-16-resposta) || falha "não consegui criar o arquivo temporário"
if jq -Rs '{query: .}' "$carga" \
    | curl -sS --fail-with-body -X POST "$URL" \
        -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d @- > "$saida"; then
  ok "migração aplicada e versão $VERSAO registrada, na mesma transação"
else
  # **Não afirmar "nada mudou" sem olhar.** Um timeout ou uma conexão cortada depois do commit
  # devolvem erro aqui com a migração já de pé. O que vale é o estado de produção agora.
  printf '\n  A chamada falhou. Resposta em %s. Relendo produção antes de dizer qualquer coisa…\n' "$saida" >&2
  estado=$(consultar "select
    (select count(*) from information_schema.columns
       where table_schema = 'public' and table_name = 'edicoes_capa' and column_name = 'motivo') as motivo,
    (select count(*) from supabase_migrations.schema_migrations where version = '$VERSAO') as registrada") \
    || falha "a aplicação falhou E a releitura também. NÃO SEI o estado de produção — NÃO repita a
       aplicação. Confira à mão, quando a API voltar:
         select (select count(*) from information_schema.columns where table_name = 'edicoes_capa'
                   and column_name = 'motivo') as motivo,
                (select count(*) from supabase_migrations.schema_migrations where version = '$VERSAO') as registrada;
       motivo=1 e registrada=1: aplicou — rode a CONFERENCIA deste arquivo. As duas em 0: nada mudou."
  e_motivo=$(jq -r '.[0].motivo' <<< "$estado")
  e_registrada=$(jq -r '.[0].registrada' <<< "$estado")
  printf '  estado real: coluna motivo=%s · versão registrada=%s\n' "$e_motivo" "$e_registrada" >&2
  if [ "$e_motivo" = "1" ] && [ "$e_registrada" = "1" ]; then
    printf '  A migração APLICOU e foi registrada — a resposta é que se perdeu no caminho.\n' >&2
    printf '  NÃO repita a aplicação. Sigo para a conferência.\n' >&2
  elif [ "$e_motivo" = "0" ] && [ "$e_registrada" = "0" ]; then
    falha "confirmado relendo produção: nada mudou (a transação é única). Leia a resposta em $saida
       antes de tentar de novo — e rode o --ensaio outra vez se a causa não for de rede."
  else
    falha_depois "ESTADO INCOERENTE: coluna motivo=$e_motivo, versão registrada=$e_registrada. O payload era um só,
       então isto não deveria existir. PARE: não repita a aplicação, leia $saida e decida com o dono."
  fi
fi

printf '\n── 3. Depois ───────────────────────────────────────────\n'
depois=$(consultar "select q.*,
  (select count(*) from public.edicoes_capa c
     join public.activity_photos p on p.id = c.foto_id and p.user_id = c.user_id
    where c.natureza = 'foto' and c.foto_activity_id = p.activity_id) as preenchidas,
  (select count(*) from public.edicoes_capa where motivo is not null) as motivo_preenchido,
  (select count(*) from supabase_migrations.schema_migrations) as migrations
  from ($CONFERENCIA) as q") \
  || falha_depois "a migração aplicou, mas a conferência não respondeu. Rode a CONFERENCIA deste arquivo à mão."

jq -r '.[0] | to_entries[] | "  \(.key): \(.value)"' <<< "$depois"
v() { jq -r ".[0].\"$1\"" <<< "$depois"; }
[ "$(v colunas)" = "2" ] || falha_depois "conferência: esperava 2 colunas novas, veio $(v colunas)"
[ "$(v check)" = "1" ] || falha_depois "conferência: o CHECK edicoes_capa_motivo_check não está lá"
[ "$(v fotos)" = "$fotos_antes" ] \
  || falha_depois "conferência: o ato 1 contou $fotos_antes capas de foto, e agora são $(v fotos). Uma impressão
       (de um build antigo, na janela) carimbou no meio — confira qual antes de seguir."
[ "$(v preenchidas)" = "$(v vivas)" ] \
  || falha_depois "conferência: $(v vivas) capas com a foto viva, e só $(v preenchidas) com foto_activity_id"
[ "$(v motivo_preenchido)" = "0" ] || falha_depois "conferência: $(v motivo_preenchido) capas com motivo — esperava nulo em todas"
[ "$(v migrations)" = "$((migrations + 1))" ] \
  || falha_depois "migrations registradas: esperado $((migrations + 1)), veio $(v migrations)"

printf '\n✓ As duas colunas estão de pé, o backfill conferido, e a versão registrada (%s migrations).\n\n' "$(v migrations)"
printf 'Agora, na ordem:\n'
printf '  1. Instale o build novo no iPhone (pnpm mobile:device) — o build DA MAIN, já conferido\n'
printf '     com conferir-bundle.py. NÃO publique eas update: o canal preview está em\n'
printf '     rollBackToEmbedded, e o JS entra pelo build.\n'
printf '  2. Abra /revista/mes/2026-07-01: a capa desenha e o disco aparece no canto do véu.\n'
printf '  3. Toque a capa: a ficha diz "Impressa antes de o app guardar o porquê.", e a\n'
printf '     atividade é Tour de la Meuse-Rhin.\n'
printf '  4. Se o app fechar ao abrir: LEIA O LOG antes de nomear a causa —\n'
printf '     xcrun devicectl device process launch --device <id> --console --terminate-existing com.sydtpt.vitale\n'
imprimir_desfazer
