import { create } from 'zustand';
import {
  SEM_DADOS_DA_RETRO,
  fetchDadosDaRetro,
  localDateStr,
  buildRetrospective,
  buildRetroHighlights,
  buildRetroLede,
  buildHeatmap,
  buildTaskGrid,
  buildYearByMonth,
  retroInputDe,
  retroSince as retroSinceDate,
  type DadosDaRetro,
  type PeriodKind,
  type RetroLede,
  type Heatmap,
  type TaskGrid,
  type RetroInput,
  type RetroSummary,
  type WeekHighlight,
  type MonthBucket,
} from '@vitale/shared';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './auth.store';
import { useActivitiesStore } from './activities.store';

interface RetroState {
  loading: boolean;
  loaded: boolean;
  loadedSince: string | null;
  /**
   * O `since` cuja busca **falhou**, ou nulo. Não é mensagem de erro: é o freio do
   * pedido automático. Sem ele, soltar o `loading` numa falha faz o efeito que
   * chama `ensure` disparar de novo no mesmo quadro (`loading` é dependência
   * dele), e uma rede fora do ar vira laço quente. Quem tenta de novo é o foco da
   * tela — e o acerto o limpa.
   */
  falhouEm: string | null;

  /**
   * Os resultados crus das nove leituras, desde `loadedSince` (Story 2.2).
   *
   * **Ninguém os lê para desenhar.** A entrada de cada período sai de
   * `retroInputDe` (`@vitale/shared`), que os corta na janela **daquele** período
   * — então uma janela mais larga já carregada (o Ano, aberto antes do Mês) não
   * muda o resumo do mês, que é o que ele era antes da 2.2. A mesma conta monta a
   * entrada do script que imprime a edição fora do telefone.
   */
  dados: DadosDaRetro;

  ensure: (since: string) => Promise<void>;
  summary: (now: Date, kind: PeriodKind, offset: number) => RetroSummary;
  highlights: (now: Date, kind: PeriodKind, offset: number) => WeekHighlight[];
  /** A manchete do período — o parágrafo de abertura (spec v2 §3). */
  lede: (now: Date, kind: PeriodKind, offset: number) => RetroLede;
  /** Uma célula por dia do período exibido — genérico em N (spec v2 §4). */
  heatmap: (now: Date, kind: PeriodKind, offset: number, metric: string) => Heatmap | null;
  /** Faixa de adesão das séries diárias — uma linha por tarefa. */
  taskGrid: (now: Date, kind: PeriodKind, offset: number) => TaskGrid | null;
  yearByMonth: (now: Date, offset: number) => MonthBucket[];
}

function currentUserId(): string | undefined {
  return useAuthStore.getState().user?.id;
}

export const useRetroStore = create<RetroState>((set, get) => {
  // As atividades vêm da store delas, que carrega o histórico inteiro; as ocultas
  // saem em `retroInputDe`.
  const buildInput = (now: Date, kind: PeriodKind, offset: number): RetroInput =>
    retroInputDe(get().dados, useActivitiesStore.getState().activities(), now, kind, offset);

  return {
    loading: false,
    loaded: false,
    loadedSince: null,
    falhouEm: null,
    dados: SEM_DADOS_DA_RETRO,

    ensure: async (since) => {
      const { loading, loaded, loadedSince } = get();
      if (loading) return;
      if (loaded && loadedSince && loadedSince <= since) return;
      const userId = currentUserId();
      if (!userId) return;

      set({ loading: true });
      void useActivitiesStore.getState().load();

      // Uma busca que rejeita não pode deixar `loading` preso: a guarda de
      // reentrada lá em cima recusaria **toda** tentativa seguinte, e a tela
      // ficaria sem botão, sem explicação e sem fim de carregamento até o app
      // reiniciar — o que a rota da revista mostra como "ainda não foi escrito".
      // É a mesma forma do `health-daily.store`.
      try {
        const dados = await fetchDadosDaRetro(supabase, userId, since);
        set({ dados, loading: false, loaded: true, loadedSince: since, falhouEm: null });
      } catch {
        set({ loading: false, falhouEm: since });
      }
    },

    summary: (now, kind, offset) => buildRetrospective(buildInput(now, kind, offset)),
    highlights: (now, kind, offset) => {
      const input = buildInput(now, kind, offset);
      return buildRetroHighlights(buildRetrospective(input), input);
    },
    lede: (now, kind, offset) => {
      const input = buildInput(now, kind, offset);
      return buildRetroLede(buildRetroHighlights(buildRetrospective(input), input));
    },
    heatmap: (now, kind, offset, metric) => buildHeatmap(buildInput(now, kind, offset), metric),
    taskGrid: (now, kind, offset) =>
      buildTaskGrid({ now, kind, offset, dailyTasks: buildInput(now, kind, offset).dailyTasks }),
    yearByMonth: (now, offset) => buildYearByMonth(buildInput(now, 'year', offset)),
  };
});

/**
 * Início do fetch necessário p/ o período selecionado.
 *
 * Delega a regra ao shared (`retroSinceDate`), que cobre tanto o período anterior
 * — exigido pelos deltas — quanto a janela de análise de 90 dias, exigida pelos
 * insights cruzados. Ver docs/specs/retrospectiva/v2-jornal.md §2.1.
 */
export function retroSince(now: Date, kind: PeriodKind, offset: number): string {
  return localDateStr(retroSinceDate(now, kind, offset));
}
