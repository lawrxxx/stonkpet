import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client (service role). Every query must be scoped to the
 * signed-in user's id; RLS blocks the public anon key entirely.
 * Never import this from client components.
 */
let client: SupabaseClient | null = null;

/** The Vercel–Supabase integration and manual setup name the URL differently; accept both. */
const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

export const dbConfigured = () => !!url() && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

export function db(): SupabaseClient {
  if (!dbConfigured()) throw new Error("Supabase is not configured");
  client ??= createClient(url()!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

/** Find or create the user row for a wallet address; returns the user id. */
export async function upsertUser(address: string): Promise<string> {
  const a = address.toLowerCase();
  const { data, error } = await db()
    .from("users")
    .upsert({ address: a, last_seen_at: new Date().toISOString() }, { onConflict: "address" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

const usedLocally = new Map<string, number>();
/**
 * Mark a sign-in nonce as used. Returns false if it was already used (a replay).
 * Uses the database when configured; otherwise an in-memory set (single instance only).
 */
export async function consumeNonce(nonce: string): Promise<boolean> {
  if (dbConfigured()) {
    const { error } = await db().from("auth_nonces").insert({ nonce });
    if (!error) return true;
    if (error.code === "23505") return false; // unique violation: already used
    throw error;
  }
  const now = Date.now();
  for (const [k, t] of usedLocally) if (now - t > 15 * 60_000) usedLocally.delete(k);
  if (usedLocally.has(nonce)) return false;
  usedLocally.set(nonce, now);
  return true;
}
