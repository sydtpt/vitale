# A revista — o corte da v1

> Resultado da mesa de 07/09/2026 sobre o
> [brief](revista-retrospectiva-brief.md). Responde os seis itens da §8 do brief.
> Companheiro obrigatório: [pré-registro da lua](../../docs/specs/revista-retrospectiva/pre-registro-lua.md).
>
> **Isto não é spec.** É a decisão de escopo que a spec vai formalizar. Onde este
> documento e a spec divergirem depois, a spec vale.

---

## 0. O corte maior: são dois épicos

| | |
|---|---|
| **Épico 1 — a revista** | só dado **que já está no banco**, mais sol e lua. Retroativo a 22/05/2023. Não depende de o usuário mudar nada |
| **Épico 2 — a captura** | presença, clima, humor ao longo do dia, dor, viagem, peso recorrente. Só rende análise a partir de **mai–jun/2027** (§4 do brief) |

Os dois não compartilham cronograma nem risco, e um não bloqueia o outro. Juntá-los
produziria um épico que não termina. **Este documento é só o épico 1.**

---

## 1. Os cadernos

Quatro cadernos e uma capa. Três coisas que pareciam cadernos **não são** — e o
padrão vale como regra: *material que atravessa cadernos não é caderno.*

| | O que leva | Fonte |
|---|---|---|
| **Capa** | uma foto (`coverOf`, já implementado) + a manchete escolhida entre os cadernos + legenda de parada (`Ittre · km 31,1 · 12:38`) | `activity_photos` |
| **Sono** | relógios deitou/apagou/acordou · duração mediana · continuidade · regularidade e jetlag social · as 5 dimensões da Saúde do sono · nota × medição · gatilhos das duas colunas · extremos com data · **a página da lua** | `SleepRetro`, `sleepTriggers` |
| **Movimento** | km · tempo · esforço duro · zonas de FC (418) · recordes (554) · elevação (275) · **cidades e piso como fatos de texto** · lápides de VO₂max e anéis | `fitness`, `sports`, `best_efforts`, `activity_routes`, `CityMark` |
| **Coração** | FC de repouso · VFC · os 179 dias de série intradiária (curva do dia, Noites, dia × hora) · lápides de respiração e SpO₂ | `health_daily`, `health_series` |
| **Rotina** | aderência de tarefas (551 ocorrências) · hábitos (336, 4 hábitos) · registros (96, 6 registros) · notas do dia (80) | `todo_occurrences`, `habit_logs`, `registro_logs`, `daily_ratings` |
| **Camada em todos** | horas de luz do dia + delta contra o mesmo período do ano anterior | função pura de data e coordenada |

### O que não é caderno, e por quê

- **Geral → capa.** O `lede` nunca foi caderno; está `fixed: true` no
  `retro-blocks.ts`. Ele **escolhe** um fato em vez de recitar sete.
- **Sol → camada.** Não tem página; muda o que as outras páginas significam.
- **Onde → capa + fatos de Movimento.** Fotos só existem em 2026; cidades cobrem
  31% das atividades e piso 138 rotas. São **atributo de atividade**, não assunto.
- **Corpo → Coração.** Das 14 métricas de `health_daily`, 4 são cadáveres, 8 nunca
  chegaram e peso tem 1 medida. Sono é do caderno Sono; passos e andares são
  subproduto de Movimento. O que sobra é o coração — e é um assunto, não uma sobra.

### Rotina fica (decisão do dono, 07/09)

O PM defendeu três cadernos: v1 é um experimento e um experimento com muitas
variáveis não é diagnosticável. Perdeu. O argumento que prevaleceu: os outros três
cadernos contam **o que aconteceu com o corpo**; nenhum conta **o que ele decidiu**.
Rotina entra com trajetória apenas — sem base anual até 2027.

---

## 2. As bases de comparação

**Três bases nomeadas + trajetória.** Não quatro bases.

| id | O que é | Existe quando |
|---|---|---|
| **B1** | o período anterior | sempre |
| **B2** | o mesmo período do ano anterior | conforme a fonte (§4 do brief) |
| **B3** | **a normal dele para este período** — média dos mesmos meses em todos os anos | ≥ 2 anos da fonte |
| **Trajetória** | `direção: sobe \| cai \| oscila`, `períodos: n`, `desde: rótulo` | ≥ 3 períodos consecutivos |

**Por que trajetória em vez de uma quarta base.** Uma base nova põe **N números**
no alfabeto da verificação; a trajetória põe **um inteiro**. Pelo mesmo preço ela
entrega 3, 6 ou 12 períodos de direção. E — o achado que decidiu — **trajetória é
a única comparação que o caderno Rotina consegue fazer antes de 2027**, porque só
precisa de períodos consecutivos.

### A regra que sustenta as três bases

**O texto é obrigado a nomear a base.** A verificação deixa de perguntar *"esse
número existe?"* e passa a perguntar *"esse número existe **como B2**, e a frase
diz **B2**?"*. Três bases sem nome é um alfabeto três vezes maior; três bases com
nome é uma **gramática** — o número tem que bater e a preposição junto.

**Quinta regra no `verificar.ts`: base citada sem nome reprova.** Reprovação, não
aviso.

### E ela conserta um bug que já está em produção

Medido nesta sessão sobre o pacote real de agosto (`ia/pacote.test.ts`):

```
módulos 6 · FatoNumero 20 · correlações 0 · eventos 0 · lacunas 0
valoresDoPacote: 71     numerosDoPacote: 80

inteiros entre 0 e 100 no alfabeto: 16
  0 2 4 6 7 8 9 11 17 21 29 31 39 49 57 80
```

**Um inteiro alucinado entre 0 e 100 passa na conferência 16% das vezes — hoje,
com uma base só.** Com três bases sem nome, perto de 50%. Números com uma casa
decimal passam a 3,6%: o risco é **inteiro pequeno**, que é o formato de "21
atividades" e "7 noites".

E o alfabeto de 71 é com correlações, eventos e lacunas **vazios**. Quando o balde
da §3.2 entrar, o crescimento vem dos cadernos, não das bases — que é o argumento
decisivo para **um pacote por caderno**: seis pacotes de 40 são muito mais seguros
que um de 240, e o caderno de Sono nunca precisa saber quantos quilômetros ele
pedalou.

---

## 2b. A forma da revista

### O sumário — existe, e não é índice

Quatro linhas, uma por caderno, cada uma com **a chamada daquele caderno** — não o
nome. A chamada é a manchete que o próprio caderno já escreveu, mostrada uma
segunda vez. Custo de superfície: **zero**; é a mesma frase, já aprovada pelas
cinco regras de verificação.

Não diz o que tem dentro; diz **por que entrar**. E como a ordem é variável (abaixo),
cada linha é **tocável** — o sumário é o mapa, e mapa que não se toca é pôster.

### Três formas, não uma por `PeriodKind`

| Forma | Períodos | O que é |
|---|---|---|
| **Postal** | semana | uma tela. Sem sumário. Capa pequena + 3 fatos. **Só trajetória** — semana contra semana é ruído. **Sem edição gravada**: calcula na hora, como a retro faz hoje |
| **Edição** | mês, trimestre | capa · sumário · quatro cadernos na ordem ranqueada. Três bases quando existem. É onde a v1 vive ou morre. No trimestre, a **camada de luz em destaque** |
| **Anuário** | ano | forma diferente, não a edição inflada. Abre **serial**: o ano desenhado mês a mês antes de qualquer texto (`yearSeries`, que já existe e já é exclusivo de `year` — é um formato, não um gráfico). Depois os cadernos, cada um com **extremos datados** (`SleepExtremes`) |

### A ordem do miolo é ranqueada — decisão do dono, 07/09

A mesa recomendou o contrário (miolo fixo pelo `retro_prefs`, capa variável, pelo
argumento de que numa revista o miolo é fixo para você **achar** e a capa muda para
você **entrar**). **O dono decidiu ranquear o miolo e aposentar a ordem do
`retro_prefs`.** Fica registrado assim.

```
ordenarCadernos(pacotes) → CadernoId[]      // pura, determinística
```

1. **Afastamento** — o maior `|deltaPct|` entre as métricas do caderno, contra a
   base nomeada daquela métrica.
2. **Portão** — a métrica que forneceu o afastamento precisa de
   `cobertura.comparavel === true` **e** n suficiente. Sem isso o caderno não
   concorre à liderança (entra na ordem, atrás).
3. **Confiança** — peso da base disponível: B2/B3 > B1 > só trajetória. É o que
   impede Rotina de liderar por ser novo e volátil: **amostra pequena varia mais**,
   e efeito grande com amostra pequena é ruído com aparência de manchete.
4. **Desempate** — ordem do catálogo. Fixa, para a função nunca ser ambígua.
5. **Lápide** — posição 1 forçada **só** se a última medida da métrica cair dentro
   deste período.
6. **Vazio** — fora da lista.

**Consequência que a decisão arrasta, e não é opcional:** a ordem sai do dado, mas
a **função** é código. Ajustar o peso da confiança em novembro faria agosto de 2026
**se reordenar sozinho** — reescrita silenciosa de período fechado, que a §2 do
brief proíbe. Então **a ordem é parte da edição**, gravada uma vez na impressão e
nunca recalculada, ao lado de provedor, modelo, `prompt_versao` e `PACOTE_VERSAO`.

Não como array: com a chave por caderno, **cada caderno é uma linha**, e um array
com a ordem do conjunto guardado em cada parte é uma chance de divergir por linha.
A ordem é uma **coluna** — `posicao smallint`, mais
`unique (user_id, tipo_periodo, inicio, fim, posicao)`, que faz o banco cobrar a
invariante em vez da revisão de código. Nem array, nem tabela cabeçalho.

Isso preserva a **prova de gráfica** que o `retro_prefs` inventou — ela deixa de
congelar por usuário depois de 60 dias e passa a congelar **por edição, na
impressão**. Mesma ideia, mais forte.

**Sai do código:** `RetroPrefs.order` · `moveBlock` · `layoutEditable` ·
`proofStartedOn` · `PROOF_DAYS` · `DEATH_DAYS` · `deadBlocks`.
**Fica:** `hidden` — esconder é outro poder ("Rotina nunca"), e é a única forma de o
leitor discordar da revista; o ranqueamento não substitui, porque um caderno
indesejado lidera justamente no mês em que varia mais.
**Sem migration:** `resolveRetroPrefs` é defensivo por desenho (chave ausente herda
default), então a chave `order` passa a ser **ignorada na resolução** e o jsonb em
produção fica como está.

**Cabeçalho de caderno fica forte** — cor de módulo por `moduleOf()`, nome grande.
Em revista de ordem fixa você reconhece pela posição; em ordem variável, pela cara.

### O arquivo — parede de capas

Não é seletor de data. É uma parede de imagens com o período por baixo: entra-se por
**reconhecer**, não por escolher. A prática de *personal informatics* aponta para
isso — o que faz alguém reabrir dado antigo é **memória e identidade**, não
descoberta; ninguém reabre agosto para conferir 435 km.

**As fotos são só de 2026** — três quartos do arquivo não tem imagem. Então **a capa
sem foto é um desenho do próprio período**: o traçado da rota mais longa
(`activity_routes`, 275), ou a grade diária. E isso fica **melhor** do que a parede
toda de foto: 2023 parece 2023, 2026 parece 2026, e a textura das capas registra
quando ele passou a fotografar. Custo de dado novo: zero.

Períodos sem atividade nem foto ficam com a grade diária. **Aceito pelo dono.**

### A foto informa, não ilustra

A legenda é um fato de três campos: `Ittre · km 31,1 · 12:38`. Sem parada, sem
quilômetro e sem hora seria ilustração. É a única entrada da revista que diz **onde**
o período aconteceu — e a razão pela qual o caderno Onde não precisou existir.

### A página da lua — moldura fixa, veredito variável

Última página do caderno Sono, depois de tudo que foi medido sem hipótese: o
contexto estabelece o registro de voz antes de a lua aparecer.

```
A LUA                                    2ª execução

Janela testada    5 noites antes da cheia
Desfecho          hora de apagar
Noites            49 dentro · 241 fora · 11 ciclos

[ o resultado ]

Próxima leitura   em 100 noites  ·  faltam 62
```

**O veredito muda; a moldura não.** É a moldura que informa que isto é um teste com
regras fixadas antes, e não uma observação que alguém teve. "Inconclusivo" imprime
*"Ainda não há noites suficientes para responder. Faltam cerca de 106."* — mesmo
corpo de letra, sem cinza, sem itálico apologético, sem ícone de aviso.
**Tipografia de caderno de laboratório.** O contador de execuções no canto é o que
impede a página de virar mística: uma coisa que se conta não se adivinha.

---

## 3. Captura nova: nenhuma na v1

Tudo da §3.4 e §3.5 do brief vai para o **épico 2** ou morre:

- **Fora por falta de fonte, não de código:** pressão, IMC, gordura, massa magra,
  cintura, água, calorias/macros/proteína, peso recorrente. `meals` (0),
  `transactions` (0) e `planned_workouts` (0) — o QuickAdd existe, funciona, e
  nunca foi usado. Não falta software.
- **Épico 2:** presença (proposta já fechada em 06/09), clima e temperatura da
  pedalada, humor ao longo do dia, café e álcool com hora, dor e lesão, viagem e
  fuso, dias de escritório.

---

## 4. O destino do dado da §3.2

Nada fica órfão:

| Dado | Vai para |
|---|---|
| 1.210 fotos | **capa** da edição |
| 174 cidades · 138 pisos | fatos de texto em **Movimento** |
| 179 dias de FC intradiária | **Coração** |
| 554 recordes · 418 zonas | **Movimento** |
| o sono inteiro (SRI, jetlag, despertares, 5 dimensões, gatilhos) | **Sono** |
| 551 ocorrências de tarefa | **Rotina** |
| correlações do `triggerImpact` | **Sono** (gatilhos) — e entram no pacote marcadas com `dentroDoPortao` |

---

## 5. Sol e lua

### Sol — camada, e pré-requisito

Entra no pacote de **todos** os cadernos, como a cobertura já entra: média de horas
de luz do período + delta contra o mesmo período do ano anterior.

**Derivado na leitura, nunca gravado** — mesmo precedente do preço do hábito
(€/unidade), o que o torna retroativo até 22/05/2023 de graça. Efeméride é função
pura de data e coordenada.

**Falta uma coordenada:** rotas têm lat/long; dias sem atividade não têm nenhuma.
O lugar do usuário passa a ser **configuração** (~50,8° N para a Bélgica).

**O `season` não muda.** A tela diz "estação" e calcula trimestre civil — e a
correção não é mover fronteira (que quebraria a edição de `season` já gravada em
produção). Estação **não é período, é contexto**: o trimestre fica como está e a
luz do dia entra como fato. O Q1 passa a **carregar** o inverno em vez de fingir
que é o inverno. Zero migration, zero errata.

**Sem isso a revista mente por omissão:** o modelo vê a quilometragem cair em
novembro e escreve "sua quilometragem caiu", quando ela cai todo novembro há três
anos. A luz do dia na Bélgica vai de ~8 h a ~16 h 30 — **dobra**.

### Lua — página dentro do Sono, sob pré-registro

O documento está escrito e é imutável:
[`docs/specs/revista-retrospectiva/pre-registro-lua.md`](../../docs/specs/revista-retrospectiva/pre-registro-lua.md)

```
sha256  d09365de54bb6bbd6fa8d99af9d1f26cddaebc3492029a63d6b1b6e4f6759664
```

Resumo do compromisso: desfecho primário **um só** (hora de apagar) · exposição =
as **5 noites que antecedem a cheia** · direção **atraso**, unilateral · covariável
**obrigatória** de horas de luz · limiar prático **15 min** · **três** vereditos
publicáveis na mesma página (*achado* · *nenhum padrão* · *inconclusivo*) ·
reexecução a cada **+100 noites**, com contador visível.

**O sol é o controle da lua.** As 290 noites cobrem 502 dias — 58%, com o verão de
2025 parcialmente ausente. A janela lunar anda pelo calendário; sem horas de luz
como covariável, um achado lunar é um achado sazonal com outro nome. Isso torna a
§5.1 **dependência dura** da §5.2.

Pelo cálculo de poder feito antes de olhar, **"inconclusivo" é o resultado mais
provável desta primeira execução** — e isso está aceito por escrito.

---

## 6. O que NÃO entra na v1 — dito em voz alta

- **Caderno de lua.** Vira página dentro do Sono. Caderno pressupõe conteúdo
  recorrente; este teste roda a cada 100 noites. Pressão para ter o que dizer todo
  mês é o mecanismo que produz o problema da gaveta.
- **Caderno Onde.** Dissolvido em capa + fatos de Movimento.
- **Caderno Corpo como estava.** Vira Coração, mais estreito e honesto.
- **Base anual e normal sazonal para Rotina.** Só trajetória até mai/2027.
- **Toda captura nova.** Épico 2.
- **Web, PDF e e-mail.** A edição é **texto gravado**; essas três são
  **renderização**, não geração. Ficam para depois sem custo de arquitetura.
- **Backfill de semanas.** Sob demanda.
- **Secundários da lua** (duração, latência, despertares) como manchete. Existem
  marcados como exploratórios.

---

## 7. Backfill — medido, não estimado

Períodos fechados por caderno, respeitando a data em que cada fonte começa:

```
caderno                     sem  mês  tri  ano  total
Movimento (desde 22/05/23)  172   39   12    2    225
Onde → dissolvido             -    -    -    -      -
Coração (desde 24/03/25)     76   17    5    0     98
Sono (desde 23/04/25)        71   16    4    0     91
Rotina (desde 01/05/26)      18    4    0    0     22
                                                  ───
                                                  436
```

A **US$ 0,011/chamada** (preço medido em agosto, não estimado): **US$ 4,80** com
semanas; **~US$ 1,20** só mês/trimestre/ano. Há US$ 25 carregados. **Volume nunca
foi o problema; desenho é.**

**Decisão:** backfill em massa de mês, trimestre e ano. Semanas sob demanda.

### Onde roda

**Não precisa ser no celular.** O núcleo é puro — `montarPacote`, `montarPrompt` e
`verificar` não fazem rede nem importam SDK, e a barreira do `architecture.test.ts`
morde quem tentar. O mesmo código roda num script `tsx` na máquina. Quem fala com o
modelo é a edge function `ia-narrar`, e ela atende os dois igual.
`fetchEdicao`/`upsertEdicao` já vivem em `shared/src/data/`.

Três condições, nenhuma negociável:

1. **A ordem:** verifica **antes** de gravar.
2. **A assinatura idêntica:** provedor · modelo · `prompt_versao` · `PACOTE_VERSAO`
   · `agg_version_no_momento`. Sem isso, 436 edições que não se comparam com as
   futuras nem aceitam errata.
3. **Paginação.** O **PostgREST corta em 1000 linhas sem erro** e `health_daily`
   tem 4.385. Sem `range` + `order`, o backfill roda inteiro, grava tudo, e um
   terço das edições narra um subconjunto silencioso do histórico — invisível em
   teste, visível dois meses depois quando um número não fecha.

**Teste obrigatório:** mesmo pacote, dois hospedeiros, mesmo texto verificado.

---

## 8. Ausência é fato declarado

Regra formalizada, extensão da `Cobertura` que já existe:

- **Caderno vazio** (não aconteceu nada) → **some**. Sem espaço reservado, sem
  "nenhuma atividade registrada". Revista não imprime página em branco.
- **Caderno cego** (o sensor morreu e o app não sabe) → **aparece como lápide**:
  nome da métrica, última data, ponto. Sem "verifique suas conexões" — isso é
  conselho, e a lei da casa proíbe. `LacunaFato` já existe no pacote e nunca foi
  preenchido.
- **A lápide vive no pé do caderno que possuía a métrica** — sempre, como
  história. Ela **vira capa uma vez só**: na edição do período **em que a métrica
  morreu**. Agosto/2026 é o mês em que os anéis pararam, e isso é a notícia daquele
  mês; setembro não é. Condição testável: *a última medida cai dentro deste
  período.*
  Sem essa regra a lápide lideraria **toda** edição para sempre — sensor morto não
  ressuscita sozinho —, e depois da terceira o leitor para de ver. Obituário
  permanente na capa é o oposto de informar.
- **O alerta operacional sai da revista.** "Você está cego há 60 dias" pertence a
  Conexões ou a uma notificação, com o tempo do agora. A edição **congela**: em 2030
  a de agosto/2026 ainda dirá que a respiração parou — o que como **história** está
  certo e como **alerta** é ruído de quatro anos atrás. São dois objetos com dois
  tempos de vida.
- **Base inexistente** → declarada no pacote. O modelo **não pode descobrir**
  sozinho que não há ano anterior; ele tem que ser **informado** de que não há.

Sem a lápide, a revista narra o silêncio como melhora: *"sua respiração está
estável"* quando não há respiração há dois meses.

---

## 9. Mudanças mecânicas que a v1 exige

1. **Migration:** chave de `edicoes_ia` ganha `caderno` —
   `(user_id, tipo_periodo, inicio, fim, caderno)`, com `CHECK` listando só os
   quatro que o app escreve. Mais `posicao smallint` e
   `unique (user_id, tipo_periodo, inicio, fim, posicao)`. `PACOTE_VERSAO`,
   `prompt_versao`, provedor, modelo e `agg_version_no_momento` seguem **por
   linha**, então o caderno de Sono ganha errata sem tocar no de Movimento.
   **A capa não ganha coluna:** a manchete é a do caderno em `posicao = 1` e a foto
   sai de `coverOf`, que já é pura. A edição inteira são quatro linhas.
   **As 6 edições hoje em produção** (`prompt_versao 2` · `pacote_versao 1`) não
   viram errata — nada que elas dizem ficou falso; elas ficam **antigas**. O texto é
   exportado para um `.md` versionado em `docs/` com a assinatura de cada uma (o que
   dá **diff** entre prompt v2 e v3, coisa que a tabela nunca daria) e as linhas são
   removidas — porque linha viva que nenhum caminho de leitura toca não é história,
   é dado apodrecendo, e não dá para escrever golden set para uma forma que o app
   não produz mais.
2. **`FatoNumero` muda de forma:** `atual` + `bases[]` identificadas, no lugar de
   `atual`/`anterior`/`delta`. Atravessa `numerosDoPacote`, `valoresDoPacote` e o
   verificador.
3. **`FatoTendencia`** novo: direção, períodos, desde.
4. **`FatoTexto`** novo: cidades, piso, lápides.
5. **Quinta regra no `verificar.ts`:** base citada sem nome reprova.
6. **Constante `PRE_REGISTRO_LUA_SHA`** no código + catraca no
   `architecture.test.ts`: hash divergente com execução já gravada quebra o build.
7. **Coordenada do usuário** em configuração, para a efeméride.
8. **`ordenarCadernos(pacotes) → CadernoId[]`** — função pura, e coluna
   `ordem_cadernos text[]` na linha da edição (a ordem congela na impressão).
9. **Aposentar `RetroPrefs.order`** e o maquinário da prova de gráfica
   (`moveBlock`, `layoutEditable`, `proofStartedOn`, `PROOF_DAYS`, `DEATH_DAYS`,
   `deadBlocks`), mantendo `hidden`. Sem migration — a chave `order` passa a ser
   ignorada em `resolveRetroPrefs`.
10. **Sumário tocável** + cabeçalho de caderno com cor de módulo (`moduleOf()`).

---

## 10. Aberto

- **ADR 0045** — *"resultado negativo publica com o mesmo destaque do positivo"* é
  lei nova na §2 do brief e merece ADR própria. Atenção: a numeração de ADR já
  colidiu duas vezes entre branches neste repositório.
- **As quatro métricas mortas da §3.3** — respiração (10/07), VO₂max (14/07), SpO₂
  (16/07), anéis (17/08). Investigação **independente** desta discussão: é cano
  quebrado ou hábito que mudou? Uma revista construída sobre um sensor que parou em
  julho narra o silêncio como se fosse fato.
- **O desvio-padrão da hora de apagar** — o único número que o pré-registro
  autoriza consultar antes de rodar o teste, e o que decide se ele tem poder.
