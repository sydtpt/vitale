/**
 * Acesso à tabela `health_daily` — dono único (AD-4).
 *
 * Uma linha por (dia, métrica). Escrever **não** passa por aqui: quem grava é o
 * sync do mobile, via upsert em lote com `AGG_VERSION` (ADR 0004) — recorrigir
 * agregação é bump de versão, não migration nem escrita avulsa — e, para a
 * `'vfc'` do intervals.icu, a edge function `connections-ingest` (ADR 0026),
 * que marca as linhas dela em `extra.source`. Daqui só se lê.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { isValidDate } from '../date/local';
import type { HealthDaily } from '../models';
import type { MetricaNoAcervo, SilencioDeMetrica } from '../period/lapides';

const COLUMNS = 'day,metric,value,min_value,max_value,count,extra';

export interface HealthDailyRow {
  day: string;
  metric: string;
  value: number | string | null;
  min_value?: number | string | null;
  max_value?: number | string | null;
  count?: number | null;
  extra?: Record<string, unknown> | null;
}

/** Linha do Postgres → modelo de domínio. Único lugar onde essa tradução existe. */
export function toHealthDaily(r: HealthDailyRow, userId: string): HealthDaily {
  return {
    userId,
    day: r.day,
    metric: r.metric,
    value: r.value == null ? null : Number(r.value),
    minValue: r.min_value == null ? undefined : Number(r.min_value),
    maxValue: r.max_value == null ? undefined : Number(r.max_value),
    count: r.count ?? undefined,
    extra: r.extra ?? undefined,
  };
}

/**
 * Tamanho da página. O PostgREST tem um teto **implícito** de 1000 linhas por
 * resposta: passar dele não dá erro — os registros excedentes simplesmente não
 * vêm, em ordem indefinida. `health_daily` grava ~9 linhas por dia (uma por
 * métrica), então 111 dias já bastam para estourar.
 *
 * Foi assim que a Retrospectiva no modo Estação (≈147 dias ⇒ ~1400 linhas) passou
 * a mostrar buraco onde havia dado. Paginar é obrigatório aqui, não otimização.
 */
const PAGE = 1000;

/**
 * Busca todas as páginas de uma consulta por intervalo.
 *
 * Ordenação estável é parte do contrato: sem `order`, duas páginas podem repetir
 * ou pular linhas. Para quando `page` volta com menos que o tamanho da página —
 * é a única condição de parada confiável, já que não há contagem total.
 */
async function fetchAllPages<T>(
  run: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await run(from, from + PAGE - 1);
    if (error) throw error;
    const page = (data ?? []) as T[];
    out.push(...page);
    if (page.length < PAGE) return out;
  }
}

/** Agregados diários desde `since`, em ordem cronológica. */
export async function fetchHealthDailySince(
  db: SupabaseClient,
  userId: string,
  since: string,
): Promise<HealthDaily[]> {
  const rows = await fetchAllPages<HealthDailyRow>((lo, hi) =>
    db
      .from('health_daily')
      .select(COLUMNS)
      .eq('user_id', userId)
      .gte('day', since)
      .order('day', { ascending: true })
      .order('metric', { ascending: true })
      .range(lo, hi),
  );
  return rows.map((r) => toHealthDaily(r, userId));
}

/** Só dia, métrica e valor — para agregados que não precisam de min/max/extra. */
export async function fetchHealthDailyValues(
  db: SupabaseClient,
  userId: string,
  since: string,
): Promise<Array<{ day: string; metric: string; value: number | null }>> {
  const rows = await fetchAllPages<{ day: string; metric: string; value: number | string | null }>(
    (lo, hi) =>
      db
        .from('health_daily')
        .select('day,metric,value')
        .eq('user_id', userId)
        .gte('day', since)
        .order('day', { ascending: true })
        .order('metric', { ascending: true })
        .range(lo, hi),
  );
  return rows.map((r) => ({
    day: r.day,
    metric: r.metric,
    value: r.value == null ? null : Number(r.value),
  }));
}

/* ── o silêncio de cada métrica (Story 2.7) ─────────────────────────────── */

/**
 * Uma linha da função `metricas_silencio` — a forma do Postgres, não a do domínio.
 *
 * `primeira` está aqui porque a função a devolve, e **não** chega ao domínio:
 * nenhuma das quatro regras a lê, e um campo que ninguém confere é um campo em
 * que alguém vai confiar um dia. Quem quiser saber quando a métrica nasceu chama
 * a função à mão — ela continua respondendo.
 */
interface LinhaDoSilencio {
  metrica: string;
  primeira: string | null;
  ultima: string | null;
  medidas: number | string | null;
  silencios: unknown;
}

/** Um número do Postgres (`int` ou `numeric`, que vem texto) — ou nada. */
function numeroDe(v: unknown): number | null {
  if (v == null || typeof v === 'boolean' || (typeof v === 'object')) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Os fatos do silêncio de cada métrica — o que o detector de métrica morta lê
 * (Story 2.7, ADR 0055).
 *
 * **Vem agrupado do banco**, pela função `metricas_silencio(int)` (migration
 * `20260923120000`), e não das duas leituras acima: elas exigem `since`, e a
 * pergunta "quando esta métrica calou pela última vez" é sobre a vida inteira
 * dela. Ler o acervo inteiro no cliente custaria cinco idas à rede e ~200 KB em
 * toda abertura da Retrospectiva; isto devolve uma linha por métrica — hoje
 * pouco mais de vinte, alguns KB. **Não é tamanho fixo**: o `jsonb` de cada
 * linha carrega todos os silêncios da vida da métrica, então ele cresce devagar,
 * com o número de silêncios acima do piso — e não com o tamanho do acervo.
 *
 * **Fatos, nunca juízo.** Quem decide quem morreu é `lapidesDoAcervo`
 * (`period/lapides.ts`), com o piso que se passa aqui. A função só conta o que
 * houve.
 *
 * **Nada aqui tem `userId`**, ao contrário das outras nove leituras: a função
 * filtra por `auth.uid()`, e portanto uma chamada **sem sessão** devolve zero
 * linhas *sem erro*. Por isso a lista vazia é significativa e é levada adiante:
 * o acervo do dono sempre tem métrica, então **zero métricas** não é "nenhum
 * silêncio", é "a função não viu ninguém". Quem avisa é `fetchDadosDaRetro`, e
 * quem o mostra ao dono é a linha `leitura:` do script.
 *
 * Métrica sem nenhuma medida não volta — as oito que o app pede ao HealthKit e
 * nunca receberam dado nenhum ficam de fora sozinhas.
 *
 * **Fato podre é descartado, nunca corrigido.** É o lado que falha ABERTO se for
 * descuidado: uma contagem `NaN` passaria pela regra das dez medidas (toda
 * comparação com `NaN` é falsa) e ganharia lápide, que é o oposto do que o
 * detector promete. Contagem que não é número, data que não é dia de calendário
 * e intervalo invertido saem aqui.
 *
 * @param pisoDias silêncios menores que isto não vêm. É o mesmo número que a
 *                 regra usa; quem o possui é o núcleo
 *                 (`PISO_DE_SILENCIO_DIAS`), e ele viaja até aqui por
 *                 parâmetro para o banco não ter régua própria.
 */
export async function fetchSilencioDasMetricas(
  db: SupabaseClient,
  pisoDias: number,
): Promise<MetricaNoAcervo[]> {
  const { data, error } = await db.rpc('metricas_silencio', { p_piso_dias: pisoDias });
  if (error) throw error;
  const out: MetricaNoAcervo[] = [];
  for (const r of (data ?? []) as LinhaDoSilencio[]) {
    // Sem última medida não há morte para datar, e é o único campo que as regras
    // leem. `primeira` não vem ao domínio — ver {@link LinhaDoSilencio}.
    if (typeof r.ultima !== 'string' || !isValidDate(r.ultima)) continue;
    const medidas = numeroDe(r.medidas);
    // Contagem podre não vira zero: zero passaria na regra das dez medidas por
    // ser MENOR que dez, e o que se quer é a métrica inteira fora.
    if (medidas === null) continue;
    out.push({
      metrica: r.metrica,
      ultimaISO: r.ultima,
      medidas,
      silencios: silenciosDe(r.silencios),
    });
  }
  return out;
}

/**
 * O `jsonb` do banco → a forma do domínio. O que não tiver a forma inteira sai.
 *
 * Os três campos decidem coisas diferentes, e todos os três se conferem: `dias`
 * é comparado com o piso e com o recorde, `de` elege o silêncio **corrente** por
 * comparação de texto (`de > ultima`), e `ate` separa o fechado do aberto. Uma
 * data que não é dia de calendário compararia como texto qualquer, e um
 * intervalo invertido (`ate < de`) não é silêncio nenhum.
 */
function silenciosDe(valor: unknown): SilencioDeMetrica[] {
  if (!Array.isArray(valor)) return [];
  const out: SilencioDeMetrica[] = [];
  for (const s of valor as Record<string, unknown>[]) {
    const de = s?.['de'];
    const ate = s?.['ate'];
    const dias = numeroDe(s?.['dias']);
    if (typeof de !== 'string' || !isValidDate(de)) continue;
    if (typeof ate !== 'string' || !isValidDate(ate)) continue;
    if (ate < de) continue;
    if (dias === null || dias < 1) continue;
    out.push({ de, ate, dias, outraChegou: s['outra_chegou'] === true });
  }
  return out;
}
