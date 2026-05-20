import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, Routes } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { AppComponent } from './app/app.component';
import { authGuard } from './app/core/auth/auth.guard';
import { profileGuard } from './app/core/auth/profile.guard';

const routes: Routes = [
  { path: '', redirectTo: 'semana', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () =>
      import('./app/features/auth/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./app/features/auth/register/register.component').then(m => m.RegisterComponent),
  },
  {
    path: 'setup',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./app/features/auth/setup/setup.component').then(m => m.SetupComponent),
  },
  {
    path: 'semana',
    canActivate: [profileGuard],
    loadComponent: () =>
      import('@features/semana/pages/semana-page.component').then(m => m.SemanaPageComponent),
  },
  {
    path: 'treinos',
    canActivate: [profileGuard],
    loadComponent: () =>
      import('@features/treinos/pages/treinos-page.component').then(m => m.TreinosPageComponent),
  },
  {
    path: 'historico-treinos',
    canActivate: [profileGuard],
    loadComponent: () =>
      import('@features/historico-treinos/pages/historico-treinos-page.component').then(m => m.HistoricoTreinosPageComponent),
  },
  {
    path: 'historico-treinos/:slug',
    canActivate: [profileGuard],
    loadComponent: () =>
      import('@features/historico-treinos/pages/tipo-atividade-page.component').then(m => m.TipoAtividadePageComponent),
  },
  {
    path: 'historico-treinos/:slug/:id',
    canActivate: [profileGuard],
    loadComponent: () =>
      import('@features/historico-treinos/pages/atividade-detalhe-page.component').then(m => m.AtividadeDetalhePageComponent),
  },
  {
    path: 'habitos',
    canActivate: [profileGuard],
    loadComponent: () =>
      import('@features/habitos/pages/habitos-page.component').then(m => m.HabitosPageComponent),
  },
  {
    path: 'alimentacao',
    canActivate: [profileGuard],
    loadComponent: () =>
      import('@features/alimentacao/pages/alimentacao-page.component').then(m => m.AlimentacaoPageComponent),
  },
  {
    path: 'compras',
    canActivate: [profileGuard],
    loadComponent: () =>
      import('@features/compras/pages/compras-page.component').then(m => m.ComprasPageComponent),
  },
  {
    path: 'casa',
    canActivate: [profileGuard],
    loadComponent: () =>
      import('@features/casa/pages/casa-page.component').then(m => m.CasaPageComponent),
  },
  {
    path: 'financas',
    canActivate: [profileGuard],
    loadComponent: () =>
      import('@features/financas/pages/financas-page.component').then(m => m.FinancasPageComponent),
  },
  {
    path: 'metas',
    canActivate: [profileGuard],
    loadComponent: () =>
      import('@features/metas/pages/metas-page.component').then(m => m.MetasPageComponent),
  },
  { path: '**', redirectTo: 'login' },
];

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideAnimationsAsync(),
  ],
}).catch(err => console.error(err));
