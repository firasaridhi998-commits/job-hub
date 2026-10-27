// Web Crypto only, so it runs in Edge middleware and in Node route handlers.
const enc = new TextEncoder();
export const SESSION_COOKIE = "jh_session";
export const SESSION_TTL_MS = 7 * 24 * 3600 * 1000;

async function hmacHex(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export async function signSession(secret: string, now = Date.now(), ttl = SESSION_TTL_MS): Promise<string> {
  const exp = String(now + ttl);
  return `${exp}.${await hmacHex(secret, exp)}`;
}

export async function verifySession(token: string | undefined, secret: string, now = Date.now()): Promise<boolean> {
  if (!token || !secret) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig) return false;
  const n = Number(exp);
  if (!Number.isFinite(n) || n < now) return false;
  return safeEqual(sig, await hmacHex(secret, exp));
}

export function sessionSecret(env: Record<string, string | undefined> = process.env): string {
  return env.SESSION_SECRET || env.APP_ACCESS_CODE || "";
}
