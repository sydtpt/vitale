#!/usr/bin/env bash
# Desce a pilha do ensaio.
#
#   supabase/ensaio/descer.sh            o volume fica — o próximo subir.sh reaproveita o banco
#   supabase/ensaio/descer.sh --apagar   o volume e a pasta de trabalho vão embora
#
# O log das consultas a produção sobrevive ao --apagar: ele é a prova de que o ensaio só leu.
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

apagar=0
case "${1:-}" in
  "")        ;;
  --apagar)  apagar=1 ;;
  *)         falha "uso: descer.sh [--apagar] (veio: $*)" ;;
esac
# Era o único dos quatro que engolia argumento a mais — e é o que apaga o volume com os textos
# reais das edições.
[ "$#" -le 1 ] || falha "uso: descer.sh [--apagar] (veio: $*)"

docker_ok
workdir_montar

if [ "$apagar" = 1 ]; then
  diga "== supabase stop --no-backup"
  sb stop --no-backup || falha "supabase stop falhou"
  # Sem `| grep -q`: sob `pipefail`, o SIGPIPE do `docker volume ls` faria a checagem falhar na
  # direção insegura — "volume apagado" com o volume lá.
  volumes=$(docker volume ls --format '{{.Name}}')
  if contem "
$volumes
" "
$ENSAIO_DB
"; then
    falha "o volume $ENSAIO_DB continua lá"
  fi
  diga "  volume $ENSAIO_DB apagado"
  # Só limpa a pasta que é nossa — a marca .orbe-ensaio é escrita pelo lib.sh, e uma pasta
  # preexistente do usuário nunca a tem (o lib.sh recusa antes).
  if [ -f "$ENSAIO_DIR/.orbe-ensaio" ]; then
    find "$ENSAIO_DIR" -mindepth 1 -maxdepth 1 \
      ! -name '.orbe-ensaio' ! -name '.lock' ! -name "$(basename "$ENSAIO_LOG")" \
      -exec rm -rf {} +
    diga "  pasta de trabalho limpa ($ENSAIO_DIR)"
    if [ -f "$ENSAIO_LOG" ]; then
      diga "  o log das consultas FICOU: $ENSAIO_LOG"
      # E é relido antes de o resto sumir: um log que ninguém confere não é prova de nada.
      log_conferir
    fi
  fi
else
  diga "== supabase stop"
  sb stop || falha "supabase stop falhou"
  diga "  volume mantido — o próximo subir.sh reaproveita o banco"
fi
