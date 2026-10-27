# Job Hub

Upload a resume (PDF or DOCX), get an explainable ATS-style readiness estimate, correct the extracted profile, then search real job listings ranked by how well they match. Built with Next.js 16 (App Router), TypeScript (strict), Tailwind CSS 3 and Zod 4. Designed for Vercel.

> Tagline: Your next opportunity starts here.

## What works without any API keys

- Server-enforced shared access code (needs `APP_ACCESS_CODE`)
- PDF and DOCX text extraction, profile parsing, editable profile
- Resume Readiness estimate (deterministic, weights in `lib/scoring/readiness.ts`)
- Keyword gap check against a pasted job description
- Job compatibility scoring engine (used as soon as a job API returns listings)

## What needs keys

| Feature | Variables | Notes |
| --- | --- | --- |
| Real job listings | `JOB_SEARCH_PROVIDER` plus `JSEARCH_API_KEY` **or** `ADZUNA_APP_ID` + `ADZUNA_APP_KEY` | Without these, the Find Jobs page shows a setup message. No sample listings are ever shown. |
| AI rewrite suggestions | at least one of `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY` | Optional. Fallback order from `AI_PRIMARY_PROVIDER` and `AI_FALLBACK_PROVIDERS`. |

See `.env.example` for every variable. Free tiers, model IDs and country coverage change; check each provider's current documentation and terms before relying on them. Hosting on Vercel does not make third-party API calls free.

## Run locally

Requires Node.js 20.9 or newer (22 recommended).

```bash
npm install
cp .env.example .env.local   # then edit; at minimum set APP_ACCESS_CODE
npm run dev                  # http://localhost:3000
```

In development, an unset `APP_ACCESS_CODE` leaves the site open for convenience. In production the site refuses all requests until it is set. Use `npm run dev` rather than `npm start` for local work; production mode sets Secure cookies, which need HTTPS (localhost is exempt in most browsers, other hostnames are not).

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint (Next.js core-web-vitals + TypeScript rules) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest, 67 tests |

## Project layout

```
app/                 pages and API routes (api/resume, api/jobs, api/ai, api/auth, api/status)
components/          Logo, Nav, form fields, in-memory profile context
lib/resume/          extraction (PDF, DOCX) and heuristic parser
lib/scoring/         readiness.ts (weights in one place) and match.ts
lib/jobs/            provider adapters (JSearch, Adzuna), normalisation, dedupe, cache
lib/ai/              provider interface, Gemini/Groq/OpenRouter adapters, router with fallback
proxy.ts             server-side access gate (Next.js 16 name for middleware)
tests/               fixtures and tests
```

## How scoring works

**Readiness (0-100)** averages five components: structure and readability, skills, experience clarity, achievement specificity, completeness (20% each). If you paste a target job description and it contains recognised skills, keyword alignment is added at weight 25 and all weights are re-normalised. It is labelled "ATS-Style Readiness Estimate" because it is calculated by Job Hub and is not any employer system's score.

**Compatibility (0-100)** weighs skills (50), title similarity (20), experience years (15) and location preference (15). A component the listing gives no data for is dropped, not scored as zero, and shows up under "Unknown". A skill missing from the resume is reported as "not found in resume", never as proof you lack it. Eligibility text such as "no visa sponsorship" is shown as a note to check; Job Hub never infers your eligibility. The score is not a hiring probability.

The two scores are never combined.

## Privacy and security summary

- Resumes are read in server memory and not written to disk or a database. The API returns the parsed profile, not the raw text. The browser keeps the profile in memory only (no localStorage); refreshing or pressing Discard clears it.
- Logs contain provider names, models and error kinds only. A test checks that resume content does not reach the console.
- API keys are read only on the server and never returned. `/api/status` reports booleans.
- The access code gate runs in `proxy.ts` for every page and API route except login/logout. Sessions are HMAC-signed, HttpOnly, SameSite=Lax and Secure in production, valid 7 days. Login attempts are limited to 5 per 15 minutes per IP (per server instance).
- Limits: 4 MB upload (request cap 4,194,304 bytes, below Vercel's roughly 4.5 MB body limit), 60,000 extracted characters, 6,000 characters sent to AI, 1,200 output tokens, 20 s AI timeout, 10 s job timeout, per-IP rate limits.
- AI suggestions send summary, skills and bullet text only. Name, email and phone are not sent. With several providers configured, a request can reach more than one of them, each under its own retention terms. Job searches send the title, location and filters you type.
- A shared passcode is simple, not individual accounts: anyone with the code has full access and there is no per-person audit trail. Add real accounts (for example an auth provider) before opening the site to the public. The in-memory rate limiter is per server instance, so it slows guessing but is not a hard guarantee; use a long random code.

## Known limitations

See `IMPLEMENTATION_REPORT.md`.
