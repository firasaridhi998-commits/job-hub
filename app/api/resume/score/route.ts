import { errorJson, limited, ok, readJson } from "@/lib/http";
import { ScoreRequestSchema } from "@/lib/schema";
import { scoreReadiness } from "@/lib/scoring/readiness";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const lim = limited(req, "score");
  if (lim) return lim;
  const parsed = ScoreRequestSchema.safeParse(await readJson(req));
  if (!parsed.success) return errorJson(400, "invalid_input", "The profile or target description is invalid or too large.");
  return ok({ readiness: scoreReadiness(parsed.data.profile, parsed.data.targetDescription) });
}
