import { createClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

// Custom lock bypasses the Navigator LockManager, which fails during OAuth
// redirects when two page contexts try to acquire the same lock simultaneously.
const noopLock = <T>(_name: string, _timeout: number, fn: () => Promise<T>) => fn();

export const supabase = createClient(
  environment.supabaseUrl,
  environment.supabaseAnonKey,
  {
    auth: {
      flowType: 'pkce',
      lock: noopLock,
    },
  }
);
