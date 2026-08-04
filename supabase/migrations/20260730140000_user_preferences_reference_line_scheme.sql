-- Cores das linhas de referência do gráfico de duração (Histórico de Treinos).
--
-- Escolhe o par de cores da reta de esforço médio ("Você") e da polilinha de
-- progressão. A linha da meta fica sempre em cinza neutro e não é configurável.
-- Ver packages/shared/src/constants/reference-lines.ts — os valores aceitos aqui
-- espelham REFERENCE_LINE_SCHEMES; NULL usa o padrão do app ('violeta-petroleo').
--
-- Sem `default` na coluna de propósito: quem decide o padrão é o shared
-- (resolveReferenceLineScheme), para web e mobile não divergirem do banco.
alter table public.user_preferences
  add column if not exists reference_line_scheme text
    check (reference_line_scheme in ('violeta-petroleo', 'violeta', 'petroleo-vinho'));

comment on column public.user_preferences.reference_line_scheme is
  'Par de cores das linhas de referência do gráfico de duração. NULL = padrão do app (violeta-petroleo).';
