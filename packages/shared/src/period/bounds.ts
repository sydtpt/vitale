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
 *   - season: trimestre civil (Q1 Jan–Mar … Q4 Out–Dez), com a mesma regra do
 *             mês → o último disponível é sempre o trimestre anterior.
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

/**
 * Os doze meses em português, na ordem de `Date.getMonth()`.
 *
 * Exportado porque a quinta regra da conferência (`ia/verificar.ts`) precisa
 * reconhecer o **nome próprio errado** — "contra 17 em junho", com o anterior
 * sendo julho — e um léxico de meses com dois donos é como as duas listas
 * divergem sem ninguém notar.
 */
export const MONTHS_PT = [
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
 * O `offset` do período do tipo `kind` que **começa** em `startISO`, contado a
 * partir de `now` — o inverso de {@link periodBounds}.
 *
 * Existe para a rota da revista (`/revista/[tipo]/[inicio]`, Story 1.11): o
 * endereço guarda o início do período, que é o que não muda com o relógio, e a
 * tela precisa do `offset` para montar a mesma entrada que a Retrospectiva monta.
 * Com ele a rota passa pelo **mesmo** `periodBounds` que a Retrospectiva usa, e não
 * por um segundo cálculo de período.
 *
 * `null` quando:
 *
 * - `kind` é `all` — o Total não tem início que o localize (e não tem edição);
 * - `startISO` não é uma data `YYYY-MM-DD` que exista (`2026-02-30` não existe);
 * - a data existe e **não é o primeiro dia** de um período do tipo: `2026-08-02`
 *   num mês, `2026-05-01` numa estação, uma terça-feira numa semana.
 *
 * Não julga se o período já fechou nem se está à frente de `now`: isso é o
 * `periodoFechado`, que a rota pergunta depois. Um início no futuro devolve o
 * `offset` positivo dele.
 *
 * **A última palavra é do próprio `periodBounds`**: o `offset` calculado só é
 * devolvido se o período dele começa exatamente em `startISO`. É o que impede
 * as contas de semana e de estação de concordarem entre si e discordarem da
 * função que a Retrospectiva usa.
 */
export function offsetDoInicio(now: Date, kind: PeriodKind, startISO: string): number | null {
  if (kind === 'all') return null;
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startISO);
  if (!partes) return null;
  const ano = Number(partes[1]);
  const mes = Number(partes[2]) - 1;
  const dia = Number(partes[3]);
  const inicio = new Date(ano, mes, dia);
  // `new Date(99, …)` é 1999: o ano entra pelo `setFullYear`, e a data que não
  // existe (30 de fevereiro) não volta com os mesmos componentes.
  inicio.setFullYear(ano);
  if (inicio.getFullYear() !== ano || inicio.getMonth() !== mes || inicio.getDate() !== dia) return null;

  let offset: number;
  switch (kind) {
    case 'week': {
      // Dias de calendário, pela meia-noite UTC dos componentes: a troca de
      // horário de verão encurta um dia local em uma hora, e dividir
      // milissegundos locais por 24 h erraria o arredondamento na semana dela.
      const segunda = periodBounds(now, 'week', 0).start;
      const dias = Math.round(
        (Date.UTC(ano, mes, dia) - Date.UTC(segunda.getFullYear(), segunda.getMonth(), segunda.getDate()))
        / 86_400_000,
      );
      if (dias % 7 !== 0) return null;
      offset = dias / 7;
      break;
    }
    case 'month':
      offset = (ano - now.getFullYear()) * 12 + (mes - now.getMonth());
      break;
    case 'season': {
      const meses = (ano - now.getFullYear()) * 12 + (mes - Math.floor(now.getMonth() / 3) * 3);
      if (meses % 3 !== 0) return null;
      offset = meses / 3;
      break;
    }
    case 'year':
      offset = ano - now.getFullYear();
      break;
  }

  const b = periodBounds(now, kind, offset).start;
  if (b.getFullYear() !== ano || b.getMonth() !== mes || b.getDate() !== dia) return null;
  // `-0` é zero para quem lê, e não para `Object.is`: a rota compara offsets.
  return offset === 0 ? 0 : offset;
}

/**
 * O rótulo **real** do período anterior a um que começa em `startISO` —
 * `"Julho 2026"`, `"27/07 – 02/08"`, `"2024"`.
 *
 * Não é `"período anterior"`: é o nome que o leitor escreveria. Existe porque a
 * quinta regra da conferência aceita o nome próprio como nomeação de B1 — *"21
 * atividades contra 17 em julho"* —, e para isso o pacote precisa saber que o
 * anterior de agosto se chama julho. Derivado andando um período para trás pelo
 * mesmo caminho que produz o rótulo do período corrente; um segundo caminho
 * daria dois nomes para o mesmo mês no dia em que um deles mudasse.
 *
 * `null` para `all`, que não tem período anterior — sempre cabe mais um dia.
 */
export function previousPeriodLabel(kind: PeriodKind, startISO: string): string | null {
  return anteriorDe(kind, startISO)?.label ?? null;
}

/**
 * O primeiro dia (`YYYY-MM-DD`, local) do período anterior a um que começa em
 * `startISO` — `"2026-07-01"` para agosto de 2026.
 *
 * Existe para o portão de nascimento do ranqueamento da revista: um hábito ou
 * registro criado **depois** deste dia tem o lado anterior da comparação
 * amputado. Sai pelo **mesmo** caminho que {@link previousPeriodLabel} — o
 * rótulo e o início do anterior são duas leituras do mesmo `periodBounds(…, -1)`,
 * e dois caminhos dariam, no dia em que um deles mudasse, um período anterior
 * com um nome e outro começo.
 *
 * `null` para `all`, pelo mesmo motivo.
 */
export function previousPeriodStartISO(kind: PeriodKind, startISO: string): string | null {
  const b = anteriorDe(kind, startISO);
  if (b == null) return null;
  const d = b.start;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** O período anterior ao que começa em `startISO` — o caminho único dos dois acima. */
function anteriorDe(kind: PeriodKind, startISO: string): PeriodBounds | null {
  if (kind === 'all') return null;
  const inicio = new Date(`${startISO}T00:00:00`);
  if (Number.isNaN(inicio.getTime())) return null;
  return periodBounds(inicio, kind, -1);
}

/**
 * O rótulo de um período em forma de **prosa** — minúsculo, com acento.
 *
 * `"Março 2026"` → `"março"`, porque ninguém escreve o ano junto do mês. Ano
 * (`"2025"`) já é a forma. Semana (`"27/07 – 02/08"`) e trimestre (`"Q1 2026"`)
 * saem só em minúsculas: são rótulos de tela, não formas de prosa, e quem os
 * consome sabe disso.
 *
 * **Dono único da redução**, e é por isso que ela mora aqui e não em quem a usa.
 * Dois consumidores, com necessidades opostas: o prompt (`ia/prompt.ts`) precisa
 * da forma **com acento**, que é a que o texto vai escrever; a conferência
 * (`ia/verificar.ts`) precisa dela **normalizada**, e normaliza a saída daqui em
 * vez de guardar uma segunda cópia da redução. Duas cópias divergem no dia em
 * que o formato do rótulo mudar — e aí o prompt prescreveria um nome que a
 * conferência não reconhece, que é exatamente a falha que a Story 1.5 fecha.
 */
export function periodProseLabel(kind: PeriodKind, label: string | null): string | null {
  if (label == null) return null;
  const s = label.trim().toLowerCase();
  if (s === '') return null;
  return kind === 'month' ? (s.split(' ')[0] ?? null) : s;
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
      // Como o mês: o trimestre corrente só fecha no dia 01 do trimestre
      // seguinte → o último disponível é sempre o anterior.
      return -1;
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
