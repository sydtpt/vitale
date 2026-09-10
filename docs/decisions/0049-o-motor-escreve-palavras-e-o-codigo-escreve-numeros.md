# 0049 — O motor escreve palavras; o código escreve números

**Status:** aceita
**Data:** 2026-09-10
**Complementa:** [0036](0036-saude-do-sono-e-contagem-nao-placar.md) (a contagem da Saúde do sono),
[0041](0041-o-nome-da-rota-e-molde-com-lacuna.md) (o molde) e
[0047](0047-a-porta-do-motor-e-uma-so-e-a-ponte-do-aparelho-e-nossa.md)
**Espinha:** [architecture-Orbe-ia-no-aparelho-2026-09-10](../../_bmad-output/planning-artifacts/architecture/architecture-Orbe-ia-no-aparelho-2026-09-10/ARCHITECTURE-SPINE.md) — AD-6 e AD-7

## Contexto

A regra da camada de IA do Orbe sempre foi que **o modelo nunca calcula**: ele recebe números prontos
e só redige, classifica ou escolhe entre opções declaradas. Até aqui ela era uma instrução no prompt e
uma conferência depois — `verificar.ts` confere que todo número citado existe no pacote.

Dois fatos de 10/09/2026 mudaram o peso dessa regra:

- **Os motores do aparelho são os pequenos.** Quem já publicou apps com Foundation Models registrou
  que o modelo "é pequeno o bastante para inventar números, se você deixar", e a Apple diz que ele não
  serve para raciocínio avançado. Numa leitura sobre dados de saúde, errar a conta é pior do que não
  ter texto.
- **A frase pedida para a Saúde do sono raramente existe.** O dono pediu uma frase que nomeie "a
  dimensão que puxa o conjunto para baixo". Rodada a contagem real sobre as 293 noites de produção,
  em todas as janelas que a tela navega: das 73 semanas, só **11 (15%)** têm uma dimensão abaixo de
  todas as outras; 17 têm empate e 45 nem têm contagem. Nas 4 semanas de 14/08 a 10/09, quatro
  dimensões estão empatadas em 1. Escolher "a pior" é comparar números — e, com empate, escolher no
  chute.

Somou-se uma limitação medida na documentação da Apple: na geração de texto livre, a recusa do modelo
chega como texto comum ("Desculpe, não posso ajudar com isso"), sem erro.

## Decisão

**Os números e as escolhas são do código; o motor escreve as palavras em volta.**

1. **Três regimes de número, e cada recurso declara o seu.**
   - **Interpolado** — padrão de todo recurso novo e obrigatório na Saúde do sono. A saída do motor
     não tem nenhum algarismo; onde a frase precisa de um valor, o motor põe um marcador, e o código o
     troca pelo fato já formatado. A sintaxe do marcador tem dono único em `ia/interpolar.ts`.
   - **Copiado e conferido** — o da Retrospectiva: o motor escreve números e a conferência exige que
     cada um exista no pacote.
   - **Molde** — o do nome de rota (ADR 0041): o motor devolve campos, a frase sai do molde, e a
     conferência é de pertinência.
2. **A conferência exige presença, não só ausência.** No regime interpolado ela reprova dígito e
   marcador fora do conjunto e exige que as dimensões do caso estejam na frase. A falta é
   `recusa-do-modelo`: é assim que a recusa em texto livre deixa de passar por leitura.
3. **Os termos proibidos têm uma lista só.** `VOCABULARIO_PROIBIDO`, criado em `ia/verificar.ts` e
   exportado, com subconjuntos nomeados — causa (a `CAUSA` de hoje), conselho, elogio, placar,
   tendência e meta, comparação com outras pessoas. Cada recurso compõe os que valem para ele; a
   Retrospectiva, que compara com bases de propósito, não compõe "tendência". Todo fato interpolado
   sai em pt-BR por `format/numero.ts`.
4. **Na Saúde do sono, o caso é do código.** Uma função pura em `sleep/` põe cada contagem em
   exatamente um caso, nesta precedência: `sem-contagem` → `medidas-insuficientes` (menos de duas
   dimensões medidas) → `tudo-no-maximo` → `todas-iguais` → `uma` → `duas` → `fora-do-empate`. O
   motor recebe o caso e as dimensões a nomear, nunca as notas para decidir. A frase usa quantas
   dimensões foram medidas, nunca o número cinco fixo. As regras de frase, aprovadas pelo dono, estão
   na CAP-13 do [spec de Sono](../specs/sono/spec.md).
5. **Escolher a dimensão é teste, não produto.** Pedir que o motor escolha, entre opções fechadas,
   existe só na bancada, em modo de medição: é o que dá o primeiro número publicado sobre quantas
   vezes um modelo pequeno lê cinco notas e acerta a menor.
6. **Leitura efêmera lê período em curso.** A §3 do spec `ia-analitica` ("período em curso não ganha
   parágrafo de máquina") vale para recurso que grava. A leitura da Saúde do sono é gerada por botão,
   nunca gravada, e por isso lê a janela de 7 dias que termina hoje.

## Alternativas rejeitadas

**Deixar o motor escolher a dimensão e conferir contra a menor nota.** É o motor calculando. Com
empate em 23% das semanas, a escolha seria arbitrária e mudaria a cada toque no botão.

**O regime da Retrospectiva também na Saúde do sono.** Funciona com o modelo de nuvem, grande, e a
conferência de números pega o erro. Com os motores pequenos do aparelho, a taxa de reprovação seria
alta sem necessidade: se o motor nunca escreve número, número errado não tem por onde entrar.

**Manter a frase literal "a que puxa para baixo".** Seria verdade em 15% das semanas e escolha no
chute no resto.

**Uma lista de termos proibidos por recurso.** Duas listas do mesmo conceito divergem, e a regra 6
da ADR 0036 (sem streak, meta, seta, conselho) viraria prosa em cada recurso.

## Consequências

**O que custa.** O motor contribui só com a redação: o template já diz a mesma informação. É
exatamente o que a bancada vai medir — se o texto do motor vale mais que o do template em português.
A F0 cria a lista de termos proibidos e o formatador de números antes de qualquer motor existir.

**O que paga.** Um número errado não tem por onde entrar na frase. A mesma semana recebe sempre o
mesmo caso, e a recusa do modelo não chega à tela como leitura.

**O que custa reverter.** Pouco: o regime é uma declaração do recurso, e a conferência continua
valendo sob qualquer um dos três.
