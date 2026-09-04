/**
 * Bem-estar diário do intervals.icu — normalização pura da VFC.
 *
 * O Garmin não escreve HRV no Apple Health, mas manda a VFC noturna para o
 * intervals.icu, que a devolve em `GET /athlete/{id}/wellness` como um registro
 * por dia (`id` = 'YYYY-MM-DD' local do atleta). Daqui sai só o que o ingest
 * grava em `health_daily` sob a métrica `'vfc'` (ADR 0026): valor, dia e o tipo
 * da medida — `hrvSDNN` quando existir, senão `hrv`, que o Garmin reporta como
 * RMSSD. Sono e FC de repouso ficam com o Apple Watch, de propósito.
 *
 * **Tudo o que decide o que vai para o banco mora aqui**, e não na edge
 * function: a `supabase/functions` não é typechecada nem testada por nenhum
 * comando do CI (não há Deno no ambiente). Quem move regra para lá a move para
 * fora do alcance dos testes — foi a conclusão da revisão, e é por isso que até
 * a montagem da query e a leitura das linhas existentes são funções desta
 * folha.
 *
 * Sem imports: a edge function `connections-ingest` importa este módulo por
 * caminho relativo e o Deno não resolve specifier sem extensão (mesmo padrão de
 * `fitness/dedupe.ts` e `cultura/tipos.ts`). É também por isso que 'YYYY-MM-DD'
 * é montado à mão aqui, em vez de vir do `localDateStr` de `date/local.ts` —
 * que segue sendo a forma canônica em todo o resto do núcleo.
 */

export type WellnessHrvKind = 'sdnn' | 'rmssd';

export interface WellnessHrv {
  /** 'YYYY-MM-DD' — o `id` do registro no intervals.icu (data local do atleta). */
  day: string;
  /** Milissegundos. */
  value: number;
  kind: WellnessHrvKind;
}

export interface WellnessWindow {
  /** 'YYYY-MM-DD' inclusivo. */
  oldest: string;
  /** 'YYYY-MM-DD' inclusivo — amanhã, para absorver o fuso do atleta. */
  newest: string;
  /** Hoje, para descartar registro com data no futuro antes de gravar. */
  today: string;
  /** Quantos dias para trás a janela cobre a partir de `now`. */
  days: number;
}

/** Janela de cada run: cobre atrasos de sincronização do relógio com folga. */
export const WELLNESS_WINDOW_DAYS = 14;
/** Primeira vez do usuário (nenhuma linha `'vfc'` de `intervals` ainda). */
export const WELLNESS_INITIAL_DAYS = 120;
/** Métrica de `health_daily` que recebe a VFC — a mesma do Apple Health (ADR 0026). */
export const WELLNESS_METRIC = 'vfc';
/** Marca das linhas desta fonte em `extra.source`. */
export const WELLNESS_SOURCE = 'intervals';

/**
 * Faixa plausível de VFC noturna, em milissegundos.
 *
 * RMSSD e SDNN de adulto ficam com folga dentro disto. Fora dela é falha de
 * medida ou troca de unidade na origem, e um único valor absurdo contamina a
 * baseline de 7 dias — ou seja, a prontidão de uma semana inteira. Descartar é
 * mais honesto que gravar: o dia fica sem linha, e `coverage` diz isso.
 */
export const WELLNESS_HRV_MIN_MS = 5;
export const WELLNESS_HRV_MAX_MS = 300;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 'YYYY-MM-DD' que existe no calendário. `2026-13-45` casa com o regex e não existe. */
function isDay(day: unknown): day is string {
  if (typeof day !== 'string' || !DAY_RE.test(day)) return false;
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function plausible(v: unknown): v is number {
  return (
    typeof v === 'number' &&
    Number.isFinite(v) &&
    v >= WELLNESS_HRV_MIN_MS &&
    v <= WELLNESS_HRV_MAX_MS
  );
}

/**
 * Registros brutos do `/wellness` → VFC por dia, ascendente por dia.
 *
 * Nunca lança: item não-objeto, `id` que não é uma data real, ou VFC fora da
 * faixa plausível é descartado. Dia repetido: o último registro válido vence.
 */
export function normalizeIntervalsWellness(raw: unknown): WellnessHrv[] {
  if (!Array.isArray(raw)) return [];
  const byDay = new Map<string, WellnessHrv>();
  for (const item of raw) {
    if (item == null || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    // Colchete, não ponto: `r` é um `Record<string, unknown>`, e a web compila
    // com `noPropertyAccessFromIndexSignature`.
    const day = r['id'];
    if (!isDay(day)) continue;
    if (plausible(r['hrvSDNN'])) byDay.set(day, { day, value: r['hrvSDNN'], kind: 'sdnn' });
    else if (plausible(r['hrv'])) byDay.set(day, { day, value: r['hrv'], kind: 'rmssd' });
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

/** Linha `'vfc'` já em `health_daily`, na forma em que o PostgREST devolve. */
export interface WellnessExistingRow {
  day: string;
  value?: number | string | null;
  extra?: Record<string, unknown> | null;
}

export interface WellnessPlan {
  /** Dias a gravar. */
  write: WellnessHrv[];
  /** Dias pulados: outra fonte (o Apple Health) já mediu aquele dia. */
  skipped: number;
  /** Dias já gravados por esta fonte com o mesmo valor — nada a fazer. */
  unchanged: number;
  /** Dias descartados por virem com data no futuro. */
  future: number;
}

/**
 * Decide o que gravar. Duas regras, e as duas importam:
 *
 * **Precedência do Apple Health.** O dia só é gravado quando não há linha
 * `'vfc'` nenhuma ou quando a que existe já é desta fonte. Repare que o que
 * decide é a *existência da linha*, não o valor de `extra.source`: uma linha do
 * Apple Health não tem `source` algum, e tratar "sem source" como "sem linha"
 * faria a VFC do Garmin sobrescrever a medição do relógio — o contrário da
 * regra. A leitura das linhas vive nesta função, e não na edge function, para
 * que essa inversão seja pegável por teste.
 *
 * **Idempotência.** Dia cujo valor já é o mesmo não volta ao banco: o run roda a
 * cada 15 minutos sobre uma janela de 14 dias, e sem isto seriam ~1300
 * atualizações inúteis por dia, cada uma disparando o gatilho de `updated_at`.
 *
 * O RPC do mobile continua sobrescrevendo sem condição, então uma medição do
 * Watch que chegue depois vence de qualquer jeito.
 *
 * @param maxDay Último dia aceito ('YYYY-MM-DD'). A janela pede até amanhã de
 *   propósito, por causa do fuso do atleta, mas gravar dia futuro faria o
 *   consumidor ler amanhã como "a VFC de hoje".
 */
export function planWellnessRows(
  hrv: readonly WellnessHrv[],
  existing: readonly WellnessExistingRow[],
  maxDay?: string,
): WellnessPlan {
  const rowByDay = new Map<string, WellnessExistingRow>();
  for (const r of existing) if (isDay(r.day)) rowByDay.set(r.day, r);

  const plan: WellnessPlan = { write: [], skipped: 0, unchanged: 0, future: 0 };
  for (const h of hrv) {
    if (maxDay && h.day > maxDay) {
      plan.future++;
      continue;
    }
    const row = rowByDay.get(h.day);
    if (row === undefined) {
      plan.write.push(h);
      continue;
    }
    const source = (row.extra ?? null)?.['source'];
    if (source !== WELLNESS_SOURCE) {
      plan.skipped++;
      continue;
    }
    if (row.value != null && Number(row.value) === h.value) plan.unchanged++;
    else plan.write.push(h);
  }
  return plan;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** 'YYYY-MM-DD' local de `d` deslocada `offsetDays` dias. */
function dayStr(d: Date, offsetDays: number): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + offsetDays);
  return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`;
}

/**
 * Janela de busca do `/wellness` para um run.
 *
 * Datas locais sem fuso, como em `fetchIntervalsActivities`: a API interpreta
 * no fuso do atleta e o runtime da function está em UTC. `newest` é amanhã pelo
 * mesmo motivo do `+1d` do fetch de atividades — quando o atleta já virou o dia
 * e o servidor ainda não, o registro de hoje não pode ficar de fora. O que
 * chegar datado depois de `today` é descartado na gravação.
 */
export function wellnessWindow(hasIntervalsRows: boolean, now: Date = new Date()): WellnessWindow {
  const days = hasIntervalsRows ? WELLNESS_WINDOW_DAYS : WELLNESS_INITIAL_DAYS;
  return {
    oldest: dayStr(now, -days),
    newest: dayStr(now, 1),
    today: dayStr(now, 0),
    days,
  };
}

/**
 * Query string do `/wellness`. Mora aqui, e não no cliente, porque trocar
 * `oldest` por `newest` devolve lista vazia sem erro nenhum — a falha some no
 * `fetched: 0`, indistinguível de "o atleta não tem VFC". Aqui isso é um teste.
 */
export function wellnessQuery(w: WellnessWindow): string {
  return `oldest=${encodeURIComponent(w.oldest)}&newest=${encodeURIComponent(w.newest)}`;
}
