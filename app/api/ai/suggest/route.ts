import { z } from "zod";
import { AIError } from "@/lib/ai/types";
import { runStructured } from "@/lib/ai/router";
import { SuggestionSchema, buildSuggestPrompt } from "@/lib/ai/suggest";
import { LIMITS } from "@/lib/config";
import { errorJson, limited, ok, readJson } from "@/lib/http";
import { ProfileSchema } from "@/lib/schema";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({ profile: ProfileSchema, targetRole: z.string().max(150).optional() });

export async function POST(req: Request) {
  const lim = limited(req, "ai", LIMITS.RATE_AI);
  if (lim) return lim;
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return errorJson(400, "invalid_input", "The profile is invalid or too large.");
  try {
    const { data, provider, model } = await runStructured(SuggestionSchema, buildSuggestPrompt(parsed.data.profile, parsed.data.targetRole));
    console.info(`[ai] suggest ok provider=${provider} model=${model}`); // no resume content in logs
    return ok({ suggestions: data, provider, model });
  } catch (e) {
    if (e instanceof AIError) {
      console.warn(`[ai] suggest failed kind=${e.kind} provider=${e.provider ?? "n/a"}`);
      const status = e.kind === "not_configured" ? 503 : e.kind === "auth" || e.kind === "bad_request" ? 502 : e.kind === "rate_limit" ? 429 : 502;
      return errorJson(status, e.kind, e.kind === "auth" ? "An AI provider rejected its API key. Check the server configuration." : e.message);
    }
    return errorJson(500, "server_error", "AI suggestions failed unexpectedly. Try again.");
  }
}
