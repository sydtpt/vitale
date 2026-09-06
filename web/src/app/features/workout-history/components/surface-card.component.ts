import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import {
  SURFACE_RANGES,
  gearForActivity,
  gearUsage,
  summarizeSurface,
  surfaceLegend,
  surfaceRamp,
  surfaceShares,
  surfaceWindow,
  type Activity,
  type Gear,
  type SurfaceMix,
  type SurfaceRange,
} from '@vitale/shared';
import { ThemeService } from '@core/theme/theme.service';

/**
 * O piso das rotas na web — a mesma leitura do celular, recomposta.
 *
 * A web recompõe, não redesenha: as classes, a ordem da escada, a legenda e a
 * regra de "não especificado" visível vêm todas do núcleo (ADR 0034). O que
 * muda aqui é o meio — SVG e CSS em vez de View — e o fato de caber mais de um
 * seletor lado a lado sem apertar.
 *
 * Dois modos: com `activities`, soma um período e oferece a lente de bicicleta;
 * com `mix`, mostra uma pedalada só e some com os seletores.
 */
@Component({
  selector: 'rt-surface-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (summary(); as s) {
      <section class="card">
        <header class="head">
          <h2 class="title">Piso</h2>
          @if (!single()) {
            <div class="controls">
              @if (bikes().length > 1) {
                <div class="seg">
                  <button type="button" class="opt" [class.active]="gearId() === 'all'"
                    (click)="gearId.set('all')">Todas</button>
                  @for (b of bikes(); track b.gear.id) {
                    <button type="button" class="opt" [class.active]="gearId() === b.gear.id"
                      (click)="gearId.set(b.gear.id)">{{ b.gear.name }}</button>
                  }
                </div>
              }
              <div class="seg">
                @for (r of ranges; track r.id) {
                  <button type="button" class="opt" [class.active]="range() === r.id"
                    (click)="range.set(r.id)">{{ r.label }}</button>
                }
              </div>
            </div>
          }
        </header>

        <div class="hero">
          <span class="big mono">{{ pct(s.paved) }}</span>
          <span class="cap">pavimentado · {{ pct(s.offroad) }} fora do asfalto</span>
        </div>

        <div class="bar" role="img" [attr.aria-label]="'Distribuição do piso: ' + ariaLabel()">
          @for (row of rows(); track row.key) {
            @if (row.share > 0) {
              <span class="seg-fill" [style.flex]="row.share" [style.background]="color(row.key)"
                [title]="row.label + ' · ' + km(row.meters) + ' km · ' + pct(row.share)"></span>
            }
          }
        </div>

        <dl class="legend">
          @for (row of rows(); track row.key) {
            <div class="row">
              <dt><i class="swatch" [style.background]="color(row.key)"></i>{{ row.label }}</dt>
              <dd class="mono">{{ km(row.meters) }} km<span class="share">{{ pct(row.share) }}</span></dd>
            </div>
          }
        </dl>

        <p class="caption">{{ caption() }}</p>
      </section>
    }
  `,
  styles: [`
    .card { background: var(--surface); border: 1px solid var(--line); border-radius: 18px; padding: 20px; display: grid; gap: 12px; }
    .head { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
    .title { margin: 0; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3); }
    .controls { margin-left: auto; display: flex; gap: 8px; flex-wrap: wrap; }
    .seg { display: inline-flex; gap: 2px; padding: 3px; background: var(--surface-mute); border-radius: 11px; border: 1px solid var(--line); }
    .opt { border: none; background: transparent; color: var(--ink-2); font-size: 12px; font-weight: 600; padding: 5px 12px; border-radius: 8px; cursor: pointer; }
    .opt.active { background: var(--surface); color: var(--ink); box-shadow: 0 1px 2px rgb(0 0 0 / 8%); }
    .opt:focus-visible { outline: 2px solid var(--primary); outline-offset: 1px; }
    .hero { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
    .big { font-size: 40px; font-weight: 600; color: var(--ink); line-height: 1; letter-spacing: -.02em; }
    .cap { font-size: 14px; color: var(--ink-2); }
    .bar { display: flex; gap: 2px; height: 16px; border-radius: 5px; overflow: hidden; background: var(--surface-mute); }
    .seg-fill { display: block; height: 100%; }
    .legend { margin: 0; display: grid; gap: 7px; }
    .row { display: flex; align-items: center; gap: 10px; }
    dt { display: flex; align-items: center; gap: 9px; font-size: 13.5px; color: var(--ink-2); margin: 0; }
    dd { margin: 0 0 0 auto; font-size: 13.5px; color: var(--ink); font-variant-numeric: tabular-nums; }
    .share { display: inline-block; min-width: 48px; text-align: right; color: var(--ink-3); }
    .swatch { width: 12px; height: 12px; border-radius: 3px; display: block; }
    .caption { margin: 0; font-size: 11.5px; color: var(--ink-3); }
    .mono { font-family: var(--font-mono); }
  `],
})
export class SurfaceCardComponent {
  private readonly theme = inject(ThemeService);

  /** Modo período: as atividades já recortadas por tipo. */
  readonly activities = input<Activity[]>([]);
  readonly gears = input<Gear[]>([]);
  /** Modo pedalada: o piso de uma rota só. Quando presente, manda. */
  readonly mix = input<SurfaceMix | undefined>(undefined);

  protected readonly ranges = SURFACE_RANGES;
  protected readonly range = signal<SurfaceRange>('tudo');
  protected readonly gearId = signal<string>('all');

  protected readonly single = computed(() => !!this.mix());

  /** Só as bicicletas que este tipo de fato usou. */
  protected readonly bikes = computed(() =>
    gearUsage(this.gears(), this.activities()).filter((u) => u.count > 0),
  );

  private readonly scoped = computed(() => {
    const id = this.gearId();
    const all = this.activities();
    if (id === 'all') return all;
    const gears = this.gears();
    return all.filter((a) => gearForActivity(gears, a)?.id === id);
  });

  protected readonly summary = computed(() => {
    const one = this.mix();
    if (one) {
      if (one.total <= 0) return null;
      const sh = surfaceShares(one);
      return {
        mix: one,
        paved: sh.liso + sh.blocos + sh.pave,
        offroad: sh.cascalho + sh.terra,
        count: 1,
        withSurface: 1,
      };
    }
    const s = summarizeSurface(this.scoped(), surfaceWindow(this.range()));
    return s.mix.total > 0 ? { mix: s.mix, paved: s.pavedShare, offroad: s.offroadShare, count: s.count, withSurface: s.withSurface } : null;
  });

  protected readonly rows = computed(() => surfaceLegend(this.summary()?.mix ?? emptyMix()));

  /** A rampa ordinal do módulo de treino, resolvida no tema ativo (ADR 0034). */
  private readonly ramp = computed(() => {
    const t = this.theme.tokens();
    return surfaceRamp(this.theme.scheme(), t.roles.orange.accent, t.surface, t.ink, t.ink4);
  });

  protected color(key: 'liso' | 'blocos' | 'cascalho' | 'terra' | 'desconhecido'): string {
    return this.ramp()[key];
  }

  protected readonly caption = computed(() => {
    const s = this.summary();
    if (!s) return '';
    const inf = s.mix.total > 0 ? Math.round((s.mix.inferido / s.mix.total) * 100) : 0;
    const infTxt = inf > 0 ? ` · ${inf}% inferido pelo tipo de via` : '';
    if (this.single()) return `Medido contra o OpenStreetMap${infTxt}`;
    const w = surfaceWindow(this.range()).label;
    const cover = s.withSurface === s.count
      ? `${s.count} ${s.count === 1 ? 'pedalada' : 'pedaladas'}`
      : `${s.withSurface} de ${s.count} pedaladas com piso`;
    return `${w} · ${cover}${infTxt}`;
  });

  protected readonly ariaLabel = computed(() =>
    this.rows().filter((r) => r.share > 0).map((r) => `${r.label} ${this.pct(r.share)}`).join(', '),
  );

  protected pct(v: number): string {
    return `${Math.round(v * 100)}%`;
  }

  protected km(meters: number): string {
    const v = meters / 1000;
    return v.toLocaleString('pt-BR', { maximumFractionDigits: v >= 100 ? 0 : 1 });
  }
}

function emptyMix(): SurfaceMix {
  return { liso: 0, blocos: 0, pave: 0, cascalho: 0, terra: 0, desconhecido: 0, inferido: 0, total: 0 };
}
