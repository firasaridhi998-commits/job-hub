"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { api } from "@/lib/client";

export default function Login() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/login", { method: "POST", body: JSON.stringify({ code }) });
      router.push("/analyze");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto mt-16 max-w-sm space-y-6">
      <Logo size={40} />
      <form onSubmit={submit} className="card space-y-4">
        <h1 className="h2">Enter the access code</h1>
        <p className="text-sm text-muted">This site is private. Ask the owner for the shared access code.</p>
        <div>
          <label htmlFor="code" className="label">Access code</label>
          <input id="code" type="password" autoComplete="current-password" className="input" value={code} onChange={(e) => setCode(e.target.value)} required />
        </div>
        {error && <p role="alert" className="text-sm text-bad">{error}</p>}
        <button className="btn-primary w-full" disabled={busy || !code}>{busy ? "Checking..." : "Enter Job Hub"}</button>
      </form>
    </div>
  );
}
