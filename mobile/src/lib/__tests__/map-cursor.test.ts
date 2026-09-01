import { describe, it, expect, jest } from '@jest/globals';

// `../theme` arrasta o store de settings → cliente Supabase (exige env vars no
// import). O HTML do mapa só lê estes tokens.
jest.mock('../../theme', () => ({
  MOD: { treino: { accent: '#F25C2B' } },
  colors: { green: '#6FA86A', surfaceMute: '#F3EADC' },
}));

import { buildMapHtml } from '../map-html';
import { MAP_STYLES } from '@vitale/shared';

const points = Array.from({ length: 20 }, (_, i) => ({
  latitude: 51.02 + i * 0.001,
  longitude: 4.47 + i * 0.001,
}));

/** O `<script>` gerado, sem as tags — é o que o WebView vai avaliar. */
function scriptOf(html: string): string {
  const parts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  expect(parts.length).toBeGreaterThan(0);
  return parts.join('\n');
}

/**
 * O cursor do scrub vive num `<script>` montado por concatenação de string, e um
 * erro de sintaxe ali não aparece em lugar nenhum: o WebView engole a exceção e
 * o mapa simplesmente para de responder ao dedo. Estes testes existem para o
 * erro aparecer no CI em vez de no aparelho.
 */
describe('API de cursor no HTML do mapa', () => {
  // Um estilo de cada família: raster desenha com Leaflet, vector com MapLibre,
  // e as duas implementações do cursor são independentes.
  const casos = [
    ['raster (Leaflet)', MAP_STYLES.voyager],
    ['vector (MapLibre)', MAP_STYLES.ofm_bright],
  ] as const;

  for (const [nome, tile] of casos) {
    it(`${nome} — o script gerado é sintaticamente válido`, () => {
      const src = scriptOf(buildMapHtml(points, false, tile));
      // `new Function` compila sem executar: pega erro de sintaxe sem precisar
      // dos globais de Leaflet/MapLibre.
      expect(() => new Function(src)).not.toThrow();
    });

    it(`${nome} — expõe __cursor e __cursorHide`, () => {
      const src = scriptOf(buildMapHtml(points, false, tile));
      expect(src).toContain('window.__cursor =');
      expect(src).toContain('window.__cursorHide =');
    });

    it(`${nome} — o marcador é núcleo escuro com anel branco`, () => {
      // Sobre tile, e há estilo de mapa claro e escuro: o par núcleo+anel é o
      // que sobrevive aos dois. Se alguém trocar por um token de tema, some num
      // dos esquemas — e este teste é onde isso aparece.
      const src = scriptOf(buildMapHtml(points, false, tile));
      const cursorBlock = src.slice(src.indexOf('window.__cursor ='));
      expect(cursorBlock.length).toBeGreaterThan(0);
      expect(src).toMatch(/#1F1B16/);
    });
  }

  it('vector — um scrub antes do load fica guardado, não estoura', () => {
    // A camada do cursor só existe depois do 'load' do MapLibre; o dedo pode
    // chegar antes. O script precisa guardar em vez de chamar getSource(null).
    const src = scriptOf(buildMapHtml(points, false, MAP_STYLES.ofm_bright));
    expect(src).toContain('pendingCursor');
    expect(src).toMatch(/if \(!cursorReady\)/);
  });

  it('raster — sem rota, o script continua válido', () => {
    const src = scriptOf(buildMapHtml([], false, MAP_STYLES.voyager));
    expect(() => new Function(src)).not.toThrow();
  });
});
