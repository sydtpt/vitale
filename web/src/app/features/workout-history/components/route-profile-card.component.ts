import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  elevationProfile,
  formatRate,
  speedSeries,
  type ActivityRoutePoint,
} from '@vitale/shared';

interface PanelVM {
  title: string;
  area: string;
  line: string;
  topLabel: string;
  botLabel: string;
  marker: { x: number; y: number; label: string } | null;
}

/** Geometria compartilhada pelos dois painéis — o eixo x tem de ser o mesmo. */
const W = 360;
const H = 92;
const PAD_L = 42;
const PAD_R = 10;
const PAD_T = 12;
const PAD_B = 8;
/** Teto de vértices por traçado: mil pontos num `path` não desenham mais nada. */
const MAX_VERTS = 240;

/**
 * Perfil de elevação e curva de ritmo, na seção da rota.
 *
 * **Dois gráficos empilhados, nunca um com dois eixos.** Altitude e velocidade
 * têm escalas sem relação nenhuma, e sobrepô-las num eixo duplo faz o leitor ver
 * cruzamentos que não significam nada — é o defeito que a tela de Recuperação
 * ainda tem. Empilhados, compartilham o eixo x (distância percorrida), que é o
 * que de fato liga os dois: dá para descer o dedo de um pico de subida para o
 * afundamento do ritmo embaixo dele.
 *
 * Cada painel some sozinho quando não há o que mostrar — rota plana não tem
 * perfil, rota sem horário por ponto não tem ritmo. Com os dois ausentes, o card
 * inteiro não aparece.
 */
@Component({
  selector: 'rt-route-profile-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (panels().length > 0) {
      <div class="wrap">
        @for (p of panels(); track p.title) {
          <div class="panel">
            <div class="head">
              <span class="p-title">{{ p.title }}</span>
              <span class="p-range mono">{{ p.botLabel }} → {{ p.topLabel }}</span>
            </div>
            <svg [attr.viewBox]="'0 0 ' + w + ' ' + h" class="chart" role="img"
              [attr.aria-label]="p.title">
              <path [attr.d]="p.area" [attr.fill]="color()" fill-opacity="0.14" />
              <path [attr.d]="p.line" [attr.stroke]="color()" stroke-width="2"
                fill="none" stroke-linejoin="round" stroke-linecap="round" />
              @if (p.marker; as m) {
                <circle [attr.cx]="m.x" [attr.cy]="m.y" r="3" [attr.fill]="color()"
                  stroke="var(--surface)" stroke-width="2" />
                <text class="mark mono" [attr.x]="m.x" [attr.y]="m.y - 7"
                  [attr.text-anchor]="m.x > w * 0.7 ? 'end' : 'middle'">{{ m.label }}</text>
              }
            </svg>
          </div>
        }
        <div class="axis">
          @for (t of xTicks(); track t.km) {
            <span class="x-tick mono" [style.left.%]="t.pct">{{ t.km }}</span>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    .wrap { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
    .panel { display: flex; flex-direction: column; gap: 2px; }
    .head { display: flex; align-items: baseline; gap: 8px; }
    .p-title { font-size: 11px; font-weight: 600; color: var(--ink-2); }
    .p-range { margin-left: auto; font-size: 10.5px; color: var(--ink-3); }
    .chart { width: 100%; height: 92px; display: block; }
    .mark { font-size: 9px; font-weight: 600; fill: var(--ink); }
    /* O eixo x é HTML e não SVG: ele é comum aos dois painéis, e desenhá-lo
       dentro de um deles o prenderia àquele gráfico. */
    .axis { position: relative; height: 13px; }
    .x-tick {
      position: absolute;
      transform: translateX(-50%);
      font-size: 10px;
      color: var(--ink-4);
      white-space: nowrap;
    }
  `],
})
export class RouteProfileCardComponent {
  readonly points = input.required<ActivityRoutePoint[]>();
  readonly activityId = input.required<number>();
  readonly color = input('var(--primary)');

  protected readonly w = W;
  protected readonly h = H;

  private readonly profile = computed(() => elevationProfile(this.points()));
  private readonly speed = computed(() => speedSeries(this.points()));

  /** O maior x dos dois painéis — o eixo é compartilhado, a escala também. */
  private readonly xMax = computed(() => {
    const e = this.profile();
    const s = this.speed();
    return Math.max(e ? e.xs[e.xs.length - 1] : 0, s ? s.xs[s.xs.length - 1] : 0, 1);
  });

  protected readonly elev = computed<PanelVM | null>(() => {
    const p = this.profile();
    if (!p) return null;
    const g = geometry(p.xs, p.ys, this.xMax(), p.minAlt, p.maxAlt);
    return {
      title: 'Elevação',
      ...g,
      topLabel: `${Math.round(p.maxAlt)} m`,
      botLabel: `${Math.round(p.minAlt)} m`,
      marker: {
        x: xAt(p.xs[p.peakIdx], this.xMax()),
        y: yAt(p.ys[p.peakIdx], p.minAlt, p.maxAlt),
        label: `${Math.round(p.maxAlt)} m`,
      },
    };
  });

  protected readonly pace = computed<PanelVM | null>(() => {
    const s = this.speed();
    if (!s) return null;
    const lo = Math.min(...s.mps);
    const hi = Math.max(...s.mps);
    const g = geometry(s.xs, s.mps, this.xMax(), lo, hi);
    return {
      title: this.activityId() === 13 ? 'Velocidade' : 'Ritmo',
      ...g,
      // O eixo é velocidade (mais alto = mais rápido, sem inverter nada), mas
      // rotulado na unidade do esporte: corrida lê min/km, bicicleta lê km/h.
      topLabel: this.rateLabel(hi),
      botLabel: this.rateLabel(lo),
      marker: null,
    };
  });

  protected readonly panels = computed(() =>
    [this.elev(), this.pace()].filter((p): p is PanelVM => p !== null),
  );

  protected readonly xTicks = computed(() => {
    const total = this.xMax() / 1000;
    return [0, 0.5, 1].map((f) => ({
      km: `${(total * f).toFixed(1).replace('.', ',')} km`,
      // O traçado ocupa a faixa entre os paddings; o rótulo segue essa faixa.
      pct: ((PAD_L + f * (W - PAD_L - PAD_R)) / W) * 100,
    }));
  });

  private rateLabel(mps: number): string {
    if (mps <= 0) return '—';
    const r = formatRate(this.activityId(), 1000, 1000 / mps);
    return r ? `${r.value} ${r.caption === 'pace' ? 'min/km' : r.caption}` : '—';
  }
}

function xAt(x: number, xMax: number): number {
  return PAD_L + (x / xMax) * (W - PAD_L - PAD_R);
}

function yAt(v: number, lo: number, hi: number): number {
  const span = hi - lo || 1;
  return PAD_T + (1 - (v - lo) / span) * (H - PAD_T - PAD_B);
}

/**
 * Traçado e área de uma série.
 *
 * Reamostra por índice até `MAX_VERTS`: uma rota longa chega com milhares de
 * pontos e, num SVG de 360 unidades de largura, tudo acima de uns poucos
 * centenas cai no mesmo pixel — custa render e não desenha nada a mais. O último
 * ponto entra sempre, senão o traçado termina antes da linha de chegada.
 */
function geometry(
  xs: number[],
  ys: number[],
  xMax: number,
  lo: number,
  hi: number,
): { area: string; line: string } {
  const step = Math.max(1, Math.ceil(xs.length / MAX_VERTS));
  const idx: number[] = [];
  for (let i = 0; i < xs.length; i += step) idx.push(i);
  if (idx[idx.length - 1] !== xs.length - 1) idx.push(xs.length - 1);

  const pts = idx.map((i) => `${xAt(xs[i], xMax).toFixed(1)},${yAt(ys[i], lo, hi).toFixed(1)}`);
  const line = `M${pts.join(' L')}`;
  const base = (H - PAD_B).toFixed(1);
  const first = xAt(xs[idx[0]], xMax).toFixed(1);
  const last = xAt(xs[idx[idx.length - 1]], xMax).toFixed(1);
  return { line, area: `${line} L${last},${base} L${first},${base} Z` };
}
