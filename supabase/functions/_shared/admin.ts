/**
 * Client Supabase com service role — SÓ para edge functions. Ignora RLS, então
 * TODA query construída com ele deve filtrar `user_id` explicitamente (o
 * `runIngest` recebe o userId por parâmetro e nunca monta query sem filtro).
 * SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY são injetadas pelo runtime.
 */
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

export type Admin = SupabaseClient;

export function adminClient(): Admin {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
