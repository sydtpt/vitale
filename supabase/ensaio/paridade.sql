-- Catálogo e privilégios do schema `public`, numa consulta só.
--
-- A MESMA consulta roda em produção (só leitura, pela prod_ler) e no banco local do ensaio;
-- preparar.sh compara as duas saídas linha a linha. Também é a metade de catálogo do retrato
-- que o ensaiar.sh tira antes e depois da candidata.
--
-- Regras de escrita, cada uma com motivo:
--
--   1. NENHUM ';' em lugar nenhum, nem dentro de literal. A guarda da prod_ler recusa antes
--      da rede a consulta que tem um — é o que impede uma segunda instrução de viajar junto.
--   2. O hash de função ignora espaço em branco. Produção recebeu várias funções pela
--      Management API numa linha só, e o repositório as escreve em várias: mesma função,
--      formatação outra. Sem isto, `_route_overview` divergiria para sempre.
--   3. Cada linha carrega o que DISTINGUE o objeto, não só o nome. As colunas saem do
--      pg_attribute com `format_type` — o `data_type` do information_schema diz "ARRAY" para
--      `text[]` e para `integer[]`, "USER-DEFINED" para enum, e perde a precisão do numeric.
--      A extensão leva o schema (o `pg_net` mora em lugares diferentes aqui e lá), e a RLS
--      leva `forced` e o dono.
--
-- Toda linha sai com o espaço em branco colapsado, senão uma policy quebrada em duas linhas
-- viraria duas "divergências" de um lado só.
select regexp_replace(l, '\s+', ' ', 'g') as l from (
  select 'col ' || c.relname || '.' || a.attname || ' #' || a.attnum || ' '
    || format_type(a.atttypid, a.atttypmod)
    || ' null=' || (case when a.attnotnull then 'NO' else 'YES' end)
    || ' def=' || coalesce(pg_get_expr(d.adbin, d.adrelid), '-')
    || ' ident=' || coalesce(nullif(a.attidentity::text, ''), '-')
    || ' gen=' || coalesce(nullif(a.attgenerated::text, ''), '-') as l
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
  where n.nspname = 'public' and a.attnum > 0 and not a.attisdropped
    and c.relkind in ('r', 'p', 'v', 'm', 'f')
  union all
  select 'con ' || rel.relname || ' ' || con.conname || ' ' || pg_get_constraintdef(con.oid)
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace n on n.oid = rel.relnamespace
  where n.nspname = 'public'
  union all
  -- `valido=f` é índice inválido: resto de um CREATE INDEX CONCURRENTLY que falhou. Ele
  -- existe, ocupa espaço, não é usado, e some do `pg_indexes` sem nenhuma marca.
  select 'idx ' || pg_get_indexdef(i.indexrelid) || ' valido=' || i.indisvalid::text
  from pg_index i
  join pg_class c on c.oid = i.indexrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
  union all
  -- `perm=` separa policy permissiva de restritiva: as duas somam de formas opostas, e sem
  -- isto saem idênticas.
  select 'pol ' || tablename || ' ' || policyname || ' ' || cmd || ' perm=' || permissive
    || ' ' || array_to_string(roles, ',')
    || ' q=' || coalesce(qual, '-') || ' c=' || coalesce(with_check, '-')
  from pg_policies where schemaname = 'public'
  union all
  -- o dono da função é fronteira de privilégio: em `security definer`, é com ele que o corpo
  -- roda.
  select 'fn ' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ') '
    || 'dono=' || pg_get_userbyid(p.proowner) || ' '
    || md5(regexp_replace(pg_get_functiondef(p.oid), '\s', '', 'g'))
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind in ('f', 'p')
  union all
  select 'trg ' || c.relname || ' ' || t.tgname || ' ' || md5(pg_get_triggerdef(t.oid))
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and not t.tgisinternal
  union all
  select 'view ' || viewname || ' ' || md5(definition) from pg_views where schemaname = 'public'
  union all
  select 'matview ' || c.relname || ' ' || md5(pg_get_viewdef(c.oid))
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'm'
  union all
  -- enum: os rótulos e a ORDEM deles, que é o que um CHECK não pega
  select 'type ' || t.typname || ' enum ['
    || array_to_string(array(select e.enumlabel from pg_enum e
                             where e.enumtypid = t.oid order by e.enumsortorder), ', ') || ']'
  from pg_type t join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public' and t.typtype = 'e'
  union all
  select 'type ' || t.typname || ' domain ' || format_type(t.typbasetype, t.typtypmod)
    || ' null=' || (case when t.typnotnull then 'NO' else 'YES' end)
    || ' def=' || coalesce(t.typdefault, '-')
    || ' check=' || coalesce((select string_agg(con.conname || ' ' || pg_get_constraintdef(con.oid), ' ' order by con.conname)
                              from pg_constraint con where con.contypid = t.oid), '-')
  from pg_type t join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public' and t.typtype = 'd'
  union all
  select 'rls ' || c.relname || ' enabled=' || c.relrowsecurity::text
    || ' forced=' || c.relforcerowsecurity::text
    || ' dono=' || pg_get_userbyid(c.relowner)
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p')
  union all
  -- A extensão leva o schema: mesma versão em lugar diferente muda o search_path que a
  -- migração precisa. O schema vem ANTES da versão de propósito: na lista de divergências
  -- conhecidas o curinga só pode comer o que muda sozinho (a versão de patch), nunca o schema.
  select 'ext ' || e.extname || ' @ ' || n.nspname || ' ' || e.extversion
  from pg_extension e join pg_namespace n on n.oid = e.extnamespace
  union all
  -- Gatilho de evento é global, não do schema: entra porque muda o que acontece com a tabela
  -- que a candidata criar (produção liga RLS sozinha em tabela nova do public).
  select 'evt ' || evtname || ' ' || evtevent || ' ' || evtenabled::text || ' ' || evtfoid::regproc::text
    || ' ' || coalesce(array_to_string(evttags, ','), '-')
  from pg_event_trigger
  union all
  -- Privilégios. Produção nasceu com o padrão antigo do Supabase e as migrations nunca
  -- declararam GRANT: sem esta metade, um banco feito só delas parece igual e não atende à API.
  select 'acl ' || c.relname || ' '
    || coalesce(array_to_string(array(select unnest(c.relacl)::text order by 1), ' '), '(padrão)')
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'S', 'p')
  union all
  select 'defacl ' || pg_get_userbyid(d.defaclrole) || ' ' || coalesce(n.nspname, '*') || ' '
    || d.defaclobjtype::text || ' '
    || array_to_string(array(select unnest(d.defaclacl)::text order by 1), ' ')
  from pg_default_acl d left join pg_namespace n on n.oid = d.defaclnamespace
  union all
  select 'schema ' || nspname || ' '
    || array_to_string(array(select unnest(nspacl)::text order by 1), ' ')
  from pg_namespace where nspname = 'public'
  union all
  select 'fnacl ' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ') '
    || coalesce(array_to_string(array(select unnest(p.proacl)::text order by 1), ' '), '(padrão)')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
) x order by 1
