---
title: 'Sprint Change Proposal — os motores de IA entram na sprint da revista'
date: '2026-09-10'
workflow: bmad-correct-course
mode: batch
scope: moderate
status: aprovada em 10/09/2026, com a decisão #6 trocada — aplicada no mesmo dia, com espelho no GitHub
trigger: 'espinha dos motores (architecture-Orbe-ia-no-aparelho-2026-09-10, 14 ADs) e ADRs 0047–0049, na main em 258084c'
---

# Sprint Change Proposal — os motores de IA entram na sprint da revista

## 1. Resumo do problema

**O que disparou.** A arquitetura dos motores de IA foi aprovada e registrada em 10/09/2026
([espinha](architecture/architecture-Orbe-ia-no-aparelho-2026-09-10/ARCHITECTURE-SPINE.md), cujo
`.memlog.md` é a autoridade, e ADRs [0047](../../docs/decisions/0047-a-porta-do-motor-e-uma-so-e-a-ponte-do-aparelho-e-nossa.md),
[0048](../../docs/decisions/0048-o-motor-e-escolhido-por-aparelho-e-a-lista-da-nuvem-e-do-servidor.md)
e [0049](../../docs/decisions/0049-o-motor-escreve-palavras-e-o-codigo-escreve-numeros.md)). Três das
catorze ADs dela mudam stories que já estão na sprint da revista:

- **AD-13** — a impressão da revista é cliente do orquestrador. A story 1.10 deixa de escrever uma
  sequência própria em `ia/`, e a porta `ler` dela passa a se chamar `buscar`.
- **AD-14** — o fio da nuvem é do núcleo: há um motor de nuvem só, `criarMotorDeNuvem(invocar)`, e
  cada hospedeiro só injeta o transporte. A story 2.2 encolhe.
- **AD-11** — o TS da bancada vive no hospedeiro de scripts da revista, e quem chegar primeiro o
  cria. A story 2.1 pode encontrar o workspace já feito.

O portão de revisão da mesma espinha achou ainda uma **premissa falsa** na espinha da revista: a
AD-15 dela parte de "não há OTA", e `mobile/app.base.json` desmente.

**Categoria.** Requisito novo do dono (priorizar os motores dentro da sprint em andamento) mais uma
premissa técnica errada, descoberta por revisão. Nada falhou em produção.

**Evidência.**

| Fato | Onde |
| --- | --- |
| A sequência da impressão mora hoje num arquivo misto, soldada a `supabase.functions.invoke('ia-narrar')` | `mobile/src/lib/edicao-ia.ts:37-59` |
| Duas cópias do cliente da `ia-narrar`, cada uma lendo a resposta de um jeito | `lib/edicao-ia.ts:38` · `services/route-name.ts:50` |
| O ramo que lê o corpo de erro é código morto nas duas: `functions.invoke` devolve erro antes do corpo em todo não-2xx | `lib/edicao-ia.ts:43-45` |
| `'STOP'` do Gemini está num `CHECK` e em duas comparações | `20260906150000_edicoes_ia.sql:36` · `routes/nomear.ts:107` · `lib/edicao-ia.ts:49,56` |
| OTA ligado: `runtimeVersion` fixo `1.0.5`, `updates.enabled: true`, canal `preview` por `requestHeaders` | `mobile/app.base.json:10-16` · `eas.json` · ADR 0009 |
| O update só vale no **segundo** lançamento: `fallbackToCacheTimeout ?? 0` | `@expo/config-plugins@57.0.9/build/utils/Updates.js:189` |
| `scripts/` já existe, com as ferramentas em Python do GitHub; não é workspace | `scripts/github/` · `pnpm-workspace.yaml` |
| A sprint tem 1.1–1.6 em `review` e 1.7–1.15 em `backlog`; nenhuma story da revista foi criada para a 1.10 | `sprint-status.yaml` |

## 2. Análise de impacto

### 2.1 Épicos

| Épico | Impacto |
| --- | --- |
| **1 — A edição** | Continua completável como planejado. A 1.10 muda de escopo (fica cliente do orquestrador); a 1.9 corrige a nota de OTA e ganha duas amarras de fronteira; a 1.11 ganha um critério (o estado vem da causa do piso). A 1.10 passa a esperar a F0 e o marco A da bancada. |
| **2 — O arquivo** | A 2.1 vira "quem chegar primeiro cria"; a 2.2 só injeta `invocar`. O resto intacto. |
| **3 e 4** | Sem impacto. |
| **5 — Os motores (novo)** | Oito stories: F0 em três (5.1–5.3), F1 (5.4), F2 (5.5), F3 (5.6), F4 (5.7), F5 (5.8). F0 e o marco A da F1 antes da 1.10; F2 depois da 1.9; F3–F5 na próxima sprint. |

Nenhum épico fica obsoleto. Nenhum épico muda de ordem; o que muda é a **intercalação**: o Épico 5
corre ao lado do Épico 1, e a 1.10 é o ponto de encontro.

### 2.2 Stories

| Story | Mudança | Por quê |
| --- | --- | --- |
| 1.9 | Nota de OTA corrigida; a migração dela é a única do Épico 1 e absorve qualquer coluna que a AD-12 dos motores peça; o `CHECK` de `motivo_de_parada` só muda com a guarda (6) junto | AD-15 corrigida; fronteira 1.9 × 1.10 × 5.1 |
| 1.10 | Reescrita: cliente do orquestrador, duas portas (`buscar`, `gravar`), só `origem: 'motor'` grava, `CONCLUSAO`, guarda (7) vira barreira | AD-12, AD-13, AD-14 dos motores |
| 1.11 | Um critério: o estado de cada caderno vem da causa do piso, e os problemas vêm da trilha | AD-12 e AD-4 dos motores |
| 2.1 | "Quem chegar primeiro cria" o workspace; se a 5.4 chegou, a 2.1 só confere | AD-11 dos motores |
| 2.2 | Do lado do modelo, só injeta `invocar`; a sessão por JWT é compartilhada com a bancada | AD-14 dos motores |
| 5.1–5.8 | Novas | espinha dos motores |

### 2.3 Artefatos

| Artefato | Mudança |
| --- | --- |
| `_bmad-output/planning-artifacts/epics.md` | Overview e frontmatter; inventário de requisitos do Épico 5 (IDs `M-`); mapa de cobertura; Épico 5 na lista e em seção própria; 1.9, 1.10, 1.11, 2.1 e 2.2 |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Bloco do correct-course no cabeçalho; comentários de 1.9, 1.10, 2.1 e 2.2; `epic-5` com oito stories |
| `_bmad-output/implementation-artifacts/epic-1-context.md` | Título da 1.10, as portas, a premissa de OTA e as dependências cruzadas |
| Espinha da revista (`ARCHITECTURE-SPINE.md` + `.memlog.md`) | AD-13 recebe nota de aperto; AD-15 tem a premissa corrigida; seed; linha no memlog |
| Espinha dos motores (`ARCHITECTURE-SPINE.md` + `.memlog.md`) | As duas linhas "vai ao correct-course" viram "resolvido"; as decisões desta proposta no memlog |
| `CLAUDE.md` | O bullet dos motores diz como eles entraram na sprint |
| Quadro do GitHub | O hook de pós-commit cria o milestone e as oito issues ao commitar a yaml — ver §5 |

**Não tocados, de propósito:** as ADRs (nada é superado; ADR é imutável), o `spec.md` da revista e os
companions de UX (nenhuma superfície da revista muda), o spec de Sono (a CAP-13 já descreve a
leitura), e `scripts/github/` (outra sessão tem mudança não commitada lá agora).

### 2.4 Impacto técnico — as fronteiras entre stories

A lição da revista é que **as stories desta casa se quebram entre si, não dentro**. Estas são as
fronteiras que a mudança cria, e cada uma virou critério de aceite em alguma story:

1. **O motor de nuvem nasce antes de a function aprender o fio.** O mapa de capacidades da espinha
   põe `criarMotorDeNuvem` na F3, mas a 1.10 precisa dele. Resolução: nasce na **5.1**, com a tabela de
   tradução lendo também a `ia-narrar` de hoje (status mais `{ error, detalhe }`); a function só passa
   a importar `ia/fio.ts` e a devolver classe na **5.6**. A F0 segue sem deploy.
2. **Quem chegar primeiro cria**, em quatro pontos: o workspace `scripts/` (5.4 × 2.1), a sessão de
   usuário por JWT (5.4 × 2.2), `mobile/src/lib/motores/` com `invocar` e o anel (1.10 × 5.5), e o
   `Engine.swift` (5.4 × 5.5).
3. **A 1.9 é a única migração do Épico 1.** Se a assinatura da AD-12 pedisse coluna em `edicoes_ia`,
   uma segunda migração pagaria uma segunda janela da AD-15. A 5.2 amarra a versão do descritor às
   colunas que já existem, e a 1.9 fica como rede.
4. **O `CHECK` de `motivo_de_parada` e a guarda (6) andam juntos.** A guarda nasce na 5.1 lendo a
   última migration que o define; se a 1.9 mexer nele, mexe na guarda no mesmo commit.
5. **O "por quê" da reprovação sobrevive ao piso.** A 1.11 lista os problemas da conferência; a 5.1
   garante que a trilha os carrega.
6. **As catracas descem em ordem.** `'ia-narrar'` e `'STOP'`: 2 na 5.1 → 1 na 1.10 → 0 na 5.7, quando
   viram barreira. A guarda (7) nasce catraca na 5.1 e vira barreira na 1.10.
7. **OTA × ponte.** Depois da 5.5 o iPhone está num `runtimeVersion` novo, e update para o 1.0.5 não
   o alcança. Como a 5.5 vem depois da 1.9, a janela da 1.9 ainda é no 1.0.5.
8. **O marco B da bancada não segura a revista.** Ele depende do macOS 27 (14/09) e do Xcode 26.6
   abrir nele, que ninguém verificou. Só o marco A é portão da 1.10.

## 3. Abordagem recomendada

**Ajuste direto** (opção 1 do checklist), com um épico novo dentro da estrutura existente.

- **Rollback** (opção 2): não se aplica — nada do que está em `review` (1.1–1.6) conflita com os
  motores. A 5.2 edita dois arquivos que a 1.4–1.6 tocaram (`ia/verificar.ts`, `ia/prompt.ts`), mas
  por cima deles, sem desfazer nada: a `CAUSA` vira subconjunto, e `formatarNumero` só muda de casa.
- **Revisão de MVP** (opção 3): não se aplica — o aceite do Épico 1 (a 1.15) e os critérios da revista
  ficam iguais.

| | |
| --- | --- |
| **Esforço** | Médio-alto. A F0 é a maior peça — três stories, a 5.1 do porte de duas stories da revista. A 1.10 fica de tamanho parecido: perde a sequência própria e ganha as amarras. |
| **Risco** | Médio. A revista passa a depender de um contrato novo. Mitigação: o marco A da 5.4 prova o caminho da 1.10 com dado real antes de ela começar. |
| **Cronograma** | A 1.10 espera 5.1, 5.2, 5.3 e o marco A da 5.4 — que correm em paralelo com 1.7, 1.8, o ensaio da migração e a 1.9, porque não tocam app nem banco. Se forem mais lentas que a 1.9, a 1.10 atrasa na diferença. |

**Por que vale o atraso.** Sem a F0 antes, a 1.10 escreveria em `ia/` uma sequência pedido → modelo →
conferência com a política de falha dela, e a Saúde do sono chegaria depois com outra — dois tipos de
porta no mesmo diretório, que é exatamente o que as ADRs 0047 e 0041 existem para impedir. Consertar
isso depois custaria refazer a 1.10.

### Decisões que tomei — para vetar

1. `criarMotorDeNuvem` nasce na **5.1**, lendo também a `ia-narrar` de hoje; a function só aprende o
   fio na **5.6**. Alternativa rejeitada: deployar a function na F0 — tiraria a F0 do "sem efeito em
   produção" e poria os dois inquilinos vivos em risco por um campo.
2. A versão do descritor da retrospectiva é o par `prompt_versao`/`pacote_versao` que `edicoes_ia` já
   grava — nenhuma coluna nova.
3. O descritor da retrospectiva **admite só motor de nuvem**, com cadeia padrão `nuvem:padrao` →
   `sem-modelo`. É o único motor aprovado para ela hoje (AD-9: os recursos que existem entram
   aprovados para o modelo em produção), e nenhum motor de aparelho passou pela bancada para ela.
   Abrir para o aparelho depois é uma linha no descritor e uma rodada de bancada.
4. O `regimeMaximo` da Saúde do sono é **nuvem** — a CAP-13 admite os três motores, a nuvem só por
   escolha explícita — e a cadeia padrão é **só `sem-modelo`** até a bancada aprovar um motor.
5. A vírgula da percepção é consertada **na origem**, em `sleep/score.ts`: a tela `/sono/saude`
   passa a mostrar `3,3/5`. É conserto de formatação, não mudança de desenho — se você preferir
   consertar só dentro da leitura, a tela fica como está.
6. Na 1.11, os estados seguem a partição que a AD-12 já faz: *reprovada* são as quatro causas
   permanentes — `reprovada`, `recusa-do-modelo`, `guarda`, `saida-invalida` —, cada uma dizendo o
   seu motivo, com "reimprimir este caderno" como ato do leitor; *erro* são as quatro passageiras —
   `indisponivel`, `capacidade`, `janela`, `transitoria` —, com "tentar de novo". Nunca o texto cru do
   fornecedor. **Trocada na aprovação:** a primeira versão punha as três permanentes que não são a
   conferência em *erro*, com "tentar de novo" — e a AD-4 diz que elas não se resolvem repetindo o
   mesmo pedido.
7. O literal `'STOP'` nasce **catraca** em 2 na 5.1 (fora a definição de `CONCLUSAO`), e não
   barreira: hoje ele está em `routes/nomear.ts` e `lib/edicao-ia.ts`.
8. Como a tela de desenvolvimento se alcança num build Release fica para a proposta visual da 5.5.
9. O `epic-5` entra no fim da yaml, em ordem numérica; a ordem real está no cabeçalho.

## 4. Propostas de mudança

### 4.1 `epics.md`

#### 4.1.1 Frontmatter — `inputDocuments`

Acrescenta, ao fim da lista:

```yaml
  - _bmad-output/planning-artifacts/architecture/architecture-Orbe-ia-no-aparelho-2026-09-10/ARCHITECTURE-SPINE.md
  - docs/decisions/0047-a-porta-do-motor-e-uma-so-e-a-ponte-do-aparelho-e-nossa.md
  - docs/decisions/0048-o-motor-e-escolhido-por-aparelho-e-a-lista-da-nuvem-e-do-servidor.md
  - docs/decisions/0049-o-motor-escreve-palavras-e-o-codigo-escreve-numeros.md
  - docs/specs/sono/spec.md
  - docs/specs/ia-analitica/spec.md
  - _bmad-output/planning-artifacts/sprint-change-proposal-2026-09-10.md
```

#### 4.1.2 Overview — parágrafo novo, depois do que explica `FR15`

> **Desde 10/09/2026 este arquivo carrega uma segunda frente.** O correct-course daquele dia
> ([proposta](sprint-change-proposal-2026-09-10.md)) pôs **os motores de IA** na sprint da revista
> como **Épico 5**, porque a story 1.10 passou a depender deles: a impressão da revista virou cliente
> do orquestrador (AD-13 da
> [espinha dos motores](architecture/architecture-Orbe-ia-no-aparelho-2026-09-10/ARCHITECTURE-SPINE.md)).
> O contrato do Épico 5 não é o `spec.md` da revista — é a CAP-13 do spec de Sono, o §4c do spec
> `ia-analitica` e as ADRs 0047–0049. Por isso os requisitos dele têm inventário próprio, com IDs
> prefixados (`M-`), e ficam fora da convenção `FR-N = CAP-N` da revista: a CAP-13 de lá não é a
> CAP-13 daqui.

#### 4.1.3 Requirements Inventory — seção nova, antes de `### FR Coverage Map`

```markdown
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
```

#### 4.1.4 FR Coverage Map — bloco novo, depois do da revista

````markdown
O Épico 5 tem mapa próprio, na mesma convenção:

```
M-FR1 (Sono CAP-13) → 5.3 (caso e template) · 5.5 (o botão e a frase no iPhone)
M-FR2 (Sono CAP-13) → 5.1 (porta, orquestrador, trilha) · 5.5 (quem escreveu, na tela)
M-FR3 (ADR 0048)    → 5.5 (escolha por aparelho) · 5.6 (a lista da nuvem)
M-FR4 (ADR 0047)    → 5.2 + 1.10 (a revista) · 5.7 (o nome de rota)
M-FR5 (AD-11)       → 5.4
M-FR6 (ADR 0047)    → 5.8
```
````

#### 4.1.5 Epic List

**Antes:**

> Quatro épicos, na ordem de entrega. A estrutura passou por uma mesa de party mode em
> 08/09/2026 e mudou três vezes; o que está abaixo é o que sobreviveu.

**Depois:**

> Cinco épicos. Os quatro primeiros são a revista, na ordem de entrega — a estrutura passou por uma
> mesa de party mode em 08/09/2026 e mudou três vezes; o que está abaixo é o que sobreviveu. O quinto,
> os motores, entrou em 10/09 por correct-course e **intercala** com o primeiro (ver a nota dele).

E, depois do Épico 4 da lista:

```markdown
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
```

#### 4.1.6 Story 1.9 — a nota e um critério

**Antes** (a nota):

> **Entrega única, dois commits.** A migração e o build que lê a forma nova **não podem ser
> entregues em momentos diferentes** (AD-15): `fetchEdicao` termina em `.maybeSingle()`
> sobre quatro colunas, e no instante em que `caderno` entra na chave ele passa a casar até
> quatro linhas e quebra o app instalado. Instância Supabase única, sem OTA. Se o trabalho
> não couber numa sessão, parta em commits — nunca em entregas.

**Depois:**

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

**Antes** (critério):

> **Given** a migração aplicada em produção — instância única, sem OTA
> **When** o build novo é instalado e a Retrospectiva é aberta no aparelho

**Depois:**

> **Given** a migração aplicada em produção — instância única, com o JS novo entregue por build ou
> por `eas update`
> **When** o JS novo está ativo no aparelho — o build instalado, ou o update no segundo lançamento —
> e a Retrospectiva é aberta

#### 4.1.7 Story 1.10 — reescrita

**Antes:** a story atual (`epics.md`, "Story 1.10: A sequência da impressão sobe para o núcleo"): três
portas — narrar, ler e gravar —, `edicao-ia.ts` emagrece para as portas de plataforma, barreira do
`upsertEdicao`, teste com portas falsas, "mostrar é progressivo, gravar é atômico".

**Depois:**

```markdown
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
**Then** ela chama `ler(descritorDaRetrospectiva, fatos, { modo: 'produto', cadeia, motorPara, registrar, agora })` uma vez por caderno
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
**Then** **mostrar é progressivo, gravar é atômico**: a escrita é do **conjunto inteiro**, numa
chamada só
**And** gravar de um caderno por vez é proibido — daria posição 1, depois 1 e 2, recalculando a ordem
de um conjunto que ainda está crescendo, e quebraria a contiguidade que a AD-4 exige
**And** isto está escrito porque o caminho natural de quem implementa é orquestrar-e-gravar em laço
```

#### 4.1.8 Story 1.11 — um critério novo, depois do dos sete estados

```markdown
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
```

#### 4.1.9 Story 2.1 — nota nova, antes dos critérios

```markdown
> **Quem chegar primeiro cria** (correct-course de 10/09; AD-11 dos motores). Se a 5.4 — a bancada —
> chegar antes, é ela que cria este workspace, sob exatamente os critérios abaixo, e a 2.1 encolhe
> para **conferir**: o backfill entra nele sem dependência nova não declarada, e as guardas já o
> enxergam. O diretório `scripts/` já existe com as ferramentas em Python do GitHub; o workspace as
> envolve, e elas não entram no `tsc`.
```

E, no primeiro critério, **antes:** "**When** o hospedeiro do backfill nasce" → **depois:**
"**When** o hospedeiro de scripts nasce — pela bancada ou pelo backfill, quem chegar primeiro".

#### 4.1.10 Story 2.2 — o primeiro critério e o de autenticação

**Antes:**

> **Given** a sequência do núcleo recebe três portas (Story 1.10)
> **When** o script as liga ao que ele tem
> **Then** ele imprime uma edição sem duplicar uma linha da sequência

**Depois:**

> **Given** a impressão é cliente do orquestrador, e o motor de nuvem é um só no núcleo,
> `criarMotorDeNuvem(invocar)` (Story 1.10; AD-14 dos motores)
> **When** o script imprime
> **Then** do lado do modelo ele **só injeta `invocar`** — o transporte até a `ia-narrar`, com o JWT
> da sessão dele —, e liga `buscar` e `gravar` ao client dele
> **And** não escreve cliente da `ia-narrar`, não lê corpo de erro e não traduz classe: isso é do núcleo
> **And** imprime uma edição sem duplicar uma linha da sequência

No critério de autenticação, acrescenta:

> **And** a sessão é a mesma que a bancada usa — quem chegar primeiro entre a 5.4 e a 2.2 a escreve
> no workspace

#### 4.1.11 Seção nova — `## Epic 5: Os motores`, depois do Épico 4

```markdown
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
```

### 4.2 `sprint-status.yaml`

**Cabeçalho** — bloco novo, depois do bloco do portão de 08/09 (o de 08/09 fica como registro):

```yaml
# CORRECT-COURSE — 10/09/2026: os motores de IA entram nesta sprint (Épico 5).
# ============================================================================
# Proposta: _bmad-output/planning-artifacts/sprint-change-proposal-2026-09-10.md
# A ordem passa a ser:
#   · 1.7, 1.8 e o ensaio da migração seguem como estavam. 5.1 → 5.2 → 5.3 (F0,
#     núcleo sem modelo) correm EM PARALELO: sem deploy, sem tela, sem banco.
#   · 5.4 (F1, bancada) depois de 5.1 e 5.3. O MARCO A dela — orquestrador em
#     modo medição, colunas sem modelo e nuvem — é portão da 1.10. O MARCO B —
#     a coluna do aparelho, macOS 27 a partir de 14/09 — NÃO segura a revista.
#   · 1.9 como estava. A 1.10 só depois de 1.9, 5.1, 5.2 e a 5.4 no marco A.
#   · 5.5 (F2, ponte + botão) depois da 1.9, em BUILD PRÓPRIO — nunca no da
#     migração. Entre 5.5 e 1.10 a ordem é livre: quem chegar primeiro cria
#     mobile/src/lib/motores/.
#   · 5.6, 5.7 e 5.8 (F3–F5) são da PRÓXIMA sprint.
```

**Comentário da 1.9** — antes:

```yaml
  # Risco 9, o mais alto da frente. ENTREGA ÚNICA: a migração e o build que a lê
  # não podem sair em momentos diferentes (AD-15) — instância única, sem OTA.
```

Depois:

```yaml
  # Risco 9, o mais alto da frente. ENTREGA ÚNICA: a migração e o JS que a lê
  # não podem sair em momentos diferentes (AD-15) — instância única. HÁ OTA
  # (corrigido em 10/09: runtime 1.0.5, canal preview), mas o update só vale no
  # SEGUNDO lançamento e, publicado antes da migração, quebra do outro lado.
  # É a ÚNICA migração do Épico 1: coluna que a AD-12 dos motores pedir entra
  # aqui, e o CHECK de motivo_de_parada só muda junto com a guarda (6) da 5.1.
```

O resto do comentário da 1.9 (ensaio fora de produção, o raio dobrado) fica.

**Comentário novo, acima da 1.10:**

```yaml
  # MUDOU DE ESCOPO em 10/09 (AD-13 dos motores): cliente do orquestrador, duas
  # portas (buscar e gravar), só origem 'motor' grava. Só depois de 1.9, 5.1, 5.2
  # e a 5.4 no marco A.
```

**Comentários novos, acima da 2.1 e da 2.2:**

```yaml
  # Encolhe se a 5.4 chegar antes: quem chegar primeiro cria o workspace scripts/.
  2-1-o-quarto-workspace-e-a-barreira-que-o-enxerga: backlog
  # Do lado do modelo, só injeta `invocar` (AD-14 dos motores).
  2-2-o-script-imprime-uma-edição-e-ela-é-idêntica-à-do-telefone: backlog
```

**Épico 5**, no fim:

```yaml
  # ── Épico 5: os motores — entrou em 10/09 por correct-course ──────────────
  # A ordem real está no cabeçalho; aqui fica em ordem numérica.
  epic-5: backlog
  # F0 — núcleo sem modelo. Sem deploy e sem tela. Em paralelo com 1.7–1.9.
  5-1-a-porta-o-fio-e-o-orquestrador: backlog
  5-2-o-descritor-da-retrospectiva-e-as-listas-com-dono: backlog
  5-3-a-leitura-da-saúde-do-sono-sem-modelo: backlog
  # F1 — dois marcos. O A é portão da 1.10. O B espera o macOS 27 (14/09) e o
  # risco aberto do Xcode 26.6: se ele não abrir no 27, a story para e volta ao
  # dono. ⚠ PORTÃO HUMANO no fim — o relatório é lido por ele, e o limiar é dele.
  5-4-a-bancada-no-mac: backlog
  # F2 — depois da 1.9, build próprio, sobe runtimeVersion. PRÉ-REQUISITO:
  # proposta visual com mockups e dados reais, aprovada (regra de 04/09).
  5-5-a-ponte-o-botão-ler-e-a-escolha-do-motor: backlog
  # ▼ PRÓXIMA SPRINT (F3–F5). Estão aqui para aparecer no quadro, não para começar.
  5-6-vários-motores-de-nuvem: backlog
  5-7-o-nome-de-rota-pela-porta: backlog
  5-8-core-ai: backlog
  epic-5-retrospective: optional
```

E `last_updated` passa para a hora da aplicação.

### 4.3 `epic-1-context.md`

- **Stories:** "Story 1.10: A sequência da impressão sobe para o núcleo" → "Story 1.10: A sequência da
  impressão sobe para o núcleo, como cliente do orquestrador".
- **Technical Decisions — as portas.** Antes: *"A sequência da impressão é do núcleo, com três portas
  injetadas — narrar, ler e gravar —, nunca um cliente de banco. Cada hospedeiro liga as portas ao
  que tem. […]"* Depois: *"**A sequência da impressão é do núcleo e é cliente do orquestrador dos
  motores** (correct-course de 10/09; AD-13 dos motores). Ela chama o orquestrador uma vez por caderno,
  com o descritor da retrospectiva, e recebe só duas portas — `buscar` e `gravar` —, nunca um cliente
  de banco; o modelo chega pelo `motorPara` do hospedeiro. Só resposta de motor grava, e piso é
  ausência. `upsertEdicao` passa a ser importável só pela sequência, por barreira: "verifica antes de
  gravar" deixa de ser promessa em comentário."*
- **Technical Decisions — a migração.** Antes: *"A migração e o build que a lê são uma operação só.
  Instância de banco única, sem OTA: […]"* Depois: *"**A migração e o JS que a lê são uma operação
  só.** Instância de banco única: […]. **Há OTA** — a premissa contrária foi corrigida em 10/09: o JS
  novo pode ir por `eas update` para o runtime 1.0.5, mas só vale a partir do segundo lançamento, e
  publicado antes da migração quebra do outro lado. […]"*
- **Cross-Story Dependencies**, dois itens novos:
  - **5.1, 5.2 e a 5.4 no marco A → 1.10** (Épico 5): a porta, o orquestrador e o descritor da
    retrospectiva existem antes de a impressão depender deles, e o caminho foi provado com dado real.
  - **1.10 ↔ 5.5**: ordem livre; quem chegar primeiro cria `mobile/src/lib/motores/`.

### 4.4 Espinha da revista (`architecture-Orbe-revista-2026-09-08`)

**AD-13** — nota acrescentada ao fim da Rule:

> **Apertada em 10/09/2026** pela AD-13 da
> [espinha dos motores](../architecture-Orbe-ia-no-aparelho-2026-09-10/ARCHITECTURE-SPINE.md)
> (correct-course do mesmo dia). A sequência não recebe mais a porta `narrar`: chama o orquestrador
> de `ia/orquestrar.ts` uma vez por caderno, com o descritor da retrospectiva, e o modelo chega pelo
> `motorPara` do hospedeiro. A porta `ler` passa a se chamar **`buscar`**. As portas injetadas passam a
> ser duas — `buscar` e `gravar` —, e a barreira do `upsertEdicao` fica como está.

**AD-15** — Prevents, antes:

> A instância do Supabase é única (AD-8 herdada) e não há OTA: aplicar a migração e
> ir dormir deixa a Retrospectiva do iPhone quebrada até o próximo build

Depois:

> A instância do Supabase é única (AD-8 herdada): aplicar a migração e ir dormir deixa
> a Retrospectiva do iPhone quebrada até o JS novo chegar. **Há OTA** — `expo-updates`
> ligado, `runtimeVersion` 1.0.5 fixo, canal `preview`
> ([`app.base.json`](../../../../mobile/app.base.json)); a premissa contrária, escrita em
> 08/09, foi corrigida em 10/09 —, mas ele encurta a janela, não a elimina: com
> `fallbackToCacheTimeout` no padrão (0), o update baixa num lançamento e só vale no seguinte

Rule, antes:

> a migração que muda a forma de leitura e o build que lê a forma nova
> entram **na mesma sessão de trabalho**, nessa ordem, com o build já compilado e
> pronto para instalar antes de a migração rodar. A janela é medida em minutos e
> declarada, não descoberta.

Depois:

> a migração que muda a forma de leitura e o JS que lê a forma nova entram **na
> mesma sessão de trabalho**, nessa ordem. O JS chega por um de dois caminhos: o
> **build**, já compilado e pronto para instalar antes de a migração rodar, ou o
> **`eas update`** para o runtime instalado, publicado **só depois** de a migração
> rodar — JS novo contra forma velha quebra do outro lado — e seguido de dois
> lançamentos do app. A janela é medida em minutos e declarada, não descoberta.
> Update que leva código da ponte dos motores nunca vai para runtime anterior
> (AD-3 dos motores).

O parágrafo "Dentro da migração a ordem também é fixa" fica.

**Structural Seed** — `ia/imprimir.ts # a sequência, com três portas injetadas (AD-13)` →
`# a sequência, cliente do orquestrador; buscar e gravar injetados (AD-13)`; e
`lib/edicao-ia.ts # emagrece: só as portas de plataforma (AD-13)` →
`# emagrece: buscar e gravar; o invocar vai para lib/motores/ (AD-13)`.

**`.memlog.md`** — linha nova:

```
- (event) CORRECT-COURSE 10/09/2026: os motores de IA entram na sprint como Epico 5 (proposta em ../../sprint-change-proposal-2026-09-10.md). Duas correcoes nesta espinha, nenhuma decisao reaberta. (1) AD-13 apertada pela AD-13 da espinha dos motores: a sequencia chama o orquestrador por caderno, a porta narrar some e ler vira buscar. (2) AD-15: a premissa 'nao ha OTA' estava errada — expo-updates ligado, runtimeVersion 1.0.5 fixo, canal preview (mobile/app.base.json:10-16). A regra fica; o eas update vira segundo caminho de fechar a janela, publicado so depois da migracao e valendo do segundo lancamento em diante (fallbackToCacheTimeout ?? 0, conferido em @expo/config-plugins 57.0.9).
```

### 4.5 Espinha dos motores (`architecture-Orbe-ia-no-aparelho-2026-09-10`)

Tabela *Inherited Invariants*:

- Linha "AD-12, AD-14 e AD-15 da revista": "[…] é desmentida por `app.base.json` (`updates.enabled`,
  `runtimeVersion` fixo) — vai ao correct-course" → "[…] — corrigida no correct-course de 10/09
  ([proposta](../../sprint-change-proposal-2026-09-10.md))".
- Linha "AD-13 da revista": "[…] Muda o escopo da story 1.10 e vai ao correct-course" → "[…] Mudou o
  escopo da story 1.10 no correct-course de 10/09".

**`.memlog.md`** — linha nova:

```
- (event) CORRECT-COURSE 10/09 (bmad-correct-course, modo batch; proposta em ../../sprint-change-proposal-2026-09-10.md). F0-F5 entram na sprint da revista como Epico 5, no mesmo epics.md e na mesma yaml, stories 5.1-5.8. Decisoes do dono: F0 em tres stories (5.1 porta+fio+orquestrador+criarMotorDeNuvem; 5.2 descritor da retrospectiva+VOCABULARIO_PROIBIDO+format/numero; 5.3 leitura da Saude sem modelo); F1 (5.4) com dois marcos e so o A (orquestrador em medicao, colunas sem modelo e nuvem) e portao da 1.10 — o B (aparelho, macOS 27) nao segura a revista; F2 (5.5) depois da 1.9 em build proprio; F3-F5 na proxima sprint, ja na yaml. Resolvido no correct-course: criarMotorDeNuvem nasce na 5.1 lendo tambem a ia-narrar de hoje, e a function so aprende o fio na 5.6 (a F0 fica sem deploy); quem chegar primeiro cria em quatro pontos — scripts/ (5.4 x 2.1), sessao JWT (5.4 x 2.2), mobile/src/lib/motores/ (1.10 x 5.5), Engine.swift (5.4 x 5.5); a versao do descritor da retrospectiva e o par prompt_versao/pacote_versao, sem coluna nova; a retrospectiva admite so nuvem; regimeMaximo da Saude e nuvem com cadeia padrao so sem-modelo ate a bancada.
```

### 4.6 `CLAUDE.md` — o bullet dos motores

Antes:

> A fase F0 (núcleo, sem modelo) tem de entrar **antes da story 1.10 da revista**, que passa a ser
> cliente do orquestrador (AD-13). A bancada de medição roda no Mac, com Mac e iPhone no 27.

Depois:

> Entrou na sprint da revista como **Épico 5** pelo correct-course de 10/09
> ([proposta](_bmad-output/planning-artifacts/sprint-change-proposal-2026-09-10.md)): a F0 (5.1–5.3) e
> o marco A da bancada (5.4) vêm **antes da story 1.10**, que passa a ser cliente do orquestrador
> (AD-13); a F2 (5.5) vem depois da 1.9, em build próprio; F3–F5 ficam para a próxima sprint. A
> bancada mede no Mac, com Mac e iPhone no 27.

## 5. Handoff

**Classificação: moderada.** Reorganiza o backlog e acrescenta um épico, sem replanejamento de
arquitetura — a arquitetura já foi feita e aprovada; esta proposta só a encaixa na sprint.

| Papel | Quem | Responsabilidade |
| --- | --- | --- |
| Product Owner | Sydnei | Aprovou em 10/09, com a #6 trocada e espelho no GitHub. Segue dono dos portões humanos da 5.4 (o limiar) e da 5.5 (a proposta visual e o veredito no iPhone) |
| Desenvolvimento | `bmad-build`, uma story por vez | Revista: 1.7 segue no worktree da revista. Motores: 5.1 num worktree próprio, a partir da `main` |

**O quadro do GitHub — decidido: com espelho.** O hook de pós-commit (`.githooks/post-commit`)
roda quando o commit toca a `sprint-status.yaml` e cria o milestone `revista-5-os-motores` e oito
issues com os rótulos `orbe`, `revista` e `epico-5`. As outras 27 issues não mudam, porque nenhum
estado mudou. Três razões, conferidas no código:

- **Adiar não evitaria nada.** O hook roda em qualquer commit que toque a yaml; sem espelho agora, as
  oito nasceriam no próximo, em outra sessão. E o sync grava `scripts/github/saida/mapa-revista.json`
  como efeito colateral — se esse arquivo não fosse commitado lá, o sync seguinte de outra árvore
  criaria as oito de novo. Feito agora, o mapa é commitado logo depois.
- **O rótulo `revista` é o certo na prática.** No README de `scripts/github/`, ele quer dizer "zona de
  execução: a yaml manda". E o campo Sprint do quadro, que uma sessão concorrente estava escrevendo em
  10/09, põe na sprint as issues `revista` em andamento ou aguardando veredito — com o rótulo, a 5.1
  entra sozinha quando começar, e F3–F5, em backlog, ficam fora.
- **O `quadro.py` desta worktree não pisa no da outra sessão:** não conhece o campo Sprint e mantém as
  mesmas cinco colunas.

O resto cosmético é o nome do milestone. Não renomeá-lo à mão: o sync o recria vazio na execução
seguinte.

**Critérios de sucesso desta mudança.**

- `epics.md`, a yaml, `epic-1-context.md`, as duas espinhas e o `CLAUDE.md` concordam entre si: nenhum
  deles descreve mais as três portas da 1.10 como o plano vigente, nem "não há OTA" como fato.
- A yaml carrega, e o ensaio do `sincronizar_sprint.py` lista exatamente oito stories novas e nenhum
  outro ajuste.
- A próxima story de cada frente está clara: **1.7** na revista, **5.1** nos motores.

**Armadilhas conhecidas para quem construir.** `architecture.test.ts` vai ser tocado pelas duas frentes
ao mesmo tempo — conflito de merge esperado, não sinal de problema. Validar cada branch num worktree
limpo do próprio commit antes da `main`. E a `main` local está 19 commits à frente do `origin/main`.
