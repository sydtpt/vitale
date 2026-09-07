import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { TypicalAwakening } from '@vitale/shared';

/**
 * O despertar típico: três números e a fração de piscada.
 *
 * A mesma peça do mobile (`TypicalAwake`), recomposta.
 *
 * **O mínimo não está aqui, de propósito.** Ele vale `0,0` min em toda janela do
 * arquivo — é a resolução do aparelho, não um fato sobre a noite. No lugar dele
 * vai a fração abaixo de cinco minutos, que responde à mesma pergunta ("quanto
 * disso é ruído?") sem imprimir ruído como dado.
 *
 * A mediana é o número do meio porque a distribuição é torta: em agosto de 2026,
 * 56 dos 85 despertares ficaram abaixo de cinco minutos e a média (6,6 min) fica
 * três vezes acima da mediana (2 min).
 */
@Component({
  selector: 'rt-typical-awake',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (typical().medianMin === null) {
      <p class="none">
        {{ typical().total === 0
          ? 'Nenhum despertar registrado nestas noites.'
          : 'Os ' + typical().total + ' despertares ficaram todos abaixo de 5 minutos — o chão do aparelho.' }}
      </p>
    } @else {
      <div class="triple">
        <div class="cell">
          <span class="lab">típico</span>
          <b class="val mono accent">{{ round(typical().medianMin) }}<small> min</small></b>
          <span class="note">mediana</span>
        </div>
        <div class="cell">
          <span class="lab">o longo</span>
          <b class="val mono">{{ typical().p90Min === null ? '—' : round(typical().p90Min) }}<small>{{ typical().p90Min === null ? '' : ' min' }}</small></b>
          <span class="note">1 em cada 10</span>
        </div>
        <div class="cell">
          <span class="lab">o maior</span>
          <b class="val mono">{{ longestMin() ?? '—' }}<small>{{ longestMin() === null ? '' : ' min' }}</small></b>
          <span class="note">{{ longestDay() || '—' }}</span>
        </div>
      </div>
      <p class="foot">
        {{ typical().brief }} dos {{ typical().total }} ficaram abaixo de 5 minutos — o piso do
        aparelho, não uma noite picada
      </p>
    }
  `,
  styles: [
    `
      :host { display: block; }
      .triple { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 8px; }
      .cell { display: flex; flex-direction: column; min-width: 0; }
      .lab { font-size: 11px; color: var(--ink-3); }
      .val { font-size: 26px; color: var(--ink); letter-spacing: -0.5px; line-height: 1.1; }
      .val.accent { color: var(--sleep-awake); }
      .val small { font-size: 12px; color: var(--ink-3); letter-spacing: 0; }
      .note { font-size: 10.5px; color: var(--ink-4); margin-top: 1px; }
      .foot { margin: 8px 0 0; font-size: 11.5px; line-height: 1.4; color: var(--ink-3); }
      .none { margin: 8px 0 0; font-size: 12px; color: var(--ink-3); }
    `,
  ],
})
export class TypicalAwakeComponent {
  readonly typical = input.required<TypicalAwakening>();
  /** 'DD/MM' do dia do maior despertar — a página formata. */
  readonly longestDay = input<string | null>(null);

  protected readonly longestMin = computed(() => {
    const l = this.typical().longest;
    return l ? Math.round(l.min) : null;
  });

  protected round(v: number | null): string {
    return v === null ? '—' : String(Math.round(v));
  }
}
