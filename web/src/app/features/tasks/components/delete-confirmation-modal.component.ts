import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

@Component({
  selector: 'rt-delete-confirmation-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './delete-confirmation-modal.component.html',
  styleUrl: './delete-confirmation-modal.component.scss',
})
export class DeleteConfirmationModalComponent {
  readonly isOpen = signal(false);
  private resolveCallback: ((confirmed: boolean) => void) | null = null;

  open(): Promise<boolean> {
    this.isOpen.set(true);
    return new Promise((resolve) => {
      this.resolveCallback = resolve;
    });
  }

  confirm(): void {
    this.close(true);
  }

  cancel(): void {
    this.close(false);
  }

  private close(confirmed: boolean): void {
    this.isOpen.set(false);
    this.resolveCallback?.(confirmed);
    this.resolveCallback = null;
  }
}
