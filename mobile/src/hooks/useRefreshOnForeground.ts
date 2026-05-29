import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/**
 * Dispara `onForeground` quando o app volta do background para `active`.
 *
 * As telas de tab ficam montadas enquanto o app está em background, então o
 * `useEffect` de carga inicial não roda de novo ao retomar — sem isto os dados
 * só atualizam num cold start. Usar junto da carga inicial, não no lugar dela.
 */
export function useRefreshOnForeground(onForeground: () => void): void {
  const cbRef = useRef(onForeground);
  cbRef.current = onForeground;

  useEffect(() => {
    let prev = AppState.currentState;
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (prev.match(/inactive|background/) && next === 'active') {
        cbRef.current();
      }
      prev = next;
    });
    return () => sub.remove();
  }, []);
}
