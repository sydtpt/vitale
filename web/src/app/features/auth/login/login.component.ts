import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'rt-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected email = '';
  protected password = '';
  protected loading = signal(false);
  protected error = signal<string | null>(null);

  constructor() {
    effect(() => {
      if (this.auth.isAuthenticated()) {
        this.router.navigate(['/semana']);
      }
    });

    const hash = window.location.hash;
    if (hash.includes('error')) {
      const params = new URLSearchParams(hash.slice(1));
      const desc = params.get('error_description');
      if (desc) this.error.set(desc.replace(/\+/g, ' '));
    }
  }

  protected async signInWithGoogle(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    const err = await this.auth.signInWithGoogle();
    if (err) this.error.set(err);
    this.loading.set(false);
  }

  protected async submit(): Promise<void> {
    if (!this.email || !this.password) return;
    this.loading.set(true);
    this.error.set(null);
    const err = await this.auth.signIn(this.email, this.password);
    if (err) this.error.set(err);
    this.loading.set(false);
  }
}
