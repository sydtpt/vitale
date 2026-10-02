-- Orbe — `places.kind` deixa de ser só `home`.
--
-- A `20260907170000_nome_das_rotas` criou a tabela com `check (kind = 'home')`, e estava
-- certa: ali `places` só guardava âncora de casa, e um CHECK de um valor só é a forma
-- mais barata de dizer isso.
--
-- A `20261002120000_presenca_fase1` adotou a tabela para a Presença **sem tocar nesse
-- CHECK** — e o buraco só apareceu no ensaio: inserir o escritório devolve
-- `23514 places_kind`. Sem o ensaio, a falha teria aparecido no aparelho, no momento em
-- que o dono cadastrasse o segundo lugar, e com cara de bug do app.
--
-- O vocabulário é o do spec da Presença (docs/specs/presenca/data-model.md §2.1). É uma
-- lista fechada, e não texto livre, pelo mesmo motivo de sempre nesta casa: `kind`
-- resolve a cor pelo `module` e aparece em leitura agregada — digitar `gim` em vez de
-- `gym` criaria um lugar que nenhuma tela encontra, calado.
--
-- ⚠ `kind` **não é identidade**. Três mercados têm `kind = 'grocery'` e três
-- `identidade` distintas; o que atravessa mudança de endereço é a identidade.

alter table public.places drop constraint places_kind;

alter table public.places add constraint places_kind
  check (kind in ('home','work','gym','grocery','food','culture','other'));

comment on column public.places.kind is
  'O papel do lugar, em vocabulário fechado. NÃO é identidade: três mercados são três identidades com o mesmo kind.';
