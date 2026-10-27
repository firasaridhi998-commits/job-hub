"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ExternalLink, Loader2, Search } from "lucide-react";
import { useProfile } from "@/components/ProfileContext";
import { api, ApiError } from "@/lib/client";
import type { Job } from "@/lib/schema";
import type { MatchResult } from "@/lib/scoring/match";

interface Result { job: Job; match: MatchResult }
interface Resp { results: Result[]; provider: string; page: number; fetchedAt: string; cached: boolean }

const ago = (iso?: string) => {
  if (!iso) return null;
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return Number.isNaN(d) ? null : d <= 0 ? "today" : d === 1 ? "1 day ago" : `${d} days ago`;
};
const money = (j: Job) => {
  const s = j.salary;
  if (!s) return null;
  const f = (n?: number) => (n ? Math.round(n).toLocaleString() : "");
  return `${[f(s.min), f(s.max)].filter(Boolean).join(" - ")} ${s.currency ?? ""}${s.period ? ` / ${s.period}` : ""}`.trim();
};

export default function Jobs() {
  const { profile } = useProfile();
  const [query, setQuery] = useState(profile?.targetTitles[0] ?? "");
  const [location, setLocation] = useState(profile?.preferences.locations[0] ?? "");
  const [country, setCountry] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ code: string; message: string } | null>(null);
  const [data, setData] = useState<{ results: Result[]; provider: string; page: number; fetchedAt: string; cached: boolean } | null>(null);
  const [sort, setSort] = useState<"score" | "date">("score");
  const [minScore, setMinScore] = useState(0);
  const [open, setOpen] = useState<string | null>(null);

  async function run(page: number) {
    if (!profile) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api<Resp>("/api/jobs/search", { method: "POST", body: JSON.stringify({ profile, query, location: location || undefined, remoteOnly, country: country || undefined, page }) });
      setData((prev) => {
        const merged = page > 1 && prev ? [...prev.results, ...r.results.filter((n) => !prev.results.some((o) => o.job.id === n.job.id || o.job.applyUrl === n.job.applyUrl))] : r.results;
        return { ...r, results: merged };
      });
    } catch (e) {
      const a = e as ApiError;
      setErr({ code: a.code, message: a.message });
    } finally {
      setBusy(false);
    }
  }
  const shown = useMemo(() => {
    const list = (data?.results ?? []).filter((r) => r.match.score >= minScore);
    return [...list].sort((a, b) => sort === "score" ? b.match.score - a.match.score : new Date(b.job.postedAt ?? 0).getTime() - new Date(a.job.postedAt ?? 0).getTime());
  }, [data, sort, minScore]);

  if (!profile) {
    return (
      <div className="card mx-auto max-w-xl space-y-3 text-center">
        <h1 className="h2">Analyze a resume first</h1>
        <p className="text-sm text-muted">Job matches are ranked against your extracted profile, which lives only in this browser tab. Refreshing the page clears it.</p>
        <Link href="/analyze" className="btn-primary mx-auto">Analyze My Resume</Link>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Find Jobs</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">Real listings from a licensed job API, ranked by how well your resume matches each description. Scores compare text only. They are not a chance of being hired.</p>
      </div>
      <form className="card grid gap-3 md:grid-cols-[2fr_1.5fr_0.7fr_auto]" onSubmit={(e) => { e.preventDefault(); setData(null); run(1); }}>
        <div><label htmlFor="q" className="label">Job title or skill</label><input id="q" className="input" value={query} onChange={(e) => setQuery(e.target.value)} required minLength={2} /></div>
        <div><label htmlFor="loc" className="label">Location (optional)</label><input id="loc" className="input" value={location} onChange={(e) => setLocation(e.target.value)} /></div>
        <div><label htmlFor="cc" className="label">Country code</label><input id="cc" className="input" maxLength={2} placeholder="us" value={country} onChange={(e) => setCountry(e.target.value)} /></div>
        <div className="flex items-end"><button className="btn-primary w-full" disabled={busy}>{busy && !data ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}Search</button></div>
        <label className="flex items-center gap-2 text-sm md:col-span-4"><input type="checkbox" checked={remoteOnly} onChange={(e) => setRemoteOnly(e.target.checked)} />Remote jobs only (as reported by the source)</label>
      </form>

      {err && (
        <div role="alert" className="card border-bad space-y-2">
          <p className="font-medium">{err.code === "not_configured" ? "Job search is not set up yet" : "The search did not work"}</p>
          <p className="text-sm text-muted">{err.message}</p>
          {err.code === "not_configured" ? <Link href="/settings" className="btn-ghost">See setup status</Link> : <button className="btn-ghost" onClick={() => run(1)}>Retry</button>}
        </div>
      )}

      {data && (
        <>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="text-muted">{shown.length} listing(s) from {data.provider}. Checked {new Date(data.fetchedAt).toLocaleTimeString()}{data.cached ? " (saved copy under 10 minutes old)" : ""}. Listings may have closed since.</span>
            <label className="ml-auto flex items-center gap-2">Sort<select className="input w-auto" value={sort} onChange={(e) => setSort(e.target.value as "score" | "date")}><option value="score">Compatibility</option><option value="date">Most recent</option></select></label>
            <label className="flex items-center gap-2">Minimum match<select className="input w-auto" value={minScore} onChange={(e) => setMinScore(Number(e.target.value))}>{[0, 30, 50, 70].map((n) => <option key={n} value={n}>{n}%</option>)}</select></label>
          </div>
          {!shown.length && <div className="card text-center text-sm text-muted">No listings matched. Try a broader title, remove the location, or lower the minimum match.</div>}
          <ul className="space-y-3">
            {shown.map(({ job, match }) => {
              const exp = open === job.id;
              const pay = money(job);
              const when = ago(job.postedAt);
              return (
                <li key={job.id} className="card space-y-3">
                  <div className="flex flex-wrap items-start gap-4">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-lg font-semibold">{job.title}</h2>
                      <p className="text-sm text-muted">{job.company}{job.location ? ` - ${job.location}` : ""}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                        {job.remote !== "unknown" && <span className="chip">{job.remote}</span>}
                        {job.employmentType && <span className="chip">{job.employmentType}</span>}
                        {pay && <span className="chip">{pay}</span>}
                        {when && <span className="chip">Posted {when}</span>}
                        <span className="chip">Source: {job.source}</span>
                      </div>
                    </div>
                    <div className="text-center" aria-label={`Compatibility ${match.score} out of 100`}>
                      <p className={`text-3xl font-extrabold ${match.score >= 70 ? "text-good" : match.score >= 45 ? "text-accent" : "text-bad"}`}>{match.score}</p>
                      <p className="text-xs text-muted">compatibility</p>
                    </div>
                  </div>
                  <ul className="list-disc space-y-0.5 pl-5 text-sm">{match.explanation.slice(0, 4).map((x) => <li key={x}>{x}</li>)}</ul>
                  <div className="flex flex-wrap gap-1.5">
                    {match.matchedRequired.map((s) => <span key={s} className="chip-good">{s}</span>)}
                    {match.missingRequired.map((s) => <span key={s} className="chip-warn" title="Not found in your resume. This does not mean you lack the skill.">{s}: not in resume</span>)}
                  </div>
                  {match.eligibilityNotes.map((n) => <p key={n} className="text-xs text-warn">Check: {n}</p>)}
                  <div className="flex flex-wrap gap-2">
                    <a href={job.applyUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">View original vacancy<ExternalLink className="h-4 w-4" /></a>
                    <button className="btn-ghost" onClick={() => setOpen(exp ? null : job.id)} aria-expanded={exp}>{exp ? "Hide details" : "Details"}</button>
                  </div>
                  {exp && (
                    <div className="space-y-2 border-t border-line pt-3 text-sm">
                      {match.missingPreferred.length > 0 && <p><span className="font-medium">Preferred, not found in resume:</span> {match.missingPreferred.join(", ")}</p>}
                      {match.matchedPreferred.length > 0 && <p><span className="font-medium">Preferred, found:</span> {match.matchedPreferred.join(", ")}</p>}
                      {match.unknown.map((u) => <p key={u} className="text-muted">Unknown: {u}</p>)}
                      {job.requirements.length > 0 && <ul className="list-disc pl-5">{job.requirements.slice(0, 8).map((r) => <li key={r}>{r}</li>)}</ul>}
                      <p className="whitespace-pre-line text-muted">{job.description.slice(0, 1500)}{job.description.length > 1500 ? "..." : ""}</p>
                      <p className="text-xs text-muted">Last checked {new Date(job.lastCheckedAt).toLocaleString()}. Full text is at the original source.</p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="text-center">
            <button className="btn-ghost" disabled={busy} onClick={() => run(data.page + 1)}>{busy ? "Loading..." : "Load more results"}</button>
          </div>
        </>
      )}
      {!data && !err && !busy && <p className="text-sm text-muted">Enter a title or skill and search. Nothing is shown until a real provider returns results.</p>}
    </div>
  );
}
