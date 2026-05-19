import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'rt-register',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  private readonly auth = inject(AuthService);

  protected email = '';
  protected password = '';
  protected confirmPassword = '';
  protected loading = signal(false);
  protected error = signal<string | null>(null);
  protected success = signal(false);

  protected async submit(): Promise<void> {
    if (!this.email || !this.password) return;
    if (this.password !== this.confirmPassword) {
      this.error.set('As senhas não coincidem.');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    const err = await this.auth.signUp(this.email, this.password);
    if (err) {
      this.error.set(err);
    } else {
      this.success.set(true);
    }
    this.loading.set(false);
  }
}
