/**
 * Rotas recorrentes: as voltas que você repete, e o seu ritmo em cada uma.
 *
 * ## Por que isto é melhor que comparar por distância
 *
 * `best-efforts.ts` já compara desempenho na mesma **distância**, e isso corrige
 * o erro grosseiro de comparar o ritmo de um 5 km com o de uma meia. Mas dois
 * dez-quilômetros diferentes ainda têm desnível, curvas e semáforos diferentes.
 * A mesma **rota** controla os três — é a comparação mais justa que os dados
 * permitem sem sensor nenhum a mais.
 *
 * ## Como duas atividades viram a mesma rota
 *
 * O traçado é reduzido a um conjunto de células de `ROUTE_CELL_M` metros, e a
 * semelhança é o **índice de Jaccard** desses conjuntos: quanto do caminho de uma
 * também foi pisado pela outra. É robusto ao que importa — sentido invertido,
 * ponto de partida deslocado, pausa no meio, GPS oscilando alguns metros — porque
 * nenhuma dessas coisas muda o conjunto de células visitadas.
 *
 * O que ele **não** distingue: ida e volta pelo mesmo caminho contra um trecho
 * percorrido uma vez só. Duas atividades sobre as mesmas ruas caem juntas mesmo
 * que uma tenha feito o dobro de voltas — por isso o filtro de distância
 * (`ROUTE_MIN_DISTANCE_RATIO`) é parte da definição, e não um refinamento.
 *
 * ## O agrupamento é por ligação completa, de propósito
 *
 * Uma atividade só entra num grupo se passar no limiar contra **todas** as que já
 * estão nele. A alternativa barata — ligação simples, em que basta parecer com
 * uma — encadeia por transitividade: medido no histórico real, ela fundiu 36
 * corridas de 5,3 a 12,3 km num "grupo" só, porque cada uma parecia com a
 * vizinha. Ligação completa produz grupos que o dono reconhece como uma rota.
 *
 * ## O limiar
 *
 * `ROUTE_MIN_OVERLAP` de 0,7 foi a escolha do dono, com os dois cenários medidos
 * à frente: a 0,7 o circuito de 10 km dele fica inteiro, com 13 corridas; a 0,8
 * ele racha em 6 + 5, duas variações da mesma volta com um quarteirão de
 * diferença. Nada aqui é gravado — o agrupamento é derivado a cada leitura —,
 * então mudar o limiar é recalcular, não migrar.
 */

/** Lado da célula do grid, em metros. */
export const ROUTE_CELL_M = 150;
/** Sobreposição mínima (0–1) entre dois traçados para serem a mesma rota. */
export const ROUTE_MIN_OVERLAP = 0.7;
/** A menor distância dividida pela maior precisa passar disto. */
export const ROUTE_MIN_DISTANCE_RATIO = 0.85;
/** Quantas repetições fazem uma rota "recorrente". */
export const ROUTE_MIN_GROUP = 3;
/** Menos células que isto e o traçado é curto ou vazio demais para comparar. */
export const ROUTE_MIN_CELLS = 8;

/** Metros por grau de latitude. Longitude encolhe com o cosseno da latitude. */
const M_PER_DEG = 111_320;

/**
 * Um ponto do traçado, nas duas formas em que ele circula.
 *
 * A coluna `route_overview` guarda pares `[lat, lng]` — metade dos bytes —, e
 * `fetchRouteOverviews` converte para objeto ao ler. Aceitar as duas evita que
 * quem chama tenha de converter de volta só para usar este módulo, e evita a
 * cópia de um array de centenas de milhares de pontos.
 */
export type RoutePointLike = readonly [number, number] | { lat: number; lng: number };

/** Uma atividade candidata a entrar num grupo. */
export interface RouteActivity {
  id: string;
  /** Traçado reduzido — o `route_overview`, não o track cheio. */
  points: readonly RoutePointLike[];
  distanceM: number;
  /** Tempo em movimento (s); zero ou ausente deixa a atividade sem ritmo. */
  movingTimeS?: number;
  /** ISO — ordena o grupo e decide a âncora. */
  startAt: string;
  elevationM?: number;
}

export interface RouteEffort {
  id: string;
  startAt: string;
  distanceM: number;
  movingTimeS: number;
  /** Segundos por km; `null` sem tempo ou sem distância. */
  paceSPerKm: number | null;
  /** 1 = o ritmo mais rápido do grupo; `null` quando não há ritmo. */
  rank: number | null;
}

export interface RecurringRoute {
  /**
   * Identidade do grupo: o id da atividade **mais antiga** dele.
   *
   * É estável enquanto o grupo não mudar de composição na ponta antiga — e é o
   * melhor que dá para fazer sem gravar nada. Serve como `key` de lista, não
   * como chave de persistência.
   */
  id: string;
  count: number;
  /** Mediana das distâncias (m) — resistente à corrida que parou o relógio tarde. */
  distanceM: number;
  /** Mediana da elevação (m); `null` quando nenhuma atividade trouxe elevação. */
  elevationM: number | null;
  /** Do mais antigo ao mais recente. */
  efforts: RouteEffort[];
  /** O ritmo mais rápido; `null` quando ninguém no grupo tem ritmo. */
  best: RouteEffort | null;
  /** O ritmo mediano — o "típico", que a média distorceria com um dia ruim. */
  median: RouteEffort | null;
  firstAt: string;
  lastAt: string;
}

export interface RecurringRouteOptions {
  cellM?: number;
  minOverlap?: number;
  minDistanceRatio?: number;
  minGroup?: number;
}

function numberOr(value: number | undefined, fallback: number, max?: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return fallback;
  return max !== undefined && value > max ? fallback : value;
}

/**
 * As células que um traçado visita, como chaves `"x:y"`.
 *
 * A projeção é local e barata: metros por grau de latitude, e a longitude
 * encolhida pelo cosseno da latitude **do próprio ponto**. Numa cidade a
 * distorção é irrelevante; num traçado que cruzasse muitos paralelos ela
 * aparece, e ainda assim de forma consistente entre duas atividades da mesma
 * região — que é tudo o que a comparação precisa.
 */
export function routeCells(
  points: readonly RoutePointLike[],
  cellM: number = ROUTE_CELL_M,
): Set<string> {
  const size = numberOr(cellM, ROUTE_CELL_M);
  const out = new Set<string>();
  for (const p of points) {
    if (p == null) continue;
    const pair = Array.isArray(p);
    if (pair && p.length < 2) continue;
    const lat = pair ? (p as readonly [number, number])[0] : (p as { lat: number }).lat;
    const lng = pair ? (p as readonly [number, number])[1] : (p as { lng: number }).lng;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const y = Math.round((lat * M_PER_DEG) / size);
    const x = Math.round((lng * Math.cos((lat * Math.PI) / 180) * M_PER_DEG) / size);
    out.add(`${x}:${y}`);
  }
  return out;
}

/** Índice de Jaccard entre dois conjuntos de células: 0 = nada em comum, 1 = idênticos. */
export function routeOverlap(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  // Percorre o menor: a interseção é simétrica e isto evita o pior caso.
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  let inter = 0;
  for (const k of small) if (big.has(k)) inter++;
  const union = a.size + b.size - inter;
  return union > 0 ? inter / union : 0;
}

function median(values: number[]): number {
  const s = [...values].sort((x, y) => x - y);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function paceOf(distanceM: number, movingTimeS: number): number | null {
  if (!(distanceM > 0) || !(movingTimeS > 0)) return null;
  return movingTimeS / (distanceM / 1000);
}

/**
 * Agrupa atividades que percorreram o mesmo traçado.
 *
 * A entrada deve conter **um esporte só** — juntar corrida e ciclismo pelas
 * mesmas ruas produziria um grupo cujo ranking de ritmo não significa nada.
 * Quem chama filtra; este módulo não conhece tipo de atividade.
 *
 * Devolve só os grupos com pelo menos `minGroup` atividades, do maior para o
 * menor e, no empate, do mais recente para o mais antigo.
 */
export function groupRecurringRoutes(
  activities: readonly RouteActivity[],
  options: RecurringRouteOptions = {},
): RecurringRoute[] {
  const cellM = numberOr(options.cellM, ROUTE_CELL_M);
  const minOverlap = numberOr(options.minOverlap, ROUTE_MIN_OVERLAP, 1);
  const minRatio = numberOr(options.minDistanceRatio, ROUTE_MIN_DISTANCE_RATIO, 1);
  const minGroup = Math.max(2, Math.floor(numberOr(options.minGroup, ROUTE_MIN_GROUP)));

  // Ordem estável por data: a âncora de cada grupo passa a ser a mais antiga, e
  // duas execuções sobre o mesmo dado produzem os mesmos grupos.
  const usable = activities
    .filter((a) => a.distanceM > 0 && Array.isArray(a.points) && a.points.length > 0)
    .map((a) => ({ act: a, cells: routeCells(a.points, cellM) }))
    .filter((a) => a.cells.size >= ROUTE_MIN_CELLS)
    .sort((x, y) => (x.act.startAt < y.act.startAt ? -1 : x.act.startAt > y.act.startAt ? 1 : 0));

  const groups: { act: RouteActivity; cells: Set<string> }[][] = [];
  for (const cand of usable) {
    const home = groups.find((g) =>
      g.every((member) => {
        const lo = Math.min(cand.act.distanceM, member.act.distanceM);
        const hi = Math.max(cand.act.distanceM, member.act.distanceM);
        if (hi <= 0 || lo / hi < minRatio) return false;
        return routeOverlap(cand.cells, member.cells) >= minOverlap;
      }),
    );
    if (home) home.push(cand);
    else groups.push([cand]);
  }

  const out: RecurringRoute[] = [];
  for (const g of groups) {
    if (g.length < minGroup) continue;
    const acts = g.map((m) => m.act);
    const efforts: RouteEffort[] = acts.map((a) => ({
      id: a.id,
      startAt: a.startAt,
      distanceM: a.distanceM,
      movingTimeS: a.movingTimeS ?? 0,
      paceSPerKm: paceOf(a.distanceM, a.movingTimeS ?? 0),
      rank: null,
    }));

    // Posto por ritmo, do mais rápido para o mais lento. Quem não tem ritmo fica
    // sem posto — e não em último, que seria afirmar um desempenho ruim.
    const ranked = efforts.filter((e) => e.paceSPerKm !== null);
    ranked.sort((a, b) => (a.paceSPerKm as number) - (b.paceSPerKm as number));
    ranked.forEach((e, i) => {
      e.rank = i + 1;
    });

    const elevs = acts.map((a) => a.elevationM).filter((v): v is number => typeof v === 'number');
    out.push({
      id: acts[0].id,
      count: acts.length,
      distanceM: median(acts.map((a) => a.distanceM)),
      elevationM: elevs.length > 0 ? median(elevs) : null,
      efforts,
      best: ranked[0] ?? null,
      median: ranked.length > 0 ? ranked[Math.floor((ranked.length - 1) / 2)] : null,
      firstAt: acts[0].startAt,
      lastAt: acts[acts.length - 1].startAt,
    });
  }

  out.sort((a, b) => b.count - a.count || (a.lastAt < b.lastAt ? 1 : -1));
  return out;
}

/** O grupo a que uma atividade pertence; `null` quando ela não repete rota. */
export function routeOf(routes: readonly RecurringRoute[], activityId: string): RecurringRoute | null {
  return routes.find((r) => r.efforts.some((e) => e.id === activityId)) ?? null;
}

/** O desempenho de uma atividade dentro do seu grupo; `null` fora de qualquer grupo. */
export function effortOf(
  routes: readonly RecurringRoute[],
  activityId: string,
): { route: RecurringRoute; effort: RouteEffort } | null {
  for (const route of routes) {
    const effort = route.efforts.find((e) => e.id === activityId);
    if (effort) return { route, effort };
  }
  return null;
}
