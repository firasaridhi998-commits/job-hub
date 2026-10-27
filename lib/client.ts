export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}
/** Small fetch wrapper that turns the API's {error:{code,message}} shape into exceptions. */
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw new ApiError("aborted", "Cancelled.", 0);
    throw new ApiError("network", "Network problem. Check your connection and try again.", 0);
  }
  if (res.status === 401 && typeof window !== "undefined" && !url.startsWith("/api/auth")) {
    // Hard navigation on purpose: clears any in-memory state after the session ends.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
    throw new ApiError("unauthorized", "Your session expired. Please sign in again.", 401);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(data?.error?.code ?? "error", data?.error?.message ?? "Something went wrong. Try again.", res.status);
  return data as T;
}
