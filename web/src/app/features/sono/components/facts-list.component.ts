import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { Fact } from '@vitale/shared';

/**
 * As análises sob um gráfico — fatos, não notas. Medianas com faixa, contagens,
 * diferenças. Vêm prontas do núcleo (`facts.ts`); aqui só se listam.
 */
@Component({
  selector: 'rt-facts-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (facts().length > 0) {
      <div class="list">
        @for (f of facts(); track f.label) {
          <div class="row"><span class="label">{{ f.label }}</span><span class="value mono">{{ f.value }}</span></div>
        }
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
    .list { margin-top: 12px; border-top: 1px solid var(--line); padding-top: 8px; display: grid; gap: 7px; }
    .row { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; font-size: 12.5px; }
    .label { color: var(--ink-2); }
    .value { color: var(--ink); text-align: right; flex-shrink: 0; }
  `],
})
export class FactsListComponent {
  readonly facts = input.required<Fact[]>();
}
