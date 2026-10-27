export type AIErrorKind = "auth" | "rate_limit" | "timeout" | "server" | "network" | "model_unavailable" | "bad_request" | "invalid_output" | "not_configured" | "all_failed";
export class AIError extends Error {
  constructor(public kind: AIErrorKind, message: string, public provider?: string) {
    super(message);
  }
}
/** Only these justify retrying or falling back to another provider. */
export const TRANSIENT = new Set<AIErrorKind>(["rate_limit", "timeout", "server", "network", "model_unavailable"]);

export interface CompleteArgs { system: string; user: string; maxTokens: number; timeoutMs: number }
export interface AIProvider {
  id: string;
  model: string;
  isConfigured(): boolean;
  complete(args: CompleteArgs, fetchImpl: typeof fetch): Promise<string>;
}
