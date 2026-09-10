# IA analítica — o contrato de contexto

> **O que este documento especifica:** não uma feature, e sim a peça que quatro features vão
> herdar. O parágrafo da Retrospectiva é o primeiro chamador; o chat é o último e o mais
> exigente. Escrever o contrato antes do primeiro chamador é o que evita descobrir o formato
> errado no terceiro.
>
> **Decisão de saída:** [ADR 0038](../../decisions/0038-a-chamada-ao-modelo-sai-da-edge-function.md)
> — edge function Supabase com a chave em `secrets`; Firebase não entra.

## 1. A lei herdada

Do [intent de 21/08](../../../_bmad-output/brainstorming/brainstorm-insights-ia-analitica-orbe-2026-08-21/brainstorm-intent.md), §3:

> **Estatística acha; LLM prioriza e narra.** Não é escolha entre os dois: são posições
> diferentes no pipeline.

Com endereço, isso vira: **o núcleo monta o pacote de fatos; o modelo escolhe qual deles é a
manchete e escreve a frase.** O modelo nunca calcula, nunca soma, nunca deriva um número que
não recebeu pronto, e nunca afirma causa.

A razão não é estilística. O dataset é de **uma** pessoa e poucos meses — é exatamente o
regime em que correlação espúria é a regra, não a exceção. `triggerImpact` já produz as
correlações de forma determinística e auditável; o que falta não é achar o número, é decidir
qual dos N merece o topo.

## 2. Os quatro consumidores

| # | Consumidor | Entrada | Frequência | Cacheável |
|---|---|---|---|---|
| 1 | Parágrafo da Retrospectiva | período fechado | ~68/ano (52 semanas + 12 meses + 4 estações) | **sim** |
| 2 | Leitura de sono | noite ou período | por botão (CAP-13 do spec de Sono) | **não** — efêmera, nunca gravada |
| 3 | Leitura de saúde/FC/esporte | período | por consulta | sim |
| 4 | **Chat** | pergunta livre sobre 10 módulos | imprevisível | **não** |

O quarto não está no escopo de construção, mas está no escopo de **desenho**: o usuário o
classificou como destino — *"será implementado em cima de tudo que tem no app"*. Um contrato
que só serve os três primeiros terá que ser reescrito para o quarto, e é isso que este
documento existe para evitar.

## 3. Edição, não cache

O usuário declarou a lei da Retrospectiva: **"é um jornal — informa, não aconselha."** Ela já
resolve o problema de invalidação, sem precisar de chave de cache.

Um jornal não reescreve a edição de terça. Se o fato muda, publica **errata** na quarta.

| Estado do período | O que acontece |
|---|---|
| **Fechado** (semana/mês/estação/ano encerrados) | edição publicada: o parágrafo é gerado uma vez, congela, e carrega a data de fechamento |
| **Em curso** (o período corrente, e sempre o modo `all`) | **sem parágrafo de máquina.** Mostra os números que já mostra hoje |
| Fechado, mas o dado embaixo mudou | não reescreve: **marca**. O `AGG_VERSION` que reprocessa até 500 dias gera errata, não reescrita |

Sem esta regra, o cache mente com confiança tipográfica: consultar "setembro" no dia 6 guarda
uma análise de seis dias sob um rótulo de trinta.

Confirmado pelo usuário em 06/09/2026.

## 4. O pacote de fatos

Um objeto único, montado pelo núcleo em `packages/shared`, puro e testável, com uma regra
inegociável: **todo número que aparecer na frase tem que estar no pacote**. Se não está, o
modelo não pode dizer.

```
PacoteDeFatos {
  periodo:    { tipo, inicio, fim, fechado: boolean, dias_com_dado }
  modulos:    { <modulo>: { metricas, delta_vs_anterior, cobertura } }
  correlacoes: [ { gatilho, metrica, delta_pct, n_com, n_sem, dentro_do_portao } ]
  eventos:    [ { data, tipo, rotulo } ]     // meia maratona, viagem, dia atípico
  lacunas:    [ { modulo, dias_sem_dado, motivo? } ]
  anterior:   PacoteDeFatos | null            // o período comparável
}
```

Quatro campos que existem por causa de erro conhecido:

- **`cobertura` e `lacunas`** — julho de 2026 tem **14 noites** de sono no banco e agosto tem
  **27**. Uma comparação de medianas entre esses dois meses é honesta só se disser isso. Sem
  cobertura no pacote, o modelo compara metade de um mês com um mês inteiro e nunca saberá.
- **`dentro_do_portao`** — o `triggerImpact` já tem os portões (`MIN_DAYS_PER_SIDE`,
  `MIN_CROSS_DELTA_PCT`). Uma correlação reprovada pode ir no pacote, mas marcada; o modelo
  não pode promovê-la a manchete.
- **`eventos`** — sem eles, uma meia maratona vira "corrida de 21 km" e o mês perde o fato
  que o organiza.
- **`anterior`** — comparação é do núcleo, não do modelo. Ele recebe os dois lados prontos.

## 4b. A costura de provedor

> **Requisito do usuário, 06/09/2026:** *"a empresa e os modelos poderão ser alterados com o
> tempo."* Formalizado na
> [ADR 0040](../../decisions/0040-o-provedor-de-modelo-e-configuracao-nao-arquitetura.md).

Não é preferência — é a leitura correta da pesquisa. Em nove meses o Google cortou cota em 92%
sem aviso, reescreveu os termos, mudou o faturamento para Prepay, retirou tabelas da
documentação e anunciou o dobro do preço dos modelos 3.x a partir de 01/01/2027.

Quatro fronteiras, e nenhuma é opcional:

1. **O núcleo não sabe que existe modelo.** `packages/shared` produz o `PacoteDeFatos` e nunca
   importa SDK nem faz rede. Barreira cobrada no `architecture.test.ts`.
2. **Um adaptador por provedor**, atrás de `Narrador.narrar(pacote) → { texto, provedor,
   modelo, tokens }`. Trocar é escrever arquivo novo, não mexer no que existe.
3. **Sem SDK** — `fetch` contra a API HTTP. Todo provedor é um POST com JSON, e o SDK é
   justamente o que vaza a forma do fornecedor para dentro do código. As quatro edge functions
   do Orbe já não têm importação externa nenhuma.
4. **Cada edição carrega assinatura:** `provedor`, `modelo`, `gerado_em`. É a linha de crédito
   do jornal — sem ela, no dia da troca não há como saber qual parágrafo veio de qual cabeça.

Provedor e modelo vêm de `secrets` (`AI_PROVIDER`, `AI_MODEL`): trocar de modelo é um comando,
não um deploy.

**O regime de cada provedor é dado, não folclore.** Uma tabela por provedor — tier exigido, o
que pode ser enviado, retenção, DPA. O achado da Bélgica (o tier gratuito do Gemini é
contratualmente proibido para quem serve usuário na EEA) vai se repetir diferente em cada um.

**E o golden set é o que qualifica o candidato:** mesmo pacote de fatos, provedor novo, e as
três verificações da §5 continuam passando ou não. Trocar de provedor vira uma tarde, não uma
refatoração.

## 4c. Os motores (10/09/2026)

A costura de provedor desta seção ganhou dois vizinhos: o **modelo do aparelho** (Foundation
Models agora, Core AI no iOS 27) e o **sem modelo** (o template de cada recurso, que é também o
piso). O desenho está na [espinha dos motores](../../../_bmad-output/planning-artifacts/architecture/architecture-Orbe-ia-no-aparelho-2026-09-10/ARCHITECTURE-SPINE.md)
e em três ADRs:

- [0047](../../decisions/0047-a-porta-do-motor-e-uma-so-e-a-ponte-do-aparelho-e-nossa.md) — uma porta
  (`Motor`), um orquestrador que percorre a sequência, classes de falha do Orbe, recuo que nunca
  aumenta a exposição, a ponte Swift do projeto e o contrato da nuvem em `ia/fio.ts`;
- [0048](../../decisions/0048-o-motor-e-escolhido-por-aparelho-e-a-lista-da-nuvem-e-do-servidor.md) —
  o motor é escolhido por aparelho e por recurso, e a lista de motores de nuvem é do servidor
  (supera o período "provedor e modelo vêm de configuração" da ADR 0040);
- [0049](../../decisions/0049-o-motor-escreve-palavras-e-o-codigo-escreve-numeros.md) — o motor
  escreve palavras e o código escreve números, com três regimes (interpolado, copiado e conferido,
  molde).

A §3 deste spec ("período em curso: sem parágrafo de máquina") vale para recurso que **grava**. A
leitura de sono do consumidor 2 é efêmera, sob pedido, e lê período em curso.

## 5. Golden set

É aqui que a testabilidade mora, e é por isso que o contrato vem antes da chamada.

O que se testa **não** é a redação — é o pacote. Entrada fixa (período fechado, dado real),
saída esperada (conjunto de fatos, com os deltas certos e as lacunas declaradas). Isso é
teste normal, determinístico, no `packages/shared`, ao lado dos 621 que já existem.

Sobre a saída do modelo, três verificações mecânicas e baratas:

1. **Todo número citado existe no pacote.** Regex + comparação. Falhou, rejeita.
2. **Nenhuma palavra de causa** ("porque", "devido a", "causou") ligando duas métricas.
3. **Nenhuma correlação fora do portão** promovida a manchete.

O que resta — se a manchete escolhida é *a boa* — não é testável e não se finge que é. É
julgamento do leitor, que é uma pessoa só e está disponível.

## 6. Caso de trabalho: agosto de 2026

Escrito à mão, com os dados reais de produção, **antes de qualquer integração**. Serve a dois
propósitos: é o primeiro caso do golden set, e é o teste que a UX pediu — descobrir se o
usuário lê um parágrafo assim antes de construir a máquina que o escreve.

### Os fatos (produção, consultados em 06/09/2026)

| | Julho | Agosto |
|---|---|---|
| Atividades | 17 | **21** |
| Quilômetros | 862 | **435** |
| Horas | 68,2 | **40,1** |
| Pedaladas | 11 · 820 km | 7 · 333 km |
| Corridas | 2 · 21 km | **8 · 101 km** |
| Noites com dado | 14 | 27 |
| Sono (mediana) | 6,89 h | 7,03 h |
| Noites ≥ 7 h | 7 de 14 | 14 de 27 |
| Despertares (média) | 3,4 | 3,1 |
| Nota de sono | 3,39 | **3,72** |
| Nota do dia | 3,82 | **4,00** |
| Nota do dia — histórico | jun 3,91 · jul 3,82 · **ago 4,00** (máximo) | |
| Passos/dia | — | 17.350 |
| FC de repouso | — | 48,1 |
| VFC | — | 63,5 |

Eventos de julho: Tour de la Wallonie (151 km, 9,8 h) e Tour de la Meuse (114 km, 9,1 h).
Evento de agosto: **meia maratona** (21 km).

### O parágrafo

> **Agosto foi o mês em que você fez mais e pediu menos.** Vinte e uma atividades contra
> dezessete em julho — e, ainda assim, 435 km no lugar de 862, e 40 horas no lugar de 68.
> Julho foi um mês de bicicleta com dois eventos grandes dentro dele, a Tour de la Wallonie e
> a Tour de la Meuse, quase dezenove horas só nos dois. Agosto trocou de esporte: **oito
> corridas, 101 km, terminando numa meia maratona.**
>
> O sono acompanhou, e discretamente. A mediana subiu de 6h53 para 7h02 e os despertares
> caíram de 3,4 para 3,1 — movimento pequeno. **A sua nota de sono subiu cinco vezes mais que
> a medição**: de 3,39 para 3,72. A nota do dia fechou em 4,00 redondo — o mais alto desde
> que você começou a dar notas, em junho.
>
> Uma ressalva de leitura: julho tem 14 noites registradas e agosto tem 27. A comparação de
> sono é entre meio mês e um mês inteiro.

### Por que este parágrafo justifica a camada

Cada número acima **já está no app hoje**. Nenhuma tela diz o que está escrito ali, e o motivo
é estrutural: a Retrospectiva ordena destaques por `Math.abs(deltaPct)`, então "−49% de
quilômetros" enterra "a nota subiu 5× mais que a medição". O ranking por volume é cego para a
manchete.

**É exatamente o trabalho que a §3 do intent de 21/08 reservou para o modelo:** achar já
achamos; falta escolher qual dos N e escrever.

## 7. Fora de escopo aqui

- A redação do prompt e a escolha do modelo — vêm depois do pacote, e são as peças mais
  baratas de trocar.
- Limites do tier gratuito, validade na EEA, e se o tier gratuito treina com o conteúdo
  enviado. Não bloqueiam este desenho; bloqueiam o deploy. São o objeto da pesquisa que ficou
  em `draft` desde 21/08.
- O chat. Desenhado para, não construído agora.
