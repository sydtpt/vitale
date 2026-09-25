/**
 * A rota da capa carimbada — do `rota_activity_id` gravado aos pontos que o SVG
 * desenha (Story 2.4a).
 *
 * Irmão de `useFotoDaCapa`, e pela mesma razão: `edicoes_capa` guarda **valor,
 * nunca geometria**. A capa `tracado` carimba o ponteiro da atividade, e a linha
 * que se desenha é a de hoje — se o dono corrigir a rota, a capa passa a mostrar a
 * rota corrigida, e isso está certo: o que congela é a escolha, não o traçado.
 *
 * **Sempre `fetchRouteSurface`, nunca a coluna `points`.** Ela guarda o track
 * inteiro; uma leitura assim chegou a 89 MB e 17,7 s, estourando o
 * `statement_timeout` de 8 s. O `route_overview` existe exatamente para as telas
 * que só desenham o traçado, e é o que esta porta traz.
 *
 * Os cinco estados são os de {@link LeituraDaRota}, e quem faz coisas diferentes
 * com cada um é `desenhoDaCapa`, no núcleo. O que este hook garante é que
 * **`procurando` vale já no primeiro render** em que a capa de traçado aparece: o
 * estado é derivado do ponteiro durante o render, e não num efeito. Com o efeito,
 * havia um quadro dizendo "não há rota" — e, desde que a reserva de altura existe,
 * esse quadro seria a capa nascendo baixa e pulando logo depois.
 */
import { useEffect, useState } from 'react';
import { fetchRouteSurface, type Capa, type LeituraDaRota } from '@vitale/shared';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth.store';

const NAO_PEDIDA: LeituraDaRota = { estado: 'nao-pedida' };
const PROCURANDO: LeituraDaRota = { estado: 'procurando' };
const SEM_LINHA: LeituraDaRota = { estado: 'sem-linha' };
const FALHOU: LeituraDaRota = { estado: 'falhou' };

export function useRotaDaCapa(capa: Capa | null): LeituraDaRota {
  const uid = useAuthStore((s) => s.user?.id);
  const activityId = capa?.natureza === 'tracado' ? capa.rotaActivityId : null;

  const [r, setR] = useState<LeituraDaRota>(activityId ? PROCURANDO : NAO_PEDIDA);
  /**
   * O alvo da leitura que `r` descreve. Comparar os dois **durante o render** é o
   * padrão do React para estado derivado: quando o ponteiro muda, `r` é reposto no
   * mesmo render, sem o quadro intermediário que um `useEffect` deixaria passar.
   */
  const [alvo, setAlvo] = useState<string | null>(activityId);
  if (alvo !== activityId) {
    setAlvo(activityId);
    setR(activityId ? PROCURANDO : NAO_PEDIDA);
  }

  useEffect(() => {
    // Sem sessão ainda: fica em `procurando` (a capa reserva a altura) até o uid
    // chegar do disco, e então este efeito roda de novo com ele.
    if (!activityId || !uid) return undefined;
    let vivo = true;
    void (async () => {
      try {
        const rota = await fetchRouteSurface(supabase, uid, activityId);
        if (!vivo) return;
        if (!rota) {
          // "Rota sumiu" é a linha da matriz que **não lança** — e por isso era a
          // única falha sem aviso. A capa cai para o papel com a legenda
          // carimbada; o log é o que diz por quê.
          console.warn(
            `[revista] a capa de traçado aponta para ${activityId}, que não tem linha em `
            + 'activity_routes; a capa cai para o papel.',
          );
          setR(SEM_LINHA);
          return;
        }
        // `segments` (o piso) é descartado de propósito: a capa é silhueta, não
        // mapa. Pintar o traçado por piso aqui competiria com a legenda pela
        // mesma pergunta, num desenho de 173 px onde nenhuma das duas ganharia.
        setR({ estado: 'pronta', overview: rota.overview });
      } catch (e) {
        if (!vivo) return;
        console.warn('[revista] a rota da capa não resolveu; a capa cai para o papel:', e);
        setR(FALHOU);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [activityId, uid]);

  return r;
}
