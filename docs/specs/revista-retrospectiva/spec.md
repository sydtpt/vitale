---
id: SPEC-revista-retrospectiva
companions:
  - cadernos.md
  - bases-e-ranqueamento.md
  - mudancas-mecanicas.md
  - pre-registro-lua.md
  - correcao-pre-registro-lua.md
  - ../../../_bmad-output/planning-artifacts/ux-designs/ux-revista-retrospectiva-2026-09-07/DESIGN.md
  - ../../../_bmad-output/planning-artifacts/ux-designs/ux-revista-retrospectiva-2026-09-07/EXPERIENCE.md
  - ../../../_bmad-output/planning-artifacts/architecture/architecture-Orbe-revista-2026-09-08/ARCHITECTURE-SPINE.md
sources:
  - ../../../_bmad-output/planning-artifacts/revista-retrospectiva-corte-v1.md
  - ../../../_bmad-output/planning-artifacts/revista-retrospectiva-brief.md
---

> **Contrato canônico.** Este SPEC e os arquivos em `companions:` são o contrato
> completo do que construir, testar e validar. Os documentos em `sources:` servem à
> rastreabilidade — consulte-os só se precisar da narrativa que este contrato omite de
> propósito.

# A Retrospectiva vira revista

## Why

Hoje a Retrospectiva imprime **um** parágrafo por período fechado. Funciona, está em
produção desde 06/09/2026, e o parágrafo é seco — não porque o prompt seja ruim, mas
porque o pacote de fatos é magro: a camada que narra recebe `{ resumo, agora }` e nada
mais.

Atrás dela há um balde de dado **já pago, já gravado e invisível para a narrativa**:
1.210 fotos com hora e parada, 174 cidades, 138 rotas com piso, 179 dias de FC por
minuto, 554 conjuntos de recordes, o sono inteiro (SRI, jetlag social, as cinco
dimensões, os gatilhos que mediram cerveja em −33 min), 551 ocorrências de tarefa e as
correlações que rodam na tela e não entram no pacote.

Isto é **uma visão a realizar** — uma revista que se relê, com vários cadernos por
período e mais profundidade quanto maior o período — somada a **uma oportunidade a
capturar**: nada disso exige que o dono mude um hábito, e sol e lua, sendo função pura
de data e lugar, retroagem até 22/05/2023 de graça. O afetado é um usuário só, que
declarou esta seção como "uma das mais importantes do app no futuro".

O prazo é dado por dois fatos. A luz do dia na Bélgica vai de ~8 h a ~16 h 30 — dobra
—, e **sem baseline sazonal a revista não separa "você fez menos" de "você fez menos
do que costuma fazer em novembro"**. E o dono tem um prior declarado sobre a lua, o
que torna a disciplina de pré-registro parte do desenho e não um refinamento.

## Capabilities

- **CAP-1 — a edição é composta de cadernos**
  - **intent:** um período fechado produz vários textos independentes, cada um com sua
    assinatura, sua verificação e sua posição, em vez de um texto único.
  - **success:** a edição de um mês existe como quatro linhas em `edicoes_ia` sob a
    chave `(user_id, tipo_periodo, inicio, fim, caderno)`; marcar errata no caderno de
    Sono não altera a linha do de Movimento.

- **CAP-2 — quatro cadernos e uma capa**
  - **intent:** o leitor lê Sono, Movimento, Coração e Rotina como seções distintas,
    cada uma com o dado que lhe pertence.
  - **success:** cada campo do catálogo em [`cadernos.md`](cadernos.md) aparece no
    caderno indicado, e nenhum dado do balde da §3.2 do brief fica órfão.

- **CAP-3 — um pacote de fatos por caderno**
  - **intent:** cada caderno é narrado a partir de um pacote restrito ao seu próprio
    assunto.
  - **success:** `montarPacote` produz um pacote por caderno; o pacote de Sono não
    contém nenhum número de ciclismo, e `valoresDoPacote` de cada caderno é menor que
    o do pacote único equivalente.

- **CAP-4 — três bases nomeadas e trajetória**
  - **intent:** cada número pode ser comparado com o período anterior, com o mesmo
    período do ano anterior e com a normal do usuário para aquele período; e a direção
    ao longo de vários períodos é um fato à parte.
  - **success:** `FatoNumero` carrega `bases[]` identificadas por id; `FatoTendencia`
    produz direção, número de períodos e desde quando, e o caderno Rotina — sem B2 e
    sem B3 até mai/2027 — ainda assim recebe comparação.

- **CAP-5 — o texto é obrigado a nomear a base**
  - **intent:** um número citado sem dizer contra o quê não pode virar edição.
  - **success:** a quinta regra de `verificar.ts` reprova base citada sem nome; um
    texto que inverte B1 e B2 reprova, e um teste prova que a regra morde.

- **CAP-6 — a luz do dia é camada em todos os cadernos**
  - **intent:** todo pacote carrega as horas de luz do período e o delta contra o
    mesmo período do ano anterior, para que a narrativa não confunda estação com
    comportamento.
  - **success:** o fato de luz aparece nos quatro pacotes, é derivado na leitura sem
    gravar coluna, e existe para qualquer data desde 22/05/2023.

- **CAP-7 — a ordem do miolo é ranqueada e congela na impressão**
  - **intent:** o caderno com a história do período lidera a edição, e a edição
    impressa não se reordena por conta própria — só um ato explícito de reimprimir a
    reordena.
  - **success:** `ordenarCadernos` é pura e determinística sobre entradas conhecidas;
    `posicao` é gravada na impressão, e reabrir uma edição fechada seis semanas depois
    devolve a mesma ordem mesmo que a função tenha mudado. Reimprimir **um** caderno
    recalcula e regrava a ordem do conjunto inteiro, em transação.

- **CAP-8 — o sumário é a lista de chamadas**
  - **intent:** o leitor decide em qual caderno entrar lendo a manchete de cada um, não
    o nome de cada um.
  - **success:** o sumário mostra quatro chamadas reaproveitadas dos cadernos, sem
    gerar texto novo, e cada linha leva ao seu caderno. A chamada é **a primeira frase
    do texto do caderno**, cortada no primeiro ponto final — extração mecânica, sem
    campo novo e sem valor novo a verificar.

- **CAP-9 — três formas por tipo de período**
  - **intent:** semana, mês/trimestre e ano são objetos diferentes, não a mesma forma
    em profundidades diferentes.
  - **success:** a semana rende um postal de uma tela, sem sumário e sem edição
    gravada; mês e trimestre rendem a edição completa; o ano abre pela série mensal
    antes de qualquer texto e traz extremos datados. Cada série mensal mede **o fato
    que liderou o ranqueamento daquele caderno**, mês a mês — a tira e a ordem falam
    do mesmo número.

- **CAP-10 — a capa, com foto ou com traçado**
  - **intent:** cada edição tem uma imagem que diz onde o período aconteceu, inclusive
    nos períodos anteriores às fotos.
  - **success:** a capa usa `coverOf` quando há foto e o traçado do período quando não
    há; a foto escolhida é **carimbada na impressão**, para que a capa congele junto com
    o texto; o arquivo é navegável como parede de capas em vez de seletor de data.

- **CAP-11 — a ausência é fato declarado**
  - **intent:** a revista sabe e diz quando ficou cega, e some quando não há o que
    dizer.
  - **success:** caderno vazio não aparece; métrica morta aparece como lápide no pé do
    seu caderno e lidera **só** na edição do período em que morreu; base inexistente
    entra no pacote como fato, e nenhuma edição narra silêncio como estabilidade.
    **A lápide vence o vazio:** um caderno cujo único conteúdo é a lápide existe e
    lidera — senão a morte da métrica se apagaria exatamente no período em que ocorreu.

- **CAP-12 — a página da lua sob pré-registro**
  - **intent:** o teste lunar é executado sob um protocolo fixado antes de olhar o
    dado, e os três resultados possíveis são publicáveis com o mesmo destaque.
  - **success:** a página imprime moldura fixa (janela, desfecho, contagem de noites e
    ciclos, próxima leitura), o veredito correto entre *achado* / *nenhum padrão* /
    *inconclusivo com noites faltantes*, e o contador de execuções; o build quebra se o
    hash do pré-registro divergir com execução já gravada. As execuções vivem em
    **`lua_execucoes`**, tabela própria — em `edicoes_ia` o CHECK recusa `caderno='lua'`,
    a chave primária impede o *acumula, nunca substitui*, e o teste roda sobre todo o
    histórico, que não é nenhum `tipo_periodo` existente.

- **CAP-13 — o arquivo histórico pode ser impresso em massa sem o aparelho**
  - **intent:** as edições de todos os períodos fechados desde 22/05/2023 passam a
    existir sem depender de alguém folhear o app no telefone.
  - **success:** as 436 edições são impressas por um hospedeiro que não é o aplicativo,
    verificando antes de gravar, com assinatura completa e leituras paginadas; a edição
    de agosto assim produzida é idêntica à que o telefone produz.

- **CAP-14 — o leitor pode silenciar um caderno**
  - **intent:** o leitor pode dizer "este caderno nunca", que é a forma de discordar da
    revista.
  - **success:** silenciar um caderno persiste nas preferências do leitor **sem
    migration**, e um caderno silenciado não aparece nem quando o ranqueamento o
    colocaria em primeiro. Silenciar caderno e esconder bloco da Retrospectiva são
    dois atos independentes: um não arrasta o outro.

## Constraints

- **É um jornal: informa, não aconselha.** Não recomenda, não motiva, não parabeniza.
  Escolher qual fato lidera é jornalismo; dizer o que fazer com ele não é.
- **Estatística acha; o modelo prioriza e narra.** Nunca calcula, nunca deriva número
  que não recebeu pronto, nunca afirma causa.
- **Todo número citado existe no pacote**, por verificação mecânica e numérica exata.
- **Cobertura desigual obriga ressalva no texto.**
- **Período fechado congela.** Dado que muda vira errata, não reescrita. `all` não tem
  edição, e o CHECK do banco recusa.
- **Provedor e modelo são configuração** (ADR 0040). Núcleo puro, sem SDK e sem rede,
  com barreira no `architecture.test.ts` — inclusive contra nome de fornecedor em
  literal de string.
- **A camada narra, nunca decide.** Nenhuma ação automática a partir de inferência de
  saúde.
- **Mobile-first.** Se não está no celular, ele não vê.
- **A revista nunca gera sozinha.** Abrir a retro só lê; imprimir é ato do usuário,
  senão folhear seis meses dispara seis chamadas pagas.
- **O sol é pré-requisito da lua.** Sem horas de luz como covariável o teste lunar não
  roda: as 290 noites cobrem 502 dias (58%), com o verão de 2025 parcialmente ausente,
  e a janela lunar anda pelo calendário — um achado lunar seria um achado sazonal com
  outro nome.
- **O pré-registro da lua é imutável**, sua sha256 é constante no código, e hash
  divergente com execução já gravada quebra o build. Reexecução a cada +100 noites, com
  contador visível.
- **A correção do pré-registro está escrita** —
  [`correcao-pre-registro-lua.md`](correcao-pre-registro-lua.md), 08/09/2026. O arquivo
  imutável não foi editado; ele próprio prescrevia a saída, *correção só por documento
  novo*. Ela corrige **duas** cláusulas do §7: a 7.2, porque `lua_execucoes` substitui
  `edicoes_ia`, e a 7.3, porque *"hash divergente **com execução já gravada**"* não é
  construível — a suíte roda offline e "execução gravada" mora no Postgres. §1 a §6 e §8
  ficam intocados, e a barreira do hash passa a valer **sempre**. Correção futura é
  documento novo, e a barreira pina a cadeia inteira.
- **Um bump de `AGG_VERSION` marca errata em todas as edições.** É global, e isso está
  certo: se a agregação mudou, toda edição anterior é potencialmente velha. O custo é
  declarado — uma errata em ~1.744 edições de uma vez é indistinguível de ruído.
  **Hoje esta restrição não vale**, e o conserto precede o backfill: `AGG_VERSION` é
  constante privada de um módulo do mobile, a edição grava `null` e a comparação devolve
  `false` para nulo — nenhuma edição em produção é elegível a errata. Sem consertar
  antes, o arquivo inteiro nasce inelegível e o conserto vira backfill do backfill. Ver
  `AD-16` da espinha.
- **Sol e lua são derivados na leitura, nunca gravados** — mesmo precedente do preço do
  hábito, o que os torna retroativos de graça.
- **`season` continua trimestre civil.** Estação não é período, é contexto; mover
  fronteira quebraria a edição de `season` já gravada em produção.
- **A ordem é coluna, não array**, e congela na impressão — **na última impressão**.
  Reabrir nunca reordena; só um ato explícito de reimprimir reordena, e ele recalcula e
  regrava o conjunto inteiro em transação, para que reimpressão parcial nunca choque com
  o `unique` da posição.
- **Mais números autorizados enfraquecem a verificação.** Medido: 71 valores no pacote
  de agosto, dos quais 16 são inteiros entre 0 e 100 — um inteiro alucinado nessa faixa
  passa 16% das vezes hoje, com uma base só. Quem acrescentar número tem que dizer como
  compensa.
- **O backfill pagina.** O PostgREST corta em 1000 linhas sem erro e `health_daily` tem
  4.385.
- **Verifica antes de gravar**, sempre, em qualquer hospedeiro.

## Non-goals

- **Captura nova de qualquer espécie** — presença, clima, humor ao longo do dia, café e
  álcool com hora, dor, viagem e fuso, dias de escritório, peso recorrente. É o épico 2,
  e só renderia análise a partir de mai–jun/2027.
- **As oito métricas que nunca chegaram** (pressão, IMC, gordura, massa magra, cintura,
  água, calorias/macros) e as tabelas zeradas `meals`, `transactions`,
  `planned_workouts`. Não falta código; falta fonte.
- **Web, PDF e e-mail.** A edição é texto gravado; essas três são renderização, não
  geração — ficam para depois sem custo de arquitetura.
- **Caderno de lua.** É página dentro do Sono: o teste roda a cada 100 noites, e um
  caderno que aparece uma vez por ano e repete a mesma frase é uma promessa quebrada
  doze vezes — pressão para ter o que dizer todo mês é o mecanismo que produz o problema
  da gaveta.
- **Caderno "Onde".** Dissolvido em capa + fatos de Movimento.
- **Base anual e normal sazonal para Rotina** antes de mai/2027.
- **Backfill em massa de semanas.**
- **Secundários da lua** (duração, latência, despertares) como manchete, e **lua × as 14
  métricas de saúde, hábitos e registros** — o caminho direto para as 30 comparações que
  o pré-registro existe para evitar.
- **Reordenação manual do miolo pelo leitor.** Aposentada por decisão do dono em
  07/09/2026, com `RetroPrefs.order` e a prova de gráfica por usuário saindo junto.
- **A investigação das quatro métricas mortas** (respiração 10/07, VO₂max 14/07, SpO₂
  16/07, anéis 17/08). A lápide narra o fato; diagnosticar a causa é trabalho
  independente.
- **Grounding / Search no modelo** (ADR 0040 — retenção de 30 dias em qualquer tier).

## Success signal

O dono abre no iPhone uma edição de mês **que já leu**, sem ser convidado a isso, e
consegue dizer qual caderno liderou e por quê — e a mesma edição, reaberta seis semanas
depois, devolve exatamente o mesmo texto e a mesma ordem.

Mecanicamente demonstrável no mesmo movimento: nenhuma edição gravada cita um número
sem nomear a base; nenhuma edição reordena ao reabrir; e a página da lua imprime seu
veredito — inclusive *"faltam cerca de 106 noites"* — com o mesmo corpo de letra de um
achado.

## Assumptions

- O backfill em massa cobre mês, trimestre e ano (436 edições, ~US$ 1,20 a US$ 4,80 ao
  preço medido de US$ 0,011/chamada), e a semana é impressa sob demanda porque o postal
  não grava edição.
- O desvio-padrão da hora de apagar ainda não foi consultado; o pré-registro autoriza
  essa consulta única, e ela decide se a primeira execução do teste lunar tem poder.
- As sete edições hoje em produção são removidas **junto com a migration**, não antes —
  hoje o caminho de leitura ainda as toca.
- **A emenda à ADR 0045 está escrita** —
  [`ADR 0046`](../../decisions/0046-a-linha-de-entrada-carrega-o-veredito.md), 08/09/2026,
  e o pré-requisito de construção está **cumprido**. Ela supersede **só a cláusula 3** da
  0045; as cláusulas 1, 2 e 4 seguem intactas. A página pode ficar atrás de um toque
  **enquanto** a linha de entrada carregar o veredito por extenso, idêntica nos três
  vereditos e no quarto estado — falhando qualquer uma das três exigências, a proibição
  original volta inteira. Nenhuma barreira mecânica sustenta essa ADR: nenhum teste sabe
  ler se uma frase nomeia um veredito, e isso está declarado nela em vez de fingido.
- **A efeméride usa uma coordenada de casa, única e fixa** (~50,8° N · Bélgica), definida
  em configuração. Viagem **não é modelada**: um período passado fora do país recebe a
  luz do dia da casa, não a do lugar onde o dono estava. Decidido pelo dono em 07/09/2026
  ("tratar como normal") por não haver ainda um modelo de lugar — o épico 2 (presença)
  é quem traz lat/long por dia, e só então isso pode mudar.

## Open Questions

**Nenhuma.** A última — CAP-14 — fechou em 08/09/2026 na passagem de arquitetura, que a
recebeu de propósito por ser decisão dela.

- **CAP-14 tem superfície.** Silenciar caderno mora em **chave própria no mesmo jsonb**,
  com `CadernoId` como vocabulário de dono único no núcleo; `RetroBlockId` **não** é
  alargado, porque um caderno herdaria `order`, `kinds` e `fixed` — e `order` é
  justamente a ordem do leitor que CAP-7 aposentou. *Sem migration* foi reconferido e
  continua verdadeiro: a coluna é jsonb sem CHECK de forma e a resolução já é defensiva.
  Ver `AD-2` da espinha.

### Correções de texto pendentes — nenhuma bloqueia

Achadas pela arquitetura, com a resposta certa já conhecida. Ficam registradas para não
serem lidas como decisão em aberto:

- [`mudancas-mecanicas.md`](mudancas-mecanicas.md) chama a efeméride de **"novo"**, e
  `packages/shared/src/astro/` já existe com `sun.ts`, `moon.ts` e `timezone-coords.ts`.
  O que falta é a agregação de luz por período e o instante das fases.
- O **§7.3 do pré-registro** segue enunciando uma barreira que não é construível. É o
  arquivo imutável; quem corrige é o documento de correção, e o §7.3 fica como está.
- **DESIGN.md e EXPERIENCE.md nomeiam `setAccessibilityFocus`**, que a documentação
  atual do React Native deprecou em favor de `sendAccessibilityEvent(ref, 'focus')`.
- A **janela lunar** do §3 é `fase −5 a −1`, que exclui a noite da cheia. A espinha
  chegou a escrevê-la fechada à direita e corrigiu; o contrato nunca esteve errado, mas
  o desvio se disfarça de ganho de precisão e por isso fica anotado.

- **As três da primeira derivação** foram resolvidas em
  07/09/2026: a coordenada virou a assunção acima; a ADR 0045 foi escrita
  ([`0045-o-resultado-negativo-publica-com-o-mesmo-destaque.md`](../../decisions/0045-o-resultado-negativo-publica-com-o-mesmo-destaque.md),
  numeração conferida contra todas as branches); e as quatro métricas mortas foram
  diagnosticadas por medição em produção — **troca de relógio, não cano quebrado**: a
  fonte da VFC migra de Apple para `intervals` em julho/2026, as horas de *stand* caem de
  11,6 (maio) para 5,0 (agosto) e os dias com anéis caem de 28 para 14 antes de parar.
  As quatro métricas mortas são exatamente as exclusivas do Apple Watch; as sobreviventes
  chegam pelo Garmin via intervals.icu. **A lápide segue necessária** — a revista continua
  tendo que dizer que ficou cega —, mas não há bug a consertar antes de construir.
