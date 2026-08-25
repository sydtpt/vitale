/**
 * Faixa de adesão das séries diárias — "lembrei ou esqueci", dia a dia.
 *
 * Derivação pura, como todo o resto da retrospectiva: web e mobile só desenham.
 *
 * **Por que não é o `Heatmap` de `retro.ts`.** Aquele é uma grade divergente de
 * UMA métrica contínua medida contra uma meta (sono vs. 7h), em calendário de 7
 * colunas. Aqui o dado é **binário** (feito / esquecido) e são **várias séries ao
 * mesmo tempo** — o que se quer ver é uma faixa por tarefa, empilhadas, para
 * comparar de relance quem está falhando. Escala divergente e coluna de semana
 * não têm o que fazer num sim/não; forçar as duas coisas no mesmo componente
 * deixaria os dois piores.
 *
 * **Eleição automática.** Entra toda série cuja recorrência vale os sete dias da
 * semana (`isDailyRecurrence`), sem flag nem cadastro: criar "comer uma fruta"
 * como diária basta.
 *
 * **Três estados, não dois.** Um dia só conta como esquecido se a série existia e
 * o dia já acabou:
 *  - `null` — fora da janela: antes de `createdOn` (não havia o que esquecer),
 *    depois de hoje (não chegou), ou **hoje ainda não feito** (ainda dá tempo);
 *  - `true` — concluída naquele dia;
 *  - `false` — a série existia, o dia passou, e não foi feita.
 *
 * O terceiro caso do `null` é o que impede o denominador de piscar: sem ele,
 * "26 de 31" viraria "26 de 32" às 00h01 e voltaria quando o ZMA fosse marcado.
 */
import { periodBounds, type PeriodKind } from './bounds';
import { recapValue, countInRange, type RecapValue } from '../week/recap';
import { localDateStr } from '../date/local';
import type { RetroDailyTask } from './retro';

/** Um dia na faixa de uma série. */
export interface TaskDayCell {
  /** 'YYYY-MM-DD' local. */
  day: string;
  /** 0 = segunda … 6 = domingo — mesmo eixo do `Heatmap`, para a UI marcar semanas. */
  weekday: number;
  /** null = fora da janela (ver o cabeçalho do módulo). */
  done: boolean | null;
}

/** Uma série diária agregada no período. */
export interface TaskGridRow {
  id: string;
  name: string;
  cells: TaskDayCell[];
  /** Dias concluídos dentro da janela. */
  done: number;
  /** Dias em que a série existia, o dia acabou, e passou batido. */
  missed: number;
  /** `done + missed` — o denominador honesto de "26 de 31". */
  possible: number;
  /** Adesão 0–1; 0 quando não houve nenhum dia elegível. */
  rate: number;
  /** Dias feitos no período vs. no anterior. */
  recap: RecapValue;
}

export interface TaskGrid {
  /** Rótulo do período, vindo de `periodBounds`. */
  label: string;
  rows: TaskGridRow[];
  /** Soma de `done` sobre soma de `possible` — a adesão do conjunto. */
  done: number;
  possible: number;
  rate: number;
}

/** Dias 'YYYY-MM-DD' de [start, end), em ordem. */
function daysOf(start: Date, end: Date): string[] {
  const out: string[] = [];
  const d = new Date(start);
  d.setHours(0, 0, 0, 0);
  while (d < end) {
    out.push(localDateStr(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** Segunda = 0 … domingo = 6 (o eixo do jornal, não o do `Date.getDay`). */
function weekdayIdx(day: string): number {
  return (new Date(`${day}T00:00:00`).getDay() + 6) % 7;
}

export interface TaskGridInput {
  now: Date;
  kind: PeriodKind;
  offset: number;
  dailyTasks?: RetroDailyTask[];
}

/**
 * Monta a faixa do período. Devolve `null` quando não há nenhuma série diária —
 * a UI omite o bloco inteiro em vez de mostrar um card vazio.
 */
export function buildTaskGrid(input: TaskGridInput): TaskGrid | null {
  const tasks = input.dailyTasks ?? [];
  if (tasks.length === 0) return null;

  const cur = periodBounds(input.now, input.kind, input.offset);
  const prev = periodBounds(input.now, input.kind, input.offset - 1);
  const today = localDateStr(input.now);
  const days = daysOf(cur.start, cur.end);

  const rows: TaskGridRow[] = tasks.map((t) => {
    const doneDays = new Set(t.days);
    let done = 0;
    let missed = 0;

    const cells = days.map<TaskDayCell>((day) => {
      const weekday = weekdayIdx(day);
      // Futuro, ou antes da série existir: não há o que cobrar.
      if (day > today || (t.createdOn && day < t.createdOn)) {
        return { day, weekday, done: null };
      }
      if (doneDays.has(day)) {
        done += 1;
        return { day, weekday, done: true };
      }
      // Hoje ainda não foi feito — pendente, não esquecido.
      if (day === today) return { day, weekday, done: null };
      missed += 1;
      return { day, weekday, done: false };
    });

    const possible = done + missed;
    return {
      id: t.id,
      name: t.name,
      cells,
      done,
      missed,
      possible,
      rate: possible > 0 ? done / possible : 0,
      recap: recapValue(done, countInRange([...doneDays], prev.start, prev.end)),
    };
  });

  const done = rows.reduce((s, r) => s + r.done, 0);
  const possible = rows.reduce((s, r) => s + r.possible, 0);

  return {
    label: cur.label,
    rows,
    done,
    possible,
    rate: possible > 0 ? done / possible : 0,
  };
}
