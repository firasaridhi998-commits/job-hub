import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { LIMITS } from "@/lib/config";

export function errorJson(status: number, code: string, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status, headers: { "Cache-Control": "no-store" } });
}
export function ok<T>(data: T) {
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
/** Returns an error response when the caller is over the limit, otherwise null. */
export function limited(req: Request, bucket: string, cfg: { max: number; windowMs: number } = LIMITS.RATE_GENERAL) {
  const r = rateLimit(`${bucket}:${clientIp(req)}`, cfg.max, cfg.windowMs);
  return r.ok ? null : errorJson(429, "rate_limited", `Too many requests. Try again in ${r.retryAfterSec} seconds.`);
}
export async function readJson(req: Request, maxBytes = 200_000): Promise<unknown | null> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) return null;
  try {
    const text = await req.text();
    if (text.length > maxBytes) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}
