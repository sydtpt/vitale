import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  TRIGGER_MIN_PER_CELL,
  type SleepTriggerBoard,
  type TriggerReach,
  type TriggerReading,
} from '@vitale/shared';

interface ReadingVM {
  key: string;
  label: string;
  phrase: string;
  cells: string;
}

interface ReachVM {
  key: string;
  label: string;
  pct: number;
  missing: string;
}

/** "dorme 33 min a menos" — a frase é do sinal, não de um juízo sobre ele. */
function phraseOf(r: TriggerReading): string {
  const d = r.delta ?? 0;
  const n = Math.round(Math.abs(d));
  if (r.metric === 'onset') return `deita ${n} min mais ${d > 0 ? 'tarde' : 'cedo'}`;
  if (r.metric === 'asleep') return `dorme ${n} min a ${d > 0 ? 'mais' : 'menos'}`;
  return `acorda ${Math.abs(d).toFixed(2).replace('.', ',')} ponto ${d > 0 ? 'acima' : 'abaixo'}`;
}

const signed = (v: number, dec: number) =>
  `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(dec).replace('.', ',')}`;

/**
 * O que precedeu a noite — esporte, hábito, registro — sob a regra das duas
 * colunas (`sleep/triggers.ts`). A mesma peça do mobile (`SleepTriggers`).
 *
 * Três blocos, e a separação entre o segundo e o terceiro é o ponto:
 *
 * 1. **O que fala** — passou a regra, com as duas colunas à vista, porque é a
 *    concordância entre elas que sustenta a leitura.
 * 2. **O que ainda não dá para dizer** — a régua de alcance, com quanto falta.
 * 3. **O que já tem noites e mesmo assim não diz nada.**
 *
 * Juntar 2 e 3 seria o erro: *"não tem efeito"* e *"não tem dado"* são coisas
 * opostas, e uma tela muda não as separa. Ver ADR 0040.
 */
@Component({
  selector: 'rt-sleep-triggers',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (readings().length > 0) {
      @for (r of readings(); track r.key) {
        <div class="row">
          <div class="main">
            <span class="name">{{ r.label }}</span>
            <span class="phrase mono">{{ r.phrase }}</span>
          </div>
          <span class="cells mono">{{ r.cells }}</span>
        </div>
      }
      <p class="rule">
        só sai quando a noite de trabalho e a de folga concordam no sinal — sem isso o
        cruzamento mede o calendário, não o gatilho
      </p>
    }

    @if (pending().length > 0) {
      <p class="gt">O que ainda não dá para dizer</p>
      <p class="gs">a leitura abre com {{ MIN }} noites de cada tipo</p>
      @for (p of pending(); track p.key) {
        <div class="reach">
          <span class="rn">{{ p.label }}</span>
          <span class="track"><span class="fill" [style.width.%]="p.pct"></span></span>
          <span class="rv mono">{{ p.missing }}</span>
        </div>
      }
    }

    @if (silent(); as s) {
      @if (s.length > 0) {
        <p class="gt">Medidos, e sem efeito</p>
        <p class="gs">{{ silentLine() }}</p>
      }
    }
  `,
  styles: [
    `
      :host { display: block; }
      .mono { font-family: ui-monospace, Menlo, monospace; font-variant-numeric: tabular-nums; }
      .row { padding: 7px 0; border-bottom: 1px solid var(--line); }
      .row:last-of-type { border-bottom: 0; }
      .main { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
      .name { font-size: 13.5px; font-weight: 600; color: var(--ink); min-width: 0; }
      .phrase { font-size: 12.5px; color: var(--ink-2); white-space: nowrap; }
      .cells { display: block; font-size: 10.5px; color: var(--ink-4); margin-top: 2px; }
      .rule { margin: 8px 0 0; font-size: 11px; line-height: 1.45; color: var(--ink-3); }
      .gt { margin: 14px 0 0; font-size: 12.5px; font-weight: 600; color: var(--ink); }
      .gs { margin: 0 0 6px; font-size: 11px; color: var(--ink-3); }
      .reach { display: flex; align-items: center; gap: 8px; padding: 4px 0; }
      .rn { width: 118px; flex: none; font-size: 12px; color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .track { flex: 1; height: 6px; border-radius: 3px; background: var(--line); overflow: hidden; }
      .fill { display: block; height: 100%; border-radius: 3px; background: var(--sleep-sleep); opacity: .6; }
      .rv { width: 60px; flex: none; text-align: right; font-size: 10.5px; color: var(--ink-3); }
    `,
  ],
})
export class SleepTriggersComponent {
  readonly board = input.required<SleepTriggerBoard>();

  protected readonly MIN = TRIGGER_MIN_PER_CELL;

  protected readonly readings = computed<ReadingVM[]>(() =>
    this.board().readings.map((r) => ({
      key: `${r.id}:${r.metric}`,
      label: r.label,
      phrase: phraseOf(r),
      cells: r.cells
        .map((c) => `${c.column} ${signed(c.delta ?? 0, r.metric === 'rating' ? 2 : 0)}`)
        .join('  ·  '),
    })),
  );

  protected readonly pending = computed<ReachVM[]>(() =>
    this.board().pending.map((p: TriggerReach) => ({
      key: p.id,
      label: p.label,
      pct: Math.max(4, (Math.min(p.presa, p.livre) / TRIGGER_MIN_PER_CELL) * 100),
      missing: p.missing === 1 ? 'falta 1' : `faltam ${p.missing}`,
    })),
  );

  protected readonly silent = computed(() => this.board().silent);
  protected readonly silentLine = computed(() =>
    this.board().silent.map((s) => `${s.label} (${s.nights})`).join(' · '),
  );
}
