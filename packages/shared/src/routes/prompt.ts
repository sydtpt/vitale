/**
 * O prompt do nome de rota — e a leitura da resposta (ADR 0041, invariante 2).
 *
 * Mora no núcleo, e não no adaptador, pelos mesmos dois motivos do
 * [ia/prompt.ts](../ia/prompt.ts): é a peça que mais muda, e é agnóstica de
 * fornecedor. O `architecture.test.ts` recusa até o nome de um provedor aqui.
 *
 * A assimetria que sustenta tudo: o modelo recebe **as cidades como o banco as
 * gravou** (`Mechelen`) e devolve **os topônimos na língua do nome**
 * (`Malines`), mais a `justificativa` de volta na grafia enviada. É a
 * justificativa que a conferência confere; os nomes vertidos ela não tem como
 * checar, e fingir que teria seria pior que não checar.
 */
import type { Lingua, NomePreenchido, RouteFacts, RouteReading } from './types';

/**
 * Sobe a cada mudança que altere o nome que sai. Vai gravado em
 * `route_name_meta`, e é o que permite rerodar só as rotas que ficaram para trás
 * em vez de renomear as 138 do zero.
 *
 * 1 — primeira versão, 07/09/2026.
 */
export const PROMPT_NOME_VERSAO = 1;

export interface PromptDeNome {
  sistema: string;
  usuario: string;
  /**
   * Pede saída em JSON ao adaptador. Declara **intenção**, não formato de fio:
   * cada provedor liga isso do seu jeito, e é o adaptador que sabe qual.
   */
  json?: boolean;
}

const NOME_DA_LINGUA: Record<Lingua, string> = {
  fr: 'francês',
  nl: 'neerlandês',
  pt: 'português',
};

const DESCRICAO_DA_FORMA: Record<RouteReading['forma'], string> = {
  'casa-loop-casa': 'saiu de casa, deu uma volta e voltou para casa',
  'casa-b': 'saiu de casa e terminou em outro lugar',
  'a-casa': 'começou longe de casa e terminou em casa',
  'a-b': 'começou num lugar e terminou em outro, nenhum deles em casa',
  'a-loop-a': 'deu uma volta fechada longe de casa, em viagem',
  degenerada: 'não deveria ter chegado aqui',
};

const SISTEMA = `Você nomeia percursos de bicicleta a partir das cidades que eles atravessaram.

O QUE VOCÊ DEVOLVE
Um objeto JSON, e nada mais. Sem texto em volta, sem cercas de código.

{
  "regiao": string | null,      // a região histórica/geográfica que o percurso explorou
  "artigo": string | null,      // o artigo definido DELA na língua pedida ("le","la","l'","les","het","de","o","a")
  "via": string | null,         // uma passagem marcante: um rio, um canal, uma cidade do meio
  "viaArtigo": string | null,
  "origem": string | null,      // a cidade de partida, na língua pedida
  "destino": string | null,     // a cidade de chegada reconhecível, na língua pedida
  "justificativa": string[]     // as cidades da lista, NA GRAFIA EM QUE FORAM ENVIADAS, que sustentam a sua escolha
}

A REGRA QUE MAIS IMPORTA
"regiao" é o nome próprio de uma **região** — Pajottenland, Hageland, Petit-Brabant,
Groene Hart, Wallonie picarde, Condroz. NUNCA o nome de uma das cidades da lista.
Se as cidades não formarem uma região que você reconheça de verdade, devolva
"regiao": null. Um percurso sem região tem nome pelo trajeto, e isso é normal:
inventar uma região é o pior resultado possível, pior do que não nomear.

LÍNGUA
Todo topônimo que você devolve vai na língua pedida, com o exônimo consagrado
quando existe (Mechelen→Malines, Antwerpen→Anvers, Halle→Hal, Klein-Brabant→
Petit-Brabant) e o nome local quando não existe (Pajottenland, Zaventem, Beersel).
O "artigo" é o artigo daquele topônimo naquela língua — é ele que decide a
contração da frase final, então erre-o e a frase sai errada.

O DESTINO É O RECONHECÍVEL
A última cidade da lista nem sempre é a que uma pessoa reconhece: num percurso
que termina em Steenokkerzeel passando por Zaventem, o destino é Zaventem.
Escolha o nome que alguém usaria para contar aonde foi.

JUSTIFICATIVA
Liste as cidades da lista enviada que sustentam a sua escolha, copiadas exatamente
como vieram. Não invente cidade, não traduza aqui, não cite cidade que não está na
lista — é o único ponto em que a sua resposta é conferida contra o dado.`;

/** Leitura + rota → o par `{ sistema, usuario }`. Nenhum dos dois conhece provedor. */
export function montarPromptDeNome(leitura: RouteReading, rota: RouteFacts): PromptDeNome {
  const km = (rota.distanceM / 1000).toFixed(1).replace('.', ',');
  const paises = [...new Set(rota.cities.map((c) => c.country))];

  const usuario = [
    `Língua do nome: ${NOME_DA_LINGUA[leitura.lingua]}.`,
    `Forma do percurso: ${DESCRICAO_DA_FORMA[leitura.forma]}.`,
    `Distância: ${km} km. Subida: ${Math.round(rota.elevationM)} m.`,
    paises.length > 1 ? `Países atravessados: ${paises.join(', ')}.` : `País: ${paises[0] ?? '—'}.`,
    '',
    'Cidades na ordem em que o percurso passou:',
    rota.cities.map((c, i) => `${i + 1}. ${c.name}`).join('\n'),
  ].join('\n');

  return { sistema: SISTEMA, usuario, json: true };
}

/** Texto puro → string sem cerca de código, se o modelo tiver posto uma. */
function semCerca(texto: string): string {
  const t = texto.trim();
  const m = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(t);
  return m ? m[1] : t;
}

function texto(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;
}

/**
 * Resposta crua → `NomePreenchido`, ou `null` se não der para ler.
 *
 * `null` aqui não é exceção: é a recusa da invariante 7 chegando pelo caminho
 * mais comum. Modelo que devolve texto em vez de JSON, ou JSON sem
 * justificativa, deixa a rota sem nome — e sem nome é melhor que com nome
 * inventado.
 */
export function lerRespostaDoModelo(bruto: string): NomePreenchido | null {
  let obj: unknown;
  try {
    obj = JSON.parse(semCerca(bruto));
  } catch {
    return null;
  }
  if (obj == null || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const o = obj as Record<string, unknown>;

  // Acesso por colchete: a web compila com `noPropertyAccessFromIndexSignature`,
  // e o `tsc` do núcleo sozinho não pega isso.
  const cru = o['justificativa'];
  const justificativa = Array.isArray(cru)
    ? cru.filter((j): j is string => typeof j === 'string' && j.trim().length > 0).map((j) => j.trim())
    : [];
  if (justificativa.length === 0) return null;

  return {
    regiao: texto(o['regiao']),
    artigo: texto(o['artigo']) ?? null,
    via: texto(o['via']),
    viaArtigo: texto(o['viaArtigo']) ?? null,
    origem: texto(o['origem']),
    destino: texto(o['destino']),
    justificativa,
  };
}
