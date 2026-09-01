import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { bestEffortCurve, formatPace, formatSpeed, type Activity } from '@vitale/shared';
import { TrendChartComponent, type TrendPoint } from '@shared/components/trend-chart/trend-chart.component';
import { formatClock, fmtDate } from '../data/format';

const RIDE = 13;

/**
 * A curva de recordes: a melhor marca em cada distância, num eixo só.
 *
 * Uma leitura responde o que oito cards não respondem — se você é forte no
 * curto e cai no longo, ou o contrário. Corrida lê ritmo (mais baixo = mais
 * rápido); pedal lê velocidade (mais alto = mais rápido). O x é log. É um
 * **envelope de melhores marcas**, não um teste — cada ponto pode ser de uma
 * corrida diferente, e o tooltip diz de quando. Mesmo builder do card do mobile.
 */
@Component({
  selector: 'rt-record-curve-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TrendChartComponent],
  template: `
    @if (points().length >= 2) {
      <section class="card">
        <header class="head">
          <h2 class="title">Curva de recordes</h2>
          <span class="sub">{{ isRide() ? 'mais alto = mais rápido' : 'mais baixo = mais rápido' }}</span>
        </header>
        <rt-trend-chart [points]="points()" [color]="color()" [logX]="true" [formatValue]="formatY()"
          [ariaLabel]="'Curva de recordes'" (pick)="open($event)" />
        <p class="caption">
          Envelope das melhores marcas — cada ponto pode ser de uma corrida diferente, não é um teste único.
          Passe o mouse para ver de quando é cada uma; clique para abrir a corrida.
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
    .head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 6px; }
    .title { font-size: 13.5px; font-weight: 650; color: var(--ink); margin: 0; }
    .sub { margin-left: auto; font-size: 11px; color: var(--ink-3); }
    .caption { font-size: 11px; color: var(--ink-3); margin: 6px 0 0; }
  `],
})
export class RecordCurveCardComponent {
  readonly activities = input.required<Activity[]>();
  readonly sportId = input.required<number>();
  /** Slug do tipo na rota — o clique no ponto abre `/workout-history/:slug/:id`. */
  readonly slug = input.required<string>();
  readonly color = input('var(--primary)');

  private readonly router = inject(Router);

  /**
   * Os cards de recorde por distância saíram da tira: este é o único caminho da
   * página até a corrida que detém cada marca. Sem ele, a curva diria "quando"
   * no tooltip e não deixaria chegar lá.
   */
  protected open(id: string): void {
    void this.router.navigate(['/workout-history', this.slug(), id]);
  }

  protected readonly isRide = computed(() => this.sportId() === RIDE);
  private readonly curve = computed(() => bestEffortCurve(this.activities(), this.sportId()));

  protected readonly points = computed<TrendPoint[]>(() =>
    this.curve().map((p) => {
      const rate = this.isRide()
        ? `${formatSpeed(p.meters, p.secs)} km/h`
        : `${formatPace(p.meters, p.secs)} /km`;
      return {
        key: p.key,
        label: p.label.replace('Meia maratona', 'Meia').replace('Maratona', '42'),
        x: p.meters,
        // Pedal: km/h, mais alto é melhor. Corrida: s/km, mais baixo é melhor.
        value: this.isRide() ? 3600 / p.secPerKm : p.secPerKm,
        title: `${p.label} · ${formatClock(p.secs)} · ${rate} · ${fmtDate(p.startAt)}`,
        id: p.id,
      };
    }),
  );

  protected readonly formatY = computed(() =>
    this.isRide() ? (v: number) => `${v.toFixed(0)} km/h` : (v: number) => formatPace(1000, v) ?? '—',
  );
}
