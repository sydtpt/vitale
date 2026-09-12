#!/usr/bin/env bash
# Ensaia uma migração candidata no banco local, do jeito que produção a recebe.
#
#   supabase/ensaio/ensaiar.sh [--falhar-no-fim] <candidata.sql>
#
# A Management API executa o arquivo como UMA consulta simples, e o Postgres roda consulta
# simples com várias instruções como UMA transação implícita. `psql --command="<arquivo
# inteiro>"` tem a mesma semântica; `-f` não tem, porque manda instrução por instrução.
#
# O roteiro:
#   1. a base ainda é a de produção? — o retrato carimbado tem de existir, bater com o banco, e
#      as versões que produção registrou têm de ser as mesmas do carimbo (lidas agora)
#   2. varredura — o que não roda dentro de transação, o que a candidata cria, e o que ela cria
#      sem RLS ou sem policy. Candidata sem instrução nenhuma é recusada
#   3. retrato antes — catálogo, ACLs, contagem e hash de conteúdo por tabela, hash por edição
#   4. aplicação numa consulta só
#   5. retrato depois, o diff dos dois, e o caminho do app reexercitado: o dono lê TUDO o que o
#      retrato viu no banco, o anônimo lê zero — inclusive nos objetos que a candidata criou
#
# `--falhar-no-fim` acrescenta um erro no fim do arquivo: é a prova do rollback limpo (R-25 do
# test design). Só passa quando a candidata inteira rodou, a aplicação falhou e o retrato ficou
# idêntico.
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

falhar=0
arquivo=""
while [ $# -gt 0 ]; do
  case "$1" in
    --falhar-no-fim) falhar=1 ;;
    -*)              falha "uso: ensaiar.sh [--falhar-no-fim] <candidata.sql>" ;;
    *)               [ -z "$arquivo" ] || falha "uso: ensaiar.sh [--falhar-no-fim] <candidata.sql>"
                     arquivo=$1 ;;
  esac
  shift
done
[ -n "$arquivo" ] || falha "uso: ensaiar.sh [--falhar-no-fim] <candidata.sql>"
[ -f "$arquivo" ] || falha "não achei a candidata: $arquivo"

git_antes=$(git_retrato)
problemas=0
problema() { printf 'ensaio: FALHOU — %s\n' "$*" >&2; problemas=$((problemas + 1)); }

docker_ok
workdir_montar
pilha_de_pe
chaves_locais
diga "== guarda de portas"
guarda_de_portas
diga "== o banco local é o de produção?"
versao_conferir

# ── a base ainda é a de produção? ────────────────────────────────────────────────
diga "== a base"
[ -f "$ENSAIO_BASE" ] ||
  falha "não há retrato da base em $ENSAIO_BASE — rode supabase/ensaio/preparar.sh. Sem ele, o ensaio não está comparando com produção"
carimbo=$(head -1 "$ENSAIO_BASE")
case "$carimbo" in
  "# base fiel a produção · "*) ;;
  *) falha "o retrato da base não tem carimbo de aprovação — apague-o e rode preparar.sh de novo" ;;
esac
campo() { printf '%s' "$carimbo" | sed -nE "s/.*[· ]$1=([^ ·]*).*/\1/p"; }
base_em=$(campo em)
base_versoes=$(campo versoes)
base_hash=$(campo versoes_hash)
base_pendentes=$(campo pendentes)
diga "  carimbo: $(printf '%s' "$carimbo" | sed 's/^# //')"

# O carimbo por si só não vale nada: ele é impresso pelo preparar.sh e nunca mais conferido.
# Aqui produção é lida DE NOVO, e a base é declarada velha quando ela andou.
versoes_agora=$(prod_versoes)
n_agora=$(printf '%s\n' "$versoes_agora" | wc -l | tr -d ' ')
hash_agora=$(printf '%s\n' "$versoes_agora" | shasum -a 256 | cut -c1-12)
if [ "$n_agora" != "$base_versoes" ] || [ "$hash_agora" != "$base_hash" ]; then
  falha "produção registrou outra coisa desde a base: carimbo diz $base_versoes versões ($base_hash) e agora são $n_agora ($hash_agora). Rode preparar.sh — a candidata encontraria um banco diferente deste"
fi
diga "  produção continua com $n_agora versões registradas (conferido agora, não pelo carimbo)"

# Data ilegível reprova: a versão anterior caía para "agora", e aí a idade dava 0 e o aviso
# sumia para sempre.
base_epoch=$(date -j -f '%Y-%m-%dT%H:%M:%S%z' "$base_em" '+%s' 2>/dev/null) || base_epoch=""
[ -n "$base_epoch" ] ||
  falha "o carimbo da base tem data ilegível ('$base_em') — sem ela não dá para dizer se a base é de agora ou de anteontem. Rode preparar.sh"
idade=$(( $(date '+%s') - base_epoch ))
if [ "$idade" -gt 7200 ]; then
  diga "  AVISO: o carimbo da base tem $((idade / 3600)) h. O catálogo de produção pode ter mudado sem passar por migration (é o que as divergências conhecidas contam) — considere rodar preparar.sh de novo."
fi
if [ "$base_pendentes" != "(nenhuma)" ]; then
  diga "  AVISO: o repositório tem migration pendente que produção ainda não aplicou ($base_pendentes)."
  diga "         Se ela for aplicada antes da candidata, a base que a candidata vai encontrar lá"
  diga "         não é esta. Ensaie as duas na ordem em que produção vai recebê-las."
fi

# ── varredura ────────────────────────────────────────────────────────────────────
varrer() {
  perl - "$1" <<'PERL'
use strict;
use warnings;
local $/;
my $s = <>;

# SQL dinâmico: o corpo entre $$…$$ é retirado antes da análise, então tabela criada dentro de
# um DO ou por execute format() é invisível. O ensaio não tenta interpretar — ele avisa.
my $dinamico = 0;
while ($s =~ /\$([A-Za-z_][A-Za-z_0-9]*|)\$(.*?)\$\1\$/gs) {
  my $corpo = $2;
  $dinamico = 1 if $corpo =~ /\b(create|execute|alter)\b/i;
}

# Identificador entre aspas é devolvido inteiro (o $7): é nome de objeto, e sem ele o aviso de
# RLS ficaria cego para `create table "Minha Tabela"`.
$s =~ s{
    (/\*.*?\*/)                                   # comentário de bloco
  | (--[^\n]*)                                    # comentário de linha
  | (\$([A-Za-z_][A-Za-z_0-9]*|)\$.*?\$\4\$)      # corpo entre $tag$ … $tag$
  | ((?<![A-Za-z0-9_])[eE]'(?:[^'\\]|\\.|'')*')   # literal E'…'
  | ('(?:[^']|'')*')                              # literal '…'
  | ("(?:[^"]|"")*")                              # identificador "…"
}{ (defined $1 or defined $2) ? ' ' : (defined $7 ? $7 : "''") }gsxe;

# Identificador do Postgres: entre aspas (podendo ter espaço, maiúscula e "" escapado) ou
# simples. E o nome qualificado, com schema opcional. Sem isto, `"Minha Tabela"` virava dois
# nomes e dois 404 — que a medição relatava como "não deu para ler".
my $ID = qr/(?:"(?:[^"]|"")*"|[A-Za-z0-9_]+)/;
my $QNAME = qr/(?:$ID\.)?$ID/;

my @achados;
my (%criadas, %com_rls, %com_policy);
my $n = 0;
for my $bruto (split /;/, $s) {
  my $t = $bruto;
  $t =~ s/\s+/ /g; $t =~ s/^ //; $t =~ s/ $//;
  next if $t eq '';
  $n++;
  my $l = lc $t;
  my $motivo;
  if ($l =~ /\bconcurrently\b/) {
    # Inclusive REFRESH MATERIALIZED VIEW CONCURRENTLY, e isso é de propósito: o Postgres chama
    # PreventInTransactionBlock("REFRESH MATERIALIZED VIEW CONCURRENTLY") em matview.c. Já
    # apareceu revisão afirmando o contrário — a citação fica aqui para não ser "consertado".
    $motivo = 'CONCURRENTLY não roda dentro de transação';
  } elsif ($l =~ /^vacuum\b/) {
    $motivo = 'VACUUM não roda dentro de transação';
  } elsif ($l =~ /^(begin|start transaction|commit|end|rollback|abort|savepoint|release|prepare transaction)\b/) {
    $motivo = 'controle de transação explícito: parte o arquivo em mais de uma transação';
  } elsif ($l =~ /^alter type\b.*\badd value\b/) {
    $motivo = 'ALTER TYPE … ADD VALUE: o rótulo novo não pode ser usado na mesma transação';
  } elsif ($l =~ /^(create|drop|alter) subscription\b/) {
    $motivo = 'comando de subscription não roda dentro de transação';
  } elsif ($l =~ /^discard\b/) {
    $motivo = 'DISCARD não roda dentro de transação';
  } elsif ($l =~ /^reindex\b.*\b(system|database|schema)\b/) {
    $motivo = 'REINDEX de schema/base/sistema não roda dentro de transação';
  } elsif ($l =~ /^cluster\s*$/ || $l =~ /^cluster verbose\s*$/) {
    $motivo = 'CLUSTER sem tabela não roda dentro de transação';
  } elsif ($l =~ /^(create|drop) database\b/ || $l =~ /^alter system\b/
        || $l =~ /^(create|drop) tablespace\b/) {
    $motivo = 'comando que o Postgres recusa dentro de transação';
  }
  push @achados, sprintf('achado instrução %d: %s — %s', $n, $motivo,
    length($t) > 110 ? substr($t, 0, 110) . '…' : $t) if $motivo;

  # Os nomes saem do texto ORIGINAL, não do minúsculo: `create table "Minha Tabela"` tem de
  # chegar do outro lado com a caixa que tinha, ou a REST devolve 404.
  if ($t =~ /^create\s+(?:unlogged\s+)?table\s+(?:if\s+not\s+exists\s+)?($QNAME)/i) {
    $criadas{$1} = 'tabela';
  }
  if ($t =~ /^select\b.*?\binto\s+(?!temp\b|temporary\b|unlogged\b)($QNAME)/is) {
    $criadas{$1} = 'tabela';
  }
  if ($t =~ /^create\s+materialized\s+view\s+(?:if\s+not\s+exists\s+)?($QNAME)/i) {
    $criadas{$1} = 'matview';
  } elsif ($t =~ /^create\s+(?:or\s+replace\s+)?(?:recursive\s+)?view\s+($QNAME)/i) {
    $criadas{$1} = 'view';
  }
  if ($t =~ /^alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?($QNAME)\s+enable\s+row\s+level\s+security/i) {
    $com_rls{$1} = 1;
  }
  if ($t =~ /^create\s+policy\s+$ID\s+on\s+(?:table\s+)?($QNAME)/i) {
    $com_policy{$1} = 1;
  }
}
print "instrucoes $n\n";
print "dinamico 1\n" if $dinamico;
print "$_\n" for @achados;
sub variantes { my $x = shift; (my $c = $x) =~ s/^public\.//; return ($x, $c, "public.$c"); }
for my $t (sort keys %criadas) {
  my $tipo = $criadas{$t};
  (my $curto = $t) =~ s/^public\.//;
  # Só objetos do public: schema alheio não é assunto da 1.9 nem da API.
  next if $t =~ /\./ && $t !~ /^public\./i;
  print "criada $tipo $curto\n";
  next unless $tipo eq 'tabela';
  my $tem_rls = 0; my $tem_policy = 0;
  for my $v (variantes($t)) { $tem_rls ||= $com_rls{$v} || 0; $tem_policy ||= $com_policy{$v} || 0; }
  print "sem-rls $curto\n"    unless $tem_rls;
  print "sem-policy $curto\n" unless $tem_policy;
}
PERL
}

diga "== varredura de $arquivo"
varredura=$(varrer "$arquivo") || falha "a varredura falhou (perl)"
instrucoes=$(printf '%s\n' "$varredura" | sed -n 's/^instrucoes //p')
achados=$(printf '%s\n' "$varredura" | { grep '^achado ' || true; } | sed 's/^achado //')
criadas=$(printf '%s\n' "$varredura" | { grep '^criada ' || true; } | sed 's/^criada //')
sem_rls=$(printf '%s\n' "$varredura" | { grep '^sem-rls ' || true; } | sed 's/^sem-rls //')
sem_policy=$(printf '%s\n' "$varredura" | { grep '^sem-policy ' || true; } | sed 's/^sem-policy //')
dinamico=$(printf '%s\n' "$varredura" | { grep -c '^dinamico ' || true; })
[ "${instrucoes:-0}" -ge 1 ] ||
  falha "a candidata não tem instrução nenhuma (só comentário?) — não há o que ensaiar, e um arquivo assim 'provaria' qualquer coisa"
if [ -n "$achados" ]; then
  diga "  ACUSADA — $instrucoes instruções, e nem todas rodam na transação única:"
  printf '%s\n' "$achados" | sed 's/^/    /'
else
  diga "  $instrucoes instruções, todas transacionais"
fi
if [ -n "$criadas" ]; then
  diga "  objetos que ela cria no public:"
  printf '%s\n' "$criadas" | sed 's/^/    /'
fi
if [ -n "$sem_rls" ]; then
  diga "  AVISO: cria tabela sem 'enable row level security' no mesmo arquivo: $(echo $sem_rls)"
  diga "         em produção o gatilho ensure_rls liga sozinho; aqui não."
fi
if [ -n "$sem_policy" ]; then
  diga "  AVISO: cria tabela sem policy nenhuma no mesmo arquivo: $(echo $sem_policy)"
  diga "         com RLS ligada e sem policy, NINGUÉM lê — nem o dono. É o estado que produção"
  diga "         produz sozinha para tabela nova, e o ponta a ponta abaixo mede exatamente isso."
fi
if [ "$dinamico" != "0" ]; then
  diga "  AVISO: a candidata tem SQL dinâmico (corpo \$\$…\$\$ com create/alter/execute)."
  diga "         O ensaio não enxerga o que nasce lá dentro: os objetos criados assim ficam"
  diga "         fora da lista acima e fora do ponta a ponta. Confira à mão."
fi

# ── retrato antes ────────────────────────────────────────────────────────────────
mkdir -p "$ENSAIO_DIR/retratos"
quando=$(date '+%Y%m%d-%H%M%S')
antes="$ENSAIO_DIR/retratos/$quando-antes.txt"
depois="$ENSAIO_DIR/retratos/$quando-depois.txt"
sha=$(shasum -a 256 "$arquivo" | cut -d' ' -f1)
opcoes=$([ "$falhar" = 1 ] && printf -- '--falhar-no-fim' || printf 'nenhuma')
cabecalho="candidata=$arquivo · sha256=$sha · opcoes=$opcoes · em=$(date '+%Y-%m-%dT%H:%M:%S%z')"

diga "== retrato antes"
retrato_arquivo "$antes" "$cabecalho (antes)"
diga "  $(( $(wc -l < "$antes" | tr -d ' ') - 1 )) linhas · candidata sha256 ${sha:0:12}…"
if ! diff -q <(retrato_corpo "$ENSAIO_BASE") <(retrato_corpo "$antes") > /dev/null; then
  diga "  o banco local difere da base preparada em $(diff <(retrato_corpo "$ENSAIO_BASE") <(retrato_corpo "$antes") | grep -c '^[<>]' || true) linhas" >&2
  falha "o banco local não está na base que o preparar.sh aprovou — outra candidata já foi aplicada em cima. Rode preparar.sh e ensaie de novo"
fi

# ── aplicação ────────────────────────────────────────────────────────────────────
bytes=$(wc -c < "$arquivo" | tr -d ' ')
[ "$bytes" -lt "$ENSAIO_MAX_BYTES" ] ||
  falha "a candidata tem $bytes bytes e o teto aqui é $ENSAIO_MAX_BYTES (o Linux corta um argumento de processo em 131072, e a aplicação em consulta única passa o arquivo inteiro como argumento do psql) — não dá para aplicá-la numa consulta só por aqui"

conteudo=$(cat "$arquivo")
marca_falha=""
if [ "$falhar" = 1 ]; then
  # O ';' solto antes garante que a última instrução do arquivo fechou, mesmo que ela termine
  # sem ponto e vírgula ou num comentário de linha. O rótulo é sorteado e entra na MENSAGEM:
  # com uma frase fixa, uma candidata que contivesse essa frase teria o erro dela creditado
  # como o nosso.
  tag=$(rotulo_livre "$conteudo" "ensaio_falha_$$")
  marca_falha="falha provocada pelo ensaio [$tag]"
  conteudo="$conteudo
;
do \$$tag\$ begin raise exception '$marca_falha'; end \$$tag\$;"
fi

diga "== aplicação (uma consulta simples, $bytes bytes de arquivo$([ "$falhar" = 1 ] && echo ' + a falha provocada no fim'))"
set +e
saida=$(docker exec "$ENSAIO_DB" psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 -v VERBOSITY=terse \
          --command="$conteudo" 2>&1)
rc=$?
set -e
saida=$(printf '%s\n' "$saida" | mascarar)
if [ -n "$saida" ]; then printf '%s\n' "$saida" | sed 's/^/    /'; fi
# Marca de comando do psql: o que prova que uma instrução chegou a rodar. A lista é a dos
# comandos que o Postgres devolve como tag; `(N rows)` entra porque SELECT não imprime tag.
TAGS='^(ALTER|ANALYZE|BEGIN|CALL|CHECKPOINT|CLOSE|CLUSTER|COMMENT|COMMIT|COPY|CREATE|DEALLOCATE|DECLARE|DELETE|DISCARD|DO|DROP|END|EXECUTE|EXPLAIN|FETCH|GRANT|IMPORT|INSERT|LISTEN|LOAD|LOCK|MERGE|MOVE|NOTIFY|PREPARE|REASSIGN|REFRESH|REINDEX|RELEASE|RESET|REVOKE|ROLLBACK|SAVEPOINT|SECURITY|SELECT|SET|SHOW|START|TRUNCATE|UNLISTEN|UPDATE|VACUUM|VALUES)[A-Z ]*( [0-9]+)*$'
marcas=$(printf '%s\n' "$saida" | grep -cE "$TAGS|^\([0-9]+ rows?\)$" || true)
diga "  psql saiu $rc · $marcas marca(s) de comando"
diga "  (marca não é instrução: SELECT devolve a tabela e '(N rows)', e uma instrução que falha não deixa marca)"

# ── retrato depois ───────────────────────────────────────────────────────────────
diga "== retrato depois"
retrato_arquivo "$depois" "$cabecalho (depois · psql saiu $rc)"
mudou=$({ LC_ALL=C comm -23 <(retrato_corpo "$antes") <(retrato_corpo "$depois") | sed 's/^/  - /'
          LC_ALL=C comm -13 <(retrato_corpo "$antes") <(retrato_corpo "$depois") | sed 's/^/  + /'; } | mascarar)
if [ -z "$mudou" ]; then
  diga "  nada mudou: catálogo, contagens, conteúdo e edições idênticos ao antes"
else
  diga "  $(printf '%s\n' "$mudou" | wc -l | tr -d ' ') linhas mudaram (- antes · + depois):"
  printf '%s\n' "$mudou"
fi

# ── o caminho do app, depois da candidata ────────────────────────────────────────
# A tabela que a candidata cria nasce aqui SEM RLS (produção liga sozinha) e COM ALL para anon
# (o padrão de privilégio de produção). Se ninguém ler pela API, ninguém descobre. E a contagem
# esperada vem do RETRATO desta corrida: tabela com RLS ligada e sem policy tem linha no banco e
# zero na API, e sem o retrato isso passaria como "tabela vazia".
if [ "$rc" = 0 ] && [ "$falhar" = 0 ]; then
  diga "== o caminho do app, com a candidata aplicada"
  pgrst_recarregar
  jwt=$(jwt_do_dono)
  if [ "$(local_psql -c "select to_regclass('public.edicoes_ia') is not null")" = "t" ]; then
    ponta_a_ponta edicoes_ia "$jwt" "$(linhas_no_retrato "$depois" edicoes_ia)" ||
      problema "a leitura de edicoes_ia não fecha depois da candidata"
  else
    diga "  edicoes_ia não existe mais depois da candidata"
  fi
  while IFS= read -r item; do
    [ -n "$item" ] || continue
    tipo=${item%% *}
    nome=${item#* }
    nome=$(printf '%s' "$nome" | sed 's/^"//; s/"$//')
    ponta_a_ponta "$nome" "$jwt" "$(linhas_no_retrato "$depois" "$nome")" ||
      problema "o objeto novo $nome ($tipo) não fecha: ou o dono não lê o que está lá, ou o anônimo lê o que não devia"
  done <<< "$criadas"
fi

git_conferir "$git_antes" || problema "o ensaio mexeu no repositório"

# ── veredito ─────────────────────────────────────────────────────────────────────
diga ""
saiu=0
if [ "$falhar" = 1 ]; then
  if [ "$instrucoes" = "1" ]; then
    diga "NOTA: a candidata tem UMA instrução, e a falha provocada faz o arquivo virar duas —"
    diga "      o Postgres abre uma transação implícita que a aplicação real NÃO teria. O que"
    diga "      esta corrida prova é o rollback da transação, não o comportamento da candidata."
  fi
  if [ "$rc" = 0 ]; then
    diga "VEREDITO: a falha provocada no fim não derrubou a aplicação — a candidata dá commit sozinha no meio?"
    saiu=1
  elif ! contem "$saida" "$marca_falha"; then
    diga "VEREDITO: a candidata falhou ANTES da falha provocada — o rollback não chegou a ser exercitado"
    saiu=1
  elif [ "$marcas" -lt 1 ]; then
    diga "VEREDITO: nenhuma instrução da candidata deixou marca de comando — o rollback NÃO foi exercitado."
    saiu=1
  elif [ -n "$mudou" ]; then
    diga "VEREDITO: ROLLBACK SUJO — a aplicação falhou e o banco mudou assim mesmo. A transação não é única."
    saiu=1
  else
    diga "VEREDITO: rollback limpo — $marcas marca(s) de comando antes do erro, e o banco ficou idêntico (R-25)."
  fi
elif [ "$rc" != 0 ]; then
  if [ -n "$mudou" ]; then
    diga "VEREDITO: a aplicação falhou E deixou mudança para trás — em produção isto seria migração pela metade."
  else
    diga "VEREDITO: a aplicação falhou e nada mudou (rollback limpo). O erro está acima."
  fi
  saiu=1
elif [ -z "$mudou" ]; then
  # Aplicou e não mudou nada: `create table if not exists` sobre tabela que já existe, por
  # exemplo. Não é ensaio — é um no-op que passaria por aprovação.
  diga "VEREDITO: aplicou e NÃO mudou nada — aqui esta candidata é um no-op, e um no-op não"
  diga "          ensaia coisa nenhuma. Ela já foi aplicada antes, ou depende de estado que"
  diga "          este banco não tem."
  saiu=1
elif [ "$problemas" -gt 0 ]; then
  diga "VEREDITO: aplicada, mas REPROVADA — $problemas conferência(s) falharam depois da"
  diga "          aplicação (acima). Como produção a receberia não é a pergunta que sobrou."
  saiu=1
else
  diga "VEREDITO: aplicada numa consulta só, como produção a receberia."
fi
if [ -n "$achados" ]; then
  diga "          E a varredura acusou instrução que não roda na transação única (acima)."
  saiu=1
fi
if [ "$problemas" -gt 0 ] && [ "$saiu" = 0 ]; then
  saiu=1
fi
exit $saiu
