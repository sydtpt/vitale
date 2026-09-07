/**
 * A conferência mecânica da saída do modelo (ADR 0041, invariante 2).
 *
 * Mesmo princípio do [ia/verificar.ts](../ia/verificar.ts): não se testa se o
 * nome é *bom* — isso é julgamento do dono, e ele está disponível. Testa-se o
 * que tem resposta binária.
 *
 * O que se confere:
 *   1. a justificativa cita só cidades que foram enviadas
 *   2. a região não é uma das cidades disfarçada de região
 *   3. rota degenerada não recebe preenchimento nenhum
 *   4. a via não repete a região, e a chegada não repete a partida
 *
 * Puro, sem rede, sem provedor — roda igual sobre a saída de qualquer modelo, o
 * que é o que faz trocar de fornecedor custar uma tarde (ADR 0040).
 */
import type { NomePreenchido, RouteFacts, RouteReading } from './types';

export interface ProblemaDeNome {
  regra: 'justificativa' | 'regiao-e-cidade' | 'degenerada' | 'repeticao';
  detalhe: string;
}

export interface VereditoDeNome {
  ok: boolean;
  problemas: ProblemaDeNome[];
}

/** Comparação de topônimo: sem acento, sem caixa, sem espaço nas bordas. */
function chave(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function verificarNome(
  rota: Pick<RouteFacts, 'cities'>,
  leitura: Pick<RouteReading, 'forma'>,
  preenchido: NomePreenchido,
): VereditoDeNome {
  const problemas: ProblemaDeNome[] = [];
  const enviadas = new Set(rota.cities.map((c) => chave(c.name)));

  if (leitura.forma === 'degenerada') {
    problemas.push({
      regra: 'degenerada',
      detalhe: 'rota degenerada não deveria ter sido enviada ao modelo',
    });
    return { ok: false, problemas };
  }

  if (preenchido.justificativa.length === 0) {
    problemas.push({ regra: 'justificativa', detalhe: 'justificativa vazia' });
  }
  for (const j of preenchido.justificativa) {
    if (!enviadas.has(chave(j))) {
      problemas.push({
        regra: 'justificativa',
        detalhe: `"${j}" não estava entre as cidades enviadas`,
      });
    }
  }

  // Uma "região" que é uma das cidades é trajeto disfarçado — e foi exatamente
  // esse disfarce (o nome da cidade de casa virando nome do passeio) que originou
  // a feature.
  if (preenchido.regiao && enviadas.has(chave(preenchido.regiao))) {
    problemas.push({
      regra: 'regiao-e-cidade',
      detalhe: `"${preenchido.regiao}" é uma das cidades da rota, não uma região`,
    });
  }

  if (preenchido.via && preenchido.regiao && chave(preenchido.via) === chave(preenchido.regiao)) {
    problemas.push({ regra: 'repeticao', detalhe: 'via repete a região' });
  }
  /*
   * Partida igual à chegada só é defeito num `a-b`, que por definição vai de um
   * lugar a OUTRO. Num loop é o contrário: sair e voltar ao mesmo ponto é o que
   * a forma significa.
   *
   * A primeira versão desta regra não fazia a distinção e reprovou, no primeiro
   * smoke test contra o modelo real, duas das cinco rotas — o Hageland e a volta
   * em São Paulo, ambas loops, ambas com o modelo respondendo corretamente.
   */
  if (
    leitura.forma === 'a-b' &&
    preenchido.origem &&
    preenchido.destino &&
    chave(preenchido.origem) === chave(preenchido.destino)
  ) {
    problemas.push({ regra: 'repeticao', detalhe: 'num A→B a chegada não pode ser a partida' });
  }

  return { ok: problemas.length === 0, problemas };
}
