import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { formatHm, type PeriodSummary } from '@vitale/shared';

/**
 * As médias do topo: *dormindo* sempre; o segundo número é *na cama* quando a
 * cama foi medida em ≥ 80% das noites, senão *acordado*. É a regra de
 * `periodSummary` — a tela só a escreve. O ponto ao lado do rótulo é a cor da
 * coisa: sono, cama ou vigília (`--sleep-*`).
 */
@Component({
  selector: 'rt-period-averages',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row">
      <div class="tile">
        <div class="lab"><i class="dot sleep"></i>dormindo</div>
        <div class="val mono">{{ hm(summary().asleepH) }}</div>
        <div class="sub">média de {{ summary().nights }} {{ summary().nights === 1 ? 'noite' : 'noites' }}</div>
      </div>
      @if (summary().secondary; as s) {
        <div class="tile">
          <div class="lab"><i class="dot" [class.bed]="s.kind === 'bed'" [class.awake]="s.kind !== 'bed'"></i>{{ s.kind === 'bed' ? 'na cama' : 'acordado' }}</div>
          <div class="val mono">
            @if (s.kind === 'bed') { {{ hm(s.hours) }} } @else { {{ round(s.minutes) }}<small> min</small> }
          </div>
          <div class="sub">
            @if (s.kind === 'bed') { {{ round(s.share * 100) }}% das noites medem a cama } @else { cama medida em {{ round(s.share * 100) }}% — média omitida }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .row { display: flex; gap: 14px; margin-top: 12px; }
    .tile { flex: 1; }
    .lab { display: flex; align-items: center; gap: 6px; font-size: 10.5px; letter-spacing: .8px; text-transform: uppercase; color: var(--ink-3); font-weight: 600; }
    .dot { width: 8px; height: 8px; border-radius: 4px; display: inline-block; }
    .dot.sleep { background: var(--sleep-sleep); }
    .dot.bed { background: var(--sleep-bed); border: 1px solid var(--sleep-sleep); }
    .dot.awake { background: var(--sleep-awake); }
    .val { font-size: 26px; letter-spacing: -.5px; color: var(--ink); margin-top: 2px; line-height: 1.15; }
    .val small { font-size: 13px; color: var(--ink-3); font-family: inherit; }
    .sub { font-size: 11px; color: var(--ink-3); }
  `],
})
export class PeriodAveragesComponent {
  readonly summary = input.required<PeriodSummary>();
  protected readonly hm = formatHm;
  protected readonly round = Math.round;
}
