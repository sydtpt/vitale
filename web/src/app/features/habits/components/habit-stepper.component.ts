import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MOD, DEFAULT_HABIT_ICON, type CounterHabit } from '@vitale/shared';
import { IconComponent } from '@core/services/icon.component';
import { isMet, isOver, progress } from '../data/habit-logic';

/**
 * Stepper de captura (porta web do `HabitStepper.tsx` do mobile): ícone + nome,
 * valor/meta com barra de progresso e botões −/＋. Apresentacional — não persiste:
 * emite `increment`/`decrement` para quem controla o rascunho.
 */
@Component({
  selector: 'rt-habit-stepper',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="stepper" [class.met]="met()" [class.over]="over()">
      <button class="btn minus" type="button" [disabled]="value() <= 0"
        [style.background]="tint()" (click)="decrement.emit()" aria-label="Diminuir">
        <rt-icon name="minus" [size]="20" [color]="accent()" [strokeWidth]="2.4" />
      </button>

      <div class="center">
        <div class="title">
          <rt-icon [name]="icon()" [size]="15" [color]="accent()" [strokeWidth]="2" />
          <span class="name">{{ habit().name }}</span>
          @if (over()) {
            <rt-icon name="flag" [size]="14" color="var(--primary-deep)" [strokeWidth]="2.2" />
          } @else if (met()) {
            <rt-icon name="check" [size]="15" [color]="accent()" [strokeWidth]="2.6" />
          }
        </div>
        <div class="value">
          <span class="num">{{ fmt(value()) }}</span>
          @if (habit().target != null) {
            <span class="target">/ {{ fmt(habit().target!) }}</span>
          }
          <span class="unit">{{ habit().unit }}</span>
        </div>
        @if (habit().target != null) {
          <div class="track">
            <div class="fill" [class.over]="over()" [style.width.%]="pct() * 100"
              [style.background]="accent()"></div>
          </div>
        }
      </div>

      <button class="btn plus" type="button" [style.background]="accent()"
        (click)="increment.emit()" aria-label="Aumentar">
        <rt-icon name="plus" [size]="22" color="#fff" [strokeWidth]="2.4" />
      </button>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .stepper {
      display: flex; align-items: center; gap: 12px;
      background: var(--surface); border: 1px solid var(--line);
      border-radius: 16px; padding: 12px;
    }
    .stepper.met { border-color: color-mix(in srgb, var(--ink) 8%, var(--line)); }
    .stepper.over { border-color: var(--primary-deep); }
    .btn {
      width: 46px; height: 46px; border-radius: 50%; border: 0; cursor: pointer;
      display: flex; align-items: center; justify-content: center; flex: 0 0 auto;
      transition: opacity 0.15s;
    }
    .btn:hover { opacity: 0.85; }
    .btn:disabled { opacity: 0.4; cursor: default; }
    .center { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
    .title { display: flex; align-items: center; gap: 6px; }
    .name { flex: 1; min-width: 0; font-size: 13.5px; font-weight: 600; color: var(--ink);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .value { display: flex; align-items: baseline; gap: 5px; }
    .num { font-size: 20px; font-weight: 700; color: var(--ink); font-variant-numeric: tabular-nums; }
    .target { font-size: 14px; color: var(--ink-3); font-weight: 500; }
    .unit { font-size: 13px; color: var(--ink-2); }
    .track { height: 6px; border-radius: 3px; background: var(--surface-mute); overflow: hidden; }
    .fill { height: 6px; border-radius: 3px; transition: width 0.25s; }
    .fill.over { background: var(--primary-deep) !important; }
  `],
})
export class HabitStepperComponent {
  readonly habit = input.required<CounterHabit>();
  readonly value = input.required<number>();

  readonly increment = output<void>();
  readonly decrement = output<void>();

  protected readonly met = computed(() => isMet(this.habit(), this.value()));
  protected readonly over = computed(() => isOver(this.habit(), this.value()));
  protected readonly pct = computed(() => progress(this.habit(), this.value()));

  protected accent(): string {
    return (MOD as Record<string, { accent: string }>)[this.habit().color]?.accent ?? MOD.habito.accent;
  }
  protected tint(): string {
    return `color-mix(in srgb, ${this.accent()} 14%, white)`;
  }
  protected icon(): string {
    return this.habit().icon || DEFAULT_HABIT_ICON;
  }

  protected fmt(n: number): string {
    const r = Math.round(n * 100) / 100;
    const s = Number.isInteger(r) ? String(r) : r.toFixed(2).replace(/\.?0+$/, '');
    return s.replace('.', ',');
  }
}
