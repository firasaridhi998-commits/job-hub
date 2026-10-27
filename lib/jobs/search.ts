import type { Job } from "@/lib/schema";
import { LIMITS } from "@/lib/config";
import { AdzunaResponse, JSearchResponse, dedupeJobs, normalizeAdzuna, normalizeJSearch } from "./normalize";

export type JobErrorKind = "not_configured" | "rate_limited" | "timeout" | "upstream" | "invalid_response" | "unsupported_country" | "auth";
export class JobError extends Error {
  constructor(public kind: JobErrorKind, message: string) {
    super(message);
  }
}
export interface SearchParams { query: string; location?: string; remoteOnly?: boolean; country?: string; page: number }
export interface SearchResult { jobs: Job[]; provider: string; page: number; fetchedAt: string; cached: boolean }
type Env = Record<string, string | undefined>;

/** Adzuna country list as documented at the time of writing; verify before relying on it. */
export const ADZUNA_COUNTRIES = ["at", "au", "be", "br", "ca", "ch", "de", "es", "fr", "gb", "in", "it", "mx", "nl", "nz", "pl", "sg", "us", "za"];

export function jobProviderStatus(env: Env = process.env): { provider: string; configured: boolean; missing: string[] } {
  const provider = (env.JOB_SEARCH_PROVIDER || "jsearch").toLowerCase();
  const need = provider === "adzuna" ? ["ADZUNA_APP_ID", "ADZUNA_APP_KEY"] : ["JSEARCH_API_KEY"];
  const missing = need.filter((k) => !env[k]);
  return { provider, configured: missing.length === 0 && (provider === "adzuna" || provider === "jsearch"), missing };
}

const cache = new Map<string, { at: number; value: SearchResult }>();
export const clearJobCache = () => cache.clear();

async function getJson(url: string, init: RequestInit, fetchImpl: typeof fetch): Promise<unknown> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), LIMITS.JOB_TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, { ...init, signal: ctl.signal });
    if (res.status === 429) throw new JobError("rate_limited", "The job provider rate limit was reached. Try again later.");
    if (res.status === 401 || res.status === 403) throw new JobError("auth", "The job provider rejected the credentials. Check the API key.");
    if (!res.ok) throw new JobError("upstream", `The job provider returned an error (${res.status}).`);
    try {
      return await res.json();
    } catch {
      throw new JobError("invalid_response", "The job provider returned an unreadable response.");
    }
  } catch (e) {
    if (e instanceof JobError) throw e;
    if (e instanceof Error && e.name === "AbortError") throw new JobError("timeout", "The job provider took too long to respond.");
    throw new JobError("upstream", "Could not reach the job provider.");
  } finally {
    clearTimeout(timer);
  }
}

export async function searchJobs(params: SearchParams, opts: { env?: Env; fetchImpl?: typeof fetch; now?: () => number } = {}): Promise<SearchResult> {
  const env = opts.env ?? process.env;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const nowMs = (opts.now ?? Date.now)();
  const st = jobProviderStatus(env);
  if (!st.configured) {
    throw new JobError("not_configured", st.provider === "adzuna" || st.provider === "jsearch" ? `Job search is not configured. Set ${st.missing.join(" and ")} in your environment variables.` : "JOB_SEARCH_PROVIDER must be jsearch or adzuna.");
  }
  const key = JSON.stringify([st.provider, params]);
  const hit = cache.get(key);
  if (hit && nowMs - hit.at < LIMITS.JOB_CACHE_TTL_MS) return { ...hit.value, cached: true };

  let jobs: Job[] = [];
  const now = new Date(nowMs);
  if (st.provider === "adzuna") {
    const country = (params.country || env.ADZUNA_COUNTRY || "gb").toLowerCase();
    if (!ADZUNA_COUNTRIES.includes(country)) throw new JobError("unsupported_country", `Adzuna does not list "${country}" as a supported country. Try JSearch or another country code.`);
    const q = new URLSearchParams({ app_id: env.ADZUNA_APP_ID!, app_key: env.ADZUNA_APP_KEY!, results_per_page: String(LIMITS.JOB_PAGE_SIZE), what: params.remoteOnly ? `${params.query} remote` : params.query });
    if (params.location) q.set("where", params.location);
    const raw = await getJson(`https://api.adzuna.com/v1/api/jobs/${country}/search/${params.page}?${q}`, { headers: { Accept: "application/json" } }, fetchImpl);
    const parsed = AdzunaResponse.safeParse(raw);
    if (!parsed.success) throw new JobError("invalid_response", "The job provider response was not in the expected format.");
    jobs = parsed.data.results.map((r) => normalizeAdzuna(r, country, now)).filter((j): j is Job => !!j);
    if (params.remoteOnly) jobs = jobs.filter((j) => j.remote === "remote");
  } else {
    const q = new URLSearchParams({ query: params.location ? `${params.query} in ${params.location}` : params.query, page: String(params.page), num_pages: "1" });
    if (params.remoteOnly) q.set("remote_jobs_only", "true");
    if (params.country) q.set("country", params.country.toLowerCase());
    const raw = await getJson(`https://jsearch.p.rapidapi.com/search-v2?${q}`, { headers: { "X-RapidAPI-Key": env.JSEARCH_API_KEY!, "X-RapidAPI-Host": "jsearch.p.rapidapi.com", Accept: "application/json" } }, fetchImpl);
    const parsed = JSearchResponse.safeParse(raw);
    if (!parsed.success) throw new JobError("invalid_response", "The job provider response was not in the expected format.");
	jobs = parsed.data.data.jobs.map((r) => normalizeJSearch(r, now)).filter((j): j is Job => !!j);
  }
  const value: SearchResult = { jobs: dedupeJobs(jobs).slice(0, LIMITS.JOB_PAGE_SIZE), provider: st.provider, page: params.page, fetchedAt: now.toISOString(), cached: false };
  cache.set(key, { at: nowMs, value });
  return value;
}
