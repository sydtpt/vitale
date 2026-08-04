import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import type { Metric, OverviewBucket } from '../data/overview';
import { ChartPaletteService } from '@core/services/chart-palette.service';

interface Seg {
  x: number; y: number; w: number; h: number;
  color: string; fill: string; label: string; value: number; opacity: number;
  top: boolean; d: string;
}
interface Bar {
  key: string; label: string; cx: number; segs: Seg[]; topY: number; total: number; faded: boolean;
  /** Y do ponto de esforço ponderado; `null` = bucket sem ponto (comparação / série desligada). */
  effY: number | null;
  /** Valor do esforço em segundos, para o tooltip. */
  effS: number;
  /** Limites do slot do bucket — usados para o degrau da meta no bucket em curso. */
  x0: number;
  slotW: number;
}
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

  protected readonly w = 600;
  protected readonly h = 240;
  protected readonly padL = 40;
  protected readonly padR = 14;
  protected readonly padT = 18;
  protected readonly padB = 28;

  // O eixo precisa absorver a meta e a série de esforço: uma meta acima da barra
  // mais alta seria cortada silenciosamente fora do plot.
  private readonly max = computed(() => {
    const eff = this.showEffort();
    return Math.max(
      1,
      this.goal() ?? 0,
      this.effortFlat() ?? 0,
      ...this.buckets().map((b) => Math.max(b.total, eff ? b.effectiveS ?? 0 : 0)),
    );
  });

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
    // O ponto de esforço anima junto com as barras; um bucket novo cresce da base.
    const effY = to.effY === null ? null : (from?.effY ?? baseY) + (to.effY - (from?.effY ?? baseY)) * e;

    return {
      key: to.key, label: to.label, cx: barX + barW / 2, segs, topY: baseY - acc,
      total: to.total, faded: to.faded, effY, effS: to.effS, x0: to.x0, slotW: to.slotW,
    };
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
      // Barras de comparação ficam fora da série de esforço (não são cronológicas).
      const effS = b.effectiveS ?? 0;
      const effY = this.showEffort() && !b.comparison && b.effectiveS !== undefined
        ? this.h - this.padB - (effS / max) * plotH
        : null;
      return {
        key: b.key, label: b.label, cx: x + barW / 2, segs, topY,
        total: b.total, faded: !!b.comparison, effY, effS, x0, slotW: slot,
      };
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

  /**
   * Linha da meta. Reta quando o período está todo fechado; com um degrau sobre o
   * bucket em curso quando `currentGoal` chega (mês/semana/ano corrente prorrateado).
   * Emitida como `path` com saltos (`M`) em vez de conectores verticais — o degrau
   * fica legível sem poluir com traços tracejados na vertical.
   */
  protected readonly goalLine = computed<{ d: string; y: number; label: string } | null>(() => {
    const goal = this.goal();
    if (!goal || goal <= 0) return null;
    const plotH = this.h - this.padT - this.padB;
    const max = this.max();
    const yOf = (v: number) => this.h - this.padB - (v / max) * plotH;
    const yFull = yOf(goal);
    const left = this.padL;
    const right = this.w - this.padR;
    const label = `${this.goalLabel()} · ${this.fmtCompact(goal)}${this.goalUnit()}`;

    const cur = this.currentGoal();
    // O bucket em curso é o último NÃO-comparação (em "12 meses" a barra de
    // comparação vem depois dele, fora da ordem cronológica).
    const bars = this.bars();
    let idx = -1;
    for (let i = bars.length - 1; i >= 0; i--) if (!bars[i].faded) { idx = i; break; }

    if (cur === undefined || cur >= goal || idx < 0) {
      return { d: `M ${left} ${yFull} L ${right} ${yFull}`, y: yFull, label };
    }

    const b = bars[idx];
    const stepStart = Math.max(left, b.x0);
    const stepEnd = Math.min(right, b.x0 + b.slotW);
    const yCur = yOf(cur);
    const parts = [`M ${left} ${yFull} L ${stepStart} ${yFull}`, `M ${stepStart} ${yCur} L ${stepEnd} ${yCur}`];
    // Barras depois do bucket em curso (comparação) voltam à meta cheia.
    if (stepEnd < right) parts.push(`M ${stepEnd} ${yFull} L ${right} ${yFull}`);
    return { d: parts.join(' '), y: yFull, label };
  });


  /** Reta horizontal do esforço médio (período "Semana"). */
  protected readonly effortLine = computed<{ y: number; label: string } | null>(() => {
    const v = this.effortFlat();
    if (v === undefined || v <= 0) return null;
    const plotH = this.h - this.padT - this.padB;
    return {
      y: this.h - this.padB - (v / this.max()) * plotH,
      label: `${this.effortFlatLabel()} · ${this.fmtCompact(v)}`,
    };
  });

  /** Polilinha do esforço ponderado. Quebra (novo `M`) nos buckets sem ponto. */
  protected readonly effortPath = computed<string>(() => {
    const parts: string[] = [];
    let open = false;
    for (const b of this.displayBars()) {
      if (b.effY === null) { open = false; continue; }
      parts.push(`${open ? 'L' : 'M'} ${b.cx} ${b.effY}`);
      open = true;
    }
    return parts.join(' ');
  });

  protected readonly effortPoints = computed(() =>
    this.displayBars()
      .filter((b) => b.effY !== null)
      .map((b) => ({ key: b.key, cx: b.cx, cy: b.effY as number, value: b.effS })),
  );

  /**
   * Rótulo de valores pequenos: o `fmt()` de duração sempre imprime horas, e a meta
   * diária (~21 min) viraria "0,4h". Abaixo de 1h usa minutos.
   */
  protected fmtCompact(v: number): string {
    if (this.metric() !== 'duration' || v >= 3600) return this.fmt(v);
    return `${this.num(v / 60, 0)} min`;
  }

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
