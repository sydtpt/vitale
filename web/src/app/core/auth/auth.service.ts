import { Injectable, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { inject } from '@angular/core';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../supabase/supabase.client';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly router = inject(Router);

  readonly session = signal<Session | null>(null);
  readonly user = computed(() => this.session()?.user ?? null);
  readonly isAuthenticated = computed(() => !!this.session());

  constructor() {
    supabase.auth.getSession().then(({ data }) => {
      this.session.set(data.session);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      this.session.set(session);
    });
  }

  async signInWithGoogle(): Promise<string | null> {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/semana` },
    });
    if (error) return error.message;
    return null;
  }

  async signIn(email: string, password: string): Promise<string | null> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return error.message;
    this.session.set(data.session);
    await this.router.navigate(['/semana']);
    return null;
  }

  async signUp(email: string, password: string): Promise<string | null> {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return error.message;
    return null;
  }

  async signOut(): Promise<void> {
    await supabase.auth.signOut();
    await this.router.navigate(['/login']);
  }
}
