/**
 * Busca de catálogo do módulo Cultura (verify_jwt=true).
 * Spec: docs/specs/cultura/spec.md · story 2
 *
 *   POST /cultura-search   (JWT do usuário)
 *     body { tipo: 'livro'|'filme'|'podcast'|'album', q: string }
 *     → { candidatos: [{ fonte, fonteId, titulo, criador?, capaUrl?, extra? }],
 *         provedor: string | null }
 *
 * Por que a busca não é feita no cliente, mesmo com quatro dos cinco provedores
 * sendo keyless:
 *   1. o segredo do TMDB não pode ir para bundle nenhum (CAP-7);
 *   2. CORS — nem todo provedor responde a XHR de navegador;
 *   3. o MusicBrainz exige `User-Agent` próprio, header que o navegador não
 *      deixa a aplicação definir, e limita a 1 req/s.
 *
 * `verify_jwt=true` não é sobre dado do usuário — a busca não toca em nada
 * dele. É para a função não virar proxy aberto queimando a cota do TMDB.
 *
 * Secrets: TMDB_API_KEY — aceita tanto a API Key v3 (32 hex, vai na query)
 * quanto o Read Access Token v4 (JWT, vai como Bearer). O provedor detecta
 * qual é pelo formato; as duas funcionam.
 */
import { json, preflight } from '../_shared/auth.ts';
import { buscarCultura } from '../_shared/providers/cultura.ts';
import { isTipoConhecido } from '../../../packages/shared/src/cultura/tipos.ts';

const MAX_Q = 200;

Deno.serve(async (req: Request): Promise<Response> => {
  const pre = preflight(req);
  if (pre) return pre;

  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let body: { tipo?: unknown; q?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'json_invalido' }, 400);
  }

  const tipo = typeof body.tipo === 'string' ? body.tipo : '';
  const q = typeof body.q === 'string' ? body.q.trim() : '';

  // Mesmo porteiro que o núcleo aplica na escrita (CAP-13), aqui na borda:
  // buscar por um tipo que não existe não tem cadeia de provedores.
  if (!isTipoConhecido(tipo)) return json({ error: 'tipo_desconhecido', tipo }, 400);
  if (q.length === 0) return json({ error: 'consulta_vazia' }, 400);
  if (q.length > MAX_Q) return json({ error: 'consulta_muito_longa' }, 400);

  try {
    const { candidatos, provedor, falhas } = await buscarCultura(tipo, q);
    // Cadeia esgotada devolve 200 com lista vazia, NÃO erro: é o sinal para o
    // cliente oferecer cadastro manual (CAP-1) — caminho legítimo, não falha.
    // As falhas viajam junto para diagnóstico, sem virar erro para o usuário.
    return json({ candidatos, provedor, falhas });
  } catch (e) {
    console.error('cultura-search:', e);
    return json({ error: 'busca_falhou' }, 502);
  }
});
