import { describe, it, expect, jest } from '@jest/globals';

// `../theme` arrasta o store de settings → cliente Supabase (exige env vars no
// import). O cartão e o map-html só leem estes tokens.
jest.mock('../../theme', () => ({
  MOD: { treino: { accent: '#F25C2B' } },
  colors: { green: '#6FA86A', surfaceMute: '#F3EADC' },
}));

import { buildShareCardHtml, type ShareCardOptions } from '../share-card-html';

// Rota sintética em L, altitude crescente e tempo monotônico que acelera na
// metade (passo de 20 s → 5 s por ponto) — dá material para as 3 artes.
const t0 = Date.parse('2026-07-20T06:00:00Z');
let elapsed = 0;
const points = Array.from({ length: 60 }, (_, i) => {
  if (i > 0) elapsed += i > 30 ? 5 : 20;
  return {
    latitude: -23.55 + i * 0.0004,
    longitude: -46.63 + (i > 30 ? (i - 30) * 0.0004 : 0),
    altitude: 700 + i * 2,
    timestamp: new Date(t0 + elapsed * 1000).toISOString(),
  };
});

const base: ShareCardOptions = {
  points,
  format: 'story',
  background: 'art',
  title: 'Corrida matinal',
  showTitle: true,
  activityId: 37,
  metrics: [{ key: 'distance', value: '8.42', caption: 'km' }],
  watermark: true,
};

const build = (o: Partial<ShareCardOptions> = {}) => buildShareCardHtml({ ...base, ...o });

describe('cartão transparente', () => {
  it('arte não pinta camada de fundo e o body sai transparente', () => {
    const html = build();
    expect(html).not.toContain('class="bg"');
    expect(html).toMatch(/body\s*\{[^}]*background:\s*transparent/);
  });

  it('preview da arte mostra o xadrez de alpha', () => {
    expect(build({ previewChecker: true })).toContain('conic-gradient');
  });

  it('mapa continua com fundo preto (sem alpha)', () => {
    const html = build({
      background: 'map',
      mapTile: { kind: 'raster', label: 'x', url: 'https://t/{z}/{x}/{y}.png', attribution: '' } as never,
    });
    expect(html).toMatch(/body\s*\{[^}]*background:\s*#000/);
  });
});

describe('estilos de arte', () => {
  it('speed: rampa de calor por segmento + legenda lento/rápido', () => {
    const html = build({ artStyle: 'speed' });
    expect(html).toContain('<div class="speedLegend">');
    // Um <line> colorido por segmento (o traçado único não gera nenhum).
    expect((html.match(/<line /g) ?? []).length).toBeGreaterThan(10);
    expect(html).toContain('stroke="#FFFFFF" stroke-opacity="0.95"'); // casing mantida
  });

  it('route: linha accent + dots, sem casing branca e sem legenda', () => {
    const html = build({ artStyle: 'route' });
    expect(html).not.toContain('<div class="speedLegend">');
    expect(html).not.toContain('stroke="#FFFFFF" stroke-opacity="0.95"'); // sem casing
    expect(html).not.toContain('<line '); // sem segmentos de velocidade
    expect(html).toContain('stroke="#F25C2B" stroke-width="15"'); // linha no accent
    expect(html).toContain('fill="#6FA86A"'); // dot de início (verde)
    expect(html).toContain('fill="#F25C2B"'); // dot de fim (accent)
  });

  it('elevation: área com degradê + rótulo do pico em metros', () => {
    const html = build({ artStyle: 'elevation' });
    expect(html).toContain('elevFill');
    expect(html).toMatch(/>8\d\d m</); // pico ~818 m, suavizado
  });
});

describe('cidades na rota', () => {
  // Uma perto do início da rota, outra perto do fim (do L sintético), para as
  // duas passarem pela anti-colisão de rótulos.
  const cities = [
    { name: 'São Paulo', state: 'SP', country: 'Brasil', lat: -23.55, lng: -46.63 },
    { name: "Santa Bárbara d'Oeste", lat: -23.5264, lng: -46.6184 },
  ];

  it('arte: desenha um rótulo por cidade quando passadas', () => {
    const html = build({ artStyle: 'route', cities });
    expect(html).toContain('São Paulo');
    expect(html).toContain("Santa Bárbara d'Oeste"); // apóstrofo é válido em texto SVG
    expect((html.match(/paint-order="stroke"/g) ?? []).length).toBe(2);
  });

  it('arte: sem cities não adiciona rótulos', () => {
    const html = build({ artStyle: 'route' });
    expect(html).not.toContain('paint-order="stroke"');
  });

  it('mapa: injeta os dados das cidades no script', () => {
    const html = build({
      background: 'map',
      cities,
      mapTile: { kind: 'raster', label: 'x', url: 'https://t/{z}/{x}/{y}.png', attribution: '' } as never,
    });
    expect(html).toContain('São Paulo');
    expect(html).toContain('cityData');
  });
});

describe('título opcional', () => {
  it('ligado: ícone, texto e traço', () => {
    const html = build({ showTitle: true });
    expect(html).toContain('class="titleRow"');
    expect(html).toContain('class="titleIcon"');
    expect(html).toContain('Corrida matinal');
    expect(html).toContain('<div class="rule"></div>');
  });

  it('desligado: some ícone, texto E traço — métricas continuam', () => {
    const html = build({ showTitle: false });
    expect(html).not.toContain('class="titleRow"');
    expect(html).not.toContain('class="titleIcon"');
    expect(html).not.toContain('Corrida matinal');
    expect(html).not.toContain('<div class="rule"></div>');
    expect(html).toContain('8.42');
  });
});
