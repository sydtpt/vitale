/**
 * Cidades da rota — a consulta ao Nominatim, feita **do aparelho**.
 *
 * Irmão de `surface-osm.ts`, e pelo mesmo motivo. A regra é toda do núcleo
 * (`geo/cidades-da-rota.ts`): amostrar, ler a resposta, colapsar duplicatas. O
 * que existe aqui é o `fetch` — e o pedágio que o protege.
 *
 * **Por que saiu da edge function.** Medido em 10/10/2026: cinco pedaladas com
 * `has_route = true`, linha em `activity_routes` e 1.204 a 6.210 pontos ficaram
 * com `cities` em `NULL`. O enriquecimento parou entre 17 e 25/09 **sem que uma
 * linha do código da function mudasse**. Serviço do OpenStreetMap atrás de saída
 * compartilhada de datacenter já tinha feito isso uma vez com o Overpass
 * (ADR 0035).
 *
 * **O pedágio é global, e isso não é zelo — é o defeito medido na primeira
 * tentativa.** A versão de 10/10 respeitava 1,1 s *dentro* de cada passe, e nada
 * impedia três passes de rodarem juntos: abrir três pedaladas em sequência deu
 * ~2,7 req/s e o Nominatim devolveu **HTTP 429** nas três, mais uma vez a cada
 * re-tentativa. O limite do serviço é por cliente, não por tela, então o pedágio
 * também tem de ser.
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
export const INTERVALO_MS = 1100;
/** Uma resposta de reverse é pequena; o que demora é a fila do serviço. */
const TIMEOUT_MS = 15_000;
/**
 * Depois de um 429 o serviço fica de castigo. Dez minutos é escolha
 * conservadora: o custo de esperar é a cidade aparecer mais tarde, e o custo de
 * insistir é o IP do dono entrar numa lista pior que um 429.
 */
export const CASTIGO_429_MS = 10 * 60_000;
/**
 * O Nominatim exige User-Agent identificável, e **bloqueia** quem não manda.
 */
const UA = 'Orbe/1.0 (life-organizer)';

const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Erro de recusa por excesso — quem chama distingue do resto. */
export class GeocoderDeCastigo extends Error {
  constructor(public readonly liberaEm: number) {
    super(`geocoder de castigo até ${new Date(liberaEm).toISOString()}`);
    this.name = 'GeocoderDeCastigo';
  }
}

/* ─────────────────────────── o pedágio, global ─────────────────────────── */

/** Instante em que a próxima chamada pode sair. Vale para o app inteiro. */
let proximaVagaEm = 0;
/** Enquanto > agora, nenhuma chamada sai: o serviço nos pôs de castigo. */
let castigoAte = 0;

/**
 * Reserva a próxima vaga e espera até ela. Reservar **antes** de dormir é o que
 * faz dois passes concorrentes se intercalarem em vez de colidirem: o segundo
 * pega a vaga seguinte, não a mesma.
 */
async function pedagio(): Promise<void> {
  const agora = Date.now();
  const vaga = Math.max(agora, proximaVagaEm);
  proximaVagaEm = vaga + INTERVALO_MS;
  if (vaga > agora) await dormir(vaga - agora);
}

/** Só para teste: devolve o pedágio ao estado inicial. */
export function limparPedagio(): void {
  proximaVagaEm = 0;
  castigoAte = 0;
}

/** Quando o geocoder volta a aceitar chamadas (0 = agora). */
export function castigoAtivoAte(): number {
  return castigoAte;
}

/* ──────────────────────────────── a chamada ──────────────────────────────── */

/** Uma coordenada → cidade. Lança em erro de rede/HTTP; `null` é "sem cidade". */
async function reverso(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<CityMark | null> {
  if (Date.now() < castigoAte) throw new GeocoderDeCastigo(castigoAte);

  const url = new URL(URL_BASE);
  url.searchParams.set('format', 'json');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));
  url.searchParams.set('zoom', '10'); // nível município/cidade
  url.searchParams.set('addressdetails', '1');
  // `namedetails` traz as variantes por idioma na MESMA resposta — é o que faz
  // os apelidos custarem zero chamada.
  url.searchParams.set('namedetails', '1');

  await pedagio();
  if (signal?.aborted) throw new Error('cancelado');

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const repassar = () => ctrl.abort();
  signal?.addEventListener('abort', repassar);
  try {
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: ctrl.signal,
    });
    if (res.status === 429) {
      // Não adianta tentar a próxima amostra: o castigo é do cliente, não da
      // coordenada. Fechar a porta aqui é o que impede o passe inteiro de virar
      // 40 chamadas recusadas em sequência.
      castigoAte = Date.now() + CASTIGO_429_MS;
      throw new GeocoderDeCastigo(castigoAte);
    }
    if (!res.ok) throw new Error(`geocode HTTP ${res.status}`);
    return cidadeDaResposta(await res.json(), lat, lng);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', repassar);
  }
}

/**
 * Lista ordenada das cidades que a rota atravessa.
 *
 * **Lança** se alguma chamada falhar: quem chama deixa a atividade sem `cities`
 * e tenta mais tarde. Devolver o que deu até ali gravaria uma rota pela metade
 * como se fosse completa — e `cities` preenchido é definitivo, ninguém volta
 * nele.
 */
export async function cidadesDaRota(
  pontos: readonly PontoGeo[],
  signal?: AbortSignal,
): Promise<CityMark[]> {
  const limpos = pontos.filter(
    (p) => typeof p?.lat === 'number' && typeof p?.lng === 'number',
  );
  if (limpos.length < 2) return [];

  const amostras = amostrarPorDistancia(limpos);
  const marcas: (CityMark | null)[] = [];
  for (const amostra of amostras) {
    if (signal?.aborted) throw new Error('cancelado');
    marcas.push(await reverso(amostra.lat, amostra.lng, signal));
  }
  return colapsarConsecutivas(marcas);
}
