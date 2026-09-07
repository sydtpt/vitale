# ADR 0040 — O cruzamento só fala quando as duas colunas concordam

- **Status:** aceita
- **Data:** 06/09/2026
- **Contexto:** Sono · Retrospectiva · CAP-12
- **Relacionada:** [0036](0036-saude-do-sono-e-contagem-nao-placar.md) (a contagem que
  substituiu o placar), [0031](0031-sono-e-categoria-nao-modulo.md)
- **Numeração:** 0037, 0038 e 0039 já estavam tomados na árvore de trabalho por outras
  frentes quando esta foi escrita. Ver `adr-numero-colide-entre-branches`.

## Contexto

O usuário pediu duas coisas: análise de sono **por tipo de esporte** (e nos dias sem
esporte), e análise **por hábito** — cerveja, café, cigarro —, lendo *o que está no app*,
não uma lista fixa.

Os dois cruzamentos são triviais de calcular e o resultado bruto é uma armadilha. Rodados
direto sobre as 289 noites do arquivo, eles produzem manchetes deliciosas e falsas:

| manchete que o dado bruto autoriza | efeito |
|---|---|
| "fumar mais te faz dormir a mais" | +2h39 |
| "beber mais água te faz dormir a mais" | +3h03 |
| "correr te faz dormir a mais" | +1h57 |

Nenhuma é real. O confundidor é o **tipo de noite**:

- a noite antes de folga dorme **6h40**; a noite antes de trabalho dorme **7h39**;
- os dias com esporte são **24%** de véspera de folga, contra **39%** nos dias sem.

O cruzamento estava medindo o calendário. E o teste que expõe isso é simples: separando
cada gatilho nas duas colunas, **os efeitos falsos invertem o sinal** entre elas.

| gatilho | noite presa | noite livre |
|---|---|---|
| Água acima da mediana | +227 min | −99 min |
| Smoke acima da mediana | +132 min | −77 min |
| Corrida | +149 min | −19 min |
| Ciclismo | +57 min | −123 min |

## Decisão

**Uma leitura de gatilho só é publicada quando as duas colunas concordam no sinal.**

Formalmente, para cada gatilho e cada métrica:

1. As noites são separadas em **presa** (véspera de dia de trabalho) e **livre** (véspera
   de folga), usando o `isFreeWakeDay(wakeDay)` que o núcleo já tinha.
2. Cada coluna precisa de `TRIGGER_MIN_PER_CELL` = **5** noites com o gatilho **e** 5 sem.
3. As duas diferenças precisam ter **o mesmo sinal**.
4. A média das duas precisa passar de um piso de tamanho: **10 min** de horário de deitar,
   **15 min** de sono, **0,30 ponto** de nota.

O passo 4 existe por um caso concreto: o registro 🤷🏻‍♂️ concorda nas duas colunas com
**+0,13 ponto** de nota. A regra de sinal o aprova; treze centésimos numa escala de 1 a 5
não são achado. A regra filtra sinal trocado, não efeito irrelevante — por isso as duas.

### O corte adaptativo

Um hábito com valor vira evento por comparação com a **mediana de todos os dias-véspera da
janela, zeros inclusos**. Uma regra, dois comportamentos:

- **hábito frequente** — a mediana cai no meio da distribuição e o corte pergunta *dose*
  (café acima de 2);
- **hábito raro** — a mediana cai em zero e o corte degenera para *presença* (cerveja acima
  de 0), que é o que se quer perguntar de algo que aconteceu em 15 noites.

O primeiro desenho cortava pela mediana dos dias **com** o hábito. Isso deixava a cerveja
com 3 noites por coluna e a emudecia — quando ela, com a regra certa, **tem** leitura.

### A janela não é o período

O quadro roda em **todo o histórico**, não na janela exibida. Um mês rende células de três
a oito noites e nenhuma leitura passaria, nunca. E a pergunta ("o que a cerveja faz comigo")
é sobre a pessoa, não sobre agosto. A tela carrega uma tarja dizendo isso.

### O que não passa não some

O que a regra rejeita se separa em **dois** blocos, e a separação é o ponto:

- **"o que ainda não dá para dizer"** — a régua de alcance, com quantas noites faltam;
- **"medidos, e sem efeito"** — tem amostra, e não diz nada.

*"Não tem efeito"* e *"não tem dado"* são coisas opostas, e uma tela muda não as distingue.
Um gatilho **nunca marcado** não entra em nenhum dos dois: vazio não é "quase lá".

## Consequências

Das 14 fontes do arquivo em 06/09/2026, **oito leituras sobrevivem**:

| gatilho | leitura | presa | livre |
|---|---|---|---|
| 🍁 | dorme 156 min a mais | +112 | +201 |
| Qualquer esporte | deita 60 min mais cedo | −30 | −90 |
| Ciclismo | deita 50 min mais cedo | −18 | −81 |
| Qualquer esporte | dorme 67 min a mais | +101 | +33 |
| Yoga | deita 41 min mais cedo | −20 | −61 |
| **Cerveja** | **dorme 33 min a menos** | **−30** | **−36** |
| Yoga | dorme 30 min a mais | +2 | +57 |
| Café acima de 2 | deita 10 min mais tarde | +5 | +15 |

Quatro ficam pendentes por amostra (Caminhada, Pizza, Fast food, Kebab) e quatro ficam
mudas com amostra (Corrida, 🤷🏻‍♂️, Smoke, Água).

- **O achado mais sólido não é sobre duração, é sobre horário:** em dia com esporte ele
  **deita mais cedo**, e isso se sustenta nas duas colunas, nos dois aparelhos e com a maior
  amostra do lote.
- **A pergunta da cerveja tem resposta**, e ela sobreviveu ao portão mais duro que eu soube
  construir — as duas colunas dão −30 e −36, uma concordância que os casos de ruído nunca
  produzem.
- **Nada disso é causa.** É observacional, é a vida de uma pessoa, e a Retrospectiva é
  jornal: informa, não aconselha. Nenhuma leitura vira recomendação e o `n` anda junto do
  número.

## Alternativas descartadas

- **Publicar o cruzamento simples, com um aviso de "associação, não causa".** É o que a
  categoria faz. O aviso não impede a manchete de dizer que fumar faz dormir melhor, e um
  jornal que precisa de nota de rodapé para não mentir já mentiu.
- **Regressão com o tipo de noite como covariável.** Mais poder, e ilegível: o leitor não
  pode conferir um coeficiente. As duas colunas lado a lado ele confere sozinho, e é por
  isso que a tela as mostra em vez de escondê-las atrás da média.
- **Esconder o que não passa.** Foi descartado explicitamente pelo usuário em 06/09/2026:
  sem a régua, a tela fica muda e ele não sabe se é "não tem efeito" ou "não tem dado".
