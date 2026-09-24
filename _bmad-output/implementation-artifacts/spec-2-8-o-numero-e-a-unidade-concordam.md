---
title: 'Story 2.8 — O número e a unidade concordam, e o script reimprime um caderno só'
type: 'bugfix'
created: '2026-09-24'
status: 'done'
baseline_commit: '4850033fbd8aa212e42d8dd98f54b3f30ea1962b'
review_loop_iteration: 1
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** O arquivo que a corrida da 2.3 acabou de imprimir diz **"1 dias"** — *"A refeição foi realizada em 1 dias ao longo do mês"*. Medido em produção em 24/09: **68 ocorrências, 37 linhas, 35 dos 45 períodos**, sempre no caderno `rotina`. Pelo ADR 0049 o número e a unidade são do código, e o código cola `'dias'` em qualquer valor. Varrendo o acervo inteiro por regex, é o **único** caso: `km`, `h`, `m` e `bpm` são símbolos e não variam.

**Approach:** A unidade concorda com o número onde ela o encontra — em `linhaDeFato`, o único lugar que os cola — e `PROMPT_VERSAO` vai a 6. E o script ganha `--caderno <id>`, que o núcleo já sabe fazer e que ele não usava: a correção passa a custar ~37 chamadas em vez de ~105.

## Boundaries & Constraints

**Always:**
- A concordância é do **código**, nunca do modelo (ADR 0049).
- **`--caderno` vale com `--massa`** — é assim que os 35 períodos se corrigem numa corrida só.
- **Parcial nunca troca capa existente.** Há quatro escolhidas à mão em produção: `trocada` em Q1/2026, Q2/2026 e jul/2026, `estrela` em ago/2026. Molde: `mobile/src/lib/edicao-ia.ts:200-205` — a parcial só carimba quando não há capa.
- Grava pela porta única `edicao_imprimir`, que recalcula as posições.

**Ask First:** subir `PACOTE_VERSAO` (ele não muda aqui — é por ele que a 2.3 julga renovação); qualquer mudança no prompt além da concordância.

**Never:** a parede de capas (2.4); rodar contra produção; reescrever texto já gravado.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| O defeito | `unidade: 'dias'`, valor `1` | `1 dia` — na linha do fato **e** em cada base comparada | N/A |
| Plural normal | `0`, `2`, `31` | `0 dias`, `2 dias`, `31 dias` | N/A |
| Unidade invariável | `km`/`h`/`bpm`, valor `1` | `1 km` — nunca `1 k` | N/A |
| Sem unidade | `unidade: ''` | o número sai sozinho | N/A |
| O delta | `deltaPct` de `1` | segue `1,0%`: `%` não é contagem | N/A |
| `--caderno` num impresso | `--tipo month --inicio 2024-01-01 --caderno rotina` | só `rotina` é reescrito; os outros mantêm texto e assinatura | N/A |
| A capa na parcial | período com capa `trocada` | a linha de `edicoes_capa` fica idêntica, e o relatório diz isso | N/A |
| Em massa | `--massa --caderno rotina` | `reimprimir` só quem tem `rotina` com `prompt_versao` abaixo do atual | 2ª corrida não gasta nada |
| Id inválido | `--caderno rotinas` | recusa **antes** da rede, nomeando os quatro válidos | sai ≠0 |

</frozen-after-approval>

## Code Map

- `prompt.ts:124-137` — `linhaDeFato`, o **único** lugar que cola unidade em número: `u` nasce :126 e é usado no fato :136 e em cada base :130. A concordância entra nos **dois** pontos.
- `prompt.ts:495-508` — o changelog de `PROMPT_VERSAO`, uma entrada por mudança do que o modelo lê; hoje `5`.
- `pacote.ts:820`, `:827` — `unidade: 'dias'` (hábitos e registros, o que alimenta o `rotina`); as **únicas** com plural. `:805`, `:808`, `:810`, `:943`, `:946` são símbolos. Decida se o singular nasce declarado aqui ou derivado no prompt, e escreva o porquê.
- `period/retro.ts:1413` — **o precedente que acerta**: `v > 1 ? 'dias' : 'dia'`.
- `ia/retrospectiva.ts:45` — `VERSAO = PROMPT_VERSAO * 1000 + PACOTE_VERSAO` → `versaoDoDescritor` → `hashDoPedido` (AD-11). Os dois hospedeiros calculam igual: a prova de "idêntica ao telefone" não cai.
- `scripts/revista/imprimir.ts` — `BANDEIRAS` :145-155 (fonte única da leitura e do `--ajuda`); a chamada **sem** `cadernos` :860-869 (ponto de injeção); `carimbarACapa` :729 e o carimbo :932 (de onde a parcial desvia); :1115 `every(c => c.pacoteVersao > …)` — a 2.3 julga por **pacote**, logo o critério do `--massa --caderno` é o `prompt_versao` do caderno pedido.
- `imprimir-sequencia.ts:153-156`, `:186` — `pedidos`, o corte antes da primeira chamada paga, e a garantia de que caderno não pedido **sobrevive**.
- `mobile/src/store/edicao.store.ts` (`imprimirAlvo`, `{ cadernos: [alvo] }`) — o telefone já faz isso; espelhar, não reinventar.

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/ia/prompt.ts` — concordância nos dois pontos de `linhaDeFato`; entrada 6 no changelog; `PROMPT_VERSAO` a 6.
- [x] `packages/shared/src/ia/pacote.ts` — a forma singular das duas unidades de contagem, ou a justificativa da derivação.
- [x] `scripts/revista/imprimir.ts` — `--caderno <id>` validado por `isCadernoId` antes da rede; passar `cadernos`; desviar do carimbo na parcial; classificar por `prompt_versao` no `--massa`.
- [x] `scripts/README.md` — a receita da correção e o que a parcial não faz.
- [x] testes — a matriz acima, no shared (concordância) e na bancada (bandeira, recusa, classificação, capa intocada).

**Acceptance Criteria:**
- Given o pacote do Rotina de janeiro/2024, when o prompt é montado, then nenhuma linha contém `1 dias`, e a de valor 1 contém `1 dia`.
- Given uma edição com capa `trocada`, when `--caderno` a reimprime, then a linha de `edicoes_capa` fica idêntica.
- Given `--massa --caderno rotina` rodado duas vezes, when a segunda roda, then nenhuma chamada paga acontece.

## Spec Change Log

**24/09/2026 — o que a construção descobriu, e que a spec não previa.**

- **`prompt_versao` não chegava ao plano.** O critério do `--massa --caderno` é o
  `prompt_versao` do caderno pedido, e `fetchArquivoDeEdicoes` só trazia `pacote_versao`
  (`ARQUIVO_COLUMNS`, `CadernoNoArquivo`). As duas versões passaram a vir separadas — elas
  respondem a perguntas diferentes, e a guarda de colunas do `edicoes-ia.test.ts` cobre a nova.
- **A guarda da capa não bastava.** `carimbarACapa` só mantinha `motivo: 'trocada'`, e a
  quarta capa escolhida à mão em produção é `estrela` (agosto/2026) — ela teria sido
  recarimbada. A parcial passou a olhar a **existência** da capa, como o telefone faz, e
  `CapaNoRelatorio.mantida` virou `'trocada' | 'parcial' | null` para o relatório dizer qual foi.
- **`--reimprimir` e `--caderno` juntos** seriam uma das duas descartada em silêncio (os
  quatro contra um). Recusados antes da rede, no molde da regra de `--exportar` com o "sim".
- **`--caderno` num período SEM edição** cria uma edição de um caderno, e o arquivo passa a
  contar o período como impresso — a massa nunca mais oferece os outros três. Num período só
  isso **avisa**; no `--massa` é `pular`, porque um caderno não é uma edição para nascer.
- **Caderno pedido que ficou sem dado NÃO é apagado**: a sequência sai em `sem-caderno`
  antes do `buscar`, e a linha antiga fica. Quem tira um caderno da edição é a impressão
  inteira. Medido, e escrito no README — a intuição contrária estava errada.
- **`--exportar` com `--caderno`** escrevia no arquivo o motivo da campanha da 2.3 ("sob o
  pacote 3, anterior à gramática da ausência"), que é falso numa correção de prompt. A prosa
  passou a seguir a corrida que vai rodar.
- Dois achados foram para o `deferred-work` em vez de virar escopo: a ressalva que o modelo
  inventou (a que a spec já mandava diferir) e o **espaço duplo** de `' ms'` e `' bpm'`, que
  `HEALTH_SPECS` declara com espaço à esquerda — pré-existente, e mexer nele é mudança de
  prompt além da concordância (*Ask First*).

**24/09/2026 — a revisão, em 15 consertos.** Nenhum renegociou a intenção; os que mudam
comportamento descrito acima estão marcados.

- **O mesmo defeito sobrevivia noutra linha do mesmo prompt**: a seção *Lacunas*
  (`prompt.ts`) colava `'dias'` cru e escrevia *"1 dias sem dado"* sob o prompt 6. A story
  promete o prompt inteiro, e o prompt inteiro não estava limpo. **E o teste que parecia
  cobrir isso não cobria** — o pacote dele tinha `lacunas: []`, então a seção nem era
  montada e a varredura dava verde sobre um prompt em que a linha não existia.
- **A guarda do singular via um fornecedor de dois.** O outro é `HEALTH_SPECS`, que
  `pacote.ts` repassa cru — e o catálogo de onde ela sai **tem** unidade em palavra
  (`passos`, `andares`). Latente hoje, e a guarda agora cobre os dois pela mesma régua, com
  a não-vácua apontando para `passos`/`andares`. A mecânica também errava: varria a fonte
  **com os comentários**, casando com a própria prosa, e usava `length <= 2` como
  "parece símbolo" — que chamaria ` bpm` de palavra. Virou `semComentario` + lista explícita.
- **O freio da corrida disparava com o diagnóstico errado, e não convergia** (muda
  comportamento, e também o da 2.3): `sem-caderno` e `nada-gravado` contavam como falha.
  Com um caderno só, mudez é corriqueira — e `sem-caderno` custa **zero** e nunca se
  resolve, então três em sequência parariam a campanha para sempre anunciando *"o token que
  venceu, cota, ou a nuvem recusando"*. Os dois viraram `pulada`, com motivo próprio. Os
  testes do freio passaram a usar falha de verdade (período que não se valida) em vez de
  "sem acervo", o que os torna mais fortes, não mais fracos.
- **A conta de chamadas se contradizia em três lugares.** 35 são **períodos**; 37 eram
  **linhas**. O número certo é 35 → 140 (35 × 4), e agora os três dizem isso e dizem de onde
  ele sai. *(A prosa da spec acima carrega o ~37/~105 de origem; não foi editada.)*
- **A coluna nova entrava sem guarda.** `undefined >= 6` é falso, então um `prompt_versao`
  ausente faria **toda** edição parecer atrasada — uma chamada paga por período do arquivo,
  sem nada ter mudado. As duas versões passam por `Number.isInteger` na varredura que já
  conferia `caderno` e `tipo_periodo`. A guarda achou uma fixture real que omitia a coluna.
- **O ensaio calava o efeito irreversível**: o aviso de "vai criar uma edição de um caderno
  só" estava sob `!semGravar`, e é exatamente o que o `--sem-gravar` existe para mostrar.
- Erros de prosa que mandavam o operador ao lugar errado: o `--exportar` sem nada a exportar
  citava `A_REIMPRIMIR`, que na campanha parcial não decide nada; o plano dizia *"uma por
  caderno"* onde é uma por **período**; e o motivo do `pular` citava o limiar em vez da
  versão **da linha** — sobre uma linha à frente do prompt de hoje, escondia justamente isso.
- Dois caminhos ganharam teste e linha no README: `--caderno` **acrescenta** um caderno que
  a edição não tem (o jeito de religar um que reprovou), e `--caderno` **não respeita
  caderno silenciado** no iPhone — o que na massa já estava declarado, mas aqui é pior,
  porque você **nomeia** o caderno silenciado.
- A frase de "semana não entra" existia em literal nos dois critérios do plano; virou uma
  constante, com teste de que a semana é pulada **por esse motivo** também no critério parcial.
- O teste dos símbolos afirmava `1 bpm` e `1 ms`, strings que a produção **não** emite
  (`HEALTH_SPECS` tem espaço à esquerda): dava a impressão de cobrir a saúde e não cobria
  nenhuma. Agora usa as reais, e prende o espaço duplo como o comportamento de hoje.
- O `deferred-work` do espaço duplo dizia "as duas listas" e são **três** (falta a da
  Semana, em `week-highlights-card.component.ts`). E ganhou a medição do dono: **zero**
  ocorrências de `[0-9]  [a-z]` nas 168 linhas de produção — o modelo normaliza o
  espaçamento, o defeito morre no caminho, e o registro existe para ninguém "consertar às
  pressas" achando que há texto sujo gravado.

## Design Notes

**Prompt sobe, pacote não.** O changelog do prompt tem uma entrada por mudança do que o modelo lê, e o texto muda; o pacote carrega os mesmos números. E subir o prompt é **seguro para a 2.3**, que julga renovação por `pacote_versao` — o arquivo não passa a parecer velho.

**A parcial e a capa.** A regra não se inventa aqui: a parcial só carimba quando não há capa, *"porque a foto e a legenda são do período, não do caderno"*. Reescrever uma das quatro capas que o dono escolheu, para corrigir uma palavra, seria trocar um defeito por um dano.

**O que fica de fora.** *"Faltam dados sem o mesmo período do ano anterior…"* aparece **uma vez em 168 linhas** e não existe em template nenhum: é o modelo escorregando. Uma ocorrência não é padrão — vai para o `deferred-work`.

## Verification

**Commands:**
- `pnpm --filter @vitale/shared lint` e `test` — 0 falhas
- `pnpm --filter @vitale/scripts lint` e `test` — 0 falhas
- `cd mobile && pnpm exec tsc --noEmit && pnpm exec jest` — 0 falhas
- `pnpm --filter @vitale/web build` — 0 erros

Os **quatro** workspaces antes de declarar verde: um nome reservado no shared já deixou a barreira vermelha sem nada aparente ter mudado.

**Manual checks:**
- `--tipo month --inicio 2024-01-01 --caderno rotina --sem-gravar` mostra um caderno na tabela, os outros intocados, e a capa como não carimbada.

## Suggested Review Order

**A concordância — a costura única**

- A regra, num lugar só: a unidade olha o número **como escrito** (`'1'`), então `1,0` e `−1` seguem plurais.
  [`prompt.ts:165`](../../packages/shared/src/ia/prompt.ts#L165)

- Os dois pontos que colavam a mesma string em quatro números: o fato e cada base comparada.
  [`prompt.ts:127`](../../packages/shared/src/ia/prompt.ts#L127)

- A terceira costura, achada na revisão: as Lacunas escreviam `1 dias sem dado` sob a versão 6.
  [`prompt.ts:614`](../../packages/shared/src/ia/prompt.ts#L614)

- A tabela do singular, declarada onde o plural é declarado — só unidade em palavra entra.
  [`pacote.ts:200`](../../packages/shared/src/ia/pacote.ts#L200)

**O script — o que decide o gasto**

- O prompt de hoje sai do descritor que o script já entrega à sequência, não de um segundo caminho.
  [`imprimir.ts:179`](../../scripts/revista/imprimir.ts#L179)

- O critério do `--massa --caderno`, com "em dia" e "à frente" separados.
  [`imprimir.ts:1308`](../../scripts/revista/imprimir.ts#L1308)

- A bandeira, conferida antes de qualquer rede.
  [`imprimir.ts:286`](../../scripts/revista/imprimir.ts#L286)

- A capa na parcial: qualquer capa existente fica, e o `motivo` nem é consultado.
  [`imprimir.ts:845`](../../scripts/revista/imprimir.ts#L845)

**As redes**

- A coluna nova entra validada — `undefined >= 6` é falso, e faria pagar uma chamada por período.
  [`edicoes-ia.ts:310`](../../packages/shared/src/data/edicoes-ia.ts#L310)

- A guarda que amarra a tabela do singular aos **dois** fornecedores, sem ler comentário como código.
  [`retrospectiva.test.ts:278`](../../packages/shared/src/ia/retrospectiva.test.ts#L278)

- A catraca da bancada, alargada em um nome, com o porquê escrito.
  [`architecture.test.ts:3770`](../../packages/shared/src/architecture.test.ts#L3770)
