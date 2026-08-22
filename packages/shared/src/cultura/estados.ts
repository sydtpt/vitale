/**
 * Máquina de estados do módulo Cultura — fonte única (CAP-2).
 * Spec: docs/specs/cultura/spec.md · diagrama em docs/specs/cultura/data-model.md
 *
 * Duas responsabilidades que andam juntas de propósito:
 *
 * 1. **Transitar** — dado um estado e um destino, quais datas gravar. TODA
 *    transição aceita uma data, com hoje como padrão: sem isso o backfill
 *    (adicionar o que foi consumido antes do app existir) gravaria o passado
 *    inteiro como hoje, e a janela da CAP-5 nasceria errada.
 *
 * 2. **Validar** — os mesmos invariantes que os `check` da migration impõem.
 *    Os checks são a última linha de defesa, não a primeira: validar aqui é o
 *    que faz uma edição de data inválida (CAP-12) voltar como mensagem própria
 *    em vez de violação de constraint do Postgres.
 */
import type { CulturaItem } from '../models/index';
import type { CulturaEstado } from './tipos';

/** Datas de um item — o par que define a janela de consumo (CAP-5). */
export interface CulturaDatas {
  iniciadoEm?: string;
  concluidoEm?: string;
}

/** Toda aresta do diagrama, incluindo as três entradas e o rollback. */
const TRANSICOES: Record<CulturaEstado, readonly CulturaEstado[]> = {
  quero: ['consumindo', 'concluido'],
  consumindo: ['concluido', 'quero'],
  concluido: ['consumindo', 'quero'],
};

/** `null` como origem representa a criação: o item nasce em qualquer estado. */
export function podeTransitar(de: CulturaEstado | null, para: CulturaEstado): boolean {
  if (de === null) return true;
  if (de === para) return false;
  return TRANSICOES[de].includes(para);
}

/**
 * Datas resultantes de uma transição. `data` é o dia em que aquilo aconteceu —
 * hoje por padrão, informado no backfill.
 *
 * Três decisões embutidas, todas do spec:
 * - `quero → concluido` grava as duas datas iguais (consumido de uma vez).
 * - `concluido → consumindo` (reler) grava `iniciadoEm` com a data NOVA, nunca
 *   a antiga: herdar a primeira leitura faria a janela abranger as duas.
 * - Voltar para `quero` limpa tudo, senão o item apareceria nas consultas de
 *   janela como se estivesse em curso.
 */
export function datasAposTransicao(
  atual: CulturaDatas,
  para: CulturaEstado,
  data: string,
): CulturaDatas {
  switch (para) {
    case 'quero':
      return {};
    case 'consumindo':
      return { iniciadoEm: data };
    case 'concluido':
      return { iniciadoEm: atual.iniciadoEm ?? data, concluidoEm: data };
  }
}

/** Violação de invariante, já em linguagem de usuário. */
export interface CulturaViolacao {
  campo: 'estado' | 'iniciadoEm' | 'concluidoEm' | 'nota';
  mensagem: string;
}

type Validavel = Pick<CulturaItem, 'estado' | 'nota'> & CulturaDatas;

/**
 * Os mesmos três invariantes dos `check` da migration, mais a faixa da nota.
 * Devolve lista vazia quando o item é coerente.
 */
export function validarItem(item: Validavel): CulturaViolacao[] {
  const v: CulturaViolacao[] = [];
  const temInicio = item.iniciadoEm != null;
  const temFim = item.concluidoEm != null;

  if (item.estado === 'quero' && temInicio) {
    v.push({ campo: 'iniciadoEm', mensagem: 'Item em "quero" não pode ter data de início.' });
  }
  if (item.estado !== 'quero' && !temInicio) {
    v.push({ campo: 'iniciadoEm', mensagem: 'Item começado precisa de data de início.' });
  }
  if (item.estado === 'concluido' && !temFim) {
    v.push({ campo: 'concluidoEm', mensagem: 'Item concluído precisa de data de conclusão.' });
  }
  if (item.estado !== 'concluido' && temFim) {
    v.push({ campo: 'concluidoEm', mensagem: 'Só item concluído tem data de conclusão.' });
  }
  if (temInicio && temFim && item.concluidoEm! < item.iniciadoEm!) {
    v.push({ campo: 'concluidoEm', mensagem: 'A conclusão não pode ser anterior ao início.' });
  }
  if (item.nota != null && (item.nota < 1 || item.nota > 5 || !Number.isInteger(item.nota))) {
    v.push({ campo: 'nota', mensagem: 'A nota vai de 1 a 5.' });
  }
  return v;
}

/**
 * Semântica de patch, compartilhada por toda edição do módulo:
 * `undefined` = "não mexe neste campo", `null` = "limpa este campo".
 *
 * O `??` sozinho não serve porque trata os dois igual — e a diferença é
 * exatamente o que faz voltar para `quero` LIMPAR as datas em vez de
 * preservá-las, o que deixaria o item incoerente com o próprio estado e
 * bateria nos `check` da migration.
 */
export function resolverPatch<T>(novo: T | null | undefined, atual: T | undefined): T | undefined {
  if (novo === null) return undefined;
  if (novo === undefined) return atual;
  return novo;
}

/**
 * Normaliza `indicadoPor` para a agregação da CAP-11: string vazia vira
 * ausência, para não abrir um grupo fantasma no agrupamento por indicador.
 */
export function normalizarIndicadoPor(valor: string | null | undefined): string | undefined {
  const limpo = (valor ?? '').trim();
  return limpo.length > 0 ? limpo : undefined;
}

/**
 * Casa um indicador digitado contra os já usados, SEM distinção de caixa, e
 * devolve a grafia existente. É o que impede "joão" e "João" de virarem dois
 * indicadores e racharem a agregação que justifica o campo existir.
 */
export function convergirIndicador(digitado: string, existentes: readonly string[]): string {
  const limpo = digitado.trim();
  const alvo = limpo.toLocaleLowerCase('pt-BR');
  const achado = existentes.find((e) => e.trim().toLocaleLowerCase('pt-BR') === alvo);
  return achado ?? limpo;
}
