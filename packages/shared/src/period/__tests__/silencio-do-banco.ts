/**
 * A função `metricas_silencio(p_piso_dias)` em TypeScript — **dono único** da
 * emulação dela (Story 2.7).
 *
 * O detector de métrica morta é puro e recebe fatos prontos; quem os produz é
 * uma função `sql` no Postgres (migration `20260923120000_metricas_silencio.sql`),
 * que nenhum teste do repositório consegue executar — não há Postgres no CI.
 * Emulá-la é o que deixa o caminho inteiro ter prova: o banco falso do contrato
 * da edição responde por aqui, e a matriz do detector (`period/lapides.test.ts`)
 * monta os fatos dela por aqui também. **Uma emulação só**, porque duas
 * divergiriam no dia em que o SQL mudasse e só uma fosse acertada.
 *
 * O que ela copia, linha a linha, da migração:
 *
 * - **medida é dia com valor** — linha sem `value` não conta;
 * - o silêncio entre duas medidas vai da véspera seguinte à véspera da próxima;
 * - o silêncio **corrente** (depois da última medida) vai até **hoje**, e é por
 *   isso que `hoje` é parâmetro: no SQL ele é `current_date`, e um gabarito
 *   preso ao relógio da máquina mudaria de valor amanhã;
 * - só voltam os silêncios de pelo menos `piso` dias;
 * - `outraChegou` é "houve medida de **qualquer outra** métrica dentro do
 *   intervalo" — o sinal que barra o blecaute —, **ou** o acervo não tem
 *   nenhuma outra métrica, caso em que não há o que testemunhar e o aparelho
 *   conta como vivo.
 *
 * Não é o SQL, e não substitui conferi-lo no banco: o que ela prova é o contrato
 * entre a forma dos fatos e a regra que os lê.
 */
import type { MetricaNoAcervo, SilencioDeMetrica } from '../lapides';

/** O dia `n` dias depois, sem fuso. */
export function diaMais(dia: string, n: number): string {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(Date.UTC(a!, m! - 1, d! + n)).toISOString().slice(0, 10);
}

/** Quantos dias de `de` a `ate`, inclusive — o `ate − de + 1` do SQL. */
export function diasDe(de: string, ate: string): number {
  const [a1, m1, d1] = de.split('-').map(Number);
  const [a2, m2, d2] = ate.split('-').map(Number);
  return Math.round((Date.UTC(a2!, m2! - 1, d2!) - Date.UTC(a1!, m1! - 1, d1!)) / 86_400_000) + 1;
}

/** Os dias de `de` a `ate`, inclusive. */
export function diasEntre(de: string, ate: string): string[] {
  const out: string[] = [];
  for (let d = de; d <= ate; d = diaMais(d, 1)) out.push(d);
  return out;
}

/**
 * Os fatos que a função devolveria para um acervo dado como "que dias cada
 * métrica teve medida".
 *
 * Métrica sem nenhum dia não volta — é o que o `group by` sobre as medidas faz,
 * e é por isso que as oito métricas que nunca receberam dado não aparecem.
 */
export function fatosDoSilencio(
  diasPorMetrica: Readonly<Record<string, readonly string[]>>,
  hoje: string,
  piso: number,
): MetricaNoAcervo[] {
  const acervo = Object.entries(diasPorMetrica)
    .map(([metrica, dias]) => [metrica, [...new Set(dias)].sort()] as const)
    .filter(([, dias]) => dias.length > 0)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1));

  return acervo.map(([metrica, dias]) => {
    // O caso degenerado: sem nenhuma outra métrica no acervo não há o que
    // testemunhar, e o aparelho conta como vivo — senão uma instalação de uma
    // métrica só nunca declararia morte nenhuma.
    const sozinha = !acervo.some(([outra]) => outra !== metrica);
    const silencios: SilencioDeMetrica[] = [];
    for (let k = 0; k < dias.length; k += 1) {
      const de = diaMais(dias[k]!, 1);
      const ate = k + 1 < dias.length ? diaMais(dias[k + 1]!, -1) : hoje;
      if (ate < de) continue;
      const n = diasDe(de, ate);
      if (n < Math.max(piso, 1)) continue;
      const outraChegou = sozinha || acervo.some(
        ([outra, diasDela]) => outra !== metrica && diasDela.some((d) => d >= de && d <= ate),
      );
      silencios.push({ de, ate, dias: n, outraChegou });
    }
    return {
      metrica,
      ultimaISO: dias[dias.length - 1]!,
      medidas: dias.length,
      silencios,
    };
  });
}
