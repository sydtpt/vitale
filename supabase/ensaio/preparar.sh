#!/usr/bin/env bash
# Põe o banco local na linha de base de produção e prova que ele é fiel o bastante para
# ensaiar uma migração em cima.
#
# A ordem é de propósito: TUDO o que vem de produção é lido primeiro, e só depois o banco local
# é tocado. Produção inalcançável no meio deixaria o local pela metade.
#
#   1. produção (só leitura): as versões registradas, as edições sem o user_id, o catálogo
#   2. a base: o arquivo de cada versão registrada entra na pasta de trabalho por link
#      simbólico. Arquivo do repositório que produção não registrou é PENDENTE — fica fora e é
#      listado. Versão registrada sem arquivo aborta.
#   3. db reset na base, privilégios de produção (com os REVOKE derivados do ACL de lá), o
#      usuário local e as edições reais
#   4. as provas: paridade de catálogo e de ACL, os textos conferidos contra o .md do
#      repositório, e o caminho do app de ponta a ponta (login, REST, RLS)
#
# O retrato da base é APAGADO no começo e só volta a existir se todas as provas passarem — e
# vai carimbado com a data, as contagens, as versões que produção registrou e as migrations
# pendentes. É por ele que o ensaiar.sh sabe que está comparando com produção.
#
#   supabase/ensaio/preparar.sh
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"
sem_argumentos "$@"

MD="$ENSAIO_REPO/docs/specs/revista-retrospectiva/primeiras-edicoes-prompt-v2.md"
CONHECIDAS="$ENSAIO_AQUI/divergencias-conhecidas.txt"
MIG="$ENSAIO_REPO/supabase/migrations"

problemas=0
problema() { printf 'ensaio: FALHOU — %s\n' "$*" >&2; problemas=$((problemas + 1)); }

# Critério de aceite nº 1: rodar o ensaio não muda o `git status` do repositório — nem o que o
# .gitignore esconde dentro de supabase/. Conferido por máquina, não por promessa.
git_antes=$(git_retrato)

# O carimbo da base morre ANTES de o banco ser tocado. Se ele só morresse no portão do fim,
# qualquer aborto duro no meio (carga que falha, lista de conhecidas ausente) deixaria no disco
# o carimbo da corrida anterior, descrevendo um banco que já não existe.
rm -f "$ENSAIO_BASE"

docker_ok
workdir_montar
pilha_de_pe
chaves_locais
diga "== guarda de portas (antes de trazer dado real para cá)"
guarda_de_portas
diga "== o banco local é o de produção?"
versao_conferir

# ─────────────────────────────────────────────────────────────────────────────────
diga "== produção (só leitura) — cada chamada fica em $ENSAIO_LOG"

versoes_prod=$(prod_versoes)
[ -n "$versoes_prod" ] || falha "produção não registrou migration nenhuma"
n_versoes=$(printf '%s\n' "$versoes_prod" | wc -l | tr -d ' ')
versoes_hash=$(printf '%s\n' "$versoes_prod" | shasum -a 256 | cut -c1-12)
diga "  $n_versoes versões registradas em supabase_migrations.schema_migrations (hash $versoes_hash)"

# As edições, sem o user_id: ele fica em produção. Do dono só sai a contagem.
edicoes=$(prod_ler "select (select count(distinct user_id) from public.edicoes_ia) as donos,
  coalesce(json_agg(to_jsonb(e) - 'user_id' order by e.tipo_periodo, e.inicio, e.fim), '[]'::json) as linhas
  from public.edicoes_ia e")
donos=$(jq -r '.[0].donos' <<< "$edicoes")
linhas=$(jq -c '.[0].linhas' <<< "$edicoes")
n_prod=$(jq 'length' <<< "$linhas")
[ "$n_prod" -gt 0 ] ||
  falha "produção não tem edição nenhuma — sem as linhas reais, a conferência dos textos passaria por vacuidade"
[ "$donos" = "1" ] ||
  falha "produção tem $donos donos de edição — remapear todas para um usuário só colidiria na chave"
diga "  $n_prod edições, de 1 dono"

prod_ler "$(cat "$ENSAIO_AQUI/paridade.sql")" | jq -r '.[].l' | LC_ALL=C sort > "$ENSAIO_DIR/paridade-prod.txt"
n_catalogo=$(wc -l < "$ENSAIO_DIR/paridade-prod.txt" | tr -d ' ')
# Leitura truncada é o modo de falha que este repositório já pagou uma vez (o PostgREST corta
# em 1.000 linhas sem erro nenhum). A contagem vem da MESMA consulta, contada do outro lado.
n_esperado=$(prod_ler "select count(*) as n from ($(cat "$ENSAIO_AQUI/paridade.sql")) t" | jq -r '.[0].n')
[ "$n_catalogo" = "$n_esperado" ] ||
  falha "produção contou $n_esperado linhas de catálogo e chegaram $n_catalogo — leitura truncada, e uma paridade sobre catálogo truncado aprovaria qualquer coisa"
diga "  $n_catalogo linhas de catálogo e ACL (produção contou as mesmas $n_esperado)"

# ─────────────────────────────────────────────────────────────────────────────────
diga "== a base"

[ -d "$MIG" ] || falha "não achei $MIG"
arquivos=$(cd "$MIG" && ls -1 2>/dev/null | grep -E '^[0-9]+_.+\.sql$' || true)
[ -n "$arquivos" ] ||
  falha "não há migration nenhuma em supabase/migrations — sem elas não existe base para reproduzir"
arquivos=$(printf '%s\n' "$arquivos" | LC_ALL=C sort)
versoes_repo=$(printf '%s\n' "$arquivos" | sed -E 's/^([0-9]+)_.*/\1/')
duplicada=$(printf '%s\n' "$versoes_repo" | LC_ALL=C sort | uniq -d)
[ -z "$duplicada" ] || falha "duas migrations com a mesma versão no repositório: $(echo $duplicada)"

sem_arquivo=$(LC_ALL=C comm -23 <(printf '%s\n' "$versoes_prod" | LC_ALL=C sort -u) \
                                <(printf '%s\n' "$versoes_repo" | LC_ALL=C sort -u))
[ -z "$sem_arquivo" ] ||
  falha "produção registrou versão que não tem arquivo no repositório: $(echo $sem_arquivo) — a base não é reproduzível"

pendentes=$(LC_ALL=C comm -13 <(printf '%s\n' "$versoes_prod" | LC_ALL=C sort -u) \
                              <(printf '%s\n' "$versoes_repo" | LC_ALL=C sort -u))

rm -rf "$ENSAIO_WD/supabase/migrations"
mkdir -p "$ENSAIO_WD/supabase/migrations"
for v in $versoes_prod; do
  f=$(printf '%s\n' "$arquivos" | grep -E "^${v}_" | head -1)
  ln -s "$MIG/$f" "$ENSAIO_WD/supabase/migrations/$f"
done
diga "  $(ls -1 "$ENSAIO_WD/supabase/migrations" | wc -l | tr -d ' ') migrations na base (link simbólico para o repositório)"
pendentes_nomes="(nenhuma)"
if [ -n "$pendentes" ]; then
  pendentes_nomes=""
  diga "  pendente(s) — no repositório, FORA da base porque produção não registrou:"
  for v in $pendentes; do
    f=$(printf '%s\n' "$arquivos" | grep -E "^${v}_" | head -1)
    diga "    $f"
    pendentes_nomes="${pendentes_nomes:+$pendentes_nomes,}$f"
  done
else
  diga "  nenhuma migration pendente"
fi

# ─────────────────────────────────────────────────────────────────────────────────
diga "== db reset --local"
if ! sb db reset --local --no-seed --yes > "$ENSAIO_DIR/preparar.log" 2>&1; then
  tail -20 "$ENSAIO_DIR/preparar.log" | mascarar >&2
  falha "db reset falhou — log em $ENSAIO_DIR/preparar.log"
fi
diga "  $(grep -cE '^Applying migration' "$ENSAIO_DIR/preparar.log" || true) migrations aplicadas"

versoes_local=$(local_psql -c "select version from supabase_migrations.schema_migrations order by version")
if ! diff -q <(printf '%s\n' "$versoes_prod" | LC_ALL=C sort) <(printf '%s\n' "$versoes_local" | LC_ALL=C sort) >/dev/null; then
  problema "o banco local não registrou exatamente a base de produção"
fi

# O db reset reinicia auth, rest e kong — e serviço que reinicia republica porta. A guarda vale
# depois deles voltarem, não só antes.
diga "== guarda de portas (de novo: o reset republicou as portas)"
guarda_de_portas

diga "== privilégios de produção"
local_psql < "$ENSAIO_AQUI/privilegios.sql" > /dev/null || falha "privilegios.sql falhou"

# Os REVOKE não são escritos à mão: eles saem do ACL que produção acabou de mostrar. Tabela que
# lá não dá acesso a anon/authenticated perde os dois aqui — e uma tabela de segredo criada
# amanhã por uma migration nova entra sozinha nesta conta, sem ninguém lembrar de editar nada.
local_psql -c "select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p') order by 1" > "$ENSAIO_DIR/tabelas-locais.txt"
local_psql -c "select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' order by 1" > "$ENSAIO_DIR/funcoes-locais.txt"
{
  printf 'begin;\n'
  { grep '^acl ' "$ENSAIO_DIR/paridade-prod.txt" || true; } | while IFS= read -r linha; do
    resto=${linha#acl }
    nome=${resto%% *}
    entradas=${resto#* }
    grep -Fxq "$nome" "$ENSAIO_DIR/tabelas-locais.txt" || continue
    papeis=""
    case "$entradas" in *"anon="*) ;; *) papeis="anon" ;; esac
    case "$entradas" in *"authenticated="*) ;; *) papeis="${papeis:+$papeis, }authenticated" ;; esac
    # `if`, não `&&`: um `&&` falso no fim do corpo faz o laço inteiro sair != 0, e sob `set -e`
    # o script morre aqui, calado — foi o que aconteceu na primeira corrida desta versão.
    if [ -n "$papeis" ]; then
      printf 'revoke all on public.%s from %s;\n' "$nome" "$papeis"
    fi
  done
  # Função também tem privilégio, e o GRANT geral de cima devolve EXECUTE a todo mundo. Onde
  # produção declarou ACL e deixou anon/authenticated de fora, o ensaio tira aqui. `(padrão)`
  # não conta: proacl nulo é o padrão embutido do Postgres, que dá EXECUTE a PUBLIC em produção
  # também.
  { grep '^fnacl ' "$ENSAIO_DIR/paridade-prod.txt" || true; } | while IFS= read -r linha; do
    assinatura=$(printf '%s' "$linha" | sed -E 's/^fnacl (.*\)) .*$/\1/')
    entradas=$(printf '%s' "$linha" | sed -E 's/^fnacl .*\) //')
    case "$entradas" in '(padrão)') continue ;; esac
    grep -Fxq "$assinatura" "$ENSAIO_DIR/funcoes-locais.txt" || continue
    papeis=""
    case "$entradas" in *"anon="*) ;; *) papeis="anon" ;; esac
    case "$entradas" in *"authenticated="*) ;; *) papeis="${papeis:+$papeis, }authenticated" ;; esac
    if [ -n "$papeis" ]; then
      printf 'revoke execute on function public.%s from %s;\n' "$assinatura" "$papeis"
    fi
  done
  printf 'commit;\n'
} > "$ENSAIO_DIR/revogar.sql"
n_revoke=$(grep -c '^revoke ' "$ENSAIO_DIR/revogar.sql" || true)
local_psql < "$ENSAIO_DIR/revogar.sql" > /dev/null || falha "os REVOKE derivados do ACL de produção falharam"
diga "  GRANTs do modelo de produção + $n_revoke REVOKE derivado(s) do ACL de lá (tabela e função)"

# ─────────────────────────────────────────────────────────────────────────────────
diga "== as edições reais, sob o usuário local do ensaio"
esperar_200 "$ENSAIO_API/auth/v1/health"
esperar_200 "$ENSAIO_API/rest/v1/"
# O aviso ao PostgREST vem DEPOIS de ele responder: mandado antes, ele se perde no reinício e o
# cache continua o velho — e aí a prova de RLS reprovaria por cache, não por privilégio.
pgrst_recarregar

uid=$(usuario_do_ensaio)
diga "  usuário $ENSAIO_EMAIL de pé"

# jsonb_populate_record ignora em silêncio a chave que a tabela local não tem. Antes de
# carregar, os dois conjuntos de coluna são comparados: coluna que só existe em produção viraria
# dado perdido sem nenhuma mensagem.
cols_prod=$(jq -r '.[0] | keys_unsorted[]' <<< "$linhas" | LC_ALL=C sort)
cols_local=$(local_psql -c "select a.attname from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'edicoes_ia' and a.attnum > 0 and not a.attisdropped
  order by a.attname" | grep -v '^user_id$' | LC_ALL=C sort)
so_prod=$(LC_ALL=C comm -23 <(printf '%s\n' "$cols_prod") <(printf '%s\n' "$cols_local"))
so_local=$(LC_ALL=C comm -13 <(printf '%s\n' "$cols_prod") <(printf '%s\n' "$cols_local"))
[ -z "$so_prod" ] ||
  falha "edicoes_ia tem em produção coluna que a base local não tem — a carga a jogaria fora calada: $(echo $so_prod)"
[ -z "$so_local" ] ||
  falha "edicoes_ia tem na base local coluna que produção não tem: $(echo $so_local) — a base não é a de produção"

# O JSON entra por dollar quote, num rótulo que não aparece nele — e por stdin, não por
# argumento: o texto das edições não passa pela linha de comando.
tag=$(rotulo_livre "$linhas" ensaio)
carregar=$(cat <<SQL
\set VERBOSITY terse
begin;
delete from public.edicoes_ia where user_id = '$uid';
insert into public.edicoes_ia
select (jsonb_populate_record(
          null::public.edicoes_ia,
          r || jsonb_build_object('user_id', '$uid')
        )).*
from jsonb_array_elements(\$$tag\$$linhas\$$tag\$::jsonb) as r;
commit;
SQL
)
# O erro, se houver, passa pela máscara: a mensagem do Postgres pode carregar a linha inteira.
if ! carga=$(printf '%s\n' "$carregar" | local_psql 2>&1); then
  printf '%s\n' "$carga" | mascarar >&2
  falha "a carga das edições falhou"
fi
n_local=$(local_psql -c "select count(*) from public.edicoes_ia")
[ "$n_local" = "$n_prod" ] || problema "produção tem $n_prod edições e o local ficou com $n_local"
diga "  $n_local edições carregadas ($(printf '%s\n' "$cols_prod" | wc -l | tr -d ' ') colunas, as mesmas de produção)"

# ─────────────────────────────────────────────────────────────────────────────────
diga "== paridade de catálogo e de ACL"
local_psql < "$ENSAIO_AQUI/paridade.sql" | LC_ALL=C sort > "$ENSAIO_DIR/paridade-local.txt"
{
  LC_ALL=C comm -23 "$ENSAIO_DIR/paridade-prod.txt" "$ENSAIO_DIR/paridade-local.txt" | sed 's/^/< /'
  LC_ALL=C comm -13 "$ENSAIO_DIR/paridade-prod.txt" "$ENSAIO_DIR/paridade-local.txt" | sed 's/^/> /'
} | LC_ALL=C sort > "$ENSAIO_DIR/divergencias.txt"

for k in col con idx pol fn trg view matview type rls ext evt acl defacl schema fnacl; do
  printf '  %-7s produção %4s · local %4s · divergentes %s\n' "$k" \
    "$(grep -c "^$k " "$ENSAIO_DIR/paridade-prod.txt" || true)" \
    "$(grep -c "^$k " "$ENSAIO_DIR/paridade-local.txt" || true)" \
    "$(grep -cE "^[<>] $k " "$ENSAIO_DIR/divergencias.txt" || true)"
done

[ -f "$CONHECIDAS" ] || falha "sem $CONHECIDAS — sem lista conhecida, toda divergência seria nova"
mal=$({ grep -vE '^[[:space:]]*(#|$)' "$CONHECIDAS" || true; } | grep -vE '^[<>] .+ \#\# .+$' || true)
[ -z "$mal" ] || falha "divergencias-conhecidas.txt tem linha sem motivo (formato '< linha ## motivo'):
$mal"
{ grep -vE '^[[:space:]]*(#|$)' "$CONHECIDAS" || true; } |
  sed -E 's/^(.*) \#\# .*$/\1/' | LC_ALL=C sort -u > "$ENSAIO_DIR/conhecidas.txt"

# Uma linha conhecida pode terminar em '*': vale como prefixo. É o que impede que a versão de
# patch de uma extensão, ou o corpo de uma função da plataforma, vire divergência nova.
curta=$({ grep -E '\*$' "$ENSAIO_DIR/conhecidas.txt" || true; } | awk '{ if (length($0) < 12) print }')
[ -z "$curta" ] || falha "padrão conhecido curto demais (casaria demais):
$curta"

conhecida_que_casa() {
  local d=$1 k pref
  while IFS= read -r k; do
    case "$k" in
      *'*') pref=${k%\*}
            if [ "${d#"$pref"}" != "$d" ]; then printf '%s\n' "$k"; return 0; fi ;;
      *)    if [ "$d" = "$k" ]; then printf '%s\n' "$k"; return 0; fi ;;
    esac
  done < "$ENSAIO_DIR/conhecidas.txt"
  return 1
}

novas=""
: > "$ENSAIO_DIR/conhecidas-usadas.txt"
while IFS= read -r d; do
  [ -n "$d" ] || continue
  if casou=$(conhecida_que_casa "$d"); then
    printf '%s\n' "$casou" >> "$ENSAIO_DIR/conhecidas-usadas.txt"
  else
    novas="$novas$d
"
  fi
done < "$ENSAIO_DIR/divergencias.txt"
sumidas=$(LC_ALL=C comm -23 "$ENSAIO_DIR/conhecidas.txt" <(LC_ALL=C sort -u "$ENSAIO_DIR/conhecidas-usadas.txt"))

n_divergencias=$(wc -l < "$ENSAIO_DIR/divergencias.txt" | tr -d ' ')
diga "  $n_divergencias divergências · $(wc -l < "$ENSAIO_DIR/conhecidas.txt" | tr -d ' ') linhas conhecidas, $(LC_ALL=C sort -u "$ENSAIO_DIR/conhecidas-usadas.txt" | wc -l | tr -d ' ') usadas"
if [ -n "$novas" ]; then
  problema "divergência fora da lista conhecida (diff completo em $ENSAIO_DIR/divergencias.txt):"
  printf '%s' "$novas" | sed 's/^/    /' >&2
fi
if [ -n "$sumidas" ]; then
  diga "  AVISO: linha conhecida que não casou com divergência nenhuma — a lista pode encolher:"
  printf '%s\n' "$sumidas" | sed 's/^/    /'
fi

# ─────────────────────────────────────────────────────────────────────────────────
diga "== os textos, conferidos contra o .md do repositório"
locais=$(local_psql <<'SQL'
select coalesce(json_agg(json_build_object('tipo', tipo_periodo, 'inicio', inicio, 'fim', fim, 'texto', texto)
       order by tipo_periodo, inicio), '[]'::json)
from public.edicoes_ia
SQL
)
veredito=$(jq -r --rawfile md "$MD" '
  def rotulo: {"week": "Semana", "month": "Mês", "season": "Trimestre", "year": "Ano"}[.];
  ($md | split("\n---\n")) as $secoes
  | .[]
  | . as $e
  | (($e.texto // "") | sub("^\\s+"; "") | sub("\\s+$"; "")) as $txt
  | ($e.tipo | rotulo) as $rot
  | if $txt == "" then
      "vazio|\($e.tipo) \($e.inicio): a edição está sem texto — e `contains(\"\")` é sempre verdadeiro, então isto passaria por vacuidade"
    elif $rot == null then
      "sem-rotulo|\($e.tipo) \($e.inicio): tipo de período que o ensaio não sabe traduzir para o .md (conhece week, month, season e year)"
    else
      ("## " + $rot + " · " + $e.inicio + " → " + $e.fim) as $cab
      | ([$secoes[] | select(contains($cab))]) as $s
      | if ($s | length) == 0 then
          "falta|\($e.tipo) \($e.inicio) → \($e.fim): o .md não tem a seção \"\($cab)\""
        elif ($s | length) > 1 then
          "ambigua|\($e.tipo) \($e.inicio) → \($e.fim): o .md tem \($s | length) seções com o cabeçalho \"\($cab)\" — não dá para dizer qual é o registro"
        elif ($s[0] | contains($txt)) then
          "ok|\($e.tipo) \($e.inicio)"
        else
          "difere|\($e.tipo) \($e.inicio) → \($e.fim): a seção existe, o texto não bate"
        end
    end
' <<< "$locais")
ok_textos=$(printf '%s\n' "$veredito" | grep -c '^ok|' || true)
diga "  $ok_textos de $n_local textos estão inteiros em $(basename "$MD")"
if [ "$ok_textos" != "$n_local" ]; then
  problema "edição sem registro no .md — a migração da 1.9 apagaria texto que o git não guarda:"
  printf '%s\n' "$veredito" | grep -v '^ok|' | sed 's/^[^|]*|/    /' >&2
fi

# ─────────────────────────────────────────────────────────────────────────────────
diga "== ponta a ponta: login, REST e RLS"
jwt=$(jwt_do_dono)
ponta_a_ponta edicoes_ia "$jwt" "$n_local" || problema "o caminho do app não fecha na base"

diga "== o log das consultas a produção, relido linha a linha"
log_conferir

# ─────────────────────────────────────────────────────────────────────────────────
git_conferir "$git_antes" || problema "o ensaio mexeu no repositório"

if [ "$problemas" -gt 0 ]; then
  rm -f "$ENSAIO_BASE"
  falha "$problemas conferência(s) falharam — o banco local está de pé, mas não é fiel a produção. O retrato da base NÃO foi gravado: sem ele o ensaiar.sh se recusa a rodar"
fi

# Só agora, e carimbado. O carimbo leva o que o ensaiar.sh precisa reconferir contra produção:
# quantas versões ela tinha registrado, o hash da lista, e o que o repositório ainda deve a ela.
retrato_arquivo "$ENSAIO_BASE" \
  "base fiel a produção · em=$(date '+%Y-%m-%dT%H:%M:%S%z') · edicoes=$n_local · divergencias=$n_divergencias · versoes=$n_versoes · versoes_hash=$versoes_hash · pendentes=$pendentes_nomes"

diga ""
diga "pronto: banco local na base de produção, com as $n_local edições reais."
diga "Agora: supabase/ensaio/ensaiar.sh <candidata.sql>"
