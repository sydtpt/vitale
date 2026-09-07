-- Orbe — Fotos na pedalada: a contagem de mídia por atividade.
-- ADR 0037 · spec: docs/specs/fotos-na-pedalada/spec.md
--
-- O selo do cartão do Histórico precisa de "quantas fotos e quantos vídeos" por
-- pedalada, e as duas saídas óbvias não servem.
--
-- Buscar as linhas e contar no cliente traz mídia demais: são 707 hoje e
-- crescem sem teto — a lista pagaria o transporte de todas para desenhar um
-- número de dois dígitos.
--
-- Filtrar por `in (<ids>)` estoura a URL: o Histórico de Ciclismo tem 338
-- atividades, e os ids são texto — treze mil caracteres de query string, que o
-- PostgREST e o proxy na frente dele recusam.
--
-- Agrupar no banco resolve os dois: **uma linha por pedalada que tem mídia**.
-- São 34 hoje, e no limite serão tantas quantas forem as atividades — algumas
-- centenas, para sempre.
--
-- `security invoker` é deliberado: a função roda com os direitos de quem
-- chama, então a RLS de `activity_photos` continua valendo. O `user_id =
-- auth.uid()` é redundante com a política e fica assim mesmo — uma função que
-- só se protege pela RLS vira um vazamento silencioso no dia em que alguém
-- mexer na política.

create or replace function public.activity_media_counts()
returns table (activity_id text, photos int, videos int)
language sql
stable
security invoker
set search_path = public
as $$
  select p.activity_id,
         count(*) filter (where p.media_type = 'photo')::int as photos,
         count(*) filter (where p.media_type = 'video')::int as videos
    from public.activity_photos p
   where p.user_id = auth.uid()
     and p.state = 'linked'
   group by p.activity_id
$$;

comment on function public.activity_media_counts() is
  'Fotos e vídeos ligados por atividade (ADR 0037). Uma linha por atividade COM mídia; atividade sem mídia não aparece.';

grant execute on function public.activity_media_counts() to authenticated;
