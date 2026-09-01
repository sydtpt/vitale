import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  METRIC_ROLE,
  elevationProfile,
  formatRate,
  indexAtDistance,
  speedSeries,
  type ActivityRoutePoint,
} from '@vitale/shared';
import { ThemeService } from '@core/theme/theme.service';

interface PanelVM {
  title: string;
  color: string;
  area: string;
  line: string;
  topLabel: string;
  botLabel: string;
  marker: { x: number; y: number; label: string } | null;
  /** Distâncias acumuladas da série — a régua para achar o ponto sob o cursor. */
  xs: number[];
  /** Valores da série, no mesmo índice de `xs`. */
  ys: number[];
  /** Extremos da escala vertical, para recalcular o y do cursor. */
  lo: number;
  hi: number;
  /** Como escrever o valor sob o cursor (com unidade). */
  fmt: (v: number) => string;
}

/**
 * Geometria compartilhada pelos dois painéis — o eixo x tem de ser o mesmo.
 *
 * A **largura é medida**, não constante: o `viewBox` acompanha a largura real em
 * pixels do card, então a escala fica 1:1 e o traçado ocupa tudo. Antes o
 * `viewBox` era fixo em 360 e o `preserveAspectRatio` padrão encolhia o desenho
 * para caber na altura, deixando-o com 360 px no meio de um card de mil e tantos
 * — o gráfico ficava numa ilha, com margens vazias dos dois lados.
 *
 * `preserveAspectRatio="none"` resolveria a largura e estragaria o resto:
 * esticaria o rótulo do pico na horizontal e afinaria o traço. Medir custa um
 * `ResizeObserver` e mantém tudo redondo.
 */
const H = 100;
/** Largura de partida, até o `ResizeObserver` medir a real. */
const W0 = 360;
/**
 * O respiro de cima é maior que os outros porque **o rótulo do pico mora nele**.
 * O pico é o máximo da série por definição, então o marcador cai sempre exatamente
 * em `PAD_T`, e o rótulo, uma linha acima: com 12 o topo dos algarismos saía do
 * `viewBox` e o número aparecia cortado. Precisa de `LABEL_DY` mais o ascendente
 * da fonte (~7 em 9px); 20 dá folga sem encostar.
 *
 * O `H` cresceu junto para a área de traçado continuar com os mesmos 72 — reduzir
 * o desenho para caber o rótulo achataria o relevo, que é o dado.
 */
const PAD_T = 20;
const PAD_B = 8;
/** Distância do rótulo ao centro do marcador. */
const LABEL_DY = 8;
/**
 * Margem em que o rótulo deixa de ser centrado no marcador e passa a ancorar
 * pela borda. Um pico no começo ou no fim do percurso é comum — a primeira
 * subida, a última rampa — e centrado ali o texto vazaria para fora do `viewBox`
 * pelos lados, que é o mesmo defeito do corte de cima, só na horizontal.
 */
const LABEL_EDGE = 18;
/**
 * Teto de vértices por traçado: **um por pixel de largura**.
 *
 * Era 240 fixo, calibrado para o `viewBox` de 360. Com o gráfico ocupando a
 * largura real do card, 240 vértices espalhados em mil e tantos pixels dariam um
 * segmento reto a cada cinco — a curva sairia poligonal, e um perfil de elevação
 * poligonal parece dado grosseiro, não decisão de desenho. Acima de um vértice
 * por pixel não há o que ganhar: dois vizinhos caem na mesma coluna.
 */
function maxVerts(w: number): number {
  return Math.max(240, Math.round(w));
}

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
 *
 * **A cor é da métrica, não da atividade.** Cada painel lê o seu papel em
 * `METRIC_ROLE`, e por isso o componente não recebe mais `color`: numa atividade
 * só, a atividade é constante e pintar os dois painéis com ela gastava cor sem
 * dizer nada — o mesmo perfil mudava de cor entre uma corrida e um pedal, o que
 * impedia comparar os dois de olho.
 *
 * **O mouse percorre o percurso.** Passar por qualquer um dos painéis acende a
 * guia nos **dois** e emite `scrub` com a distância — é o que move o ponto no
 * mapa acima. Os dois acendem juntos de propósito: é a pergunta que a pilha
 * existe para responder, "o que o ritmo fez naquela subida". Sair da área
 * apaga, que é o contrato do hover; no mobile, onde não há "sair", o cursor
 * fica até ser limpo.
 */
@Component({
  selector: 'rt-route-profile-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (panels().length > 0) {
      <div class="wrap" #wrap (pointerleave)="clearCursor()">
        @for (p of panels(); track p.title) {
          <div class="panel">
            <div class="head">
              <span class="p-title">{{ p.title }}</span>
              @if (cursorOf(p); as c) {
                <!-- Sob o cursor a faixa dá lugar ao valor daquele ponto: mesma
                     vaga, e o extremo do percurso interessa menos que o lugar
                     que se está olhando. -->
                <span class="p-reading mono" [style.color]="p.color">{{ c.label }}</span>
              } @else {
                <span class="p-range mono">{{ p.botLabel }} → {{ p.topLabel }}</span>
              }
            </div>
            <svg [attr.viewBox]="'0 0 ' + w() + ' ' + h" class="chart" role="img"
              [attr.aria-label]="p.title"
              (pointermove)="onPointer($event)" (pointerdown)="onPointer($event)">
              <path [attr.d]="p.area" [attr.fill]="p.color" fill-opacity="0.14" />
              <path [attr.d]="p.line" [attr.stroke]="p.color" stroke-width="2"
                fill="none" stroke-linejoin="round" stroke-linecap="round" />
              @if (p.marker; as m) {
                <circle [attr.cx]="m.x" [attr.cy]="m.y" r="3" [attr.fill]="p.color"
                  stroke="var(--surface)" stroke-width="2" />
                <text class="mark mono" [attr.x]="m.x" [attr.y]="m.y - labelDy"
                  [attr.text-anchor]="labelAnchor(m.x)">{{ m.label }}</text>
              }
              @if (cursorOf(p); as c) {
                <!-- A guia é cromo, não dado: tinta neutra para não competir com
                     a cor da métrica dentro do mesmo painel. -->
                <line [attr.x1]="c.x" [attr.x2]="c.x" [attr.y1]="padT - 6" [attr.y2]="h - padB"
                  stroke="var(--ink-4)" stroke-width="1" />
                <circle [attr.cx]="c.x" [attr.cy]="c.y" r="4" [attr.fill]="p.color"
                  stroke="var(--surface)" stroke-width="2" />
              }
            </svg>
          </div>
        }
        <div class="axis">
          @if (cursorKm(); as km) {
            <span class="x-live mono">{{ km }}</span>
          } @else {
            @for (t of xTicks(); track t.km) {
              <span class="x-tick mono">{{ t.km }}</span>
            }
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
    .p-reading { margin-left: auto; font-size: 11px; font-weight: 650; }
    .chart { width: 100%; height: 100px; display: block; cursor: crosshair; }
    .mark { font-size: 9px; font-weight: 600; fill: var(--ink); }
    /* O eixo x é HTML e não SVG: ele é comum aos dois painéis, e desenhá-lo
       dentro de um deles o prenderia àquele gráfico.

       space-between e não posição absoluta por porcentagem: com o traçado
       ocupando a largura inteira, as três marcas caem em 0%, 50% e 100%, e a
       primeira e a última ficariam metade para fora se fossem centradas no
       ponto. Encostadas nas bordas elas dizem a mesma coisa e cabem. */
    .axis { display: flex; justify-content: space-between; height: 13px; }
    .x-tick {
      font-size: 10px;
      color: var(--ink-4);
      white-space: nowrap;
    }
    /* Com o cursor aceso, as três marcas dão lugar a uma: a pergunta deixou de
       ser "onde é o meio" e passou a ser "em que quilômetro estou". */
    .x-live { font-size: 10px; font-weight: 650; color: var(--ink-2); }
  `],
})
export class RouteProfileCardComponent {
  readonly points = input.required<ActivityRoutePoint[]>();
  readonly activityId = input.required<number>();

  /** Distância (m) sob o cursor, ou `null` ao sair da área. Move o mapa. */
  readonly scrub = output<number | null>();

  private readonly theme = inject(ThemeService);
  private readonly destroyRef = inject(DestroyRef);

  /** Largura real do card, em pixels. O `viewBox` acompanha, escala 1:1. */
  protected readonly w = signal(W0);
  protected readonly h = H;
  protected readonly padT = PAD_T;
  protected readonly padB = PAD_B;
  protected readonly labelDy = LABEL_DY;

  private readonly wrapEl = viewChild<ElementRef<HTMLElement>>('wrap');
  private ro?: ResizeObserver;

  constructor() {
    // O `wrap` só existe quando há painel, e some quando a rota é trocada por
    // uma sem perfil — daí observar por efeito em vez de no `afterNextRender`.
    effect(() => {
      const el = this.wrapEl()?.nativeElement;
      this.ro?.disconnect();
      if (!el) return;
      this.ro = new ResizeObserver(([entry]) => {
        const w = Math.round(entry.contentRect.width);
        if (w > 0) this.w.set(w);
      });
      this.ro.observe(el);
    });
    this.destroyRef.onDestroy(() => this.ro?.disconnect());
  }

  /** Distância (m) sob o cursor. `null` = sem cursor. */
  private readonly cursorX = signal<number | null>(null);

  /**
   * Converte a posição do ponteiro na distância do percurso.
   *
   * Passa pelo `getBoundingClientRect` e não pelo `offsetX` cru porque o
   * `offsetX` de um evento sobre um filho do `<svg>` — o traçado, o marcador —
   * é relativo àquele filho, não ao gráfico. Com a escala 1:1 a conta é direta,
   * mas continua saindo da caixa medida, que é o que também a mantém correta
   * durante o quadro em que a janela muda de tamanho.
   */
  protected onPointer(ev: PointerEvent): void {
    const el = ev.currentTarget as SVGSVGElement;
    const r = el.getBoundingClientRect();
    if (r.width === 0) return;
    const frac = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
    const x = frac * this.xMax();
    this.cursorX.set(x);
    this.scrub.emit(x);
  }

  protected clearCursor(): void {
    this.cursorX.set(null);
    this.scrub.emit(null);
  }

  /** Posição e leitura do cursor dentro de um painel; `null` sem cursor. */
  protected cursorOf(p: PanelVM): { x: number; y: number; label: string } | null {
    const x = this.cursorX();
    if (x === null) return null;
    const i = indexAtDistance(p.xs, x);
    if (i < 0) return null;
    return {
      x: xAt(p.xs[i], this.xMax(), this.w()),
      y: yAt(p.ys[i], p.lo, p.hi),
      label: p.fmt(p.ys[i]),
    };
  }

  /** Quilometragem sob o cursor, já formatada; `null` sem cursor. */
  protected readonly cursorKm = computed(() => {
    const x = this.cursorX();
    return x === null ? null : `${(x / 1000).toFixed(1).replace('.', ',')} km`;
  });

  /** Onde ancorar o rótulo do pico para ele não vazar pelas laterais. */
  protected labelAnchor(x: number): 'start' | 'middle' | 'end' {
    if (x < LABEL_EDGE) return 'start';
    if (x > this.w() - LABEL_EDGE) return 'end';
    return 'middle';
  }

  /** Acento do papel da métrica, nos eixos de tema ativos. */
  private colorOf(metric: keyof typeof METRIC_ROLE): string {
    return this.theme.tokens().roles[METRIC_ROLE[metric]].accent;
  }

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
    const g = geometry(p.xs, p.ys, this.xMax(), p.minAlt, p.maxAlt, this.w());
    return {
      title: 'Elevação',
      color: this.colorOf('elevacao'),
      ...g,
      topLabel: `${Math.round(p.maxAlt)} m`,
      botLabel: `${Math.round(p.minAlt)} m`,
      marker: {
        x: xAt(p.xs[p.peakIdx], this.xMax(), this.w()),
        y: yAt(p.ys[p.peakIdx], p.minAlt, p.maxAlt),
        label: `${Math.round(p.maxAlt)} m`,
      },
      xs: p.xs,
      ys: p.ys,
      lo: p.minAlt,
      hi: p.maxAlt,
      fmt: (v: number) => `${Math.round(v)} m`,
    };
  });

  protected readonly pace = computed<PanelVM | null>(() => {
    const s = this.speed();
    if (!s) return null;
    const lo = Math.min(...s.mps);
    const hi = Math.max(...s.mps);
    const g = geometry(s.xs, s.mps, this.xMax(), lo, hi, this.w());
    return {
      title: this.activityId() === 13 ? 'Velocidade' : 'Ritmo',
      color: this.colorOf('velocidade'),
      ...g,
      // O eixo é velocidade (mais alto = mais rápido, sem inverter nada), mas
      // rotulado na unidade do esporte: corrida lê min/km, bicicleta lê km/h.
      topLabel: this.rateLabel(hi),
      botLabel: this.rateLabel(lo),
      marker: null,
      xs: s.xs,
      ys: s.mps,
      lo,
      hi,
      fmt: (v: number) => this.rateLabel(v),
    };
  });

  protected readonly panels = computed(() =>
    [this.elev(), this.pace()].filter((p): p is PanelVM => p !== null),
  );

  protected readonly xTicks = computed(() => {
    const total = this.xMax() / 1000;
    // O traçado ocupa a largura inteira, então as marcas são início, meio e fim
    // — o `space-between` do eixo as põe no lugar sem cálculo de posição.
    return [0, 0.5, 1].map((f) => ({
      km: `${(total * f).toFixed(1).replace('.', ',')} km`,
    }));
  });

  private rateLabel(mps: number): string {
    if (mps <= 0) return '—';
    const r = formatRate(this.activityId(), 1000, 1000 / mps);
    return r ? `${r.value} ${r.caption === 'pace' ? 'min/km' : r.caption}` : '—';
  }
}

function xAt(x: number, xMax: number, w: number): number {
  return (x / xMax) * w;
}

function yAt(v: number, lo: number, hi: number): number {
  const span = hi - lo || 1;
  return PAD_T + (1 - (v - lo) / span) * (H - PAD_T - PAD_B);
}

/**
 * Traçado e área de uma série.
 *
 * Reamostra por índice até o teto de `maxVerts(w)`: uma rota longa chega com
 * milhares de pontos e, acima de um vértice por pixel, os vizinhos caem na mesma
 * coluna — custa render e não desenha nada a mais. O último ponto entra sempre,
 * senão o traçado termina antes da linha de chegada.
 */
function geometry(
  xs: number[],
  ys: number[],
  xMax: number,
  lo: number,
  hi: number,
  w: number,
): { area: string; line: string } {
  const step = Math.max(1, Math.ceil(xs.length / maxVerts(w)));
  const idx: number[] = [];
  for (let i = 0; i < xs.length; i += step) idx.push(i);
  if (idx[idx.length - 1] !== xs.length - 1) idx.push(xs.length - 1);

  const pts = idx.map((i) => `${xAt(xs[i], xMax, w).toFixed(1)},${yAt(ys[i], lo, hi).toFixed(1)}`);
  const line = `M${pts.join(' L')}`;
  const base = (H - PAD_B).toFixed(1);
  const first = xAt(xs[idx[0]], xMax, w).toFixed(1);
  const last = xAt(xs[idx[idx.length - 1]], xMax, w).toFixed(1);
  return { line, area: `${line} L${last},${base} L${first},${base} Z` };
}
