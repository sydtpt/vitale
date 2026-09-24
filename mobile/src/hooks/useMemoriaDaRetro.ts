/**
 * A janela da Retrospectiva **garantida**, e o selo do que ela carregou (Story 2.4a).
 *
 * Dois trabalhos que andavam separados e não podiam:
 *
 * 1. **pedir a janela** — `ensure(since)` a cada foco e sempre que
 *    `precisaGarantirJanela` disser que falta. Quem fazia isso era só
 *    `useEntradaDaEdicao`; a grade da capa **lia** a memória e nunca a pedia, e
 *    funcionava por acaso, porque os dois estão montados na mesma tela. Reusada
 *    pela parede (2.4b), como o cabeçalho dela promete, a grade devolveria as
 *    células certas e **zero marcas** — indistinguível de um período vazio, que é
 *    justamente o que a capa da grade existe para mostrar;
 * 2. **dizer quando o que se derivou dela ficou velho** — o selo, que é um número
 *    e sobe quando {@link mesmaMemoria} diz que a memória mudou. Quem memoiza
 *    depende dele e de mais nada, em vez de repetir à mão uma lista de cinco
 *    campos com o `exhaustive-deps` desligado.
 *
 * O selo é calculado **durante o render**, num `ref`: é o padrão de cache
 * derivado, e é idempotente — duas passadas sobre a mesma memória sobem o número
 * uma vez só, porque a primeira já guardou a leitura.
 */
import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { useActivitiesStore } from '../store/activities.store';
import { useAuthStore } from '../store/auth.store';
import { precisaGarantirJanela } from '../store/edicao.store';
import { mesmaMemoria, type MemoriaDaRetro } from '../store/memoria-da-retro';
import { useRetroStore } from '../store/retro.store';

export function useMemoriaDaRetro(since: string): number {
  const ensure = useRetroStore((s) => s.ensure);
  const loaded = useRetroStore((s) => s.loaded);
  const loading = useRetroStore((s) => s.loading);
  const loadedSince = useRetroStore((s) => s.loadedSince);
  const dados = useRetroStore((s) => s.dados);
  // A janela que falhou: sem ela, soltar `loading` na falha faria o efeito abaixo
  // pedir de novo no mesmo quadro, e uma rede fora do ar viraria laço quente.
  const falhouEm = useRetroStore((s) => s.falhouEm);
  const atividades = useActivitiesStore((s) => s._all);
  // `ensure` desiste sem sessão: quando ela chega do disco, a janela é pedida de novo.
  const uid = useAuthStore((s) => s.user?.id);

  useFocusEffect(useCallback(() => {
    void ensure(since);
  }, [ensure, since]));
  useEffect(() => {
    if (precisaGarantirJanela({ loaded, loading, loadedSince, falhouEm }, since)) void ensure(since);
  }, [ensure, since, loaded, loading, loadedSince, falhouEm, uid]);

  const memoria: MemoriaDaRetro = { loaded, loading, loadedSince, dados, atividades };
  const anterior = useRef(memoria);
  const selo = useRef(0);
  if (!mesmaMemoria(anterior.current, memoria)) {
    anterior.current = memoria;
    selo.current += 1;
  }
  return selo.current;
}
