import { create } from 'zustand';
import type { CadernoId, EntradaPacote, Edicao } from '@vitale/shared';
import { useAuthStore } from './auth.store';
import { buscarEdicao, imprimirEdicao, naoImpressoDe } from '../lib/edicao-ia';

/**
 * As edições impressas da Retrospectiva (ADRs 0038 e 0040 · Stories 1.9 e 1.10).
 *
 * Uma edição é o **conjunto dos cadernos** de um período fechado, guardado aqui
 * por `tipo|inicio|fim`. Três regras de comportamento que a tela herda sem ter
 * que saber:
 *
 * - **Nunca gera sozinha.** Abrir a Retrospectiva lê o que já existe, e ler é de
 *   graça. Escrever é o toque do dono em "Escrever a edição" (`imprimir`), só a
 *   partir de um período fechado e não escrito — a reimpressão é da 1.11.
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
/** Um caderno que não saiu na última impressão, e por quê — em palavras. */
export interface NaoImpresso {
  caderno: CadernoId;
  motivo: string;
}

/**
 * Um caderno durante a impressão. A tela os desenha um a um, na ordem em que o
 * núcleo os lê: **mostrar é progressivo**, mesmo que gravar seja atômico.
 */
export type CadernoNaImpressao =
  | { caderno: CadernoId; fase: 'na-fila' }
  | { caderno: CadernoId; fase: 'escrevendo' }
  | { caderno: CadernoId; fase: 'escrito'; texto: string }
  | { caderno: CadernoId; fase: 'nao-escrito'; motivo: string };

/** O aviso do período fechado em que nenhum caderno tem o que dizer. Sem botão: tocar não mudaria nada. */
export const AVISO_SEM_CADERNO = 'Nenhum caderno deste período tem o que dizer.';

export type EstadoEdicao =
  /** Primeira leitura, em voo. Não desenha nada: um cartão que pisca a cada foco. */
  | { fase: 'carregando' }
  /** Releitura **pedida pelo leitor**. Desenha, porque toque sem resposta é toque perdido. */
  | { fase: 'relendo' }
  /**
   * O período fechou e tem cadernos impressos, na ordem gravada. `naoImpressos`
   * vem da impressão que acabou de acontecer: os cadernos que não saíram, com o
   * motivo. Uma leitura do banco não os traz.
   */
  | { fase: 'pronta'; edicao: Edicao; naoImpressos?: readonly NaoImpresso[] }
  /**
   * O período fechou e nenhum caderno foi escrito ainda. `motivos` são os da
   * última tentativa; `semCaderno` diz que tentar não adianta — e aí não há botão.
   */
  | { fase: 'nao-escrita'; motivos?: readonly NaoImpresso[]; semCaderno?: true }
  /**
   * A impressão está em curso. `cadernos` chega vazio no toque (a preferência
   * ainda está sendo lida) e ganha a fila quando o primeiro caderno começa.
   */
  | { fase: 'imprimindo'; cadernos: readonly CadernoNaImpressao[] }
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
  /**
   * Uma porta falhou. `aposImpressao` marca o erro que veio de uma impressão já
   * começada: o `gravar` pode ter feito commit antes de a conexão cair, então a
   * tela não promete escrita — diz que a impressão não terminou e oferece ver o
   * que ficou gravado (a releitura). O erro de leitura não tem a marca.
   */
  | { fase: 'erro'; mensagem: string; aposImpressao?: true };

interface EdicaoState {
  porPeriodo: Record<string, EstadoEdicao>;
  /** Lê a edição já impressa. Não chama o modelo, não gasta. */
  carregar: (entrada: EntradaPacote) => Promise<void>;
  /** Relê depois de um erro de leitura. Continua sem escrever nada. */
  recarregar: (entrada: EntradaPacote) => Promise<void>;
  /**
   * O toque em "Escrever a edição". **Só age quando `podeEscrever`** — período
   * fechado e não escrito, com o que dizer, e os dados da Retrospectiva prontos —,
   * e o segundo toque durante a impressão é ignorado: uma impressão por período,
   * paga uma vez. Antes de chamar modelo, relê o banco: a edição pode ter sido
   * impressa depois da última leitura.
   */
  imprimir: (entrada: EntradaPacote, dadosProntos: boolean) => Promise<void>;
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

/**
 * Os dados que a edição narra já chegaram? — a prontidão que a tela calcula.
 *
 * O `summary` da Retrospectiva é recalculado da memória a cada render, e a memória
 * pode estar pela metade: a busca da retro em voo, a janela carregada cobrindo
 * outro intervalo (o `loadedSince` começa **depois** do que este período precisa),
 * ou as atividades — que a retro carrega sem esperar — ainda chegando. Uma
 * impressão nesse intervalo congelaria para sempre uma edição com fatos
 * incompletos: período fechado não se reescreve.
 */
export function dadosProntosParaImprimir(
  retro: { readonly loaded: boolean; readonly loading: boolean; readonly loadedSince: string | null },
  atividades: { readonly loaded: boolean; readonly loading: boolean },
  since: string,
): boolean {
  return retro.loaded && !retro.loading && retro.loadedSince !== null && retro.loadedSince <= since
    && atividades.loaded && !atividades.loading;
}

/**
 * O botão "Escrever a edição" aparece? — a decisão, fora do JSX, com teste.
 *
 * Três condições, e as três são necessárias: o período fechou e não foi escrito;
 * há caderno com o que dizer (`semCaderno` é a resposta de que tocar não mudaria
 * nada); e os dados estão prontos. Sem a terceira, o botão não aparece — nem
 * desabilitado: um botão cinza sem razão visível é um convite a tocar de novo.
 * A ação `imprimir` confere a mesma função.
 */
export function podeEscrever(estado: EstadoEdicao, dadosProntos: boolean): boolean {
  return estado.fase === 'nao-escrita' && !estado.semCaderno && dadosProntos;
}

/** O ramo que não existe: o compilador reprova um estado novo da sequência sem tratamento. */
function estadoNaoTratado(nunca: never): string {
  console.warn('[edicao] a impressão devolveu um estado sem tratamento:', nunca);
  return 'A impressão devolveu uma resposta que o app não sabe ler.';
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
 * A impressão que falhou numa porta depois de começar. **Não promete escrita**: o
 * `gravar` pode ter feito commit antes de a conexão cair, e o que ficou no banco só
 * a releitura diz. O detalhe vai para o log.
 */
function mensagemDeImpressao(e: unknown): string {
  console.warn('[edicao] falha ao imprimir a edição:', e);
  return 'A impressão não terminou. Parte dela pode ter ficado gravada.';
}

type Set = (fn: (s: EdicaoState) => Partial<EdicaoState>) => void;

/**
 * Uma leitura, e o estado que ela produz. `emCurso` é a fase enquanto ela corre:
 * silenciosa na primeira vez, visível quando o leitor pediu.
 *
 * **Os motivos da última tentativa sobrevivem à releitura.** Um período que
 * continua não escrito depois de uma impressão sem sucesso tem de continuar
 * dizendo por quê — senão o próximo foco da tela apagava a explicação que o dono
 * acabou de receber. O `semCaderno` não sobrevive: ele é uma previsão sobre o
 * dado, e o dado pode ter chegado.
 */
async function ler(
  set: Set,
  get: () => EdicaoState,
  entrada: EntradaPacote,
  uid: string,
  emCurso: 'carregando' | 'relendo',
): Promise<void> {
  const chave = chaveDe(uid, entrada);
  const antes = get().porPeriodo[chave];
  const motivos = antes?.fase === 'nao-escrita' && antes.motivos && antes.motivos.length > 0 ? antes.motivos : null;
  set((s) => ({ porPeriodo: { ...s.porPeriodo, [chave]: { fase: emCurso } } }));
  try {
    const r = await buscarEdicao(uid, entrada);
    const proximo: EstadoEdicao =
      r.estado === 'ausente' ? { fase: 'ausente' }
        : r.edicao.length > 0 ? { fase: 'pronta', edicao: r.edicao }
          : motivos ? { fase: 'nao-escrita', motivos }
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
    //
    // **`imprimindo` também fica**: um foco da tela no meio da impressão relia o
    // banco, punha `carregando` por cima da fila e apagava os cadernos já
    // mostrados — que só estão na memória até a gravação terminar.
    if (atual && (atual.fase === 'pronta' || atual.fase === 'erro'
      || atual.fase === 'carregando' || atual.fase === 'relendo' || atual.fase === 'imprimindo')) {
      return;
    }
    await ler(set, get, entrada, uid, 'carregando');
  },

  recarregar: async (entrada) => {
    const uid = userId();
    if (!uid) return;
    const atual = get().porPeriodo[chaveDe(uid, entrada)]?.fase;
    if (atual === 'carregando' || atual === 'relendo' || atual === 'imprimindo') return;
    await ler(set, get, entrada, uid, 'relendo');
  },

  imprimir: async (entrada, dadosProntos) => {
    const uid = userId();
    if (!uid) return;
    const chave = chaveDe(uid, entrada);
    const atual = get().porPeriodo[chave];
    // A mesma decisão que desenha o botão. O segundo toque encontra `imprimindo` —
    // o `set` abaixo roda antes de qualquer `await`.
    if (!atual || !podeEscrever(atual, dadosProntos)) return;

    const por = (estado: EstadoEdicao): void =>
      set((s) => ({ porPeriodo: { ...s.porPeriodo, [chave]: estado } }));
    /** Muda um caderno da fila — só se a impressão desta chave ainda estiver em curso. */
    const naFila = (mudar: (cadernos: readonly CadernoNaImpressao[]) => readonly CadernoNaImpressao[]): void => {
      const e = get().porPeriodo[chave];
      if (e?.fase === 'imprimindo') por({ fase: 'imprimindo', cadernos: mudar(e.cadernos) });
    };

    por({ fase: 'imprimindo', cadernos: [] });

    // **Relê antes de pagar.** O `nao-escrita` da memória pode ser velho: a edição
    // pode ter sido impressa depois da última leitura (outro aparelho, o backfill).
    // Imprimir por cima dela seria reimpressão — regenerar e pagar tudo de novo,
    // sobrescrevendo texto publicado. Falha aqui é erro de leitura: nada começou.
    try {
      const lida = await buscarEdicao(uid, entrada);
      if (lida.estado === 'ausente') {
        por({ fase: 'ausente' });
        return;
      }
      if (lida.edicao.length > 0) {
        por({ fase: 'pronta', edicao: lida.edicao });
        return;
      }
    } catch (e) {
      por({ fase: 'erro', mensagem: mensagemDeLeitura(e) });
      return;
    }

    try {
      const r = await imprimirEdicao(uid, entrada, {
        aoComecar: (caderno, fila) => naFila((cadernos) => {
          const base: readonly CadernoNaImpressao[] = cadernos.length > 0
            ? cadernos
            : fila.map((c) => ({ caderno: c, fase: 'na-fila' as const }));
          return base.map((c) => (c.caderno === caderno ? { caderno, fase: 'escrevendo' as const } : c));
        }),
        aoLer: (caderno, desfecho) => naFila((cadernos) => {
          const lido: CadernoNaImpressao = desfecho.tipo === 'escrito'
            ? { caderno, fase: 'escrito', texto: desfecho.leitura.frase }
            : { caderno, fase: 'nao-escrito', motivo: naoImpressoDe(desfecho) ?? 'não saiu' };
          return cadernos.map((c) => (c.caderno === caderno ? lido : c));
        }),
      });

      const naoImpressos: NaoImpresso[] = [];
      if (r.estado === 'gravada' || r.estado === 'nada-gravado') {
        for (const { caderno, desfecho } of r.desfechos) {
          const motivo = naoImpressoDe(desfecho);
          if (motivo !== null) naoImpressos.push({ caderno, motivo });
        }
      }
      switch (r.estado) {
        case 'gravada':
          por(r.edicao.length > 0
            ? { fase: 'pronta', edicao: r.edicao, ...(naoImpressos.length > 0 ? { naoImpressos } : {}) }
            : { fase: 'nao-escrita', motivos: naoImpressos });
          return;
        case 'nada-gravado':
          por({ fase: 'nao-escrita', motivos: naoImpressos });
          return;
        case 'sem-caderno':
          por({ fase: 'nao-escrita', semCaderno: true });
          return;
        case 'aberto':
          por({ fase: 'ausente' });
          return;
        default:
          // Sem este ramo, um estado inesperado deixaria a chave presa em
          // `imprimindo` — e `carregar`/`recarregar` a recusam até o app reiniciar.
          por({ fase: 'erro', mensagem: estadoNaoTratado(r), aposImpressao: true });
          return;
      }
    } catch (e) {
      por({ fase: 'erro', mensagem: mensagemDeImpressao(e), aposImpressao: true });
    }
  },
}));
