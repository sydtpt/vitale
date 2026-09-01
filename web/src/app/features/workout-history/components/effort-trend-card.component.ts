import { ChangeDetectionStrategy, Component, computed, input, linkedSignal } from '@angular/core';
import { bestEffortTrend, distancesWithData, type Activity, type BestEffortDistance } from '@vitale/shared';
import { TrendChartComponent, type TrendPoint } from '@shared/components/trend-chart/trend-chart.component';
import { formatClock, formatRate } from '../data/format';

/**
 * "Estou diminuindo?" — o melhor tempo por mês numa distância, contra o recorde.
 *
 * O objetivo declarado é baixar minutos por quilômetro, e ritmo médio de corrida
 * não mede isso: um 20 km leve tem ritmo pior que um 5 km forte, sempre. A única
 * leitura comparável consigo mesma é o ritmo **na mesma distância** — daí o
 * seletor, e daí só as distâncias que têm marca. Mesmo builder do card do
 * mobile; a série é a mesma nos dois.
 */
@Component({
  selector: 'rt-effort-trend-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TrendChartComponent],
  template: `
    @if (distances().length > 0 && trend(); as t) {
      <section class="card">
        <header class="head">
          <h2 class="title">Melhor {{ selectedLabel() }} por mês</h2>
          @if (t.record; as r) {
            <span class="record">
              recorde <b class="mono">{{ clock(r.secs) }}</b>
              @if (recordRate(); as rate) { <span class="mono rate">· {{ rate }}</span> }
            </span>
          }
        </header>

        @if (distances().length > 1) {
          <div class="toggle" role="tablist">
            @for (d of distances(); track d.key) {
              <button type="button" class="m" role="tab" [class.active]="d.key === selected()"
                [attr.aria-selected]="d.key === selected()" (click)="selected.set(d.key)">{{ short(d.label) }}</button>
            }
          </div>
        }

        <rt-trend-chart [points]="points()" [color]="color()" [reference]="t.record?.secs ?? null"
          [referenceLabel]="t.record ? 'recorde ' + clock(t.record.secs) : ''" [formatValue]="clock"
          emptyLabel="Nenhuma corrida cobriu esta distância nos últimos {{ months() }} meses"
          [ariaLabel]="'Melhor ' + selectedLabel() + ' por mês'" />

        <p class="caption">
          Mais baixo = mais rápido · um ponto por mês, o melhor daquele mês
          @if (t.measured > 0) { · {{ t.measured }} de {{ months() }} meses com marca }
        </p>
      </section>
    }
  `,
  styles: [`
    .card {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 16px;
      box-shadow: var(--shadow-sm);
      margin-bottom: 18px;
    }
    .head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
    .title { font-size: 13.5px; font-weight: 650; color: var(--ink); margin: 0; }
    .record { margin-left: auto; font-size: 12px; color: var(--ink-3); }
    .record b { color: var(--ink); font-weight: 650; }
    .rate { color: var(--ink-2); }
    .toggle {
      display: inline-flex; gap: 2px; padding: 3px; margin-bottom: 10px;
      background: var(--surface-mute); border-radius: 11px; border: 1px solid var(--line);
    }
    .m {
      border: none; background: transparent; color: var(--ink-2);
      font-size: 12.5px; font-weight: 600; padding: 5px 12px; border-radius: 8px;
      cursor: pointer; transition: background 0.12s, color 0.12s;
    }
    .m:hover { color: var(--ink); }
    /* Tinta, e não o acento da marca: é letra, e o piso de letra é 4,5. ADR 0024. */
    .m.active { background: var(--surface); color: var(--ink); box-shadow: var(--shadow-sm); }
    .caption { font-size: 11px; color: var(--ink-3); margin: 6px 0 0; }
  `],
})
export class EffortTrendCardComponent {
  readonly activities = input.required<Activity[]>();
  readonly sportId = input.required<number>();
  readonly color = input('var(--primary)');
  readonly months = input(12);

  protected readonly distances = computed(() => distancesWithData(this.activities(), this.sportId()));

  /**
   * A distância escolhida. `linkedSignal`: o clique escreve, mas se a lista de
   * distâncias mudar e a escolhida sumir, volta ao padrão em vez de apontar para
   * um botão que não existe. 5 km é o que mais se corre; senão, a primeira.
   */
  protected readonly selected = linkedSignal<BestEffortDistance[], string>({
    source: this.distances,
    computation: (ds, prev) => {
      if (prev && ds.some((d) => d.key === prev.value)) return prev.value;
      return ds.find((d) => d.key === '5000')?.key ?? ds[0]?.key ?? '';
    },
  });

  protected readonly selectedLabel = computed(
    () => this.distances().find((d) => d.key === this.selected())?.label ?? '',
  );

  protected readonly trend = computed(() =>
    this.selected() ? bestEffortTrend(this.activities(), this.sportId(), this.selected(), this.months()) : null,
  );

  protected readonly points = computed<TrendPoint[]>(() =>
    (this.trend()?.buckets ?? []).map((b) => ({ key: b.key, label: b.label, value: b.secs })),
  );

  protected readonly recordRate = computed(() => {
    const t = this.trend();
    const d = this.distances().find((x) => x.key === this.selected());
    if (!t?.record || !d) return null;
    const r = formatRate(this.sportId(), d.meters, t.record.secs);
    return r ? `${r.value} ${r.caption === 'pace' ? '/km' : r.caption}` : null;
  });

  protected readonly clock = (s: number) => formatClock(s);
  protected short(label: string): string {
    return label.replace('Meia maratona', 'Meia');
  }
}
