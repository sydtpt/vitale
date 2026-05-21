import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from '../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isLoading: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signInWithGoogle: () => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  loading: false,
  isLoading: true,
  error: null,

  initialize: async () => {
    const { data } = await supabase.auth.getSession();
    set({ session: data.session, user: data.session?.user ?? null, isLoading: false });

    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null });
    });
  },

  signIn: async (email, password) => {
    set({ loading: true, error: null });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    set({ loading: false });
    if (error) {
      set({ error: error.message });
      return error.message;
    }
    return null;
  },

  signInWithGoogle: async () => {
    set({ loading: true, error: null });
    const redirectTo = makeRedirectUri({ scheme: 'vitale' });
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) {
      set({ loading: false, error: error.message });
      return error.message;
    }
    const result = await WebBrowser.openAuthSessionAsync(data.url!, redirectTo);
    set({ loading: false });
    if (result.type !== 'success') return 'Login cancelado.';

    // PKCE flow: exchange the code returned in the redirect URL for a session
    const { error: sessionError } = await supabase.auth.exchangeCodeForSession(result.url);
    if (sessionError) return sessionError.message;
    return null;
  },

  signUp: async (email, password) => {
    set({ loading: true, error: null });
    const { error } = await supabase.auth.signUp({ email, password });
    set({ loading: false });
    if (error) {
      set({ error: error.message });
      return error.message;
    }
    return null;
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null });
  },
}));
