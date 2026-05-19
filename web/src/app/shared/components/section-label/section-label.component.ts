import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'rt-section-label',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './section-label.component.html',
  styleUrl: './section-label.component.scss',
})
export class SectionLabelComponent {
  @Input() right?: string;
}
