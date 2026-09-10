---
review: adversario
alvo: ARCHITECTURE-SPINE.md (motores-do-orbe, status draft)
data: 2026-09-10
metodo: pares de unidades do nível de baixo que obedecem a cada AD ao pé da letra e saem incompatíveis
ancoragem: código do worktree life-organizer-wt-motores (branch docs/motores-arquitetura), conferido linha a linha
---

# Revisão adversária — Os motores do Orbe

## Veredito

**A espinha fixa bem as decisões do dono (as costuras, a ponte nossa, o caso do código, a escolha
local, a lista no servidor), mas deixa sem dono as formas que atravessam fronteira.** Os tipos que
cruzam de um hospedeiro para outro — o motivo de parada, a classe no fio Swift→TS e Deno→TS, o
`MotorId` simbólico, o pedido canônico e o resultado do orquestrador — aparecem como nomes, sem
grafia e sem casa. Dois deles quebram produção no primeiro dia da F4 ou da story 1.10: o literal
`'STOP'` do Gemini está num `CHECK` do banco e em `nomear.ts`, e o piso da AD-2 grava recusa
permanente quando o motor só estava indisponível. **Não está pronta para destilar stories:** fechar
B1, B2, B4, B5 e B6 antes de a F0 escrever `ia/motor.ts`, porque todos são tipos do núcleo.

Foram achados **19 buracos**: 2 críticos, 8 altos, 9 médios, mais 5 baixos agrupados no fim.
Mais abaixo, os ataques que a espinha já fecha.

## Resumo

| # | Buraco | Par que colide | Sev. | Mexe em |
| --- | --- | --- | --- | --- |
| B1 | "Conclusão" tem a grafia do Google, e ela está num `CHECK` | F2 ponte × F4 nome de rota / 1.10 gravar | **crítico** | Convenção Resposta, AD-4 |
| B2 | O piso não diz por que respondeu, e quem grava grava o piso | F0 orquestrador × F4 / 1.10 | **crítico** | AD-2, AD-4 |
| B3 | O motor de nuvem não tem casa comum; o fio não tem dono que o Deno alcance | F3 × F2 × F1 × 2.2 × web | alto | AD-4, AD-9, AD-10 |
| B4 | `MotorId` sem grafia para "sistema" e "padrão da nuvem", e confundido com a assinatura | F0 cadeias × F2 catálogo × F3 lista | alto | AD-8 |
| B5 | Dois donos do recuo e do anel: porta ou orquestrador | F0 × F2 | alto | AD-1, AD-2, AD-5 |
| B6 | A 1.10 e a F0 criam duas sequências em `ia/` | 1.10 × F0 | alto | AD-2, tabela herdada |
| B7 | "O mesmo pedido" não tem definição verificável | F1 × F2 | alto | AD-11 |
| B8 | "A CLI compila o arquivo da ponte" não fecha com um módulo Expo | F1 × F2 | alto | AD-3, AD-11 |
| B9 | A AD-5 tem portas laterais: leitura defensiva e recuo entre provedores | F0 resolução × F2 seletor × F3 lista | alto | AD-5, AD-8 |
| B10 | A classe não tem forma no fio Swift→TS e a guarda (3) pode passar vazia | F2 × F0 barreira × F5 | alto | AD-4, AD-10 |
| B11 | A troca de SO muda o modelo e o ramo compilado sem mudar o id | F1 Mac × F2 EAS × F5 | médio | AD-3, AD-11 |
| B12 | Medição precisa de cadeia de um elo, que a AD-5 proíbe | F1 / tela lado a lado × F0 | médio | AD-2, AD-5 |
| B13 | "Nenhuma tela chama motor ao abrir" × nome de rota que nomeia ao abrir | Convenção × F4 | médio | Convenção |
| B14 | "JSON Schema" sem subconjunto: três tradutores, três dialetos | F0/F4 × F2 × F3 | médio | AD-3, Convenção Pedido |
| B15 | Os casos da AD-7 não particionam, e a frase diz "cinco" | F0 classificador × F0 frase × F1 sonda | médio | AD-7 |
| B16 | O catálogo esconde o indisponível, e a falta da lista apaga a nuvem | F2 × F3 | médio | AD-5, AD-8, AD-9 |
| B17 | Concorrência sem dono | F2 botão × F2 ponte × 1.10 | médio | AD-3, Convenção |
| B18 | O portão da bancada × padrão de nuvem que muda por `secrets` | AD-11 × F3 | médio | AD-9, AD-11 |
| B19 | O vocabulário proibido "que já tem dono" não existe | F0 × stories da revista | médio | AD-6, tabela herdada |
| B20–B24 | reexport, marcador, guardrail na nuvem, escrita da preferência, amostragem | vários | baixo | — |

---

## Críticos

### B1 — "Conclusão" tem a grafia do Google, e ela está num `CHECK` do banco

**Par:** F2 (ponte do aparelho + porta) × F4 (nome de rota pela porta) — e × story 1.10 (porta
`gravar`).

**Como os dois obedecem.** A Convenção "Resposta" diz que a resposta carrega "motivo de parada" e
que "motivo de parada que não seja conclusão vira `saida-invalida`", mas não diz **qual é a grafia
de conclusão** nem quem traduz. AD-3/AD-4 proíbem nome de fornecedor atravessando, e a Convenção
"Vocabulário" diz que a API da ponte é em inglês. Foundation Models não tem *finish reason*: a
ponte, obediente, devolve `motivoDeParada: "completed"` (ou omite). A F4 migra
`services/route-name.ts` para a porta sem tocar em `routes/nomear.ts` — a AD-1 só manda reexportar o
tipo.

**A incompatibilidade.** O vocabulário do Gemini está pinado em três lugares:

- `packages/shared/src/routes/nomear.ts:107` — `if (resposta.motivoDeParada && resposta.motivoDeParada !== 'STOP')` → recusa `'truncado'`;
- `mobile/src/lib/edicao-ia.ts:49,56` — o mesmo teste, e ausência vira `'STOP'`;
- `supabase/migrations/20260906150000_edicoes_ia.sql:36` — `motivo_de_parada text not null check (motivo_de_parada = 'STOP')`.

Com a ponte devolvendo `"completed"`: todo nome de rota pelo aparelho vira recusa `truncado`,
`saveRouteName` grava `route_name_meta`, e `data/activities.ts:75` deriva
`routeNameChecked: r.route_name_meta != null` — **a pedalada nunca mais é tentada**. Na revista,
qualquer motor que não seja Google (o aparelho, ou um segundo provedor com `end_turn`/`stop`) faz
`upsertEdicao` bater no `CHECK`. Se a F0 "normalizar" para uma palavra do Orbe (`'concluido'`), é a
edição do próprio Google que o `CHECK` passa a recusar. E se a ponte omitir o campo, `nomear.ts`
aceita tudo — inclusive truncagem de verdade, que some calada.

**Severidade: crítico.** Queima permanente de dado no banco na primeira abertura de pedalada com
motor de aparelho (F4), ou revista que não grava (1.10 com qualquer motor novo). Nenhum teste de
unidade pega, porque cada lado passa sozinho.

**Rule proposta (aperta a Convenção "Resposta" e a AD-4):**

> `Resposta` só existe para geração concluída e **não carrega motivo de parada cru**. A borda (a
> ponte e o adaptador da nuvem) traduz o motivo do fornecedor: conclusão vira `Resposta`; qualquer
> outro motivo vira `Falha { classe: 'saida-invalida', detalhe }`, e o motivo cru só vai ao
> `detalhe` e ao anel. O Orbe tem uma constante de conclusão, `CONCLUSAO`, com dono em
> `ia/motor.ts` (o valor pode continuar `'STOP'` para não exigir migration — o que muda é o dono), e
> é ela que `upsertEdicao` grava. Uma barreira confere que o `CHECK` de `edicoes_ia.motivo_de_parada`
> e a constante são iguais, no molde de `ID_COLUMNS`. O literal `'STOP'` só aparece no adaptador do
> Google. Nenhum consumidor compara motivo de parada — nem `nomear.ts`, nem a sequência da impressão.

### B2 — O piso não diz por que respondeu, e quem grava grava o piso

**Par:** F0 (orquestrador com `semModelo` obrigatório, AD-2 + tabela da AD-4) × F4 (nome de rota,
que grava) — e × story 1.10 (revista, que grava).

**Como os dois obedecem.** AD-2: `semModelo(fatos)` é "obrigatório pelo tipo" e o orquestrador
devolve "frase, assinatura e a trilha". AD-4: `indisponivel` e `capacidade` recuam; `transitoria`
"cai no piso". O nome de rota e a revista gravam o que o orquestrador devolve.

**A incompatibilidade.**

- *Nome de rota.* Preferência `aparelho` para `nome-de-rota`; o iPhone está com Apple Intelligence
  em `modelNotReady` (modelo baixando, minutos). → `indisponivel` → recua → `sem-modelo` → o
  orquestrador entrega o piso, e a sequência de F4 grava `route_name_meta` → a rota fica marcada
  como visitada **para sempre**. É exatamente o que `routes/nomear.ts:15-18` diz que não pode
  acontecer — *"gravar recusa num caso desses queimaria a rota para sempre por causa de um
  timeout"* —, e hoje só a exceção protege isso. A AD-4 transforma a exceção em classe e a AD-2
  transforma a classe em resposta: a proteção some.
- *Revista.* "Obrigatório pelo tipo" força a 1.10 a ter um piso que é **frase**. Mas a espinha da
  revista diz que "caderno reprovado não tem linha", o `CHECK length(trim(texto)) > 0` proíbe
  inventar texto, e a ADR 0041 (§7, linha 175) diz que *recusar é resultado válido* — o piso do nome
  de rota é a ausência. Uma `transitoria` da nuvem passaria pela porta `gravar` como edição
  impressa com a frase-molde, assinada por ninguém.

**Severidade: crítico.** Mesma classe de dano do B1 — estado permanente errado no banco —, por um
caminho que a espinha apresenta como o comportamento correto.

**Rule proposta (aperta a AD-2; cláusula nova na AD-4):**

> O piso pode ser ausência: `semModelo(fatos): Frase | Ausencia`, e ausência com motivo é piso
> válido (ADR 0041). O orquestrador devolve um resultado discriminado —
> `{ origem: 'motor', texto, resposta, trilha }` ou `{ origem: 'piso', frase | null, causa, trilha }`
> —, em que `causa` é a classe que derrubou o último motor, ou `'preferencia'` quando a cadeia era
> só `sem-modelo`. Recurso que grava declara `grava: true`, e a porta de gravação recebe um tipo
> que só `origem: 'motor'` produz. Piso causado por `indisponivel`, `capacidade`, `transitoria` ou
> `janela` **nunca grava nada** — nem recusa, nem marca de visitado. Recusa permanente (`guarda`,
> `recusa`, `saida-invalida`, reprovação da conferência) só grava se o recurso declarar que recusa é
> resultado (nome de rota: sim; revista: não).

---

## Altos

### B3 — O motor de nuvem não tem casa comum, e o fio não tem dono que o Deno alcance

**Par:** F3 (`ia-narrar` com lista e "erro próprio") × F2 (porta do app) — e, fora do mobile, F1
(bancada em `scripts/`), story 2.2 (backfill em `scripts/`) e a web quando entrar.

**Como os dois obedecem.** AD-4 põe a tradução "na borda" — `_shared/ia/narrador.ts` e
`ia-narrar` — com `ClasseDeFalha` de dono único em `ia/motor.ts`. AD-9 dá à function um "erro
próprio, não 500" para motor fora da lista. AD-10(1) prende o literal `'ia-narrar'` a
`mobile/src/lib/motores/`. Só que o Deno só importa do núcleo módulo **sem imports**
(`architecture.test.ts:162-193`), a guarda (3) só lê Swift, e a guarda (1) só enxerga o mobile.

**A incompatibilidade.**

- Hoje nenhuma das duas cópias lê o corpo de erro. `supabase.functions.invoke` devolve
  `{ data: null, error: FunctionsHttpError }` em todo não-2xx (functions-js 2.106,
  `FunctionsClient.js:266`), e `route-name.ts:53` e `edicao-ia.ts:43` fazem `throw error` antes de
  olhar `d.detalhe`. Como a `ia-narrar` só devolve falha com 400/405/413/502/503, o ramo
  `if (d.error)` é **código morto** nas duas. Cada cliente novo vai redescobrir
  `error.context.json()` do seu jeito.
- Exemplo: a F3 devolve `422 { error: 'motor_fora_da_lista' }`. A porta da F2 trata
  `FunctionsHttpError` genérico como `transitoria` (piso, o usuário repete). A bancada escreve o
  próprio cliente em `scripts/` — a guarda (1) não chega lá — e trata 4xx como `indisponivel`
  (recua). É o mesmo erro com duas classes e duas trilhas: o Prevents literal da AD-4. E a function
  pode emitir `classe: 'cota'` sem nada acusar.
- O `guarda` da nuvem nunca chega como `guarda`: bloqueio de segurança do Gemini volta sem texto, e
  `narrador.ts:113` lança "texto vazio" → 502 `narracao_falhou`.
- Quando a web entrar, `web/src/app/core/motores/nuvem.ts` e `mobile/src/lib/motores/nuvem.ts`
  derrubam a barreira "nenhum módulo com o mesmo nome nos dois apps" (`architecture.test.ts:85`),
  cuja mensagem manda subir para o núcleo. A resposta é essa mesma, só que tarde.

**Severidade: alto.** Classificação divergente é justamente o que a AD-4 existe para impedir, e são
quatro clientes previstos (app, bancada, backfill, web) para zero donos.

**Rule proposta (AD nova, "O fio da nuvem é do núcleo"):**

> O contrato da `ia-narrar` — corpo do pedido, corpo da resposta, envelope de falha com `classe`, a
> lista `CLASSES_DE_FALHA` e `lerMotorId` / `formatarMotorId` — mora em
> `packages/shared/src/ia/fio.ts`, **sem imports**, importado pela function por caminho relativo. A
> barreira do Deno passa a tê-lo como alvo, no precedente de `cultura/tipos.ts` e
> `cadeiaDeProvedores` (`architecture.test.ts:200`). A function responde toda falha com
> `{ falha: { classe, detalhe } }` e um status fixado por classe, e nunca devolve falha sem classe.
> O motor de nuvem é um só e mora no núcleo: `criarMotorDeNuvem(invocar)`, com o transporte
> injetado e normalizado (`{ status, corpo } | { rede: true }`). Cada hospedeiro — app, web,
> bancada, backfill — só injeta `invocar`. A guarda (1) varre `mobile/src`, `web/src` e `scripts/`,
> com um ponto de injeção declarado por hospedeiro, e uma guarda nova confere que `ia-narrar/` e
> `_shared/ia/` não declaram literal de classe fora de `fio.ts`.

### B4 — O id do motor não tem grafia para "o modelo do sistema" nem para "o padrão da nuvem", e se confunde com a assinatura

**Par:** F0 (cadeias padrão declaradas no núcleo, AD-2/AD-8) × F2 (catálogo que a ponte publica) ×
F3 (lista nos `secrets`).

**Como os três obedecem.** AD-8 fixa `aparelho:<pesos>` e `nuvem:<provedor>/<modelo>`, e o núcleo
"trata a variante como opaca". A barreira (2) proíbe o núcleo de nomear fornecedor (`google`,
`gemini`… e, com a AD-10, `foundationmodels`), e a AD-9 diz que o padrão de nuvem é do servidor. A
API da ponte é em inglês. A assinatura no aparelho usa "a versão do iOS" como modelo.

**A incompatibilidade.**

- A cadeia padrão da Saúde do sono precisa citar o motor do aparelho. A F0 escreve
  `['aparelho:sistema', 'sem-modelo']`; a ponte, em inglês, publica `aparelho:system`. Na
  resolução, `aparelho:sistema` não está no catálogo, e o resultado é que a POC nunca usa o
  aparelho — **e ninguém vê**, porque o piso responde.
- A cadeia da revista precisa de nuvem, mas o núcleo não pode escrever
  `nuvem:google/gemini-2.5-flash` (barreira) nem conhece a lista (AD-9). A F0 inventa
  `nuvem:padrao`; a F3 recebe `motor: "nuvem:padrao"`, que não está na lista → "erro próprio" →
  **nenhuma narração da revista passa**.
- A grafia no fio. A lista nos `secrets` é escrita `google/gemini-2.5-flash`; o app manda
  `nuvem:google/gemini-2.5-flash` → fora da lista. Ids reais têm `/` e `:`
  (`mlx-community/Qwen3-4B-4bit`, `qwen3:4b`), e "a variante é opaca" não diz onde cortar.
- Identidade × assinatura. A tela lado a lado mostra quem escreveu pela assinatura; um "usar este"
  grava `aparelho:26.5` (a versão do iOS) como preferência, e a próxima atualização do iOS a torna
  desconhecida. Na nuvem, `narrador.ts:122-125` grava `modelVersion`, que *"pode diferir do pedido
  quando um alias resolve para outra versão"*: a AD-5 ("a tela diz por que o escolhido não
  escreveu") compara preferência com assinatura e acusa falha de quem respondeu.

**Severidade: alto.** Falha silenciosa da POC inteira (primeiro exemplo) e da revista (segundo),
com todas as ADs obedecidas.

**Rule proposta (aperta a AD-8):**

> `MotorId` é identidade estável de escolha; a assinatura é identidade observada de quem respondeu,
> e nada compara um com a outra. Gramática: o tipo vai até o primeiro `:`, o provedor até o primeiro
> `/`, e o resto é literal. Há duas variantes simbólicas reservadas, com dono em `ia/fio.ts`:
> `aparelho:sistema` (o modelo que o SO fornece, em qualquer versão) e `nuvem:padrao` (corpo sem
> `motor`, e o servidor escolhe). Cadeias padrão declaradas no núcleo só usam `sem-modelo` e essas
> duas. A ponte publica o catálogo com esses ids exatos — exceção declarada à API em inglês —, e a
> lista nos `secrets` é escrita em `MotorId` completo e lida pelo mesmo `lerMotorId`. A trilha
> registra o `MotorId` tentado; a tela diz quem escreveu pela trilha e mostra a assinatura como
> detalhe.

### B5 — Dois donos do recuo e do anel: a porta do app ou o orquestrador

**Par:** F0 (orquestrador, AD-2) × F2 (porta do app, que o Seed descreve como "aparelho, nuvem,
preferência, catálogo, anel de falhas").

**Como os dois obedecem.** AD-1: a única porta é `Motor: Pedido → Promise<Resposta>`, e "o motor
entra como argumento" (no singular). AD-2: o orquestrador devolve "a trilha das tentativas". AD-5
vincula "a porta do app" à cadeia. AD-3: o pedido nunca carrega recurso. Convenção: o anel guarda
"recurso, motor, classe, instante e o pedido completo".

**A incompatibilidade.** Há duas leituras legítimas, e as duas quebram:

- (a) a F0 escreve `lerSaude(fatos, motor: Motor)`, e a porta entrega um `Motor` composto que
  percorre a cadeia por dentro: a trilha some e o orquestrador não sabe quem escreveu;
- (b) a F0 percorre a cadeia **e** a porta também recua em `indisponivel`: recuo duplo, com um elo
  pulado.

O anel só pode ser gravado por quem conhece o recurso, e o `Motor` não o recebe. Se a porta grava,
o `Pedido` passa a levar `recurso` até a ponte (fere a AD-3), ou a porta refaz a tabela de
permanência da AD-4 — a segunda tabela. E `sem-modelo` não cabe num `Motor`, porque precisa dos
fatos e não do pedido. Falta ainda o destino da exceção crua que escapa de um motor (um `TypeError`
na porta): se virar `transitoria`, defeito vira "tente de novo" para sempre, fora do anel. O mesmo
vale para o "é defeito" da AD-4 (`janela` sem pedido curto), que não diz o que acontece.

**Severidade: alto.** É a estrutura de chamada do sistema inteiro, e as duas leituras são naturais.

**Rule proposta (aperta a AD-2 com a assinatura do orquestrador):**

> O orquestrador é o único que percorre cadeia, e sua assinatura é fixada:
> `ler(descritor, fatos, { cadeia, motorPara, registrar, agora })`. `cadeia` chega resolvida pelo
> núcleo; `motorPara(id): Motor | undefined` é fornecido pelo hospedeiro; `registrar(evento)` é a
> porta do anel. A porta do app entrega um motor por id e nunca repete, recua nem decide
> permanência. `sem-modelo` não é `Motor`: é o passo terminal do orquestrador, que chama
> `descritor.semModelo`. `Motor` não lança — devolve `Resposta | Falha`. Exceção que escapa de um
> motor é **defeito**: vai ao anel com a pilha e cai no piso, nunca vira `transitoria`. `janela` sem
> pedido curto segue o mesmo caminho.

### B6 — A story 1.10 e a F0 obedecem as duas e criam duas sequências em `ia/`

**Par:** story 1.10 (AD-13 da revista: `ia/imprimir.ts` com as portas narrar, ler e gravar) × F0
(AD-2: "um orquestrador único em `ia/`").

**Como os dois obedecem.** A tabela herdada diz só que "a porta `narrar` da story 1.10 **é** a
`Motor`". A 1.10 cumpre isso: `imprimir.ts` recebe `narrar: Motor`, monta, chama, verifica e grava,
caderno por caderno, com "mostrar é progressivo, gravar é atômico" (`epics.md:663-669`). O descritor
da retrospectiva só nasce na F4 (Capability Map), então a 1.10 não tem orquestrador para chamar e
escreve a própria sequência — dentro do núcleo, onde "nenhum hospedeiro executa por fora" não a
alcança.

**A incompatibilidade.**

- Ficam duas sequências pedido → motor → leitura → conferência em `ia/`, com duas políticas de
  falha: `imprimir.ts` não conhece classe (tudo é "não imprime"), e o orquestrador recua.
- Se a 1.10 usar o orquestrador, o resultado ("frase, assinatura e trilha") não traz o que
  `upsertEdicao` exige no tipo: `motivoDeParada`, `tokensEntrada` e `tokensSaida`
  (`data/edicoes-ia.ts:95-97`).
- O contrato `usuario: ''` = "não gaste chamada" de `montarPrompt` (`ia/prompt.ts:508-532`) é do
  chamador. Um orquestrador que não o conhece chama o motor com prompt vazio: a nuvem responde 400
  `prompt_vazio` (sem classe), e o aparelho gera texto do nada.
- A porta `ler` da revista é leitura do banco; a AD-2 chama de "leitura" o parse da resposta; e o
  botão da POC se chama "Ler". São três sentidos para um verbo só, no mesmo diretório (AD-3
  herdada).
- O arquivo do orquestrador não está no Structural Seed; o de `imprimir.ts` está, na espinha irmã.

**Severidade: alto.** O memlog pôs a F0 antes da 1.10 para impedir "dois tipos de porta" — e
resolveu o tipo, não a sequência.

**Rule proposta (AD nova, "A impressão é cliente do orquestrador"; levar ao correct-course, porque
muda o escopo da 1.10):**

> A sequência da impressão (`ia/imprimir.ts`) não chama `Motor`: chama o orquestrador uma vez por
> caderno, com o descritor da retrospectiva, que nasce na F0 junto com o da Saúde do sono (regime
> copiado e conferido, `grava: true`, piso = ausência). O orquestrador mora em `ia/orquestrar.ts`, e
> o resultado de origem `motor` carrega a `Resposta` inteira (assinatura e tokens). `montarPedido`
> devolve `Pedido | null`, e `null` quer dizer "não gaste chamada": o orquestrador devolve piso com
> causa `'mudo'` sem chamar motor. A porta `ler` da revista passa a se chamar `buscar`.

### B7 — "O mesmo pedido" não tem definição verificável

**Par:** F1 (a bancada gera pedidos lendo produção) × F2 (o app gera o pedido a partir da tela).

**Como os dois obedecem.** AD-11: "os pedidos da bancada são gerados pelo mesmo descritor de recurso
que o app usa". O descritor recebe os fatos, e os fatos saem do `SleepScore`.

**A incompatibilidade.** A **entrada** do descritor é montada na tela, não no núcleo.
`mobile/src/app/sono/saude.tsx:58-69` escolhe `today` (congelado na montagem), chama
`filterByRange` e `rangeNights`, e recorta o `history`; a web repete isso em
`sono-saude-page.component.ts:59`. As notas vêm do store com janela de **90 dias**
(`SONO_WINDOW_DAYS`, `mobile/src/store/sono.store.ts:17,63`), enquanto as noites vêm desde 2000. A
bancada, lendo produção, busca todas as notas: em `4s` com offset ≥ 3 e em `12m`/`ano`, a percepção
é medida na bancada e ausente no app. O caso da AD-7 muda, e o pedido muda com ele — com o mesmo
descritor. A amostra de 20 no iPhone (AD-11) não tem como provar identidade, porque não há
serialização canônica nem transporte de pedido entre os hospedeiros. E o pedido entra no Swift por
dois caminhos: o objeto JS convertido em dicionário pela ponte do Expo, e o JSON lido do stdin pela
CLI, com o esquema virando `[String: Any]` de dois jeitos.

**Severidade: alto.** A AD-11 existe para "não medir um caminho e publicar outro", e sem hash o
portão mede um pedido que o app nunca manda.

**Rule proposta (aperta a AD-11):**

> Pedido idêntico é pedido com o mesmo hash. O núcleo é dono de `serializarPedido` (JSON canônico:
> chaves ordenadas, nenhum campo indefinido, com a versão do descritor) e de `hashDoPedido`. A
> montagem da entrada é função pura do recurso — na Saúde do sono,
> `entradaDaSaude(noites, notas, { range, offset, hoje })`, com as janelas de noite e de nota
> explícitas —, e é ela que a tela e a bancada chamam. O pedido atravessa para o Swift como essa
> string JSON nos dois hospedeiros e é decodificado por um único `Codable` no arquivo da ponte. A
> tela de desenvolvimento mostra o hash e exporta e importa pedidos; a amostra de 20 da AD-11
> compara por hash.

### B8 — "A CLI compila o arquivo da ponte" não fecha com um módulo Expo

**Par:** F1 (CLI Swift com `swift build` no Mac, que pelo cronograma do memlog vem **antes** da F2) ×
F2 (módulo Expo local).

**Como os dois obedecem.** AD-3: "módulo Expo local". AD-11: "a CLI Swift compila o arquivo da
ponte, sem cópia". Seed: `scripts/bancada-motores/ … swift/ com a CLI`.

**A incompatibilidade.** O arquivo natural de um módulo Expo começa com `import ExpoModulesCore` e
declara `Module`/`AsyncFunction`, e a CLI não tem ExpoModulesCore — não compila. O SwiftPM exige
que o `path` de um target fique dentro do pacote: um `Package.swift` em `scripts/bancada-motores/swift/`
não inclui arquivo de `mobile/modules/…` sem symlink. Como a F1 chega primeiro, ela escreve o motor
Swift em algum lugar: se for em `scripts/`, a F2 terá que apontar o podspec para fora de `mobile/`,
ou copiar — o que a AD-11 proíbe. E `#available(iOS 26, *)`, o texto da AD-3, não compila chamada
ao Foundation Models num alvo macOS com mínimo abaixo de 26, porque o `*` vale pelo mínimo do alvo.

**Severidade: alto.** A primeira unidade a nascer (F1) decide sozinha onde mora o Swift do app.

**Rule proposta (aperta a AD-3 e a AD-11):**

> A ponte são dois arquivos em `mobile/modules/on-device-engine/ios/`: `Engine.swift` (só
> `Foundation` e `FoundationModels`; pedido JSON entra, `Resposta | Falha` JSON sai; a tabela
> erro→classe e a conversão de esquema moram aqui) e `OnDeviceEngineModule.swift` (cola do Expo, sem
> `catch`, sem literal de classe, sem lógica). O `Package.swift` da CLI mora em
> `mobile/modules/on-device-engine/`, com o target apontando para `ios/Engine.swift`, e a F1 cria
> `Engine.swift` já nesse lugar. As guardas são `#available(iOS 26, macOS 26, *)`. Barreira:
> `Engine.swift` não importa `ExpoModulesCore`.

### B9 — A AD-5 tem portas laterais: a leitura defensiva e o recuo entre provedores

**Par:** F0 (resolução da preferência, AD-8, e função de cadeia, AD-5) × F2 (`/configuracoes/motores`)
e F3 (a lista de nuvem).

**Como os dois obedecem.** AD-8: "id desconhecido cai no padrão do recurso". AD-5: recuo "para
motor de regime igual ou menor", com três regimes, e o teste cobra que "nenhuma cadeia gerada tenha
nuvem depois de aparelho".

**A incompatibilidade.**

- O dono escolhe `aparelho:…` para a retrospectiva, para que o pacote de saúde não saia do
  telefone. Um build seguinte muda a grafia dos pesos (a F5 introduz `aparelho:coreai/…` e renomeia
  o do sistema), ou o valor lido vem corrompido: id desconhecido → padrão do recurso = nuvem. **O
  dado de saúde sai do telefone sem ninguém pedir** — o Prevents da AD-5, entrando pela AD-8. O
  teste da AD-5 não pega, porque a cadeia gerada é "só nuvem", que é legal.
- `[nuvem:google/…, nuvem:outro/…, sem-modelo]` tem "regime igual" e passa no teste. Mas o dado vai
  a um segundo terceiro que ninguém escolheu — exatamente a alternativa que a ADR 0040 rejeitou
  (linha 101: *"Multi-provedor ativo desde o início (fallback automático). Dobra … os regimes de
  dado a auditar"*). E a mesma ADR (linha 85) diz que o regime, inclusive "o que pode ser enviado",
  é **por provedor**.
- Nenhum recurso declara teto. Um recurso sensível futuro (álcool, peso — está no Deferred) com
  padrão `aparelho` aparece no seletor com todos os motores de nuvem.

**Severidade: alto.** É privacidade de dado de saúde, a razão de ser da AD-5.

**Rule proposta (aperta a AD-5 e a AD-8):**

> Na nuvem, o regime é por provedor: o recuo nunca troca de provedor, e provedor diferente só entra
> por preferência explícita. Preferência ilegível degrada dentro do próprio regime:
> `aparelho:<desconhecido>` resolve para a cadeia do recurso filtrada a regime ≤ aparelho, e id que
> nem se deixa ler resolve para `sem-modelo` — nunca para um padrão de regime acima do da
> preferência gravada. Cada recurso declara `regimeMaximo`; a resolução recusa preferência acima
> dele, e o seletor não a oferece. O teste da AD-5 é de propriedade sobre
> (preferência × padrão × catálogo), não só sobre as cadeias padrão.

### B10 — A classe não tem forma no fio Swift→TS, e a guarda (3) pode passar vazia

**Par:** F2 (ponte + porta) × F0 (barreira 3 e `ClasseDeFalha`) — e × F5 (Xcode 27).

**Como os dois obedecem.** AD-10(3): "a barreira lê o Swift da ponte e exige que todo literal de
classe emitido pertença a `ClasseDeFalha`". Convenção: "a API da ponte é em inglês".

**A incompatibilidade.**

- A F2, seguindo a Convenção, lança `GuardrailViolationException`. O JS recebe
  `code: 'ERR_GUARDRAIL_VIOLATION'` — é o `errorCodeFromString` do expo-modules-core 57
  (`CodedError.swift:45`: `"ERR_"` mais o nome em caixa alta, sem `Exception`). Não há literal
  `"guarda"` no Swift, e a barreira não tem o que conferir. Ou a F2 escreve
  `enum Classe: String { case indisponivel, guarda, … }` com raw values implícitos: zero literais, e
  a barreira fica verde por vacuidade, mesmo com um `case capacity` a mais.
- A tabela erro→classe não está na espinha. `rateLimited` é `capacidade` (recua) ou `transitoria`
  (piso)? E `decodingFailure`, `unsupportedGuide`, `unsupportedLanguageOrLocale`,
  `assetsUnavailable`, `concurrentRequests`? Um erro que o SDK 26 não conhece (o `LanguageModelError`
  do iOS 27 chegando a um binário do Xcode 26) cai no `catch` genérico — com qual classe? Pela AD-4
  só permanentes vão ao anel, então **o erro não mapeado some**.

**Severidade: alto.** A AD-4 existe para que duas pontas não classifiquem diferente, e a transição
do Xcode 27 está no escopo declarado.

**Rule proposta (aperta a AD-4 e a AD-10):**

> A classe atravessa como string em português, igual a `CLASSES_DE_FALHA` — exceção declarada à API
> em inglês —, dentro de uma `Falha` devolvida como **valor**, nunca como exceção do Expo. O Swift
> declara `enum ClasseDeFalha: String` com raw values **explícitos**; a barreira acha o enum (e falha
> se não achar) e exige igualdade de conjunto com o TS, não subconjunto. A tabela
> erro-do-fornecedor → classe é escrita uma vez, em `Engine.swift`. `@unknown default` e erro não
> reconhecido viram `transitoria` **e** vão ao anel com o nome cru — o anel guarda os permanentes e
> também os não mapeados.

---

## Médios

### B11 — A troca de SO muda o modelo e o ramo compilado sem mudar o id

**Par:** F1 (bancada no Mac) × F2 (app pelo EAS) — na F5, e já na próxima versão maior do iOS, que
costuma sair em setembro.

**A incompatibilidade.** `#if canImport(FoundationModels)` é verdadeiro em todo SDK 26 e 27: não
guarda `tokenCount` (26.4, que pede `#available(iOS 26.4, *)` em tempo de execução) nem
`LanguageModelError` (27, que pede guarda de compilador do Xcode 27). Com o Mac no Xcode 27 e o EAS
no 26, "o mesmo arquivo" compila dois ramos: a bancada mede o mapeamento de `LanguageModelError`, e
o app roda o de `GenerationError`. E o modelo do sistema vem com o SO: quando o iPhone sobe para o
iOS 27, `aparelho:sistema` passa a ser **outro modelo**, com o mesmo id e o mesmo portão aprovado.
A amostra de 20 é feita uma vez, o relatório não tem chave de versão, e a assinatura põe a versão
do iOS de um lado e (presumivelmente) a do macOS do outro — as duas colunas nem se juntam.

**Severidade: médio**, e sobe para alto no dia em que o Mac ou o iPhone mudarem de versão maior.

**Rule proposta (aperta a AD-11 e a Convenção "Assinatura"):**

> A assinatura do aparelho carrega `plataforma` e `build do SO` em campos separados. Relatório da
> bancada e portão são chaveados por (recurso, `MotorId`, build do SO). A amostra de 20 da AD-11
> roda de novo sempre que o Mac ou o iPhone mudam de versão maior, e resultados de versões
> diferentes nunca se somam. A CLI e o build de entrega usam o mesmo Xcode maior: o script da
> bancada confere `xcodebuild -version` contra o perfil do EAS e se recusa a rodar se divergirem.
> `#available` guarda símbolo novo do mesmo framework; `#if canImport` só guarda framework novo
> (Core AI).

### B12 — Medição precisa de cadeia de um elo, que a AD-5 proíbe

**Par:** F1 (bancada) e F2 (tela lado a lado) × F0 (AD-5: `sem-modelo` é sempre o último elo;
AD-2: ninguém executa a sequência por fora).

**A incompatibilidade.** A coluna "aparelho" da tela lado a lado, passando pelo orquestrador com
`[aparelho, sem-modelo]`, mostra a frase-molde quando o aparelho falha — e aí a comparação é de
molde com molde. Se a tela chamar o `Motor` direto e conferir por fora, fere a AD-2. Na bancada é
igual: medir a taxa de guarda do aparelho exige que a falha seja o resultado, não o piso.

**Rule proposta (aperta a AD-2):**

> O orquestrador tem dois modos: `produto` (cadeia resolvida, a AD-5 vale) e `medicao`
> (exatamente um motor, sem recuo e sem piso, e o resultado é a tentativa com a classe). Só a
> bancada e a tela de desenvolvimento usam `medicao`, e o tipo do resultado de medição não é aceito
> por nenhuma porta de gravação.

### B13 — "Nenhuma tela chama motor ao abrir" × nome de rota que nomeia ao abrir

**Par:** Convenção "Quando se chama um motor" × F4 (nome de rota pela porta).

**A incompatibilidade.** `mobile/src/app/historico/[label]/[id].tsx:149-163` chama
`nomearPedaladaSePreciso` num `useEffect` quando o detalhe abre — a ADR 0042 escolheu *"uma vez por
pedalada, quando o dono abre o detalhe"*. A F4, ao passar isso pela porta, ou fere a Convenção, ou
muda o produto (nome só por botão) sem ninguém ter decidido.

**Rule proposta (aperta a Convenção):**

> Há dois gatilhos, e o recurso declara qual é o seu. Leitura efêmera: só por ação explícita.
> Recurso que grava uma vez por entidade: pode disparar por evento, no máximo uma vez por entidade,
> protegido pela marca gravada (`route_name_meta`) e nunca gravando piso de indisponibilidade (B2).

### B14 — "O esquema é JSON Schema" sem subconjunto: três tradutores, três dialetos

**Par:** F0/F4 (descritor do nome de rota com `saida: esquema`) × F2 (ponte → `DynamicGenerationSchema`)
× F3 (a `ia-narrar`, que só conhece `json?: boolean`).

**A incompatibilidade.** O prompt do nome de rota declara `"regiao": string | null`
(`routes/prompt.ts:61-69`). Em JSON Schema isso é `type: ["string", "null"]` — válido para o Gemini,
e sem tradução direta em `DynamicGenerationSchema`, que tem propriedade opcional e não união com
null. A ponte falha na conversão, e com qual classe? `capacidade` recua para `sem-modelo`;
`saida-invalida` grava recusa e queima a rota (B2). Na nuvem, o corpo de hoje é
`{ sistema, usuario, json }`: se a porta mandar `saida.esquema` e a F3 não o ler, o Gemini responde
sem esquema — com uma restrição diferente da que a bancada mediu no aparelho.

**Rule proposta (aperta a Convenção "Pedido" e a AD-3):**

> O núcleo é dono de um subconjunto fechado, `Esquema`: objeto com propriedades obrigatórias ou
> opcionais, string com `enum`, inteiro com limites, booleano, array com mínimo e máximo — sem
> `null`, `$ref`, `oneOf` nem `format`. Tem validador, e um teste passa todo descritor por ele.
> Ausência se expressa como propriedade opcional, nunca como `null`. O fio da `ia-narrar` carrega o
> esquema e o adaptador o traduz; `json?: boolean` passa a ser derivado de `saida.tipo`.

### B15 — Os casos da AD-7 não particionam, e a frase decidida diz "cinco"

**Par:** F0 classificador × F0 frase/`semModelo` × F1 sonda de fidelidade.

**A incompatibilidade.** Sejam *n* dimensões medidas e *k* delas no mínimo, abaixo de 2. `duas`
(k = 2) e `todas-iguais` (k = n) coincidem quando n = 2; `fora-do-empate` (k ≥ 3) e `todas-iguais`
coincidem quando k = n ≥ 3. "Exatamente um caso", sem precedência: o classificador escolhe um, e um
oráculo escrito à mão na bancada pode esperar o outro. A frase decidida para `todas-iguais` é *"as
cinco dimensões estão no mesmo ponto"* (memlog, linha 44), mas a percepção não foi medida em 60 de
73 semanas (memlog, linha 33): no caso típico de `todas-iguais` são quatro dimensões, e a frase sai
errada justamente no caso comum. A borda "menos de duas medidas" (Deferred) é um sétimo caso ainda
sem nome.

**Rule proposta (aperta a AD-7):**

> Precedência fixa, avaliada nesta ordem: `sem-contagem` → `medidas-insuficientes` (menos de duas
> medidas) → `tudo-no-maximo` → `todas-iguais` (k = n) → `uma` → `duas` → `fora-do-empate`. O caso
> carrega *n*, e a frase usa essa contagem, não o número cinco. Um teste enumera todas as combinações
> de 0–2 × presença nas cinco dimensões e confere que cada uma cai em exatamente um caso.

### B16 — O catálogo esconde o indisponível, e a falta da lista apaga a nuvem

**Par:** F2 (catálogo do app) × F3 (lista exposta pela function, com deploy manual).

**A incompatibilidade.** (a) A AD-8 resolve "contra o catálogo do que o hospedeiro roda agora". Se o
aparelho sem Apple Intelligence sai do catálogo, a preferência é filtrada antes de ser tentada, a
trilha não tem o elo, e a tela não consegue dizer "Apple Intelligence desligado" — que a AD-5 manda
dizer. (b) A function hoje responde 405 a todo não-POST (`ia-narrar/index.ts:42`). Um build novo que
lê a lista antes do deploy manual da F3 fica com catálogo de nuvem vazio, e a revista, cuja cadeia é
nuvem → piso, não imprime. "Sem cópia própria" proíbe o cache que atravessaria essa janela. Pelo
precedente da AD-15 da revista, deploy e build fora de ordem é janela declarada, não descoberta.

**Rule proposta (aperta a AD-8 e a AD-9):**

> O catálogo lista todo motor conhecido do hospedeiro com estado `disponivel | indisponivel(motivo)`.
> A resolução nunca descarta a preferência: motor indisponível entra na trilha como tentativa
> sintética, com classe `indisponivel` e o motivo. `nuvem:padrao` está no catálogo sempre que houver
> rede, com ou sem lista; falhar ao ler a lista remove só as variantes nomeadas. O app pode guardar
> a última lista lida como cache com instante — não é cópia, porque não decide nada que a function
> não confira. A F3 declara a ordem: deploy primeiro, build depois.

### B17 — Concorrência sem dono: dois toques, janela trocada em voo, quatro cadernos num modelo só

**Par:** F2 (botão Ler + porta) × F2 (ponte sem estado, AD-3) × story 1.10 (quatro cadernos).

**A incompatibilidade.** Dois toques são duas gerações de ~14 s (o memlog mediu 13,8 s a frio) e, na
nuvem, duas chamadas pagas. Trocar de 7d para 4s durante a geração faz a frase da 7d pousar na 4s.
A ponte "sem estado" não guarda o handle da tarefa, então não cancela. A 1.10 narra quatro cadernos;
com `Promise.all` (o natural na nuvem) num motor de aparelho, são quatro sessões simultâneas no mesmo
modelo do sistema, cada uma com a sua janela de 4.096 tokens. Ninguém é dono da concorrência.

**Rule proposta (Convenção nova):**

> Concorrência é propriedade do motor: o catálogo declara `paralelo: n` (aparelho: 1), e a porta
> serializa por motor. A porta faz voo único por (recurso, `hashDoPedido`): um segundo toque com o
> mesmo hash se junta ao primeiro, e resultado cujo hash não é o do pedido corrente da tela é
> descartado. A ponte continua sem estado e não cancela — declarado.

### B18 — O portão da bancada × o padrão de nuvem que muda por `secrets`

**Par:** AD-11 ("um recurso só ganha motor de modelo como padrão depois de passar pela bancada") ×
F3/AD-9 ("modelo novo de provedor existente é configuração").

**A incompatibilidade.** A revista, o nome de rota e qualquer recurso com `nuvem:padrao` na cadeia
(B4) trocam de modelo com um `supabase secrets set`, sem bancada. E o núcleo não pode registrar
"aprovado com o modelo X", porque a barreira (2) proíbe o nome. O portão fica sem lugar para morar.

**Rule proposta (aperta a AD-11):**

> O portão é dado fora do núcleo. A lista do servidor carrega, por motor, os recursos para os quais
> ele passou na bancada (`aprovadoPara`), e esse campo só é escrito a partir de um relatório da
> bancada. `nuvem:padrao` como padrão de um recurso só vale se o padrão corrente do servidor estiver
> aprovado para aquele recurso; se não estiver, a resolução o trata como `indisponivel`, com motivo
> "não medido". (Alternativa só de procedimento, mais fraca: trocar o padrão nos `secrets` exige
> rodar a bancada de todo recurso que o usa.)

### B19 — O vocabulário proibido "que já tem dono" não existe

**Par:** F0 (a conferência da Saúde do sono compõe as listas, AD-6) × as stories da revista que
editam `ia/verificar.ts` (1.7, 1.8 e seguintes).

**A incompatibilidade.** `ia/verificar.ts` tem só `CAUSA`, privada (linha 46). Não há lista de
conselho, placar ou comparação com outras pessoas em nenhum lugar do núcleo — esses termos só
aparecem em comentários de `sleep/`. A tabela herdada (AD-3) e a AD-6 afirmam um dono que não
existe. A F0, para cumprir a AD-6, cria as listas: se as puser em `sleep/`, a revista cria as suas
depois em `verificar.ts`, e são dois donos.

**Rule proposta (corrige a linha AD-3 herdada e aperta a AD-6):**

> A F0 cria `VOCABULARIO_PROIBIDO` (causa, conselho, placar, comparação) em `ia/verificar.ts`,
> exportado, e `verificarTexto` passa a consumi-lo. Nenhum outro arquivo declara lista de termo
> proibido.

---

## Baixos

| # | Buraco | Rule proposta |
| --- | --- | --- |
| B20 | O reexport que a AD-1 manda fazer (`routes/` reexporta `ChamadorDeModelo` como `Motor`), e o barril `index.ts`, furam o alvo derivado da barreira (2): um arquivo que importa `Motor` de `../routes/nomear` não "importa `ia/motor`" | `Motor` só se importa de `ia/motor`. `ChamadorDeModelo` vira alias declarado no próprio `ia/motor.ts` e morre na F4. O alvo derivado casa qualquer arquivo que referencie `Motor` ou `Pedido`, por qualquer caminho |
| B21 | A sintaxe do marcador da AD-6 não tem dono: um recurso usa `{duracao}`, outro `«duracao»`, e a conferência genérica não sabe qual | Sintaxe e substituição em `ia/interpolar.ts`, com dono único |
| B22 | `guardrails` do pedido não tem significado na nuvem: a F3 pode mapear `permissivo` para `safetySettings` do provedor ou ignorar, e a bancada compara taxas de guarda sob restrições diferentes | O adaptador declara, na tabela de regime (ADR 0040), o que faz com `guardrails`; o relatório da bancada mostra |
| B23 | A preferência é um mapa inteiro gravado com `setJSON` (read-modify-write), com dois escritores (configurações e tela de desenvolvimento) | Um módulo dono da chave, com fila, no molde de `sync-breadcrumbs.ts:90` |
| B24 | A AD-7 promete no Prevents que a mesma janela não ganhe "frases diferentes a cada toque", mas a Rule só fixa o caso; amostragem não é declarada (a nuvem usa 0,4 fixo em `narrador.ts:63`, a ponte usará o padrão do sistema) | `Pedido` declara `amostragem: 'gulosa' \| 'padrao'`, e medição usa a gulosa — ou a promessa sai do Prevents |

---

## Ataques tentados que a espinha já fecha

- **Terceira cópia do cliente da `ia-narrar` dentro do app** — a AD-10(1) fecha no mobile; o buraco
  está fora dele (B3).
- **Preferência de motor derrubando `user_preferences` pelo `CHECK`** — a AD-8 fecha: guardada
  localmente, sem coluna, sem `ID_COLUMNS`.
- **A web recebendo um motor que não roda** — a AD-8 fecha: cada aparelho decide a sua.
- **Tempestade de chamadas pagas por retry** — a AD-4 fecha: "não existe retry automático fora desta
  tabela".
- **Contexto vazando entre recursos pela sessão** — a AD-3 fecha: uma sessão nova por pedido.
- **O motor escolhendo a dimensão, ou seja, calculando** — a AD-7 fecha; a sonda fica na bancada.
- **Modo permissivo com saída guiada** — a AD-3 fecha pelo tipo.
- **Nome de fornecedor subindo ao núcleo** — a barreira (2), com a lista ampliada, fecha (exceto
  pelo reexport, B20).
- **Chave de serviço na bancada** — a AD-11 herda a AD-14 da revista.
- **Fixture real versionado** — a Convenção e a AD-8 herdada fecham.
- **Dois workspaces de scripts (F1 e story 2.1)** — a AD-11 decide quem cria primeiro.
- **Registro de falha indo ao banco** — a Convenção fecha.
- **Lista de nuvem copiada no app** — a AD-9 fecha a posse; o que falta é o formato (B4) e a
  disponibilidade (B16).
- **Recuo aparelho → nuvem por cadeia gerada** — a AD-5 e o teste fecham; as portas laterais estão
  em B9.
- **Uma terceira costura (Vercel AI SDK e afins)** — a AD-1 fecha.
- **`/sono/saude` chamando motor ao abrir** — a Convenção fecha; o conflito está no nome de rota
  (B13).
- **Número inventado na Saúde do sono** — a AD-6 interpolada fecha; sobra a sintaxe do marcador
  (B21).
- **A ponte conhecendo o recurso** — a AD-3 fecha, e é justamente isso que cria a pressão de B5 (o
  anel precisa do recurso).
- **`toFixed` da percepção** — a Convenção fecha. A troca aparece também na `/sono/saude` da web e
  no bloco Sono da retro (a mesma `periodScore`), o que é desejável; o pacote da revista não consome
  `SleepScore.fact`, conferido.

## Ordem sugerida para fechar

1. **Antes da F0 escrever `ia/motor.ts`** (todos são tipos do núcleo): B1, B2, B4, B5, B6, B15, B19
   e B20.
2. **Antes da F1**: B7, B8, B11 e B12. A F1 é quem decide onde mora o Swift e o que é "mesmo
   pedido".
3. **Antes da F2**: B10, B16 e B17, e B9 antes do seletor.
4. **Antes da F3**: B3, B14 e B18.
5. **Antes da F4**: B13, que fica automaticamente coberto se B1 e B2 estiverem fechados.

B6 muda o escopo da story 1.10, e B3 toca a 2.2 (o backfill passa a injetar `invocar` em vez de
escrever cliente). Os dois vão ao `bmad-correct-course` que o memlog já previa.
