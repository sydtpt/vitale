import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import type { ActivityRoutePoint, MapStyle } from '@vitale/shared';
import { MAP_STYLES } from '@vitale/shared';
import { PreferencesService } from '@core/services/preferences.service';
import * as L from 'leaflet';

/**
 * Mapa OpenStreetMap (via Leaflet) com a rota GPS de uma atividade outdoor.
 * Desenha a polyline, marca início/fim e ajusta o zoom à rota.
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

  private readonly mapEl = viewChild.required<ElementRef<HTMLElement>>('map');
  private readonly destroyRef = inject(DestroyRef);
  private readonly prefs = inject(PreferencesService);

  private map?: L.Map;
  private tileLayer?: L.TileLayer;
  private casing?: L.Polyline;
  private line?: L.Polyline;
  private markers: L.Layer[] = [];
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
    // Troca os tiles quando o usuário muda o estilo de mapa (carregado do DB).
    effect(() => {
      const style = this.prefs.mapStyle();
      if (this.map) this.applyTileStyle(style);
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
    this.applyTileStyle(this.prefs.mapStyle());
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

  /** (Re)aplica a camada de tiles do estilo escolhido, removendo a anterior. */
  private applyTileStyle(style: MapStyle): void {
    const map = this.map;
    if (!map) return;
    this.tileLayer?.remove();
    const cfg = MAP_STYLES[style];
    this.tileLayer = L.tileLayer(cfg.url, {
      maxZoom: cfg.maxZoom,
      subdomains: cfg.subdomains,
      attribution: cfg.attribution,
    }).addTo(map);
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
    this.markers.push(
      L.circleMarker(start, {
        radius: 6, color: '#fff', weight: 2, fillColor: '#3FA34D', fillOpacity: 1,
      }).bindTooltip('Início').addTo(map),
      L.circleMarker(end, {
        radius: 6, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1,
      }).bindTooltip('Fim').addTo(map),
    );

    this.fit();
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

  /** Lê a cor primária do design system; cai no laranja da marca se ausente. */
  private routeColor(): string {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
    return v || '#F25C2B';
  }
}
