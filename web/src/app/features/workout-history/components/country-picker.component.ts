import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { CountrySummary } from '@vitale/shared';

/**
 * Grade de seleção de país (US1, caso N países). Cada célula: bandeira, nome e
 * nº de pedaladas. Emite o código ISO2 ao clicar; a página troca o `?country=`.
 */
@Component({
  selector: 'rt-country-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid">
      @for (c of countries(); track c.code) {
        <button type="button" class="cell" (click)="select.emit(c.code)">
          <span class="flag">{{ c.flag }}</span>
          <span class="meta">
            <span class="name">{{ c.name }}</span>
            <span class="count">{{ c.rideCount }} {{ c.rideCount === 1 ? 'pedalada' : 'pedaladas' }}</span>
          </span>
        </button>
      }
    </div>
  `,
  styles: [
    `:host { display: block; }
     .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
     .cell { display: flex; align-items: center; gap: 12px; text-align: left;
       padding: 14px 16px; background: var(--surface); border: 1.5px solid var(--line);
       border-radius: 14px; font-family: inherit; cursor: pointer;
       transition: border-color 0.15s, box-shadow 0.15s; }
     .cell:hover { border-color: var(--primary); box-shadow: var(--shadow-sm); }
     .flag { font-size: 30px; line-height: 1; flex-shrink: 0; }
     .meta { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
     .name { font-size: 15px; font-weight: 650; color: var(--ink); letter-spacing: -0.2px; }
     .count { font-size: 12.5px; color: var(--ink-3); }`,
  ],
})
export class CountryPickerComponent {
  readonly countries = input.required<CountrySummary[]>();
  readonly select = output<string>();
}
