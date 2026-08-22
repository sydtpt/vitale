/**
 * Clientes de catálogo do módulo Cultura — cinco provedores atrás de um shape só.
 * Spec: docs/specs/cultura/spec.md
 *
 * Só o TMDB exige credencial (`TMDB_API_KEY`); os outros quatro são keyless.
 * Mesmo assim a busca inteira mora aqui e não no cliente, por três motivos:
 * o segredo do TMDB (CAP-7), o CORS, e o rate-limit do MusicBrainz, que exige
 * `User-Agent` próprio — header que o navegador não deixa o app definir.
 *
 * A CADEIA de provedores NÃO é decidida aqui: vem de `cultura/tipos.ts` no
 * núcleo compartilhado, o mesmo módulo que os apps leem. Duplicá-la faria a
 * ordem de fallback divergir calada entre cliente e servidor.
 */
import { cadeiaDeProvedores } from '../../../../packages/shared/src/cultura/tipos.ts';

/** Shape único de resposta — o cliente não precisa saber quem respondeu. */
export interface CulturaCandidato {
  fonte: string;
  fonteId: string;
  titulo: string;
  criador?: string;
  capaUrl?: string;
  extra?: Record<string, unknown>;
}

/**
 * Identificação exigida pelo MusicBrainz e boa educação nos demais. A política
 * deles pede contato real e alcançável — é como te avisam antes de bloquear,
 * em vez de só bloquear. O repositório ainda se chama `vitale`: o nome visível
 * virou Orbe, mas o repo e os bundle IDs não foram renomeados.
 */
const USER_AGENT = 'Orbe/1.0 (https://github.com/sydtpt/vitale)';

/** MusicBrainz permite 1 req/s. Serializa e espaça, em vez de levar bloqueio. */
let musicBrainzLivreEm = 0;
async function throttleMusicBrainz(): Promise<void> {
  const agora = Date.now();
  const espera = Math.max(0, musicBrainzLivreEm - agora);
  musicBrainzLivreEm = agora + espera + 1100;
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
}

async function getJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...headers },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return await res.json();
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

/* ───────────────────────── provedores ───────────────────────── */

async function googleBooks(q: string): Promise<CulturaCandidato[]> {
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=10`;
  const d = await getJson(url) as { items?: Array<Record<string, any>> };
  return (d.items ?? []).map((it) => {
    const v = it['volumeInfo'] ?? {};
    return {
      fonte: 'google_books',
      fonteId: String(it['id']),
      titulo: String(v['title'] ?? ''),
      criador: (v['authors'] as string[] | undefined)?.join(', '),
      capaUrl: str(v['imageLinks']?.['thumbnail'])?.replace('http://', 'https://'),
      extra: { paginas: v['pageCount'], ano: anoDe(str(v['publishedDate'])) },
    };
  }).filter((c) => c.titulo);
}

async function openLibrary(q: string): Promise<CulturaCandidato[]> {
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=10`;
  const d = await getJson(url) as { docs?: Array<Record<string, any>> };
  return (d.docs ?? []).map((doc) => ({
    fonte: 'open_library',
    fonteId: String(doc['key'] ?? '').replace('/works/', ''),
    titulo: String(doc['title'] ?? ''),
    criador: (doc['author_name'] as string[] | undefined)?.join(', '),
    capaUrl: doc['cover_i'] ? `https://covers.openlibrary.org/b/id/${doc['cover_i']}-M.jpg` : undefined,
    extra: { paginas: doc['number_of_pages_median'], ano: doc['first_publish_year'] },
  })).filter((c) => c.titulo && c.fonteId);
}

async function tmdb(q: string): Promise<CulturaCandidato[]> {
  const key = Deno.env.get('TMDB_API_KEY');
  // Ausência de chave é ERRO, não "sem resultado": deixar cair silenciosamente
  // para o iTunes esconderia uma função mal configurada por tempo indefinido.
  if (!key) throw new Error('TMDB_API_KEY não configurado');

  // O TMDB emite DUAS credenciais e elas não são intercambiáveis: a API Key
  // (v3, 32 hex) vai na query; o Read Access Token (v4, JWT) vai como Bearer.
  // Aceitar as duas evita o modo de falha mais chato daqui — a credencial
  // errada dá 401, o fallback engole, e a busca de filme fica pior sem avisar.
  //
  // PREFIRA o Read Access Token: header não entra em log de proxy, CDN nem
  // servidor, e query string entra. A v3 fica suportada como rede, não como
  // recomendação.
  const ehToken = key.startsWith('eyJ');
  let url = `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(q)}&language=pt-BR`;
  const headers: Record<string, string> = {};
  if (ehToken) headers['Authorization'] = `Bearer ${key}`;
  else url += `&api_key=${encodeURIComponent(key)}`;

  const d = await getJson(url, headers) as {
    results?: Array<Record<string, any>>;
  };
  return (d.results ?? []).map((m) => ({
    fonte: 'tmdb',
    fonteId: String(m['id']),
    titulo: String(m['title'] ?? m['original_title'] ?? ''),
    // O diretor exige outra chamada (/movie/{id}/credits); fica para o save,
    // não para cada linha de resultado.
    capaUrl: m['poster_path'] ? `https://image.tmdb.org/t/p/w342${m['poster_path']}` : undefined,
    extra: { ano: anoDe(str(m['release_date'])) },
  })).filter((c) => c.titulo);
}

/** Cobre filme, álbum e podcast; `entity` muda por tipo. */
async function itunes(q: string, entity: string): Promise<CulturaCandidato[]> {
  const url =
    `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=${entity}&limit=10`;
  const d = await getJson(url) as { results?: Array<Record<string, any>> };
  return (d.results ?? []).map((r) => ({
    fonte: 'itunes',
    fonteId: String(r['trackId'] ?? r['collectionId'] ?? ''),
    titulo: String(r['trackName'] ?? r['collectionName'] ?? ''),
    criador: str(r['artistName']),
    capaUrl: str(r['artworkUrl100'])?.replace('100x100', '400x400'),
    extra: {
      ano: anoDe(str(r['releaseDate'])),
      duracaoMin: r['trackTimeMillis'] ? Math.round(r['trackTimeMillis'] / 60000) : undefined,
      nFaixas: r['trackCount'],
    },
  })).filter((c) => c.titulo && c.fonteId);
}

async function musicBrainz(q: string): Promise<CulturaCandidato[]> {
  await throttleMusicBrainz();
  const url =
    `https://musicbrainz.org/ws/2/release-group?query=${encodeURIComponent(q)}&fmt=json&limit=10`;
  const d = await getJson(url) as { 'release-groups'?: Array<Record<string, any>> };
  return (d['release-groups'] ?? []).map((rg) => ({
    fonte: 'musicbrainz',
    fonteId: String(rg['id']),
    titulo: String(rg['title'] ?? ''),
    criador: (rg['artist-credit'] as Array<Record<string, any>> | undefined)?.[0]?.['name'],
    // O MusicBrainz não serve capa; a Cover Art Archive é chaveada pelo mesmo id.
    capaUrl: rg['id'] ? `https://coverartarchive.org/release-group/${rg['id']}/front-250` : undefined,
    extra: { ano: anoDe(str(rg['first-release-date'])) },
  })).filter((c) => c.titulo);
}

function anoDe(data: string | undefined): number | undefined {
  const n = data ? Number(data.slice(0, 4)) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

/** Um provedor por nome, já ciente do tipo (o iTunes muda de `entity`). */
function chamar(provedor: string, tipo: string, q: string): Promise<CulturaCandidato[]> {
  switch (provedor) {
    case 'google_books': return googleBooks(q);
    case 'open_library': return openLibrary(q);
    case 'tmdb': return tmdb(q);
    case 'musicbrainz': return musicBrainz(q);
    case 'itunes': {
      const entity = tipo === 'filme' ? 'movie' : tipo === 'podcast' ? 'podcast' : 'album';
      return itunes(q, entity);
    }
    default: return Promise.resolve([]);
  }
}

export interface BuscaResultado {
  candidatos: CulturaCandidato[];
  /** Quem respondeu. `null` quando a cadeia inteira falhou ou veio vazia. */
  provedor: string | null;
  /** Provedores que erraram, com o motivo — para diagnóstico, não para a UI. */
  falhas: Array<{ provedor: string; erro: string }>;
}

/**
 * Percorre a cadeia do tipo e devolve o primeiro provedor com resultado.
 *
 * O fallback dispara em DOIS gatilhos: zero resultados **e** erro ou timeout.
 * Tratar só o primeiro anularia o fallback de filme, cuja razão de existir é o
 * TMDB indisponível — um 401 não é "não achou".
 *
 * Cadeia esgotada devolve lista vazia, e não erro: é o sinal para o cliente
 * oferecer o cadastro manual (CAP-1), que é um caminho legítimo e não uma falha.
 */
export async function buscarCultura(tipo: string, q: string): Promise<BuscaResultado> {
  const falhas: BuscaResultado['falhas'] = [];
  for (const provedor of cadeiaDeProvedores(tipo)) {
    try {
      const candidatos = await chamar(provedor, tipo, q);
      if (candidatos.length > 0) return { candidatos, provedor, falhas };
    } catch (e) {
      falhas.push({ provedor, erro: e instanceof Error ? e.message : String(e) });
    }
  }
  return { candidatos: [], provedor: null, falhas };
}
