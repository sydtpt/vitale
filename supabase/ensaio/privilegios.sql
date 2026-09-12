-- O modelo de privilégios de PRODUÇÃO, aplicado no banco local depois do reset.
--
-- Por que isto existe: produção nasceu com o padrão antigo do Supabase — toda tabela nova do
-- `public` recebe ALL para anon, authenticated e service_role, toda função recebe EXECUTE, e
-- quem protege é a RLS. O CLI atual cria o banco com o padrão novo, que não expõe nada à API.
-- As migrations nunca declararam esses GRANTs (ADR 0011 promete que um ambiente novo
-- reproduz produção, e aqui ele não reproduz). Sem este arquivo, o login funciona e a REST
-- responde `permission denied for table edicoes_ia` — o app fica sem tabela nenhuma.
--
-- Declarar os GRANTs nas migrations é decisão do dono, e ele adiou. Enquanto isso, o ensaio
-- replica o modelo aqui, e a paridade de ACL do preparar.sh prova que ficou igual.
begin;

-- Para o que a migração ensaiada criar (a 1.9 cria uma tabela nova).
-- PUBLIC fica FORA daqui de propósito: em produção o pg_default_acl de função não tem
-- entrada para PUBLIC — o EXECUTE para PUBLIC vem do padrão embutido do Postgres, que já
-- soma ao que está declarado por schema. Pôr PUBLIC aqui criaria uma linha que produção
-- não tem, e a paridade acusaria.
alter default privileges for role postgres in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant execute on functions to anon, authenticated, service_role;

-- Para o que as migrations já criaram.
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to public, anon, authenticated, service_role;

-- As EXCEÇÕES não moram aqui. Um GRANT geral como o de cima desfaz, calado, qualquer REVOKE
-- que uma migration tenha feito — hoje o de `linked_account_secrets`
-- (20260711120000_linked_accounts.sql:76), amanhã o da próxima tabela de segredo. Por isso o
-- preparar.sh gera os REVOKE a partir do ACL que ACABOU de ler de produção: tabela que lá não
-- dá acesso a anon/authenticated perde os dois aqui, pelo nome que produção disser, não por
-- um nome escrito à mão neste arquivo.
commit;
