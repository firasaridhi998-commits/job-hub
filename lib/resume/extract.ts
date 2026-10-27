import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import { LIMITS } from "@/lib/config";

export type FileKind = "pdf" | "docx";
export type ExtractErrorCode = "unsupported" | "too_large" | "no_text" | "corrupt";

export class ExtractError extends Error {
  constructor(public code: ExtractErrorCode, message: string) {
    super(message);
  }
}

/** Identify the real file type from its bytes, not the extension. */
export function detectKind(bytes: Uint8Array): FileKind | null {
  const head = new TextDecoder("latin1").decode(bytes.slice(0, 1024));
  if (head.includes("%PDF-")) return "pdf";
  if (bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) return "docx";
  return null;
}

export function cleanText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, LIMITS.MAX_TEXT_CHARS);
}

export async function extractResumeText(bytes: Uint8Array, filename: string): Promise<{ text: string; kind: FileKind }> {
  if (bytes.length > LIMITS.MAX_FILE_BYTES) throw new ExtractError("too_large", "The file is larger than 4 MB. Export a smaller PDF or DOCX.");
  const kind = detectKind(bytes);
  const lower = filename.toLowerCase();
  const extKind: FileKind | null = lower.endsWith(".pdf") ? "pdf" : lower.endsWith(".docx") ? "docx" : null;
  if (!kind || !extKind || kind !== extKind) {
    throw new ExtractError("unsupported", "Only genuine PDF and DOCX files are supported (old .doc files are not).");
  }
  let raw = "";
  try {
    if (kind === "pdf") {
      const pdf = await getDocumentProxy(new Uint8Array(bytes));
      const res = await extractText(pdf, { mergePages: true });
      raw = Array.isArray(res.text) ? res.text.join("\n") : res.text;
    } else {
      raw = (await mammoth.extractRawText({ buffer: Buffer.from(bytes) })).value;
    }
  } catch {
    throw new ExtractError("corrupt", "The file could not be read. It may be damaged or password-protected.");
  }
  const text = cleanText(raw);
  if (text.replace(/\s/g, "").length < 80) {
    throw new ExtractError("no_text", "Almost no selectable text was found, so this looks like a scanned or image-only file. OCR is not enabled. Upload a text-based PDF or a DOCX.");
  }
  return { text, kind };
}
