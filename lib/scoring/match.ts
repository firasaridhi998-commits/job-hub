import type { Job, Profile } from "@/lib/schema";
import { extractSkills, skillKey } from "@/lib/skills";

/** Job compatibility weights. Components a job gives no data for are dropped and the rest re-normalised. */
export const MATCH_WEIGHTS = { skills: 50, title: 20, experience: 15, location: 15 } as const;
type Key = keyof typeof MATCH_WEIGHTS;

export interface MatchResult {
  score: number;
  components: { key: Key; score: number | null; weight: number; note: string }[];
  matchedRequired: string[];
  missingRequired: string[];
  matchedPreferred: string[];
  missingPreferred: string[];
  unknown: string[];
  eligibilityNotes: string[];
  explanation: string[];
}

const STOP = new Set(["and", "the", "of", "for", "a", "an", "in", "at", "to", "senior", "junior", "lead", "sr", "jr", "intern", "ii", "iii", "i", "remote"]);
const tokens = (s: string) => s.toLowerCase().replace(/[^a-z0-9+#. ]/g, " ").split(/\s+/).filter((t) => t && !STOP.has(t));

export function titleSimilarity(jobTitle: string, candidateTitles: string[]): number {
  const jt = new Set(tokens(jobTitle));
  if (!jt.size || !candidateTitles.length) return 0;
  return Math.max(...candidateTitles.map((c) => {
    const ct = new Set(tokens(c));
    let hit = 0;
    for (const t of jt) if (ct.has(t)) hit++;
    return hit / jt.size;
  }));
}

export function splitRequiredPreferred(text: string): { required: string; preferred: string } {
  const idx = text.search(/\b(?:preferred|nice to have|nice-to-have|bonus|a plus|desirable|good to have)\b/i);
  return idx < 0 ? { required: text, preferred: "" } : { required: text.slice(0, idx), preferred: text.slice(idx) };
}

export function requiredYears(text: string): number | null {
  const m = /(\d{1,2})\s*\+?\s*(?:-\s*\d{1,2}\s*)?(?:years?|yrs?)\b/i.exec(text);
  return m ? Number(m[1]) : null;
}

export function eligibilityNotes(job: Pick<Job, "description">, p: Profile): string[] {
  const t = job.description;
  const notes: string[] = [];
  if (/(?:no|not\s+(?:able|offer|provid\w*)[^.]{0,30})\s*(?:visa\s+)?sponsorship/i.test(t) || /sponsorship\s+(?:is\s+)?not\s+(?:available|offered|provided)/i.test(t)) {
    notes.push(p.preferences.needsSponsorship === true ? "The listing says no visa sponsorship, and your profile says you need sponsorship." : "The listing says no visa sponsorship is offered. Check this against your own situation.");
  }
  if (/(?:authori[sz]ed|eligible|right)\s+to\s+work/i.test(t)) notes.push("The listing requires existing work authorization. Verify you meet it.");
  if (/security\s+clearance/i.test(t)) notes.push("The listing mentions a security clearance requirement.");
  return notes;
}

export function scoreJob(p: Profile, job: Job): MatchResult {
  const text = `${job.title}\n${job.description}\n${job.requirements.join("\n")}`;
  const { required, preferred } = splitRequiredPreferred(text);
  const reqSkills = extractSkills(required);
  const prefSkills = extractSkills(preferred).filter((s) => !reqSkills.includes(s));
  const resumeSkills = new Set([...p.skills.map(skillKey), ...extractSkills([p.summary, ...p.experience.flatMap((e) => [e.title, ...e.bullets])].join(" ")).map(skillKey)]);
  const has = (s: string) => resumeSkills.has(skillKey(s));
  const matchedRequired = reqSkills.filter(has);
  const missingRequired = reqSkills.filter((s) => !has(s));
  const matchedPreferred = prefSkills.filter(has);
  const missingPreferred = prefSkills.filter((s) => !has(s));
  const unknown: string[] = [];
  const comps: MatchResult["components"] = [];

  if (reqSkills.length + prefSkills.length) {
    const r = reqSkills.length ? matchedRequired.length / reqSkills.length : null;
    const pr = prefSkills.length ? matchedPreferred.length / prefSkills.length : null;
    const s = r !== null && pr !== null ? r * 0.8 + pr * 0.2 : (r ?? pr ?? 0);
    comps.push({ key: "skills", score: Math.round(s * 100), weight: MATCH_WEIGHTS.skills, note: `${matchedRequired.length}/${reqSkills.length} required and ${matchedPreferred.length}/${prefSkills.length} preferred skills found in your resume.` });
  } else {
    unknown.push("The listing does not name skills this app recognises, so skills were not scored.");
    comps.push({ key: "skills", score: null, weight: MATCH_WEIGHTS.skills, note: "No recognisable skills in the listing." });
  }

  const titles = [...p.targetTitles, p.headline, ...p.experience.map((e) => e.title)].filter(Boolean);
  if (titles.length) {
    const s = titleSimilarity(job.title, titles);
    comps.push({ key: "title", score: Math.round(s * 100), weight: MATCH_WEIGHTS.title, note: `Title overlap with your target and past titles: ${Math.round(s * 100)}%.` });
  } else comps.push({ key: "title", score: null, weight: MATCH_WEIGHTS.title, note: "Your profile has no titles to compare." });

  const need = requiredYears(job.description);
  if (need !== null && p.yearsExperience !== null) {
    const s = Math.min(1, p.yearsExperience / Math.max(need, 1));
    comps.push({ key: "experience", score: Math.round(s * 100), weight: MATCH_WEIGHTS.experience, note: `Listing mentions ${need}+ years; your resume suggests about ${p.yearsExperience}.` });
  } else {
    unknown.push(need === null ? "The listing does not state a years-of-experience requirement." : "Your years of experience could not be determined.");
    comps.push({ key: "experience", score: null, weight: MATCH_WEIGHTS.experience, note: "Not enough information." });
  }

  const pref = p.preferences;
  const hasLocPref = pref.locations.length > 0 || pref.workMode !== "any";
  if (hasLocPref) {
    const loc = job.location.toLowerCase();
    const locHit = pref.locations.some((l) => l && loc.includes(l.toLowerCase()));
    const remoteOk = job.remote === "remote" && (pref.workMode === "any" || pref.workMode === "remote" || pref.openToRelocation);
    const modeConflict = job.remote !== "unknown" && pref.workMode !== "any" && job.remote !== pref.workMode && !locHit;
    const s = remoteOk || (locHit && !modeConflict) ? 100 : job.remote === "unknown" && !pref.locations.length ? null : 25;
    comps.push({ key: "location", score: s, weight: MATCH_WEIGHTS.location, note: s === 100 ? "Matches your location or work-mode preference." : s === null ? "Work arrangement not stated." : "Does not match your location or work-mode preference." });
    if (s === null) unknown.push("The listing does not say whether the work is remote or on-site.");
  } else comps.push({ key: "location", score: null, weight: MATCH_WEIGHTS.location, note: "No location preference set." });

  const live = comps.filter((c) => c.score !== null);
  const wsum = live.reduce((a, c) => a + c.weight, 0);
  const score = wsum ? Math.round(live.reduce((a, c) => a + (c.score as number) * c.weight, 0) / wsum) : 0;
  const explanation: string[] = [];
  if (matchedRequired.length) explanation.push(`Strong match: ${matchedRequired.slice(0, 5).join(", ")}.`);
  if (missingRequired.length) explanation.push(`Not found in resume: ${missingRequired.slice(0, 5).join(", ")}. This may be missing from the resume rather than from your experience.`);
  for (const c of comps) if (c.key !== "skills" && c.score !== null) explanation.push(c.note);
  for (const u of unknown.slice(0, 2)) explanation.push(`Unknown: ${u}`);
  return { score, components: comps, matchedRequired, missingRequired, matchedPreferred, missingPreferred, unknown, eligibilityNotes: eligibilityNotes(job, p), explanation };
}
