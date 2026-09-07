/**
 * Quantas fotos e vídeos cada pedalada tem — o que o selo do cartão lê.
 *
 * Uma consulta só para a lista inteira, e não uma por cartão: a `FlatList`
 * monta e desmonta linhas enquanto rola, e um pedido por linha seria uma
 * rajada de requisições cujo resultado o usuário nunca chega a ver.
 *
 * O mapa vem do banco já agrupado (ver `fetchMediaCounts`), então quem não tem
 * mídia simplesmente não está nele. O cartão trata `undefined` como "sem selo",
 * que é o caso de 9 em cada 10 linhas.
 */

import { useCallback, useEffect, useState } from 'react';
import { type ActivityMediaCount, fetchMediaCounts } from '@vitale/shared';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth.store';

export function useMediaCounts(): {
  counts: Map<string, ActivityMediaCount>;
  reload: () => Promise<void>;
} {
  const userId = useAuthStore((s) => s.user?.id);
  const [counts, setCounts] = useState<Map<string, ActivityMediaCount>>(new Map());

  const reload = useCallback(async () => {
    if (!userId) {
      setCounts(new Map());
      return;
    }
    try {
      setCounts(await fetchMediaCounts(supabase));
    } catch {
      // Sem contagem a lista continua inteira — só sem selo. Falhar aqui não
      // pode tirar o Histórico do ar por causa de um adorno.
    }
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { counts, reload };
}
