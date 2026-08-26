import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PanelComponent } from '@shared/components/panel/panel.component';
import type { WellnessSummary } from '@vitale/shared';

const CAT_COLOR: Record<string, string> = {
  sono: '#6E8CC9',
  fcRepouso: '#E26A8A',
  vfc: '#6FA86A',
  aneis: '#F25C2B',
};

const TONE_COLOR: Record<string, string> = {
  baixa: '#6FA86A',
  moderada: '#F5B946',
  alta: '#F25C2B',
};

/** Card 2 — índice de bem-estar (prontidão recente) + roll-up por categoria + faixa de esporte. */
@Component({
  selector: 'rt-wellness-index-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PanelComponent],
  template: `
    <rt-panel title="Índice de bem-estar">
      @if (summary().overall == null) {
        <div class="empty">Sincronize a Saúde para ver o índice.</div>
      } @else {
        <div class="head">
          <div>
            <div class="big">{{ summary().overall }}</div>
            <div class="cap">prontidão · dia mais recente</div>
          </div>
          <div class="sport">
            <div class="srow"><span class="sv">{{ summary().sport.sessions }}</span> treinos na semana</div>
            <div class="srow">
              carga <span class="tag" [style.color]="toneColor()" [style.background]="toneBg()">{{ summary().sport.loadLabel }}</span>
              · {{ summary().sport.hardMin }} min fortes
            </div>
          </div>
        </div>
        <div class="bars">
          @for (c of categories(); track c.key) {
            <div class="row">
              <span class="lbl">{{ c.label }}</span>
              <span class="track"><span class="fill" [style.width.%]="c.score" [style.background]="c.color"></span></span>
              <span class="val">{{ c.score }}</span>
            </div>
          }
        </div>
      }
    </rt-panel>
  `,
  styles: [`
    .empty { font-size: 13px; color: var(--ink-3); padding: 16px 0; }
    .head { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 14px; }
    .big { font-size: 40px; font-weight: 600; color: var(--ink); line-height: 1; }
    .cap { font-size: 11px; color: var(--ink-3); margin-top: 2px; }
    .sport { text-align: right; }
    .srow { font-size: 12px; color: var(--ink-2); margin-top: 2px; }
    .sv { font-weight: 700; color: var(--ink); }
    .tag { font-size: 11px; font-weight: 700; padding: 1px 7px; border-radius: 999px; }
    .bars { display: flex; flex-direction: column; gap: 8px; }
    .row { display: flex; align-items: center; gap: 10px; }
    .lbl { width: 130px; font-size: 12.5px; color: var(--ink-2); }
    .track { flex: 1; height: 8px; border-radius: 4px; background: var(--surface-mute); overflow: hidden; }
    .fill { display: block; height: 8px; border-radius: 4px; }
    .val { width: 26px; text-align: right; font-size: 12.5px; font-weight: 700; color: var(--ink); font-family: var(--font-mono); }
  `],
})
export class WellnessIndexCardComponent {
  readonly summary = input.required<WellnessSummary>();

  protected readonly categories = computed(() =>
    this.summary().categories.map((c) => ({ ...c, color: CAT_COLOR[c.key] ?? '#F25C2B' })),
  );

  protected toneColor(): string {
    return TONE_COLOR[this.summary().sport.loadLabel] ?? '#5C534A';
  }
  protected toneBg(): string {
    return (TONE_COLOR[this.summary().sport.loadLabel] ?? '#5C534A') + '22';
  }
}
