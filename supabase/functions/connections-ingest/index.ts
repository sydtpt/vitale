/**
 * Ingestão de treinos das contas vinculadas (Strava, intervals.icu).
 *
 * Dois modos de chamada (verify_jwt=false — cada modo autentica por si):
 *   1. Cron (pg_cron + pg_net, a cada 15 min): header `x-cron-secret` igual ao
 *      secret CRON_SECRET → processa TODOS os vínculos com status=connected.
 *   2. Usuário ("Sincronizar agora" / pós-vínculo): JWT no Authorization +
 *      body { provider } → processa só aquele vínculo daquele usuário.
 */
import { adminClient } from '../_shared/admin.ts';
import { getUserFromRequest, json, preflight } from '../_shared/auth.ts';
import { runIngest, runIngestAll } from '../_shared/ingest.ts';

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const admin = adminClient();

  const cronSecret = Deno.env.get('CRON_SECRET');
  const provided = req.headers.get('x-cron-secret');
  if (cronSecret && provided) {
    if (provided !== cronSecret) return json({ error: 'cron secret inválido' }, 401);
    const summaries = await runIngestAll(admin);
    return json({ mode: 'cron', summaries });
  }

  const user = await getUserFromRequest(req);
  if (!user) return json({ error: 'não autenticado' }, 401);
  let provider: string | undefined;
  try {
    provider = (await req.json())?.provider;
  } catch {
    // body vazio → erro abaixo
  }
  if (provider !== 'strava' && provider !== 'intervals') {
    return json({ error: "provider deve ser 'strava' ou 'intervals'" }, 400);
  }
  const summary = await runIngest(admin, user.id, provider);
  return json({ mode: 'user', summary }, summary.error ? 422 : 200);
});
