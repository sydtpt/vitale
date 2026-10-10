/**
 * As cidades que uma rota atravessa — a **regra**, sem rede.
 *
 * Este módulo é o irmão de `surface/classify.ts`: ele amostra o traçado, lê a
 * resposta do Nominatim e colapsa duplicatas, mas não faz uma única chamada. O
 * `fetch` mora na casca de quem chama — hoje `mobile/src/lib/geocode-osm.ts`.
 *
 * **Por que a regra saiu da edge function.** Até 10/10/2026 o enriquecimento
 * rodava só no servidor (`supabase/functions/_shared/geocode.ts`), e parou de
 * funcionar entre 17 e 25/09 sem que uma linha daquele código mudasse — cinco
 * pedaladas com rota, milhares de pontos e `cities` em `NULL`. É o mesmo desenho
 * que já tinha falhado com o Overpass: serviço do OpenStreetMap atrás de uma
 * saída compartilhada de datacenter. A [ADR 0035] resolveu aquilo trazendo o
 * passe para o aparelho, e esta é a mesma mudança para o geocoder.
 */
import type { CityMark } from '../models';
import { haversineM } from './distance';

/** O mínimo que o passe precisa de um ponto da rota. */
export interface PontoGeo {
  lat: number;
  lng: number;
}

/** Espaçamento (m) entre amostras — ~1,5 km cobre troca de cidade. */
export const ESPACAMENTO_AMOSTRA_M = 1500;
/** Teto de amostras por rota: limita chamadas ao geocoder por atividade. */
export const MAX_AMOSTRAS = 40;

/**
 * As chaves do `namedetails` que viram apelido. Lista **fechada** de propósito:
 * a resposta de Bruxelas traz 188 variantes de nome, e persistir todas encheria
 * as marcas do acervo de texto que ninguém vai digitar.
 *
 * O recorte cobre as línguas que este acervo produz e consome: `fr`/`nl`/`de`
 * são as oficiais da Bélgica, `en` é o que a Strava escreve no nome da atividade
 * ao lado, e `pt` existe porque o dono do app é brasileiro e digitaria
 * *Bruxelas*. `alt_name` e `short_name` pegam o resto (é de onde vem "BXL").
 */
const CHAVES_DE_APELIDO = [
  'name:fr',
  'name:nl',
  'name:de',
  'name:en',
  'name:pt',
  'alt_name',
  'short_name',
] as const;

/** Minúscula e sem acento — só para deduplicar, nunca para persistir. */
function chaveDedupe(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Colhe as grafias alternativas da MESMA resposta que já foi pedida — custo zero
 * de chamada.
 *
 * Deduplica contra o nome canônico já escolhido **ignorando acento e caixa**:
 * em Bruxelas o canônico é `name:fr` = "Bruxelles", então ele sai da lista e
 * sobram Brussel, Brussels, Bruxelas e BXL.
 *
 * `Brüssel` (`name:de`) **não** sobra: a chave dele é a mesma de `Brussel`, que
 * vem antes. Perder não custa nada — quem digita "Brüssel" acha pelo mesmo
 * normalizador. O comentário desta função na edge function listava Brüssel
 * entre os sobreviventes e estava errado; ver o caso em `cidades-da-rota.test.ts`.
 */
export function colherApelidosDoNome(
  namedetails: Record<string, unknown>,
  canonico: string,
): string[] {
  const vistos = new Set<string>([chaveDedupe(canonico)]);
  const out: string[] = [];
  for (const k of CHAVES_DE_APELIDO) {
    const bruto = namedetails[k];
    if (typeof bruto !== 'string') continue;
    // O OSM separa grafias múltiplas por ';' no mesmo valor.
    for (const parte of bruto.split(';')) {
      const nome = parte.trim();
      if (nome.length < 2) continue;
      const chave = chaveDedupe(nome);
      if (!chave || vistos.has(chave)) continue;
      vistos.add(chave);
      out.push(nome);
    }
  }
  return out;
}

/**
 * Idioma preferido para os nomes, pela região do ponto (código ISO 3166-2 que o
 * Nominatim devolve em `addressdetails`). Bélgica: Flandres (BE-VLG) → nl;
 * Bruxelas (BE-BRU) e Valônia (BE-WAL) → fr. Fora das regiões mapeadas devolve
 * null: o nome padrão do OSM já vem no idioma local em regiões monolíngues.
 */
export function linguaPreferida(address: Record<string, unknown>): string | null {
  const iso = String(address['ISO3166-2-lvl4'] ?? '');
  if (iso === 'BE-VLG') return 'nl';
  if (iso === 'BE-BRU' || iso === 'BE-WAL') return 'fr';
  return null;
}

/**
 * Amostra a rota por distância acumulada, distribuindo o orçamento pela rota
 * INTEIRA: o espaçamento cresce em rotas longas para caber no teto de
 * `MAX_AMOSTRAS` — assim a segunda metade e o ponto final (cidade onde parou)
 * sempre entram, em vez de truncar nos primeiros ~60 km. Início e fim sempre
 * incluídos.
 */
export function amostrarPorDistancia(pontos: readonly PontoGeo[]): PontoGeo[] {
  if (pontos.length === 0) return [];
  let total = 0;
  for (let i = 1; i < pontos.length; i++) {
    total += haversineM(pontos[i - 1].lat, pontos[i - 1].lng, pontos[i].lat, pontos[i].lng);
  }
  const espacamento = Math.max(ESPACAMENTO_AMOSTRA_M, total / MAX_AMOSTRAS);
  const amostras: PontoGeo[] = [pontos[0]];
  let acc = 0;
  for (let i = 1; i < pontos.length; i++) {
    acc += haversineM(pontos[i - 1].lat, pontos[i - 1].lng, pontos[i].lat, pontos[i].lng);
    if (acc >= espacamento) {
      amostras.push(pontos[i]);
      acc = 0;
    }
  }
  const ultimo = pontos[pontos.length - 1];
  if (amostras[amostras.length - 1] !== ultimo) amostras.push(ultimo);
  return amostras;
}

/**
 * A resposta do Nominatim → uma marca de cidade, ou `null` quando a resposta
 * veio OK mas sem cidade (ponto no mar, por exemplo).
 *
 * `lat`/`lng` devolvidos são os do CENTRO da cidade (ponto representativo do
 * município), não os da amostra da rota — cai de volta na amostra se o centro
 * vier ausente.
 */
export function cidadeDaResposta(
  body: unknown,
  latAmostra: number,
  lngAmostra: number,
): CityMark | null {
  const corpo = (body ?? {}) as Record<string, unknown>;
  const a = corpo['address'] as Record<string, unknown> | undefined;
  if (!a) return null;
  const base = a['city'] ?? a['town'] ?? a['village'] ?? a['municipality'] ?? a['county'];
  const lingua = linguaPreferida(a);
  const nd = (corpo['namedetails'] ?? {}) as Record<string, unknown>;
  const localizado = lingua ? nd[`name:${lingua}`] : undefined;
  // Usa a variante localizada quando o nome padrão é bilíngue (ex.: Bruxelas,
  // "Bruxelles - Brussel") ou quando o objeto resolvido é a própria cidade —
  // evita trocar o nome da cidade pelo de um bairro em zooms ambíguos.
  const bilingue = typeof base === 'string' && base.includes(' - ');
  const nome = localizado && (bilingue || nd['name'] === base || !base) ? localizado : base;
  if (!nome) return null;

  const centroLat = Number(corpo['lat']);
  const centroLng = Number(corpo['lon']);
  const temCentro = Number.isFinite(centroLat) && Number.isFinite(centroLng);
  return {
    name: String(nome),
    // SEMPRE presente, mesmo vazio. Omitir quando não há apelido faria "esta
    // cidade não tem outra grafia" e "esta marca é anterior ao passe" virarem o
    // mesmo estado — e aí Etterbeek, que se escreve igual em francês e em
    // neerlandês, voltaria à fila do backfill para sempre.
    aliases: colherApelidosDoNome(nd, String(nome)),
    state: a['state'] ? String(a['state']) : undefined,
    country: a['country'] ? String(a['country']) : undefined,
    countryCode: a['country_code'] ? String(a['country_code']).toUpperCase() : undefined,
    lat: temCentro ? centroLat : latAmostra,
    lng: temCentro ? centroLng : lngAmostra,
  };
}

/**
 * Colapsa duplicatas **consecutivas** pelo nome. Re-entrar numa cidade já vista
 * depois de passar por outra continua gerando uma marca nova — é isso que faz a
 * lista ser o percurso, e não um conjunto.
 */
export function colapsarConsecutivas(marcas: readonly (CityMark | null)[]): CityMark[] {
  const out: CityMark[] = [];
  for (const c of marcas) {
    if (!c) continue;
    const anterior = out[out.length - 1];
    if (anterior && anterior.name === c.name) continue;
    out.push(c);
  }
  return out;
}
