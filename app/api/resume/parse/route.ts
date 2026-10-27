import { LIMITS } from "@/lib/config";
import { errorJson, limited, ok } from "@/lib/http";
import { ExtractError, extractResumeText } from "@/lib/resume/extract";
import { parseResume } from "@/lib/resume/parse";
import { scoreReadiness } from "@/lib/scoring/readiness";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const lim = limited(req, "parse");
  if (lim) return lim;
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > LIMITS.MAX_REQUEST_BYTES) return errorJson(413, "too_large", "The upload is larger than 4 MB.");
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return errorJson(400, "bad_request", "The upload could not be read. Choose a PDF or DOCX file and try again.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) return errorJson(400, "bad_request", "No file was received.");
  if (file.size > LIMITS.MAX_FILE_BYTES) return errorJson(413, "too_large", "The file is larger than 4 MB.");
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { text, kind } = await extractResumeText(bytes, file.name);
    const profile = parseResume(text);
    return ok({ profile, readiness: scoreReadiness(profile), kind }); // resume text itself is never returned or logged
  } catch (e) {
    if (e instanceof ExtractError) return errorJson(e.code === "too_large" ? 413 : 422, e.code, e.message);
    return errorJson(500, "server_error", "Something went wrong while reading the resume. Try again.");
  }
}
