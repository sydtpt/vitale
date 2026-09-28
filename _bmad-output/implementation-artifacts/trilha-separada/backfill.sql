-- Orbe — As sete trilhas que o Apple Watch gravou como caminhada
--
-- Aplicar DEPOIS de supabase/migrations/20260928120000_activities_type_edited.sql.
-- Sem a coluna `type_edited`, este update falha; e se falhasse em silêncio, o
-- próximo `syncType('Caminhada')` o desfaria sem deixar marca.
--
-- POR QUE SÃO SETE, E NÃO 23. O critério de tamanho (≥ 5 km ou ≥ 90 min ou
-- ≥ 100 m de desnível) marca 23 das 90 caminhadas, mas catorze delas são
-- turismo a pé: Paris ×2, Amsterdam ×2, Rotterdam, Barcelona, Lisboa,
-- Cambridge e Bruxelles ×5. Nenhum corte numérico separa as duas nuvens —
-- Paris tem 91 m de desnível e a trilha dos lagos de l'Eau d'Heure tem 98 m.
-- O que separa é a CIDADE, e o acervo já a tinha gravada em `cities` desde o
-- enriquecimento de 07/09/2026. Veredito do dono em 28/09/2026: "separar
-- trilha de caminhada mesmo".
--
-- AS DUAS SEM PROVA FICAM COMO ESTÃO, também por decisão dele: 03/02/2026
-- (9,2 km em 2.755 min, sem rota e sem cidade — 45 horas de gravação) e
-- 25/09/2024 (7,0 km, sem rota). Continuam Caminhada, visíveis, sem `hidden`.
--
-- O QUE MUDA DE NÚMERO. O MET da Trilha é 5,3 e o da Caminhada é 4,3
-- (packages/shared/src/health/who-activity.ts) — o esforço destas sete sobe
-- retroativamente em ~23%. O papel cromático vai de `yellow` para `green` e o
-- ícone de `walk` para `hiking`; ambos já existiam para o id 24 nos dois apps.
-- Elas saem do balde /historico/caminhada e entram em /historico/trilha.

begin;

create temporary table trilhas_a_corrigir (id text primary key) on commit drop;

insert into trilhas_a_corrigir (id) values
  ('57F25121-DD72-4424-9A58-91CB8B3E356F'),  -- 14/07/2026 ·  4,3 km ·  84 min · 110 m · Bohan
  ('BFD4981C-4F17-49D5-B835-364824CCDAC5'),  -- 13/07/2026 · 16,2 km · 295 min · 418 m · Bohan, Laforêt, Membre, Orchimont, Vresse-sur-Semois
  ('010A8F1B-34DF-4637-8A72-1283F8EBEC0C'),  -- 20/06/2026 ·  7,5 km ·  97 min · 252 m · Namur
  ('BD9E5399-DE8B-4006-BA24-6BDBC730C308'),  -- 15/03/2026 · 21,4 km · 270 min · 335 m · Charleroi
  ('A57677C6-CADF-4DF9-A84D-86648A413430'),  -- 22/12/2025 · 11,8 km · 187 min · 588 m · Andenne, Namur
  ('166786B0-CE9D-433C-A2D8-C65A9FFD5C48'),  -- 31/05/2025 · 10,1 km · 160 min · 357 m · Dinant
  ('9926885F-965E-40D9-9D17-132621D7DBA7');  -- 17/09/2023 ·  7,7 km · 128 min ·  98 m · Boussu-lez-Walcourt, Erpion, Froidchapelle, Vergnies

-- Trava a porta antes de escrever: se alguma das sete não for mais uma
-- caminhada (já corrigida, apagada, deduplicada contra o Garmin), o update
-- silenciosamente tocaria menos linhas do que se espera. Aqui ele aborta.
do $$
declare n int;
begin
  select count(*) into n
    from public.activities a
    join trilhas_a_corrigir t on t.id = a.id
   where a.activity_id = 52;
  if n <> 7 then
    raise exception 'Esperava 7 caminhadas para corrigir, encontrei %. Nada foi escrito.', n;
  end if;
end $$;

update public.activities a
   set activity_id    = 24,
       type_edited    = true,
       locally_edited = true,
       edited_at      = now()
  from trilhas_a_corrigir t
 where t.id = a.id
   and a.activity_id = 52;

-- A inscrição do tipo no sync do HealthKit. Sem ela, uma trilha gravada no
-- Apple Watch não sobe: o filtro do delta é
-- `subscribed.has(getActivityMeta(w.activityId).label)` — casa por RÓTULO, e
-- `Trilha` nunca esteve na tabela porque nunca houve um treino desse tipo no
-- relógio para a tela Fitness oferecer.
insert into public.synced_activity_types (user_id, type_key)
select distinct a.user_id, 'Trilha'
  from public.activities a
  join trilhas_a_corrigir t on t.id = a.id
on conflict (user_id, type_key) do nothing;

commit;

-- Conferência depois (deve devolver 8 para 24 e 83 para 52):
--   select activity_id, count(*) from public.activities
--    where activity_id in (24, 52) group by 1 order by 1;
--   select type_key from public.synced_activity_types order by type_key;
