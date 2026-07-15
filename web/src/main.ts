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
    path: 'retrospectiva',
    canActivate: [profileGuard],
    loadComponent: () =>
      import('@features/retrospectiva/pages/retrospectiva-page.component').then(m => m.RetrospectivaPageComponent),
  },
  {
    path: 'treinos',
    canActivate: [profileGuard],
    loadComponent: () =>
      import('@features/treinos/pages/treinos-page.component').then(m => m.TreinosPageComponent),
  },
  {
    path: 'workout-history',
    canActivate: [profileGuard],
    loadComponent: () =>
      import('@features/workout-history/pages/workout-history-page.component').then(m => m.WorkoutHistoryPageComponent),
  },
  {
    path: 'workout-history/:slug',
    canActivate: [profileGuard],
    loadComponent: () =>
      import('@features/workout-history/pages/activity-type-page.component').then(m => m.ActivityTypePageComponent),
  },
  {
    path: 'workout-history/:slug/:id',
    canActivate: [profileGuard],
    loadComponent: () =>
      import('@features/workout-history/pages/activity-detail-page.component').then(m => m.ActivityDetailPageComponent),
  },
  {
    path: 'habits',
    canActivate: [profileGuard],
    loadComponent: () =>
      import('@features/habits/pages/habits-page.component').then(m => m.HabitsPageComponent),
  },
  {
    path: 'saude',
    canActivate: [profileGuard],
    loadComponent: () =>
      import('@features/saude/pages/saude-page.component').then(m => m.SaudePageComponent),
  },
  {
    path: 'recuperacao',
    canActivate: [profileGuard],
    loadComponent: () =>
      import('@features/recuperacao/pages/recuperacao-page.component').then(m => m.RecuperacaoPageComponent),
  },
  {
    path: 'tasks',
    canActivate: [profileGuard],
    loadComponent: () =>
      import('@features/tasks/pages/tasks-page.component').then(m => m.TasksPageComponent),
  },
  {
    path: 'registros',
    canActivate: [profileGuard],
    loadComponent: () =>
      import('@features/registros/pages/registros-page.component').then(m => m.RegistrosPageComponent),
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
  {
    path: 'conexoes',
    canActivate: [profileGuard],
    loadComponent: () =>
      import('@features/conexoes/pages/conexoes-page.component').then(m => m.ConexoesPageComponent),
  },
  { path: '**', redirectTo: 'login' },
];

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideAnimationsAsync(),
  ],
}).catch(err => console.error(err));
