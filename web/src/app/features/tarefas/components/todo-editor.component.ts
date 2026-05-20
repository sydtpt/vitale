import { ChangeDetectionStrategy, Component, OnInit, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MOD, type TodoModule, type TodoRecurrence, type TodoOverduePolicy, type TodoCancelPolicy, type TodoTemplate } from '@vitale/shared';
import { TodosStore, type NewTodo } from '../data/todos.store';

type Kind = TodoRecurrence['kind'];

const MODULES: { key: TodoModule; label: string }[] = [
  { key: 'geral', label: 'Geral' },
  { key: 'casa', label: 'Casa' },
  { key: 'financas', label: 'Finanças' },
  { key: 'compras', label: 'Compras' },
  { key: 'saude', label: 'Saúde' },
];

const KINDS: { key: Kind; label: string }[] = [
  { key: 'none', label: 'Avulsa' },
  { key: 'monthly', label: 'Mensal' },
  { key: 'weekly', label: 'Semanal' },
  { key: 'yearly', label: 'Anual' },
  { key: 'after_completion', label: 'Após concluir' },
  { key: 'usage', label: 'Por uso' },
  { key: 'event', label: 'Por evento' },
  { key: 'stock', label: 'Por estoque' },
];

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

@Component({
  selector: 'rt-todo-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <div class="overlay" (click)="close.emit()">
      <div class="modal" (click)="$event.stopPropagation()">
        <h2 class="title">{{ template() ? 'Editar tarefa' : 'Nova tarefa' }}</h2>

        <label class="lbl">Nome</label>
        <input class="inp" [(ngModel)]="name" placeholder="Ex.: Pagar aluguel" />

        <label class="lbl">Módulo</label>
        <div class="chips">
          @for (m of modules; track m.key) {
            <button class="chip" [class.on]="mod === m.key" (click)="mod = m.key">{{ m.label }}</button>
          }
        </div>

        <label class="lbl">Recorrência</label>
        <div class="chips">
          @for (k of kinds; track k.key) {
            <button class="chip" [class.on]="kind === k.key" (click)="kind = k.key">{{ k.label }}</button>
          }
        </div>

        @switch (kind) {
          @case ('monthly') {
            <label class="lbl">Dia do mês</label>
            <input class="inp" type="number" [(ngModel)]="monthlyDay" />
          }
          @case ('weekly') {
            <label class="lbl">Dias da semana</label>
            <div class="chips">
              @for (w of weekdays; track $index) {
                <button class="day" [class.on]="selectedDays.includes($index)" (click)="toggleDay($index)">{{ w }}</button>
              }
            </div>
          }
          @case ('yearly') {
            <div class="row">
              <div class="col"><label class="lbl">Mês</label><input class="inp" type="number" [(ngModel)]="yearMonth" /></div>
              <div class="col"><label class="lbl">Dia</label><input class="inp" type="number" [(ngModel)]="yearDay" /></div>
            </div>
          }
          @case ('after_completion') {
            <label class="lbl">Dias após concluir</label>
            <input class="inp" type="number" [(ngModel)]="intervalDays" />
          }
          @case ('usage') {
            <div class="row">
              <div class="col"><label class="lbl">A cada</label><input class="inp" type="number" [(ngModel)]="every" /></div>
              <div class="col"><label class="lbl">Unidade</label><input class="inp" [(ngModel)]="meterUnit" /></div>
            </div>
          }
          @case ('event') {
            <label class="lbl">Evento (rótulo)</label>
            <input class="inp" [(ngModel)]="eventLabel" placeholder="Ex.: depois que chover" />
          }
          @case ('stock') {
            <label class="lbl">Item (opcional)</label>
            <input class="inp" [(ngModel)]="stockRef" placeholder="Ex.: Café" />
          }
        }

        <label class="lbl">Se não fizer no dia</label>
        <div class="chips">
          <button class="chip" [class.on]="overdue === 'carry'" (click)="overdue = 'carry'">Acumula</button>
          <button class="chip" [class.on]="overdue === 'expire'" (click)="overdue = 'expire'">Expira</button>
        </div>

        <label class="lbl">Cancelável</label>
        <div class="chips">
          <button class="chip" [class.on]="cancelPolicy === 'manual'" (click)="setCancel('manual')">Sim</button>
          <button class="chip" [class.on]="cancelPolicy === 'none'" (click)="setCancel('none')">Obrigatória</button>
          <button class="chip" [class.on]="cancelPolicy === 'auto'" (click)="setCancel('auto')">Auto</button>
        </div>

        <label class="lbl">Cor</label>
        <div class="chips">
          @for (c of colors; track c.key) {
            <button class="swatch" [class.on]="color === c.key" [style.background]="c.accent" (click)="color = c.key"></button>
          }
        </div>

        <div class="foot">
          <button class="btn ghost" (click)="close.emit()">Cancelar</button>
          <button class="btn primary" [disabled]="!valid()" (click)="onSave()">{{ template() ? 'Salvar' : 'Criar' }}</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .overlay { position: fixed; inset: 0; background: rgba(31,27,22,0.35); display: flex; align-items: center; justify-content: center; z-index: 100; }
    .modal { background: var(--surface); border-radius: 18px; padding: 24px; width: min(520px, 92vw); max-height: 88vh; overflow: auto; box-shadow: var(--shadow-card); }
    .title { font-size: 19px; font-weight: 650; color: var(--ink); margin-bottom: 8px; }
    .lbl { display: block; font-size: 12.5px; font-weight: 600; color: var(--ink-2); margin: 14px 0 6px; }
    .inp { width: 100%; border: 1px solid var(--line); border-radius: 10px; padding: 9px 12px; font-size: 14px; color: var(--ink); background: var(--surface); box-sizing: border-box; }
    .row { display: flex; gap: 12px; }
    .col { flex: 1; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip { border: 1px solid var(--line); background: var(--surface-mute); color: var(--ink-2); font-size: 13px; padding: 6px 12px; border-radius: 999px; cursor: pointer; }
    .chip.on { background: var(--primary); color: #fff; border-color: var(--primary); }
    .day { width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--line); background: var(--surface); color: var(--ink-2); font-weight: 700; cursor: pointer; }
    .day.on { background: var(--primary); color: #fff; border-color: var(--primary); }
    .swatch { width: 32px; height: 32px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; }
    .swatch.on { border-color: var(--ink); }
    .foot { display: flex; justify-content: flex-end; gap: 8px; margin-top: 22px; }
    .btn { border: none; border-radius: 10px; padding: 10px 18px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .btn.ghost { background: var(--surface-mute); color: var(--ink-2); }
    .btn.primary { background: var(--primary); color: #fff; }
    .btn.primary:disabled { opacity: 0.4; cursor: default; }
  `],
})
export class TodoEditorComponent implements OnInit {
  private readonly store = inject(TodosStore);
  readonly template = input<TodoTemplate | null>(null);
  readonly close = output<void>();
  readonly saved = output<void>();

  protected readonly modules = MODULES;
  protected readonly kinds = KINDS;
  protected readonly weekdays = WEEKDAYS;
  protected readonly colors = [
    { key: 'tarefa', accent: MOD.tarefa.accent },
    { key: 'casa', accent: MOD.casa.accent },
    { key: 'financas', accent: MOD.financas.accent },
    { key: 'compras', accent: MOD.compras.accent },
    { key: 'habito', accent: MOD.habito.accent },
    { key: 'treino', accent: MOD.treino.accent },
  ];

  protected name = '';
  protected mod: TodoModule = 'geral';
  protected kind: Kind = 'none';
  protected monthlyDay = 1;
  protected selectedDays: number[] = [];
  protected yearMonth = 1;
  protected yearDay = 1;
  protected intervalDays = 15;
  protected meterUnit = 'km';
  protected every = 5000;
  protected eventLabel = '';
  protected stockRef = '';
  protected overdue: TodoOverduePolicy = 'carry';
  protected cancelPolicy: TodoCancelPolicy = 'manual';
  protected color = 'tarefa';

  ngOnInit(): void {
    const t = this.template();
    if (!t) return;
    this.name = t.name;
    this.mod = t.module;
    this.kind = t.recurrence.kind;
    const r = t.recurrence;
    if (r.kind === 'monthly') this.monthlyDay = r.day;
    if (r.kind === 'weekly') this.selectedDays = [...r.weekdays];
    if (r.kind === 'yearly') { this.yearMonth = r.month; this.yearDay = r.day; }
    if (r.kind === 'after_completion') this.intervalDays = r.intervalDays;
    if (r.kind === 'usage') { this.meterUnit = r.meterUnit; this.every = r.every; }
    if (r.kind === 'event') this.eventLabel = r.label;
    if (r.kind === 'stock') this.stockRef = r.shopItemRef ?? '';
    this.overdue = t.overdue;
    this.cancelPolicy = t.cancelPolicy;
    this.color = t.color || 'tarefa';
  }

  protected toggleDay(d: number): void {
    this.selectedDays = this.selectedDays.includes(d)
      ? this.selectedDays.filter((x) => x !== d)
      : [...this.selectedDays, d];
  }

  protected setCancel(c: TodoCancelPolicy): void {
    this.cancelPolicy = c;
    if (c === 'auto') this.overdue = 'expire';
  }

  private buildRecurrence(): TodoRecurrence | null {
    switch (this.kind) {
      case 'none': return { kind: 'none' };
      case 'monthly': return this.monthlyDay >= 1 && this.monthlyDay <= 31 ? { kind: 'monthly', day: Number(this.monthlyDay) } : null;
      case 'weekly': return this.selectedDays.length ? { kind: 'weekly', weekdays: [...this.selectedDays].sort((a, b) => a - b) } : null;
      case 'yearly': return this.yearMonth >= 1 && this.yearMonth <= 12 && this.yearDay >= 1 && this.yearDay <= 31 ? { kind: 'yearly', month: Number(this.yearMonth), day: Number(this.yearDay) } : null;
      case 'after_completion': return this.intervalDays > 0 ? { kind: 'after_completion', intervalDays: Math.round(Number(this.intervalDays)) } : null;
      case 'usage': return this.meterUnit.trim() && this.every > 0 ? { kind: 'usage', meterUnit: this.meterUnit.trim(), every: Number(this.every) } : null;
      case 'event': return this.eventLabel.trim() ? { kind: 'event', label: this.eventLabel.trim() } : null;
      case 'stock': return { kind: 'stock', shopItemRef: this.stockRef.trim() || undefined };
    }
  }

  protected valid(): boolean {
    return this.name.trim() !== '' && this.buildRecurrence() != null;
  }

  protected async onSave(): Promise<void> {
    const recurrence = this.buildRecurrence();
    if (!this.name.trim() || !recurrence) return;
    const t = this.template();
    if (t) {
      await this.store.updateTemplate(t.id, {
        name: this.name.trim(),
        color: this.color,
        module: this.mod,
        recurrence,
        overdue: this.overdue,
        cancel_policy: this.cancelPolicy,
      });
    } else {
      const value: NewTodo = {
        name: this.name.trim(),
        icon: 'checkbox-outline',
        color: this.color,
        module: this.mod,
        recurrence,
        overdue: this.overdue,
        cancelPolicy: this.cancelPolicy,
        meter: this.kind === 'usage' ? 0 : undefined,
      };
      await this.store.createTemplate(value);
    }
    this.saved.emit();
  }
}
