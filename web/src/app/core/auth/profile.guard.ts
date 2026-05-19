import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs';
import { AuthService } from './auth.service';
import { ProfileService } from './profile.service';

export const profileGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const profile = inject(ProfileService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) return router.createUrlTree(['/login']);

  const state = profile.state();

  if (state === 'loading') {
    // Wait for the async profile check before deciding
    return toObservable(profile.state).pipe(
      filter(s => s !== 'loading'),
      take(1),
      map(s => (s === 'complete' ? true : router.createUrlTree(['/setup']))),
    );
  }

  return state === 'complete' ? true : router.createUrlTree(['/setup']);
};
