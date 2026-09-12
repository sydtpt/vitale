---
title: 'O ensaio da migração — um Supabase local fiel a produção, reproduzível'
type: 'chore'
created: '2026-09-11'
status: 'done'
review_loop_iteration: 0
baseline_commit: '1fc9ae114ff655c34ac295051791050b0f9cde9f'
context:
  - '{project-root}/skills/test-artifacts/test-design-epic-1.md'
  - '{project-root}/docs/decisions/0011-schema-mora-em-migrations.md'
---

<frozen-after-approval reason="human-owned intent — renegotiated by the owner on 12/09/2026, after the third review: o terceiro desfecho da guarda de portas e a reprovação da tabela nova legível pelo anônimo">

## Intent

**Problem:** A 1.9 é a migração de maior risco da frente (risco 9, instância única, sem staging), e o único nível de teste que ela tem é ensaiar fora de produção (T-2 do test design). Hoje não dá: o Docker da máquina não roda, um banco feito só das migrations não tem os privilégios de produção (o app não lê tabela nenhuma), e o CLI está linkado com produção.

**Approach:** Scripts em `supabase/ensaio/` que sobem um Supabase local a partir das migrations que produção já registrou, replicam os privilégios de produção, carregam as edições reais lidas de produção sob um usuário local, provam a paridade e ensaiam uma migração candidata do jeito que produção a recebe — o arquivo inteiro numa chamada só.

## Boundaries & Constraints

**Always:**
- Produção só é lida: uma instrução `select`/`with` por chamada, sem `;` interno, dentro de `begin transaction read only; …; commit;`, pela Management API com o token do keychain (o de `check-schema-drift.sh`). Consulta fora disso é recusada antes da rede.
- Todo comando do Supabase CLI roda numa pasta de trabalho temporária **sem link**: `config.toml` e migrations por link simbólico, e só `.temp/postgres-version` copiado (a imagem de produção); `--local` onde o comando aceita. Rodar o ensaio não muda o `git status` do repositório.
- A linha de base é o conjunto que produção registrou em `supabase_migrations.schema_migrations`. Arquivo do repo fora dele é **pendente**: fica fora da base e é listado. Versão registrada sem arquivo no repo aborta.
- Nenhuma porta do ensaio escuta fora de `127.0.0.1` — conferido depois de subir; se escutar, derruba e aborta.
- As edições entram sob o usuário local `ensaio@orbe.local`; o `user_id` de produção não é lido.
- A candidata é aplicada como a Management API aplica: o arquivo inteiro numa única consulta simples (uma transação implícita). Antes, o script acusa o que não roda em transação (`concurrently`, `vacuum`, controle de transação explícito).
- Docker pelo colima, com `DOCKER_CONFIG` próprio do ensaio.

**Ask First:**
- Mudar qualquer arquivo de `supabase/migrations/` ou o `config.toml`.
- Qualquer escrita em produção, de qualquer tamanho.
- Mudar configuração da máquina além do que o README documenta.

**Never:**
- `supabase db push`, `supabase link`, `--linked`, ou `--db-url` apontando para produção.
- Texto de edição, UUID de usuário ou token de produção no repositório ou em log.
- GRANT nas migrations (adiado pelo dono) e a migração da 1.9 em si.

## I/O & Edge-Case Matrix

| Cenário | Entrada / Estado | Esperado | Erro |
|---|---|---|---|
| Subir | colima de pé, pilha parada | pilha em PG 17.6, só em 127.0.0.1 | porta fora de 127.0.0.1 → derruba a pilha e sai ≠ 0; **não deu para medir** (porta publicada sem ninguém escutando) → mantém a pilha de pé e sai ≠ 0 |
| Preparar | pilha de pé | reset na base; privilégios; 7 edições; paridade sem divergência fora da lista conhecida; os 7 textos no `.md`; dono vê 7, anônimo 0 | divergência nova → sai ≠ 0 com o diff |
| Pendente | arquivo no repo que produção não registrou | fora da base, listado | N/A |
| Base impossível | versão registrada sem arquivo | — | aborta nomeando a versão |
| Candidata boa | arquivo que acrescenta uma coluna | aplica; mostra o diff de catálogo antes × depois | N/A |
| Falha no meio | a boa com `--falhar-no-fim` | erro, e catálogo e edições idênticos ao antes | — |
| Tabela nova aberta | candidata cria tabela no `public` e o anônimo lê linha dela | **reprova** — o ensaio é mais rigoroso que produção, onde o gatilho da plataforma ligaria RLS sozinho: a migração tem de ligá-la | sai ≠ 0 |
| Não transacional | `create index concurrently` | acusada antes; a aplicação falha sem mudar nada | sai ≠ 0 |
| Leitura suspeita | consulta com `;` ou que não começa por `select`/`with` | — | recusada antes da rede |
| Produção inalcançável | token ausente ou API fora | — | mensagem clara, sai ≠ 0, nada local pela metade |

</frozen-after-approval>

## Code Map

- `supabase/ensaio/lib.sh` -- o ambiente e as guardas: `prod_ler` (leitura em transação read only, com log), `sb` (CLI sem link), `portas_conferir`, `versao_conferir` (versão e papel conferidos **contra produção**), `retrato`, `mascarar`, a trava e a pasta do ensaio. Sem shebang: só é `source`ado
- `supabase/ensaio/subir.sh` · `preparar.sh` · `ensaiar.sh` · `descer.sh` -- os quatro comandos
- `supabase/ensaio/paridade.sql` · `privilegios.sql` · `divergencias-conhecidas.txt` -- a consulta de catálogo e ACL (sem `;`, hash de função sem espaço em branco), o modelo de privilégios de produção e as divergências aceitas, em grupos
- `supabase/ensaio/README.md` -- requisitos, comandos, o que cada checagem prova, 11 armadilhas, "depois do ensaio" e o que o ensaio não cobre
- *(origem)* os protótipos de 11/09 viveram no scratchpad da sessão (`sb.sh`, `sonda-workdir.sh`, `versoes.sh`, `prod-q.sh`, `paridade.sql`, `acl.sql`, `privilegios.sql`, `carregar-edicoes.sh`, `ponta-a-ponta.sh`, `sonda-readonly.sh`) e foram absorvidos pelos arquivos acima; o scratchpad some com a sessão
- `supabase/scripts/check-schema-drift.sh` -- precedente de token do keychain e Management API; continua existindo
- `supabase/.temp/postgres-version` (`17.6.1.121`) -- copiar; `supabase/.temp/project-ref` -- o link com produção, **nunca** copiar
- `supabase/config.toml:15` -- `project_id = "vitale"`: nomes dos contêineres e do volume; um ensaio por vez
- `supabase/migrations/20260711120000_linked_accounts.sql:76` -- o único REVOKE que os privilégios repetem
- `docs/specs/revista-retrospectiva/primeiras-edicoes-prompt-v2.md` -- os 7 textos
- `skills/test-artifacts/test-design-epic-1.md:100-116,337` -- T-2 e R-25: o que o ensaio prova
- `.gitignore` -- não ignora `supabase/.branches/`, que o CLI cria se rodado na raiz

## Tasks & Acceptance

**Execution:**
- [x] `supabase/ensaio/lib.sh` -- ambiente do colima, `DOCKER_CONFIG` próprio, pasta de trabalho sem link com a base de produção, `prod_ler` read only (cada consulta vai para um log da pasta de trabalho), `local_psql`, chaves padrão locais -- as guardas num lugar só
- [x] `supabase/ensaio/subir.sh` e `descer.sh` -- sobe pela pasta de trabalho e confere porta e versão; desce mantendo o volume, ou `--apagar`
- [x] `supabase/ensaio/preparar.sh` + `privilegios.sql` + `paridade.sql` + `divergencias-conhecidas.txt` -- reset, privilégios, usuário e edições, paridade de catálogo e de ACL (hash de função sem espaço em branco), textos no `.md`, ponta a ponta. As divergências conhecidas saem de `paridade.diff`, `acl-prod.txt` e `acl-local.txt` do protótipo, cada uma com o motivo numa linha
- [x] `supabase/ensaio/ensaiar.sh` -- varredura, retrato antes, aplicação numa consulta, retrato depois, `--falhar-no-fim`
- [x] `supabase/ensaio/README.md` -- requisitos (colima e o `override.yaml` das portas), os comandos, o que cada checagem prova, as armadilhas
- [x] `.gitignore` -- `supabase/.branches/`

**Acceptance Criteria:**
- Given colima de pé e a pilha parada, when `subir.sh && preparar.sh` roda, then sai 0 e o `git status` do repositório é o mesmo de antes.
- Given o ensaio inteiro, when as chamadas à Management API são registradas, then todas são leitura em transação read only.
- Given a candidata de teste com `--falhar-no-fim`, when `ensaiar.sh` roda, then catálogo e as 7 edições ficam idênticos ao antes — a prova do rollback limpo (R-25).

## Spec Change Log

**2026-09-12 — três ajustes de implementação, nenhum de intenção.**

- **A linha "Não transacional" da matriz vale para arquivo com mais de uma instrução.**
  Medido: `create index concurrently` **sozinho** num arquivo **aplica** — aqui e em produção
  —, porque consulta simples com uma instrução só não abre transação implícita. Com duas ou
  mais, o Postgres recusa ("cannot run inside a transaction block") e nada muda, como a
  matriz previa. Os dois casos foram exercitados. O `ensaiar.sh` acusa na varredura e sai
  ≠ 0 nos dois, e a armadilha nº 7 do README explica por que o risco real é a migração
  deixar de ser atômica, não a instrução falhar.
- **As chaves locais saem do `supabase status`, não de um literal no `lib.sh`.** Continuam
  sendo as chaves padrão do desenvolvimento local — públicas, iguais em toda máquina —, mas
  lidas do CLI em vez de copiadas para o repositório: um JWT de `service_role` versionado
  tropeça em varredura de segredo e envelhece junto com o CLI.
- **A paridade ganhou os gatilhos de evento**, que não estavam no protótipo. Foi por eles que
  apareceu o `ensure_rls`: **produção liga RLS sozinha em tabela nova do `public`**. Entrou
  na lista de divergências conhecidas com o motivo, porque muda o que a candidata da 1.9 vê
  aqui e lá — aqui a tabela nova nasce sem RLS, lá com.

**2026-09-12 — rodada 1 de revisão: 35 remendos, nenhum de intenção.** O que mudou de
substância, e não só de rigor:

- **Evidência que podia mentir.** O retrato da base era gravado *antes* do portão: base
  infiel virava referência, e o `ensaiar.sh` seguinte não via diferença nenhuma. Agora o
  retrato só é gravado se tudo passar, vai **carimbado**, e o `ensaiar.sh` **reprova** (não
  avisa) quando ele falta, não tem carimbo, ou o banco saiu da base. Medido antes do
  conserto: com `ENSAIO_DIR` novo, uma corrida `--falhar-no-fim` imprimia o aviso e saía 0
  dizendo "rollback limpo".
- **A prova do R-25 passava com candidata vazia.** Um arquivo só de comentário dava "0
  instruções" e "rollback limpo". Agora candidata sem instrução é recusada, e o
  `--falhar-no-fim` conta as marcas de comando que o psql imprimiu: sem instrução que rodou,
  o rollback não foi exercitado, e o veredito diz isso.
- **A paridade prometia mais do que media.** A linha de extensão não levava o schema — e
  medido em produção: o `pg_net` mora no `public` lá e em `extensions` aqui, e as duas linhas
  saíam idênticas. A linha de coluna vinha do `information_schema` (`numeric(10,2)` e
  `numeric` iguais, `text[]` e `integer[]` virando "ARRAY", enum virando "USER-DEFINED"): agora
  sai do `pg_attribute` com `format_type`, posição, identidade e generated. A de RLS ganhou
  `forced` e dono; entraram tipos (enum com rótulos e domínios) e matviews; e o retrato ganhou
  **hash do conteúdo** de cada tabela.
- **A lista de conhecidas** aceita `*` no fim como prefixo (senão o patch de uma extensão vira
  divergência nova), agrupa o motivo em cabeçalho e traz escrito o procedimento para
  acrescentar uma linha.
- **Guardas que não guardavam:** `--linked=true` passava pelo filtro do CLI; as variáveis
  `SUPABASE_*` do ambiente não eram limpas; o `override.yaml` era conferido por linhas soltas,
  que podiam estar em regras diferentes; a marca `.orbe-ensaio` era criada sempre, então nunca
  protegia pasta alheia; não havia trava contra dois ensaios; a versão e o papel eram
  conferidos contra um arquivo, não contra produção.
- **Fidelidade do que a 1.9 vai fazer:** a metade dos privilégios padrão que só uma tabela
  nova exercita passou a ter candidata de teste própria, e o diff prova que a tabela nasce com
  `anon`/`authenticated`/`service_role` como em produção. A varredura avisa quando a candidata
  cria tabela no `public` sem RLS, que é a única diferença de comportamento conhecida entre os
  dois lados.

**2026-09-12 — rodada 2 de revisão: 31 remendos, incluindo uma regressão da rodada 1.**

- **A fidelidade não estava amarrada no tempo.** O conserto da rodada 1 ("versão e papel
  conferidos contra produção") virou um cache em disco na mesma entrega: medido, o
  `versao_conferir` passava com **zero** chamadas a produção, e passava igual com o cache
  adulterado. Agora não há cache: cada corrida lê, e a conferência reprova se a leitura não
  tiver acontecido nela. No mesmo espírito, o `ensaiar.sh` — que **não falava com produção em
  nenhum momento** — relê as versões registradas e reprova quando elas não batem com o carimbo
  da base, que ganhou contagem, hash e a lista de migrations pendentes.
- **O caminho do app não era reexercitado depois da candidata**, e é justamente ali que a
  tabela nova aparece: sem RLS (produção liga sozinha) e com ALL para `anon` (o padrão de
  privilégio de produção). O bloco ponta a ponta subiu para a `lib.sh` e roda também no fim do
  `ensaiar.sh`, por tabela criada. Medido: uma candidata que cria tabela **com linha dentro**
  passa em tudo e é pega exatamente ali — o anônimo lê a linha.
- **A janela do critério "o git status não muda"** cobria só o `preparar.sh`, e o
  `supabase start` acontece fora dela. Pior: a linha que esta entrega pôs no `.gitignore`
  escondia do `--porcelain` justamente a sujeira proibida. Os três comandos passaram a medir, e
  a medição inclui os ignorados de dentro de `supabase/`.
- **O critério "toda chamada é leitura" não podia testemunhar a própria violação**: o log é
  escrito pela `prod_ler`. Agora o host da API mora numa variável só e uma autoconferência
  recusa qualquer script do ensaio que o cite por fora.
- **Evidência que ainda podia mentir:** o retrato da base só era apagado no ramo macio (aborto
  duro deixava o carimbo da corrida anterior descrevendo um banco que já não existia); o
  `retrato()` engolia falha do psql, e retrato curto comparado com retrato curto diz "nada
  mudou"; a contagem de "instruções que rodaram" contava qualquer linha em caixa alta; e a
  conferência dos textos aceitava texto vazio, porque em jq `contains("")` é sempre verdadeiro.
- **Paridade e lista de conhecidas:** o curinga `*` comia o schema da extensão — a divergência
  que motivou pôr o schema na linha —, então o campo mudou de ordem (`ext <nome> @ <schema>
  <versão>`) e o curinga passou a comer só a versão; em troca, os objetos **da plataforma**
  (`rls_auto_enable`, `ensure_rls`), que a Supabase muda sem avisar, passaram a usar curinga.
  Entraram `permissive` na policy, `indisvalid` no índice e o dono na função. E os REVOKE do
  `privilegios.sql` deixaram de ser nome fixo: saem do ACL que produção acabou de mostrar.

**2026-09-12 — rodada 3 de revisão: 24 remendos, duas emendas do dono, e o fim da revisão.**

- **O pior achado era sobre o caso exato da 1.9.** Tabela criada com RLS ligada e sem policy —
  que é o estado que produção produz sozinha, pelo gatilho `ensure_rls` — tem linha no banco e
  zero na API. O ponta a ponta chamava isso de "tabela vazia" e o ensaio saía **0**. Agora a
  contagem esperada vem do retrato da própria corrida (`linhas <t> <n>`) e o dono lendo menos
  do que o banco tem **reprova**, nomeando a causa. Medido antes e depois no mesmo arquivo.
- **Duas emendas de contrato, do dono** (e o bloco congelado foi emendado por ele): a guarda de
  portas passou a ter **três desfechos** — tudo em loopback, exposição (derruba a pilha) e
  "não deu para medir" (reprova **sem** derrubar; repasse lento do colima não custa a pilha) —,
  e **tabela nova legível pelo anônimo REPROVA de propósito**, mesmo sabendo que em produção o
  gatilho da plataforma ligaria a RLS: o ensaio não aprova o que depende de rede alheia para
  ser seguro.
- **Guardas que ainda não guardavam:** a guarda de leitura procurava o host por extenso e não
  via a chamada montada pela variável — a forma que a própria `prod_ler` usa; o log, vendido
  como prova de que só houve leitura, nunca era relido; nome de objeto entre aspas virava dois
  nomes e dois 404 relatados como "não deu para medir"; `contar_rest` sem `Content-Range`
  imprimia "o anônimo LÊ  linha(s)", sem número; a guarda de portas não rodava depois do
  `db reset`, que reinicia quem publica porta; carimbo com data ilegível virava idade zero; e
  candidata que aplica e não muda nada passava como ensaio válido.
- **Cobertura barata que faltava:** view e matview entram no ponta a ponta (nascem com ALL para
  `anon` igual às tabelas); os REVOKE derivados cobrem função além de tabela; a varredura avisa
  quando a candidata cria tabela **sem policy nenhuma**, e quando há **SQL dinâmico**, que ela
  não enxerga; leitura truncada do catálogo de produção é conferida contra um `count(*)` da
  mesma consulta; e o piso do retrato passou a sair da base carimbada, não de um número
  inventado.
- **Critério de parada, decidido pelo dono.** Três rodadas seguidas acharam defeito da mesma
  classe — *guarda que não guarda* —, e em shell isso é estrutural: cada guarda é código que
  precisa de outra guarda. A saída escolhida foi **consertar os buracos reais e declarar os
  limites** em vez de reescrever a ferramenta noutra linguagem. O que sobra está escrito no
  README, em "o que o ensaio não cobre": migração de dados, SQL dinâmico, RLS entre dois donos,
  privilégio de coluna, ACL de view/matview/sequência, e as três classes de paridade que hoje
  medem 0 × 0.

## Design Notes

**Quatro armadilhas, cada uma paga no protótipo.** O Docker Desktop 3.6 morre calado no macOS 26 → colima. O `~/.docker/config.json` tem `credsStore: desktop` → `DOCKER_CONFIG` próprio. O CLI publica em `0.0.0.0` e o colima repassava para a rede, com senha padrão → `~/.colima/_lima/_config/override.yaml` manda para `127.0.0.1` (o `ip` do dockerd não basta). O CLI novo não expõe tabela à API → privilégios de produção depois do reset.

**Por que sem link.** O projeto está linkado com produção, e `db reset --linked` a apagaria. Sem `project-ref` na pasta de trabalho, o erro de digitação não tem para onde ir.

**Por que uma consulta só.** A Management API executa o arquivo como uma consulta simples, e o Postgres roda consulta simples com várias instruções como **uma** transação implícita — e recusa `concurrently` dentro dela. `psql -c "<arquivo inteiro>"` tem a mesma semântica; `-f` não.

## Verification

**Commands:**
- `bash -n supabase/ensaio/*.sh` -- expected: sem erro de sintaxe
- `supabase/ensaio/descer.sh --apagar && supabase/ensaio/subir.sh && supabase/ensaio/preparar.sh` -- expected: sai 0; `git status` inalterado
- `supabase/ensaio/ensaiar.sh` com uma candidata de teste escrita num diretório temporário (fora do repo), que acrescenta uma coluna, e de novo com `--falhar-no-fim` -- expected: aplica; depois, erro e retrato idêntico
- Candidata com `create index concurrently`; consulta de produção com `;`; a guarda de porta exercitada sem mexer na máquina (por exemplo, apontando para um `override.yaml` inexistente) -- expected: cada um recusado, sai ≠ 0
- **Candidata que CRIA TABELA** (a metade dos privilégios que só a tabela nova exercita, como a da 1.9) -- expected: aplica, e o diff traz a linha `acl <tabela> anon=… authenticated=… service_role=…`, prova de que o `alter default privileges` do `privilegios.sql` vale para o que a candidata criar; e a varredura avisa que ela nasce sem RLS, que em produção o `ensure_rls` ligaria
- Candidata **sem instrução nenhuma** (só comentário); `ensaiar.sh` com o banco fora da base preparada; `ensaiar.sh` sem retrato de base -- expected: cada um recusado, sai ≠ 0 (os três "provavam" rollback limpo antes da rodada 1 de revisão)
- Pasta de ensaio preexistente sem a marca; `ENSAIO_DIR` relativo; segunda corrida com a trava presa (dono vivo e dono morto dão mensagens diferentes); `override.yaml` com as duas metades da regra em entradas diferentes, com `hostPortRange` estreito, e com o `127.0.0.1` só num comentário; argumento inesperado nos scripts -- expected: cada um recusado, sai ≠ 0
- **A segunda guarda da `prod_ler`**: `with x as (delete from … returning 1) select count(*) from x` -- expected: passa pela guarda de texto (começa por `with`, não tem `;`) e morre na transação read only, com `25006 cannot execute SELECT in a read-only transaction`. É a guarda que sustenta "produção só é lida", e a única cujo caso não estava listado
- **A base amarrada no tempo**: carimbo adulterado para outra contagem de versões; carimbo velho; `ensaiar.sh` com a base fora do lugar -- expected: o primeiro reprova ("produção registrou outra coisa desde a base"), o segundo avisa, o terceiro reprova. E o `ensaiar.sh` acrescenta 2 leituras ao log a cada corrida — antes da rodada 2 ele não falava com produção nenhuma vez
- **Candidata que cria tabela COM linha dentro** -- expected: aplica, e o caminho do app reexercitado acusa que o anônimo lê a linha (a tabela nasce sem RLS aqui e com ALL para `anon`), saindo ≠ 0
- **Candidata que cria tabela, LIGA RLS e insere linha** (o estado que produção produz sozinha para a tabela da 1.9: RLS ligada pelo gatilho, nenhuma policy) -- expected: o retrato diz `linhas <t> 1`, o dono lê 0, e o ensaio REPROVA nomeando a causa. Antes da rodada 3 isto saía 0, com a mensagem "tabela vazia"
- **Candidata com nome entre aspas, com espaço e maiúscula, e uma view no mesmo arquivo** -- expected: o nome chega inteiro do outro lado (sem 404), e a view entra no ponta a ponta junto com a tabela
- **Candidata que aplica e não muda nada** (`select 1`), e **candidata com SQL dinâmico** (`do $$ … execute format(…) … $$`) -- expected: a primeira é reprovada como no-op; a segunda avisa que o ensaio não enxerga o que nasce no corpo, e o retrato antes × depois mostra o objeto assim mesmo
- **Script do ensaio que fala com a rede por fora da `prod_ler`**, montando a URL pela variável; **log adulterado** com uma entrada que não é leitura, e com linha que não é JSON -- expected: cada um recusado, sai ≠ 0. São as duas provas que o próprio ensaio vende (só leitura, e o log como prova) e que ninguém conferia
- **Os dois casos da matriz que faltavam:** base impossível (versão registrada em produção sem arquivo no repositório) -- expected: aborta nomeando a versão, **antes** de tocar no banco local; e produção inalcançável (token ausente no keychain) -- expected: mensagem clara, sai ≠ 0, nada local pela metade

## Suggested Review Order

**A porta para produção**

- A entrada: uma instrução, em transação read only, e cada chamada no log antes da rede.
  [`lib.sh:657`](../../supabase/ensaio/lib.sh#L657)

- Ninguém fala com produção por fora: varre nomes e `curl`, não o host literal.
  [`lib.sh:166`](../../supabase/ensaio/lib.sh#L166)

- O log é relido linha a linha — prova conferida, não só arquivada.
  [`lib.sh:186`](../../supabase/ensaio/lib.sh#L186)

**O banco local é mesmo o de produção?**

- Tudo o que vem de produção é lido antes de o banco local ser tocado.
  [`preparar.sh:51`](../../supabase/ensaio/preparar.sh#L51)

- A base é o que produção registrou; o que o repositório tem a mais é pendente.
  [`preparar.sh:82`](../../supabase/ensaio/preparar.sh#L82)

- Os privilégios de produção — o achado que motivou o ensaio inteiro.
  [`preparar.sh:139`](../../supabase/ensaio/preparar.sh#L139)

- Paridade de catálogo e de ACL, contra a lista de divergências aceitas.
  [`preparar.sh:241`](../../supabase/ensaio/preparar.sh#L241)

- A consulta que define o que "igual" quer dizer.
  [`paridade.sql:1`](../../supabase/ensaio/paridade.sql#L1)

- O que se aceita diferente, cada linha com o motivo e o procedimento no topo.
  [`divergencias-conhecidas.txt:1`](../../supabase/ensaio/divergencias-conhecidas.txt#L1)

- Versão e papel conferidos contra produção a cada corrida, sem cache.
  [`lib.sh:374`](../../supabase/ensaio/lib.sh#L374)

**O ensaio da candidata**

- A varredura: o que não roda dentro da transação implícita, e por quê.
  [`ensaiar.sh:94`](../../supabase/ensaio/ensaiar.sh#L94)

- A aplicação numa consulta simples — a semântica da Management API.
  [`ensaiar.sh:272`](../../supabase/ensaio/ensaiar.sh#L272)

- Depois de aplicar, o caminho do app é refeito sobre o que a candidata criou.
  [`ensaiar.sh:299`](../../supabase/ensaio/ensaiar.sh#L299)

- Dono e anônimo contra a contagem do retrato: tabela que ninguém lê reprova.
  [`lib.sh:626`](../../supabase/ensaio/lib.sh#L626)

- O retrato: catálogo, ACL, contagem e conteúdo por tabela, com piso aferido.
  [`lib.sh:485`](../../supabase/ensaio/lib.sh#L485)

**As guardas da máquina**

- A regra do colima que prende as portas no 127.0.0.1, validada inteira.
  [`lib.sh:280`](../../supabase/ensaio/lib.sh#L280)

- Três desfechos: tudo em loopback, exposição (derruba) e falha de medição.
  [`lib.sh:312`](../../supabase/ensaio/lib.sh#L312)

- O CLI só roda sem link, e recusa o que falaria com produção.
  [`lib.sh:228`](../../supabase/ensaio/lib.sh#L228)

- A pasta do ensaio, a marca que protege o `--apagar`, e a trava.
  [`lib.sh:102`](../../supabase/ensaio/lib.sh#L102)

**Periféricos**

- Subir, com a janela de `git status` fechada por máquina.
  [`subir.sh:1`](../../supabase/ensaio/subir.sh#L1)

- Descer, mantendo o volume ou apagando tudo menos o log.
  [`descer.sh:1`](../../supabase/ensaio/descer.sh#L1)

- O runbook: requisitos, o que cada checagem prova, as armadilhas e o que não cobre.
  [`README.md:1`](../../supabase/ensaio/README.md#L1)
