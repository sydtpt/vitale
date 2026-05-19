import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'rt-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './panel.component.html',
  styleUrl: './panel.component.scss',
})
export class PanelComponent {
  @Input() title?: string;
  @Input() pad = 18;
}
