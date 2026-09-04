/**
 * Períodos de sono → a linha diária de `health_daily`.
 *
 * ## Por que existe
 *
 * `sleep_periods` passa a ser a fonte, mas `health_daily.sono` **não morre**:
 * a prontidão (`health/readiness`), a retrospectiva (`period/retro`), os
 * destaques da semana e as notificações leem `seriesFor('sono')` e não podem
 * quebrar.
 *
 * Ter a mesma grandeza em dois lugares é o padrão de reclamação nº 5 da pesquisa
 * competitiva — "métricas do mesmo app se contradizem". A única forma de isso
 * não acontecer é a linha diária ser **derivada**, nunca calculada em paralelo:
 * uma fonte, duas formas, escritas no mesmo ciclo de sync.
 *
 * ## Por que no cliente, e não num trigger
 *
 * O precedente de trigger no banco (ADR 0005, métricas estimadas) é difícil de
 * depurar quando erra: o valor aparece certo numa tela e errado na outra sem
 * nada no meio para inspecionar. Aqui a derivação é uma função pura, testada,
 * que roda antes do upsert.
 *
 * ## O formato do `extra` é contrato
 *
 * As chaves são exatamente as que `aggregateSleep` grava hoje — `deep`, `rem`,
 * `core`, `unspecified`, `awake`, `inbed`, `onset`, todas em **horas**. Isso não
 * é gosto: é o que faz o backfill reescrever o passado sem que nenhum consumidor
 * perceba. O teste que trava esse formato é o mais importante deste módulo.
 */

import type { SleepPeriod } from '../models';

const MS_H = 3_600_000;

/**
 * Latência abaixo disto não é latência.
 *
 * Espelha `MIN_ONSET_MS` de `mobile/src/lib/health-buckets.ts`. Fontes que
 * derivam a janela "na cama" do próprio sono abrem `INBED` no mesmo instante do
 * `onset` — o Garmin faz isso em 41 de 42 noites medidas. Gravar esse zero
 * disfarçado faria a tela afirmar "você apagou assim que deitou".
 */
export const MIN_LATENCY_MIN = 1;

/** Uma linha de `health_daily` com `metric = 'sono'`, pronta para upsert. */
export interface DerivedSleepDay {
  day: string;                          // 'YYYY-MM-DD' local (dia de acordar)
  value: number;                        // Σ horas líquidas dormidas
  count: number;                        // nº de períodos do dia
  extra: Record<string, number> | null; // horas por estágio + inbed + onset
}

/**
 * Soma os períodos por dia de acordar e devolve a linha diária de cada dia.
 *
 * Agrupa por `wakeDay` — a mesma convenção que o agregador usa hoje
 * (`localDayKey(iv.end)`), e a que junta a noite com a nota que o usuário dá ao
 * acordar em `daily_ratings`.
 *
 * Saída ordenada por dia, para o upsert em lote ser determinístico.
 */
export function deriveSleepDays(periods: readonly SleepPeriod[]): DerivedSleepDay[] {
  const byDay = new Map<string, SleepPeriod[]>();
  for (const p of periods) {
    const group = byDay.get(p.wakeDay);
    if (group) group.push(p);
    else byDay.set(p.wakeDay, [p]);
  }

  const days: DerivedSleepDay[] = [];
  for (const [day, group] of byDay) {
    let value = 0;
    const extra: Record<string, number> = {};

    for (const p of group) {
      value += p.asleepH;

      for (const [stage, hours] of Object.entries(p.stages ?? {})) {
        extra[stage] = (extra[stage] ?? 0) + hours;
      }

      // `inbed` e `onset` moram no mesmo mapa que os estágios porque é assim que
      // o formato de hoje os grava — não são estágios, são grandezas da janela.
      if (p.inBedAt && p.inBedEnd) {
        const bedH = (new Date(p.inBedEnd).getTime() - new Date(p.inBedAt).getTime()) / MS_H;
        if (bedH > 0) extra['inbed'] = (extra['inbed'] ?? 0) + bedH;
      }
      if (p.inBedAt) {
        const latMin =
          (new Date(p.onsetAt).getTime() - new Date(p.inBedAt).getTime()) / 60_000;
        if (latMin >= MIN_LATENCY_MIN) {
          extra['onset'] = (extra['onset'] ?? 0) + latMin / 60;
        }
      }
    }

    days.push({
      day,
      value,
      count: group.length,
      // Fonte sem hipnograma nem janela de cama não gera nada: `extra` fica nulo,
      // exatamente como hoje. `{}` seria um estado novo que ninguém espera.
      extra: Object.keys(extra).length > 0 ? extra : null,
    });
  }

  return days.sort((a, b) => a.day.localeCompare(b.day));
}

/**
 * Tempo acordado de um período, em minutos.
 *
 * Distingue os três estados: `null` quando a fonte não reporta vigília — que é
 * o caso de todas as 42 noites da era Garmin —, e `0` quando ela reporta e não
 * houve nenhuma. Devolver zero nos dois casos faria a tela afirmar "você dormiu
 * direto" quando a verdade é "não sei".
 */
export function awakeMinOf(p: SleepPeriod): number | null {
  if (p.awakenings === null) return null;
  return p.awakenings.reduce(
    (sum, a) => sum + (new Date(a.to).getTime() - new Date(a.from).getTime()) / 60_000,
    0,
  );
}
