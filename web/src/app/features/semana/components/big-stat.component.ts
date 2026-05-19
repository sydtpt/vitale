import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { IconComponent } from '@core/services/icon.component';

@Component({
  selector: 'rt-big-stat',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './big-stat.component.html',
  styleUrl: './big-stat.component.scss',
})
export class BigStatComponent {
  @Input() icon = '';
  @Input() color = '#F25C2B';
  @Input() label = '';
  @Input() value: string | number = '';
  @Input() suffix?: string;
  @Input() delta?: string;
  @Input() deltaPos = true;
  @Input() sub = '';
}
