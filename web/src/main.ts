import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, Routes } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { AppComponent } from './app/app.component';
import { authGuard } from './app/core/auth/auth.guard';

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
    path: 'semana',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@features/semana/pages/semana-page.component').then(m => m.SemanaPageComponent),
  },
  {
    path: 'treinos',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@features/treinos/pages/treinos-page.component').then(m => m.TreinosPageComponent),
  },
  {
    path: 'alimentacao',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@features/alimentacao/pages/alimentacao-page.component').then(m => m.AlimentacaoPageComponent),
  },
  {
    path: 'compras',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@features/compras/pages/compras-page.component').then(m => m.ComprasPageComponent),
  },
  {
    path: 'casa',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@features/casa/pages/casa-page.component').then(m => m.CasaPageComponent),
  },
  {
    path: 'financas',
    canActivate: [authGuard],
    loadComponent: () =>
      import('@features/financas/pages/financas-page.component').then(m => m.FinancasPageComponent),
  },
  {
    path: 'metas',
    canActivate: [authGuard],
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
