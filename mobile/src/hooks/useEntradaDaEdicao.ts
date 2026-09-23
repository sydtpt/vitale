import { useCallback, useEffect, useMemo } from 'react';
import { useFocusEffect } from 'expo-router';
import { montarEntradaDaEdicao, type EntradaPacote, type PeriodKind, type RetroSummary } from '@vitale/shared';
import { useActivitiesStore } from '../store/activities.store';
import { useAuthStore } from '../store/auth.store';
import { dadosProntosParaImprimir, precisaGarantirJanela } from '../store/edicao.store';
import { retroSince, useRetroStore } from '../store/retro.store';

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
}

/**
 * A entrada da edição de um período, e a prontidão dela — o que a Retrospectiva e
 * a rota da revista precisam **igual** (Story 1.11).
 *
 * Antes da rota isto morava inline na Retrospectiva, e a rota teria de repeti-lo:
 * duas entradas montadas por dois caminhos são duas edições possíveis para o
 * mesmo período, e a que fica congelada é a de quem tocou primeiro.
 *
 * Três coisas, na ordem:
 *
 * 1. **garante a janela carregada** (`ensure(retroSince(…))`) a cada foco e sempre
 *    que `precisaGarantirJanela` diz que falta — a rota pode abrir sem a
 *    Retrospectiva ter carregado aquele período, ou enquanto ela busca uma janela
 *    mais estreita; nesse caso `ensure` sai cedo, e é o fim da busca em voo
 *    (`loading` voltando a falso) que chama de novo. Se a busca **falhou**, o
 *    pedido automático para — quem tenta de novo é o foco;
 * 2. **monta o resumo** pela store da retro, e o recalcula quando a janela
 *    carregada muda. `loaded` sozinho não bastava: ele só vira `true` uma vez, e
 *    a busca de uma janela mais larga (trocar Semana por Ano) terminava sem o
 *    resumo ser refeito — a prontidão dizia "pronto" sobre um resumo da memória
 *    anterior, e é esse resumo que a impressão congelaria;
 * 3. **monta as lápides** pela conta do núcleo, sobre os fatos do silêncio que
 *    vieram com a janela (Story 2.7) — é o que faz a lápide existir no aparelho;
 * 4. **diz se os dados estão prontos** — a mesma função que a ação confere.
 *
 * `now` vem de quem chama: é o relógio da tela, e a entrada tem de ser a mesma
 * enquanto ela estiver montada (a chave da edição sai dela).
 */
export function useEntradaDaEdicao(kind: PeriodKind, offset: number, now: Date): EntradaDaEdicao {
  const ensure = useRetroStore((s) => s.ensure);
  const summaryFn = useRetroStore((s) => s.summary);
  // A lápide (Story 2.7) sai da mesma store e da mesma conta do núcleo que o
  // script usa — se ela fosse derivada aqui, o iPhone e o Mac teriam duas.
  const lapidesFn = useRetroStore((s) => s.lapides);
  const loaded = useRetroStore((s) => s.loaded);
  const loading = useRetroStore((s) => s.loading);
  const loadedSince = useRetroStore((s) => s.loadedSince);
  // A janela que falhou: sem ela, soltar `loading` na falha faria este efeito
  // pedir de novo no mesmo quadro, e uma rede fora do ar viraria laço quente.
  const falhouEm = useRetroStore((s) => s.falhouEm);
  const atividadesLoaded = useActivitiesStore((s) => s.loaded);
  const atividadesLoading = useActivitiesStore((s) => s.loading);
  const allActs = useActivitiesStore((s) => s._all);

  // `ensure` desiste sem sessão: quando ela chega do disco, a janela é pedida de novo.
  const uid = useAuthStore((s) => s.user?.id);

  const since = useMemo(() => retroSince(now, kind, offset), [now, kind, offset]);

  useFocusEffect(useCallback(() => {
    void ensure(since);
  }, [ensure, since]));
  useEffect(() => {
    if (precisaGarantirJanela({ loaded, loading, loadedSince, falhouEm }, since)) void ensure(since);
  }, [ensure, since, loaded, loading, loadedSince, falhouEm, uid]);

  const resumo = useMemo(
    () => summaryFn(now, kind, offset),
    // `loading` e `loadedSince` entram porque são eles que mudam quando uma janela
    // nova chega; `loaded` só muda uma vez na vida da store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [summaryFn, now, kind, offset, loaded, loading, loadedSince, allActs],
  );
  const lapides = useMemo(
    () => lapidesFn(now),
    // As mesmas dependências do resumo, e pelo mesmo motivo: os fatos do silêncio
    // chegam com a janela, e é `loadedSince` que muda quando ela chega.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lapidesFn, now, loaded, loading, loadedSince],
  );
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

  return { resumo, entrada, dadosProntos };
}
