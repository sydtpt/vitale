/**
 * Vincula a conta intervals.icu do usuário (ponte Garmin → Vitale).
 *
 * POST { apiKey, athleteId }  (JWT do usuário no Authorization — verify_jwt=true)
 *   1. valida a chave com GET /athlete/{id} no intervals.icu
 *   2. upsert em linked_accounts (status=connected, athlete_meta com max_hr)
 *      + linked_account_secrets (api_key) — via service role
 *   3. dispara o primeiro chunk de ingestão inline (o cron continua o backfill)
 *
 * DELETE { } com ?provider — não existe aqui: o desvincular é um DELETE direto
 * em linked_accounts pelo client (RLS permite; secrets caem por cascade).
 */
import { adminClient } from '../_shared/admin.ts';
import { getUserFromRequest, json, preflight } from '../_shared/auth.ts';
import { validateIntervals } from '../_shared/providers/intervals.ts';
import { runIngest } from '../_shared/ingest.ts';

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const user = await getUserFromRequest(req);
  if (!user) return json({ error: 'não autenticado' }, 401);

  let body: { apiKey?: string; athleteId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'body inválido' }, 400);
  }
  const apiKey = body.apiKey?.trim();
  const athleteId = body.athleteId?.trim().replace(/^i?/, 'i'); // aceita "123" ou "i123"
  if (!apiKey || !athleteId) return json({ error: 'apiKey e athleteId são obrigatórios' }, 400);

  let athlete;
  try {
    athlete = await validateIntervals(apiKey, athleteId);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'validação falhou' }, 422);
  }

  const admin = adminClient();
  const { error: accErr } = await admin.from('linked_accounts').upsert(
    {
      user_id: user.id,
      provider: 'intervals',
      status: 'connected',
      athlete_id: athlete.athleteId,
      athlete_name: athlete.name ?? null,
      athlete_meta: athlete.meta,
      connected_at: new Date().toISOString(),
      last_error: null,
    },
    { onConflict: 'user_id,provider' },
  );
  if (accErr) return json({ error: accErr.message }, 500);
  const { error: secErr } = await admin.from('linked_account_secrets').upsert(
    {
      user_id: user.id,
      provider: 'intervals',
      api_key: apiKey,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,provider' },
  );
  if (secErr) return json({ error: secErr.message }, 500);

  // Primeiro chunk do backfill inline — feedback imediato na tela de Conexões.
  const summary = await runIngest(admin, user.id, 'intervals');
  return json({ status: 'connected', athleteName: athlete.name, firstSync: summary });
});
