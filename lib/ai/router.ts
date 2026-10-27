import type { ZodType } from "zod";
import { LIMITS } from "@/lib/config";
import { buildProviders, orderProviders } from "./providers";
import { AIError, TRANSIENT, type AIProvider } from "./types";

/** Usage counters only. Never stores prompts, resumes or model output. */
const usage = new Map<string, { ok: number; failed: number }>();
export const getUsage = () => Object.fromEntries(usage);
export const resetUsage = () => usage.clear();
const bump = (id: string, k: "ok" | "failed") => {
  const u = usage.get(id) ?? { ok: 0, failed: 0 };
  u[k] += 1;
  usage.set(id, u);
};

export function parseJsonLoose(text: string): unknown {
  const t = text.replace(/```(?:json)?/gi, "").trim();
  const s = t.indexOf("{");
  const e = t.lastIndexOf("}");
  if (s < 0 || e <= s) throw new AIError("invalid_output", "The AI response was not valid JSON.");
  try {
    return JSON.parse(t.slice(s, e + 1));
  } catch {
    throw new AIError("invalid_output", "The AI response was not valid JSON.");
  }
}

export interface RunOptions {
  providers?: AIProvider[];
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  maxRetries?: number;
  maxProviders?: number;
}

export async function runStructured<T>(schema: ZodType<T>, prompt: { system: string; user: string }, opts: RunOptions = {}): Promise<{ data: T; provider: string; model: string }> {
  const env = opts.env ?? process.env;
  const list = (opts.providers ?? orderProviders(buildProviders(env), env)).slice(0, opts.maxProviders ?? LIMITS.AI_MAX_PROVIDERS_TRIED);
  if (!list.length) throw new AIError("not_configured", "No AI provider is configured. Add GEMINI_API_KEY, GROQ_API_KEY or OPENROUTER_API_KEY.");
  const fetchImpl = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const maxRetries = opts.maxRetries ?? LIMITS.AI_MAX_RETRIES;
  let last: AIError | null = null;

  for (const p of list) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const text = await p.complete({ ...prompt, maxTokens: LIMITS.AI_MAX_OUTPUT_TOKENS, timeoutMs: LIMITS.AI_TIMEOUT_MS }, fetchImpl);
        const parsed = schema.safeParse(parseJsonLoose(text));
        if (!parsed.success) throw new AIError("invalid_output", "The AI response did not match the expected format.", p.id);
        bump(p.id, "ok");
        return { data: parsed.data, provider: p.id, model: p.model };
      } catch (e) {
        const err = e instanceof AIError ? e : new AIError("server", "Unexpected AI error.", p.id);
        bump(p.id, "failed");
        last = err;
        if (err.kind === "invalid_output") break; // try the next provider, no same-provider retry
        if (!TRANSIENT.has(err.kind)) throw err; // auth / bad request: surface, do not hammer or hide
        if (attempt < maxRetries) await sleep(500 * 2 ** attempt);
        else break;
      }
    }
  }
  throw new AIError("all_failed", `All configured AI providers failed (last problem: ${last?.kind ?? "unknown"}). Try again shortly.`, last?.provider);
}
