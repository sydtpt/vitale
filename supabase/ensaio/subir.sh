#!/usr/bin/env bash
# Sobe o Supabase local do ensaio: db, auth, rest e gateway, pela pasta de trabalho
# temporária — sem link com produção, na imagem de Postgres que produção roda.
#
# Confere, depois de subir, que nenhuma porta escuta fora de 127.0.0.1. Se escutar, derruba a
# pilha e sai != 0: o banco local sobe com a senha padrão `postgres`. E confere contra
# produção — não contra um arquivo — que a versão do servidor e o papel que executa batem.
#
#   supabase/ensaio/subir.sh
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"
sem_argumentos "$@"

git_antes=$(git_retrato)

diga "== ambiente"
docker_ok
override_ok
workdir_montar
diga "  colima de pé · pasta de trabalho $ENSAIO_WD"

ja_de_pe=$(docker ps --filter "label=com.supabase.cli.project=$ENSAIO_PROJETO" --format '{{.Names}}' | wc -l | tr -d ' ')
if [ "$ja_de_pe" -gt 0 ]; then
  diga "  AVISO: a pilha já está de pé ($ja_de_pe contêineres). O 'supabase start' vira no-op e a"
  diga "         lista de exclusão NÃO vale: o que estiver de pé continua de pé, inclusive serviço"
  diga "         que este ensaio não usa. Para uma pilha enxuta: descer.sh --apagar && subir.sh"
fi

diga "== supabase start"
if ! sb start -x "$ENSAIO_EXCLUIR" > "$ENSAIO_DIR/subir.log" 2>&1; then
  tail -20 "$ENSAIO_DIR/subir.log" >&2
  falha "supabase start falhou — log inteiro em $ENSAIO_DIR/subir.log"
fi
if grep -q "not valid to exclude" "$ENSAIO_DIR/subir.log"; then
  diga "  AVISO: o CLI recusou nomes da lista de exclusão (ENSAIO_EXCLUIR no lib.sh) —"
  diga "         serviço a mais de pé. O nome certo está em $ENSAIO_DIR/subir.log"
fi
diga "  de pé: $(docker ps --filter "label=com.supabase.cli.project=$ENSAIO_PROJETO" --format '{{.Names}}' | tr '\n' ' ')"

diga "== guarda de portas"
guarda_de_portas

diga "== o banco local é o de produção?"
versao_conferir

# O `supabase start` é o comando com mais chance de sujar o repositório (é ele que cria
# `supabase/.branches/` quando roda da raiz), e é justamente o que ficava fora da janela em que
# o critério de aceite era medido.
diga "== o repositório"
git_conferir "$git_antes" || falha "o subir.sh mexeu no repositório"

diga ""
diga "de pé. Agora: supabase/ensaio/preparar.sh"
