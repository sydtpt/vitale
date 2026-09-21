# 0050 — O limiar do portão sai de medição, e tem quatro condições

**Status:** aceita
**Data:** 2026-09-12
**Complementa:** [0047](0047-a-porta-do-motor-e-uma-so-e-a-ponte-do-aparelho-e-nossa.md),
[0048](0048-o-motor-e-escolhido-por-aparelho-e-a-lista-da-nuvem-e-do-servidor.md) e
[0049](0049-o-motor-escreve-palavras-e-o-codigo-escreve-numeros.md)
**Espinha:** [architecture-Orbe-ia-no-aparelho-2026-09-10](../../_bmad-output/planning-artifacts/architecture/architecture-Orbe-ia-no-aparelho-2026-09-10/ARCHITECTURE-SPINE.md) — AD-11

## Contexto

A ADR 0049 fechou **como** o motor escreve (o código decide o caso e os números; ele redige em volta) e
deixou em aberto **quando** um motor de modelo deixa de ser curiosidade e passa a ser o padrão de um
recurso. A regra escrita era de processo, não de número: "motor de modelo vira padrão só depois da
bancada, com limiar fixado pelo dono — nunca por agente".

Em 12/09/2026 a bancada (story 5.4, marco A) mediu pela primeira vez, sobre o acervo real de produção —
295 noites e 91 notas, 389 janelas enumeradas, o pedido idêntico ao que a tela vai montar:

| | sem modelo | nuvem (`nuvem:padrao`) |
|---|---|---|
| janelas medidas | 389 (todas) | 22 — duas por caso × alcance, as mais recentes |
| aprovadas pela conferência | — (é o piso) | **22 de 22** |
| reprovadas · recusas · falhas de rede | — | **0 · 0 · 0** |
| frases idênticas à do template | — | **0** |
| tamanho da frase (mediana) | 47 caracteres | **98** |
| tempo por chamada (mediana · pior) | 0 | **13,6 s · 25,8 s** |

Três fatos saíram daí, e é sobre eles que esta decisão se apoia:

- **O contrato do regime interpolado funciona com modelo grande.** Nenhuma reprovação, e os sete casos
  cobertos na noite e no período. O modelo escreveu marcador, nunca algarismo — a conferência de presença
  e a de vocabulário não barraram nada honesto.
- **O que o modelo acrescenta é a janela, não a análise.** Em todas as 22 ele diz *quando* e quantas
  dimensões foram medidas, e o resto é a mesma informação do template, em português melhor. É exatamente o
  que a 0049 manda, e é pouco — o que torna a pergunta "vale o botão?" legítima.
- **A leitura pela nuvem custa segundos,** não milissegundos. Para um botão, isso é espera que a tela
  precisa mostrar.

## Decisão

**Um motor de modelo vira padrão de um recurso quando passa nas quatro condições abaixo, na medição da
bancada, e o dono registra a aprovação.** As quatro valem juntas: falhar em uma só é não passar.

1. **Aprovação ≥ 90%** das janelas medidas na coluna daquele motor — aprovada é desfecho `ok` na
   conferência do descritor, não "pareceu boa".
2. **Cobertura da amostra:** os sete casos da CAP-13 presentes, **nos dois alcances** (noite e período).
   Amostra que não vê um caso não diz nada sobre ele — e é num caso raro que o modelo pequeno vai errar.
3. **Nada idêntico ao template:** nenhuma frase aprovada igual à do piso. Motor que reproduz o template
   não justifica rede, espera nem dependência; o piso já faz isso de graça e offline.
4. **Mediana de tempo por chamada ≤ 20 s**, na mesma medição. É teto de leitura sob toque, não de lote.

**Quem mede é a bancada, e o relatório é a prova.** O número vale para o par recurso × `MotorId` que foi
medido, com o manifesto registrado: trocar o modelo, o provedor ou o pedido pede medição nova. Nenhum
agente fixa, afrouxa ou contorna o limiar; nenhum código o lê para decidir sozinho.

**A nuvem da Saúde do sono passa** (100%, 0 idênticas, 13,6 s) e fica **aprovada como motor de modelo do
recurso** — o que a habilita a ser escolhida, não a ser imposta: a escolha continua sendo de cada aparelho,
por recurso (0048), e a cadeia padrão só muda quando a 5.5 entregar a escolha na tela.

## Alternativas rejeitadas

**Exigir 95% e mediana ≤ 10 s.** Mais seguro no papel, e hoje **reprovaria a nuvem pela latência** — o
template seguiria no comando até o motor do aparelho existir. Perdeu porque transformaria o limiar de
qualidade num limiar de infraestrutura: a espera é problema de tela (indicador de carregamento), e 10 s é
um teto que nenhuma leitura por rede cumpre com folga.

**Só qualidade, sem teto de tempo.** Perdeu porque leitura sob toque sem teto nenhum vira tela parada sem
contrato: sem um número, ninguém sabe quando a espera deixou de ser aceitável, e a regressão entra calada
num troca de modelo.

**Fixar o limiar por nota subjetiva do texto** ("a frase ficou boa"). Perdeu porque não se compara entre
duas medições nem entre dois modelos, e porque a ADR 0049 existe para tirar do modelo o que pode ser
medido. O julgamento humano continua no lugar certo: ele decide **se vale ligar**, lendo as frases lado a
lado; as quatro condições só dizem quando a pergunta pode ser feita.

**Exigir zero reprovação.** Perdeu porque a conferência é deliberadamente severa — ela reprova paráfrase
honesta quando a regra é lexical, e a 5.3 registrou isso. Um motor que erra 1 em 10 e cai no piso nas
outras 9 entrega leitura melhor que o piso em 90% dos toques, e o recuo é silencioso e imediato.

## Consequências

**O que custa.** Toda troca de modelo ou de provedor passa a exigir uma rodada da bancada antes de virar
padrão — alguns minutos e até 28 chamadas. E a amostra mínima força o acervo a ter os sete casos: num
acervo pequeno, a medição espera dado.

**O que paga.** O primeiro número publicado do Orbe sobre motor de IA, com procedência: manifesto, hash do
acervo e o pedido idêntico ao da tela. E um limiar que se aplica igual ao modelo do aparelho no marco B,
onde a reprovação é esperada — é lá que as quatro condições vão trabalhar de verdade.

**O que custa reverter.** Pouco: é um parágrafo de decisão, não código. Mudar os números pede ADR nova que
supersede esta, com a medição que a justifique — que é o ponto.

**O que isto não decide.** Se a Saúde do sono *vai* ler pela nuvem por padrão no iPhone: isso é da 5.5,
depois da proposta visual, e continua sendo escolha por aparelho. E nada sobre o motor do aparelho, que o
marco B vai medir quando o macOS 27 permitir.

---

## Emenda de 2026-09-21 — o pedido v2, medido nos dois motores

**O dono aprovou a nuvem no pedido v2.** A ADR 0050 diz que trocar o pedido exige medição nova; esta
emenda registra essa medição e a aprovação, sem mexer nas quatro condições nem nos números delas.

**Por que o pedido mudou.** Em 21/09 o modelo do aparelho foi medido pela primeira vez no próprio
iPhone (AFM 3 Core Advanced, iOS 27.0), sobre a amostra do Mac: **0 de 23**, com a regra do **marcador**
reprovando 36 vezes. O modelo *maior* fez pior que o menor do Mac (3 de 22, 12/09) — o que aponta para o
pedido, não para o modelo. O pedido v2 da story 5.11, escrito justamente para o marcador, foi então
medido nos dois motores, no mesmo dia e sobre o mesmo acervo (304 noites, manifesto `a9a66e37e443`):

| | pedido v1 | **pedido v2** |
|---|---|---|
| Aparelho — AFM 3 Core Advanced | 0 de 23 (0%) | **11 de 23 (47,8%)** |
| Aparelho — reprovações por marcador | 36 | **12** |
| Aparelho — mediana por chamada | 1,0 s | **0,9 s** |
| Nuvem — aprovação | 22 de 22 (12/09) | **23 de 23** |
| Nuvem — idênticas ao template | 0 | **0 de 23** |
| Nuvem — mediana · pior | 13,6 s · 25,8 s | **10,1 s · 18,4 s** |

**A decisão.** O v2 ganha nos dois lados: leva o aparelho de zero a quase metade e deixa a nuvem **3,5 s
mais rápida** sem perder aprovação. A aprovação da nuvem passa a valer para o par
`saude-do-sono × nuvem:padrao` **com o pedido v2**; a do v1 fica como história. A cadeia padrão do
recurso **não muda** — continua `[sem-modelo]`, e os motores de modelo entram por escolha no seletor.

**O aparelho segue reprovado**, agora com um alvo em vez de um muro: as falhas se concentram em três
combinações que nunca passam — `uma`, `tudo-no-maximo` e `fora-do-empate/noite` —, enquanto sete das doze
presentes na amostra já têm frase aprovada.

**Uma ressalva sobre a condição 2.** A amostra de 21/09 tem **12 das 14** combinações de caso × alcance:
`sem-contagem/noite` e `medidas-insuficientes/período` **não têm nenhuma janela no acervo**, e aumentar a
amostra não as cria. As 12 presentes foram todas aprovadas pela nuvem. A condição continua escrita como
está — quando o acervo produzir os dois casos que faltam, eles entram na medição seguinte.
