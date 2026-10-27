import { buildProviders, orderProviders } from "@/lib/ai/providers";
import { getUsage } from "@/lib/ai/router";
import { ok } from "@/lib/http";
import { jobProviderStatus } from "@/lib/jobs/search";
import { LIMITS } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Only booleans and names. Never returns key values. */
export async function GET() {
  const all = buildProviders();
  const order = orderProviders(all).map((p) => p.id);
  const jobs = jobProviderStatus();
  return ok({
    access: { configured: !!process.env.APP_ACCESS_CODE },
    ai: { providers: all.map((p) => ({ id: p.id, model: p.model, configured: p.isConfigured() })), order, usageThisInstance: getUsage() },
    jobs: { provider: jobs.provider, configured: jobs.configured, missing: jobs.missing },
    limits: { maxFileMB: LIMITS.MAX_FILE_BYTES / 1_000_000 },
  });
}
