/**
 * O que o app está fazendo por conta própria, por atividade.
 *
 * Existe para que a tela possa dizer "espere" em vez de parecer quebrada. O
 * enriquecimento de cidades de uma pedalada de 3.347 pontos são 41 chamadas ao
 * OpenStreetMap a 1,1 s — **~45 segundos** em que nada mudava na tela, e o dono
 * saía e voltava para descobrir se algo tinha acontecido (medido em 10/10/2026).
 *
 * **Isto não é log.** O log é `sync-breadcrumbs.ts`, vive em disco e fala para
 * quem depura. Aqui é estado de tela, vive em memória, fala português comum, e
 * some quando o trabalho acaba — ver `docs/specs/trabalho-em-curso/spec.md`.
 */
import { create } from 'zustand';

/** Os passes que demoram o bastante para o dono precisar saber. */
export type TipoDeTrabalho = 'cidades' | 'nome' | 'piso';

/**
 * Ordem de prioridade quando mais de um corre junto: o de maior espera
 * esperada primeiro. A faixa mostra **um** de cada vez (CAP-4) porque a
 * pergunta que ela responde é "quanto tempo devo esperar", e somar trabalhos
 * não responde isso.
 */
const PRIORIDADE: readonly TipoDeTrabalho[] = ['cidades', 'piso', 'nome'];

/** O que a faixa escreve para cada passe. */
export const ROTULO: Record<TipoDeTrabalho, string> = {
  cidades: 'procurando as cidades',
  piso: 'medindo o piso',
  nome: 'escrevendo o nome da rota',
};

export interface TrabalhoEmCurso {
  atividadeId: string;
  tipo: TipoDeTrabalho;
  /** Epoch ms do começo — a faixa usa para não piscar em passe rápido (CAP-3). */
  desde: number;
  /** Avanço, quando o passe sabe medir. Sem isto a barra é indeterminada. */
  feito?: number;
  total?: number;
}

export interface TrabalhoQueFalhou {
  atividadeId: string;
  tipo: TipoDeTrabalho;
  /** Frase curta em português comum. Nunca a mensagem crua do serviço. */
  motivo: string;
  /** Epoch ms a partir do qual repetir faz sentido. Ausente = pode agora. */
  repetirApos?: number;
}

const chave = (atividadeId: string, tipo: TipoDeTrabalho) => `${atividadeId}:${tipo}`;

interface EstadoDoTrabalho {
  emCurso: Record<string, TrabalhoEmCurso>;
  falhas: Record<string, TrabalhoQueFalhou>;

  comecar: (atividadeId: string, tipo: TipoDeTrabalho) => void;
  avancar: (atividadeId: string, tipo: TipoDeTrabalho, feito: number, total: number) => void;
  terminar: (atividadeId: string, tipo: TipoDeTrabalho) => void;
  falhar: (
    atividadeId: string,
    tipo: TipoDeTrabalho,
    motivo: string,
    repetirApos?: number,
  ) => void;
  esquecerFalha: (atividadeId: string, tipo: TipoDeTrabalho) => void;
}

export const useTrabalhoStore = create<EstadoDoTrabalho>((set) => ({
  emCurso: {},
  falhas: {},

  comecar: (atividadeId, tipo) =>
    set((s) => {
      const k = chave(atividadeId, tipo);
      // Começar limpa a falha anterior: a tela não mostra "não deu" e "tentando"
      // ao mesmo tempo, que é a forma mais rápida de parecer defeito.
      const falhas = { ...s.falhas };
      delete falhas[k];
      return {
        falhas,
        emCurso: { ...s.emCurso, [k]: { atividadeId, tipo, desde: Date.now() } },
      };
    }),

  avancar: (atividadeId, tipo, feito, total) =>
    set((s) => {
      const k = chave(atividadeId, tipo);
      const atual = s.emCurso[k];
      // Sem `comecar` antes, avançar não inventa trabalho: o passe pode ter sido
      // cancelado entre uma amostra e outra.
      if (!atual) return s;
      return { emCurso: { ...s.emCurso, [k]: { ...atual, feito, total } } };
    }),

  terminar: (atividadeId, tipo) =>
    set((s) => {
      const k = chave(atividadeId, tipo);
      if (!s.emCurso[k] && !s.falhas[k]) return s;
      const emCurso = { ...s.emCurso };
      const falhas = { ...s.falhas };
      delete emCurso[k];
      delete falhas[k];
      return { emCurso, falhas };
    }),

  falhar: (atividadeId, tipo, motivo, repetirApos) =>
    set((s) => {
      const k = chave(atividadeId, tipo);
      const emCurso = { ...s.emCurso };
      delete emCurso[k];
      return {
        emCurso,
        falhas: { ...s.falhas, [k]: { atividadeId, tipo, motivo, repetirApos } },
      };
    }),

  esquecerFalha: (atividadeId, tipo) =>
    set((s) => {
      const k = chave(atividadeId, tipo);
      if (!s.falhas[k]) return s;
      const falhas = { ...s.falhas };
      delete falhas[k];
      return { falhas };
    }),
}));

/**
 * O trabalho que a faixa deve mostrar para esta atividade, ou `null`.
 *
 * Puro e exportado para teste: é aqui que mora a regra do "um de cada vez" e a
 * precedência. A falha ganha da execução de outro passe — depois de 45 s
 * esperando, saber que não deu vale mais que saber que outra coisa começou.
 */
export function oQueMostrar(
  atividadeId: string,
  emCurso: Record<string, TrabalhoEmCurso>,
  falhas: Record<string, TrabalhoQueFalhou>,
): { estado: 'curso'; trabalho: TrabalhoEmCurso } | { estado: 'falha'; falha: TrabalhoQueFalhou } | null {
  for (const tipo of PRIORIDADE) {
    const f = falhas[chave(atividadeId, tipo)];
    if (f) return { estado: 'falha', falha: f };
  }
  for (const tipo of PRIORIDADE) {
    const t = emCurso[chave(atividadeId, tipo)];
    if (t) return { estado: 'curso', trabalho: t };
  }
  return null;
}
