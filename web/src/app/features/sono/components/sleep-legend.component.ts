import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Uma amostra por marca, e as quatro telas de sono desenham a mesma amostra
 * para a mesma coisa: o vão com a marca ao lado é "despertar" em todas, a
 * hachura é "sem estágio" em todas. A cor é sempre uma variável `--sleep-*`.
 */
export interface LegendItem {
  kind: 'solid' | 'gap' | 'gaptick' | 'hatch' | 'dashed';
  /** Uma variável CSS (`var(--sleep-rem)`), não um hex. */
  color?: string;
  label: string;
}

@Component({
  selector: 'rt-sleep-legend',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="legend">
      @for (it of items(); track it.label) {
        <span class="item">
          @switch (it.kind) {
            @case ('solid') { <i class="sw" [style.background]="it.color"></i> }
            @case ('dashed') { <i class="sw dashed" [style.border-color]="it.color"></i> }
            @case ('gap') { <i class="sw gap"></i> }
            @case ('gaptick') { <i class="sw gap"></i><i class="tick" [style.background]="it.color"></i> }
            @case ('hatch') { <i class="sw hatch" [style.--hatch]="it.color"></i> }
          }
          {{ it.label }}
        </span>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .legend { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 12px; font-size: 11.5px; color: var(--ink-2); }
    .item { display: inline-flex; align-items: center; gap: 6px; }
    .sw { display: inline-block; width: 11px; height: 11px; border-radius: 3px; }
    .sw.dashed { border: 1px dashed; background: transparent; }
    .sw.gap { border: 1px solid var(--ink-4); background: var(--surface); }
    .tick { display: inline-block; width: 3px; height: 11px; border-radius: 1px; margin-left: -4px; }
    .sw.hatch { background: repeating-linear-gradient(45deg, transparent 0 3px, var(--hatch) 3px 4.3px); }
  `],
})
export class SleepLegendComponent {
  readonly items = input.required<LegendItem[]>();
}
