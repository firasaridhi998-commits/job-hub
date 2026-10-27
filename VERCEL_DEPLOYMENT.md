# Deploying Job Hub to Vercel

Vercel cannot import a bare ZIP from its dashboard. Use one of the two routes below. Route A needs no Git knowledge.

## Before you start

1. Extract `job-hub.zip`. Open the `job-hub` folder; `package.json` should be directly inside it.
2. Create a free account at vercel.com.
3. Decide your access code (long and random, for example the output of `openssl rand -hex 16`).
4. Optional now, can be added later: a job-search key (JSearch via RapidAPI, or Adzuna) and an AI key (Gemini, Groq or OpenRouter).

## Route A: Vercel CLI (no Git)

1. Install Node.js 20.9 or newer from nodejs.org.
2. Open a terminal inside the extracted `job-hub` folder.
3. Run `npx vercel login` and follow the prompts.
4. Run `npx vercel` and answer the questions. Accept the detected framework (Next.js) and defaults. This creates a preview deployment.
5. Add environment variables (see below), for example `npx vercel env add APP_ACCESS_CODE production`, or use the dashboard: Project, Settings, Environment Variables.
6. Run `npx vercel --prod` to deploy to production with those variables.

## Route B: GitHub

1. Create a new empty private repository on github.com.
2. In the extracted folder run: `git init`, `git add .`, `git commit -m "Job Hub"`, then the `git remote add origin ...` and `git push -u origin main` commands GitHub shows you. `.gitignore` already excludes `node_modules`, `.next` and `.env*`.
3. In Vercel choose Add New, Project, import that repository. Framework: Next.js. Leave build and output settings at their defaults.
4. Add the environment variables before pressing Deploy.

## Environment variables

| Name | Required | Purpose |
| --- | --- | --- |
| `APP_ACCESS_CODE` | **Yes** | Shared code for the login page. The site returns 503 in production without it. |
| `SESSION_SECRET` | Recommended | Separate secret for signing session cookies. If unset the access code is used. |
| `JOB_SEARCH_PROVIDER` | For jobs | `jsearch` or `adzuna` |
| `JSEARCH_API_KEY` | If jsearch | RapidAPI key |
| `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `ADZUNA_COUNTRY` | If adzuna | Adzuna credentials and a supported two-letter country |
| `AI_PRIMARY_PROVIDER`, `AI_FALLBACK_PROVIDERS` | Optional | e.g. `gemini` and `groq,openrouter` |
| `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY` | Optional | Configure any subset |
| `GEMINI_MODEL`, `GROQ_MODEL`, `OPENROUTER_MODEL` | Optional | Override default model IDs when a provider retires one |

Never put keys in the code, in `NEXT_PUBLIC_` variables, or in Git. After changing variables you must redeploy.

## Smoke test after deploying

1. Open the URL. You should land on the login page. `/analyze` before signing in must redirect to `/login`.
2. A wrong code is refused; the right code lets you in.
3. Settings page: access code shows Configured; providers you set show Configured; others say Missing configuration.
4. Upload a text-based PDF and a DOCX under 4 MB. You should see a score, skills and an editable profile.
5. Upload a renamed `.txt` file as `.pdf`: you should get a clear "unsupported" error.
6. Find Jobs: with a key set you get listings with working "View original vacancy" links. Without it you get the setup message and no listings.
7. If AI keys are set, press Suggest improvements and read the output critically.

## Troubleshooting

- **Everything returns "Access gate is not configured"**: `APP_ACCESS_CODE` is missing for the Production environment. Add it and redeploy.
- **Login works but you bounce back to login**: your browser blocked the cookie; make sure you are on the https URL.
- **Build fails on Node version**: in Project Settings, General, set Node.js Version to 20.x or 22.x.
- **Upload says too large**: the limit is 4 MB; Vercel rejects bodies above about 4.5 MB before the app can respond.
- **"The AI provider rejected the API key"**: key typo or wrong provider. This is a configuration error and is not retried or hidden by fallback.
- **Rate limit messages**: you hit a free-tier quota. Wait, add a fallback provider, or reduce use.
- **Job API 403/429**: check the plan and quota in the provider dashboard.

Note: Vercel's free Hobby plan is intended for personal, non-commercial use. Check Vercel's current terms before charging anyone, and note that free serverless functions have time limits (this app asks for at most 30 s for parsing and job search, 60 s for AI).
