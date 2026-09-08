---
type: architecture-review
rubric: espinha-boa
target: '../ARCHITECTURE-SPINE.md'
parent: '../../architecture-Orbe-2026-08-17/ARCHITECTURE-SPINE.md'
spec: '../../../../docs/specs/revista-retrospectiva/spec.md'
reviewer: 'revisor de arquitetura'
date: '2026-09-08'
verdict: 'aprovada com correções obrigatórias'
counts: { critico: 3, alto: 3, medio: 5, baixo: 7 }
---

# Revisão de rubrica — espinha da revista da Retrospectiva

> **Veredito.** É uma espinha de domínio forte e honestamente ancorada no código — verifiquei
> os seis arquivos citados e a ratificação está certa em quase tudo —, mas **não serve ainda
> como substrato de construção**: a orquestração da impressão não tem dono, a Rule da AD-4
> fixa "quatro linhas" numa altitude em que a maioria das edições tem uma, e o envelope
> operacional inteiro foi deferido com uma justificativa que a própria frente contradiz.

Método: cada item da rubrica foi julgado contra o texto da espinha **e** contra o código real
(`packages/shared/src/period/retro-blocks.ts`, `packages/shared/src/ia/`,
`packages/shared/src/theme/derive.ts`, `packages/shared/src/theme/css-vars.ts`,
`packages/shared/src/theme/theme.test.ts`, `packages/shared/src/architecture.test.ts`,
`packages/shared/src/data/edicoes-ia.ts`, `packages/shared/src/astro/moon.ts`,
`supabase/migrations/20260906150000_edicoes_ia.sql`, `supabase/config.toml`,
`supabase/functions/ia-narrar/index.ts`, `mobile/src/lib/edicao-ia.ts`,
`mobile/src/app/retrospectiva/index.tsx`, `pnpm-workspace.yaml`, `package.json`).

---

## Item 1 — Ela fixa os pontos reais de divergência para as stories, sem deixar nenhum de fora?

**Parcialmente.** Os pontos que ela fixa, fixa bem: a rota própria (AD-1), o vocabulário do
caderno (AD-2), o grão da capa (AD-3), a fronteira transacional (AD-4), a tabela da lua
(AD-5), o módulo e a janela do teste lunar (AD-6), a coordenada constante (AD-10) e a função
única da chamada (AD-11) são todos escolhas que dois construtores fariam diferente, e todas
saem decididas com a razão nomeada. A AD-11 em particular é modelar: ela antecipa o erro
concreto (`1.210 fotos` cortado em `1.`), aponta o precedente no código
(`verificar.ts` já trata `\d{1,3}(?:\.\d{3})+` como milhar) e pede o teste que morde.

Faltam quatro pontos, um deles grave.

### F1 — A orquestração da impressão não tem dono `[CRÍTICO]`

O diagrama do paradigma desenha o pipeline de quatro estágios e diz que **três hospedeiros o
executam igual**. Nenhuma AD diz **de quem é o laço**.

Hoje o laço existe e mora em `mobile/src/lib/edicao-ia.ts` — `gerarEdicao()` faz
`montarPacote → narrar → verificarTexto → upsertEdicao`, e `narrar()` chama
`supabase.functions.invoke('ia-narrar', ...)`. Esse arquivo **não é importável do
`scripts/`**: ele importa `./supabase`, que é o client React Native. Então o terceiro
hospedeiro da AD-12 vai reescrever o laço — e é exatamente a falha que o companion nomeia:

> *"Se a edição gerada pelo script divergir da gerada pelo telefone, há duas implementações da
> mesma conta — o preço já foi pago uma vez, quando a manchete divergiu da tela."*
> — `mudancas-mecanicas.md`

Pior: as barreiras herdadas não pegam essa duplicação. A guarda de basename duplicado varre
`web/src` e `mobile/src`; a guarda "o núcleo não importa dos apps" varre
`packages/shared/src`. Um `scripts/edicao-ia.ts` gêmeo do `mobile/src/lib/edicao-ia.ts` passa
calado nas três. A AD-12 estende **só** a varredura do `.from()`, e escreve na própria Rule a
frase que se aplica a ela mesma: *"invariante que vale só para quem chegou primeiro não é
invariante"*.

**Falta uma AD:** quem é dono de `imprimirEdicao(db, userId, entrada) → Edicao[]`. A saída
natural é o núcleo com o client injetado (AD-4 herdada já injeta `SupabaseClient`, e
`db.functions.invoke` está nele), deixando ao adaptador só a construção do client — mas isso
é decisão de arquitetura, não de story, e é a única que faz o teste obrigatório do spec
("mesmo pacote, dois hospedeiros, mesmo texto verificado") ser estruturalmente verdadeiro em
vez de verificado por disciplina.

### F2 — A tira do anuário não congela `[ALTO]`

CAP-9 exige que cada tira de doze meses meça **"o fato que liderou o ranqueamento daquele
caderno"**, mês a mês, *"a tira e a ordem falam do mesmo número"*. A AD-4 congela `posicao`,
que é a ordem **dos cadernos** — nada congela **qual fato liderou dentro do caderno**.

Consequência: a tira é necessariamente recalculada na leitura, por `ordenarCadernos` (ou pela
função de afastamento que a alimenta) rodando sobre pacotes montados hoje. Ajustar o peso da
confiança em novembro faz a tira de agosto mudar — e o texto de agosto, congelado, passa a
contradizer a tira que o acompanha. É a **mesma** reescrita silenciosa que a AD-4 e a
`mudancas-mecanicas.md` existem para impedir, entrando pela porta ao lado.

Duas saídas plausíveis, e dois construtores escolheriam diferente: gravar a chave do fato
líder por linha de `edicoes_ia`, ou declarar a tira explicitamente derivada e aceitar que ela
não é parte da edição congelada. A espinha não escolhe nem declara aberto.

### F3 — A capa numa reimpressão **total** `[MÉDIO]`

A AD-3 diz *"carimbada na primeira impressão e **nunca tocada por reimpressão parcial**"*. Por
contraste, uma reimpressão total toca? O texto sugere que sim e não decide. A regra de
consistência ("o que congela guarda valor") não responde a pergunta de *quando* congela de
novo. Duas leituras defensáveis do mesmo parágrafo é o teste de que falta uma decisão.

### F4 — A rota da semana `[MÉDIO]`

A AD-1 exclui de `/revista/` só *"período em curso e `all`"*. Então `week` tem rota? O postal
**não grava edição** (CAP-9, `cadernos.md`), o que faz `/revista/week/2026-08-24` ser uma rota
sem linha em `edicoes_ia` — legítimo, mas diferente o bastante de mês/trimestre para merecer
uma frase. Um construtor põe o postal em rota; outro o deixa dentro de `/retrospectiva` como
uma forma do bloco `lede`, e a "parede de capas" passa a ter dois tipos de item.

---

## Item 2 — A Rule de cada AD é executável, e impede mesmo o que a linha "Prevents" declara?

**Na maioria, sim, e com folga.** As Rules boas desta espinha são boas pelo mesmo motivo:
nomeiam um mecanismo, não uma intenção.

- **AD-4** — `deferrable initially deferred` + upsert em uma chamada + árbitro na PK
  não-deferrable. Cita a limitação real ("deferrable não pode ser árbitro") e a descarta com
  razão, e recusa nominalmente a alternativa impossível (`SET CONSTRAINTS` de um cliente
  PostgREST). Isso é executável.
- **AD-7** — sha256 de um caminho fixo contra uma constante, num teste que já roda offline.
  Cobrável, e o argumento de por que a condicional do §7.3 *não* é construível (a suíte roda
  com `npx tsx`, sem cliente de banco; AD-13 herdada proíbe guarda que passa por não executar)
  está correto contra o código.
- **AD-8** — **duas** asserções, argmax e piso, com o número de combinações certo. Conferi:
  `theme.test.ts` já usa exatamente esse idioma ("nas 36 combinações" = 3 temas × 6 paletas ×
  2 esquemas), `GRAPHIC_FLOOR = 3` e `TEXT_FLOOR = 4.5` existem em `derive.ts`, e a
  justificativa do piso de 3,0 (22 px peso 700 é texto grande no WCAG, que começa em 18,66 px
  negrito) é a razão nomeada que a rubrica pede em vez de frouxidão.
- **AD-9** — nomeia a API certa (`sendAccessibilityEvent`), a errada
  (`setAccessibilityFocus`) e proíbe `findNodeHandle`. Conferi o typing instalado: os dois
  métodos existem. Cobrável por grep, e a espinha até acerta a contagem ("ao lado dos cinco
  que já existem" — `mobile/src/hooks/` tem exatamente cinco).
- **AD-11** — pede teste com os três casos que o corte ingênuo erra. Executável.
- **AD-12** — "a varredura da barreira é estendida **no mesmo commit** em que ele nasce".
  Executável e datado.

Duas exceções, uma delas grave.

### F5 — A Rule da AD-4 é executável **e errada**: "quatro linhas" `[CRÍTICO]`

A AD-4 diz *"toda impressão — inteira ou parcial — é **um `upsert` das quatro linhas numa
chamada só**"*. O diagrama repete (`upsert 4 linhas + capa`) e a tabela de convenções
endurece: *"Sempre o conjunto das quatro linhas numa chamada (AD-4). Nunca uma linha avulsa"*.

Isso contradiz o contrato em três pontos independentes:

1. **CAP-11** — *"caderno vazio não aparece"*, e `bases-e-ranqueamento.md` passo 6: *"Vazio —
   fora da lista"*.
2. **A tabela de backfill de `mudancas-mecanicas.md`** — Movimento começa em 22/05/23 (225
   edições), Coração em 24/03/25 (98), Sono em 23/04/25 (91), Rotina em 01/05/26 (22). Uma
   edição de mês de 2023 tem **um** caderno. A maioria das 436 tem menos de quatro.
3. **O banco** — `texto text not null check (length(trim(texto)) > 0)` recusa a linha vazia,
   então "quatro sempre" não é nem preenchível com placeholder.

A invariante correta é *"o conjunto completo dos cadernos **não vazios**, numa chamada, com
`posicao` contígua"*. E a correção abre uma segunda pergunta que a espinha também não
responde: **`posicao` renumera** quando o conjunto de cadernos não vazios muda entre duas
impressões? Com `unique` deferido a permutação é segura, mas a semântica (1..N contíguo vs.
slot estável por caderno) muda o que a tira do anuário e a parede de capas leem.

Como está, um construtor escreve `upsert` de 4 e quebra em 2023; outro escreve `upsert` de N e
está certo — divergindo da espinha e da convenção.

### F6 — A AD-2 previne por prosa o que as outras previnem por guarda `[MÉDIO]`

A AD-2 declara *"Prevents: … a ordem escolhida pelo leitor, que CAP-7 aposentou, voltar pela
porta dos fundos de `visibleBlocks`"* e *"`RetroBlockId` **não é alargado**"*. A Rule descreve
o desenho certo (chave própria `cadernosOcultos`, `CadernoId` com dono único) mas **não nomeia
nenhum mecanismo** que cobre o não-alargamento nem a não-volta do `order`. Numa espinha em que
AD-7, AD-8 e AD-12 todas nomeiam a guarda e o commit em que ela entra, esta destoa.

Vale notar o que ela acerta: conferi `user_preferences.retro_prefs` — é `jsonb not null
default '{}'` **sem CHECK de forma**, a barreira dos CHECKs em `architecture.test.ts` cobre só
colunas de id (`theme`, `wallpaper`, `theme_id`, `palette_id`, `brand_id`), e
`resolveRetroPrefs` descarta chave desconhecida em silêncio. O *"sem migration continua
verdade"* está medido e correto.

### F7 — "no molde do `onPrimary`" descreve mal o código `[BAIXO]`

A AD-8 diz que `onAccent` *"deriva no molde do `onPrimary`: o melhor entre `ink` e `bgPure` por
contraste medido"*. O `onPrimary` real escolhe entre `'#FFFFFF'` e `'#000000'` e **honra um
override autoral** (`brand.on?.[scheme]`, porque *"o `laranja` quer branco, que o automático
rejeitaria"*). O idioma ink/bgPure é o do `onTintOf`. A Rule é autocontida e continua
executável — a asserção de argmax é sobre `ink`/`bgPure` explicitamente —, mas a frase de
ratificação está errada e é justamente o tipo de frase que alguém copia.

---

## Item 3 — Algo em "Deferred" deixaria duas unidades divergirem?

Sete das oito linhas são deferimentos legítimos: não-objetivo declarado (web/PDF/e-mail,
backfill de semanas), condição temporal dura (base anual em mai/2027, coordenada por dia no
épico 2), ou revisita de uma decisão **já tomada** (a catraca dos 4,25, a data órfã em
`hidden`, o `TONE_COLOR`). Nenhuma delas deixa duas unidades divergirem.

A oitava é defeito.

### F8 — "Distribuição e deploy" defere o envelope operacional inteiro, com premissa falsa `[CRÍTICO]`

> *"…esta frente **não muda o envelope operacional**, e registrá-lo é trabalho do épico de
> distribuição"*

A frente muda o envelope operacional em três eixos, e cada um é um ponto real de divergência:

1. **Credencial do terceiro hospedeiro.** Conferi `supabase/config.toml`:
   `[functions.ia-narrar] verify_jwt = true`, e a docstring da function diz por quê — *"para a
   function não virar proxy aberto queimando o crédito Prepay"*. A RLS de `edicoes_ia` é
   `auth.uid() = user_id`. Então o script precisa de um JWT de usuário. Duas saídas, e dois
   construtores escolheriam diferente: (a) `signInWithPassword` com a anon key, (b) uma
   `service_role` key num `.env`. A (b) **atravessa a convenção herdada** — *"Segredo real só
   em edge function; `.env` e `mobile/.env` nunca são lidos, editados nem commitados"* — e de
   quebra fura a RLS, tornando o `with check (auth.uid() = user_id)` inerte para o hospedeiro
   que vai escrever 436 linhas. A AD-12 diz *"constrói o próprio client"* e nada mais.
2. **Resolução de dependência do terceiro hospedeiro** — ver F9.
3. **Mecânica da corrida paga** — ver F15.

A AD-12 decide *onde o script mora*; ninguém decide *como ele autentica, resolve e roda*. E o
único item de Deferred que poderia carregar isso declara que não há nada a carregar.

---

## Item 4 — Ela ratifica o código existente, ou o contradiz?

**Ratifica, e com um nível de conferência acima do usual.** O que verifiquei arquivo a
arquivo:

| Afirmação da espinha | Verificação |
|---|---|
| `RetroBlockId` não contém caderno; `resolveRetroPrefs` descarta chave desconhecida em silêncio; `hidden` guarda a data | ✅ `retro-blocks.ts:35-48`, `:103-140`, `:87` |
| `retro_prefs` é jsonb sem CHECK de forma ⇒ *sem migration* continua verdade | ✅ conferido contra a migration e contra a barreira de CHECKs |
| `moon.ts` recusa devolver idade em dias, com ~0,8 d de erro | ✅ `moon.ts:20-22` — a AD-6 é ratificação fiel, não invenção |
| `TRIGGER_MIN_PER_CELL` já mora em `sleep/triggers.ts` | ✅ `triggers.ts:53` |
| `verificar.ts` trata `\d{1,3}(?:\.\d{3})+` como milhar; hoje são **quatro** regras (logo, "a quinta") | ✅ `verificar.ts` — `NUM` e as regras `numero`/`causa`/`correlacao`/`ressalva` |
| A barreira do `.from()` varre só `web/src` e `mobile/src`; a do `createClient` varre só `packages/shared/src` | ✅ `architecture.test.ts:105-116`, `:125-135` — a premissa da AD-12 é exata |
| `GRAPHIC_FLOOR = 3`, `TEXT_FLOOR = 4.5`, `RoleTokens`, `ModuleTokens`, `bgPure` | ✅ `derive.ts:76,78,267,467`; `moduleOf()` devolve `{tint, accent, onTint}` |
| "36 combinações" e o idioma de duas asserções | ✅ `theme.test.ts:186` já diz *"nas 36 combinações"* |
| `onAccent` **não** ganha variável CSS de graça | ✅ `css-vars.ts` enumera os campos de papel um a um — nada auto-emite. A AD-8 sai barata |
| O CHECK de `edicoes_ia` recusa `all`; a PK é de 4 colunas; `motivo_de_parada = 'STOP'` | ✅ `20260906150000_edicoes_ia.sql` |
| `AccessibilityInfo` expõe os dois métodos no RN instalado | ✅ typing de `AccessibilityInfo.d.ts:141,174` |
| `mobile/src/hooks/` tem cinco hooks | ✅ |
| `activity_photos.taken_at` é a chave de cura | ✅ `20260906160000_activity_photos.sql:18,38,87` |
| A `ia-narrar` já existe | ✅ `supabase/functions/ia-narrar/` — e note que **`CLAUDE.md` está desatualizado**, listando quatro functions e nomeando `strava-oauth`, que não está mais no diretório |
| A web nunca teve o painel Diagramação | ✅ nenhum arquivo em `web/src` importa de `period/retro-blocks` |

Cinco correções.

### F9 — A AD-12 colide com a AD-14 e a AD-17 herdadas `[ALTO]`

A Rule manda o script viver *"**fora dos três** — não em `packages/shared/src` … e não em
`web/src` nem `mobile/src`"*, e o Structural Seed o põe em `scripts/` na raiz.

Conferi a raiz: `pnpm-workspace.yaml` declara `packages/*`, `web`, `mobile` — três. E o
`package.json` da raiz declara **zero dependências** (só `scripts` de conveniência e
`packageManager`). Sob o `nodeLinker` isolado que a AD-14 herdada trava de propósito, um
diretório `scripts/` fora de todo workspace **não resolve** `@vitale/shared`,
`@supabase/supabase-js` nem `tsx`. Não é detalhe de story: é o que decide se CAP-13 roda.

As duas saídas conflitam com heranças diferentes:

- Pôr `scripts` em `pnpm-workspace.yaml` cria um **quarto workspace**, contra a letra da AD-17
  herdada (*"o portão automatizado cobre os **três** workspaces"*) e sob a AD-13 herdada, que
  exige que quem declara target `test` execute um runner de verdade.
- Declarar as dependências na raiz faz da raiz um pacote de fato, e a AD-14 herdada é explícita:
  *"Dependência usada sem ser declarada é defeito, não conveniência"* — o que também vale para
  quem passa a declarar sem ser workspace.

A AD-12 decide o endereço e não decide a resolução. Precisa decidir, e nomear qual herdada
cede.

### F10 — "doze blocos" × "os treze blocos" `[BAIXO]`

A AD-1 diz *"os **doze** blocos"* na linha Prevents e *"os **treze** blocos"* na Rule.
`RETRO_BLOCKS` tem 13 (`lede`, `kpis`, `highlights`, `heatmap`, `tasks`, `dailyTasks`,
`purchases`, `fitness`, `sports`, `health`, `sleep`, `habits`, `yearSeries`). A segunda está
certa.

### F11 — A Stack pina uma versão que não é a instalada `[BAIXO]`

A tabela diz `React Native / Expo — 0.86.3 / ~57.0.20`. `mobile/package.json` declara `0.86.3`,
mas a árvore instalada é `react-native@0.86.2` (o que casa com a espinha pai). Como a espinha
diz *"semente, conferida em 08/09/2026"*, o número deveria ser o que está instalado ou vir com
a ressalva.

### F12 — O `TONE_COLOR` tem um defeito pior do que o registrado `[BAIXO]`

A linha de Deferred registra *"`retrospectiva/index.tsx:75` viola nenhum hex em tela"*. É
verdade e é a metade menor. A linha é:

```ts
const TONE_COLOR: Record<string, string> = { good: '#6FA86A', bad: '#D9491B', neutral: colors.ink3 };
```

`colors` é o Proxy que resolve **na leitura**, e isto é escopo de módulo: `neutral` congela no
import, no esquema ativo naquele instante — exatamente o defeito que a barreira *"nenhum
`StyleSheet` no escopo do módulo lê o tema"* existe para pegar, e que ela **não** pega porque
só varre `StyleSheet.create`. Deferir está certo (fora do escopo), registrar pela metade não.

### F13 — O Structural Seed omite `data/edicoes-ia.ts` `[BAIXO]`

O Capability Map aponta CAP-1 para `data/edicoes-ia.ts`, mas a semente não o lista entre os
arquivos que mudam. E ele muda de forma não trivial: hoje `upsertEdicao` grava **uma** linha,
com `.single()` e `onConflict: 'user_id,tipo_periodo,inicio,fim'`. A AD-4 exige upsert de
conjunto sobre a chave de cinco colunas, o que muda assinatura, `onConflict` e retorno.

### F14 — O frontmatter cita um companion que ainda não existe `[BAIXO]`

`companions: correcao-pre-registro-lua.md`. O arquivo não existe em
`docs/specs/revista-retrospectiva/`. O Structural Seed o lista corretamente como algo que
**nasce**; o frontmatter o declara como se já vinculasse. Vale um `(a criar)`.

---

## Item 5 — Ela cobre as capacidades do spec que a dirigiu?

**As 14 aparecem no mapa**, e três decisões merecem crédito explícito por fecharem o que o
spec deixou aberto:

- **CAP-14** era declarada *"bloqueante"* e *"decisão de arquitetura, deixada aberta de
  propósito"* nas Open Questions do spec. A AD-2 a fecha, com a razão certa (o caderno herdaria
  `order`/`kinds`/`fixed`, e `order` é justamente o que CAP-7 aposentou) e reconferindo o *"sem
  migration"*. É a espinha fazendo o trabalho que a espinha existe para fazer.
- **CAP-12** ganha AD-5 + AD-6 + AD-7, e a AD-7 é **mais estrita** que o §7.3 do pré-registro,
  declarando a divergência e mandando-a para o documento de correção em vez de a esconder.
- **CAP-10** ganha o grão certo (AD-3), com o argumento do defeito espelhado — quatro cópias da
  mesma capa numa chave por caderno é o mesmo erro que o contrato recusou para a ordem.

Duas capacidades ficam com cobertura fina:

- **CAP-9** — ver F2. O anuário é a forma cuja invariante (tira = ordem) não tem dono.
- **CAP-13** — ver F15 abaixo.

### F15 — A mecânica da corrida de backfill não é decidida nem declarada aberta `[MÉDIO]`

A AD-12 cobre onde o script mora e o que ele reusa; AD-10 cobre a coordenada. Ficam de fora,
sem menção:

- **Sequência e retomada.** São ~99 chamadas pagas para mês/trimestre/ano (53 Movimento + 22
  Coração + 20 Sono + 4 Rotina), 436 com semanas. O que acontece quando a corrida cai na 60?
  O upsert por edição é idempotente, mas nada declara que a corrida é retomável nem como ela
  sabe o que já imprimiu.
- **Concorrência e limite.** Sequencial ou em paralelo? A `ia-narrar` tem `MAX_CHARS = 60_000`
  e um provedor com cota atrás; a espinha não decide.
- **Caderno reprovado no meio da edição.** *"Verifica antes de gravar"* é herdada do companion,
  mas se o caderno de Rotina reprova e os outros três passam, grava-se a edição parcial de três
  (e a AD-4 diz "quatro")? Isso amarra em F5 e é a interação mais provável de todas — a AD-4 até
  cita esse caso como motivo da constraint deferida, sem dizer o desfecho.

---

## Item 6 — Alguma AD nova enfraquece ou contradiz uma herdada?

A tabela **Inherited Invariants** é boa prática e a maioria das ligações está certa: AD-5
herdada é invocada nominalmente pela cláusula que ela de fato admite ("colapsar round-trip");
AD-13 herdada é o que sustenta a decisão de tornar a AD-7 incondicional; AD-3 herdada sustenta
o dono único de `CadernoId` e da chamada; AD-11 herdada corretamente manda a emenda da ADR
0045 para uma ADR nova.

Duas contradições, ambas na AD-12, ambas já detalhadas:

- **F9** — AD-12 × AD-14 herdada (resolução isolada) e AD-17 herdada (o portão cobre os três
  workspaces).
- **F1** — AD-12 × AD-1/AD-2/AD-7 herdadas: ao criar um quarto lugar onde se escreve código,
  fora do alcance das três barreiras do núcleo, ela abre um esconderijo para lógica pura
  exatamente do tipo que a AD-1 herdada existe para impedir. A AD-12 fecha um dos três buracos
  (`.from()`) e deixa dois.

Nada mais contradiz. Em particular, a AD-8 **não** enfraquece a AD-17 herdada — o
`onAccent` toca núcleo e os dois apps, e a espinha diz isso na tabela.

---

## Item 7 — Toda dimensão da altitude está decidida, deferida ou declarada aberta? (envelope operacional)

**O lado de domínio está completo; o lado operacional está quase inteiramente ausente**, e é
onde a rubrica pede atenção especial.

Decidido: schema (três migrations nomeadas), fronteira transacional, onde cada módulo nasce,
qual barreira entra em qual commit, versões de pacote e prompt. Bom.

Não decidido e **não declarado aberto**:

### F16 — Migration × build instalado no aparelho `[ALTO]`

Trocar a chave primária de `edicoes_ia` de quatro para cinco colunas é DDL destrutivo numa
tabela que o **build hoje instalado no iPhone** lê. `fetchEdicao` filtra por
`(user_id, tipo_periodo, inicio, fim)` e chama `.maybeSingle()`. Depois da migration, esse
filtro casa com até quatro linhas e `maybeSingle()` **erra** (PGRST116). A Retrospectiva do
dono perde o `EdicaoCard` entre a migration e a próxima instalação nativa.

O agravante é herdado e a espinha o cita sem tirar a consequência: a AD-8 herdada diz que há
**uma instância só** e que *"todo trabalho de desenvolvimento escreve em dado real"*, e o
mobile não tem caminho OTA (build nativo, EAS manual). Ou seja: não existe janela em que
banco e app estejam em versões diferentes por acidente — a janela é garantida, e a espinha não
a ordena.

A espinha também não diz **quem aplica** as três migrations nem que a aplicação exige
confirmação explícita, que é literalmente o que a AD-8 herdada manda (*"Migration só com
confirmação explícita; DDL destrutivo nunca sem aval"*).

### F17 — Nenhuma declaração de irreversibilidade `[MÉDIO]`

A troca de PK somada à remoção das 7 edições em produção (que o companion manda sair *na*
migration) é um caminho só de ida sob um ledger append-only. Nada declara isso, e nada diz o
que existe de rede — o texto das 7 está exportado em `primeiras-edicoes-prompt-v2.md`, o que é
metade de um plano de recuperação e vale ser dito como tal.

### F18 — Teto de custo e condição de parada `[BAIXO]`

O companion mede US$ 0,011/chamada e US$ 25 carregados. A espinha não amarra teto nem condição
de parada para a corrida, o que é o único ponto onde uma frente que gasta dinheiro real
encontra a arquitetura.

**O que está corretamente resolvido do lado operacional**, e vale registrar para não ser
"consertado" depois: a `ia-narrar` existe, é `verify_jwt = true` por razão escrita, e é burra
de propósito — não importa nada do núcleo, porque a barreira do Deno exige módulo sem imports.
A espinha acerta ao não mexer nisso.

---

## Achados, por severidade

| # | Sev | Achado | Onde |
|---|---|---|---|
| F1 | crítico | A orquestração `montar → narrar → verificar → gravar` não tem dono; o terceiro hospedeiro vai duplicar `mobile/src/lib/edicao-ia.ts` e nenhuma das três barreiras do núcleo varre `scripts/` | AD-12, paradigma |
| F5 | crítico | A Rule da AD-4 fixa "quatro linhas"; CAP-11, o passo 6 do ranqueamento e a tabela de backfill dizem que a maioria das 436 edições tem 1–3, e o CHECK `length(trim(texto)) > 0` proíbe preencher | AD-4, convenções, diagrama |
| F8 | crítico | "Distribuição e deploy" defere o envelope operacional alegando que a frente não o muda — ela introduz um hospedeiro novo que precisa de JWT de usuário (`verify_jwt = true`) e de credencial que a convenção herdada de segredos restringe | Deferred |
| F2 | alto | Nada congela "o fato que liderou o ranqueamento daquele caderno"; a tira do anuário (CAP-9) recalcula e pode contradizer o texto congelado | AD-4 / CAP-9 |
| F9 | alto | `scripts/` "fora dos três" não resolve dependência sob o `nodeLinker` isolado (workspace tem 3 pacotes, raiz tem 0 deps); as duas saídas conflitam com AD-14 e AD-17 herdadas | AD-12 |
| F16 | alto | A troca de PK de `edicoes_ia` quebra o `.maybeSingle()` do build instalado no iPhone; instância única (AD-8 herdada) e sem OTA garantem a janela, e a espinha não ordena migration × release | Structural Seed |
| F3 | médio | A capa é recarimbada numa reimpressão **total**? A AD-3 só exclui a parcial | AD-3 |
| F4 | médio | `week` tem rota de revista? A AD-1 exclui só período em curso e `all` | AD-1 |
| F6 | médio | A AD-2 previne por prosa (`RetroBlockId` não é alargado, `order` não volta) num documento em que AD-7/AD-8/AD-12 nomeiam guarda e commit | AD-2 |
| F15 | médio | CAP-13 sem retomada, concorrência, teto, nem desfecho para "um caderno reprovou e três passaram" | AD-12 / CAP-13 |
| F17 | médio | Caminho só de ida (PK + remoção das 7 linhas) não declarado como tal | Structural Seed |
| F7 | baixo | "no molde do `onPrimary`" descreve mal o código (`#FFF`/`#000` + override autoral; o idioma ink/bgPure é o do `onTintOf`) | AD-8 |
| F10 | baixo | "doze blocos" na Prevents × "treze" na Rule; são 13 | AD-1 |
| F11 | baixo | Stack pina RN 0.86.3; a árvore instalada é 0.86.2 | Stack |
| F12 | baixo | O `TONE_COLOR` também lê `colors.ink3` em escopo de módulo (tema congelado no import) — defeito maior que o hex registrado | Deferred |
| F13 | baixo | Structural Seed omite `data/edicoes-ia.ts`, que muda assinatura, `onConflict` e retorno | Structural Seed |
| F14 | baixo | `companions:` cita `correcao-pre-registro-lua.md`, que ainda não existe | frontmatter |
| F18 | baixo | Sem teto de custo nem condição de parada para a corrida paga | Deferred |

**Contagem:** 3 críticos · 3 altos · 5 médios · 7 baixos — 18 achados.

---

## Correções obrigatórias antes de escrever stories

1. **Corrigir a AD-4** para "o conjunto dos cadernos **não vazios**, numa chamada", e decidir a
   semântica de `posicao` quando esse conjunto muda entre impressões. Ajustar o diagrama e a
   linha da tabela de convenções junto. *(F5)*
2. **Acrescentar uma AD de dono da impressão** — quem possui
   `imprimirEdicao(db, userId, entrada)`, e por que ela alcança os dois hospedeiros sem
   duplicar. Se ficar no núcleo com client injetado, estender também as barreiras de basename e
   de import a `scripts/`, no mesmo commit, pelo mesmo argumento que a própria AD-12 já
   escreve. *(F1)*
3. **Fechar o envelope operacional** numa AD ou numa linha de Deferred honesta: credencial do
   terceiro hospedeiro, resolução de dependência dele, e a ordem migration × release nativo.
   *(F8, F9, F16)*
4. **Decidir ou declarar aberto** o congelamento do fato líder da tira do anuário. *(F2)*

O restante é emenda de texto e pode andar junto com as stories.
