---
title: 'Story 1.5 — O prompt aprende as regras novas'
type: 'feature'
created: '2026-09-09'
status: 'done'
review_loop_iteration: 3
baseline_commit: '8fd4b34918e14de8e22974a0487e5a596e83ef54'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A Story 1.4 deixou uma janela declarada: a quinta regra **reprova** quem cita
valor de base sem nomear a base, e o prompt v2 não manda nomear nada — ele nem mostra B2 e B3
ao modelo. Enquanto ela durar, todo texto gerado tende a reprovar por uma lei que ninguém
contou ao modelo, e quem depurar vai achar que o verificador está errado.

**Approach:** O prompt passa a **mandar** o que o verificador **cobra**. Cada fato chega com
as três bases já rotuladas com a frase exata que a conferência aceita, a trajetória chega como
direção, e as leis do jornal ficam escritas. O prompt passa a ser montado **por caderno**, e
`PROMPT_VERSAO` sobe de 2 para 3.

## Boundaries & Constraints

**Always:**
- **A frase que o prompt prescreve é a frase que o verificador aceita.** As três formas —
  *"contra julho"* (B1), *"contra agosto do ano passado"* (B2), *"contra o que você costuma
  fazer em agosto"* (B3) — têm que passar em `verificarTexto`. Provado por teste de ida e
  volta, não por leitura.
- **Zero número novo no alfabeto.** B2, B3 e `periodos` já estão em `valoresDoPacote`;
  mostrá-los ao modelo não muda o tamanho do alfabeto. Se algo aumentá-lo, o aumento é
  declarado.
- **Ausência é fato.** Base que não existe aparece no prompt dizendo que não existe; base que
  existe e não foi medida diz isso — as duas coisas são diferentes.
- A trajetória se escreve como **direção** (*"cai pelo terceiro mês seguido"*), nunca como
  valor bruto.
- Nenhum nome de fornecedor no texto do prompt — a barreira cobre **literal de string**,
  porque o prompt vaza para o contexto do modelo.

**Ask First:**
- Qualquer alargamento do vocabulário de `verificar.ts` além do necessário para as três formas
  prescritas. Vocabulário novo é a única forma de afrouxar a quinta regra.
- Qualquer número novo no pacote ou no prompt.

**Never:**
- Não narrar quatro vezes no celular: a impressão por caderno é a Story 1.10, e quadruplicar a
  chamada paga antes de haver onde gravar as quatro linhas é regressão paga.
- Não relaxar as cinco regras para acomodar prosa. Se a prosa prescrita reprova, corrige-se a
  prescrição ou o vocabulário — nunca a severidade.
- Não escrever tela: esta story não tem superfície.
- Não mexer no ranqueamento, na lápide, nem na extração da chamada (1.7 e 1.8).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Fato com as três bases | `atual` 435 km; B1 862, B2 300, B3 410 | A linha mostra as três, cada uma com a **frase prescrita** e o percentual | N/A |
| Ida e volta das três | A frase que o prompt rotulou para B*n*, citada com o valor de B*n* | `verificarTexto` **aprova** — inclusive a perífrase de B3 | N/A |
| Base inexistente | B2 com `existe: false` | Sai como `sem o mesmo período do ano anterior` | N/A |
| Base existente sem medida | B3 `existe: true`, `valor: null` | Sai como não medida — **não** como inexistente | N/A |
| Período sem nome próprio | Semana e trimestre | Cai no rótulo genérico (`o período anterior`), que a conferência aceita | N/A |
| Prompt de um caderno | `montarPrompt(pacoteDeSono)` | Nenhum número nem rótulo de Movimento no texto | N/A |
| Trajetória | `direcao: 'cai'`, `periodos: 3`, `desde: 'junho'` | Sai como direção; o único número é `3` | N/A |
| Edição inteira (transitório) | Os quatro pacotes | Um prompt só, com os quatro cadernos — como hoje | N/A |

</frozen-after-approval>

## Code Map

- `packages/shared/src/ia/prompt.ts:35-57` -- `linhaDeFato`: hoje renderiza **só B1 e sem
  nome** (`(anterior: 862 km, −49,5%)`). O comentário no topo dela declara que B2/B3,
  `tendencias` e `textos` esperam por esta story
- `packages/shared/src/ia/prompt.ts:96-129` · `:143` · `:160-210` -- `SISTEMA` (faltam:
  nomear a base, trajetória como direção, a primeira frase como manchete, exemplos de
  conselho), `PROMPT_VERSAO = 2` → 3, e `montarPrompt(UmOuMaisPacotes)`, que passa a ser
  **por caderno** com a união à parte
- `packages/shared/src/ia/verificar.ts:99-121` -- `B1_GENERICO`, `B1_POR_TIPO`, `B2_VOCAB`,
  **`B3_VOCAB`** — o vocabulário que a quinta regra aceita
- `packages/shared/src/ia/verificar.ts:148-167` -- `nomeEmProsa` (privada): `"Julho 2026"` →
  `"julho"`, já **normalizada** (sem acento). O prompt precisa da forma com acento
- `packages/shared/src/period/bounds.ts:42` · `:138` -- `MONTHS_PT` e `previousPeriodLabel`:
  dono único do rótulo de período
- `packages/shared/src/ia/pacote.ts:76-105` · `:137-159` -- `BASE_ROTULO` e `Base` (`existe`,
  `valor`, `motivo`), a gramática de ausência que a linha do fato tem que respeitar; e
  `FatoTendencia`/`FatoTexto`, hoje invisíveis no prompt
- `packages/shared/src/ia/verificar.test.ts:971-1027` -- `describe('montarPrompt')`; a
  asserção `'(anterior: 862 km, −49,5%)'` muda de forma nesta story
- `mobile/src/lib/edicao-ia.ts:37-57` -- único chamador de `montarPrompt`; passa os quatro
  pacotes e narra **um texto só** até a Story 1.10
- `packages/shared/src/architecture.test.ts:759-806` -- a barreira que lê `ia/` inteiro,
  comentários fora e **literal de string dentro**

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/period/bounds.ts` -- expor o rótulo do período **em prosa** (com
      acento, minúsculo: `"Março 2026"` → `"março"`), dono único; `verificar.ts` passa a
      normalizar essa saída em vez de ter a própria cópia
- [x] `packages/shared/src/ia/verificar.ts` -- `B3_VOCAB` aceita a perífrase que a story
      prescreve (*"o que você costuma fazer em agosto"*). **É o defeito de encaixe entre
      1.4 e 1.5**: a forma prescrita não estava no vocabulário e reprovaria — ver Design Notes
- [x] `packages/shared/src/ia/prompt.ts` -- a frase prescrita de cada base, derivada do
      período. **Uma base tem UM nome**: os ramos com valor e sem medida usam a mesma frase,
      nunca `BASE_ROTULO` num e a frase prescrita no outro
- [x] `packages/shared/src/ia/prompt.ts` -- **a base inexistente sai da linha do fato** e é
      declarada uma vez por caderno. Repetida em toda linha ela põe vocabulário de base a
      menos de 64 caracteres de todo número, e a quinta regra lê isso como inversão — ver
      Design Notes e o Spec Change Log
- [x] `packages/shared/src/ia/prompt.ts` -- `SISTEMA` proíbe escrever o nome de uma comparação
      **na mesma frase** que um número de outra. É a prescrição fechando o buraco, porque a
      severidade da quinta regra não se mexe (ver *Never*)
- [x] `packages/shared/src/ia/prompt.ts` -- renderizar `tendencias` (direção) e `textos`. O
      `desde` da trajetória é nome de período: numa edição de mês é nome próprio que não é o
      corrente nem o anterior, e a quinta regra o acusa. `desde` com dígito não vai ao prompt
- [x] `packages/shared/src/ia/prompt.ts` -- a linha de **Cobertura** ganha seção própria: hoje
      ela cai sob o último `####`, e se esse for `Fatos sem número` a regra 5 proíbe
      exatamente os números que a regra 8 exige
- [x] `packages/shared/src/ia/prompt.ts` -- `SISTEMA` reescrito: nomear a base com as três
      formas; trajetória como direção; informa e não aconselha, com os exemplos proibidos;
      nunca calcula e nunca afirma causa; ressalva de cobertura; **a primeira frase vira capa
      e sumário**. Ele serve aos **dois grãos** — o caderno e a união que o celular ainda
      manda —, então o escopo do texto sai do cabeçalho do usuário, não de um `SISTEMA`
      escrito no singular
- [x] `packages/shared/src/ia/prompt.ts` -- `montarPrompt` passa a receber **um** pacote;
      `montarPromptDaEdicao` fica com a união, declarada transitória até a 1.10
- [x] `packages/shared/src/ia/prompt.ts` -- `PROMPT_VERSAO = 3`
- [x] `mobile/src/lib/edicao-ia.ts` -- chamar a função da edição; nada mais muda
- [x] `packages/shared/src/ia/verificar.test.ts` -- a matriz, com **o teste de ida e volta**
      das três bases em `month`, `year`, `week` e `season` — e sobre **a forma que a produção
      emite hoje** (B1 com valor, B2 e B3 inexistentes), não só sobre as três valoradas

**Acceptance Criteria:**
- Given as três formas prescritas, when cada uma é escrita com o valor da base que rotula,
  then `verificarTexto` não devolve nenhum problema de `regra: 'base'`.
- Given o pacote de Sono, when `montarPrompt` o monta, then nenhum número nem rótulo dos
  outros cadernos aparece no texto.
- Given o alfabeto de agosto medido na 1.3 (71 valores / 16 inteiros), when o prompt v3 é
  montado, then o alfabeto continua idêntico — a story não põe número novo.
- Given a barreira do núcleo de IA, when o prompt v3 existe, then ela continua verde.
- Given a story fecha, when `PROMPT_VERSAO` é lido, then vale 3.

## Spec Change Log

### Iteração 1 — a declaração de ausência é vocabulário de base (09/09/2026)

**Achado que disparou.** Duas camadas de revisão, independentes, executaram o caminho e
acharam o mesmo: com a primeira derivação, **toda linha de fato em produção** terminava em
`; sem o mesmo período do ano anterior; sem a normal do período` — porque hoje o celular monta
`EntradaPacote` sem `bases`, e `basesDe` marca B2 e B3 `existe: false` em **todos** os fatos.
Essas duas frases são feitas do vocabulário que a quinta regra usa para identificar B2 e B3.
Reproduzido à mão, com o pacote na forma real de agosto:

```
"Sem a normal do período, o único contraste é 862."
  → base: "862" é valor de B1 (o período anterior), mas a frase nomeia B3 (a normal do período)
```

O modelo obedeceria a regra 3 do `SISTEMA` — declarar a ausência — e a edição inteira seria
recusada. É a falha da janela 1.4→1.5 reaparecendo com o sinal invertido, e a suíte ficava
**verde**: os testes de ausência conferiam a string do prompt e nunca alimentavam o
verificador, e a ida e volta só rodava sobre a forma com as três bases valoradas, que a
produção não emite.

**Estado ruim evitado.** Mesclar isto entregaria uma story cujo propósito declarado é fechar a
janela em que o prompt prescreve o que o verificador recusa — e que a reabriria em toda linha
de todo caderno, sem nenhum teste vermelho.

**O que foi emendado.** A base inexistente sai da linha do fato e é declarada uma vez por
caderno; uma base passa a ter um nome só nos ramos com valor e sem medida; o `SISTEMA` proíbe
escrever o nome de uma comparação na mesma frase que um número de outra; o `desde` da
trajetória e a linha de Cobertura ganham tratamento; e a ida e volta passa a rodar sobre a
forma que a produção emite hoje, além de `season`. Mais o `SISTEMA` servindo aos dois grãos.

**KEEP — o que funcionou e tem que sobreviver à re-derivação:**
- **A ida e volta lê o prompt renderizado**, extraindo a frase da linha do fato — nunca
  chamando a função que rotula. Chamar `frasesDasBases` do teste faria os dois lados
  concordarem sobre uma frase que o texto renderizado não contém: é a forma exata do defeito
  que a 1.4 deixou.
- **`'costuma fazer'` em `B3_VOCAB`**, com o teste que escreve a perífrase de B3 ao lado de um
  valor de **B1** e continua reprovando por inversão — a prova de que o conserto é vocabulário
  e não severidade.
- **`periodProseLabel` em `bounds.ts` como dono único**, com `nomeEmProsa` normalizando a saída
  dele em vez de guardar a segunda cópia da redução.
- **Nome próprio só em `month` e `year`**, com a razão escrita: *"contra 27/07 – 02/08"* põe
  dígitos que o pacote não autoriza e reprovaria na **primeira** regra, não na quinta.
- **`montarPrompt` por caderno + `montarPromptDaEdicao` transitória**, e `PROMPT_VERSAO = 3`.
- **A armadilha do `FatoTexto` testada**: o `72` de *"72% pavimentado"* fora do alfabeto, com
  teste demonstrando que citá-lo solto reprova na primeira regra.
- **A varredura do parágrafo da regra 2 atrás de nome de mês**, que impede exemplo fixo de base
  no `SISTEMA` sem condenar o `"30 de agosto"` da seção FORMA.
- **A medição do alfabeto inalterada em 71/16**, com a união idêntica à da v1.

### Iteração 2 — a regra era geral, e a emenda 1 escreveu o caso particular (09/09/2026)

**Achado que disparou.** As três camadas convergiram: a emenda 1 tirou da linha do fato a base
**inexistente**, mas a base que **existe e não foi medida** continuou inline, sob a frase
prescrita — `(contra julho: 862 km, −49,5%; contra o que você costuma fazer em agosto: não foi
medida)`. Medido: o nome de B3 a **30 caracteres** do valor de B1, dentro da `JANELA_DECISAO`
de 64. É a mesma vizinhança da iteração 1, por outra porta. **Latente**, não em produção: o
celular monta `EntradaPacote` sem `bases`, então B2/B3 são sempre inexistentes hoje; fica vivo
no dia em que alguém popular `EntradaPacote.bases`.

E a guarda escrita para pegar exatamente isso é **inerte**: `clausulas` parte no primeiro
`': '`, então `contra … : não foi medida` volta com `valor: 'não foi medida'`, e o
`assert.ok(c.valor != null)` passa. A guarda só dispara em cláusula sem dois-pontos — forma que
`linhaDeFato` não produz mais.

**O que foi emendado — a regra geral, no lugar do caso particular.** Uma linha de fato só pode
nomear uma base **quando o número daquela base vem logo em seguida**. Toda declaração sem
número — inexistente *ou* sem medida — desce para o bloco do caderno. A guarda passa a exigir
que a cauda da cláusula **seja um número**, não que exista.

**Rota escolhida: correção dirigida, não terceiro revert.** A emenda é uma generalização
estrita de uma regra que a spec já dizia, e reverter mil linhas corretas para re-derivá-las
quase idênticas trocaria defeito conhecido por defeito novo. Registrado como desvio consciente
do fluxo, não como esquecimento.

**Também emendado, do mesmo achado:** as leis do `SISTEMA` que se contradizem — a regra 2
proíbe o que a própria linha de fato exibe (três nomes e três números numa frase), a 4 proíbe o
que `linhaDeTendencia` renderiza (`3` a 26 caracteres de `junho`), e a 5 manda citar o fato sem
número *"como está escrito"* logo depois de proibir extrair número de dentro dele, o que é
insatisfazível para *"72% pavimentado"*. As leis passam a falar do **texto que o modelo
escreve**, não do que ele lê. E `nomeDoFato` ganha a mesma guarda de dígito que o `desde` já
tinha.

### Iteração 3 — a classe grave não voltou; sobrou lei estrita demais e afirmação falsa (09/09/2026)

**O que a rodada mediu.** Pela política registrada no `AGENTS.md`, todo remendo puxa revisão
nova, e ela rodou. **Nenhum achado da classe das rodadas 1 e 2** — vocabulário de base dentro
da janela de decisão do número de outra. Os severos caíram para imprecisão de documentação,
lacuna de teste e risco pré-existente. Convergência, não divergência.

**Quatro correções aplicadas à mão, sem re-derivação:**

1. **A lei 2 era mais estrita que o verificador.** Ela proibia *"uma frase que traz o número de
   uma comparação não traz o nome de outra"* — e `"Foram 435 km, contra julho: 862 km, e contra
   agosto do ano passado: 300 km."` passa limpo na conferência. Lei estrita demais não reprova
   nada: joga fora escrita boa, e proibia a própria forma que a linha do fato exibe. Agora ela
   proíbe o que é perigoso de verdade — nome de comparação **sem o número dela** ao lado do
   número de outra —, com teste provando que a prosa permitida é a que a conferência aprova.
2. **Duas afirmações falsas no código.** *"Os dois registros nunca se misturam"* é falso em
   `week`, `season` e `all`, onde a frase prescrita **é** o rótulo genérico — e isso está certo,
   porque cada nome segue colado ao próprio valor. E *"a lei não dá exemplo de base"* era falso:
   a FORMA proibia planilha com *"em comparação com o ciclo passado"*, e `'ciclo passado'` é
   literalmente `B1_GENERICO` — vocabulário de base dentro da lei que jurava não ter nenhum,
   quebrado em duas linhas pelo formatador, três seções abaixo de onde a asserção olhava. A
   varredura passou a ser do `SISTEMA` **inteiro**, normalizado como a quinta regra normaliza.
3. **O fecho do bloco mentia.** *"Nenhuma das linhas acima tem número"* — acima estão a lista de
   fatos e a Cobertura, que têm. A frase passou a nomear a seção, não uma posição.
4. **`semDado` não é o vazio inteiro.** Ele olha `metricas`, `tendencias` e `textos`, e ignora
   `cobertura`, `lacunas`, `eventos` e `correlacoes`. Um caderno de Sono sem uma métrica pode
   ter 31 dias de lacuna e cobertura **desigual**, que a regra 8 obriga a declarar — devolver
   vazio ali calaria uma ressalva obrigatória, e na Story 1.10, onde cada caderno é conferido
   sozinho, não haveria outro para carregá-la. Mudo passou a ser quem não tem nada disso.

**A lacuna de teste mais afiada, e ela não era defeito vivo.** `periodProseLabel` devolve o
rótulo **com** acento (quem escreve é o prompt) e `nomeEmProsa` normaliza (quem lê é a
conferência). As duas metades vivem em arquivos diferentes e só uma estava presa: nenhuma ida e
volta passava por mês acentuado, porque `Março` é o único em `MONTHS_PT` e nenhum fixture o
usava como anterior. Apagar a normalização deixava as 124 verdes e reprovava **toda edição de
abril** — o prompt prescreve *"contra março"*, a agulha fica com acento, e `nomesProprios` ainda
acha `"marco"` e o denuncia como nome próprio **errado**: silêncio virando acusação. A ida e
volta de abril entrou.

**O que foi deferido, com o motivo.** Quatro achados reais que **não são desta story**: rótulo
de fato com dígito (`Cerveja 500 ml`, `SpO2`) reprovando na regra 1 — rendering da v1; dígitos
não autorizados no cabeçalho de semana e trimestre — idem; B1 e B2 mostradas como comparações
distintas numa edição de ano — origem no pacote; e a manchete lida em isolamento sem base
nomeada — Story 1.8, dona da extração. Estão em `deferred-work.md` com evidência.

## Design Notes

**A ausência não pode morar ao lado do número.** Declarar que uma base não existe **exige**
nomeá-la, e o nome dela é exatamente o que a quinta regra procura para decidir de quem é o
número mais próximo. Repetir a declaração em toda linha põe vocabulário de B2 e B3 a menos de
64 caracteres — a `JANELA_DECISAO` — de todo valor de B1 do prompt, e convida o modelo a
reproduzir essa vizinhança na prosa. Por isso a declaração é **do caderno, uma vez**, longe da
lista, e o `SISTEMA` diz ao modelo que nome de comparação e número de outra comparação não
cabem na mesma frase.

> **O conserto mais profundo existe e não é desta story.** Uma base **negada** ("sem X", "X:
> não foi medida") não é uma citação de X, e a quinta regra poderia deixar de tratá-la como
> nomeação. Isso mexeria na severidade da regra, que o *Never* desta spec proíbe: *"corrige-se
> a prescrição ou o vocabulário — nunca a severidade"*. Fica registrado como decisão do dono,
> não como omissão.

**O `SISTEMA` serve a dois grãos, e um deles é a produção de hoje.** O celular manda os quatro
cadernos num texto só até a Story 1.10. Um `SISTEMA` que abre com *"você escreve o caderno"* no
singular descreve errado exatamente a chamada que está em produção agora. O escopo do texto —
um caderno ou a edição — sai do cabeçalho da mensagem do usuário, que as duas funções escrevem
diferente; a lei fica neutra e vale para os dois.

**O defeito de encaixe, e por que ele só aparece agora.** A Story 1.4 registrou que as três
formas prescritas passam. Duas passam. A terceira não: o teste que se chama *"a forma de B3 —
'o que você costuma fazer em agosto'"* **assere outra frase** (`"da normal do período para
agosto"`), e `B3_VOCAB` não conhece "costuma". Se o prompt prescrevesse a forma do épico como
está, todo texto que citasse B3 reprovaria — exatamente a falha que esta story existe para
fechar, com o sinal invertido. É o que o memlog chama de quebra **entre** stories: nenhuma
revisão isolada pega. O conserto é vocabulário, não severidade — a inversão continua sendo
pega, porque a regra compara a base nomeada com a base do valor.

**Prescrever pela renderização, não pelo exemplo.** O modelo não precisa deduzir a forma: cada
base chega no prompt já rotulada com a frase que a conferência aceita, e a lei manda copiar o
rótulo. Exemplo fixo no `SISTEMA` envelheceria em silêncio quando o período mudasse de tipo.

**Duas funções, e a segunda tem data de morte.** `montarPrompt` é por caderno — é o que a
1.10 vai usar quatro vezes. `montarPromptDaEdicao` existe só para o celular continuar narrando
um texto só até lá: narrar quatro vezes hoje quadruplicaria a chamada paga sem haver onde
gravar as quatro linhas.

**O que esta story deliberadamente não conserta:** fato com `atual` nulo continua fora do
prompt, mesmo tendo base ("no mês passado eram 48 bpm"). É a métrica morta, e ela vira
**lápide** na Story 1.7. Registrado aqui porque o alfabeto autoriza números que o prompt não
mostra — o que é seguro (alfabeto ⊇ prompt), mas parece bug.

**Armadilha do `FatoTexto`:** ele não entra no alfabeto numérico. Um valor como *"72%
pavimentado"* citado pelo modelo reprovaria na **primeira** regra. Ninguém produz `FatoTexto`
hoje; o prompt manda citá-los por extenso e não extrair número de dentro deles, e quem for
produzi-los precisa saber disso.

## Verification

**Commands:**
- `pnpm --filter @vitale/shared lint` -- expected: 0 erros
- `pnpm --filter @vitale/shared test` -- expected: exit 0, barreiras verdes, a medição do
  alfabeto **inalterada**
- `cd mobile && pnpm exec tsc --noEmit && pnpm exec jest` -- expected: sem regressão
- `pnpm --filter @vitale/web build && pnpm --filter @vitale/web test` -- expected: sem regressão

**Provas negativas (rodar e reverter):**
- Prescrever B3 sem acrescentar a perífrase ao vocabulário -- expected: a ida e volta de B3
  reprova. É a prova de que o defeito de encaixe era real.
- Renderizar a base sem o rótulo (só `(anterior: 862)`) -- expected: a ida e volta de B1
  reprova.
- Fazer `montarPrompt` aceitar a união de novo -- expected: o teste de isolamento por caderno
  reprova.
- Tirar do `SISTEMA` a regra da primeira frase -- expected: a asserção da manchete reprova.
- Renderizar a trajetória com valor bruto -- expected: a asserção de direção reprova.
- Tratar base inexistente como não medida -- expected: os dois casos da matriz colidem.
- **Pôr a base inexistente de volta na linha do fato** -- expected: a ida e volta sobre a forma
  de produção reprova, com `"862" é valor de B1 … mas a frase nomeia B3`. É a prova de que a
  iteração 1 era real, e ela tem que ficar vermelha se alguém desfizer a emenda.
- Escrever o `SISTEMA` no singular (*"você escreve o caderno"*) -- expected: a asserção de que
  a lei serve aos dois grãos reprova.
- Renderizar a base sem medida com `BASE_ROTULO` em vez da frase prescrita -- expected: a
  asserção de "uma base, um nome" reprova.
- Devolver a linha de Cobertura para debaixo do último `####` -- expected: a asserção de seção
  própria reprova.

**Manual checks:**
- Nenhum. Sem superfície; a primeira tela é a Story 1.11.

