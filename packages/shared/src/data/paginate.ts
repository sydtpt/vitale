/**
 * Paginação de consultas por intervalo.
 *
 * O PostgREST tem um teto **implícito** de 1000 linhas por resposta. Passar dele
 * **não gera erro**: as linhas excedentes simplesmente não vêm, em ordem
 * indefinida, e o código recebe um array menor achando que é tudo o que existe.
 *
 * Foi assim que a Retrospectiva no modo Estação passou a mostrar buraco onde havia
 * dado: `health_daily` grava ~9 linhas por dia (uma por métrica), então 111 dias
 * bastavam para cortar (25/08/2026 — ver docs/specs/retrospectiva/v2-jornal.md).
 *
 * O modo de falha é assimétrico e por isso perigoso: funciona no desenvolvimento,
 * onde as janelas são curtas, e quebra em produção conforme o histórico cresce. O
 * sintoma — "faltou dado" — aponta para a captura, não para a leitura.
 *
 * **Regra:** toda consulta por intervalo que possa crescer com o tempo passa por
 * aqui. Uma que hoje devolve 80 linhas devolve 1200 daqui a dois anos.
 */

/** Tamanho da página. É o teto do PostgREST; pedir mais não adianta. */
export const PAGE_SIZE = 1000;

/**
 * Busca todas as páginas de uma consulta.
 *
 * `run` recebe o intervalo `[from, to]` inclusivo e deve aplicar `.range(from, to)`
 * **e uma ordenação estável** — sem `order`, o Postgres não garante a mesma ordem
 * entre chamadas e duas páginas podem repetir ou pular linhas.
 *
 * **Estável quer dizer TOTAL, não só "tem um `order`".** A coluna natural destas
 * consultas é quase sempre uma data (`log_date`, `tx_date`, `start_at`), e data
 * empata às dezenas: vários hábitos no mesmo dia, várias transações na mesma
 * data, o mesmo treino gravado por dois apps com o mesmo início. Dentro de um
 * bloco empatado a ordem é livre, e ela pode mudar entre uma página e a
 * seguinte — linhas na fronteira somem ou vêm duas vezes. Acrescente a chave
 * primária como último critério (`.order('id', ...)`), a menos que a ordenação
 * já seja única por construção — é o caso de `daily_ratings`, cuja PK é
 * `(user_id, day)` com o `user_id` fixo no filtro.
 *
 * Para quando a página volta com menos que `PAGE_SIZE`: é a única condição de
 * parada confiável, já que a resposta não traz contagem total.
 */
export async function fetchAllPages<T>(
  run: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await run(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []) as T[];
    out.push(...page);
    if (page.length < PAGE_SIZE) return out;
  }
}
