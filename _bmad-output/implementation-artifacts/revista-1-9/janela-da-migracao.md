# A janela da migração da 1.9 — o que quebra, o que não volta, e a ordem

Escrito em 13/09/2026, com produção medida no mesmo dia: **7 edições**, todas com
`agg_version_no_momento` **nulo**, e **67 migrations** registradas.

**A janela foi executada em 13/09/2026 e deu certo.** O que está escrito abaixo é o que
foi seguido; a seção 6, no fim, registra o que só se aprendeu fazendo — inclusive um
pré-requisito que faltava aqui e custou dois builds.

Este arquivo é para ser seguido **na hora**, com o telefone na mão.

Os passos 4, 5 e 6 estão automatizados em [`aplicar.sh`](aplicar.sh), ao lado deste
arquivo — ele confere o estado antes, pede confirmação por extenso, aplica, registra a
versão e confere depois. `bash aplicar.sh --ensaio` roda só as conferências, sem
escrever nada. O texto abaixo continua valendo como o que o script faz, e é o que você
lê se ele parar no meio.

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
  > **Não confirmado na prática.** Na janela de 13/09 o app fechou ao abrir, mas o log do
  > aparelho mostrou outra causa (ver seção 6), e o app velho nunca foi lançado de novo
  > contra o schema novo. O comportamento acima segue sendo dedução, não medição.
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

   **De qual árvore** (custou dois builds em 13/09): o `.app` tem de sair de uma árvore
   que contenha a 1.9, e o nome da branch não prova isso. Confira **dentro do bundle**:
   ```bash
   python3 conferir-bundle.py <caminho>/Orbe.app/main.jsbundle
   ```
   Ele procura as marcas da 1.9 em ASCII **e** em UTF-16 — o Hermes guarda string com
   acento em UTF-16, então `grep` simples devolve zero para frase acentuada que **está**
   lá.

   **O `.env` é pré-requisito.** `mobile/.env` está no `.gitignore`, então worktree nova
   nasce sem ele, e o `xcodebuild` local não lê o `eas.json`. Sem
   `EXPO_PUBLIC_SUPABASE_URL`/`ANON_KEY` o app compila e **morre no lançamento**, antes de
   qualquer tela (`Error: supabaseUrl is required.`). Copie da árvore principal antes de
   compilar.
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
| Passo 7 | **o app fecha sozinho ao abrir** | **Não conclua que é o schema.** Leia o log do aparelho antes: `xcrun devicectl device process launch --device <id> --console --terminate-existing com.sydtpt.vitale`. Em 13/09 o sintoma parecia o intervalo quebrado e era `.env` faltando. |
| Passo 9 | a função recusa a chamada | Quase sempre é `set local role authenticated` esquecido, ou `metrica_lider` ausente no objeto — a função diz qual, com nome. |
| Depois | quer voltar atrás | Não há caminho de volta com o dado. O caminho é para a frente: consertar o JS, ou escrever a migração seguinte. |

## 6. O que só se aprendeu fazendo (13/09/2026)

A janela levou cerca de uma hora, e o banco nunca esteve em risco: a migração aplicou de
primeira e as nove conferências passaram. O tempo foi todo do lado do **aparelho**.

1. **O build saiu da árvore errada.** O `.app` de 12:27 vinha de
   `~/Projects/life-organizer`, que estava na frente `feat/revista-luz-do-dia` — sem a
   1.9. Descoberto lendo o bundle, não o nome da branch. Daí o `conferir-bundle.py`.
2. **O Hermes guarda acento em UTF-16.** `grep` no `main.jsbundle` achava
   `metrica_lider` e não achava "A impressão está parada" — as duas estavam lá. Conferir
   nas duas codificações, ou o veredito sai errado.
3. **`mobile/.env` não acompanha worktree**, e sem ele o app morre no lançamento com
   `Error: supabaseUrl is required.` — antes de qualquer tela, e sem relação nenhuma com
   o schema.
4. **Sintoma lido pela expectativa.** O app fechou no minuto exato em que o intervalo
   quebrado era esperado, e a causa foi atribuída à migração sem prova. O log estava a um
   comando de distância. **Ler o log antes de nomear a causa.**
5. **Existe `eas update` publicado no canal `preview` de 07/09**, anterior à 1.9. Não
   atrapalhou (o bundle embutido é mais novo e tem precedência), mas **publicar um update
   de branch sem a 1.9 quebra o app sem ninguém tocar em nada**.

**O que a semeadura provou**, e nenhum teste provava: a `edicao_imprimir` chamada em
produção como `authenticated` com o JWT real gravou os três cadernos em `posicao` 1, 2 e
3, com `metrica_lider` **nulo** no de Coração — o caso da lápide, aceito por decisão do
dono. Desfeita em seguida: `edicoes_ia` e `edicoes_capa` voltaram a zero.
