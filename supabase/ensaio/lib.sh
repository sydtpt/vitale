# shellcheck shell=bash
# supabase/ensaio/lib.sh — o ambiente e as guardas do ensaio da migração, num lugar só.
#
# Carregado (`source`) por subir.sh, preparar.sh, ensaiar.sh e descer.sh; não roda sozinho, e
# por isso não tem shebang nem bit de execução. Escrito para o bash 3.2 do macOS: sem array
# associativo, sem mapfile, sem ${x,,}. E sem `local x=$(…)`, que engole o status da
# substituição.
#
# As guardas, e onde cada uma mora:
#   prod_ler         produção só é LIDA: uma instrução select/with por chamada, sem ';',
#                    embrulhada em `begin transaction read only; …; commit;`. Toda chamada vai
#                    para $ENSAIO_LOG antes de sair para a rede — a consulta, nunca a resposta
#                    nem o token. `guarda_de_leitura` confere que nenhum script do ensaio fala
#                    com a Management API por fora dela.
#   sb               o Supabase CLI roda só numa pasta de trabalho temporária, SEM link com
#                    produção, e recusa db push, link, --linked, --db-url e --project-ref. O
#                    ambiente que o CLI também lê (SUPABASE_*) é limpo aqui.
#   portas_conferir  nenhuma porta do ensaio escuta fora de 127.0.0.1 no Mac.
#   versao_conferir  o banco local é a imagem de produção, na mesma versão, e a migração roda
#                    com o mesmo papel — conferido contra produção NESTA corrida, não contra
#                    arquivo nem contra cache de ontem.
#   git_*            rodar o ensaio não muda o `git status` do repositório, incluindo o que o
#                    .gitignore esconde dentro de supabase/.
#   trava            um ensaio por vez: dois dividiriam pasta, contêiner e volume.

set -euo pipefail

ENSAIO_REPO=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)
ENSAIO_AQUI="$ENSAIO_REPO/supabase/ensaio"

# A pasta do ensaio fica FORA do repositório: rodar o ensaio não muda o `git status`.
if [ -n "${ENSAIO_DIR:-}" ]; then
  ENSAIO_DIR=${ENSAIO_DIR%/}
else
  ENSAIO_DIR=${TMPDIR:-/tmp}
  ENSAIO_DIR="${ENSAIO_DIR%/}/orbe-ensaio"
fi
ENSAIO_WD="$ENSAIO_DIR/workdir"              # o --workdir do CLI (tem supabase/ dentro)
ENSAIO_LOG="$ENSAIO_DIR/prod-consultas.log"  # uma linha JSON por chamada à Management API
ENSAIO_BASE="$ENSAIO_DIR/retrato-base.txt"   # o retrato carimbado da base, escrito pelo preparar.sh

# O arquivo que manda o colima repassar para 127.0.0.1 o que a VM publica em 0.0.0.0.
# Variável para a guarda poder ser exercitada sem mexer na máquina.
ENSAIO_OVERRIDE=${ENSAIO_OVERRIDE:-$HOME/.colima/_lima/_config/override.yaml}
# O token do CLI no keychain — o mesmo de supabase/scripts/check-schema-drift.sh.
ENSAIO_KEYCHAIN=${ENSAIO_KEYCHAIN:-Supabase CLI}
ENSAIO_PROD_REF="svyyuhxkblufhfvfvqte"
# O host da Management API mora numa variável só, e a guarda de leitura confere que ele aparece
# uma vez só no ensaio inteiro: é aqui.
ENSAIO_API_HOST="api.supabase.com"

ENSAIO_EMAIL="ensaio@orbe.local"
ENSAIO_SENHA="ensaio-local"

# Teto do que cabe numa aplicação em consulta única: o Linux corta um argumento de processo em
# MAX_ARG_STRLEN = 32 páginas = 131072 bytes, e o `psql --command=` do ensaio é um argumento
# só. A margem de 2 KiB cobre o `--command=` e o resto da linha de comando do contêiner.
ENSAIO_MAX_BYTES=$((131072 - 2048))
# Piso de linhas de um retrato do banco: hoje a base tem ~780. Retrato menor que isto é
# consulta que morreu no meio, não banco que encolheu.
ENSAIO_RETRATO_MIN=200

# Só db, auth (gotrue), rest (postgrest) e gateway (kong) sobem. Os nomes são os que o CLI
# 2.109 aceita — a lista do `supabase start --help` está velha (analytics, inbucket, storage e
# meta NÃO excluem nada; ele só avisa, e o subir.sh repassa o aviso).
ENSAIO_EXCLUIR="edge-runtime,imgproxy,logflare,mailpit,postgres-meta,realtime,storage-api,studio,supavisor,vector"

# project_id do config.toml nomeia contêineres e volume: supabase_db_<id>. Um ensaio por vez.
ENSAIO_PROJETO=$(sed -nE 's/^[[:space:]]*project_id[[:space:]]*=[[:space:]]*"([^"]+)".*/\1/p' \
  "$ENSAIO_REPO/supabase/config.toml" | head -1)
ENSAIO_DB="supabase_db_${ENSAIO_PROJETO}"

export PATH="/opt/homebrew/bin:$PATH"   # o /usr/local/bin/docker é o do Docker Desktop antigo
export DOCKER_HOST="unix://$HOME/.colima/default/docker.sock"
export DOCKER_CONFIG="$ENSAIO_DIR/docker-config"

# O CLI lê estas do ambiente e elas apontariam para produção sem aparecer em nenhuma linha de
# comando. Fora daqui.
for _v in SUPABASE_DB_URL SUPABASE_PROJECT_ID SUPABASE_PROJECT_REF SUPABASE_ACCESS_TOKEN SUPABASE_WORKDIR; do
  eval "[ -z \"\${$_v:-}\" ]" || printf 'ensaio: %s estava no ambiente e foi ignorada aqui\n' "$_v" >&2
  unset "$_v" 2>/dev/null || true
done
unset _v

diga()  { printf '%s\n' "$*"; }
falha() { printf 'ensaio: %s\n' "$*" >&2; exit 1; }

# "$1 contém $2?" — sem `grep -q` num cano, que sob `pipefail` responde errado quando o
# produtor leva SIGPIPE (a armadilha que o check-schema-drift.sh já documentou neste repo).
contem() { case "$1" in *"$2"*) return 0 ;; *) return 1 ;; esac; }

[ -n "$ENSAIO_PROJETO" ] || falha "sem project_id em supabase/config.toml"

# Os scripts não aceitam argumento nenhum além do que cada um declara.
sem_argumentos() {
  [ "$#" -eq 0 ] || falha "$(basename "$0") não recebe argumento (veio: $*)"
}

# ── a pasta do ensaio, e a trava ─────────────────────────────────────────────────
# A marca .orbe-ensaio diz "esta pasta é nossa": sem ela, uma pasta que já existia é do
# usuário, e o --apagar do descer.sh não pode encostar nela.
ensaio_dir() {
  local real pai
  case "$ENSAIO_DIR" in
    /*) ;;
    *)  falha "ENSAIO_DIR precisa ser caminho absoluto (veio '$ENSAIO_DIR') — o --workdir do CLI resolve a partir de outra pasta" ;;
  esac
  pai=$(cd "$(dirname "$ENSAIO_DIR")" 2>/dev/null && pwd -P) || pai=""
  case "$pai/" in
    "$ENSAIO_REPO/"*) falha "a pasta do ensaio ($ENSAIO_DIR) ficaria dentro do repositório — o git status mudaria" ;;
  esac
  if [ -e "$ENSAIO_DIR" ] && [ ! -f "$ENSAIO_DIR/.orbe-ensaio" ]; then
    [ -d "$ENSAIO_DIR" ] || falha "$ENSAIO_DIR existe e não é pasta"
    [ -z "$(ls -A "$ENSAIO_DIR" 2>/dev/null)" ] ||
      falha "$ENSAIO_DIR já existe, tem conteúdo e não é do ensaio (sem a marca .orbe-ensaio). Escolha outra com ENSAIO_DIR=…"
  fi
  mkdir -p "$ENSAIO_DIR" || falha "não consegui criar $ENSAIO_DIR"
  real=$(cd "$ENSAIO_DIR" && pwd -P)
  case "$real/" in
    "$ENSAIO_REPO/"*) falha "a pasta do ensaio ($real) está dentro do repositório — o git status mudaria" ;;
  esac
  : > "$ENSAIO_DIR/.orbe-ensaio"
  # Resto de uma versão anterior, que guardava a identidade de produção em disco. Ninguém lê
  # mais isso — e um arquivo desses na pasta sugere um cache que não existe.
  rm -f "$ENSAIO_DIR/prod-identidade.json"
  chmod 700 "$ENSAIO_DIR"   # ela guarda o catálogo inteiro de produção e o texto das edições
  mkdir -p "$DOCKER_CONFIG"
  [ -f "$DOCKER_CONFIG/config.json" ] || printf '{}\n' > "$DOCKER_CONFIG/config.json"
}
ensaio_dir

# A trava guarda quem a pegou: trava órfã de uma corrida morta tem de ser distinguível de
# corrida viva, senão a saída é sempre "apague na mão".
trava() {
  local dono pid quando viva tmp
  if ! mkdir "$ENSAIO_DIR/.lock" 2>/dev/null; then
    dono=$(cat "$ENSAIO_DIR/.lock/dono" 2>/dev/null || printf '')
    if [ -z "$dono" ]; then
      # Entre o mkdir e a escrita do dono existe um instante; dono ausente é corrida VIVA que
      # acabou de pegar a trava, não trava órfã.
      falha "outro ensaio acabou de pegar esta pasta ($ENSAIO_DIR) e ainda não se identificou — espere e tente de novo"
    fi
    pid=${dono%% *}
    quando=${dono#* }
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      viva="e o processo $pid AINDA está vivo — espere ele terminar"
    else
      viva="e o processo $pid não existe mais — trava órfã: rm -rf '$ENSAIO_DIR/.lock'"
    fi
    falha "outro ensaio pegou esta pasta ($ENSAIO_DIR) em $quando, $viva"
  fi
  # Escreve e move: o arquivo aparece inteiro ou não aparece.
  tmp="$ENSAIO_DIR/.lock/.dono.$$"
  printf '%s %s\n' "$$" "$(date '+%Y-%m-%dT%H:%M:%S%z')" > "$tmp"
  mv "$tmp" "$ENSAIO_DIR/.lock/dono"
  trap 'rm -rf "$ENSAIO_DIR/.lock" 2>/dev/null || true' EXIT
}
trava

# Nenhum script do ensaio pode falar com a Management API por fora da prod_ler — se falasse, o
# log não saberia, e o critério "toda chamada é leitura" não teria como ser conferido.
# A varredura é pelos NOMES, não pelo host escrito por extenso: a própria prod_ler monta a URL
# a partir da variável, então procurar o literal deixaria passar exatamente a forma que ela usa.
# E a lista de arquivos sai de quem dá `source` na lib.sh — um glob da pasta acusaria arquivo
# alheio e perderia script novo em subpasta.
guarda_de_leitura() {
  local scripts f fora quantas
  scripts=$(grep -rl 'ensaio/lib\.sh\|/lib\.sh"' "$ENSAIO_AQUI" --include='*.sh' 2>/dev/null | grep -v '/lib\.sh$' || true)
  [ -n "$scripts" ] ||
    falha "a guarda de leitura não achou script nenhum que carregue a lib.sh — ela ficaria sem alvo"
  for f in $scripts; do
    fora=$(grep -nE 'ENSAIO_API_HOST|ENSAIO_PROD_REF|(^|[^a-zA-Z_])curl( |$)' "$f" || true)
    [ -z "$fora" ] ||
      falha "$(basename "$f") fala com a rede por fora da prod_ler — o log não registraria a chamada:
$fora"
  done
  # `grep -c` conta LINHA; aqui o que importa é ocorrência.
  quantas=$(grep -oF "$ENSAIO_API_HOST" "$ENSAIO_AQUI/lib.sh" | wc -l | tr -d ' ')
  [ "$quantas" = "1" ] ||
    falha "o host da Management API aparece $quantas vezes na lib.sh (o esperado é 1, a atribuição) — a prod_ler pode ter deixado de ser a única porta"
}
guarda_de_leitura

# O log é vendido como a prova de que só houve leitura — então ele é RELIDO, linha a linha.
# Prova que ninguém relê é promessa.
log_conferir() {
  local fora linhas
  [ -s "$ENSAIO_LOG" ] || { diga "  (o log de consultas está vazio: nenhuma chamada a produção ainda)"; return 0; }
  linhas=$(wc -l < "$ENSAIO_LOG" | tr -d ' ')
  fora=$(jq -r 'select((.consulta | startswith("begin transaction read only; ")) | not) | .consulta' "$ENSAIO_LOG" 2>/dev/null) ||
    falha "o log de consultas tem linha que não é JSON do ensaio — alguém escreveu nele por fora ($ENSAIO_LOG)"
  [ -z "$fora" ] ||
    falha "o log tem chamada que não é leitura em transação read only:
$(printf '%s\n' "$fora" | head -5 | mascarar)"
  diga "  $linhas chamada(s) a produção no log, todas em transação read only"
}

# Pasta de trabalho do CLI: config.toml por link simbólico, a imagem de produção por cópia de
# .temp/postgres-version, e NADA do link (project-ref, linked-project.json, pooler-url).
# As migrations da base entram por link simbólico em preparar.sh, uma a uma.
workdir_montar() {
  local s="$ENSAIO_WD/supabase" ref
  [ -f "$ENSAIO_REPO/supabase/.temp/postgres-version" ] ||
    falha "não achei supabase/.temp/postgres-version — é dele que sai a imagem de produção. Ele aparece quando o CLI fala com o projeto (supabase link), e é a única coisa que o ensaio copia de lá"
  # O project-ref NÃO é copiado: é lido só para garantir que a imagem que estamos usando é a do
  # projeto que estamos lendo. Ensaiar com a imagem de um projeto e o catálogo de outro seria
  # fidelidade de mentira.
  if [ -f "$ENSAIO_REPO/supabase/.temp/project-ref" ]; then
    ref=$(cat "$ENSAIO_REPO/supabase/.temp/project-ref")
    [ "$ref" = "$ENSAIO_PROD_REF" ] ||
      falha "o repositório está linkado com o projeto '$ref' e o ensaio lê o '$ENSAIO_PROD_REF' — a imagem viria de um e o catálogo de outro"
  fi
  mkdir -p "$s/.temp" "$s/migrations"
  ln -sfn "$ENSAIO_REPO/supabase/config.toml" "$s/config.toml"
  cp "$ENSAIO_REPO/supabase/.temp/postgres-version" "$s/.temp/postgres-version"
  sem_link
}

sem_link() {
  local f
  for f in project-ref linked-project.json pooler-url; do
    [ ! -e "$ENSAIO_WD/supabase/.temp/$f" ] ||
      falha "a pasta de trabalho tem supabase/.temp/$f — ela estaria linkada com produção"
  done
}

# ── o Supabase CLI ───────────────────────────────────────────────────────────────
sb() {
  local a
  for a in "$@"; do
    case "$a" in
      push|link|unlink|--linked|--linked=*|--db-url|--db-url=*|--project-ref|--project-ref=*)
        falha "recusado: 'supabase $*' — o ensaio nunca fala com produção pelo CLI" ;;
    esac
  done
  sem_link
  ( cd "$ENSAIO_WD" && supabase --workdir "$ENSAIO_WD" "$@" )
}

# ── o repositório não pode mudar ─────────────────────────────────────────────────
# O `git status --porcelain` normal não veria o que o .gitignore esconde — e é exatamente
# `supabase/.branches/`, que esta entrega passou a ignorar, a sujeira que o CLI deixa quando
# roda da raiz. Por isso o retrato inclui os ignorados de dentro de supabase/.
git_retrato() {
  if ! git -C "$ENSAIO_REPO" rev-parse --git-dir >/dev/null 2>&1; then
    printf '(sem git)\n'
    return 0
  fi
  git -C "$ENSAIO_REPO" status --porcelain
  git -C "$ENSAIO_REPO" status --porcelain --ignored -- supabase/ | sed 's/^/ignorado /'
}

git_conferir() {   # $1 = retrato de antes
  local depois
  depois=$(git_retrato)
  if [ "$1" != "$depois" ]; then
    diga "  o repositório mudou durante a corrida:" >&2
    diff <(printf '%s\n' "$1") <(printf '%s\n' "$depois") | sed 's/^/    /' >&2
    return 1
  fi
  if [ -e "$ENSAIO_REPO/supabase/.branches" ]; then
    diga "  AVISO: supabase/.branches existe no repositório — alguém já rodou o CLI da raiz."
    diga "         Ele é ignorado pelo git, mas não nasceu desta corrida (o retrato acima prova)."
  fi
  diga "  git status idêntico ao do começo da corrida (inclusive o que o .gitignore esconde em supabase/)"
}

# ── Docker, portas e versão ──────────────────────────────────────────────────────
docker_ok() {
  [ -S "${DOCKER_HOST#unix://}" ] ||
    falha "o socket do colima não existe (${DOCKER_HOST#unix://}). Suba com: colima start"
  docker info >/dev/null 2>&1 || falha "o Docker do colima não responde. Suba com: colima start"
}

# O conserto que fecha o banco para a rede. Sem ele o CLI publica em 0.0.0.0 e o colima repassa
# para 0.0.0.0 do Mac — com a senha padrão `postgres`.
#
# A regra é conferida INTEIRA, numa entrada só, com as duas faixas: procurar as linhas soltas
# aprovaria duas regras diferentes, cada uma com metade do que importa.
override_ok() {
  [ -f "$ENSAIO_OVERRIDE" ] ||
    falha "sem $ENSAIO_OVERRIDE — o colima repassaria as portas do ensaio para a rede. Ver supabase/ensaio/README.md"
  perl -e '
    use strict; use warnings;
    local $/; my $y = <>;
    $y =~ s/^[ \t]*#.*$//mg;      # linha de comentário fora
    $y =~ s/[ \t]+#.*$//mg;       # comentário no fim da linha fora: ele não vale como regra
    my @regras = split /^\s*-\s+/m, $y;
    for my $r (@regras) {
      next unless $r =~ /guestIPMustBeZero:\s*"?true"?/;
      next unless $r =~ /guestIP:\s*"?0\.0\.0\.0"?/;
      next unless $r =~ /hostIP:\s*"?127\.0\.0\.1"?/;
      my ($gde, $gate) = $r =~ /guestPortRange:\s*\[\s*(\d+)\s*,\s*(\d+)\s*\]/;
      my ($hde, $hate) = $r =~ /hostPortRange:\s*\[\s*(\d+)\s*,\s*(\d+)\s*\]/;
      next unless defined $gde && $gde <= 54321 && $gate >= 54399;
      # hostPortRange ausente vale como "igual ao guest"; presente, precisa cobrir também.
      next if defined $hde && !($hde <= 54321 && $hate >= 54399);
      exit 0;
    }
    exit 1;
  ' "$ENSAIO_OVERRIDE" ||
    falha "$ENSAIO_OVERRIDE não tem UMA regra que mande 0.0.0.0 da VM para 127.0.0.1 do Mac cobrindo as portas do ensaio (guestIPMustBeZero, guestIP, hostIP e as faixas na MESMA entrada). Ver supabase/ensaio/README.md"
}

# Toda porta que os contêineres do ensaio publicam precisa ter quem escute no Mac, e só em
# loopback.
#   0 = tudo em 127.0.0.1
#   1 = EXPOSIÇÃO: alguém escuta fora do loopback
#   2 = não deu para medir (ninguém escuta ainda, ou não há porta publicada)
# Os dois erros são diferentes de propósito: repasse lento do colima não é motivo para derrubar
# a pilha, e exposição é.
portas_conferir() {
  local portas p l linhas n expostas="" mudas=""
  portas=$(docker ps --filter "label=com.supabase.cli.project=$ENSAIO_PROJETO" --format '{{.Ports}}' |
    tr ',' '\n' | sed -nE 's/.*:([0-9]+)->.*/\1/p' | LC_ALL=C sort -u)
  if [ -z "$portas" ]; then
    diga "  nenhuma porta publicada pelos contêineres do ensaio — a guarda ficou sem alvo" >&2
    return 2
  fi
  for p in $portas; do
    n=0
    while :; do   # o repasse do colima leva alguns segundos para aparecer
      linhas=$(lsof -nP -iTCP:"$p" -sTCP:LISTEN -Fn 2>/dev/null | sed -n 's/^n//p' | LC_ALL=C sort -u || true)
      [ -n "$linhas" ] && break
      n=$((n + 1)); [ "$n" -ge 20 ] && break
      sleep 1
    done
    if [ -z "$linhas" ]; then
      mudas="$mudas $p"
      continue
    fi
    while IFS= read -r l; do
      case "$l" in
        "127.0.0.1:$p"|"[::1]:$p") ;;
        *) expostas="$expostas $p($l)" ;;
      esac
    done <<< "$linhas"
  done
  if [ -n "$expostas" ]; then
    diga "  EXPOSIÇÃO — porta escutando fora de 127.0.0.1:$expostas" >&2
    return 1
  fi
  if [ -n "$mudas" ]; then
    diga "  não deu para medir: ninguém escuta em 20 s nas portas$mudas (repasse do colima atrasado?)" >&2
    return 2
  fi
  diga "  portas só em 127.0.0.1: $(echo $portas)"
}

guarda_de_portas() {
  local rc=0
  portas_conferir || rc=$?
  case "$rc" in
    0) return 0 ;;
    1) diga "== derrubando a pilha (o banco estava alcançável de fora)" >&2
       sb stop >/dev/null 2>&1 || true
       falha "porta do ensaio fora de 127.0.0.1 — pilha derrubada. Ver supabase/ensaio/README.md" ;;
    *) falha "a guarda de portas não conseguiu medir — a pilha ficou de pé, de propósito. Confira com: lsof -nP -iTCP -sTCP:LISTEN | grep 543" ;;
  esac
}

pilha_de_pe() {
  [ "$(docker inspect -f '{{.State.Running}}' "$ENSAIO_DB" 2>/dev/null || true)" = "true" ] ||
    falha "a pilha do ensaio não está de pé ($ENSAIO_DB) — rode supabase/ensaio/subir.sh"
}

# ── produção: a identidade, lida NESTA corrida ───────────────────────────────────
# Sem cache em disco: cache com validade de "uma vez por pasta" foi o que transformou
# "conferido contra produção" em "conferido contra um arquivo que eu mesmo escrevi".
prod_identidade() {
  prod_ler "select current_setting('server_version') as versao, current_user as papel"
}

versao_conferir() {
  local esperado img v papel prod_v prod_papel id antes_log depois_log
  esperado=$(cat "$ENSAIO_WD/supabase/.temp/postgres-version")
  img=$(docker inspect -f '{{.Config.Image}}' "$ENSAIO_DB")
  case "$img" in
    *":$esperado") ;;
    *) falha "o banco local roda $img; o .temp/postgres-version de produção diz $esperado" ;;
  esac
  antes_log=$(wc -l < "$ENSAIO_LOG" 2>/dev/null || printf '0')
  id=$(prod_identidade)
  depois_log=$(wc -l < "$ENSAIO_LOG" 2>/dev/null || printf '0')
  prod_v=$(jq -r '.[0].versao' <<< "$id")
  prod_papel=$(jq -r '.[0].papel' <<< "$id")
  [ -n "$prod_v" ] && [ "$prod_v" != "null" ] ||
    falha "produção não disse a versão do servidor — a fidelidade não pode ser afirmada"
  # A leitura tem de ter acontecido NESTA corrida: se o log não cresceu, a comparação seria
  # contra memória de outra corrida.
  [ "$depois_log" -gt "$antes_log" ] ||
    falha "a identidade de produção não foi lida nesta corrida — a conferência de versão e papel seria contra cache"
  v=$(local_psql -c 'show server_version')
  [ "$v" = "$prod_v" ] ||
    falha "o Postgres local é $v e produção é $prod_v — a candidata não estaria sendo ensaiada na mesma versão"
  papel=$(local_psql -c 'select current_user')
  [ "$papel" = "$prod_papel" ] ||
    falha "aqui a migração rodaria como '$papel' e em produção roda como '$prod_papel' — dono e privilégio do que ela criar sairiam diferentes"
  diga "  Postgres $v · imagem $esperado · papel $papel — os três iguais aos de produção (lido agora)"
}

# As versões que produção registrou, em uma linha só: "<n> <md5 da lista>". Serve ao preparar.sh
# (para montar a base) e ao ensaiar.sh (para saber se a base ainda é a de produção).
prod_versoes() {
  prod_ler "select version from supabase_migrations.schema_migrations order by version" | jq -r '.[].version'
}

# ── o banco local ────────────────────────────────────────────────────────────────
local_psql() {
  docker exec -i "$ENSAIO_DB" psql -U postgres -d postgres -X -q -tA -v ON_ERROR_STOP=1 "$@"
}

# As chaves padrão do desenvolvimento local do Supabase — públicas, iguais em toda máquina —
# lidas do próprio CLI em vez de copiadas para cá. O JSON é lido com jq: `sed` em saída de
# ferramenta dá a mensagem errada no dia em que a formatação mudar.
chaves_locais() {
  local st rc=0
  st=$(sb status -o json 2>/dev/null) || rc=$?
  [ "$rc" = 0 ] ||
    falha "supabase status saiu $rc — a pilha está de pé? (supabase/ensaio/subir.sh)"
  jq -e 'type == "object"' <<< "$st" >/dev/null 2>&1 ||
    falha "supabase status não devolveu JSON de objeto — o formato do CLI mudou. Primeira linha: $(printf '%s' "$st" | head -1)"
  ENSAIO_API=$(jq -r '.API_URL // empty' <<< "$st")
  ENSAIO_ANON=$(jq -r '.ANON_KEY // empty' <<< "$st")
  ENSAIO_SR=$(jq -r '.SERVICE_ROLE_KEY // empty' <<< "$st")
  [ -n "$ENSAIO_API" ] && [ -n "$ENSAIO_ANON" ] && [ -n "$ENSAIO_SR" ] ||
    falha "supabase status veio sem API_URL/ANON_KEY/SERVICE_ROLE_KEY — o formato do CLI mudou"
  case "$ENSAIO_API" in
    http://127.0.0.1:*) ;;
    *) falha "a API local não está em 127.0.0.1 ($ENSAIO_API)" ;;
  esac
}

# Espera um endpoint local responder 200 (até ~60 s). Serve depois do db reset, que reinicia
# auth e rest.
esperar_200() {
  local url=$1 n=0
  while [ "$(curl -s -o /dev/null -w '%{http_code}' -H "apikey: $ENSAIO_ANON" "$url" || true)" != "200" ]; do
    n=$((n + 1)); [ "$n" -ge 60 ] && falha "$url não respondeu 200 em 60 s"
    sleep 1
  done
}

# O PostgREST guarda em cache o que enxerga. Depois de mexer em privilégio ou criar tabela, ele
# precisa do aviso — e o aviso só vale depois de ele estar de pé.
pgrst_recarregar() {
  local_psql -c "notify pgrst, 'reload schema'" > /dev/null || true
  sleep 1
}

# Máscara para o que vai à tela vindo do banco ou de produção. O Postgres decora erro com o dado
# que o causou — a linha inteira, a chave, o valor recusado, o CONTEXT/QUERY do plpgsql —, e
# aqui o dado é texto de edição.
mascarar() {
  sed -E \
    -e 's/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/<uuid>/g' \
    -e 's/(Failing row contains).*/\1 (omitido pelo ensaio)/' \
    -e 's/(Key \([^)]*\))=\(.*/\1=(omitido pelo ensaio)/' \
    -e 's/^([[:space:]]*(DETAIL|CONTEXT|QUERY|HINT|LINE [0-9]+):).*/\1 (omitido pelo ensaio)/' \
    -e 's/(invalid input syntax[^:]*):.*/\1: (omitido pelo ensaio)/' \
    -e 's/(value too long[^:]*):.*/\1: (omitido pelo ensaio)/' \
    -e 's/^(.{250}).*$/\1 …(cortado pelo ensaio)/'
}

# Um rótulo de dollar quote que não apareça no texto dado — senão o literal fecha no meio.
# Sem `grep -q` num cano: sob `pipefail`, o SIGPIPE do produtor faria a busca "não achar".
rotulo_livre() {
  local tag=${2:-ensaio}
  while :; do
    case "$1" in
      *"\$$tag\$"*) tag="${tag}x" ;;
      *) break ;;
    esac
  done
  printf '%s' "$tag"
}

# ── retrato ──────────────────────────────────────────────────────────────────────
# Catálogo e ACLs (paridade.sql), contagem e hash do conteúdo de cada tabela do public, e um
# hash por edição. Sem texto e sem UUID — só o que permite dizer "idêntico" ou "mudou".
# Tolerante a edicoes_ia não existir mais (a candidata pode tirá-la).
#
# O status das duas consultas é conferido: se o psql morre no meio, o retrato sai curto, e
# retrato curto comparado com retrato curto diria "nada mudou" para qualquer coisa.
retrato() {
  local catalogo dados saida linhas piso base_linhas
  catalogo=$(local_psql < "$ENSAIO_AQUI/paridade.sql") ||
    falha "retrato: a consulta de catálogo (paridade.sql) falhou no banco local"
  # Matview entra na contagem junto com as tabelas: ela guarda linha, e o ponta a ponta precisa
  # saber quantas para não chamar de "vazio" o que o dono só não consegue ler.
  dados=$(local_psql <<'SQL'
select format('select %L || '' '' || count(*) from %I.%I', 'linhas ' || c.relname, n.nspname, c.relname)
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p', 'm')
order by c.relname \gexec
select format(
  'select %L || '' '' || coalesce(md5(string_agg(h, '','' order by h)), ''(vazia)'') from (select md5(t::text) as h from %I.%I t) s',
  'dados ' || c.relname, n.nspname, c.relname)
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p', 'm')
order by c.relname \gexec
select to_regclass('public.edicoes_ia') is not null as tem_edicoes \gset
\if :tem_edicoes
-- coalesce em tudo: coluna nula somiria da linha inteira, e a edição desapareceria do retrato
-- sem nenhuma marca — que é o jeito mais silencioso de "nada mudou" mentir.
select 'edicao ' || coalesce(e.tipo_periodo, '(nulo)') || ' ' || coalesce(e.inicio::text, '(nulo)')
    || ' ' || coalesce(e.fim::text, '(nulo)') || ' ' || md5(to_jsonb(e)::text)
from public.edicoes_ia e;
\endif
SQL
  ) || falha "retrato: a consulta de dados falhou no banco local"
  saida=$({ printf '%s\n' "$catalogo"; printf '%s\n' "$dados"; } | grep -v '^$' | LC_ALL=C sort)
  linhas=$(printf '%s\n' "$saida" | wc -l | tr -d ' ')
  # O piso sai do retrato da base que está ali do lado, não de um número inventado: metade dele,
  # porque migração que apaga objeto encolhe o retrato de verdade, e consulta que morre no meio
  # o corta pela raiz.
  piso=$ENSAIO_RETRATO_MIN
  if [ -f "$ENSAIO_BASE" ]; then
    base_linhas=$(( $(wc -l < "$ENSAIO_BASE" | tr -d ' ') - 1 ))
    if [ "$base_linhas" -gt 0 ]; then
      piso=$(( base_linhas / 2 ))
    fi
  fi
  [ "$linhas" -ge "$piso" ] ||
    falha "retrato: saíram $linhas linhas e o piso é $piso — consulta que morreu no meio, não banco que encolheu"
  printf '%s\n' "$saida"
}

# Quantas linhas o retrato viu num objeto ("?" quando ele não conta esse tipo — view simples,
# por exemplo). Busca por texto fixo: nome de objeto pode ter caractere que o regex leria.
linhas_no_retrato() {   # $1 = arquivo de retrato, $2 = nome do objeto
  local n
  n=$({ grep -F "linhas $2 " "$1" || true; } | head -1 | awk '{print $NF}')
  printf '%s' "${n:-?}"
}

# Retrato com cabeçalho: o arquivo guarda O QUE foi ensaiado, não só quando.
retrato_arquivo() {   # $1 = arquivo, $2 = texto do cabeçalho
  local corpo
  corpo=$(retrato)
  { printf '# %s\n' "$2"; printf '%s\n' "$corpo"; } > "$1"
}

retrato_corpo() { tail -n +2 "$1"; }   # o retrato sem o cabeçalho

# ── o caminho do app: login, REST e RLS ──────────────────────────────────────────
# Mora aqui porque não é só do preparar.sh: depois de aplicar uma candidata que cria tabela, é
# esta a única medição que enxerga tabela nova exposta à API sem RLS.
# O usuário local do ensaio, criado ou reaproveitado (com a senha redefinida: se ele
# sobreviveu a um ensaio anterior com outra senha, o login falharia e o único conserto seria
# apagar o volume). Mora aqui, e não no preparar.sh, porque TODA chamada de rede do ensaio fica
# na lib.sh — é o que deixa a guarda de leitura poder dizer "nenhum curl fora daqui".
usuario_do_ensaio() {
  local uid uuid_re
  uid=$(curl -sf "$ENSAIO_API/auth/v1/admin/users?per_page=1000" \
          -H "apikey: $ENSAIO_SR" -H "Authorization: Bearer $ENSAIO_SR" |
        jq -r --arg e "$ENSAIO_EMAIL" 'first(.users[] | select(.email == $e) | .id) // empty') || uid=""
  if [ -n "$uid" ]; then
    curl -sf -X PUT "$ENSAIO_API/auth/v1/admin/users/$uid" \
      -H "apikey: $ENSAIO_SR" -H "Authorization: Bearer $ENSAIO_SR" -H "Content-Type: application/json" \
      --data-binary "$(jq -cn --arg s "$ENSAIO_SENHA" '{password: $s, email_confirm: true}')" > /dev/null ||
      falha "não consegui redefinir a senha de $ENSAIO_EMAIL no auth local"
  else
    uid=$(curl -sf -X POST "$ENSAIO_API/auth/v1/admin/users" \
            -H "apikey: $ENSAIO_SR" -H "Authorization: Bearer $ENSAIO_SR" -H "Content-Type: application/json" \
            --data-binary "$(jq -cn --arg e "$ENSAIO_EMAIL" --arg s "$ENSAIO_SENHA" \
                '{email: $e, password: $s, email_confirm: true}')" |
          jq -r '.id // empty') || uid=""
  fi
  uuid_re='^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  [[ $uid =~ $uuid_re ]] || falha "não consegui criar o usuário $ENSAIO_EMAIL no auth local"
  printf '%s' "$uid"
}

jwt_do_dono() {
  local jwt
  jwt=$(curl -sf -X POST "$ENSAIO_API/auth/v1/token?grant_type=password" \
          -H "apikey: $ENSAIO_ANON" -H "Content-Type: application/json" \
          --data-binary "$(jq -cn --arg e "$ENSAIO_EMAIL" --arg s "$ENSAIO_SENHA" '{email: $e, password: $s}')" |
        jq -r '.access_token // empty') || jwt=""
  [ -n "$jwt" ] || falha "o login de $ENSAIO_EMAIL no auth local falhou"
  printf '%s' "$jwt"
}

# `jq length` contaria no máximo as 1000 linhas que o PostgREST devolve por padrão, sem erro
# nenhum — a contagem vem do Content-Range, com count=exact.
# Devolve "<n>", ou "erro(<o quê>)". Falta de Content-Range é FALHA DE MEDIÇÃO, não zero: a
# versão anterior devolvia vazio e a mensagem saía "o anônimo LÊ  linha(s)", sem número.
contar_rest() {   # $1 = objeto, $2 = Bearer
  local cab n obj
  obj=$(printf '%s' "$1" | sed 's/ /%20/g')   # nome com espaço existe, e a URL não o aceita cru
  cab=$(curl -sS -D - -o /dev/null "$ENSAIO_API/rest/v1/$obj?select=*&limit=1" \
          -H "apikey: $ENSAIO_ANON" -H "Authorization: Bearer $2" \
          -H 'Prefer: count=exact' -H 'Range-Unit: items' 2>/dev/null) || { printf 'erro(curl)'; return 0; }
  case "$(printf '%s' "$cab" | head -1)" in
    *" 20"*) ;;
    *) printf 'erro(%s)' "$(printf '%s' "$cab" | head -1 | tr -d '\r' | cut -c1-40)"; return 0 ;;
  esac
  n=$(printf '%s' "$cab" | tr -d '\r' | sed -nE 's|^[Cc]ontent-[Rr]ange:[[:space:]]*[^/]*/([0-9]+).*|\1|p' | head -1)
  [ -n "$n" ] || { printf 'erro(sem-content-range)'; return 0; }
  printf '%s' "$n"
}

# Espera o PostgREST enxergar um objeto recém-criado (ele recarrega o cache em segundo plano).
esperar_rest() {   # $1 = objeto, $2 = Bearer
  local n=0 r
  while :; do
    r=$(contar_rest "$1" "$2")
    case "$r" in
      erro*404*) ;;   # o cache do PostgREST ainda não viu o objeto
      *) printf '%s' "$r"; return 0 ;;
    esac
    n=$((n + 1)); [ "$n" -ge 15 ] && { printf '%s' "$r"; return 0; }
    sleep 1
  done
}

# Ponta a ponta num objeto: o dono lê TUDO o que está lá, o anônimo lê ZERO.
#
# O "quantas linhas estão lá" vem do retrato da própria corrida, não da API: sem isso, tabela
# que o dono NÃO consegue ler (RLS ligada, nenhuma policy — que é exatamente o estado que
# produção produz sozinha para tabela nova) passava como "tabela vazia", e o ensaio saía 0.
#
# Anônimo lendo linha REPROVA, mesmo sabendo que em produção o gatilho ensure_rls ligaria a RLS:
# decisão do dono na rodada 3 — o ensaio não aprova o que depende de rede alheia para ser seguro.
ponta_a_ponta() {   # $1 = objeto, $2 = jwt do dono, $3 = quantas linhas o retrato viu (ou "?")
  local dono anonimo esperado=${3:-?}
  dono=$(esperar_rest "$1" "$2")
  anonimo=$(contar_rest "$1" "$ENSAIO_ANON")
  diga "  $1 — dono: $dono · anônimo: $anonimo · no banco: $esperado"
  case "$dono" in
    erro*) diga "    o dono não consegue ler $1 pela REST ($dono)" >&2; return 1 ;;
  esac
  case "$anonimo" in
    0) ;;
    erro*) diga "    a leitura anônima de $1 nem chegou a acontecer ($anonimo) — falha de MEDIÇÃO, não veredito de RLS" >&2; return 1 ;;
    *) diga "    o anônimo LÊ $anonimo linha(s) de $1 — sem RLS ou com policy aberta" >&2; return 1 ;;
  esac
  case "$esperado" in
    '?') diga "    (o retrato não conta linhas deste objeto — o zero do anônimo prova menos aqui)" ;;
    *) if [ "$dono" != "$esperado" ]; then
         diga "    o banco tem $esperado linha(s) em $1 e o dono lê $dono — RLS ligada sem policy que o alcance?" >&2
         return 1
       fi
       if [ "$esperado" = "0" ]; then
         diga "    (o objeto está vazio: o zero do anônimo aqui prova que a leitura chegou, não que a RLS esconde)"
       fi ;;
  esac
  return 0
}

# ── produção: só leitura ─────────────────────────────────────────────────────────
# prod_ler "<select …>"  → JSON (array de linhas) na saída padrão.
# Recusa ANTES da rede a consulta que tem ';' ou não começa por select/with. Linhas que são só
# comentário (--) saem antes da checagem. O resto vai inteiro, embrulhado numa transação read
# only: um `with … delete` passa pela primeira guarda e morre na segunda.
prod_ler() {
  local corpo lc re token resposta codigo
  corpo=$(printf '%s\n' "$1" | sed -E '/^[[:space:]]*--/d')
  corpo="${corpo#"${corpo%%[![:space:]]*}"}"
  corpo="${corpo%"${corpo##*[![:space:]]}"}"
  case "$corpo" in
    *';'*) falha "consulta de produção recusada antes da rede: tem ';'" ;;
  esac
  lc=$(printf '%s' "$corpo" | tr '[:upper:]' '[:lower:]')
  re='^(select|with)[[:space:]]'
  [[ $lc =~ $re ]] || falha "consulta de produção recusada antes da rede: não começa por select/with"
  corpo="begin transaction read only; $corpo; commit;"

  token=$(security find-generic-password -s "$ENSAIO_KEYCHAIN" -w 2>/dev/null) || token=""
  [ -n "$token" ] ||
    falha "produção inalcançável: token do Supabase CLI ausente no keychain (serviço '$ENSAIO_KEYCHAIN'). Rode: supabase login"

  jq -cn --arg em "$(date '+%Y-%m-%dT%H:%M:%S%z')" --arg origem "$(basename "$0")" --arg consulta "$corpo" \
    '{em: $em, origem: $origem, consulta: $consulta}' >> "$ENSAIO_LOG" ||
    falha "não consegui registrar a consulta em $ENSAIO_LOG — nada foi enviado"

  # O token vai por um descritor (-H @…), não pela linha de comando: não aparece no `ps`.
  resposta=$(jq -n --arg q "$corpo" '{query: $q}' |
    curl -sS --max-time 90 -w '\n%{http_code}' -X POST \
      "https://$ENSAIO_API_HOST/v1/projects/$ENSAIO_PROD_REF/database/query" \
      -H @<(printf 'Authorization: Bearer %s\n' "$token") \
      -H 'Content-Type: application/json' --data-binary @-) ||
    falha "produção inalcançável: a Management API não respondeu (rede fora, ou a API da Supabase caiu)"
  codigo=${resposta##*$'\n'}
  resposta=${resposta%$'\n'*}
  case "$codigo" in
    2??) ;;
    # A mensagem de erro devolve pedaço do que o Postgres viu — passa pela máscara.
    *) falha "produção recusou a leitura (HTTP $codigo): $(jq -r '.message // .' <<< "$resposta" 2>/dev/null | head -c 400 | mascarar || true)" ;;
  esac
  jq -e 'type == "array"' <<< "$resposta" >/dev/null 2>&1 ||
    falha "resposta inesperada da Management API (não é uma lista de linhas)"
  printf '%s\n' "$resposta"
}
