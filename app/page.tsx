import Link from "next/link";
import { FileSearch, Target, ListChecks, Lock } from "lucide-react";
import { Logo } from "@/components/Logo";

const features = [
  { icon: FileSearch, title: "Resume Analysis", body: "Upload a PDF or DOCX. Job Hub reads your skills, experience and education, then scores structure, skills, experience clarity and achievements, with the evidence behind every number." },
  { icon: Target, title: "Smart Job Matching", body: "Search real listings from a licensed job API. Each one gets a compatibility score showing which required skills your resume covers and which it does not mention." },
  { icon: ListChecks, title: "Actionable Recommendations", body: "Get a short, prioritized list of fixes tied to what was actually found in your resume. Suggestions never ask you to invent experience." },
];
const steps = [
  { t: "Upload", d: "Drop in your resume. Text is extracted on the server and kept only in your browser tab." },
  { t: "Review", d: "Check and correct the extracted profile, then read your readiness estimate." },
  { t: "Match", d: "Search jobs and open the original vacancy when one fits." },
];

export default function Home() {
  return (
    <div className="space-y-20">
      <section className="grid items-center gap-10 py-6 md:grid-cols-[1.2fr_1fr]">
        <div>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">Know your resume. Find your next opportunity.</h1>
          <p className="mt-5 max-w-xl text-lg text-muted">Job Hub explains how your resume reads to applicant tracking software, then ranks real job listings by how well they fit what your resume shows.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/analyze" className="btn-primary px-6 py-3 text-base">Analyze My Resume</Link>
            <Link href="/#how" className="btn-ghost px-6 py-3 text-base">See how it works</Link>
          </div>
          <p className="mt-4 text-sm text-muted">Your next opportunity starts here.</p>
        </div>
        <div className="card flex flex-col items-start gap-4 bg-raised" aria-hidden="true">
          <Logo size={44} />
          <div className="w-full space-y-2 text-sm">
            {["Structure and readability", "Skills and terminology", "Experience clarity", "Achievement specificity"].map((l, i) => (
              <div key={l}>
                <div className="mb-1 flex justify-between text-muted"><span>{l}</span></div>
                <div className="h-2 rounded bg-ink"><div className="h-2 rounded bg-accent" style={{ width: `${[72, 58, 80, 41][i]}%` }} /></div>
              </div>
            ))}
            <p className="pt-2 text-xs text-muted">Illustration of the report layout, not real data.</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {features.map(({ icon: Icon, title, body }) => (
          <article key={title} className="card">
            <Icon className="mb-3 h-6 w-6 text-accent" aria-hidden="true" />
            <h2 className="h2">{title}</h2>
            <p className="mt-2 text-sm text-muted">{body}</p>
          </article>
        ))}
      </section>

      <section id="how" className="scroll-mt-24">
        <h2 className="text-2xl font-bold tracking-tight">How it works</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.t} className="card">
              <span className="text-sm font-semibold text-accent">Step {i + 1}</span>
              <h3 className="mt-1 text-lg font-semibold">{s.t}</h3>
              <p className="mt-1 text-sm text-muted">{s.d}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 max-w-3xl text-sm text-muted">The readiness number is an ATS-style estimate calculated by Job Hub. It is not the score any employer system would give you. The job compatibility score compares your resume with a listing. It is not a chance of being hired.</p>
      </section>

      <section className="card flex gap-4">
        <Lock className="mt-1 h-6 w-6 shrink-0 text-accent" aria-hidden="true" />
        <div>
          <h2 className="h2">Privacy</h2>
          <p className="mt-2 max-w-3xl text-sm text-muted">Resumes are processed in memory and are not saved to a database or disk. Your profile lives only in this browser tab and disappears when you refresh or press Discard. If AI suggestions are switched on, a trimmed version of your resume text (without name, email or phone) is sent to the configured AI provider, which handles it under its own terms. Job searches send only the title, location and filters you choose.</p>
        </div>
      </section>

      <footer className="border-t border-line pt-6 text-sm text-muted">
        <p>Job Hub is a private tool for a small group. It helps you find and evaluate openings. It does not apply to jobs for you. Job data comes from third-party providers and can be out of date; always check the original posting.</p>
      </footer>
    </div>
  );
}
