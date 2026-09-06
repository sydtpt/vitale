import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { SleepScore } from '@vitale/shared';

/**
 * As linhas da saúde do sono: rótulo, dois traços e o fato cru.
 *
 * A mesma peça do mobile (`SleepScoreDims`), recomposta — não redesenhada. Três
 * decisões do review de 06/09/2026 moram aqui, e nenhuma é estética:
 *
 * 1. **O fato fica ao lado do preenchimento, sempre.** É o que deixa discordar
 *    de um ponto sem descartar as outras dimensões.
 * 2. **Preenchido é `--sleep-sleep`, vazio é `--line`.** Sem verde-amarelo-
 *    vermelho: semáforo é juízo, e a tela não julga (ADR 0036).
 * 3. **Dimensão não medida não é dimensão zerada.** Sai apagada, com o motivo
 *    escrito, e fora do denominador — que por isso encolhe.
 */
@Component({
  selector: 'rt-sleep-score-dims',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dims">
      @for (d of score().dimensions; track d.key) {
        <div class="dim" [class.absent]="d.points === null">
          <span class="lab">{{ d.label }}</span>
          <span class="pips">
            @for (i of PIPS; track i) {
              <i class="pip" [class.on]="(d.points ?? 0) > i"></i>
            }
          </span>
          <span class="fact mono">{{ d.points === null ? (d.absent ?? '—') : d.fact }}</span>
        </div>
      }
    </div>

    <div class="rule"></div>

    @if (!hideTally() && score().scored) {
      <div class="tally">
        <b class="mono">{{ score().points }}<small>/{{ score().max }}</small></b>
        @if (note()) { <span class="note">{{ note() }}</span> }
      </div>
    } @else if (note()) {
      <p class="note solo">{{ note() }}</p>
    }
  `,
  styles: [`
    :host { display: block; }
    .dims { display: flex; flex-direction: column; gap: 9px; margin-top: 10px; }
    .dim { display: grid; grid-template-columns: 104px minmax(60px, 1fr) auto; gap: 12px; align-items: center; }
    .lab { font-size: 12.5px; font-weight: 600; color: var(--ink); }
    .dim.absent .lab, .dim.absent .fact { color: var(--ink-3); }
    .pips { display: flex; gap: 3px; }
    .pip { flex: 1; height: 7px; border-radius: 4px; background: var(--line); }
    .pip.on { background: var(--sleep-sleep); }
    /* O motivo da ausência é frase, não número: ele quebra em vez de ser cortado. */
    .fact { font-size: 11.5px; color: var(--ink-2); text-align: right; max-width: 22ch; }
    .rule { height: 1px; background: var(--line); margin: 14px 0; }
    .tally { display: flex; align-items: baseline; gap: 10px; }
    .tally b { font-size: 32px; letter-spacing: -1px; color: var(--ink); font-weight: 600; line-height: 1; }
    .tally b small { font-size: 16px; color: var(--ink-3); font-weight: 400; }
    .note { font-size: 11.5px; line-height: 1.45; color: var(--ink-3); }
    .note.solo { margin: 0; }
  `],
})
export class SleepScoreDimsComponent {
  readonly score = input.required<SleepScore>();
  /** Esconde o total — onde a cobertura não sustenta a contagem. */
  readonly hideTally = input(false);
  readonly note = input<string | undefined>(undefined);
  protected readonly PIPS = [0, 1];
}
