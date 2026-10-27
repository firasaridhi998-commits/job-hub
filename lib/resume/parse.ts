import { Profile, ProfileSchema, type Education, type Experience } from "@/lib/schema";
import { dedupeSkills, extractSkills } from "@/lib/skills";

const MON = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const START = `(?:${MON}\\.?\\s+|\\d{1,2}[\\/.]\\s*)?((?:19|20)\\d{2})`;
export const DATE_RANGE = new RegExp(`${START}\\s*(?:-|–|—|to)\\s*(?:${START}|(present|current|now|today|ongoing))`, "i");

const SECTION_PATTERNS: [string, RegExp][] = [
  ["summary", /^(?:professional\s+|career\s+)?(?:summary|profile|about(?:\s+me)?|objective)$|^profil$/i],
  ["experience", /^(?:(?:professional|work|relevant)\s+experience|experience|employment(?:\s+history)?|work\s+history|expériences?\s+professionnelles?)$/i],
  ["education", /^(?:education(?:\s+and\s+training)?|academic\s+(?:background|qualifications)|formation|études)$/i],
  ["skills", /^(?:(?:technical|core|key)\s+skills|skills|competenc(?:ies|es)|compétences|technologies)$/i],
  ["certifications", /^(?:certifications?|licen[cs]es?(?:\s+and\s+certifications?)?|courses|training|certificats?)$/i],
  ["languages", /^(?:languages?|langues)$/i],
  ["projects", /^(?:projects?|personal\s+projects?|projets)$/i],
  ["other", /^(?:interests|hobbies|references|volunteer(?:ing)?|awards|publications|activities)$/i],
];
const BULLET = /^[•\-*–·▪●◦]\s*/;
const KNOWN_LANGS = ["english", "french", "arabic", "german", "spanish", "italian", "portuguese", "chinese", "japanese", "russian", "turkish", "dutch"];

function sectionOf(line: string): string | null {
  const t = line.replace(/[:：]+$/, "").trim();
  if (!t || t.length > 40) return null;
  for (const [key, re] of SECTION_PATTERNS) if (re.test(t)) return key;
  return null;
}

export function splitSections(lines: string[]): Map<string, string[]> {
  const map = new Map<string, string[]>([["header", []]]);
  let cur = "header";
  for (const line of lines) {
    const key = sectionOf(line);
    if (key) {
      cur = key;
      if (!map.has(cur)) map.set(cur, []);
      continue;
    }
    map.get(cur)!.push(line);
  }
  return map;
}

function splitHeader(h: string): { title: string; company: string } {
  const clean = h.replace(BULLET, "").trim();
  const parts = clean.split(/\s+(?:at|@)\s+|\s*[|•·]\s*|\s+[-–—]\s+|,\s+/i).map((s) => s.trim()).filter(Boolean);
  return { title: parts[0] ?? "", company: parts[1] ?? "" };
}

export function parseExperience(lines: string[]): Experience[] {
  const out: Experience[] = [];
  let pending: string[] = [];
  let cur: Experience | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = DATE_RANGE.exec(line);
    if (m && !BULLET.test(line)) {
      const rest = line.replace(DATE_RANGE, "").replace(/[()|,–—\-\s]+$/g, "").replace(/^[()|,–—\-\s]+/g, "");
      const header = [...pending, rest].filter(Boolean).join(" | ");
      pending = [];
      const { title, company } = splitHeader(header);
      cur = { title, company, start: m[1], end: m[2] ?? "Present", bullets: [] };
      out.push(cur);
      continue;
    }
    const nextHasDate = i + 1 < lines.length && DATE_RANGE.test(lines[i + 1]);
    const isBullet = BULLET.test(line);
    if (!isBullet && line.length <= 80 && (nextHasDate || !cur)) {
      pending.push(line);
      if (pending.length > 2) pending.shift();
      continue;
    }
    if (cur) cur.bullets.push(line.replace(BULLET, "").trim());
  }
  return out.slice(0, 25);
}

export function estimateYears(exp: Experience[], nowYear = new Date().getFullYear()): number | null {
  const spans = exp
    .map((e) => {
      const s = Number(e.start);
      const en = /present/i.test(e.end ?? "") ? nowYear : Number(e.end);
      return Number.isFinite(s) && Number.isFinite(en) && en >= s ? ([s, en] as [number, number]) : null;
    })
    .filter((x): x is [number, number] => !!x)
    .sort((a, b) => a[0] - b[0]);
  if (!spans.length) return null;
  let total = 0;
  let [cs, ce] = spans[0];
  for (const [s, e] of spans.slice(1)) {
    if (s <= ce) ce = Math.max(ce, e);
    else {
      total += ce - cs;
      [cs, ce] = [s, e];
    }
  }
  total += ce - cs;
  return Math.max(total, 0);
}

function parseEducation(lines: string[]): Education[] {
  const DEG = /bachelor|master|ph\.?d|doctorate|b\.?sc|m\.?sc|b\.?a\b|m\.?a\b|mba|diploma|licen[cs]e|ingénieur|engineer(?:ing)? degree|degree|baccalaur|bts|dut/i;
  const INST = /universit|institut|school|college|faculty|facult|[ée]cole|academy/i;
  const out: Education[] = [];
  for (const raw of lines) {
    const line = raw.replace(BULLET, "").trim();
    const year = /(?:19|20)\d{2}(?:\s*[-–]\s*(?:(?:19|20)\d{2}|present))?/i.exec(line)?.[0];
    const text = line.replace(/\(?\b(?:19|20)\d{2}(?:\s*[-–]\s*(?:(?:19|20)\d{2}|present))?\)?/i, "").replace(/[,|\s-]+$/, "").trim();
    if (DEG.test(text)) {
      const [degree, inst] = text.split(/\s+[-–—|]\s+|,\s+(?=[A-Z])/);
      out.push({ degree: degree?.trim() ?? text, institution: inst?.trim() ?? "", year });
    } else if (INST.test(text)) {
      const last = out[out.length - 1];
      if (last && !last.institution) {
        last.institution = text;
        if (!last.year) last.year = year;
      } else out.push({ degree: "", institution: text, year });
    }
  }
  return out.slice(0, 12);
}

const splitList = (lines: string[]) =>
  lines.flatMap((l) => l.replace(BULLET, "").split(/[,;|•·]/)).map((s) => s.trim()).filter((s) => s && s.length <= 40 && s.split(" ").length <= 4);

function parseLanguages(lines: string[], fullText: string): string[] {
  const tokens = lines.flatMap((l) => l.split(/[,;|•·\n]/)).map((s) => s.split(/[(:\-–]/)[0].trim().toLowerCase());
  const found = KNOWN_LANGS.filter((k) => tokens.some((t) => t === k || t.startsWith(`${k} `)));
  if (!lines.length && !found.length && /languages?\s*:/i.test(fullText)) return [];
  return found.map((l) => l[0].toUpperCase() + l.slice(1));
}

export function parseResume(text: string): Profile {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const sections = splitSections(lines);
  const header = sections.get("header") ?? [];
  const email = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.exec(text)?.[0] ?? "";
  const phone = /(?<![\d])(\+?\d[\d\s().-]{7,17}\d)(?![\d])/.exec(header.join(" ") || text)?.[1]?.trim() ?? "";
  const name = header.find((l) => !/[@\d]/.test(l) && l.length <= 40 && l.split(" ").length >= 2 && l.split(" ").length <= 4) ?? "";
  const nameIdx = header.indexOf(name);
  const headlineCand = header[nameIdx + 1];
  const looksTitle = headlineCand && headlineCand.length <= 70 && !/[@\d]/.test(headlineCand) && !/^[•\-*]/.test(headlineCand);
  const experience = parseExperience(sections.get("experience") ?? []);
  const headline = looksTitle ? headlineCand : experience[0]?.title ?? "";
  const location = header.find((l) => /^[A-Za-zÀ-ÿ .'-]+,\s*[A-Za-zÀ-ÿ .'-]+$/.test(l) && l !== name && l.length <= 50) ?? "";
  const skillSection = splitList(sections.get("skills") ?? []);
  const skills = dedupeSkills([...skillSection, ...extractSkills(text)]).slice(0, 120);
  const bulletCount = experience.reduce((n, e) => n + e.bullets.length, 0);
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const found = [...sections.keys()].filter((k) => k !== "header" && (sections.get(k)?.length ?? 0) > 0);
  const warnings: string[] = [];
  if (!email) warnings.push("No email address was detected.");
  if (!phone) warnings.push("No phone number was detected.");
  if (wordCount < 200) warnings.push("The resume is very short (under 200 words).");
  if (wordCount > 1300) warnings.push("The resume is long (over 1,300 words); consider trimming to the most relevant content.");
  if (!experience.length) warnings.push("No work-experience entries with date ranges were detected.");
  if (experience.length && bulletCount === 0) warnings.push("Experience entries have no description lines.");
  if (lines.some((l) => l.length > 400)) warnings.push("Some paragraphs are very long. Short bullet points are easier for ATS software and recruiters to scan.");
  for (const need of ["experience", "education", "skills"]) if (!found.includes(need)) warnings.push(`No clearly labelled "${need[0].toUpperCase() + need.slice(1)}" section was detected.`);
  return ProfileSchema.parse({
    name, email, phone, location, headline,
    summary: (sections.get("summary") ?? []).join(" ").slice(0, 1200),
    skills,
    experience,
    education: parseEducation(sections.get("education") ?? []),
    certifications: (sections.get("certifications") ?? []).map((l) => l.replace(BULLET, "").trim()).filter((l) => l.length <= 200).slice(0, 30),
    languages: parseLanguages(sections.get("languages") ?? [], text),
    targetTitles: headline ? [headline] : [],
    yearsExperience: estimateYears(experience),
    meta: { wordCount, sections: found, bulletCount, warnings },
  });
}
