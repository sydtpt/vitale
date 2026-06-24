import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface NavItem {
  path: string;
  icon: string;
  label: string;
}

@Component({
  selector: 'rt-sidebar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  protected readonly items: NavItem[] = [
    { path: '/semana',      icon: '📅', label: 'Semana' },
    { path: '/retrospectiva', icon: '🗓️', label: 'Retrospectiva' },
    { path: '/treinos',     icon: '🏋️', label: 'Treinos' },
    { path: '/workout-history', icon: '📊', label: 'Histórico de treinos' },
    { path: '/tasks',       icon: '✅', label: 'Tarefas' },
    { path: '/habits',      icon: '🔁', label: 'Hábitos' },
    { path: '/registros',   icon: '📌', label: 'Registros' },
    { path: '/saude',       icon: '❤️', label: 'Saúde' },
    { path: '/recuperacao', icon: '🔋', label: 'Recuperação' },
    { path: '/alimentacao', icon: '🍽️', label: 'Alimentação' },
    { path: '/compras',     icon: '🛒', label: 'Compras' },
    { path: '/casa',        icon: '🏠', label: 'Casa' },
    { path: '/financas',    icon: '💰', label: 'Finanças' },
    { path: '/metas',       icon: '🎯', label: 'Metas' },
  ];

  protected readonly weekStats = [
    { l: 'Streak hábitos',  v: '12d' },
    { l: 'Pontuação média', v: '78/100' },
    { l: 'Treinos feitos',  v: '3 de 5' },
  ];
}
