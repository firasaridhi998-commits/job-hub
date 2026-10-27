/** Central limits. Change here, not in individual routes. */
export const LIMITS = {
  /** Largest resume file accepted (4 MB, decimal). */
  MAX_FILE_BYTES: 4_000_000,
  /** Whole upload request cap; stays under Vercel's ~4.5 MB serverless body limit. */
  MAX_REQUEST_BYTES: 4_194_304,
  MAX_TEXT_CHARS: 60_000,
  MAX_JD_CHARS: 12_000,
  MAX_AI_INPUT_CHARS: 6_000,
  AI_MAX_OUTPUT_TOKENS: 1_200,
  AI_TIMEOUT_MS: 20_000,
  AI_MAX_RETRIES: 1,
  AI_MAX_PROVIDERS_TRIED: 3,
  JOB_TIMEOUT_MS: 25_000,
  JOB_PAGE_SIZE: 20,
  JOB_CACHE_TTL_MS: 10 * 60_000,
  RATE_GENERAL: { max: 40, windowMs: 60_000 },
  RATE_AI: { max: 6, windowMs: 60_000 },
  RATE_LOGIN: { max: 5, windowMs: 15 * 60_000 },
} as const;
