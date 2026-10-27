import { errorJson, limited, ok, readJson } from "@/lib/http";
import { JobSearchRequestSchema } from "@/lib/schema";
import { scoreJob } from "@/lib/scoring/match";
import { JobError, searchJobs } from "@/lib/jobs/search";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const lim = limited(req, "jobs");
  if (lim) return lim;
  const parsed = JobSearchRequestSchema.safeParse(await readJson(req));
  if (!parsed.success) return errorJson(400, "invalid_input", "Check the search fields: a job title or keyword is required.");
  const { profile, ...params } = parsed.data;
  try {
    const result = await searchJobs(params);
    const jobs = result.jobs.map((job) => ({ job, match: scoreJob(profile, job) })).sort((a, b) => b.match.score - a.match.score);
    return ok({ results: jobs, provider: result.provider, page: result.page, fetchedAt: result.fetchedAt, cached: result.cached });
  } catch (e) {
    if (e instanceof JobError) {
      const status = e.kind === "not_configured" ? 503 : e.kind === "rate_limited" ? 429 : e.kind === "unsupported_country" ? 400 : 502;
      return errorJson(status, e.kind, e.message);
    }
    return errorJson(500, "server_error", "Job search failed unexpectedly. Try again.");
  }
}
