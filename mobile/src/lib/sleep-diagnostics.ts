/**
 * Por que uma noite não virou linha de `sono`.
 *
 * Existe para separar **"o relógio não gravou"** de **"o app perdeu"**. Sem isso os
 * dois casos são indistinguíveis na tela: `aggregateSleepNights` descarta em
 * silêncio a noite que não rende nenhum intervalo dormindo, e o buraco fica igual
 * ao de uma noite que nunca existiu.
 *
 * ## O que a primeira rodada mostrou (25/08/2026, 60 dias, 769 amostras)
 *
 * `34 registradas · 1 perdida · 25 sem amostra`. **O pipeline está bom** — a
 * agregação perdeu uma noite em sessenta. As 25 restantes não existem no HealthKit
 * do aparelho: a era Apple Watch (até 18/07) tinha cobertura ruim na origem; a era
 * Garmin roda a ~88%.
 *
 * Isso **corrigiu** a suspeita que motivou o módulo. Eu havia lido "54 noites com
 * `fcRepouso` e sem `sono`" como prova de que o relógio mediu e nós perdemos —
 * inferência forte demais: o `restingHeartRate` da Apple é um valor diário
 * derivado de períodos de inatividade e **não depende de rastreio de sono**.
 * Existir FC de repouso não prova que a noite foi medida.
 *
 * Este módulo é derivação pura: recebe as amostras cruas já buscadas e devolve o
 * veredito por noite, sem tocar em HealthKit.
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
  | 'anulada'
  /**
   * Há rótulo de sono, mas nenhuma amostra forma intervalo válido (`end <= start`).
   * `toIntervals` descarta esses, então o agregador não vê sono nenhum. Amostra
   * degenerada da fonte — não é perda nossa, e confundir com `anulada` faz o
   * diagnóstico acusar um `AWAKE` que não existe.
   */
  | 'degenerada';

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
  /** Noites com amostra degenerada da fonte. Não é perda nossa; é dado quebrado. */
  degeneradas: number;
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
    // "Dormindo" de verdade exige intervalo **válido**: a mesma regra do
    // `toIntervals`, senão uma amostra de duração zero conta como sono e o
    // veredito acusa um `AWAKE` inexistente.
    const dormindoValido = samples.some(
      (s) => SLEEPING.has((s.label ?? '').toUpperCase())
        && new Date(s.end).getTime() > new Date(s.start).getTime(),
    );
    const temRotuloDeSono = Object.keys(labels).some((l) => SLEEPING.has(l));

    const verdict: SleepVerdict = hours != null
      ? 'ok'
      : dormindoValido
        ? 'anulada'          // havia sono com duração; o AWAKE comeu tudo
        : temRotuloDeSono
          ? 'degenerada'     // rótulo de sono, mas sem intervalo válido
          : 'sem-estagio';   // só INBED/AWAKE — o agregador descarta calado

    nights.push({ day, verdict, samples: samples.length, labels, hours: hours ?? null });
  }

  nights.sort((a, b) => (a.day < b.day ? 1 : -1)); // mais recente primeiro

  return {
    nights,
    ok: nights.filter((n) => n.verdict === 'ok').length,
    perdidas: nights.filter((n) => n.verdict === 'sem-estagio' || n.verdict === 'anulada').length,
    degeneradas: nights.filter((n) => n.verdict === 'degenerada').length,
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
    degeneradas: diag.degeneradas,
    semAmostra: nights.filter((n) => n.verdict === 'sem-amostra').length,
  };
}
