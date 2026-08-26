/**
 * Guarda do cache de folhas de estilo.
 *
 * O bug que este arquivo existe para impedir não dá erro nenhum: se um eixo do
 * tema ficar de fora da chave de cache (ou das dependências do
 * `useThemedStyles`), a folha antiga é servida de novo e **a tela simplesmente
 * não muda**. Já aconteceu neste app duas vezes — uma com o esquema claro/escuro
 * e outra com o papel de parede — e nos dois casos o sintoma foi "o modo escuro
 * não funciona", com o código parecendo correto.
 *
 * São 3 temas × 2 esquemas × 6 paletas × 4 marcas × 2 estados de wallpaper =
 * **288 estados**. O teste exige que todos produzam chaves distintas: nenhuma
 * colisão significa nenhuma folha servida errada.
 */
import { BRANDS, PALETTES, THEMES, type BrandId, type PaletteId, type ThemeId } from '@vitale/shared';
// Importa de `tokens`, não de `index`: o provider arrasta a store de
// preferências e o cliente Supabase, que exigiriam credenciais no teste.
import { colors, moduleColors, setActiveAxes, shadows, themed, themedCacheKey, type ColorScheme } from '../tokens';

const THEME_IDS = THEMES.map((t) => t.id) as ThemeId[];
const PALETTE_IDS = PALETTES.map((p) => p.id) as PaletteId[];
const BRAND_IDS = BRANDS.map((b) => b.id) as BrandId[];
const SCHEMES: ColorScheme[] = ['light', 'dark'];

type State = { t: ThemeId; s: ColorScheme; p: PaletteId; b: BrandId; wp: boolean };

const ALL: State[] = THEME_IDS.flatMap((t) =>
  SCHEMES.flatMap((s) =>
    PALETTE_IDS.flatMap((p) =>
      BRAND_IDS.flatMap((b) => [true, false].map((wp) => ({ t, s, p, b, wp }))),
    ),
  ),
);

describe('cache de tema', () => {
  afterEach(() => setActiveAxes('orbe', 'light', 'orbe', 'laranja', false));

  it('dá uma chave distinta a cada combinação de eixos', () => {
    const seen = new Map<string, State>();
    for (const st of ALL) {
      setActiveAxes(st.t, st.s, st.p, st.b, st.wp);
      const key = themedCacheKey();
      const clash = seen.get(key);
      if (clash) {
        throw new Error(
          `colisão de chave "${key}": ${JSON.stringify(clash)} × ${JSON.stringify(st)} — ` +
            `a folha de um seria servida para o outro`,
        );
      }
      seen.set(key, st);
    }
    expect(seen.size).toBe(ALL.length);
  });

  it('reconstrói a folha quando qualquer eixo muda', () => {
    let builds = 0;
    const sheet = themed(() => {
      builds += 1;
      return { box: { backgroundColor: colors.surface, color: colors.ink } };
    });

    // Cada degrau muda UM eixo. A folha lida não depende da marca — e é
    // justamente por isso que ela serve de prova: se a chave de cache ignorasse
    // a marca, o degrau 'marca' não reconstruiria e `builds` não avançaria.
    const eixos: [string, State][] = [
      ['base', { t: 'orbe', s: 'light', p: 'orbe', b: 'laranja', wp: false }],
      ['tema', { t: 'clean', s: 'light', p: 'orbe', b: 'laranja', wp: false }],
      ['esquema', { t: 'clean', s: 'dark', p: 'orbe', b: 'laranja', wp: false }],
      ['paleta', { t: 'clean', s: 'dark', p: 'joia', b: 'laranja', wp: false }],
      ['marca', { t: 'clean', s: 'dark', p: 'joia', b: 'azul', wp: false }],
      ['wallpaper', { t: 'clean', s: 'dark', p: 'joia', b: 'azul', wp: true }],
    ];

    eixos.forEach(([nome, st], i) => {
      setActiveAxes(st.t, st.s, st.p, st.b, st.wp);
      void sheet.box.backgroundColor;
      expect(`${nome}:${builds}`).toBe(`${nome}:${i + 1}`);
    });

    // Reentrar num estado já visto usa o cache, sem reconstruir.
    setActiveAxes('orbe', 'light', 'orbe', 'laranja', false);
    void sheet.box.backgroundColor;
    expect(builds).toBe(eixos.length);
  });

  it('a marca chega aos tokens sem tocar nos módulos', () => {
    setActiveAxes('orbe', 'light', 'orbe', 'laranja', false);
    const laranja = { primary: colors.primary, treino: moduleColors('treino').accent };

    setActiveAxes('orbe', 'light', 'orbe', 'azul', false);
    expect(colors.primary).not.toBe(laranja.primary);
    // O “+” fica azul; o chip de Treino continua laranja. É a separação inteira
    // entre cromo e identidade de módulo, num par de asserções.
    expect(moduleColors('treino').accent).toBe(laranja.treino);
  });

  it('o proxy de cores segue os eixos ativos', () => {
    setActiveAxes('orbe', 'light', 'orbe', 'laranja', false);
    // O recorte histórico do app não pode mudar por causa da refatoração.
    expect(colors.bg).toBe('#FFF7EE');
    expect(colors.primary).toBe('#F25C2B');

    setActiveAxes('clean', 'dark', 'orbe', 'laranja', false);
    expect(colors.bg).toBe('#000000');
    // Clean por contorno: o card não tem preenchimento próprio.
    expect(colors.surface).toBe('#000000');

    setActiveAxes('cleanElev', 'dark', 'orbe', 'laranja', false);
    expect(colors.surface).not.toBe('#000000');
  });

  it('o card troca sombra por contorno nos temas Clean', () => {
    setActiveAxes('orbe', 'light', 'orbe', 'laranja', false);
    const orbe = shadows.card as Record<string, unknown>;
    expect(orbe['shadowOpacity']).toBeGreaterThan(0);
    expect(orbe['borderWidth']).toBeUndefined();

    setActiveAxes('clean', 'light', 'orbe', 'laranja', false);
    const clean = shadows.card as Record<string, unknown>;
    // Excludentes: sombra E borda juntas é o visual pesado que o Clean evita.
    expect(clean['shadowOpacity']).toBe(0);
    expect(clean['elevation']).toBe(0);
    expect(clean['borderWidth']).toBe(1);
    expect(clean['borderColor']).toBe(colors.hairline);
  });

  it('com wallpaper ativo o fundo da tela fica transparente', () => {
    setActiveAxes('orbe', 'light', 'orbe', 'laranja', true);
    expect(colors.bg).toBe('transparent');
    // ...mas só o `bg`: o resto continua opaco, senão o conteúdo some junto.
    expect(colors.surface).toBe('#FFFFFF');
  });
});
