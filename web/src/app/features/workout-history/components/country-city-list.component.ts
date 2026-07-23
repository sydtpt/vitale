import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { CountryCityMark } from '@vitale/shared';

/**
 * Lista de cidades já cruzadas num país (US3). Cada linha: nome + estado (quando
 * houver) e um contador de quantas pedaladas passaram por ali. Ordenação e
 * dedupe vêm prontos de `citiesInCountry`.
 */
@Component({
  selector: 'rt-country-city-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap">
      <div class="head">
        <span class="title">Cidades</span>
        <span class="total">{{ cities().length }}</span>
      </div>
      @if (cities().length === 0) {
        <div class="empty">Nenhuma cidade resolvida ainda para este país.</div>
      } @else {
        <ul class="list">
          @for (c of cities(); track c.name) {
            <li class="row">
              <span class="dot"></span>
              <span class="name">
                {{ c.name }}
                @if (c.state) { <span class="state">· {{ c.state }}</span> }
              </span>
              @if (c.visitCount > 1) {
                <span class="visits">{{ c.visitCount }}×</span>
              }
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: [
    `:host { display: block; }
     .wrap { background: var(--surface); border: 1px solid var(--line); border-radius: 16px;
       padding: 16px 18px; }
     .head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 12px; }
     .title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
       color: var(--ink-3); }
     .total { font-size: 13px; font-weight: 650; color: var(--ink-2); font-variant-numeric: tabular-nums; }
     .empty { font-size: 13px; color: var(--ink-3); padding: 8px 0; }
     .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
     .row { display: flex; align-items: center; gap: 10px; padding: 8px 0;
       border-top: 1px solid var(--line); font-size: 14px; }
     .row:first-child { border-top: none; }
     .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--primary); flex-shrink: 0; }
     .name { flex: 1; min-width: 0; color: var(--ink); }
     .state { color: var(--ink-3); font-size: 12.5px; }
     .visits { font-size: 12px; font-weight: 650; color: var(--ink-3);
       background: var(--surface-mute); border-radius: 20px; padding: 2px 9px;
       font-variant-numeric: tabular-nums; }`,
  ],
})
export class CountryCityListComponent {
  readonly cities = input.required<CountryCityMark[]>();
}
