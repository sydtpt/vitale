import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { CountryStats } from '@vitale/shared';
import { fmtDuration, fmtElevation, fmtKcal, fmtKm, formatSpeed } from '../data/format';

/** Altura do Monte Everest (m) — base do "× Everest" da subida total. */
const EVEREST_M = 8849;

/**
 * Faixa de estatísticas agregadas do país (entre o mapa e as listas). Componente
 * de apresentação: recebe os agregados prontos (`countryStats`) + o nº de cidades
 * e formata com os helpers do histórico. Tiles com dado ausente mostram "—".
 *
 * Os volumes que chegam aqui já vêm rateados pelo trecho dentro do país, daí o
 * "aqui" nos rótulos de máximo: numa pedalada que cruzou a fronteira, o número é
 * o do trecho, não o da pedalada inteira (que segue cheio na lista de treinos).
 */
@Component({
  selector: 'rt-country-stats',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid">
      <div class="tile">
        <span class="value">{{ fmtKm(stats().distanceM) }} <span class="unit">km</span></span>
        <span class="label">Distância total</span>
      </div>
      <div class="tile">
        <span class="value">{{ fmtElevation(stats().elevationM) ?? '—' }}</span>
        <span class="label">Subida total</span>
        @if (everest(); as e) { <span class="caption">≈ {{ e }}× o Everest</span> }
      </div>
      <div class="tile">
        <span class="value">{{ fmtDuration(stats().movingTimeS) }}</span>
        <span class="label">Tempo pedalando</span>
        @if (days(); as d) { <span class="caption">≈ {{ d.value }} {{ d.unit }}</span> }
      </div>
      <div class="tile">
        <span class="value">{{ speed() ?? '—' }} <span class="unit">km/h</span></span>
        <span class="label">Velocidade média</span>
      </div>
      <div class="tile">
        <span class="value">{{ fmtKm(stats().longestRideM) }} <span class="unit">km</span></span>
        <span class="label">Maior trecho aqui</span>
      </div>
      <div class="tile">
        <span class="value">{{ fmtElevation(stats().maxClimbM) ?? '—' }}</span>
        <span class="label">Maior subida aqui</span>
      </div>
      <div class="tile">
        <span class="value">{{ cityCount() }}</span>
        <span class="label">Cidades</span>
      </div>
      @if (stats().calories > 0) {
        <div class="tile">
          <span class="value">{{ fmtKcal(stats().calories) }} <span class="unit">kcal</span></span>
          <span class="label">Calorias</span>
        </div>
      }
    </div>
  `,
  styles: [
    `:host { display: block; }
     .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
     .tile { display: flex; flex-direction: column; gap: 3px; padding: 14px 16px;
       background: var(--surface); border: 1px solid var(--line); border-radius: 14px; }
     .value { font-size: 22px; font-weight: 650; letter-spacing: -0.4px; color: var(--ink);
       font-variant-numeric: tabular-nums; }
     .unit { font-size: 13px; font-weight: 600; color: var(--ink-3); letter-spacing: 0; }
     .label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px;
       color: var(--ink-3); }
     .caption { font-size: 11.5px; color: var(--primary); font-weight: 600; margin-top: 1px; }`,
  ],
})
export class CountryStatsComponent {
  readonly stats = input.required<CountryStats>();
  readonly cityCount = input.required<number>();

  protected readonly fmtKm = fmtKm;
  protected readonly fmtElevation = fmtElevation;
  protected readonly fmtDuration = fmtDuration;
  protected readonly fmtKcal = fmtKcal;

  protected readonly speed = computed(() =>
    formatSpeed(this.stats().distanceM, this.stats().movingTimeS),
  );
  /** "× Everest" formatado (1 casa); null quando a subida é baixa demais p/ valer. */
  protected readonly everest = computed(() => {
    const ratio = this.stats().elevationM / EVEREST_M;
    return ratio >= 0.1 ? ratio.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : null;
  });
  /** Tempo pedalando em dias (1 casa) + rótulo singular/plural; null se < 0,1 dia. */
  protected readonly days = computed(() => {
    const d = this.stats().movingTimeS / 86400;
    if (d < 0.1) return null;
    const value = d.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
    return { value, unit: value === '1' ? 'dia' : 'dias' };
  });
}
