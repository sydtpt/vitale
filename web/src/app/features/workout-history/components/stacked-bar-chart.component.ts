import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import {
  buildStackedBars,
  easeOutCubic,
  formatAxisLabel,
  formatCompactLabel,
  formatMetricShort,
  interpolateStackedBars,
  isHexColor,
  smoothLinePath,
  stackedGradientId,
  stackedGradientStops,
  type LinePoint,
  type StackedBar,
  type StackedBarsGeometry,
} from '@vitale/shared';
import type { Metric, OverviewBucket } from '../data/overview';
import { ChartPaletteService } from '@core/services/chart-palette.service';
import { ThemeService } from '@core/theme/theme.service';

const ANIM_MS = 360;
/** Cor de uma série que já sumiu do alvo e ainda está encolhendo. */
const FADING_COLOR = 'var(--ink-3)';

/**
 * A geometria desta tela. O modelo é o do núcleo; o que fica aqui são as medidas
 * — o `viewBox` fixo de 600×240 e `minSlot: 0`, que é o que diz "nunca rola: os
 * slots encolhem até caber", ao contrário do mobile.
 */
const GEOMETRY: StackedBarsGeometry = {
  width: 600,
  height: 240,
  padTop: 18,
  padRight: 14,
  padBottom: 28,
  padLeft: 40,
  minSlot: 0,
  topRadius: 6,
  maxBarWidth: { normal: 42, emphasis: 56, comparison: 30 },
};

/**
 * Barras empilhadas por tipo de atividade.
 *
 * A geometria é a do núcleo (`buildStackedBars`), a mesma que o mobile desenha;
 * o que fica aqui é o SVG do Angular e a animação. O tooltip da web é um
 * `<title>` por segmento — no desktop o navegador já o entrega de graça.
 */
@Component({
  selector: 'rt-stacked-bar-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './stacked-bar-chart.component.html',
  styleUrl: './stacked-bar-chart.component.scss',
})
export class StackedBarChartComponent {
  readonly buckets = input.required<OverviewBucket[]>();
  readonly metric = input.required<Metric>();
  /** Meta de referência (mesma unidade das barras); `undefined` = sem linha. */
  readonly goal = input<number | undefined>(undefined);
  /** Rótulo da linha de meta (ex.: "OMS"). */
  readonly goalLabel = input('Meta');
  /** Sufixo de unidade do rótulo ("/mês"): sem ele "14h" é lido como total do período. */
  readonly goalUnit = input('');
  /**
   * Meta do bucket em curso, proporcional ao tempo decorrido. Quando presente, a
   * linha da meta desce em degrau sobre esse bucket — comparar um mês pela metade
   * com a meta cheia faria a última barra parecer sempre um fracasso.
   */
  readonly currentGoal = input<number | undefined>(undefined);
  /** Desenha a polilinha de esforço ponderado a partir de `bucket.effectiveS`. */
  readonly showEffort = input(false);
  /**
   * Reta horizontal com o esforço médio por bucket. Combina com `showEffort`: a
   * polilinha mostra a variação, a reta mostra o patamar médio para comparar direto
   * com a meta. No período "Semana" aparece sozinha (lá não há progressão).
   */
  readonly effortFlat = input<number | undefined>(undefined);
  /** Rótulo da reta de média. */
  readonly effortFlatLabel = input('Média');
  /** Cor da reta de média (esquema configurável em Preferências). */
  readonly effortFlatColor = input('var(--ink-2)');
  /** Cor da polilinha de progressão. */
  readonly effortColor = input('var(--ink-2)');

  private readonly palette = inject(ChartPaletteService);
  private readonly theme = inject(ThemeService);

  protected readonly w = GEOMETRY.width;
  protected readonly h = GEOMETRY.height;
  protected readonly padL = GEOMETRY.padLeft;
  protected readonly padR = GEOMETRY.padRight;
  protected readonly padT = GEOMETRY.padTop;
  protected readonly padB = GEOMETRY.padBottom;

  private readonly model = computed(() =>
    buildStackedBars({
      buckets: this.buckets(),
      metric: this.metric(),
      geometry: GEOMETRY,
      goal: this.goal(),
      currentGoal: this.currentGoal(),
      showEffort: this.showEffort(),
      effortFlat: this.effortFlat(),
      colorOf: (c) => this.palette.remap(c), // reativo à paleta ativa
    }),
  );

  // `model().bars` = estado-alvo. `display()` = o que é renderizado, interpolado
  // quadro-a-quadro (troca de período, de métrica ou remoção de série na legenda).
  private readonly display = signal<StackedBar[]>([]);
  protected readonly displayBars = this.display.asReadonly();
  private current: StackedBar[] = [];
  private raf = 0;
  private readonly reduceMotion =
    typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  constructor() {
    // Dispara o tween sempre que o alvo muda. O `.set` acontece fora da execução
    // reativa (via microtask/rAF) para não escrever signal dentro do effect.
    effect(() => {
      const target = this.model().bars;
      queueMicrotask(() => this.animateTo(target));
    });
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(this.raf));
  }

  private setDisplay(bars: StackedBar[]): void {
    this.current = bars;
    this.display.set(bars);
  }

  private animateTo(target: StackedBar[]): void {
    cancelAnimationFrame(this.raf);
    if (this.reduceMotion || typeof requestAnimationFrame === 'undefined') {
      this.setDisplay(target);
      return;
    }
    // Congelado antes do laço: interpolar a partir do quadro anterior achataria
    // a curva do easing — cada quadro andaria uma fração do que resta.
    const from = this.current;
    const baseY = this.model().baseY;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ANIM_MS);
      if (t >= 1) {
        this.setDisplay(target); // assenta exatamente no alvo
        return;
      }
      const e = easeOutCubic(t);
      this.setDisplay(
        interpolateStackedBars(from, target, e, baseY, GEOMETRY.topRadius, FADING_COLOR),
      );
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  /** Cores distintas atualmente renderizadas (inclui séries que estão encolhendo). */
  protected readonly gradColors = computed<string[]>(() => {
    const set = new Set<string>();
    for (const b of this.display()) for (const s of b.segs) if (isHexColor(s.color)) set.add(s.color);
    return [...set];
  });

  protected gradId(color: string): string {
    return stackedGradientId(color);
  }
  protected topStop(color: string): string {
    return stackedGradientStops(color, this.theme.tokens().surface).top;
  }
  protected baseStop(color: string): string {
    return stackedGradientStops(color, this.theme.tokens().surface).base;
  }
  protected fillOf(color: string): string {
    return isHexColor(color) ? `url(#${stackedGradientId(color)})` : color;
  }

  protected readonly grid = computed(() =>
    this.model().grid.map((g) => ({
      y: g.y,
      base: g.base,
      label: formatAxisLabel(g.value, this.metric()),
    })),
  );

  protected readonly goalLine = computed<{ d: string; y: number; label: string } | null>(() => {
    const m = this.model();
    if (m.goalPath === '' || m.goalY === null) return null;
    return {
      d: m.goalPath,
      y: m.goalY,
      label: `${this.goalLabel()} · ${this.fmtCompact(this.goal() ?? 0)}${this.goalUnit()}`,
    };
  });

  /** Reta horizontal do esforço médio (período "Semana"). */
  protected readonly effortLine = computed<{ y: number; label: string } | null>(() => {
    const y = this.model().effortFlatY;
    if (y === null) return null;
    return { y, label: `${this.effortFlatLabel()} · ${this.fmtCompact(this.effortFlat() ?? 0)}` };
  });

  /**
   * Curva do esforço ponderado. Cúbica monotônica: suaviza os cantos sem inventar
   * picos entre os buckets. Quebra (`null`) nos buckets sem ponto.
   */
  protected readonly effortPath = computed<string>(() =>
    smoothLinePath(
      this.displayBars().map<LinePoint | null>((b) => (b.effY === null ? null : { x: b.cx, y: b.effY })),
    ),
  );

  protected readonly effortPoints = computed(() =>
    this.displayBars()
      .filter((b) => b.effY !== null)
      .map((b) => ({ key: b.key, cx: b.cx, cy: b.effY as number, value: b.effS })),
  );

  protected fmtCompact(v: number): string {
    return formatCompactLabel(v, this.metric());
  }

  /** Rótulo do eixo e do topo da barra. */
  protected fmtShort(v: number): string {
    return formatAxisLabel(v, this.metric());
  }

  /** Valor de um segmento no `<title>` — a forma curta cabe melhor num tooltip nativo. */
  protected fmt(v: number): string {
    return formatMetricShort(v, this.metric());
  }
}
