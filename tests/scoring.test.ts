import { describe, expect, it } from "vitest";
import { parseResume } from "@/lib/resume/parse";
import { emptyProfile } from "@/lib/schema";
import { READINESS_WEIGHTS, scoreReadiness } from "@/lib/scoring/readiness";
import { scoreJob, splitRequiredPreferred, titleSimilarity } from "@/lib/scoring/match";
import { dedupeSkills, extractSkills, normalizeSkill } from "@/lib/skills";
import { SAMPLE_RESUME, job } from "./helpers";

const profile = parseResume(SAMPLE_RESUME);

describe("skills", () => {
  it("normalises aliases", () => {
    expect(normalizeSkill("nodejs")).toBe("Node.js");
    expect(normalizeSkill(" js ")).toBe("JavaScript");
    expect(normalizeSkill("k8s")).toBe("Kubernetes");
    expect(normalizeSkill("excel")).toBe("Excel");
  });
  it("does not confuse Java with JavaScript or find skills inside other words", () => {
    expect(extractSkills("We use JavaScript daily")).toEqual(["JavaScript"]);
    expect(extractSkills("Java and React.js, Node.js")).toEqual(expect.arrayContaining(["Java", "React", "Node.js"]));
    expect(extractSkills("Gitlab and github")).not.toContain("Git");
  });
  it("does not treat the verb excel as a skill in free text", () => expect(extractSkills("I excel at teamwork")).toEqual([]));
  it("dedupes case-insensitively", () => expect(dedupeSkills(["react", "React", "reactjs"])).toEqual(["React"]));
});

describe("resume readiness", () => {
  it("scores a good resume above a sparse one and explains each component", () => {
    const good = scoreReadiness(profile);
    const bad = scoreReadiness(parseResume("John Smith\nI like work."));
    expect(good.overall).toBeGreaterThan(bad.overall);
    expect(good.components.map((c) => c.key)).toEqual(["structure", "skills", "experience", "achievements", "completeness"]);
    expect(good.components.every((c) => c.explanation.length > 10 && c.score >= 0 && c.score <= 100)).toBe(true);
    expect(good.label).toBe("ATS-Style Readiness Estimate");
  });
  it("does not score keyword alignment without a target description", () => {
    const r = scoreReadiness(profile);
    expect(r.targetEvaluated).toBe(false);
    expect(r.notes.join(" ")).toMatch(/No target job description/);
  });
  it("detects missing keywords against a target description", () => {
    const r = scoreReadiness(profile, "Looking for React, Kubernetes and Terraform experience.");
    expect(r.targetEvaluated).toBe(true);
    expect(r.missingKeywords).toEqual(expect.arrayContaining(["Kubernetes", "Terraform"]));
    expect(r.missingKeywords).not.toContain("React");
    expect(r.components.find((c) => c.key === "keywords")?.weight).toBeGreaterThan(0);
  });
  it("weights always sum to about 100", () => {
    const r = scoreReadiness(profile, "React Kubernetes");
    expect(Math.abs(r.components.reduce((a, c) => a + c.weight, 0) - 100)).toBeLessThanOrEqual(1);
    expect(READINESS_WEIGHTS.structure).toBe(20);
  });
  it("handles a completely empty profile without throwing", () => {
    const r = scoreReadiness(emptyProfile());
    expect(r.overall).toBeLessThan(30);
    expect(r.confidence).toBe("low");
  });
  it("is deterministic", () => expect(scoreReadiness(profile)).toEqual(scoreReadiness(profile)));
});

describe("job compatibility", () => {
  it("separates required from preferred skills", () => {
    const s = splitRequiredPreferred(job().description);
    expect(s.required).toContain("React");
    expect(s.preferred).toContain("Kubernetes");
  });
  it("reports matched and missing skills as not found in resume", () => {
    const m = scoreJob(profile, job());
    expect(m.matchedRequired).toEqual(expect.arrayContaining(["React", "Node.js", "PostgreSQL"]));
    expect(m.missingPreferred).toEqual(expect.arrayContaining(["Kubernetes", "GraphQL"]));
    expect(m.score).toBeGreaterThan(60);
  });
  it("ranks a better-matching job higher and is reproducible", () => {
    const strong = scoreJob(profile, job());
    const weak = scoreJob(profile, job({ title: "Data Scientist", description: "Python, PyTorch, TensorFlow and Machine Learning required." }));
    expect(strong.score).toBeGreaterThan(weak.score);
    expect(scoreJob(profile, job())).toEqual(strong);
  });
  it("treats missing job requirements as unknown, not as zero", () => {
    const m = scoreJob(profile, job({ description: "Join our friendly team." }));
    expect(m.components.find((c) => c.key === "skills")?.score).toBeNull();
    expect(m.unknown.length).toBeGreaterThan(0);
  });
  it("handles an empty candidate profile", () => {
    const m = scoreJob(emptyProfile(), job());
    expect(m.score).toBeGreaterThanOrEqual(0);
    expect(m.missingRequired.length).toBeGreaterThan(0);
  });
  it("applies location preference only when the user set one", () => {
    const p = { ...profile, preferences: { ...profile.preferences, workMode: "onsite" as const, locations: ["Paris"] } };
    expect(scoreJob(p, job({ remote: "onsite", location: "Paris, France" })).components.find((c) => c.key === "location")?.score).toBe(100);
    expect(scoreJob(p, job({ remote: "onsite", location: "Berlin" })).components.find((c) => c.key === "location")?.score).toBe(25);
    expect(scoreJob(profile, job()).components.find((c) => c.key === "location")?.score).toBeNull();
  });
  it("flags eligibility text without inferring anything about the candidate", () => {
    const m = scoreJob(profile, job({ description: "React role. We cannot offer visa sponsorship. Must be authorized to work in the US." }));
    expect(m.eligibilityNotes.length).toBe(2);
    const needs = scoreJob({ ...profile, preferences: { ...profile.preferences, needsSponsorship: true } }, job({ description: "No visa sponsorship." }));
    expect(needs.eligibilityNotes[0]).toMatch(/your profile says you need/);
  });
  it("title similarity ignores seniority words", () => expect(titleSimilarity("Senior Full Stack Developer", ["Full Stack Developer"])).toBe(1));
});
