import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, Routes } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { AppComponent } from './app/app.component';

const routes: Routes = [
  { path: '', redirectTo: 'semana', pathMatch: 'full' },
  {
    path: 'semana',
    loadComponent: () =>
      import('@features/semana/pages/semana-page.component').then(m => m.SemanaPageComponent),
  },
  {
    path: 'treinos',
    loadComponent: () =>
      import('@features/treinos/pages/treinos-page.component').then(m => m.TreinosPageComponent),
  },
  {
    path: 'alimentacao',
    loadComponent: () =>
      import('@features/alimentacao/pages/alimentacao-page.component').then(m => m.AlimentacaoPageComponent),
  },
  {
    path: 'compras',
    loadComponent: () =>
      import('@features/compras/pages/compras-page.component').then(m => m.ComprasPageComponent),
  },
  {
    path: 'casa',
    loadComponent: () =>
      import('@features/casa/pages/casa-page.component').then(m => m.CasaPageComponent),
  },
  {
    path: 'financas',
    loadComponent: () =>
      import('@features/financas/pages/financas-page.component').then(m => m.FinancasPageComponent),
  },
  {
    path: 'metas',
    loadComponent: () =>
      import('@features/metas/pages/metas-page.component').then(m => m.MetasPageComponent),
  },
  { path: '**', redirectTo: 'semana' },
];

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideAnimationsAsync(),
  ],
}).catch(err => console.error(err));
