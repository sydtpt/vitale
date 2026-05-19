import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * <rt-icon name="check" [size]="18" color="#F25C2B" [strokeWidth]="2" />
 * Minimal inline icon set — stroke-based SVGs, all share the same 24×24 viewBox.
 */
@Component({
  selector: 'rt-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './icon.component.html',
})
export class IconComponent {
  @Input() name = '';
  @Input() size: number = 18;
  @Input() color: string = 'currentColor';
  @Input() strokeWidth: number = 1.8;
}
