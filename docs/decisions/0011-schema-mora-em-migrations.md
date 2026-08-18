# 0011 — Schema mora em migrations; desvio é defeito

**Status:** aceita
**Data:** 2026-08-18

## Contexto

`public.profiles` existia em produção desde antes do versionamento e nenhuma migration a criava. Verificado em 2026-08-18: das 21 tabelas em produção, 20 eram versionadas — ela era a única exceção, e nada nas migrations faltava no banco.

A consequência não foi arrumação pendente; foi uma tabela duplicada. Quem construiu as configurações do mobile leu `supabase/migrations/`, não encontrou tabela de perfil, e criou `user_profiles` (migration `20260528120000`). O repositório mentiu por omissão, e a duplicata foi a resposta correta a uma informação errada.

O resultado eram dois donos do mesmo conceito, com o dado real (1 linha) na tabela invisível e a versionada vazia.

## Decisão

**Toda tabela, policy, índice e função de produção nasce de uma migration.** Objeto criado à mão no dashboard ou pela Management API é defeito, não atalho — mesmo que funcione.

`profiles` foi trazida para o versionamento em `20260818120000_profiles_versionada.sql`, reproduzindo o estado verificado em produção de forma idempotente: no-op lá, criação em banco limpo.

Entre as duas tabelas, `profiles` vence: tem o dado, `name` e `birthdate` são `NOT NULL` contra um `display_name` anulável, carrega `birthdate` (dado de domínio que alimenta estimativa de FC máxima), e é o nome idiomático do Supabase para a tabela pública chaveada em `auth.users.id`.

O desvio se detecta comparando as tabelas de produção contra as que as migrations criam — comando registrado no `AGENTS.md`.

## Alternativas rejeitadas

**`user_profiles` vencer.** Combina com `user_preferences`, que existe — consistência de nomenclatura real. Perde para dado, constraint e convenção de ecossistema. E a separação é semântica, não acidental: `profiles` é quem o usuário é, `user_preferences` é como ele configurou o app.

**Só escolher uma tabela, sem versionar.** Corrige o sintoma. A invisibilidade é que produziu a duplicata, e ela produziria outra.

**Guarda mecânica no `npm run test`.** A checagem precisa do banco, e pela [0008](#) — instância única, sem CI — não há onde um teste unitário alcançar produção. Fingir que a AD-7 cobre seria pior que admitir que não cobre; por isso virou comando documentado, não teste.

## Consequências

Um `db reset` ou um ambiente novo agora reproduz o login da web, que antes quebraria calado — `user_profiles` seria recriada e `profiles` não.

`user_profiles` fica marcada como obsoleta por comentário, mas **não** é derrubada: o drop é irreversível, vazia hoje não prova vazia sempre, e o mobile ainda a consulta. A aposentadoria acontece quando o mobile passar a ler `profiles`.

Migration aplicada pela Management API precisa ser registrada em `supabase_migrations.schema_migrations`, senão um `db push` futuro re-executa.
