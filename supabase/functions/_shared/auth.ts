/**
 * Helpers de autenticação/resposta comuns às edge functions.
 * O usuário é resolvido do JWT no header Authorization (client anon + getUser).
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

/** CORS para `supabase.functions.invoke` a partir do navegador (web Angular). */
export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

/** Resposta padrão ao preflight OPTIONS; null quando não é preflight. */
export function preflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  return null;
}

/** Usuário autenticado do request, ou null (sem header / JWT inválido). */
export async function getUserFromRequest(req: Request): Promise<{ id: string } | null> {
  const authorization = req.headers.get('Authorization');
  if (!authorization) return null;
  const client = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } },
  );
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id };
}
