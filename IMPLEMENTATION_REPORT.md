# Implementation report

Date of build: 2026-10-27. Built and checked inside a sandboxed Linux container with npm registry access only.

## Implemented

- Landing page, login, Resume Analyzer, Find Jobs, Settings/status. Original logo (J mark with a hub dot, two-weight wordmark) and SVG favicon. Black/white/yellow tokens from the brief.
- Server-enforced shared-code gate (`proxy.ts`), signed HttpOnly session cookie, login brute-force limiter, fail-closed in production when unconfigured.
- Upload: drag and drop, picker, 4 MB limit (client and server, plus whole-request cap), real file-type sniffing from bytes (not just extension), cancel, remove/replace, clear errors for unsupported, oversized, corrupt, and image-only files (no OCR; says so).
- Parser: contact details, headline, summary, skills (taxonomy of about 80 skills with aliases), experience with dates and bullets, education, certifications, languages, estimated years of experience, formatting warnings. Fully editable profile including preferences. Sponsorship need is a checkbox the user sets; nothing about eligibility is inferred.
- Readiness estimate with documented weights, per-component explanation and evidence, missing keywords versus a pasted job description, prioritized actions, parsing-confidence indicator.
- Job layer: JSearch and Adzuna adapters, Zod validation of provider responses, normalisation, dedupe, 10-minute cache, timeouts, error classification. Listings without a valid http(s) apply URL are dropped. Original link, source, posted date, salary (only when supplied) and last-checked time are shown.
- Compatibility engine: required versus preferred skills, title similarity, years of experience, location/work-mode preference, "unknown" handling, eligibility notes, explanation lines. Filters: minimum score, sort by compatibility or recency, remote-only, location, country code.
- AI layer: Gemini, Groq and OpenRouter adapters behind one interface; ordered fallback; bounded retries with exponential backoff; fallback only on rate limit, timeout, 5xx, network, unavailable model; no retry on auth or bad request; Zod validation of every response; move to next provider on malformed output; in-memory usage counters without content; minimal prompt without name or contact details. Used for optional rewrite suggestions only. All scoring is deterministic and does not use AI.

## Checks actually run (final code, Next.js 16.4.3, Zod 4)

| Check | Result |
| --- | --- |
| `npm run lint` | passed, no warnings |
| `npm run typecheck` | passed |
| `npm test` | 67 tests in 5 files passed |
| `npm run build` | passed |
| `npm audit` | 0 vulnerabilities (Next.js 14 was upgraded to 16 because 14.x carried known advisories) |
| Fresh-copy check: ZIP extracted to a clean folder, then `npm ci`, lint, typecheck, tests, build | all passed (0 vulnerabilities, 67 tests) |
| Production server smoke test (`next start`, curl) | gate redirects/401s without cookie; login sets HttpOnly cookie; DOCX and generated PDF parse end to end; bad file rejected; job search returns 503 setup error with no listings; AI returns 503 setup error; all 5 pages return 200 when signed in; server log contained none of the test resume's strings |

Tests cover: PDF and DOCX parsing, wrong extension, oversize, image-only/empty PDF, corrupt DOCX, profile parsing, skill normalisation, readiness scoring and determinism, missing keywords, empty profile, compatibility scoring and ranking, unknown requirements, eligibility notes, normalisation, dedupe, missing job credentials, rate limit/auth/malformed/timeout from the job provider (mocked), AI fallback on rate limit/timeout/server/network, no fallback on auth, malformed AI output, schema validation, provider ordering and HTTP shape (mocked), session signing/tampering/expiry, access gate, login limiter, upload route validation, status route leaking no keys, and console privacy.

## NOT verified (be aware)

- **No live external calls.** JSearch, Adzuna, Gemini, Groq and OpenRouter were never contacted (no keys, and the sandbox network allowlist excludes them). Their request URLs, headers and response shapes follow my knowledge of their documentation and are exercised only against mocked responses. Default model IDs are unverified and may be retired. Confirm current docs, quotas, country coverage (Adzuna's list is hard-coded and may be outdated, and may not cover your market) and licensing terms before use.
- **No browser testing.** The UI was type-checked, linted, built and fetched over HTTP, but never opened in a browser or on a phone, and there are no automated UI or accessibility tests. Expect small visual or layout issues to fix.
- **Not deployed.** Nothing was pushed to Vercel.
- **Parser quality on real resumes.** Tests use a synthetic resume and generated PDF/DOCX. Multi-column, table-heavy or designer templates can extract in a scrambled order. The parser is heuristic, tuned for English and some French headings; non-English resumes will have thin skill and section detection (the skill taxonomy is English).

## Known limitations

- No OCR for scanned PDFs.
- Rate limiting and the job cache are per serverless instance (in memory), so limits are approximate.
- Shared passcode only; no per-user accounts, no audit trail.
- Salary expectations are stored but not used in scoring; education requirements, language requirements and relocation are not scored (relocation only widens remote matches). Seniority is covered only through the years-of-experience figure.
- Job descriptions from APIs are often truncated; skills beyond the truncated text will show as missing.
- Remote status is detected from provider flags or keywords and may be wrong or unknown.
- A job source may keep a listing after it has closed; Job Hub shows when it was last checked but cannot confirm it is still open.
- Third-party AI and job providers apply their own retention policies, which this app cannot control.
- Free-tier terms and quotas change; nothing here guarantees free operation.
