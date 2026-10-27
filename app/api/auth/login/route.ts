import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_TTL_MS, safeEqual, sessionSecret, signSession } from "@/lib/auth";
import { LIMITS } from "@/lib/config";
import { errorJson, limited, readJson } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const code = process.env.APP_ACCESS_CODE;
  if (!code) return errorJson(503, "not_configured", "APP_ACCESS_CODE is not set on the server.");
  const lim = limited(req, "login", LIMITS.RATE_LOGIN);
  if (lim) return lim;
  const body = (await readJson(req, 2000)) as { code?: unknown } | null;
  if (!body || typeof body.code !== "string" || !safeEqual(body.code, code)) return errorJson(401, "invalid_code", "That access code is not correct.");
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await signSession(sessionSecret()), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
  return res;
}
