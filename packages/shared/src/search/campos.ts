/**
 * O registro de campos buscáveis e os pesos do ranqueamento
 * (spec busca-textual §5, CAP-6 e CAP-8).
 *
 * **Por que raridade e não `name_edited`.** A intuição diz que o nome que o
 * dono editou à mão é o que importa. Medido em produção em 07/09/2026, é
 * falso: dos 33 nomes com `name_edited`, **31 são "Yoga"** — e os que de fato
 * informam (*Tour de la Meuse-Rhin*, *Morning Ride*, *Rotterdam Cycling*)
 * chegaram já nomeados da Strava, com `name_edited = false`. Precisão de 6%,
 * cobertura de 17%.
 *
 * A frequência do nome no acervo separa quase perfeitamente: 4 nomes cobrem
 * 526 das 555 atividades (Yoga, Cycling, Treino, Running) e os 9 nomes que
 * aparecem uma única vez são exatamente os interessantes. E o sinal se corrige
 * sozinho: se um dia 200 pedaladas se chamarem "Commute", o nome vira rótulo
 * sem ninguém reconfigurar nada — que é o mesmo motivo de os 22
 * "Boucle de Bruxelles" já nascerem rebaixados.
 */
import type { Activity } from '../models';

export type SearchFieldId = 'cidade' | 'cidade-apelido' | 'rota' | 'nome' | 'aparelho' | 'fonte';

/** Faixa de informatividade de um texto, pela frequência dele no acervo. */
export type Faixa = 'rara' | 'comum' | 'rotulo';

/**
 * Onde ficam os cortes. Medidos, não escolhidos por gosto: a distribuição real
 * tem 9 nomes com 1 ocorrência, 3 entre 2 e 3, 2 entre 4 e 20, e 4 acima de 20
 * cobrindo 95% do acervo. Qualquer corte entre 3 e 20 dá o mesmo resultado
 * hoje — os limites estão largos de propósito, para o dado poder crescer sem
 * atravessar uma fronteira apertada.
 */
export function faixaDe(ocorrencias: number): Faixa {
  if (ocorrencias <= 3) return 'rara';
  if (ocorrencias <= 20) return 'comum';
  return 'rotulo';
}

/**
 * Peso por campo. A cidade lidera porque é o pedido original e o mais preciso:
 * a marca vem do geocodificador, não de um rótulo que a fonte inventou.
 *
 * O nome de ROTA pesa um pouco mais que o nome de atividade na mesma faixa
 * (85/50/22 contra 80/45/20) porque ele foi derivado do próprio percurso, não
 * herdado da fonte — e porque é o único campo que o cartão mostra, então
 * casá-lo já vem com a explicação de graça.
 */
export const PESO = {
  cidade: 100,
  cidadeApelido: 90,
  rota: { rara: 85, comum: 50, rotulo: 22 } as const,
  nome: { rara: 80, comum: 45, rotulo: 20 } as const,
  aparelho: 50,
  fonte: 45,
} as const;

/**
 * Uma parcela buscável de uma atividade.
 *
 * `label` ausente é informação, não omissão: significa que o campo **já está à
 * vista no cartão**, e é isso que manda a tela grifar em vez de explicar
 * (CAP-9). Hoje só `rota` é assim — a data é manchete e o nome próprio ocupa a
 * segunda linha desde a proposta C (`18b260b`); cidade, nome de atividade,
 * aparelho e fonte não aparecem em lugar nenhum do cartão.
 */
export interface SearchEntry {
  field: SearchFieldId;
  label?: string;
  weight: number;
  /** O que a tela mostra. Num apelido, é o nome CANÔNICO — quem digita
   *  `louvain` precisa ver `Leuven`, senão não aprende o que o acervo guarda. */
  text: string;
  /** O que casa. Num apelido, são os tokens do APELIDO, não os do canônico. */
  tokens: readonly string[];
}

/** O campo deste casamento já está à vista no cartão? */
export function estaAVista(e: SearchEntry): boolean {
  return e.label === undefined;
}

/**
 * Quantas vezes cada texto aparece no acervo, normalizado. É o insumo das
 * faixas — e roda uma vez por carga, junto com o índice.
 */
export function contar(
  atividades: readonly Activity[],
  de: (a: Activity) => string | undefined,
  normalizar: (s: string) => string,
): Map<string, number> {
  const n = new Map<string, number>();
  for (const a of atividades) {
    const texto = de(a)?.trim();
    if (!texto) continue;
    const chave = normalizar(texto);
    n.set(chave, (n.get(chave) ?? 0) + 1);
  }
  return n;
}
