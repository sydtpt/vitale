/**
 * A forma do passeio — a metade determinística do nome (ADR 0041, invariante 1).
 *
 * Tudo aqui sai de geometria e contagem: onde começou, onde terminou, contra
 * qual casa, em que país. Nenhuma linha depende de conhecimento de mundo, e por
 * isso nenhuma linha depende de modelo. Se todo provedor sumir, este arquivo
 * continua respondendo.
 *
 * O que ele **não** sabe: que Lennik e Strijtem são o Pajottenland. Isso é a
 * outra metade, e ela custa uma chamada.
 */
import { haversineM } from '../geo/distance';
import { activityLocalDate } from '../gear/assign';
import { ancoraEm } from './anchor';
import type { HomeAnchor, Lingua, RouteFacts, RouteReading } from './types';

/**
 * O portão de degenerescência (ADR 0041, §7). Roda **antes** de qualquer
 * chamada: uma rota de 0 km ou de uma cidade só não tem nome a descobrir, e
 * pedir um ao modelo é convidá-lo a inventar.
 *
 * 2 km porque a menor pedalada com nome defensável nas 138 tem 12,9 km, e o
 * degrau abaixo disso é ruído de GPS.
 */
export const MIN_DISTANCIA_M = 2000;

/**
 * Dentro de **uma cidade só**, o corte sobe para 8 km.
 *
 * A primeira versão desta regra recusava toda rota com menos de duas cidades, e
 * o fixture a derrubou: são 8 rotas assim nas 138, e entre elas está a volta de
 * **24 km em São Paulo**, que tem nome óbvio e aprovado. O que separa ela da
 * saída de 5,3 km em Amsterdam não é a contagem de cidades — é a distância.
 *
 * 8 km porque é o vão real do dado: a maior rota de uma cidade só que não merece
 * nome tem 5,35 km, e a menor que merece tem 9,27 km.
 */
export const MIN_DISTANCIA_CIDADE_UNICA_M = 8000;

/**
 * País → língua do nome.
 *
 * **A Bélgica é francês, inclusive nas rotas flamengas** — decisão declarada do
 * dono em 07/09/2026, não inferência. É por isso que a regra é uma tabela e não
 * um `Intl`: nenhuma biblioteca vai concordar que a língua de Mechelen é o
 * francês, e ela está certa; quem manda aqui é a preferência do leitor.
 *
 * A Alemanha não entra: não há molde alemão, porque não há rota dominada pela
 * Alemanha nas 138. Cair no fallback é o comportamento correto até haver.
 */
const PAIS_LINGUA: readonly { re: RegExp; lingua: Lingua }[] = [
  { re: /belgi/i, lingua: 'fr' },
  { re: /france/i, lingua: 'fr' },
  { re: /nederland|netherlands/i, lingua: 'nl' },
  { re: /brasil|brazil|portugal/i, lingua: 'pt' },
];

/** Sem país mapeado, o nome sai na língua do app. Palpitar seria pior. */
export const LINGUA_PADRAO: Lingua = 'pt';

export function linguaDoPais(pais: string | undefined): Lingua {
  if (!pais) return LINGUA_PADRAO;
  return PAIS_LINGUA.find((p) => p.re.test(pais))?.lingua ?? LINGUA_PADRAO;
}

/** País com mais cidades na rota. Empate desempata pela partida (ADR 0041, invariante 5). */
export function paisDominante(cities: RouteFacts['cities']): string | undefined {
  if (cities.length === 0) return undefined;
  const contagem = new Map<string, number>();
  for (const c of cities) contagem.set(c.country, (contagem.get(c.country) ?? 0) + 1);
  let melhor = cities[0].country;
  for (const [pais, n] of contagem) {
    const atual = contagem.get(melhor) ?? 0;
    // `>` e não `>=`: no empate o primeiro país (o da partida) fica.
    if (n > atual) melhor = pais;
  }
  return melhor;
}

/**
 * A cidade mais longe da casa — ou da partida, quando não há casa vigente.
 *
 * É **palpite, não veredito**. Nas 138 rotas ela acerta o destino reconhecível
 * na maioria, e erra exatamente onde se espera: numa ida ao aeroporto a mais
 * distante é Steenokkerzeel, e a que o dono reconhece é Zaventem. Por isso o
 * modelo pode sobrepor com `destino`, e o `verificar` confere que a substituta
 * estava na lista.
 */
export function cidadeMaisDistante(
  cities: RouteFacts['cities'],
  origemLat: number,
  origemLng: number,
): string | undefined {
  let melhor: string | undefined;
  let maior = -1;
  for (const c of cities) {
    const d = haversineM(origemLat, origemLng, c.lat, c.lng);
    if (d > maior) {
      maior = d;
      melhor = c.name;
    }
  }
  return melhor;
}

/**
 * Rota + casas → leitura. É o que vai no prompt, e é o que o molde consome.
 *
 * Sem âncora vigente (ninguém tem casa antes da primeira), as distâncias saem
 * `Infinity` e a rota cai em `a-b` ou `a-loop-a` — nunca em `casa-*`. Melhor
 * perder um "Casa" do que inventar um.
 */
export function lerRota(rota: RouteFacts, ancoras: readonly HomeAnchor[]): RouteReading {
  const pais = paisDominante(rota.cities);
  const lingua = linguaDoPais(pais);

  const base = {
    origem: rota.cities[0]?.name,
    destino: rota.cities[rota.cities.length - 1]?.name,
    paisDominante: pais,
    lingua,
  };

  const degenerada =
    rota.cities.length === 0 ||
    rota.distanceM < MIN_DISTANCIA_M ||
    (rota.cities.length < 2 && rota.distanceM < MIN_DISTANCIA_CIDADE_UNICA_M);

  if (degenerada) {
    return {
      ...base,
      forma: 'degenerada',
      distanciaCasaInicioM: Infinity,
      distanciaCasaFimM: Infinity,
    };
  }

  const casa = ancoraEm(ancoras, activityLocalDate(rota.startAt));
  const raio = casa?.radiusM ?? 0;
  const ini = casa ? haversineM(rota.lat0, rota.lng0, casa.lat, casa.lng) : Infinity;
  const fim = casa ? haversineM(rota.lat1, rota.lng1, casa.lat, casa.lng) : Infinity;
  const vao = haversineM(rota.lat0, rota.lng0, rota.lat1, rota.lng1);

  const forma =
    ini < raio && fim < raio
      ? 'casa-loop-casa'
      : ini < raio
        ? 'casa-b'
        : fim < raio
          ? 'a-casa'
          : vao < (casa?.radiusM ?? 400)
            ? 'a-loop-a'
            : 'a-b';

  return {
    ...base,
    forma,
    cidadeDistante: cidadeMaisDistante(
      rota.cities,
      casa?.lat ?? rota.lat0,
      casa?.lng ?? rota.lng0,
    ),
    distanciaCasaInicioM: ini,
    distanciaCasaFimM: fim,
  };
}
