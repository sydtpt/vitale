# O ensaio da migração

Um Supabase local fiel a produção, reproduzível, para ensaiar uma migração **antes** de ela
chegar lá.

Existe por causa da Story 1.9 da revista: risco 9 no test design, instância única, sem staging
e sem OTA — o único nível de teste que ela tem é ensaiar fora de produção (T-2 e R-25 em
`skills/test-artifacts/test-design-epic-1.md`). O ensaio não torna a migração correta; ele
troca *descobrir em produção* por *descobrir aqui*.

```
supabase/ensaio/subir.sh                                   sobe a pilha local
supabase/ensaio/preparar.sh                                põe o banco na base de produção e prova a paridade
supabase/ensaio/ensaiar.sh [--falhar-no-fim] candidata.sql aplica a candidata como produção a receberia
supabase/ensaio/descer.sh [--apagar]                       desce (o volume fica, ou vai embora com --apagar)
```

Tudo o que o ensaio escreve fica em `$TMPDIR/orbe-ensaio` (modo 700) — pasta de trabalho do
CLI, logs, retratos e o log das consultas a produção. Nada é escrito no repositório: rodar o
ensaio inteiro não muda o `git status`, e **os três comandos conferem isso por máquina**
(`subir.sh`, `preparar.sh` e `ensaiar.sh` comparam o `git status --porcelain` do começo com o
do fim, **incluindo o que o `.gitignore` esconde dentro de `supabase/`** — senão a própria
linha que esta entrega acrescentou ao `.gitignore` apagaria a sujeira da medição).

Para mudar o lugar, `ENSAIO_DIR=/caminho/absoluto` — relativo é recusado (o `--workdir` do CLI
resolveria a partir de outra pasta), e pasta que já exista com conteúdo e sem a marca
`.orbe-ensaio` também, porque o `--apagar` limpa o que estiver lá.

**Um ensaio por vez**, e isso é travado: cada corrida cria `$ENSAIO_DIR/.lock` e solta na
saída. Duas corridas dividiriam pasta, contêiner e volume.

## Requisitos

- **colima**, não Docker Desktop. O Docker Desktop 3.6 (2021) desta máquina morre calado no
  macOS 26. `brew install colima docker` e `colima start --cpu 4 --memory 6`. O cliente é o
  `/opt/homebrew/bin/docker` — o `/usr/local/bin/docker` é o antigo.
- **`~/.colima/_lima/_config/override.yaml`** com a regra abaixo. Sem ela o CLI publica em
  `0.0.0.0`, o colima repassa para a rede, e o Postgres local — senha padrão `postgres` — fica
  aberto na LAN. O `docker.ip: 127.0.0.1` do `colima.yaml` **não** basta.

  ```yaml
  portForwards:
    - guestIPMustBeZero: true
      guestIP: 0.0.0.0
      guestPortRange: [1, 65535]
      hostIP: 127.0.0.1
      hostPortRange: [1, 65535]
      proto: tcp
  ```

  O `subir.sh` recusa subir sem **uma regra que tenha as quatro coisas juntas** (as duas
  metades em regras diferentes não valem: a primeira que casa é a que vale, e a outra seria
  decoração), e derruba a pilha se alguma porta escutar fora de 127.0.0.1 depois de subir.
- **Supabase CLI logado** (`supabase login`): o token no keychain do macOS, serviço
  `Supabase CLI`, lido com o `security` — o mesmo que o
  `supabase/scripts/check-schema-drift.sh` usa. Só para **ler** produção.
- **CLI 2.109** ou próximo: é dessa versão a lista de nomes que o `supabase start -x` aceita
  (ver armadilha nº 5). O `subir.sh` avisa se o CLI recusar algum nome da lista.
- Ferramentas do sistema, todas do macOS: `jq`, `curl`, `perl`, `shasum`, `security` (o token no
  keychain), `lsof -Fn` (as portas), `date -j -f` (a idade do carimbo) e `sed -E`. O bash é o
  3.2 do macOS — os scripts são escritos para ele, sem array associativo nem `mapfile`. Em
  Linux, `date -j -f` e `lsof -Fn` têm outra sintaxe: o ensaio é de macOS.
- Variáveis de ajuste, todas opcionais: `ENSAIO_DIR` (onde tudo é escrito; caminho absoluto),
  `ENSAIO_OVERRIDE` (o arquivo do colima que a guarda de portas exige) e `ENSAIO_KEYCHAIN` (o
  serviço do keychain onde o token do CLI mora). As três existem para as guardas poderem ser
  exercitadas sem mexer na máquina.
- O `supabase/.temp/postgres-version` do repositório, que diz qual imagem produção roda. É a
  única coisa que o ensaio copia de lá, e aparece quando o CLI fala com o projeto.

## O que cada checagem prova

**`subir.sh`** — a pilha sobe pela pasta de trabalho temporária, com `db`, `auth`, `rest` e
`kong` só (o resto é excluído). Prova que o Postgres local é a **imagem de produção** e que a
**versão do servidor e o papel que executa** batem com os de produção — lidos de lá a cada
corrida, não de arquivo nem de cache.

A guarda de portas tem **três desfechos**, e a diferença importa:

| Desfecho | O que significa | O que o ensaio faz |
|---|---|---|
| tudo em `127.0.0.1` | as portas publicadas escutam só em loopback | segue |
| **exposição** | alguma porta escuta fora do loopback | **derruba a pilha** e sai ≠ 0 — o banco sobe com a senha padrão `postgres` |
| **não deu para medir** | nenhuma porta publicada, ou ninguém escutando em 20 s (repasse do colima atrasado) | sai ≠ 0 **sem derrubar**: falha de medição não é exposição, e derrubar a pilha por lentidão custa caro e não protege nada |

**`preparar.sh`** — nesta ordem, e a ordem é a garantia de que produção inalcançável no meio
não deixa o banco local pela metade:

| Passo | O que prova |
|---|---|
| Lê produção (versões, edições, catálogo) | tudo o que vem de lá vem **antes** de qualquer mudança aqui |
| Monta a base | a base é o conjunto que produção **registrou** em `supabase_migrations.schema_migrations`, não o que o repositório tem. Arquivo que produção não registrou é **pendente**: fica fora e é listado. Versão registrada sem arquivo **aborta**, nomeando a versão |
| `db reset` | as migrations aplicam limpas num Postgres zerado, e o banco registra exatamente a base |
| `privilegios.sql` | o modelo de privilégios de produção (armadilha nº 4), inclusive o **padrão** que a tabela nova da candidata vai herdar. Os REVOKE não estão escritos lá: eles são **derivados do ACL que produção acabou de mostrar** — tabela que lá não dá acesso a `anon`/`authenticated` perde os dois aqui, e uma tabela de segredo criada amanhã entra sozinha nessa conta |
| Colunas e edições | as colunas de `edicoes_ia` são as mesmas dos dois lados (senão a carga jogaria fora, calada, o que só existe lá), e as edições reais entram sob o usuário local `ensaio@orbe.local`. O `user_id` de produção **não é lido** — de lá só sai a contagem de donos |
| Paridade | catálogo (colunas com tipo completo, constraints, índices, policies, funções, triggers, views e matviews, tipos, RLS com `forced` e dono, extensões **com o schema**, gatilhos de evento) **e** ACLs, linha a linha contra produção. Divergência fora de `divergencias-conhecidas.txt` reprova |
| Textos | cada edição carregada está inteira em `docs/specs/revista-retrospectiva/primeiras-edicoes-prompt-v2.md`. É o que autoriza a 1.9 a apagá-las: o git guarda |
| Ponta a ponta | login do dono, leitura pela REST e RLS — o dono vê as 7, o anônimo vê 0. A contagem vem do `Content-Range` com `count=exact`, não do tamanho da lista: o PostgREST corta em 1.000 linhas sem erro nenhum |

Se **qualquer** uma reprovar, o retrato da base não é gravado — e sem ele o `ensaiar.sh` se
recusa a rodar. O retrato aprovado sai carimbado, com data e contagem na primeira linha.

**`ensaiar.sh`** — aplica a candidata **do jeito que produção a recebe**: a Management API
executa o arquivo como *uma consulta simples*, e o Postgres roda consulta simples com várias
instruções como **uma transação implícita**. `psql --command="<arquivo inteiro>"` tem a mesma
semântica; `-f` não tem, porque manda instrução por instrução.

0. **A base ainda é a de produção?** O retrato carimbado tem de existir, e o `ensaiar.sh`
   **relê produção** (as versões registradas) para conferir contra o carimbo: se produção
   aplicou uma migration desde a base, ele para e manda rodar o `preparar.sh`. Carimbo com mais
   de duas horas vira aviso, e migration pendente no repositório também — produção pode aplicá-la
   antes da candidata, e aí a base que a candidata encontra lá não é esta.
1. **Varredura** — acusa o que não roda dentro de transação (`CONCURRENTLY`, `VACUUM`,
   controle de transação explícito, `ALTER TYPE … ADD VALUE`, `CREATE/DROP SUBSCRIPTION`,
   `DISCARD`, `CREATE DATABASE`…). Comentários, literais e corpos `$$…$$` saem antes da
   análise: sem isso, o `begin` de todo corpo plpgsql seria acusado. Candidata **sem instrução
   nenhuma é recusada**. E avisa (sem reprovar) quando a candidata cria tabela no `public` sem
   `enable row level security` no mesmo arquivo — ver armadilha nº 10.
2. **Retrato antes** — catálogo, ACLs, contagem e **hash do conteúdo** de cada tabela, e um
   hash por edição. Ele tem de bater com o retrato carimbado da base; se não bater — outra
   candidata foi aplicada em cima —, o ensaio para e manda rodar o `preparar.sh`.
3. **Aplicação** numa consulta só.
4. **Retrato depois**, e o diff dos dois.
5. **O caminho do app, de novo** — login, REST e RLS, agora com a candidata aplicada, em
   `edicoes_ia` e em **cada objeto que a varredura viu a candidata criar** (tabela, view e view
   materializada). É a única medição que enxerga objeto novo exposto à API: ele nasce aqui sem
   RLS (produção liga sozinha) e com ALL para `anon` (o padrão de privilégio de produção).

   A régua tem dois lados, e os dois **reprovam**:

   - **o anônimo lê linha** → reprova. Mesmo sabendo que em produção o gatilho `ensure_rls`
     ligaria a RLS: é decisão do dono — o ensaio não aprova o que depende de rede alheia para
     ser seguro. Quem quer a tabela fechada declara `enable row level security` na migration.
   - **o dono lê menos do que o banco tem** → reprova. A contagem esperada sai do **retrato
     desta corrida** (`linhas <t> <n>`), não da API. Tabela com RLS ligada e sem policy tem
     linha no banco e zero na API — que é exatamente o estado que produção produz sozinha, e
     que antes passava como "tabela vazia", com o ensaio saindo 0.

   Quando o objeto está mesmo vazio, o ensaio diz que aquele zero não prova nada.

`--falhar-no-fim` acrescenta um erro no fim do arquivo. Passa (sai 0) só quando as instruções
da candidata **chegaram a rodar** (o ensaio conta as marcas de comando que o psql imprimiu), a
aplicação inteira falhou **e** o retrato ficou idêntico: é a prova do rollback limpo, o R-25.
Numa candidata de **uma** instrução ele avisa: o bloco injetado faz o arquivo virar duas, e aí
existe uma transação implícita que a aplicação real não teria.

Para voltar à base depois de aplicar uma candidata, rode `preparar.sh` de novo.

## As guardas

- **Produção só é lida.** `prod_ler` recusa, *antes da rede*, consulta que tenha `;` ou que não
  comece por `select`/`with`; o que passa vai embrulhado em
  `begin transaction read only; … ; commit;`, e cada chamada é registrada em
  `$ENSAIO_DIR/prod-consultas.log` (a consulta — nunca a resposta, nunca o token). Um
  `with … delete …` passa pela primeira guarda e morre na segunda. O log **sobrevive** ao
  `descer.sh --apagar`: ele é a prova de que só houve leitura. E como um log só testemunha o
  que passa por ele, há uma autoconferência: o host da Management API aparece **uma vez** no
  ensaio inteiro, dentro da `prod_ler` — qualquer script que tentasse falar com produção por
  fora é recusado na entrada.
  **O que ela não cobre:** função com efeito colateral que a transação read only não barra
  (`pg_terminate_backend`, por exemplo). A guarda é contra engano, não contra consulta
  maliciosa — quem escreve as consultas são estes scripts.
- **O CLI nunca fala com produção.** Roda sempre com `--workdir` numa pasta temporária onde o
  `config.toml` é link simbólico e só o `.temp/postgres-version` é cópia. O `.temp/project-ref`
  — o link — nunca é copiado; os scripts recusam `db push`, `link`, `--linked`, `--db-url` e
  `--project-ref`; e as variáveis que o CLI também lê do ambiente (`SUPABASE_DB_URL`,
  `SUPABASE_PROJECT_ID`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_WORKDIR`) são apagadas na entrada,
  com aviso.
- **Nada de produção no repositório nem em log.** Texto de edição, UUID de usuário e token
  ficam fora: o que vai à tela vindo do banco passa por uma máscara que troca UUID por
  `<uuid>`, corta o `Failing row contains` e o `Key (…)=(…)` que o Postgres anexa a erro de
  constraint, e trunca linha muito longa.

## As armadilhas

Cada uma custou uma descoberta. Elas estão aqui para não custar duas.

1. **Docker Desktop 3.6 morre calado** no macOS 26 — daemon que nunca responde, sem erro. O
   runtime é o colima.
2. **`~/.docker/config.json` tem `credsStore: desktop`** e o `docker` tenta chamar o ajudante
   de credenciais que não existe mais. O ensaio usa `DOCKER_CONFIG` próprio.
3. **O CLI publica em `0.0.0.0`** e diz isso em letras pequenas ao subir. Veja o `override.yaml`
   acima.
4. **Os privilégios padrão divergem, e as migrations não os declaram.** Produção nasceu com o
   padrão antigo do Supabase (ALL para `anon`, `authenticated` e `service_role` em toda tabela
   nova do `public`, EXECUTE em função) e a RLS é quem protege. O CLI atual cria o banco com o
   padrão novo, que não expõe nada à API: um banco feito só das migrations responde
   `permission denied for table edicoes_ia`. O `privilegios.sql` replica o modelo de produção
   depois do reset — inclusive o `alter default privileges`, que é o que faz a tabela criada
   pela candidata nascer com as mesmas ACLs que teria lá. Declarar os GRANTs nas migrations
   (ADR 0011) é decisão do dono, e está em aberto.
5. **Os nomes de `supabase start -x` do `--help` estão velhos.** `analytics`, `inbucket`,
   `storage` e `meta` não excluem nada — o CLI só avisa e sobe tudo. Os nomes que valem
   aparecem no próprio aviso (`logflare`, `mailpit`, `storage-api`, `postgres-meta`…), e o
   `subir.sh` repassa o aviso se o CLI recusar algum.
6. **`-x` só vale quando a pilha sobe de verdade.** Com os contêineres já de pé, o
   `supabase start` é no-op e o serviço a mais continua lá — o `subir.sh` avisa quando é esse o
   caso. Para valer: `descer.sh --apagar`.
7. **Uma instrução sozinha não abre transação implícita.** `create index concurrently` num
   arquivo de uma instrução **passa** — aqui e em produção. Com duas ou mais, o Postgres recusa
   ("cannot run inside a transaction block"). É por isso que a varredura acusa em vez de
   confiar na aplicação: o risco não é a instrução falhar, é a migração deixar de ser atômica
   sem ninguém notar.
8. **O teto do argumento é 128 KiB.** A aplicação numa consulta só passa o arquivo inteiro como
   argumento do `psql` dentro do contêiner, e o Linux para em 128 KiB por argumento. O
   `ensaiar.sh` recusa antes.
9. **Coluna nova em `edicoes_ia` move o hash das 7 edições** no retrato: a linha mudou de forma.
   É verdade, não ruído — e é o que a 1.9 vai mostrar.
10. **Produção liga RLS sozinha em tabela nova do `public`** (gatilho `ensure_rls`, da
    plataforma). O ensaio **não** replica: é rede a mais lá, não a menos. Tabela que a candidata
    criar sem `enable row level security` explícito aparece sem RLS aqui e com RLS em produção —
    e a varredura avisa quando isso acontece.
11. **O PostgREST guarda em cache o que enxerga.** Depois dos GRANTs — e **depois** de ele
    responder 200, senão o aviso se perde no reinício — o ensaio manda
    `notify pgrst, 'reload schema'`. Sem isso a prova de RLS pode reprovar por cache velho, e o
    diagnóstico apontaria para privilégio, que já está certo.
12. **Marca de comando não é instrução.** O `psql` imprime uma marca por instrução que roda
    (`ALTER TABLE`, `CREATE INDEX`…), mas `SELECT` devolve a tabela e `(N rows)`, e instrução
    que falha não deixa marca nenhuma. O número que o ensaio mostra é o de marcas, e ele serve
    para uma pergunta só: *alguma coisa chegou a rodar antes do erro?*
13. **Cache de fidelidade é fidelidade de mentira.** A versão do Postgres e o papel que executa
    são lidos de produção **a cada corrida** — houve uma versão deste ensaio que guardava isso
    em disco, e nela "conferido contra produção" valia uma vez por pasta e nunca mais.

## O que fica no disco quando você para

`descer.sh` **sem** `--apagar` deixa tudo isto para trás, por tempo indeterminado:

| O quê | Onde | O que tem dentro |
|---|---|---|
| o volume do Postgres | `supabase_db_vitale`, no colima | os **textos reais das sete edições**, num banco de senha padrão `postgres` |
| o catálogo de produção | `$ENSAIO_DIR/paridade-prod.txt` | o schema inteiro do `public` de produção: colunas, policies, ACLs |
| os retratos | `$ENSAIO_DIR/retratos/` | catálogo e hashes de cada corrida (sem texto, sem UUID) |
| a pasta de trabalho | `$ENSAIO_DIR/workdir/` | config do CLI e as chaves padrão locais |
| o log das consultas | `$ENSAIO_DIR/prod-consultas.log` | as consultas feitas a produção — nenhum dado de usuário |

A pasta é `700`, e a guarda de portas cuida da rede enquanto a pilha está de pé; nenhuma das
duas cuida do disco depois. **Ao terminar o trabalho, use `descer.sh --apagar`**: o volume some,
a pasta é limpa, e o que fica é só o log — que é relido, linha a linha, antes de o resto sumir.
Guarde o volume só enquanto estiver no meio de um ensaio.

## Depois do ensaio

A candidata aprovada vira uma migration de verdade: arquivo em `supabase/migrations/` com a
versão no nome, como manda a ADR 0011. E há uma pegadinha na hora de aplicar:

> **Aplicar pela Management API não registra nada em `supabase_migrations.schema_migrations`.**
> A versão precisa ser inserida **à mão** lá, no mesmo passo. Sem isso, a migration continua
> "pendente" para sempre — o `preparar.sh` vai deixá-la fora da base em todo ensaio seguinte, e
> um `db push` futuro tentaria re-executá-la.

## O que o ensaio não cobre

- As cinco divergências reais entre produção e as migrations — o `pg_cron` habilitado pelo
  dashboard, o `pg_net` morando em `public` lá e em `extensions` aqui, a tabela
  `health_daily_vfc_backup_20260904` feita à mão, o default de `user_preferences.blur_intensity`
  (100 lá, 50 na migration) e o gatilho `ensure_rls`. Estão em `divergencias-conhecidas.txt`, em
  grupos, cada uma com o motivo — e nenhuma toca a 1.9.
- **Migração de dados.** O banco do ensaio tem as 7 edições e mais nada: o retrato compara
  contagem e hash de conteúdo de toda tabela do `public`, mas todas as outras estão vazias.
  Uma migração que reescreve linha (backfill, `update … set`) aplica aqui sem provar nada sobre
  o que faria com as 4.385 linhas de `health_daily` lá.
- **SQL dinâmico.** Objeto criado dentro de `DO $$…$$` ou por `execute format()` é invisível
  para a varredura — o corpo é retirado antes da análise. O ensaio **avisa** quando vê SQL
  dinâmico, e o retrato antes × depois ainda pega o objeto; o que fica de fora é a lista de
  objetos criados e, com ela, o ponta a ponta deles.
- **RLS entre dois donos.** O ensaio tem **um** usuário (a carga das edições exige dono único),
  então ele prova "o dono lê, o anônimo não" — e nunca "o usuário A não lê a linha do usuário
  B", que é a outra metade do que uma policy `auth.uid() = user_id` promete.
- Alguns detalhes de catálogo continuam fora da paridade: parâmetros de sequência
  (`increment`, `start`, `cache`), `comment on` de tabela e coluna, `storage`/`compression` de
  coluna, **privilégio de coluna** (`grant (col) on tabela`) e o ACL de view, matview e
  sequência — a linha `acl` os mostra, mas os REVOKE derivados cobrem só tabela e função. E o
  ensaio olha o `public`: `auth` e `storage` ficam fora.
- As classes `view`, `matview` e `type` da paridade medem **0 × 0** hoje: o schema não tem
  nenhum desses objetos. Elas existem na consulta, mas só provam alguma coisa no dia em que
  uma migração criar o primeiro — até lá, verde ali é ausência, não conferência.
- O `supabase db push`, que aplica instrução por instrução. O ensaio replica a **Management
  API**, que é por onde esta migração vai.
- Volume e latência de produção: aqui há 7 edições e um usuário.
- A varredura é um analisador **léxico**, não um parser de SQL: ela tira comentários, literais e
  corpos `$$…$$` e olha a primeira palavra de cada instrução. Comentário de bloco **aninhado**
  (que o Postgres aceita) e quoting exótico podem enganá-la. A aplicação de verdade é a segunda
  rede — e o retrato antes × depois, a terceira.
- E, principalmente, **se a candidata está certa**. O ensaio prova que ela aplica, que falha
  limpo e o que ela muda no catálogo. O que ela *devia* mudar continua sendo julgamento.
