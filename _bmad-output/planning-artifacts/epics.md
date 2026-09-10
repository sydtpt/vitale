---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
inputDocuments:
  - docs/specs/revista-retrospectiva/spec.md
  - docs/specs/revista-retrospectiva/cadernos.md
  - docs/specs/revista-retrospectiva/bases-e-ranqueamento.md
  - docs/specs/revista-retrospectiva/mudancas-mecanicas.md
  - docs/specs/revista-retrospectiva/pre-registro-lua.md
  - docs/specs/revista-retrospectiva/correcao-pre-registro-lua.md
  - _bmad-output/planning-artifacts/architecture/architecture-Orbe-revista-2026-09-08/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-revista-retrospectiva-2026-09-07/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-revista-retrospectiva-2026-09-07/EXPERIENCE.md
  - _bmad-output/planning-artifacts/architecture/architecture-Orbe-ia-no-aparelho-2026-09-10/ARCHITECTURE-SPINE.md
  - docs/decisions/0047-a-porta-do-motor-e-uma-so-e-a-ponte-do-aparelho-e-nossa.md
  - docs/decisions/0048-o-motor-e-escolhido-por-aparelho-e-a-lista-da-nuvem-e-do-servidor.md
  - docs/decisions/0049-o-motor-escreve-palavras-e-o-codigo-escreve-numeros.md
  - docs/specs/sono/spec.md
  - docs/specs/ia-analitica/spec.md
  - _bmad-output/planning-artifacts/sprint-change-proposal-2026-09-10.md
---

# Orbe — Epic Breakdown

## Overview

Decomposição da frente **A revista da Retrospectiva** (épico 1: só dado já gravado,
mais sol e lua, retroativo a 22/05/2023) em stories implementáveis.

**Esta frente não tem PRD.** O contrato é o kernel do `bmad-spec`
([`spec.md`](../../docs/specs/revista-retrospectiva/spec.md)), que é mais estrito:
capacidades com `success` testável, restrições que vinculam decisões, e não-objetivos
explícitos. Por isso os **FRs derivam das 14 capacidades** (`CAP-N` → `FR-N`, um a um,
para que a rastreabilidade contra o contrato seja exata) e os **NFRs das 19 restrições**.
`FR15` é a única exceção: não vem de capacidade nenhuma.

**Desde 10/09/2026 este arquivo carrega uma segunda frente.** O correct-course daquele dia
([proposta](sprint-change-proposal-2026-09-10.md)) pôs **os motores de IA** na sprint da revista
como **Épico 5**, porque a story 1.10 passou a depender deles: a impressão da revista virou cliente
do orquestrador (AD-13 da
[espinha dos motores](architecture/architecture-Orbe-ia-no-aparelho-2026-09-10/ARCHITECTURE-SPINE.md)).
O contrato do Épico 5 não é o `spec.md` da revista — é a CAP-13 do spec de Sono, o §4c do spec
`ia-analitica` e as ADRs 0047–0049. Por isso os requisitos dele têm inventário próprio, com IDs
prefixados (`M-`), e ficam fora da convenção `FR-N = CAP-N` da revista: a CAP-13 de lá não é a
CAP-13 daqui.

## Requirements Inventory

### Functional Requirements

- **FR1** *(CAP-1)*: Um período fechado produz vários textos independentes, cada um com
  sua assinatura, sua verificação e sua posição, em vez de um texto único. Marcar errata
  num caderno não altera os outros.
- **FR2** *(CAP-2)*: O leitor lê Sono, Movimento, Coração e Rotina como seções distintas,
  cada uma com o dado que lhe pertence, e nenhum dado do balde fica órfão.
- **FR3** *(CAP-3)*: Cada caderno é narrado a partir de um pacote restrito ao seu próprio
  assunto — o pacote de Sono não contém número de ciclismo.
- **FR4** *(CAP-4)*: Cada número pode ser comparado com três bases nomeadas (B1 período
  anterior, B2 mesmo período do ano anterior, B3 a normal do usuário), e a direção ao
  longo de vários períodos é um fato à parte.
- **FR5** *(CAP-5)*: Um número citado sem dizer contra o quê não pode virar edição — a
  quinta regra da verificação reprova base citada sem nome.
- **FR6** *(CAP-6)*: Todo pacote carrega as horas de luz do período e o delta contra o
  mesmo período do ano anterior, derivadas na leitura, para qualquer data desde
  22/05/2023.
- **FR7** *(CAP-7)*: O caderno com a história do período lidera a edição; a ordem é
  determinística, congela na impressão, e só um ato explícito de reimprimir a reordena.
- **FR8** *(CAP-8)*: O sumário mostra a chamada de cada caderno — não o nome —, cada linha
  leva ao seu caderno, e a chamada é extraída mecanicamente do texto que já existe.
- **FR9** *(CAP-9)*: Semana, mês/trimestre e ano são três objetos distintos — postal,
  edição e anuário —, não a mesma forma em profundidades diferentes.
- **FR10** *(CAP-10)*: Cada edição tem uma imagem que diz onde o período aconteceu,
  inclusive nos períodos anteriores às fotos, congelada na impressão; o arquivo é
  navegável como parede de capas.
- **FR11** *(CAP-11)*: A revista sabe e diz quando ficou cega — caderno vazio some,
  métrica morta vira lápide, base inexistente entra no pacote como fato, e a lápide vence
  o vazio.
- **FR12** *(CAP-12)*: O teste lunar roda sob protocolo fixado antes de olhar o dado, e os
  três vereditos publicam com o mesmo destaque, com moldura fixa e contador de execuções.
- **FR13** *(CAP-13)*: As edições de todos os períodos fechados desde 22/05/2023 podem ser
  impressas em massa por um hospedeiro que não é o aplicativo, com o mesmo resultado.
- **FR14** *(CAP-14)*: O leitor pode silenciar um caderno, e ele não aparece nem quando o
  ranqueamento o colocaria em primeiro.
- **FR15** *(sem capacidade — defeito de produção, `AD-16`)*: Um bump de `AGG_VERSION`
  marca errata em todas as edições. **Hoje não marca nenhuma**: a constante é privada a um
  módulo do mobile, a edição grava `null`, e a comparação devolve `false` para nulo. O
  conserto **precede o backfill**, senão o arquivo inteiro nasce inelegível a errata.

### NonFunctional Requirements

- **NFR1**: É um jornal — informa, não aconselha. Não recomenda, não motiva, não
  parabeniza.
- **NFR2**: Estatística acha; o modelo prioriza e narra. Nunca calcula, nunca deriva
  número que não recebeu pronto, nunca afirma causa.
- **NFR3**: Todo número citado existe no pacote, por verificação mecânica e numérica
  exata.
- **NFR4**: Cobertura desigual obriga ressalva no texto.
- **NFR5**: Período fechado congela. Dado que muda vira errata, não reescrita; `all` não
  tem edição e o CHECK do banco recusa.
- **NFR6**: Provedor e modelo são configuração (ADR 0040). Núcleo puro, sem SDK e sem
  rede, com barreira — inclusive contra nome de fornecedor em literal de string.
- **NFR7**: A camada narra, nunca decide. Nenhuma ação automática a partir de inferência
  de saúde.
- **NFR8**: Mobile-first. Se não está no celular, ele não vê.
- **NFR9**: A revista nunca gera sozinha. Abrir só lê; imprimir é ato do usuário.
- **NFR10**: O sol é pré-requisito da lua. Sem horas de luz como covariável o teste lunar
  não roda.
- **NFR11**: O pré-registro da lua é imutável, sua sha256 é constante no código, e hash
  divergente quebra o build. Reexecução a cada +100 noites, com contador visível.
- **NFR12**: A correção do pré-registro é documento novo, nunca edição do original, e a
  barreira pina a cadeia inteira.
- **NFR13**: Um bump de `AGG_VERSION` marca errata em todas as edições — custo aceito e
  declarado.
- **NFR14**: Sol e lua são derivados na leitura, nunca gravados.
- **NFR15**: `season` continua trimestre civil.
- **NFR16**: A ordem é coluna, não array, e congela na última impressão; reimpressão
  parcial recalcula o conjunto em transação.
- **NFR17**: Mais números autorizados enfraquecem a verificação — quem acrescentar número
  tem que dizer como compensa. Medido: inteiro pequeno passa 16% das vezes.
- **NFR18**: O backfill pagina. O PostgREST corta em 1000 linhas sem erro.
- **NFR19**: Verifica antes de gravar, sempre, em qualquer hospedeiro.

### Additional Requirements

Da espinha de arquitetura. **Nenhum starter template** — é brownfield sobre um monorepo
pnpm de três workspaces, e a espinha ratifica as convenções existentes em vez de as
substituir. Cada item cita o `AD` que o governa.

- **AD-1** — A edição vive em rota nova `/revista/[tipo]/[inicio]`; `/retrospectiva` fica
  intacta (13 blocos, seletor, painel Diagramação). O `EdicaoCard` é a única porta. A rota
  **só lê**; a parede desenha só as capas que existem. `all` e período em curso não têm
  rota de revista.
- **AD-2** — `CadernoId` é vocabulário de dono único no núcleo; `RetroBlockId` não é
  alargado; silenciar caderno é chave nova no mesmo jsonb, sem migration.
- **AD-3** — A capa carimbada mora em `edicoes_capa`, chave por edição. Carimbada na
  primeira impressão e na reimpressão inteira; nunca na parcial. Guarda valores
  resolvidos, natureza de três valores (`foto`/`tracado`/`grade`), e a legenda formatada.
- **AD-4** — A ordem é recalculada por função no banco, numa chamada: grava o texto só dos
  regenerados, ajusta as posições e apaga a linha do caderno que saiu. O `unique` da
  posição nasce `deferrable initially deferred`. Posições contíguas de 1 a N.
- **AD-5** — `lua_execucoes`, chave surrogate, uma linha por execução, com hash, janela,
  veredito, contagens, noites faltantes e portão reprovado. Nulo é "não medido".
- **AD-6** — O teste lunar mora em `sleep/lua.ts`; `astro/moon.ts` ganha o instante das
  fases (Meeus 49). Janela `[cheia − 5 dias, cheia)`, aberta à direita. A noite é
  representada por instante fixo do entardecer, nunca pelo desfecho medido.
- **AD-7** — Barreira do hash incondicional e offline, pinando a cadeia inteira
  (pré-registro + cada documento de correção).
- **AD-8** — `onAccent` entra em `RoleTokens` e `ModuleTokens`; barreira com duas
  asserções (argmax, e piso de 3,0 por ser texto grande). Sem alias plano nem variável CSS.
- **AD-9** — Foco de acessibilidade via `sendAccessibilityEvent(ref, 'focus')`, em hook
  genérico em `mobile/src/hooks/`. Nunca no núcleo.
- **AD-10** — Coordenada de casa constante no núcleo, nunca `deviceCoords()`. As horas de
  luz entram no pacote com uma casa decimal, como compensação medida do NFR17.
- **AD-11** — A chamada sai de uma função pura única; "primeiro ponto final" não é
  `indexOf('.')` (milhar em pt-BR usa ponto). Sem texto, a chamada não existe.
- **AD-12** — O backfill é quarto workspace declarado em `pnpm-workspace.yaml`, e a
  barreira do `.from()` é estendida para cobri-lo no mesmo commit.
- **AD-13** — A sequência da impressão sobe para o núcleo; `upsertEdicao` passa a ser
  importável só pela sequência, por barreira. *Apertada em 10/09* pela AD-13 dos motores: a
  sequência é cliente do orquestrador, e as portas injetadas são duas, `buscar` e `gravar`.
- **AD-14** — O backfill autentica como o usuário; chave de serviço é proibida.
- **AD-15** — A migração e o build que a lê são uma operação só. Dentro da migração, as 7
  edições saem antes das colunas `not null` nascerem.
- **AD-16** — `AGG_VERSION` sobe para o núcleo com dono único e passa a ser sempre gravada.
- **AD-17** — A impressão carimba a chave da métrica que liderou; a tira do anuário lê o
  carimbo e nunca recalcula.
- **AD-18** — O véu da capa se aprofunda até 4,5 contra o pixel mais claro sob o texto, e a
  amostragem acontece no aparelho.

### UX Design Requirements

- **UX-DR1**: `onAccent` — token novo por papel de paleta, derivado como o melhor entre
  `ink` e `bgPure`. Sem ele a faixa saturada não tem primeiro plano legível (`on` sobre
  `accent` mede 1,00–1,94).
- **UX-DR2**: Faixa de caderno saturada (`accent`), sangrada, 56 px, com nome em 22/700 e
  ícone. Em `soft` as quatro faixas ficam indistinguíveis nas 36 combinações (ΔE mín 0,8).
- **UX-DR3**: Ícone dentro da faixa como segundo portador de identidade — resolve a colisão
  laranja × vermelho (ΔE 4,1–9,9 em cinco das seis paletas) e daltonismo no mesmo gesto.
  `bicycle-outline` é **ícone novo**, não existe no `ICON_MAP`.
- **UX-DR4**: Capa sangrada a 45vh, com véu em gradiente **local** (nunca filtro sobre a
  imagem inteira) e piso de contraste medido de 4,5.
- **UX-DR5**: Linha de sumário — alvo de toque de linha inteira, mínimo 44 px, que rola com
  âncora até a faixa do caderno, sem navegação e sem entrada na pilha.
- **UX-DR6**: A rolagem ancorada move o foco do leitor de tela. Código novo — nem
  `setAccessibilityFocus` nem `announceForAccessibility` existem em `mobile/src/` hoje.
- **UX-DR7**: Informação obrigatória usa `ink2`, nunca `ink3` (3,05 sobre `surface` e 2,87
  sobre `bg`, abaixo do piso de objeto gráfico). Vale para assinatura, os cinco rótulos da
  ficha da lua, e o período de cada capa na parede.
- **UX-DR8**: Moldura da lua com altura que **cresce com o texto** e cresce igual nos três
  vereditos. Altura fixa é proibida: corta o veredito em AX3 e anula a ADR 0045 em
  silêncio, exatamente para quem tem baixa visão.
- **UX-DR9**: Quatro estados por caderno mais dois de ausência — período em curso (nada),
  fechado e não escrito, escrevendo (por caderno), pronta, reprovada na conferência (com o
  porquê), errata (que declara e não reescreve), erro.
- **UX-DR10**: Lápide em dois estados visuais e nunca um terceiro — no topo com um degrau
  de corpo no mês da morte, no pé no corpo normal nos demais.
- **UX-DR11**: Entrada da lua carregando o veredito por extenso, idêntica em tipografia e
  extensão nos três vereditos e no quarto estado (o teste ainda não rodou).
- **UX-DR12**: Anuário — quatro tiras de doze meses, 34 px, na cor do caderno, abrindo
  antes de qualquer texto. Não é gráfico interativo: sem toque, tooltip ou scrub.
- **UX-DR13**: Parede de capas em duas colunas, rótulo abaixo, ~6 por tela; o volume anual
  aparece como as quatro tiras em miniatura.
- **UX-DR14**: Tipografia — três famílias com papéis fixos (serifada é o que a máquina
  escreveu e passou pela conferência; mono é o que ela mediu; sans é o cromo). Número
  dentro de frase fica na serifada da frase.
- **UX-DR15**: Nenhum gesto horizontal, nenhum compartilhar, nenhum hover/tooltip em lugar
  nenhum da revista. Postal é acromático.
- **UX-DR16**: Botão de imprimir só aparece em período fechado e ainda não escrito.

### Requisitos do Épico 5 — os motores

> Inventário próprio, nascido no correct-course de 10/09/2026. O contrato é a
> [CAP-13 do spec de Sono](../../docs/specs/sono/spec.md), o §4c do spec
> [`ia-analitica`](../../docs/specs/ia-analitica/spec.md) e as ADRs 0047, 0048 e 0049. A espinha é
> [architecture-Orbe-ia-no-aparelho-2026-09-10](architecture/architecture-Orbe-ia-no-aparelho-2026-09-10/ARCHITECTURE-SPINE.md),
> e o `.memlog.md` dela é a autoridade. Os `AD-n` citados nas stories do Épico 5 são **os dela**;
> quando houver risco de confusão com os da revista, vêm marcados *dos motores*.

**Funcionais**

- **M-FR1** *(Sono CAP-13)*: O usuário lê, numa frase, o que a contagem da CAP-11 diz sobre o
  período ou a noite. A frase nasce de **um caso** classificado pelo código, entre sete, em
  precedência fixa; é gerada só quando ele aperta "Ler", e nunca gravada.
- **M-FR2** *(Sono CAP-13)*: Três motores — sem modelo, aparelho e nuvem —, e a tela diz quem
  escreveu e, quando for o caso, por que o escolhido não escreveu.
- **M-FR3** *(ADR 0048)*: Cada aparelho escolhe o motor de cada recurso; a nuvem são vários motores,
  numa lista que é do servidor.
- **M-FR4** *(ADR 0047)*: A narração da revista e o nome de rota passam pela mesma porta e pelo mesmo
  orquestrador que a Saúde do sono.
- **M-FR5** *(AD-11)*: A bancada no Mac mede template × aparelho × nuvem sobre as leituras reais e é
  o portão para um recurso ganhar motor de modelo como padrão.
- **M-FR6** *(ADR 0047)*: Pesos abertos entram pelo Core AI, na linha `model:` da ponte.

**Não funcionais** — as invariantes das três ADRs

- **M-NFR1**: O motor nunca calcula: recebe o caso pronto e só redige (AD-7).
- **M-NFR2**: O motor escreve palavras, o código escreve números — no regime interpolado, nenhum
  algarismo na saída do motor (AD-6, ADR 0049).
- **M-NFR3**: O recuo nunca aumenta a exposição nem troca de destinatário; aparelho não recua para
  nuvem (AD-5).
- **M-NFR4**: Só resposta de motor grava. Piso causado por indisponibilidade, capacidade, janela ou
  falha passageira nunca grava nada (AD-12).
- **M-NFR5**: Uma porta por hospedeiro; o núcleo não conhece rede, SDK nem fornecedor, e as barreiras
  acham o inquilino pelo import (AD-1, AD-10).
- **M-NFR6**: Nenhum dado de saúde de produção é versionado; a bancada versiona só o manifesto
  (AD-11).
- **M-NFR7**: As seis regras da ADR 0036 continuam inteiras — sem placar, sem conselho, sem
  "melhorou" ou "piorou".
- **M-NFR8**: Mobile-first. A web fica fora da primeira versão.

**Adicionais da espinha:** as catorze ADs dos motores, citadas por número em cada story. As três que
tocam a revista são a **AD-13** (a 1.10 é cliente do orquestrador; `ler` vira `buscar`), a **AD-14**
(o fio da nuvem é do núcleo; cada hospedeiro só injeta `invocar`) e a **AD-11** (a bancada pode
criar o workspace `scripts/` antes da 2.1).

### FR Coverage Map

> **Convenção deste mapa**, decidida em 08/09/2026. O **ID é o do contrato** — `FR-N` é
> `CAP-N`, e nenhuma segunda numeração é inventada, porque a espinha, o memlog do spec e
> o relatório de validação da UX já citam `CAP-N` e uma numeração paralela exigiria um
> mapeamento que não viveria em documento nenhum. A **granularidade vai para este mapa**,
> não para os IDs: uma capacidade grande lista qual story cobre qual fatia, para que
> cobertura **parcial** apareça em vez de somir.
>
> ```
> FR9  (CAP-9)  →  Story 4.2 (postal) · 4.3 (edição) · 6.1 (anuário)
> ```

```
FR1  (CAP-1)  → Épico 1
FR2  (CAP-2)  → Épico 1
FR3  (CAP-3)  → Épico 1
FR4  (CAP-4)  → Épico 1
FR5  (CAP-5)  → Épico 1
FR6  (CAP-6)  → Épico 1 (a luz nos quatro pacotes) · Épico 3 (o destaque no trimestre)
FR7  (CAP-7)  → Épico 1
FR8  (CAP-8)  → Épico 1
FR9  (CAP-9)  → Épico 1 (edição) · Épico 3 (postal, anuário)
FR10 (CAP-10) → Épico 1 (o carimbo e a capa na edição) · Épico 2 (a parede de capas)
FR11 (CAP-11) → Épico 1
FR12 (CAP-12) → Épico 4
FR13 (CAP-13) → Épico 2
FR14 (CAP-14) → Épico 2
FR15 (AD-16)  → Épico 1
```

Os 15 estão cobertos. `FR6`, `FR9` e `FR10` são as três capacidades que atravessam épico, e
é para elas que a granularidade deste mapa existe.

O Épico 5 tem mapa próprio, na mesma convenção:

```
M-FR1 (Sono CAP-13) → 5.3 (caso e template) · 5.5 (o botão e a frase no iPhone)
M-FR2 (Sono CAP-13) → 5.1 (porta, orquestrador, trilha) · 5.5 (quem escreveu, na tela)
M-FR3 (ADR 0048)    → 5.5 (escolha por aparelho) · 5.6 (a lista da nuvem)
M-FR4 (ADR 0047)    → 5.2 + 1.10 (a revista) · 5.7 (o nome de rota)
M-FR5 (AD-11)       → 5.4
M-FR6 (ADR 0047)    → 5.8
```

## Epic List

> Cinco épicos. Os quatro primeiros são a revista, na ordem de entrega — a estrutura passou por
> uma mesa de party mode em 08/09/2026 e mudou três vezes; o que está abaixo é o que sobreviveu. O
> quinto, os motores, entrou em 10/09 por correct-course e **intercala** com o primeiro (ver a nota
> dele).

### Épico 1: A edição

Ele abre um mês fechado no iPhone e lê **a revista** — capa, sumário e os cadernos na
ordem que o dado escolheu, com cada número dizendo contra o quê está sendo comparado. E
ela congela.

**FRs cobertos:** FR1, FR2, FR3, FR4, FR5, FR6 *(o fato no pacote)*, FR7, FR8,
FR9 *(a forma edição)*, FR10 *(o carimbo e a capa na edição)*, FR11, FR15

**Carrega também**, por decisão de arquitetura ou da mesa:

- `edicoes_capa` e o carimbo da capa — descem para cá porque o backfill vem logo depois, e
  uma edição de 2026 impressa sem carimbo tem a capa derivando para sempre (`AD-3`).
- A coluna `metrica_lider` — nasce aqui e é **gravada desde a primeira impressão**, mesmo
  que só o anuário do Épico 3 a leia (`AD-17`). Cada acoplamento migração × build custa uma
  janela em que o app instalado quebra (`AD-15`); pagar duas quando dá para pagar uma é
  escolha ruim.
- A sequência *montar → narrar → verificar → gravar* no núcleo (`AD-13`) — desde 10/09 como
  cliente do orquestrador dos motores, com `buscar` e `gravar` injetados. O teste dos dois
  hospedeiros é exigência do contrato, não flexibilidade especulativa.
- As fixtures puras do pacote e do verificador — custo zero, e nascem no mesmo commit da
  mudança de forma que as torna necessárias.
- O conserto do `AGG_VERSION` (`FR15`, `AD-16`), que **precede** o backfill.

**Critério de aceite do épico:** ele lê **três** edições impressas de verdade — não uma.
`agosto/2026` (os quatro cadernos, foto na capa), `julho/2026` (três lápides em dois
cadernos, onde o passo 5 força posição 1 nos dois e o desempate do catálogo decide) e um
mês de **2023** (um caderno só, capa de traçado). Custo medido: ~3 centavos.
**Razão:** `CAP-7` é o miolo ranqueado — a decisão que o dono tomou contra a recomendação
da mesa em 07/09. Com **uma** edição a ordem parece arbitrária; o ranqueamento só se prova
quando a ordem muda entre períodos e ele entende por quê. Sem isso, o veredito sobre a
maior aposta da frente ficaria agendado para o épico seguinte.
**Prova-se em agosto/2026, não folheando para 2023** — o arquivo antigo é raso por
natureza, e o retorno que vem dali é sobre o acervo, não sobre a revista.

### Épico 2: O arquivo

As edições de todos os períodos fechados desde 22/05/2023 passam a existir, e ele
**folheia até 2023** numa parede de capas, vendo pela textura quando começou a fotografar.
E passa a poder dizer "este caderno nunca".

**FRs cobertos:** FR13, FR10 *(a parede de capas)*, FR14

**Notas:**

- Imprimir e folhear são **um épico só**. Partir a jornada 4 ao meio deixaria um épico
  cuja entrega é "linhas no banco" — sem nada que ele possa ver.
- `FR14` (silenciar caderno) mora aqui e não no Épico 1: silenciar é **resposta a ter
  lido**, e é aqui que ele passa a ter dezenas de edições sobre as quais discordar. O
  painel Diagramação emagrece junto — perde as setas, fica só o olho.
- O quarto workspace (`AD-12`) e a autenticação como usuário (`AD-14`) nascem aqui, onde
  pertencem. A prova precoce da sequência vem das portas injetadas do Épico 1, não de
  antecipar topologia de build.
- O piloto de três **já rodou** no aceite do Épico 1; aqui restam as demais.

### Épico 3: As outras duas formas

Semana vira **postal** de uma tela que não custa nada; ano vira **anuário** que abre pelas
quatro tiras antes de qualquer texto, lendo a métrica que o Épico 1 vem carimbando desde o
primeiro dia.

**FRs cobertos:** FR9 *(postal e anuário)*, FR6 *(o destaque de luz no trimestre)*

**Pré-requisito:** uma passagem curta de `bmad-ux` para o destaque de luz no trimestre —
**uma coisa só**, sem reabrir capa, sumário ou paleta. Adiada de propósito para depois das
três edições-piloto: desenhar o destaque de um fato que ninguém nunca viu renderizado é
projetar a partir do documento. Pode acabar não sendo necessária.

### Épico 4: A lua sob pré-registro

Ele abre a página da lua e recebe o veredito — inclusive *"faltam cerca de 106 noites"* —
com o mesmo corpo de letra de um achado.

**FRs cobertos:** FR12

**Notas:** os dois artefatos obrigatórios já existem — `correcao-pre-registro-lua.md` e a
ADR 0046 —, então o épico está liberado. A janela é `[cheia − 5 dias, cheia)`, aberta à
direita, e a noite é representada por instante fixo do entardecer, nunca pelo desfecho
medido (`AD-6`).

### Épico 5: Os motores

Ele aperta **"Ler"** na Saúde do sono e lê uma frase sobre o período — escrita pelo modelo do
iPhone, pela nuvem ou pelo template —, e a tela diz quem escreveu. E a revista passa a narrar pela
mesma porta.

**Requisitos cobertos:** M-FR1 a M-FR6

**Entrou na sprint da revista por correct-course, em 10/09/2026**, porque a story 1.10 passou a
depender dele (AD-13 dos motores). A ordem não é a numérica:

- **F0 — 5.1, 5.2, 5.3** antes da 1.10. Núcleo puro, sem deploy e sem tela, em paralelo com 1.7–1.9.
- **F1 — 5.4** antes da 1.10, **só no marco A**: o orquestrador em modo medição com as colunas sem
  modelo e nuvem, que é o caminho que a 1.10 usa. O **marco B** — a coluna do aparelho, com o Mac no
  macOS 27 — não segura a revista.
- **F2 — 5.5** depois da 1.9, em build próprio.
- **F3, F4 e F5 — 5.6, 5.7, 5.8** na próxima sprint.

**Critério de aceite do épico nesta sprint (F0–F2):** ele leu o primeiro relatório da bancada e fixou
o limiar; e aperta "Ler" no iPhone sobre as janelas de hoje e lê, na tela de desenvolvimento, a frase
de cada motor disponível ao lado da do template. As duas coisas são veredito dele, não de dev.

## Decisões de superfície tomadas fora das espinhas de UX

Registradas aqui porque nasceram na mesa de 08/09 e não estão em `DESIGN.md` nem em
`EXPERIENCE.md`:

- **A ressalva de cobertura desigual não tem componente.** A restrição diz *"ressalva **no
  texto**"* — a superfície é a prosa, e a quarta regra do verificador já a cobra. Não era
  lacuna.
- **A capa sem caderno em `posicao = 1` com texto:** *"não impressa"* é o **estado inicial
  de 100% das edições**, não caso de borda — a capa mostra o período e o convite de
  escrever. *"Sendo escrita"* e *"reprovada"* são transitórios, e o segundo é o clímax da
  jornada 2, então não pode ficar com buraco.
- **O sumário em estado misto:** a linha **permanece**, com o nome do caderno e **sem
  chamada**. Sumir seria mentir por omissão; esperar o sumário ficar completo esconderia os
  cadernos que deram certo por causa de um que falhou.

## Epic 1: A edição

Ele abre um mês fechado no iPhone e lê a revista — capa, sumário e os cadernos na ordem que
o dado escolheu, com cada número dizendo contra o quê está sendo comparado. E ela congela.

As stories 1.1 a 1.8 não produzem tela: o núcleo é puro e a primeira coisa visível aparece
na 1.11. Aceito de propósito — antecipar a tela para vê-la mudar três vezes contradiz a
forma constante que o `EXPERIENCE.md` promete.

### Story 1.1: `AGG_VERSION` vira vocabulário do núcleo

As a dono do Orbe,
I want que toda edição registre a versão de agregação que a sustentava,
So that um bump futuro marque errata em vez de passar em branco.

**Acceptance Criteria:**

**Given** `AGG_VERSION` é hoje uma const privada em `mobile/src/services/health-sync.ts:90`
**When** ela sobe para o núcleo com dono único (AD-3 herdada, AD-16)
**Then** o sync do mobile passa a lê-la de lá
**And** nenhum outro módulo a redefine

**Given** uma edição sendo gravada por qualquer hospedeiro
**When** a gravação acontece
**Then** `agg_version_no_momento` recebe o valor vigente
**And** nunca recebe `null` — a coluna deixa de aceitar ausência silenciosa

**Given** a suíte do núcleo
**When** ela roda
**Then** existe barreira que falha se o caminho de gravação puder omitir o valor
**And** a barreira roda offline, sem cliente de banco

**Given** uma edição gravada antes de um bump
**When** `precisaErrata` é consultado depois do bump
**Then** devolve `true` — hoje devolve `false`, porque `null` nunca difere de nada

### Story 1.2: `onAccent` no sistema de tema

As a leitor da revista,
I want que o nome do caderno seja legível sobre a faixa colorida em qualquer tema,
So that eu reconheça a seção pela cara, já que a ordem muda a cada edição.

**Acceptance Criteria:**

**Given** não existe primeiro plano para `accent` sólido por papel de paleta — `on` mede
1,00 a 1,94 sobre `accent` nas 36 combinações
**When** `onAccent` é derivado como o melhor entre `ink` e `bgPure`, no molde do `onPrimary`
**Then** ele existe em `RoleTokens` e em `ModuleTokens`
**And** `moduleOf()` o devolve, porque é `moduleOf()` que a faixa lê

**Given** as 36 combinações (3 temas × 6 paletas × 2 esquemas)
**When** `theme.test.ts` roda
**Then** assere que `onAccent` é o argmax de contraste entre `ink` e `bgPure`
**And** assere `contrast(onAccent, accent) ≥ GRAPHIC_FLOOR`

**Given** o mínimo medido é 4,246 e o piso cobrado é 3,0
**When** alguém ler o teste
**Then** a razão está escrita nele: o nome do caderno é 22 px peso 700, e isso é texto
grande no WCAG, que começa em 18,66 px negrito
**And** cobrar `TEXT_FLOOR` derrubaria o build sem que nada esteja errado

**Given** web, PDF e e-mail são não-objetivos declarados
**When** `onAccent` nasce
**Then** não ganha alias plano (`yellowOnAccent`…) nem variável CSS

**Given** o recorte histórico Orbe claro
**When** `resolveTokens` roda depois da mudança
**Then** os hex históricos continuam idênticos — o teste que os trava não se mexe

### Story 1.3: O pacote fala por caderno, com bases nomeadas

As a dono do Orbe,
I want que cada caderno seja narrado a partir de um pacote restrito ao seu assunto,
So that o caderno de Sono nunca precise saber quantos quilômetros eu pedalei.

**Acceptance Criteria:**

**Given** `FatoNumero` tem hoje `atual`/`anterior`/`delta`
**When** ele passa a ter `atual` mais `bases[]` identificadas por id
**Then** B1 (período anterior), B2 (mesmo período do ano anterior) e B3 (a normal dele)
existem como bases nomeadas
**And** base inexistente entra no pacote **como fato**, nunca some

**Given** `FatoTendencia` e `FatoTexto` não existem
**When** eles nascem
**Then** a trajetória carrega direção, número de períodos e desde quando, sem valor bruto
**And** cidades, piso e lápides entram como `FatoTexto`

**Given** `montarPacote` monta um pacote único
**When** ele passa a montar por caderno
**Then** `valoresDoPacote` de cada caderno é menor que o do pacote único equivalente
**And** o pacote de Sono não contém nenhum número de ciclismo

**Given** a forma do pacote mudou
**When** a story fecha
**Then** `PACOTE_VERSAO` subiu de 1 para 2
**And** as fixtures puras do pacote nasceram no mesmo commit, sobre dado real

### Story 1.4: O texto é obrigado a nomear a base

As a dono do Orbe,
I want que um número citado sem dizer contra o quê não vire edição,
So that três bases não virem um alfabeto três vezes maior.

**Acceptance Criteria:**

**Given** `verificar.ts` tem quatro regras
**When** a quinta entra
**Then** base citada sem nome **reprova** — reprovação, não aviso
**And** um texto que escreve "435 km, contra 380 no ano passado" reprova

**Given** um texto que inverte B1 e B2
**When** ele passa pela verificação
**Then** reprova, porque a regra confere o número **e** a preposição

**Given** a regra precisa provar que morde
**When** os testes rodam
**Then** existe caso que reprova por base sem nome e caso que aprova por base nomeada

### Story 1.5: O prompt aprende as regras novas

As a dono do Orbe,
I want que o modelo seja instruído das regras que o verificador cobra,
So that ele não reprove por desobedecer uma lei que ninguém lhe contou.

> Esta story carrega **três NFRs que não têm outro dono**. O `verificar.ts` **reprova** quem
> desobedece; é aqui que alguém **manda** obedecer. Sem ela, o Épico 1 inteiro produz textos
> que falham na conferência por regras novas, e quem estiver depurando vai achar que o
> verificador está errado.

**Acceptance Criteria:**

**Given** a quinta regra reprova base citada sem nome (Story 1.4)
**When** o prompt é reescrito
**Then** ele **manda nomear a base**, com as três formas de escrever: "contra julho" (B1),
"contra agosto do ano passado" (B2), "contra o que você costuma fazer em agosto" (B3)
**And** trajetória se escreve como direção — "cai pelo terceiro mês seguido" —, nunca como
valor bruto

**Given** as leis do jornal (NFR1, NFR2, NFR4)
**When** o prompt instrui
**Then** estão nele, explícitos: **informa e não aconselha** — nada de parabéns, "que tal",
"experimente" ou "verifique suas conexões"; o modelo **nunca calcula**, nunca deriva número
que não recebeu pronto e **nunca afirma causa**; e **cobertura desigual obriga ressalva no
texto**
**And** a ressalva é a única forma que essa restrição tem — não há componente a desenhar, a
superfície é a prosa

**Given** o `cadernos.md` decidiu em 08/09 que a chamada é a primeira frase do texto
**When** o prompt é escrito
**Then** ele **diz ao modelo que a primeira frase vira capa e sumário**
**And** essa é a contrapartida declarada da extração mecânica: custo zero de geração, nada
novo a verificar

**Given** cada caderno é narrado a partir do próprio pacote
**When** o prompt é montado
**Then** ele é montado **por caderno** e não conhece os outros

**Given** a barreira do núcleo que fala com modelo cobre **literal de string**
**When** o prompt é editado
**Then** nenhum nome de fornecedor entra nele — o texto do prompt vaza para o contexto do
modelo, e é por isso que a guarda não abre exceção ali

**Given** a forma mudou
**When** a story fecha
**Then** `PROMPT_VERSAO` subiu de 2 para 3

### Story 1.6: A camada de luz entra nos quatro pacotes

As a dono do Orbe,
I want que a narrativa saiba quanta luz do dia o período teve,
So that ela não confunda "você fez menos" com "você fez menos do que se faz em novembro".

**Acceptance Criteria:**

**Given** `packages/shared/src/astro/` já tem `sun.ts` com `solarEvents`
**When** a agregação de horas de luz por período nasce
**Then** ela reusa o módulo existente — não há efeméride nova (AD-3 herdada)

**Given** a coordenada precisa ser a mesma nos dois hospedeiros
**When** ela é definida
**Then** é **constante do núcleo** (~50,8° N), nunca `deviceCoords()` (AD-10)
**And** o script de backfill e o iPhone produzem a mesma edição verificada, mesmo em fusos
diferentes

**Given** "mais números autorizados enfraquecem a verificação" cobra compensação
**When** as horas de luz entram no pacote
**Then** entram com **uma casa decimal** — inteiro pequeno passa 16% das vezes, número com
uma decimal passa 3,6%
**And** a compensação está escrita onde alguém que acrescente número a encontre

**Given** sol e lua são derivados na leitura
**When** um período de 2023 é montado
**Then** o fato de luz existe, sem coluna nova e sem backfill

### Story 1.7: O ranqueamento do miolo e a lápide

As a leitor da revista,
I want que o caderno com a história do período abra a edição,
So that eu saiba onde entrar sem ler os quatro.

**Acceptance Criteria:**

**Given** `ordenarCadernos(pacotes) → CadernoId[]`
**When** ela roda sobre entradas conhecidas
**Then** é pura e determinística
**And** o desempate é a ordem do catálogo, fixa, para a função nunca ser ambígua

**Given** os seis passos do ranqueamento
**When** o passo 5 (lápide força posição 1) e o passo 6 (vazio sai da lista) se encontram
**Then** o **passo 5 vence** — um caderno cujo único conteúdo é a lápide existe e lidera
**And** julho/2026 tem lápide em Movimento e em Coração, e Movimento lidera pelo catálogo

**Given** a lápide vira capa uma vez só
**When** a última medida da métrica cai dentro do período
**Then** ela lidera nessa edição
**And** em setembro/2026, com os anéis mortos em agosto, ela não lidera

**Given** o passo 2 (portão de cobertura e n)
**When** um caderno novo e volátil como Rotina concorre
**Then** ele não lidera por amostra pequena — entra na ordem, atrás

### Story 1.8: A chamada sai de uma função só

As a leitor da revista,
I want que a manchete da capa e a linha do sumário venham do texto que o caderno já
escreveu,
So that nada novo precise ser gerado nem verificado para eu saber por que entrar.

**Acceptance Criteria:**

**Given** a chamada é a primeira frase do texto, cortada no primeiro ponto final
**When** a função pura nasce no núcleo com dono único
**Then** capa, sumário e parede consomem **a mesma** função

**Given** o texto gerado usa milhar em pt-BR com ponto — `verificar.ts` já trata
`\d{1,3}(?:\.\d{3})+`
**When** a frase começa com "1.210 fotos em 2026."
**Then** a chamada é a frase inteira, não `1.`
**And** o teste cobre milhar com ponto, decimal com vírgula e abreviação

**Given** um caderno sendo escrito, reprovado, ou não impresso
**When** a chamada é pedida
**Then** ela **não existe**
**And** quem a consome trata ausência, nunca string vazia

### Story 1.9: A migração e a leitura da forma nova

As a dono do Orbe,
I want que a edição passe a ser uma linha por caderno,
So that marcar errata no caderno de Sono não toque a linha do de Movimento.

> **Entrega única, dois commits.** A migração e o JS que lê a forma nova **não podem ser
> entregues em momentos diferentes** (AD-15): `fetchEdicao` termina em `.maybeSingle()`
> sobre quatro colunas, e no instante em que `caderno` entra na chave ele passa a casar até
> quatro linhas e quebra o app instalado. Instância Supabase única. **Há OTA** — a premissa
> contrária foi corrigida em 10/09: `expo-updates` ligado, `runtimeVersion` 1.0.5, canal `preview`.
> O JS novo pode ir por `eas update` em vez de build, mas o update só vale a partir do **segundo**
> lançamento do app, e publicado antes da migração quebra do outro lado. Se o trabalho não couber
> numa sessão, parta em commits — nunca em entregas.
>
> **É a única migração do Épico 1.** Se a assinatura da AD-12 dos motores pedir coluna em
> `edicoes_ia`, ela entra aqui, nunca numa segunda migração. E o `CHECK` de `motivo_de_parada`
> continua igual a `CONCLUSAO` — se mudar, a guarda (6) da 5.1 muda no mesmo commit.

**Acceptance Criteria:**

**Given** sete edições em produção com `prompt_versao 2`
**When** a migração roda
**Then** elas saem **antes** de `caderno`, `posicao` e `metrica_lider` nascerem `not null`
**And** o texto delas já está exportado em `primeiras-edicoes-prompt-v2.md`

**Given** a chave primária de `edicoes_ia`
**When** a migração termina
**Then** ela é `(user_id, tipo_periodo, inicio, fim, caderno)`
**And** `caderno` tem CHECK com os quatro ids do catálogo
**And** existe `unique (user_id, tipo_periodo, inicio, fim, posicao)` **`deferrable initially
deferred`**

**Given** a capa tem grão de edição, não de caderno
**When** a migração termina
**Then** `edicoes_capa` existe com chave `(user_id, tipo_periodo, inicio, fim)`, RLS pelo
dono, natureza de três valores (`foto`/`tracado`/`grade`) e a legenda como **valor
resolvido**

**Given** a reimpressão parcial não pode reassinar o que não regenerou
**When** a função que recalcula a ordem nasce no banco
**Then** ela grava o texto só dos regenerados, ajusta `posicao` de todos e **apaga** a linha
do caderno que saiu do conjunto
**And** as posições ficam contíguas de 1 a N sobre os cadernos que a edição tem

**Given** a migração aplicada em produção — instância única, com o JS novo entregue por build ou
por `eas update`
**When** o JS novo está ativo no aparelho — o build instalado, ou o update no segundo lançamento —
e a Retrospectiva é aberta
**Then** ela **não quebra**: nenhum `.maybeSingle()` recebe mais de uma linha
**And** este é o critério conferível; *"na mesma sessão de trabalho"* é instrução
operacional e vive na nota acima, não aqui — nenhum teste confere em quantos commits o
trabalho foi partido

**Given** o sinal de sucesso do spec — *"reaberta seis semanas depois, devolve exatamente o
mesmo texto e a mesma ordem, mesmo que a função tenha mudado"*
**When** uma edição impressa é lida
**Then** a ordem vem de **`posicao`**, que é **fonte da verdade na leitura**
**And** o caminho de leitura **nunca** chama `ordenarCadernos` — ela é função de impressão,
não de render

**Given** chamar a função no render é o caminho mais curto e nada hoje o impede
**When** a barreira nasce em `architecture.test.ts`
**Then** ela falha se `ordenarCadernos` for importada por `mobile/src` ou `web/src`
**And** sem essa barreira o defeito passa em revisão de código e só aparece no dia em que o
peso da confiança mudar e uma edição fechada se reordenar sozinha — reescrita silenciosa
pela porta do render

### Story 1.10: A sequência da impressão sobe para o núcleo, como cliente do orquestrador

As a dono do Orbe,
I want que "verifica antes de gravar" seja a única forma que o código consegue executar,
So that um texto reprovado nunca chegue ao banco por nenhum caminho.

> **Mudou de escopo em 10/09/2026** (correct-course; AD-13 e AD-14 dos motores). A sequência não
> chama mais o modelo por conta própria: chama o **orquestrador** do Épico 5 uma vez por caderno, com
> o descritor da retrospectiva. A porta `narrar` deixou de existir, e a `ler` passou a se chamar
> **`buscar`** — "Ler" é o botão da Saúde do sono, e a leitura da resposta é "interpretar".
> **Depende de** 1.9, 5.1, 5.2 e da 5.4 no marco A.

**Acceptance Criteria:**

**Given** a sequência mora hoje inteira em `mobile/src/lib/edicao-ia.ts`, arquivo misto
**When** ela sobe para `ia/imprimir.ts` (AD-2 herdada; AD-13 da revista, apertada pela dos motores)
**Then** ela chama `ler(descritorDaRetrospectiva, fatos, { modo: 'produto', cadeia, motorPara, registrar, agora })`
uma vez por caderno
**And** recebe **duas portas como funções** — `buscar` e `gravar` —, mais o `motorPara` e o
`registrar` do hospedeiro
**And** nunca recebe um `SupabaseClient` nem chama um `Motor` direto

**Given** um caderno mudo
**When** `montarPedido` devolve nulo
**Then** nenhuma chamada é gasta, e o caderno não entra no conjunto

**Given** o resultado do orquestrador é discriminado (AD-12 dos motores)
**When** a sequência grava
**Then** só resultado de `origem: 'motor'` chega a `gravar` — o tipo da porta não aceita outro
**And** piso é ausência e recusa não é resultado: o caderno que caiu no piso não grava nada
**And** o motivo de parada gravado é a constante `CONCLUSAO`, nunca o que o provedor devolveu

**Given** cada hospedeiro liga as portas ao que tem
**When** o iPhone imprime
**Then** `mobile/src/lib/edicao-ia.ts` emagrece para `buscar` e `gravar` ligados ao client dele
**And** o transporte até a `ia-narrar` sai dele e vai para `mobile/src/lib/motores/` como `invocar`,
injetado em `criarMotorDeNuvem` — quem chegar primeiro entre a 1.10 e a 5.5 cria o diretório, com
`motorPara`, `invocar` e o anel
**And** a catraca do literal `'ia-narrar'` desce de 2 para 1, e a do `'STOP'` perde o `edicao-ia.ts`

**Given** "verifica antes de gravar" é hoje promessa em comentário
**When** a barreira nasce
**Then** `architecture.test.ts` falha se `upsertEdicao` for importado por qualquer módulo que não
seja a sequência ou `data/`
**And** a guarda (7) dos motores vira barreira: fora de `packages/shared`, do núcleo de IA só se
importam descritores e o orquestrador

**Given** a sequência é pura
**When** os testes rodam com motores falsos entregues pelo `motorPara` e com `buscar` e `gravar` falsos
**Then** o caminho inteiro — montar, orquestrar, conferir, gravar — é exercitado sem rede e sem script
**And** existe caso em que um caderno cai no piso e os outros gravam

**Given** a edição chega em peças e cada caderno aparece quando fica pronto
**When** a sequência grava
**Then** **mostrar é progressivo, gravar é atômico**: a escrita é do **conjunto inteiro**,
numa chamada só
**And** gravar de um caderno por vez é proibido — daria posição 1, depois 1 e 2, recalculando
a ordem de um conjunto que ainda está crescendo, e quebraria a contiguidade que a AD-4 exige
**And** isto está escrito porque o caminho natural de quem implementa é orquestrar-e-gravar em
laço

### Story 1.11: A rota da revista, e os estados da edição

As a leitor da revista,
I want abrir a edição de um mês fechado numa tela própria,
So that a capa tenha a página inteira e o seletor de período não brigue com ela.

**Acceptance Criteria:**

**Given** `/retrospectiva` tem hoje seletor, treze blocos e o painel Diagramação
**When** `/revista/[tipo]/[inicio]` nasce
**Then** `/retrospectiva` **não perde nada**
**And** o `EdicaoCard` dentro do bloco `lede` vira a porta, com capa em miniatura e chamada

**Given** "a revista nunca gera sozinha"
**When** a rota abre um período fechado e não impresso
**Then** ela mostra o convite de escrever e **não escreve**
**And** o botão de imprimir só aparece em período fechado e ainda não escrito

**Given** `periodoFechado('all', …)` devolve `false` sempre e o CHECK recusa `'all'`
**When** o período em curso ou Total é aberto
**Then** não há rota de revista — os blocos da Retrospectiva são o conteúdo inteiro

**Given** os sete estados, que valem **por caderno** e não por edição
**When** cada um acontece
**Then** *período em curso* mostra **nada** — não é botão desabilitado nem aviso, é ausência
**And** *fechado e não escrito* mostra a ação de escrever, explícita
**And** *escrevendo* mostra indicador **por caderno** — a edição chega em peças
**And** *pronta* mostra o texto congelado
**And** *reprovada na conferência* diz **por quê**, listando os problemas: não é erro do app,
é a conferência funcionando
**And** *errata* mantém a edição como está, com a marca de que os números foram
reprocessados depois dela — **errata não reescreve**
**And** *erro* mostra a mensagem e a ação de tentar de novo

**Given** o estado de cada caderno vem do resultado do orquestrador, não de exceção (AD-12 dos motores)
**When** um caderno não imprime
**Then** *reprovada* são as quatro causas permanentes — `reprovada`, `recusa-do-modelo`, `guarda` e
`saida-invalida` —, cada uma dizendo o seu motivo; na conferência, os problemas listados são os que
a trilha carrega
**And** reimprimir o caderno reprovado é ato do leitor, nunca "tentar de novo": a AD-4 diz que o
mesmo pedido não se resolve repetindo
**And** *erro* são as quatro passageiras — `indisponivel`, `capacidade`, `janela` e `transitoria` —,
ditas pela classe em palavras, com a ação de tentar de novo
**And** nenhum dos dois estados mostra o texto cru do fornecedor, que só a tela de desenvolvimento
dos motores mostra

**Given** a errata é por caderno
**When** o caderno de Sono recebe errata
**Then** a linha do de Movimento não é tocada

**Given** o clímax da jornada 2 — *"ele manda escrever de novo só o que falhou"*
**When** um caderno está no estado *reprovada na conferência*
**Then** a tela oferece **reimprimir aquele caderno**, e só ele
**And** os outros cadernos continuam impressos e íntegros, sem serem reassinados
**And** a ação chama a função do banco que recalcula a ordem do conjunto em uma transação
(Story 1.9) — ela não recalcula posição no cliente

**Given** reimprimir é ato explícito e a revista nunca gera sozinha
**When** a edição é apenas reaberta
**Then** nada é reimpresso e nada é reordenado
**And** só um ato explícito de reimprimir reordena — a ordem congela na **última** impressão

**Given** um caderno reprovado **não tem linha no banco** — o CHECK proíbe texto vazio —,
então a reprovação **não sobrevive ao relançamento do app**
**When** o estado *reprovada* existe, dentro da sessão
**Then** a tela **distingue** reprovado de vazio: um diz que o texto foi descartado e por
quê, o outro simplesmente não aparece
**And** depois de um relançamento o caderno reprovado fica indistinguível de um caderno que
não tinha o que dizer, e o convite de escrever reaparece para ele

**Given** isto é **decisão declarada, não esquecimento**
**When** alguém reencontrar este comportamento numa revisão futura
**Then** encontra aqui a razão: a reprovação é evento do **agora**, não fato do período, e
`edicoes_ia` é tabela de edição publicada, não de tentativa
**And** o custo aceito está nomeado: o clímax da jornada 2 vive uma sessão
**And** quem quiser mudar isso está mudando uma decisão de produto, não consertando um bug

### Story 1.12: Os cadernos desenhados

As a leitor da revista,
I want reconhecer cada caderno pela cara,
So that a ordem mudar a cada edição não me faça perder o lugar.

**Acceptance Criteria:**

**Given** a ordem do miolo é variável, e em revista de ordem fixa o leitor reconhece pela
posição
**When** os cadernos são desenhados
**Then** cada um abre com faixa **sangrada** de 56 px no `accent` do módulo, resolvido por
`moduleOf()`, com o nome em `onAccent` e ícone em traço
**And** a cor **não é o único portador** da identidade: Movimento e Coração medem ΔE 4,1 a
9,9 em cinco das seis paletas, e é o ícone que os separa — e que resolve daltonismo no mesmo
gesto

**Given** o `ICON_MAP` não tem bicicleta
**When** o ícone de Movimento é escolhido
**Then** `bicycle-outline` entra como **ícone novo**, com o viés declarado: a pedalada domina
o acervo, e corrida e caminhada ficam sob ele

**Given** a lápide tem dois estados e nunca um terceiro
**When** a métrica morreu dentro do período
**Then** ela sobe ao topo do caderno com um degrau de corpo
**And** nos outros períodos volta ao pé, no corpo normal, e nunca sobe de novo
**And** ela **não é tocável** e não leva a Conexões — o alerta operacional vive fora da
revista

**Given** as três famílias têm papéis fixos — serifada é o que a máquina escreveu e passou
pela conferência, mono é o que ela mediu, sans é o cromo
**When** o texto do caderno é composto
**Then** ele é serifado, e **número dentro de frase fica na serifada da frase**
**And** só número exposto como dado — ficha, legenda, assinatura — vai para mono
**And** nenhum hex é escrito na tela: cor sai de `moduleOf()` e `resolveTokens()`

**Given** informação obrigatória não usa `ink3`, que mede 2,87 sobre `bg`
**When** a assinatura é desenhada sob o texto de cada caderno
**Then** ela fica **visível**, nunca atrás de toque, em `ink2` e no formato modelo + data

### Story 1.13: A capa na edição, com o véu medido

As a leitor da revista,
I want que a capa diga onde o período aconteceu e não mude depois,
So that a edição que eu li em agosto seja a mesma em outubro.

**Acceptance Criteria:**

**Given** `coverOf` lê `isCover` e `state === 'linked'`, os dois mutáveis depois da impressão
**When** a edição é impressa
**Then** a escolha da foto e a legenda **já formatada** são carimbadas em `edicoes_capa`
**And** a legenda continua imprimindo — e servindo de descrição textual — depois que o
`ph://` some da biblioteca

**Given** as fotos são só de 2026
**When** um período sem foto é impresso
**Then** a natureza carimbada é `tracado` (a rota do próprio período) ou `grade`
**And** 2023 parece 2023 — a textura das capas registra quando ele passou a fotografar

**Given** o carimbo é da primeira impressão
**When** uma reimpressão **parcial** acontece
**Then** a capa não é tocada
**And** numa reimpressão **inteira** ela é recarimbada

**Given** as fotos vêm da biblioteca do iPhone e o app não escolhe o céu
**When** o texto é posto sobre a imagem
**Then** o véu é gradiente **local**, nunca filtro sobre a imagem inteira
**And** ele se aprofunda até o texto alcançar **4,5 contra o pixel mais claro sob ele**,
medido no aparelho
**And** véu que não alcança o piso faz o texto sair da imagem e ir para baixo dela

### Story 1.14: O sumário e a rolagem ancorada

As a leitor da revista,
I want decidir em qual caderno entrar lendo a manchete de cada um,
So that eu não precise ler os quatro para achar o que importa.

**Acceptance Criteria:**

**Given** a ordem do miolo é variável
**When** o sumário é desenhado
**Then** cada linha traz o nome do caderno e **a chamada dele**, na ordem impressa
**And** o alvo de toque é a **linha inteira**, mínimo 44 px

**Given** um caderno sendo escrito ou reprovado não tem chamada
**When** o sumário é desenhado nesse estado
**Then** a linha **permanece**, com o nome do caderno e sem chamada
**And** o sumário não espera ficar completo para aparecer

**Given** o sumário é a única navegação da revista
**When** uma linha é tocada
**Then** a página rola com âncora até a faixa daquele caderno, sem navegação e sem entrada
na pilha
**And** o foco do leitor de tela vai junto, via
`AccessibilityInfo.sendAccessibilityEvent(ref, 'focus')`

**Given** nem `setAccessibilityFocus` nem `announceForAccessibility` existem em
`mobile/src/` hoje
**When** o hook nasce em `mobile/src/hooks/`
**Then** ele é genérico — rolar até uma âncora e mover o foco junto
**And** não usa `setAccessibilityFocus`, que a documentação atual deprecou

**Given** a capa mostra a manchete do caderno em `posicao = 1` e a primeira linha do sumário
mostra a chamada do mesmo caderno
**When** a edição é aberta
**Then** a repetição acontece e é **forma, não defeito** — a capa é identidade do período, a
linha é o alvo de toque

### Story 1.15: O piloto de três edições

As a dono do Orbe,
I want ler três edições impressas de verdade antes de imprimir o arquivo inteiro,
So that eu julgue se o miolo ranqueado funciona — que foi a aposta que eu fiz contra a mesa.

> **Story com portão humano.** A entrega de dev é imprimir três períodos nomeados e pô-los
> na frente dele. O **julgamento não é de dev e nenhum agente a conclui sozinho** — quem
> fecha esta story é o dono, lendo. Não confundir com as demais: aqui "pronto" é um veredito
> humano, e é de propósito.

**Acceptance Criteria:**

**Given** com **uma** edição a ordem ranqueada parece arbitrária
**When** o piloto roda
**Then** são impressas **três**: `agosto/2026` (quatro cadernos, foto na capa),
`julho/2026` (três lápides em dois cadernos, onde o passo 5 força posição 1 nos dois) e um
mês de **2023** (um caderno só, capa de traçado)
**And** o custo medido fica na casa dos centavos

**Given** o ranqueamento só se prova quando a ordem muda entre períodos
**When** ele lê as três
**Then** consegue dizer qual caderno liderou cada uma **e por quê**
**And** se a ordem não parecer óbvia nessas três, ela não vai parecer nunca

**Given** o Épico 1 se prova em agosto/2026
**When** o aceite é dado
**Then** não é dado folheando para 2023 — o arquivo antigo é raso por natureza, e o retorno
que vem dali é sobre o acervo, não sobre a revista

**Given** um texto pode reprovar na conferência
**When** isso acontece no piloto
**Then** a tela diz **por quê**, os outros cadernos ficam impressos e íntegros, e ele manda
escrever de novo só o que falhou

## Epic 2: O arquivo

As edições de todos os períodos fechados desde 22/05/2023 passam a existir, e ele folheia
até 2023 numa parede de capas, vendo pela textura quando começou a fotografar. E passa a
poder dizer "este caderno nunca".

Imprimir e folhear são um épico só: partir a jornada 4 ao meio deixaria um épico cuja
entrega é "linhas no banco", sem nada que ele possa ver.

### Story 2.1: O quarto workspace, e a barreira que o enxerga

As a dono do Orbe,
I want que o hospedeiro novo entre no repositório declarando o que usa,
So that ele não seja o único lugar onde se escreve query sem nada acusar.

> **Quem chegar primeiro cria** (correct-course de 10/09; AD-11 dos motores). Se a 5.4 — a bancada —
> chegar antes, é ela que cria este workspace, sob exatamente os critérios abaixo, e a 2.1 encolhe
> para **conferir**: o backfill entra nele sem dependência nova não declarada, e as guardas já o
> enxergam. O diretório `scripts/` já existe com as ferramentas em Python do GitHub; o workspace as
> envolve, e elas não entram no `tsc`.

**Acceptance Criteria:**

**Given** a raiz do monorepo declara zero dependências e `pnpm-workspace.yaml` tem três
pacotes
**When** o hospedeiro de scripts nasce — pela bancada ou pelo backfill, quem chegar primeiro
**Then** ele entra como **workspace declarado**, com `@supabase/supabase-js` e `tsx` nas
dependências dele
**And** dependência usada sem ser declarada é defeito, não conveniência (AD-14 herdada)

**Given** a barreira *"nenhuma chamada `.from()` fora do núcleo"* varre hoje só `web/src` e
`mobile/src`
**When** o workspace nasce
**Then** a varredura é estendida para cobri-lo **no mesmo commit**
**And** invariante que vale só para quem chegou primeiro não é invariante

**Given** o portão automatizado valida três workspaces a cada mudança de dependência
**When** o quarto existe
**Then** ele entra no portão também (AD-17 herdada)
**And** não sobra workspace que nada valida

**Given** o núcleo não constrói `SupabaseClient`
**When** o script precisa de um
**Then** ele o constrói **no próprio workspace**, nunca em `packages/shared/src`

### Story 2.2: O script imprime uma edição, e ela é idêntica à do telefone

As a dono do Orbe,
I want que o mesmo núcleo produza a mesma edição fora do aparelho,
So that não existam duas implementações da mesma conta.

**Acceptance Criteria:**

**Given** a impressão é cliente do orquestrador, e o motor de nuvem é um só no núcleo,
`criarMotorDeNuvem(invocar)` (Story 1.10; AD-14 dos motores)
**When** o script imprime
**Then** do lado do modelo ele **só injeta `invocar`** — o transporte até a `ia-narrar`, com o JWT
da sessão dele —, e liga `buscar` e `gravar` ao client dele
**And** não escreve cliente da `ia-narrar`, não lê corpo de erro e não traduz classe: isso é do núcleo
**And** imprime uma edição sem duplicar uma linha da sequência

**Given** `ia-narrar` é `verify_jwt = true` para proteger o crédito Prepay
**When** o script se autentica
**Then** ele usa **sessão de usuário** pelo caminho normal de auth
**And** **chave de serviço é proibida** — ela desligaria a RLS que é a única proteção das
linhas (AD-14)
**And** a credencial vem do ambiente de quem roda e **não é versionada**
**And** a sessão é a mesma que a bancada usa — quem chegar primeiro entre a 5.4 e a 2.2 a escreve
no workspace

**Given** o teste obrigatório do contrato
**When** o mesmo pacote é impresso pelos dois hospedeiros
**Then** o texto verificado é **o mesmo**
**And** a assinatura é idêntica: provedor, modelo, `prompt_versao`, `PACOTE_VERSAO` e
`agg_version_no_momento`

**Given** "verifica antes de gravar, sempre, em qualquer hospedeiro"
**When** o texto reprova no script
**Then** ele não chega ao banco, exatamente como no telefone

### Story 2.3: A impressão em massa dos períodos fechados

As a dono do Orbe,
I want que o arquivo inteiro passe a existir sem eu folhear o telefone,
So that a parede tenha o que mostrar e o ranqueamento tenha com o que variar.

**Acceptance Criteria:**

**Given** o piloto de três já rodou no aceite do Épico 1
**When** a impressão em massa roda
**Then** ela cobre **mês, trimestre e ano** — 53 períodos, menos os três do piloto
**And** **semana não grava edição**: o postal calcula na hora, e 172 chamadas para textos de
sete dias não se pagam

**Given** o PostgREST corta em 1000 linhas **sem erro** e `health_daily` tem 4.385
**When** o script lê qualquer intervalo que cresça com o tempo
**Then** a leitura passa por `fetchAllPages`, com `range` **e ordenação total**
**And** sem isso o backfill rodaria inteiro, gravaria tudo, e um terço das edições narraria
um subconjunto silencioso — invisível em teste, visível dois meses depois

**Given** cada período fechado tem um conjunto de cadernos que raramente é quatro
**When** uma edição é gravada
**Then** as posições ficam contíguas de 1 a N sobre os cadernos que ela tem
**And** caderno vazio não reserva posição

**Given** a capa é carimbada na impressão (Story 1.13)
**When** as edições de 2026 são impressas
**Then** cada uma leva o carimbo
**And** nenhuma edição nasce com a capa por resolver — carimbar depois não recuperaria nada,
porque o estado que se leria já andou

### Story 2.4: A parede de capas

As a leitor da revista,
I want folhear o arquivo por capas em vez de escolher datas,
So that eu veja pela textura quando comecei a fotografar.

**Acceptance Criteria:**

**Given** o arquivo é navegável como parede, não como seletor de data
**When** ela abre
**Then** são **duas colunas**, cerca de seis capas por tela, da mais recente para trás
**And** o rótulo — período e manchete curta — fica **abaixo** da capa, em `ink2`
**And** a capa inteira é o alvo de toque, e abre aquela edição

**Given** as três naturezas carimbadas
**When** a parede desenha
**Then** `foto` mostra a imagem, `tracado` mostra a rota do período em SVG, e `grade` mostra
a grade diária
**And** a fronteira entre traçado e foto, em algum ponto de 2025, é visível sem legenda
nenhuma

**Given** o volume anual não tem capa
**When** um ano aparece na grade
**Then** ele é representado pelas **quatro tiras em miniatura**
**And** é isso que o distingue dos meses dentro da parede

**Given** as capas apontam para a biblioteca do iPhone
**When** uma imagem está resolvendo ou não existe mais
**Then** a tela reusa o precedente do `useAssetUri` — `'loading'` e `null` são estados
distintos, e sumir calado faria a parede mentir
**And** capa cuja imagem morreu **ainda diz o que era**, porque a legenda foi carimbada como
valor e não como ponteiro

**Given** a revista não se compartilha e não tem gesto horizontal
**When** a parede é usada
**Then** não há botão de compartilhar, nem carrossel, nem deslizar entre períodos
**And** a borda esquerda continua pertencendo ao voltar do sistema

### Story 2.5: Silenciar um caderno

As a leitor da revista,
I want poder dizer "este caderno nunca",
So that eu tenha como discordar da revista depois de tê-la lido.

**Acceptance Criteria:**

**Given** `RetroBlockId` não contém caderno nenhum e não vai ser alargado
**When** silenciar caderno nasce
**Then** ele mora em chave própria — `RetroPrefs.cadernosOcultos` — no mesmo jsonb
`user_preferences.retro_prefs`
**And** `CadernoId` é vocabulário de dono único no núcleo (AD-2)

**Given** `retro_prefs` é `jsonb not null default '{}'` **sem CHECK de forma**
**When** a chave nova entra
**Then** **não há migration**
**And** `resolveRetroPrefs` ganha um ramo defensivo, e chave desconhecida continua sendo
descartada em silêncio

**Given** o valor guardado é a data em que foi silenciado
**When** `deadBlocks` e `DEATH_DAYS` saem do código
**Then** a data continua sendo gravada, com o custo declarado de ser forma que promete o que
já não cumpre

**Given** um caderno silenciado
**When** o ranqueamento o colocaria em primeiro
**Then** ele **não aparece** — o ranqueamento não substitui o silenciar, porque um caderno
indesejado lidera justamente no mês em que varia mais

**Given** o painel Diagramação da Retrospectiva
**When** a story fecha
**Then** ele perde as duas setas de cada linha e fica só o olho
**And** a legenda muda, porque a segunda frase falava da regra dos 60 dias, que deixou de
existir
**And** silenciar caderno e esconder bloco continuam sendo dois atos independentes

## Epic 3: As outras duas formas

Semana vira postal de uma tela que não custa nada; ano vira anuário que abre pelas quatro
tiras antes de qualquer texto, lendo a métrica que o Épico 1 vem carimbando desde o primeiro
dia.

Não é a edição em profundidades diferentes: são objetos distintos.

### Story 3.1: O postal da semana

As a leitor da revista,
I want que a semana caiba numa tela e não custe nada,
So that folhear seis semanas não dispare seis chamadas pagas.

**Acceptance Criteria:**

**Given** a semana é rasa por declaração do contrato
**When** o postal abre
**Then** é **uma tela**, sem sumário — não há o que sumariar
**And** capa pequena, três fatos, e **só trajetória** como comparação: semana contra semana
anterior é ruído

**Given** o postal é a única superfície **acromática** da revista
**When** ele desenha
**Then** não há cor de módulo
**And** a ausência de cor é o que diz *isto é um postal, não uma edição* antes de ele ler uma
palavra — é consequência da regra, não padrão novo

**Given** o postal **não grava edição**
**When** ele é aberto
**Then** calcula na hora, como a retro faz hoje
**And** nada é escrito em `edicoes_ia`

**Given** a prosa do postal só existe se ele mandar escrever
**When** ele sai e reabre
**Then** volta aos **três fatos apurados**, sem prosa
**And** não há terceiro estado de persistência: ou é gravado, ou é efêmero

### Story 3.2: O anuário do ano

As a leitor da revista,
I want que o ano abra desenhado mês a mês antes de qualquer texto,
So that eu leia doze formas em vez de procurar uma manchete que o ano não tem.

**Acceptance Criteria:**

**Given** um ano não tem uma manchete, tem doze formas
**When** o anuário abre
**Then** ele abre **serial**: quatro tiras de doze meses, 34 px, uma por caderno, na cor do
caderno, **antes de qualquer texto**
**And** os meses são rotulados uma vez só, sob a última tira

**Given** a tira mede o fato que liderou o ranqueamento daquele caderno naquele mês
**When** ela desenha
**Then** ela lê a `metrica_lider` **carimbada** na impressão (AD-17)
**And** **nunca recalcula** — senão o anuário de 2025 desenharia outras doze marcas quando
`ordenarCadernos` mudasse de peso, que é reescrita silenciosa de período fechado

**Given** uma edição impressa antes de a coluna existir
**When** a tira encontra um mês sem carimbo
**Then** ela desenha **lacuna declarada**
**And** nunca um valor recalculado que fingiria ser o de então

**Given** a tira é formato, não visualização
**When** ele a toca
**Then** nada acontece — sem toque, sem tooltip, sem scrub

**Given** o anuário não tem capa
**When** ele aparece na parede de capas
**Then** é representado pelas quatro tiras em miniatura
**And** é isso que o distingue dos meses dentro da grade

**Given** o ano é o único período com extremos que valem data
**When** os cadernos vêm depois da série
**Then** cada um traz os **extremos datados**

### Story 3.3: O destaque de luz no trimestre

As a leitor da revista,
I want que o trimestre dê peso à luz do dia,
So that eu não confunda o que mudou em mim com o que mudou na estação.

> **Pré-requisito:** a passagem curta de `bmad-ux` para esta superfície. Ela foi **adiada de
> propósito** para depois das três edições-piloto: desenhar o destaque de um fato que
> ninguém nunca viu renderizado é projetar a partir do documento. **Pode acabar não sendo
> necessária** — se a luz na prosa já bastar, esta story morre e o `FR6` fica coberto só
> pelo Épico 1.

**Acceptance Criteria — os que o contrato já dá:**

**Given** o trimestre é o recorte em que a estação muda de significado
**When** o destaque existe
**Then** ele aparece **só** em `tipo_periodo = 'season'`
**And** `season` continua sendo trimestre civil — mover a fronteira quebraria a edição de
`season` já gravada em produção

**Given** as horas de luz já entram nos quatro pacotes (Story 1.6)
**When** o destaque desenha
**Then** ele **não pede dado novo** e não grava coluna nenhuma
**And** o número que ele mostra é o mesmo que a prosa cita, com a mesma casa decimal

**Acceptance Criteria — os que dependem da passagem de UX:** forma, posição e tratamento
visual do destaque. Não se escrevem aqui sem inventar UX.

## Epic 4: A lua sob pré-registro

Ele abre a página da lua e recebe o veredito — inclusive *"faltam cerca de 106 noites"* —
com o mesmo corpo de letra de um achado.

Os dois artefatos obrigatórios já existem: `correcao-pre-registro-lua.md` e a ADR 0046.

### Story 4.1: O instante da lua cheia entra na efeméride

As a dono do Orbe,
I want saber quando cada lua cheia aconteceu, ao minuto,
So that a janela testada seja a que o pré-registro fixou e não uma aproximação.

**Acceptance Criteria:**

**Given** `astro/moon.ts` declara por escrito que **não** devolve idade em dias, porque ela
sai da elongação com até ~0,8 dia de erro
**When** o instante verdadeiro das fases entra (Meeus cap. 49)
**Then** ele fica **no módulo que já é dono do conceito**, não num módulo novo (AD-3 herdada)
**And** `moon.ts` continua sem devolver idade em dias

**Given** a janela é de cinco noites
**When** o erro do instante é medido contra efeméride de referência
**Then** ele fica na casa dos **minutos**
**And** 0,8 dia numa janela de cinco embaralharia a coluna testada com a de controle

**Given** o §3 pré-registrou *"as 5 noites que **antecedem** a cheia (fase −5 a −1)"*
**When** a janela é calculada
**Then** ela é **`[cheia − 5 dias, cheia)`** — aberta à direita
**And** a noite da lua cheia **fica de fora**: fechar à direita incluiria a noite de maior
valor esperado sob a hipótese e excluiria a −5, deslocando a coluna testada

**Given** o desfecho medido é a hora de apagar, que atravessa a meia-noite por desenho
**When** uma noite é classificada dentro ou fora da janela
**Then** ela é representada por um **instante fixo do entardecer**
**And** **nunca** pelo `apagou` medido — classificar a exposição pelo desfecho seria endógeno:
se a lua atrasa o adormecer, uma noite na fronteira trocaria de coluna por causa do efeito
que está sendo medido

### Story 4.2: O teste lunar sob protocolo, e `lua_execucoes`

As a dono do Orbe,
I want que o teste rode exatamente como foi fixado antes de eu olhar o dado,
So that um sistema que procura o que eu já acredito não encontre.

**Acceptance Criteria:**

**Given** o desfecho, os portões e a regra das duas colunas são vocabulário de sono, e
`TRIGGER_MIN_PER_CELL` já mora em `sleep/triggers.ts`
**When** o teste nasce
**Then** ele mora em **`sleep/lua.ts`**
**And** não em `ia/` — a página é **calculada sob protocolo, não narrada**, e não assina modelo
**And** não em `astro/`, que continua sendo efeméride pura e não sabe o que é uma noite

**Given** os três portões do §4
**When** qualquer um reprova
**Then** o veredito é **inconclusivo**, nunca "nenhum padrão"
**And** o portão que reprovou é registrado: `amostra`, `ciclos` ou `luz`

**Given** os três vereditos do §5
**When** o teste roda com poder ≥ 80% e não acha nada
**Then** o veredito é **"nenhum padrão"** — que é informação
**And** com poder < 80% é **"inconclusivo"**, que é silêncio, e imprime **quantas noites
faltam**

**Given** o §7.1 manda o executor comparar o hash **antes de rodar**
**When** o teste é executado
**Then** a constante `PRE_REGISTRO_LUA_SHA` **nasce nesta story**, e o executor a compara
**And** a **barreira de build** que a protege é a Story 4.3 — a constante existe antes, o
guarda chega depois, e nenhuma das duas depende de uma story futura

**Given** o CHECK de `edicoes_ia` recusa `caderno='lua'`, a chave primária impede acumular,
e o teste roda sobre todo o histórico
**When** a execução é gravada
**Then** ela vai para **`lua_execucoes`**, chave surrogate, uma linha por execução, RLS pelo
dono
**And** a linha carrega o hash do pré-registro que a autorizou, a janela, o veredito, noites
dentro e fora, ciclos distintos, noites faltantes e o portão reprovado
**And** efeito, p e poder ficam **nulos** quando o portão reprovou antes de medir — nulo aqui
é "não foi medido", nunca zero

**Given** o contador da página tem que significar alguma coisa
**When** a página é aberta
**Then** ela **lê a última linha gravada** e nunca calcula um veredito ao abrir
**And** gravar linha é ato explícito, na cadência de +100 noites — uma execução é uma
decisão, não um render

### Story 4.3: A barreira do hash, incondicional e offline

As a dono do Orbe,
I want que mudar o protocolo depois de ver o resultado quebre o build,
So that eu não consiga fazer isso em silêncio.

**Acceptance Criteria:**

**Given** o pré-registro é imutável e a correção dele também
**When** a barreira nasce em `architecture.test.ts`
**Then** ela pina **a cadeia inteira**: a sha256 do `pre-registro-lua.md` **e** a de cada
documento de correção que o emenda
**And** hoje são dois: o pré-registro e a correção de 08/09

**Given** a condicional do §7.3 — *"com execução já gravada"* — não é construível offline
**When** o hash diverge
**Then** o build quebra **sempre**, tenha havido execução ou não
**And** a razão está escrita no teste: a suíte roda com `npx tsx`, sem cliente de banco, e um
teste que precisasse da rede seria verde por não executar

**Given** uma correção futura
**When** ela é escrita
**Then** acrescenta um par à lista — o mesmo gesto append-only da cadeia
**And** o `pre-registro-lua.md` continua sem ser editado

### Story 4.4: A página da lua

As a dono do Orbe,
I want que o resultado negativo ocupe a mesma página que um achado ocuparia,
So that a ausência de padrão não fique indistinguível de "ainda não rodou".

**Acceptance Criteria:**

**Given** a moldura é invariável em **campos**, não em pixels
**When** a página abre
**Then** os cinco campos estão sempre presentes e na mesma ordem: janela testada · desfecho ·
noites e ciclos · próxima leitura · contador de execuções
**And** não existe variante curta da página para quando não deu nada

**Given** o tipo dinâmico grande é usado por quem tem baixa visão
**When** o bloco do veredito desenha
**Then** a altura **cresce com o texto**, e cresce igual nos três vereditos
**And** altura fixa é **proibida** aqui: caixa fixa corta o veredito em AX3 e anularia a
garantia da ADR 0045 exatamente para quem ela mais protege

**Given** há um quarto estado antes dos três vereditos
**When** o teste ainda não rodou
**Then** a moldura aparece igual, com os campos que já existem e a data da **primeira**
leitura no lugar da próxima
**And** é o estado em que a página passa a maior parte do tempo, e omiti-lo seria o modo de
falha que a ADR existe para impedir

**Given** as execuções acumulam
**When** houve mais de uma
**Then** a página imprime a mais recente em corpo cheio e as anteriores como lista de
veredito + data
**And** sem isso o contador anunciaria um histórico que a tela esconde — gaveta com selo de
honestidade

**Given** a página não é narrada
**When** ela imprime procedência
**Then** ela **não assina modelo** — a procedência dela é o **hash do pré-registro** que
autorizou a execução, mais o contador
**And** ela não tem faixa de caderno e não tem ícone: abre com a **fase sinódica desenhada**,
o disco com a fatia das cinco noites destacada, que é dado e não símbolo

**Given** a covariável é pré-requisito do teste, mas os campos da moldura estão enumerados
**When** a luz do dia é mostrada
**Then** ela vive no **rodapé do método**
**And** **sobe para o bloco do veredito** num caso só: quando o portão da luz é justamente o
que reprovou, porque aí ela é a razão do inconclusivo

**Given** a ADR 0046 permite a sub-página **sob três exigências**
**When** a linha de entrada no pé do caderno Sono é escrita
**Then** ela **nomeia o veredito por extenso**, não o assunto
**And** é idêntica em tratamento nos três vereditos **e no quarto estado**
**And** quem nunca tocar já leu o resultado — falhando qualquer uma das três, a proibição
original da 0045 volta inteira

**Given** informação obrigatória não usa `ink3`
**When** os rótulos da ficha desenham
**Then** eles usam `ink2`, no mesmo corpo
**And** nenhum secundário — duração, latência, despertares — vira manchete ou entra na capa
da edição sob qualquer condição

## Epic 5: Os motores

Ele aperta "Ler" na Saúde do sono e lê uma frase sobre o período — escrita pelo modelo do iPhone,
pela nuvem ou pelo template —, e a tela diz quem escreveu. E a revista passa a narrar pela mesma porta.

As stories 5.1 a 5.4 não produzem tela: o núcleo é puro, a bancada roda no Mac, e a primeira coisa
visível é o botão da 5.5. A ordem de entrega intercala com o Épico 1 — ver a nota do épico na lista.

### Story 5.1: A porta, o fio e o orquestrador (F0)

As a dono do Orbe,
I want que todo recurso fale com qualquer motor por uma porta só, e que um só caminho percorra a cadeia,
So that a Saúde do sono não vire a terceira cópia do cliente da `ia-narrar`, e a revista não escreva
uma segunda sequência em `ia/`.

> **Antes da 1.10, e sem deploy nem tela.** A AD-13 diz que quem chegar primeiro entre a F0 e a 1.10
> cria `ia/motor.ts`, `ia/orquestrar.ts` e `ia/fio.ts` exatamente como a espinha fixa — pelo
> correct-course, é esta story. A `ia-narrar` de hoje continua servindo os dois inquilinos.

**Acceptance Criteria:**

**Given** a única costura hoje é o `ChamadorDeModelo` de `routes/nomear.ts`
**When** `ia/motor.ts` nasce
**Then** `Motor` é uma função de `Pedido` para `Promise<Resposta | Falha>` que **nunca rejeita** —
falha é valor, com classe (AD-1)
**And** `ChamadorDeModelo` vira apelido declarado ali, até morrer na 5.7
**And** `Motor` só se importa de `ia/motor`; reexportá-lo com outro nome é proibido
**And** `CONCLUSAO` nasce ali, com valor `'STOP'` e sem migration (AD-12)

**Given** o contrato da nuvem precisa ser lido pelo Deno
**When** `ia/fio.ts` nasce
**Then** ele **não importa nada** e é dono de `CLASSES_DE_FALHA` (as sete, cada uma com o critério da
AD-4), de `lerMotorId` e `formatarMotorId` com `aparelho:sistema` e `nuvem:padrao` reservados, do
corpo do pedido e da resposta, do envelope de falha e do subconjunto `Esquema` com validador (AD-4,
AD-8, AD-14)
**And** a barreira "módulo do núcleo importado pelo Deno continua sem imports" passa a cobri-lo

**Given** o orquestrador é o único que percorre cadeia (AD-2)
**When** `ia/orquestrar.ts` nasce
**Then** a assinatura é `ler(descritor, fatos, { modo, cadeia, motorPara, registrar, agora })`, e
`sem-modelo` é o passo terminal, não um `Motor`
**And** em `produto`, `indisponivel` e `capacidade` recuam; `janela` repete uma vez com o pedido curto
do recurso; `guarda`, `recusa-do-modelo`, `saida-invalida` e a conferência reprovada nunca se
repetem; `transitoria` cai no piso sem repetir (AD-4)
**And** em `medicao` roda exatamente um motor, sem recuo e sem piso, e devolve a tentativa com a classe
**And** exceção que escape de um motor é defeito: vai ao anel com a pilha e cai no piso, nunca vira
`transitoria`

**Given** a 1.11 precisa dizer por que um caderno reprovou
**When** o orquestrador devolve em modo `produto`
**Then** o resultado é discriminado: `origem: 'motor'` (a `Resposta` inteira, a trilha e os problemas
da conferência) ou `origem: 'piso'` (frase ou ausência, `causa` e a trilha) (AD-12)
**And** a trilha de uma tentativa reprovada carrega os problemas da conferência
**And** `causa` é a classe que derrubou o último motor, `reprovada`, `mudo` ou `preferencia`

**Given** a cadeia vazaria dado de saúde se recuasse para cima
**When** a resolução roda sobre preferência × padrão × catálogo
**Then** `Cadeia` é tipo marcado que só o núcleo constrói, e um teste de propriedade cobra que a
exposição não cresce, o provedor não muda e `sem-modelo` fecha a cadeia (AD-5)
**And** preferência ilegível degrada dentro do próprio regime, nunca para um padrão mais exposto

**Given** "pedido idêntico" precisa ser verificável entre o Mac e o iPhone (AD-11)
**When** um pedido é montado
**Then** `serializarPedido` — JSON canônico, chaves ordenadas, sem campo indefinido, com a versão do
descritor — e `hashDoPedido` têm dono no núcleo

**Given** hoje há duas cópias do cliente da `ia-narrar`, e o ramo que lê o corpo de erro é código
morto nas duas
**When** `criarMotorDeNuvem(invocar)` nasce
**Then** é o **único** motor de nuvem, e recebe o transporte normalizado — status e corpo, ou falta de
rede (AD-14)
**And** a tradução para classe é uma tabela ao lado dele, com teste, que lê também a `ia-narrar`
**de hoje** — status mais `{ error, detalhe }` —, porque a function só aprende o fio na 5.6
**And** motivo de parada diferente de `CONCLUSAO` vira `saida-invalida`, com o motivo cru no detalhe

**Given** o seletor nunca pode listar recurso à mão
**When** o catálogo de recursos nasce em `ia/`
**Then** `RecursoId` tem dono ali, e todo descritor se registra nele (AD-2)

**Given** as barreiras entram com o código que cobram (AD-7 herdada)
**When** a story fecha
**Then** entram, offline, as guardas da AD-10 que já têm alvo:
(2) o alvo da barreira do núcleo de IA passa a ser derivado — o fecho transitivo de quem importa
`ia/motor`, além de `ia/` e `routes/` —, e a lista de fornecedores ganha `coreai`, `qwen`, `llama`,
`mlx`, `gemma`, `foundationmodels` e `privatecloudcompute`;
(5) o teste de propriedade da AD-5;
(6) `CONCLUSAO` igual ao `CHECK` de `edicoes_ia.motivo_de_parada`, lido da última migration que o
define, e o literal `'STOP'` como **catraca** em 2 (`routes/nomear.ts`, `lib/edicao-ia.ts`), fora a
definição de `CONCLUSAO`;
(7) catraca no número atual (`lib/edicao-ia.ts`);
(1) o literal `'ia-narrar'` e o import de `on-device-engine` só no ponto de injeção de cada
hospedeiro, catraca em 2 (`lib/edicao-ia.ts`, `services/route-name.ts`), varrendo `mobile/src`,
`web/src` e `scripts/`
**And** a (3) e a (4), que olham `Engine.swift`, nascem com ele — na 5.4 ou na 5.5

### Story 5.2: O descritor da retrospectiva, e as listas com dono (F0)

As a dono do Orbe,
I want que a revista declare o seu caminho como descritor, com as regras que ela já cobra,
So that a 1.10 só precise chamar o orquestrador, sem mudar nada do que a conferência aprova.

> Depende da 5.1. Antes da 1.10.

**Acceptance Criteria:**

**Given** a AD-13 fixa o descritor da retrospectiva
**When** ele nasce em `ia/`
**Then** declara regime **copiado e conferido**, que grava, piso = ausência, recusa não é resultado, e
`montarPedido` nulo para caderno mudo
**And** a montagem é o `montarPacotes`/`montarPrompt` por caderno que já existem, e a conferência é o
`verificarTexto` que já existe
**And** admite só motor de nuvem, com cadeia padrão `nuvem:padrao` → `sem-modelo` — é o único
aprovado para ela hoje (AD-9), e nenhum motor de aparelho passou pela bancada para ela
**And** nenhuma regra muda: os testes de `pacote.ts`, `prompt.ts` e `verificar.ts` passam sem edição,
e `PROMPT_VERSAO` e `PACOTE_VERSAO` não sobem

**Given** a assinatura carrega a versão do descritor (AD-12)
**When** a retrospectiva a declara
**Then** a versão é o par `prompt_versao`/`pacote_versao` que `edicoes_ia` já grava — nenhuma coluna
nova, e a 1.9 continua sendo a única migração do Épico 1

**Given** a lista de termos proibidos tem hoje um pedaço privado, `CAUSA`, em `ia/verificar.ts`
**When** `VOCABULARIO_PROIBIDO` nasce ali, exportado (AD-6)
**Then** tem subconjuntos nomeados: causa (a `CAUSA` de hoje), conselho, elogio, placar, tendência e
meta, comparação com outras pessoas
**And** a retrospectiva compõe só `causa`, como hoje — a conferência dela reprova exatamente o que
reprovava
**And** nenhum outro arquivo declara lista de termo proibido, por guarda

**Given** `formatarNumero` mora em `ia/prompt.ts`
**When** ele se muda para `format/numero.ts` (AD-6)
**Then** `ia/prompt.ts` passa a importá-lo de lá, e nenhum número formatado muda

### Story 5.3: A leitura da Saúde do sono, sem modelo (F0)

As a dono do Orbe,
I want a frase da Saúde do sono escrita pelo template sobre as minhas noites de verdade,
So that exista o piso contra o qual cada motor vai ser julgado, antes de existir motor.

> Depende de 5.1 e 5.2 (a lista de termos e o formatador). Sem tela: as frases do template se leem
> pelo teste e pela bancada.

**Acceptance Criteria:**

**Given** a frase pedida nomeia "a dimensão que puxa o conjunto para baixo", e só 15% das semanas
têm uma
**When** `casoDaSaude` nasce em `sleep/`, pura (AD-7)
**Then** cada `SleepScore` cai em exatamente um caso, nesta precedência: `sem-contagem` →
`medidas-insuficientes` → `tudo-no-maximo` → `todas-iguais` → `uma` → `duas` → `fora-do-empate`
**And** o caso carrega quantas dimensões foram medidas, e dimensão não medida sai dele (regra 4 da
ADR 0036)
**And** um teste enumera todas as combinações de nota × presença nas cinco dimensões e confere que
cada uma cai em exatamente um caso

**Given** a tela e a bancada precisam montar o mesmo pedido (AD-11)
**When** `entradaDaSaude(noites, notas, { range, offset, hoje })` nasce
**Then** é pura, com as janelas de noite e de nota explícitas, e é a única entrada das duas

**Given** o regime interpolado é obrigatório na Saúde do sono (AD-6, ADR 0049)
**When** `ia/interpolar.ts` nasce
**Then** a sintaxe e a substituição de marcador têm dono ali
**And** a conferência da Saúde reprova algarismo, marcador fora do caso e dimensão a mais, e **exige
a presença** das dimensões do caso — a ausência é `recusa-do-modelo`
**And** compõe de `VOCABULARIO_PROIBIDO` os subconjuntos que valem para ela: conselho, causa, elogio,
placar, tendência e meta, comparação com outras pessoas

**Given** o descritor da Saúde do sono
**When** ele se registra no catálogo
**Then** declara regime interpolado, amostragem gulosa, saída `texto`, que não grava, `regimeMaximo`
nuvem — a CAP-13 admite os três motores, a nuvem só por escolha explícita —, e a cadeia padrão
**só `sem-modelo`** até a bancada aprovar um motor (AD-11)

**Given** `semModelo(fatos)` é obrigatório pelo tipo (AD-2)
**When** o template escreve
**Then** há frase para os sete casos, com a contagem real de dimensões medidas — nunca "cinco" fixo
**And** `tudo-no-maximo` diz isso sem elogio; `sem-contagem` diz a cobertura quando houver e nunca
fala em conjunto

**Given** o fato da percepção sai com ponto (`toFixed` em `sleep/score.ts`), e o núcleo de IA
escreve vírgula
**When** a leitura interpola
**Then** todo fato sai em pt-BR por `format/numero.ts`, e o conserto é na origem
**And** a tela `/sono/saude` passa a mostrar `3,3/5` — conserto de formatação, não mudança de desenho

**Given** a medição de 10/09 sobre as noites de produção
**When** a leitura roda sobre o mesmo recorte, a partir de export fora do git (AD-11)
**Then** a distribuição dos casos é conferida contra ela — 7 dias: 11 com uma, 17 empates, 45 sem
contagem; 4 semanas: 2, 4 e 13; 12 meses: as duas sem contagem; noites: 136, 139 e 18 com tudo no
máximo
**And** toda diferença é explicada — a borda `medidas-insuficientes`, aprovada depois da medição, é
a única que pode mover número

### Story 5.4: A bancada no Mac (F1)

As a dono do Orbe,
I want medir template × aparelho × nuvem sobre as minhas leituras reais antes de existir botão,
So that o limiar do portão saia de um relatório, não de impressão.

> **Dois marcos, e só o primeiro é portão da 1.10** (correct-course de 10/09).
> **Marco A — o caminho da 1.10:** o orquestrador em modo `medicao` sobre as leituras reais, com as
> colunas sem modelo e nuvem. É o mesmo caminho que a 1.10 vai usar — orquestrador,
> `criarMotorDeNuvem`, `invocar`, `ia-narrar` com JWT —, provado com dado real antes de a revista
> depender dele.
> **Marco B — a coluna do aparelho:** exige o Mac no macOS 27 (público em 14/09) e o mesmo Xcode maior
> do build de entrega. **Se o Xcode 26.6 não abrir no macOS 27, a story para e volta ao dono**, e a
> revista segue, porque o marco B não a segura.
> **Portão humano no fim:** o relatório é lido por ele, e o limiar é dele. Nenhum agente o fixa.
> Depende de 5.1 e 5.3.

**Acceptance Criteria — marco A:**

**Given** o TS da bancada vive no hospedeiro de scripts da AD-12 da revista (AD-11)
**When** a bancada chega antes da 2.1
**Then** é ela que cria o workspace `scripts/`, sob os critérios da 2.1 — declarado em
`pnpm-workspace.yaml` com as dependências que usa, coberto pela barreira do `.from()` no mesmo commit,
no portão do CI, e com o client construído no próprio workspace
**And** as ferramentas em Python de `scripts/github/` ficam como estão

**Given** a nuvem entra com JWT de usuário, nunca chave de serviço (AD-14 da revista)
**When** a bancada autentica
**Then** usa sessão de usuário, com a credencial vinda do ambiente de quem roda e nunca versionada
**And** quem chegar primeiro entre a 5.4 e a 2.2 escreve esse caminho no workspace

**Given** nenhum dado de saúde de produção é versionado (AD-11; AD-8 herdada)
**When** a bancada lê produção
**Then** exporta sob demanda para diretório ignorado pelo git, não importa escritor de `data/`, e
versiona só o manifesto — as janelas e o hash do export
**And** a leitura pagina por `fetchAllPages`, com ordenação total — o PostgREST corta em 1000 linhas
sem erro

**Given** a bancada acrescenta só a sonda e o relatório (AD-11)
**When** ela mede
**Then** chama `entradaDaSaude` e o orquestrador em modo `medicao` com o motor injetado — os mesmos
pedidos, pelo mesmo hash, que a tela vai montar
**And** mede todas as janelas que a tela navega: 7 dias, 4 semanas, 12 meses e as noites
**And** a nuvem entra por `criarMotorDeNuvem` com o `invocar` do script, e o literal `'ia-narrar'`
fica só no ponto de injeção dele (guarda 1)

**Given** o relatório tem de ser comparável
**When** ele é escrito
**Then** é chaveado por recurso, `MotorId` e build do sistema, com as conferências mecânicas por
pedido e a classe de cada falha
**And** um relatório só se compara com outro do mesmo manifesto
**And** com o marco A de pé, a 1.10 está liberada

**Acceptance Criteria — marco B:**

**Given** a F1 chega antes da F2 (AD-11)
**When** a coluna do aparelho entra
**Then** é a bancada que cria `Engine.swift` em `mobile/modules/on-device-engine/ios/`, só com
`Foundation` e `FoundationModels` e sem `ExpoModulesCore` (AD-3)
**And** a CLI Swift o compila **sem cópia**
**And** as guardas (3) e (4) nascem com ele: o `enum ClasseDeFalha: String`, com valores brutos
explícitos, é igual a `CLASSES_DE_FALHA` — e a guarda falha se não o achar —, e `Engine.swift` só
importa módulos da lista permitida

**Given** a linha de base é o macOS 27 (decisão de 10/09)
**When** a coluna do aparelho mede
**Then** o Mac está no macOS 27, com Apple Intelligence ativo, e a CLI usa o mesmo Xcode maior do
build de entrega
**And** se o Xcode 26.6 não abrir no macOS 27, a story para e volta ao dono — as saídas estão no
Deferred da espinha

**Given** pedir ao motor que escolha a dimensão só existe em modo `medicao` (AD-7)
**When** a sonda de fidelidade roda
**Then** o motor escolhe entre opções fechadas, por esquema, e a bancada confere contra o caso do código

**Given** o relatório completo
**When** ele termina de ler
**Then** o limiar do portão é fixado **por ele** e registrado — é o que decide se a Saúde ganha motor
de modelo como padrão

### Story 5.5: A ponte, o botão Ler e a escolha do motor (F2)

As a dono do Orbe,
I want apertar "Ler" na Saúde do sono e ver quem escreveu a frase,
So that eu julgue no aparelho o que a bancada mediu no Mac.

> **Pré-requisito:** proposta visual com mockups e dados reais, aprovada por ele — o botão e a frase
> em `/sono/saude`, `/configuracoes/motores` e a tela de desenvolvimento (regra permanente de 04/09).
> **Depois da 1.9, em build próprio** — nunca no build da migração, que é o de maior risco da sprint.
> Depende de 5.1, 5.3 e do `Engine.swift` (da 5.4 ou desta).

**Acceptance Criteria:**

**Given** a ponte é Swift nosso, sem estado, sem domínio e só com pesos locais (AD-3)
**When** o módulo `on-device-engine` nasce em `mobile/modules/`
**Then** tem dois arquivos em `ios/`: `Engine.swift` (se a 5.4 ainda não o criou) e a cola do Expo,
sem `catch`, literal de classe nem lógica
**And** a porta o carrega com `requireOptionalNativeModule`: ausência é `indisponivel`, nunca exceção
no import
**And** uma sessão nova por pedido, e a janela é lida de `contextSize` em execução
**And** as guardas são `#available(iOS 26, macOS 26, *)`, `#available(iOS 26.4, macOS 26.4, *)` para
`tokenCount`, `#if compiler(>=6.4)` para símbolo novo dentro de `FoundationModels`, e `@unknown
default` em todo `switch` sobre enum da Apple
**And** a tabela erro → classe mora no `Engine.swift`, com teste

**Given** há OTA no runtime 1.0.5
**When** o build que embarca a ponte é feito
**Then** `runtimeVersion` sobe, e nenhum update com código da porta vai para o runtime anterior
**And** `expo-doctor` continua 21/21

**Given** o ponto de injeção do app (AD-10)
**When** `mobile/src/lib/motores/` recebe o aparelho
**Then** ali ficam `motorPara`, `invocar`, o catálogo, a preferência e o anel — quem chegar primeiro
entre a 1.10 e esta cria o diretório, e esta acrescenta o resto
**And** o catálogo lista todo motor conhecido, disponível ou indisponível com motivo, e declara a
concorrência (aparelho: um); o ponto de injeção serializa por motor
**And** a preferência é um mapa `RecursoId` → `MotorId` em AsyncStorage, com um módulo só dono da
chave e fila no molde de `sync-breadcrumbs`; `user_preferences` não é tocada (AD-8)
**And** o anel guarda a trilha de toda execução e o pedido completo só nas falhas permanentes,
defeitos e erros não mapeados — nunca sai do aparelho
**And** o import de `on-device-engine` só aparece ali (guarda 1)

**Given** leitura efêmera é só por ação explícita
**When** ele aperta "Ler" em `/sono/saude`
**Then** a frase sai do motor escolhido para a Saúde do sono **neste** aparelho, pela cadeia
resolvida — nunca ao abrir a tela
**And** a tela diz quem escreveu e, quando for o caso, por que o escolhido não escreveu
**And** um segundo toque com o mesmo hash se junta ao primeiro, e resultado cujo hash não é o do
pedido corrente é descartado
**And** nada é gravado

**Given** a escolha é por recurso e por aparelho (AD-5, AD-8)
**When** `/configuracoes/motores` abre
**Then** lista os recursos do catálogo do núcleo — nunca à mão — e, para cada um, os motores até o
`regimeMaximo` dele
**And** motor indisponível aparece com o motivo, e a preferência gravada nunca é descartada

**Given** a tela de desenvolvimento com os motores lado a lado
**When** ele a abre
**Then** cada motor roda em modo `medicao` sobre o mesmo pedido, com a classe e o detalhe da falha —
é o único lugar onde o texto cru do fornecedor aparece

**Given** Mac e iPhone precisam concordar (AD-11)
**When** o iPhone está no iOS 27 (a partir de 15/09)
**Then** a amostra de 20 pedidos compara por hash com a bancada, no mesmo major.minor
**And** roda de novo sempre que um dos dois muda de versão maior

**Given** um recurso só ganha motor de modelo como padrão depois da bancada (AD-11)
**When** o build sai
**Then** a cadeia padrão da Saúde continua `sem-modelo` até o limiar da 5.4 ser atingido; o aparelho
entra por escolha dele

**Given** o device é fronteira nomeada (AD-17 herdada)
**When** a story fecha
**Then** o veredito é dele, no iPhone — verde no CI nunca quer dizer motor funcionando

### Story 5.6: Vários motores de nuvem (F3)

As a dono do Orbe,
I want escolher, por recurso, entre motores de nuvem que o servidor autorizou,
So that eu teste outro provedor sem trocar o modelo do app inteiro.

> **Próxima sprint.** ADR 0048.

**Acceptance Criteria:**

**Given** a `ia-narrar` ainda não conhece o fio
**When** ela passa a importar `ia/fio.ts` por caminho relativo
**Then** nunca devolve falha sem classe, e o status é o fixado por classe (AD-14)
**And** `supabase/functions/` não declara literal de classe fora do que importa (guarda 3)
**And** a leitura da resposta antiga, na tabela da 5.1, morre

**Given** a lista de motores de nuvem é do servidor (AD-9)
**When** ela entra em `secrets`
**Then** é escrita em `MotorId` completo, cada entrada com os recursos para os quais passou na
bancada — os dois recursos que existem entram aprovados para o modelo em produção hoje
**And** `AI_PROVIDER` e `AI_MODEL` continuam sendo `nuvem:padrao`, que só resolve para um recurso se
o padrão estiver aprovado para ele

**Given** o corpo pode pedir um motor
**When** o `motor` pedido está na lista, é usado; ausente, vale o padrão; fora, falha com `indisponivel`
**Then** corpo sem `motor` se comporta como hoje

**Given** o app lê a lista do servidor
**When** a function a expõe
**Then** o deploy que a expõe vem **antes** do build que a lê
**And** o catálogo guarda a última lista lida, com instante, e falhar ao lê-la remove só as
variantes nomeadas — `nuvem:padrao` fica sempre que há rede

**Given** provedor novo entra com regime (AD-9)
**When** um provedor entra na lista
**Then** a tabela de regime dele já está versionada em `docs/` — tier, o que pode ser enviado,
retenção, DPA, uso para treino, o que faz com `guardrails`
**And** a function nunca registra `sistema` nem `usuario` em log; registra motor, classe, status e tokens

### Story 5.7: O nome de rota pela porta (F4)

As a dono do Orbe,
I want que o nome de rota passe pela mesma porta que a revista e a Saúde,
So that a escolha de motor valha no app todo e a última cópia do cliente da `ia-narrar` morra.

> **Próxima sprint.** Ratifica a ADR 0041 como regime molde e a 0042 como gatilho por entidade.

**Acceptance Criteria:**

**Given** o nome de rota é o regime **molde** (AD-6, ADR 0041)
**When** `routes/` vira descritor
**Then** o motor devolve campos pelo subconjunto `Esquema`, a frase sai do molde, e a conferência é
de pertinência — todo lugar citado foi enviado
**And** recusa é resultado: as causas permanentes gravam como hoje

**Given** um piso por indisponibilidade marcaria a pedalada como nomeada para sempre
**When** a causa é `indisponivel`, `capacidade`, `transitoria` ou `janela`
**Then** nada é gravado — nem recusa, nem marca de visitado (AD-12)
**And** o gatilho continua "ao abrir o detalhe, uma vez por pedalada", e o "próximo tick" é o
próprio gatilho, não retry da porta

**Given** `services/route-name.ts` é a última cópia do cliente
**When** ele passa pelo ponto de injeção
**Then** `ChamadorDeModelo` morre, e as catracas do `'ia-narrar'` (guarda 1) e do `'STOP'` (guarda 6)
chegam a zero e viram barreira

### Story 5.8: Core AI (F5)

As a dono do Orbe,
I want rodar pesos abertos no iPhone pela mesma ponte,
So that eu compare um modelo aberto com o da Apple sem mexer em nenhum recurso.

> **Próxima sprint, e exige Xcode 27**, que não está na imagem EAS da SDK 57: o build é local.

**Acceptance Criteria:**

**Given** o `CoreAILanguageModel` exige iOS e macOS 27 como alvo mínimo no pacote da Apple
**When** a story começa
**Then** a primeira entrega é a decisão dele entre subir o alvo do app, vendorizar
`apple/coreai-models` (BSD-3) ou escrever conformidade própria de `LanguageModel`, com o custo de
cada uma na mesa (Deferred da espinha)

**Given** a linha `model:` é a costura dos pesos (AD-1, AD-3)
**When** a variante entra
**Then** ela é `aparelho:<pesos>` pela gramática de `ia/fio.ts`, só com pesos que rodam no aparelho,
e nenhum recurso muda
**And** o módulo do Core AI entra atrás de `#if canImport`, e os erros novos do Xcode 27 entram na
tabela erro → classe

**Given** pesos abertos não têm o guardrail da Apple, e a memória é o portão real
**When** eles chegam ao aparelho
**Then** a variante passa pela bancada antes de virar padrão de qualquer recurso
**And** recurso sensível só a admite depois de a bancada medir a taxa de guardrail
