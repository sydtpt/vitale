/**
 * A grade da capa — a contagem do núcleo sobre a memória da Retrospectiva
 * (Story 2.4a).
 *
 * **Nenhuma leitura nova do banco.** A conta sai de `entradaDaGradeDe`, que corta
 * os mesmos dados na mesma janela que o resumo usa, e o recorte por período é do
 * núcleo (`gradeDoPeriodo`).
 *
 * **Ele pede a janela**, por `useMemoriaDaRetro`, em vez de depender de quem mais
 * está montado na tela: uma grade que lê sem pedir devolveria as células certas
 * com zero marcas.
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
  const since = useMemo(() => retroSince(now, kind, offset), [now, kind, offset]);
  // Pede a janela do período que esta tela mostra, e devolve o selo da memória.
  const selo = useMemoriaDaRetro(since);
  return useGradeDeUmPeriodo(kind, offset, now, precisa, selo);
}

/**
 * A grade de **um ladrilho da parede** (Story 2.4b) — a mesma contagem, com o selo
 * vindo de fora e **sem pedir janela nenhuma**.
 *
 * ## Por que ele não pode chamar `useMemoriaDaRetro`
 *
 * Porque `ensure(since)` **alarga** a janela da Retrospectiva, e a parede desce
 * até junho de 2023. Um ladrilho que pedisse a janela dele transformaria a
 * rolagem num gatilho de busca: chegar em 2023 dispararia a leitura do acervo
 * inteiro — milhares de linhas de `health_daily`, noites, hábitos — para desenhar
 * quadradinhos. Quem pede a janela é a parede, **uma vez**, pelo período mais
 * recente, e é dela que vem o `selo`.
 *
 * ## O que isso custa, declarado
 *
 * As atividades vêm do acervo **inteiro** (a store delas carrega tudo), então a
 * textura que a parede existe para mostrar está lá em 2023 como em 2026. Os
 * **registros**, não: eles só existem dentro da janela carregada, e num mês
 * antigo a célula de um dia que teve só registro sai vazia. É a mesma degradação
 * que a 2.4a já declarou para a grade antes das marcas chegarem — células certas,
 * marcas em falta —, e a alternativa seria a rolagem baixar o histórico todo.
 *
 * `offset` nulo é o período cujo início não é começo de mês: sem ele não há
 * período a contar, e a capa cai para o papel em vez de desenhar outro mês.
 */
export function useGradeDoLadrilho(
  offset: number | null,
  now: Date,
  precisa: boolean,
  selo: number,
): GradeDaCapa | null {
  return useGradeDeUmPeriodo('month', offset, now, precisa, selo);
}

/** A contagem, e só ela — o que os dois de cima compartilham. */
function useGradeDeUmPeriodo(
  kind: TipoComEdicao,
  offset: number | null,
  now: Date,
  precisa: boolean,
  selo: number,
): GradeDaCapa | null {
  const gradeFn = useRetroStore((s) => s.grade);
  return useMemo(
    () => (precisa && offset !== null ? gradeFn(now, kind, offset) : null),
    // O `selo` é a lista de dependências da memória, inteira, num número só — ver
    // `store/memoria-da-retro.ts`. `gradeFn` é estável por construção do Zustand.
    [gradeFn, precisa, now, kind, offset, selo],
  );
}
