import { describe, expect, it } from "vitest";
import { ExtractError, extractResumeText, detectKind } from "@/lib/resume/extract";
import { parseResume } from "@/lib/resume/parse";
import { ProfileSchema } from "@/lib/schema";
import { SAMPLE_RESUME, makeDocx, makePdf } from "./helpers";

describe("extraction", () => {
  it("extracts text from a DOCX", async () => {
    const { text, kind } = await extractResumeText(await makeDocx(SAMPLE_RESUME), "cv.docx");
    expect(kind).toBe("docx");
    expect(text).toContain("Software Engineer");
  });
  it("extracts text from a PDF", async () => {
    const { text, kind } = await extractResumeText(makePdf(SAMPLE_RESUME), "cv.pdf");
    expect(kind).toBe("pdf");
    expect(text).toContain("Acme Digital");
  });
  it("rejects a renamed file whose bytes are not PDF/DOCX", async () => {
    await expect(extractResumeText(new TextEncoder().encode("just some text ".repeat(20)), "cv.pdf")).rejects.toMatchObject({ code: "unsupported" });
  });
  it("rejects extension/content mismatch", async () => {
    await expect(extractResumeText(makePdf(SAMPLE_RESUME), "cv.docx")).rejects.toMatchObject({ code: "unsupported" });
  });
  it("rejects oversized files", async () => {
    const big = new Uint8Array(4_000_001);
    await expect(extractResumeText(big, "cv.pdf")).rejects.toBeInstanceOf(ExtractError);
    await expect(extractResumeText(big, "cv.pdf")).rejects.toMatchObject({ code: "too_large" });
  });
  it("reports image-only/empty PDFs as no_text instead of succeeding", async () => {
    await expect(extractResumeText(makePdf(" "), "cv.pdf")).rejects.toMatchObject({ code: "no_text" });
  });
  it("reports a corrupt DOCX", async () => {
    const bad = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5, 6, 7, 8]);
    await expect(extractResumeText(bad, "cv.docx")).rejects.toMatchObject({ code: "corrupt" });
  });
  it("detects kinds from bytes", () => {
    expect(detectKind(makePdf("x"))).toBe("pdf");
    expect(detectKind(new Uint8Array([1, 2, 3, 4, 5]))).toBeNull();
  });
});

describe("profile parsing", () => {
  const p = parseResume(SAMPLE_RESUME);
  it("produces a schema-valid profile", () => expect(ProfileSchema.safeParse(p).success).toBe(true));
  it("finds contact details", () => {
    expect(p.name).toBe("Amine Ben Salah");
    expect(p.email).toBe("amine@example.com");
    expect(p.phone).toContain("216");
  });
  it("finds two roles with dates and bullets", () => {
    expect(p.experience).toHaveLength(2);
    expect(p.experience[0]).toMatchObject({ title: "Software Engineer", company: "Acme Digital", start: "2020", end: "Present" });
    expect(p.experience[0].bullets).toHaveLength(3);
    expect(p.experience[1].company).toBe("Tunis Web Studio");
  });
  it("normalises skills and merges list with text mentions", () => {
    expect(p.skills).toEqual(expect.arrayContaining(["JavaScript", "TypeScript", "React", "Node.js", "SQL", "Docker", "PostgreSQL", "AWS"]));
    expect(new Set(p.skills.map((s) => s.toLowerCase())).size).toBe(p.skills.length);
  });
  it("finds education, certifications and languages", () => {
    expect(p.education[0].degree).toContain("BSc");
    expect(p.certifications).toContain("AWS Cloud Practitioner");
    expect(p.languages).toEqual(expect.arrayContaining(["Arabic", "French", "English"]));
  });
  it("does not invent fields for a nearly empty resume", () => {
    const e = parseResume("Hello\nworld");
    expect(e.experience).toEqual([]);
    expect(e.email).toBe("");
    expect(e.yearsExperience).toBeNull();
    expect(e.meta.warnings.length).toBeGreaterThan(0);
  });
});
