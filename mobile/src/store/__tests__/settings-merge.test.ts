/**
 * Guarda da fusão local × remoto das preferências.
 *
 * O defeito que este arquivo existe para impedir aparece só quando um campo
 * NOVO é acrescentado: o cache local gravado por uma versão anterior do app não
 * o conhece, e a regra de "o mais novo vence" — aplicada ao objeto inteiro —
 * fazia esse buraco apagar o valor que o banco tinha. O usuário via a
 * preferência voltar sozinha para o padrão, com o valor certo gravado em prod.
 *
 * Foi assim que o tema podia renderizar `orbe` com `theme_id = 'clean'` salvo.
 *
 * A regra: um campo ausente no cache nunca é escolha do usuário, é lacuna. O
 * remoto é a base; o local só sobrepõe o que de fato tem.
 */
import type { UserPreferences } from '@vitale/shared';
// A função DE VERDADE, não uma cópia: um teste sobre cópia passa enquanto o
// original diverge.
import { mergePreferences as merge } from '../preferences-merge';

const base = (over: Partial<UserPreferences> = {}): UserPreferences =>
  ({
    userId: 'u1',
    theme: 'system',
    themeId: 'orbe',
    paletteId: 'orbe',
    brandId: 'laranja',
    glassEnabled: false,
    blurIntensity: 50,
    language: 'pt-BR',
    notificationsEnabled: true,
    mapStyle: 'voyager',
    wallpaper: 'flat',
    updatedAt: '2026-08-26T07:00:00.000Z',
    ...over,
  }) as UserPreferences;

describe('fusão de preferências', () => {
  it('cache antigo não apaga campo que o banco tem', () => {
    const remote = base({ themeId: 'clean', paletteId: 'neon', brandId: 'tinta' });
    // Cache de uma versão anterior: mais novo, e sem os campos que nasceram depois.
    const local = base({ updatedAt: '2026-08-26T09:00:00.000Z' });
    delete (local as Partial<UserPreferences>).themeId;
    delete (local as Partial<UserPreferences>).paletteId;
    delete (local as Partial<UserPreferences>).brandId;

    const r = merge(remote, local, true)!;
    expect(r.themeId).toBe('clean');
    expect(r.paletteId).toBe('neon');
    expect(r.brandId).toBe('tinta');
  });

  it('escolha local recente ainda vence o remoto', () => {
    // O motivo de a regra existir: o upsert pode não ter chegado.
    const remote = base({ wallpaper: 'flat' });
    const local = base({ wallpaper: 'mesh', updatedAt: '2026-08-26T09:00:00.000Z' });
    expect(merge(remote, local, true)!.wallpaper).toBe('mesh');
  });

  it('remoto mais novo sobrescreve o local por inteiro', () => {
    const remote = base({ themeId: 'cleanElev' });
    const local = base({ themeId: 'orbe' });
    expect(merge(remote, local, false)!.themeId).toBe('cleanElev');
  });

  it('sem linha remota, preserva o que já está em memória', () => {
    const local = base({ themeId: 'clean' });
    expect(merge(null, local, false)!.themeId).toBe('clean');
  });
});
