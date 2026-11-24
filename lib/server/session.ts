import { cookies } from "next/headers";

/**
 * Minimal signed-cookie session (HMAC-SHA256 via Web Crypto, no extra library).
 * The cookie holds the wallet address that signed in with SIWE, and an expiry.
 *
 * Secret: SESSION_SECRET if set, otherwise derived from SUPABASE_SERVICE_ROLE_KEY
 * so there's one less variable to configure. Rotating either signs everyone out.
 */
const COOKIE = "sp_session";
const NONCE_COOKIE = "sp_nonce";
const MAX_AGE_S = 7 * 24 * 3600;

const enc = new TextEncoder();
const b64url = (b: ArrayBuffer | Uint8Array) =>
  Buffer.from(b instanceof Uint8Array ? b : new Uint8Array(b)).toString("base64url");

export const sessionConfigured = () => !!(process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY);

async function key(): Promise<CryptoKey> {
  const raw = process.env.SESSION_SECRET || (process.env.SUPABASE_SERVICE_ROLE_KEY ? "stonkpet-session:" + process.env.SUPABASE_SERVICE_ROLE_KEY : "");
  if (!raw) throw new Error("No session secret: set SESSION_SECRET or SUPABASE_SERVICE_ROLE_KEY");
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(raw));
  return crypto.subtle.importKey("raw", digest, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

async function sign(payload: object): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = b64url(await crypto.subtle.sign("HMAC", await key(), enc.encode(body)));
  return `${body}.${sig}`;
}

async function verify<T>(token: string | undefined): Promise<T | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const ok = await crypto.subtle.verify("HMAC", await key(), Buffer.from(sig, "base64url"), enc.encode(body));
  if (!ok) return null;
  try { return JSON.parse(Buffer.from(body, "base64url").toString()) as T; } catch { return null; }
}

const cookieOpts = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };

export type Session = { address: `0x${string}`; exp: number };

export async function getSession(): Promise<Session | null> {
  const s = await verify<Session>((await cookies()).get(COOKIE)?.value);
  return s && s.exp > Date.now() / 1000 ? s : null;
}

export async function setSession(address: `0x${string}`) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_S;
  (await cookies()).set(COOKIE, await sign({ address: address.toLowerCase(), exp }), { ...cookieOpts, maxAge: MAX_AGE_S });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

/** One-time nonce for Sign-In with Ethereum, held in a short-lived signed cookie. */
export async function setNonce(nonce: string) {
  (await cookies()).set(NONCE_COOKIE, await sign({ nonce, exp: Math.floor(Date.now() / 1000) + 600 }), { ...cookieOpts, maxAge: 600 });
}
export async function takeNonce(): Promise<string | null> {
  const jar = await cookies();
  const v = await verify<{ nonce: string; exp: number }>(jar.get(NONCE_COOKIE)?.value);
  jar.delete(NONCE_COOKIE);
  return v && v.exp > Date.now() / 1000 ? v.nonce : null;
}
