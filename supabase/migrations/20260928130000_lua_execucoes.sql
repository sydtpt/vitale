-- Orbe — `lua_execucoes`: onde cada execução do teste lunar fica gravada (story 4.2b).
--
-- AD-5 da espinha da revista · protocolo em quatro documentos imutáveis:
--   docs/specs/revista-retrospectiva/pre-registro-lua.md                       (07/09/2026)
--   docs/specs/revista-retrospectiva/correcao-pre-registro-lua.md              (08/09/2026)
--   docs/specs/revista-retrospectiva/pre-registro-lua-outras-fases.md          (28/09/2026)
--   docs/specs/revista-retrospectiva/correcao-2-pre-registro-lua-outras-fases.md (28/09/2026)
--
-- A §7 de 07/09 é a razão desta tabela, e ela não é armazenamento: é **mecânica
-- anti-gaveta**. O campo da lua tem o problema da gaveta como risco dominante
-- (Cordi 2014 o nomeia no título), e a resposta do protocolo não é impedir que o
-- dono rode o teste de novo — é tornar cada tentativa **permanente e contável**.
-- Daí as três propriedades que esta tabela existe para ter:
--
--   1. **Acumula, nunca substitui.** `insert`, jamais `upsert`. A segunda execução
--      não apaga a primeira: é a pilha de tentativas que dá sentido ao contador de
--      execuções da §7.4 ("se foram seis, a página diz *sexta execução*").
--   2. **As quatro fases juntas, ou nenhuma** (§9 de 28/09). Não por disciplina do
--      chamador: pelo `constraint trigger` do fim deste arquivo.
--   3. **Nulo é "não foi medido", nunca zero.** Efeito, p, poder e z saem nulos
--      quando um portão reprovou antes de medir, e o `comment on column` de **toda**
--      coluna nullable **contém** a cláusula `NULO = …`, dizendo o que o nulo
--      significa naquela coluna. Contém, e não "começa por": a frase útil costuma vir
--      antes da cláusula, e exigir a posição seria exigir a pior redação das duas.
--      `architecture.test.ts` cobra a cláusula, coluna por coluna, contra este arquivo.
--
-- **Por que não `edicoes_ia`** (correção de 08/09, três impedimentos independentes):
-- o CHECK de `caderno` recusa `'lua'`; a chave primária transforma o *acumula* em
-- *substitui*; e o teste roda sobre **todo o histórico**, que não é `week`, `month`,
-- `season` nem `year` — e `all` o CHECK também recusa, por desenho.
--
-- ── O grão: UMA LINHA POR FASE POR EXECUÇÃO ─────────────────────────────────
--
-- Precedente literal da story 1.9, quando `edicoes_ia` passou a ter `caderno` na
-- chave. A alternativa — uma linha por execução com os quatro vereditos dentro —
-- espremeria quatro conjuntos de veredito, efeito, p, poder, contagens e portão
-- numa linha larga ou num `jsonb` sem tipo, e **perderia o CHECK** de cada um. Com
-- o grão por fase, `fase`, `familia`, `lateralidade`, `veredito`, `motivo`,
-- `portao_reprovado` e `falta_unidade` são vocabulário fechado no banco.
--
-- As colunas de **execução** (o identificador, a hora, a cadeia, a
-- operacionalização) e as de **acervo** repetem nas quatro linhas. É denormalização
-- deliberada: são quatro linhas por execução, numa cadência de uma execução a cada
-- cem noites, e a alternativa seria uma segunda tabela — mais superfície de
-- migração do que a repetição custa.
--
-- ── Sem `if not exists`, de propósito ───────────────────────────────────────
--
-- O mesmo motivo de `edicoes_capa` (20260912120000): `if not exists` transformaria
-- "a tabela já existe com OUTRA forma" em sucesso calado, e a `create policy` logo
-- abaixo não é idempotente de qualquer jeito. Esta migração é fail-fast.
--
-- ── Nenhum índice, e isto é medido, não esquecido ───────────────────────────
--
-- A chave primária já indexa `(user_id, execucao_id, fase)`, que é por onde o
-- `constraint trigger` conta. A leitura da última execução ordena por
-- `(rodada_em desc, execucao_id desc)` sobre **quatro linhas por execução**, numa
-- cadência de uma execução a cada cem noites: são dezenas de linhas na vida da
-- tabela, e um índice para ordenar dezenas de linhas é peso sem ganho.

create table public.lua_execucoes (
  user_id uuid not null references auth.users(id) on delete cascade,

  -- **O identificador da execução, e por que ele tem esse `default`.**
  --
  -- As quatro linhas de uma execução têm de compartilhar este valor, e quem as
  -- insere é o cliente, numa chamada só. Gerar o uuid no cliente não é opção: o
  -- Hermes (React Native) não tem `crypto.randomUUID`, o repositório nunca gerou
  -- uuid fora do banco, e um `default gen_random_uuid()` daria **um id por linha**
  -- — a própria coisa que o `constraint trigger` recusa.
  --
  -- `now()` é o `transaction_timestamp()`: constante dentro da transação e igual
  -- para as quatro linhas do mesmo `insert`, que é uma statement e uma transação.
  -- `auth.uid()` é constante na sessão. Então o default é **o mesmo valor para as
  -- quatro linhas** sem que ninguém precise combinar nada — e duas execuções
  -- distintas do mesmo dono no mesmo microssegundo colidiriam na chave primária,
  -- que é falha alta, não silenciosa.
  --
  -- `extract(epoch from now())`, e não `now()::text`: a segunda depende do
  -- `TimeZone` da sessão, e o id de uma execução não deve mudar de forma com a
  -- configuração de quem a gravou.
  --
  -- **`txid_current()` entra no md5 porque os outros dois ingredientes empatam.**
  -- `auth.uid()` é **nulo** em toda sessão sem JWT — `postgres`, `service_role`, o
  -- ensaio, um backfill por script —, e lá o `coalesce` devolve a mesma palavra
  -- para todo mundo. Sobra o relógio, e duas execuções em transações diferentes no
  -- mesmo microssegundo colidiriam na chave primária **sem nome**: "duplicate key
  -- value violates lua_execucoes_pkey", que não diz que duas execuções tentaram ser
  -- a mesma. O id da transação é único no cluster e resolve isso.
  --
  -- **Dentro de UMA transação o id continua constante, e isso é o desenho.** É
  -- exatamente o que faz as quatro linhas de um `insert` compartilharem o valor sem
  -- ninguém combinar nada. A consequência é que duas execuções *distintas* na mesma
  -- transação colidem na chave — e é o desfecho certo: a §9 fala de uma execução por
  -- escrita, e duas numa transação só não é uma coisa que este desenho permita.
  execucao_id uuid not null
    default md5(coalesce(auth.uid()::text, 'sem-sessao') || '|'
                || txid_current()::text || '|'
                || extract(epoch from now())::text)::uuid,

  -- A hora da execução. `default now()` — o mesmo `transaction_timestamp()` do id,
  -- então as quatro linhas concordam por construção. Escrita pelo banco e não pelo
  -- cliente: aqui não há caminho de `update` (a tabela só acumula), e o relógio do
  -- servidor é o único que os dois hospedeiros compartilham.
  rodada_em timestamptz not null default now(),

  -- ── A cadeia de documentos que autorizou a execução ──────────────────────
  --
  -- A §7.1 manda o executor comparar a sha256 do pré-registro **antes de rodar**;
  -- o §10 de 28/09 estendeu a exigência aos dois documentos, e a segunda correção,
  -- aos quatro. O que fica gravado é a **lista ordenada** de `{arquivo, sha256}`,
  -- e não só o digest, porque a pergunta que um leitor futuro faz é *quais
  -- documentos autorizaram isto* — não *qual era o digest*.
  --
  -- A cadeia é **append-only** nos três documentos que a declaram, então quatro é
  -- o piso: um documento novo acrescenta um par, nenhum some. O piso **não sobe**
  -- quando a cadeia crescer — execuções antigas têm quatro elos e continuam
  -- legíveis. É `CADEIA_MINIMA` (`sleep/lua-carimbo.ts`), e um teste confere que
  -- o número aqui é o de lá.
  --
  -- **`case`, e não `and`.** O `and` do Postgres não garante curto-circuito: o
  -- planejador pode avaliar `jsonb_array_length(cadeia)` antes do `jsonb_typeof`,
  -- e sobre um objeto jsonb essa função **levanta `22023`** ("cannot get array
  -- length of a non-array") em vez de violar um CHECK nomeado. A diferença aparece
  -- na mensagem que chega ao app: um erro de tipo cru, sem o nome da constraint,
  -- em vez de "viola lua_execucoes_cadeia_check". O `case` é a única forma de
  -- pedir a ordem de avaliação em SQL.
  cadeia jsonb not null
    check (case when jsonb_typeof(cadeia) = 'array'
                then jsonb_array_length(cadeia) >= 4
                else false end),

  -- O digest da cadeia: sha256 das sha256, na ordem, unidas por `\n`. É a forma
  -- curta de comparar duas execuções; a forma longa é a coluna acima.
  cadeia_digest text not null check (cadeia_digest ~ '^[0-9a-f]{64}$'),

  -- ── A operacionalização, carimbada em cada execução ──────────────────────
  --
  -- O §10 de 28/09 nomeia a dívida: estes três valores vivem em
  -- `packages/shared/src/sleep/lua.ts`, **fora de qualquer documento hasheado**, e
  -- mudar um deles depois de ver o resultado desloca a coluna testada **sem
  -- quebrar o build**. A barreira que os cobraria é decisão da story 4.3.
  --
  -- Carimbá-los aqui não impede a mudança — torna-a **visível depois do fato**,
  -- que é o propósito declarado da §7.3: não impedir, obrigar a dizer em voz alta.
  -- Duas execuções com janelas diferentes ficam lado a lado na mesma tabela.
  --
  -- O teto de 30 não é folga arbitrária: **uma lunação inteira tem 29,53 dias**, e
  -- uma janela de 30 noites classifica *toda* noite como exposta, esvaziando a
  -- coluna de controle. Acima disso o número não é uma janela mais larga, é um
  -- teste que deixou de existir — e o CHECK é o que impede que ele seja gravado
  -- com cara de execução válida.
  janela_noites smallint not null check (janela_noites >= 1 and janela_noites <= 30),
  hora_utc_do_fim_da_noite smallint not null
    check (hora_utc_do_fim_da_noite >= 0 and hora_utc_do_fim_da_noite <= 23),
  -- `aberta` é a borda `[fase − 5 d, fase)` do §3. O valor não é copiado de um
  -- literal no TypeScript: ele é **medido** contra a própria classificação, que é o
  -- que faz dele um carimbo e não um comentário.
  borda_direita text not null check (borda_direita in ('aberta', 'fechada')),

  -- **A versão do motor — o carimbo que falta quando a conta muda de forma.**
  --
  -- A janela, a hora e a borda dizem **qual noite entrou em qual coluna**. Nada
  -- dizia **com que aritmética o veredito saiu**: trocar o Hodges–Lehmann pela
  -- diferença de medianas, o Mann–Whitney por outro teste, ou a aproximação normal
  -- do poder por uma exata muda efeito, p e poder sobre o **mesmo** acervo, e
  -- mudá-los *depois de ver o resultado* é a gaveta pela porta dos fundos. Como os
  -- três valores acima, este carimbo não impede: ele põe duas execuções com
  -- motores diferentes lado a lado na mesma tabela.
  --
  -- É `MOTOR_LUNAR_VERSAO` (`sleep/lua-carimbo.ts`), e ela é presa por um golden do
  -- sha256 de `sleep/lua-protocolo.ts`: mexer no motor sem subir a versão reprova a
  -- suíte. O molde é `PROMPT_VERSAO` com o golden de `ia/verificar.test.ts`.
  motor_versao smallint not null check (motor_versao >= 1),

  -- **A versão da RÉGUA, que não é a do motor — e são duas de propósito.**
  --
  -- As três colunas acima carimbam os *valores* da janela. A **lógica** que os usa
  -- pode mudar sem que nenhum deles mude, e mudou duas vezes em setembro de 2026: o
  -- instante da noite foi do entardecer para o fim dela, e a hora foi de 11:00 para
  -- 08:00 UTC. Sem esta coluna, duas execuções com a mesma janela, a mesma hora e a
  -- mesma borda seriam **indistinguíveis** mesmo com a régua reescrita no meio.
  --
  -- Juntá-la a `motor_versao` faria uma mudança de janela subir a versão do motor,
  -- dizendo a coisa errada: o motor não mudou, a régua mudou. É `JANELA_LUNAR_VERSAO`
  -- (`sleep/lua-carimbo.ts`), presa por um golden do sha256 de `sleep/lua.ts` em
  -- `architecture.test.ts` — a mesma barreira que pina os quatro documentos da
  -- cadeia, e que desde a story 4.3 **impede** a mudança silenciosa da régua em vez
  -- de só carimbá-la.
  janela_versao smallint not null check (janela_versao >= 1),

  -- ── O que foi PEDIDO, que não é o mesmo que o que foi achado ─────────────
  --
  -- O `desde` da leitura decide quais noites entram tanto quanto `janela_noites`, e
  -- ele mora no **chamador** — `fetchNoitesLunares` não tem padrão, de propósito.
  -- Sem esta coluna, "o acervo começa em 2026-01-01" é ambíguo entre *pedi assim* e
  -- *não há dado antes*, e as duas levam a leituras opostas da mesma execução.
  -- `INICIO_DO_ACERVO_LUNAR` (23/04/2025, §3) é o valor do protocolo; a coluna
  -- guarda o que de fato foi pedido, que pode ser outro numa execução exploratória.
  pedido_desde date not null,

  -- ── O acervo sobre o qual a execução rodou ───────────────────────────────

  acervo_noites integer not null check (acervo_noites >= 0),
  acervo_noites_distintas integer not null check (acervo_noites_distintas >= 0),
  -- **Quantas noites chegaram com mais de um período de sono e foram colapsadas.**
  --
  -- O colapso pelo `onset_at` mais cedo é a escolha operacional mais nova da cadeia
  -- (a segunda correção de 28/09) e a única que não vira nenhum outro número aqui:
  -- janela, hora, borda e motor têm coluna; o colapso não tinha. Zero é resposta —
  -- "nenhuma noite precisou" —, e não ausência de medida: a leitura conta sempre.
  acervo_noites_colapsadas integer not null check (acervo_noites_colapsadas >= 0),
  acervo_de date,
  acervo_ate date,
  acervo_sd_min double precision,
  acervo_origem_do_eixo_h double precision not null
    check (acervo_origem_do_eixo_h >= 0 and acervo_origem_do_eixo_h < 24),
  acervo_noites_sem_luz integer not null check (acervo_noites_sem_luz >= 0),
  acervo_primeira_noite_sem_luz date,

  -- ── A fase, e o que o protocolo fixou para ela ───────────────────────────
  --
  -- Os ids são os de `LunarPhaseKind` (`astro/moon.ts`), letra por letra, do
  -- Postgres ao componente — o mesmo princípio de `edicoes_ia.caderno`: um id que
  -- precisasse de tradução entre camadas seria um id a mais para manter em
  -- sincronia. Por isso `firstQuarter`, e não `first_quarter`.
  fase text not null check (fase in ('new', 'firstQuarter', 'full', 'lastQuarter')),

  -- As duas famílias, que **nunca** se somam num resultado só (§2 de 28/09): a
  -- cheia é confirmatória a 5%, pré-registrada sozinha em 07/09 com direção tirada
  -- do Casiraghi 2021; as três nasceram depois, em trio, sem direção própria.
  familia text not null check (familia in ('cheia', 'as-tres')),

  -- `double precision`, e não `numeric`: α das três é 5/3 %, um número que não tem
  -- representação decimal exata, e o que a página imprime arredondado (1,67%) é
  -- **mais frouxo** que o protocolo. O `double` é o mesmo valor que o motor usou.
  alfa double precision not null check (alfa > 0 and alfa < 1),

  lateralidade text not null check (lateralidade in ('unilateral', 'bilateral')),
  direcao text check (direcao in ('atraso')),

  -- ── O veredito ───────────────────────────────────────────────────────────

  veredito text not null
    check (veredito in ('achado', 'nenhum_padrao', 'inconclusivo')),
  motivo text check (motivo in ('luz', 'amostra', 'ciclos', 'poder')),
  portao_reprovado text check (portao_reprovado in ('luz', 'amostra', 'ciclos')),

  -- ── A medida. Nula é "não foi medida" ────────────────────────────────────

  efeito_min double precision,
  -- Uma letra, porque é o nome que os dois pré-registros usam e o nome do campo do
  -- motor (`ResultadoDaFase.p`). O tradutor de linha é um só e mapeia
  -- coluna↔campo sem apelido; batizá-la `p_valor` aqui criaria a tradução que o
  -- resto desta tabela evita.
  p double precision check (p >= 0 and p <= 1),
  z_de_mann_whitney double precision,
  poder double precision check (poder >= 0 and poder <= 1),
  efeito_minimo_detectavel_min double precision,

  -- ── As contagens, que valem sempre ───────────────────────────────────────

  noites_dentro integer not null check (noites_dentro >= 0),
  noites_fora integer not null check (noites_fora >= 0),
  ciclos integer not null check (ciclos >= 0),

  -- ── Quanto falta, **e em quê** ───────────────────────────────────────────
  --
  -- Quatro motivos, quatro unidades diferentes, e o número sozinho mente. O
  -- precedente é a story 2.8, o "1 dias": lá o defeito era a unidade não concordar
  -- com o número; aqui seria a unidade não existir. Quem imprimir "faltam N
  -- noites" para `ciclos` está imprimindo outra coisa com o nome de noite.
  falta_quanto integer check (falta_quanto >= 1),
  falta_unidade text check (falta_unidade in (
    'noites-sem-luz', 'noites-de-coluna', 'ciclos', 'noites-coletaveis')),

  noites_para_80 integer check (noites_para_80 >= 1),

  primary key (user_id, execucao_id, fase),

  -- Meia falta não é falta — o molde de `capa_identidade_bate_com_natureza`.
  constraint falta_tem_numero_e_unidade check (
    (falta_quanto is null) = (falta_unidade is null)
  ),

  -- A unidade sai do motivo, e de lugar nenhum mais. É `UNIDADE_DO_MOTIVO`
  -- (`sleep/lua-protocolo.ts`) escrita no banco: sem isto, uma execução podia
  -- gravar "faltam 3 ciclos" com a unidade de noites e a página imprimiria a frase
  -- errada com a tipografia de um fato medido.
  constraint unidade_bate_com_o_motivo check (
    falta_unidade is null
    or (motivo = 'luz' and falta_unidade = 'noites-sem-luz')
    or (motivo = 'amostra' and falta_unidade = 'noites-de-coluna')
    or (motivo = 'ciclos' and falta_unidade = 'ciclos')
    or (motivo = 'poder' and falta_unidade = 'noites-coletaveis')
  ),

  -- **"Nenhum padrão" e "inconclusivo" não são a mesma coisa** (§5 de 07/09), e
  -- confundi-los é o erro mais fácil do protocolo. O motivo existe exatamente
  -- quando o veredito é `inconclusivo`; um veredito decidido com motivo guardado
  -- seria as duas coisas ao mesmo tempo.
  --
  -- `falta` **pode** ser nula num `inconclusivo`: quando a dispersão é degenerada,
  -- a conta de quanto falta não existe, e um número ali seria invenção.
  constraint motivo_existe_quando_inconclusivo check (
    (veredito = 'inconclusivo' and motivo is not null)
    or (veredito <> 'inconclusivo' and motivo is null
        and portao_reprovado is null and falta_quanto is null)
  ),

  -- O portão reprovado É o motivo, quando há portão. `motivo = 'poder'` é o
  -- inconclusivo **com os três portões abertos**, e por isso não tem portão.
  constraint portao_e_o_proprio_motivo check (
    (portao_reprovado is null and (motivo is null or motivo = 'poder'))
    or portao_reprovado = motivo
  ),

  -- Portão fechado ⇒ **nada foi medido**. É a gramática de ausência da AD-16 na
  -- direção estrita: zero aqui seria uma medida, e uma medida que não aconteceu.
  constraint portao_reprovado_nao_mede check (
    portao_reprovado is null
    or (efeito_min is null and p is null and z_de_mann_whitney is null
        and poder is null and efeito_minimo_detectavel_min is null
        and noites_para_80 is null)
  ),

  -- E o inverso: veredito decidido ⇒ a medida existe. Um `achado` sem efeito, sem
  -- p ou sem poder seria um veredito sem a conta que o produziu.
  --
  -- `z_de_mann_whitney` fica de fora de propósito: ele é nulo quando **não houve
  -- teste** — coluna vazia ou tudo empatado —, e nesses casos o p é 1 por decisão
  -- declarada, não por conta.
  constraint medida_existe_quando_ha_veredito check (
    veredito = 'inconclusivo'
    or (efeito_min is not null and p is not null and poder is not null)
  ),

  -- **O poder é portão, e o portão tem um número.** Os dois lados dele:
  --
  -- Um veredito decidido passou pelo portão, então o poder dele é **ao menos 0,8**
  -- (§4). Sem este CHECK, uma linha com `achado` e poder 0,3 é gravável — e ela
  -- seria a forma exata da gaveta que o protocolo inteiro existe para fechar: um p
  -- pequeno num acervo que não sustenta a conclusão.
  constraint veredito_decidido_passou_no_poder check (
    veredito = 'inconclusivo' or poder >= 0.8::double precision
  ),

  -- E o outro lado: `motivo = 'poder'` é o inconclusivo que **chegou a medir** e
  -- achou pouco, então o poder dele é menor que 0,8.
  --
  -- **`poder is null` é aceito aqui, e isso não é frouxidão.** O motor devolve
  -- `motivo = 'poder'` com poder nulo quando a dispersão é degenerada — SD zero ou
  -- não finito —, porque poder não medido não é poder suficiente. É o mesmo caso em
  -- que `falta` sai nula, e o CHECK que o recusasse tornaria esse acervo
  -- **impossível de gravar**: a execução rodaria, produziria um veredito legítimo e
  -- morreria na escrita, que é o desfecho mais caro de todos (a tabela só recebe
  -- uma execução a cada cem noites).
  constraint poder_fraco_e_o_motivo_poder check (
    motivo is distinct from 'poder'
    or poder is null
    or poder < 0.8::double precision
  ),

  -- Um ciclo sinódico só conta quando contribui com ao menos uma noite DENTRO da
  -- janela desta fase, então ciclos nunca passa de noites_dentro. É a mesma
  -- afirmação de `colunas_cabem_no_acervo`, um nível abaixo: sem ela, "10 ciclos
  -- com 6 noites dentro" é gravável e a página imprime um portão que passou por
  -- aritmética impossível.
  constraint ciclos_cabem_nas_noites_dentro check (ciclos <= noites_dentro),

  -- **`double precision` aceita `'NaN'` calado, e `>= 0` não o pega.**
  --
  -- No Postgres o NaN é ordenado **acima** de qualquer número: `'NaN' >= 0` é
  -- verdadeiro, e um CHECK de piso deixa passar o NaN inteiro. `alfa`, `p`, `poder`
  -- e `acervo_origem_do_eixo_h` escapam por acidente — os quatro têm **teto**, e
  -- `NaN < 24` é falso. As quatro colunas abaixo não tinham nenhum, e um NaN nelas
  -- chegaria à página como um efeito que não desenha e um eixo que não ordena.
  --
  -- `x < 'Infinity'` é o teste de finitude que também recusa NaN, e por isso ele
  -- basta sozinho de um lado. Os pisos ficam explícitos porque dizem outra coisa:
  -- SD é distância (nunca negativa) e MDE é um deslocamento a detectar (zero seria
  -- "detecta qualquer coisa", que é o oposto da verdade).
  constraint as_medidas_sao_numeros_finitos check (
    (acervo_sd_min is null
       or (acervo_sd_min >= 0 and acervo_sd_min < 'Infinity'::double precision))
    and (efeito_min is null
       or (efeito_min > '-Infinity'::double precision
           and efeito_min < 'Infinity'::double precision))
    and (z_de_mann_whitney is null
       or (z_de_mann_whitney > '-Infinity'::double precision
           and z_de_mann_whitney < 'Infinity'::double precision))
    and (efeito_minimo_detectavel_min is null
       or (efeito_minimo_detectavel_min > 0
           and efeito_minimo_detectavel_min < 'Infinity'::double precision))
  ),

  constraint acervo_intervalo_valido check (
    (acervo_de is null) = (acervo_ate is null)
    and (acervo_ate is null or acervo_ate >= acervo_de)
  ),

  -- **Acervo vazio e intervalo são a mesma afirmação, e têm de concordar.**
  -- `acervo_intervalo_valido` prende `de` a `ate` e não olha a contagem: zero noites
  -- com intervalo, ou 300 noites sem intervalo, passam por ele. A segunda metade é a
  -- dispersão: o SD marginal só existe com **duas** noites ou mais, e um número ali
  -- sobre uma noite só seria zero com cara de medida.
  constraint acervo_vazio_nao_tem_intervalo check (
    (acervo_noites = 0) = (acervo_de is null)
    and (acervo_sd_min is null or acervo_noites >= 2)
  ),

  -- Colapsar é tirar período, nunca acrescentar noite.
  constraint acervo_colapsado_cabe_no_acervo check (
    acervo_noites_colapsadas <= acervo_noites
  ),

  -- O `desde` recorta por `wake_day >= desde`, então a primeira noite do acervo
  -- nunca é anterior ao que foi pedido. Um acervo que começasse antes do pedido
  -- seria leitura por outro caminho que não a porta.
  constraint acervo_comeca_depois_do_pedido check (
    acervo_de is null or acervo_de >= pedido_desde
  ),

  -- As duas contagens do acervo **são iguais**, sempre: o motor recusa `wakeDay`
  -- repetido em vez de deduplicar, porque duplicata infla poder. A coluna existe
  -- para quem auditar, e o CHECK é o que faz dela uma afirmação em vez de um par
  -- de números que podem discordar sem que nada acuse.
  constraint acervo_nao_tem_noite_repetida check (
    acervo_noites = acervo_noites_distintas
  ),

  -- A noite sem luz que a coluna aponta só existe se houver noite sem luz.
  constraint primeira_sem_luz_bate_com_a_contagem check (
    (acervo_noites_sem_luz = 0 and acervo_primeira_noite_sem_luz is null)
    or (acervo_noites_sem_luz > 0 and acervo_primeira_noite_sem_luz is not null)
  ),

  constraint colunas_cabem_no_acervo check (
    noites_dentro + noites_fora = acervo_noites
  )
);

comment on table public.lua_execucoes is
  'Cada execução do teste lunar pré-registrado, UMA LINHA POR FASE (AD-5). Acumula, nunca substitui: é a pilha de tentativas que dá sentido ao contador de execuções da §7.4. Autoridade: os quatro documentos imutáveis de docs/specs/revista-retrospectiva/.';

comment on column public.lua_execucoes.user_id is
  'O dono. A RLS decide o que cada um vê e escreve.';
comment on column public.lua_execucoes.execucao_id is
  'A execução a que esta linha pertence. As quatro fases compartilham o valor, que sai do default (now() é constante na transação) porque o Hermes não gera uuid.';
comment on column public.lua_execucoes.rodada_em is
  'Quando a execução rodou. Igual nas quatro linhas: o mesmo transaction_timestamp() do execucao_id.';
comment on column public.lua_execucoes.cadeia is
  'A lista ORDENADA de {arquivo, sha256} dos documentos que autorizaram esta execução, append-only. A pergunta do leitor futuro é quais documentos autorizaram isto, não qual era o digest.';
comment on column public.lua_execucoes.cadeia_digest is
  'sha256 das sha256 da cadeia, na ordem, unidas por quebra de linha — a forma curta de comparar duas execuções.';
comment on column public.lua_execucoes.janela_noites is
  'JANELA_LUNAR_NOITES no momento da execução (5 no protocolo). Carimbado porque vive em código fora de documento hasheado (§10 de 28/09).';
comment on column public.lua_execucoes.hora_utc_do_fim_da_noite is
  'HORA_UTC_DO_FIM_DA_NOITE no momento da execução (8 no protocolo): a hora UTC que representa a noite. Carimbado pelo mesmo motivo.';
comment on column public.lua_execucoes.borda_direita is
  'A borda direita da janela [fase - 5 d, fase) no momento da execução: aberta no protocolo. Medida contra a classificação, não copiada de um literal.';
comment on column public.lua_execucoes.motor_versao is
  'MOTOR_LUNAR_VERSAO no momento da execução: a aritmética que produziu efeito, p e poder (Hodges-Lehmann, Mann-Whitney, aproximação normal do poder). Presa por golden do sha256 de sleep/lua-protocolo.ts — mexer no motor sem subir a versão reprova a suíte.';
comment on column public.lua_execucoes.janela_versao is
  'JANELA_LUNAR_VERSAO no momento da execução: a régua que decidiu qual noite entrou em qual coluna. Separada de motor_versao porque uma mudança de janela não muda o motor — e as três colunas de valor acima não mudam quando só a lógica de sleep/lua.ts muda, o que aconteceu duas vezes em setembro de 2026. Presa por golden do sha256 de sleep/lua.ts.';
comment on column public.lua_execucoes.pedido_desde is
  'O desde que o chamador pediu à leitura. Sem ele, um acervo que começa tarde é ambíguo entre pedi assim e não há dado antes. O valor do protocolo é 23/04/2025 (§3), em INICIO_DO_ACERVO_LUNAR.';

comment on column public.lua_execucoes.acervo_noites is
  'Noites que entraram na execução.';
comment on column public.lua_execucoes.acervo_noites_distintas is
  'wakeDay distintos — sempre igual a acervo_noites, porque o motor recusa noite repetida em vez de deduplicar (duplicata infla poder). Publicada para quem auditar.';
comment on column public.lua_execucoes.acervo_noites_colapsadas is
  'Quantas noites chegaram com mais de um período de sono e foram colapsadas pelo onset_at mais cedo (segunda correção de 28/09). Zero é resposta — nenhuma precisou —, não ausência de medida.';
comment on column public.lua_execucoes.acervo_de is
  'O primeiro wakeDay do acervo, em ordem cronológica. NULO = acervo vazio, e então acervo_ate também é nulo.';
comment on column public.lua_execucoes.acervo_ate is
  'O último wakeDay do acervo. NULO = acervo vazio.';
comment on column public.lua_execucoes.acervo_sd_min is
  'SD marginal BRUTO da hora de apagar, em minutos — o único número que a §5 autoriza consultar antes de rodar. NULO = menos de duas noites, e então não há dispersão a medir.';
comment on column public.lua_execucoes.acervo_origem_do_eixo_h is
  'A origem do eixo do relógio efetivamente usada, em horas locais: 18 salvo travessia. Girar não move efeito nem p (os dois são invariantes a somar constante), mas move o SD e portanto o poder, que é portão.';
comment on column public.lua_execucoes.acervo_noites_sem_luz is
  'Noites sem horas de luz utilizáveis. Acima de zero, as quatro fases param no portão da luz — a covariável é pré-requisito do §3, não ressalva.';
comment on column public.lua_execucoes.acervo_primeira_noite_sem_luz is
  'O wakeDay da primeira noite sem luz, por onde começar a olhar. NULO = nenhuma noite sem luz.';

comment on column public.lua_execucoes.fase is
  'Qual das quatro fases principais esta linha mede. Os ids são os de LunarPhaseKind (astro/moon.ts), letra por letra.';
comment on column public.lua_execucoes.familia is
  'A família do teste: cheia (confirmatória, 5%, pré-registrada sozinha em 07/09) ou as-tres (nascidas em trio em 28/09). As duas NUNCA se somam num resultado só (§2 de 28/09).';
comment on column public.lua_execucoes.alfa is
  'O α desta fase no momento da execução: 0,05 na cheia, 0,05/3 em cada uma das três. Carimbado, não derivado da família na leitura.';
comment on column public.lua_execucoes.lateralidade is
  'unilateral na cheia, que tem mecanismo e direção na literatura; bilateral nas três, que não têm (§5 de 28/09).';
comment on column public.lua_execucoes.direcao is
  'A direção que conta como achado: atraso na cheia. NULO = as duas contam (o bilateral das três), e não "direção não registrada".';

comment on column public.lua_execucoes.veredito is
  'achado, nenhum_padrao ou inconclusivo. Os três se publicam, na mesma página e com o mesmo destaque (§5 de 07/09).';
comment on column public.lua_execucoes.motivo is
  'Por que este inconclusivo é inconclusivo: luz, amostra, ciclos (os portões) ou poder (os três portões abertos). NULO = o veredito não é inconclusivo.';
comment on column public.lua_execucoes.portao_reprovado is
  'Qual portão da §4 reprovou. NULO = nenhum reprovou — inclusive no inconclusivo por poder, que passa os três.';

comment on column public.lua_execucoes.efeito_min is
  'Deslocamento de Hodges-Lehmann em minutos, COM SINAL (positivo é atraso). NULO = não foi medido, porque um portão reprovou antes; zero seria mentira.';
comment on column public.lua_execucoes.p is
  'p de Mann-Whitney, na lateralidade desta fase. NULO = não foi medido (portão fechado).';
comment on column public.lua_execucoes.z_de_mann_whitney is
  'O z que produziu o p — U padronizado, já com as correções de continuidade e de empates. Publicado para que o p seja auditável contra a tabela normal sem refazer o teste. NULO = não foi medido, ou não houve teste com que medir (coluna vazia ou tudo empatado, em que o p é 1 por decisão declarada).';
comment on column public.lua_execucoes.poder is
  'Poder para detectar 15 min, no SD marginal bruto. É PORTÃO, não desempate: abaixo de 0,8 o veredito é inconclusivo mesmo com p pequeno. NULO = não foi medido.';
comment on column public.lua_execucoes.efeito_minimo_detectavel_min is
  'Efeito mínimo detectável a 80% de poder, em minutos — a segunda coluna das tabelas dos dois documentos. NULO = não foi medido.';

comment on column public.lua_execucoes.noites_dentro is
  'Noites na janela desta fase.';
comment on column public.lua_execucoes.noites_fora is
  'Noites fora dela — todas as outras, e a coluna de controle CONTÉM as janelas das outras três fases (§7 de 28/09). O viés é para o nulo: esconde achado, não fabrica.';
comment on column public.lua_execucoes.ciclos is
  'Ciclos sinódicos distintos que contribuíram com ao menos uma noite nesta janela. O portão pede 10.';

comment on column public.lua_execucoes.falta_quanto is
  'Quanto falta para este inconclusivo deixar de ser inconclusivo. NULO = o veredito não é inconclusivo, ou a dispersão é degenerada e a conta não existe.';
comment on column public.lua_execucoes.falta_unidade is
  'A unidade do número ao lado: quatro motivos, quatro unidades. NULO = não há número. Nunca imprima "faltam N noites" quando a unidade é ciclos.';
comment on column public.lua_execucoes.noites_para_80 is
  'Noites TOTAIS para 80% de poder em 15 min, mantida a razão de colunas observada — o número que os documentos tabelam. NULO = não foi medido.';

alter table public.lua_execucoes enable row level security;

-- ── POLICIES POR VERBO, e a ausência de duas delas é o desenho ──────────────
--
-- As irmãs desta tabela usam `for all`, e aqui isso estaria errado. `for all`
-- concede `update` — e um veredito gravado poderia ser **reescrito no lugar**,
-- que é exatamente o contrário das três propriedades do topo deste arquivo. O
-- `acumula, nunca substitui` da §7.2 deixaria de ser propriedade do banco e
-- voltaria a ser disciplina do chamador, que é a coisa que este par de documentos
-- existe para não depender.
--
-- **Não há `for update`.** Uma execução é uma tentativa que aconteceu; corrigir
-- uma é reescrever a história do teste. O que se faz é gravar outra — e o contador
-- da §7.4 conta as duas, que é o ponto.
--
-- **Não há `for delete`, e isto é a gaveta fechando de verdade.** Apagar uma
-- execução inteira continua sendo o único desfazer que existe (ver o gatilho
-- abaixo), mas ele deixa de ser alcançável pela API: tirar uma execução passa a
-- exigir o dono agindo como superusuário, de propósito e em voz alta. É o
-- "não impedir, obrigar a dizer em voz alta" da §7.3 — com a diferença de que um
-- `delete` pelo app não deixaria rastro nenhum de ter acontecido.
--
-- **A policy de `select` é o que sustenta a invariante, e não é só leitura.** O
-- `constraint trigger` abaixo é `security invoker`: ele conta as linhas da execução
-- **pelos olhos de quem escreveu**. Sem `select`, a contagem enxerga zero, o ramo
-- `v_linhas = 0` retorna calado e o "quatro ou nenhuma" para de ser cobrado sem
-- que nada acuse. Quem mexer nesta policy está mexendo no gatilho.
create policy "lua_execucoes: o dono lê as suas" on public.lua_execucoes
  for select using (auth.uid() = user_id);

create policy "lua_execucoes: o dono grava as suas" on public.lua_execucoes
  for insert with check (auth.uid() = user_id);

-- ── "Quatro ou nenhuma" é do BANCO, não da porta (§9 de 28/09) ──────────────
--
-- *"Uma execução autorizada calcula as quatro fases, grava as quatro e publica as
-- quatro. É proibido rodar uma fase, ver o resultado e decidir se roda as outras."*
--
-- Um `insert` de quatro linhas numa statement já é atômico, e isso resolve o
-- caminho felizes — mas deixa a regra dependendo de o único chamador estar certo,
-- e **este par de documentos existe para não depender de disciplina**. O
-- `constraint trigger` cobra a forma no COMMIT, para quem quer que escreva.
--
-- **`deferrable initially deferred` é o que torna a regra cobrável.** Sem isso a
-- primeira das quatro linhas já violaria a contagem, e a escrita inteira ficaria
-- impossível — o mesmo mecanismo que a 1.9 usou para a permutação de posições, pelo
-- mesmo motivo: a invariante vale no fim da transação, não no meio dela.
--
-- **Não há `pg_advisory_xact_lock` aqui**, ao contrário de `edicao_imprimir`.
-- Execuções acumulam e nunca permutam: duas execuções concorrentes escrevem
-- `execucao_id` distintos e não disputam linha nenhuma, então a corrida que a 1.9
-- tinha não existe.
--
-- **Zero é legítimo, e é o único desfazer que existe.** Apagar uma execução
-- INTEIRA é um ato com cara de ato; apagar três de quatro não é desfazer, é
-- mutilar — e deixaria uma execução que publica três fases, que é exatamente o que
-- a §9 proíbe.
--
-- **O ramo DELETE continua aqui mesmo sem policy de `delete`.** Não é código
-- morto: a RLS não vale para superusuário, e o `delete` de uma execução inteira é
-- precisamente o caminho que sobra depois que a policy fechou a porta da API. O
-- gatilho é o que garante que esse caminho também obedeça à §9 — `on delete
-- cascade` de `auth.users` passa por aqui, e um `delete` à mão no psql também.
-- Tirar o ramo deixaria o único desfazer que existe sem cobrança nenhuma.

create or replace function public.lua_execucao_conferir(p_user uuid, p_execucao uuid)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $conferir$
declare
  v_linhas integer;
  v_fases  integer;
begin
  select count(*), count(distinct l.fase)
    into v_linhas, v_fases
    from public.lua_execucoes l
   where l.user_id = p_user
     and l.execucao_id = p_execucao;

  if v_linhas = 0 then
    return;
  end if;

  -- `count(distinct fase) = 4` com o CHECK da coluna limitando a quatro valores
  -- **é** "uma linha por fase": quatro linhas, quatro fases distintas, e só quatro
  -- fases existem. Não precisa nomeá-las aqui.
  if v_linhas <> 4 or v_fases <> 4 then
    raise exception
      'a execução % ficou com % linha(s) e % fase(s) distintas — uma execução do teste lunar grava as QUATRO fases ou nenhuma (§9 do pré-registro de 28/09/2026). Apagar uma execução inteira é permitido; deixá-la com três, não.',
      p_execucao, v_linhas, v_fases;
  end if;
end
$conferir$;

comment on function public.lua_execucao_conferir(uuid, uuid) is
  'Cobra que uma execução do teste lunar tenha exatamente quatro linhas, uma por fase — ou nenhuma. Chamada pelo constraint trigger de lua_execucoes, no commit.';

create or replace function public.lua_execucao_completa()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $completa$
begin
  -- Os dois lados do `update` são conferidos: um `update` que move uma linha para
  -- outro `execucao_id` deixaria a execução de origem com três, e conferir só o
  -- `new` não veria isso. `old` e `new` são lidos em ramos separados de propósito —
  -- referenciar `old` num `insert` é erro de plpgsql, não nulo.
  if tg_op = 'INSERT' then
    perform public.lua_execucao_conferir(new.user_id, new.execucao_id);
  elsif tg_op = 'DELETE' then
    perform public.lua_execucao_conferir(old.user_id, old.execucao_id);
  else
    perform public.lua_execucao_conferir(old.user_id, old.execucao_id);
    perform public.lua_execucao_conferir(new.user_id, new.execucao_id);
  end if;
  return null;
end
$completa$;

comment on function public.lua_execucao_completa() is
  'Função do constraint trigger de lua_execucoes: só se chama como trigger. Ver lua_execucao_conferir.';

create constraint trigger lua_execucoes_quatro_ou_nenhuma
  after insert or update or delete on public.lua_execucoes
  deferrable initially deferred
  for each row
  execute function public.lua_execucao_completa();
