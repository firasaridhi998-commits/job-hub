import { AIError, type AIProvider, type CompleteArgs } from "./types";

type Env = Record<string, string | undefined>;

function classify(status: number, body: string, provider: string): AIError {
  if (status === 401 || status === 403) return new AIError("auth", "The AI provider rejected the API key.", provider);
  if (status === 429) return new AIError("rate_limit", "The AI provider rate limit was reached.", provider);
  if (status === 408 || status === 504) return new AIError("timeout", "The AI provider timed out.", provider);
  if (status === 404) return new AIError("model_unavailable", "The configured AI model is unavailable.", provider);
  if (status >= 500) return new AIError("server", "The AI provider had a temporary error.", provider);
  if (/api key|permission|credential/i.test(body)) return new AIError("auth", "The AI provider rejected the API key.", provider);
  return new AIError("bad_request", "The AI provider rejected the request.", provider);
}

async function post(provider: string, url: string, headers: Record<string, string>, body: unknown, a: CompleteArgs, fetchImpl: typeof fetch): Promise<unknown> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), a.timeoutMs);
  try {
    const res = await fetchImpl(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body), signal: ctl.signal });
    if (!res.ok) throw classify(res.status, (await res.text().catch(() => "")).slice(0, 300), provider);
    return await res.json();
  } catch (e) {
    if (e instanceof AIError) throw e;
    if (e instanceof Error && e.name === "AbortError") throw new AIError("timeout", "The AI provider timed out.", provider);
    throw new AIError("network", "Could not reach the AI provider.", provider);
  } finally {
    clearTimeout(timer);
  }
}

function openAICompatible(id: string, url: string, key: string | undefined, model: string, jsonMode: boolean): AIProvider {
  return {
    id, model,
    isConfigured: () => !!key,
    async complete(a, fetchImpl) {
      const body: Record<string, unknown> = { model, max_tokens: a.maxTokens, temperature: 0.2, messages: [{ role: "system", content: a.system }, { role: "user", content: a.user }] };
      if (jsonMode) body.response_format = { type: "json_object" };
      const data = (await post(id, url, { Authorization: `Bearer ${key}` }, body, a, fetchImpl)) as { choices?: { message?: { content?: string } }[] };
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new AIError("invalid_output", "The AI provider returned an empty response.", id);
      return text;
    },
  };
}

export function buildProviders(env: Env = process.env): AIProvider[] {
  const gemini: AIProvider = {
    id: "gemini",
    model: env.GEMINI_MODEL || "gemini-2.0-flash",
    isConfigured: () => !!env.GEMINI_API_KEY,
    async complete(a, fetchImpl) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`;
      const body = {
        systemInstruction: { parts: [{ text: a.system }] },
        contents: [{ role: "user", parts: [{ text: a.user }] }],
        generationConfig: { maxOutputTokens: a.maxTokens, temperature: 0.2, responseMimeType: "application/json" },
      };
      const data = (await post("gemini", url, { "x-goog-api-key": env.GEMINI_API_KEY ?? "" }, body, a, fetchImpl)) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
      if (!text) throw new AIError("invalid_output", "The AI provider returned an empty response.", "gemini");
      return text;
    },
  };
  const groq = openAICompatible("groq", "https://api.groq.com/openai/v1/chat/completions", env.GROQ_API_KEY, env.GROQ_MODEL || "llama-3.3-70b-versatile", true);
  const openrouter = openAICompatible("openrouter", "https://openrouter.ai/api/v1/chat/completions", env.OPENROUTER_API_KEY, env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free", false);
  return [gemini, groq, openrouter];
}

/** Primary first, then listed fallbacks, then any other configured provider. Unconfigured providers are dropped. */
export function orderProviders(all: AIProvider[], env: Env = process.env): AIProvider[] {
  const byId = new Map(all.map((p) => [p.id, p]));
  const wanted = [env.AI_PRIMARY_PROVIDER, ...(env.AI_FALLBACK_PROVIDERS ?? "").split(",")].map((s) => s?.trim().toLowerCase()).filter((s): s is string => !!s);
  const ordered = [...new Set([...wanted, ...all.map((p) => p.id)])].map((id) => byId.get(id)).filter((p): p is AIProvider => !!p && p.isConfigured());
  return ordered;
}
