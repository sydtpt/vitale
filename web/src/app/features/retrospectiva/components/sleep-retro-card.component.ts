import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  AWAKE_COUNTED_MIN,
  NIGHT_REFERENCE_H,
  clockOfAxis,
  coverageNote,
  formatHm,
  signedMin,
  type PeriodKind,
  type SleepRetro,
  type SleepTriggerBoard,
} from '@vitale/shared';
import { TypicalAwakeComponent } from '@features/sono/components/typical-awake.component';
import { SleepTriggersComponent } from './sleep-triggers.component';
import { SleepScoreDimsComponent } from '@features/sono/components/sleep-score-dims.component';

const NOUN: Record<PeriodKind, string> = {
  week: 'semana', month: 'mês', season: 'estação', year: 'ano', all: 'período',
};
const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function dm(day: string): string {
  return `${Number(day.slice(8, 10))}/${day.slice(5, 7)}`;
}
function weekRange(key: string): string {
  const a = new Date(`${key}T12:00:00`);
  const b = new Date(a);
  b.setDate(a.getDate() + 6);
  return `${a.getDate()}–${b.getDate()} ${MES[b.getMonth()]}`;
}

/**
 * O bloco **Sono** da Retrospectiva na web — a mesma página do mobile,
 * recomposta em coluna. A web já calculava `summary.sleep` desde 05/09 e não a
 * desenhava; agora desenha, e com as seis pautas de 06/09 (ADR 0036).
 *
 * A ordem é de jornal: a tarja, o **selo** em caixa, e então o corpo — quanto,
 * quando, acordado e a que horas, por fase, as semanas, como acordou, e as duas
 * datas que fecham. Nenhum cálculo nasce aqui: tudo vem de `sleepRetro`.
 *
 * Três regras que o desenho carrega:
 * 1. **O número grande é a mediana**, e a média entra embaixo quando as duas
 *    discordam — publicar só a média é publicar o número errado quando uma noite
 *    curta puxa o período.
 * 2. **O selo não é a manchete.** Ele vem depois da tarja e antes do corpo.
 * 3. **Sem semáforo nas dimensões** e sem seta de tendência: as diferenças saem
 *    em minutos, que são fato.
 */
@Component({
  selector: 'rt-sleep-retro-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SleepScoreDimsComponent, TypicalAwakeComponent, SleepTriggersComponent],
  template: `
    <div class="eyebrow">
      Sono <span class="n">· {{ r().cur.nights }} {{ r().cur.nights === 1 ? 'noite' : 'noites' }}</span>
    </div>

    @if (r().score; as sc) {
      <div class="seal">
        <div class="seal-t">Saúde do sono</div>
        <rt-sleep-score-dims [score]="sc" [note]="note()" />
      </div>
    }

    <div class="big">
      {{ hm(r().medianH) }}
      @if (d(); as dd) {
        <span class="big-delta" [attr.data-tone]="tone(dd.asleepMin, false, 5)">{{ sig(dd.asleepMin) }} vs {{ noun() }} anterior</span>
      }
    </div>
    <p class="muted">
      dormindo numa noite típica · {{ r().cur.nightsAtReference }} de {{ r().cur.nights }} com {{ REF }} h ou mais
    </p>
    @if (r().meanMedianSplit) {
      <p class="fine">
        a média foi {{ hm(r().cur.asleepH) }} — a noite de {{ dm(r().extremes.shortest.day) }},
        com {{ hm(r().extremes.shortest.h) }}, puxa sozinha
      </p>
    }

    <div class="row"><span>Apagou · acordou</span><span class="row-v mono">{{ clock(r().cur.onset.median) }} · {{ clock(r().cur.wake.median) }}</span></div>
    <p class="fine">
      medianas · miolo {{ clock(r().cur.onset.p25) }}–{{ clock(r().cur.onset.p75) }} e
      {{ clock(r().cur.wake.p25) }}–{{ clock(r().cur.wake.p75) }}
    </p>

    <p class="sub">Acordado — e a que horas</p>
    @if (r().cur.awake; as aw) {
      <div class="row"><span>Por noite</span><span class="row-v mono">{{ round(aw.minMean) }} min <small>· {{ aw.countMean.toFixed(1) }} despertares</small></span></div>
      @if (r().awakeSpread; as sp) {
        @if (sp.total > 0) {
          <div class="row"><span>De {{ COUNTED }} min para cima</span><span class="row-v mono">{{ sp.counted }} <small>de {{ sp.total }}</small></span></div>
        }
      }
      @if (r().typical; as t) {
        @if (t.medianMin !== null) {
          <rt-typical-awake [typical]="t" [longestDay]="t.longest ? dm(t.longest.day) : null" />
          <p class="fine">a duração de um despertar não muda de aparelho — a contagem, sim</p>
        }
      }
      @if (peak(); as pk) {
        <div class="hours">
          @for (h of r().awakeHours; track h.from) {
            <span class="hour">
              <span class="h-track"><span class="h-bar" [style.height.px]="barH(h.nights, pk.nights)" [style.opacity]="h.nights === pk.nights ? 1 : .42"></span></span>
              <span class="h-lab mono">{{ clock(h.from).slice(0, 2) }}</span>
            </span>
          }
        </div>
        <p class="fine">a noite quebrou mais entre {{ clock(pk.from) }} e {{ clock(pk.from + 1) }} — {{ pk.nights }} noites</p>
      }
    } @else {
      <p class="fine">a fonte não reporta despertares neste período</p>
    }

    @if (r().cur.stages; as st) {
      <p class="sub">Por fase — a noite média</p>
      <div class="stage">
        <i [style.flex]="st.rem" style="background:var(--sleep-rem)"></i>
        <i [style.flex]="st.core" style="background:var(--sleep-light)"></i>
        <i [style.flex]="st.deep" style="background:var(--sleep-deep)"></i>
        @if (r().cur.awake; as aw) { <i [style.flex]="aw.minMean / 60" style="background:var(--sleep-awake)"></i> }
      </div>
      <div class="key">
        <span><i style="background:var(--sleep-rem)"></i>REM {{ hm(st.rem) }}</span>
        <span><i style="background:var(--sleep-light)"></i>Leve {{ hm(st.core) }}</span>
        <span><i style="background:var(--sleep-deep)"></i>Profundo {{ hm(st.deep) }}</span>
        @if (r().cur.awake; as aw) { <span><i style="background:var(--sleep-awake)"></i>acordado {{ round(aw.minMean) }} min</span> }
      </div>
    }

    @if (showWeeks()) {
      <p class="sub">Semana a semana</p>
      <div class="weeks">
        @for (w of shownWeeks(); track w.key) {
          <span class="wk">
            <span class="wk-v mono">{{ hm(w.asleepH) }}</span>
            <span class="wk-track"><span class="wk-bar" [style.height.px]="wkH(w.asleepH)"></span></span>
            <span class="wk-l">{{ weekRange(w.key) }}</span>
            <span class="wk-n mono">n{{ w.nights }}</span>
          </span>
        }
      </div>
    }

    @if (showSri()) {
      <p class="sub">Regularidade, semana a semana</p>
      <div class="weeks">
        @for (w of sriWeeks(); track w.key) {
          <span class="wk">
            <span class="wk-v mono">{{ round(w.sri!) }}</span>
            <span class="wk-track"><span class="wk-bar deep" [style.height.px]="sriH(w.sri!)"></span></span>
            <span class="wk-l">{{ weekRange(w.key) }}</span>
            <span class="wk-n mono">n{{ w.nights }}</span>
          </span>
        }
      </div>
      <p class="fine">
        índice de 0 a 100 — a chance de você estar no mesmo estado 24 h depois. Abaixo de 72 fica o
        quintil de maior risco do UK Biobank.
      </p>
    }

    @if (r().ratings; as rt) {
      <p class="sub">Como você acordou</p>
      <div class="row"><span>Nota média</span><span class="row-v mono">{{ rt.mean.toFixed(1) }}/5 <small>· {{ rt.n }} noites</small></span></div>
      @if (rt.hi; as hi) {
        <div class="row"><span>Nota 4–5 ({{ hi.n }})</span><span class="row-v mono">{{ hm(hi.asleepH) }}</span></div>
      }
      @if (rt.lo; as lo) {
        <div class="row"><span>Nota ≤3 ({{ lo.n }})</span><span class="row-v mono">{{ hm(lo.asleepH) }}</span></div>
      }
      @if (showBands()) {
        <p class="fine">e por quanto você dormiu naquelas noites</p>
        @for (b of ratedBands(); track b.label) {
          <div class="row"><span>Noites de {{ b.label }} ({{ b.ratedNights }})</span><span class="row-v mono">{{ b.rating!.toFixed(2) }}</span></div>
        }
      }
    }

    <p class="sub">{{ nounCap() }} em duas datas</p>
    <div class="row">
      <span>{{ dm(r().extremes.shortest.day) }} — a mais curta</span>
      <span class="row-v mono">{{ hm(r().extremes.shortest.h) }}</span>
    </div>
    <div class="row">
      <span>{{ dm(r().extremes.longest.day) }} — a mais longa</span>
      <span class="row-v mono">{{ hm(r().extremes.longest.h) }}</span>
    </div>
    @if (r().extremes.best; as b) {
      <div class="row"><span>{{ dm(b.day) }} — a de maior contagem</span><span class="row-v mono">{{ b.points }}/{{ b.max }}</span></div>
    }

    @if (triggers(); as tb) {
      <div class="standing">
        <span class="tag">todo o histórico · não é {{ deste() }}</span>
        <p class="sub st">O que precedeu a noite</p>
        <rt-sleep-triggers [board]="tb" />
      </div>
    }

    <p class="fix">
      @if (r().prev; as p) { {{ nounCap() }} anterior: {{ p.nights }} {{ p.nights === 1 ? 'noite' : 'noites' }}. }
      @if (r().cur.stages) { Fases são estimativa do relógio, comparáveis com você mesmo. }
      @if (r().sourceChange; as m) { A comparação cruza a troca para {{ m.label }} ({{ dm(m.day) }}): despertares não se comparam. }
      @if (lowCoverage(); as c) { {{ c.nights }} de {{ c.expected }} noites gravadas — abaixo do piso, as medidas aparecem e a contagem não. }
    </p>
  `,
  styles: [`
    :host { display: block; }
    .eyebrow { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-3); }
    .eyebrow .n { font-weight: 500; text-transform: none; letter-spacing: 0; }
    .mono { font-family: ui-monospace, Menlo, monospace; font-variant-numeric: tabular-nums; }

    .seal { background: var(--surface-mute); border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; margin: 10px 0 14px; }
    .seal-t { font-size: 10.5px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; color: var(--ink-3); }

    .big { font-size: 30px; font-weight: 700; color: var(--ink); display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
    .big-delta { font-size: 13px; font-weight: 600; }
    .big-delta[data-tone="good"] { color: var(--role-green-text, var(--ink-2)); }
    .big-delta[data-tone="bad"] { color: var(--role-red-text, var(--ink-2)); }
    .big-delta[data-tone="flat"] { color: var(--ink-3); }
    .muted { font-size: 13px; color: var(--ink-3); margin: 4px 0 8px; }
    .fine { font-size: 11.5px; line-height: 1.5; color: var(--ink-3); margin: 2px 0 8px; }
    .sub { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--ink-3); margin: 14px 0 4px; }
    .row { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; padding: 5px 0; font-size: 13.5px; border-bottom: 1px solid var(--line); }
    .row:last-of-type { border-bottom: 0; }
    .row-v { font-weight: 600; }
    .row-v small { font-weight: 400; color: var(--ink-3); }

    .hours { display: flex; gap: 3px; align-items: flex-end; margin-top: 8px; }
    .hour { flex: 1; display: flex; flex-direction: column; align-items: center; }
    .h-track { height: 32px; width: 100%; display: flex; align-items: flex-end; justify-content: center; }
    .h-bar { width: 68%; border-radius: 2px; background: var(--sleep-awake); }
    .h-lab { font-size: 8.5px; color: var(--ink-4); margin-top: 3px; }

    .stage { display: flex; height: 16px; gap: 2px; border-radius: 4px; overflow: hidden; margin-top: 6px; }
    .stage i { display: block; }
    .key { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 11.5px; color: var(--ink-2); margin-top: 8px; }
    .key i { display: inline-block; width: 9px; height: 9px; border-radius: 2px; margin-right: 5px; vertical-align: -1px; }

    .weeks { display: flex; gap: 6px; align-items: flex-end; margin-top: 6px; }
    .wk { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 0; }
    .wk-v { font-size: 11px; color: var(--ink); }
    .wk-track { height: 44px; width: 100%; display: flex; align-items: flex-end; justify-content: center; }
    .wk-bar { width: 62%; border-radius: 3px; background: var(--sleep-sleep); }
    .wk-bar.deep { background: var(--sleep-deep); }
    .wk-l { font-size: 9.5px; color: var(--ink-3); white-space: nowrap; }
    .wk-n { font-size: 9px; color: var(--ink-4); }

    /* Os gatilhos falam de outra janela. O vão e a tarja avisam antes do número. */
    .standing { margin-top: 20px; padding-top: 14px; border-top: 1px solid var(--line); }
    .standing .tag { display: block; font-size: 9.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-4); font-weight: 600; }
    .sub.st { margin-top: 4px; }

    .fix { margin: 14px 0 0; padding-left: 12px; border-left: 2px solid var(--line-deep); font-size: 11.5px; line-height: 1.5; color: var(--ink-3); }
  `],
})
export class SleepRetroCardComponent {
  readonly retro = input.required<SleepRetro>();
  readonly kind = input.required<PeriodKind>();
  /** 'Total' não tem período anterior — as variações somem. */
  readonly noPrior = input(false);
  /**
   * O que precedeu a noite. Roda em todo o histórico, não no período — por isso
   * chega por fora de `retro`, que é do período. `null` esconde o bloco.
   */
  readonly triggers = input<SleepTriggerBoard | null>(null);

  protected readonly REF = NIGHT_REFERENCE_H;
  protected readonly COUNTED = AWAKE_COUNTED_MIN;
  protected readonly hm = formatHm;
  protected readonly sig = signedMin;
  protected readonly clock = clockOfAxis;
  protected readonly dm = dm;
  protected readonly weekRange = weekRange;
  protected readonly round = Math.round;

  protected readonly r = this.retro;
  protected readonly d = computed(() => (this.noPrior() ? null : this.retro().delta));
  protected readonly noun = computed(() => NOUN[this.kind()]);
  /** 'desta semana' | 'deste mês' — a tarja dos gatilhos concorda com o período. */
  protected readonly deste = computed(() => {
    const n = NOUN[this.kind()];
    return n === 'semana' || n === 'estação' ? `desta ${n}` : `deste ${n}`;
  });
  protected readonly nounCap = computed(() => {
    const n = this.noun();
    return n.charAt(0).toUpperCase() + n.slice(1);
  });
  protected readonly note = computed(() => {
    // Guardado, e não `score!`: o template só lê isto dentro do `@if`, mas um
    // sinal que explode quando lido fora dele é uma armadilha para quem editar.
    const s = this.retro().score;
    return s ? coverageNote(s) ?? undefined : undefined;
  });

  protected readonly peak = computed(() => {
    const hs = this.retro().awakeHours;
    if (hs.length < 3) return null;
    return hs.reduce((m, h) => (h.nights > m.nights ? h : m));
  });

  protected readonly shownWeeks = computed(() => this.retro().weeks.filter((w) => w.nights >= 3));
  protected readonly showWeeks = computed(() => {
    const k = this.kind();
    return (k === 'month' || k === 'season') && this.shownWeeks().length >= 2;
  });
  protected readonly sriWeeks = computed(() => this.retro().regularityWeeks.filter((w) => w.sri !== null));
  protected readonly showSri = computed(() => this.sriWeeks().length >= 2);
  protected readonly ratedBands = computed(() =>
    this.retro().bands.filter((b) => b.rating !== null && b.nights > 0),
  );
  protected readonly showBands = computed(() => this.ratedBands().length >= 2);

  protected readonly lowCoverage = computed(() => {
    const s = this.retro().score;
    return s && !s.scored && s.coverage && s.coverage.nights > 0 ? s.coverage : null;
  });

  protected readonly wkMax = computed(() => Math.max(9, ...this.shownWeeks().map((w) => w.asleepH)));
  protected wkH(h: number): number {
    return Math.max(3, (h / this.wkMax()) * 44);
  }
  protected sriH(v: number): number {
    return Math.max(3, (Math.max(0, v) / 100) * 44);
  }
  protected barH(n: number, peak: number): number {
    return Math.max(2, (n / peak) * 32);
  }

  protected tone(min: number, higherIsWorse: boolean, flat: number): 'good' | 'bad' | 'flat' {
    if (Math.abs(min) < flat) return 'flat';
    return (higherIsWorse ? min > 0 : min < 0) ? 'bad' : 'good';
  }
}
