/**
 * Ingestão de treinos das contas vinculadas (Strava, intervals.icu).
 *
 * Três modos de chamada (verify_jwt=false — cada modo autentica por si):
 *   1. Cron (pg_cron + pg_net, a cada 15 min): header `x-cron-secret` igual ao
 *      secret CRON_SECRET → processa TODOS os vínculos com status=connected.
 *   2. Usuário ("Sincronizar agora" / pós-vínculo): JWT no Authorization +
 *      body { provider } → processa só aquele vínculo daquele usuário.
 *   3. Usuário (pós-push do sync HealthKit): JWT + body { mode: 'reconcile' } →
 *      só a varredura reconcileRecent — mescla duplicatas multi-app do
 *      HealthKit mesmo sem nenhum provider vinculado.
 */
import { adminClient } from '../_shared/admin.ts';
import { getUserFromRequest, json, preflight } from '../_shared/auth.ts';
import { reconcileRecent, runIngest, runIngestAll } from '../_shared/ingest.ts';

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
  let body: { provider?: string; mode?: string } = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    // body vazio → erro abaixo
  }

  if (body.mode === 'reconcile') {
    try {
      const swept = await reconcileRecent(admin, user.id);
      return json({ mode: 'reconcile', swept });
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : String(err) }, 500);
    }
  }

  const provider = body.provider;
  if (provider !== 'strava' && provider !== 'intervals') {
    return json({ error: "provider deve ser 'strava' ou 'intervals', ou mode: 'reconcile'" }, 400);
  }
  const summary = await runIngest(admin, user.id, provider);
  return json({ mode: 'user', summary }, summary.error ? 422 : 200);
});
