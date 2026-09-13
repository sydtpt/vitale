#!/usr/bin/env bash
# Cenário: a TRAVA de `edicao_imprimir` serializa duas impressões do mesmo período.
# Story 1.9 · rodada 3.
#
# ## Por que ele não é SQL
#
# O `edicao-imprimir.sql` roda inteiro dentro de **uma** transação — é assim que o
# `ensaiar.sh` aplica uma candidata, e é assim que produção a recebe. Dentro de uma
# transação só, o `pg_advisory_xact_lock` nunca disputa nada com ninguém: ele pega
# a trava, e pronto. Medido: **apagar a linha da trava mantém o cenário SQL inteiro
# verde.** Uma guarda que some sem reprovar nada é uma guarda que não guarda — e
# esta carrega a razão declarada de a função existir ("lost update entre o iPhone e
# o script do backfill").
#
# Concorrência só se observa com duas sessões, então este caso abre duas: um `psql`
# que segura a transação aberta e outro que tenta imprimir o mesmo período.
#
# ## O que ele prova, e como
#
# 1. **A segunda chamada ESPERA.** Com a sessão A dentro de `edicao_imprimir` e a
#    transação aberta, a sessão B chama a mesma função no mesmo período e fica
#    bloqueada. A prova não é o relógio (que mede lentidão, não bloqueio): é o
#    `pg_locks` — B aparece esperando um lock `advisory` com `granted = false`.
# 2. **E só espera por causa da trava.** A sessão C chama a função num período
#    DIFERENTE, com A ainda segurando a dela, e passa na hora. Sem este controle,
#    "B esperou" seria compatível com o banco estar travado por qualquer motivo.
# 3. **Depois do commit de A, B anda** e a edição fica consistente.
#
# ## Como rodar
#
#   supabase/ensaio/subir.sh
#   supabase/ensaio/preparar.sh
#   supabase/ensaio/ensaiar.sh supabase/migrations/20260912120000_edicao_por_caderno.sql
#   supabase/ensaio/cenarios/concorrencia.sh
#
# Ele precisa da função já aplicada — ou seja, roda **depois** do `ensaiar.sh`, sobre
# o banco que ficou. Não usa a Management API e não fala com produção.
#
# ## O que ele deixa para trás
#
# Nada: as duas sessões terminam em `rollback`, e no fim ele confere a contagem do
# período dele. O período é 2999-02, que produção nunca vai usar.
source "$(cd "$(dirname "$0")" && pwd)/../lib.sh"

sem_argumentos "$@"

problemas=0
problema() { printf 'ensaio: FALHOU — %s\n' "$*" >&2; problemas=$((problemas + 1)); }

git_antes=$(git_retrato)

docker_ok
workdir_montar
# Sem chamar `trava`: o `lib.sh` já a pega ao ser carregado, e uma segunda chamada
# encontra a trava da própria corrida e a denuncia como corrida alheia.
pilha_de_pe
chaves_locais

INI=2999-02-01
FIM=2999-02-28
CAD="array['sono','movimento']"

# O dono é o mesmo usuário do ensaio. A função é `security invoker`: rodar como
# `postgres` passaria por cima da RLS e mediria menos do que parece.
uid=$(local_psql -c "select id from auth.users order by created_at limit 1")
[ -n "$uid" ] ||
  falha "o banco do ensaio não tem usuário — rode o preparar.sh antes"

# A carga de uma impressão de dois cadernos, montada uma vez.
linhas() {
  cat <<JSON
[{"caderno":"sono","texto":"$1","provedor":"p","modelo":"$1","prompt_versao":3,
  "pacote_versao":3,"motivo_de_parada":"STOP","tokens_entrada":1,"tokens_saida":1,
  "agg_version_no_momento":9,"metrica_lider":null},
 {"caderno":"movimento","texto":"$1","provedor":"p","modelo":"$1","prompt_versao":3,
  "pacote_versao":3,"motivo_de_parada":"STOP","tokens_entrada":1,"tokens_saida":1,
  "agg_version_no_momento":9,"metrica_lider":null}]
JSON
}

comoDono() {   # o preâmbulo que faz a sessão ser o dono, para a RLS
  printf "select set_config('request.jwt.claims', '{\"sub\":\"%s\",\"role\":\"authenticated\"}', true);\nset local role authenticated;\n" "$uid"
}

TRAB="$ENSAIO_DIR/concorrencia"
rm -rf "$TRAB"; mkdir -p "$TRAB"

limpar() {
  local_psql -c "delete from public.edicoes_ia
                  where user_id = '$uid' and inicio in ('$INI', '2999-03-01')" >/dev/null 2>&1 || true
  rm -f "$TRAB"/a.fifo
}
# **O `trap` da lib é preservado.** `trava` instala um `trap … EXIT` que solta a
# trava da pasta; um `trap` novo aqui o SUBSTITUI, e a corrida termina deixando a
# trava para trás — a corrida seguinte acusa "outro ensaio pegou esta pasta" sobre
# um processo que já morreu. Por isso este trap faz as duas coisas.
trap 'limpar; rm -rf "$ENSAIO_DIR/.lock" 2>/dev/null || true' EXIT

diga "== a sessão A abre a transação, imprime e NÃO comita"
# A fifo é o que segura a transação de A aberta: o `psql` bloqueia lendo dela até
# este script escrever. Sem isso não haveria janela nenhuma para medir.
mkfifo "$TRAB/a.fifo"
{
  comoDono
  printf "select public.edicao_imprimir('month','%s','%s',%s,'%s'::jsonb);\n" \
    "$INI" "$FIM" "$CAD" "$(linhas m1 | tr -d '\n')"
  printf "\\\\echo A_DENTRO\n"
  cat "$TRAB/a.fifo"
} | docker exec -i "$ENSAIO_DB" psql -U postgres -d postgres -X -q -tA -v ON_ERROR_STOP=1 \
      -c '\set AUTOCOMMIT off' -f - > "$TRAB/a.out" 2>&1 &
a_pid=$!

# Espera A chegar dentro da transação, com a trava na mão.
for _ in $(seq 1 100); do
  grep -q A_DENTRO "$TRAB/a.out" 2>/dev/null && break
  sleep 0.1
done
grep -q A_DENTRO "$TRAB/a.out" 2>/dev/null ||
  falha "a sessão A não chegou a imprimir (saída em $TRAB/a.out)"
diga "  A está dentro da transação, segurando a trava do período $INI"

diga "== a sessão C imprime OUTRO período — o controle"
# Se isto travasse, "B esperou" não diria nada sobre a trava por edição: diria que
# o banco inteiro parou. Roda com prazo curto, porque passar é ser rápido.
c_saiu=0
{
  comoDono
  printf "set local lock_timeout = '5s';\nset local statement_timeout = '10s';\n"
  printf "select count(*) from public.edicao_imprimir('month','2999-03-01','2999-03-31',%s,'%s'::jsonb);\n" \
    "$CAD" "$(linhas m9 | tr -d '\n')"
  printf "rollback;\n"
} | docker exec -i "$ENSAIO_DB" psql -U postgres -d postgres -X -q -tA -v ON_ERROR_STOP=1 \
      -c '\set AUTOCOMMIT off' -f - > "$TRAB/c.out" 2>&1 || c_saiu=$?
[ "$c_saiu" = 0 ] ||
  { mascarar < "$TRAB/c.out" >&2; falha "o CONTROLE travou: outro período não deveria esperar por este"; }
diga "  C passou na hora, em outro período — a trava é por EDIÇÃO, não por tabela"

diga "== a sessão B tenta o MESMO período, com A ainda aberta"
b_saiu=0
{
  comoDono
  printf "set local lock_timeout = '20s';\nset local statement_timeout = '30s';\n"
  printf "select public.edicao_imprimir('month','%s','%s',%s,'%s'::jsonb);\n" \
    "$INI" "$FIM" "$CAD" "$(linhas m2 | tr -d '\n')"
  printf "commit;\n"
} | docker exec -i "$ENSAIO_DB" psql -U postgres -d postgres -X -q -tA -v ON_ERROR_STOP=1 \
      -c '\set AUTOCOMMIT off' -f - > "$TRAB/b.out" 2>&1 &
b_pid=$!

# **A medição.** Não é o relógio: é o catálogo de travas. B tem de aparecer
# esperando um lock `advisory` que ninguém lhe concedeu.
esperando=0
for _ in $(seq 1 100); do
  esperando=$(local_psql -c "select count(*) from pg_locks
                              where locktype = 'advisory' and not granted")
  [ "$esperando" -ge 1 ] && break
  sleep 0.1
done
if [ "${esperando:-0}" -lt 1 ]; then
  kill "$a_pid" "$b_pid" 2>/dev/null || true
  falha "B NÃO esperou: nenhum lock advisory pendente em pg_locks.
    É o que se vê quando a linha do pg_advisory_xact_lock sai da função — as duas
    impressões rodam cada uma no seu snapshot e o árbitro vira a unique no COMMIT."
fi
diga "  B está bloqueado em pg_locks (advisory, granted = false) — a trava serializa"

# Quantas linhas B já gravou enquanto espera? Nenhuma: ele nem entrou.
antes=$(local_psql -c "select count(*) from public.edicoes_ia where user_id = '$uid' and inicio = '$INI'")
diga "  e não gravou nada enquanto esperava (linhas visíveis fora da transação de A: $antes)"

diga "== A comita; B deve andar"
printf 'commit;\n' > "$TRAB/a.fifo"
wait "$a_pid" || { mascarar < "$TRAB/a.out" >&2; falha "a sessão A falhou"; }
wait "$b_pid" || { mascarar < "$TRAB/b.out" >&2; falha "a sessão B falhou depois de A comitar"; }

# O desfecho: B rodou DEPOIS de A, então quem ficou gravado é B — e a edição está
# inteira, com dois cadernos e posições contíguas. Se as duas tivessem entrelaçado,
# aqui haveria linha de m1 sobrevivendo ao lado de m2, ou posição repetida.
final=$(local_psql -c "select string_agg(modelo || ':' || posicao, ',' order by posicao)
                         from public.edicoes_ia
                        where user_id = '$uid' and tipo_periodo = 'month'
                          and inicio = '$INI' and fim = '$FIM'")
[ "$final" = "m2:1,m2:2" ] ||
  falha "a edição final ficou '$final', e devia ser 'm2:1,m2:2' — a segunda impressão inteira, sem mistura"
diga "  edição final: $final — a segunda impressão inteira, sem entrelaçar com a primeira"

limpar
resto=$(local_psql -c "select count(*) from public.edicoes_ia where user_id = '$uid' and inicio = '$INI'")
[ "$resto" = "0" ] || problema "o cenário deixou $resto linha(s) para trás"

git_conferir "$git_antes" || problema "o cenário mexeu no repositório"

if [ "$problemas" -gt 0 ]; then
  falha "o cenário de concorrência terminou com $problemas problema(s)"
fi
diga ""
diga "VEREDITO: a trava serializa duas impressões do mesmo período (B esperou em pg_locks),"
diga "          e não serializa períodos diferentes (C passou na hora)."
