import { create } from 'zustand';
import type { EntradaPacote, Edicao } from '@vitale/shared';
import { useAuthStore } from './auth.store';
import { buscarEdicao } from '../lib/edicao-ia';

/**
 * As edições impressas da Retrospectiva (ADRs 0038 e 0040 · Story 1.9).
 *
 * Uma edição é o **conjunto dos cadernos** de um período fechado, guardado aqui
 * por `tipo|inicio|fim`. Três regras de comportamento que a tela herda sem ter
 * que saber:
 *
 * - **Nunca gera.** Nem sozinha, nem a pedido: a escrita saiu do celular na
 *   Story 1.9 e volta na 1.10, atrás da sequência da impressão. Abrir a
 *   Retrospectiva lê o que já existe, e ler é de graça.
 * - **Nunca reordena.** A ordem dos cadernos vem da coluna `posicao`, congelada
 *   na última impressão. A store não ordena nada.
 * - **Nunca anuncia o que não pode existir.** Quem decide é o núcleo
 *   (`temEdicao` e `periodoFechado`); a store só repassa o estado `ausente`, e o
 *   cartão some.
 *
 * A chave já **não é mais** a chave primária da tabela: a primária ganhou o
 * caderno, e esta é a do período — mais o **dono**, que a tabela tem e a tela
 * não mostra.
 */
export type EstadoEdicao =
  /** Primeira leitura, em voo. Não desenha nada: um cartão que pisca a cada foco. */
  | { fase: 'carregando' }
  /** Releitura **pedida pelo leitor**. Desenha, porque toque sem resposta é toque perdido. */
  | { fase: 'relendo' }
  /** O período fechou e tem cadernos impressos, na ordem gravada. */
  | { fase: 'pronta'; edicao: Edicao }
  /** O período fechou e nenhum caderno foi escrito ainda. */
  | { fase: 'nao-escrita' }
  /** Período em curso, ou período que nunca terá edição. A tela não mostra nada. */
  | { fase: 'ausente' }
  /**
   * Não há sessão — e por isso não há a quem perguntar.
   *
   * Sem ela o cartão ficava **invisível para sempre**: `carregar` saía antes de
   * qualquer `set`, o mapa nunca ganhava a chave, e o padrão (`carregando`) é
   * justamente a fase que não desenha nada. Silêncio é a resposta certa para
   * período em curso, e a errada para "o app não sabe quem é você".
   *
   * **Não é a mesma coisa que a sessão ainda estar hidratando.** No arranque a
   * frio, `useAuthStore` nasce sem usuário e só ganha um quando `initialize()`
   * volta do `getSession()`; tratar os dois iguais mostraria "Entre na sua
   * conta" nos primeiros quadros de todo arranque, para quem está logado. Quem
   * separa os dois é `estadoDe`, pelo `isLoading` do auth.
   */
  | { fase: 'sem-sessao' }
  | { fase: 'erro'; mensagem: string };

interface EdicaoState {
  porPeriodo: Record<string, EstadoEdicao>;
  /** Lê a edição já impressa. Não chama o modelo, não gasta. */
  carregar: (entrada: EntradaPacote) => Promise<void>;
  /** Relê depois de um erro de leitura. Continua sem escrever nada. */
  recarregar: (entrada: EntradaPacote) => Promise<void>;
  estado: (entrada: EntradaPacote) => EstadoEdicao;
}

/**
 * `<uid>|month|2026-08-01|2026-08-31` — o dono e o período.
 *
 * **O uid entra na chave, e não é decoração.** Sem ele o mapa é do app, não do
 * usuário: quem sai e entra com outra conta encontra o texto da anterior já
 * desenhado, porque `pronta` não relê — período fechado congela, que é a regra
 * certa para a edição e a errada para a identidade. Com o uid na chave o estado
 * do outro dono não é invalidado: ele é **inalcançável**, e não existe quadro
 * nenhum em que ele apareça.
 */
export function chaveDe(uid: string, e: EntradaPacote): string {
  const r = e.resumo;
  return `${uid}|${r.kind}|${r.startISO}|${r.endISO}`;
}

/**
 * O estado de uma chave — a **mesma** função dos dois lados.
 *
 * A tela não pode chamar função dentro do seletor (o seletor devolveria objeto
 * novo a cada quadro, e o teste de estabilidade cobra isso), então ela assina
 * `porPeriodo` e deriva aqui fora. O `estado()` da store faz o mesmo com o mapa
 * que já tem. Antes eram dois caminhos: o da tela, sem teste, e o da store,
 * testado e sem chamador.
 *
 * `chave` nula é a ausência de um dono — e aí `sessaoHidratando` decide **qual**
 * das duas ausências é: o app ainda não sabe quem é você (silêncio, porque a
 * resposta está a caminho) ou não há sessão (a frase). O parâmetro não tem
 * padrão de propósito: todo chamador tem de responder a essa pergunta, e a que
 * mais precisa responder é a tela, no primeiro quadro do arranque a frio.
 */
export function estadoDe(
  porPeriodo: Record<string, EstadoEdicao>,
  chave: string | null,
  sessaoHidratando: boolean,
): EstadoEdicao {
  if (chave === null) {
    return sessaoHidratando ? { fase: 'carregando' } : { fase: 'sem-sessao' };
  }
  return porPeriodo[chave] ?? { fase: 'carregando' };
}

function userId(): string | undefined {
  return useAuthStore.getState().user?.id;
}

/** A sessão ainda está sendo lida do disco (`initialize()` não voltou). */
function sessaoHidratando(): boolean {
  return useAuthStore.getState().isLoading;
}

/**
 * O leitor não lê `PGRST116`, e mostrá-lo é confessar um detalhe de transporte
 * onde cabia uma frase. O motivo real vai para o log, que é onde ele serve.
 */
function mensagemDeLeitura(e: unknown): string {
  console.warn('[edicao] falha ao ler a edição:', e);
  return 'Não foi possível ler a edição agora.';
}

/**
 * Uma leitura, e o estado que ela produz. `emCurso` é a fase enquanto ela corre:
 * silenciosa na primeira vez, visível quando o leitor pediu.
 */
async function ler(
  set: (fn: (s: EdicaoState) => Partial<EdicaoState>) => void,
  entrada: EntradaPacote,
  uid: string,
  emCurso: 'carregando' | 'relendo',
): Promise<void> {
  const chave = chaveDe(uid, entrada);
  set((s) => ({ porPeriodo: { ...s.porPeriodo, [chave]: { fase: emCurso } } }));
  try {
    const r = await buscarEdicao(uid, entrada);
    const proximo: EstadoEdicao =
      r.estado === 'ausente' ? { fase: 'ausente' }
        : r.edicao.length > 0 ? { fase: 'pronta', edicao: r.edicao }
          : { fase: 'nao-escrita' };
    set((s) => ({ porPeriodo: { ...s.porPeriodo, [chave]: proximo } }));
  } catch (e) {
    set((s) => ({
      porPeriodo: { ...s.porPeriodo, [chave]: { fase: 'erro', mensagem: mensagemDeLeitura(e) } },
    }));
  }
}

export const useEdicaoStore = create<EdicaoState>((set, get) => ({
  porPeriodo: {},

  estado: (entrada) => {
    const uid = userId();
    return estadoDe(get().porPeriodo, uid ? chaveDe(uid, entrada) : null, sessaoHidratando());
  },

  carregar: async (entrada) => {
    const uid = userId();
    // Sem sessão não há a quem perguntar — e também não há chave sob a qual
    // guardar a resposta. Quem desenha o `sem-sessao` é `estadoDe`, a partir da
    // chave nula: um mapa chaveado por uid não tem onde pôr um estado sem dono.
    if (!uid) return;
    const atual = get().porPeriodo[chaveDe(uid, entrada)];
    // **`ausente` e `nao-escrita` releem; `pronta`, `erro` e a leitura em voo não.**
    //
    // `ausente` e `nao-escrita` são respostas sobre o RELÓGIO, não sobre o
    // arquivo: um período olhado em curso fecha, e um período fechado e vazio é
    // impresso. Guardá-los como definitivos esconderia a edição pelo resto da
    // sessão — que foi exatamente o que a primeira versão desta store fazia.
    // `pronta` fica: período fechado congela, e reabrir nunca reordena.
    //
    // **`erro` fica junto com `pronta`, e é a correção da rodada 2.** Ele relia
    // a cada foco da tela, o que custa duas coisas: a rede cai e o log enche de
    // uma linha por folheada, e o botão "Tentar de novo" fica sem conteúdo —
    // quando o dedo chega nele, a releitura automática já aconteceu. Releitura
    // de erro é ato do leitor, e tem porta própria (`recarregar`).
    if (atual && (atual.fase === 'pronta' || atual.fase === 'erro'
      || atual.fase === 'carregando' || atual.fase === 'relendo')) {
      return;
    }
    await ler(set, entrada, uid, 'carregando');
  },

  recarregar: async (entrada) => {
    const uid = userId();
    if (!uid) return;
    const atual = get().porPeriodo[chaveDe(uid, entrada)]?.fase;
    if (atual === 'carregando' || atual === 'relendo') return;
    await ler(set, entrada, uid, 'relendo');
  },
}));
