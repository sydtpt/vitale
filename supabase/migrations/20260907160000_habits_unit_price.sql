-- Orbe — preço médio do hábito contador
--
-- Uma coluna, na unidade que o hábito já usa: `unit_price` é o preço de UMA
-- unidade de `unit` (11,00 por litro de cerveja; 0,45 por cigarro), em euro.
-- Fica ao lado de `step` e `target`, que também são valores na mesma unidade.
--
-- O gasto **não** é gravado em lugar nenhum: sai de `Σ habit_logs.value ×
-- unit_price` na leitura (ver packages/shared/src/habits/cost.ts). É o que
-- torna o preço retroativo sem backfill — pôr um preço hoje passa a descrever
-- todo o histórico do hábito, e corrigi-lo reescreve a estimativa inteira.
--
-- `numeric(10,4)`: quatro casas porque preço por unidade pode ser fração de
-- centavo (um cigarro de um maço de 20). Nulo = o hábito não estima gasto, e é
-- o padrão de todos os que já existem.

alter table public.habits
  add column if not exists unit_price numeric(10,4)
    check (unit_price is null or unit_price >= 0);

comment on column public.habits.unit_price is
  'Preço médio de uma unidade de `unit`, em euro. Nulo = sem estimativa de gasto. '
  'Um preço só, aplicado a todo o histórico — não acompanha variação no tempo.';
