import { z } from "zod";
import type { Job } from "@/lib/schema";

const httpUrl = (u: unknown): string | null => {
  if (typeof u !== "string") return null;
  try {
    const x = new URL(u);
    return x.protocol === "https:" || x.protocol === "http:" ? x.toString() : null;
  } catch {
    return null;
  }
};
export function detectRemote(text: string): Job["remote"] {
  if (/\bhybrid\b/i.test(text)) return "hybrid";
  if (/\bremote\b|work\s+from\s+home|télétravail/i.test(text)) return "remote";
  return "unknown";
}
const strip = (s: unknown) => (typeof s === "string" ? s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : "");

const AdzunaJob = z.object({
  id: z.union([z.string(), z.number()]),
  title: z.string().optional(),
  description: z.string().optional(),
  created: z.string().optional(),
  redirect_url: z.string().optional(),
  company: z.object({ display_name: z.string().optional() }).partial().optional(),
  location: z.object({ display_name: z.string().optional() }).partial().optional(),
  salary_min: z.number().nullish(),
  salary_max: z.number().nullish(),
  contract_time: z.string().nullish(),
});
export const AdzunaResponse = z.object({ results: z.array(z.unknown()) });

export function normalizeAdzuna(raw: unknown, country: string, now = new Date()): Job | null {
  const r = AdzunaJob.safeParse(raw);
  if (!r.success) return null;
  const j = r.data;
  const applyUrl = httpUrl(j.redirect_url);
  const title = strip(j.title);
  if (!applyUrl || !title) return null;
  const description = strip(j.description);
  const location = j.location?.display_name ?? "";
  return {
    id: `adzuna:${j.id}`, provider: "adzuna", title, company: j.company?.display_name ?? "Unknown employer", location, country,
    remote: detectRemote(`${title} ${location} ${description}`), employmentType: j.contract_time ?? undefined, description, requirements: [],
    salary: j.salary_min || j.salary_max ? { min: j.salary_min ?? undefined, max: j.salary_max ?? undefined, period: "year" } : undefined,
    postedAt: j.created, applyUrl, source: "Adzuna", lastCheckedAt: now.toISOString(),
  };
}

const JSearchJob = z.object({
  job_id: z.string().optional(),
  job_title: z.string().optional(),
  employer_name: z.string().nullish(),
  job_city: z.string().nullish(),
  job_state: z.string().nullish(),
  job_country: z.string().nullish(),
  job_is_remote: z.boolean().nullish(),
  job_description: z.string().nullish(),
  job_apply_link: z.string().nullish(),
  job_posted_at_datetime_utc: z.string().nullish(),
  job_min_salary: z.number().nullish(),
  job_max_salary: z.number().nullish(),
  job_salary_currency: z.string().nullish(),
  job_salary_period: z.string().nullish(),
  job_employment_type: z.string().nullish(),
  job_publisher: z.string().nullish(),
  job_highlights: z.object({ Qualifications: z.array(z.string()).optional() }).partial().nullish(),
});
export const JSearchResponse = z.object({
  data: z.object({
    jobs: z.array(z.unknown()),
  }),
});

export function normalizeJSearch(raw: unknown, now = new Date()): Job | null {
  const r = JSearchJob.safeParse(raw);
  if (!r.success) return null;
  const j = r.data;
  const applyUrl = httpUrl(j.job_apply_link);
  const title = strip(j.job_title);
  if (!applyUrl || !title) return null;
  const description = strip(j.job_description);
  const location = [j.job_city, j.job_state, j.job_country].filter(Boolean).join(", ");
  return {
    id: `jsearch:${j.job_id ?? applyUrl}`, provider: "jsearch", title, company: j.employer_name ?? "Unknown employer", location, country: j.job_country ?? undefined,
    remote: j.job_is_remote ? "remote" : detectRemote(`${title} ${description.slice(0, 600)}`), employmentType: j.job_employment_type ?? undefined, description,
    requirements: (j.job_highlights?.Qualifications ?? []).map(strip).filter(Boolean).slice(0, 15),
    salary: j.job_min_salary || j.job_max_salary ? { min: j.job_min_salary ?? undefined, max: j.job_max_salary ?? undefined, currency: j.job_salary_currency ?? undefined, period: j.job_salary_period ?? undefined } : undefined,
    postedAt: j.job_posted_at_datetime_utc ?? undefined, applyUrl, source: j.job_publisher ? `${j.job_publisher} via JSearch` : "JSearch", lastCheckedAt: now.toISOString(),
  };
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export function dedupeKey(j: Job): string {
  try {
    const u = new URL(j.applyUrl);
    if (u.hostname && u.pathname.length > 1) return `${u.hostname}${u.pathname}`.toLowerCase();
  } catch { /* fall through */ }
  return `${norm(j.title)}|${norm(j.company)}|${norm(j.location)}`;
}
/** Remove duplicates by URL or title/company/location, keeping the richest copy. */
export function dedupeJobs(jobs: Job[]): Job[] {
  const byKey = new Map<string, Job>();
  const byTriple = new Map<string, string>();
  for (const j of jobs) {
    const triple = `${norm(j.title)}|${norm(j.company)}|${norm(j.location)}`;
    const key = byTriple.get(triple) ?? dedupeKey(j);
    const prev = byKey.get(key);
    if (!prev || j.description.length > prev.description.length) byKey.set(key, j);
    byTriple.set(triple, key);
  }
  return [...byKey.values()];
}
