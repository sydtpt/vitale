/**
 * Lado do aparelho do diagnóstico de sono.
 *
 * Vive em `services/` porque toca módulo nativo: a derivação pura fica em
 * `lib/sleep-diagnostics.ts`, que é onde estão os testes. Misturar os dois
 * quebrava a suíte inteira — o Jest não carrega os Turbo Modules.
 */
import { HK, healthSource } from '../lib/health-source/active';
import type { Sample } from '../lib/health-buckets';
import {
  diagnoseSleepNights,
  marcarNoitesVazias,
  type SleepDiagSummary,
} from '../lib/sleep-diagnostics';

/** 'YYYY-MM-DD' local. */
function dayStr(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Roda o diagnóstico contra o HealthKit do aparelho, nos últimos `dias`.
 *
 * Lê as amostras **cruas**, sem passar pelo agregador do sync — é justamente a
 * diferença entre as duas leituras que responde a pergunta. Note que
 * `queryCategorySamples` engole erro e devolve `[]` (ver `kingstinct-provider`),
 * então "zero amostras" aqui pode ser ausência real **ou** falha silenciosa da
 * consulta; por isso o total lido aparece no resumo.
 */
export async function diagnosticarSonoNoAparelho(dias = 60): Promise<SleepDiagSummary & {
  /** Total de amostras cruas lidas. Zero com `dias` grande é sinal de falha, não de ausência. */
  amostrasLidas: number;
}> {
  const fim = new Date();
  const ini = new Date();
  ini.setHours(0, 0, 0, 0);
  ini.setDate(ini.getDate() - (dias - 1));

  const raw = await healthSource.queryCategorySamples(HK.sleepAnalysis, {
    startDate: ini.toISOString(),
    endDate: fim.toISOString(),
    ascending: true,
  });

  const samples: Sample[] = raw.map((v) => ({
    value: 0,
    start: v.startDate,
    end: v.endDate,
    label: String(v.value).toUpperCase(),
  }));

  const diag = marcarNoitesVazias(
    diagnoseSleepNights(samples),
    dayStr(ini.getTime()),
    dayStr(fim.getTime()),
  );
  return { ...diag, amostrasLidas: samples.length };
}
