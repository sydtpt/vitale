import { useCallback, useEffect, useState } from 'react';
import { msUntilSolarChange, solarScheme, type SolarScheme } from '@vitale/shared';
import { useRefreshOnForeground } from '../hooks/useRefreshOnForeground';

/**
 * Esquema claro/escuro seguindo o sol, para a preferência `solar`.
 *
 * A conta mora no núcleo (`astro/solar-scheme`) e é pura; o que este hook
 * acrescenta é o **quando reconsultar**, que é o que o React Native complica:
 *
 * - **um timer até a próxima virada**, e não uma varredura de minuto em minuto.
 *   São dois despertares por dia em vez de 1.440;
 * - **recálculo ao voltar ao primeiro plano**, porque o timer não roda com o
 *   app suspenso. Sem isto, quem abre o app às 22h depois de tê-lo deixado
 *   aberto às 15h vê a tela clara até o próximo timer disparar — que é o modo
 *   de falha mais provável desta feature, e o mais silencioso;
 * - **`enabled`**, para o timer não existir quando a preferência é outra. Um
 *   `setTimeout` de seis horas segurando um componente é caro à toa.
 *
 * Devolve `null` quando o fuso do aparelho não tem coordenada (`UTC`,
 * `Etc/GMT+3`) — quem chama cai no esquema do sistema operacional.
 */
export function useSolarScheme(enabled: boolean): SolarScheme | null {
  const [state, setState] = useState<SolarScheme | null>(() =>
    enabled ? solarScheme() : null,
  );

  const recompute = useCallback(() => {
    setState(enabled ? solarScheme() : null);
  }, [enabled]);

  // Voltar do background é o que salva o caso do app deixado aberto: o fuso
  // pode ter mudado no avião, o relógio pode ter sido acertado, e o timer com
  // certeza não correu.
  useRefreshOnForeground(recompute);

  useEffect(() => {
    if (!enabled) {
      setState(null);
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    let vivo = true;

    // Reagenda a si mesmo: cada virada devolve a próxima. Recalcula antes de
    // agendar para não confiar num `until` que já pode ter envelhecido — o
    // efeito também roda ao (re)montar.
    const agendar = () => {
      const atual = solarScheme();
      setState(atual);
      timer = setTimeout(() => {
        if (vivo) agendar();
      }, msUntilSolarChange(atual));
    };
    agendar();

    return () => {
      vivo = false;
      clearTimeout(timer);
    };
  }, [enabled]);

  return state;
}
