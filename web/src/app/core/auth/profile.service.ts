import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { supabase } from '../supabase/supabase.client';
import { fetchProfile, saveProfile, type Profile } from '@vitale/shared';

export type ProfileState = 'loading' | 'complete' | 'incomplete';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly auth = inject(AuthService);

  readonly state = signal<ProfileState>('loading');
  private readonly data = signal<Profile | null>(null);

  readonly isComplete = computed(() => this.state() === 'complete');
  readonly displayName = computed(() => this.data()?.name ?? '');
  readonly avatarUrl = computed(() => this.data()?.avatarUrl ?? null);

  constructor() {
    effect(
      () => {
        const user = this.auth.user();
        if (!user) {
          this.state.set('incomplete');
          this.data.set(null);
          return;
        }
        void this.load(user.id);
      },
      { allowSignalWrites: true },
    );
  }

  private async load(userId: string): Promise<void> {
    this.state.set('loading');

    try {
      const profile = await fetchProfile(supabase, userId);
      this.data.set(profile);
      this.state.set(profile ? 'complete' : 'incomplete');
    } catch {
      // Falha de rede ou RLS: cai para o setup em vez de travar o app. Não é
      // mais "tabela pode não existir" — ela é versionada desde a ADR 0011.
      this.data.set(null);
      this.state.set('incomplete');
    }
  }

  /** avatarDataUrl: base64 already resized by caller; null = use Google avatar URL */
  async save(name: string, birthdate: string, avatarDataUrl?: string): Promise<string | null> {
    const user = this.auth.user();
    if (!user) return 'Usuário não autenticado';

    // Prefer uploaded avatar; fall back to Google OAuth photo
    const meta = user.user_metadata;
    const avatar = avatarDataUrl
      ?? meta?.['avatar_url']
      ?? meta?.['picture']
      ?? null;

    try {
      await saveProfile(supabase, { userId: user.id, name, birthdate, avatarUrl: avatar });
    } catch (e) {
      return e instanceof Error ? e.message : 'Falha ao salvar o perfil';
    }

    this.data.set({ userId: user.id, name, birthdate, avatarUrl: avatar ?? undefined });
    this.state.set('complete');
    return null;
  }
}
