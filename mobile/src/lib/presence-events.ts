/**
 * Fase 0 da Presença: o diário cru dos eventos de geofence, **só no aparelho**.
 *
 * Nada aqui sobe para o Supabase. A fase 0 existe para responder três perguntas
 * que nenhum documento responde no papel — quantos eventos por dia o iOS entrega,
 * quanto disso é flapping na borda, e se a bateria sente — e ela responde com o
 * dado dele, não com a média de ninguém. Por isso o log é local, limitado e
 * descartável: `clearPresenceLog()` apaga tudo sem consequência.
 *
 * As três medidas de `summarizePresence()` não são estatística decorativa: cada
 * uma calibra um limiar que a fase 1 vai gravar no banco.
 *
 *   - `shortStays`  → o limiar de 8 min que marca uma visita como passagem
 *   - `shortGaps`   → o limiar de 20 min que cola duas visitas no mesmo lugar
 *   - `openEnters`  → quantas bordas a fase 1 teria que inferir
 *
 * Se os números dele desmentirem os limiares propostos, quem muda é o limiar.
 *
 * Modelado em [habit-queue.ts](./habit-queue.ts) — mesma trava, mesmo `KVStore`
 * injetável, mesma persistência por AsyncStorage.
 */
import { asyncStore, getJSON, setJSON, type KVStore } from './local-store';

export type PresenceEventKind = 'enter' | 'exit';

export interface PresenceEvent {
  /** `${placeId}:${kind}:${at}` — o iOS reentrega evento; sem isto o log dobra. */
  id: string;
  /** `identifier` da região, que na fase 0 é o id local do lugar. */
  placeId: string;
  kind: PresenceEventKind;
  /** ISO do instante em que o JS recebeu o evento. */
  at: string;
  /** Fuso local na entrega. A fase 1 depende disto para o "dia" de uma visita. */
  tz: string;
  lat?: number;
  lon?: number;
  accuracyM?: number;
  /**
   * Idade, em segundos, do fix reaproveitado do cache do iOS.
   *
   * A fase 0 nunca pede posição nova: `getLastKnownPositionAsync` custa zero
   * bateria mas devolve o que já existia, que pode ser de minutos atrás. Guardar
   * a idade é o que separa "o app sabe onde você está" de "o app está repetindo
   * onde você estava" — e é a diferença entre a coordenada servir ou não para
   * nomear um lugar na fase 1.
   */
  fixAgeS?: number;
  /**
   * `AppState` no momento da entrega. Um evento com `background` é a prova de
   * que o iOS relançou o app sozinho — que é a premissa inteira da feature.
   */
  appState: string;
  /**
   * `true` quando o evento **não mudou o estado** da região: o iOS disse
   * "dentro" e nós já achávamos que estávamos dentro.
   *
   * Isso não é travessia, é relatório. O iOS reavalia o estado das regiões a
   * cada lançamento do app e a cada `startGeofencingAsync`, e o `expo-location`
   * traduz a reavaliação como entrada. Sem esta marca, cada abertura do app
   * virava uma "chegada em casa" — o log de 07/09 tinha doze delas numa noite
   * parada, uma por build instalado.
   *
   * O evento é guardado assim mesmo (ele prova que a task rodou), mas fica fora
   * de toda medida: contá-lo inflaria eventos/dia e inventaria bordas a inferir.
   */
  redundant?: boolean;
}

const KEY = 'vitale:presence-log';
const STATE_KEY = 'vitale:presence-state';

/**
 * Último estado conhecido de cada região — `'in'` ou `'out'`.
 *
 * Persistido porque o caso que ele resolve é justamente o relançamento: o iOS
 * sobe o app, reavalia a região e diz "dentro". Em memória, a comparação sempre
 * começaria vazia e todo lançamento passaria por travessia.
 */
export type RegionState = 'in' | 'out';

export async function readRegionStates(
  store: KVStore = asyncStore,
): Promise<Record<string, RegionState>> {
  return (await getJSON<Record<string, RegionState>>(STATE_KEY, store)) ?? {};
}

/**
 * Aplica o estado que o evento afirma e diz se ele foi **travessia**.
 *
 * Primeira notícia de um lugar conta como travessia: sem estado anterior não há
 * como saber, e errar para "é travessia" é coerente com "errar a mais".
 */
export async function applyRegionState(
  placeId: string,
  kind: PresenceEventKind,
  store: KVStore = asyncStore,
): Promise<boolean> {
  const estados = await readRegionStates(store);
  const novo: RegionState = kind === 'enter' ? 'in' : 'out';
  const anterior = estados[placeId];
  estados[placeId] = novo;
  await setJSON(STATE_KEY, estados, store);
  return anterior !== novo;
}

export async function clearRegionStates(store: KVStore = asyncStore): Promise<void> {
  await setJSON<Record<string, RegionState>>(STATE_KEY, {}, store);
}

/**
 * Teto do log. O evento é minúsculo, mas a fase 0 roda por semanas sem ninguém
 * olhando, e um log sem teto vira um AsyncStorage de megabytes que ninguém pediu.
 * 500 eventos cobrem folgado duas semanas mesmo no pior caso de flapping — e se
 * estourar, o próprio estouro é resultado: significa que passou de ~35/dia.
 */
export const PRESENCE_LOG_CAP = 500;

/** Trava de leitura-modificação-escrita, pelo mesmo motivo da fila de hábitos. */
let logLock: Promise<unknown> = Promise.resolve();

function withLogLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = logLock.then(fn, fn);
  logLock = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

export function presenceEventId(placeId: string, kind: PresenceEventKind, at: string): string {
  return `${placeId}:${kind}:${at}`;
}

export async function readPresenceLog(store: KVStore = asyncStore): Promise<PresenceEvent[]> {
  return (await getJSON<PresenceEvent[]>(KEY, store)) ?? [];
}

/**
 * Acrescenta um evento, deduplicando por `id` e respeitando o teto (descarta o
 * mais antigo). Roda sob a trava porque dois eventos podem chegar juntos: sair
 * de um raio e entrar em outro na mesma esquina entrega `exit` e `enter` no
 * mesmo instante, e sem trava um dos dois some.
 */
export async function appendPresenceEvent(
  event: PresenceEvent,
  store: KVStore = asyncStore,
): Promise<void> {
  return withLogLock(async () => {
    const current = await readPresenceLog(store);
    if (current.some((e) => e.id === event.id)) return;
    const next = [...current, event];
    await setJSON(KEY, next.slice(Math.max(0, next.length - PRESENCE_LOG_CAP)), store);
  });
}

export async function clearPresenceLog(store: KVStore = asyncStore): Promise<void> {
  await setJSON<PresenceEvent[]>(KEY, [], store);
}

/** Limiares propostos, aqui para o resumo poder contradizê-los com dado real. */
export const SHORT_STAY_MIN = 8;
export const SHORT_GAP_MIN = 20;

export interface PresenceDayCount {
  /** 'YYYY-MM-DD' no fuso gravado no evento. */
  day: string;
  count: number;
}

export interface PresenceSummary {
  total: number;
  /** Dias distintos com pelo menos um evento. */
  days: number;
  perDay: PresenceDayCount[];
  /** Maior contagem em um único dia — o número que denuncia flapping. */
  busiestDay: PresenceDayCount | null;
  /** enter → exit no mesmo lugar em menos de SHORT_STAY_MIN. Seriam passagens. */
  shortStays: number;
  /** exit → enter no mesmo lugar em menos de SHORT_GAP_MIN. Seriam coladas. */
  shortGaps: number;
  /** enter sem exit correspondente. Cada um é uma borda que a fase 1 inferiria. */
  openEnters: number;
  /** Eventos cuja coordenada veio de um fix com mais de 5 min. */
  staleFixes: number;
  /**
   * Mediana da precisão relatada pelo iOS, em metros. `null` sem nenhum fix.
   *
   * É **a** evidência para escolher o raio: ele precisa ser maior que o erro de
   * posição, senão o fix cai fora do círculo com o usuário dentro. Mediana e não
   * média porque um único fix ruim de 800 m — comum ao sair do metrô — puxaria a
   * média e faria o raio parecer inviável.
   */
  medianAccuracyM: number | null;
  /**
   * Relatórios de estado descartados das medidas. Não é ruído a esconder: é a
   * contagem de vezes que o app foi lançado ou o monitoramento rearmado.
   */
  redundant: number;
}

/** Dia local do evento, derivado do fuso que ele mesmo carrega. */
export function presenceDay(event: PresenceEvent): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: event.tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(event.at));
  } catch {
    // Fuso inválido (mudou de aparelho, dado antigo): cai no fuso do momento.
    return new Date(event.at).toISOString().slice(0, 10);
  }
}

const STALE_FIX_S = 300;

/**
 * Lê o log e devolve as medidas que decidem a fase 1.
 *
 * Assume ordem cronológica de chegada, que é como `appendPresenceEvent` grava.
 * Ordena mesmo assim: um evento entregue com atraso pelo iOS chega fora de ordem,
 * e um par enter/exit invertido contaria como permanência negativa.
 */
export function summarizePresence(events: PresenceEvent[]): PresenceSummary {
  // Relatórios de estado ficam de fora de TODA medida. Eles não são travessia:
  // contá-los inflaria eventos/dia e inventaria bordas a inferir — foi o que
  // aconteceu no log de 07/09, com uma "chegada" por build instalado.
  const sorted = [...events]
    .filter((e) => !e.redundant)
    .sort((a, b) => a.at.localeCompare(b.at));

  const byDay = new Map<string, number>();
  const precisoes: number[] = [];
  let staleFixes = 0;
  for (const e of sorted) {
    const day = presenceDay(e);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
    if (e.fixAgeS != null && e.fixAgeS > STALE_FIX_S) staleFixes += 1;
    if (e.accuracyM != null) precisoes.push(e.accuracyM);
  }

  const perDay: PresenceDayCount[] = [...byDay.entries()]
    .map(([day, count]) => ({ day, count }))
    .sort((a, b) => a.day.localeCompare(b.day));

  const busiestDay = perDay.reduce<PresenceDayCount | null>(
    (best, d) => (best == null || d.count > best.count ? d : best),
    null,
  );

  // Percorre por lugar: o pareamento enter/exit só faz sentido dentro do mesmo
  // raio. Eventos de lugares diferentes se intercalam o tempo todo.
  const byPlace = new Map<string, PresenceEvent[]>();
  for (const e of sorted) {
    const list = byPlace.get(e.placeId);
    if (list) list.push(e);
    else byPlace.set(e.placeId, [e]);
  }

  let shortStays = 0;
  let shortGaps = 0;
  let openEnters = 0;

  for (const list of byPlace.values()) {
    let openEnter: PresenceEvent | null = null;
    let lastExit: PresenceEvent | null = null;

    for (const e of list) {
      if (e.kind === 'enter') {
        // Dois `enter` seguidos sem `exit`: o primeiro nunca fechou.
        if (openEnter) openEnters += 1;
        if (lastExit && minutesBetween(lastExit.at, e.at) < SHORT_GAP_MIN) shortGaps += 1;
        openEnter = e;
      } else {
        if (openEnter) {
          if (minutesBetween(openEnter.at, e.at) < SHORT_STAY_MIN) shortStays += 1;
          openEnter = null;
        }
        lastExit = e;
      }
    }

    // O último `enter` sem par não é buraco: é a visita em curso agora.
    // Só conta como aberto se houve outro evento depois dele em qualquer lugar.
    if (openEnter && sorted[sorted.length - 1] !== openEnter) openEnters += 1;
  }

  return {
    total: sorted.length,
    days: perDay.length,
    perDay,
    busiestDay,
    shortStays,
    shortGaps,
    openEnters,
    staleFixes,
    medianAccuracyM: mediana(precisoes),
    redundant: events.length - sorted.length,
  };
}

function mediana(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const ord = [...xs].sort((a, b) => a - b);
  const meio = Math.floor(ord.length / 2);
  return ord.length % 2 === 1 ? ord[meio] : Math.round((ord[meio - 1] + ord[meio]) / 2);
}

/** Os sinais vitais de um lugar: ele está vivo, e com que intensidade. */
export interface PlaceVitals {
  count: number;
  /** ISO do último evento, ou null se o lugar nunca disparou. */
  lastAt: string | null;
}

/**
 * Contagem e último evento por lugar.
 *
 * É o que a lista mostra embaixo do nome, e responde à única pergunta que
 * importa de relance na fase 0: **este lugar está mudo?** Um lugar sem evento
 * nenhum depois de dias é o sintoma central — raio pequeno demais, centro no
 * lugar errado, ou a permissão caiu. Ler isso hoje exige percorrer o log
 * inteiro; aqui custa uma passada.
 */
export function vitalsByPlace(events: readonly PresenceEvent[]): Map<string, PlaceVitals> {
  const out = new Map<string, PlaceVitals>();
  for (const e of events) {
    if (e.redundant) continue;
    const atual = out.get(e.placeId);
    if (!atual) {
      out.set(e.placeId, { count: 1, lastAt: e.at });
    } else {
      atual.count += 1;
      if (e.at > atual.lastAt!) atual.lastAt = e.at;
    }
  }
  return out;
}

function minutesBetween(a: string, b: string): number {
  return Math.abs(new Date(b).getTime() - new Date(a).getTime()) / 60000;
}
