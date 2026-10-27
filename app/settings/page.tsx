"use client";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { api } from "@/lib/client";

interface Status {
  access: { configured: boolean };
  ai: { providers: { id: string; model: string; configured: boolean }[]; order: string[] };
  jobs: { provider: string; configured: boolean; missing: string[] };
  limits: { maxFileMB: number };
}

function Row({ ok, title, detail }: { ok: boolean; title: string; detail: string }) {
  const Icon = ok ? CheckCircle2 : CircleAlert;
  return (
    <li className="flex gap-3 py-3">
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${ok ? "text-good" : "text-warn"}`} aria-hidden="true" />
      <div>
        <p className="font-medium">{title} <span className={ok ? "text-good" : "text-warn"}>{ok ? "Configured" : "Missing configuration"}</span></p>
        <p className="text-sm text-muted">{detail}</p>
      </div>
    </li>
  );
}

export default function Settings() {
  const [s, setS] = useState<Status | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(() => { api<Status>("/api/status").then((r) => { setS(r); setErr(""); }).catch((e: Error) => setErr(e.message)); }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings and status</h1>
      <p className="text-sm text-muted">This page shows which server-side integrations are set up. Key values are never shown. To change them, edit the environment variables in your Vercel project (Settings, then Environment Variables) and redeploy.</p>
      {err && <div role="alert" className="card border-bad text-sm">{err} <button className="underline" onClick={load}>Retry</button></div>}
      {!s && !err && <p className="text-muted">Loading status...</p>}
      {s && (
        <ul className="card divide-y divide-line">
          <Row ok={s.access.configured} title="Access code" detail="APP_ACCESS_CODE protects every page and API route. Without it, a production deployment refuses all requests." />
          {s.ai.providers.map((p) => (
            <Row key={p.id} ok={p.configured} title={`AI: ${p.id}`} detail={`Model ${p.model}. ${p.configured ? (s.ai.order.indexOf(p.id) === 0 ? "Used first." : "Available as a fallback.") : "Optional. Resume analysis and job matching work without AI."}`} />
          ))}
          <Row ok={s.jobs.configured} title={`Job search: ${s.jobs.provider}`} detail={s.jobs.configured ? "Real listings are available." : `Set ${s.jobs.missing.join(" and ") || "JOB_SEARCH_PROVIDER to jsearch or adzuna"} to enable job search.`} />
        </ul>
      )}
      <p className="text-sm text-muted">Free tiers of AI and job APIs have quotas and terms that can change. Hosting on Vercel does not make those third-party calls free.</p>
    </div>
  );
}
