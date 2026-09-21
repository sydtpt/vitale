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
 *   5. o artigo é da língua do nome
 *
 * Puro, sem rede, sem provedor — roda igual sobre a saída de qualquer modelo, o
 * que é o que faz trocar de fornecedor custar uma tarde (ADR 0040).
 */
import { NOME_DA_LINGUA } from './prompt';
import type { Artigo, Lingua, NomePreenchido, RouteFacts, RouteReading } from './types';

export interface ProblemaDeNome {
  regra: 'justificativa' | 'regiao-e-cidade' | 'degenerada' | 'repeticao' | 'artigo';
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

/**
 * Artigos definidos **por língua** — e é o "por língua" que é a regra inteira.
 *
 * `de` é o caso que prova a necessidade: artigo definido em neerlandês,
 * preposição em francês. A mesma palavra passa em `nl` e reprova em `fr`, o que
 * uma lista global jamais conseguiria dizer.
 *
 * As formas aqui são exatamente as que o molde sabe escrever: `frDe`/`frPar`
 * contraem `le`/`les`/`la`/`l'`, `ptDe`/`ptPor` contraem `o`/`a`/`os`/`as`, e
 * `nlVan`/`nlDoor` concatenam o artigo como veio (daí `'t`, a forma reduzida de
 * `het`, sair certo em `van 't Gooi`). Artigo fora desta tabela não é só "de
 * outra língua" — é artigo que o molde perderia calado.
 *
 * **Exaustivo por tipo, de propósito.** Não há ramo para "língua sem tabela":
 * `Record<Lingua, …>` obriga as três a estarem aqui, então "língua fora da
 * tabela" não existe — e uma quarta `Lingua` quebra o build neste mapa e no
 * `NOME_DA_LINGUA` do `prompt.ts`, que é onde se quer ser interrompido. Um
 * `if (!tabela)` aqui seria ramo morto fingindo defesa.
 */
export const ARTIGOS_POR_LINGUA: Record<Lingua, readonly string[]> = {
  fr: ['le', 'la', 'les', "l'"],
  nl: ['de', 'het', "'t"],
  pt: ['o', 'a', 'os', 'as'],
};

/**
 * O artigo pertence à língua do nome?
 *
 * Medido em 21/09/2026, antes de a regra existir, sobre as 135 rotas aprovadas:
 * **127** das respostas do modelo aberto trouxeram artigo fora da língua pedida
 * — artigo português em rota francesa. Os dois números que importam saem daí:
 * só **29** dessas tinham `regiao`, e portanto só 29 sairiam com a frase errada;
 * as outras ~98 têm artigo solto que o molde **nunca lê**, e reprovar essas
 * seria trocar um defeito cosmético por uma recusa permanente gravada.
 *
 * É por isso que quem chama esta função a amarra ao uso do campo. Do outro lado,
 * os 135 nomes que o dono aprovou só têm `le` (11) e `la` (4), ambos franceses
 * em rotas francesas: nenhum é reprovado.
 */
function conferirArtigo(
  lingua: Lingua,
  artigo: Artigo | undefined,
  campo: 'artigo' | 'viaArtigo',
): ProblemaDeNome | null {
  // Ausente é o caso de 120 das 135 metas aprovadas — "nome próprio sem artigo",
  // como o docblock de `Artigo` diz. Branco é o mesmo caso: o molde o trata como
  // falso, e o `lerRespostaDoModelo` já o normaliza para nulo.
  if (artigo == null || artigo.trim().length === 0) return null;

  const k = chave(artigo);
  if (ARTIGOS_POR_LINGUA[lingua].some((a) => chave(a) === k)) return null;
  return {
    regra: 'artigo',
    detalhe: `${campo} "${artigo}" não é artigo em ${NOME_DA_LINGUA[lingua]}`,
  };
}

export function verificarNome(
  rota: Pick<RouteFacts, 'cities'>,
  leitura: Pick<RouteReading, 'forma' | 'lingua'>,
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

  /*
   * O artigo é do modelo, mas a língua é do núcleo — e é o molde que junta os
   * dois. Um `la` numa rota neerlandesa não é erro de gosto: ele entra no
   * `nlVan` e sai "Ronde van la Zennevallei". Por isso a conferência é aqui, e
   * não no molde: o molde não pode desistir, e esta é a hora de desistir.
   *
   * **Cada artigo é conferido só quando o campo que ele acompanha existe**, e
   * isto não é zelo: é a diferença entre a regra e um estrago. `semRegiao` nunca
   * lê `artigo` e `sufixoVia` nem é chamado sem `via`, então um artigo solto não
   * chega à frase — e como `recusaEResultado` é `true` no descritor, reprovar
   * por ele grava uma recusa **permanente** e deixa a pedalada sem nome para
   * sempre. Nos números de 21/09 isso seriam ~98 das 135: artigo fora da língua
   * sem região nenhuma, sobre respostas cujo trajeto o molde escreveria
   * perfeitamente ("De Tournai à Antoing"). A regra morde onde o campo é lido, e
   * em lugar nenhum mais.
   */
  if (preenchido.regiao) {
    const p = conferirArtigo(leitura.lingua, preenchido.artigo, 'artigo');
    if (p) problemas.push(p);
  }
  if (preenchido.via) {
    const p = conferirArtigo(leitura.lingua, preenchido.viaArtigo, 'viaArtigo');
    if (p) problemas.push(p);
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
