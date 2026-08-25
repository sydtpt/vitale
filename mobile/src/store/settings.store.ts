import { create } from 'zustand';
import type { Profile, UserPreferences, AppTheme } from '@vitale/shared';
import {
  fetchProfile,
  fetchUserPreferencesRow,
  patchProfile,
  upsertUserPreferences,
} from '@vitale/shared';
import {
  resolveMapStyle,
  DEFAULT_MAP_STYLE,
  resolveWallpaper,
  DEFAULT_WALLPAPER,
  resolveNotificationPrefs,
  resolveRetroPrefs,
  DEFAULT_NOTIFICATION_PREFS,
  resolveReferenceLineScheme,
} from '@vitale/shared';
import { supabase } from '../lib/supabase';
import { getJSON, setJSON } from '../lib/local-store';
import { useAuthStore } from './auth.store';

/** Cache local das preferências p/ restauração instantânea no boot (sem piscar) e offline. */
const PREFS_KEY = 'vitale.preferences';

interface SettingsState {
  profile: Profile | null;
  preferences: UserPreferences | null;
  loading: boolean;
  loadSettings: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<Profile, 'name' | 'avatarUrl'>>) => Promise<void>;
  updatePreferences: (patch: Partial<Omit<UserPreferences, 'userId' | 'updatedAt'>>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  profile: null,
  preferences: null,
  loading: false,

  loadSettings: async () => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;
    // Hidrata do cache local primeiro para o tema/glass aparecer instantaneamente.
    if (!get().preferences) {
      const cached = await getJSON<UserPreferences>(PREFS_KEY);
      if (cached && cached.userId === userId && !get().preferences) {
        set({ preferences: cached });
      }
    }
    set({ loading: true });
    const [profileRes, prefsRes] = await Promise.all([
      fetchProfile(supabase, userId),
      fetchUserPreferencesRow(supabase, userId),
    ]);
    const pr = prefsRes as Record<string, any> | null;
    const remotePrefs: UserPreferences | null = pr
      ? {
          userId: pr.id,
          theme: (pr.theme ?? 'system') as AppTheme,
          glassEnabled: pr.glass_enabled ?? false,
          blurIntensity: pr.blur_intensity ?? 50,
          language: pr.language ?? 'pt-BR',
          notificationsEnabled: pr.notifications_enabled ?? true,
          mapStyle: resolveMapStyle(pr.map_style),
          wallpaper: resolveWallpaper(pr.wallpaper),
          dailyReminderTime: pr.daily_reminder_time ?? undefined,
          nutritionCaloriesGoal: pr.nutrition_calories_goal ?? undefined,
          nutritionProteinG: pr.nutrition_protein_g ?? undefined,
          nutritionCarbsG: pr.nutrition_carbs_g ?? undefined,
          nutritionFatG: pr.nutrition_fat_g ?? undefined,
          trainingDaysPerWeek: pr.training_days_per_week ?? undefined,
          maxHr: pr.max_hr ?? undefined,
          weeklyActivityTargetMin: pr.weekly_activity_target_min ?? undefined,
          referenceLineScheme: resolveReferenceLineScheme(pr.reference_line_scheme),
          notificationPrefs: resolveNotificationPrefs(pr.notification_prefs),
          retroPrefs: resolveRetroPrefs(pr.retro_prefs),
          updatedAt: pr.updated_at,
        }
      : null;
    // Preferência local já hidratada (cache/memória). Pode conter uma escolha
    // recente do usuário que ainda não sincronizou para o remoto.
    const localPrefs = get().preferences;
    const localIsNewer =
      !!remotePrefs &&
      !!localPrefs &&
      localPrefs.userId === userId &&
      Date.parse(localPrefs.updatedAt) > Date.parse(remotePrefs.updatedAt);
    // Last-write-wins por timestamp: só deixamos o remoto sobrescrever quando ele
    // for mais novo. Assim uma escolha local recente (ex.: papel de parede) não é
    // revertida para o snapshot remoto/default se o upsert ainda não chegou. Sem
    // linha remota (offline/erro), preserva o que já está em memória/cache.
    const prefs: UserPreferences =
      (localIsNewer ? localPrefs : remotePrefs) ??
      localPrefs ?? {
        userId,
        theme: 'system',
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
    set({
      loading: false,
      // `null` quando o setup ainda não rodou — o mobile não cria perfil.
      profile: profileRes,
      preferences: prefs,
    });
    setJSON(PREFS_KEY, prefs);
  },

  updateProfile: async (patch) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;
    const current = get().profile;
    // Sem perfil não há o que editar: criar exige nome e nascimento, coletados
    // no setup da web. `patchProfile` também é no-op sem linha. Ver ADR 0011.
    if (!current) return;
    const next: Profile = { ...current, ...patch, updatedAt: new Date().toISOString() };
    set({ profile: next });
    await patchProfile(supabase, userId, { name: next.name, avatarUrl: next.avatarUrl ?? null });
  },

  updatePreferences: async (patch) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;
    const current = get().preferences ?? {
      userId,
      theme: 'system' as AppTheme,
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
    const next: UserPreferences = { ...current, ...patch, updatedAt: new Date().toISOString() };
    set({ preferences: next });
    // Persiste localmente na hora ("ao ativar, salvar") — independente da rede.
    await setJSON(PREFS_KEY, next);
    let upsertError: string | null = null;
    try {
      await upsertUserPreferences(supabase, userId, {
      theme: next.theme,
      glass_enabled: next.glassEnabled,
      blur_intensity: next.blurIntensity ?? 50,
      language: next.language,
      notifications_enabled: next.notificationsEnabled,
      map_style: next.mapStyle,
      wallpaper: next.wallpaper,
      daily_reminder_time: next.dailyReminderTime ?? null,
      nutrition_calories_goal: next.nutritionCaloriesGoal ?? null,
      nutrition_protein_g: next.nutritionProteinG ?? null,
      nutrition_carbs_g: next.nutritionCarbsG ?? null,
      nutrition_fat_g: next.nutritionFatG ?? null,
      training_days_per_week: next.trainingDaysPerWeek ?? null,
      max_hr: next.maxHr ?? null,
      weekly_activity_target_min: next.weeklyActivityTargetMin ?? null,
      reference_line_scheme: next.referenceLineScheme ?? null,
      notification_prefs: next.notificationPrefs ?? {},
      retro_prefs: next.retroPrefs ?? {},
      });
    } catch (e) {
      upsertError = e instanceof Error ? e.message : String(e);
    }
    // Falha de sync não derruba a escolha local (já no cache); só não fica silenciosa.
    if (upsertError) console.warn('[settings] falha ao salvar preferências no servidor:', upsertError);
  },
}));
