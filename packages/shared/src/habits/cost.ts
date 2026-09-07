/**
 * Gasto estimado de um hábito contador — o irmão de `habitCalories`.
 *
 * As duas estimativas respondem à mesma pergunta ("12,5 L sozinho não diz
 * nada") por caminhos opostos, e a diferença importa:
 *
 * - **kcal** é derivada do *nome*: uma tabela no núcleo sabe que cerveja tem
 *   ~472 kcal/L, e o usuário não digita nada;
 * - **gasto** é *autorado*: o preço de um litro depende de onde a pessoa
 *   compra, e nenhuma tabela do núcleo pode adivinhar 11 €/L. Por isso ele
 *   mora no hábito (`unit_price`), não aqui.
 *
 * O gasto nunca é persistido: `habit_logs` guarda a quantidade, e o dinheiro
 * sai da multiplicação na leitura. É o que torna o preço **retroativo de
 * graça** — pôr 11 €/L hoje reescreve o custo de todos os 60 L de trás.
 *
 * O limite dessa escolha, dito por extenso: é **um preço só**, aplicado a toda
 * a história. Não acompanha o preço subindo no tempo nem separa o copo do bar
 * da lata de casa. É ordem de grandeza — a mesma promessa da kcal. Se um dia
 * precisar de mais, o caminho é preço com data de vigência (uma tabela
 * `habit_prices`), não um segundo campo aqui.
 */

/**
 * Gasto estimado para um total acumulado, ou `null` quando o hábito não tem
 * preço — a UI usa o `null` para não desenhar a linha, do mesmo jeito que faz
 * com a kcal de um hábito sem densidade conhecida.
 *
 * Total zero devolve `null`, não `€0`: "não gastou nada" e "não houve registro"
 * leem igual na tela, e a segunda é a verdadeira.
 */
export function habitCost(unitPrice: number | undefined | null, total: number): number | null {
  if (unitPrice == null || !(unitPrice > 0)) return null;
  if (!(total > 0)) return null;
  return total * unitPrice;
}
