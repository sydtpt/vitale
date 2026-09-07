/**
 * O molde — onde a frase é montada (ADR 0041, invariante 2).
 *
 * O modelo devolve peças; **quem escreve é este arquivo**. O motivo não é
 * desconfiança, é gramática: em francês não existe `"Tour de " + região`, porque
 * *de* + *le* contrai em **du** e *de* + vogal elide em **d'**. Deixar isso com o
 * modelo é aceitar "Tour de le Pajottenland" num dia ruim, sem teste que pegue.
 *
 * Aqui há teste que pega — o golden set das 20 pedaladas reais.
 */
import type { Artigo, Lingua, NomePreenchido, RouteReading } from './types';

/**
 * Acima disto, um passeio com região é `Tour`; abaixo, `Boucle`.
 *
 * Não é número redondo por acaso: nas 20 aprovadas, o Hageland com 55 km virou
 * *Tour* e a forêt de Soignes com 33 km virou *Boucle*. O corte tinha de cair
 * entre os dois, e 50 é o redondo que cabe no vão.
 */
export const KM_TOUR = 50;

const VOGAIS = /^[aeiouâàéèêëîïôöûüh]/i;

/* ──────────────────────────── francês ──────────────────────────── */

/** `de` + artigo, com contração e elisão. É a razão de este arquivo existir. */
function frDe(nome: string, artigo: Artigo): string {
  if (artigo === 'le') return `du ${nome}`;
  if (artigo === 'les') return `des ${nome}`;
  if (artigo === 'la') return `de la ${nome}`;
  if (artigo === "l'") return `de l'${nome}`;
  return VOGAIS.test(nome) ? `d'${nome}` : `de ${nome}`;
}

function frPar(nome: string, artigo: Artigo): string {
  if (artigo === "l'") return `par l'${nome}`;
  return artigo ? `par ${artigo} ${nome}` : `par ${nome}`;
}

/* ──────────────────────────── neerlandês ──────────────────────────── */

function nlVan(nome: string, artigo: Artigo): string {
  return artigo ? `van ${artigo} ${nome}` : `van ${nome}`;
}

function nlDoor(nome: string, artigo: Artigo): string {
  return artigo ? `door ${artigo} ${nome}` : `door ${nome}`;
}

/* ──────────────────────────── português ──────────────────────────── */

function ptDe(nome: string, artigo: Artigo): string {
  if (artigo === 'o') return `do ${nome}`;
  if (artigo === 'a') return `da ${nome}`;
  if (artigo === 'os') return `dos ${nome}`;
  if (artigo === 'as') return `das ${nome}`;
  return `de ${nome}`;
}

function ptPor(nome: string, artigo: Artigo): string {
  if (artigo === 'o') return `pelo ${nome}`;
  if (artigo === 'a') return `pela ${nome}`;
  return `por ${nome}`;
}

/** Primeira letra em caixa alta, sem tocar no resto (`d'Amsterdam` continua assim). */
function capitalizar(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

/**
 * Peças + leitura → a frase. `null` quando não há nome a dar — rota degenerada,
 * ou trajeto sem as pontas necessárias. Recusar é resultado válido (ADR 0041, §7).
 */
export function montarNome(
  leitura: RouteReading,
  preenchido: NomePreenchido,
  distanciaM: number,
): string | null {
  if (leitura.forma === 'degenerada') return null;

  const { lingua } = leitura;
  const origem = preenchido.origem ?? leitura.origem;
  const destino = preenchido.destino ?? leitura.destino;
  const alvoLoop = preenchido.destino ?? leitura.cidadeDistante ?? leitura.destino;

  /*
   * Quem decide entre "região na cabeça" e "trajeto na cabeça" num A→B é o
   * MODELO, não uma regra daqui — ele preenche `regiao` ou preenche as pontas.
   *
   * A tentativa anterior rebaixava toda região de `a-b` para passagem, e o golden
   * a derrubou na hora: `Tour de la Meuse-Rhin` (Liège → Lanaken) virou
   * `De Liège à Lanaken par la Meuse-Rhin`. Rotterdam → Amsterdam quer trajeto,
   * Liège → Lanaken quer região, e as duas são `a-b` de mais de 50 km. O que as
   * separa é se as pontas valem ser nomeadas — julgamento de mundo, que mora do
   * outro lado da lacuna.
   */
  const base = preenchido.regiao
    ? comRegiao(lingua, preenchido.regiao, preenchido.artigo ?? null, leitura.forma, distanciaM)
    : semRegiao(lingua, leitura.forma, origem, destino, alvoLoop);

  if (base == null) return null;

  const via = preenchido.via ? sufixoVia(lingua, preenchido.via, preenchido.viaArtigo ?? null) : '';
  return `${base}${via}`;
}

function comRegiao(
  lingua: Lingua,
  regiao: string,
  artigo: Artigo,
  forma: RouteReading['forma'],
  distanciaM: number,
): string {
  /*
   * `Tour` é distância, não topologia — foi o que as 20 aprovadas mostraram: o
   * Hageland (55 km, loop) virou *Tour*, e a forêt de Soignes (33 km, que nem
   * loop é) virou *Boucle*. A única correção topológica é o `a-b`: um trajeto
   * entre duas cidades diferentes não é uma volta, por mais curto que seja.
   */
  const tour = distanciaM >= KM_TOUR * 1000 || forma === 'a-b';
  if (lingua === 'fr') return tour ? `Tour ${frDe(regiao, artigo)}` : `Boucle ${frDe(regiao, artigo)}`;
  if (lingua === 'nl') return tour ? `Ronde ${nlVan(regiao, artigo)}` : `Rondje ${regiao}`;
  return tour ? `Tour ${ptDe(regiao, artigo)}` : `Volta ${ptPor(regiao, artigo)}`;
}

function semRegiao(
  lingua: Lingua,
  forma: RouteReading['forma'],
  origem: string | undefined,
  destino: string | undefined,
  alvoLoop: string | undefined,
): string | null {
  if (forma === 'casa-loop-casa' || forma === 'a-loop-a') {
    if (!alvoLoop) return null;
    if (lingua === 'fr') return `Boucle ${frDe(alvoLoop, null)}`;
    if (lingua === 'nl') return `Rondje ${alvoLoop}`;
    return `Volta por ${alvoLoop}`;
  }
  if (forma === 'casa-b') {
    if (!destino) return null;
    if (lingua === 'fr') return `Aller à ${destino}`;
    if (lingua === 'nl') return `Naar ${destino}`;
    return `Ida a ${destino}`;
  }
  if (forma === 'a-casa') {
    if (!origem) return null;
    if (lingua === 'fr') return `Retour ${frDe(origem, null)}`;
    if (lingua === 'nl') return `Terug van ${origem}`;
    return `Volta ${ptDe(origem, null)}`;
  }
  // a-b
  if (!origem || !destino) return null;
  if (lingua === 'fr') return `${capitalizar(frDe(origem, null))} à ${destino}`;
  if (lingua === 'nl') return `Van ${origem} naar ${destino}`;
  return `De ${origem} a ${destino}`;
}

function sufixoVia(lingua: Lingua, via: string, artigo: Artigo): string {
  if (lingua === 'fr') return ` ${frPar(via, artigo)}`;
  if (lingua === 'nl') return ` ${nlDoor(via, artigo)}`;
  return ` ${ptPor(via, artigo)}`;
}
