-- Cenário: a função `edicao_imprimir` faz o que a AD-4 promete.
-- Story 1.9 · roda pelo `ensaiar.sh`, e por isso é SQL, não transcrito.
--
-- ## Por que ele existe
--
-- O `ensaiar.sh` prova que a migração aplica, que falha limpo e o que ela muda no
-- catálogo. Ele **não** prova que a função está certa — e a função é a peça que
-- carrega a invariante mais fácil de quebrar em silêncio: posições contíguas de
-- 1 a N. Um `create or replace` futuro que derrubasse a guarda de contiguidade
-- passaria por todo o ensaio sem acusar nada.
--
-- ## Como rodar
--
-- O `ensaiar.sh` recusa candidata sobre um banco que já saiu da base (é a guarda
-- que impede ensaiar em cima de outra candidata), então o cenário não roda como
-- segunda aplicação: ele é **concatenado** à migração e aplicado como uma coisa
-- só, que é também como produção receberia as duas.
--
--   supabase/ensaio/subir.sh
--   supabase/ensaio/preparar.sh
--   cat supabase/migrations/20260912120000_edicao_por_caderno.sql \
--       supabase/ensaio/cenarios/edicao-imprimir.sql > "$TMPDIR/candidata-com-cenario.sql"
--   supabase/ensaio/ensaiar.sh "$TMPDIR/candidata-com-cenario.sql"
--
-- **Sem `--falhar-no-fim`, e isso importa.** Com a falha provocada, uma asserção
-- que disparasse aqui produziria o mesmo desfecho que o sucesso — tudo falha,
-- tudo volta, veredito verde. Sem ela, asserção que dispara é aplicação que
-- falha, e o ensaio diz isso em letras grandes.
--
-- ## E DEPOIS que a migração estiver em produção
--
-- A candidata concatenada **não é reaplicável**: a guarda das sete edições exige
-- achar sete (e produção passa a ter zero), e `create table edicoes_capa` não
-- tem `if not exists`, de propósito. Rodar este cenário de novo, a partir daí, é
-- aplicá-lo **sozinho** — a base que o `preparar.sh` monta já traz a migração
-- registrada, e com ela a função:
--
--   supabase/ensaio/preparar.sh
--   supabase/ensaio/ensaiar.sh supabase/ensaio/cenarios/edicao-imprimir.sql
--
-- É o que mantém repetível a única prova que a `edicao_imprimir` tem. (Foi para
-- não fechar essa porta que o `preparar.sh` passou a AVISAR, em vez de abortar,
-- quando produção não tem edição nenhuma.)
--
-- ## O que ele deixa para trás
--
-- Nada. O cenário apaga as próprias linhas no fim e confere que a tabela ficou
-- vazia, de modo que o retrato depois é idêntico ao da migração sozinha. Quem
-- quiser ver que ele rodou olha a contagem de marcas de comando.
--
-- Sem `begin`/`commit`: o arquivo inteiro já é uma transação implícita, e
-- controle explícito partiria a candidata em várias — o que a varredura recusa.

-- O dono do ensaio, lido antes de descer para `authenticated` (que não enxerga
-- `auth.users`). A função é `security invoker`: rodar como `postgres` passaria
-- por cima da RLS e mediria menos do que parece.
select set_config('orbe.cenario_user',
                  (select id::text from auth.users order by created_at limit 1), true);
select set_config('request.jwt.claims',
                  json_build_object('sub', current_setting('orbe.cenario_user'),
                                    'role', 'authenticated')::text, true);
set local role authenticated;

do $cenario$
declare
  v_linha  jsonb;
  v_linhas jsonb;
  v_cadernos text[];
  v_posicoes smallint[];
  v_modelos text[];
  v_n integer;
  v_msg text;
  v_dono text;
  -- Um dono que não existe em `auth.users`, e não precisa existir: a outra
  -- sessão nunca chega a inserir linha nenhuma — é isso que se está medindo.
  v_outro constant text := '00000000-0000-0000-0000-0000000000b2';
  -- **Um período que produção nunca vai usar.**
  --
  -- O cenário operava sobre agosto de 2026 e contava a tabela inteira. Isso só é
  -- verdade enquanto `edicoes_ia` estiver vazia — e deixa de ser no minuto em que
  -- a 1.10 imprimir a primeira edição: daí em diante o cenário reprovaria por
  -- contagem alheia, ou pior, o `delete` final apagaria dado carregado de
  -- produção. Com período próprio e filtro por dono, ele convive com o arquivo.
  v_ini constant date := '2999-01-01';
  v_fim constant date := '2999-01-31';
begin
  v_dono := current_setting('orbe.cenario_user');
  -- ── A. primeira impressão: quatro cadernos, posições 1 a 4 ──────────────
  v_linhas := jsonb_build_array(
    jsonb_build_object('caderno','movimento','texto','Movimento de agosto.','provedor','p','modelo','m1',
                       'prompt_versao',3,'pacote_versao',3,'motivo_de_parada','STOP',
                       'tokens_entrada',10,'tokens_saida',20,'agg_version_no_momento',9,'metrica_lider','distancia'),
    jsonb_build_object('caderno','sono','texto','Sono de agosto.','provedor','p','modelo','m1',
                       'prompt_versao',3,'pacote_versao',3,'motivo_de_parada','STOP',
                       'tokens_entrada',10,'tokens_saida',20,'agg_version_no_momento',9,'metrica_lider','duracao'),
    jsonb_build_object('caderno','coracao','texto','Coracao de agosto.','provedor','p','modelo','m1',
                       'prompt_versao',3,'pacote_versao',3,'motivo_de_parada','STOP',
                       'tokens_entrada',10,'tokens_saida',20,'agg_version_no_momento',9,'metrica_lider',null),
    jsonb_build_object('caderno','rotina','texto','Rotina de agosto.','provedor','p','modelo','m1',
                       'prompt_versao',3,'pacote_versao',3,'motivo_de_parada','STOP',
                       'tokens_entrada',10,'tokens_saida',20,'agg_version_no_momento',9,'metrica_lider','tarefas')
  );

  select array_agg(caderno order by posicao), array_agg(posicao order by posicao)
    into v_cadernos, v_posicoes
    from public.edicao_imprimir('month', v_ini, v_fim,
           array['movimento','sono','coracao','rotina'], v_linhas);

  if v_cadernos <> array['movimento','sono','coracao','rotina']::text[] then
    raise exception 'A: a ordem gravada foi %, e a pedida era movimento,sono,coracao,rotina', v_cadernos;
  end if;
  if v_posicoes <> array[1,2,3,4]::smallint[] then
    raise exception 'A: as posições foram %, e deviam ser 1,2,3,4', v_posicoes;
  end if;

  -- `metrica_lider` nulo sobrevive como nulo: é declaração, não omissão.
  if (select metrica_lider from public.edicoes_ia
        where user_id = v_dono::uuid and tipo_periodo = 'month'
          and inicio = v_ini and fim = v_fim and caderno = 'coracao') is not null then
    raise exception 'A: o caderno de lápide gravou métrica líder onde não havia nenhuma';
  end if;

  -- ── B. PERMUTAÇÃO PURA: nada regenerado, ordem invertida ────────────────
  --
  -- É esta chamada que a `unique` deferida existe para permitir: trocar 1 e 4
  -- passa por um instante em que dois cadernos disputam a mesma posição.
  select array_agg(caderno order by posicao), array_agg(modelo order by posicao)
    into v_cadernos, v_modelos
    from public.edicao_imprimir('month', v_ini, v_fim,
           array['rotina','coracao','sono','movimento'], '[]'::jsonb);

  if v_cadernos <> array['rotina','coracao','sono','movimento']::text[] then
    raise exception 'B: a permutação não pegou — ficou %', v_cadernos;
  end if;
  if v_modelos <> array['m1','m1','m1','m1']::text[] then
    raise exception 'B: permutar reassinou os cadernos — modelos ficaram %', v_modelos;
  end if;

  -- ── C. REIMPRESSÃO PARCIAL: três regenerados, rotina sai ────────────────
  v_linhas := jsonb_build_array(
    jsonb_build_object('caderno','coracao','texto','Coracao, segunda tiragem.','provedor','p','modelo','m2',
                       'prompt_versao',3,'pacote_versao',3,'motivo_de_parada','STOP',
                       'tokens_entrada',1,'tokens_saida',2,'agg_version_no_momento',9,'metrica_lider','fc_repouso'),
    jsonb_build_object('caderno','movimento','texto','Movimento, segunda tiragem.','provedor','p','modelo','m2',
                       'prompt_versao',3,'pacote_versao',3,'motivo_de_parada','STOP',
                       'tokens_entrada',1,'tokens_saida',2,'agg_version_no_momento',9,'metrica_lider','distancia'),
    jsonb_build_object('caderno','sono','texto','Sono, segunda tiragem.','provedor','p','modelo','m2',
                       'prompt_versao',3,'pacote_versao',3,'motivo_de_parada','STOP',
                       'tokens_entrada',1,'tokens_saida',2,'agg_version_no_momento',9,'metrica_lider',null)
  );

  perform public.edicao_imprimir('month', v_ini, v_fim,
            array['coracao','movimento','sono'], v_linhas);

  select count(*), array_agg(caderno order by posicao), array_agg(posicao order by posicao)
    into v_n, v_cadernos, v_posicoes
    from public.edicoes_ia
   where user_id = v_dono::uuid and tipo_periodo = 'month' and inicio = v_ini and fim = v_fim;

  if v_n <> 3 then
    raise exception 'C: sobraram % linhas, e a edição passou a ter 3 cadernos', v_n;
  end if;
  if v_posicoes <> array[1,2,3]::smallint[] then
    raise exception 'C: as posições ficaram %, e deviam ser contíguas 1,2,3', v_posicoes;
  end if;
  if exists (select 1 from public.edicoes_ia
               where user_id = v_dono::uuid and tipo_periodo = 'month'
                 and inicio = v_ini and fim = v_fim and caderno = 'rotina') then
    raise exception 'C: o caderno que saiu do conjunto continuou no banco — linha órfã reservando posição';
  end if;

  -- ── D. o parcial de verdade: um regenerado, dois só mudam de lugar ──────
  --
  -- É aqui que mora a razão de a ordem ser recalculada no banco: um
  -- read-modify-write do cliente reassinaria os dois cadernos que ele não
  -- regenerou, trocando modelo e `gerado_em` de textos que outro modelo escreveu.
  v_linha := jsonb_build_object('caderno','sono','texto','Sono, terceira tiragem.','provedor','p','modelo','m3',
                                'prompt_versao',3,'pacote_versao',3,'motivo_de_parada','STOP',
                                'tokens_entrada',1,'tokens_saida',2,'agg_version_no_momento',9,'metrica_lider','regularidade');

  select array_agg(caderno order by posicao), array_agg(modelo order by posicao)
    into v_cadernos, v_modelos
    from public.edicao_imprimir('month', v_ini, v_fim,
           array['sono','coracao','movimento'], jsonb_build_array(v_linha));

  if v_cadernos <> array['sono','coracao','movimento']::text[] then
    raise exception 'D: a ordem ficou %', v_cadernos;
  end if;
  if v_modelos <> array['m3','m2','m2']::text[] then
    raise exception 'D: a reimpressão parcial REASSINOU o que não regenerou — modelos %', v_modelos;
  end if;

  -- ── E. as guardas: cada uma recusa, com mensagem própria ────────────────
  --
  -- Cada bloco captura a exceção e confere a mensagem. Guarda que deixasse de
  -- disparar cairia no `raise` de dentro do `begin`, que é o que reprova.

  begin
    perform public.edicao_imprimir('month', v_ini, v_fim, array[]::text[], '[]'::jsonb);
    raise exception 'E1: ordem vazia foi aceita';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg not like '%sem caderno nenhum na ordem%' then raise; end if;
  end;

  begin
    perform public.edicao_imprimir('month', v_ini, v_fim,
              array['sono', null]::text[], '[]'::jsonb);
    raise exception 'E2: ordem com elemento nulo foi aceita';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg not like '%elemento nulo%' then raise; end if;
  end;

  begin
    perform public.edicao_imprimir('month', v_ini, v_fim,
              array['sono','sono'], '[]'::jsonb);
    raise exception 'E3: caderno repetido na ordem foi aceito';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg not like '%repetido na ordem%' then raise; end if;
  end;

  -- Repetido DENTRO de p_linhas: sem a guarda, o `on conflict` morre com
  -- "cannot affect row a second time", que não diz qual caderno nem por quê.
  begin
    perform public.edicao_imprimir('month', v_ini, v_fim, array['sono'],
              jsonb_build_array(
                jsonb_build_object('caderno','sono','texto','a','provedor','p','modelo','m',
                                   'prompt_versao',3,'pacote_versao',3,'motivo_de_parada','STOP',
                                   'tokens_entrada',0,'tokens_saida',0,'agg_version_no_momento',9,'metrica_lider',null),
                jsonb_build_object('caderno','sono','texto','b','provedor','p','modelo','m',
                                   'prompt_versao',3,'pacote_versao',3,'motivo_de_parada','STOP',
                                   'tokens_entrada',0,'tokens_saida',0,'agg_version_no_momento',9,'metrica_lider',null)));
    raise exception 'E4: caderno repetido em p_linhas foi aceito';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg not like '%repetido em p_linhas%' then raise; end if;
  end;

  -- Caderno nulo em p_linhas: sem a guarda o `string_agg` o pula e a recusa fica
  -- muda sobre a única linha que está errada.
  begin
    perform public.edicao_imprimir('month', v_ini, v_fim, array['sono'],
              jsonb_build_array(
                jsonb_build_object('caderno',null,'texto','a','provedor','p','modelo','m',
                                   'prompt_versao',3,'pacote_versao',3,'motivo_de_parada','STOP',
                                   'tokens_entrada',0,'tokens_saida',0,'agg_version_no_momento',9,'metrica_lider',null)));
    raise exception 'E5: linha com caderno nulo foi aceita';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg not like '%linha sem caderno%' then raise; end if;
  end;

  -- **A versão da agregação é a exceção nomeada da gramática de ausência.** Foi
  -- a omissão dela que deixou as 7 edições de produção inelegíveis a errata; a
  -- recusa aqui é o que impede a história de recomeçar pelo lado do RPC.
  begin
    perform public.edicao_imprimir('month', v_ini, v_fim, array['sono'],
              jsonb_build_array(
                jsonb_build_object('caderno','sono','texto','a','provedor','p','modelo','m',
                                   'prompt_versao',3,'pacote_versao',3,'motivo_de_parada','STOP',
                                   'tokens_entrada',0,'tokens_saida',0,'metrica_lider',null)));
    raise exception 'E6: linha sem agg_version_no_momento foi aceita';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg not like '%sem agg_version_no_momento%' then raise; end if;
  end;

  -- Zero é MEDIDA: uma chamada que não gastou entrada é um fato, e a função não
  -- pode confundi-lo com ausência — nem inventá-lo no lugar dela.
  begin
    perform public.edicao_imprimir('month', v_ini, v_fim, array['sono'],
              jsonb_build_array(
                jsonb_build_object('caderno','sono','texto','a','provedor','p','modelo','m',
                                   'prompt_versao',3,'pacote_versao',3,'motivo_de_parada','STOP',
                                   'tokens_saida',0,'agg_version_no_momento',9,'metrica_lider',null)));
    raise exception 'E7: linha sem tokens_entrada foi aceita (nulo virou zero?)';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg not like '%sem tokens_entrada%' then raise; end if;
  end;

  begin
    perform public.edicao_imprimir('month', v_ini, v_fim, array['sono','rotina'],
              jsonb_build_array(
                jsonb_build_object('caderno','sono','texto','a','provedor','p','modelo','m',
                                   'prompt_versao',3,'pacote_versao',3,'motivo_de_parada','STOP',
                                   'tokens_entrada',0,'tokens_saida',0,'agg_version_no_momento',9,'metrica_lider',null)));
    raise exception 'E8: ordem com caderno sem texto foi aceita — posição reservada sem linha';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg not like '%sem texto%' then raise; end if;
  end;

  -- **Caderno fora do catálogo é recusado na ENTRADA, não pelo CHECK.**
  --
  -- Antes isto caía no `edicoes_ia_caderno_check`, e só porque a chamada tinha
  -- linha para inserir: numa permutação pura o `insert` não acontece e o CHECK
  -- não é tocado, então `array['lua']` morria na mensagem de contagem — a mesma
  -- que o bloco F usa como prova de isolamento.
  begin
    perform public.edicao_imprimir('month', v_ini, v_fim, array['lua'],
              jsonb_build_array(
                jsonb_build_object('caderno','lua','texto','a','provedor','p','modelo','m',
                                   'prompt_versao',3,'pacote_versao',3,'motivo_de_parada','STOP',
                                   'tokens_entrada',0,'tokens_saida',0,'agg_version_no_momento',9,'metrica_lider',null)));
    raise exception 'E9: caderno fora do catálogo virou linha';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg not like '%fora do catálogo na ordem%' then raise; end if;
  end;

  -- E o mesmo, na permutação pura — que é o caminho em que o CHECK nunca seria
  -- alcançado. Sem a guarda de entrada, esta chamada produzia a frase do bloco F.
  begin
    perform public.edicao_imprimir('month', v_ini, v_fim, array['lua'], '[]'::jsonb);
    raise exception 'E9b: caderno fora do catálogo passou na permutação pura';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg not like '%fora do catálogo na ordem%' then raise; end if;
  end;

  -- Tipo de período que nunca fecha. `all` é valor legítimo de `PeriodKind` e
  -- ilegítimo aqui, e também não tocava CHECK nenhum na permutação pura.
  begin
    perform public.edicao_imprimir('all', v_ini, v_fim, array['sono'], '[]'::jsonb);
    raise exception 'E9c: tipo de período sem edição foi aceito';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg not like '%tipo de período sem edição possível%' then raise; end if;
  end;

  begin
    perform public.edicao_imprimir('month', v_ini, v_fim, array['sono'],
              jsonb_build_array(
                jsonb_build_object('caderno','sono','texto','a','provedor','p','modelo','m',
                                   'prompt_versao',3,'pacote_versao',3,'motivo_de_parada','MAX_TOKENS',
                                   'tokens_entrada',0,'tokens_saida',0,'agg_version_no_momento',9,'metrica_lider',null)));
    raise exception 'E10: texto truncado virou edição';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg not like '%motivo_de_parada%' then raise; end if;
  end;

  -- **A chave `metrica_lider` AUSENTE.** É a guarda que existe para não repetir a
  -- história do `agg_version_no_momento`, que chegou a produção nulo em todas as
  -- linhas por ser opcional numa fila de passagens — e era a única guarda da
  -- função sem caso nenhum no cenário. Nulo ESCRITO é declaração (o caso A já o
  -- cobre, no caderno de lápide); chave que não veio é esquecimento.
  begin
    perform public.edicao_imprimir('month', v_ini, v_fim, array['sono'],
              jsonb_build_array(
                jsonb_build_object('caderno','sono','texto','a','provedor','p','modelo','m',
                                   'prompt_versao',3,'pacote_versao',3,'motivo_de_parada','STOP',
                                   'tokens_entrada',0,'tokens_saida',0,'agg_version_no_momento',9)));
    raise exception 'E11: linha SEM A CHAVE metrica_lider foi aceita';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg not like '%linha sem a chave metrica_lider%' then raise; end if;
  end;

  -- `p_ordem` nulo: apagar a edição inteira tem de ser um ato com essa cara, não
  -- o caso degenerado de uma impressão.
  begin
    perform public.edicao_imprimir('month', v_ini, v_fim, null, '[]'::jsonb);
    raise exception 'E12: p_ordem nulo foi aceito';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg not like '%sem ordem%' then raise; end if;
  end;

  -- `p_linhas` nulo ≠ `[]`. A diferença entre as duas é a diferença entre uma
  -- permutação e um engano.
  begin
    perform public.edicao_imprimir('month', v_ini, v_fim, array['sono'], null);
    raise exception 'E13: p_linhas nulo foi aceito';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg not like '%p_linhas nulo%' then raise; end if;
  end;

  begin
    perform public.edicao_imprimir('month', v_ini, v_fim, array['sono'], '{}'::jsonb);
    raise exception 'E14: p_linhas que não é array foi aceito';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg not like '%tem de ser um array jsonb%' then raise; end if;
  end;

  -- Elemento que não é objeto: sem a guarda, o `jsonb_to_recordset` morre com a
  -- mensagem do Postgres, e a guarda da chave chega antes dela acusando a linha
  -- de estar "sem caderno" — a acusação errada.
  begin
    perform public.edicao_imprimir('month', v_ini, v_fim, array['sono'], '[1]'::jsonb);
    raise exception 'E15: elemento que não é objeto foi aceito';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg not like '%elemento que não é objeto%' then raise; end if;
  end;

  -- Intervalo invertido. Sem a guarda, o `delete` e o `update` não achariam nada
  -- e só o `insert` bateria no CHECK — com a mensagem do banco, não com a de
  -- quem chamou; e numa permutação pura, com mensagem nenhuma.
  begin
    perform public.edicao_imprimir('month', v_fim, v_ini, array['sono'], '[]'::jsonb);
    raise exception 'E16: intervalo invertido foi aceito';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg not like '%termina antes de começar%' then raise; end if;
  end;

  begin
    perform public.edicao_imprimir(null, v_ini, v_fim, array['sono'], '[]'::jsonb);
    raise exception 'E17: chamada sem tipo de período foi aceita';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg not like '%exige tipo, início e fim%' then raise; end if;
  end;

  -- Linha que traz um caderno que a ordem não pediu: ela não teria posição, e o
  -- `array_position` a gravaria com nulo.
  begin
    perform public.edicao_imprimir('month', v_ini, v_fim, array['sono'],
              jsonb_build_array(
                jsonb_build_object('caderno','rotina','texto','a','provedor','p','modelo','m',
                                   'prompt_versao',3,'pacote_versao',3,'motivo_de_parada','STOP',
                                   'tokens_entrada',0,'tokens_saida',0,'agg_version_no_momento',9,'metrica_lider',null)));
    raise exception 'E18: linha fora da ordem foi aceita';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg not like '%fora da ordem%' then raise; end if;
  end;

  -- **O CHECK do banco continua sendo a última rede.** Ele já não é alcançável
  -- pela função (a guarda de entrada recusa antes), mas a tabela tem outros
  -- escritores — `upsertEdicao`, um `psql` à mão, um backfill —, e é por eles
  -- que ele existe. Sem este caso, afrouxar o CHECK não reprovaria nada aqui.
  begin
    insert into public.edicoes_ia (
      user_id, tipo_periodo, inicio, fim, caderno, posicao, texto, provedor, modelo,
      prompt_versao, pacote_versao, motivo_de_parada, tokens_entrada, tokens_saida,
      agg_version_no_momento, metrica_lider, gerado_em
    ) values (
      v_dono::uuid, 'month', v_ini, v_fim, 'lua', 9, 'a', 'p', 'm',
      3, 3, 'STOP', 0, 0, 9, null, now()
    );
    raise exception 'E19: o CHECK de caderno deixou passar um id fora do catálogo';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg not like '%edicoes_ia_caderno_check%' then raise; end if;
  end;

  -- ── F. ISOLAMENTO: outra sessão não alcança o período alheio ────────────
  --
  -- `edicao_imprimir` é a **primeira função deste projeto que ESCREVE por RPC**,
  -- e o resto do cenário roda com um usuário só — o que prova que ela funciona,
  -- nunca que ela se contém. O ensaio tem um dono só (a carga das edições exige
  -- isso), mas identidade aqui não é linha em `auth.users`: é o `sub` do
  -- `request.jwt.claims`, que é o que `auth.uid()` lê e a policy compara. Dá
  -- para ser outra pessoa sem existir — e é o bastante, porque a outra pessoa
  -- nunca chega a gravar.

  -- **O controle, primeiro.** Sem ele, o que vem depois mediria "a chamada da
  -- outra sessão falha" — que é compatível com a função estar quebrada para
  -- todo mundo. Com ele, o MESMO argumento tem dois desfechos, e a única
  -- diferença entre as duas chamadas é quem as fez.
  select count(*) into v_n
    from public.edicao_imprimir('month', v_ini, v_fim,
           array['sono','coracao','movimento'], '[]'::jsonb);
  if v_n <> 3 then
    raise exception 'F: o dono devia enxergar os 3 cadernos dele e enxergou %', v_n;
  end if;

  -- **Uma capa, para a RLS de `edicoes_capa` ter linha sobre a qual falar.**
  -- Sem isto, trocar a policy dela por `using (true)` passava no ensaio inteiro:
  -- a tabela nascia vazia, e zero linhas visíveis é o que uma policy certa e uma
  -- policy ausente produzem igual.
  insert into public.edicoes_capa (user_id, tipo_periodo, inicio, fim, natureza, legenda)
  values (v_dono::uuid, 'month', v_ini, v_fim, 'grade', 'Grade de janeiro');
  select count(*) into v_n from public.edicoes_capa
   where tipo_periodo = 'month' and inicio = v_ini and fim = v_fim;
  if v_n <> 1 then
    raise exception 'F: o dono devia ver a própria capa e viu % linha(s)', v_n;
  end if;

  -- A outra sessão: mesmo papel, outro `sub`. (`set_config('role', …)` é a forma
  -- de função do `set local role`, que é o que se pode chamar de dentro do bloco.)
  perform set_config('request.jwt.claims',
                     json_build_object('sub', v_outro, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  -- As duas tabelas, pela RLS: o outro não vê linha nenhuma do dono.
  select count(*) into v_n from public.edicoes_ia
   where tipo_periodo = 'month' and inicio = v_ini and fim = v_fim;
  if v_n <> 0 then
    raise exception 'F: a outra sessão LÊ % linha(s) de edicoes_ia — a policy não está separando os donos', v_n;
  end if;
  select count(*) into v_n from public.edicoes_capa
   where tipo_periodo = 'month' and inicio = v_ini and fim = v_fim;
  if v_n <> 0 then
    raise exception 'F: a outra sessão LÊ % linha(s) de edicoes_capa — a policy da capa não separa os donos', v_n;
  end if;

  -- **A função, ancorada no desfecho que só o vazamento produz.**
  --
  -- A âncora não é a mensagem: com a edição do dono invisível, a chamada não tem
  -- como terminar bem — ela pede três cadernos e não encontra nenhum. Se a RLS
  -- vazasse, esta chamada **teria sucesso**, devolveria 3 linhas e teria gravado
  -- a permutação em cima da edição alheia. Por isso o sucesso é a reprovação, e
  -- é ele que está escrito primeiro; a conferência da frase vem depois, e só
  -- para garantir que a recusa foi por não achar linha, e não por um engano de
  -- catálogo ou de argumento — que agora têm mensagens próprias.
  begin
    select count(*) into v_n
      from public.edicao_imprimir('month', v_ini, v_fim,
             array['sono','coracao','movimento'], '[]'::jsonb);
    raise exception
      'F: VAZAMENTO DE RLS — a outra sessão imprimiu no período do dono e recebeu % linha(s)', v_n;
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg like 'F: VAZAMENTO DE RLS%' then raise; end if;
    if v_msg not like '%a ordem tem 3 cadernos e a edição gravou 0 linhas%' then raise; end if;
  end;

  -- De volta ao dono: a passagem da outra sessão não deixou marca. Os modelos
  -- são a prova fina — um `delete` que tivesse alcançado a edição alheia, e
  -- depois voltado pelo rollback do bloco, ainda assim não poderia reassinar.
  perform set_config('request.jwt.claims',
                     json_build_object('sub', v_dono, 'role', 'authenticated')::text, true);
  select count(*), array_agg(modelo order by posicao) into v_n, v_modelos
    from public.edicoes_ia
   where user_id = v_dono::uuid and tipo_periodo = 'month' and inicio = v_ini and fim = v_fim;
  if v_n <> 3 or v_modelos <> array['m3','m2','m2']::text[] then
    raise exception 'F: a edição do dono mudou depois da passagem da outra sessão — % linha(s), modelos %',
      v_n, v_modelos;
  end if;

  -- ── G. a unique deferida é cobrada sobre o ESTADO FINAL ─────────────────
  --
  -- Sem isto o cenário limpava a tabela e a constraint deferida chegava ao
  -- COMMIT sem ter o que conferir: a invariante que ela carrega — posição única
  -- por edição — **nunca era cobrada** sobre as linhas que o cenário construiu.
  -- Forçar `immediate` aqui é onde as três impressões, a permutação e o parcial
  -- terminam de ser julgados; depois disso, apagar é seguro.
  set constraints public.edicoes_ia_posicao_unica immediate;

  -- ── H. o cenário não deixa rastro ───────────────────────────────────────
  --
  -- Apaga só o que ele criou: o dono dele, o período dele. Um `delete` sem
  -- filtro convivia com a tabela vazia de hoje e apagaria o arquivo no dia em
  -- que a 1.10 imprimisse a primeira edição de verdade.
  delete from public.edicoes_capa
   where user_id = v_dono::uuid and tipo_periodo = 'month' and inicio = v_ini and fim = v_fim;
  delete from public.edicoes_ia
   where user_id = v_dono::uuid and tipo_periodo = 'month' and inicio = v_ini and fim = v_fim;
  select count(*) into v_n from public.edicoes_ia
   where tipo_periodo = 'month' and inicio = v_ini and fim = v_fim;
  if v_n <> 0 then
    raise exception 'H: o cenário deixou % linhas para trás', v_n;
  end if;
  select count(*) into v_n from public.edicoes_capa
   where tipo_periodo = 'month' and inicio = v_ini and fim = v_fim;
  if v_n <> 0 then
    raise exception 'H: o cenário deixou % capa(s) para trás', v_n;
  end if;

  raise notice 'cenário edicao_imprimir: A–H verdes, e as duas tabelas voltaram ao que eram';
end
$cenario$;

reset role;
