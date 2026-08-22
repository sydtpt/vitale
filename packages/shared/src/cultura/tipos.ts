/**
 * Registro de tipos de mídia do módulo Cultura — fonte única (CAP-9).
 * Spec: docs/specs/cultura/spec.md
 *
 * O conjunto de mídias vive AQUI e não no schema: `cultura_items.tipo` não tem
 * `check` constraint, e é isso que faz a quinta mídia custar zero migration.
 * A contrapartida é a CAP-13 — quem valida na escrita é o módulo de dados,
 * usando `isTipoConhecido` daqui.
 *
 * **O registro é append-only.** Um tipo nunca é removido: `tipo` não é editável
 * (CAP-12), então remover uma mídia deixaria seus itens órfãos, com rótulo
 * genérico e sem conserto que não fosse deletar. Mesma disciplina das ADRs.
 *
 * **Sem imports, de propósito** — mesmo padrão de `fitness/dedupe.ts`. A edge
 * function `cultura-search` importa este arquivo direto por caminho relativo, e
 * o Deno exige extensão explícita em todo specifier. Manter o módulo
 * auto-contido é o que permite a cadeia de provedores ter fonte única entre os
 * dois apps e o servidor, em vez de uma cópia que diverge calada.
 */

/**
 * Mídia de um item. Deliberadamente `string` e não union fechada: o conjunto
 * válido é o registro abaixo, não o tipo nem o banco (CAP-9).
 */
export type CulturaTipo = string;

/**
 * Estado de um item. Vocabulário NEUTRO: 'ler/lido' travaria filme, podcast e
 * álbum (CAP-8). Os rótulos por mídia são apresentação e vivem no registro.
 */
export type CulturaEstado = 'quero' | 'consumindo' | 'concluido';

/** Provedor de catálogo. `null` no fallback significa "não há segundo". */
export interface CulturaProvedores {
  primario: string;
  fallback: string | null;
  /**
   * `cobertura` — o fallback acha o que o primário não tem; vale tentar sempre.
   * `disponibilidade` — quase nunca acha o que o primário não achou; existe só
   * para a busca não morrer com o primário fora do ar. Não merece esforço de
   * merge de resultados.
   */
  naturezaFallback: 'cobertura' | 'disponibilidade' | null;
}

export interface CulturaTipoMeta {
  tipo: CulturaTipo;
  /** Nome da mídia no singular, para títulos e seletores. */
  rotulo: string;
  /** O que `criador` significa nesta mídia. */
  rotuloCriador: string;
  /** Rótulo de cada estado. Apresentação apenas — nunca vira coluna nem enum. */
  estados: Record<CulturaEstado, string>;
  provedores: CulturaProvedores;
}

/** APPEND-ONLY. Acrescentar ao fim; nunca remover nem renomear uma chave. */
export const CULTURA_TIPOS: readonly CulturaTipoMeta[] = [
  {
    tipo: 'livro',
    rotulo: 'Livro',
    rotuloCriador: 'Autor',
    estados: { quero: 'Quero ler', consumindo: 'Lendo', concluido: 'Lido' },
    provedores: { primario: 'google_books', fallback: 'open_library', naturezaFallback: 'cobertura' },
  },
  {
    tipo: 'filme',
    rotulo: 'Filme',
    rotuloCriador: 'Diretor',
    estados: { quero: 'Quero ver', consumindo: 'Vendo', concluido: 'Visto' },
    provedores: { primario: 'tmdb', fallback: 'itunes', naturezaFallback: 'disponibilidade' },
  },
  {
    tipo: 'podcast',
    rotulo: 'Podcast',
    rotuloCriador: 'Apresentador',
    estados: { quero: 'Quero ouvir', consumindo: 'Ouvindo', concluido: 'Ouvido' },
    provedores: { primario: 'itunes', fallback: null, naturezaFallback: null },
  },
  {
    tipo: 'album',
    rotulo: 'Álbum',
    rotuloCriador: 'Artista',
    estados: { quero: 'Quero ouvir', consumindo: 'Ouvindo', concluido: 'Ouvido' },
    provedores: { primario: 'itunes', fallback: 'musicbrainz', naturezaFallback: 'cobertura' },
  },
] as const;

/**
 * Fallback de leitura para tipo desconhecido (CAP-13). Existe para que um item
 * gravado com tipo fora do registro renderize em vez de quebrar a tela — não
 * para ser gravado: a escrita rejeita antes.
 */
const TIPO_DESCONHECIDO: CulturaTipoMeta = {
  tipo: '',
  rotulo: 'Item',
  rotuloCriador: 'Criador',
  estados: { quero: 'Quero', consumindo: 'Em andamento', concluido: 'Concluído' },
  provedores: { primario: '', fallback: null, naturezaFallback: null },
};

const POR_TIPO = new Map(CULTURA_TIPOS.map((t) => [t.tipo, t]));

/** Os tipos válidos, na ordem do registro. */
export function tiposConhecidos(): CulturaTipo[] {
  return CULTURA_TIPOS.map((t) => t.tipo);
}

/** Porteiro da CAP-13. O módulo de dados chama isto antes de escrever. */
export function isTipoConhecido(tipo: string): boolean {
  return POR_TIPO.has(tipo);
}

/** Metadados do tipo. Tipo desconhecido cai no genérico em vez de lançar. */
export function metaDoTipo(tipo: CulturaTipo): CulturaTipoMeta {
  return POR_TIPO.get(tipo) ?? TIPO_DESCONHECIDO;
}

/** Rótulo do estado na língua da mídia (CAP-8). */
export function rotuloEstado(tipo: CulturaTipo, estado: CulturaEstado): string {
  return metaDoTipo(tipo).estados[estado];
}

/**
 * Cadeia de provedores a tentar, em ordem. A edge function percorre esta lista
 * e cai para o próximo tanto em zero resultados quanto em erro ou timeout —
 * um 401 do TMDB não é "não achou", e tratar só o primeiro caso anularia
 * justamente o fallback de disponibilidade.
 */
export function cadeiaDeProvedores(tipo: CulturaTipo): string[] {
  const { primario, fallback } = metaDoTipo(tipo).provedores;
  const cadeia = primario ? [primario] : [];
  if (fallback) cadeia.push(fallback);
  return cadeia;
}
