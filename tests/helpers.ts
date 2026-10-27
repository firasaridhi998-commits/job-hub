import { Document, Packer, Paragraph } from "docx";

export const SAMPLE_RESUME = `Amine Ben Salah
Full Stack Developer
amine@example.com | +216 20 123 456
Tunis, Tunisia

Summary
Developer with experience building web applications for small businesses.

Experience
Software Engineer at Acme Digital
Jan 2020 - Present
- Built REST APIs with Node.js and PostgreSQL serving 5000 users
- Improved page load time by 35% using React and caching
- Deployed services with Docker on AWS

Junior Developer | Tunis Web Studio
2017 - 2019
- Developed websites using HTML, CSS and JavaScript
- Maintained client projects and fixed bugs

Education
BSc Computer Science - University of Tunis, 2017

Skills
JavaScript, TypeScript, React, Node.js, SQL, Git, Docker

Certifications
AWS Cloud Practitioner

Languages
Arabic (native), French (fluent), English (professional)
`;

export async function makeDocx(text: string): Promise<Uint8Array> {
  const doc = new Document({ sections: [{ children: text.split("\n").map((l) => new Paragraph(l)) }] });
  return new Uint8Array(await Packer.toBuffer(doc));
}

/** Builds a minimal valid text PDF with correct xref offsets. */
export function makePdf(text: string): Uint8Array {
  const esc = (s: string) => s.replace(/[\\()]/g, "\\$&");
  const content = "BT /F1 10 Tf 14 TL 40 760 Td " + text.split("\n").map((l) => `(${esc(l)}) Tj T*`).join(" ") + " ET";
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(out);
}

import type { Job } from "@/lib/schema";
export const job = (over: Partial<Job> = {}): Job => ({
  id: "x:1", provider: "jsearch", title: "Full Stack Developer", company: "Acme", location: "Remote", remote: "remote",
  description: "We need 3+ years of experience with React, Node.js and PostgreSQL. Nice to have: Kubernetes, GraphQL.",
  requirements: [], applyUrl: "https://example.com/jobs/1", source: "JSearch", lastCheckedAt: "2026-01-01T00:00:00.000Z", ...over,
});
