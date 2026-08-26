/**
 * Fusão e padrões das preferências — **parte pura**, sem Supabase.
 *
 * Separado da store pelo mesmo motivo que `theme/tokens.ts` foi separado do
 * provider: importar a store arrasta o cliente Supabase, e o teste desta lógica
 * quebrava com "supabaseUrl is required" antes da primeira asserção. Fusão de
 * objeto não depende de sessão.
 */
import type { UserPreferences } from '@vitale/shared';
import {
  DEFAULT_BRAND_ID,
  DEFAULT_MAP_STYLE,
  DEFAULT_NOTIFICATION_PREFS,
  DEFAULT_PALETTE_ID,
  DEFAULT_THEME_ID,
  DEFAULT_WALLPAPER,
  resolveRetroPrefs,
} from '@vitale/shared';

/**
 * Funde as preferências remotas com as locais, **campo a campo**.
 *
 * Trocar o objeto inteiro pelo local propaga os BURACOS dele: um cache gravado
 * por uma versão anterior do app não conhece os campos que nasceram depois, e ao
 * vencer por ser mais novo apagava esses campos com `undefined` — que então
 * caíam no padrão. É como o tema podia renderizar `orbe` com `theme_id='clean'`
 * gravado no banco: a preferência voltava sozinha, com o valor certo em prod.
 *
 * Um campo ausente no cache nunca é escolha do usuário; é lacuna. Então o remoto
 * é a base, e o local só sobrepõe o que de fato tem — preservando o motivo de a
 * regra existir, que é uma escolha recente cujo upsert ainda não chegou.
 *
 * Exportada para `settings-merge.test.ts` exercitar a função DE VERDADE; um
 * teste sobre uma cópia da lógica passa enquanto o original diverge.
 */
export function mergePreferences(
  remote: UserPreferences | null,
  local: UserPreferences | null,
  localIsNewer: boolean,
): UserPreferences | null {
  const definidos = <T extends object>(o: T): Partial<T> =>
    Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
  return (
    (localIsNewer && remote && local ? { ...remote, ...definidos(local) } : remote) ?? local ?? null
  );
}

/** Padrões de primeira execução — sem linha remota nem cache. */
export function defaultPreferences(userId: string): UserPreferences {
  return {
    userId,
    theme: 'system',
    themeId: DEFAULT_THEME_ID,
    paletteId: DEFAULT_PALETTE_ID,
    brandId: DEFAULT_BRAND_ID,
    glassEnabled: false,
    blurIntensity: 50,
    language: 'pt-BR',
    notificationsEnabled: true,
    mapStyle: DEFAULT_MAP_STYLE,
    wallpaper: DEFAULT_WALLPAPER,
    notificationPrefs: DEFAULT_NOTIFICATION_PREFS,
    retroPrefs: resolveRetroPrefs(null),
    updatedAt: new Date().toISOString(),
  };
}
