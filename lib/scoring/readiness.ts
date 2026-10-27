import type { Profile } from "@/lib/schema";
import { extractSkills, skillKey } from "@/lib/skills";

/**
 * Scoring weights live here only. Weights are re-normalised over the components
 * that can actually be evaluated (keyword alignment needs a target job description).
 */
export const READINESS_WEIGHTS = {
  structure: 20,
  skills: 20,
  experience: 20,
  achievements: 20,
  completeness: 20,
  keywords: 25,
} as const;
export type ComponentKey = keyof typeof READINESS_WEIGHTS;

export interface ReadinessComponent {
  key: ComponentKey;
  label: string;
  score: number;
  weight: number;
  explanation: string;
  evidence: string[];
  tips: string[];
}
export interface ReadinessResult {
  label: "ATS-Style Readiness Estimate";
  overall: number;
  components: ReadinessComponent[];
  missingKeywords: string[];
  targetEvaluated: boolean;
  priorities: { title: string; detail: string }[];
  confidence: "low" | "medium" | "high";
  notes: string[];
}

const ACTION_VERBS = /^(led|managed|developed|built|designed|implemented|created|improved|increased|reduced|delivered|launched|optimi[sz]ed|automated|analy[sz]ed|coordinated|trained|maintained|deployed|migrated|supervised|negotiated|achieved|established|organi[sz]ed|resolved|mentored|planned|produced|taught|conducted|diagnosed|repaired|installed|configured|wrote|drove|owned|ran|handled|prepared|reviewed|tested|integrated)\b/i;
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const isQuantified = (b: string) => /\d+(?:[.,]\d+)?\s?(?:%|k\b|m\b|\+)|[$€£]\s?\d|\b\d{2,}\b/.test(b.replace(/\b(?:19|20)\d{2}\b/g, ""));

export function scoreReadiness(p: Profile, targetDescription?: string): ReadinessResult {
  const comps: Omit<ReadinessComponent, "weight">[] = [];
  const m = p.meta;
  const bullets = p.experience.flatMap((e) => e.bullets);

  // Structure & readability
  {
    const core = ["experience", "education", "skills"].filter((s) => m.sections.includes(s)).length;
    let s = core * 15 + (m.sections.includes("summary") || p.summary ? 10 : 0);
    s += m.wordCount >= 250 && m.wordCount <= 1000 ? 25 : m.wordCount >= 150 && m.wordCount <= 1300 ? 15 : 5;
    s += (p.email ? 10 : 0) + (p.phone ? 10 : 0);
    comps.push({
      key: "structure", label: "Structure and readability", score: clamp(s),
      explanation: `${core} of 3 core sections (experience, education, skills) were detected; the resume has about ${m.wordCount} words.`,
      evidence: m.warnings.slice(0, 4),
      tips: [
        ...(core < 3 ? ["Use standard section headings such as Experience, Education and Skills so ATS software can find them."] : []),
        ...(!p.summary ? ["Add a two or three line professional summary that names your target role."] : []),
        ...(m.wordCount < 250 || m.wordCount > 1000 ? ["Aim for roughly 300 to 900 words on one or two pages."] : []),
      ],
    });
  }
  // Skills
  {
    const n = p.skills.length;
    comps.push({
      key: "skills", label: "Skills and terminology", score: clamp((n / 12) * 100),
      explanation: `${n} skills were found. About 12 or more relevant skills is a healthy range for most roles.`,
      evidence: p.skills.slice(0, 8),
      tips: n < 8 ? ["List the tools, technologies and methods you have actually used in a dedicated Skills section."] : [],
    });
  }
  // Experience clarity
  {
    const parts = p.experience.map((e) => [!!e.title, !!e.company, !!e.start, e.bullets.length >= 2].filter(Boolean).length / 4);
    const s = parts.length ? (parts.reduce((a, b) => a + b, 0) / parts.length) * 100 : 0;
    comps.push({
      key: "experience", label: "Experience clarity", score: clamp(s),
      explanation: parts.length ? `${p.experience.length} role(s) found; each is checked for title, employer, dates and at least two description lines.` : "No work-experience entries with date ranges could be read.",
      evidence: p.experience.slice(0, 3).map((e) => `${e.title || "(no title)"} at ${e.company || "(no employer)"} ${e.start ?? "?"}-${e.end ?? "?"}`),
      tips: parts.length ? (s < 80 ? ["Give every role a title, employer, date range and at least two bullet points."] : []) : ["Add an Experience section with a title, employer and dates for each role (internships and projects count)."],
    });
  }
  // Achievement specificity
  {
    const verb = bullets.filter((b) => ACTION_VERBS.test(b)).length;
    const quant = bullets.filter(isQuantified).length;
    const s = bullets.length ? (verb / bullets.length) * 50 + (quant / bullets.length) * 50 : 0;
    const weak = bullets.filter((b) => !isQuantified(b)).slice(0, 3);
    comps.push({
      key: "achievements", label: "Achievement specificity", score: clamp(s),
      explanation: bullets.length ? `${verb} of ${bullets.length} bullets start with an action verb and ${quant} include a number, percentage or amount.` : "There are no bullet points describing responsibilities or results.",
      evidence: weak,
      tips: bullets.length && quant < bullets.length / 2 ? ["Where it is true, add the real size, frequency or result of your work. If you do not have a number, describe the outcome in words instead of guessing."] : bullets.length ? [] : ["Describe what you did and what changed because of it, using short bullets that start with a verb."],
    });
  }
  // Completeness
  {
    const checks: [boolean, string][] = [
      [!!p.name, "name"], [!!p.email, "email"], [!!p.phone, "phone"], [!!p.location, "location"], [!!p.summary || !!p.headline, "headline or summary"],
      [p.education.length > 0, "education"], [p.experience.length > 0, "experience"], [p.skills.length > 0, "skills"],
    ];
    const missing = checks.filter(([ok]) => !ok).map(([, n]) => n);
    comps.push({
      key: "completeness", label: "Completeness and consistency", score: clamp(((checks.length - missing.length) / checks.length) * 100),
      explanation: missing.length ? `Not detected: ${missing.join(", ")}. This may mean the item is absent or was not readable.` : "All the basic fields were detected.",
      evidence: [], tips: missing.length ? [`Check that these are present and clearly labelled: ${missing.join(", ")}.`] : [],
    });
  }
  // Keyword alignment (only with a target description)
  const jdSkills = targetDescription ? extractSkills(targetDescription) : [];
  const targetEvaluated = jdSkills.length > 0;
  let missingKeywords: string[] = [];
  const notes: string[] = [];
  if (targetDescription && !targetEvaluated) notes.push("The target description contained no recognisable skills, so keyword alignment was not scored.");
  if (!targetDescription) notes.push("No target job description was supplied, so keyword alignment was not scored.");
  if (targetEvaluated) {
    const have = new Set(p.skills.map(skillKey));
    const resumeText = [p.summary, p.headline, ...p.experience.flatMap((e) => [e.title, ...e.bullets])].join(" ");
    const inText = new Set(extractSkills(resumeText).map(skillKey));
    const matched = jdSkills.filter((s) => have.has(skillKey(s)) || inText.has(skillKey(s)));
    missingKeywords = jdSkills.filter((s) => !matched.includes(s));
    comps.push({
      key: "keywords", label: "Keyword alignment with target", score: clamp((matched.length / jdSkills.length) * 100),
      explanation: `${matched.length} of ${jdSkills.length} skills named in the target description appear in your resume.`,
      evidence: matched.slice(0, 8),
      tips: missingKeywords.length ? [`These terms were not found in the resume: ${missingKeywords.join(", ")}. Add them only if you genuinely have that experience.`] : [],
    });
  }
  const total = comps.reduce((a, c) => a + READINESS_WEIGHTS[c.key], 0);
  const components: ReadinessComponent[] = comps.map((c) => ({ ...c, weight: Math.round((READINESS_WEIGHTS[c.key] / total) * 100) }));
  const overall = clamp(components.reduce((a, c) => a + c.score * (READINESS_WEIGHTS[c.key] / total), 0));
  const priorities = [...components]
    .sort((a, b) => (100 - b.score) * b.weight - (100 - a.score) * a.weight)
    .filter((c) => c.tips.length)
    .slice(0, 4)
    .map((c) => ({ title: c.label, detail: c.tips[0] }));
  const confidence = m.wordCount < 150 || !p.experience.length ? "low" : m.sections.length >= 4 ? "high" : "medium";
  if (confidence === "low") notes.push("Parsing confidence is low. Review the extracted profile before trusting these numbers.");
  return { label: "ATS-Style Readiness Estimate", overall, components, missingKeywords, targetEvaluated, priorities, confidence, notes };
}
