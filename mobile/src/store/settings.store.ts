import { create } from 'zustand';
import type { UserProfile, UserPreferences, AppTheme } from '@vitale/shared';
import { supabase } from '../lib/supabase';
import { getJSON, setJSON } from '../lib/local-store';
import { useAuthStore } from './auth.store';

/** Cache local das preferências p/ restauração instantânea no boot (sem piscar) e offline. */
const PREFS_KEY = 'vitale.preferences';

interface SettingsState {
  profile: UserProfile | null;
  preferences: UserPreferences | null;
  loading: boolean;
  loadSettings: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<UserProfile, 'displayName' | 'avatarUrl'>>) => Promise<void>;
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
      supabase.from('user_profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('user_preferences').select('*').eq('id', userId).maybeSingle(),
    ]);
    // Sem linha remota (inclui offline/erro): preserva o que já está em memória/cache
    // para não sobrescrever a preferência salva com os defaults.
    const prefs: UserPreferences = prefsRes.data
      ? {
          userId: prefsRes.data.id,
          theme: (prefsRes.data.theme ?? 'system') as AppTheme,
          glassEnabled: prefsRes.data.glass_enabled ?? false,
          language: prefsRes.data.language ?? 'pt-BR',
          notificationsEnabled: prefsRes.data.notifications_enabled ?? true,
          dailyReminderTime: prefsRes.data.daily_reminder_time ?? undefined,
          nutritionCaloriesGoal: prefsRes.data.nutrition_calories_goal ?? undefined,
          nutritionProteinG: prefsRes.data.nutrition_protein_g ?? undefined,
          nutritionCarbsG: prefsRes.data.nutrition_carbs_g ?? undefined,
          nutritionFatG: prefsRes.data.nutrition_fat_g ?? undefined,
          trainingDaysPerWeek: prefsRes.data.training_days_per_week ?? undefined,
          updatedAt: prefsRes.data.updated_at,
        }
      : get().preferences ?? {
          userId,
          theme: 'system',
          glassEnabled: false,
          language: 'pt-BR',
          notificationsEnabled: true,
          updatedAt: new Date().toISOString(),
        };
    set({
      loading: false,
      profile: profileRes.data
        ? {
            id: profileRes.data.id,
            displayName: profileRes.data.display_name ?? undefined,
            avatarUrl: profileRes.data.avatar_url ?? undefined,
            updatedAt: profileRes.data.updated_at,
          }
        : { id: userId, updatedAt: new Date().toISOString() },
      preferences: prefs,
    });
    setJSON(PREFS_KEY, prefs);
  },

  updateProfile: async (patch) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;
    const current = get().profile;
    const next: UserProfile = {
      ...current,
      id: userId,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    set({ profile: next });
    await supabase.from('user_profiles').upsert({
      id: userId,
      display_name: next.displayName ?? null,
      avatar_url: next.avatarUrl ?? null,
    });
  },

  updatePreferences: async (patch) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;
    const current = get().preferences ?? {
      userId,
      theme: 'system' as AppTheme,
      glassEnabled: false,
      language: 'pt-BR',
      notificationsEnabled: true,
      updatedAt: new Date().toISOString(),
    };
    const next: UserPreferences = { ...current, ...patch, updatedAt: new Date().toISOString() };
    set({ preferences: next });
    // Persiste localmente na hora ("ao ativar, salvar") — independente da rede.
    setJSON(PREFS_KEY, next);
    await supabase.from('user_preferences').upsert({
      id: userId,
      theme: next.theme,
      glass_enabled: next.glassEnabled,
      language: next.language,
      notifications_enabled: next.notificationsEnabled,
      daily_reminder_time: next.dailyReminderTime ?? null,
      nutrition_calories_goal: next.nutritionCaloriesGoal ?? null,
      nutrition_protein_g: next.nutritionProteinG ?? null,
      nutrition_carbs_g: next.nutritionCarbsG ?? null,
      nutrition_fat_g: next.nutritionFatG ?? null,
      training_days_per_week: next.trainingDaysPerWeek ?? null,
    });
  },
}));
