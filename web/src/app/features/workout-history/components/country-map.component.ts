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
import type { ActivityRoutePoint, MapStyle, ViewportBounds } from '@vitale/shared';
import { MAP_STYLES } from '@vitale/shared';
import { PreferencesService } from '@core/services/preferences.service';
import * as L from 'leaflet';
import maplibregl from 'maplibre-gl';

// O plugin maplibre-gl-leaflet referencia o global `maplibregl` em runtime.
(globalThis as unknown as { maplibregl: typeof maplibregl }).maplibregl = maplibregl;
import '@maplibre/maplibre-gl-leaflet';

/** Máx. de pontos por rota ao desenhar (dezenas de rotas juntas — a forma no
 *  zoom do país sobrevive à redução; mantém o mapa fluido). */
const MAX_POINTS_PER_ROUTE = 150;

function downsample(points: readonly ActivityRoutePoint[], max: number): ActivityRoutePoint[] {
  if (points.length <= max) return points.slice();
  const step = Math.ceil(points.length / max);
  const out: ActivityRoutePoint[] = [];
  for (let i = 0; i < points.length; i += step) out.push(points[i]);
  const last = points[points.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

/**
 * Mapa com TODAS as rotas de um país sobrepostas. Variante do
 * `ActivityMapComponent`: uma polyline (fina, sem casing dupla) por atividade, e
 * o enquadramento vem do `viewport` calculado (bbox do país ± buffer), não do
 * conteúdo desenhado — assim a vista cobre o país mesmo onde não há rota.
 */
@Component({
  selector: 'rt-country-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<div #map class="map"></div>',
  styles: [
    `:host { display: block; }
     .map { height: 460px; width: 100%; border-radius: 16px; overflow: hidden;
       border: 1px solid var(--line); background: var(--surface-mute); z-index: 0; }`,
  ],
})
export class CountryMapComponent {
  /** Rotas GPS a desenhar — uma por atividade. */
  readonly routes = input.required<ActivityRoutePoint[][]>();
  /** Enquadramento inicial `[[sul,oeste],[norte,leste]]`; null ⇒ ajusta às rotas. */
  readonly viewport = input<ViewportBounds | null>(null);

  private readonly mapEl = viewChild.required<ElementRef<HTMLElement>>('map');
  private readonly destroyRef = inject(DestroyRef);
  private readonly prefs = inject(PreferencesService);

  private map?: L.Map;
  private baseLayer?: L.Layer;
  private lines: L.Polyline[] = [];
  private ro?: ResizeObserver;
  private fitted = false;

  constructor() {
    afterNextRender(() => this.init());
    effect(() => {
      const routes = this.routes();
      this.viewport();
      if (this.map) {
        this.fitted = false;
        this.draw(routes);
      }
    });
    effect(() => {
      const style = this.prefs.mapStyle();
      if (this.map) this.applyStyle(style);
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
    this.applyStyle(this.prefs.mapStyle());
    this.draw(this.routes());

    this.ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (!r || r.width === 0 || r.height === 0) return;
      map.invalidateSize();
      if (!this.fitted) this.fit();
    });
    this.ro.observe(el);
  }

  /** (Re)aplica a camada base — idêntico ao `ActivityMapComponent`. */
  private applyStyle(style: MapStyle): void {
    const map = this.map;
    if (!map) return;
    this.baseLayer?.remove();
    const cfg = MAP_STYLES[style];
    if (cfg.kind === 'vector') {
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

  private draw(routes: ActivityRoutePoint[][]): void {
    const map = this.map;
    if (!map) return;
    this.lines.forEach((l) => l.remove());
    this.lines = [];

    const color = this.routeColor();
    for (const route of routes) {
      if (route.length < 2) continue;
      const latlngs = downsample(route, MAX_POINTS_PER_ROUTE).map(
        (p) => [p.lat, p.lng] as L.LatLngTuple,
      );
      this.lines.push(
        L.polyline(latlngs, {
          color,
          weight: 3,
          opacity: 0.7,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map),
      );
    }
    this.fit();
  }

  /** Enquadra ao `viewport` (piso = país); sem ele, ajusta ao conteúdo. */
  private fit(): void {
    const map = this.map;
    if (!map) return;
    const vp = this.viewport();
    let bounds: L.LatLngBounds | undefined;
    if (vp) {
      bounds = L.latLngBounds(vp[0], vp[1]);
    } else if (this.lines.length > 0) {
      bounds = this.lines[0].getBounds();
      for (let i = 1; i < this.lines.length; i++) bounds.extend(this.lines[i].getBounds());
    }
    if (!bounds || !bounds.isValid()) return;
    map.fitBounds(bounds, { padding: [24, 24] });
    const size = map.getSize();
    if (size.x > 0 && size.y > 0) this.fitted = true;
  }

  private routeColor(): string {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
    return v || '#F25C2B';
  }
}
