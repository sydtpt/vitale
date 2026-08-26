import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '@shared/layouts/sidebar.component';
import { AuthService } from './core/auth/auth.service';
import { ThemeService } from './core/theme/theme.service';

@Component({
  selector: 'rt-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, SidebarComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  protected readonly auth = inject(AuthService);

  /**
   * Injetado só para existir. É `providedIn: 'root'`, mas o Angular só constrói
   * um serviço quando alguém o pede — e é no construtor dele que as variáveis
   * CSS do tema são escritas no `:root`. Sem esta linha, o sistema de temas
   * inteiro fica inerte e a página cai no piso do `styles.scss`.
   */
  private readonly theme = inject(ThemeService);
}
