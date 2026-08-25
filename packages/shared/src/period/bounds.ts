/**
 * Limites de período para a Retrospectiva — generaliza a noção de "semana"
 * (ver `../week/recap.ts`) para semana | mês | estação | ano | total, com
 * regras de disponibilidade. Derivação 100% pura (sem Angular/React),
 * compartilhada por web e mobile. Datas em horário local.
 *
 * Convenção de `offset`: 0 = período corrente do tipo, −1 = anterior, +1 = seguinte.
 * Disponibilidade (o quanto à frente o usuário pode navegar):
 *   - week:   a semana corrente só "fecha" no domingo ≥ 20h; antes disso o último
 *             período disponível é a semana anterior.
 *   - month:  o mês corrente só fica disponível no dia 01 do mês seguinte → o
 *             último disponível é sempre o mês anterior.
 *   - season: trimestre civil (Q1 Jan–Mar … Q4 Out–Dez), disponível ao vivo.
 *   - year:   o ano corrente fica disponível ao vivo (offset 0).
 *   - all:    período único de tudo (offset ignorado), disponível ao vivo.
 */
import { mondayOf } from '../week/recap';

export type PeriodKind = 'week' | 'month' | 'year' | 'season' | 'all';

/** Início fixo do período 'all' — anterior a qualquer dado real do app. */
const ALL_TIME_START_YEAR = 2000;

export interface PeriodBounds {
  /** Início inclusivo (00:00 local). */
  start: Date;
  /** Fim exclusivo (00:00 local do dia seguinte ao último). */
  end: Date;
  /** Rótulo pronto para exibição. */
  label: string;
}

const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Início do período (00:00 local) que contém `now`, deslocado por `offset`. */
function periodStart(now: Date, kind: PeriodKind, offset: number): Date {
  switch (kind) {
    case 'week': {
      const monday = mondayOf(now);
      return new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + offset * 7);
    }
    case 'month':
      return new Date(now.getFullYear(), now.getMonth() + offset, 1);
    case 'season': {
      // Trimestre civil: o construtor de Date normaliza overflow de mês,
      // então a virada de ano (ex.: Q1 − 1 → Out do ano anterior) sai grátis.
      const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
      return new Date(now.getFullYear(), quarterMonth + offset * 3, 1);
    }
    case 'year':
      return new Date(now.getFullYear() + offset, 0, 1);
    case 'all':
      return new Date(ALL_TIME_START_YEAR, 0, 1);
  }
}

/** Próximo início após `start` (= fim exclusivo do período). */
function nextStart(start: Date, kind: PeriodKind): Date {
  switch (kind) {
    case 'week':
      return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
    case 'month':
      return new Date(start.getFullYear(), start.getMonth() + 1, 1);
    case 'season':
      return new Date(start.getFullYear(), start.getMonth() + 3, 1);
    case 'year':
      return new Date(start.getFullYear() + 1, 0, 1);
    case 'all':
      // Nunca alcançado: `periodBounds` trata 'all' antes de chamar aqui
      // (o fim é ancorado em `now`). Mantido só pela exaustividade do switch.
      return new Date(start.getFullYear() + 1000, 0, 1);
  }
}

/** Rótulo do período a partir do seu início. */
export function periodLabel(kind: PeriodKind, start: Date): string {
  switch (kind) {
    case 'week': {
      const end = nextStart(start, 'week');
      const sun = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1);
      return `${pad2(start.getDate())}/${pad2(start.getMonth() + 1)} – ${pad2(sun.getDate())}/${pad2(sun.getMonth() + 1)}`;
    }
    case 'month':
      return `${MONTHS_PT[start.getMonth()]} ${start.getFullYear()}`;
    case 'season':
      return `Q${Math.floor(start.getMonth() / 3) + 1} ${start.getFullYear()}`;
    case 'year':
      return `${start.getFullYear()}`;
    case 'all':
      return 'Total';
  }
}

/** Intervalo [início, fim) do período + rótulo. */
export function periodBounds(now: Date, kind: PeriodKind, offset = 0): PeriodBounds {
  if (kind === 'all') {
    // Período único: do epoch fixo até amanhã 00:00 (inclui o dia corrente).
    const start = new Date(ALL_TIME_START_YEAR, 0, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return { start, end, label: periodLabel('all', start) };
  }
  const start = periodStart(now, kind, offset);
  start.setHours(0, 0, 0, 0);
  const end = nextStart(start, kind);
  end.setHours(0, 0, 0, 0);
  return { start, end, label: periodLabel(kind, start) };
}

/**
 * Maior `offset` que o usuário pode visualizar agora (o período mais recente
 * "disponível"). É o teto de navegação para frente; para trás é livre.
 */
export function latestAvailableOffset(now: Date, kind: PeriodKind): number {
  switch (kind) {
    case 'week': {
      // Semana corrente disponível só no domingo (getDay()===0) a partir das 20h.
      const closed = now.getDay() === 0 && now.getHours() >= 20;
      return closed ? 0 : -1;
    }
    case 'month':
      // O mês corrente só fecha no dia 01 do mês seguinte → último é o anterior.
      return -1;
    case 'season':
      // Trimestre corrente disponível ao vivo, como o ano.
      return 0;
    case 'year':
      // Ano corrente disponível ao vivo.
      return 0;
    case 'all':
      // Período único — não há navegação.
      return 0;
  }
}

/**
 * Janela de **análise** — quantos dias de histórico os derivadores de associação
 * (`triggerImpact`) enxergam, independente do período **exibido**.
 *
 * Existe porque as duas janelas não são a mesma coisa: o insight fala do usuário,
 * não da semana; a semana é só quando ele olha. Com a janela colada no período,
 * uma visão semanal dá 7 dias, e `MIN_DAYS_PER_SIDE = 3` de cada lado torna o
 * insight cruzado praticamente inalcançável — era o defeito D1 da v1.
 *
 * Ver docs/specs/retrospectiva/v2-jornal.md §2.1.
 */
export const ANALYSIS_WINDOW_DAYS = 90;

/**
 * Início do fetch necessário para o período selecionado.
 *
 * É o **menor** entre o início do período anterior (que os deltas exigem) e
 * `hoje − ANALYSIS_WINDOW_DAYS` (que as associações exigem). Fonte única das duas
 * plataformas — antes a regra estava duplicada no store mobile e inline no
 * componente web, e as duas só cobriam o período anterior.
 *
 * **Invariante:** alargar o fetch não altera nenhum `RecapValue`. Somas, médias e
 * deltas continuam calculados estritamente dentro do período exibido; só os
 * derivadores de associação leem a janela larga.
 */
export function retroSince(now: Date, kind: PeriodKind, offset: number): Date {
  const prior = periodBounds(now, kind, offset - 1).start;
  const analysis = new Date(now);
  analysis.setHours(0, 0, 0, 0);
  analysis.setDate(analysis.getDate() - ANALYSIS_WINDOW_DAYS);
  return prior < analysis ? prior : analysis;
}
