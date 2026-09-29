-- Cenário: `lua_execucoes` cobra no banco o que os quatro documentos prometem.
-- Story 4.2b · roda pelo `ensaiar.sh`, e por isso é SQL, não transcrito.
--
-- ## Por que ele existe
--
-- O `ensaiar.sh` prova que a migração aplica, que falha limpo e o que ela muda no
-- catálogo. Ele **não** prova que as regras estão certas — e aqui as regras são a
-- coisa toda: o `constraint trigger` do "quatro ou nenhuma" (§9 de 28/09), as
-- policies por verbo que fazem o `acumula, nunca substitui` (§7.2) ser propriedade
-- do banco em vez de disciplina do chamador, e dezessete `constraint … check`
-- nomeadas que só existem em texto SQL.
--
-- Medido em 29/09/2026, antes deste arquivo: apagar o bloco inteiro do `create
-- constraint trigger`, ou o `enable row level security`, ou qualquer CHECK nomeado
-- deixava as suítes do núcleo **verdes**. `architecture.test.ts` passou a cobrar o
-- texto da migração; este cenário é o outro lado — ele cobra o **comportamento**,
-- num Postgres de verdade, e é a única prova que o gatilho pode ter.
--
-- ## Como rodar
--
-- O `ensaiar.sh` recusa candidata sobre um banco que já saiu da base, então o
-- cenário não roda como segunda aplicação: ele é **concatenado** à migração e
-- aplicado como uma coisa só, que é também como produção receberia as duas.
--
--   supabase/ensaio/subir.sh
--   supabase/ensaio/preparar.sh
--   cat supabase/migrations/20260928130000_lua_execucoes.sql \
--       supabase/ensaio/cenarios/lua-execucoes.sql > "$TMPDIR/candidata-com-cenario.sql"
--   supabase/ensaio/ensaiar.sh "$TMPDIR/candidata-com-cenario.sql"
--
-- **Sem `--falhar-no-fim`, e isso importa.** Com a falha provocada, uma asserção
-- que disparasse aqui produziria o mesmo desfecho que o sucesso — tudo falha, tudo
-- volta, veredito verde. Sem ela, asserção que dispara é aplicação que falha, e o
-- ensaio diz isso em letras grandes.
--
-- ## E DEPOIS que a migração estiver em produção
--
-- A candidata concatenada **não é reaplicável**: `create table lua_execucoes` não
-- tem `if not exists`, de propósito. Rodar este cenário de novo, a partir daí, é
-- aplicá-lo **sozinho** — a base que o `preparar.sh` monta já traz a migração:
--
--   supabase/ensaio/preparar.sh
--   supabase/ensaio/ensaiar.sh supabase/ensaio/cenarios/lua-execucoes.sql
--
-- ## O que ele deixa para trás
--
-- Nada. Todas as linhas dele têm `pedido_desde = '2999-01-01'` — um alcance que
-- produção nunca vai pedir —, o bloco final apaga por esse filtro e confere que a
-- tabela voltou ao que era. Um `delete` sem filtro conviveria com a tabela vazia de
-- hoje e apagaria o acervo no dia em que a primeira execução autorizada rodar.
--
-- Sem `begin`/`commit`: o arquivo inteiro já é uma transação implícita, e controle
-- explícito partiria a candidata em várias — o que a varredura recusa.

-- O dono do ensaio, lido antes de descer para `authenticated` (que não enxerga
-- `auth.users`). O gatilho é `security invoker`: rodar como `postgres` passaria por
-- cima da RLS e mediria menos do que parece — e é justamente a policy de `select`
-- que sustenta a contagem do gatilho.
select set_config('orbe.cenario_user',
                  (select id::text from auth.users order by created_at limit 1), true);
select set_config('request.jwt.claims',
                  json_build_object('sub', current_setting('orbe.cenario_user'),
                                    'role', 'authenticated')::text, true);
set local role authenticated;

do $cenario$
declare
  v_dono      uuid;
  v_id        uuid;
  v_n         integer;
  v_msg       text;
  v_constraint text;
  v_sqlstate  text;
  v_base      jsonb;
  v_linhas    jsonb;
  v_caso      jsonb;
  v_casos     jsonb;
  v_distintos integer;
  v_fases     text[] := array['new', 'firstQuarter', 'full', 'lastQuarter'];
  v_fase      text;
  v_i         integer;
  -- O alcance que produção nunca vai pedir. É por ele que o bloco final apaga.
  v_marca     constant date := '2999-01-01';
begin
  v_dono := current_setting('orbe.cenario_user')::uuid;

  -- A linha-base é uma execução **reprovada no portão da luz**: é o desfecho com
  -- mais nulos, e por isso o que mais exercita a gramática de ausência. Os números
  -- são coerentes entre si de propósito — 70 + 330 = 400 = acervo_noites, 14 ciclos
  -- dentro de 70 noites —, porque três CHECKs diferentes cobram essa aritmética.
  v_base := jsonb_build_object(
    'user_id', v_dono,
    'rodada_em', '2999-01-15T12:00:00Z',
    'cadeia', jsonb_build_array(
      jsonb_build_object('arquivo', 'a.md', 'sha256', repeat('a', 64)),
      jsonb_build_object('arquivo', 'b.md', 'sha256', repeat('b', 64)),
      jsonb_build_object('arquivo', 'c.md', 'sha256', repeat('c', 64)),
      jsonb_build_object('arquivo', 'd.md', 'sha256', repeat('d', 64))),
    'cadeia_digest', repeat('e', 64),
    'janela_noites', 5,
    'hora_utc_do_fim_da_noite', 8,
    'borda_direita', 'aberta',
    'motor_versao', 1,
    'pedido_desde', v_marca,
    'acervo_noites', 400,
    'acervo_noites_distintas', 400,
    'acervo_noites_colapsadas', 0,
    'acervo_de', v_marca,
    'acervo_ate', '2999-12-31',
    'acervo_sd_min', 15.86,
    'acervo_origem_do_eixo_h', 18,
    'acervo_noites_sem_luz', 1,
    'acervo_primeira_noite_sem_luz', '2999-01-08',
    'veredito', 'inconclusivo',
    'motivo', 'luz',
    'portao_reprovado', 'luz',
    'efeito_min', null,
    'p', null,
    'z_de_mann_whitney', null,
    'poder', null,
    'efeito_minimo_detectavel_min', null,
    'noites_dentro', 70,
    'noites_fora', 330,
    'ciclos', 14,
    'falta_quanto', 1,
    'falta_unidade', 'noites-sem-luz',
    'noites_para_80', null);

  -- ── A. `deferrable initially deferred` é o que torna a regra cobrável ───────
  --
  -- As quatro linhas chegam em DUAS statements. Com a constraint imediata, a
  -- primeira já violaria a contagem e a escrita inteira ficaria impossível — é o
  -- mesmo mecanismo que a 1.9 usou para permutar posições, pelo mesmo motivo: a
  -- invariante vale no fim da transação, não no meio dela.
  --
  -- E é aqui que o `default` do `execucao_id` se prova: nenhuma das duas statements
  -- manda o id, e as quatro linhas saem com o MESMO valor, porque `auth.uid()`,
  -- `txid_current()` e `now()` são constantes na transação.
  insert into public.lua_execucoes
  select * from jsonb_populate_recordset(null::public.lua_execucoes,
    jsonb_build_array(v_base || jsonb_build_object('fase', 'new', 'familia', 'as-tres',
                        'alfa', 0.05/3, 'lateralidade', 'bilateral', 'direcao', null),
                      v_base || jsonb_build_object('fase', 'full', 'familia', 'cheia',
                        'alfa', 0.05, 'lateralidade', 'unilateral', 'direcao', 'atraso')));

  insert into public.lua_execucoes
  select * from jsonb_populate_recordset(null::public.lua_execucoes,
    jsonb_build_array(v_base || jsonb_build_object('fase', 'firstQuarter', 'familia', 'as-tres',
                        'alfa', 0.05/3, 'lateralidade', 'bilateral', 'direcao', null),
                      v_base || jsonb_build_object('fase', 'lastQuarter', 'familia', 'as-tres',
                        'alfa', 0.05/3, 'lateralidade', 'bilateral', 'direcao', null)));

  select count(*), count(distinct execucao_id), count(distinct rodada_em)
    into v_n, v_i, v_distintos
    from public.lua_execucoes where pedido_desde = v_marca;
  if v_n <> 4 then
    raise exception 'A: entraram % linhas, e eram 4', v_n;
  end if;
  if v_i <> 1 then
    raise exception 'A: as quatro linhas ficaram com % execucao_id distintos — o default não é constante na transação', v_i;
  end if;
  if v_distintos <> 1 then
    raise exception 'A: as quatro linhas ficaram com % rodada_em distintos', v_distintos;
  end if;

  -- O commit, antecipado: é aqui que o gatilho é cobrado, e as quatro estão lá.
  set constraints public.lua_execucoes_quatro_ou_nenhuma immediate;

  select execucao_id into v_id from public.lua_execucoes where pedido_desde = v_marca limit 1;

  -- ── B. TRÊS linhas não fecham uma execução ─────────────────────────────────
  --
  -- Com a constraint imediata, um gatilho AFTER ROW é cobrado no fim da STATEMENT,
  -- e não linha a linha — então um `insert` de quatro passa e um de três não. É a
  -- §9 deixando de ser disciplina.
  begin
    v_id := gen_random_uuid();
    insert into public.lua_execucoes
    select * from jsonb_populate_recordset(null::public.lua_execucoes,
      jsonb_build_array(
        v_base || jsonb_build_object('execucao_id', v_id, 'fase', 'new',
          'familia', 'as-tres', 'alfa', 0.05/3, 'lateralidade', 'bilateral', 'direcao', null),
        v_base || jsonb_build_object('execucao_id', v_id, 'fase', 'firstQuarter',
          'familia', 'as-tres', 'alfa', 0.05/3, 'lateralidade', 'bilateral', 'direcao', null),
        v_base || jsonb_build_object('execucao_id', v_id, 'fase', 'full',
          'familia', 'cheia', 'alfa', 0.05, 'lateralidade', 'unilateral', 'direcao', 'atraso')));
    raise exception 'B: uma execução de TRÊS fases foi aceita';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg not like '%QUATRO fases ou nenhuma%' then raise; end if;
  end;
  set constraints public.lua_execucoes_quatro_ou_nenhuma immediate;

  select count(*) into v_n from public.lua_execucoes where pedido_desde = v_marca;
  if v_n <> 4 then
    raise exception 'B: a escrita de três fases deixou % linhas para trás', v_n;
  end if;

  -- ── C. Quatro numa statement só passam, e a segunda execução ACUMULA ───────
  v_id := gen_random_uuid();
  v_linhas := '[]'::jsonb;
  for v_i in 1 .. 4 loop
    v_fase := v_fases[v_i];
    v_linhas := v_linhas || jsonb_build_array(
      v_base || jsonb_build_object(
        'execucao_id', v_id, 'fase', v_fase,
        'familia', case when v_fase = 'full' then 'cheia' else 'as-tres' end,
        'alfa', case when v_fase = 'full' then 0.05 else 0.05/3 end,
        'lateralidade', case when v_fase = 'full' then 'unilateral' else 'bilateral' end,
        'direcao', case when v_fase = 'full' then 'atraso' else null end));
  end loop;
  insert into public.lua_execucoes
  select * from jsonb_populate_recordset(null::public.lua_execucoes, v_linhas);

  select count(*), count(distinct execucao_id) into v_n, v_i
    from public.lua_execucoes where pedido_desde = v_marca;
  if v_n <> 8 or v_i <> 2 then
    raise exception 'C: a segunda execução não ACUMULOU — % linhas em % execuções', v_n, v_i;
  end if;

  -- ── D. As policies por verbo: o dono lê e grava, e não muda nem apaga ──────
  --
  -- Sem `for update` e sem `for delete`, a RLS não recusa com erro: ela **não
  -- enxerga linha nenhuma** para mudar ou apagar, e o comando afeta zero linhas. É
  -- o que fecha a gaveta pela API — tirar uma execução passa a exigir o dono agindo
  -- como superusuário, de propósito (é o que o bloco G faz).
  update public.lua_execucoes set veredito = 'achado'
   where pedido_desde = v_marca and execucao_id = v_id;
  get diagnostics v_n = row_count;
  if v_n <> 0 then
    raise exception 'D: o UPDATE afetou % linhas — existe policy de update, e um veredito gravado pode ser reescrito no lugar', v_n;
  end if;

  delete from public.lua_execucoes where pedido_desde = v_marca and execucao_id = v_id;
  get diagnostics v_n = row_count;
  if v_n <> 0 then
    raise exception 'D: o DELETE afetou % linhas — existe policy de delete, e a execução some pela API sem deixar rastro de ter sumido', v_n;
  end if;

  select count(*) into v_n from public.lua_execucoes where pedido_desde = v_marca;
  if v_n <> 8 then
    raise exception 'D: sobraram % linhas depois do update e do delete recusados', v_n;
  end if;

  -- ── E. Os CHECKs, um por um, pelo NOME: 17 nomeados + 2 de coluna ──────────
  --
  -- Cada caso muda UM campo da primeira das quatro linhas e espera a constraint
  -- nomeada que corresponde. Conferir o nome, e não a mensagem, é o que impede que
  -- um caso passe por violar outra coisa: `constraint_name` sai do diagnóstico do
  -- Postgres, não da nossa leitura.
  v_casos := jsonb_build_array(
    jsonb_build_object('nome', 'falta_tem_numero_e_unidade',
      'patch', jsonb_build_object('falta_unidade', null)),
    jsonb_build_object('nome', 'unidade_bate_com_o_motivo',
      'patch', jsonb_build_object('falta_unidade', 'ciclos')),
    jsonb_build_object('nome', 'motivo_existe_quando_inconclusivo',
      'patch', jsonb_build_object('motivo', null, 'portao_reprovado', null,
                                  'falta_quanto', null, 'falta_unidade', null)),
    jsonb_build_object('nome', 'portao_e_o_proprio_motivo',
      'patch', jsonb_build_object('portao_reprovado', 'amostra')),
    jsonb_build_object('nome', 'portao_reprovado_nao_mede',
      'patch', jsonb_build_object('efeito_min', -3.0)),
    jsonb_build_object('nome', 'medida_existe_quando_ha_veredito',
      'patch', jsonb_build_object('veredito', 'nenhum_padrao', 'motivo', null,
                                  'portao_reprovado', null, 'falta_quanto', null,
                                  'falta_unidade', null)),
    -- O achado sem poder: a forma exata da gaveta que o protocolo existe para fechar.
    jsonb_build_object('nome', 'veredito_decidido_passou_no_poder',
      'patch', jsonb_build_object('veredito', 'achado', 'motivo', null,
                                  'portao_reprovado', null, 'falta_quanto', null,
                                  'falta_unidade', null, 'efeito_min', 20.0, 'p', 0.01,
                                  'z_de_mann_whitney', 2.5, 'poder', 0.5,
                                  'efeito_minimo_detectavel_min', 10.0, 'noites_para_80', 500)),
    jsonb_build_object('nome', 'poder_fraco_e_o_motivo_poder',
      'patch', jsonb_build_object('motivo', 'poder', 'portao_reprovado', null,
                                  'efeito_min', 2.0, 'p', 0.5, 'z_de_mann_whitney', 0.1,
                                  'poder', 0.95, 'efeito_minimo_detectavel_min', 5.0,
                                  'noites_para_80', 100, 'falta_quanto', 10,
                                  'falta_unidade', 'noites-coletaveis')),
    jsonb_build_object('nome', 'ciclos_cabem_nas_noites_dentro',
      'patch', jsonb_build_object('ciclos', 71)),
    -- **O NaN**: `'NaN' >= 0` é VERDADEIRO no Postgres, e um CHECK de piso o deixa
    -- passar calado. Quem o pega é o teto de finitude.
    jsonb_build_object('nome', 'as_medidas_sao_numeros_finitos',
      'patch', jsonb_build_object('acervo_sd_min', 'NaN')),
    jsonb_build_object('nome', 'acervo_intervalo_valido',
      'patch', jsonb_build_object('acervo_ate', '2999-01-01', 'acervo_de', '2999-06-01')),
    jsonb_build_object('nome', 'acervo_vazio_nao_tem_intervalo',
      'patch', jsonb_build_object('acervo_de', null, 'acervo_ate', null)),
    jsonb_build_object('nome', 'acervo_colapsado_cabe_no_acervo',
      'patch', jsonb_build_object('acervo_noites_colapsadas', 401)),
    jsonb_build_object('nome', 'acervo_comeca_depois_do_pedido',
      'patch', jsonb_build_object('acervo_de', '2998-01-01', 'acervo_ate', '2999-12-31')),
    jsonb_build_object('nome', 'acervo_nao_tem_noite_repetida',
      'patch', jsonb_build_object('acervo_noites_distintas', 399)),
    jsonb_build_object('nome', 'primeira_sem_luz_bate_com_a_contagem',
      'patch', jsonb_build_object('acervo_primeira_noite_sem_luz', null)),
    jsonb_build_object('nome', 'colunas_cabem_no_acervo',
      'patch', jsonb_build_object('noites_fora', 331)),
    -- Os dois CHECKs de coluna que a revisão apontou, com o nome que o Postgres dá.
    jsonb_build_object('nome', 'lua_execucoes_janela_noites_check',
      'patch', jsonb_build_object('janela_noites', 31)),
    -- **A cadeia que não é lista.** Com `and`, o planejador pode avaliar
    -- `jsonb_array_length` antes do `jsonb_typeof` e levantar 22023 CRU, sem nome de
    -- constraint. O `case` é o que garante a ordem — e é isso que este caso mede.
    jsonb_build_object('nome', 'lua_execucoes_cadeia_check',
      'patch', jsonb_build_object('cadeia', jsonb_build_object('arquivo', 'a.md')))
  );

  for v_i in 0 .. jsonb_array_length(v_casos) - 1 loop
    v_caso := v_casos -> v_i;
    begin
      v_id := gen_random_uuid();
      v_linhas := jsonb_build_array(
        v_base || jsonb_build_object('execucao_id', v_id, 'fase', 'new', 'familia', 'as-tres',
          'alfa', 0.05/3, 'lateralidade', 'bilateral', 'direcao', null)
                || (v_caso -> 'patch'),
        v_base || jsonb_build_object('execucao_id', v_id, 'fase', 'firstQuarter', 'familia', 'as-tres',
          'alfa', 0.05/3, 'lateralidade', 'bilateral', 'direcao', null),
        v_base || jsonb_build_object('execucao_id', v_id, 'fase', 'full', 'familia', 'cheia',
          'alfa', 0.05, 'lateralidade', 'unilateral', 'direcao', 'atraso'),
        v_base || jsonb_build_object('execucao_id', v_id, 'fase', 'lastQuarter', 'familia', 'as-tres',
          'alfa', 0.05/3, 'lateralidade', 'bilateral', 'direcao', null));
      insert into public.lua_execucoes
      select * from jsonb_populate_recordset(null::public.lua_execucoes, v_linhas);
      raise exception 'E[%]: a linha que viola % foi ACEITA', v_i, v_caso ->> 'nome';
    exception when others then
      get stacked diagnostics v_msg = message_text,
                              v_constraint = constraint_name,
                              v_sqlstate = returned_sqlstate;
      if v_msg like 'E[%' then raise; end if;
      if v_sqlstate <> '23514' then
        raise exception 'E[%]: % devia violar um CHECK (23514) e o Postgres devolveu % — %',
          v_i, v_caso ->> 'nome', v_sqlstate, v_msg;
      end if;
      if v_constraint is distinct from (v_caso ->> 'nome') then
        raise exception 'E[%]: esperava a constraint % e disparou % — o caso viola outra coisa',
          v_i, v_caso ->> 'nome', coalesce(v_constraint, '(sem nome)');
      end if;
    end;
    set constraints public.lua_execucoes_quatro_ou_nenhuma immediate;
  end loop;

  -- ── F. E o caminho feliz continua feliz depois de tudo isso ────────────────
  select count(*) into v_n from public.lua_execucoes where pedido_desde = v_marca;
  if v_n <> 8 then
    raise exception 'F: depois dos CHECKs sobraram % linhas, e eram 8 — algum caso deixou linha para trás', v_n;
  end if;

  raise notice 'cenário lua_execucoes: A–F verdes (% casos de CHECK, todos pelo nome)',
    jsonb_array_length(v_casos);
end
$cenario$;

-- ── G. O delete que sobra: superusuário, e só a execução INTEIRA ─────────────
--
-- A policy fechou a porta da API, então o único desfazer que existe é este — e ele
-- também obedece à §9. É `postgres` porque a RLS não vale para superusuário: é o
-- caminho que sobra, de propósito, e o gatilho é o que garante que ele não mutile.
reset role;

do $desfazer$
declare
  v_id  uuid;
  v_n   integer;
  v_msg text;
begin
  set constraints public.lua_execucoes_quatro_ou_nenhuma immediate;

  select execucao_id into v_id
    from public.lua_execucoes where pedido_desde = '2999-01-01' limit 1;
  if v_id is null then
    raise exception 'G: o cenário anterior não deixou linha nenhuma para apagar';
  end if;

  -- Três de quatro não é desfazer, é mutilar.
  begin
    delete from public.lua_execucoes
     where pedido_desde = '2999-01-01' and execucao_id = v_id and fase <> 'new';
    raise exception 'G: o delete PARCIAL foi aceito — a execução ficaria publicando uma fase';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg not like '%QUATRO fases ou nenhuma%' then raise; end if;
  end;
  set constraints public.lua_execucoes_quatro_ou_nenhuma immediate;

  select count(*) into v_n
    from public.lua_execucoes where pedido_desde = '2999-01-01' and execucao_id = v_id;
  if v_n <> 4 then
    raise exception 'G: o delete parcial recusado deixou % linhas', v_n;
  end if;

  -- A execução inteira sai.
  delete from public.lua_execucoes where pedido_desde = '2999-01-01' and execucao_id = v_id;
  get diagnostics v_n = row_count;
  if v_n <> 4 then
    raise exception 'G: o delete da execução inteira apagou % linhas', v_n;
  end if;

  -- ── H. O cenário não deixa rastro ──────────────────────────────────────────
  delete from public.lua_execucoes where pedido_desde = '2999-01-01';
  select count(*) into v_n from public.lua_execucoes where pedido_desde = '2999-01-01';
  if v_n <> 0 then
    raise exception 'H: o cenário deixou % linhas para trás', v_n;
  end if;

  raise notice 'cenário lua_execucoes: G–H verdes, e a tabela voltou ao que era';
end
$desfazer$;
