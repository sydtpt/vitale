import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import type { Metric, OverviewBucket } from '../data/overview';
import { ChartPaletteService } from '@core/services/chart-palette.service';

interface Seg {
  x: number; y: number; w: number; h: number;
  color: string; fill: string; label: string; value: number; opacity: number;
  top: boolean; d: string;
}
interface Bar { key: string; label: string; cx: number; segs: Seg[]; topY: number; total: number; faded: boolean; }
interface GridLine { y: number; label: string; }

// Tom quente para suavizar/clarear as cores das séries (casa com a paleta bege/creme).
const WARM = '#FBF1E2';
const TOP_RADIUS = 6;
const ANIM_MS = 360;

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
function isHex(c: string): boolean { return HEX_RE.test(c); }
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(r: number, g: number, b: number): string {
  const to = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}
function mix(hex: string, withHex: string, amount: number): string {
  const [r1, g1, b1] = hexToRgb(hex);
  const [r2, g2, b2] = hexToRgb(withHex);
  return rgbToHex(r1 + (r2 - r1) * amount, g1 + (g2 - g1) * amount, b1 + (b2 - b1) * amount);
}
function easeOutCubic(t: number): number { return 1 - Math.pow(1 - t, 3); }

/** Retângulo com cantos superiores arredondados e base reta. */
function topRoundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.max(0, Math.min(r, w / 2, h));
  return [
    `M ${x} ${y + h}`,
    `L ${x} ${y + rr}`,
    `Q ${x} ${y} ${x + rr} ${y}`,
    `L ${x + w - rr} ${y}`,
    `Q ${x + w} ${y} ${x + w} ${y + rr}`,
    `L ${x + w} ${y + h}`,
    'Z',
  ].join(' ');
}

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
  private readonly palette = inject(ChartPaletteService);

  protected readonly w = 600;
  protected readonly h = 240;
  protected readonly padL = 40;
  protected readonly padR = 14;
  protected readonly padT = 18;
  protected readonly padB = 28;

  private readonly max = computed(() => Math.max(1, ...this.buckets().map((b) => b.total)));

  // `bars()` = estado-alvo (geometria final). `display()` = o que é renderizado,
  // interpolado quadro-a-quadro do estado atual até o alvo (troca de período,
  // métrica ou remoção de série na legenda).
  private readonly display = signal<Bar[]>([]);
  protected readonly displayBars = this.display.asReadonly();
  private current: Bar[] = [];
  private raf = 0;
  private readonly reduceMotion =
    typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  constructor() {
    // Dispara o tween sempre que o alvo muda. O `.set` acontece fora da execução
    // reativa (via microtask/rAF) para não escrever signal dentro do effect.
    effect(() => {
      const target = this.bars();
      queueMicrotask(() => this.animateTo(target));
    });
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(this.raf));
  }

  private setDisplay(bars: Bar[]): void {
    this.current = bars;
    this.display.set(bars);
  }

  private animateTo(target: Bar[]): void {
    cancelAnimationFrame(this.raf);
    if (this.reduceMotion || typeof requestAnimationFrame === 'undefined') {
      this.setDisplay(target);
      return;
    }
    const fromByKey = new Map(this.current.map((b) => [b.key, b]));
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ANIM_MS);
      if (t >= 1) {
        this.setDisplay(target); // assenta exatamente no alvo (ordem/arredondado corretos)
        return;
      }
      const e = easeOutCubic(t);
      this.setDisplay(target.map((tb) => this.interpBar(fromByKey.get(tb.key), tb, e)));
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  /** Interpola um bar entre o estado anterior (mesma key) e o alvo.
   * Séries removidas encolhem a 0; novas crescem de 0; a pilha é re-empilhada por quadro. */
  private interpBar(from: Bar | undefined, to: Bar, e: number): Bar {
    const fromSegs = from?.segs ?? [];
    const fromByLabel = new Map(fromSegs.map((s) => [s.label, s]));
    const toByLabel = new Map(to.segs.map((s) => [s.label, s]));
    // Ordem = a do alvo; séries removidas voltam à sua posição anterior (encolhem no lugar).
    const order: string[] = to.segs.map((s) => s.label);
    fromSegs.forEach((s, idx) => {
      if (!toByLabel.has(s.label)) order.splice(Math.min(idx, order.length), 0, s.label);
    });

    const barW = to.segs[0]?.w ?? fromSegs[0]?.w ?? 0;
    const barX = to.segs[0]?.x ?? fromSegs[0]?.x ?? 0;
    const baseY = this.h - this.padB;

    const rows = order.map((label) => {
      const fs = fromByLabel.get(label);
      const ts = toByLabel.get(label);
      const fromH = fs?.h ?? 0;
      const toH = ts?.h ?? 0;
      return {
        label,
        h: fromH + (toH - fromH) * e,
        color: ts?.color ?? fs?.color ?? 'var(--ink-3)',
        value: ts?.value ?? 0,
      };
    });

    let topIdx = -1;
    for (let i = rows.length - 1; i >= 0; i--) if (rows[i].h > 0.5) { topIdx = i; break; }

    let acc = 0;
    const opacity = to.faded ? 0.4 : 1;
    const segs: Seg[] = rows.map((r, i) => {
      acc += r.h;
      const y = baseY - acc;
      const top = i === topIdx;
      const rr = Math.min(TOP_RADIUS, barW / 2, r.h);
      return {
        x: barX, y, w: barW, h: r.h, color: r.color, fill: this.fillFor(r.color),
        label: r.label, value: r.value, opacity,
        top, d: top ? topRoundedRectPath(barX, y, barW, r.h, rr) : '',
      };
    });
    return { key: to.key, label: to.label, cx: barX + barW / 2, segs, topY: baseY - acc, total: to.total, faded: to.faded };
  }

  /** Cores distintas atualmente renderizadas (inclui séries que estão encolhendo). */
  protected readonly gradColors = computed<string[]>(() => {
    const set = new Set<string>();
    for (const b of this.display()) for (const s of b.segs) if (isHex(s.color)) set.add(s.color);
    return [...set];
  });

  protected gradId(color: string): string { return `sbc-grad-${color.replace('#', '')}`; }
  protected topStop(color: string): string { return mix(color, WARM, 0.32); }
  protected baseStop(color: string): string { return mix(color, WARM, 0.08); }
  private fillFor(color: string): string {
    return isHex(color) ? `url(#${this.gradId(color)})` : color;
  }

  /** Peso de largura: mês atual (destaque) ganha mais espaço; comparação, menos. */
  private weightOf(b: OverviewBucket): number {
    if (b.emphasis) return 1.5;
    if (b.comparison) return 0.72;
    return 1;
  }

  /** Largura máxima da barra por bucket, acompanhando o peso do slot. */
  private maxBarWidthOf(b: OverviewBucket): number {
    if (b.emphasis) return 56;
    if (b.comparison) return 30;
    return 42;
  }

  private readonly bars = computed<Bar[]>(() => {
    const bs = this.buckets();
    const max = this.max();
    const plotH = this.h - this.padT - this.padB;
    const plotW = this.w - this.padL - this.padR;

    // Slots com largura proporcional ao peso do bucket (destaque/comparação).
    const weights = bs.map((b) => this.weightOf(b));
    const totalW = weights.reduce((s, x) => s + x, 0) || 1;
    const unit = plotW / totalW;

    let cursor = this.padL;
    return bs.map((b, i) => {
      const slot = unit * weights[i];
      const x0 = cursor;
      cursor += slot;
      const barW = Math.min(slot * 0.62, this.maxBarWidthOf(b));
      const x = x0 + (slot - barW) / 2;
      const opacity = b.comparison ? 0.4 : 1;
      const topIdx = b.segments.length - 1;
      let acc = 0;
      const segs: Seg[] = b.segments.map((s, si) => {
        const segH = (s.value / max) * plotH;
        acc += segH;
        const y = this.h - this.padB - acc;
        const top = si === topIdx;
        const r = Math.min(TOP_RADIUS, barW / 2, segH);
        const color = this.palette.remap(s.color); // reativo à paleta ativa
        return {
          x, y, w: barW, h: segH, color, fill: this.fillFor(color), label: s.label,
          value: s.value, opacity, top, d: top ? topRoundedRectPath(x, y, barW, segH, r) : '',
        };
      });
      const topY = this.h - this.padB - acc;
      return { key: b.key, label: b.label, cx: x + barW / 2, segs, topY, total: b.total, faded: !!b.comparison };
    });
  });

  protected readonly grid = computed<GridLine[]>(() => {
    const max = this.max();
    const plotH = this.h - this.padT - this.padB;
    return [0, 0.5, 1].map((f) => ({
      y: this.h - this.padB - f * plotH,
      label: this.fmt(max * f),
    }));
  });

  protected fmt(v: number): string {
    switch (this.metric()) {
      case 'distance': return `${this.num(v / 1000, v >= 10000 ? 0 : 1)}km`;
      case 'duration': return `${this.num(v / 3600, v >= 36000 ? 0 : 1)}h`;
      case 'calories': return this.num(Math.round(v), 0);
      case 'count': return this.num(Math.round(v), 0);
    }
  }

  /** Formata com máscara de milhar (pt-BR) e nº fixo de casas decimais. */
  private num(v: number, digits: number): string {
    return v.toLocaleString('pt-BR', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  }
}
