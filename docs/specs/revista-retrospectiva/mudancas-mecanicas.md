# Mudanças mecânicas

Companion de [`spec.md`](spec.md). O que muda no banco, no núcleo e no código
existente. Cobre CAP-1, CAP-6, CAP-13 e CAP-14.

## Banco

### `edicoes_ia` — chave e posição

```sql
primary key (user_id, tipo_periodo, inicio, fim, caderno)
caderno  text not null check (caderno in ('sono','movimento','coracao','rotina'))
posicao  smallint not null
unique (user_id, tipo_periodo, inicio, fim, posicao)
```

`PACOTE_VERSAO`, `prompt_versao`, provedor, modelo e `agg_version_no_momento` seguem
**por linha** — o caderno de Sono ganha errata sem tocar no de Movimento.

**Mas `AGG_VERSION` é global**, e já se moveu nove vezes: um bump marca errata em todas
as edições de uma vez — hoje, ~1.744 linhas. Isto **fica assim**, decidido em 08/09/2026:
se a agregação mudou, toda edição anterior é potencialmente velha, e dizer isso é honesto.
O custo é declarado — uma errata que aparece em tudo ao mesmo tempo é indistinguível de
ruído, e vale aqui o mesmo argumento que a lápide já usou sobre repetição.

**A ordem é coluna, não array.** Com a chave por caderno, cada caderno é uma linha; um
array com a ordem do conjunto guardado em cada parte é uma chance de divergir por
linha. O `unique` faz o banco cobrar a invariante em vez da revisão de código.

**A ordem congela na impressão.** A ordem sai do dado, mas `ordenarCadernos` é código:
ajustar o peso da confiança em novembro faria agosto/2026 se reordenar sozinho —
reescrita silenciosa de período fechado. Isto preserva a **prova de gráfica** que o
`retro_prefs` inventou: ela deixa de congelar por usuário depois de 60 dias e passa a
congelar **por edição, na impressão**.

**A capa ganha coluna** — decidido em 08/09/2026, **supersedendo** a decisão de que não
ganharia. A manchete continua derivada (é a primeira frase do caderno em `posicao = 1`),
mas **a foto é carimbada na impressão**: `coverOf` lê `isCover` e `state === 'linked'`,
os dois mutáveis depois dela — a estrela, o vínculo automático de 40 m, o `ph://` que
some da biblioteca. Sem carimbo, a foto de agosto vira outra em outubro, contra *período
fechado congela* e contra o próprio sinal de sucesso deste spec.

### A ordem sobrevive à reimpressão parcial

Reimprimir **um** caderno — a edição em que Rotina reprova e os outros três ficam —
chocaria com `unique (user_id, tipo_periodo, inicio, fim, posicao)` se a posição do
reprovado voltasse diferente. **Cada impressão, mesmo parcial, recalcula e regrava as
quatro posições em transação.** Nenhuma linha órfã, nenhuma posição reservada sem texto.

A restrição *a ordem congela na impressão* passa a ler-se **na última impressão**:
reabrir nunca reordena, e só um ato explícito de reimprimir reordena.

### A lua não cabe aqui — `lua_execucoes`

O `caderno='lua'` que o [pré-registro](pre-registro-lua.md) §7.2 manda gravar bate no
CHECK acima; a chave primária torna o *acumula, nunca substitui* impossível; e o teste
roda sobre **todo o histórico**, que não é `week`, `month`, `season` nem `year` — e `all`
o CHECK também recusa. Três impedimentos independentes, e nenhum deles se conserta sem
descaracterizar `edicoes_ia`.

As execuções passam a viver em **`lua_execucoes`**: uma linha por execução, com o hash do
pré-registro que a autorizou, o veredito, as contagens e a data. Acumular vira natural.

> **Pré-requisito de construção.** Isto contraria o §7.2, e o pré-registro é **imutável**.
> O arquivo não se edita: ele próprio prescreve a saída — *"correção só por documento
> novo, que cita este e diz o que mudou e por quê"*. Esse documento é obrigatório antes de
> a lua ser construída.

### As 7 edições hoje em produção

`prompt_versao 2` · `pacote_versao 1` · `gemini-3.6-flash`, impressas em 06–07/09/2026.

**Não viram errata** — errata é para quando o fato muda, e nenhum fato mudou; elas
ficaram *antigas*, que é outra coisa. O texto está exportado em
[`primeiras-edicoes-prompt-v2.md`](primeiras-edicoes-prompt-v2.md), o que dá **diff**
contra o prompt v3 (coisa que a tabela nunca daria).

**As linhas saem na migration, não antes.** Hoje o caminho de leitura ainda as toca e
uma delas tem horas de vida; removê-las sem substituto é regressão sem ganho. O
argumento a favor de remover — *linha viva que nenhum caminho de leitura toca
apodrece, e não dá para escrever golden set para uma forma que o app não produz mais*
— passa a valer no dia em que `pacote_versao` sobe.

## Núcleo

| Item | Mudança |
|---|---|
| `FatoNumero` | `atual` + `bases[]` identificadas, no lugar de `atual`/`anterior`/`delta`. Atravessa `numerosDoPacote`, `valoresDoPacote` e o verificador |
| `FatoTendencia` | **novo** — direção, períodos, desde |
| `FatoTexto` | **novo** — cidades, piso, lápides |
| `montarPacote` | passa a montar **por caderno** |
| `verificar.ts` | **quinta regra** — base citada sem nome reprova |
| `ordenarCadernos` | **novo** — função pura, `pacotes → CadernoId[]` |
| `PACOTE_VERSAO` | 1 → **2** |
| `PROMPT_VERSAO` | 2 → **3** |
| efeméride (sol e lua) | **novo**, função pura de data e coordenada; derivada na leitura, **nunca gravada** — mesmo precedente do preço do hábito (`unit_price`), o que a torna retroativa a 22/05/2023 de graça |
| `PRE_REGISTRO_LUA_SHA` | **nova constante**, comparada antes de rodar o teste lunar |

Tudo em `shared/src/ia/` continua sob a barreira do `architecture.test.ts`: nada de
`fetch`/XHR/WebSocket, import não-relativo, nome de fornecedor ou leitura de ambiente
— inclusive em literal de string.

### Barreira nova

Hash do pré-registro divergente **com execução já gravada** quebra o build. Não para
impedir — o dono tem o repositório — mas para obrigar a declarar em voz alta que o
teste mudou depois de ver o resultado.

## O que sai do código

| Sai | O que era |
|---|---|
| `RetroPrefs.order` · `moveBlock` | a ordem escolhida pelo leitor |
| `layoutEditable` · `proofStartedOn` · `PROOF_DAYS` | a prova de gráfica por usuário |
| `DEATH_DAYS` · `deadBlocks` | blocos escondidos há 60 dias virando candidatos a remoção |

**Fica `hidden`.** Esconder é outro poder — *"Rotina nunca"* — e é a única forma de o
leitor discordar da revista; o ranqueamento não substitui, porque um caderno
indesejado lidera justamente no mês em que varia mais.

**Sem migration.** `resolveRetroPrefs` é defensivo por desenho (chave ausente herda o
default), então a chave `order` passa a ser **ignorada na resolução** e o jsonb em
produção fica como está.

O painel **"Diagramação"** em [`mobile/src/app/retrospectiva/index.tsx:735`](../../../mobile/src/app/retrospectiva/index.tsx)
não some — emagrece: perde as duas setas de cada linha e fica só o olho. A legenda
muda, porque a segunda frase fala de uma regra que deixou de existir. A web nunca teve
esse painel.

## Coordenada do usuário

A efeméride precisa de latitude e longitude. As rotas têm; os dias sem atividade não
têm nenhuma. **O lugar do usuário passa a ser configuração** (~50,8° N para a
Bélgica). Onde exatamente ela mora, e o que acontece com viagem, é questão aberta.

## Backfill

**Períodos fechados por caderno**, respeitando a data em que cada fonte começa:

```
caderno                     sem  mês  tri  ano  total
Movimento (desde 22/05/23)  172   39   12    2    225
Coração   (desde 24/03/25)   76   17    5    0     98
Sono      (desde 23/04/25)   71   16    4    0     91
Rotina    (desde 01/05/26)   18    4    0    0     22
                                                  ───
                                                  436
```

A **US$ 0,011/chamada** — preço medido em agosto, não estimado — **US$ 4,80** com
semanas, **~US$ 1,20** só mês/trimestre/ano. Há US$ 25 carregados.

**Decisão:** em massa para mês, trimestre e ano. Semana não grava edição (é postal).

### Roda fora do aparelho

O núcleo é puro, então o mesmo código roda num script `tsx` na máquina exatamente como
roda no iPhone; quem fala com o modelo é a edge function `ia-narrar`, que atende os
dois igual. `fetchEdicao`/`upsertEdicao` já vivem em `shared/src/data/`, porque a
catraca recusa `.from()` fora do núcleo.

Três condições, nenhuma negociável:

1. **A ordem** — verifica **antes** de gravar.
2. **A assinatura idêntica** — provedor · modelo · `prompt_versao` · `PACOTE_VERSAO` ·
   `agg_version_no_momento`. Sem isso, 436 edições que não se comparam com as futuras
   nem aceitam errata.
3. **Paginação** — o **PostgREST corta em 1000 linhas sem erro** e `health_daily` tem
   4.385. Sem `range` + `order`, o backfill roda inteiro, grava tudo, e um terço das
   edições narra um subconjunto silencioso do histórico: invisível em teste, visível
   dois meses depois quando um número não fecha.

**Teste obrigatório:** mesmo pacote, dois hospedeiros, mesmo texto verificado. Se a
edição gerada pelo script divergir da gerada pelo telefone, há duas implementações da
mesma conta — o preço já foi pago uma vez, quando a manchete divergiu da tela.
