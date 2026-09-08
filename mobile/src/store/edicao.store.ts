import { create } from 'zustand';
import type { EntradaPacote, Edicao, Problema } from '@vitale/shared';
import { useAuthStore } from './auth.store';
import { buscarEdicao, gerarEdicao } from '../lib/edicao-ia';

/**
 * As edições impressas da Retrospectiva (ADRs 0038 e 0040).
 *
 * Uma edição por período fechado, guardada por chave `tipo|inicio|fim`. Duas
 * regras de comportamento que a tela herda sem ter que saber:
 *
 * - **Nunca gera sozinha.** Abrir a Retrospectiva lê o que já existe; imprimir
 *   custa dinheiro e é o usuário quem manda. Sem isso, folhear seis meses de
 *   histórico dispararia seis chamadas pagas sem ninguém pedir.
 * - **Nunca gera período em curso.** Quem decide é o núcleo (`periodoFechado`);
 *   a store só repassa o estado `aberto`.
 */
type EstadoEdicao =
  | { fase: 'vazio' }
  | { fase: 'carregando' }
  | { fase: 'gerando' }
  | { fase: 'pronta'; edicao: Edicao }
  | { fase: 'aberto' }
  | { fase: 'reprovada'; problemas: Problema[] }
  | { fase: 'erro'; mensagem: string };

interface EdicaoState {
  porPeriodo: Record<string, EstadoEdicao>;
  /** Lê a edição já impressa. Não chama o modelo, não gasta. */
  carregar: (entrada: EntradaPacote) => Promise<void>;
  /** Imprime a edição. Só a pedido — esta é a chamada que custa. */
  gerar: (entrada: EntradaPacote) => Promise<void>;
  estado: (entrada: EntradaPacote) => EstadoEdicao;
}

/** `month|2026-08-01|2026-08-31` — a mesma chave primária da tabela. */
function chaveDe(e: EntradaPacote): string {
  const r = e.resumo;
  return `${r.kind}|${r.startISO}|${r.endISO}`;
}

function userId(): string | undefined {
  return useAuthStore.getState().user?.id;
}

export const useEdicaoStore = create<EdicaoState>((set, get) => ({
  porPeriodo: {},

  estado: (entrada) => get().porPeriodo[chaveDe(entrada)] ?? { fase: 'vazio' },

  carregar: async (entrada) => {
    const uid = userId();
    if (!uid) return;
    const chave = chaveDe(entrada);
    // Já resolvida ou em voo: não repete. A tela chama isto a cada foco.
    const atual = get().porPeriodo[chave];
    if (atual && atual.fase !== 'vazio' && atual.fase !== 'erro') return;

    set((s) => ({ porPeriodo: { ...s.porPeriodo, [chave]: { fase: 'carregando' } } }));
    try {
      const edicao = await buscarEdicao(uid, entrada);
      set((s) => ({
        porPeriodo: {
          ...s.porPeriodo,
          [chave]: edicao ? { fase: 'pronta', edicao } : { fase: 'vazio' },
        },
      }));
    } catch (e) {
      set((s) => ({
        porPeriodo: {
          ...s.porPeriodo,
          [chave]: { fase: 'erro', mensagem: e instanceof Error ? e.message : String(e) },
        },
      }));
    }
  },

  gerar: async (entrada) => {
    const uid = userId();
    if (!uid) return;
    const chave = chaveDe(entrada);
    if (get().porPeriodo[chave]?.fase === 'gerando') return;

    set((s) => ({ porPeriodo: { ...s.porPeriodo, [chave]: { fase: 'gerando' } } }));
    const r = await gerarEdicao(uid, entrada);
    const proximo: EstadoEdicao =
      r.estado === 'ok' ? { fase: 'pronta', edicao: r.edicao }
        : r.estado === 'aberto' ? { fase: 'aberto' }
          : r.estado === 'reprovado' ? { fase: 'reprovada', problemas: r.problemas }
            : { fase: 'erro', mensagem: r.mensagem };
    set((s) => ({ porPeriodo: { ...s.porPeriodo, [chave]: proximo } }));
  },
}));
