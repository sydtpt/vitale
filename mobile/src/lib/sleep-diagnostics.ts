/**
 * Por que uma noite não virou linha de `sono`.
 *
 * Motivação (25/08/2026): cruzando `health_daily` em produção, **54 noites de 2026
 * têm `fcRepouso` mas não têm `sono`**. FC de repouso é medida durante o sono, então
 * o relógio estava no pulso e o aparelho detectou a noite — o dado se perdeu no
 * nosso caminho, não no do usuário. Junho foi o pior mês: 11 de 28 noites.
 *
 * `aggregateSleepNights` só produz uma noite quando existe intervalo **dormindo**
 * (`ASLEEP` genérico ou um estágio detalhado). Uma noite gravada só com `INBED`
 * — ou em que o `AWAKE` cobre todo o sono — sai do agregador sem nenhuma linha e
 * **sem nenhum aviso**: some, indistinguível de noite que nunca existiu.
 *
 * Este módulo separa os dois casos. É derivação pura: recebe as amostras cruas já
 * buscadas e devolve o veredito por noite, sem tocar em HealthKit.
 */
import { aggregateSleepNights, type Sample } from './health-buckets';

export type SleepVerdict =
  /** Virou linha normalmente. */
  | 'ok'
  /** O HealthKit não tem amostra nenhuma nessa noite — relógio fora ou não sincronizado. */
  | 'sem-amostra'
  /** Há amostras, mas nenhuma é "dormindo": só `INBED` e/ou `AWAKE`. Perda nossa. */
  | 'sem-estagio'
  /** Havia sono, mas o `AWAKE` cobriu tudo — net <= 0. Perda nossa. */
  | 'anulada';

export interface SleepNightDiag {
  /** Dia em que acordou ('YYYY-MM-DD') — a mesma chave que a agregação usa. */
  day: string;
  verdict: SleepVerdict;
  /** Quantas amostras cruas caíram nessa noite. */
  samples: number;
  /** Contagem por rótulo ('INBED', 'ASLEEP', 'CORE', 'AWAKE'…). */
  labels: Record<string, number>;
  /** Horas agregadas quando o veredito é 'ok'. */
  hours: number | null;
}

export interface SleepDiagSummary {
  nights: SleepNightDiag[];
  ok: number;
  /** Noites perdidas **por nossa causa** — as que o app deveria ter registrado. */
  perdidas: number;
  /** Noites sem amostra nenhuma: nada a fazer do lado do app. */
  semAmostra: number;
}

/** 'YYYY-MM-DD' local. */
function dayStr(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const SLEEPING = new Set(['ASLEEP', 'CORE', 'DEEP', 'REM']);

/**
 * Agrupa por **dia em que a amostra termina** — a mesma regra do agregador
 * (`localDayKey(iv.end)`), senão os dois discordariam sobre a qual noite um
 * intervalo pertence e o diagnóstico acusaria erro onde não há.
 */
export function diagnoseSleepNights(raw: Sample[]): SleepDiagSummary {
  const byNight = new Map<string, Sample[]>();
  for (const s of raw) {
    const key = dayStr(new Date(s.end).getTime());
    const arr = byNight.get(key);
    if (arr) arr.push(s);
    else byNight.set(key, [s]);
  }

  // Roda o agregador de verdade — não uma reimplementação. Um diagnóstico que
  // simula a lógica que está diagnosticando não prova nada.
  const horasPorNoite = new Map<string, number>();
  for (const n of aggregateSleepNights(raw)) {
    horasPorNoite.set(dayStr(new Date(n.start).getTime()), n.value);
  }

  const nights: SleepNightDiag[] = [];
  for (const [day, samples] of byNight) {
    const labels: Record<string, number> = {};
    for (const s of samples) {
      const l = (s.label ?? '').toUpperCase() || '(sem rótulo)';
      labels[l] = (labels[l] ?? 0) + 1;
    }
    const hours = horasPorNoite.get(day);
    const temDormindo = Object.keys(labels).some((l) => SLEEPING.has(l));

    const verdict: SleepVerdict = hours != null
      ? 'ok'
      : temDormindo
        ? 'anulada'      // tinha sono, o AWAKE comeu tudo
        : 'sem-estagio'; // só INBED/AWAKE — o agregador descarta calado

    nights.push({ day, verdict, samples: samples.length, labels, hours: hours ?? null });
  }

  nights.sort((a, b) => (a.day < b.day ? 1 : -1)); // mais recente primeiro

  return {
    nights,
    ok: nights.filter((n) => n.verdict === 'ok').length,
    perdidas: nights.filter((n) => n.verdict === 'sem-estagio' || n.verdict === 'anulada').length,
    semAmostra: 0, // preenchido por quem sabe o intervalo pedido — ver `marcarNoitesVazias`
  };
}

/**
 * Completa o diagnóstico com as noites do intervalo que **não tiveram amostra
 * nenhuma**. Precisa do intervalo pedido, que `diagnoseSleepNights` não conhece —
 * sem isso, "não veio nada" some da conta em vez de virar um veredito.
 */
export function marcarNoitesVazias(
  diag: SleepDiagSummary,
  from: string,
  to: string,
): SleepDiagSummary {
  const vistas = new Set(diag.nights.map((n) => n.day));
  const nights = [...diag.nights];

  const ini = new Date(`${from}T00:00:00`);
  const fim = new Date(`${to}T00:00:00`);
  for (const d = new Date(ini); d <= fim; d.setDate(d.getDate() + 1)) {
    const day = dayStr(d.getTime());
    if (vistas.has(day)) continue;
    nights.push({ day, verdict: 'sem-amostra', samples: 0, labels: {}, hours: null });
  }

  nights.sort((a, b) => (a.day < b.day ? 1 : -1));
  return {
    nights,
    ok: diag.ok,
    perdidas: diag.perdidas,
    semAmostra: nights.filter((n) => n.verdict === 'sem-amostra').length,
  };
}
