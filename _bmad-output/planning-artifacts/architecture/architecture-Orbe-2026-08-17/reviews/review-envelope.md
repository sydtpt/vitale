---
lens: envelope operacional e de segurança (ad-hoc)
target: ARCHITECTURE-SPINE.md — Orbe, altitude initiative, purpose build-substrate
date: 2026-08-18
method: leitura das migrations, do código dos dois apps e das edge functions. Nenhuma conexão a banco.
verdict: estrutura de código sólida; três dimensões operacionais inteiras em silêncio às vésperas da publicação do web
---

# Reviewer Gate — Lente: envelope operacional e de segurança

## Veredito

A espinha é forte no eixo que escolheu — fronteira núcleo/adaptador, dono de vocabulário, contrato
de schema — e tem **um** eixo operacional resolvido de verdade (disciplina de migration), mas
resolvido *fora* dela. Das seis dimensões de envelope que uma espinha de altitude *initiative* com
publicação iminente precisa ter decidido, duas estão decididas, uma está diferida com condição
escrita, e **três estão em silêncio total**: caminho de escrita, falha/observabilidade e backup.
O silêncio não é neutro em nenhuma das três — em cada uma existe hoje uma divergência concreta
entre web e mobile que a espinha permite e não vê.

| # | Dimensão | Estado | Achados |
|---|---|---|---|
| 1 | Autenticação e autorização | **Parcialmente decidida** — execução exemplar, invariante ausente | E1 (high), E2 (low) |
| 2 | Deploy e ambientes | **Diferida** — mas uma condição de revisita já venceu | E3 (high), E4 (medium), E5 (medium) |
| 3 | Disciplina de schema/migration | **Decidida** — a melhor coberta do repositório | E6 (medium) |
| 4 | Escrita offline / fila / conflito | **Silenciosa** | E7 (high), E8 (medium) |
| 5 | Falha, erro e observabilidade | **Silenciosa** (com uma convenção de fato não escrita) | E9 (medium) |
| 6 | Dado e backup | **Silenciosa** — silêncio total | E10 (high) |

Severidades: 4 high · 5 medium · 1 low · 0 critical. Nada vaza dado hoje; o que existe é margem
para que passe a vazar, quebrar ou sumir sem que nada acuse.

---

## Dimensão 1 — Autenticação e autorização

**Estado: parcialmente decidida.** A execução está correta e verificada. A garantia para o
*próximo* objeto não existe.

### Cobertura real de RLS — verificada, sem lacuna

A suspeita levantada no briefing (21 tabelas criadas, 14 com RLS) **não se confirma**. Varredura
das migrations com regex tolerante a multi-linha e ao prefixo `public.`:

- **21 tabelas criadas** em `supabase/migrations/`.
- **21 com `enable row level security`** — cobertura de 100%, zero faltantes.
- **20 com pelo menos uma policy**; a única sem policy é `linked_account_secrets`.
- **Todas as policies são por usuário.** Sem exceção permissiva: `for all using (auth.uid() =
  user_id) with check (auth.uid() = user_id)` nas 17 tabelas com coluna `user_id`; `auth.uid() =
  id` nas três chaveadas em `auth.users.id` (`user_profiles`, `user_preferences`, `profiles`).
  Nenhuma policy `using (true)`, nenhuma sem predicado, nenhuma concedida a `anon`.
- `linked_accounts` tem grão deliberado — `for select` e `for delete` apenas, sem insert/update
  pelo client (a escrita é da edge function). Correto.
- `linked_account_secrets` tem RLS ativa e zero policy = **deny-all**, reforçado por
  `revoke all on public.linked_account_secrets from anon, authenticated`
  (`20260711120000_linked_accounts.sql:76`). Intencional e bem-feito.
- **Todas as 12 funções RPC são `security invoker`** — `sync_upsert_activities`,
  `sync_upsert_health_daily`, `habit_log_add`, `habit_log_set`, `todo_resolve`,
  `activity_metric_baseline` e as auxiliares. Nenhum `security definer` no repositório, portanto
  nenhum caminho de escape de RLS pelo lado das funções. O único client de service role
  (`supabase/functions/_shared/admin.ts`) está confinado às edge functions e carrega no cabeçalho
  a obrigação de filtrar `user_id` explicitamente.

**Não há achado de cobertura de RLS.** A AD-9 está apoiada em algo que hoje é verdade.

### E1 — Nenhuma AD garante que a próxima tabela nasça com RLS · **high**

A cobertura de hoje é resultado de disciplina não escrita. Nenhuma AD a exige:

- A **AD-9** é a única que menciona RLS, e a menciona como **premissa** ("a anon key é pública e
  protegida por RLS"), nunca como obrigação. Ela consome a garantia; não a produz.
- A **AD-7** enumera exatamente quatro checagens mecânicas — basename duplicado, `.from(` fora de
  `shared/data`, núcleo importando de app, núcleo construindo client. Nenhuma sobre RLS.
- O **`supabase/scripts/check-schema-drift.sh`** compara *tabelas* e *colunas* de produção contra as
  migrations. Não lê `pg_class.relrowsecurity` nem `pg_policies`.
- A **Consistency Conventions** tem uma linha "Segredos" que repete que a anon key é pública, e
  nenhuma linha sobre RLS.

Dano concreto: uma migration futura que esqueça `enable row level security` passa em
`npm run test` (AD-7 não olha), passa no `check-schema-drift.sh` (a tabela *existe* na migration,
então não é desvio) e chega a produção. A tabela fica legível e gravável por qualquer visitante
do web publicado, com a chave que está no bundle versionado — um `GET
$SUPABASE_URL/rest/v1/<tabela>?select=*` com o `apikey` lido do JavaScript servido. O conteúdo
dessas tabelas é saúde, geolocalização com traçado de rota e finanças pessoais. A anon key deixa
de ser inócua no instante em que uma única tabela perde a policy, e não há nada entre o
esquecimento e a produção.

O reparo é barato porque o ponto de imposição já existe: o `check-schema-drift.sh` já autentica no
projeto e já roda SQL arbitrário. Acrescentar a ele a checagem de `relrowsecurity` e de contagem
de policies por tabela transforma a premissa da AD-9 em invariante verificada, sem inventar
infraestrutura nova. Isso pede uma AD que diga *toda tabela de `public` tem RLS e policy por
usuário; a exceção é nomeada na migration* — com `linked_account_secrets` como a exceção nomeada
existente.

### E2 — O deny-all de `linked_account_secrets` não está registrado como decisão · **low**

A tabela de credenciais OAuth depende de uma configuração que *parece um defeito*: RLS ligada e
nenhuma policy. Está justificada em comentário de migration ("credenciais, invisíveis ao client")
e endurecida pelo `revoke`, mas não existe ADR nem linha de convenção que a nomeie. Dano: qualquer
auditoria futura — inclusive a checagem proposta em E1, ou o próprio linter do Supabase, que
sinaliza "RLS enabled with no policy" — lê isso como buraco e a "correção" natural é criar uma
policy `auth.uid() = user_id`, o que devolve tokens de Strava e intervals.icu ao client. É o tipo
de exceção que precisa estar escrita no lugar onde alguém vai procurar antes de "consertar".

---

## Dimensão 2 — Deploy e ambientes

**Estado: diferida com condição escrita** — e a condição de uma delas venceu antes da espinha ser
publicada. O `Deferred` registra "Alvo de hospedagem do web — ao publicar", e o `.memlog.md`
registra que a publicação é iminente. A ausência de CI está diferida de forma defensável (condição
de revisita concreta, ponto de imposição alternativo nomeado na AD-7). A instância única está
[ADOPTED] com mitigação escrita. Nenhum achado nesses dois. Os achados são no que a AD-9 fechou
sem perceber.

### E3 — Publicar hoje quebra o login com Google · **high**

`web/src/environments/environment.ts` é o **único** arquivo de environment e contém:

```
production: false,
appUrl: 'http://localhost:4200',
```

`appUrl` é consumido em `web/src/app/core/auth/auth.service.ts:29`:

```ts
const { error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: `${environment.appUrl}/semana` },
});
```

A AD-9 determina que "o build de produção não substitui arquivo nem injeta segredo", e o
`angular.json` de fato não tem `fileReplacements`. Consequência: no site publicado, o botão
"entrar com Google" devolve o usuário para `http://localhost:4200/semana`. Login por senha
funciona; o OAuth não.

O diagnóstico da AD-9 estava certo — o placeholder de `environment.prod.ts` era morto e enganoso —
mas a regra resolveu o problema do **segredo** e eliminou junto o único mecanismo do projeto para
config **não-secreta que varia por ambiente**. E existe config assim: a origem da aplicação. A
AD-9 precisa de um segundo tempo, do tipo *a origem vem do runtime (`window.location.origin`),
nunca de arquivo de build* — o que preserva integralmente a intenção original (nenhuma etapa de
substituição no build) e faz o OAuth funcionar em qualquer host. Há um segundo passo, fora do
repositório, que também não está registrado em lugar nenhum: o domínio de produção precisa entrar
na allow-list de redirect do Supabase Auth, senão o provedor recusa o callback.

### E4 — O alvo de conexão tem quatro cópias versionadas e nenhum dono · **medium**

A URL do projeto e a anon key aparecem versionadas em quatro lugares:

- `web/src/environments/environment.ts` (uma vez)
- `mobile/eas.json` (três vezes — perfis `development`, `preview` e `production`, valores idênticos)

A AD-3 exige dono único para "conceito de domínio"; o alvo de conexão não é conceito de domínio,
então escapa formalmente — mas é exatamente o mesmo defeito que a espinha inteira existe para
matar, aplicado à configuração. Nenhuma AD nomeia dono do par URL+chave.

O dano não é hoje; é no dia da revisita. O `Deferred` prevê "segunda instância Supabase para
desenvolvimento" e trata a revisita como custo de "manter dois schemas em sincronia". O custo real
é maior: trocar de instância exige quatro edições coordenadas em dois formatos diferentes, e errar
uma delas produz um build apontando para o banco errado **sem erro visível** — o client conecta,
autentica e lê dados de outro ambiente. Um perfil `preview` do EAS que continue apontando para
produção enquanto o `development` já migrou é precisamente o acidente que a segunda instância
existe para evitar.

### E5 — Publicar expõe `/register` sem gate e sem decisão · **medium**

`web/src/main.ts:15-19` registra a rota `register` sem `canActivate`. As demais rotas estão
guardadas por `authGuard`/`profileGuard`, corretamente. Nada na espinha decide se o cadastro é
aberto ou fechado.

Dano: a partir da publicação, qualquer pessoa cria conta na mesma instância que guarda os dados
pessoais do dono. A RLS isola os dados — não há vazamento — então o dano é de cota, ruído e
superfície de abuso (envio de e-mail de confirmação, linhas em `auth.users`) numa instância que a
AD-8 declara única para tudo. É decisão de envelope de dois estados (desligar signup no dashboard,
ou assumir cadastro aberto conscientemente) que a altitude *initiative* deveria ter tomado antes
de publicar, e que hoje será tomada por omissão.

---

## Dimensão 3 — Disciplina de schema/migration

**Estado: decidida.** É a dimensão operacional mais bem resolvida do projeto, e a única com
detector real.

Existe e é rastreável:

- **ADR 0011** (`docs/decisions/0011-schema-mora-em-migrations.md`) estabelece o invariante
  explícito: "toda tabela, policy, índice e função de produção nasce de uma migration. Objeto
  criado à mão no dashboard ou pela Management API é defeito, não atalho." Nasceu de um caso real
  (a `profiles` invisível que produziu a duplicata `user_profiles`) e a análise da causa está
  correta — o repositório mentiu por omissão e a duplicata foi a resposta certa a informação
  errada.
- **Detecção de desvio existe e roda**: `supabase/scripts/check-schema-drift.sh` compara as
  tabelas de `public` em produção contra as que as migrations criam, nos dois sentidos, e faz uma
  checagem frouxa e deliberadamente conservadora no nível de coluna. Sai != 0 no desvio.
- **Caminho até produção está normatizado** no `AGENTS.md`: nunca `supabase db push` sem
  confirmação explícita; nunca DDL destrutivo sem aval; migration aplicada pela Management API
  precisa ser registrada em `supabase_migrations.schema_migrations` sob pena de reexecução.
- A própria ADR 0011 **recusa** a saída fácil de fingir que a AD-7 cobre isso ("a checagem precisa
  do banco... Fingir que a AD-7 cobre seria pior que admitir que não cobre"). Honestidade
  arquitetural correta e rara.

### E6 — A espinha não sabe que nada disso existe · **medium**

Nem a ADR 0011, nem o `check-schema-drift.sh`, nem a regra de registro em
`supabase_migrations.schema_migrations` aparecem em qualquer AD. O `Structural Seed` diz apenas
`migrations/ # ledger append-only; aplicada nunca é reescrita` — que é a metade *passiva* do
invariante (não reescrever) e omite a metade *ativa* (todo objeto nasce aqui, e existe um comando
que prova).

O `purpose` declarado da espinha é `build-substrate`: ela é o documento a partir do qual se
constrói. Quem construir a partir dela não descobre que criar tabela pelo dashboard é defeito, nem
que existe um detector para rodar depois de mexer em schema. A AD-11 garante que a ADR 0011 não
será editada, mas nada garante que será *encontrada* — a espinha é a porta de entrada e essa porta
não tem a placa.

Duas notas de precisão que a mesma emenda deveria resolver:

1. O detector cobre **tabela e coluna**. A ADR 0011 promete o invariante para "tabela, policy,
   índice e função". Policy, índice e função ficam sem detecção — e a policy é justamente o que a
   AD-9 precisa (ver E1). Um `alter table ... disable row level security` ou um `drop policy`
   aplicado no dashboard passa hoje inteiramente despercebido.
2. Fechar E1 e E6 é o mesmo trabalho: a espinha ganha uma AD de envelope de dados que aponte para
   a ADR 0011 e para o script, e o script ganha a consulta de RLS/policy. Ponto de imposição já
   existe, autenticação já existe, hábito de rodar já está documentado no `AGENTS.md`.

---

## Dimensão 4 — Escrita offline / fila / conflito

**Estado: silenciosa.** A espinha não contém a palavra escrita, fila, retry, idempotência ou
conflito. A AD-4 fala de *acesso* a tabela e trata leitura e escrita como a mesma coisa. Não são.

### E7 — O invariante que protege o dado existe só como comentário num arquivo do mobile · **high**

O que existe hoje, lido do código:

| Caminho | Fila | Trava | Contrato do servidor |
|---|---|---|---|
| `mobile/src/lib/sync-queue.ts` | sim, dedup por `(kind, id)` | **não** | upsert idempotente (`on conflict do update`) |
| `mobile/src/lib/todo-queue.ts` | sim, dedup por `opId` | **não** | `todo_resolve` — set de status, idempotente |
| `mobile/src/lib/habit-queue.ts` | sim, dedup por `opId` | **sim** | `habit_log_add` — **soma delta, não idempotente** |
| `web/` (todo o app) | **nenhuma** | — | escreve direto |

As três filas do mobile têm contratos de correção diferentes, e a diferença não é estilística: a
trava do `habit-queue.ts` existe porque a RPC subjacente **soma**. O comentário no arquivo
documenta o bug real que a produziu:

```
 * o drain do 1º ainda está no ar (não limpou a fila) quando o 2º lê `[d1, d2]`
 * e reenvia `d1` — como o backend SOMA o delta, o valor dobra no servidor.
```

O invariante verdadeiro do sistema é: **a operação do servidor é idempotente, ou a fila é
serializada.** Esse invariante foi descoberto pagando o preço, e mora inteiro em um comentário
dentro de `mobile/src/lib/`, invisível para o web e para a espinha.

Dano concreto e a poucos passos de distância: o web hoje escapa porque `habits.store.ts:75` usa
`habit_log_set` (idempotente) e nunca chama `habit_log_add`. Nada em lugar nenhum registra que
essa escolha *é* a proteção. Um botão "+1" na página de hábitos do web — feature óbvia, com o
mobile como precedente e a RPC `habit_log_add` disponível e documentada — reproduz a contagem
dobrada em duplo clique, num app que não tem fila, não tem trava e não tem onde a trava do mobile
alcançar. E como o dado é um contador de hábito de longo prazo, o erro é silencioso e permanente.

### E8 — A mutação escapa da AD-4, e `todo_resolve` já tem dois donos divergentes · **medium**

A AD-4 promete: "cada tabela tem exatamente um módulo dono do seu acesso". Os próprios módulos do
núcleo declaram que a promessa não cobre a escrita:

- `packages/shared/src/data/habit-logs.ts:4` — "Escrever **não** passa por aqui: vai pelas RPCs..."
- `packages/shared/src/data/habits.ts:4` — idem
- `packages/shared/src/data/todo-occurrences.ts:5` — "Conclusão **não** passa por aqui — vai pela
  RPC `todo_resolve`"

Consequência já materializada: `todo_resolve` tem dois donos hoje.

- Web: `web/src/app/features/tasks/data/todos.store.ts:137`, `:141`, `:237` — três chamadas
  diretas a `supabase.rpc('todo_resolve', ...)`, sem fila, sem checagem de erro.
- Mobile: `mobile/src/services/todo-resolve.ts` — seam único, com enfileiramento e drain, e uma
  ADR própria (0008 — "seam único de conclusão de tarefa") que vale só para um dos dois apps.

É exatamente a duplicação que a espinha inteira foi escrita para matar (AD-1 a AD-4, AD-12),
sobrevivendo na dimensão que nenhuma delas olha. A divergência de comportamento já é observável:
com a rede caída, no mobile a conclusão fica enfileirada e drena depois; no web ela some — e o
usuário viu a tarefa marcada, porque o estado local já mudou.

A espinha precisa de uma AD que diga quem é dono do **caminho de escrita**, não só da query: se a
mutação é RPC, o módulo que a envelopa é único e mora no núcleo; se a operação do servidor não é
idempotente, isso é propriedade declarada do módulo e a serialização é obrigação de quem chama.

### Conflito

Não há resolução de conflito no sistema, e essa é uma escolha razoável para um usuário único — mas
não está registrada. O padrão de fato é last-write-wins via `on conflict do update`. A única
decisão real de conflito existente é `activities.locally_edited`
(`20260520130000_activities_locally_edited.sql`), onde o sync deixa de sobrescrever a linha editada
à mão — decisão boa, com consequência séria para a dimensão 6, e ausente da espinha.

---

## Dimensão 5 — Falha, erro e observabilidade

**Estado: silenciosa**, com uma convenção de fato que merece ser promovida e uma ausência que
merece ser decidida.

Verificado no código:

- **Existe convenção real no núcleo**: `packages/shared/src/data/*.ts` usa `if (error) throw error`
  de forma uniforme em todas as funções. É boa e é consistente — e não está escrita em lugar
  nenhum. Vale promover a linha de `Consistency Conventions`, custo zero.
- **Não existe convenção no tratamento.** 14 `console.error` no web, 22 `console.*` no mobile,
  todos ad-hoc no ponto de uso. Nenhum `ErrorHandler` global no Angular. Nenhum error boundary.
- **Nenhum sinal de produção.** Zero ocorrências de Sentry, Bugsnag, Crashlytics, PostHog ou
  Datadog no repositório inteiro. Nenhum log estruturado, nenhuma telemetria, nenhuma métrica.

### E9 — Publicado, o app falha em silêncio e ninguém fica sabendo · **medium**

`console.error` não é sinal de produção: ninguém tem o console aberto no celular nem no site
publicado. Com instância única (AD-8) e sem staging, **o único ambiente onde um defeito aparece é
produção — e ele aparece mudo.**

Dano concreto, já presente: `web/src/app/features/tasks/data/todos.store.ts:137`, `:141` e `:237`
chamam `todo_resolve` sem checar o `error` retornado e sem `try/catch`. Uma tarefa marcada como
feita com a rede instável muda o estado local, falha no servidor, não registra nada em lugar
nenhum, e reaparece por fazer no próximo carregamento. O usuário conclui que "o app perdeu a
tarefa" e não existe nenhum artefato que permita descobrir por quê — nem log, nem erro na tela,
nem contador.

O mais próximo de um sinal operacional que o projeto tem são os `console.warn('[sync] ...')` de
`mobile/src/services/activity-sync.ts` e `health-sync.ts`, que pelo menos carregam prefixo e
mensagem estruturada. Existem só no mobile, e só no sync.

A altitude não exige escolher uma ferramenta. Exige decidir: ou entra um sinal mínimo de produção,
ou fica registrado como diferido com condição — "quando um defeito relatado não puder ser
reproduzido localmente" é uma condição honesta. Silêncio, aqui, é a única das três opções que não
é uma decisão.

---

## Dimensão 6 — Dado e backup

**Estado: silenciosa.** Silêncio total, e é o silêncio mais caro da revisão.

### E10 — Anos de dado pessoal insubstituível, instância única, zero decisão sobre perda · **high**

Busca por `backup`, `restore`, `pg_dump`, `point-in-time` e `PITR` em todo o repositório: **zero
ocorrências** fora de arquivos de skill do BMAD, que não têm relação com o projeto. Não há decisão,
não há procedimento, não há menção.

O que está em jogo, nessa única instância que a AD-8 declara servir dev, preview e produção:
atividades com traçado GPS de anos, série histórica de saúde (`health_daily`), avaliações
subjetivas diárias, refeições, transações financeiras, metas, hábitos e o histórico de tarefas.

E parte desse dado **não é recuperável por reimportação**, o que derruba a defesa intuitiva de que
"o HealthKit e o Strava são a fonte da verdade":

- `activities.locally_edited` existe precisamente para que o sync **não** sobrescreva a edição
  manual. Refazer o sync não reconstrói nenhuma edição.
- `activities.hidden` preserva linhas que já foram apagadas no HealthKit. A fonte externa não as
  tem mais; só o banco tem.
- Métricas estimadas por trigger, backfills de elevação e de rota, e a deduplicação manual
  registrada na memória do projeto são todos estado derivado com trabalho humano embutido.

A AD-8 assume conscientemente o risco de **escrever em dado real** e não diz nada sobre **perder**
dado real. As mitigações que ela escreve — confirmação antes de `db push`, DDL destrutivo só com
aval — previnem o acidente e não reparam nenhum. O item de `Deferred` sobre a segunda instância
também só enxerga "uma perda de dado em desenvolvimento", que é a metade menor do problema: a
perda que importa é a da instância que também é produção.

Pode ser que exista backup por default do plano contratado no Supabase. **Isso não é verificável a
partir do repositório, e a não-verificabilidade é o achado**: se existe, ninguém decidiu, ninguém
sabe a janela de retenção e ninguém nunca testou uma restauração. Um `drop` mal digitado, um
`delete` sem `where` autorizado no piloto automático, ou o encerramento da conta são todos
recuperáveis ou catastróficos dependendo de uma configuração que a arquitetura não olha.

O mínimo à altura: uma AD que declare a política de retenção e o caminho de recuperação, e — dado
que o `check-schema-drift.sh` já prova que exportar do projeto por script é trivial neste
repositório — um export periódico versionado fora da instância. A decisão pode até ser "aceito a
perda"; ela só não pode continuar não existindo.

---

## Resumo dos achados

| ID | Severidade | Dimensão | Achado |
|---|---|---|---|
| E1 | **high** | 1 | Nenhuma AD garante RLS+policy na próxima tabela; AD-9 consome a garantia sem produzi-la, e nem AD-7 nem o drift script a verificam |
| E3 | **high** | 2 | `appUrl: 'http://localhost:4200'` no único environment quebra o OAuth Google ao publicar; AD-9 removeu o mecanismo para config não-secreta por ambiente |
| E7 | **high** | 4 | O invariante "operação idempotente OU fila serializada" mora só num comentário do `habit-queue.ts`; o web não tem fila e a RPC aditiva está a um botão de distância |
| E10 | **high** | 6 | Instância única com anos de dado pessoal parcialmente insubstituível (`locally_edited`, `hidden`) e zero decisão sobre backup ou recuperação |
| E4 | medium | 2 | URL+anon key duplicadas em 4 lugares versionados sem dono; subestima o custo de revisita do Deferred da segunda instância |
| E5 | medium | 2 | `/register` sem gate no web publicado; cadastro aberto vs. fechado nunca foi decidido |
| E6 | medium | 3 | ADR 0011 e `check-schema-drift.sh` não são referenciados por nenhuma AD; o detector cobre tabela/coluna, não policy, índice nem função |
| E8 | medium | 4 | A escrita por RPC escapa da AD-4; `todo_resolve` já tem dois donos divergentes (web direto vs. seam do mobile com fila) |
| E9 | medium | 5 | Zero sinal de produção; `todos.store.ts` descarta erros de `todo_resolve` e a tarefa reaparece sem rastro |
| E2 | low | 1 | Deny-all de `linked_account_secrets` registrado só em comentário; parece defeito e a "correção" expõe tokens OAuth |

## Nota sobre o que está certo

Registrado porque uma lente adversarial que só lista buracos distorce a leitura do estado real:

- Cobertura de RLS é **completa e correta**, com policies por usuário sem uma única exceção
  permissiva, e todas as RPCs em `security invoker`.
- O service role está **confinado** às edge functions, com a obrigação de filtro escrita no
  cabeçalho do módulo.
- A disciplina de migration tem **invariante, ADR e detector executável** — mais do que a maioria
  dos projetos deste porte, e com a honestidade explícita de recusar fingir cobertura da AD-7.
- A AD-8 é uma decisão **assumida e mitigada**, não uma omissão — que é exatamente o que uma
  espinha deve fazer com um risco que escolhe correr.
