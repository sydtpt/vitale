# 0036 — Saúde do sono é contagem de dimensões, não placar

**Status:** aceita
**Data:** 2026-09-06
**Substitui:** o parágrafo "não existe nota de sono, score, streak" da §2 do
[spec de Sono](../specs/sono/spec.md)

## Contexto

A §2 do spec de Sono diz, desde 04/09/2026: *"A tela entrega o fato e para de falar. Não
existe nota de sono, score, streak, seta de tendência ou meta."* A decisão tinha três apoios,
e todos continuam de pé:

- o padrão nº 1 de reclamação da categoria é "a nota discorda do corpo" (4 fontes + ação
  coletiva contra a Oura em 08/2026);
- ortossonia é entidade clínica, com prevalência de ~3–5% estimada pelos próprios autores;
- a especificidade sono/vigília destes aparelhos contra polissonografia vai de 0,18 a 0,54
  ([Chinoy 2021](https://academic.oup.com/sleep/article/44/5/zsaa291/6055610)), com o Garmin
  no piso.

Em 06/09/2026 o usuário pediu um score para dia, semana e mês. A pesquisa que precedeu este
documento mediu as **288 noites reais** em produção e mediu também a literatura. O resultado
não foi "ele estava errado" nem "o spec estava errado": foi que **o objeto que a §2 proíbe e o
objeto que ele pediu não são o mesmo objeto**.

O que a §2 proíbe é o composto normalizado da categoria: um número de 0 a 100, derivado em
boa parte de estágios, com pesos não publicados, apresentado como veredito. O que a pesquisa
sustenta é outra coisa, e é o formato que a própria literatura usa quando compõe.

## Decisão

Existe **Saúde do sono**: uma **contagem de dimensões**, não uma nota.

Cinco dimensões, cada uma valendo 0, 1 ou 2, somadas — a escala do RU-SATED
([Buysse 2014](https://www.med.upenn.edu/cbti/assets/user-content/uploads/PMF%202024/Buysse%202014%20Sleep%20Health%20Can%20we%20Define%20it.pdf)),
que é a única moldura multidimensional de sono saudável com instrumento publicado. O
precedente de composição é o
[Wallace 2018](https://academic.oup.com/sleep/article/41/1/zsx189/4642232) (n = 2.887, 11
anos), que **conta dimensões extremas** em vez de ponderá-las: cada dimensão ruim a mais vale
HR 1,10.

| Dimensão | Noite | Período | Origem do limiar |
|---|---|---|---|
| Duração | horas dormidas | mediana + % ≥ 7 h | AASM/SRS 2015 |
| Continuidade | acordado + despertares | mediana | Ohayon 2017, com limiar **da própria pessoa** |
| Horário | midpoint vs o habitual dela | dispersão dentro do período | Buysse 2014, relativo |
| Regularidade | **não existe** | SRI de noites seguidas | Windred 2024 |
| Percepção | nota 1–5 ao acordar | média | Buysse 2014, "satisfaction" |

Implementação em [`packages/shared/src/sleep/score.ts`](../../packages/shared/src/sleep/score.ts),
com testes em `score.test.ts`.

### As seis regras que fazem disso outra coisa

1. **A contagem nunca aparece sozinha.** Cada dimensão carrega o dado cru que a gerou, ao
   lado do preenchimento. É o que permite discordar de uma linha sem descartar as outras
   quatro — e o que impede a tela de dizer "confie em mim".
2. **A linha de base de continuidade e horário é a distribuição recente da própria pessoa**,
   janela de 30 noites, olhando só para trás. Não é preferência: ver §"a medição do relógio".
3. **Estágios não pontuam.** Ver §"por que estágios ficam de fora".
4. **Dimensão não medida encolhe o denominador.** Ela nunca vira zero disfarçado: sai da
   lista com o motivo escrito, e o máximo cai de 8 para 6, de 10 para 8.
5. **Período abaixo de 70% de cobertura não recebe contagem.** As medidas continuam visíveis;
   só o total some.
6. **Nada de streak, meta, seta de tendência, comparação com outras pessoas ou conselho.**
   Os guarda-corpos da §2 contra ortossonia continuam valendo na íntegra.

### A noite tem quatro dimensões; o período tem cinco

Isso não é configuração, é definição. O índice de regularidade compara o estado em *t* com o
estado em *t + 24 h*: é uma relação **entre** noites, como inclinação é uma relação entre
pontos. Uma noite sozinha não tem regularidade.

A consequência de produto é boa: a tela de período passa a ter uma razão de existir que a tela
de noite não pode cobrir.

## A medição do relógio, que é o achado que governa tudo

Em 18/07/2026 o usuário trocou o Apple Watch pelo Garmin. Nas 288 noites em produção:

| | Apple (245 noites) | Garmin (43 noites) |
|---|---|---|
| Tempo acordado, mediana | **71,5 min** | **13 min** |
| Eficiência, mediana | **76,4%** | **96,8%** |
| Noites com eficiência ≥ 85% | 13% | 84% |

Mesma pessoa, mesma cama, mesmos hábitos. Os 20 minutos de WASO do consenso Ohayon dariam a
ele **um ano inteiro de notas ruins e um agosto de notas ótimas**, e a diferença seria o pulso.

Por isso continuidade e horário são relativos à distribuição recente dele. Uma troca de
aparelho é absorvida em cerca de um mês, sozinha, sem ninguém precisar declarar a fonte.
Duração, regularidade e percepção **não** são relativas: sete horas são sete horas em qualquer
relógio, o SRI não depende de estagiamento, e a nota é do dono.

> A coluna `source` de `sleep_periods` está **nula em 288 de 288 linhas**. Quando o agregador
> passar a preenchê-la, dá para estreitar a base por fonte e a convergência fica imediata em
> vez de levar um mês. É melhoria, não pré-requisito.

## Por que estágios ficam de fora

Três razões independentes, e a terceira sozinha bastaria.

1. **Sem consenso.** O painel do NSF revisou 277 estudos e chegou a acordo sobre quatro
   indicadores de continuidade. Sobre arquitetura — REM, N1, N2, N3, microdespertares — e
   sobre cochilos, **não houve consenso** (Ohayon 2017).
2. **Sem precisão.** Os aparelhos não identificam de 30% a 50% do profundo e do REM, e pioram
   nas noites ruins (Chinoy 2021).
3. **Nos dados dele, a fração de profundo é artefato da duração.** ρ = −0,61 entre a fração de
   profundo e as horas dormidas na era Garmin. As horas de profundo quase não variam
   (ρ = 0,17 com a duração); é o denominador que cresce. Consequência medida: a fração de
   profundo tem ρ = **−0,56** com a nota que ele dá ao acordar. **Um ponto por "% de profundo"
   seria um ponto por dormir pouco.**

Estágios continuam visíveis na subview de Tempos e no detalhe da noite, com o rótulo de
incerteza. Eles descrevem; não pontuam.

**Latência também fica de fora:** o Garmin não mede a hora de deitar (0 de 43 noites), e uma
dimensão que só existe no passado quebraria a comparação entre períodos.

## O que os dados dele dizem sobre a percepção

Nas 56 noites com nota e medição, a única medida objetiva que acompanha a nota é a **duração**
(ρ = 0,49 no total, 0,61 na era Garmin). Tempo acordado dá −0,31, eficiência 0,34, midpoint
−0,10.

| Duração | n | Nota média | % com nota ≥ 4 |
|---|---|---|---|
| < 6 h | 12 | 3,25 | 25% |
| 6–7 h | 19 | 3,84 | 74% |
| 7–8 h | 15 | 3,87 | 87% |
| ≥ 8 h | 10 | 4,00 | 100% |

Duas ressalvas ficam registradas porque limitam o que a feature pode prometer:

- **Ele não usa a escala inteira.** Das 83 notas, nenhuma é 1 ou 2; 38 das 56 com medição são
  4. A percepção discrimina pouco, e por isso vale um ponto entre cinco, não mais.
- **A nota do dia não tem relação com a noite anterior** (ρ = 0,16 com a duração; ρ = −0,09
  entre as duas notas). **A tela nunca vai dizer que a noite explica o dia** — nos dados dele,
  não explica.

Isso é coerente com a literatura, e é bom lembrar a magnitude: a polissonografia, que é o
padrão-ouro, explica de 11% a 17% da variância da qualidade percebida
([Kaplan 2017](https://pubmed.ncbi.nlm.nih.gov/27889439/)); wearables explicam de 2,5% a 16,2%
([Srivali 2026](https://www.sciencedirect.com/science/article/abs/pii/S1389945726001802)).
Nenhum score vai concordar com o corpo na maior parte das noites. É a física do problema.

## O piso de cobertura

São 287 noites em 501 dias corridos — **57% de cobertura**. Na era Garmin sobe para 86%, mas
**14 dos 18 meses estão abaixo de 70%**. Um mês pela metade não vira nota: viraria uma nota
sobre as noites que o relógio conseguiu gravar, que é uma amostra enviesada por construção.

Abaixo do piso o resultado sai com `scored: false`. No histórico real isto é o caso **comum**,
não a exceção — e é por isso que a tela precisa desenhar bem esse estado, não tratá-lo como
erro.

## Alternativas rejeitadas

**Manter a §2 como está e recusar o pedido.** O argumento da §2 é contra um objeto específico,
e o usuário reafirmou o pedido depois de ver a proposta e a medição. Recusar seria transformar
uma decisão de desenho em dogma. *(E o custo de reverter é baixo — ver abaixo.)*

**Um 0–100 ponderado, como a categoria faz.** Exigiria pesos, e pesos exigem uma função de
perda que ninguém tem. A Apple é a única que publica os dela (50/30/20) e mexeu nas faixas em
11/2025 **sem tocar na fórmula**, para o rótulo casar melhor com a sensação — o que confirma
que o valor percebido mora na calibração do rótulo, não na precisão do número.

**Calibrar o score contra a nota dele.** Tentador, porque a nota existe. Mas com 56 noites,
três valores usados e 38 deles iguais a 4, seria ajustar a ruído — e faria a nota entrar duas
vezes, como alvo e como dimensão.

**Limiares absolutos de continuidade (Ohayon).** É exatamente o que a troca de relógio
derruba. Ficam como referência escrita na tela de origem das dimensões, não como corte.

## Consequências

**Custo:** a §2 deixa de ser uma proibição categórica e passa a ser uma proibição de forma. Um
leitor futuro precisa ler esta ADR junto com ela, e a redação do spec foi atualizada para
apontar para cá.

**Risco real:** a contagem pode virar placar por deriva — alguém acrescenta uma seta, um
streak, uma comparação com o período anterior em forma de "melhorou". As seis regras acima
são o que impede isso, e a regra 1 (o fato sempre ao lado) é a que carrega o peso.

**Custo de reverter:** baixo. `score.ts` é puro e isolado; a UI é um componente em cada app e
uma rota (`/sono/saude`). Nada no pipeline de sync, no banco ou no tema depende disso.

**Efeito colateral bom:** a citação do SRI ficou verificada. O spec carregava, desde 04/09, a
ressalva de que a fórmula vinha de fonte secundária. O
[Phillips 2017](https://www.nature.com/articles/s41598-017-03171-4) foi lido nesta rodada:
probabilidade de mesmo estado a 24 h de distância, minuto a minuto, reescalada por
`y = 200(x − ½)`. A implementação em `regularity.ts` está correta, e o índice pode ser exibido.
