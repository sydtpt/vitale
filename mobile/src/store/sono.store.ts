import { create } from 'zustand';
import {
  fetchDailyRatingScores,
  fetchDailyRatingsSince,
  fetchSleepPeriodsSince,
  localDateStr,
  type SleepPeriod,
} from '@vitale/shared';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './auth.store';

/**
 * Janela em memória, em dias. O timing chart usa 14, o relógio de vigília ~30,
 * e o par nota × medição quer o máximo que houver — 90 é a mesma janela de
 * análise da Retrospectiva (`ANALYSIS_WINDOW_DAYS`), pelo mesmo motivo: abaixo
 * disso o `n` por nota fica pequeno demais para mostrar.
 */
export const SONO_WINDOW_DAYS = 90;

interface SonoState {
  /** Períodos da janela, em ordem cronológica (mais antigo primeiro). */
  periods: SleepPeriod[];
  /** Nota 1–5 dada ao acordar, por dia de acordar. */
  sleepRatings: Record<string, number>;
  /**
   * O primeiro dia que `sleepRatings` cobre, ou `null` antes do `load()`.
   *
   * Existe porque o mapa de notas é **parcial de propósito** (90 dias), e quem o
   * lê não tem como distinguir "não há nota nesse dia" de "não carreguei esse
   * dia". Sem este campo, a percepção de um período de 12 meses contaria 89 notas
   * de 365 noites e chamaria isso de dado.
   */
  ratingsSince: string | null;
  loading: boolean;
  loaded: boolean;
  error?: string;
  /**
   * A última falha ao **estender** a janela de notas, ou `undefined`.
   *
   * Separado do `error` porque a consequência é outra: o `error` é "não há sono
   * nenhum carregado", e este é "a contagem está de pé, mas a percepção conta menos
   * dias do que a janela pede". Sem ele, uma consulta que quebrou e um período sem
   * nota nenhuma produzem a mesma tela.
   */
  notasError?: string;

  load: () => Promise<void>;
  /**
   * Estende o mapa de notas para trás, até `dia`, sem mexer em
   * `SONO_WINDOW_DAYS` — que é lido por outros consumidores e continua sendo a
   * janela padrão.
   *
   * É o que a `/sono/saude` chama quando a janela escolhida é mais antiga que o
   * que está em memória (`12m` e `ano` são os casos reais). Não faz nada quando o
   * dia já está coberto, então a tela pode chamá-la a cada troca de janela.
   */
  carregarNotasDesde: (dia: string) => Promise<void>;
  /**
   * Só a noite de hoje — o que a Hoje pede ao lado da nota (spec Sono CAP-8).
   * Uma consulta por `wake_day`, não o histórico: os 288 períodos com segmentos
   * de estágio pesam ~380 kB e são da aba Sono, que os carrega ao abrir. Mescla
   * em `periods` sem duplicar e **não** marca `loaded`, para a aba seguir
   * carregando o resto quando for aberta.
   */
  loadToday: () => Promise<void>;
  /** O período de um dia de acordar — a chave de junção com a nota. */
  byDay: (wakeDay: string) => SleepPeriod | undefined;
}

function sinceDay(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - (days - 1));
  return localDateStr(d);
}

export const useSonoStore = create<SonoState>((set, get) => ({
  periods: [],
  sleepRatings: {},
  ratingsSince: null,
  loading: false,
  loaded: false,

  async load() {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;
    set({ loading: true, error: undefined });
    try {
      // Períodos: o histórico inteiro — as subviews navegam por ano e por
      // 12 meses, e a tabela tem no máximo o backfill de 500 dias (~1 linha/dia).
      // Notas: só a janela de análise; o par nota × medição do /sono usa 90 dias.
      const desde = sinceDay(SONO_WINDOW_DAYS);
      const [periods, ratings] = await Promise.all([
        fetchSleepPeriodsSince(supabase, userId, '2000-01-01'),
        fetchDailyRatingsSince(supabase, userId, desde),
      ]);
      const doBanco: Record<string, number> = {};
      for (const r of ratings) if (r.sleepQuality != null) doBanco[r.day] = r.sleepQuality;
      // **Mescla, não substitui.** A tela dispara `load()` e `carregarNotasDesde()`
      // no mesmo commit, e o `load()` é o mais lento dos dois (ele também traz o
      // histórico inteiro de períodos). Substituir aqui jogava fora as notas de 400
      // dias que a extensão já tinha trazido — e a tela **não se recuperava**: o
      // `desde` da janela sai de `rangeBounds`, que não depende de `periods`, então o
      // efeito não rodava de novo e a percepção de `12m` ficava contando 90 dias.
      set((s) => ({
        periods,
        sleepRatings: { ...s.sleepRatings, ...doBanco },
        // A janela só cresce, aqui também: a extensão que chegou primeiro cobre
        // mais do que estes 90 dias.
        ratingsSince: s.ratingsSince !== null && s.ratingsSince < desde ? s.ratingsSince : desde,
        loading: false,
        loaded: true,
      }));
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : 'Erro ao carregar o sono.' });
    }
  },

  async carregarNotasDesde(dia) {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;
    const { ratingsSince } = get();
    // Já coberto. A comparação é de string porque o dia é `AAAA-MM-DD`, que ordena
    // lexicograficamente igual ao calendário.
    if (ratingsSince !== null && dia >= ratingsSince) return;
    try {
      // Só as notas, sem a anotação: o que a contagem lê é a nota do sono, e
      // puxar o texto de 365 dias para contar a percepção seria pagar por campo
      // que nenhuma tela desta janela mostra.
      const notas = await fetchDailyRatingScores(supabase, userId, dia);
      set((s) => {
        const sleepRatings = { ...s.sleepRatings };
        for (const n of notas) if (n.sleepQuality != null) sleepRatings[n.day] = n.sleepQuality;
        // A janela só cresce: duas telas pedindo janelas diferentes não podem
        // fazer a cobertura encolher na volta da mais recente.
        const desde = s.ratingsSince === null || dia < s.ratingsSince ? dia : s.ratingsSince;
        return { sleepRatings, ratingsSince: desde, notasError: undefined };
      });
    } catch (e) {
      // A contagem degrada sozinha: sem as notas antigas, a percepção conta o que
      // há — um erro aqui não pode apagar a contagem das outras quatro dimensões.
      //
      // Mas **degradar calado é o defeito**: sem registro, "a consulta quebrou" e
      // "você não deu nota" viram a mesma tela. O erro fica no estado para quem
      // quiser distinguir; nenhuma tela o desenha ainda.
      set({ notasError: e instanceof Error ? e.message : 'Erro ao carregar as notas do período.' });
    }
  },

  async loadToday() {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;
    try {
      const today = await fetchSleepPeriodsSince(supabase, userId, localDateStr());
      if (today.length === 0) return;
      set((s) => {
        // `onset_at` identifica o período; o que já estava (de um `load()`
        // anterior ou de um foreground) sai antes de entrar de novo.
        const fresh = new Set(today.map((p) => p.onsetAt));
        const kept = s.periods.filter((p) => !fresh.has(p.onsetAt));
        return { periods: [...kept, ...today].sort((a, b) => a.onsetAt.localeCompare(b.onsetAt)) };
      });
    } catch {
      // A Hoje não tem onde mostrar erro de sono: o espaço fica em branco
      // (decisão D2 da CAP-8) e a aba Sono, com o `load()` inteiro, reporta o dela.
    }
  },

  byDay(wakeDay) {
    // Mais recente primeiro: num dia com dois períodos, o que acordou por último
    // é a "noite" que a tela chama pelo dia.
    return [...get().periods].reverse().find((p) => p.wakeDay === wakeDay);
  },
}));
