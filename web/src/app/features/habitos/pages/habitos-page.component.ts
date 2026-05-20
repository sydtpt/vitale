import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { IconComponent } from '@core/services/icon.component';
import { HabitsStore } from '../data/habits.store';
import { HabitAnalyticsCardComponent } from '../components/habit-analytics-card.component';

@Component({
  selector: 'rt-habitos-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, IconComponent, HabitAnalyticsCardComponent],
  template: `
    <div class="page">
      @if (store.loading()) {
        <div class="state">Carregando hábitos…</div>
      } @else if (store.error()) {
        <div class="state error">Não foi possível carregar: {{ store.error() }}</div>
      } @else if (store.isEmpty()) {
        <div class="empty">
          <div class="empty-icon">
            <rt-icon name="droplet" [size]="34" color="var(--primary)" [strokeWidth]="1.8" />
          </div>
          <h2 class="empty-title">Nenhum hábito ainda</h2>
          <p class="empty-text">
            Crie contadores (água, cigarro…) no app do celular em
            <strong>Mais → Hábitos</strong>. Eles aparecem aqui com streaks, médias
            e o histórico dos últimos meses.
          </p>
        </div>
      } @else {
        <rt-page-header
          eyebrow="Hábitos"
          [title]="count() + (count() === 1 ? ' contador' : ' contadores')"
          subtitle="Adesão, streaks e médias dos seus hábitos diários"
        />
        <div class="grid">
          @for (h of store.habits(); track h.id) {
            <rt-habit-analytics-card [habit]="h" [logs]="store.logsFor(h.id)" />
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .page { padding: 24px 32px 48px; max-width: 1200px; }
    .grid {
      margin-top: 24px;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
    }
    .state { padding: 48px 0; text-align: center; font-size: 14px; color: var(--ink-2); }
    .state.error { color: var(--primary-deep); }
    .empty { max-width: 460px; margin: 80px auto 0; text-align: center; }
    .empty-icon {
      width: 72px; height: 72px; margin: 0 auto 20px;
      display: flex; align-items: center; justify-content: center;
      border-radius: 20px; background: var(--primary-soft);
    }
    .empty-title { font-size: 19px; font-weight: 650; color: var(--ink); margin-bottom: 10px; }
    .empty-text { font-size: 14px; line-height: 1.6; color: var(--ink-2); }
    .empty-text strong { color: var(--ink); font-weight: 600; }
  `],
})
export class HabitosPageComponent {
  protected readonly store = inject(HabitsStore);
  protected readonly count = computed(() => this.store.habits().length);

  constructor() {
    void this.store.load();
  }
}
