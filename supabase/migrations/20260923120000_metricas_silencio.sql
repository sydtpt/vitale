-- Orbe — O detector de métrica morta: os FATOS do silêncio (story 2.7).
-- ADR 0055 · spec: _bmad-output/implementation-artifacts/spec-2-7-o-detector-de-metrica-morta.md
--
-- A revista sabe receber, conferir, narrar, ranquear e desenhar a lápide desde
-- as stories 1.7 e 1.12 — e ninguém a produz. Quatro métricas pararam em 2026
-- (respiração 10/07, VO₂max 14/07, SpO₂ 16/07, anéis 17/08) e seguem narradas
-- como calmaria. Falta quem olhe o acervo e diga o que parou de chegar.
--
-- **Esta função não diz quem morreu.** Ela devolve fatos, por métrica: quando
-- foi a primeira e a última medida, quantas medidas houve na vida, e quais
-- foram os silêncios — com o sinal de o aparelho ter continuado gravando
-- durante cada um. Quem aplica as quatro regras do dono é o núcleo
-- (`packages/shared/src/period/lapides.ts`), onde a regra tem teste barato e
-- mudá-la não pede migração.
--
-- Por que no banco, e não o acervo no cliente: ler `health_daily` inteiro custa
-- cinco idas à rede e ~200 KB hoje, em toda abertura da Retrospectiva e em toda
-- impressão, e cresce uma ida a cada 43 dias. Isto devolve **uma linha por
-- métrica** — pouco mais de vinte hoje, alguns KB. Não é tamanho fixo: o `jsonb`
-- de cada linha carrega todos os silêncios da vida daquela métrica, então ele
-- cresce devagar, com o número de silêncios acima do piso, e não com o tamanho do
-- acervo. E como nada pode ser persistido — o backfill reescreve até 500 dias e o
-- `updated_at` é reescrito a cada sync —, esse custo é pago a cada leitura, não
-- uma vez.
--
-- Molde literal de `activity_media_counts` (20260907120000): `language sql`,
-- `stable`, `security invoker`, `search_path` fixo e `user_id = auth.uid()`
-- redundante com a RLS de propósito — uma função que só se protege pela
-- política vira vazamento silencioso no dia em que alguém mexer nela.
--
-- **Aditiva, e sem índice novo.** Nenhuma mudança de schema. O
-- `health_daily_user_metric_day_idx` `(user_id, metric, day desc)` serve à
-- agregação por métrica; ele **não** serve ao `exists` da testemunha, que filtra
-- `metric <> ...` numa faixa de dia — esse ramo varre a partição do usuário. Fica
-- assim de propósito: são poucas dezenas de silêncios acima do piso, sobre um
-- acervo pessoal de alguns milhares de linhas. Se um dia doer, o índice que falta
-- é por `(user_id, day)`.
--
-- O app que ainda não a conhece não quebra: a leitura falha e a edição sai sem
-- lápide, exatamente como saía antes dela.

create or replace function public.metricas_silencio(p_piso_dias int)
returns table (
  metrica   text,
  primeira  date,
  ultima    date,
  medidas   int,
  silencios jsonb
)
language sql
stable
security invoker
set search_path = public
as $$
  with medida as (
    -- Medida é **dia com valor**. Linha sem `value` é dia sem relógio, não
    -- medida — a mesma régua da medição passiva da ADR 0054.
    select h.metric, h.day
      from public.health_daily h
     where h.user_id = auth.uid()
       and h.value is not null
  ),
  vao as (
    -- Entre cada medida e a seguinte; depois da última, até HOJE. O silêncio
    -- corrente é o único que pode declarar morte, e ele só tem tamanho contra
    -- o dia de hoje: fechá-lo no fim do acervo tornaria o sinal `outra_chegou`
    -- vazio por construção (haveria sempre outra métrica no fim dele).
    select m.metric,
           m.day + 1 as de,
           coalesce(lead(m.day) over (partition by m.metric order by m.day), current_date + 1) - 1 as ate
      from medida m
  ),
  silencio as (
    select v.metric, v.de, v.ate, (v.ate - v.de + 1)::int as dias
      from vao v
     where v.ate >= v.de
       and (v.ate - v.de + 1) >= greatest(p_piso_dias, 1)
  ),
  com_sinal as (
    -- "O aparelho estava gravando neste intervalo?" — houve linha de QUALQUER
    -- outra métrica dentro dele. É o que barra o BLECAUTE: troca de telefone,
    -- permissão revogada, quando nada chega e sem isto a edição sairia com
    -- lápide em todas as métricas de uma vez.
    --
    -- **Não é o que separa família parada de métrica morta.** Medido em
    -- 23/09/2026: no silêncio que começa em 11/07/2025 (a última medida da
    -- família de atividade é 10/07) as métricas de pulso seguiram chegando, e o
    -- sinal é verdadeiro ali. Quem separa esses dois casos é o recorde próprio,
    -- no núcleo.
    --
    -- O segundo ramo é o caso degenerado: acervo com UMA métrica só. Sem ele,
    -- `outra_chegou` seria falsa para sempre e nenhuma morte seria declarada
    -- nunca — "não há mais ninguém para testemunhar" viraria "não morreu".
    -- Quando não existe nenhuma outra métrica no acervo, não há o que
    -- testemunhar, e o aparelho conta como vivo.
    select s.metric, s.de, s.ate, s.dias,
           (
             not exists (
               select 1
                 from public.health_daily o
                where o.user_id = auth.uid()
                  and o.metric <> s.metric
                  and o.value is not null
             )
             or exists (
               select 1
                 from public.health_daily o
                where o.user_id = auth.uid()
                  and o.metric <> s.metric
                  and o.value is not null
                  and o.day between s.de and s.ate
             )
           ) as outra_chegou
      from silencio s
  )
  select m.metric,
         min(m.day)  as primeira,
         max(m.day)  as ultima,
         count(*)::int as medidas,
         coalesce(
           (select jsonb_agg(
                     jsonb_build_object(
                       'de', c.de, 'ate', c.ate, 'dias', c.dias, 'outra_chegou', c.outra_chegou
                     )
                     order by c.de
                   )
              from com_sinal c
             where c.metric = m.metric),
           '[]'::jsonb
         ) as silencios
    from medida m
   group by m.metric
   order by m.metric
$$;

comment on function public.metricas_silencio(int) is
  'Fatos do silêncio por métrica de health_daily (story 2.7 / ADR 0055): primeira e última medida, '
  'quantas medidas na vida, e os silêncios de pelo menos p_piso_dias dias, cada um com de, ate, dias e '
  'outra_chegou (houve linha de outra métrica no intervalo). O último silêncio de uma métrica que calou '
  'vai até current_date. NÃO decide quem morreu — quem aplica as regras é o núcleo.';

-- **O `grant` sozinho não restringe nada.** No Postgres toda função nasce com
-- EXECUTE para `PUBLIC`, então conceder a `authenticated` só repete o que já
-- valia — inclusive para `anon`. O `revoke` abaixo é o que faz a defesa em
-- profundidade descrita no cabeçalho existir: quem não está autenticado não
-- alcança a função, e o `auth.uid()` lá dentro deixa de ser a única fronteira.
-- Mesmo molde de `edicao_imprimir` (migration 20260912120000).
revoke execute on function public.metricas_silencio(int) from public, anon;
grant execute on function public.metricas_silencio(int) to authenticated;
