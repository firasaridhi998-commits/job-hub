import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, sessionSecret, verifySession } from "@/lib/auth";

const PUBLIC_PATHS = new Set(["/login", "/api/auth/login", "/api/auth/logout"]);

function deny(isApi: boolean, req: NextRequest, status: number, message: string) {
  if (isApi) return NextResponse.json({ error: { code: status === 401 ? "unauthorized" : "not_configured", message } }, { status });
  if (status === 401) return NextResponse.redirect(new URL("/login", req.url));
  return new NextResponse(message, { status });
}

/** Next.js 16 "proxy" (formerly middleware). Every page and API route (except login/logout) passes through this server-side gate. */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();
  const isApi = pathname.startsWith("/api/");
  if (!process.env.APP_ACCESS_CODE) {
    if (process.env.NODE_ENV === "production") {
      return deny(isApi, req, 503, "Access gate is not configured. Set APP_ACCESS_CODE in the environment variables.");
    }
    return NextResponse.next(); // local development convenience only
  }
  const ok = await verifySession(req.cookies.get(SESSION_COOKIE)?.value, sessionSecret());
  if (!ok) return deny(isApi, req, 401, "Please sign in again.");
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|icon.svg|favicon.ico).*)"] };
