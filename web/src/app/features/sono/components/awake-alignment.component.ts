import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { AlignmentTest, AwakeAlignment } from '@vitale/shared';

interface LaneBar {
  key: number;
  /** Altura da barra observada, em px. */
  h: number;
  /** Altura da linha do acaso, em px, medida do chão. */
  chance: number;
  label: string;
  peak: boolean;
}

interface LaneVM {
  title: string;
  hint: string;
  bars: LaneBar[];
  verdict: string;
  awake: boolean;
}

const BAR_H = 54;
const clockLabel = (h: number) => `${String(h).padStart(2, '0')}h`;
const sinceLabel = (h: number) => (h === 0 ? 'a 1ª meia hora' : `+${h}h`);

/**
 * Relógio ou corpo — a peça que responde *"tem algo me acordando na mesma hora?"*.
 *
 * A mesma peça do mobile (`AwakeAlignmentView`), recomposta. Dois alinhamentos
 * dos **mesmos** despertares, cada um contra o que o acaso daria: uma causa
 * externa (trem, avião, vizinho) fica presa ao relógio de parede, uma causa
 * interna fica presa ao sono. A que subir acima do acaso explica — e quando
 * nenhuma sobe, isso também é resposta.
 *
 * A linha do acaso **não é uniforme**: às 4h ele quase sempre está dormindo, e
 * sem esse denominador de exposição o gráfico mediria o relógio, não a pessoa.
 * Ver `awake-shape.ts`, inclusive para por que a primeira hora de sono sai do
 * eixo do relógio.
 */
@Component({
  selector: 'rt-awake-alignment',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="sub">
      {{ alignment().events }} despertares de {{ alignment().nights }} noites ·
      {{ fromLabel() }} a {{ toLabel() }}
    </p>

    @for (lane of lanes(); track lane.title) {
      <div class="lane">
        <div class="head">
          <b>{{ lane.title }}</b>
          <span class="hint">{{ lane.hint }}</span>
        </div>
        <div class="bars" [class.awake]="lane.awake">
          @for (b of lane.bars; track b.key) {
            <div class="col">
              <div class="track">
                <div class="bar" [class.peak]="b.peak" [style.height.px]="b.h"></div>
                <div class="chance" [style.bottom.px]="b.chance"></div>
              </div>
              <span class="xl mono" [class.on]="b.peak">{{ b.label }}</span>
            </div>
          }
        </div>
        <p class="verdict">{{ lane.verdict }}</p>
      </div>
    }

    <p class="close">{{ close() }}</p>
  `,
  styles: [
    `
      :host { display: block; }
      .sub { margin: 0 0 4px; font-size: 11.5px; color: var(--ink-3); }
      .lane { margin-top: 14px; }
      .head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
      .head b { font-size: 12.5px; color: var(--ink); }
      .hint { font-size: 10.5px; color: var(--ink-4); }
      .bars { display: flex; gap: 2px; align-items: flex-end; margin-top: 8px; }
      .col { flex: 1; display: flex; flex-direction: column; align-items: center; min-width: 0; }
      .track { height: 54px; width: 100%; position: relative; display: flex; align-items: flex-end; justify-content: center; }
      .bar { width: 78%; border-radius: 2px; background: var(--sleep-sleep); opacity: 0.55; }
      .bars.awake .bar { background: var(--sleep-awake); }
      .bar.peak { opacity: 1; }
      .chance { position: absolute; left: 0; right: 0; height: 1.5px; background: var(--ink-4); }
      .xl { font-size: 8px; color: var(--ink-4); margin-top: 3px; white-space: nowrap; }
      .xl.on { color: var(--ink-2); font-weight: 600; }
      .verdict { margin: 6px 0 0; font-size: 11.5px; line-height: 1.4; color: var(--ink-2); }
      .close {
        margin: 14px 0 0; padding-top: 10px; border-top: 1px solid var(--line);
        font-size: 12.5px; line-height: 1.45; color: var(--ink);
      }
    `,
  ],
})
export class AwakeAlignmentComponent {
  readonly alignment = input.required<AwakeAlignment>();
  readonly fromLabel = input.required<string>();
  readonly toLabel = input.required<string>();

  protected readonly lanes = computed<LaneVM[]>(() => {
    const a = this.alignment();
    return [
      {
        title: 'Pelo relógio de parede',
        hint: 'descontada a 1ª hora de sono',
        bars: this.barsOf(a.clock, clockLabel),
        awake: true,
        verdict: this.clockVerdict(a.clock),
      },
      {
        title: 'Desde que você apagou',
        hint: 'faixas de meia hora',
        bars: this.barsOf(a.since, sinceLabel),
        awake: false,
        verdict:
          a.since.significant && a.since.peak
            ? `${a.since.peak.observed} despertares em ${sinceLabel(a.since.peak.from)} contra ` +
              `${Math.round(a.since.peak.expected)} esperados — ` +
              `${a.since.peak.ratio.toFixed(1).replace('.', ',')}× o acaso`
            : 'espalhados pela noite, como o acaso daria',
      },
    ];
  });

  protected readonly close = computed(() => {
    const a = this.alignment();
    if (a.clock.significant) return 'Há uma hora do relógio que se repete acima do acaso.';
    if (a.since.significant) {
      return 'Nenhuma hora do relógio te acorda. O que quebra a sua noite acompanha o seu sono, não a rua.';
    }
    return 'Nem o relógio nem o sono explicam — os despertares caem espalhados.';
  });

  private clockVerdict(t: AlignmentTest): string {
    if (!t.peak) return 'sem faixa com noites suficientes';
    const at = clockLabel(t.peak.from);
    const exp = Math.round(t.peak.expected);
    return t.significant
      ? `a noite quebra mais por volta de ${at} — ${t.peak.observed} contra ${exp} que o acaso daria`
      : `nada se repete: a hora mais carregada, ${at}, tem ${t.peak.observed} despertares e o acaso daria ${exp}`;
  }

  /**
   * Escala comum às barras e à linha do acaso — senão a comparação visual mente.
   * As faixas sem exposição saem: as horas em que ele nunca dorme são vão, não
   * zero, e desenhá-las achataria o resto.
   */
  private barsOf(t: AlignmentTest, label: (n: number) => string): LaneBar[] {
    const top = Math.max(1, ...t.bins.map((b) => Math.max(b.observed, b.expected)));
    return t.bins
      .filter((b) => b.expected >= 0.5 || b.observed > 0)
      .map((b) => ({
        key: b.from,
        h: Math.max(1, (b.observed / top) * BAR_H),
        chance: (b.expected / top) * BAR_H,
        label: b.from % 2 === 0 ? label(b.from) : '',
        peak: t.peak?.from === b.from,
      }));
  }
}
