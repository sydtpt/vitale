/**
 * Tipos do nome de rota (ADR 0041).
 *
 * A fronteira que estes tipos desenham é a que sustenta a decisão inteira:
 * `RouteReading` é o que o núcleo **deriva sozinho** — forma, pontas, país,
 * língua — e `NomePreenchido` é o que **só o modelo sabe**: a região histórica e
 * seu artigo. Nada aqui conhece provedor, e nada aqui faz rede.
 */

/**
 * A forma do passeio. `degenerada` não é falha — é a rota curta demais ou pobre
 * demais para merecer nome, e sai antes de qualquer chamada (ADR 0041, §7).
 */
export type RouteShape =
  | 'casa-loop-casa'
  | 'casa-b'
  | 'a-casa'
  | 'a-b'
  | 'a-loop-a'
  | 'degenerada';

/** As formas que voltam ao ponto de partida — as que pedem molde de volta. */
export const FORMAS_LOOP: readonly RouteShape[] = ['casa-loop-casa', 'a-loop-a'];

/**
 * Línguas com molde. Alemão fica de fora até existir uma rota dominada pela
 * Alemanha; hoje não há nenhuma nas 138.
 */
export type Lingua = 'fr' | 'nl' | 'pt';

/**
 * Artigo do topônimo na língua do nome. `null` = nome próprio sem artigo
 * (quase toda cidade). É o que permite a contração correta — em francês
 * *de* + *le* = **du**, e errar isso é errar a frase inteira.
 */
export type Artigo = string | null;

/** Uma casa, com vigência. Molde do `gear` da ADR 0034. */
export interface HomeAnchor {
  lat: number;
  lng: number;
  radiusM: number;
  /** 'YYYY-MM-DD' — primeiro dia de vigência. */
  activeFrom: string;
  /** 'YYYY-MM-DD' ou null = vigente hoje. */
  activeTo: string | null;
}

/** Uma cidade atravessada, como o `enrichCities` grava. */
export interface RouteCity {
  name: string;
  country: string;
  lat: number;
  lng: number;
}

/** O que o banco tem sobre uma rota, antes de qualquer derivação. */
export interface RouteFacts {
  startAt: string;
  distanceM: number;
  elevationM: number;
  lat0: number;
  lng0: number;
  lat1: number;
  lng1: number;
  cities: readonly RouteCity[];
}

/** O que o núcleo deriva sozinho — puro, testável, sem custo. */
export interface RouteReading {
  forma: RouteShape;
  /** Primeira cidade do percurso. */
  origem?: string;
  /** Última cidade do percurso. */
  destino?: string;
  /** A mais longe da âncora (ou da partida, sem âncora). Palpite, não veredito. */
  cidadeDistante?: string;
  /** País com mais cidades na rota; empate desempata pela partida. */
  paisDominante?: string;
  /** Língua do nome, derivada do país dominante. */
  lingua: Lingua;
  distanciaCasaInicioM: number;
  distanciaCasaFimM: number;
}

/**
 * O que o modelo devolve. **Campos, nunca a frase** (ADR 0041, invariante 2) —
 * é o molde que monta, porque contração é gramática e gramática mora em código.
 */
export interface NomePreenchido {
  /** Região histórica. Ausente = não há região forte, e o trajeto assume. */
  regiao?: string;
  artigo?: Artigo;
  /** Passagem secundária: um rio, um canal, uma cidade no meio. */
  via?: string;
  viaArtigo?: Artigo;
  /**
   * Pontas **na língua do nome**, sobrepondo o que a leitura derivou.
   *
   * São dois trabalhos numa chave só, e é deliberado: escolher a cidade
   * reconhecível (Steenokkerzeel → Zaventem) e vertê-la para a língua
   * (Mechelen → Malines). Nenhum dos dois é derivável do dado — o primeiro é
   * julgamento, o segundo é exônimo. Por isso a conferência não pode exigir que
   * estas strings estejam na lista de cidades: quem responde por elas é a
   * `justificativa`.
   */
  origem?: string;
  destino?: string;
  /** Cidades da lista enviada, **como foram enviadas**, que sustentam o nome. */
  justificativa: readonly string[];
}
