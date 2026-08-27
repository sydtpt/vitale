import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { buildTypeVolumeTrend, totalsDelta, type Activity } from '@vitale/shared';
import { metaForActivity } from '@core/models/activity-types';
import { VolumeChartComponent } from '@shared/components/volume-chart/volume-chart.component';

/**
 * A evolução recente de um tipo, logo abaixo dos recordes.
 *
 * Os recordes contam o que **já** aconteceram — o melhor de sempre, o maior dos
 * doze meses. Não dizem se a coisa está indo para cima ou para baixo agora, que
 * é a outra pergunta que se leva para a página de um esporte. Daí o painel curto
 * aqui e não uma segunda página.
 *
 * A série é a mesma do card do tipo na lista, pelo mesmo builder do núcleo, só
 * que com a janela maior: card e página discordando sobre o mesmo esporte seria
 * o pior tipo de bug — dois números certos sobre a mesma coisa.
 */
@Component({
  selector: 'rt-type-evolution-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [VolumeChartComponent],
  template: `
    <section class="card">
      <header class="head">
        <h2 class="title">Evolução</h2>
        <div class="agg">
          <span class="total mono">{{ trend().total }}<span class="unit"> {{ unit() }}</span></span>
          <!-- Três estados, como nos tiles: sem base não mostra nada, zero
               mostra "=", o resto mostra a seta. -->
          @if (delta() !== null) {
            <span class="delta mono"
              [attr.data-dir]="delta()! > 0 ? 'up' : delta()! < 0 ? 'down' : 'flat'">
              @if (delta() === 0) { = } @else { {{ delta()! > 0 ? '↑' : '↓' }}{{ abs(delta()!) }}% }
            </span>
          }
        </div>
      </header>

      <rt-volume-chart [buckets]="trend().buckets" [unit]="unit()" [color]="color()"
        [reference]="trend().mean" [referenceLabel]="'média ' + trend().mean + ' ' + unit()"
        [ariaLabel]="'Volume de ' + label() + ' por semana, últimas ' + weeks() + ' semanas'"
        emptyLabel="Nada nas últimas semanas" />

      <p class="caption">
        Últimas {{ weeks() }} semanas · média de {{ trend().mean }} {{ unit() }} por semana
        @if (delta() !== null) { · variação sobre as {{ weeks() }} semanas anteriores }
      </p>
    </section>
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
    .head {
      display: flex;
      align-items: baseline;
      gap: 10px;
      margin-bottom: 6px;
    }
    .title { font-size: 13.5px; font-weight: 650; color: var(--ink); margin: 0; }
    .agg { margin-left: auto; display: flex; align-items: baseline; gap: 8px; }
    .total { font-size: 20px; font-weight: 650; color: var(--ink); letter-spacing: -0.4px; }
    .unit { font-size: 13px; font-weight: 600; color: var(--ink-3); }
    .delta { font-size: 11px; font-weight: 650; color: var(--ink-3); }
    .delta[data-dir='up'] { color: var(--role-green-text); }
    .delta[data-dir='down'] { color: var(--role-red-text); }
    .caption { font-size: 11px; color: var(--ink-3); margin: 4px 0 0; }
  `],
})
export class TypeEvolutionCardComponent {
  /** O histórico inteiro — o recorte por rótulo é feito aqui. */
  readonly activities = input.required<Activity[]>();
  readonly label = input.required<string>();
  /** Tipos com distância medem em km; os demais, em minutos. */
  readonly hasDistance = input(true);
  readonly color = input('var(--primary)');
  readonly weeks = input(12);

  protected readonly unit = computed(() => (this.hasDistance() ? 'km' : 'min'));

  protected readonly trend = computed(() =>
    buildTypeVolumeTrend(
      this.activities(),
      (id) => metaForActivity(id).label,
      this.label(),
      this.hasDistance() ? 'distance' : 'duration',
      this.weeks(),
    ),
  );

  /** `null` sem base de comparação: crescer a partir do nada não é "↑ 100%". */
  protected readonly delta = computed(() =>
    totalsDelta(this.trend().total, this.trend().previousTotal),
  );

  protected abs(n: number): number {
    return Math.abs(n);
  }
}
