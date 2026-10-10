/**
 * Cidades da rota — a consulta ao Nominatim, feita **do aparelho**.
 *
 * Irmão de `surface-osm.ts`, e pelo mesmo motivo. A regra é toda do núcleo
 * (`geo/cidades-da-rota.ts`): amostrar, ler a resposta, colapsar duplicatas. O
 * que existe aqui é o `fetch`.
 *
 * **Por que saiu da edge function.** Medido em 10/10/2026: cinco pedaladas com
 * `has_route = true`, linha em `activity_routes` e 1.204 a 6.210 pontos ficaram
 * com `cities` em `NULL`. O enriquecimento parou entre 17 e 25/09 **sem que uma
 * linha do código da function mudasse** — nenhum commit tocou `geocode.ts`,
 * `ingest.ts` ou `connections-ingest/` naquela janela. Serviço do OpenStreetMap
 * atrás de saída compartilhada de datacenter já tinha feito isso uma vez com o
 * Overpass (ADR 0035); daqui a mesma chamada respondeu em 0,74 s quando medida.
 *
 * Contrato do passe: best-effort e retry-safe. Uma atividade por vez, falha
 * deixa `cities` em `NULL` para tentar de novo, e **nunca** derruba quem chamou.
 */
import {
  amostrarPorDistancia,
  cidadeDaResposta,
  colapsarConsecutivas,
  type CityMark,
  type PontoGeo,
} from '@vitale/shared';

const URL_BASE = 'https://nominatim.openstreetmap.org/reverse';
/** Política do Nominatim: no máximo ~1 req/s. 1,1 s é a folga sobre ela. */
const INTERVALO_MS = 1100;
/** Uma resposta de reverse é pequena; o que demora é a fila do serviço. */
const TIMEOUT_MS = 15_000;
/**
 * O Nominatim exige User-Agent identificável, e **bloqueia** quem não manda.
 * Mesmo valor que a edge function usava.
 */
const UA = 'Orbe/1.0 (life-organizer)';

const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Uma coordenada → cidade. Lança em erro de rede/HTTP; `null` é "sem cidade". */
async function reverso(lat: number, lng: number): Promise<CityMark | null> {
  const url = new URL(URL_BASE);
  url.searchParams.set('format', 'json');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));
  url.searchParams.set('zoom', '10'); // nível município/cidade
  url.searchParams.set('addressdetails', '1');
  // `namedetails` traz as variantes por idioma na MESMA resposta — é o que faz
  // os apelidos custarem zero chamada.
  url.searchParams.set('namedetails', '1');

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`geocode HTTP ${res.status}`);
    return cidadeDaResposta(await res.json(), lat, lng);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Lista ordenada das cidades que a rota atravessa.
 *
 * **Lança** se alguma chamada falhar: quem chama deixa a atividade sem `cities`
 * e tenta na próxima vez. Devolver o que deu até ali gravaria uma rota pela
 * metade como se fosse completa — e `cities` preenchido é definitivo, ninguém
 * volta nele.
 */
export async function cidadesDaRota(pontos: readonly PontoGeo[]): Promise<CityMark[]> {
  const limpos = pontos.filter(
    (p) => typeof p?.lat === 'number' && typeof p?.lng === 'number',
  );
  if (limpos.length < 2) return [];

  const amostras = amostrarPorDistancia(limpos);
  const marcas: (CityMark | null)[] = [];
  for (let i = 0; i < amostras.length; i++) {
    if (i > 0) await dormir(INTERVALO_MS);
    marcas.push(await reverso(amostras[i].lat, amostras[i].lng));
  }
  return colapsarConsecutivas(marcas);
}
