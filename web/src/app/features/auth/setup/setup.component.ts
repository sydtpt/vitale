import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { ProfileService } from '../../../core/auth/profile.service';

@Component({
  selector: 'rt-setup',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  templateUrl: './setup.component.html',
  styleUrl: './setup.component.scss',
})
export class SetupComponent {
  private readonly auth = inject(AuthService);
  private readonly profile = inject(ProfileService);
  private readonly router = inject(Router);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  protected name = signal('');
  protected birthdate = signal('');
  /** URL shown in the avatar circle — Google URL or local base64 preview */
  protected avatarPreview = signal<string | null>(null);
  /** Resized base64 to send to ProfileService; null = use existing Google avatar */
  protected avatarDataUrl = signal<string | null>(null);
  protected loading = signal(false);
  protected error = signal<string | null>(null);

  constructor() {
    if (this.profile.isComplete()) {
      this.router.navigate(['/semana']);
      return;
    }

    const user = this.auth.user();
    if (user) {
      const meta = user.user_metadata;
      const googleName = meta?.['full_name'] ?? meta?.['name'] ?? '';
      if (googleName) this.name.set(googleName);
    }

    const existingAvatar = this.profile.avatarUrl();
    if (existingAvatar) this.avatarPreview.set(existingAvatar);
  }

  protected triggerUpload(): void {
    this.fileInput.nativeElement.click();
  }

  protected onAvatarError(): void {
    // Google avatar URL may be blocked or expired — fall back to placeholder
    this.avatarPreview.set(null);
  }

  protected onFileChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.resizeAndPreview(file);
  }

  private resizeAndPreview(file: File): void {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      const MAX = 128;
      const scale = Math.min(MAX / img.width, MAX / img.height, 1);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(objectUrl);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      this.avatarPreview.set(dataUrl);
      this.avatarDataUrl.set(dataUrl);
    };

    img.src = objectUrl;
  }

  protected async logout(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigate(['/login']);
  }

  protected async submit(): Promise<void> {
    const name = this.name().trim();
    const birthdate = this.birthdate();
    if (!name || !birthdate) return;

    this.loading.set(true);
    this.error.set(null);

    const err = await this.profile.save(name, birthdate, this.avatarDataUrl() ?? undefined);

    if (err) {
      this.error.set(err);
      this.loading.set(false);
      return;
    }

    await this.router.navigate(['/semana']);
  }
}
