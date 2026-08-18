import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { IconComponent } from '@core/services/icon.component';
import { localDateStr } from '@vitale/shared';

interface DayCell {
  date: string;        // 'YYYY-MM-DD' ('' = célula vazia de preenchimento)
  day: number;
  marked: boolean;
  future: boolean;
}

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/**
 * Calendário mensal: grade de 7 colunas (domingo→sábado), navegação ◀ mês ▶.
 * Datas futuras desabilitadas. Emite a data escolhida e o mês visualizado.
 */
@Component({
  selector: 'rt-month-calendar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="cal">
      <div class="nav">
        <button class="navbtn" type="button" (click)="step(-1)" aria-label="Mês anterior">
          <rt-icon name="chev-l" [size]="18" color="var(--ink-2)" [strokeWidth]="2.2" />
        </button>
        <span class="label">{{ monthLabel() }}</span>
        <button class="navbtn" type="button" [disabled]="!canNext()" (click)="step(1)" aria-label="Próximo mês">
          <rt-icon name="chev-r" [size]="18" color="var(--ink-2)" [strokeWidth]="2.2" />
        </button>
      </div>

      <div class="grid head">
        @for (w of weekdays; track $index) { <span class="wd">{{ w }}</span> }
      </div>
      <div class="grid">
        @for (c of cells(); track $index) {
          @if (c.date) {
            <button
              class="day"
              type="button"
              [class.sel]="c.date === selected()"
              [class.today]="c.date === today"
              [disabled]="c.future"
              (click)="daySelected.emit(c.date)"
            >
              <span class="n">{{ c.day }}</span>
              @if (c.marked) { <span class="dot"></span> }
            </button>
          } @else {
            <span class="day empty"></span>
          }
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .cal {
      background: var(--surface); border: 1px solid var(--line);
      border-radius: 18px; padding: 14px; box-shadow: var(--shadow-card);
    }
    .nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
    .label { font-size: 14.5px; font-weight: 650; color: var(--ink); text-transform: capitalize; }
    .navbtn {
      width: 32px; height: 32px; border-radius: 9px; border: 1px solid var(--line);
      background: var(--surface); cursor: pointer; display: flex; align-items: center; justify-content: center;
    }
    .navbtn:hover { background: var(--surface-mute); }
    .navbtn:disabled { opacity: 0.4; cursor: default; }
    .grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
    .grid.head { margin-bottom: 4px; }
    .wd { text-align: center; font-size: 11px; font-weight: 600; color: var(--ink-3); padding: 2px 0; }
    .day {
      position: relative; aspect-ratio: 1; border: 0; background: transparent; border-radius: 10px;
      cursor: pointer; font-size: 13.5px; color: var(--ink); display: flex;
      align-items: center; justify-content: center;
    }
    .day:hover:not(:disabled):not(.empty) { background: var(--surface-mute); }
    .day:disabled { color: var(--ink-4); cursor: default; }
    .day.empty { cursor: default; }
    .day.today { font-weight: 700; box-shadow: inset 0 0 0 1px var(--line); }
    .day.sel { background: var(--primary); color: #fff; font-weight: 700; }
    .dot {
      position: absolute; bottom: 5px; left: 50%; transform: translateX(-50%);
      width: 4px; height: 4px; border-radius: 50%; background: var(--primary);
    }
    .day.sel .dot { background: #fff; }
  `],
})
export class MonthCalendarComponent {
  readonly selected = input<string | null>(null);
  readonly marked = input<Set<string>>(new Set<string>());

  readonly daySelected = output<string>();
  readonly monthChanged = output<{ year: number; monthIdx: number }>();

  protected readonly weekdays = WEEKDAYS;
  protected readonly today = localDateStr();

  private readonly now = new Date();
  protected readonly viewYear = signal(this.now.getFullYear());
  protected readonly viewMonth = signal(this.now.getMonth());

  protected readonly monthLabel = computed(() => `${MONTHS[this.viewMonth()]} ${this.viewYear()}`);

  /** Bloqueia avançar para meses futuros. */
  protected readonly canNext = computed(() => {
    const y = this.viewYear(), m = this.viewMonth();
    return y < this.now.getFullYear() || (y === this.now.getFullYear() && m < this.now.getMonth());
  });

  protected readonly cells = computed<DayCell[]>(() => {
    const y = this.viewYear(), m = this.viewMonth();
    const marks = this.marked();
    const first = new Date(y, m, 1).getDay();           // 0=domingo
    const total = new Date(y, m + 1, 0).getDate();
    const out: DayCell[] = [];
    for (let i = 0; i < first; i++) out.push({ date: '', day: 0, marked: false, future: false });
    for (let d = 1; d <= total; d++) {
      const date = localDateStr(new Date(y, m, d));
      out.push({ date, day: d, marked: marks.has(date), future: date > this.today });
    }
    return out;
  });

  protected step(delta: number): void {
    if (delta > 0 && !this.canNext()) return;
    let m = this.viewMonth() + delta;
    let y = this.viewYear();
    if (m < 0) { m = 11; y--; }
    else if (m > 11) { m = 0; y++; }
    this.viewMonth.set(m);
    this.viewYear.set(y);
    this.monthChanged.emit({ year: y, monthIdx: m });
  }
}
