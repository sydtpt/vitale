import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PanelComponent } from '@shared/components/panel/panel.component';
import type { SportHealthInsight } from '@vitale/shared';

const TONE_COLOR: Record<string, string> = {
  good: '#6FA86A',
  bad: '#E26A8A',
  neutral: '#9C928A',
};

/** Card 4 — efeito do treino forte no dia seguinte (defasagem 1 dia). */
@Component({
  selector: 'rt-sport-health-insights-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PanelComponent],
  template: `
    <rt-panel title="Treino forte → recuperação (dia seguinte)">
      <div class="rows">
        @for (r of rows(); track r.key) {
          <div class="row" [style.border-left-color]="r.color">
            <div class="text">{{ r.text }}</div>
            @if (r.enough) {
              <div class="meta">r = {{ r.rStr }} · {{ r.n }} pares</div>
            }
          </div>
        }
      </div>
      <div class="disc">Associação observacional (amostra pequena) — não é causa.</div>
    </rt-panel>
  `,
  styles: [`
    .rows { display: flex; flex-direction: column; gap: 8px; }
    .row { background: var(--surface-mute); border-left: 3px solid var(--ink-3); border-radius: 8px; padding: 8px 12px; }
    .text { font-size: 13px; color: var(--ink); }
    .meta { font-size: 11px; color: var(--ink-3); margin-top: 2px; font-family: 'Geist Mono', monospace; }
    .disc { font-size: 11px; color: var(--ink-3); margin-top: 8px; }
  `],
})
export class SportHealthInsightsCardComponent {
  readonly insights = input<SportHealthInsight[]>([]);

  protected readonly rows = computed(() =>
    this.insights().map((i) => ({
      ...i,
      color: TONE_COLOR[i.tone] ?? '#9C928A',
      rStr: i.r.toFixed(2),
    })),
  );
}
