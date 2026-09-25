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

/* ── o outro teto: o tamanho da URL ──────────────────────────────────────── */

/**
 * Quantos ids cabem num `.in(...)`.
 *
 * **Este teto não é o de cima, e confundir os dois produz a guarda errada.** Numa
 * consulta `.in('id', ids)` sobre a chave primária, o número de linhas **nunca
 * passa o número de ids** — paginar não protege de nada, porque o corte de mil
 * linhas exigiria mais de mil ids, e aí o que estoura primeiro é a **URL**: o
 * PostgREST recebe a lista como query string, e um GET longo demais volta 414 ou
 * é cortado pelo proxy.
 *
 * A diferença que importa: o teto de linhas corta **calado**, e por isso a
 * resposta é paginar; o teto da URL falha **alto**, e por isso a resposta é
 * fatiar a lista antes de perguntar. Foi o que tirou a contagem de mídia do
 * `.in()` e a levou para uma RPC ({@link fetchMediaCounts}) — o Histórico de
 * Ciclismo tem 338 atividades de id textual.
 *
 * 200 é o mesmo número conservador que `fetchExistingRouteIds` já usava: com
 * UUIDs de 36 caracteres mais o separador, uma fatia cheia dá ~7,4 KB de query
 * string, bem abaixo dos 8 KB que servidores costumam aceitar.
 */
export const IDS_POR_LOTE = 200;

/**
 * Lê por uma lista de ids, em fatias de {@link IDS_POR_LOTE}.
 *
 * `run` recebe a fatia e deve aplicar `.in(<coluna>, fatia)`. **Não pagina de
 * propósito**: quem chama isto filtra por chave (ou por uma coluna única), e aí
 * cada fatia devolve no máximo `IDS_POR_LOTE` linhas — bem longe do teto do
 * PostgREST. Uma leitura em que um id casa **várias** linhas (as fotos de uma
 * atividade, por exemplo) precisa das duas coisas, e aí `run` pagina por dentro.
 *
 * Lista vazia não vai ao banco: um `.in([])` é uma ida de rede para receber zero
 * linhas.
 */
export async function fetchEmLotesDeIds<T>(
  ids: readonly string[],
  run: (fatia: readonly string[]) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<T[]> {
  if (ids.length === 0) return [];
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += IDS_POR_LOTE) {
    const { data, error } = await run(ids.slice(i, i + IDS_POR_LOTE));
    if (error) throw error;
    out.push(...((data ?? []) as T[]));
  }
  return out;
}
