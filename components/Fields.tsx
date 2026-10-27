"use client";
import { useState } from "react";

/** Comma-separated list editor. Commits on blur so typing a comma never fights the cursor. */
export function ListInput({ id, label, value, onChange, placeholder, hint }: { id: string; label: string; value: string[]; onChange: (v: string[]) => void; placeholder?: string; hint?: string }) {
  const joined = value.join(", ");
  const [text, setText] = useState(joined);
  const [seen, setSeen] = useState(joined);
  if (joined !== seen) {
    setSeen(joined);
    setText(joined);
  }
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <input id={id} className="input" value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)} onBlur={() => onChange(text.split(",").map((s) => s.trim()).filter(Boolean))} />
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function LinesInput({ id, label, value, onChange }: { id: string; label: string; value: string[]; onChange: (v: string[]) => void }) {
  const joined = value.join("\n");
  const [text, setText] = useState(joined);
  const [seen, setSeen] = useState(joined);
  if (joined !== seen) {
    setSeen(joined);
    setText(joined);
  }
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <textarea id={id} rows={Math.min(8, Math.max(3, value.length + 1))} className="input" value={text} onChange={(e) => setText(e.target.value)} onBlur={() => onChange(text.split("\n").map((s) => s.trim()).filter(Boolean))} />
    </div>
  );
}

export function Text({ id, label, value, onChange, placeholder, type = "text" }: { id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <input id={id} type={type} className="input" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function ScoreRing({ score, size = 132, label }: { score: number; size?: number; label: string }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const color = score >= 75 ? "#4ADE80" : score >= 50 ? "#FFD400" : "#F87171";
  return (
    <div className="relative" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${score} out of 100`}>
      <svg viewBox="0 0 120 120" width={size} height={size}>
        <circle cx="60" cy="60" r={r} fill="none" stroke="#303036" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} transform="rotate(-90 60 60)" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-extrabold">{score}</span>
        <span className="text-xs text-muted">out of 100</span>
      </div>
    </div>
  );
}
