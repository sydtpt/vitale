-- Orbe — Sono: a janela na cama nunca é menor que o sono.
-- Spec: docs/specs/sono/data-model.md §4.2 · tasks T3.6/T3.7
--
-- O invariante nasceu no cliente (`aggregateSleepPeriods`): a janela INBED é a
-- união das amostras que tocam a noite, alargada para cobrir [onset, wake] —
-- dormir fora da cama não existe para este dado. Foi preciso porque 14 noites
-- do histórico tinham eficiência acima de 100%, e porque o primeiro backfill
-- deixou 57 janelas até 57 s DEPOIS da chave (a RPC truncava o onset ao minuto
-- e o cliente não).
--
-- O backfill v7 provou o invariante em 286 noites reais (viola = 0) ANTES de
-- ele virar CHECK — a ordem certa: a regra no código, o dado conformado, depois
-- a trava no banco. Uma trava antes disso teria rejeitado o próprio backfill.
--
-- `not valid` + `validate` em separado: o VALIDATE varre a tabela sem bloquear
-- escritas concorrentes; o ADD com validação imediata tomaria um lock mais
-- pesado. Com 286 linhas a diferença é acadêmica — o padrão fica para quando
-- não for.
alter table public.sleep_periods
  add constraint sleep_periods_bed_covers_sleep check (
    in_bed_at is null
    or (in_bed_at <= onset_at and in_bed_end >= wake_at)
  ) not valid;

alter table public.sleep_periods
  validate constraint sleep_periods_bed_covers_sleep;
