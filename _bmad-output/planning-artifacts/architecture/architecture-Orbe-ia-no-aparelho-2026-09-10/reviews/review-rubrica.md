# Revisão pela rubrica — espinha "Os motores do Orbe" (draft de 10/09/2026)

**Revisor:** caminhante da rubrica (independente, só leitura)
**Alvo:** `ARCHITECTURE-SPINE.md` desta pasta, contra o `.memlog.md`, a espinha pai
(`architecture-Orbe-2026-08-17`), a espinha da revista (`architecture-Orbe-revista-2026-09-08`),
as ADRs 0036/0038/0040/0041/0042, os specs `ia-analitica` e `sono` (CAP-11) e o código no
worktree `life-organizer-wt-motores` (branch `docs/motores-arquitetura`, `fcbaf6d`).

## Veredito

**Aprovar com correções obrigatórias. Não promover a `final` nem levar ao correct-course antes
de fechar os 2 críticos e os 7 altos.**

A forma está certa e bate com o código: duas costuras em duas altitudes, uma porta só, a catraca
em 2 que vira barreira, preferência local, lista de nuvem no servidor. Os fatos brownfield
conferem quase todos (ver "Conferido e correto" no fim). O que falta é o que mais importa para
unidades construídas em paralelo: **o contrato de falha e de resultado que atravessa a porta**
ainda não está fixado, e a story 1.10 é a próxima unidade a tipar essa porta. Além disso, três
regras contradizem ADR aceita ou código existente **sem declarar a superação**. E há uma regra
apoiada numa lista de vocabulário que não existe no código.

Placar: **2 críticos, 7 altos, 12 médios, 10 baixos.**

---

## Críticos

### C1 — O contrato de falha e de resultado da porta não está fixado

**Onde:** AD-1 (l. 111), AD-2 (l. 117), AD-4 (l. 129), Convenção "Resposta" (l. 179).

A AD-1 define `Motor` como "uma função de `Pedido` para `Promise<Resposta>`". A AD-4 dá sete
classes. Nenhuma regra diz **por onde a falha atravessa a porta**: rejeição com erro, ou
`Resposta` como união discriminada. Também não diz quem converte o motivo de parada, nem o que o
orquestrador devolve. Esse é o ponto de divergência nº 1 entre a ponte (F2), a porta de nuvem
(F3/F4), o orquestrador (F0) e a story 1.10. E é exatamente a divergência que o memlog registrou
como achado (l. 13: "cada uma parseando a resposta inline e tratando truncagem diferente").

Evidência de que as unidades existentes já divergem nesse ponto:

- `packages/shared/src/routes/nomear.ts:15-18`: o núcleo "deixa a exceção subir".
- `mobile/src/lib/edicao-ia.ts:43-51`: texto truncado vira `throw`, e depois vira estado `erro` (l. 114-116).
- `packages/shared/src/routes/nomear.ts:107-112`: texto truncado vira recusa permanente, gravada.
- `mobile/src/services/route-name.ts:127-129`: engole qualquer erro.
- `_bmad-output/planning-artifacts/epics.md:700-704` (story 1.11): a UI da revista distingue
  *reprovada na conferência* (lista os problemas) de *erro* (tentar de novo). O resultado do
  orquestrador da AD-2 ("frase, assinatura e a trilha", l. 117) não carrega os problemas da
  conferência, e **a reprovação da conferência não tem classe na AD-4**. Então ninguém sabe se
  ela recua, se cai no piso, ou se aparece na trilha.

**Correção (texto de Rule):**

> **AD-1, acrescentar:** `Motor` nunca rejeita. `Resposta` é união discriminada:
> `{ ok: true; texto; assinatura; motivoDeParada; tokens? }` ou
> `{ ok: false; classe: ClasseDeFalha; detalhe: string; assinatura }`. Exceção que escape de
> uma implementação é defeito dela: o orquestrador a registra como `transitoria` com o detalhe.
> Quem converte motivo de parada diferente de conclusão em `saida-invalida` é a implementação do
> motor (ponte ou adaptador), nunca o orquestrador.
>
> **AD-2, acrescentar:** o orquestrador devolve
> `{ frase: string | null; origem: MotorId; trilha: Tentativa[]; problemas: Problema[] }`, com
> `Tentativa = { motor: MotorId; resultado: 'ok' | ClasseDeFalha | 'reprovada' }`. Conferência
> reprovada não é classe de motor. Ela é `reprovada` na trilha: permanente para aquele pedido,
> não recua, cai no piso e sobe os problemas no resultado.

### C2 — Três regras contradizem ADR aceita e código existente sem declarar a superação

**Onde:** Convenção "Quando se chama um motor" (l. 184), AD-4 (l. 129, "Não existe retry
automático fora desta tabela"), Convenção "Registro de falha permanente" (l. 182), linha de
herança da ADR 0041/0042 (l. 89: "generalizados").

(a) **Chamar ao abrir a tela.** A ADR 0042 §Decisão 4 (l. 52-54) diz: "**Quando:** ao abrir o
detalhe de uma pedalada sem nome, uma vez por pedalada". O código faz isso
(`mobile/src/services/route-name.ts:5-7`, `98-103`). A espinha põe o nome de rota na porta na F4
(frontmatter l. 14, mapa l. 234) e ao mesmo tempo proíbe que qualquer tela chame motor ao abrir.
Na F4, uma das duas cede: ou o nome de rota quebra, e 175 pedaladas continuam sem nome, ou a
espinha é ignorada.

(b) **Retry automático.** A ADR 0041, nas Consequências (l. 224-225), diz: "falha de rede deixa
nulo e tenta no próximo tick". Em `route-name.ts:93-96` a pedalada volta a entrar "na próxima
abertura". A AD-4 diz que `transitoria` "só o usuário repete" e que não há retry fora da tabela.

(c) **"Nunca vai ao banco".** A recusa do nome de rota é gravada em `route_name_meta`, e isso
inclui `truncado`, que é `saida-invalida` (`nomear.ts:107-112`; ADR 0041 inv. 7). A convenção
diz que o registro de falha permanente "nunca vai ao banco", sem separar o anel de diagnóstico do
resultado de domínio de um recurso que grava.

A espinha declara que supera em parte só a invariante 4 da ADR 0040 (l. 88, 159). As três
contradições acima ficam em silêncio. Isso fere o item 5 da rubrica e a AD-11 herdada.

**Correção:**

> **Convenção "Quando se chama um motor":** por ação explícita de quem opera o hospedeiro (o
> usuário no app, quem roda a bancada ou o script). **Exceção nomeada:** o nome de rota chama ao
> abrir o detalhe de uma pedalada sem nome, uma vez por pedalada (ADR 0042 §4). Leitura de dado
> de saúde nunca é exceção.
>
> **AD-4, trocar a última frase:** `transitoria` cai no piso e não se repete na mesma execução.
> Um recurso com cursor gravado (nome de rota: `route_name is null`) volta a tentar no próximo
> gatilho dele (ADR 0041). Isso é o gatilho do recurso, não retry da porta.
>
> **Convenção "Registro de falha":** o anel local nunca vai ao banco. O resultado de domínio de
> um recurso que grava continua onde a ADR dele manda.
>
> **Herança, l. 88-89:** listar por número e parágrafo tudo o que a espinha supera, e dizer
> "ratificadas" para o resto.

---

## Altos

### A1 — A corrida F0 × story 1.10 não virou regra

**Onde:** linha de herança da revista (l. 90: "a porta `narrar` da story 1.10 **é** a `Motor`");
Seed (l. 202-208).

A frase mais importante entre as duas frentes está numa célula da tabela de herança. Ela não está
em nenhuma AD. O memlog (l. 47) mostra que a ordem "F0 antes da 1.10" ainda é recomendação, não
decisão, e a 1.10 está em `backlog` no `sprint-status.yaml:83`. Se a 1.10 começar primeiro, ela
cria o tipo dela, e nascem dois tipos de porta. É exatamente o que o memlog quer evitar. A espinha
resolveu essa mesma corrida para a bancada contra a 2.1 (AD-11, l. 171: "é ela quem cria esse
workspace"), mas não resolveu esta.

Também falta **onde mora o orquestrador**. A AD-2 diz "um orquestrador único em `ia/`", mas o
Seed não nomeia o arquivo, e a revista já reserva `ia/imprimir.ts` para "a sequência" (AD-13 da
revista). São dois orquestradores possíveis em `ia/`.

**Correção:**

> **AD-1, acrescentar:** quem chega primeiro cria. Se a 1.10 começar antes da F0, é ela que cria
> `ia/motor.ts` com `Motor`, `Pedido`, `Resposta` e `ClasseDeFalha` desta espinha, e a porta
> narrar de `ia/imprimir.ts` é tipada como `Motor`, nunca com tipo próprio. `imprimir` chama o
> orquestrador da AD-2 por caderno e acrescenta só ler e gravar.
>
> **Seed:** `ia/orquestrar.ts  # AD-2 — o orquestrador único` (ou o nome escolhido).

### A2 — O piso obrigatório colide com a revista e com o nome de rota

**Onde:** AD-2 (l. 117: "`semModelo(fatos)` (obrigatório pelo tipo)"; Prevents: "um recurso sem
piso, que some quando o motor falta"), AD-4 ("caem no piso"), AD-5 ("`sem-modelo` é sempre o
último elo").

A AD-2 vale para a retrospectiva (Binds, l. 115). Na revista, sumir quando o motor falta é o
comportamento decidido: AD-1 da revista ("a revista nunca gera sozinha") e AD-4 da revista
("caderno reprovado não tem linha"). No nome de rota, o piso é `null`, e a leitura cai no nome da
fonte (ADR 0041 inv. 7, l. 177-181). Um tipo que obrigue um texto de piso força a 1.10 e a F4 a
inventar texto sem modelo, ou a gravá-lo como edição.

**Correção:**

> **AD-2:** `semModelo(fatos)` é obrigatório pelo tipo e devolve `string | null`. `null` é
> ausência declarada, com motivo. Um recurso que grava nunca grava o piso: na retrospectiva o
> piso é `null` (caderno sem linha) e no nome de rota é `null` (cai no nome da fonte). A Saúde
> do sono tem piso de texto.

### A3 — O recuo permite trocar de provedor de nuvem: dado de saúde para um terceiro não escolhido

**Onde:** AD-5 (l. 135: "só recua para motor de regime igual ou menor"), Deferred (l. 251).

"Regime igual" deixa `nuvem:A` recuar sozinho para `nuvem:B`. A ADR 0040 **rejeitou** isso por
nome, nas Alternativas (l. 101-103: "Multi-provedor ativo desde o início (fallback automático).
Dobra [...] os regimes de dado a auditar"). Ela também manda ter uma tabela de regime **por
provedor** (l. 85-86), e a AD-5 põe todos os provedores no mesmo degrau. Isso é, ao mesmo tempo,
um buraco de privacidade (dado do Artigo 9 do RGPD indo para um provedor que o dono não escolheu
para aquele recurso) e uma contradição não declarada com ADR aceita.

A trava "nenhum provedor novo entra na lista sem a tabela de regime" está no Deferred (l. 251).
Mas ela é um portão da F3, não algo que pode esperar.

**Correção:**

> **AD-5:** o recuo nunca troca de destinatário do dado. `nuvem:<p>/<m>` só recua para outro
> modelo do mesmo provedor, para aparelho ou para sem-modelo. Uma cadeia entre provedores
> diferentes existe só se o usuário a montar, motor a motor (ADR 0040). O teste da cadeia cobra
> três coisas: a exposição não cresce, o provedor de nuvem não muda, e sem-modelo é o último elo.
>
> **AD-9, acrescentar:** um provedor só entra na lista com a tabela de regime dele versionada em
> `docs/` (tier, o que pode ser enviado, retenção, DPA, uso para treino). Sai do Deferred.

### A4 — O "dono do vocabulário proibido" não existe, e duas decisões ficaram de fora

**Onde:** linha AD-3 herdada (l. 81: "o vocabulário proibido (conselho, causa, placar) já tem
dono em `ia/verificar.ts`"), AD-6 (l. 141: "vem das listas de `ia/verificar.ts`, compostas e
nunca reescritas"), Seed (l. 205: "passa a exportá-lo").

Isso é falso. `packages/shared/src/ia/verificar.ts:46-50` tem **uma** lista, `CAUSA`, e ela é
`const` privada. Não há lista de conselho, placar nem comparação com outras pessoas. O tipo
`Problema.regra` (l. 33) é `'numero' | 'causa' | 'correlacao' | 'ressalva' | 'base'`. O
"não recomenda, não parabeniza" existe só como prescrição no prompt (`ia/prompt.ts:336-340`). O
próprio código avisa contra essa confusão: `ia/prompt.ts:286-306` ("afirmação falsa aqui é pior
que ausência de afirmação — ela faz quem lê acreditar que o prompt está atrás de uma rede que não
existe").

Faltam duas coisas:

- A decisão do dono de 10/09 (memlog l. 37): "tudo em 2 → diz isso **sem elogio**". A AD-7 não a
  registra, e nenhuma lista a cobra.
- A regra 6 da ADR 0036 (l. 65-66): sem streak, meta, seta de tendência, conselho. O risco
  nomeado na própria ADR é "melhorou" (l. 181-183). As listas da revista não servem aqui, porque
  a revista compara com bases de propósito.

**Correção:**

> **AD-6:** `ia/verificar.ts` é dono só de `CAUSA`. As listas de conselho, elogio ("parabéns",
> "continue assim"), placar e comparação com outras pessoas nascem na F0 com dono único
> (proposta: `ia/vocabulario.ts`), exportadas, e são compostas por `verificarTexto` e pela
> conferência de cada recurso. A Saúde do sono compõe também a regra 6 da ADR 0036 (streak, meta,
> tendência, "melhorou/piorou") e a decisão de 10/09: `tudo-no-maximo` sem elogio.
>
> Corrigir também a l. 81 e o Seed (l. 205).

### A5 — As classes de falha têm nome, mas não critério, e a borda da nuvem fica sem guarda

**Onde:** AD-4 (l. 129), AD-10 (3) (l. 165), linha AD-6 herdada (l. 82: "ganha só a lista").

O Prevents da AD-4 é "duas pontas classificando o mesmo erro de jeitos diferentes". A regra lista
sete nomes, mas não diz o que entra em cada um. Os casos reais ficam para cada borda decidir:

| Caso | Onde aparece |
| --- | --- |
| sem rede | nuvem |
| HTTP 429 / cota ou crédito Prepay esgotado | nuvem |
| chave inválida, 503 `provedor_nao_configurado` | `ia-narrar/index.ts:68` |
| 413 `prompt_muito_longo` | `ia-narrar/index.ts:57-59` |
| motor fora da lista (AD-9) | nuvem |
| `rateLimited`, `timeout` | Apple, iOS 27 |
| `unsupportedLanguageOrLocale` | Apple |
| `modelNotReady` | Apple |

"Sem rede" como `transitoria` manda o usuário para o piso, mesmo com o aparelho disponível. Como
`indisponivel`, recua para o aparelho. As duas pontas vão escolher diferente.

A guarda (3) da AD-10 lê só o Swift. O adaptador Deno, que a AD-4 vincula (l. 127), emite classes
sem guarda nenhuma. E a linha l. 82 diz que a `ia-narrar` "ganha só a lista", mas pela AD-4 ela
também ganha a classificação.

Por último, "nenhum nome de fornecedor atravessa" contradiz um desenho deliberado:
`ia-narrar/index.ts:79-83` e `narrador.ts:98-102` repassam o corpo do provedor em `detalhe`, pela
"lição do Overpass" (`route-name.ts:63-65`).

**Correção:**

> **AD-4, acrescentar a tabela de critérios** (ela é invariante, não detalhe):
>
> - `indisponivel`: o motor não atende nenhum pedido agora, e outro motor pode (não elegível,
>   Apple Intelligence desligada, modelo não pronto, pesos ausentes, fora da lista, sem rede,
>   crédito ou chave).
> - `capacidade`: atende, mas não este pedido (idioma, esquema, guia).
> - `janela`: o pedido não cabe no contexto.
> - `guarda`: o guardrail bloqueou.
> - `recusa`: o modelo recusou.
> - `saida-invalida`: a resposta não se lê (ilegível, truncada, fora do esquema).
> - `transitoria`: o mesmo pedido no mesmo motor pode dar certo depois (timeout, rate limit, 5xx).
>
> A tradução de cada borda é uma tabela ao lado dela, com teste. A guarda (3) da AD-10 lê também
> `supabase/functions/_shared/ia/*.ts`. `detalhe` pode carregar texto do fornecedor para
> diagnóstico e só a tela de desenvolvimento o mostra. Nenhuma decisão do app lê `detalhe`.

### A6 — "A CLI compila o mesmo arquivo" não compila como está escrito, e `#if canImport` não protege símbolo

**Onde:** AD-3 (l. 123), AD-11 (l. 171), Seed (l. 209, 216).

Um módulo Expo em Swift importa `ExpoModulesCore`. Uma CLI SwiftPM no Mac não compila esse
arquivo sem essa dependência. A regra não diz qual arquivo a CLI compila. E, pela ordem do memlog
(l. 47), a F1 (bancada) chega antes da F2 (ponte). Então a F1 cria um Swift que a F2 teria de
reaproveitar, e hoje nem existe `mobile/modules/`.

Além disso, `#if canImport` testa **módulo**, não símbolo. Os erros novos do Xcode 27
(`LanguageModelError`, memlog l. 17) são símbolos novos **dentro** de `FoundationModels`, e
`canImport(FoundationModels)` é verdadeiro no Xcode 26.6. Resultado: o build quebra, que é o que o
Prevents da AD-3 promete evitar. `tokenCount` já está no SDK 26.5, e o que o protege é
`#available(iOS 26.4, *)`, não `canImport`. E no macOS a guarda `#available(iOS 26, *)` precisa
nomear `macOS 26`.

**Correção:**

> **AD-3:** a ponte é partida em dois arquivos Swift.
>
> - `OnDeviceEngineCore.swift` importa só `Foundation` e `FoundationModels` (e `CoreAI` na F5) e
>   contém a sessão, a tradução de erro e a conversão de esquema.
> - O módulo Expo importa `ExpoModulesCore` e só adapta.
>
> A CLI da bancada compila o core pelo caminho em `mobile/modules/on-device-engine/ios/`, sem
> cópia. Se a F1 chegar antes da F2, é ela que cria o core nesse caminho.
>
> Guardas:
>
> - `#available(iOS 26, macOS 26, *)` para o framework.
> - `#available(iOS 26.4, macOS 26.4, *)` para `tokenCount` e `contextSize`.
> - `#if canImport(CoreAI)` só para módulo novo.
> - Símbolo novo dentro de `FoundationModels` (os erros do Xcode 27) atrás de guarda de
>   compilador, conferida no Xcode 27, nunca `canImport`.

### A7 — Envelope operacional: OTA está ligado, e o JS da porta pode chegar a um binário sem a ponte

**Onde:** Seed (l. 222: "Ponte Swift [...] Não vai por OTA").

`mobile/app.base.json:10-16` tem `runtimeVersion: "1.0.5"` fixo e `updates.enabled: true`, e
`mobile/package.json:39` declara `expo-updates`. Um `eas update` com a porta chega a qualquer
binário 1.0.5. Se esse binário não tem o módulo nativo, `requireNativeModule` lança no import. O
repositório já documenta esse perigo: `mobile/src/app/(tabs)/_layout.tsx:40-43` ("um OTA caindo
num build antigo demais viraria crash de boot"). A espinha cobre só a metade Swift.

Também falta a ordem de deploy entre a `ia-narrar` com a lista e o build que a lê. Hoje um GET na
function devolve 405 (`ia-narrar/index.ts:42`). A compatibilidade para trás está declarada (corpo
sem `motor`); a compatibilidade para frente, não.

Observação lateral: a AD-15 da revista parte de "não há OTA", e isso é desmentido pelo mesmo
`app.base.json`.

**Correção (Seed ou AD-3):**

> O build que embarca a ponte sobe `runtimeVersion`. Nenhum update com código da porta vai para
> um runtime anterior. A porta carrega o módulo com `requireOptionalNativeModule`: ausência é
> `indisponivel`, nunca exceção no import. A `ia-narrar` que expõe a lista é deployada antes do
> build que a lê, e o app trata falha ao ler a lista como catálogo de nuvem só com o padrão.

---

## Médios

### M1 — O `Pedido` não tem caminho pela nuvem

**Onde:** Convenção "Pedido" (l. 178), AD-9.

O corpo da `ia-narrar` aceita `{ sistema, usuario, json }` (`index.ts:44-54`). A AD-9 acrescenta
só `motor`. Falta decidir três coisas:

- se `saida: 'esquema'` atravessa como JSON Schema ou degrada para `json`;
- o que acontece com os `guardrails` do pedido na nuvem;
- como o nome de rota, que hoje usa `json: true` **sem esquema** (`routes/prompt.ts:31-39`), vira
  `Pedido`. O `Pedido` não tem valor "json sem esquema", e no aparelho a geração guiada exige
  esquema.

F2 e F3 vão divergir aqui.

**Correção:** "A `ia-narrar` recebe o `Pedido`. `saida: 'esquema'` atravessa como JSON Schema, e o
adaptador o traduz para o formato de fio do provedor ou responde `capacidade`. `json?` sai do
contrato. Guardrail que o provedor não honra é `capacidade`. O nome de rota ganha esquema na F4."

### M2 — A gramática do `MotorId` não tem o padrão da nuvem, e o formato da lista não está fixado

**Onde:** AD-8 (l. 153), AD-9 (l. 159).

A cadeia padrão de um recurso mora no núcleo, e a barreira proíbe nome de fornecedor ali. Por
isso, a cadeia padrão da retrospectiva (hoje, nuvem) **não pode ser escrita** como
`nuvem:<provedor>/<modelo>`. A AD-9 já prevê "se vier ausente, vale o padrão", mas o `MotorId` não
tem como dizer isso.

Também não está fixado que a lista em `secrets`, o campo `motor` e o `MotorId` do app usam **a
mesma string**. O Prevents da AD-8 ("dois formatos de id entre hospedeiros") ignora o servidor.

**Correção:** acrescentar `nuvem` (sem variante) = padrão do servidor. A lista e o campo `motor`
usam exatamente o `MotorId`. Quem interpreta o formato é um módulo do núcleo sem imports,
importável pelo Deno (precedente: `cultura/tipos.ts` e as barreiras em
`architecture.test.ts:162-209`).

### M3 — Os dois regimes da AD-6 não cabem no nome de rota, e "generaliza a 0041" é inexato

**Onde:** AD-6, herança l. 89.

No nome de rota, o motor devolve **campos** e a frase é do molde (ADR 0041 inv. 2). O campo `via`
pode legitimamente ter algarismo (estrada "N25"). O regime interpolado reprovaria esse algarismo,
e o regime "copiado e conferido" não se aplica. Na F4 o recurso tem de declarar um regime e
nenhum serve.

**Correção:** um terceiro regime, **molde**: "o motor devolve campos por esquema; nenhum número
sai do motor; a frase é do molde; a conferência é de pertinência dos campos". E trocar a l. 89 de
"generalizados" para "ratificados, com o molde como terceiro regime".

### M4 — O alvo "derivado" da barreira (2) escapa pelos caminhos que a própria espinha cria

**Onde:** AD-10 (2) (l. 165).

"Todo arquivo que importa `ia/motor`" deixa passar três caminhos:

- o reexport que o Seed manda (`routes/nomear.ts` reexporta, l. 207);
- o barril `index.ts`;
- o arquivo com o texto do prompt do recurso, se ele não importar `ia/motor`. A barreira existe
  justamente porque "nomear um fornecedor ali vaza para o contexto do modelo"
  (`architecture.test.ts:782-787`).

**Correção:** o alvo é o fecho transitivo, por import relativo, a partir de todo arquivo (fora de
teste) que importe qualquer módulo de `ia/`. Ou um padrão de caminho obrigatório para o que fala
com modelo (ex. `<dominio>/leitura/`). Reexportar `Motor` com outro nome é proibido.

### M5 — "Nenhum fixture real é versionado" contradiz o código e o spec

**Onde:** herança AD-8 (l. 84), Convenção "Dado de produção na bancada" (l. 183).

`packages/shared/src/routes/__fixtures__/rides.json` tem 175 KB de pedaladas reais, com a ponta
de casa (`lat0: 50.85126, lng0: 4.34281`), e `golden.json` é o golden set real do nome de rota. O
spec `ia-analitica` §5 (l. 125-127) define o golden set como "teste normal, determinístico, no
`packages/shared` [...] dado real". Nenhuma decisão do dono no memlog sustenta a proibição.

Há ainda dois problemas de mecanismo:

- sem conjunto estável, dois relatórios da bancada não se comparam, e o limiar do dono (AD-11)
  vira instável;
- "leitura só" não é mecânica: o JWT de usuário também escreve.

**Correção:** "Nenhum dado de saúde de produção é versionado. O golden set da bancada versiona só
o manifesto (as janelas e o hash do export), e um relatório só se compara com outro do mesmo
manifesto. Os fixtures de rota existentes: ratificar ou remover, por decisão do dono. A bancada
não importa escritor de `data/` (barreira no molde do `upsertEdicao` da revista)."

### M6 — "Gravar saída de motor" não é futuro: dois recursos já gravam

**Onde:** Deferred (l. 247: "quando um recurso gravar [...] A POC não grava").

A retrospectiva grava em `edicoes_ia` (`edicao-ia.ts:98-112`: provedor, modelo, promptVersao,
tokens) e o nome de rota grava em `route_name_meta` (`nomear.ts:46-61`). A 1.10 passa a revista
pela porta **agora**. Falta decidir:

- como `assinatura` (`tipo`, provedor, modelo, instante) vira as colunas que já existem (não há
  `tipo`; tokens são obrigatórios na edição e só existem no aparelho a partir do 26.4);
- quais tipos de motor um recurso que grava admite (a revista no aparelho, com janela de 4.096
  tokens, é `janela` sempre);
- se a assinatura carrega a versão do pedido, que a bancada precisa para comparar execuções.

**Correção:** tirar do Deferred.

> Um recurso que grava declara no descritor os tipos de motor que admite e como a assinatura vira
> colunas. A assinatura carrega a versão do pedido do recurso. O catálogo e a cadeia nunca
> oferecem a um recurso um motor que ele não admite.

### M7 — "Exatamente um caso" não tem precedência

**Onde:** AD-7 (l. 147).

Três situações ficam ambíguas:

- Duas medidas empatadas no mesmo ponto abaixo de 2 são `duas` e também `todas-iguais`.
- Três ou mais medidas, todas empatadas em 1, são `fora-do-empate` (sem nenhuma dimensão para
  nomear) e também `todas-iguais`.
- Uma noite com `scored` falso (nada medido: `score.ts:312-322`) não cai em caso nenhum, porque
  `sem-contagem` foi definido só para período e a noite não tem cobertura (`score.ts:177`).

**Correção:**

> A primeira regra que casa vence: `sem-contagem` (`scored` falso, noite ou período) →
> `medidas-insuficientes` (se o dono confirmar a borda do Deferred) → `tudo-no-maximo` →
> `todas-iguais` → `uma` (exatamente uma no mínimo) → `duas` (exatamente duas no mínimo e alguma
> acima) → `fora-do-empate` (três ou mais no mínimo e alguma acima). Um teste de propriedade cobra
> que todo `SleepScore` gerado cai em exatamente um caso.

### M8 — Observabilidade: uma revisita sem dado, e o servidor sem regra

**Onde:** Convenção "Registro de falha permanente" (l. 182), Deferred (l. 250).

A revisita do retry de `transitoria` depende de "o registro mostrar que vale", mas o registro só
guarda as falhas permanentes. `transitoria` nunca entra, então a condição nunca pode ser
observada.

No servidor, nada impede registrar em log `sistema` e `usuario` (dado de saúde). Hoje o log leva
o corpo do provedor (`index.ts:82`, `narrador.ts:101-102`).

**Correção:** "O anel registra a trilha de toda execução (a classe de cada tentativa), e o pedido
completo só nas falhas permanentes. A `ia-narrar` nunca registra `sistema` nem `usuario`; registra
motor, classe, status e tokens."

### M9 — "Nenhum hospedeiro executa por fora" é prosa, e a bancada aparece conferindo sozinha

**Onde:** AD-2 (l. 117), AD-11 (l. 171), diagrama (l. 57: `BTS["...pedidos · conferência · relatório"]`).

A AD-11 fixa o descritor, mas não o orquestrador. Uma bancada que confere por conta própria
repete o que o Prevents da AD-11 quer evitar: "medir um caminho e publicar outro". Três pontos
seguem abertos:

- as opções de geração (amostragem, temperatura, teto de saída) não estão no `Pedido`;
- a nuvem fixa temperatura 0,4 no servidor (`narrador.ts:63`), e a ponte decide sozinha;
- a amostra de 20 pedidos não diz **o que** compara.

**Correção:**

> **AD-2:** o `index.ts` do núcleo exporta o descritor e o orquestrador, não as peças (montar,
> ler, conferir, frase). Uma barreira acusa import dessas peças fora de `ia/` e do domínio do
> recurso.
>
> **AD-11:** a bancada executa o orquestrador com o motor injetado e acrescenta só a sonda e o
> relatório. As opções de geração são do pedido. O critério da amostra de 20 pedidos é fixado
> antes dela.

### M10 — A superação da invariante 4 da ADR 0040 não está delimitada

**Onde:** AD-9 (l. 159: "supera em parte a invariante 4").

A invariante 4 (ADR 0040, l. 70-77) tem dois períodos: (a) provedor e modelo vêm de `AI_PROVIDER`
e `AI_MODEL`; (b) toda edição gravada assina provedor, modelo e `gerado_em`. A regra não diz qual
cai, nem o que acontece com `AI_PROVIDER` e `AI_MODEL`. E "corpo sem `motor` exatamente como
hoje" só vale se o padrão continuar sendo esses dois. A ADR nova (memlog l. 38: "pede ADR nova")
também não aparece no Seed.

**Correção:**

> Supera o período (a): provedor e modelo passam a vir de uma lista em `secrets`, e
> `AI_PROVIDER`/`AI_MODEL` continuam sendo o padrão. O período (b) segue intacto. Nenhuma linha da
> F3 antes da ADR 0047+ que registra a superação (AD-11 herdada).
>
> Seed: acrescentar `docs/decisions/0047-...` e as outras duas.

### M11 — Uma decisão do dono não foi registrada

**Onde:** memlog l. 30 (Q4): "A secao 3 do spec ia-analitica nao morde porque nada fica guardado e
a geracao e pedido explicito".

A tela `/sono/saude` abre em 7 dias terminando hoje, que é período em curso (memlog l. 15). Quem
implementar a F2 lendo o spec (§3, l. 51: "em curso: sem parágrafo de máquina") pode bloquear a
janela de 7 dias. A decisão que libera isso está só no memlog. O "sem elogio" entrou em A4.

**Correção (Convenção ou AD-7):** "A §3 do spec `ia-analitica` vale para recurso que grava. Uma
leitura efêmera, sob pedido e sem gravação, lê período em curso."

### M12 — `RecursoId` e o catálogo de recursos não têm dono nem arquivo

**Onde:** AD-8 (mapa `RecursoId` → `MotorId`), Seed (l. 204 lista `ia/motor.ts` sem `RecursoId`).

O seletor `/configuracoes/motores` precisa listar os recursos. Sem um catálogo com dono, a tela
escreve a lista à mão, o que viola a AD-3 herdada.

**Correção:** "`RecursoId` e o catálogo de recursos moram em `ia/`, com dono único, e cada
descritor se registra lá. O seletor nunca lista recurso à mão."

---

## Baixos

- **B1 — Colisão de vocabulário** (AD-3 herdada, Convenção "um nome por conceito"):
  - "regime" tem três sentidos: exposição (AD-5), números (AD-6) e regime do provedor (ADR 0040;
    Deferred l. 251). Proposta: "exposição" na AD-5 e "regime de números" na AD-6.
  - "recusa" é classe de motor na AD-4 e resultado de domínio em `MotivoDaRecusa`/`route_name_meta`
    (`nomear.ts:38-58`). Proposta: `recusa-do-modelo`, mais uma tabela de mapeamento para a F4.
  - O Seed mantém `ChamadorDeModelo` como segundo nome para `Motor` (l. 207). Proposta: o alias
    morre na F4.
- **B2 — AD-4:** "`janela` [...] sem ele, é defeito" não diz o que acontece em execução. Proposta:
  "sem pedido curto, `janela` é permanente: piso e anel".
- **B3 — AD-5:** o teste descrito ("nenhuma nuvem depois de aparelho") é mais fraco que a regra.
  "Única fonte de cadeias" não é mecânico. Proposta: tipo marcado `Cadeia` que só a função
  constrói.
- **B4 — Anel de falhas:** o teto é por contagem, com pedidos de até 60 mil caracteres numa chave
  só de AsyncStorage (lida inteira a cada escrita, no molde de `sync-breadcrumbs.ts:97-105`).
  Proposta: teto por tamanho, e o conteúdo nunca sai do aparelho (sem botão de compartilhar).
- **B5 — Diagrama 1** (l. 42-70): não tem o nó do orquestrador. `TELA --> REC` sugere que a tela
  compõe descritor e porta, o contrário da AD-2. A sintaxe mermaid dos dois diagramas é válida.
- **B6 — Marcação [ADOPTED]:** o memlog (l. 43) registra as 11 ADs como aprovadas pelo dono, mas
  AD-2, AD-4, AD-5, AD-6 e AD-10 estão sem a marca. Declarar o que a marca significa, para uma
  revisão futura não as reabrir.
- **B7 — Guarda (3) da AD-10:** fixar o ponto de emissão (um `enum` Swift com valor bruto,
  comparado ao `ClasseDeFalha`) e a asserção de não-vacuidade a partir da F2.
- **B8 — ADR 0040, invariante 1:** a espinha diz "intactas" (l. 88), mas com `ClasseDeFalha`,
  `guarda` e `janela` no núcleo, "não sabe que existe modelo" só vale lida como a ADR 0042 a leu
  ("conhece a porta, não o fornecedor"). Dizer isso.
- **B9 — Deferred "Spotlight"** (l. 244): traz "A regra já vale". Regra em vigor mora em AD, não no
  Deferred.
- **B10 — Frontmatter** (l. 20): usa como fonte um artifact privado não versionado. As decisões
  dele precisam estar nas ADRs 0047+ (AD-10 herdada). Nota solta: `formatarNumero` mora em
  `ia/prompt.ts:38`, e existe um `format/`; a Saúde do sono passaria a importar o módulo do prompt
  da revista para formatar número.

---

## A rubrica, item a item

| Item | Resultado |
| --- | --- |
| 1. Fixa os pontos de divergência de F0–F5 e da 1.10 | **Parcial.** Fixa bem a porta única, a preferência, a lista e o workspace. Não fixa o contrato de falha e de resultado (C1), a corrida F0×1.10 (A1), o arquivo Swift da CLI (A6), o `Pedido` pela nuvem (M1), o `MotorId` do padrão (M2) nem o catálogo de recursos (M12) |
| 2. Rules aplicáveis e que impedem o Prevents | AD-1, AD-7 e AD-8 aplicáveis. AD-2 é metade prosa (M9). AD-3 não impede o build quebrado (A6). AD-4 não impede a classificação divergente (A5). AD-5 tem o teste mais fraco que a regra e um buraco (A3, B3). AD-6 cita listas que não existem (A4). AD-10 (2) escapa (M4). AD-11 não fixa o orquestrador (M9) |
| 3. Deferred que deixa unidades divergirem | "Gravar saída" (M6), "Tabela de regime" (A3), "Retry de transitoria" (M8) |
| 4. Ratifica e não contradiz o brownfield | Contradiz em quatro pontos: C2, A4, M5, e o `detalhe` em A5 |
| 5. Nada enfraquece herdada ou ADR aceita | ADR 0042 §4 e 0041 (C2), ADR 0040 multi-provedor (A3). A superação da inv. 4 está declarada, mas mal delimitada (M10) |
| 6. Dimensões da altitude | Deploy e ambientes: parcial (A7). Provedor e infra: sim, com A3. Operação e observabilidade: aparelho sim, servidor em silêncio (M8). Privacidade: sim, com A3, M8 e B4 |
| 7. Mermaid, placeholder, decisão × rationale | Sintaxe válida. Nenhum placeholder. Pouca justificativa dentro de Rule (AD-10 (2) "`apple` fica fora porque…", Stack "avaliado e rejeitado") |

## Conferido e correto

- Duas cópias do cliente da `ia-narrar`, e só no mobile: `mobile/src/lib/edicao-ia.ts:38` e
  `mobile/src/services/route-name.ts:50`. Nenhuma na web nem em `scripts/`.
- A barreira de IA cobre `ia/` e `routes/` por lista manual (`architecture.test.ts:766`), e a lista
  de fornecedores não tem `apple`, `qwen`, `llama` nem `coreai` (l. 778). `apple` aparece em
  `sleep/` só em comentário, que a barreira remove, então a exclusão é segura.
- `ChamadorDeModelo` em `routes/nomear.ts:36`, exportado pelo barril (`index.ts:127`).
- `toFixed(1)` da percepção em `sleep/score.ts:498`.
- `local-store.ts` sobre AsyncStorage; `sync-breadcrumbs.ts` com anel de 60 e fila serializada.
- `ia-narrar` sem SDK, `verify_jwt = true` (`supabase/config.toml:30-31`), um adaptador
  (`narrador.ts:137-144`), assinando `modelVersion` (l. 125).
- A barreira de `user_preferences` (`ID_COLUMNS`) fica intocada, coerente com a AD-8.
- Versões: Expo `~57.0.20`, RN `0.86.3` (`mobile/package.json:21,44`); alvo iOS 16.4
  (`Podfile:25`, `project.pbxproj`). 1.9, 1.10 e 2.1 em `backlog` no `sprint-status.yaml`, e F0/F1
  ainda não inseridas, como a espinha diz.
