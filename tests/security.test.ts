import { describe, expect, it, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { safeEqual, signSession, verifySession } from "@/lib/auth";
import { rateLimit, resetRateLimits } from "@/lib/rateLimit";
import { proxy as middleware } from "@/proxy";
import { POST as parsePost } from "@/app/api/resume/parse/route";
import { POST as loginPost } from "@/app/api/auth/login/route";
import { POST as jobsPost } from "@/app/api/jobs/search/route";
import { GET as statusGet } from "@/app/api/status/route";
import { emptyProfile } from "@/lib/schema";
import { SAMPLE_RESUME, makeDocx } from "./helpers";

beforeEach(() => { resetRateLimits(); vi.unstubAllEnvs(); });

describe("session tokens", () => {
  it("verifies valid tokens and rejects tampered, expired and empty ones", async () => {
    const t = await signSession("secret", 1000, 5000);
    expect(await verifySession(t, "secret", 2000)).toBe(true);
    expect(await verifySession(t, "other", 2000)).toBe(false);
    expect(await verifySession(t, "secret", 7000)).toBe(false);
    expect(await verifySession(t.replace(/.$/, "0"), "secret", 2000)).toBe(false);
    expect(await verifySession(undefined, "secret")).toBe(false);
    expect(await verifySession("garbage", "secret")).toBe(false);
  });
  it("safeEqual compares strings", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});

describe("access gate (middleware)", () => {
  it("blocks API and page requests without a session, but allows login", async () => {
    vi.stubEnv("APP_ACCESS_CODE", "letmein");
    const api = await middleware(new NextRequest("http://x.test/api/jobs/search", { method: "POST" }));
    expect(api.status).toBe(401);
    const page = await middleware(new NextRequest("http://x.test/analyze"));
    expect(page.status).toBe(307);
    expect(page.headers.get("location")).toContain("/login");
    const login = await middleware(new NextRequest("http://x.test/login"));
    expect(login.headers.get("x-middleware-next")).toBe("1");
  });
  it("lets a signed session through and rejects a forged cookie", async () => {
    vi.stubEnv("APP_ACCESS_CODE", "letmein");
    const good = await signSession("letmein");
    const ok = await middleware(new NextRequest("http://x.test/api/status", { headers: { cookie: `jh_session=${good}` } }));
    expect(ok.headers.get("x-middleware-next")).toBe("1");
    const bad = await middleware(new NextRequest("http://x.test/api/status", { headers: { cookie: "jh_session=9999999999999.deadbeef" } }));
    expect(bad.status).toBe(401);
  });
  it("fails closed in production when no access code is configured", async () => {
    vi.stubEnv("APP_ACCESS_CODE", "");
    vi.stubEnv("NODE_ENV", "production");
    expect((await middleware(new NextRequest("http://x.test/api/status"))).status).toBe(503);
  });
});

describe("login route", () => {
  const login = (code: string) => loginPost(new Request("http://x.test/api/auth/login", { method: "POST", body: JSON.stringify({ code }), headers: { "x-forwarded-for": "1.2.3.4" } }));
  it("sets an HttpOnly cookie on success and refuses a wrong code", async () => {
    vi.stubEnv("APP_ACCESS_CODE", "letmein");
    const ok = await login("letmein");
    expect(ok.status).toBe(200);
    expect(ok.headers.get("set-cookie")).toMatch(/jh_session=.*HttpOnly/i);
    expect((await login("wrong")).status).toBe(401);
  });
  it("rate-limits brute force attempts", async () => {
    vi.stubEnv("APP_ACCESS_CODE", "letmein");
    const codes: number[] = [];
    for (let i = 0; i < 7; i++) codes.push((await login(`bad${i}`)).status);
    expect(codes.slice(0, 5).every((c) => c === 401)).toBe(true);
    expect(codes[6]).toBe(429);
  });
});

describe("rate limiter", () => {
  it("blocks after max and recovers after the window", () => {
    expect(rateLimit("k", 2, 1000, 0).ok).toBe(true);
    expect(rateLimit("k", 2, 1000, 1).ok).toBe(true);
    expect(rateLimit("k", 2, 1000, 2).ok).toBe(false);
    expect(rateLimit("k", 2, 1000, 1500).ok).toBe(true);
  });
});

describe("API routes", () => {
  it("parse route accepts a real DOCX and returns profile + readiness, not raw text", async () => {
    const fd = new FormData();
    fd.set("file", new File([(await makeDocx(SAMPLE_RESUME)) as BlobPart], "cv.docx"));
    const res = await parsePost(new Request("http://x.test/api/resume/parse", { method: "POST", body: fd }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.profile.email).toBe("amine@example.com");
    expect(body.readiness.overall).toBeGreaterThan(0);
    expect(JSON.stringify(body)).not.toContain("Maintained client projects and fixed bugs\nEducation");
  });
  it("parse route rejects oversized, wrong-type and missing uploads with clear errors", async () => {
    const big = new FormData();
    big.set("file", new File([new Uint8Array(4_000_001)], "cv.pdf"));
    expect((await parsePost(new Request("http://x.test/api/resume/parse", { method: "POST", body: big }))).status).toBe(413);
    const txt = new FormData();
    txt.set("file", new File(["hello ".repeat(50)], "cv.pdf"));
    const r = await parsePost(new Request("http://x.test/api/resume/parse", { method: "POST", body: txt }));
    expect(r.status).toBe(422);
    expect((await r.json()).error.code).toBe("unsupported");
    expect((await parsePost(new Request("http://x.test/api/resume/parse", { method: "POST", body: new FormData() }))).status).toBe(400);
    const lying = await parsePost(new Request("http://x.test/api/resume/parse", { method: "POST", body: "x", headers: { "content-length": "9999999" } }));
    expect(lying.status).toBe(413);
  });
  it("jobs route returns a 503 setup error, never mock listings, when unconfigured", async () => {
    vi.stubEnv("JSEARCH_API_KEY", "");
    vi.stubEnv("JOB_SEARCH_PROVIDER", "jsearch");
    const res = await jobsPost(new Request("http://x.test/api/jobs/search", { method: "POST", body: JSON.stringify({ profile: emptyProfile(), query: "developer" }) }));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe("not_configured");
    expect(body.results).toBeUndefined();
  });
  it("jobs route validates input", async () => {
    const res = await jobsPost(new Request("http://x.test/api/jobs/search", { method: "POST", body: JSON.stringify({ profile: emptyProfile(), query: "" }) }));
    expect(res.status).toBe(400);
  });
  it("status route never leaks key values", async () => {
    vi.stubEnv("GROQ_API_KEY", "sk-super-secret-value");
    vi.stubEnv("APP_ACCESS_CODE", "hunter2-code");
    const text = JSON.stringify(await (await statusGet()).json());
    expect(text).not.toContain("sk-super-secret-value");
    expect(text).not.toContain("hunter2-code");
    expect(text).toContain('"configured":true');
  });
});

describe("logging privacy", () => {
  it("error paths do not write resume content to the console", async () => {
    const spies = (["log", "info", "warn", "error"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    const fd = new FormData();
    fd.set("file", new File([(await makeDocx(SAMPLE_RESUME)) as BlobPart], "cv.docx"));
    await parsePost(new Request("http://x.test/api/resume/parse", { method: "POST", body: fd }));
    const logged = spies.flatMap((s) => s.mock.calls).join(" ");
    expect(logged).not.toMatch(/amine|Acme Digital/i);
    spies.forEach((s) => s.mockRestore());
  });
});
