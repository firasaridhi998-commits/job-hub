import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { buildProviders, orderProviders } from "@/lib/ai/providers";
import { getUsage, parseJsonLoose, resetUsage, runStructured } from "@/lib/ai/router";
import { buildSuggestPrompt, SuggestionSchema } from "@/lib/ai/suggest";
import { AIError, type AIProvider } from "@/lib/ai/types";
import { parseResume } from "@/lib/resume/parse";
import { SAMPLE_RESUME } from "./helpers";

const Schema = z.object({ ok: z.boolean() });
const fake = (id: string, impl: () => Promise<string>): AIProvider => ({ id, model: `${id}-m`, isConfigured: () => true, complete: vi.fn(impl) });
const noSleep = async () => {};

describe("AI router", () => {
  it("returns validated output from the primary provider", async () => {
    resetUsage();
    const r = await runStructured(Schema, { system: "s", user: "u" }, { providers: [fake("a", async () => '```json\n{"ok":true}\n```')], sleep: noSleep });
    expect(r).toEqual({ data: { ok: true }, provider: "a", model: "a-m" });
    expect(getUsage().a.ok).toBe(1);
  });
  it("falls back on rate limit after bounded retries", async () => {
    const a = fake("a", async () => { throw new AIError("rate_limit", "429", "a"); });
    const b = fake("b", async () => '{"ok":true}');
    const r = await runStructured(Schema, { system: "s", user: "u" }, { providers: [a, b], sleep: noSleep, maxRetries: 1 });
    expect(r.provider).toBe("b");
    expect(a.complete).toHaveBeenCalledTimes(2); // 1 try + 1 retry, then fallback
  });
  it("falls back on timeout and temporary server errors", async () => {
    for (const kind of ["timeout", "server", "network", "model_unavailable"] as const) {
      const r = await runStructured(Schema, { system: "s", user: "u" }, { providers: [fake("a", async () => { throw new AIError(kind, "x"); }), fake("b", async () => '{"ok":true}')], sleep: noSleep, maxRetries: 0 });
      expect(r.provider).toBe("b");
    }
  });
  it("does NOT retry or fall back on auth or bad-request errors", async () => {
    const a = fake("a", async () => { throw new AIError("auth", "bad key", "a"); });
    const b = fake("b", async () => '{"ok":true}');
    await expect(runStructured(Schema, { system: "s", user: "u" }, { providers: [a, b], sleep: noSleep })).rejects.toMatchObject({ kind: "auth" });
    expect(a.complete).toHaveBeenCalledTimes(1);
    expect(b.complete).not.toHaveBeenCalled();
  });
  it("moves to the next provider on malformed or schema-invalid output", async () => {
    const r = await runStructured(Schema, { system: "s", user: "u" }, { providers: [fake("a", async () => "not json at all"), fake("b", async () => '{"ok":"yes"}'), fake("c", async () => '{"ok":false}')], sleep: noSleep });
    expect(r.provider).toBe("c");
  });
  it("reports all_failed when every provider fails transiently", async () => {
    const p = fake("a", async () => { throw new AIError("timeout", "t"); });
    await expect(runStructured(Schema, { system: "s", user: "u" }, { providers: [p], sleep: noSleep, maxRetries: 2 })).rejects.toMatchObject({ kind: "all_failed" });
    expect(p.complete).toHaveBeenCalledTimes(3);
  });
  it("reports not_configured when there are no providers", async () => {
    await expect(runStructured(Schema, { system: "s", user: "u" }, { env: {} })).rejects.toMatchObject({ kind: "not_configured" });
  });
  it("parseJsonLoose rejects garbage", () => expect(() => parseJsonLoose("hello")).toThrow(AIError));
});

describe("provider config", () => {
  it("only uses configured providers, honouring primary and fallback order", () => {
    const env = { AI_PRIMARY_PROVIDER: "groq", AI_FALLBACK_PROVIDERS: "openrouter,gemini", GROQ_API_KEY: "g", GEMINI_API_KEY: "m" };
    expect(orderProviders(buildProviders(env), env).map((p) => p.id)).toEqual(["groq", "gemini"]);
    expect(orderProviders(buildProviders({}), {})).toEqual([]);
  });
  it("sends the expected HTTP request and classifies HTTP errors (mocked fetch)", async () => {
    const env = { GROQ_API_KEY: "secret" };
    const [, groq] = buildProviders(env);
    const f = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }), { status: 200 })) as unknown as typeof fetch;
    expect(await groq.complete({ system: "s", user: "u", maxTokens: 10, timeoutMs: 1000 }, f)).toBe('{"ok":true}');
    const init = (f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];
    expect(init[0]).toContain("groq.com");
    expect((init[1].headers as Record<string, string>).Authorization).toBe("Bearer secret");
    const f429 = vi.fn(async () => new Response("{}", { status: 429 })) as unknown as typeof fetch;
    await expect(groq.complete({ system: "s", user: "u", maxTokens: 10, timeoutMs: 1000 }, f429)).rejects.toMatchObject({ kind: "rate_limit" });
    const f401 = vi.fn(async () => new Response("{}", { status: 401 })) as unknown as typeof fetch;
    await expect(groq.complete({ system: "s", user: "u", maxTokens: 10, timeoutMs: 1000 }, f401)).rejects.toMatchObject({ kind: "auth" });
  });
});

describe("AI privacy and output schema", () => {
  it("never sends name, email or phone to the model", () => {
    const { user, system } = buildSuggestPrompt(parseResume(SAMPLE_RESUME));
    expect(user + system).not.toMatch(/amine|example\.com|216/i);
    expect(user).toContain("Node.js");
  });
  it("suggestion schema rejects malformed output and defaults missing arrays", () => {
    expect(SuggestionSchema.safeParse({ bulletRewrites: "no" }).success).toBe(false);
    expect(SuggestionSchema.parse({}).bulletRewrites).toEqual([]);
  });
});
