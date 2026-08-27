import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { ProfileService } from '@core/auth/profile.service';

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
  private readonly profile = inject(ProfileService);
  private readonly auth = inject(AuthService);

  /**
   * A identidade vem do perfil, não de uma constante.
   *
   * O rodapé dizia "CR · Cristiano R. · Plano pessoal" em toda tela — nome de
   * protótipo, e o `ProfileService` já servia o nome de verdade três linhas
   * acima, no "Bom dia" da tela Semana. Sem perfil carregado o bloco some, em
   * vez de mostrar iniciais de ninguém.
   */
  protected readonly name = this.profile.displayName;
  protected readonly avatarUrl = this.profile.avatarUrl;
  protected readonly email = computed(() => this.auth.user()?.email ?? '');

  protected readonly initials = computed(() => {
    const parts = this.name().trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '';
    const first = parts[0][0];
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return `${first}${last}`.toUpperCase();
  });

  protected readonly items: NavItem[] = [
    { path: '/semana',      icon: '📅', label: 'Semana' },
    { path: '/retrospectiva', icon: '🗓️', label: 'Retrospectiva' },
    { path: '/treinos',     icon: '🏋️', label: 'Treinos' },
    { path: '/workout-history', icon: '📊', label: 'Histórico de treinos' },
    { path: '/tasks',       icon: '✅', label: 'Tarefas' },
    { path: '/habits',      icon: '🔁', label: 'Hábitos' },
    { path: '/registros',   icon: '📌', label: 'Registros' },
    { path: '/cultura',     icon: '📚', label: 'Cultura' },
    { path: '/saude',       icon: '❤️', label: 'Saúde' },
    { path: '/recuperacao', icon: '🔋', label: 'Recuperação' },
    { path: '/alimentacao', icon: '🍽️', label: 'Alimentação' },
    { path: '/compras',     icon: '🛒', label: 'Compras' },
    { path: '/casa',        icon: '🏠', label: 'Casa' },
    { path: '/financas',    icon: '💰', label: 'Finanças' },
    { path: '/metas',       icon: '🎯', label: 'Metas' },
    { path: '/conexoes',    icon: '🔗', label: 'Conexões' },
    { path: '/configuracoes', icon: '⚙️', label: 'Configurações' },
  ];

}
