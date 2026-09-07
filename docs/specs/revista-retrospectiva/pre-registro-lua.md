# Pré-registro — lua × início do sono

> **Escrito em 07/09/2026, antes de qualquer consulta ao dado.** Nenhuma
> mediana, nenhuma contagem por fase e nenhum cruzamento lunar foi olhado antes
> deste texto. O único número consultado até aqui é a contagem total de noites
> (290), que não distingue fase.
>
> **Este arquivo é imutável.** Ele não é spec: spec descreve o que o software
> faz e muda quando o software muda. Um pré-registro é um **compromisso datado**
> — ele vale justamente porque não pode ser reescrito depois de ver o resultado.
> Correção só por documento novo, que cita este e diz o que mudou e por quê.

## 1. Por que isto existe

O dono do app declarou, no brief da revista: *"Achar padrões entre fases da lua
(caso haja). Pessoalmente, estou me observando nisso já faz um tempo."*

Essa segunda frase é o motivo do documento. **Há um prior declarado**, e um
sistema que procura o que o dono já acredita encontra. Some-se a isso a
aritmética: lua × 14 métricas de saúde já são 14 testes; com hábitos e registros
passa de 30. A 5%, o acaso entrega "achado" — e a camada que narra vai imprimi-lo
com a mesma tipografia de um fato medido.

Pré-registrar é a única saída que não depende de disciplina: fixar o desfecho, a
janela, a direção e o limiar **antes** de olhar, e assumir por escrito que o
resultado negativo se publica com o mesmo destaque do positivo.

## 2. O que a literatura decide (e o que ela não decide)

O campo é **contestado**, e o que importa aqui não é o placar — é o desenho.

| Estudo | Desenho | Resultado |
|---|---|---|
| **Cajochen 2013** | 33 pessoas, retrospectivo, laboratório | sono profundo −30%, latência +5 min, duração −20 min na cheia |
| **Cordi 2014** | 3 amostras, >23 mil noites, n≈1.265, retrospectivo | **falhou em replicar**; título nomeia o *file drawer problem* e relata múltiplos nulos não publicados |
| **Casiraghi 2021** (*Science Advances*) | actimetria de campo; Toba/Qom com e sem eletricidade + urbanos em Seattle; **mesmo indivíduo ao longo de ciclos** | sono **atrasado e mais curto nas noites que ANTECEDEM a cheia** |

Três consequências para este teste:

1. **O desenho copiado é o do Casiraghi**, porque é o único cujo poder vem de
   seguir o mesmo indivíduo por vários ciclos em vez de comparar pessoas entre
   si. É o que torna 290 noites de uma pessoa um desenho, e não uma anedota.
2. **A exposição é "antes da cheia", não "na cheia".** Testar a lua cheia é
   testar a hipótese folclórica, não a medida.
3. **A gaveta é o risco dominante do campo.** Por isso a §7 deste documento.

O que a literatura **não** decide: o mecanismo. A hipótese usual é luz noturna, e
céu encoberto belga a maior parte do ano a enfraquece. Este teste **não afirma
causa** — por lei da casa e por honestidade.

## 3. O desenho

| | |
|---|---|
| **Sujeito** | um indivíduo; `sleep_periods`, 23/04/2025 → 07/09/2026 |
| **n** | 290 noites (58% de cobertura do intervalo; o buraco até 18/07/2025 é a perda do Apple Watch) |
| **Desfecho primário — um só** | **hora de apagar**, em minutos desde a meia-noite |
| **Exposição** | as **5 noites que antecedem a lua cheia** (fase −5 a −1 do sinódico), contra todas as outras noites |
| **Colunas** | duas. Não oito caixas de fase — oito caixas são oito testes |
| **Direção** | **atraso**. Unilateral, α = 5%. Adiantamento **não** conta como achado |
| **Covariável obrigatória** | horas de luz do dia na latitude do sujeito (~50,8° N) |
| **Teste** | comparação das medianas com covariável de luz; o portão da §4 decide se roda |

### Por que a hora de apagar, e não a duração

A duração dele é **contaminada por despertador**. A hora de acordar é imposta
(trabalho, compromisso, alarme). Se a lua atrasa o adormecer e a hora de acordar
não se move, a duração encurta por **consequência aritmética**, não por efeito
independente. A hora de apagar é a variável comportamentalmente livre: é onde o
efeito, se existir, aparece sem intermediário.

Duração, latência e despertares ficam como **secundários exploratórios** — §6.

### Por que a luz do dia é obrigatória, e não um refinamento

As 290 noites cobrem 502 dias de calendário: 9,5 meses de dado espalhados em
16,5 meses, com o verão de 2025 parcialmente ausente. **A cobertura sazonal é
desigual.** A janela lunar anda pelo calendário, e a luz do dia na Bélgica vai de
~8 h a ~16 h 30 — dobra. Se as noites da janela caírem desproporcionalmente numa
estação, e a hora de apagar variar com a luz, **um achado lunar é um achado
sazonal com outro nome**.

Sem horas de luz como covariável, este teste não roda. Não é ressalva; é
pré-requisito.

## 4. Os portões — o teste só roda se todos passarem

1. **Amostra por coluna:** ≥ 5 noites de cada lado (`TRIGGER_MIN_PER_CELL`, a
   regra das duas colunas que o repositório já aplica em `sleep/triggers.ts`).
   Estimativa: ~49 dentro, ~241 fora. Passa com folga.
2. **Ciclos distintos:** ≥ **10** dos ciclos sinódicos do intervalo precisam
   contribuir com ao menos uma noite na janela. 290 noites em 17 ciclos dá ~17
   noites por ciclo de 29,5 — **cada ciclo está pela metade**, e as 49 noites da
   janela podem vir de oito ciclos, não de dezessete. Oito replicações internas é
   menos do que o desenho promete.
3. **Luz do dia disponível** para todas as noites de ambas as colunas.

Portão reprovado ⇒ o resultado é **inconclusivo** (§5), nunca "nenhum padrão".

## 5. Os três resultados — todos publicáveis, na mesma página

O limiar prático é **15 minutos** de atraso mediano. Um efeito estatisticamente
significante e **menor** que 15 min é relatado como **nulo prático**: existe no
teste, não existe na vida.

| Veredito | Condição | O que a página diz |
|---|---|---|
| **Achado** | ≥ 15 min de atraso · p < 0,05 unilateral · poder ≥ 80% | o efeito medido, sem mecanismo e sem causa |
| **Nenhum padrão** | não significante **com poder ≥ 80%** | não há efeito detectável de 15 min ou mais |
| **Inconclusivo** | poder < 80%, ou qualquer portão da §4 reprovado | **quantas noites faltam** |

**"Nenhum padrão" e "inconclusivo" não são a mesma coisa**, e confundi-los é o
erro mais fácil deste documento. Um teste com poder que não acha nada é
informação. Um teste sem poder que não acha nada é silêncio — imprimi-lo como
"nenhum padrão" seria mentir com o mesmo tom de voz.

### Poder, calculado antes de olhar

n = 49 dentro × 241 fora, unilateral, α = 5%:

| SD da hora de apagar | efeito mín. detectável (80%) | poder p/ 15 min | poder p/ 30 min |
|---|---|---|---|
| 30 min | 11,7 min | 94% | 100% |
| 45 min | 17,5 min | 69% | 100% |
| 60 min | 23,4 min | 48% | 94% |
| 75 min | 29,2 min | 36% | 82% |
| 90 min | 35,1 min | 28% | 69% |

Noites totais para 80% de poder em 15 min: **396** (SD 45) · **706** (SD 60) ·
**1.101** (SD 75). Ele tem 290. Em dispersão alta, o veredito **inconclusivo** é
o resultado mais provável desta primeira execução — e isso é aceito por escrito,
aqui, antes de rodar.

### O único número que pode ser consultado antes

**O desvio-padrão da hora de apagar**, marginal, sem separar por fase. Ele é
permitido porque dispersão não carrega informação sobre a hipótese: revela se o
teste tem poder para existir, sem revelar o resultado. Olhar a **mediana por
fase** contamina o pré-registro e o invalida.

## 6. Secundários — exploratórios, e nunca de capa

Duração, latência e número de despertares. Relatados **marcados como
exploratórios**, sem valor de p promovido a manchete, e sem entrar na capa da
edição sob nenhuma condição. Existem para uma execução futura com poder, não para
esta.

Fora do escopo por decisão explícita: as 14 métricas de `health_daily`, hábitos e
registros. Testá-los contra a lua é o caminho direto para as 30 comparações que
este documento existe para evitar.

## 7. Contra refazer até dar certo

Não se impede — o dono tem o banco, o repositório e o app, e o dado é dele.
O que se faz é **tornar cada tentativa permanente e contável**:

1. Este arquivo é o único autorizador. Sua **sha256** entra no código como
   constante; o executor compara antes de rodar.
2. Toda execução grava linha em `edicoes_ia` com `caderno='lua'` **e o hash do
   pré-registro que a autorizou**. Nunca substitui — **acumula**.
3. Hash divergente com execução já gravada ⇒ **o build quebra**
   (`architecture.test.ts`). Não para impedir: para obrigar a dizer em voz alta
   que o teste mudou depois de ver o resultado. Mesma mecânica das leis do brief
   — quem derruba uma, derruba declarando.
4. **A página mostra o contador de execuções.** Se foram seis, a página diz
   *sexta execução*.
5. **Cadência pré-fixada:** reexecuta a cada **+100 noites**, não por vontade.

## 8. Onde isto aparece na revista

Não é caderno. É uma **página dentro do caderno Sono**, com a data da próxima
execução impressa nela. Caderno próprio pressupõe conteúdo recorrente por
período; este teste roda a cada cem noites. Um caderno que aparece uma vez por
ano e repete a mesma frase é uma promessa quebrada doze vezes — e pressão para
ter o que dizer todo mês é exatamente o mecanismo que produz o problema da gaveta.

## Fontes

- Cajochen et al. (2013), *Evidence that the lunar cycle influences human sleep* — [PubMed](https://pubmed.ncbi.nlm.nih.gov/23891110/)
- Cordi et al. (2014), *Lunar cycle effects on sleep and the file drawer problem* — [Current Biology](https://www.sciencedirect.com/science/article/pii/S0960982214005429)
- Casiraghi et al. (2021), *Moonstruck sleep: Synchronization of human sleep with the moon cycle under field conditions* — [Science Advances](https://www.science.org/doi/10.1126/sciadv.abe0465)
- Smith, Croy & Persson Waye (2015), *Bad sleep? Don't blame the moon! A population-based study* — [Sleep Medicine](https://www.sciencedirect.com/science/article/abs/pii/S1389945715008916)
