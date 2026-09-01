import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import type { ActivityRoutePoint, MapStyle } from '@vitale/shared';
import { MAP_STYLES, moduleOf } from '@vitale/shared';
import { PreferencesService } from '@core/services/preferences.service';
import { ThemeService } from '@core/theme/theme.service';
import * as L from 'leaflet';
import maplibregl from 'maplibre-gl';

// O plugin maplibre-gl-leaflet referencia o global `maplibregl` em tempo de
// execução; expomos antes de qualquer chamada a `L.maplibreGL(...)`.
(globalThis as unknown as { maplibregl: typeof maplibregl }).maplibregl = maplibregl;
import '@maplibre/maplibre-gl-leaflet';

/**
 * Mapa com a rota GPS de uma atividade outdoor. Estilos raster usam tiles do
 * Leaflet; estilos vetoriais (OpenFreeMap) entram como camada MapLibre GL via
 * `maplibre-gl-leaflet` (renderização 2D — o tilt 3D só existe no mobile).
 * Desenha a polyline, marca início/fim e ajusta o zoom à rota.
 *
 * `cursor` acende um ponto sobre a rota — é o mouse percorrendo o gráfico de
 * elevação/velocidade logo abaixo.
 */
@Component({
  selector: 'rt-activity-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './activity-map.component.html',
  styleUrl: './activity-map.component.scss',
})
export class ActivityMapComponent {
  readonly points = input.required<ActivityRoutePoint[]>();
  /** Ponto do percurso a destacar, ou `null` para apagar o destaque. */
  readonly cursor = input<{ lat: number; lng: number } | null>(null);

  /** Zoom por scroll começa travado; vira `true` ao clicar no mapa (esconde a dica). */
  protected readonly interactive = signal(false);

  private readonly mapEl = viewChild.required<ElementRef<HTMLElement>>('map');
  private readonly destroyRef = inject(DestroyRef);
  private readonly prefs = inject(PreferencesService);
  private readonly theme = inject(ThemeService);

  private map?: L.Map;
  private baseLayer?: L.Layer;
  private casing?: L.Polyline;
  private line?: L.Polyline;
  private markers: L.Layer[] = [];
  /** Guardados à parte dos `markers` porque recolorem quando a paleta muda. */
  private startMarker?: L.CircleMarker;
  private endMarker?: L.CircleMarker;
  private cursorMarker?: L.CircleMarker;
  private ro?: ResizeObserver;
  private fitted = false;

  constructor() {
    afterNextRender(() => this.init());
    // Redesenha quando a rota muda; ignora enquanto o mapa ainda não inicializou.
    effect(() => {
      const pts = this.points();
      if (this.map) {
        this.fitted = false;
        this.draw(pts);
      }
    });
    // Troca o estilo quando o usuário muda o mapa (carregado do DB).
    effect(() => {
      const style = this.prefs.mapStyle();
      if (this.map) this.applyStyle(style);
    });
    // Move (ou apaga) o ponto do scrub, sem redesenhar a rota nem reenquadrar.
    effect(() => this.drawCursor(this.cursor()));
    // Trocar de paleta ou de esquema recolore a rota na hora. Sem isto ela
    // ficaria na cor de quando a tela abriu, que é o que o `getComputedStyle`
    // fazia: lia uma vez e congelava.
    effect(() => {
      const [route, start] = [this.routeColor(), this.startColor()];
      this.line?.setStyle({ color: route });
      this.endMarker?.setStyle({ fillColor: route });
      this.startMarker?.setStyle({ fillColor: start });
    });
    this.destroyRef.onDestroy(() => {
      this.ro?.disconnect();
      this.map?.remove();
    });
  }

  private init(): void {
    const el = this.mapEl().nativeElement;
    const map = L.map(el, { scrollWheelZoom: false });
    this.map = map;
    // Scroll-zoom começa travado para não sequestrar o scroll da página; ativa
    // ao clicar no mapa e volta a travar quando o mouse sai da área.
    map.on('click', () => {
      map.scrollWheelZoom.enable();
      this.interactive.set(true);
    });
    el.addEventListener('mouseleave', () => {
      map.scrollWheelZoom.disable();
      this.interactive.set(false);
    });
    this.applyStyle(this.prefs.mapStyle());
    this.draw(this.points());

    // O container só ganha o tamanho real depois do layout do navegador.
    // Sem isso o Leaflet posiciona tiles e a rota fora da área visível —
    // o ResizeObserver corrige assim que houver dimensão de verdade.
    this.ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (!r || r.width === 0 || r.height === 0) return;
      map.invalidateSize();
      if (!this.fitted) this.fit();
    });
    this.ro.observe(el);
  }

  /** (Re)aplica a camada base do estilo escolhido, removendo a anterior. */
  private applyStyle(style: MapStyle): void {
    const map = this.map;
    if (!map) return;
    this.baseLayer?.remove();
    const cfg = MAP_STYLES[style];
    if (cfg.kind === 'vector') {
      // Estilo vetorial OpenFreeMap via MapLibre GL (camada do Leaflet, 2D).
      this.baseLayer = (L as unknown as {
        maplibreGL: (opts: { style: string; attribution?: string }) => L.Layer;
      })
        .maplibreGL({ style: cfg.styleUrl, attribution: cfg.attribution })
        .addTo(map);
    } else {
      this.baseLayer = L.tileLayer(cfg.url, {
        maxZoom: cfg.maxZoom,
        subdomains: cfg.subdomains,
        attribution: cfg.attribution,
      }).addTo(map);
    }
  }

  private draw(points: ActivityRoutePoint[]): void {
    const map = this.map;
    if (!map) return;

    this.casing?.remove();
    this.line?.remove();
    this.markers.forEach((m) => m.remove());
    this.markers = [];

    if (points.length === 0) {
      map.setView([0, 0], 1);
      return;
    }

    const latlngs = points.map((p) => [p.lat, p.lng] as L.LatLngTuple);
    const color = this.routeColor();

    // Casing branco por baixo (halo estilo Strava) + rota colorida por cima,
    // ambos com cantos arredondados para a linha destacar do mapa de fundo.
    this.casing = L.polyline(latlngs, {
      color: '#FFFFFF', weight: 8, opacity: 0.95, lineCap: 'round', lineJoin: 'round',
    }).addTo(map);
    this.line = L.polyline(latlngs, {
      color, weight: 4, opacity: 1, lineCap: 'round', lineJoin: 'round',
    }).addTo(map);

    const start = latlngs[0];
    const end = latlngs[latlngs.length - 1];
    this.startMarker = L.circleMarker(start, {
      radius: 6, color: '#fff', weight: 2, fillColor: this.startColor(), fillOpacity: 1,
    }).bindTooltip('Início').addTo(map);
    this.endMarker = L.circleMarker(end, {
      radius: 6, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1,
    }).bindTooltip('Fim').addTo(map);
    this.markers.push(
      this.startMarker,
      this.endMarker,
    );

    this.fit();
  }

  /**
   * Ponto do scrub sobre a rota.
   *
   * **Núcleo escuro com anel branco, e não uma cor de tema.** O marcador tem de
   * ser legível sobre qualquer tile, e há estilo de mapa claro *e* escuro na
   * lista: um token que virasse quase-branco no esquema escuro sumiria sobre o
   * Positron, e um fixo escuro sumiria sobre o Dark Matter. É a mesma solução do
   * casing branco sob a linha da rota. Verde e laranja também estão fora: são o
   * início e o fim, que ficam desenhados ao mesmo tempo que este.
   */
  private drawCursor(at: { lat: number; lng: number } | null): void {
    const map = this.map;
    if (!map) return;
    if (!at) {
      this.cursorMarker?.remove();
      this.cursorMarker = undefined;
      return;
    }
    if (this.cursorMarker) {
      this.cursorMarker.setLatLng([at.lat, at.lng]);
      return;
    }
    this.cursorMarker = L.circleMarker([at.lat, at.lng], {
      radius: 5, color: '#FFFFFF', weight: 3,
      fillColor: '#1F1B16', fillOpacity: 1, interactive: false,
    }).addTo(map);
  }

  /** Enquadra a rota; só marca como ajustado quando o mapa já tem tamanho. */
  private fit(): void {
    const map = this.map;
    if (!map || !this.line) return;
    const bounds = this.line.getBounds();
    if (!bounds.isValid()) return;
    map.fitBounds(bounds, { padding: [24, 24] });
    const size = map.getSize();
    if (size.x > 0 && size.y > 0) this.fitted = true;
  }

  /**
   * Cor da rota: o papel do módulo **treino**, que é o `orange`.
   *
   * Lia `--primary`, e isso era erro de categoria. `--primary` vem do eixo
   * **marca**, que governa o cromo — FAB, CTA, toggle, estado ativo. A rota não
   * é cromo, é dado: com a marca em `tinta` o percurso saía quase-preto, e em
   * `azul` sairia azul. O papel responde à **paleta**, que é o eixo da cor de
   * dado, e por construção continua da família laranja nas seis.
   *
   * É também o que o mobile sempre desenhou (`MOD.treino.accent`) — as duas
   * telas discordavam sobre a cor do mesmo percurso.
   */
  private routeColor(): string {
    return moduleOf('treino', this.theme.themeId(), this.theme.scheme(), this.theme.paletteId())
      .accent;
  }

  /** Cor do ponto de largada: o papel `green`, como no mobile. */
  private startColor(): string {
    return this.theme.tokens().roles.green.accent;
  }
}
