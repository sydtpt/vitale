/**
 * OAuth da Strava — três rotas (verify_jwt=false; cada rota autentica por si):
 *
 *   POST /strava-oauth/authorize   (JWT do usuário)
 *     body { platform: 'mobile' | 'web' } → { url } de autorização da Strava.
 *     O `state` é stateless: base64url(userId|platform|exp) + HMAC-SHA256 com
 *     OAUTH_STATE_SECRET — o JWT nunca aparece em URL de navegador.
 *
 *   GET /strava-oauth/callback?code&state   (redirect do navegador, sem JWT)
 *     Verifica o HMAC/expiração do state → troca code por tokens → upsert
 *     linked_accounts + secrets → primeiro chunk de ingest → 302 de volta ao
 *     app (vitale://…) ou à web ({WEB_APP_URL}/conexoes?…).
 *
 *   DELETE /strava-oauth/link   (JWT do usuário)
 *     Desautoriza na Strava (best-effort; o token só existe no servidor) e
 *     apaga o vínculo. O client também pode só deletar linked_accounts via RLS,
 *     mas aí o app continua autorizado na conta Strava do usuário.
 *
 * Secrets: STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, OAUTH_STATE_SECRET,
 * WEB_APP_URL (base da web para o retorno, ex.: https://vitale.example.com).
 */
import { adminClient } from '../_shared/admin.ts';
import { getUserFromRequest, json, preflight } from '../_shared/auth.ts';
import {
  deauthorizeStrava,
  exchangeStravaCode,
  stravaAuthorizeUrl,
} from '../_shared/providers/strava.ts';
import { runIngest } from '../_shared/ingest.ts';

const STATE_TTL_MS = 10 * 60_000;
const MOBILE_RETURN = 'vitale://configuracoes/conexoes';

/* ───────────────────── state assinado (HMAC) ───────────────────── */

function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}

function b64urlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return atob(s.replaceAll('-', '+').replaceAll('_', '/') + pad);
}

async function hmac(payload: string): Promise<string> {
  const secret = Deno.env.get('OAUTH_STATE_SECRET');
  if (!secret) throw new Error('OAUTH_STATE_SECRET não configurado');
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return b64url(new Uint8Array(sig));
}

async function makeState(userId: string, platform: string): Promise<string> {
  const payload = b64url(
    new TextEncoder().encode(`${userId}|${platform}|${Date.now() + STATE_TTL_MS}`),
  );
  return `${payload}.${await hmac(payload)}`;
}

async function verifyState(state: string): Promise<{ userId: string; platform: string } | null> {
  const [payload, sig] = state.split('.');
  if (!payload || !sig) return null;
  if ((await hmac(payload)) !== sig) return null;
  const [userId, platform, expStr] = b64urlDecode(payload).split('|');
  if (!userId || !platform || Date.now() > Number(expStr)) return null;
  return { userId, platform };
}

/* ───────────────────── retorno ao app/web ───────────────────── */

function returnUrl(platform: string, params: Record<string, string>): string {
  const qs = new URLSearchParams(params).toString();
  if (platform === 'web') {
    const base = (Deno.env.get('WEB_APP_URL') ?? '').replace(/\/$/, '');
    return `${base}/conexoes?${qs}`;
  }
  return `${MOBILE_RETURN}?${qs}`;
}

function redirect(url: string): Response {
  return new Response(null, { status: 302, headers: { Location: url } });
}

/* ───────────────────── handler ───────────────────── */

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const url = new URL(req.url);
  const route = url.pathname.split('/').filter(Boolean).pop();

  // POST /authorize — gera a URL de autorização para o navegador do usuário.
  if (req.method === 'POST' && route === 'authorize') {
    const user = await getUserFromRequest(req);
    if (!user) return json({ error: 'não autenticado' }, 401);
    let platform = 'mobile';
    try {
      const body = await req.json();
      if (body?.platform === 'web') platform = 'web';
    } catch {
      // body ausente → mobile
    }
    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/strava-oauth/callback`;
    const state = await makeState(user.id, platform);
    return json({ url: stravaAuthorizeUrl(redirectUri, state) });
  }

  // GET /callback — redirect da Strava (sem JWT; autentica pelo state).
  if (req.method === 'GET' && route === 'callback') {
    const state = url.searchParams.get('state') ?? '';
    const verified = await verifyState(state);
    if (!verified) return json({ error: 'state inválido ou expirado' }, 400);
    const { userId, platform } = verified;

    const code = url.searchParams.get('code');
    if (!code) {
      // Usuário negou acesso na Strava (?error=access_denied).
      return redirect(returnUrl(platform, { provider: 'strava', status: 'error', reason: 'denied' }));
    }

    const admin = adminClient();
    try {
      const tokens = await exchangeStravaCode(code);
      const { error: accErr } = await admin.from('linked_accounts').upsert(
        {
          user_id: userId,
          provider: 'strava',
          status: 'connected',
          athlete_id: tokens.athleteId ?? null,
          athlete_name: tokens.athleteName ?? null,
          connected_at: new Date().toISOString(),
          last_error: null,
        },
        { onConflict: 'user_id,provider' },
      );
      if (accErr) throw new Error(accErr.message);
      const { error: secErr } = await admin.from('linked_account_secrets').upsert(
        {
          user_id: userId,
          provider: 'strava',
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
          expires_at: tokens.expiresAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,provider' },
      );
      if (secErr) throw new Error(secErr.message);

      // Primeiro chunk do backfill; o cron continua o resto.
      await runIngest(admin, userId, 'strava');
      return redirect(returnUrl(platform, { provider: 'strava', status: 'ok' }));
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'exchange_failed';
      return redirect(
        returnUrl(platform, { provider: 'strava', status: 'error', reason: reason.slice(0, 120) }),
      );
    }
  }

  // DELETE /link — desautoriza na Strava e remove o vínculo.
  if (req.method === 'DELETE' && route === 'link') {
    const user = await getUserFromRequest(req);
    if (!user) return json({ error: 'não autenticado' }, 401);
    const admin = adminClient();
    const { data: secret } = await admin
      .from('linked_account_secrets')
      .select('access_token')
      .eq('user_id', user.id)
      .eq('provider', 'strava')
      .maybeSingle();
    if (secret?.access_token) await deauthorizeStrava(secret.access_token);
    await admin
      .from('linked_accounts')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', 'strava');
    return json({ status: 'unlinked' });
  }

  return json({ error: 'rota desconhecida' }, 404);
});
