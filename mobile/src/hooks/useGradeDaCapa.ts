/**
 * A grade da capa — a contagem do núcleo sobre a memória da Retrospectiva
 * (Story 2.4a).
 *
 * **Nenhuma leitura nova do banco.** A conta sai de `entradaDaGradeDe`, que corta
 * os mesmos dados na mesma janela que o resumo usa, e o recorte por período é do
 * núcleo (`gradeDoPeriodo`).
 *
 * **Ele pede a janela**, por `useMemoriaDaRetro`, em vez de depender de quem mais
 * está montado na tela: a parede da 2.4b vai usar este hook sem a edição ao lado,
 * e uma grade que lê sem pedir devolveria as células certas com zero marcas.
 *
 * `precisa` existe para não montar entrada nenhuma quando a capa não tem grade a
 * desenhar — só a `grade` e a `tracado` (que pode cair para a grade) têm o que
 * fazer com ela. A capa de foto devolve `null` sem tocar em nada. A janela
 * continua sendo pedida do mesmo jeito: quem a garante é a tela, não o desenho.
 *
 * **A grade aparece antes de as marcas chegarem**, com as células certas e nenhuma
 * marcada — o número de células é do calendário, não do banco. É o comportamento
 * desejado: nada salta de lugar quando as marcas chegam.
 */
import { useMemo } from 'react';
import type { GradeDaCapa, TipoComEdicao } from '@vitale/shared';
import { retroSince, useRetroStore } from '../store/retro.store';
import { useMemoriaDaRetro } from './useMemoriaDaRetro';

export function useGradeDaCapa(
  kind: TipoComEdicao,
  offset: number,
  now: Date,
  precisa: boolean,
): GradeDaCapa | null {
  const gradeFn = useRetroStore((s) => s.grade);
  const since = useMemo(() => retroSince(now, kind, offset), [now, kind, offset]);
  const selo = useMemoriaDaRetro(since);

  return useMemo(
    () => (precisa ? gradeFn(now, kind, offset) : null),
    // O `selo` é a lista de dependências da memória, inteira, num número só — ver
    // `store/memoria-da-retro.ts`. `gradeFn` é estável por construção do Zustand.
    [gradeFn, precisa, now, kind, offset, selo],
  );
}
