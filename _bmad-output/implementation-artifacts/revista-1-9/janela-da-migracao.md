# A janela da migração da 1.9 — o que quebra, o que não volta, e a ordem

Escrito em 13/09/2026, com produção medida no mesmo dia: **7 edições**, todas com
`agg_version_no_momento` **nulo**, e **67 migrations** registradas.

Este arquivo é para ser seguido **na hora**, com o telefone na mão.

---

## 1. O que quebra, e quando

A resposta curta: **o app instalado quebra no instante em que a migração roda**, e o
JS novo quebra enquanto a migração **não** rodou. Não existe ordem sem intervalo — só
existe intervalo curto e intervalo longo.

| Quem | Contra o schema VELHO | Contra o schema NOVO |
|---|---|---|
| App instalado hoje | funciona | **quebra ao abrir e ao gravar** |
| JS da 1.9 | **quebra ao abrir** | funciona |

Por quê, em detalhe:

- **Ao abrir**, o app velho faz `.maybeSingle()` sobre quatro colunas. Com `caderno` na
  chave, a mesma consulta passa a casar até quatro linhas e o PostgREST devolve erro
  (`PGRST116`) em vez de linha. O cartão mostra a mensagem de erro.
- **Ao gravar**, o `onConflict` do app velho nomeia uma chave que deixou de existir
  (`42P10`), e o payload não tem as colunas novas obrigatórias (`23502`). O raio é o
  dobro do que a story original dizia: não é só leitura.
- **O JS da 1.9 contra o schema velho** pede `caderno`, `posicao` e `metrica_lider`, que
  ainda não existem (`42703`). Por isso publicar o `eas update` **antes** da migração
  quebra do outro lado.

**Consequência prática:** o intervalo em que a Retrospectiva não funciona vai do
instante da migração até o JS novo estar ativo. Você é o único usuário — basta não
abrir a Retrospectiva nesse intervalo.

## 2. O que não tem volta

- **As 7 edições são apagadas.** O texto delas está em
  `docs/specs/revista-retrospectiva/primeiras-edicoes-prompt-v2.md`, e o ensaio confere
  **7 de 7** antes de qualquer coisa. O que se perde é o registro no banco (datas,
  modelo, tokens), não o texto.
- **Não há migração de volta.** Desfazer a forma nova seria escrever outra migração, e
  o dado que ela restauraria já não existe. O seguro é o JS novo estar **pronto antes**.
- **A janela é única.** Coluna que aparecer depois entra nesta migração, não numa
  segunda: cada janela custa um build.

## 3. O que protege

- **A migração é uma transação só.** A Management API executa o arquivo inteiro como
  uma consulta simples, e o Postgres roda consulta simples com várias instruções como
  **uma** transação implícita. As 17 instruções são todas transacionais (conferido pela
  varredura do ensaio). Falha no meio = nada acontece. Provado: no ensaio, com falha
  provocada no fim, o retrato do banco ficou **idêntico**.
- **A guarda das sete.** Se o número de linhas a apagar não for exatamente 7, a migração
  **aborta antes de mexer em qualquer coisa**. Isso cobre o caso de o app imprimir uma
  edição nova entre hoje e a janela.
- **A ordem interna.** As sete saem antes de as colunas obrigatórias nascerem. Hoje isso
  protege em **dois** pontos: `caderno not null` e `agg_version_no_momento set not null`
  — as sete linhas têm esse campo nulo.

## 4. O roteiro

### Antes da janela (sem pressa, em qualquer momento)

1. **Mesclar o PR #498** na `main`.
2. **Preparar o JS novo.** Duas opções:
   - **Build** (recomendado): compile e deixe **pronto para instalar** no telefone. O
     intervalo quebrado fica sendo os minutos entre a migração e o toque em "instalar".
   - **`eas update`**: publique **só depois** da migração. O update baixa num lançamento
     e **só vale no seguinte**, então o app fica quebrado por dois lançamentos.
3. **Confirmar que produção ainda tem sete edições** (só leitura):
   ```sql
   select count(*) from public.edicoes_ia;
   ```
   Se não forem 7: exporte o texto das novas para o `.md` **antes** e ajuste o número
   esperado dentro da migração, no bloco `guarda_das_sete`.

### A janela (15 a 30 minutos, com o telefone na mão)

4. **Aplicar a migração**, o arquivo inteiro numa chamada só, pela Management API:
   ```bash
   TOKEN=$(security find-generic-password -s "Supabase CLI" -w)
   jq -Rs '{query: .}' supabase/migrations/20260912120000_edicao_por_caderno.sql \
     | curl -sS -X POST "https://api.supabase.com/v1/projects/svyyuhxkblufhfvfvqte/database/query" \
         -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d @-
   ```
   Erro aqui significa que **nada** mudou. Leia a mensagem e pare.

5. **Registrar a versão** — a Management API não registra, e sem isto a migration fica
   "pendente" para sempre e um `db push` futuro tentaria repeti-la:
   ```sql
   insert into supabase_migrations.schema_migrations (version, name)
   values ('20260912120000', 'edicao_por_caderno');
   ```

6. **Conferir a forma nova** (só leitura):
   ```sql
   select
     (select count(*) from public.edicoes_ia)                                    as edicoes_apagadas_devem_ser_0,
     (select count(*) from information_schema.columns
       where table_name = 'edicoes_ia' and column_name in ('caderno','posicao','metrica_lider')) as colunas_novas_devem_ser_3,
     (select count(*) from pg_constraint where conname = 'edicoes_ia_posicao_unica' and condeferrable) as unique_deferida_deve_ser_1,
     (select count(*) from information_schema.tables where table_name = 'edicoes_capa') as capa_deve_ser_1,
     (select count(*) from pg_proc where proname = 'edicao_imprimir')            as funcao_deve_ser_1,
     (select count(*) from supabase_migrations.schema_migrations)                as migrations_devem_ser_68;
   ```

7. **Ativar o JS novo**: instalar o build (ou publicar o `eas update` e abrir o app
   duas vezes).

8. **Abrir a Retrospectiva** num mês fechado. Esperado: **nenhum erro**, e a frase que
   ocupa o lugar do botão. Se aparecer mensagem de erro, o JS ativo ainda é o velho.

9. **Semear uma edição** e conferir a tela nova — o procedimento completo, com o
   desfazer, está nos "Manual checks" da spec desta story. É o único passo que exercita
   em produção o caminho de escrita que a 1.10 vai usar.

10. **Desfazer a semeadura** quando terminar de olhar. Ela é andaime: o Épico 2 vai
    imprimir este mês de verdade.

### Depois

- O `preparar.sh` do ensaio passa a avisar **"produção não tem edição nenhuma"**. É
  esperado, e está escrito lá.
- A frase provisória da tela sai na **1.10**, junto com a volta da escrita. Está
  registrada no `deferred-work.md`.

## 5. Se der errado

| Onde | Sintoma | O que fazer |
|---|---|---|
| Passo 4 | erro na aplicação | Nada mudou — a transação é única. Leia a mensagem; se for a guarda das sete, exporte a edição nova e ajuste o número. |
| Passo 4 | a chamada não responde | Confira o passo 6 antes de repetir: se a forma nova já estiver lá, **não repita** (a guarda das sete abortaria, mas o registro do passo 5 pode ter ficado para trás). |
| Passo 7 | o app abre com erro | O JS ativo ainda é o velho. Instale o build, ou abra o app mais uma vez se foi por `eas update`. |
| Passo 9 | a função recusa a chamada | Quase sempre é `set local role authenticated` esquecido, ou `metrica_lider` ausente no objeto — a função diz qual, com nome. |
| Depois | quer voltar atrás | Não há caminho de volta com o dado. O caminho é para a frente: consertar o JS, ou escrever a migração seguinte. |
