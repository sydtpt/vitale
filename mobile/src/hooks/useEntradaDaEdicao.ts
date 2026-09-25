import { useMemo } from 'react';
import { montarEntradaDaEdicao, type EntradaPacote, type PeriodKind, type RetroSummary } from '@vitale/shared';
import { useActivitiesStore } from '../store/activities.store';
import { dadosProntosParaImprimir } from '../store/edicao.store';
import { retroSince, useRetroStore } from '../store/retro.store';
import { useMemoriaDaRetro } from './useMemoriaDaRetro';

export interface EntradaDaEdicao {
  /** O resumo do período — o mesmo que a Retrospectiva desenha. */
  readonly resumo: RetroSummary;
  /**
   * O que o núcleo recebe para montar os pacotes: o resumo, o relógio e as
   * lápides — as métricas que pararam de chegar (Story 2.7).
   */
  readonly entrada: EntradaPacote;
  /**
   * Os dados que a edição narra já chegaram (`dadosProntosParaImprimir`). Falso:
   * nada que escreve aparece, nem desabilitado.
   */
  readonly dadosProntos: boolean;
  /**
   * O **selo da memória** (`useMemoriaDaRetro`): a lista de invalidação inteira
   * num número, que sobe quando a memória da Retrospectiva muda.
   *
   * Sai daqui porque quem deriva **mais coisa** da mesma memória precisa dele — o
   * postal da semana (Story 3.1) memoiza os destaques, e sem o selo eles ficariam
   * congelados na primeira janela carregada, exatamente como o resumo ficava
   * antes da 2.4a. A alternativa era chamar `useMemoriaDaRetro` uma segunda vez
   * na mesma tela: dois `useFocusEffect` pedindo a mesma janela, e dois selos
   * contando em separado o mesmo evento.
   */
  readonly selo: number;
}

/**
 * A entrada da edição de um período, e a prontidão dela — o que a Retrospectiva e
 * a rota da revista precisam **igual** (Story 1.11).
 *
 * Antes da rota isto morava inline na Retrospectiva, e a rota teria de repeti-lo:
 * duas entradas montadas por dois caminhos são duas edições possíveis para o
 * mesmo período, e a que fica congelada é a de quem tocou primeiro.
 *
 * Quatro coisas, na ordem:
 *
 * 1. **garante a janela carregada e pega o selo dela** — `useMemoriaDaRetro`, que
 *    desde a 2.4a é quem chama `ensure` a cada foco e sempre que
 *    `precisaGarantirJanela` diz que falta. Ele saiu daqui porque a grade da capa
 *    precisa do mesmo par (pedir + saber quando o que se derivou ficou velho), e
 *    porque a lista de invalidação, escrita à mão nos dois lugares, congelava a
 *    conta em silêncio quando alguém tirava um item dela;
 * 2. **monta o resumo** pela store da retro, e o recalcula quando o selo muda.
 *    `loaded` sozinho não bastava: ele só vira `true` uma vez, e a busca de uma
 *    janela mais larga (trocar Semana por Ano) terminava sem o resumo ser
 *    refeito — a prontidão dizia "pronto" sobre um resumo da memória anterior, e é
 *    esse resumo que a impressão congelaria;
 * 3. **monta as lápides** pela conta do núcleo, sobre os fatos do silêncio que
 *    vieram com a janela (Story 2.7) — é o que faz a lápide existir no aparelho;
 * 4. **diz se os dados estão prontos** — a mesma função que a ação confere.
 *
 * `now` vem de quem chama: é o relógio da tela, e a entrada tem de ser a mesma
 * enquanto ela estiver montada (a chave da edição sai dela).
 */
export function useEntradaDaEdicao(kind: PeriodKind, offset: number, now: Date): EntradaDaEdicao {
  const summaryFn = useRetroStore((s) => s.summary);
  // A lápide (Story 2.7) sai da mesma store e da mesma conta do núcleo que o
  // script usa — se ela fosse derivada aqui, o iPhone e o Mac teriam duas.
  const lapidesFn = useRetroStore((s) => s.lapides);
  const loaded = useRetroStore((s) => s.loaded);
  const loading = useRetroStore((s) => s.loading);
  const loadedSince = useRetroStore((s) => s.loadedSince);
  const atividadesLoaded = useActivitiesStore((s) => s.loaded);
  const atividadesLoading = useActivitiesStore((s) => s.loading);

  const since = useMemo(() => retroSince(now, kind, offset), [now, kind, offset]);

  /**
   * Garante a janela e devolve o **selo** da memória — a lista de invalidação
   * inteira num número (Story 2.4a). Ela era repetida à mão aqui, com o
   * `exhaustive-deps` desligado, e tirar um item congelava o resumo em silêncio;
   * agora a regra é pura e tem teste (`store/memoria-da-retro.ts`).
   */
  const selo = useMemoriaDaRetro(since);

  const resumo = useMemo(() => summaryFn(now, kind, offset), [summaryFn, now, kind, offset, selo]);
  const lapides = useMemo(() => lapidesFn(now), [lapidesFn, now, selo]);
  // **Pela função do núcleo, nunca por um literal aqui.** Este hook não é
  // executado por teste nenhum; um literal deixaria "esqueci as lápides" passar
  // com a suíte verde. `montarEntradaDaEdicao` é a mesma composição que o script
  // usa, e o teste do contrato a chama.
  const entrada = useMemo<EntradaPacote>(
    () => montarEntradaDaEdicao(resumo, now, lapides),
    [resumo, now, lapides],
  );
  const dadosProntos = useMemo(
    () => dadosProntosParaImprimir(
      { loaded, loading, loadedSince },
      { loaded: atividadesLoaded, loading: atividadesLoading },
      since,
    ),
    [loaded, loading, loadedSince, atividadesLoaded, atividadesLoading, since],
  );

  return { resumo, entrada, dadosProntos, selo };
}
