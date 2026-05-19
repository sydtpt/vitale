import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { supabase } from '../supabase/supabase.client';

export type ProfileState = 'loading' | 'complete' | 'incomplete';

interface ProfileRow {
  id: string;
  name: string;
  birthdate: string;
  avatar_url: string | null;
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly auth = inject(AuthService);

  readonly state = signal<ProfileState>('loading');
  private readonly data = signal<ProfileRow | null>(null);

  readonly isComplete = computed(() => this.state() === 'complete');
  readonly displayName = computed(() => this.data()?.name ?? '');
  readonly avatarUrl = computed(() => this.data()?.avatar_url ?? null);

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

    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, birthdate, avatar_url')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      // Table may not exist yet — treat as incomplete so setup runs
      this.state.set('incomplete');
      return;
    }

    this.data.set(data ?? null);
    this.state.set(data?.name && data?.birthdate ? 'complete' : 'incomplete');
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

    const row: ProfileRow & { updated_at: string } = {
      id: user.id,
      name,
      birthdate,
      avatar_url: avatar,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('profiles').upsert(row);
    if (error) return error.message;

    this.data.set({ id: user.id, name, birthdate, avatar_url: avatar });
    this.state.set('complete');
    return null;
  }
}
