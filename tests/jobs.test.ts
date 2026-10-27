import { beforeEach, describe, expect, it, vi } from "vitest";
import { dedupeJobs, normalizeAdzuna, normalizeJSearch } from "@/lib/jobs/normalize";
import { JobError, clearJobCache, searchJobs } from "@/lib/jobs/search";
import { job } from "./helpers";

const jsearchRaw = (o: object = {}) => ({ job_id: "a1", job_title: "Dev", employer_name: "Acme", job_city: "Paris", job_country: "FR", job_description: "<p>Use <b>React</b></p>", job_apply_link: "https://acme.example/apply/1", job_is_remote: false, job_publisher: "LinkedIn", ...o });
const mockFetch = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

beforeEach(() => clearJobCache());

describe("normalisation", () => {
  it("normalises a JSearch listing and strips HTML", () => {
    const j = normalizeJSearch(jsearchRaw())!;
    expect(j.description).toBe("Use React");
    expect(j.applyUrl).toBe("https://acme.example/apply/1");
    expect(j.source).toBe("LinkedIn via JSearch");
    expect(j.salary).toBeUndefined();
  });
  it("drops listings without a valid apply URL or title (never invents one)", () => {
    expect(normalizeJSearch(jsearchRaw({ job_apply_link: null }))).toBeNull();
    expect(normalizeJSearch(jsearchRaw({ job_apply_link: "javascript:alert(1)" }))).toBeNull();
    expect(normalizeJSearch(jsearchRaw({ job_title: "" }))).toBeNull();
    expect(normalizeAdzuna({ id: 1, title: "X" }, "gb")).toBeNull();
  });
  it("normalises an Adzuna listing", () => {
    const j = normalizeAdzuna({ id: 9, title: "Remote Dev", description: "desc", redirect_url: "https://adzuna.example/x", company: { display_name: "Z" }, location: { display_name: "London" }, salary_min: 40000, created: "2026-01-02T00:00:00Z" }, "gb")!;
    expect(j).toMatchObject({ id: "adzuna:9", company: "Z", remote: "remote", source: "Adzuna" });
    expect(j.salary?.min).toBe(40000);
  });
});

describe("dedupe", () => {
  it("removes same-URL and same-title/company/location duplicates, keeping the richer copy", () => {
    const a = job({ id: "1", applyUrl: "https://x.example/job/1?utm=a", description: "short" });
    const b = job({ id: "2", applyUrl: "https://x.example/job/1?utm=b", description: "a much longer description" });
    const c = job({ id: "3", applyUrl: "https://other.example/q", title: "Full Stack  Developer", company: "ACME", location: "remote", description: "tiny" });
    const d = job({ id: "4", applyUrl: "https://z.example/different", title: "Cook", company: "Other" });
    const out = dedupeJobs([a, b, c, d]);
    expect(out).toHaveLength(2);
    expect(out.find((j) => j.id === "2")).toBeTruthy();
    expect(out.find((j) => j.id === "4")).toBeTruthy();
  });
});

describe("searchJobs", () => {
  it("fails clearly (no fake listings) when no provider is configured", async () => {
    await expect(searchJobs({ query: "dev", page: 1 }, { env: {} })).rejects.toMatchObject({ kind: "not_configured" });
    await expect(searchJobs({ query: "dev", page: 1 }, { env: { JOB_SEARCH_PROVIDER: "adzuna", ADZUNA_APP_ID: "x" } })).rejects.toThrow(/ADZUNA_APP_KEY/);
  });
  it("returns normalised results and caches identical requests", async () => {
    const f = mockFetch({ data: [jsearchRaw(), jsearchRaw({ job_id: "dup" })] });
    const env = { JSEARCH_API_KEY: "k" };
    const r1 = await searchJobs({ query: "dev", page: 1 }, { env, fetchImpl: f });
    const r2 = await searchJobs({ query: "dev", page: 1 }, { env, fetchImpl: f });
    expect(r1.jobs).toHaveLength(1);
    expect(r2.cached).toBe(true);
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("classifies rate limits, bad keys, malformed payloads and unsupported countries", async () => {
    const env = { JSEARCH_API_KEY: "k" };
    await expect(searchJobs({ query: "a1", page: 1 }, { env, fetchImpl: mockFetch({}, 429) })).rejects.toMatchObject({ kind: "rate_limited" });
    await expect(searchJobs({ query: "a2", page: 1 }, { env, fetchImpl: mockFetch({}, 403) })).rejects.toMatchObject({ kind: "auth" });
    await expect(searchJobs({ query: "a3", page: 1 }, { env, fetchImpl: mockFetch({ nope: 1 }) })).rejects.toMatchObject({ kind: "invalid_response" });
    const ad = { JOB_SEARCH_PROVIDER: "adzuna", ADZUNA_APP_ID: "i", ADZUNA_APP_KEY: "k" };
    await expect(searchJobs({ query: "a4", page: 1, country: "tn" }, { env: ad, fetchImpl: mockFetch({ results: [] }) })).rejects.toBeInstanceOf(JobError);
  });
  it("handles an empty result set", async () => {
    const r = await searchJobs({ query: "nothing", page: 1 }, { env: { JSEARCH_API_KEY: "k" }, fetchImpl: mockFetch({ data: [] }) });
    expect(r.jobs).toEqual([]);
  });
  it("times out slow providers", async () => {
    vi.useFakeTimers();
    const slow = vi.fn((_u: unknown, init?: RequestInit) => new Promise((_r, rej) => init?.signal?.addEventListener("abort", () => rej(Object.assign(new Error("abort"), { name: "AbortError" }))))) as unknown as typeof fetch;
    const p = expect(searchJobs({ query: "slow", page: 1 }, { env: { JSEARCH_API_KEY: "k" }, fetchImpl: slow })).rejects.toMatchObject({ kind: "timeout" });
    await vi.advanceTimersByTimeAsync(11_000);
    await p;
    vi.useRealTimers();
  });
});
