-- Orbe — A edição passa a ser UMA LINHA POR CADERNO.
-- Story 1.9 · spec: docs/specs/revista-retrospectiva/mudancas-mecanicas.md
-- ADs 3, 4, 15, 16 e 17 da espinha da revista.
--
-- É a ÚNICA migração do Épico 1. Coluna que aparecer depois entra aqui, não numa
-- segunda — a instância é única, não há staging, e cada janela custa um build.
--
-- A ordem interna deste arquivo É a garantia:
--
--   1. As 7 edições de produção saem PRIMEIRO. Elas não têm caderno, não têm
--      posição e não têm agregação carimbada; com as colunas já obrigatórias, a
--      migração pararia no `add column … not null` e o banco ficaria como estava.
--      O texto delas está exportado em `primeiras-edicoes-prompt-v2.md` — é o que
--      autoriza apagá-las: o git guarda, e a forma que elas têm o app não produz
--      mais (`pacote_versao` subiu para 3, `prompt_versao` para 3).
--   2. Só então nascem `caderno`, `posicao` e `metrica_lider`.
--
-- **O CHECK de `motivo_de_parada` não é tocado.** Ele continua sendo a conclusão
-- de `ia/motor.ts`, e a guarda do `architecture.test.ts` compara os dois lendo a
-- ÚLTIMA migration que o define. Mexer nele aqui trocaria a definição vigente.

-- ── 1. As 7 edições saem, antes de qualquer coluna obrigatória ──────────────
--
-- **E são exatamente 7.** O texto exportado é de sete linhas; se a janela da
-- AD-15 pegar o banco com oito — um build antigo gravou entre a exportação e a
-- aplicação —, a oitava sairia daqui sem existir em lugar nenhum. A migração
-- reprova em vez de apagar: o git é o único lugar onde esse texto sobrevive.

do $guarda_das_sete$
declare
  v_esperado constant integer := 7;
  v_apagadas integer;
begin
  delete from public.edicoes_ia;
  get diagnostics v_apagadas = row_count;
  if v_apagadas <> v_esperado then
    raise exception
      'a migração apagaria % edições, e o texto exportado em primeiras-edicoes-prompt-v2.md cobre %. Reexporte as edições que faltam ANTES de aplicar — depois daqui elas não existem em lugar nenhum.',
      v_apagadas, v_esperado;
  end if;
end
$guarda_das_sete$;

-- ── 2. As colunas novas ─────────────────────────────────────────────────────

alter table public.edicoes_ia
  -- A mesma lista de `period/cadernos.ts`, letra por letra: minúsculas sem
  -- acento, do Postgres ao componente. Um id que precisasse de tradução entre
  -- camadas seria um id a mais para manter em sincronia.
  add column caderno text not null
    check (caderno in ('sono', 'movimento', 'coracao', 'rotina')),

  -- A ordem é COLUNA, não array. Com a chave por caderno, um array com a ordem
  -- do conjunto guardado em cada parte é uma chance de divergir por linha.
  -- Contígua de 1 a N sobre os cadernos que a edição TEM — que raramente são
  -- quatro: 22 dos 39 meses do backfill têm um caderno só. Caderno vazio não
  -- reserva posição, caderno reprovado não tem linha.
  add column posicao smallint not null
    check (posicao >= 1),

  -- A chave da métrica que liderou o ranqueamento, carimbada na impressão e
  -- nunca recalculada (AD-17): re-derivada depois, ela leria um estado que já
  -- andou. **Aceita nulo, e nulo é a verdade** — "nenhuma métrica liderou":
  -- caderno que entrou pela lápide, ou onde nada passou no portão de amostra.
  -- Sentinela inventaria uma chave que não existe, e o anuário do Épico 3 lê
  -- este nulo como lacuna declarada.
  add column metrica_lider text;

-- O comentário da tabela ainda descrevia a forma velha, "uma linha por período".
-- Ele é o que um `\d+` mostra, e descrever errado a tabela que acabou de mudar de
-- grão é como a próxima pessoa aprende a coisa errada.
comment on table public.edicoes_ia is
  'Cadernos gerados por modelo para períodos FECHADOS. UMA LINHA POR CADERNO, assinada pelo provedor/modelo/prompt que a escreveu; a ordem do miolo é a coluna posicao, congelada na última impressão.';

comment on column public.edicoes_ia.caderno is
  'A seção da edição (period/cadernos.ts). Parte da chave: o caderno de Sono ganha errata sem tocar no de Movimento.';
comment on column public.edicoes_ia.posicao is
  'A ordem do miolo, congelada na última impressão. Contígua de 1 a N sobre os cadernos que a edição tem.';
comment on column public.edicoes_ia.metrica_lider is
  'A chave do fato que liderou o ranqueamento. NULO = nenhuma métrica liderou (lápide, ou nada passou no portão).';

-- ── 3. A chave ──────────────────────────────────────────────────────────────

alter table public.edicoes_ia drop constraint edicoes_ia_pkey;

alter table public.edicoes_ia
  add constraint edicoes_ia_pkey
  primary key (user_id, tipo_periodo, inicio, fim, caderno);

-- `deferrable initially deferred` não é detalhe: sem isso a PERMUTAÇÃO de
-- posições é ilegal em qualquer formulação — trocar 1 e 2 passa por um instante
-- em que dois cadernos disputam a mesma posição. É cobrado no COMMIT, e o
-- árbitro do `ON CONFLICT` continua sendo a chave primária, que não é deferrable.
alter table public.edicoes_ia
  add constraint edicoes_ia_posicao_unica
  unique (user_id, tipo_periodo, inicio, fim, posicao)
  deferrable initially deferred;

-- ── 4. A agregação deixa de aceitar ausência (AD-16) ────────────────────────
--
-- `null` é "não foi medido" em toda a base; esta coluna é a exceção nomeada.
-- Enquanto ela aceitava nulo, `precisaErrata` devolvia falso para as 7 linhas e
-- NENHUMA edição em produção era elegível a errata. Quem grava lê a constante no
-- ponto de gravação (`data/edicoes-ia.ts`), então a coluna pode cobrar.
alter table public.edicoes_ia
  alter column agg_version_no_momento set not null;

-- ── 5. A capa, com grão de EDIÇÃO ───────────────────────────────────────────
--
-- Tabela à parte, e não coluna: com a chave por caderno, uma coluna em
-- `edicoes_ia` seriam até quatro cópias da mesma capa — o mesmo padrão que o
-- contrato recusou para a ordem. E a parede lê uma linha por edição em vez de
-- varrer quatro e desduplicar.
--
-- **Ninguém escreve aqui ainda.** O carimbo é da Story 1.13; esta migração só
-- cria a forma, porque uma segunda migração no Épico 1 está proibida.
--
-- Sem `if not exists`, de propósito: esta migração é deliberadamente fail-fast
-- (a guarda das sete edições existe para isso), e `if not exists` transformaria
-- "a tabela já existe com OUTRA forma" em sucesso calado. A `create policy`
-- logo abaixo não é idempotente de qualquer jeito — a migração nunca foi
-- reexecutável, e fingir que é só esconde de qual passo ela morreu.
create table public.edicoes_capa (
  user_id       uuid not null references auth.users(id) on delete cascade,

  -- Os mesmos CHECKs de `edicoes_ia`: a capa é de uma edição, e edição de
  -- período que nunca fecha não existe.
  tipo_periodo  text not null check (tipo_periodo in ('week', 'month', 'season', 'year')),
  inicio        date not null,
  fim           date not null,

  -- TRÊS naturezas, não duas. `foto` só existe a partir de 2026; `tracado` é a
  -- rota do próprio período; `grade` é o que sobra quando não há nem foto nem
  -- rota — e sem ela 2023 não teria capa nenhuma.
  natureza      text not null check (natureza in ('foto', 'tracado', 'grade')),

  -- A identidade do que foi escolhido, **sem chave estrangeira de propósito**.
  -- O carimbo guarda valor, não ponteiro: uma FK com `cascade` apagaria a capa
  -- de um período fechado no dia em que a foto saísse do acervo, e uma com `set
  -- null` a esvaziaria. `foto_taken_at` é a chave de cura da ADR 0037 — o
  -- `asset_id` do PhotoKit não é estável, o instante da captura é.
  foto_id          uuid,
  foto_taken_at    timestamptz,
  rota_activity_id text,

  -- A legenda **já formatada** ("Ittre · km 31,1 · 12:38"), não os três campos:
  -- é o que a faz continuar imprimindo — e servindo de descrição textual — depois
  -- que o `ph://` some da biblioteca do iPhone.
  legenda       text not null check (length(trim(legenda)) > 0),

  carimbada_em  timestamptz not null default now(),

  primary key (user_id, tipo_periodo, inicio, fim),
  -- O par do `edicao_intervalo_valido` que `edicoes_ia` já tem desde a migration
  -- de 06/09: duas tabelas com a mesma chave de período, com a mesma regra.
  constraint capa_intervalo_valido check (fim >= inicio),

  -- Meia capa não é capa: a natureza e a identidade andam juntas, ou a
  -- reimpressão parcial acharia uma foto sem instante para curar.
  constraint capa_identidade_bate_com_natureza check (
    (natureza = 'foto'    and foto_id is not null and foto_taken_at is not null
                          and rota_activity_id is null)
    or (natureza = 'tracado' and rota_activity_id is not null
                             and foto_id is null and foto_taken_at is null)
    or (natureza = 'grade'   and foto_id is null and foto_taken_at is null
                             and rota_activity_id is null)
  )
);

comment on table public.edicoes_capa is
  'A capa carimbada de uma edição (AD-3). Grão de edição, não de caderno. Valores resolvidos: natureza, identidade e a legenda já formatada.';

alter table public.edicoes_capa enable row level security;

create policy "own edicoes_capa" on public.edicoes_capa
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── 6. A impressão, numa chamada só (AD-4) ──────────────────────────────────
--
-- Por que no banco, e não no cliente: um `upsert` do conjunto direto do
-- PostgREST é atômico e a permutação até passa (a unique é deferida), mas para
-- não zerar as colunas dos cadernos que a reimpressão NÃO regenerou ele teria
-- que relê-los e regravá-los — que é o read-modify-write, o lost update entre o
-- iPhone e o script do backfill no mesmo período, e a REASSINATURA de três
-- textos que outro modelo escreveu.
--
-- Recebe os cadernos que a edição PASSA A TER, em ordem, e o texto só dos
-- regenerados. Grava os regenerados, ajusta a posição de todos e apaga a linha
-- do caderno que saiu — `upsert` não apaga, e caderno que ficou vazio deixaria
-- linha fantasma reservando posição sem texto.
create or replace function public.edicao_imprimir(
  p_tipo_periodo text,
  p_inicio       date,
  p_fim          date,
  p_ordem        text[],
  p_linhas       jsonb default '[]'::jsonb
) returns setof public.edicoes_ia
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v_user  uuid := auth.uid();
  v_n     integer := coalesce(array_length(p_ordem, 1), 0);
  v_fora  text;
  v_tem   integer;
begin
  if v_user is null then
    raise exception 'edicao_imprimir exige sessão autenticada';
  end if;

  if p_tipo_periodo is null or p_inicio is null or p_fim is null then
    raise exception 'edicao_imprimir exige tipo, início e fim do período';
  end if;

  -- **O tipo é conferido AQUI, e não pelo CHECK.**
  --
  -- O CHECK de `tipo_periodo` só é tocado quando há `insert`, e a permutação pura
  -- (`p_linhas = '[]'`) não insere nada: um `'all'` — que é valor legítimo de
  -- `PeriodKind` e ilegítimo aqui — atravessava as guardas, não achava linha
  -- nenhuma e morria na mensagem genérica de contagem, que fala de caderno sem
  -- texto e não do tipo errado. Diagnóstico apontando para o lugar errado é pior
  -- que diagnóstico nenhum.
  if p_tipo_periodo not in ('week', 'month', 'season', 'year') then
    raise exception
      'tipo de período sem edição possível: % — os quatro são week, month, season e year (all nunca fecha)',
      p_tipo_periodo;
  end if;

  -- O intervalo invertido não morreria aqui: o `delete` e o `update` filtram por
  -- ele e não acham nada, e só o `insert` bate no CHECK `edicao_intervalo_valido`
  -- — com a mensagem do banco, não com a de quem chamou. E numa chamada sem
  -- linha nova (a permutação pura) ele não bate em nada e devolveria vazio.
  if p_fim < p_inicio then
    raise exception 'o período termina antes de começar: % a %', p_inicio, p_fim;
  end if;

  -- **A trava é o ponto inteiro desta função.** Sem ela, duas impressões do
  -- mesmo período — o iPhone e o script do backfill — rodam cada uma no seu
  -- snapshot: as duas apagam, as duas inserem, as duas passam a própria
  -- conferência final, e o único árbitro vira a `unique` deferida estourando no
  -- COMMIT, sem dizer qual período nem quem chamou. `pg_advisory_xact_lock`
  -- serializa por EDIÇÃO (não por tabela) e solta sozinha no fim da transação.
  perform pg_advisory_xact_lock(hashtextextended(
    v_user::text || '|' || p_tipo_periodo || '|' || p_inicio::text || '|' || p_fim::text, 0));

  -- Edição sem caderno nenhum não é edição vazia: é chamada errada. Apagar a
  -- edição inteira tem que ser um ato com essa cara, não o caso degenerado deste.
  if p_ordem is null then
    raise exception 'edicao_imprimir sem ordem — passe os cadernos que a edição passa a ter';
  end if;
  if v_n = 0 then
    raise exception 'edicao_imprimir sem caderno nenhum na ordem';
  end if;

  -- `p_linhas` é a carga da impressão. Nulo não é "nada a regenerar" — quem não
  -- regenera nada passa `[]`, e a diferença entre as duas coisas é a diferença
  -- entre uma permutação e um engano.
  if p_linhas is null then
    raise exception 'p_linhas nulo — para não regenerar nada, passe um array vazio';
  end if;
  if jsonb_typeof(p_linhas) <> 'array' then
    raise exception 'p_linhas tem de ser um array jsonb, e veio %', jsonb_typeof(p_linhas);
  end if;

  -- Elemento que não é objeto. Sem isto, `jsonb_to_recordset` morre com
  -- "argument of json_to_recordset must be an array of objects" — mensagem do
  -- Postgres, sem dizer qual elemento —, e a guarda da chave `metrica_lider`
  -- chegaria antes dela dizendo "linha sem caderno", que é a acusação errada.
  select string_agg(format('%s (%s)', idx - 1, jsonb_typeof(e)), ', ') into v_fora
    from jsonb_array_elements(p_linhas) with ordinality as t(e, idx)
   where jsonb_typeof(e) <> 'object';
  if v_fora is not null then
    raise exception 'p_linhas tem elemento que não é objeto, na posição %', v_fora;
  end if;

  -- Nulo na ordem vira posição para ninguém: ele passa pela contagem de
  -- duplicatas (dois nulos agrupam), reserva um lugar e some no `array_position`.
  -- Por isso vem ANTES da duplicata.
  if exists (select 1 from unnest(p_ordem) as c where c is null) then
    raise exception 'a ordem tem elemento nulo: %', p_ordem;
  end if;

  if exists (select 1 from unnest(p_ordem) as c group by c having count(*) > 1) then
    raise exception 'caderno repetido na ordem: %', p_ordem;
  end if;

  -- Caderno fora do catálogo, pelo mesmo motivo do tipo acima: numa permutação
  -- pura o CHECK de `caderno` não é tocado, e `array['lua']` caía na mensagem de
  -- contagem — a mesma que o cenário usa como prova de isolamento entre donos.
  -- Duas causas muito diferentes chegando pela mesma frase é como uma prova
  -- passa por motivo nenhum.
  select string_agg(c, ', ') into v_fora
    from unnest(p_ordem) as c
   where c not in ('sono', 'movimento', 'coracao', 'rotina');
  if v_fora is not null then
    raise exception
      'caderno fora do catálogo na ordem: % — os quatro são sono, movimento, coracao e rotina',
      v_fora;
  end if;

  -- O mesmo caderno duas vezes em `p_linhas` faz o `insert … on conflict` morrer
  -- com "cannot affect row a second time", que não diz qual caderno nem por quê.
  select string_agg(d.caderno, ', ')
    into v_fora
    from (
      select l.caderno
        from jsonb_to_recordset(p_linhas) as l(caderno text)
       group by l.caderno
      having count(*) > 1
    ) as d;
  if v_fora is not null then
    raise exception 'caderno repetido em p_linhas: %', v_fora;
  end if;

  -- **Toda linha chega inteira, e o erro diz QUAL campo falta.**
  --
  -- `not null` cru diria "null value in column X" sem dizer de que caderno — e,
  -- no caso de `agg_version_no_momento`, diria a coisa errada sobre a coisa
  -- certa. Essa coluna é a exceção nomeada da gramática de ausência (AD-16): ela
  -- chegou a produção nula em todas as 7 linhas porque era opcional numa fila de
  -- passagens, e aqui ela volta a ser passada de fora. A guarda é o que impede a
  -- mesma história de recomeçar por este lado — e quem chama tem de ler a
  -- constante `AGG_VERSION`, nunca inventar o número.
  --
  -- Caderno nulo entra aqui de propósito: sem ele, o `string_agg` da ordem o
  -- pularia e a guarda ficaria muda sobre a única linha que está errada.
  select string_agg(x.queixa, ' · ')
    into v_fora
    from (
      select coalesce('caderno ' || l.caderno, 'linha sem caderno') || ': '
             || array_to_string(array_remove(array[
                  case when l.caderno is null then 'caderno nulo' end,
                  case when l.caderno is not null and array_position(p_ordem, l.caderno) is null
                       then 'fora da ordem' end,
                  case when l.texto is null then 'sem texto' end,
                  case when l.provedor is null then 'sem provedor' end,
                  case when l.modelo is null then 'sem modelo' end,
                  case when l.prompt_versao is null then 'sem prompt_versao' end,
                  case when l.pacote_versao is null then 'sem pacote_versao' end,
                  case when l.motivo_de_parada is null then 'sem motivo_de_parada' end,
                  case when l.tokens_entrada is null then 'sem tokens_entrada' end,
                  case when l.tokens_saida is null then 'sem tokens_saida' end,
                  case when l.agg_version_no_momento is null
                       then 'sem agg_version_no_momento (leia AGG_VERSION do núcleo)' end
                ], null), ', ') as queixa
        from jsonb_to_recordset(p_linhas) as l(
          caderno text, texto text, provedor text, modelo text,
          prompt_versao integer, pacote_versao integer, motivo_de_parada text,
          tokens_entrada integer, tokens_saida integer,
          agg_version_no_momento integer, metrica_lider text
        )
       where l.caderno is null
          or array_position(p_ordem, l.caderno) is null
          or l.texto is null or l.provedor is null or l.modelo is null
          or l.prompt_versao is null or l.pacote_versao is null
          or l.motivo_de_parada is null or l.tokens_entrada is null
          or l.tokens_saida is null or l.agg_version_no_momento is null
    ) as x;
  if v_fora is not null then
    raise exception 'linha recusada — %', v_fora;
  end if;

  -- **A chave tem de estar PRESENTE, mesmo valendo nulo.**
  --
  -- `jsonb_to_recordset` devolve nulo tanto para `"metrica_lider": null` quanto
  -- para a chave que não veio, e as duas coisas são opostas: a primeira é a
  -- declaração "nenhuma métrica liderou" (caderno de lápide), a segunda é
  -- esquecimento. Deixá-las iguais é a mesma história que `agg_version_no_momento`
  -- já contou uma vez, com o nulo chegando a produção em todas as linhas.
  select string_agg(coalesce('caderno ' || (e->>'caderno'), 'linha sem caderno'), ', ')
    into v_fora
    from jsonb_array_elements(p_linhas) as e
   where not (e ? 'metrica_lider');
  if v_fora is not null then
    raise exception
      'linha sem a chave metrica_lider — %. Nulo é declaração e precisa ser escrito; chave ausente é esquecimento.',
      v_fora;
  end if;

  -- O que saiu do conjunto some.
  delete from public.edicoes_ia e
   where e.user_id = v_user
     and e.tipo_periodo = p_tipo_periodo
     and e.inicio = p_inicio
     and e.fim = p_fim
     and not (e.caderno = any (p_ordem));

  -- Os regenerados: texto e assinatura novos. `agg_version_no_momento` e
  -- `metrica_lider` vêm da chamada porque quem os conhece é quem imprimiu —
  -- o nulo de `metrica_lider` é declarado, não omitido.
  insert into public.edicoes_ia (
    user_id, tipo_periodo, inicio, fim, caderno, posicao, texto,
    provedor, modelo, prompt_versao, pacote_versao, motivo_de_parada,
    tokens_entrada, tokens_saida, agg_version_no_momento, metrica_lider, gerado_em
  )
  select
    v_user, p_tipo_periodo, p_inicio, p_fim, l.caderno,
    array_position(p_ordem, l.caderno)::smallint, l.texto,
    l.provedor, l.modelo, l.prompt_versao, l.pacote_versao, l.motivo_de_parada,
    -- Sem `coalesce`: zero é uma MEDIDA — uma chamada que não gastou entrada —, e
    -- inventá-lo para um nulo é exatamente a confusão que a gramática de ausência
    -- proíbe. Nulo aqui já foi recusado pela guarda acima, com nome.
    l.tokens_entrada, l.tokens_saida,
    l.agg_version_no_momento, l.metrica_lider, now()
  from jsonb_to_recordset(p_linhas) as l(
    caderno text, texto text, provedor text, modelo text,
    prompt_versao integer, pacote_versao integer, motivo_de_parada text,
    tokens_entrada integer, tokens_saida integer,
    agg_version_no_momento integer, metrica_lider text
  )
  on conflict (user_id, tipo_periodo, inicio, fim, caderno) do update
    set posicao                = excluded.posicao,
        texto                  = excluded.texto,
        provedor               = excluded.provedor,
        modelo                 = excluded.modelo,
        prompt_versao          = excluded.prompt_versao,
        pacote_versao          = excluded.pacote_versao,
        motivo_de_parada       = excluded.motivo_de_parada,
        tokens_entrada         = excluded.tokens_entrada,
        tokens_saida           = excluded.tokens_saida,
        agg_version_no_momento = excluded.agg_version_no_momento,
        metrica_lider          = excluded.metrica_lider,
        gerado_em              = excluded.gerado_em;

  -- Os que ficaram: SÓ a posição muda. É aqui que a permutação acontece, e é por
  -- ela que a unique é deferida.
  update public.edicoes_ia e
     set posicao = array_position(p_ordem, e.caderno)::smallint
   where e.user_id = v_user
     and e.tipo_periodo = p_tipo_periodo
     and e.inicio = p_inicio
     and e.fim = p_fim
     and e.posicao is distinct from array_position(p_ordem, e.caderno)::smallint;

  -- Nenhuma posição reservada sem texto: todo caderno da ordem tem linha. Falha
  -- aqui é chamada que mandou ordenar um caderno que ela não regenerou e que
  -- nunca existiu.
  select count(*) into v_tem
    from public.edicoes_ia e
   where e.user_id = v_user
     and e.tipo_periodo = p_tipo_periodo
     and e.inicio = p_inicio
     and e.fim = p_fim;
  if v_tem <> v_n then
    raise exception 'a ordem tem % cadernos e a edição gravou % linhas — caderno na ordem sem texto', v_n, v_tem;
  end if;

  -- **A unique deferida é cobrada AQUI, e não no COMMIT.**
  --
  -- Ela nasce deferida porque a permutação precisa passar por um instante ilegal.
  -- Mas deixá-la deferida até o fim joga a violação para fora do ponto de chamada:
  -- o erro chega no `commit`, sem período, sem caderno e sem pilha de quem
  -- imprimiu. Forçar `immediate` cobra a invariante com o contexto de quem a
  -- quebrou; voltar a `deferred` devolve a transação ao estado em que a achou, o
  -- que importa para quem imprime duas edições na mesma transação.
  set constraints public.edicoes_ia_posicao_unica immediate;
  set constraints public.edicoes_ia_posicao_unica deferred;

  return query
    select e.*
      from public.edicoes_ia e
     where e.user_id = v_user
       and e.tipo_periodo = p_tipo_periodo
       and e.inicio = p_inicio
       and e.fim = p_fim
     order by e.posicao;
end;
$fn$;

comment on function public.edicao_imprimir(text, date, date, text[], jsonb) is
  'Imprime uma edição numa chamada: grava o texto só dos regenerados, ajusta a posição de todos e apaga o caderno que saiu (AD-4).';

-- Função nova no `public` nasce com EXECUTE para PUBLIC (padrão do Postgres) e
-- para `anon` (padrão de privilégio desta instância). As duas coisas juntas
-- deixam a única defesa desta função ser o `raise` de sessão lá dentro — uma
-- linha de plpgsql como fronteira de autorização. Aqui ela deixa de ser a única:
-- quem não está autenticado não alcança a função.
--
-- `authenticated` mantém o EXECUTE, que é quem a chama; a RLS de `edicoes_ia`
-- continua decidindo o que cada dono vê e escreve.
revoke execute on function public.edicao_imprimir(text, date, date, text[], jsonb)
  from public, anon;
