import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { IconComponent } from '@core/services/icon.component';
import { FINANCAS, COMPRAS_RECORR, CASA_TAREFAS, METAS } from '@core/models/mock-data';

@Component({
  selector: 'rt-spend-by-category',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './spend-by-category.component.html',
  styleUrl: './spend-by-category.component.scss',
})
export class SpendByCategoryComponent {
  protected readonly cats = FINANCAS.byCategory;
  private readonly total = this.cats.reduce((s, c) => s + c.amount, 0);
  percent(a: number) { return Math.round((a / this.total) * 100); }
}

@Component({
  selector: 'rt-recurring-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './recurring-list.component.html',
  styleUrl: './recurring-list.component.scss',
})
export class RecurringListComponent {
  protected readonly items = COMPRAS_RECORR;
}

@Component({
  selector: 'rt-casa-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './casa-list.component.html',
  styleUrl: './casa-list.component.scss',
})
export class CasaListComponent {
  protected readonly items = CASA_TAREFAS;
}

@Component({
  selector: 'rt-metas-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './metas-list.component.html',
  styleUrl: './metas-list.component.scss',
})
export class MetasListComponent {
  @Input() compact = false;
  protected readonly items = METAS;
}
