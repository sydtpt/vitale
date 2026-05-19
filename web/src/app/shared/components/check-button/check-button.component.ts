import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { IconComponent } from '@core/services/icon.component';

@Component({
  selector: 'rt-check-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './check-button.component.html',
  styleUrl: './check-button.component.scss',
})
export class CheckButtonComponent {
  @Input() checked = false;
  @Input() small = false;
}
