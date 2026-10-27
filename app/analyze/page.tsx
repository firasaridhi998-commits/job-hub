"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { AlertTriangle, FileText, Loader2, Sparkles, Trash2, Upload, X } from "lucide-react";
import { LinesInput, ListInput, ScoreRing, Text } from "@/components/Fields";
import { useProfile } from "@/components/ProfileContext";
import { api } from "@/lib/client";
import type { Profile } from "@/lib/schema";
import type { ReadinessResult } from "@/lib/scoring/readiness";
import type { Suggestions } from "@/lib/ai/suggest";

const MAX_BYTES = 4_000_000;

export default function Analyze() {
  const { profile, readiness, version, setProfile, setReadiness, load, discard } = useProfile();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);
  const ctl = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState("");
  const [rescoring, setRescoring] = useState(false);
  const [ai, setAi] = useState<{ busy: boolean; error: string; data: Suggestions | null; provider?: string }>({ busy: false, error: "", data: null });

  function pick(f: File | undefined) {
    setError("");
    if (!f) return;
    const name = f.name.toLowerCase();
    if (!name.endsWith(".pdf") && !name.endsWith(".docx")) return setError("Unsupported file type. Choose a PDF or DOCX file.");
    if (f.size > MAX_BYTES) return setError("This file is larger than 4 MB. Export a smaller PDF or DOCX.");
    if (f.size === 0) return setError("This file is empty.");
    setFile(f);
  }
  async function analyze() {
    if (!file) return;
    setBusy(true);
    setError("");
    ctl.current = new AbortController();
    try {
      const fd = new FormData();
      fd.set("file", file);
      const r = await api<{ profile: Profile; readiness: ReadinessResult }>("/api/resume/parse", { method: "POST", body: fd, signal: ctl.current.signal });
      load(r.profile, r.readiness);
      setAi({ busy: false, error: "", data: null });
    } catch (e) {
      const err = e as { code?: string; message?: string };
      if (err.code !== "aborted") setError(err.message ?? "Analysis failed.");
    } finally {
      setBusy(false);
    }
  }
  const update = (patch: Partial<Profile>) => profile && setProfile({ ...profile, ...patch });
  async function rescore() {
    if (!profile) return;
    setRescoring(true);
    setError("");
    try {
      const r = await api<{ readiness: ReadinessResult }>("/api/resume/score", { method: "POST", body: JSON.stringify({ profile, targetDescription: target || undefined }) });
      setReadiness(r.readiness);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRescoring(false);
    }
  }
  async function suggest() {
    if (!profile) return;
    setAi({ busy: true, error: "", data: null });
    try {
      const r = await api<{ suggestions: Suggestions; provider: string }>("/api/ai/suggest", { method: "POST", body: JSON.stringify({ profile, targetRole: profile.targetTitles[0] }) });
      setAi({ busy: false, error: "", data: r.suggestions, provider: r.provider });
    } catch (e) {
      setAi({ busy: false, error: (e as Error).message, data: null });
    }
  }
  function reset() {
    discard();
    setFile(null);
    setTarget("");
    setAi({ busy: false, error: "", data: null });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Resume Analyzer</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">Upload a PDF or DOCX up to 4 MB. Job Hub extracts your name and contact details, headline, skills, work history, education, certifications and languages. The file is read in memory and not stored. Your profile stays in this browser tab until you refresh or discard it.</p>
      </div>

      {!profile && (
        <section className="card space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }}
            className={`flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-10 text-center ${drag ? "border-accent bg-raised" : "border-line"}`}
          >
            <Upload className="h-8 w-8 text-accent" aria-hidden="true" />
            <p className="font-medium">Drag your resume here</p>
            <p className="text-sm text-muted">PDF or DOCX, up to 4 MB. Scanned image-only files are not supported.</p>
            <input ref={inputRef} id="resume-file" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
            <label htmlFor="resume-file" className="btn-ghost cursor-pointer">{file ? "Replace file" : "Choose file"}</label>
          </div>
          {file && (
            <div className="flex items-center gap-3 rounded-md border border-line bg-raised p-3">
              <FileText className="h-5 w-5 text-accent" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted">{(file.size / 1_000_000).toFixed(2)} MB. {busy ? "Reading your resume..." : "Ready to analyze."}</p>
              </div>
              <button className="text-muted hover:text-fg" onClick={() => { setFile(null); if (inputRef.current) inputRef.current.value = ""; }} aria-label="Remove file" disabled={busy}><X className="h-5 w-5" /></button>
            </div>
          )}
          <p className="rounded-md bg-raised p-3 text-xs text-muted">Privacy: the file is processed in server memory and discarded. It is not saved or used for training. Analysis itself uses no AI. If you later request AI suggestions, trimmed resume text without your name, email or phone goes to the configured AI provider.</p>
          {error && <p role="alert" className="flex gap-2 text-sm text-bad"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</p>}
          <div className="flex gap-3">
            <button className="btn-primary" disabled={!file || busy} onClick={analyze}>{busy ? <><Loader2 className="h-4 w-4 animate-spin" />Analyzing...</> : "Analyze My Resume"}</button>
            {busy && <button className="btn-ghost" onClick={() => ctl.current?.abort()}>Cancel</button>}
          </div>
        </section>
      )}

      {profile && readiness && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/jobs" className="btn-primary">Find matching jobs</Link>
            <button className="btn-ghost" onClick={reset}><Trash2 className="h-4 w-4" />Discard analysis</button>
          </div>
          {error && <p role="alert" className="text-sm text-bad">{error}</p>}

          <section className="grid gap-4 lg:grid-cols-[auto_1fr]">
            <div className="card flex flex-col items-center gap-3">
              <ScoreRing score={readiness.overall} label="ATS-style readiness estimate" />
              <p className="text-center text-sm font-semibold">ATS-Style Readiness Estimate</p>
              <p className="max-w-[16rem] text-center text-xs text-muted">Calculated by Job Hub from the rules below. It is not the score any employer ATS would give you and does not predict hiring results. Parsing confidence: {readiness.confidence}.</p>
            </div>
            <div className="card space-y-4">
              <h2 className="h2">Score breakdown</h2>
              {readiness.components.map((c) => (
                <div key={c.key}>
                  <div className="flex items-baseline justify-between text-sm"><span className="font-medium">{c.label}</span><span className="text-muted">{c.score}/100 (weight {c.weight}%)</span></div>
                  <div className="mt-1 h-2 rounded bg-ink"><div className="h-2 rounded bg-accent" style={{ width: `${c.score}%` }} /></div>
                  <p className="mt-1 text-xs text-muted">{c.explanation}</p>
                </div>
              ))}
              {readiness.notes.map((n) => <p key={n} className="text-xs text-warn">{n}</p>)}
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="card">
              <h2 className="h2">Strengths</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {readiness.components.filter((c) => c.score >= 70).map((c) => <li key={c.key}>{c.label}: {c.explanation}</li>)}
                {!readiness.components.some((c) => c.score >= 70) && <li className="text-muted">No component reached 70 yet. See the priorities for where to start.</li>}
              </ul>
            </div>
            <div className="card">
              <h2 className="h2">Improvement priorities</h2>
              <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">
                {readiness.priorities.map((p) => <li key={p.title}><span className="font-medium">{p.title}.</span> {p.detail}</li>)}
                {!readiness.priorities.length && <li className="text-muted">Nothing urgent was detected.</li>}
              </ol>
            </div>
            <div className="card">
              <h2 className="h2">Formatting and readability</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {profile.meta.warnings.map((w) => <li key={w}>{w}</li>)}
                {!profile.meta.warnings.length && <li className="text-muted">No formatting problems were detected.</li>}
              </ul>
              <p className="mt-2 text-xs text-muted">{profile.meta.wordCount} words. Sections found: {profile.meta.sections.join(", ") || "none"}.</p>
            </div>
            <div className="card">
              <h2 className="h2">Extracted skills</h2>
              <div className="mt-2 flex flex-wrap gap-1.5">{profile.skills.map((s) => <span key={s} className="chip">{s}</span>)}{!profile.skills.length && <span className="text-sm text-muted">None found.</span>}</div>
            </div>
          </section>

          <section className="card space-y-3">
            <h2 className="h2">Check against a target job</h2>
            <p className="text-sm text-muted">Paste a job description to add keyword alignment to the estimate. Terms not found are shown as missing from your resume, not as skills you lack.</p>
            <label htmlFor="target" className="label">Target job description (optional)</label>
            <textarea id="target" rows={5} maxLength={12000} className="input" value={target} onChange={(e) => setTarget(e.target.value)} />
            <button className="btn-ghost" onClick={rescore} disabled={rescoring}>{rescoring ? "Scoring..." : "Re-run analysis"}</button>
            {readiness.targetEvaluated && (
              <div className="text-sm">
                <p className="font-medium">Not found in your resume:</p>
                <div className="mt-1 flex flex-wrap gap-1.5">{readiness.missingKeywords.map((k) => <span key={k} className="chip-warn">{k}</span>)}{!readiness.missingKeywords.length && <span className="text-good">All recognised terms are present.</span>}</div>
                <p className="mt-1 text-xs text-muted">Add a term only if you genuinely have that experience.</p>
              </div>
            )}
          </section>

          <section className="card space-y-3">
            <h2 className="h2">AI rewrite suggestions (optional)</h2>
            <p className="text-sm text-muted">Sends your summary, skills and bullet points (no name, email or phone) to the configured AI provider. Suggestions keep your facts and use [placeholders] where a number would help.</p>
            <button className="btn-ghost" onClick={suggest} disabled={ai.busy}>{ai.busy ? <><Loader2 className="h-4 w-4 animate-spin" />Thinking...</> : <><Sparkles className="h-4 w-4" />Suggest improvements</>}</button>
            {ai.error && <p role="alert" className="text-sm text-bad">{ai.error}</p>}
            {ai.data && (
              <div className="space-y-4 text-sm">
                {ai.data.summarySuggestion && <div><p className="font-medium">Summary idea</p><p className="text-muted">{ai.data.summarySuggestion}</p></div>}
                {ai.data.bulletRewrites.map((b, i) => (
                  <div key={i} className="rounded-md border border-line p-3">
                    <p className="text-xs text-muted">Original</p><p>{b.original}</p>
                    <p className="mt-2 text-xs text-muted">Suggestion</p><p>{b.suggestion}</p>
                    {b.needsInfo.length > 0 && <p className="mt-1 text-xs text-warn">You need to supply: {b.needsInfo.join("; ")}</p>}
                  </div>
                ))}
                {ai.data.skillsToConsider.length > 0 && <div><p className="font-medium">Skills to consider adding only if you have them</p><div className="mt-1 flex flex-wrap gap-1.5">{ai.data.skillsToConsider.map((s) => <span key={s} className="chip">{s}</span>)}</div></div>}
                <p className="text-xs text-muted">Generated by {ai.provider}. Review every line for accuracy before using it.</p>
              </div>
            )}
          </section>

          <section className="card space-y-4" key={version}>
            <h2 className="h2">Your profile (edit anything that was read wrongly)</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <Text id="p-name" label="Name" value={profile.name} onChange={(v) => update({ name: v })} />
              <Text id="p-head" label="Professional headline" value={profile.headline} onChange={(v) => update({ headline: v })} />
              <Text id="p-email" label="Email" value={profile.email} onChange={(v) => update({ email: v })} />
              <Text id="p-loc" label="Location" value={profile.location} onChange={(v) => update({ location: v })} />
            </div>
            <div>
              <label htmlFor="p-sum" className="label">Summary</label>
              <textarea id="p-sum" rows={3} className="input" value={profile.summary} onChange={(e) => update({ summary: e.target.value })} />
            </div>
            <ListInput id="p-skills" label="Skills (comma separated)" value={profile.skills} onChange={(v) => update({ skills: v })} />
            <ListInput id="p-titles" label="Target job titles" value={profile.targetTitles} onChange={(v) => update({ targetTitles: v.slice(0, 5) })} hint="Used to prefill job search and score title similarity." />
            <div className="grid gap-3 md:grid-cols-3">
              <ListInput id="p-cert" label="Certifications" value={profile.certifications} onChange={(v) => update({ certifications: v })} />
              <ListInput id="p-lang" label="Languages" value={profile.languages} onChange={(v) => update({ languages: v })} />
              <div>
                <label htmlFor="p-years" className="label">Years of experience (estimated)</label>
                <input id="p-years" type="number" min={0} max={60} className="input" value={profile.yearsExperience ?? ""} onChange={(e) => update({ yearsExperience: e.target.value === "" ? null : Math.max(0, Math.min(60, Number(e.target.value))) })} />
              </div>
            </div>

            <h3 className="pt-2 font-semibold">Employment history</h3>
            {profile.experience.map((x, i) => {
              const set = (patch: Partial<typeof x>) => update({ experience: profile.experience.map((e, j) => (j === i ? { ...e, ...patch } : e)) });
              return (
                <div key={i} className="space-y-2 rounded-md border border-line p-3">
                  <div className="grid gap-2 md:grid-cols-4">
                    <Text id={`x-t-${i}`} label="Title" value={x.title} onChange={(v) => set({ title: v })} />
                    <Text id={`x-c-${i}`} label="Employer" value={x.company} onChange={(v) => set({ company: v })} />
                    <Text id={`x-s-${i}`} label="Start" value={x.start ?? ""} onChange={(v) => set({ start: v })} />
                    <Text id={`x-e-${i}`} label="End" value={x.end ?? ""} onChange={(v) => set({ end: v })} />
                  </div>
                  <LinesInput id={`x-b-${i}`} label="Responsibilities and achievements (one per line)" value={x.bullets} onChange={(v) => set({ bullets: v })} />
                  <button className="text-xs text-muted hover:text-bad" onClick={() => update({ experience: profile.experience.filter((_, j) => j !== i) })}>Remove this role</button>
                </div>
              );
            })}
            <button className="btn-ghost" onClick={() => update({ experience: [...profile.experience, { title: "", company: "", bullets: [] }] })}>Add a role</button>

            <h3 className="pt-2 font-semibold">Education</h3>
            {profile.education.map((x, i) => {
              const set = (patch: Partial<typeof x>) => update({ education: profile.education.map((e, j) => (j === i ? { ...e, ...patch } : e)) });
              return (
                <div key={i} className="grid items-end gap-2 md:grid-cols-[2fr_2fr_1fr_auto]">
                  <Text id={`ed-d-${i}`} label="Degree" value={x.degree} onChange={(v) => set({ degree: v })} />
                  <Text id={`ed-i-${i}`} label="Institution" value={x.institution} onChange={(v) => set({ institution: v })} />
                  <Text id={`ed-y-${i}`} label="Year" value={x.year ?? ""} onChange={(v) => set({ year: v })} />
                  <button className="pb-2 text-xs text-muted hover:text-bad" onClick={() => update({ education: profile.education.filter((_, j) => j !== i) })}>Remove</button>
                </div>
              );
            })}
            <button className="btn-ghost" onClick={() => update({ education: [...profile.education, { degree: "", institution: "" }] })}>Add education</button>

            <h3 className="pt-2 font-semibold">Job preferences</h3>
            <p className="text-xs text-muted">Optional. Preferences adjust the location part of a match score. Eligibility facts below are only what you enter; Job Hub never guesses them from your name, nationality or languages.</p>
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label htmlFor="pref-mode" className="label">Work arrangement</label>
                <select id="pref-mode" className="input" value={profile.preferences.workMode} onChange={(e) => update({ preferences: { ...profile.preferences, workMode: e.target.value as Profile["preferences"]["workMode"] } })}>
                  <option value="any">Any</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option>
                </select>
              </div>
              <ListInput id="pref-loc" label="Preferred cities or countries" value={profile.preferences.locations} onChange={(v) => update({ preferences: { ...profile.preferences, locations: v } })} />
              <div>
                <label htmlFor="pref-sal" className="label">Minimum salary (optional)</label>
                <input id="pref-sal" type="number" min={0} className="input" value={profile.preferences.minSalary ?? ""} onChange={(e) => update({ preferences: { ...profile.preferences, minSalary: e.target.value === "" ? undefined : Number(e.target.value) } })} />
              </div>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={profile.preferences.openToRelocation} onChange={(e) => update({ preferences: { ...profile.preferences, openToRelocation: e.target.checked } })} />Open to relocation</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={profile.preferences.needsSponsorship === true} onChange={(e) => update({ preferences: { ...profile.preferences, needsSponsorship: e.target.checked ? true : undefined } })} />I need visa sponsorship</label>
            </div>
            <button className="btn-primary" onClick={rescore} disabled={rescoring}>{rescoring ? "Scoring..." : "Save edits and re-run analysis"}</button>
          </section>
        </>
      )}
    </div>
  );
}
