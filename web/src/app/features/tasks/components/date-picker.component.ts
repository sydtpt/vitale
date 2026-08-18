import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { IconComponent } from '@core/services/icon.component';
import { localDateStr } from '@vitale/shared';

interface DayCell {
  date: string;   // 'YYYY-MM-DD' ('' = célula vazia de preenchimento)
  day: number;
  past: boolean;
}

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/**
 * Seletor visual de dia: grade de 7 colunas (domingo→sábado), navegação ◀ mês ▶.
 * Voltado para "a partir de" — dias passados ficam desabilitados. Emite 'YYYY-MM-DD'.
 */
@Component({
  selector: 'rt-date-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="cal">
      <div class="nav">
        <button class="navbtn" type="button" [disabled]="!canPrev()" (click)="step(-1)" aria-label="Mês anterior">
          <rt-icon name="chev-l" [size]="18" color="var(--ink-2)" [strokeWidth]="2.2" />
        </button>
        <span class="label">{{ monthLabel() }}</span>
        <button class="navbtn" type="button" (click)="step(1)" aria-label="Próximo mês">
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
              [disabled]="c.past"
              (click)="daySelected.emit(c.date)"
            >
              <span class="n">{{ c.day }}</span>
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
      border-radius: 14px; padding: 12px;
    }
    .nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
    .label { font-size: 14px; font-weight: 650; color: var(--ink); text-transform: capitalize; }
    .navbtn {
      width: 32px; height: 32px; border-radius: 9px; border: 1px solid var(--line);
      background: var(--surface); cursor: pointer; display: flex; align-items: center; justify-content: center;
    }
    .navbtn:hover:not(:disabled) { background: var(--surface-mute); }
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
    .day.sel { background: var(--primary); color: #fff; font-weight: 700; box-shadow: none; }
  `],
})
export class DatePickerComponent {
  readonly selected = input<string | null>(null);

  readonly daySelected = output<string>();

  protected readonly weekdays = WEEKDAYS;
  protected readonly today = localDateStr();

  private readonly now = new Date();
  protected readonly viewYear = signal(this.now.getFullYear());
  protected readonly viewMonth = signal(this.now.getMonth());

  constructor() {
    // Abre no mês da data já escolhida (útil ao editar uma série existente).
    effect(() => {
      const sel = this.selected();
      if (!sel) return;
      const [y, m] = sel.split('-').map(Number);
      if (y && m) { this.viewYear.set(y); this.viewMonth.set(m - 1); }
    });
  }

  protected readonly monthLabel = computed(() => `${MONTHS[this.viewMonth()]} ${this.viewYear()}`);

  /** Bloqueia voltar para antes do mês corrente (dias passados não são "a partir de"). */
  protected readonly canPrev = computed(() => {
    const y = this.viewYear(), m = this.viewMonth();
    return y > this.now.getFullYear() || (y === this.now.getFullYear() && m > this.now.getMonth());
  });

  protected readonly cells = computed<DayCell[]>(() => {
    const y = this.viewYear(), m = this.viewMonth();
    const first = new Date(y, m, 1).getDay();           // 0=domingo
    const total = new Date(y, m + 1, 0).getDate();
    const out: DayCell[] = [];
    for (let i = 0; i < first; i++) out.push({ date: '', day: 0, past: false });
    for (let d = 1; d <= total; d++) {
      const date = localDateStr(new Date(y, m, d));
      out.push({ date, day: d, past: date < this.today });
    }
    return out;
  });

  protected step(delta: number): void {
    if (delta < 0 && !this.canPrev()) return;
    let m = this.viewMonth() + delta;
    let y = this.viewYear();
    if (m < 0) { m = 11; y--; }
    else if (m > 11) { m = 0; y++; }
    this.viewMonth.set(m);
    this.viewYear.set(y);
  }
}
