import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PanelComponent } from '@shared/components/panel/panel.component';
import type { PeriodRecap, RecapStat } from '@vitale/shared';

interface TileVM { label: string; value: string; delta: string; tone: 'up' | 'down' | 'flat'; }

function fmtDelta(s: RecapStat): { delta: string; tone: 'up' | 'down' | 'flat' } {
  if (s.deltaPct == null) return { delta: '—', tone: 'flat' };
  const r = Math.round(s.deltaPct);
  if (r === 0) return { delta: '0%', tone: 'flat' };
  return { delta: `${r > 0 ? '↑' : '↓'}${Math.abs(r)}%`, tone: r > 0 ? 'up' : 'down' };
}

function fmtDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

/** Card de recap do período (30 dias) — totais de treino + prontidão vs período anterior. */
@Component({
  selector: 'rt-period-recap-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PanelComponent],
  template: `
    <rt-panel title="Resumo do mês · 30 dias">
      @if (isEmpty()) {
        <div class="empty">Sem treinos nos últimos 30 dias.</div>
      } @else {
        <div class="tiles">
          @for (t of tiles(); track t.label) {
            <div class="tile">
              <div class="lbl">{{ t.label }}</div>
              <div class="val">{{ t.value }}</div>
              <div class="delta" [class.up]="t.tone === 'up'" [class.down]="t.tone === 'down'">{{ t.delta }}</div>
            </div>
          }
        </div>
        @if (recap().longestKm > 0) {
          <div class="foot">Maior distância: {{ longest() }} km · vs período anterior de mesmo tamanho</div>
        }
      }
    </rt-panel>
  `,
  styles: [`
    .empty { font-size: 13px; color: var(--ink-3); padding: 16px 0; }
    .tiles { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
    @media (max-width: 720px) { .tiles { grid-template-columns: repeat(2, 1fr); } }
    .tile { background: var(--surface-mute); border-radius: 10px; padding: 10px 12px; }
    .lbl { font-size: 11px; color: var(--ink-3); }
    .val { font-size: 18px; font-weight: 700; color: var(--ink); margin-top: 2px; font-family: var(--font-mono); }
    .delta { font-size: 11.5px; color: var(--ink-3); margin-top: 2px; }
    .delta.up { color: #6FA86A; }
    .delta.down { color: #E26A8A; }
    .foot { font-size: 11px; color: var(--ink-3); margin-top: 8px; }
  `],
})
export class PeriodRecapCardComponent {
  readonly recap = input.required<PeriodRecap>();

  protected readonly isEmpty = computed(() => this.recap().sessions.current === 0);
  protected longest(): string { return this.recap().longestKm.toFixed(1).replace('.', ','); }

  protected readonly tiles = computed<TileVM[]>(() => {
    const r = this.recap();
    return [
      { label: 'Distância', value: `${r.distanceKm.current.toFixed(1).replace('.', ',')} km`, ...fmtDelta(r.distanceKm) },
      { label: 'Treinos', value: `${r.sessions.current}`, ...fmtDelta(r.sessions) },
      { label: 'Tempo', value: fmtDuration(r.durationMin.current), ...fmtDelta(r.durationMin) },
      { label: 'Carga forte', value: `${r.hardMin.current} min`, ...fmtDelta(r.hardMin) },
      { label: 'Prontidão', value: `${r.avgReadiness.current}`, ...fmtDelta(r.avgReadiness) },
    ];
  });
}
