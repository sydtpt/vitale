-- Orbe — o índice de `client_event_id` deixa de ser parcial, para o `upsert` existir.
--
-- A `20261002120000_presenca_fase1` criou:
--
--   create unique index visits_client_event on public.visits (user_id, client_event_id)
--     where client_event_id is not null;
--
-- O `where` parecia zelo e era um defeito: **`ON CONFLICT` não casa com índice parcial**
-- a menos que a própria instrução repita o predicado — e o PostgREST não tem como
-- expressar isso. O resultado foi `42P10: there is no unique or exclusion constraint
-- matching the ON CONFLICT specification`, no primeiro toque real do botão "Enviar para
-- o banco", com a Fase 1 inteira pronta atrás dele.
--
-- O predicado era redundante de qualquer forma: num índice único comum, **nulo não
-- colide com nulo** (o padrão do Postgres é `nulls distinct`), então linha sem
-- `client_event_id` continua livre — que é exatamente o que o parcial queria garantir.
--
-- ── POR QUE O ENSAIO NÃO PEGOU ──────────────────────────────────────────────
--
-- O ensaio de 02/10 subiu as 30 visitas com `INSERT` puro e conferiu a invariante. Ele
-- provou o **schema** e não provou o **caminho de escrita que o app usa**, que é
-- `upsert`. São coisas diferentes, e a primeira passar não diz nada sobre a segunda.
--
-- A lição, para a próxima migração com `upsert`: ensaiar a instrução que o aplicativo
-- de fato emite, não uma equivalente. O irmão `place_days` passou no mesmo teste com
-- `ON CONFLICT (user_id, day, place_id)` porque o índice dele **não** é parcial — e é
-- o contraste entre os dois que nomeia a causa.

drop index if exists public.visits_client_event;

create unique index visits_client_event on public.visits (user_id, client_event_id);

comment on column public.visits.client_event_id is
  'O id do evento no aparelho (`placeId:kind:instante`). É a chave de idempotência da fila: reenviar a mesma travessia atualiza em vez de duplicar. NULO = linha que não veio da fila (correção manual, semeadura antiga) — e nulo não colide com nulo, então várias convivem.';
