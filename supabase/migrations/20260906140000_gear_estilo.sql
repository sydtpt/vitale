-- Orbe — O estilo da bicicleta (gravel, estrada, MTB…).
--
-- `kind` responde "que tipo de equipamento é" (bicicleta, e só) e é estrutural:
-- mexer nele mexe na herança. `style` responde "que bicicleta é" — é descritivo,
-- opcional, e existe para a tela dizer "sua gravel" em vez de "sua bicicleta",
-- e para um dia agrupar piso por estilo em vez de por unidade.
--
-- Vem do cadastro no app (dados básicos: nome, estilo, em uso desde, notas).
-- Nulo é resposta legítima: quem não quer classificar não classifica.

alter table public.gear
  add column if not exists style text;

alter table public.gear
  drop constraint if exists gear_style,
  add constraint gear_style
    check (style is null or style in ('gravel', 'road', 'mtb', 'city', 'other'));

comment on column public.gear.style is
  'Estilo descritivo da bicicleta: gravel | road | mtb | city | other. Nulo = não classificada. Diferente de `kind`, que é estrutural.';
